"""Exercise office travel, sector decisions, delivery, and existing saved progress.

Requires Python Playwright and Chromium. Owns an isolated Vite process group and
fresh browser contexts; never changes another browser's company or live server.
"""
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
        panel.locator('[data-action="close-station"]').click()
        panel.wait_for(state='hidden')


def visit(page, action, pointer=False):
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
        assert page.evaluate('action => window.__testedScene.requestInteraction(action)', action), f'No route to {action}.'
    panel = page.locator(f'#world-stage #station-panel[data-station="{action}"]')
    if not before['near']:
        assert not panel.is_visible(), f'{action} opened before the character arrived.'
    try:
        panel.wait_for(state='visible', timeout=20000)
    except Exception:
        print(json.dumps(page.evaluate("""action => window.__testedScene ? ({action,player:window.__testedScene.player,
          destination:window.__testedScene.destination,path:window.__testedScene.path,
          pendingAction:window.__testedScene.pendingAction,
          interactionOpen:window.__testedScene.interactionOpen,
          canStand:window.__testedScene.canStand(window.__testedScene.player.x,window.__testedScene.player.y)})
          : ({action,reason:'The page reloaded while the test was running.'})""", action), ensure_ascii=False))
        page.screenshot(path=str(ARTIFACTS/f'devhouse-route-failure-{action}.png'), full_page=True)
        raise
    assert page.evaluate('action => window.__testedScene.isNearStation(action)', action), f'{action} opened outside its sector.'
    if not before['near']:
        after = page.evaluate('({x:window.__testedScene.player.x,y:window.__testedScene.player.y})')
        assert abs(after['x']-before['x'])+abs(after['y']-before['y']) > 10
    assert page.locator('#office-canvas').is_visible(), 'Sector decisions must keep the office visible.'
    return panel


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


def verify_legacy_save(browser, url):
    fixture = legacy_fixture()
    old = fixture['state']
    context = browser.new_context(viewport={'width':1440,'height':1000})
    context.add_init_script('localStorage.setItem('+json.dumps(SAVE_KEY)+', '+json.dumps(json.dumps(fixture))+');')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    instrument_scene(page)
    assert page.locator('#profile-form').count() == 0, 'A v1 company must not restart founder creation.'
    restored = company(page)
    assert restored['version'] == 2
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
    page.screenshot(path=str(ARTIFACTS/'devhouse-v2-product.png'), full_page=True)
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


def run_journey(browser, url):
    context = browser.new_context(viewport={'width':1440,'height':1000})
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

    work = visit(page, 'work')
    work.locator('[data-allocation="quality"]').evaluate("element => {element.value=2; element.dispatchEvent(new Event('change',{bubbles:true}));}")
    assert sum(company(page)['allocation'].values()) == 8
    assert company(page)['allocation']['quality'] == 2
    work.locator('[data-action="work"]').click()
    assert company(page)['manualDeliveryHours'] > 0
    progress = company(page)['projects'][0]['progress']
    repeat = work.locator('[data-action="work"]')
    if not repeat.is_disabled():
        repeat.click()
    assert company(page)['projects'][0]['progress'] == progress
    quality_before = company(page)['projects'][0]['quality']
    debt_before = company(page)['debt']
    work.locator('[data-action="review"]').click()
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
    old_cash = company(page)['cash']
    furniture.locator('[data-buy="desk"]').click()
    assert company(page)['cash'] == old_cash - 1500
    assert page.evaluate('window.__testedScene.canStand(window.__testedScene.player.x,window.__testedScene.player.y)')
    assert furniture.locator('[data-buy="desk"]').is_disabled()
    finance = visit(page, 'finance')
    finance.locator('[data-station-tab="ledger"]').click()
    assert 'Mesa compartilhada' in finance.inner_text()
    checks.append('Furniture purchase, duplicate prevention, safe collision and sector finance ledger')

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
                'product','loan']:
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
    page.screenshot(path=str(ARTIFACTS/'devhouse-v2-office.png'), full_page=True)
    visit(page, 'sales')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v2-sales.png'), full_page=True)
    checks.append('Live clock, speed, pause and desktop screenshots')

    reception = visit(page, 'reception')
    reception.locator('[data-station-tab="guide"]').click()
    reception.locator('[data-action="new-game"]').click()
    page.locator('.modal [data-action="confirm-new"]').click()
    create_founder(page, 'Nova fundadora', 'Nova historia')
    fresh = company(page)
    assert fresh['cash'] == 20000 and fresh['day'] == 1
    assert not fresh['projects'] and not fresh['employees'] and not fresh['furniture']
    assert not page.locator('#station-panel').is_visible()
    assert not page.evaluate('window.__testedScene.interactionOpen')
    assert page.locator('#office-canvas').evaluate('element => element === document.activeElement')
    assert '20.000' in visit(page, 'finance').inner_text()
    checks.append('Restart from reception clears the old station and preserves physical access for the new founder')
    context.close()


def run_mobile(browser, url):
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url, wait_until='networkidle')
    create_founder(page, 'Ana', 'Ponto Dev')
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    assert page.locator('#office-canvas').is_visible()
    visit(page, 'sales', pointer=True)
    assert page.evaluate('document.body.scrollWidth <= innerWidth')
    page.screenshot(path=str(ARTIFACTS/'devhouse-v2-mobile-sales.png'), full_page=True)
    checks.append('Mobile founder, pointer station routing and responsive sector layout')
    context.close()


def main():
    with socket.socket() as free_port:
        free_port.bind(('127.0.0.1', 0))
        port = free_port.getsockname()[1]
    url = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryFile(mode='w+') as server_log:
        server = subprocess.Popen(['npm','run','dev','--','--port',str(port),'--strictPort'],
            cwd=ROOT, stdout=server_log, stderr=subprocess.STDOUT, start_new_session=True)
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
                    run_journey(browser, url)
                    verify_legacy_save(browser, url)
                    run_mobile(browser, url)
                    assert not errors, f'Browser errors: {errors}'
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
