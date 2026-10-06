import './style.css';
import { OfficeScene } from './office.js';
import { renderOfficeStore } from './store-ui.js';
import { renderFinanceBoard } from './finance-ui.js';
import { createShopBrowser, currentShopRoute, navigateShop, parseShopAddress, renderShopBrowser, getShopCatalog } from './shop-browser.js';
import { renderComputer, renderDevelopmentTerminal } from './computer-ui.js';
import { getComputerLoginMode, configureComputerPassword, authenticateComputer, parseTerminalCommand } from './computer-session.js';
import { icon, escape, money, pct, avatar } from './ui.js';
import { TEST_SAVE_KEY, TEST_MODE_KEY, enableLocalTest, isLocalTestState } from './local-test.js';
import { CANDIDATES, createGame, loadGame, saveGame, advanceDay, prospect, hireEmployee, setAllocation, setProjectMode, performAction, negotiateProject, discoverLead, interviewCandidate, assignEmployee, resolveProjectEvent, setProjectPriority, collectReceivable, renegotiateReceivable, anticipateReceivable, investProduct, recordTravel, takeLoan, repayLoan, getOfficeOverview, getRoomEffects, ROOM_ACTIONS, getRoomActionEligibility, purchaseOfficeItem, expandOffice, upgradeRoom, customizeBanner, upgradeComputer, performRoomAction, getNegotiationChance, getWorkSession, getWorkSessionEligibility, startWorkSession, answerWorkPuzzle, completeWorkSession } from './simulation.js';

const testRequest = new URL(location.href).searchParams.get('teste');
let localTestMode = testRequest === '1';
try {
  if (testRequest === '1') localStorage.setItem(TEST_MODE_KEY, '1');
  else if (testRequest === '0') localStorage.removeItem(TEST_MODE_KEY);
  else localTestMode = localStorage.getItem(TEST_MODE_KEY) === '1';
} catch { /* The URL still activates a session if browser storage is unavailable. */ }
const storageKey = localTestMode ? TEST_SAVE_KEY : undefined;
const testSaved = localTestMode ? loadGame(TEST_SAVE_KEY) : null;
const saved = localTestMode ? testSaved || loadGame() : loadGame();
let gameStarted = Boolean(saved);
let state = saved || createGame({ name: 'Alex', company: 'Sua empresa', age: 26, avatarColor: '#adc972', trait: 'balanced' });
if (localTestMode) enableLocalTest(state, !testSaved);
state.paused = true;
let elapsed = 0;
let scene;
let currentStation = null;
let panelWasPaused = true;
let panelTab = 'main';
let financeDay = null;
let financePeriod = null;
let computerApp = 'desktop';
let shopBrowser = createShopBrowser();
let computerUnlocked = false;
let computerLoginMode = null;
let computerLoginError = '';
let computerLoginBusy = false;
let computerSessionId = 0;
let computerStartMenuOpen = false;
let computerMaximized = false;
let terminalView = 'work';
let terminalHistory = [];
let pendingSummary = null;
let toastTimer;
let positionTimer;
let lastModalTrigger;
const stations = {
  work: { title: 'Meu computador', subtitle: 'Sente para desenvolver, planejar a expansão e criar produtos', icon: 'code', short: 'Meu PC' },
  sales: { title: 'Mesa comercial', subtitle: 'Converse, descubra o escopo e negocie', icon: 'message', short: 'Comercial' },
  board: { title: 'Quadro de projetos', subtitle: 'Prazos, entregas e decisões do time', icon: 'folder', short: 'Projetos' },
  finance: { title: 'Setor financeiro', subtitle: 'Fluxo de caixa, cobranças e crédito', icon: 'wallet', short: 'Financeiro' },
  team: { title: 'Pessoas & cultura', subtitle: 'Entreviste, contrate e distribua responsabilidades', icon: 'people', short: 'RH' },
  furniture: { title: 'Loja do escritório', subtitle: 'Cada compra muda o espaço, a rotina e o caixa', icon: 'chair', short: 'Loja' },
  meeting: { title: 'Sala de reunião', subtitle: 'Alinhe pessoas, apresente propostas e integre o time', icon: 'people', short: 'Reuniões' },
  ceo: { title: 'Sala do fundador', subtitle: 'Foco e prestígio, sem perder o contato com a equipe', icon: 'target', short: 'CEO' },
  coffee: { title: 'Copa', subtitle: 'Uma pequena pausa também faz parte do trabalho', icon: 'coffee', short: 'Café' },
  rest: { title: 'Cantinho de descanso', subtitle: 'Uma equipe descansada constrói melhor', icon: 'sun', short: 'Descanso' },
  product: { title: 'Laboratório de produto', subtitle: 'Transforme problemas conhecidos em uma aposta sua', icon: 'bulb', short: 'Laboratório' },
  reception: { title: 'Diário do fundador', subtitle: 'Sua trajetória, reputação e próximos passos', icon: 'book', short: 'Diário' },
  exit: { title: 'Fechamento do escritório', subtitle: 'Confira a rotina antes de fechar as portas', icon: 'clock', short: 'Fechar o dia' },
};

document.querySelector('#app').innerHTML = `<main class="game-shell"><section id="world-stage" class="world-stage" aria-label="Escritório da sua empresa"><canvas id="office-canvas" tabindex="0"></canvas><header class="world-topbar"><div class="world-identity"><strong id="company-name"></strong><span id="founder-name"></span></div><div class="world-time-controls"><div class="world-time"><span id="day-date"></span><strong id="day-time"></strong></div><span class="hud-divider"></span><button class="icon-button" id="pause-button" data-action="pause" aria-label="Retomar tempo">${icon('play')}</button><button class="speed-button" id="speed-button" data-action="speed" title="Alterar velocidade">1×</button></div><button class="icon-button settings-button" data-action="settings" aria-label="Configurações" title="Configurações">${icon('settings')}</button></header><section id="station-panel" class="station-panel" hidden aria-label="Consulta no setor do escritório"></section></section></main>`;

function activeProjects() { return state.projects.filter((p) => p.status === 'active'); }
function isComputerApp(app) { return currentStation === 'work' && computerUnlocked && computerApp === app; }
function isStoreOpen() { return currentStation === 'furniture' || isComputerApp('expansion'); }
function focusWorkPuzzle() {
  document.querySelector('#terminal-command, #station-panel [data-puzzle-answer], #station-panel [data-action="complete-work-session"]')?.focus({ preventScroll: true });
}
function panelScroller(panel = document.querySelector('#station-panel')) {
  return panel.querySelector('.finance-board-pages') || panel.querySelector('.shop-browser-viewport') || panel.querySelector('.terminal-output-area') || panel.querySelector('.computer-window-content') || panel.querySelector('.station-body');
}
function browseShop(route) {
  if (!isComputerApp('expansion') || !scene.isNearStation('work')) return;
  navigateShop(shopBrowser, route);
  renderStation();
  panelScroller().scrollTop = 0;
  document.querySelector('.shop-page-content')?.focus({ preventScroll: true });
}
function buyShopProduct(id) {
  if (!isComputerApp('expansion') || !scene.isNearStation('work')) return;
  const product = getShopCatalog(state).find((entry) => entry.id === id);
  if (!product?.eligibility.ok) return toast(product?.eligibility.reason || 'Este produto não está disponível.', false);
  const before = state.cash;
  const result = product.kind === 'area' ? run(expandOffice)
    : product.kind === 'room' ? run(upgradeRoom, product.target)
      : product.kind === 'computer' ? run(upgradeComputer, product.target)
        : run(purchaseOfficeItem, product.target, { workstationId: product.workstation });
  if (!result?.ok) return;
  const office = getOfficeOverview(state);
  shopBrowser.receipt = { name: product.name, price: before - state.cash, category: product.category, message: result.message,
    cash: state.cash, usedSlots: office.usedSlots, maxSlots: office.maxSlots, maintenance: office.monthlyMaintenance, nextMaintenanceDay: office.nextMaintenanceDay };
  if (isComputerApp('expansion')) browseShop({ page: 'receipt', receipt: shopBrowser.receipt });
}
function lockComputer() {
  computerSessionId++;
  computerUnlocked = false;
  computerLoginMode = null;
  computerLoginError = '';
  computerLoginBusy = false;
  computerStartMenuOpen = false;
  computerMaximized = false;
  computerApp = 'desktop';
}
function focusComputer() {
  const selector = !computerUnlocked ? '#computer-login-form input[name="password"]'
    : computerApp === 'development' ? '#terminal-command' : '#station-panel [data-computer-command="start-menu"]';
  requestAnimationFrame(() => document.querySelector(selector)?.focus({ preventScroll: true }));
}
function terminalLog(command, output) {
  terminalHistory.push({ command: String(command).slice(0, 120), output: String(output) });
  terminalHistory = terminalHistory.slice(-12);
}
function executeTerminalCommand(input) {
  if (!isComputerApp('development') || !scene.isNearStation('work')) return;
  const parsed = parseTerminalCommand(input);
  if (!parsed.command) return focusWorkPuzzle();
  let output;
  let result;
  switch (parsed.command) {
    case 'ajuda':
      output = 'trabalhar: iniciar ou retomar 5 decisões; 1–4: responder; concluir: aplicar a produção; rotina: distribuir as 8h; foco: escolher projeto; revisar: usar 1h de revisão; status: consultar o dia; limpar: limpar o histórico.';
      break;
    case 'status': {
      const session = getWorkSession(state);
      const project = state.projects.find((p) => p.id === session?.projectId) || getWorkSessionEligibility(state).project;
      output = `Dia ${state.day} | Energia ${Math.round(state.energy)}% | Dívida técnica ${Math.round(state.debt)}%\nRotina: ${state.allocation.sales}h vendas, ${state.allocation.delivery}h desenvolvimento, ${state.allocation.quality}h revisão.\n${project ? `${project.title}: ${project.progress.toFixed(1)}/${project.hours}h, qualidade ${Math.round(project.quality)}%.` : 'Nenhum contrato ativo. Visite o Comercial.'}\n${session ? `Sessão salva: ${session.index}/${session.total} decisões. ${session.status === 'ready' ? 'Digite concluir para aplicar.' : 'Responda com 1, 2, 3 ou 4.'}` : getWorkSessionEligibility(state).reason || 'Pronto para iniciar uma sessão de trabalho.'}`;
      break;
    }
    case 'rotina':
    case 'foco':
      terminalView = 'routine';
      panelTab = parsed.command === 'foco' ? 'focus' : 'main';
      output = parsed.command === 'foco' ? 'Selecione o projeto prioritário abaixo.' : 'Ajuste a distribuição das oito horas abaixo.';
      break;
    case 'trabalhar':
      terminalView = 'work';
      result = run(startWorkSession);
      break;
    case 'answer': {
      terminalView = 'work';
      const session = getWorkSession(state);
      const option = session?.currentPuzzle?.options?.[parsed.argument];
      if (!option) output = session?.status === 'ready' ? 'As cinco decisões estão registradas. Digite concluir para aplicar o trabalho.' : 'Nenhuma decisão aberta. Digite trabalhar para começar.';
      else result = run(answerWorkPuzzle, option.id);
      break;
    }
    case 'concluir':
      terminalView = 'work';
      result = run(completeWorkSession);
      break;
    case 'revisar':
      result = run(performAction, 'review');
      break;
    case 'limpar':
      terminalHistory = [];
      break;
    default:
      output = 'Comando desconhecido. Digite ajuda para consultar os comandos disponíveis.';
  }
  if (parsed.command !== 'limpar') terminalLog(input, result?.message || output || 'Pronto.');
  renderStation();
  const scroller = panelScroller();
  const outputTarget = ['answer', 'trabalhar'].includes(parsed.command)
    ? document.querySelector('#station-panel .puzzle-question') || document.querySelector('#station-panel .puzzle-results') || document.querySelector('#station-panel .work-puzzle')
    : document.querySelector(['rotina', 'foco'].includes(parsed.command) ? '#station-panel .terminal-routine' : '#station-panel .terminal-history .terminal-output:last-child');
  if (scroller && outputTarget) scroller.scrollTop += outputTarget.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  else if (scroller && parsed.command === 'limpar') scroller.scrollTop = 0;
  focusWorkPuzzle();
}
async function submitComputerLogin(form) {
  if (currentStation !== 'work' || computerUnlocked || computerLoginBusy || !scene.isNearStation('work')) return;
  const sessionId = computerSessionId;
  const game = state;
  const mode = computerLoginMode || getComputerLoginMode(game);
  const values = new FormData(form);
  const candidate = { computer: game.computer };
  computerLoginBusy = true;
  const result = mode === 'login'
    ? await authenticateComputer(candidate, values.get('password'))
    : await configureComputerPassword(candidate, values.get('password'), values.get('confirm'));
  if (state !== game || sessionId !== computerSessionId || currentStation !== 'work') return;
  computerLoginBusy = false;
  if (result.ok) {
    if (mode !== 'login') state.computer = candidate.computer;
    computerUnlocked = true;
    computerLoginMode = null;
    computerLoginError = '';
    computerApp = 'desktop';
    persist();
  } else computerLoginError = result.message;
  renderStation();
  focusComputer();
}
function dailyCost() {
  const office = getOfficeOverview(state);
  return office.dailyRent + office.monthlyMaintenance / 28 + state.employees.reduce((sum, e) => sum + e.salary * (e.contract === 'CLT' ? 1.7 : 1.15) / 20, 0);
}
function toast(message, ok = true) {
  document.querySelector('#toast-root').innerHTML = `<div class="toast ${ok ? '' : 'toast-error'}">${icon(ok ? 'check' : 'message')}<span>${escape(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { document.querySelector('#toast-root').innerHTML = ''; }, 5000);
}
function persist() {
  if (!gameStarted) return;
  const result = saveGame(state, storageKey);
  if (result?.ok === false) toast(result.message, false);
}
function renderClock() {
  document.querySelector('#company-name').textContent = state.profile.company;
  document.querySelector('#founder-name').textContent = state.profile.name;
  document.querySelector('#company-name').title = state.profile.company;
  document.querySelector('#founder-name').title = state.profile.name;
  const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  document.querySelector('#day-date').textContent = `Dia ${String(state.day).padStart(2, '0')} · ${weekdays[(state.day - 1) % 7]}`;
  const minute = Math.floor(Math.min(elapsed, 120) / 120 * 480);
  document.querySelector('#day-time').textContent = `${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const pauseButton = document.querySelector('#pause-button');
  pauseButton.innerHTML = icon(state.paused ? 'play' : 'pause');
  pauseButton.disabled = Boolean(currentStation) || state.status === 'bankrupt';
  pauseButton.setAttribute('aria-label', state.paused ? 'Retomar tempo' : 'Pausar tempo');
  pauseButton.setAttribute('aria-pressed', String(!state.paused));
  pauseButton.title = currentStation ? 'Tempo pausado durante a consulta' : state.paused ? 'Retomar tempo' : 'Pausar tempo';
  document.querySelector('#speed-button').textContent = `${state.speed || 1}×`;
}
function render() {
  renderClock();
  scene?.setState(state);
  if (scene && gameStarted) state.officePosition = { x: scene.player.x, y: scene.player.y };
  if (currentStation && !scene.isNearStation(currentStation)) {
    state.paused = true;
    panelWasPaused = true;
    closeStation();
  }
  if (currentStation) renderStation();
}
function run(fn, ...args) {
  if (!currentStation || !scene.isNearStation(currentStation)) return toast('Chegue perto do setor para tomar essa decisão.', false);
  const focused = document.activeElement;
  const focusKey = ['allocation', 'projectMode', 'employeeAssignment', 'employeeRole'].find((key) => focused?.dataset?.[key]);
  const focusValue = focusKey ? focused.dataset[focusKey] : null;
  const result = fn(state, ...args);
  render(); persist();
  if (result?.message) toast(result.message, result.ok !== false);
  if (focusKey) {
    const attr = focusKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    document.querySelector(`[data-${attr}="${CSS.escape(focusValue)}"]`)?.focus();
  } else if (currentStation) document.querySelector('#station-panel [data-action="close-station"]')?.focus({ preventScroll: true });
  return result;
}
function openStation(action) {
  if (!gameStarted || !stations[action]) return;
  if (!scene.isNearStation(action)) { scene.requestInteraction(action); return; }
  if (currentStation !== action) {
    panelWasPaused = state.paused;
    panelTab = 'main';
    if (action === 'work') { lockComputer(); terminalView = 'work'; }
  }
  currentStation = action;
  state.paused = true;
  scene.setInteractionOpen(true);
  scene.setPlayerSeated?.(action === 'work');
  state.officePosition = { x: scene.player.x, y: scene.player.y };
  renderStation();
  renderClock();
  persist();
  if (action === 'work') focusComputer();
  else requestAnimationFrame(() => document.querySelector('#station-panel [data-action="close-station"]')?.focus());
}
function closeStation() {
  if (!currentStation) return;
  if (currentStation === 'work') lockComputer();
  scene.setPlayerSeated?.(false);
  state.officePosition = { x: scene.player.x, y: scene.player.y };
  currentStation = null;
  document.querySelector('#station-panel').hidden = true;
  scene.setInteractionOpen(false);
  state.paused = state.status === 'bankrupt' ? true : panelWasPaused;
  renderClock(); persist();
  document.querySelector('#office-canvas').focus({ preventScroll: true });
}
function travelTo(action) {
  if (!gameStarted) return;
  if (['meeting', 'ceo'].includes(action) && !state.office.special[action]) return;
  if (currentStation) closeStation();
  const result = scene.requestInteraction(action);
  if (result === false) toast('Não foi possível encontrar um caminho até esse setor.', false);
}
function positionPanel() {
  const panel = document.querySelector('#station-panel');
  if (!currentStation) return;
  if (['work', 'finance'].includes(currentStation) || window.innerWidth <= 760) {
    panel.style.left = ''; panel.style.top = ''; return;
  }
  const anchor = scene.getScreenPoint(currentStation);
  if (!anchor) return;
  const width = panel.getBoundingClientRect().width;
  const height = panel.offsetHeight;
  const margin = 16, top = 78, bottom = window.innerHeight - 16;
  const left = anchor.x > window.innerWidth / 2 ? anchor.x - width - 24 : anchor.x + 24;
  panel.style.left = `${Math.max(margin, Math.min(window.innerWidth - width - margin, left))}px`;
  panel.style.top = `${Math.max(top, Math.min(bottom - height, anchor.y - height / 2))}px`;
}
function stats(items) {
  return `<div class="stat-grid">${items.map(([label, value, detail]) => `<div class="station-stat"><small>${label}</small><strong>${value}</strong>${detail ? `<span>${detail}</span>` : ''}</div>`).join('')}</div>`;
}
function tabs(items) {
  return `<nav class="in-world-tabs" aria-label="Opções deste setor">${items.map(([id, label]) => `<button data-station-tab="${id}" class="${panelTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>`;
}
function selectPanelTab(id, attribute) {
  panelTab = id;
  panelScroller().scrollTop = 0;
  renderStation();
  document.querySelector(`#station-panel [${attribute}="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
function projectRow(p) {
  const progress = pct(p.progress / p.hours * 100);
  return `<div class="project-row"><div><strong>${escape(p.title)}</strong><small>${escape(p.client)} · ${money(p.price)} · prazo D${p.deadline}</small></div><div class="project-progress"><div class="mini-meter"><span style="width:${progress}%"></span></div><span>${Math.round(progress)}%</span></div></div>`;
}
function officeCostContent(office) {
  return `<h3 class="subheading">O espaço continua custando depois da compra.</h3>${stats([
    ['ESCRITÓRIO', escape(office.stage.name), `${office.usedSlots} / ${office.maxSlots} posições ocupadas`],
    ['ALUGUEL & UTILIDADES', money(office.dailyRent), 'Cobrança diária, inclusive no fim de semana'],
    ['MANUTENÇÃO MENSAL', money(office.monthlyMaintenance), `Próxima cobrança: D${office.nextMaintenanceDay}`],
  ])}<div class="concept-note">${icon('wallet')}<p>Computadores melhores e salas construídas acrescentam manutenção a cada 28 dias. O custo diário estimado reserva uma parte desse valor; o lançamento no caixa ocorre na data indicada. A folha permanece separada e só é paga nos dias úteis.</p></div><h3 class="subheading">Sua reserva precisa acompanhar o crescimento.</h3><p class="muted">A loja mostra preço, ocupação e custo contínuo antes de cada compra. Mais espaço permite contratar e separar setores, mas aumenta o aluguel mesmo quando não há contratos em andamento.</p>`;
}
function specialRoomContent(room) {
  if (!state.office.special[room]) return '<div class="empty-state">Construa esta sala na loja para usar suas ações.</div>';
  const meeting = room === 'meeting';
  const actions = ROOM_ACTIONS.filter((action) => action.room === room);
  const effects = getRoomEffects(state);
  const intro = meeting
    ? 'Uma hora de conversa pode poupar retrabalho. As ações usam a rotina do fundador e só podem ser feitas uma vez por dia.'
    : 'A privacidade ajuda a recuperar foco e energia. Usar a sala repetidamente aumenta a distância da equipe; reservar tempo para conversar reaproxima vocês.';
  return `${stats(meeting ? [
    ['EQUIPE', state.employees.length, 'Pessoas que constroem junto'],
    ['SINERGIA', `${Math.round(effects.synergy * 100)}%`, 'A divisão das salas afeta a colaboração'],
  ] : [
    ['ENERGIA', `${Math.round(state.energy)}%`, 'Seu foco também depende de descanso'],
    ['ISOLAMENTO', state.office.ceoIsolation, 'O excesso reduz a moral da equipe'],
  ])}<p class="muted">${intro}</p><div class="office-room-actions">${actions.map((action) => {
    const eligibility = getRoomActionEligibility(state, action.id);
    const area = { sales: 'vendas', delivery: 'desenvolvimento', quality: 'qualidade e gestão' }[action.area];
    return `<article class="project-card"><h3>${escape(action.label || action.name)}</h3><p class="muted">${escape(action.description)}</p><div class="opportunity-meta"><span>${icon('clock')} ${action.hours}h de ${area}</span><span>${action.cost ? money(action.cost) : 'Sem custo em dinheiro'}</span></div>${!eligibility.ok ? `<p class="muted">${escape(eligibility.reason || eligibility.message)}</p>` : ''}<button class="${eligibility.ok ? 'primary' : 'secondary'}-button full" data-room-action="${action.id}" ${eligibility.ok ? '' : 'disabled'}>${escape(action.label || action.name)} ${icon('arrow')}</button></article>`;
  }).join('')}</div><div class="concept-note">${icon(meeting ? 'people' : 'target')}<p>${meeting ? 'Alinhamento reduz bloqueios e melhora revisões; apresentações ajudam nas próximas negociações; integração acelera os primeiros dias de quem acabou de chegar.' : 'Prestígio tem consequência. Observe o isolamento e a moral no RH para decidir entre trabalhar sozinho e passar tempo com o time.'}</p></div>`;
}
function renderStation() {
  const el = document.querySelector('#station-panel');
  const s = stations[currentStation];
  const previousScroll = panelScroller(el)?.scrollTop || 0;
  el.hidden = false;
  el.dataset.station = currentStation;
  el.classList.toggle('computer-panel', currentStation === 'work');
  el.classList.toggle('finance-panel', currentStation === 'finance');
  el.classList.toggle('computer-maximized', currentStation === 'work' && computerMaximized);
  if (currentStation === 'finance') {
    el.innerHTML = renderFinanceBoard(state, { section: panelTab, selectedDay: financeDay, selectedPeriod: financePeriod });
    panelScroller(el).scrollTop = previousScroll;
    requestAnimationFrame(positionPanel);
    return;
  }
  if (currentStation === 'work') {
    el.innerHTML = `<div class="station-frame computer-frame"><div class="station-body computer-host">${stationContent('work')}</div></div>`;
    panelScroller(el).scrollTop = previousScroll;
    requestAnimationFrame(positionPanel);
    return;
  }
  el.innerHTML = `<div class="station-frame"><header class="station-header"><span class="station-icon">${icon(s.icon)}</span><div class="station-heading"><div class="section-label">${escape(state.profile.name)} ESTÁ CONSULTANDO</div><h2>${s.title}</h2><p class="station-subtitle">${s.subtitle}</p></div><button class="station-close icon-button" data-action="close-station" aria-label="Voltar ao escritório">${icon('close')}</button></header><div class="station-body">${stationContent(currentStation)}</div><footer class="station-status"><span class="online-dot"></span> Consulta no local · tempo pausado <span><kbd>Esc</kbd> voltar ao escritório</span></footer></div>`;
  el.querySelector('.station-body').scrollTop = previousScroll;
  requestAnimationFrame(positionPanel);
}
function developmentContent() {
    const categories = [['sales', 'Vender & descobrir', 'message'], ['delivery', 'Desenvolver & criar', 'code'], ['quality', 'Revisar & gerir', 'target']];
    const effects = getRoomEffects(state);
    const routine = `${tabs([['main', 'Rotina de hoje'], ['focus', 'Foco & código']])}${stats([['ENERGIA', `${Math.round(state.energy)}%`, 'Café e descanso recuperam'], ['DÍVIDA TÉCNICA', `${Math.round(state.debt)}%`, 'Qualidade reduz o custo futuro'], ['DESLOCAMENTO', `${(state.travelHours || 0).toFixed(2)}h`, 'Tempo que sai da capacidade de entrega']])}<div class="concept-note">${icon('people')}<p>Ruído entre comercial e desenvolvimento: <strong>${Math.round(effects.noise * 100)}%</strong>. Sinergia da equipe: <strong>${Math.round(effects.synergy * 100)}%</strong>. Isolar setores reduz interrupções; manter proximidade facilita revisões e ajuda contra bloqueios.</p></div>${panelTab === 'focus' ? `<h3 class="subheading">Em qual projeto você vai se concentrar?</h3><p class="muted">Seu foco define a prioridade das horas do fundador. O RH distribui o trabalho da equipe.</p>${activeProjects().map((p) => `<article class="project-card">${projectRow(p)}<button class="${state.focusProjectId === p.id ? 'primary' : 'secondary'}-button compact full" data-project-priority="${escape(p.id)}">${state.focusProjectId === p.id ? `${icon('check')} Foco atual` : 'Priorizar este projeto'}</button></article>`).join('') || '<div class="empty-state">Nenhum contrato na mesa. Vá ao comercial para fechar seu primeiro projeto.</div>'}<div class="action-grid"><button class="secondary-button" data-action="review">${icon('target')} Revisar 1h</button></div>` : `<h3 class="subheading">Oito horas. Escolhas que competem.</h3><p class="muted">Discovery e propostas usam vendas; entrevistas e pesquisa usam qualidade; protótipos e código usam desenvolvimento.</p><div class="allocation-bar">${categories.map(([key]) => `<span class="${key}" style="flex:${state.allocation[key]}"></span>`).join('')}</div><div class="allocation-rows">${categories.map(([key, label, glyph]) => `<div class="allocation-row"><div class="allocation-label"><span class="allocation-icon ${key}">${icon(glyph)}</span><strong>${label}</strong><b>${state.allocation[key]}h</b></div><input class="range ${key}" type="range" min="0" max="8" step="1" value="${state.allocation[key]}" data-allocation="${key}" aria-label="Horas para ${label}"/></div>`).join('')}</div><div class="action-grid"><button class="secondary-button" data-action="review">${icon('target')} Revisar 1h</button></div><div class="concept-note">${icon('clock')}<p>Trabalho manual adianta as horas reservadas; não cria horas extras. Ao fechar o escritório, a rotina restante e as tarefas da equipe são executadas.</p></div>`}`;
    return renderDevelopmentTerminal(state, { session: getWorkSession(state), eligibility: getWorkSessionEligibility(state), routine, view: terminalView, history: terminalHistory });
}
function stationContent(action) {
  if (action === 'work') {
    const content = !computerUnlocked ? '' : computerApp === 'expansion' ? renderShopBrowser(state, shopBrowser)
      : computerApp === 'development' ? developmentContent()
        : computerApp === 'laboratory' ? stationContent('product') : '';
    const minute = Math.floor(Math.min(elapsed, 120) / 120 * 480);
    const clock = `${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    return renderComputer(state, { app: computerApp, content, session: getWorkSession(state), clock, locked: !computerUnlocked, loginMode: computerLoginMode || getComputerLoginMode(state), loginError: computerLoginError, startMenuOpen: computerStartMenuOpen, maximized: computerMaximized });
  }
  if (action === 'sales') {
    return `${stats([['CONTATOS', state.leads.length, 'Até 6 oportunidades abertas'], ['REPUTAÇÃO', `${Math.round(state.reputation)}/100`, 'Influencia propostas premium'], ['TEMPO COMERCIAL', `${state.allocation.sales}h`, 'Discovery usa uma hora da rotina']])}<div class="section-header"><h3 class="subheading">Qual problema vale sua próxima hora?</h3><button class="secondary-button compact" data-action="prospect">${icon('plus')} Prospectar</button></div><p class="muted">Investigar antes de vender diminui incerteza. Preço e salas mudam as chances de fechar, prazo e recebimento. Cada contato tem uma tentativa de negociação.</p>${state.leads.map((l, i) => `<article class="opportunity-card"><div class="opportunity-top"><span class="client-monogram color-${i % 3}">${escape(l.client.slice(0, 2).toUpperCase())}</span><div><small>${escape(l.sector)}</small><strong>${escape(l.client)}</strong></div><span class="tag">${l.discovered ? 'ESCOPO DESCOBERTO' : 'CONTATO ABERTO'}</span></div><h3>${escape(l.title)}</h3><p>${escape(l.description)}</p><div class="opportunity-meta"><span>${icon('clock')} ${l.estimateMin || Math.floor(l.hours * .85)}–${l.estimateMax || Math.ceil(l.hours * 1.25)}h estimadas</span><span>${l.duration} dias</span></div>${l.discovered ? `<div class="discovery-note"><strong>Discovery concluído</strong><p>${escape(l.qualification?.scope || 'O cliente confirmou o escopo e as necessidades prioritárias.')}</p><small>${escape(l.qualification?.risks || 'Menos incerteza para defender sua proposta.')}</small></div>` : `<button class="secondary-button compact full" data-discover="${escape(l.id)}" ${l.negotiation ? 'disabled' : ''}>${icon('message')} Investigar o escopo · 1h de vendas</button>`}${l.negotiation ? `<div class="interview-note"><strong>Negociação encerrada</strong><p>O cliente recusou a proposta. Novos contatos chegam pela prospecção; esta negociação não pode ser repetida.</p></div>` : ''}<div class="proposal-options"><button data-negotiate="${escape(l.id)}" data-pricing="discount" ${l.negotiation ? 'disabled' : ''}><small>COMPETITIVA</small><strong>${money(l.price * .85)}</strong><span>+2 dias de prazo · recebe D+2<br>${Math.round(getNegotiationChance(state, l.id, 'discount') * 100)}% de chance de fechar</span></button><button data-negotiate="${escape(l.id)}" data-pricing="standard" class="recommended" ${l.negotiation ? 'disabled' : ''}><small>EQUILIBRADA</small><strong>${money(l.price)}</strong><span>Prazo base · recebe D+3<br>${Math.round(getNegotiationChance(state, l.id, 'standard') * 100)}% de chance de fechar</span></button><button data-negotiate="${escape(l.id)}" data-pricing="premium" ${l.negotiation || (!l.discovered && state.reputation < 25) ? 'disabled' : ''}><small>PREMIUM</small><strong>${money(l.price * 1.2)}</strong><span>−2 dias de prazo · recebe D+5<br>${Math.round(getNegotiationChance(state, l.id, 'premium') * 100)}% de chance de fechar</span></button></div></article>`).join('') || '<div class="empty-state">Seu pipeline está vazio. Prospecte ou reserve mais horas de vendas.</div>'}`;
  }
  if (action === 'board') {
    const events = state.pendingEvents || [];
    return `${tabs([['main', 'Quadro & entregas'], ['events', `Decisões pendentes (${events.length})`]])}${panelTab === 'events' ? events.map((event) => `<article class="event-card"><span class="tag">DECISÃO DO FUNDADOR</span><h3>${escape(event.title)}</h3><p>${escape(event.description)}</p><div class="event-options">${event.options.map((o) => `<button class="secondary-button" data-event="${escape(event.id)}" data-choice="${escape(o.id)}"><strong>${escape(o.label)}</strong><small>${escape(o.description)}</small></button>`).join('')}</div></article>`).join('') || '<div class="empty-state">Nenhum imprevisto pendente. Continue acompanhando seus projetos.</div>' : `${events.length ? `<div class="event-alert">${icon('message')} ${events.length} decisão aguardando você no quadro. <button class="text-button" data-station-tab="events">Resolver agora ${icon('arrow')}</button></div>` : ''}<div class="kanban-strip"><span>A DESENVOLVER</span><span>EM EXECUÇÃO</span><span>REVISÃO</span><span>ENTREGUE</span></div>${state.projects.length ? state.projects.slice().reverse().map((p) => `<article class="project-card">${projectRow(p)}<div class="project-card-meta"><span class="status-pill ${p.status === 'delivered' ? 'success' : ''}">${p.status === 'delivered' ? 'Entregue' : ({ backlog: 'A desenvolver', development: 'Em execução', review: 'Em revisão' }[p.phase] || 'Em execução')}</span><span>Qualidade ${Math.round(p.quality)}% · ${p.progress.toFixed(1)}/${p.hours}h</span></div>${p.status === 'active' ? `<label class="select-label">Ritmo de execução<select data-project-mode="${escape(p.id)}"><option value="fast" ${p.mode === 'fast' ? 'selected' : ''}>Rápido · mais dívida e risco de bugs</option><option value="standard" ${p.mode === 'standard' ? 'selected' : ''}>Padrão · equilíbrio entre prazo e qualidade</option><option value="careful" ${p.mode === 'careful' ? 'selected' : ''}>Caprichado · mais qualidade, menos velocidade</option></select></label><button class="secondary-button compact full" data-project-priority="${escape(p.id)}">${state.focusProjectId === p.id ? 'Prioridade do fundador' : 'Definir como prioridade'}</button>` : `<p class="muted">${p.paid ? 'Pagamento recebido.' : `Recebimento previsto para D${p.dueDay}. Consulte o financeiro.`}</p>`}</article>`).join('') : '<div class="empty-state">O primeiro post-it começa na mesa comercial. Caminhe até lá e feche um contrato.</div>'}`}`;
  }
  if (action === 'team') {
    const office = getOfficeOverview(state);
    return `${tabs([['main', 'Equipe & responsabilidades'], ['candidates', 'Entrevistas & vagas']])}${stats([['POSTOS LIVRES', office.freePosts, 'Mesa e cadeira prontas antes de contratar'], ['EQUIPE', state.employees.length, 'Computadores são atribuídos ao ocupar um posto']])}${panelTab === 'candidates' ? `<p class="muted">Conhecer a pessoa custa 1h de qualidade e gestão. Sem mesa e cadeira livres não há contratação: prepare um posto na loja. A sala do RH melhora a seleção dos talentos.</p>${CANDIDATES.filter((c) => !state.employees.some((e) => e.id === c.id)).map((c) => { const interview = state.interviews?.[c.id]; return `<article class="person-card"><div class="person-top">${avatar(c.color, 52, c.name)}<div><h3>${escape(c.name)}</h3><p>${escape(c.role)}</p></div><span class="trait-pill">${money(c.salary)}/mês</span></div><p class="muted">${escape(c.trait)}</p>${interview ? `<div class="interview-note"><strong>Entrevista concluída · ${Math.round(interview.score)}/100</strong><p>${escape(interview.strength)}</p><small>${escape(interview.risk)}</small></div>` : `<button class="secondary-button full" data-interview="${escape(c.id)}">Entrevistar · 1h de gestão</button>`}<div class="hire-actions"><button class="primary-button compact" data-hire="${escape(c.id)}" data-contract="PJ" ${(!interview && !isLocalTestState(state)) || office.freePosts <= 0 ? 'disabled' : ''}>PJ · ${money(c.salary * 1.15)}/mês</button><button class="secondary-button compact" data-hire="${escape(c.id)}" data-contract="CLT" ${(!interview && !isLocalTestState(state)) || office.freePosts <= 0 ? 'disabled' : ''}>CLT · ${money(c.salary * 1.7)}/mês</button></div></article>`; }).join('') || '<div class="empty-state">Todos os talentos deste primeiro grupo já fazem parte da sua equipe.</div>'}` : `<article class="person-card"><div class="person-top">${avatar(state.profile.avatarColor, 48, state.profile.name)}<div><h3>${escape(state.profile.name)}</h3><p>Fundador · vende, entrega e decide</p></div><span class="tag">8H / DIA</span></div></article>${state.employees.map((e) => `<article class="person-card"><div class="person-top">${avatar(e.color, 48, e.name)}<div><h3>${escape(e.name)}</h3><p>${escape(e.role)} · ${e.contract}</p></div><span class="status-pill ${e.stress > 60 ? '' : 'success'}">${e.stress > 60 ? 'Sobrecarregado' : 'Em equilíbrio'}</span></div>${stats([['MORAL', `${Math.round(e.morale ?? 80)}%`], ['ESTRESSE', `${Math.round(e.stress ?? 10)}%`], ['FOLHA / DIA', money(e.salary * (e.contract === 'CLT' ? 1.7 : 1.15) / 20)]])}<div class="station-grid"><label class="select-label">Responsabilidade<select data-employee-assignment="${escape(e.id)}"><option value="auto" ${!e.assignment || e.assignment === 'auto' ? 'selected' : ''}>Ajudar na fila prioritária</option>${activeProjects().map((p) => `<option value="${escape(p.id)}" ${e.assignment === p.id ? 'selected' : ''}>${escape(p.title)}</option>`).join('')}</select></label><label class="select-label">Papel no projeto<select data-employee-role="${escape(e.id)}"><option value="delivery" ${e.assignmentRole !== 'quality' ? 'selected' : ''}>Desenvolver</option><option value="quality" ${e.assignmentRole === 'quality' ? 'selected' : ''}>Revisar & testar</option></select></label></div></article>`).join('') || '<div class="empty-state">Você ainda faz tudo. Consulte a aba de entrevistas para trazer a primeira pessoa.</div>'}<div class="concept-note">${icon('people')}<p>Distribuir pessoas entre entregas e revisão muda o resultado. Sobrecarga eleva estresse e reduz produtividade; a equipe não é apenas uma soma de horas.</p></div>`}`;
  }
  if (action === 'furniture') return renderOfficeStore(state, panelTab === 'main' ? 'overview' : panelTab);
  if (action === 'meeting' || action === 'ceo') return specialRoomContent(action);
  if (action === 'coffee' || action === 'rest') {
    const coffee = action === 'coffee';
    return `${stats([['SUA ENERGIA', `${Math.round(state.energy)}%`, state.energy < 35 ? 'O cansaço já afeta suas entregas' : 'Energia influencia a produtividade'], ['PAUSAS HOJE', state.dailyActions?.[coffee ? 'coffee' : 'rest'] || 0, coffee ? 'Até 2 cafés por dia' : 'Uma pausa de descanso por dia']])}<div class="rest-illustration">${icon(coffee ? 'coffee' : 'sun')}</div><h3 class="subheading">${coffee ? 'Uma conversa. Um café. Uma nova ideia.' : 'Feche os olhos antes de abrir outra tarefa.'}</h3><p class="muted">${coffee ? 'R$ 15 recuperam energia. Uma cafeteira melhor torna essa pausa mais eficiente.' : 'R$ 40 cobrem um lanche e o descanso. Um lounge confortável melhora essa recuperação e as noites seguintes.'}</p><button class="primary-button full" data-action="${coffee ? 'coffee' : 'rest'}">${coffee ? 'Preparar café · R$ 15' : 'Descansar e fazer um lanche · R$ 40'} ${icon('arrow')}</button>`;
  }
  if (action === 'product') {
    const product = state.product || { unlocked: false, progress: 0, research: 0, users: 0, mrr: 0, stage: 'locked' };
    return `${product.unlocked ? `<span class="tag">${product.stage === 'launched' ? 'PRODUTO LANÇADO' : 'IDEIA EM CONSTRUÇÃO'}</span><h3 class="subheading">Sua próxima receita pode ser recorrente.</h3>${stats([['MVP', `${Math.round(product.progress)}%`, 'Construção e validação'], ['PESQUISAS', product.research, 'Duas validações para lançar'], ['MRR', money(product.mrr), `${product.users} usuários`]])}<div class="mini-meter product-meter"><span style="width:${pct(product.progress)}%"></span></div><p class="muted">O laboratório disputa as mesmas horas que pagam seus contratos. Um protótipo usa 2h de desenvolvimento e R$ 300; pesquisar usa 1h de qualidade e R$ 150. Cabe um investimento por dia.</p>${product.stage === 'launched' ? `<div class="discovery-note"><strong>MVP lançado</strong><p>Próxima receita prevista: D${product.nextPaymentDay}. O ciclo de 28 dias cobra R$ 100 de suporte.</p></div>` : ''}<div class="action-grid"><button class="primary-button" data-product="prototype" ${product.stage === 'launched' || product.progress >= 100 || state.dailyActions.product >= 1 ? 'disabled' : ''}>${icon('code')} Construir protótipo</button><button class="secondary-button" data-product="research" ${product.stage === 'launched' || state.dailyActions.product >= 1 ? 'disabled' : ''}>${icon('message')} Validar com usuários</button></div>` : `<div class="product-locked">${icon('lock')}<h3>Conheça clientes antes de apostar.</h3><p>Entregue dois projetos para liberar seu laboratório. As dores que você descobriu podem se transformar em produto.</p><span class="tag">${state.stats.delivered} / 2 ENTREGAS</span></div>`}<div class="product-roadmap"><span>01 · IDEIA</span><span>02 · MVP</span><span>03 · LANÇAMENTO</span><span>04 · RECORRÊNCIA</span></div><div class="concept-note">${icon('bulb')}<p>Serviço paga as contas hoje. Produto consome caixa e capacidade antes de começar a gerar receita. O desafio é escolher o momento.</p></div>`;
  }
  if (action === 'reception') {
    return `${tabs([['main', pendingSummary ? 'Fechamento & diário' : 'Diário & conquistas'], ['guide', 'Guia & identidade']])}${panelTab === 'guide' ? `<div class="guide-grid"><article>${icon('message')}<h3>Vender exige presença</h3><p>Vá ao comercial. Descubra o escopo e escolha preço, prazo e recebimento.</p></article><article>${icon('code')}<h3>Seu dia tem oito horas</h3><p>Crie a senha do Meu PC e abra Desenvolver. Digite rotina para dividir as oito horas, trabalhar para resolver cinco decisões e concluir para aplicar a produção. Caminhar, entrevistar e construir usam o mesmo orçamento.</p></article><article>${icon('folder')}<h3>Projetos pedem decisões</h3><p>O quadro mostra progresso, qualidade e imprevistos. Resolva pedidos extras e bloqueios antes que custem prazo.</p></article><article>${icon('people')}<h3>Delegar tem consequências</h3><p>Entreviste no RH e escolha quem desenvolve ou revisa cada projeto. Equipe custa folha e precisa de equilíbrio. Prepare mesa e cadeira na loja antes de contratar.</p></article><article>${icon('chair')}<h3>O espaço também é estratégia</h3><p>A garagem cresce para uma sala comercial e um andar inteiro. Cada sala disputa espaço e cobra manutenção. Separar setores reduz ruído, mas também a sinergia.</p></article></div><div class="action-grid"><button class="secondary-button" data-action="profile">${avatar(state.profile.avatarColor, 28)} Meu fundador</button><button class="secondary-button" data-action="new-game">Começar outra história</button></div>` : `${pendingSummary ? summaryMarkup() : ''}${stats([['REPUTAÇÃO', `${Math.round(state.reputation)}/100`, 'Sobe com qualidade, cai com atrasos'], ['ENTREGAS', state.stats.delivered, 'Seu portfólio cresce a cada cliente'], ['HORAS DE ENTREGA', `${state.stats.hoursWorked.toFixed(1)}h`, 'Tempo transformado em resultado']])}<ol class="mission-checklist"><li class="done">${icon('check')} Abra as portas da empresa.</li><li class="${state.projects.length ? 'done' : ''}">${icon(state.projects.length ? 'check' : 'target')} Feche seu primeiro contrato no comercial.</li><li class="${state.stats.delivered ? 'done' : ''}">${icon(state.stats.delivered ? 'check' : 'target')} Faça a primeira entrega pelo quadro.</li><li class="${state.employees.length ? 'done' : ''}">${icon(state.employees.length ? 'check' : 'target')} Entreviste e traga uma pessoa pelo RH.</li><li class="${state.product?.unlocked ? 'done' : ''}">${icon(state.product?.unlocked ? 'check' : 'target')} Entregue dois projetos e libere o laboratório.</li></ol><h3 class="subheading">Diário do fundador</h3><div class="activity-list">${state.log.slice(0, 12).map((l) => `<div class="activity"><span class="activity-dot"></span><p>${escape(l.message)}</p><small>D${l.day}</small></div>`).join('')}</div>`}`;
  }
  if (action === 'exit') {
    if (pendingSummary) return summaryMarkup();
    return `<h3 class="subheading">Antes de apagar as luzes.</h3><p class="muted">As horas restantes do fundador e as responsabilidades da equipe são executadas. Custos e recebimentos são contabilizados; novos imprevistos podem aparecer no quadro.</p>${stats([['ROTINA', `${state.allocation.sales} / ${state.allocation.delivery} / ${state.allocation.quality}h`, 'Vendas / desenvolvimento / qualidade'], ['TRABALHO EM ANDAMENTO', activeProjects().length, `${state.pendingEvents?.length || 0} decisão pendente no quadro`], ['EQUIPE', `${state.employees.length + 1} pessoa${state.employees.length ? 's' : ''}`, 'Você e quem constrói junto']])}${state.status === 'bankrupt' ? '<div class="concept-note warning">Sua empresa encerrou as atividades. Você pode começar outra história pelo diário da recepção.</div>' : `<button class="primary-button full" data-action="end-day">Encerrar o dia ${icon('arrow')}</button>`}<div class="concept-note">${icon('clock')}<p>O fim de semana é pulado, com descanso e custos fixos contabilizados. O próximo dia começa pausado para você pensar na rotina.</p></div>`;
  }
  return '';
}
function summaryMarkup() {
  if (!pendingSummary) return '';
  const s = pendingSummary;
  return `<div id="day-summary"><span class="tag">DIA ${s.day} CONSTRUÍDO</span><h3 class="subheading">Fechou o notebook. Respira.</h3><p class="muted">${escape(s.message)}</p>${stats([['HORAS ENTREGUES', `${s.hours.toFixed(1)}h`], ['PROJETOS CONCLUÍDOS', s.delivered], ['VARIAÇÃO NO CAIXA', `${s.cash >= 0 ? '+' : '−'}${money(Math.abs(s.cash))}`], ['ENERGIA PARA AMANHÃ', `${Math.round(state.energy)}%`]])}${state.pendingEvents?.length ? `<div class="event-alert">${icon('message')} Há decisões novas no quadro de projetos. Passe lá antes de continuar.</div>` : ''}<button class="primary-button full" data-action="continue-day">Voltar ao escritório ${icon('arrow')}</button></div>`;
}
function finishDay(automatic = false) {
  if (!automatic && (!['exit', 'reception'].includes(currentStation) || !scene.isNearStation(currentStation))) return;
  const before = { day: state.day, cash: state.cash, delivered: state.stats.delivered, hours: state.stats.hoursWorked };
  const result = advanceDay(state);
  if (result?.ok === false) return toast(result.message, false);
  let weekends = 0;
  while ((state.day - 1) % 7 >= 5 && state.status !== 'bankrupt') { advanceDay(state); weekends++; }
  pendingSummary = { day: before.day, cash: state.cash - before.cash, delivered: state.stats.delivered - before.delivered, hours: state.stats.hoursWorked - before.hours, message: result.message + (weekends ? ' Fim de semana contabilizado: descanso, custos e recebimentos.' : '') };
  elapsed = 0;
  state.paused = true;
  panelWasPaused = true;
  persist(); render();
  if (automatic) { toast('O dia terminou. Vamos consultar o fechamento na recepção.'); travelTo('reception'); }
}

function openModal(content, wide = false, closable = true) {
  lastModalTrigger = document.activeElement;
  document.querySelector('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${closable ? `<button class="modal-close icon-button" data-action="close-modal" aria-label="Fechar janela">${icon('close')}</button>` : ''}${content}</section></div>`;
  const first = document.querySelector('.modal input, .modal button, .modal select');
  requestAnimationFrame(() => first?.focus());
}
function closeModal() {
  document.querySelector('#modal-root').innerHTML = '';
  lastModalTrigger?.focus();
}

function showProfile(isNew = false) {
  if (isNew) state.paused = true;
  const p = state.profile;
  const colors = ['#adc972', '#84b9a9', '#b5a0d3', '#dc9573', '#dcba66'];
  openModal(`<div class="profile-layout"><div class="profile-intro"><h2 id="modal-title">${isNew ? 'Criar empresa' : 'Fundador e empresa'}</h2><div class="founder-preview"><div class="portrait-grid"></div><div id="profile-avatar">${avatar(p.avatarColor, 180, p.name)}</div></div></div><form id="profile-form" class="profile-form"><div class="section-label">${isNew ? 'ANTES DE ABRIR AS PORTAS' : 'SUA IDENTIDADE'}</div><label>Seu nome<input name="name" required maxlength="32" placeholder="Seu nome" autocomplete="given-name" value="${isNew ? '' : escape(p.name)}" /></label><label>Nome da empresa<input name="company" required maxlength="40" placeholder="Nome da empresa" autocomplete="organization" value="${isNew ? '' : escape(p.company)}" /></label><div class="profile-fields"><label>Sua idade<input name="age" type="number" min="18" max="80" required value="${p.age}" /></label><label>Seu ponto forte<select name="trait"><option value="balanced" ${p.trait === 'balanced' ? 'selected' : ''}>Um pouco de tudo</option><option value="technical" ${p.trait === 'technical' ? 'selected' : ''}>Dev de coração</option><option value="commercial" ${p.trait === 'commercial' ? 'selected' : ''}>Bom de conversa</option></select></label></div><fieldset class="color-fieldset"><legend>A cor do seu personagem</legend><div class="color-choices">${colors.map((c, i) => `<label class="color-choice" style="--swatch:${c}"><input type="radio" name="avatarColor" value="${c}" ${c === p.avatarColor || (!colors.includes(p.avatarColor) && i === 0) ? 'checked' : ''} aria-label="${['Verde', 'Azul', 'Lilás', 'Terracota', 'Mostarda'][i]}"/><span>${icon('check')}</span></label>`).join('')}</div></fieldset><button type="submit" class="primary-button full">${isNew ? 'Abrir as portas' : 'Salvar meu perfil'} ${icon('arrow')}</button><p class="form-footnote">${icon('save')} Seu progresso fica salvo neste navegador.</p></form></div>`, true, !isNew);
  document.querySelector('#profile-form').addEventListener('change', (e) => { if (e.target.name === 'avatarColor') document.querySelector('#profile-avatar').innerHTML = avatar(e.target.value, 180); });
  document.querySelector('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const profile = { name: data.get('name').trim(), company: data.get('company').trim(), age: Number(data.get('age')), trait: data.get('trait'), avatarColor: data.get('avatarColor') };
    if (!profile.name || !profile.company) return toast('Preencha seu nome e o nome da empresa.', false);
    if (isNew) {
      currentStation = null;
      document.querySelector('#station-panel').hidden = true;
      scene.setPlayerSeated?.(false);
      scene.setInteractionOpen(false);
      lockComputer();
      shopBrowser = createShopBrowser();
      terminalView = 'work';
      terminalHistory = [];
      panelWasPaused = true;
      financeDay = null; financePeriod = null;
      state = createGame(profile);
      if (localTestMode) enableLocalTest(state, true);
      gameStarted = true;
      elapsed = 0;
      scene.setState(state);
      scene.resetPlayer();
      state.officePosition = { x: scene.player.x, y: scene.player.y };
    }
    else state.profile = profile;
    pendingSummary = null; persist(); closeModal(); render();
    if (isNew) document.querySelector('#office-canvas').focus({ preventScroll: true });
    toast(isNew ? `${profile.company} está de portas abertas. Bem-vindo, ${profile.name}!` : 'Seu perfil foi atualizado.');
  });
}


function showNewGameConfirm() {
  openModal(`<div class="section-label">UM NOVO COMEÇO</div><h2 id="modal-title">Abrir uma nova empresa?</h2><p class="muted">A história atual será substituída neste navegador. Caixa, projetos, equipe e mobília serão reiniciados.</p><div class="confirm-actions"><button class="secondary-button" data-action="close-modal">Continuar minha história</button><button class="primary-button" data-action="confirm-new">Começar do zero ${icon('arrow')}</button></div>`);
}
function showSettings() {
  openModal(`<div class="settings-content"><div class="settings-brand brand"><span class="brand-mark">${icon('code')}</span><span>devhouse<span class="brand-dot">.</span></span></div><h2 id="modal-title">Configurações</h2><div class="settings-actions"><button data-action="fullscreen">${icon('fullscreen')}<span>${document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'}</span></button><button data-action="settings-profile">${icon('people')}<span>Fundador e empresa</span></button><button data-action="settings-help">${icon('book')}<span>Como jogar</span></button><button data-action="settings-new">${icon('plus')}<span>Novo jogo</span></button></div>${localTestMode ? '<section class="settings-test"><strong>Teste local</strong><p>Partida separada, com requisitos de progresso liberados. Amplie o espaço para instalar mais itens.</p><div class="settings-actions"><button data-local-test="money">+ R$ 1 milhão</button><button data-local-test="exit">Voltar à partida normal</button></div></section>' : ''}</div>`);
}
function showControls() {
  openModal(`<h2 id="modal-title">Como jogar</h2><div class="settings-help"><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou setas para andar.</p><p>Clique ou toque no chão para caminhar. Clique em uma mesa ou no nome de um setor para ir até ele.</p><p><kbd>E</kbd> consulta o setor próximo. <kbd>Esc</kbd> fecha uma consulta.</p><p>Use o computador para desenvolver, comprar expansões e construir seu produto. Comercial, projetos, finanças e RH ficam nas mesas do escritório.</p><p>O botão de tempo retoma ou pausa o expediente. As velocidades são 1×, 2× e 4×.</p></div><button class="secondary-button full" data-action="settings">Voltar às configurações</button>`);
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else return toast('Este navegador não oferece tela cheia. O escritório já ocupa toda a área disponível.', false);
    showSettings();
    document.querySelector('[data-action="fullscreen"]')?.focus();
  } catch { toast('Não foi possível abrir a tela cheia neste navegador.', false); }
}
function handleAction(action) {
  if (action === 'settings') return showSettings();
  if (action === 'settings-help') return showControls();
  if (action === 'settings-profile') return showProfile();
  if (action === 'settings-new') return showNewGameConfirm();
  if (action === 'fullscreen') return toggleFullscreen();
  if (action === 'close-station') return closeStation();
  if (action === 'close-modal') return closeModal();
  if (action === 'confirm-new') return showProfile(true);
  if (action === 'pause') {
    if (currentStation) return toast('Conclua a consulta e volte ao escritório para retomar o tempo.');
    state.paused = !state.paused; persist(); renderClock(); return;
  }
  if (action === 'speed') { state.speed = ({ 1: 2, 2: 4, 4: 1 })[state.speed] || 1; persist(); renderClock(); return; }
  if (!currentStation || !scene.isNearStation(currentStation)) return;
  if (action === 'end-day' && currentStation === 'exit') finishDay();
  else if (action === 'continue-day') { pendingSummary = null; closeStation(); }
  else if (action === 'prospect' && currentStation === 'sales') run(prospect);
  else if (action === 'start-work-session' && isComputerApp('development')) executeTerminalCommand('trabalhar');
  else if (action === 'complete-work-session' && isComputerApp('development')) executeTerminalCommand('concluir');
  else if (action === 'review' && isComputerApp('development')) executeTerminalCommand('revisar');
  else if (action === 'coffee' && currentStation === 'coffee') run(performAction, 'coffee');
  else if (action === 'rest' && currentStation === 'rest') run(performAction, 'rest');
  else if (action === 'take-loan' && currentStation === 'finance') run(takeLoan);
  else if (action === 'repay-loan' && currentStation === 'finance') run(repayLoan);
  else if (action === 'profile' && currentStation === 'reception') showProfile();
  else if (action === 'new-game' && currentStation === 'reception') showNewGameConfirm();
}
document.addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target || target.disabled) return;
  if (target.dataset.localTest && localTestMode) {
    if (target.dataset.localTest === 'money') {
      state.cash = Math.min(state.cash + 1000000, 100000000);
      state.status = 'active';
      render(); persist();
      toast('R$ 1 milhão adicionado somente à sua partida de teste.');
    } else if (target.dataset.localTest === 'exit') {
      persist();
      try { localStorage.removeItem(TEST_MODE_KEY); } catch { /* Query overrides storage. */ }
      const url = new URL(location.href);
      url.searchParams.set('teste', '0');
      location.replace(url.href);
    }
    return;
  }
  if (target.dataset.travel) return travelTo(target.dataset.travel);
  if (target.dataset.action) return handleAction(target.dataset.action);
  if (!currentStation || !scene.isNearStation(currentStation)) return;
  if (currentStation === 'finance' && target.dataset.financeDay) {
    financeDay = Number(target.dataset.financeDay); panelTab = 'forecast'; renderStation();
    document.querySelector(`.finance-day-strip [data-finance-day="${financeDay}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (currentStation === 'finance' && target.dataset.financeAction) {
    if (target.dataset.financeAction === 'anticipate') run(anticipateReceivable, target.dataset.financeProject);
    else if (target.dataset.financeAction === 'firm') run(collectReceivable, target.dataset.financeProject, 'firm');
    return;
  }
  if (target.dataset.computerCommand && currentStation === 'work') {
    const command = target.dataset.computerCommand;
    if (command === 'reset-password' && !computerUnlocked) {
      lockComputer();
      computerLoginMode = 'reset';
    } else if (command === 'cancel-reset' && !computerUnlocked) lockComputer();
    else if (command === 'lock' && computerUnlocked) lockComputer();
    else if (command === 'start-menu' && computerUnlocked) computerStartMenuOpen = !computerStartMenuOpen;
    else if (command === 'minimize' && computerUnlocked) { computerApp = 'desktop'; computerStartMenuOpen = false; }
    else if (command === 'maximize' && computerUnlocked) computerMaximized = !computerMaximized;
    else return;
    renderStation();
    focusComputer();
    return;
  }
  if (currentStation === 'work' && !computerUnlocked) return;
  if (isComputerApp('expansion')) {
    if (target.dataset.shopToggleFilters) return browseShop({ ...currentShopRoute(shopBrowser), filtersOpen: !currentShopRoute(shopBrowser).filtersOpen });
    if (target.dataset.shopProduct) return browseShop({ page: 'product', product: target.dataset.shopProduct });
    if (target.dataset.shopCategory) return browseShop({ page: 'catalog', category: target.dataset.shopCategory });
    if (target.dataset.shopPage) return browseShop({ page: target.dataset.shopPage });
    if (target.dataset.shopBuy) return buyShopProduct(target.dataset.shopBuy);
    if (target.dataset.shopNav) {
      if (target.dataset.shopNav === 'back' && shopBrowser.index > 0) shopBrowser.index--;
      else if (target.dataset.shopNav === 'forward' && shopBrowser.index < shopBrowser.history.length - 1) shopBrowser.index++;
      renderStation();
      panelScroller().scrollTop = 0;
      document.querySelector(`#station-panel [data-shop-nav="${target.dataset.shopNav}"]`)?.focus({ preventScroll: true });
      return;
    }
  }
  if (target.dataset.terminalCommand && isComputerApp('development')) return executeTerminalCommand(target.dataset.terminalCommand);
  if (target.dataset.computerApp && currentStation === 'work' && ['desktop', 'expansion', 'development', 'laboratory'].includes(target.dataset.computerApp)) {
    if (target.dataset.computerApp === 'development' && computerApp !== 'development') { panelTab = 'main'; terminalView = 'work'; }
    computerApp = target.dataset.computerApp;
    computerStartMenuOpen = false;
    panelScroller().scrollTop = 0;
    renderStation();
    focusComputer();
    return;
  }
  if (target.dataset.puzzleAnswer && isComputerApp('development')) {
    const index = getWorkSession(state)?.currentPuzzle?.options?.findIndex((option) => option.id === target.dataset.puzzleAnswer);
    if (index >= 0) executeTerminalCommand(String(index + 1));
    return;
  }
  if (target.dataset.stationTab) return selectPanelTab(target.dataset.stationTab, 'data-station-tab');
  if (target.dataset.storeTab && isStoreOpen()) {
    return selectPanelTab(target.dataset.storeTab, 'data-store-tab');
  }
  if (target.hasAttribute('data-office-expand') && isStoreOpen()) return run(expandOffice);
  if (target.dataset.officeBuy && isStoreOpen()) return run(purchaseOfficeItem, target.dataset.officeBuy, { workstationId: target.dataset.workstation });
  if (target.dataset.roomUpgrade && isStoreOpen()) return run(upgradeRoom, target.dataset.roomUpgrade);
  if (target.dataset.computerUpgrade && isStoreOpen()) return run(upgradeComputer, target.dataset.computerUpgrade);
  if (target.dataset.roomAction && ['meeting', 'ceo'].includes(currentStation)) {
    const correctRoom = ['focus', 'team-time'].includes(target.dataset.roomAction) ? 'ceo' : 'meeting';
    if (currentStation === correctRoom) return run(performRoomAction, target.dataset.roomAction);
  }
  if (target.dataset.discover && currentStation === 'sales') run(discoverLead, target.dataset.discover);
  else if (target.dataset.negotiate && currentStation === 'sales') run(negotiateProject, target.dataset.negotiate, target.dataset.pricing);
  else if (target.dataset.interview && currentStation === 'team') run(interviewCandidate, target.dataset.interview);
  else if (target.dataset.hire && currentStation === 'team') run(hireEmployee, target.dataset.hire, target.dataset.contract);
  else if (target.dataset.event && currentStation === 'board') run(resolveProjectEvent, target.dataset.event, target.dataset.choice);
  else if (target.dataset.projectPriority && (currentStation === 'board' || currentStation === 'work' && computerApp === 'development')) run(setProjectPriority, target.dataset.projectPriority);
  else if (target.dataset.collect && currentStation === 'finance') run(collectReceivable, target.dataset.collect);
  else if (target.dataset.product && (currentStation === 'product' || currentStation === 'work' && computerApp === 'laboratory')) run(investProduct, target.dataset.product);
});
document.addEventListener('submit', (e) => {
  const financialForm = e.target.closest('[data-finance-form]');
  if (financialForm) {
    e.preventDefault();
    if (currentStation !== 'finance' || !scene.isNearStation('finance')) return;
    const data = new FormData(financialForm);
    if (financialForm.dataset.financeForm === 'borrow') run(takeLoan, Number(data.get('amount')));
    else if (financialForm.dataset.financeForm === 'repay') run(repayLoan, Number(data.get('amount')));
    else if (financialForm.dataset.financeForm === 'renegotiate') run(renegotiateReceivable, financialForm.dataset.financeProject, Number(data.get('extension')));
    return;
  }
  if (['shop-address-form', 'shop-search-form', 'shop-filter-form'].includes(e.target.id)) {
    e.preventDefault();
    if (!isComputerApp('expansion') || !scene.isNearStation('work')) return;
    const values = new FormData(e.target);
    if (e.target.id === 'shop-address-form') browseShop(parseShopAddress(values.get('address')));
    else if (e.target.id === 'shop-search-form') browseShop({ page: 'catalog', category: 'all', query: String(values.get('query') || '').trim().slice(0, 64) });
    else browseShop({ ...currentShopRoute(shopBrowser), sort: values.get('sort'), roomClass: values.get('roomClass') || '', available: values.has('available') });
    return;
  }
  if (e.target.id === 'computer-login-form') { e.preventDefault(); void submitComputerLogin(e.target); return; }
  if (e.target.id === 'terminal-command-form') {
    e.preventDefault();
    executeTerminalCommand(new FormData(e.target).get('command'));
    return;
  }
  if (e.target.id !== 'banner-form') return;
  e.preventDefault();
  if (!isStoreOpen() || !scene.isNearStation(currentStation)) return;
  const values = new FormData(e.target);
  run(customizeBanner, values.get('bannerText'), values.get('bannerColor'));
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-finance-period]') && currentStation === 'finance' && scene.isNearStation('finance')) {
    const id = Number(e.target.value);
    if (state.finance.periods.some(p => p.id === id)) { financePeriod = id; renderStation(); }
    return;
  }
  if (!currentStation || !scene.isNearStation(currentStation)) return;
  if (currentStation === 'work' && !computerUnlocked) return;
  const t = e.target;
  if (t.dataset.allocation && currentStation === 'work' && computerApp === 'development') run(setAllocation, t.dataset.allocation, Number(t.value));
  else if (t.dataset.projectMode && currentStation === 'board') run(setProjectMode, t.dataset.projectMode, t.value);
  else if (t.dataset.employeeAssignment && currentStation === 'team') {
    const employee = state.employees.find((p) => p.id === t.dataset.employeeAssignment);
    run(assignEmployee, employee.id, t.value, employee.assignmentRole || 'delivery');
  } else if (t.dataset.employeeRole && currentStation === 'team') {
    const employee = state.employees.find((p) => p.id === t.dataset.employeeRole);
    run(assignEmployee, employee.id, employee.assignment || 'auto', t.value);
  }
});
document.addEventListener('keydown', (e) => {
  const modal = document.querySelector('.modal');
  if (e.key === 'Escape') {
    if (modal?.querySelector('[data-action="close-modal"]')) { e.preventDefault(); closeModal(); }
    else if (!modal && currentStation === 'work' && computerStartMenuOpen) { e.preventDefault(); computerStartMenuOpen = false; renderStation(); focusComputer(); }
    else if (!modal && currentStation) { e.preventDefault(); closeStation(); }
  }
  const container = modal || (!document.querySelector('#station-panel').hidden ? document.querySelector('#station-panel') : null);
  if (e.key !== 'Tab' || !container) return;
  const all = [...container.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')];
  const first = all[0], last = all.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
});
window.addEventListener('resize', () => { scene?.resize(); positionPanel(); });
scene = new OfficeScene(document.querySelector('#office-canvas'), {
  onInteract: openStation,
  onMove: ({ x, y, distance }) => {
    if (!gameStarted || currentStation) return;
    state.officePosition = { x, y };
    if (distance > 0) recordTravel(state, distance);
    clearTimeout(positionTimer);
    positionTimer = setTimeout(persist, 450);
  },
});
render();
if (!saved) showProfile(true);
setInterval(() => {
  if (state.paused || currentStation || document.querySelector('.modal-overlay') || state.status === 'bankrupt') return;
  elapsed += state.speed || 1;
  if (elapsed >= 120) finishDay(true);
  else renderClock();
}, 1000);
window.addEventListener('beforeunload', () => { if (gameStarted) saveGame(state, storageKey); });
