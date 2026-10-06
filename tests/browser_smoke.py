"""Exercise office travel, sector decisions, delivery, and existing saved progress.

Requires Python Playwright and Chromium. Owns an isolated Vite process group and
fresh browser contexts; never changes another browser's company or live server.
"""
import base64
import gzip
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SAVE_KEY = 'joguinho-save-v1'
PC_PASSWORD = 'escritorio123'
ARTIFACTS = Path(os.environ.get('GAME_TEST_ARTIFACTS', tempfile.mkdtemp(prefix='devhouse-browser-')))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
errors = []
checks = []


def company(page):
    """Read the rendered company, including migrations not yet saved again."""
    return page.evaluate('JSON.parse(JSON.stringify(window.__testedScene.state))')


def instrument_scene(page):
    # This hook exists only in the isolated test context, never in app code.
    page.evaluate("""async () => {
      const {OfficeScene} = await import('/src/office.js');
      const draw = OfficeScene.prototype.draw;
      OfficeScene.prototype.draw = function (...args) {
        window.__testedScene = this;
        return draw.apply(this, args);
      };
    }""")
    page.wait_for_function('Boolean(window.__testedScene)')


def close_station(page):
    panel = page.locator('#station-panel')
    if panel.is_visible():
        panel.locator('[data-action="close-station"]').first.click()
        panel.wait_for(state='hidden')


def unlock_computer(page, password=PC_PASSWORD):
    """Use the visible game login, creating credentials only on first use."""
    panel = page.locator('#station-panel[data-station="work"]')
    if not panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible():
        return panel
    form = panel.locator('#computer-login-form')
    form.locator('[name="password"]').fill(password)
    if form.locator('[name="confirm"]').count():
        form.locator('[name="confirm"]').fill(password)
    form.locator('button[type="submit"]').click()
    panel.locator('.computer-monitor[data-computer-app-active="desktop"]').wait_for(state='visible')
    return panel


def visit(page, action, pointer=False, authenticate=True):
    """Use ordinary walking routes, with no character teleportation."""
    close_station(page)
    before = page.evaluate("""action => ({x:window.__testedScene.player.x,
      y:window.__testedScene.player.y, near:window.__testedScene.isNearStation(action)})""", action)
    if pointer:
        target = page.evaluate("""action => {
          const scene=window.__testedScene, station=scene.getStation(action);
          const rect=scene.canvas.getBoundingClientRect();
          return {x:rect.left+scene.offsetX+station.labelX*scene.scale,
                  y:rect.top+scene.offsetY+station.labelY*scene.scale};
        }""", action)
        page.mouse.click(target['x'], target['y'])
    else:
        # Exercise the same routing API used by a canvas click, including sectors
        # outside the moving camera. This never teleports or opens a station early.
        assert page.evaluate('action => window.__testedScene.requestInteraction(action)', action)
    panel = page.locator(f'#world-stage #station-panel[data-station="{action}"]')
    if not before['near']:
        assert not panel.is_visible(), f'{action} opened before the character arrived.'
    try:
        panel.wait_for(state='visible', timeout=20000)
    except Exception:
        print(json.dumps(page.evaluate("""action => window.__testedScene ? ({action,player:window.__testedScene.player,
          destination:window.__testedScene.destination,path:window.__testedScene.path,
          pendingAction:window.__testedScene.pendingAction,
          interactionOpen:window.__testedScene.interactionOpen,office:window.__testedScene.state.office,
          obstacles:window.__testedScene.obstacles,
          canStand:window.__testedScene.canStand(window.__testedScene.player.x,window.__testedScene.player.y)})
          : ({action,reason:'The page reloaded while the test was running.'})""", action), ensure_ascii=False))
        page.screenshot(path=str(ARTIFACTS/f'devhouse-route-failure-{action}.png'), full_page=True, animations='disabled')
        raise
    assert page.evaluate('action => window.__testedScene.isNearStation(action)', action), f'{action} opened outside its sector.'
    if not before['near']:
        after = page.evaluate('({x:window.__testedScene.player.x,y:window.__testedScene.player.y})')
        assert abs(after['x']-before['x'])+abs(after['y']-before['y']) > 10
    assert page.locator('#office-canvas').is_visible(), 'Sector decisions must keep the office visible.'
    if action == 'work' and authenticate:
        unlock_computer(page)
    return panel


def computer_app(page, app):
    panel = page.locator('#station-panel[data-station="work"]')
    panel.locator(f'[data-computer-app="{app}"]').first.click()
    panel.locator(f'.computer-monitor[data-computer-app-active="{app}"]').wait_for(state='visible')
    assert page.evaluate('window.__testedScene.player.seated')
    return panel


def development(page):
    visit(page, 'work')
    return computer_app(page, 'development')


def terminal_command(page, command):
    form = page.locator('#terminal-command-form')
    page.wait_for_function("""() => {
      const input=document.querySelector('#terminal-command-form [name="command"]');
      const screen=document.querySelector('.computer-screen');
      if (!input || !screen) return false;
      const box=input.getBoundingClientRect(), monitor=screen.getBoundingClientRect();
      return box.width>0 && box.left>=monitor.left && box.right<=monitor.right
        && box.top>=monitor.top && box.bottom<=monitor.bottom
        && box.left>=0 && box.top>=0 && box.right<=innerWidth && box.bottom<=innerHeight;
    }""")
    form.locator('[name="command"]').fill(command)
    form.locator('[name="command"]').press('Enter')


def answer_puzzle(page, correct=True, typed=False):
    """Choose office decisions by their visible meaning, never the answer key."""
    session = company(page)['workSession']
    puzzle = session['puzzles'][session['index']]
    sensible_prefixes = {
        'priorities': ('Preparar uma versão utilizável', 'Fazer primeiro a tarefa crítica', 'Destravar o login'),
        'scope': ('Negociar um aditivo', 'Registrar o pedido fora do escopo', 'Confirmar por escrito'),
        'cash': ('Nada ainda:', 'O saldo de caixa e as datas reais'),
        'quality': ('Testar o fluxo principal', 'Corrigir a falha principal', 'Conferir o escopo aceito'),
    }
    def sensible(label):
        if label.startswith(sensible_prefixes.get(puzzle['kind'], ())):
            return True
        if puzzle['kind'] == 'cash':
            return label.endswith(', quando o pagamento entrar.')
        if puzzle['kind'] == 'schedule':
            return label == f"{company(page)['allocation']['delivery']}h de entrega." or label.endswith('h; as ações e o deslocamento usam a mesma reserva.') or label == '2h de vendas + 5h de entrega + 1h de revisão.'
        return False
    candidates = [option for option in puzzle['options'] if sensible(option['label'])]
    assert len(candidates) == 1, f'The office decision must have one clear sensible choice: {puzzle["prompt"]}'
    answer = candidates[0] if correct else next(option for option in puzzle['options'] if option['id'] != candidates[0]['id'])
    choice = page.locator(f'[data-puzzle-answer="{answer["id"]}"]')
    assert choice.locator('strong').inner_text() == answer['label']
    if typed:
        terminal_command(page, str(puzzle['options'].index(answer) + 1))
    else:
        choice.click()
    assert company(page)['workSession']['index'] == session['index'] + 1
    assert company(page)['workSession']['mistakes'] == session['mistakes'] + (0 if correct else 1)
    assert page.locator(f'.puzzle-feedback[data-correct="{str(correct).lower()}"]').is_visible()


def end_day(page):
    visit(page, 'exit').locator('[data-action="end-day"]').click()
    page.locator('#day-summary').wait_for(state='visible')
    page.locator('[data-action="continue-day"]').click()
    page.locator('#station-panel').wait_for(state='hidden')
    assert (company(page)['day']-1) % 7 < 5, 'Weekends must be accounted for before returning to work.'


def resolve_events(page):
    pending = [event for event in company(page).get('pendingEvents', []) if event.get('status', 'pending') == 'pending']
    if not pending:
        return 0
    panel = visit(page, 'board')
    panel.locator('[data-station-tab="events"]').first.click()
    resolved = 0
    for _ in pending:
        choices = panel.locator('[data-event][data-choice]:not([disabled])')
        assert choices.count(), 'The project board must offer a decision for a pending event.'
        count_before = len([event for event in company(page).get('pendingEvents', []) if event.get('status', 'pending') == 'pending'])
        choices.first.click()
        count_after = len([event for event in company(page).get('pendingEvents', []) if event.get('status', 'pending') == 'pending'])
        assert count_after < count_before, 'Choosing an event option must resolve the decision.'
        resolved += 1
    close_station(page)
    return resolved


def create_founder(page, name='Gabriel', studio='Orlando Studio'):
    page.locator('input[name="name"]').fill(name)
    page.locator('input[name="company"]').fill(studio)
    page.locator('input[name="age"]').fill('27')
    page.locator('select[name="trait"]').select_option('technical')
    page.locator('input[name="avatarColor"][value="#84b9a9"]').check()
    page.locator('#profile-form button[type="submit"]').click()
    page.locator('#profile-form').wait_for(state='detached')
    instrument_scene(page)


def legacy_fixture():
    """Actual v1 gameplay, captured from 1b8b3d3 through public simulation APIs.

    Embedded to keep this test usable without Git history. Includes a delivered
    contract, an active contract, staff, furniture, history and a D+3 invoice.
    """
    return json.loads(r'''{
      "version":1,"state":{
        "version":1,"profile":{"name":"Fundador antigo","company":"Estudio legado","age":31,"avatarColor":"#84b9a9","trait":"technical"},
        "day":3,"cash":17058,"reputation":14,"energy":84,"debt":0.89,"allocation":{"sales":2,"delivery":5,"quality":1},
        "projects":[
          {"id":"cafe-site-1","title":"Um site com aroma de café","client":"Café Aurora","sector":"Comércio","price":4800,"hours":22,"duration":8,"description":"Site institucional, cardápio e formulário de contato para uma cafeteria do bairro.","receivedDay":1,"expiresDay":19,"progress":22,"deadline":9,"mode":"standard","quality":71.88,"paid":false,"status":"delivered","startedDay":1,"completedDay":2,"invoiceAmount":4800,"dueDay":5},
          {"id":"clinica-agenda-2","title":"Agenda sem papel","client":"Clínica Viver","sector":"Saúde","price":8200,"hours":38,"duration":14,"description":"Um sistema simples para organizar consultas, pacientes e horários disponíveis.","receivedDay":1,"expiresDay":19,"progress":0.47,"deadline":15,"mode":"standard","quality":71.02,"paid":false,"status":"active","startedDay":1}
        ],
        "leads":[{"id":"loja-vitrine-3","title":"A loja entra na internet","client":"Estúdio Ponto","sector":"Varejo","price":6500,"hours":30,"duration":11,"description":"Catálogo digital de produtos com painel de edição e pedidos por mensagem.","receivedDay":1,"expiresDay":19}],
        "employees":[{"id":"lucas","name":"Lucas","role":"Dev frontend","salary":2800,"productivity":6,"trait":"Transforma café em interfaces","color":"#8c79d9","contract":"PJ","hiredDay":1}],
        "furniture":[{"id":"desk","name":"Mesa compartilhada","price":1500,"description":"Mais duas vagas para trazer gente nova para o time.","purchasedDay":1},{"id":"coffee-machine","name":"Cafeteira","price":900,"description":"Cada café recupera 22 de energia em vez de 14.","purchasedDay":1}],
        "receivables":[{"projectId":"cafe-site-1","client":"Café Aurora","amount":4800,"dueDay":5}],
        "ledger":[{"day":2,"label":"Salários e contratos","amount":-161},{"day":2,"label":"Aluguel, internet e custos fixos","amount":-110},{"day":1,"label":"Salários e contratos","amount":-161},{"day":1,"label":"Aluguel, internet e custos fixos","amount":-110},{"day":1,"label":"Cafeteira","amount":-900},{"day":1,"label":"Mesa compartilhada","amount":-1500},{"day":1,"label":"Capital inicial","amount":20000}],
        "log":[{"day":2,"message":"Um site com aroma de café entregue com qualidade 72%. R$ 4800 previstos para o dia 5."},{"day":1,"message":"Cafeteira chegou ao escritório."},{"day":1,"message":"Mesa compartilhada chegou ao escritório."},{"day":1,"message":"Lucas entrou para o time com contrato PJ. Custo por dia útil: R$ 161.00."},{"day":1,"message":"Contrato fechado com Clínica Viver. O pagamento chega três dias após a entrega."},{"day":1,"message":"Contrato fechado com Café Aurora. O pagamento chega três dias após a entrega."},{"day":1,"message":"As portas estão abertas. Seu primeiro cliente está a uma conversa de distância."}],
        "history":[{"day":1,"cash":20000,"revenue":0,"debt":0,"reputation":12},{"day":1,"cash":17329,"revenue":0,"debt":0.74,"reputation":12},{"day":2,"cash":17058,"revenue":0,"debt":0.89,"reputation":14}],
        "stats":{"revenue":0,"delivered":1,"hoursWorked":22},"speed":1,"paused":true,"status":"active","bankrupt":false,"consecutiveNegativeDays":0,"nextLeadId":4,"salesProgress":4,
        "actionHours":0,"manualDeliveryHours":0,"manualQualityHours":0,"manualSalesHours":0,"dailyActions":{"coffee":0,"rest":0,"work":0,"review":0,"prospect":0}
      }
    }''')



def v2_progression_fixture():
    """Genuine v2 save from HEAD 7dc102a, generated through public game APIs.

    The founder bought the five old furniture items, interviewed and hired the
    two candidates, negotiated and delivered thirty contracts in careful
    mode, paid payroll/rent, and resolved real events through day 173. No state
    fields were hand-edited. Includes two unpaid invoices and a full history.
    Compressed only to keep the browser test compact and independent of Git.
    """
    encoded = (
        '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'
        'N8/9prvWPgiV0R+zdTewvnz58v/RP+vA0MYAAA=='
    )
    return json.loads(gzip.decompress(base64.b64decode(encoded)))


def v2_budget_fixture():
    """Genuine v2 company with one hire and two deliveries, after recurring costs.

    Built from the same historical module via buyFurniture, interviewCandidate,
    hireEmployee, two negotiated contracts, and advanceDay; checks cash limits
    without changing the
    company at runtime or issuing failed purchases through hidden app APIs.
    """
    encoded = (
        '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'
    )
    return json.loads(gzip.decompress(base64.b64decode(encoded)))



def saved_context(browser, url, fixture, viewport=None):
    context = browser.new_context(viewport=viewport or {'width':1440,'height':1000}, reduced_motion='reduce')
    context.add_init_script('if (!localStorage.getItem('+json.dumps(SAVE_KEY)+')) localStorage.setItem('+json.dumps(SAVE_KEY)+', '+json.dumps(json.dumps(fixture))+');')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    instrument_scene(page)
    return context, page


def verify_legacy_save(browser, url):
    fixture = legacy_fixture()
    old = fixture['state']
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    context.add_init_script('localStorage.setItem('+json.dumps(SAVE_KEY)+', '+json.dumps(json.dumps(fixture))+');')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    instrument_scene(page)
    assert page.locator('#profile-form').count() == 0, 'A v1 company must not restart founder creation.'
    restored = company(page)
    assert restored['version'] == 3
    for key in ['profile','day','cash','reputation','energy','debt','allocation','ledger','history','stats']:
        assert restored[key] == old[key], f'v1 migration changed {key}.'
    for index, project in enumerate(old['projects']):
        for key, value in project.items():
            assert restored['projects'][index][key] == value, f'v1 migration changed {project["id"]}:{key}.'
    for index, invoice in enumerate(old['receivables']):
        for key, value in invoice.items():
            assert restored['receivables'][index][key] == value, f'v1 migration changed invoice {key}.'
    assert restored['employees'][0]['id'] == 'lucas'
    assert restored['employees'][0]['contract'] == 'PJ'
    assert restored['employees'][0]['salary'] == 2800
    assert [item['id'] for item in restored['furniture']] == ['desk','coffee-machine']
    assert restored['paused'] is True
    assert '4.800' in visit(page, 'finance').inner_text()
    for _ in range(3):
        end_day(page)
    assert company(page)['projects'][0]['paid'] is True
    assert company(page)['stats']['revenue'] >= 4800, 'Old D+3 invoice must still pay after migration.'
    for _ in range(8):
        if company(page)['stats']['delivered'] >= 2:
            break
        end_day(page)
    else:
        raise AssertionError('The migrated active contract failed to unlock the product laboratory.')
    product = visit(page, 'product')
    assert company(page)['product']['unlocked'] is True
    cash_before = company(page)['cash']
    product.locator('[data-product="prototype"]').click()
    assert company(page)['product']['progress'] == 10
    assert company(page)['cash'] == cash_before - 300
    assert product.locator('[data-product="prototype"]').is_disabled()
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-product.png'), full_page=True, animations='disabled')
    end_day(page)
    product = visit(page, 'product')
    cash_before = company(page)['cash']
    product.locator('[data-product="research"]').click()
    assert company(page)['product']['research'] == 1
    assert company(page)['cash'] == cash_before - 150
    assert company(page)['manualQualityHours'] == 1
    context.close()
    checks.append('V1 migration preserves company, active contracts, staff, furniture, history and invoice payment')
    checks.append('Finishing migrated contracts legitimately unlocks product prototype and market research in the laboratory')


def verify_v2_office_progression(browser, url):
    fixture = v2_progression_fixture()
    old = fixture['state']
    context, page = saved_context(browser, url, fixture)
    restored = company(page)
    assert restored['version'] == 3
    for key in ['profile','day','cash','reputation','energy','debt','allocation','ledger','history','stats','furniture']:
        assert restored[key] == old[key], f'V2 migration changed {key}.'
    for kind in ['projects','employees','receivables']:
        for index, entry in enumerate(old[kind]):
            for key, value in entry.items():
                assert restored[kind][index][key] == value, f'V2 migration changed {kind}[{index}].{key}.'
    assert restored['office']['stage'] == 'commercial'
    assert set(restored['office']['rooms'].values()) == {'open'}
    assert restored['office']['nextMaintenanceDay'] == old['day'] + 28
    assert not page.locator('[data-travel="meeting"]').is_visible()
    assert not page.locator('[data-travel="ceo"]').is_visible()
    assert not page.evaluate('window.__testedScene.requestInteraction("meeting")')
    assert not page.evaluate('window.__testedScene.requestInteraction("ceo")')
    checks.append('Genuine v2 company migrates without losing contracts, invoice dates, old equipment or financial history')

    store = visit(page, 'furniture')
    assert store.locator('[role="meter"]').get_attribute('aria-valuemax') == '16'
    assert 'manuten' in store.inner_text().lower()
    store.locator('[data-store-tab="rooms"]').first.click()
    store.locator('[data-room-upgrade="development"]').click()
    assert company(page)['office']['rooms']['development'] == 'partition'
    assert company(page)['office']['rooms']['sales'] == 'open'
    close_station(page)
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-commercial-partition.png'), full_page=True, animations='disabled')
    work = development(page)
    terminal_command(page, 'rotina')
    work.locator('[data-allocation="quality"]').evaluate("element => {element.value=3; element.dispatchEvent(new Event('change',{bubbles:true}));}")
    team = visit(page, 'team')
    team.locator('[data-station-tab="candidates"]').click()
    team.locator('[data-interview="bia"]').click()
    team.locator('[data-hire="bia"][data-contract="PJ"]').click()
    assert company(page)['employees'][-1]['id'] == 'bia'
    assert len(company(page)['employees']) == 3
    store = visit(page, 'furniture')
    store.locator('[data-store-tab="rooms"]').first.click()
    store.locator('[data-room-upgrade="development"]').click()
    assert company(page)['office']['rooms']['development'] == 'dedicated'
    assert company(page)['office']['rooms']['sales'] == 'open'
    close_station(page)
    assert visit(page, 'work').is_visible(), 'A dedicated room must retain a walkable entrance.'
    checks.append('Commercial map has real partition and dedicated walls, independent sector choices and a new staffed workstation')

    store = visit(page, 'furniture')
    store.locator('[data-store-tab="overview"]').first.click()
    cash_before = company(page)['cash']
    assert not store.locator('[data-office-expand]').is_disabled()
    store.locator('[data-office-expand]').click()
    assert company(page)['office']['stage'] == 'floor'
    assert company(page)['cash'] == cash_before - 16000
    if not store.is_visible():
        store = visit(page, 'furniture')
    store.locator('[data-store-tab="workstations"]').first.click()
    founder_post = next(post for post in company(page)['office']['workstations'] if post['employeeId'] == 'founder')
    old_pc = founder_post['computerLevel']
    store.locator(f'[data-computer-upgrade="{founder_post["id"]}"]').click()
    founder_post = next(post for post in company(page)['office']['workstations'] if post['employeeId'] == 'founder')
    assert founder_post['computerLevel'] == old_pc + 1
    store.locator('[data-store-tab="rooms"]').first.click()
    store.locator('[data-room-upgrade="development"]').click()
    assert company(page)['office']['rooms']['development'] == 'glass'
    for level in ['partition','dedicated','glass']:
        store.locator('[data-room-upgrade="sales"]').click()
        assert company(page)['office']['rooms']['sales'] == level
    assert company(page)['office']['rooms']['finance'] == 'open'
    store.locator('[data-office-buy="meeting"]').click()
    assert company(page)['office']['special']['meeting'] is True
    store.locator('[data-office-buy="ceo"]').click()
    assert company(page)['office']['special']['ceo'] is True
    checks.append('Progress unlocks the floor map, individual PC tier, glass rooms and physically accessible special rooms')

    store.locator('[data-store-tab="appearance"]').first.click()
    for item in ['floor','decor','banner']:
        store.locator(f'[data-office-buy="{item}"]').click()
        assert company(page)['office']['amenities'][item] is True
    banner = store.locator('#banner-form')
    banner.locator('[name="bannerText"]').fill('EQUIPE HORIZONTE')
    banner.locator('[name="bannerColor"]').evaluate("element => {element.value='#237b64';element.dispatchEvent(new Event('input',{bubbles:true}));}")
    banner.locator('button[type="submit"]').click()
    assert company(page)['office']['banner'] == {'text':'EQUIPE HORIZONTE','color':'#237b64'}
    assert store.locator('.store-banner-preview').inner_text() == 'EQUIPE HORIZONTE'
    close_station(page)
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-floor-glass.png'), full_page=True, animations='disabled')
    checks.append('Floor, decoration and custom banner have real purchases and persist text/color in the office')

    for action in ['work','board','sales','finance','team','furniture','coffee','rest','product','reception','exit']:
        assert visit(page, action).is_visible()
    meeting = visit(page, 'meeting')
    hours_before = company(page)['actionHours']
    meeting.locator('[data-room-action="alignment"]').click()
    assert company(page)['actionHours'] > hours_before
    assert meeting.locator('[data-room-action="alignment"]').is_disabled()
    hours_before = company(page)['actionHours']
    meeting.locator('[data-room-action="presentation"]').click()
    assert company(page)['actionHours'] > hours_before
    hours_before = company(page)['actionHours']
    meeting.locator('[data-room-action="onboarding"]').click()
    assert company(page)['actionHours'] > hours_before
    ceo = visit(page, 'ceo')
    hours_before = company(page)['actionHours']
    energy_before = company(page)['energy']
    ceo.locator('[data-room-action="focus"]').click()
    assert company(page)['actionHours'] > hours_before
    assert ceo.locator('[data-room-action="focus"]').is_disabled()
    assert company(page)['energy'] > energy_before
    isolation = company(page)['office']['ceoIsolation']
    ceo.locator('[data-room-action="team-time"]').click()
    assert company(page)['office']['ceoIsolation'] < isolation
    close_station(page)
    checks.append('Every floor sector remains reachable with glass walls; meeting and CEO decisions consume actual work hours')

    saved = company(page)
    page.reload(wait_until='networkidle')
    instrument_scene(page)
    assert company(page)['office'] == saved['office'], 'Office progression and banner must survive reload.'
    assert company(page)['employees'] == saved['employees']
    assert company(page)['cash'] == saved['cash']
    assert visit(page, 'meeting').is_visible()
    assert visit(page, 'ceo').is_visible()
    checks.append('Expanded layout, equipment, sector levels, staff onboarding and banner restore from saved progress')
    close_station(page)
    maintenance_day = company(page)['office']['nextMaintenanceDay']
    maintenance = page.evaluate("""async () => {
      const {getOfficeOverview} = await import('/src/simulation.js');
      return getOfficeOverview(window.__testedScene.state).monthlyMaintenance;
    }""")
    while company(page)['day'] <= maintenance_day:
        end_day(page)
    charges = [entry for entry in company(page)['ledger'] if entry['label'] == 'Manutenção mensal de computadores e salas']
    assert len(charges) == 1 and charges[0]['day'] == maintenance_day
    assert charges[0]['amount'] == -maintenance
    assert company(page)['office']['nextMaintenanceDay'] == maintenance_day + 28
    finance = visit(page, 'finance')
    finance.locator('[data-station-tab="ledger"]').click()
    assert 'Manutenção mensal de computadores e salas' in finance.inner_text()
    checks.append('Expanded office bills exactly its displayed PC/room maintenance after 28 days and exposes it in finance')
    close_station(page)
    mobile_fixture = json.loads(page.evaluate('localStorage.getItem('+json.dumps(SAVE_KEY)+')'))
    context.close()
    return mobile_fixture


def verify_store_budget(browser, url):
    fixture = v2_budget_fixture()
    context, page = saved_context(browser, url, fixture)
    assert company(page)['cash'] == fixture['state']['cash'] and 0 < company(page)['cash'] < 600
    store = visit(page, 'furniture')
    before = company(page)
    assert store.locator('[data-office-buy="lounge"]').is_disabled()
    assert 'O caixa não cobre' in store.locator('[data-office-buy="lounge"]').locator('xpath=ancestor::article').inner_text()
    assert store.locator('[data-office-expand]').is_disabled()
    store.locator('[data-store-tab="appearance"]').first.click()
    assert store.locator('[data-office-buy="floor"]').is_disabled()
    assert 'O caixa não cobre' in store.locator('[data-office-buy="floor"]').locator('xpath=ancestor::article').inner_text()
    assert store.locator('[data-office-buy="banner"]').is_disabled()
    assert 'O caixa não cobre' in store.locator('[data-office-buy="banner"]').locator('xpath=ancestor::article').inner_text()
    assert company(page)['cash'] == before['cash']
    assert company(page)['office'] == before['office'], 'Unavailable purchases must not consume positions.'
    checks.append('Authentic low-cash company shows budget limits for floor, banner, lounge and office expansion')
    context.close()


def verify_computer_login(browser, url):
    """Every physical PC session authenticates, without changing the company."""
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    create_founder(page, 'Teste do computador', 'Estudio Retro')
    panel = visit(page, 'work', authenticate=False)
    assert page.evaluate('window.__testedScene.player.seated'), 'The founder must sit down before the PC login.'
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible()
    page.wait_for_function('document.querySelector(\'#computer-login-form [name="password"]\') === document.activeElement')
    first = company(page)
    form = panel.locator('#computer-login-form')
    assert form.locator('[name="confirm"]').is_visible(), 'First use must let the player create a game password.'
    form.locator('[name="password"]').fill(PC_PASSWORD)
    form.locator('[name="confirm"]').fill('senha-diferente')
    form.locator('button[type="submit"]').click()
    panel.locator('.computer-login-error').wait_for(state='visible')
    assert panel.locator('.computer-login-error').is_visible(), 'Mismatched confirmation must explain the failed setup.'
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible()
    unlock_computer(page)
    configured = company(page)
    for key in ['cash','day','projects','office','stats','manualDeliveryHours','manualQualityHours','actionHours']:
        assert configured[key] == first[key], f'Creating a PC password must not change {key}.'
    assert configured['computer']['passwordHash'] and configured['computer']['passwordSalt']
    assert PC_PASSWORD not in json.dumps(configured['computer']), 'The save must not contain the entered password.'
    page.screenshot(path=str(ARTIFACTS/'devhouse-retro-desktop.png'), full_page=True, animations='disabled')

    close_station(page)
    assert not page.evaluate('window.__testedScene.player.seated')
    panel = visit(page, 'work', authenticate=False)
    form = panel.locator('#computer-login-form')
    assert not form.locator('[name="confirm"]').count()
    form.locator('[name="password"]').fill('senha-incorreta')
    form.locator('button[type="submit"]').click()
    panel.locator('.computer-login-error').wait_for(state='visible')
    assert panel.locator('.computer-login-error').is_visible()
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible(), 'A wrong password must keep the desktop locked.'
    assert company(page)['computer'] == configured['computer']
    page.screenshot(path=str(ARTIFACTS/'devhouse-retro-login.png'), full_page=True, animations='disabled')
    unlock_computer(page)
    panel.locator('[data-computer-command="start-menu"]').click()
    panel.locator('.computer-start-menu').wait_for(state='visible')
    panel.locator('[data-computer-command="lock"]').first.click()
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible()
    assert page.evaluate('window.__testedScene.player.seated'), 'Locking the PC must keep the founder at the desk.'
    unlock_computer(page)
    close_station(page)
    saved = company(page)
    page.reload(wait_until='networkidle')
    instrument_scene(page)
    assert company(page)['computer'] == saved['computer'], 'PC credentials must survive a reload.'
    panel = visit(page, 'work', authenticate=False)
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible(), 'Reload must not retain an authenticated session.'
    before_reset = company(page)
    panel.locator('[data-computer-command="reset-password"]').click()
    assert panel.locator('#computer-login-form [name="confirm"]').is_visible()
    panel.locator('[data-computer-command="cancel-reset"]').click()
    assert company(page)['computer'] == before_reset['computer'], 'Cancelling recovery must preserve the existing credential.'
    panel.locator('[data-computer-command="reset-password"]').click()
    recovered_password = 'novo-escritorio'
    unlock_computer(page, recovered_password)
    recovered = company(page)
    assert recovered['computer']['passwordHash'] != before_reset['computer']['passwordHash']
    for key in ['profile','day','cash','projects','employees','office','history','stats','manualDeliveryHours','manualQualityHours','actionHours']:
        assert recovered[key] == before_reset[key], f'Password recovery must preserve {key}.'
    close_station(page)
    panel = visit(page, 'work', authenticate=False)
    unlock_computer(page, recovered_password)
    close_station(page)
    context.close()
    checks.append('First-use password setup validates confirmation and saves a salted credential without spending game time')
    checks.append('Wrong passwords, desktop lock, physical reentry and reload all require the game PC login')
    checks.append('Password recovery and cancellation preserve the founder, company and office progress')


def run_journey(browser, url):
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    assert page.locator('#profile-form').count() == 1
    page.reload(wait_until='networkidle')
    assert page.locator('#profile-form').count() == 1, 'Reload must not bypass founder creation.'
    assert page.evaluate(f'localStorage.getItem({json.dumps(SAVE_KEY)})') is None
    create_founder(page)
    assert company(page)['profile'] == {'name':'Gabriel','company':'Orlando Studio','age':27,'trait':'technical','avatarColor':'#84b9a9'}
    assert page.locator('.game-shell').is_visible()
    assert page.locator('.sidebar, .main-nav, [data-view], #metrics, #management-view').count() == 0
    assert not page.locator('#station-panel').is_visible()
    checks.append('Founder creation, interrupted-onboarding reload and one office without dashboard routes')

    finance = visit(page, 'finance', pointer=True)
    assert '20.000' in finance.inner_text()
    finance.locator('[data-station-tab="credit"]').click()
    finance.locator('[data-action="take-loan"]').click()
    assert company(page)['cash'] == 22000
    assert company(page)['loan']['balance'] == 2000
    finance.locator('[data-action="repay-loan"]').click()
    assert company(page)['cash'] == 20000
    assert company(page)['loan']['balance'] == 0
    assert company(page)['loan']['taken'] is True
    position = page.evaluate('({x:window.__testedScene.player.x,y:window.__testedScene.player.y})')
    page.keyboard.down('a')
    page.wait_for_timeout(180)
    page.keyboard.up('a')
    assert page.evaluate('({x:window.__testedScene.player.x,y:window.__testedScene.player.y})') == position
    page.keyboard.press('Escape')
    page.locator('#station-panel').wait_for(state='hidden')
    assert page.locator('#office-canvas').evaluate('element => element === document.activeElement')
    x_before = page.evaluate('window.__testedScene.player.x')
    page.keyboard.down('d')
    page.wait_for_timeout(180)
    page.keyboard.up('d')
    assert page.evaluate('window.__testedScene.player.x') > x_before + 15
    page.keyboard.press('e')
    page.locator('#station-panel[data-station="finance"]').wait_for(state='visible')
    close_station(page)
    checks.append('Pointer travel gates finance; credit, repayment, movement lock, WASD and nearby E interaction')

    sales = visit(page, 'sales')
    lead_id = sales.locator('[data-discover]').first.get_attribute('data-discover')
    sales.locator(f'[data-discover="{lead_id}"]').click()
    assert company(page)['manualSalesHours'] >= 1
    sales.locator(f'[data-negotiate="{lead_id}"][data-pricing="standard"]').click()
    assert len(company(page)['projects']) == 1
    assert company(page)['cash'] == 20000, 'Contracts must not pay before delivery.'
    project_id = company(page)['projects'][0]['id']
    board = visit(page, 'board')
    board.locator(f'[data-project-mode="{project_id}"]').select_option('careful')
    assert company(page)['projects'][0]['mode'] == 'careful'
    board.locator(f'[data-project-mode="{project_id}"]').select_option('standard')
    board.locator(f'[data-project-priority="{project_id}"]').click()
    assert company(page)['focusProjectId'] == project_id
    checks.append('Sales discovery, negotiated contract, project-board execution mode and founder priority')

    work = development(page)
    untouched = company(page)
    terminal_command(page, 'ajuda')
    assert page.locator('.terminal-history').inner_text().strip()
    terminal_command(page, 'status')
    terminal_command(page, 'comando-desconhecido')
    for key in ['cash','projects','workSession','manualDeliveryHours','manualQualityHours','manualSalesHours','actionHours']:
        assert company(page)[key] == untouched[key], f'Read-only and unknown terminal commands must not change {key}.'
    assert 'comando-desconhecido' in page.locator('.terminal-history').inner_text()
    terminal_command(page, 'limpar')
    assert not page.locator('.terminal-history').count(), 'Clearing the terminal must remove the entire command history.'
    terminal_command(page, 'rotina')
    work.locator('[data-allocation="quality"]').evaluate("element => {element.value=2; element.dispatchEvent(new Event('change',{bubbles:true}));}")
    assert sum(company(page)['allocation'].values()) == 8
    assert company(page)['allocation']['quality'] == 2
    assert page.locator('.computer-monitor[data-computer-app-active="development"]').is_visible()
    assert page.evaluate('window.__testedScene.player.seated && window.__testedScene.player.facing === "up"')
    computer_app(page, 'desktop')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-computer-desktop.png'), full_page=True, animations='disabled')
    work.locator('[data-computer-command="start-menu"]').click()
    work.locator('.computer-start-menu').wait_for(state='visible')
    work.locator('.computer-start-menu [data-computer-app="development"]').click()
    assert not work.locator('.computer-start-menu').count(), 'Opening an app must dismiss the Start menu.'
    work.locator('[data-computer-command="maximize"]').click()
    assert work.locator('[data-computer-window="development"]').get_attribute('class').find('computer-window-maximized') >= 0
    work.locator('[data-computer-command="maximize"]').click()
    assert 'computer-window-maximized' not in work.locator('[data-computer-window="development"]').get_attribute('class')
    work.locator('[data-computer-command="minimize"]').click()
    assert work.locator('.computer-monitor[data-computer-app-active="desktop"]').is_visible()
    computer_app(page, 'development')
    assert company(page)['workSession'] is None
    checks.append('Classic Start menu opens applications and functional window controls minimize, resume and maximize the PC app')
    expansion = computer_app(page, 'expansion')
    assert expansion.locator('.office-store').is_visible()
    before = company(page)['cash']
    expansion.locator('[data-shop-product="item:coffee-machine"]').first.click()
    expansion.locator('[data-shop-buy="item:coffee-machine"]').click()
    assert expansion.locator('[data-shop-page-active="receipt"]').is_visible()
    assert company(page)['cash'] == before - 900
    assert company(page)['office']['stage'] == 'garage'
    laboratory = computer_app(page, 'laboratory')
    assert laboratory.locator('[data-computer-window="laboratory"]').inner_text().strip()
    work = computer_app(page, 'development')
    progress_before = company(page)['projects'][0]['progress']
    hours_before = company(page)['manualDeliveryHours']
    terminal_command(page, 'trabalhar')
    assert company(page)['projects'][0]['progress'] == progress_before
    assert company(page)['manualDeliveryHours'] == hours_before
    assert {puzzle['kind'] for puzzle in company(page)['workSession']['puzzles']} == {'schedule','scope','priorities','cash','quality'}
    answer_puzzle(page, correct=False)
    answer_puzzle(page, correct=True, typed=True)
    partial = company(page)['workSession']
    assert partial['index'] == 2 and partial['mistakes'] == 1
    close_station(page)
    assert not page.evaluate('window.__testedScene.player.seated')
    assert page.evaluate('window.__testedScene.canStand(window.__testedScene.player.x,window.__testedScene.player.y)')
    page.reload(wait_until='networkidle')
    instrument_scene(page)
    assert company(page)['workSession'] == partial
    assert not page.evaluate('window.__testedScene.player.seated')
    work = development(page)
    assert work.locator('.work-puzzle').get_attribute('data-session') == partial['id']
    while company(page)['workSession']['index'] < 5:
        answer_puzzle(page, correct=True, typed=True)
    assert work.locator('.puzzle-results').is_visible()
    assert '4/5' in work.locator('.puzzle-results').inner_text().replace(' ', '')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-computer-puzzles.png'), full_page=True, animations='disabled')
    terminal_command(page, 'concluir')
    assert company(page)['workSession'] is None
    assert company(page)['manualDeliveryHours'] > hours_before
    progress = company(page)['projects'][0]['progress']
    assert progress > progress_before
    assert work.locator('[data-action="start-work-session"]').is_disabled()
    assert company(page)['projects'][0]['progress'] == progress
    checks.append('Physical founder PC sits, opens three virtual apps, buys equipment and stands safely on exit')
    checks.append('Five real office puzzles give right/wrong feedback, save midway and apply one shared two-hour work block')
    checks.append('The interactive terminal accepts read-only commands, numbered puzzle answers and one work conclusion without bypassing the shared hour budget')
    quality_before = company(page)['projects'][0]['quality']
    debt_before = company(page)['debt']
    terminal_command(page, 'revisar')
    assert company(page)['projects'][0]['quality'] > quality_before
    assert company(page)['debt'] < debt_before
    assert company(page)['manualQualityHours'] == 1
    checks.append('Eight-hour allocation, limited manual development and quality review at the computer')

    coffee = visit(page, 'coffee')
    energy_before, cash_before = company(page)['energy'], company(page)['cash']
    coffee.locator('[data-action="coffee"]').click()
    assert company(page)['energy'] > energy_before
    assert company(page)['cash'] == cash_before - 15
    team = visit(page, 'team')
    team.locator('[data-station-tab="candidates"]').click()
    assert team.locator('[data-hire="lucas"][data-contract="PJ"]').is_disabled()
    team.locator('[data-interview="lucas"]').click()
    assert team.locator('[data-hire="lucas"][data-contract="PJ"]').is_disabled(), 'An interview cannot bypass the need for a staffed workstation.'
    furniture = visit(page, 'furniture')
    furniture.locator('[data-store-tab="workstations"]').first.click()
    old_cash = company(page)['cash']
    furniture.locator('[data-office-buy="desk"]').click()
    assert company(page)['cash'] == old_cash - 650
    furniture.locator('[data-office-buy="chair"]').first.click()
    assert company(page)['cash'] == old_cash - 930
    assert page.evaluate('window.__testedScene.canStand(window.__testedScene.player.x,window.__testedScene.player.y)')
    team = visit(page, 'team')
    team.locator('[data-station-tab="candidates"]').click()
    team.locator('[data-hire="lucas"][data-contract="PJ"]').click()
    assert company(page)['employees'][0]['contract'] == 'PJ'
    team.locator('[data-station-tab="main"]').click()
    team.locator('[data-employee-assignment="lucas"]').select_option(project_id)
    assert company(page)['employees'][0]['assignment'] == project_id
    team.locator('[data-employee-role="lucas"]').select_option('quality')
    assert company(page)['employees'][0]['assignmentRole'] == 'quality'
    team.locator('[data-employee-role="lucas"]').select_option('delivery')
    assert company(page)['employees'][0]['assignmentRole'] == 'delivery'
    checks.append('Coffee cost and energy, HR interview, hiring, project assignment and staff role')

    furniture = visit(page, 'furniture')
    furniture.locator('[data-store-tab="workstations"]').first.click()
    assert furniture.locator('[data-office-buy="desk"]').is_disabled(), 'The garage must not allow a third workstation.'
    assert furniture.locator('[data-computer-upgrade]').first.is_disabled(), 'Advanced computers must show their progression gate.'
    furniture.locator('[data-store-tab="overview"]').first.click()
    assert '90' in furniture.inner_text() and 'manuten' in furniture.inner_text().lower()
    finance = visit(page, 'finance')
    finance.locator('[data-station-tab="ledger"]').click()
    assert 'Mesa' in finance.inner_text() and 'Cadeira' in finance.inner_text()
    checks.append('Desk and chair capacity, garage slot limit, computer gate, running costs and finance ledger')

    resolved = 0
    for day_index in range(15):
        end_day(page)
        resolved += resolve_events(page)
        if day_index == 1:
            rest = visit(page, 'rest')
            energy_before, cash_before = company(page)['energy'], company(page)['cash']
            assert energy_before < 100, 'Repeated workdays must make a recovery break useful.'
            rest.locator('[data-action="rest"]').click()
            assert company(page)['energy'] > energy_before
            assert company(page)['cash'] == cash_before - 40
            close_station(page)
        if company(page)['stats']['revenue'] > 0:
            break
    else:
        raise AssertionError('First contract failed to deliver and receive payment.')
    assert company(page)['stats']['delivered'] >= 1
    assert company(page)['projects'][0]['paid'] is True
    assert resolved > 0, 'New contracts must produce a project-event decision.'
    assert any(entry['label']=='Salários e contratos' for entry in company(page)['ledger'])
    checks.append('Exit-sector day closure, weekends, payroll, event choices and delayed payment')

    rest = visit(page, 'rest')
    energy_before = company(page)['energy']
    if energy_before < 100:
        cash_before = company(page)['cash']
        rest.locator('[data-action="rest"]').click()
        assert company(page)['energy'] > energy_before
        assert company(page)['cash'] == cash_before - 40
    assert visit(page, 'product').inner_text().strip()
    assert visit(page, 'reception').inner_text().strip()
    close_station(page)
    checks.append('Rest, product milestones and founder reception require office travel')

    saved = company(page)
    page.reload(wait_until='networkidle')
    instrument_scene(page)
    restored = company(page)
    assert page.locator('#profile-form').count() == 0
    for key in ['profile','cash','day','projects','employees','furniture','receivables','stats',
                'allocation','dailyActions','manualDeliveryHours','manualQualityHours',
                'manualSalesHours','travelHours','officePosition','interviews','pendingEvents',
                'product','loan','office','workSession']:
        assert restored[key] == saved[key], f'Reload lost {key}.'
    assert restored['paused'] is True
    assert not page.locator('#station-panel').is_visible()
    checks.append('Saved company restoration returns to a paused office')

    page.locator('[data-action="speed"]').click()
    page.locator('[data-action="speed"]').click()
    assert company(page)['speed'] == 4
    page.locator('[data-action="pause"]').click()
    clock_before = page.locator('#day-time').inner_text()
    page.wait_for_timeout(1200)
    assert page.locator('#day-time').inner_text() != clock_before
    page.locator('[data-action="pause"]').click()
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-office.png'), full_page=True, animations='disabled')
    visit(page, 'sales')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-sales.png'), full_page=True, animations='disabled')
    checks.append('Live clock, speed, pause and desktop screenshots')

    reception = visit(page, 'reception')
    reception.locator('[data-station-tab="guide"]').click()
    reception.locator('[data-action="new-game"]').click()
    page.locator('.modal [data-action="confirm-new"]').click()
    create_founder(page, 'Nova fundadora', 'Nova historia')
    fresh = company(page)
    assert fresh['cash'] == 20000 and fresh['day'] == 1
    assert not fresh['projects'] and not fresh['employees'] and not fresh['furniture']
    assert not fresh.get('computer', {}).get('passwordHash'), 'A new founder must create their own PC password.'
    assert not page.locator('#station-panel').is_visible()
    assert not page.evaluate('window.__testedScene.interactionOpen')
    assert page.locator('#office-canvas').evaluate('element => element === document.activeElement')
    assert '20.000' in visit(page, 'finance').inner_text()
    checks.append('Restart from reception clears the old station and preserves physical access for the new founder')
    context.close()


def run_mobile(browser, url, advanced_fixture=None):
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    create_founder(page, 'Ana', 'Ponto Dev')
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    assert page.locator('#office-canvas').is_visible()
    visit(page, 'sales', pointer=True)
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-mobile-sales.png'), full_page=True, animations='disabled')
    store = visit(page, 'furniture')
    for tab in ['overview','workstations','rooms','appearance']:
        store.locator(f'[data-store-tab="{tab}"]').first.click()
        assert page.evaluate('document.body.scrollWidth <= innerWidth')
        assert 'undefined' not in store.inner_text()
    store.locator('[data-store-tab="rooms"]').first.click()
    page.screenshot(path=str(ARTIFACTS/'devhouse-v3-mobile-store.png'), full_page=True, animations='disabled')
    checks.append('Mobile founder, pointer station routing and every responsive store tab')
    panel = visit(page, 'work', authenticate=False)
    assert panel.locator('.computer-monitor[data-computer-app-active="login"]').is_visible()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.screenshot(path=str(ARTIFACTS/'devhouse-retro-mobile-login.png'), full_page=True, animations='disabled')
    unlock_computer(page)
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.screenshot(path=str(ARTIFACTS/'devhouse-retro-mobile-desktop.png'), full_page=True, animations='disabled')
    computer_app(page, 'development')
    terminal_command(page, 'ajuda')
    terminal_command(page, 'rotina')
    assert panel.locator('[data-allocation="delivery"]').is_visible()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    panel.locator('[data-computer-command="maximize"]').click()
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    terminal_command(page, 'status')
    page.screenshot(path=str(ARTIFACTS/'devhouse-retro-mobile-terminal.png'), full_page=True, animations='disabled')
    close_station(page)
    assert not page.evaluate('window.__testedScene.player.seated')
    checks.append('Mobile PC login, retro desktop, typed terminal commands, routine controls and maximized window fit the phone viewport')
    context.close()
    if advanced_fixture:
        context, page = saved_context(browser, url, advanced_fixture, {'width':390,'height':844})
        assert company(page)['office']['stage'] == 'floor'
        for action in ['work','sales','finance','team','meeting','ceo']:
            assert visit(page, action).is_visible()
            assert page.evaluate('document.body.scrollWidth <= innerWidth')
        close_station(page)
        page.screenshot(path=str(ARTIFACTS/'devhouse-v3-mobile-floor.png'), full_page=True, animations='disabled')
        checks.append('Mobile camera follows actual walks throughout the floor map, glass sectors and special rooms')
        context.close()


def verify_browser_shop(browser, url):
    context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    create_founder(page, 'Bia', 'Ateliê Digital')
    visit(page, 'work')
    panel = computer_app(page, 'expansion')
    untouched = company(page)
    assert panel.locator('#shop-address').input_value().endswith('/catalogo')
    assert panel.locator('.shop-card').count() > 20
    assert panel.locator('.shop-product-art').count() > 20
    panel.locator('[data-shop-category="areas"]').first.click()
    assert panel.locator('.shop-card').count() == 3
    panel.locator('[data-shop-product="area:commercial"]').first.click()
    assert panel.locator('[data-shop-buy="area:commercial"]').is_disabled()
    assert 'Requer' in panel.locator('.shop-detail-eligibility').inner_text()
    panel.locator('[data-shop-nav="back"]').click()
    assert panel.locator('.shop-card').count() == 3
    panel.locator('[data-shop-nav="forward"]').click()
    assert panel.locator('[data-shop-detail="area:commercial"]').is_visible()
    panel.locator('[data-shop-nav="reload"]').click()
    assert panel.locator('[data-shop-buy="area:commercial"]').is_disabled()
    address = panel.locator('#shop-address')
    address.fill('https://www.espacoecia.game/catalogo/salas')
    address.press('Enter')
    panel.locator('#shop-filter-form [name="roomClass"]').select_option('Sala de vidro')
    panel.locator('#shop-filter-form [type="submit"]').click()
    assert panel.locator('.shop-card').count() == 4
    assert all('Sala de vidro' in name for name in panel.locator('.shop-card-label strong').all_text_contents())
    address.fill('https://example.invalid/catalogo')
    address.press('Enter')
    assert panel.locator('[data-shop-page-active="error"]').is_visible()
    panel.locator('.shop-empty [data-shop-page="home"]').click()
    query = panel.locator('#shop-search-form [name="query"]')
    query.fill('cafeteira')
    query.press('Enter')
    assert panel.locator('.shop-card').count() == 1
    for key in ['cash','projects','office','manualDeliveryHours','manualQualityHours','manualSalesHours']:
        assert company(page)[key] == untouched[key], f'Browser navigation must not change {key}.'
    page.screenshot(path=str(ARTIFACTS/'devhouse-browser-search.png'), full_page=True, animations='disabled')
    checks.append('In-PC browser address, back, forward, refresh, search and class filters navigate without spending company resources')
    panel.locator('[data-shop-category="all"]').first.click()
    page.screenshot(path=str(ARTIFACTS/'devhouse-browser-catalog.png'), full_page=True, animations='disabled')
    panel.locator('[data-shop-product="item:desk"]').first.click()
    panel.locator('[data-shop-buy="item:desk"]').click()
    assert company(page)['cash'] == untouched['cash'] - 650
    assert len(company(page)['office']['workstations']) == 2
    assert panel.locator('[data-shop-page-active="receipt"]').is_visible()
    page.screenshot(path=str(ARTIFACTS/'devhouse-browser-receipt.png'), full_page=True, animations='disabled')
    after = company(page)
    panel.locator('[data-shop-nav="reload"]').click()
    assert company(page)['cash'] == after['cash'], 'Refreshing a receipt must not charge the purchase again.'
    panel.locator('[data-shop-category="desks"]').first.click()
    panel.locator('[data-shop-product="chair:post-2"]').first.click()
    panel.locator('[data-shop-buy="chair:post-2"]').click()
    assert company(page)['office']['workstations'][1]['chair'] is True
    assert company(page)['cash'] == untouched['cash'] - 930
    for _ in range(3):
        panel.locator('[data-shop-nav="back"]').click()
    assert 'Mesa com computador' in panel.locator('.shop-receipt > p').first.inner_text(), 'Back must restore the original order, rather than the latest receipt.'
    assert '19.350' in panel.locator('.shop-receipt dl').inner_text(), 'A historical receipt preserves the balance after its own purchase.'
    for _ in range(3):
        panel.locator('[data-shop-nav="forward"]').click()
    assert 'Cadeira' in panel.locator('.shop-receipt > p').first.inner_text()
    assert company(page)['cash'] == untouched['cash'] - 930
    checks.append('Store product details, installed desk and selected chair generate a receipt and debit the advertised price exactly once')
    saved = company(page)
    close_station(page)
    page.reload(wait_until='networkidle')
    instrument_scene(page)
    assert company(page)['office'] == saved['office']
    assert company(page)['cash'] == saved['cash']
    context.close()

    context, page = saved_context(browser, url, v2_progression_fixture())
    visit(page, 'work')
    panel = computer_app(page, 'expansion')
    before = company(page)
    panel.locator('[data-shop-category="rooms"]').first.click()
    panel.locator('[data-shop-product="room:development:partition"]').first.click()
    assert not panel.locator('[data-shop-buy="room:development:partition"]').is_disabled()
    panel.locator('[data-shop-buy="room:development:partition"]').click()
    assert company(page)['office']['rooms']['development'] == 'partition'
    assert company(page)['cash'] == before['cash'] - 650
    panel.locator('[data-shop-category="areas"]').first.click()
    panel.locator('[data-shop-product="area:floor"]').first.click()
    page.screenshot(path=str(ARTIFACTS/'devhouse-browser-area.png'), full_page=True, animations='disabled')
    before = company(page)
    panel.locator('[data-shop-buy="area:floor"]').click()
    assert company(page)['office']['stage'] == 'floor'
    assert company(page)['cash'] == before['cash'] - 16000
    if not panel.is_visible():
        visit(page, 'work')
        panel = computer_app(page, 'expansion')
    panel.locator('[data-shop-category="hardware"]').first.click()
    panel.locator('[data-shop-product="pc:post-1:3"]').first.click()
    before = company(page)['cash']
    panel.locator('[data-shop-buy="pc:post-1:3"]').click()
    assert company(page)['office']['workstations'][0]['computerLevel'] == 3
    assert company(page)['cash'] == before - 3600
    checks.append('Eligible room classes, area expansion and workstation-specific hardware purchases use the actual office progression and save it')
    context.close()

    context, page = saved_context(browser, url, v2_progression_fixture(), {'width':390,'height':844})
    visit(page, 'work')
    panel = computer_app(page, 'expansion')
    for category in ['all','areas','rooms','desks','hardware','comfort','identity']:
        panel.locator(f'[data-shop-category="{category}"]').first.click()
        assert panel.locator('.shop-card').count()
        assert page.evaluate('document.body.scrollWidth <= innerWidth')
        assert panel.locator('.shop-browser-viewport').evaluate('el => el.scrollWidth <= el.clientWidth + 1')
    panel.locator('[data-shop-category="rooms"]').first.click()
    panel.locator('[data-shop-toggle-filters]').click()
    panel.locator('#shop-filter-form [name="roomClass"]').select_option('Divisórias')
    panel.locator('#shop-filter-form [type="submit"]').click()
    assert panel.locator('.shop-card').count() == 4
    panel.locator('[data-shop-product="room:development:partition"]').first.click()
    before = company(page)['cash']
    panel.locator('[data-shop-buy="room:development:partition"]').click()
    assert company(page)['cash'] == before - 650
    panel.locator('[data-shop-category="rooms"]').first.click()
    page.screenshot(path=str(ARTIFACTS/'devhouse-browser-mobile.png'), full_page=True, animations='disabled')
    checks.append('Mobile in-PC store scrolls every category, opens details and installs an eligible room without horizontal overflow')
    context.close()


def verify_minimal_office(browser, url):
    fixtures = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', """
      import {createGame} from './src/simulation.js';
      const state=createGame({name:'Marina Souza',company:'Estúdio Aurora',age:28,trait:'balanced'});
      console.log(JSON.stringify(['garage','commercial','floor'].map(stage=>({version:3,state:{...state,office:{...state.office,stage}}}))));
    """], cwd=ROOT, text=True))
    for viewport in [{'width':1440,'height':1000}, {'width':1920,'height':1080},
                     {'width':2560,'height':1080}, {'width':390,'height':844},
                     {'width':320,'height':568}, {'width':844,'height':390}]:
        for fixture in fixtures:
            context, page = saved_context(browser, url, fixture, viewport)
            assert page.locator('.office-compass, .walk-help, .world-watermark, #context-prompt').count() == 0
            assert page.locator('.world-topbar .brand').count() == 0
            assert page.locator('#company-name').inner_text() == 'Estúdio Aurora'
            assert page.locator('#founder-name').inner_text() == 'Marina Souza'
            geometry = page.evaluate("""() => {
              const s=window.__testedScene, b=s.viewBounds;
              const rects=[...document.querySelectorAll('.world-topbar > *')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
              return {left:s.offsetX+b.x*s.scale, right:s.offsetX+(b.x+b.w)*s.scale,
                top:s.offsetY+b.y*s.scale,bottom:s.offsetY+(b.y+b.h)*s.scale,
                width:innerWidth,height:innerHeight,rects,overflow:document.body.scrollWidth>innerWidth};
            }""")
            assert geometry['left'] <= .01 and geometry['top'] <= .01
            assert geometry['right'] >= viewport['width']-.01 and geometry['bottom'] >= viewport['height']-.01
            assert not geometry['overflow']
            for index, rect in enumerate(geometry['rects']):
                assert 0 <= rect['left'] < rect['right'] <= viewport['width']
                if index:
                    assert geometry['rects'][index-1]['right'] <= rect['left']
            stage=fixture['state']['office']['stage']
            page.screenshot(path=str(ARTIFACTS/f'office-{stage}-{viewport["width"]}x{viewport["height"]}.png'), animations='disabled')
            if stage == 'garage':
                page.locator('[data-action="settings"]').click()
                assert page.locator('.settings-brand').is_visible()
                page.locator('[data-action="settings-help"]').click()
                assert page.locator('#modal-title').inner_text() == 'Como jogar'
                page.keyboard.press('Escape')
                if viewport['width'] == 1920:
                    page.locator('[data-action="settings"]').click()
                    page.locator('[data-action="fullscreen"]').click()
                    page.wait_for_function('Boolean(document.fullscreenElement)')
                    page.locator('[data-action="fullscreen"]').click()
                    page.wait_for_function('!document.fullscreenElement')
                    page.keyboard.press('Escape')
                visit(page,'work')
                panel=page.locator('#station-panel')
                rect=panel.bounding_box()
                assert rect['y'] >= 60 and rect['y']+rect['height'] <= viewport['height']+1, rect
                assert panel.locator('.computer-screen').bounding_box()['height'] > max(130, viewport['height']-210)
                computer_app(page,'expansion')
                assert panel.locator('.shop-browser').is_visible()
                assert panel.locator('.shop-browser-viewport').bounding_box()['height'] >= 70
                panel.locator('[data-computer-command="maximize"]').click()
                assert panel.bounding_box()['height'] >= viewport['height'] - 18
                assert panel.locator('.shop-browser-viewport').bounding_box()['height'] >= 70
                panel.locator('[data-computer-command="maximize"]').click()
                assert page.evaluate('document.body.scrollWidth <= innerWidth')
                page.screenshot(path=str(ARTIFACTS/f'computer-{viewport["width"]}x{viewport["height"]}.png'), animations='disabled')
                close_station(page)
            context.close()
    checks.append('Office fills all six desktop, ultrawide and mobile viewports across all three maps; minimal HUD has no overlap or removed navigation')
    checks.append('Settings, help and native fullscreen work; larger computer and expansion browser stay inside every viewport')


def main():
    with socket.socket() as free_port:
        free_port.bind(('127.0.0.1', 0))
        port = free_port.getsockname()[1]
    url = f'http://127.0.0.1:{port}'
    # Snapshot app sources so builds in the shared checkout cannot trigger a
    # Vite HTML/HMR reload halfway through a physical office journey.
    with tempfile.TemporaryDirectory(prefix='devhouse-browser-source-') as snapshot_dir, tempfile.TemporaryFile(mode='w+') as server_log:
        snapshot = Path(snapshot_dir)
        shutil.copytree(ROOT / 'src', snapshot / 'src')
        if (ROOT / 'public').exists():
            shutil.copytree(ROOT / 'public', snapshot / 'public')
        for filename in ['index.html','package.json']:
            shutil.copy2(ROOT / filename, snapshot / filename)
        for config in ROOT.glob('vite.config.*'):
            shutil.copy2(config, snapshot / config.name)
        (snapshot / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        server = subprocess.Popen(['npm','run','dev','--','--port',str(port),'--strictPort'],
            cwd=snapshot, stdout=server_log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            for _ in range(60):
                if server.poll() is not None:
                    server_log.seek(0)
                    raise RuntimeError(server_log.read())
                try:
                    with urlopen(url, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.15)
            else:
                raise RuntimeError('Vite did not start on the isolated test port.')
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
                try:
                    suite = os.environ.get('GAME_BROWSER_SUITE')
                    if suite != 'shop':
                        verify_minimal_office(browser, url)
                    if suite != 'hud':
                        verify_browser_shop(browser, url)
                    if suite not in ('shop', 'hud'):
                        verify_computer_login(browser, url)
                        run_journey(browser, url)
                        verify_legacy_save(browser, url)
                        advanced_fixture = verify_v2_office_progression(browser, url)
                        verify_store_budget(browser, url)
                        run_mobile(browser, url, advanced_fixture)
                    assert not errors, f'Browser errors: {errors}'
                except Exception:
                    for index, context in enumerate(browser.contexts):
                        for page_index, page in enumerate(context.pages):
                            if page.is_closed():
                                continue
                            page.screenshot(path=str(ARTIFACTS/f'devhouse-failure-{index}-{page_index}.png'), full_page=True, animations='disabled')
                    print(json.dumps({'completed_checks':checks,'browser_errors':errors,'artifacts':str(ARTIFACTS)}, ensure_ascii=False), flush=True)
                    raise
                finally:
                    browser.close()
            print(json.dumps({'passed':len(checks),'checks':checks,'browser_errors':errors,'artifacts':str(ARTIFACTS)}, ensure_ascii=False, indent=2))
        finally:
            try:
                os.killpg(server.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid, signal.SIGKILL)
                server.wait(timeout=5)


if __name__ == '__main__':
    main()
