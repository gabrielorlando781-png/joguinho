"""Exercise real founder creation, movement, delivery, payments and save restoration.

Requires the cloud image's Python Playwright and Chromium. Starts and stops its own
Vite server; never modifies another browser's save or the development server.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:5199'
ARTIFACTS = Path(os.environ.get('GAME_TEST_ARTIFACTS', tempfile.mkdtemp(prefix='devhouse-browser-')))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
errors = []
checks = []


def company(page):
    return page.evaluate("JSON.parse(localStorage.getItem('joguinho-save-v1')).state")


def station(page, x, y):
    canvas = page.locator('#office-canvas').bounding_box()
    scale = min(canvas['width'] / 920, canvas['height'] / 540)
    offset_x = (canvas['width'] - 920 * scale) / 2
    offset_y = (canvas['height'] - 540 * scale) / 2
    page.mouse.click(canvas['x'] + offset_x + x * scale, canvas['y'] + offset_y + y * scale)


def end_day(page):
    page.get_by_role('button', name='Encerrar o dia', exact=False).click()
    page.locator('.modal [data-action="close-modal"]').last.click()


with tempfile.TemporaryFile(mode='w+') as server_log:
    server = subprocess.Popen(
        ['npm', 'run', 'dev', '--', '--port', '5199', '--strictPort'],
        cwd=ROOT, stdout=server_log, stderr=subprocess.STDOUT, start_new_session=True,
    )
    try:
        for _ in range(60):
            if server.poll() is not None:
                server_log.seek(0)
                raise RuntimeError(server_log.read())
            try:
                with urlopen(URL, timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.15)
        else:
            raise RuntimeError('Vite did not start on the isolated test port.')
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(URL, wait_until='networkidle')
            assert page.locator('#profile-form').count() == 1
            page.reload(wait_until='networkidle')
            assert page.locator('#profile-form').count() == 1, 'Reload must not bypass character creation.'
            assert page.evaluate("localStorage.getItem('joguinho-save-v1')") is None
            page.locator('input[name=name]').fill('Gabriel')
            page.locator('input[name=company]').fill('Orlando Studio')
            page.locator('input[name=age]').fill('27')
            page.locator('select[name=trait]').select_option('technical')
            page.locator('input[name=avatarColor][value="#84b9a9"]').check()
            page.get_by_role('button', name='Abrir as portas').click()
            assert company(page)['profile'] == {'name': 'Gabriel', 'company': 'Orlando Studio', 'age': 27, 'trait': 'technical', 'avatarColor': '#84b9a9'}
            checks.append('Founder creation and interrupted-onboarding reload')

            page.locator('.main-nav [data-view=projects]').click()
            page.locator('[data-accept]').first.click()
            assert len(company(page)['projects']) == 1
            assert company(page)['cash'] == 20000, 'A contract must not pay before delivery.'
            page.locator('select[data-project-mode]').select_option('careful')
            assert company(page)['projects'][0]['mode'] == 'careful'
            page.locator('select[data-project-mode]').select_option('standard')
            page.locator('.main-nav [data-view=office]').click()
            # Instrument the existing scene's next draw in the isolated browser;
            # no debug hooks are added to the application code.
            page.evaluate("""async () => {
              const {OfficeScene} = await import('/src/office.js');
              const draw = OfficeScene.prototype.draw;
              OfficeScene.prototype.draw = function (...args) {
                window.__testedScene = this;
                return draw.apply(this, args);
              };
            }""")
            page.wait_for_function('Boolean(window.__testedScene)')
            x_before = page.evaluate('window.__testedScene.player.x')
            page.locator('#office-canvas').focus()
            page.keyboard.down('d')
            page.wait_for_timeout(250)
            page.keyboard.up('d')
            assert page.evaluate('window.__testedScene.player.x') > x_before + 15
            station(page, 242, 162)
            page.wait_for_function("JSON.parse(localStorage.getItem('joguinho-save-v1')).state.projects[0].progress > 0", timeout=8000)
            assert company(page)['manualDeliveryHours'] == 2
            page.keyboard.press('e')
            assert company(page)['manualDeliveryHours'] == 2, 'Repeated interaction cannot generate free work.'
            checks.append('Contract, project modes, WASD movement, click navigation and limited work interaction')

            page.locator('[data-allocation=delivery]').evaluate("e => { e.value = 6; e.dispatchEvent(new Event('change', {bubbles:true})); }")
            assert sum(company(page)['allocation'].values()) == 8
            assert company(page)['allocation']['delivery'] == 6
            for _ in range(12):
                end_day(page)
                assert (company(page)['day'] - 1) % 7 < 5, 'UI skips weekends while accounting for them.'
                if company(page)['stats']['revenue'] > 0:
                    break
            else:
                raise AssertionError('First contract failed to deliver and receive payment.')
            assert company(page)['stats']['delivered'] == 1
            assert company(page)['stats']['revenue'] > 0
            assert company(page)['projects'][0]['paid'] is True
            assert len(company(page)['receivables']) == 0
            checks.append('Eight-hour allocation, day summaries, weekends, delivery and delayed payment')

            page.locator('.main-nav [data-view=team]').click()
            page.locator('[data-hire=lucas][data-contract=PJ]').click()
            assert company(page)['employees'][0]['contract'] == 'PJ'
            page.locator('.main-nav [data-view=office]').click()
            # Stand where the future shared desk will appear, then buy it.
            station(page, 250, 405)
            page.wait_for_function('Math.hypot(window.__testedScene.player.x - 250, window.__testedScene.player.y - 405) < 8', timeout=8000)
            page.locator('.sidebar [data-view=furniture]').click()
            old_cash = company(page)['cash']
            page.locator('[data-buy=desk]').click()
            assert company(page)['cash'] == old_cash - 1500
            page.locator('.main-nav [data-view=office]').click()
            assert page.evaluate('window.__testedScene.canStand(window.__testedScene.player.x, window.__testedScene.player.y)'), 'Purchasing furniture must never trap the player.'
            before_day = company(page)['day']
            before_cash = company(page)['cash']
            end_day(page)
            assert company(page)['cash'] < before_cash - 110, 'Employees must incur payroll.'
            page.reload(wait_until='networkidle')
            assert page.locator('#profile-form').count() == 0
            assert company(page)['profile']['company'] == 'Orlando Studio'
            assert company(page)['day'] > before_day
            assert company(page)['employees'][0]['id'] == 'lucas'
            assert company(page)['furniture'][0]['id'] == 'desk'
            assert company(page)['paused'] is True
            checks.append('Hiring, payroll, furniture collision regression and full save restoration')

            page.locator('[data-action=speed]').click()
            page.locator('[data-action=speed]').click()
            assert company(page)['speed'] == 4
            page.get_by_role('button', name='Retomar tempo', exact=True).click()
            time_before = page.locator('#day-time').inner_text()
            page.wait_for_timeout(1200)
            assert page.locator('#day-time').inner_text() != time_before
            page.get_by_role('button', name='Pausar tempo', exact=True).click()
            page.locator('.sidebar [data-action=guide]').click()
            assert page.get_by_role('dialog').is_visible()
            page.keyboard.press('Escape')
            assert page.get_by_role('dialog').count() == 0
            page.locator('.main-nav [data-view=finance]').click()
            assert page.locator('.ledger-row').first.inner_text().find('Salários') >= 0
            page.locator('.main-nav [data-view=product]').click()
            assert 'próximo capítulo' in page.locator('.product-preview').inner_text().lower()
            page.locator('.main-nav [data-view=office]').click()
            page.wait_for_timeout(4900)
            page.screenshot(path=str(ARTIFACTS / 'devhouse-office.png'), full_page=True)
            checks.append('Live clock, speed, pause, guide, current ledger order and product scope')

            mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
            mobile_page = mobile.new_page()
            mobile_page.on('pageerror', lambda error: errors.append(str(error)))
            mobile_page.goto(URL, wait_until='networkidle')
            mobile_page.screenshot(path=str(ARTIFACTS / 'devhouse-mobile-profile.png'), full_page=True)
            mobile_page.locator('input[name=name]').fill('Ana')
            mobile_page.locator('input[name=company]').fill('Ponto Dev')
            mobile_page.get_by_role('button', name='Abrir as portas').click()
            assert mobile_page.evaluate('document.body.scrollWidth <= innerWidth'), 'Mobile layout must not overflow horizontally.'
            assert mobile_page.locator('#office-canvas').is_visible()
            mobile_page.screenshot(path=str(ARTIFACTS / 'devhouse-mobile-office.png'), full_page=True)
            checks.append('Mobile profile creation and responsive office')
            assert not errors, f'Browser errors: {errors}'
            browser.close()
        print(json.dumps({'passed': len(checks), 'checks': checks, 'browser_errors': errors, 'artifacts': str(ARTIFACTS)}, ensure_ascii=False, indent=2))
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
