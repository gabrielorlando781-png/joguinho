import './style.css';
import { OfficeScene } from './office.js';
import { CANDIDATES, FURNITURE, createGame, loadGame, saveGame, advanceDay, acceptProject, prospect, hireEmployee, buyFurniture, setAllocation, setProjectMode, performAction } from './simulation.js';

const icons = {
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 11h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/><circle cx="16.5" cy="14.5" r=".5"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
  chair: '<path d="M6 13V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9M4 10v6h16v-6M7 16v5m10-5v5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  play: '<path d="m8 4 13 8L8 20Z"/>',
  pause: '<path d="M7 4h3v16H7zm7 0h3v16h-3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  coffee: '<path d="M4 8h12v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Zm12 1h3a3 3 0 0 1 0 6h-3M7 3v2m4-2v2M2 23h17"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="m3 17 6-6 4 4L21 5m-6 0h6v6"/>',
  book: '<path d="M12 5v16M3 3c3-1 6 0 9 2 3-2 6-3 9-2v16c-3-1-6 0-9 2-3-2-6-3-9-2Z"/>',
  save: '<path d="M5 3h12l4 4v14H3V3Zm2 0v7h10V3M7 21v-7h10v7"/>',
  plant: '<path d="M12 14C5 14 3 9 3 4c6 0 9 3 9 10Zm0 0c0-7 3-10 9-10 0 5-2 10-9 10Zm0 0v6M7 20h10"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Zm-14-7h10M7 12h7"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.code}</svg>`;
const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const pct = (n) => Math.max(0, Math.min(100, n));
const saved = loadGame();
let gameStarted = Boolean(saved);
let state = saved || createGame({ name: 'Alex', company: 'Sua empresa', age: 26, avatarColor: '#adc972', trait: 'balanced' });
state.paused = true;
let view = 'office';
let elapsed = 0;
let scene;
let toastTimer;
let lastModalTrigger;

function avatar(color = '#adc972', size = 48, name = '') {
  return `<svg class="avatar-art" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${escape(name || 'Personagem')}"><rect width="48" height="48" rx="14" fill="${escape(color)}" fill-opacity=".14"/><path d="M12 48V34h6v-5h12v5h6v14" fill="${escape(color)}"/><path d="M15 11h18v8h3v10h-5v5H17v-5h-5V19h3" fill="#e9b891"/><path d="M12 17V9h5V5h15v5h5v12h-5v-7h-7v4H15v5h-3" fill="#45372e"/><path d="M19 23h3v3h-3m9-3h3v3h-3" fill="#292d29"/><path d="M21 31h7v2h-7" fill="#b37761"/><path d="M20 35h8v4h-8" fill="#e9b891"/></svg>`;
}

document.querySelector('#app').innerHTML = `
<div class="shell">
  <aside class="sidebar">
    <a class="brand" href="#" aria-label="devhouse, início"><span class="brand-mark">${icon('code')}</span><span>devhouse<span class="brand-dot">.</span></span></a>
    <div class="sidebar-kicker">SEU PEQUENO GRANDE NEGÓCIO</div>
    <nav class="main-nav" aria-label="Navegação principal">
      <button class="nav-item active" data-view="office">${icon('grid')}<span>Escritório</span><span class="nav-dot"></span></button>
      <button class="nav-item" data-view="projects">${icon('folder')}<span>Projetos</span><span class="nav-count" id="nav-project-count">0</span></button>
      <button class="nav-item" data-view="team">${icon('people')}<span>Equipe</span></button>
      <button class="nav-item" data-view="finance">${icon('wallet')}<span>Financeiro</span></button>
      <button class="nav-item" data-view="product">${icon('bulb')}<span>Seu produto</span>${icon('lock', 'nav-lock')}</button>
    </nav>
    <div class="sidebar-kicker second">FAÇA DO SEU JEITO</div>
    <nav aria-label="Personalização e ajuda">
      <button class="nav-item" data-view="furniture">${icon('chair')}<span>Mobiliar</span></button>
      <button class="nav-item" data-action="guide">${icon('book')}<span>Guia do fundador</span></button>
    </nav>
    <div class="sidebar-bottom">
      <div class="stage-card"><div class="stage-card-top"><span class="stage-seed">${icon('plant')}</span><span>DO ZERO AO PRIMEIRO SIM</span></div><strong>Estágio 01 <span>·</span> Fundador solo</strong><div class="thin-progress"><span id="stage-progress"></span></div><p id="stage-copy">Seu primeiro cliente muda tudo.</p></div>
      <button class="founder-profile" data-action="profile" id="founder-profile"></button>
      <div class="sidebar-footer"><span class="online-dot"></span> Versão 0.1 <span>Feito de possibilidades</span></div>
    </div>
  </aside>
  <div class="main-area">
    <header class="topbar"><div class="breadcrumb"><span id="company-breadcrumb"></span><span>/</span><strong id="view-breadcrumb">Escritório</strong></div><div class="topbar-right"><span class="save-status" id="save-status">${icon('check')} Salvo neste navegador</span><button class="icon-button" data-action="guide" aria-label="Abrir guia do jogo">${icon('book')}</button></div></header>
    <main>
      <div class="page-heading"><div><div class="eyebrow"><span class="online-dot"></span> SUA HISTÓRIA ESTÁ SÓ COMEÇANDO</div><h1 id="page-title">Seu primeiro escritório<span>.</span></h1><p id="page-subtitle">Um notebook, uma ideia e muita coisa para construir.</p></div><div class="day-control"><div class="day-label">${icon('sun')}<div><strong id="day-date">Segunda-feira</strong><span id="day-time">Dia 01 · 09:00</span></div></div><div class="time-buttons"><button class="icon-button" id="pause-button" data-action="pause" aria-label="Retomar tempo">${icon('play')}</button><button class="speed-button" data-action="speed" id="speed-button" title="Alterar velocidade do tempo">1×</button></div></div></div>
      <section class="metrics" aria-label="Indicadores da empresa" id="metrics"></section>
      <section id="office-view">
        <div class="office-grid">
          <div class="office-card panel"><div class="panel-heading"><div class="section-label">${icon('grid')} O ESCRITÓRIO <span class="tag">SEU PRIMEIRO CANTO</span></div><span class="room-status"><span class="online-dot"></span> Home office</span></div><div class="canvas-wrap"><canvas id="office-canvas" tabindex="0" aria-label="Escritório jogável. Use WASD ou setas para andar, E para interagir. Clique no chão para caminhar."></canvas><div class="room-corner"><span class="live-pip"></span> <span id="room-company"></span> <span class="room-corner-separator">/</span> EST. 2026</div></div><div class="office-controls"><span class="keyboard-controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>para andar</span><span class="control-divider"></span><kbd>E</kbd><span>interagir</span></span><button class="text-button" data-action="guide">${icon('message')} Como jogar</button></div></div>
          <aside id="daily-panel" class="panel daily-panel"></aside>
        </div>
        <section class="first-steps" id="first-steps"></section>
        <div class="bottom-grid"><section class="panel projects-mini" id="projects-mini"></section><section class="panel activity-panel" id="activity-panel"></section></div>
      </section>
      <section id="management-view" hidden></section>
      <footer class="main-footer"><span>Um dia de cada vez. Uma empresa do seu jeito.</span><span>${icon('save')} Progresso salvo automaticamente neste navegador</span></footer>
    </main>
  </div>
</div>`;

function toast(message, ok = true) {
  const el = document.querySelector('#toast-root');
  el.innerHTML = `<div class="toast ${ok ? '' : 'toast-error'}">${icon(ok ? 'check' : 'message')}<span>${escape(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.innerHTML = ''; }, 4800);
}

function persist() {
  if (!gameStarted) return;
  const result = saveGame(state);
  const failed = result === false || result?.ok === false;
  document.querySelector('#save-status').innerHTML = failed ? `${icon('message')} Salvamento indisponível` : `${icon('check')} Salvo neste navegador`;
  if (failed) toast('O navegador não permitiu salvar. Mantenha esta aba aberta.', false);
}

function run(fn, ...args) {
  const focused = document.activeElement;
  const focusAllocation = focused?.dataset?.allocation;
  const focusProject = focused?.dataset?.projectMode;
  const result = fn(state, ...args);
  if (result?.message) toast(result.message, result.ok !== false);
  persist();
  render();
  if (focusAllocation) document.querySelector(`[data-allocation="${focusAllocation}"]`)?.focus();
  if (focusProject) document.querySelector(`[data-project-mode="${CSS.escape(focusProject)}"]`)?.focus();
  return result;
}

function activeProjects() { return state.projects.filter((p) => p.status !== 'delivered' && p.progress < p.hours); }
function dailyCost() { return 110 + state.employees.reduce((sum, e) => sum + (e.salary || 0) * (e.contract === 'CLT' ? 1.7 : 1.15) / 20, 0); }

function render() {
  const p = state.profile;
  document.querySelector('#company-breadcrumb').textContent = p.company;
  document.querySelector('#room-company').textContent = p.company;
  document.querySelector('#founder-profile').innerHTML = `${avatar(p.avatarColor, 40, p.name)}<span><strong>${escape(p.name)}</strong><small>Fundador · ${p.age} anos</small></span>${icon('down')}`;
  document.querySelector('#nav-project-count').textContent = activeProjects().length;
  const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  document.querySelector('#day-date').textContent = days[(state.day - 1) % 7];
  const minute = Math.floor(elapsed / 120 * 480);
  document.querySelector('#day-time').textContent = `Dia ${String(state.day).padStart(2, '0')} · ${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  document.querySelector('#pause-button').innerHTML = icon(state.paused ? 'play' : 'pause');
  document.querySelector('#pause-button').setAttribute('aria-label', state.paused ? 'Retomar tempo' : 'Pausar tempo');
  document.querySelector('#speed-button').textContent = `${state.speed || 1}×`;
  const runway = Math.max(0, Math.floor(state.cash / dailyCost()));
  const active = activeProjects().length;
  document.querySelector('#metrics').innerHTML = `
    <article class="metric"><div class="metric-label">${icon('wallet')} CAIXA DISPONÍVEL <span class="metric-dot green"></span></div><div class="metric-value">${money(state.cash)}</div><div class="metric-detail">${icon('trend')} <span>${runway} dias</span> de fôlego no ritmo atual</div></article>
    <article class="metric"><div class="metric-label">${icon('folder')} PROJETOS ATIVOS</div><div class="metric-value">${String(active).padStart(2, '0')} <span class="metric-unit">/ 03</span></div><div class="metric-detail">${active ? `${state.stats.delivered || 0} entregues · ${state.allocation.delivery}h/dia de desenvolvimento` : 'Seu próximo cliente está por aí'}</div></article>
    <article class="metric"><div class="metric-label">${icon('star')} REPUTAÇÃO <span class="metric-hint">${state.reputation >= 40 ? 'CRESCENDO' : 'COMEÇANDO'}</span></div><div class="metric-value">${Math.round(state.reputation)}<span class="metric-unit"> / 100</span></div><div class="metric-detail"><div class="mini-meter"><span style="width:${pct(state.reputation)}%"></span></div><span>Cada entrega conta</span></div></article>
    <article class="metric"><div class="metric-label">${icon('coffee')} SUA ENERGIA</div><div class="metric-value">${Math.round(state.energy)}<span class="metric-unit">%</span><span class="energy-caption">${state.energy > 65 ? 'Pronto para criar' : state.energy > 30 ? 'Pausa para um café?' : 'Hora de descansar'}</span></div><div class="metric-detail"><div class="mini-meter energy"><span style="width:${pct(state.energy)}%"></span></div><span>${state.debt > 0 ? `${Math.round(state.debt)}% de dívida técnica` : 'Cabeça fresca, código limpo'}</span></div></article>`;
  const items = [
    { key: 'sales', label: 'Prospectar & vender', icon: 'message', cls: 'sales', detail: 'Encontre quem precisa de você' },
    { key: 'delivery', label: 'Desenvolver', icon: 'code', cls: 'delivery', detail: 'Transforme horas em entregas' },
    { key: 'quality', label: 'Qualidade & gestão', icon: 'target', cls: 'quality', detail: 'Menos bugs, mais confiança' },
  ];
  document.querySelector('#daily-panel').innerHTML = `<div class="section-label">${icon('clock')} SEU DIA, SUAS ESCOLHAS</div><h2>Tempo é o seu capital<span>.</span></h2><p class="muted">Você tem <strong>8 horas</strong>. Onde vai investir?</p><div class="allocation-bar">${items.map((i) => `<span class="${i.cls}" style="flex:${state.allocation[i.key] || 0}"></span>`).join('')}</div><div class="allocation-rows">${items.map((i) => `<div class="allocation-row"><div class="allocation-label"><span class="allocation-icon ${i.cls}">${icon(i.icon)}</span><span><strong>${i.label}</strong><small>${i.detail}</small></span><b>${state.allocation[i.key]}h</b></div><input type="range" min="0" max="8" step="1" value="${state.allocation[i.key]}" class="range ${i.cls}" data-allocation="${i.key}" aria-label="Horas para ${i.label}" /></div>`).join('')}</div><div class="daily-insight">${icon('bulb')}<span>${active ? 'Vender mantém o futuro aberto. Entregar paga a conta.' : 'Antes do primeiro projeto, reserve um tempo para vender.'}</span></div><button class="primary-button full" data-action="end-day">Encerrar o dia ${icon('arrow')}</button><div class="daily-footnote">${state.paused ? 'Tempo pausado · decida sem pressa' : `${state.speed}× · um dia dura ${120 / state.speed} segundos`}</div>`;
  const steps = [ { done: true, label: 'Abra as portas', subtitle: 'Sua empresa nasceu' }, { done: state.projects.length > 0, label: 'Conquiste um cliente', subtitle: 'Feche seu primeiro projeto' }, { done: state.stats.delivered > 0, label: 'Faça a primeira entrega', subtitle: 'Construa sua reputação' } ];
  document.querySelector('#first-steps').innerHTML = `<div class="first-steps-title"><span class="small-badge">${icon('plant')}</span><span><strong>Grandes coisas começam pequenas.</strong><small>Seu caminho até a primeira conquista</small></span></div><div class="steps-list">${steps.map((s, i) => `<div class="step ${s.done ? 'done' : ''}"><span class="step-number">${s.done ? icon('check') : `0${i + 1}`}</span><span><strong>${s.label}</strong><small>${s.subtitle}</small></span>${i < 2 ? `<span class="step-connector"></span>` : ''}</div>`).join('')}</div>`;
  document.querySelector('#stage-progress').style.width = `${Math.min(100, 10 + state.projects.length * 18 + state.stats.delivered * 24 + state.employees.length * 15)}%`;
  document.querySelector('#stage-copy').textContent = state.stats.delivered > 0 ? 'Uma entrega feita. O próximo passo é delegar.' : 'Seu primeiro cliente muda tudo.';
  document.querySelector('#projects-mini').innerHTML = `<div class="section-header"><div><div class="section-label">O QUE VEM A SEGUIR</div><h3>${active ? 'Projetos em movimento' : 'Seu primeiro “vamos fazer?”'}</h3></div><button class="text-button" data-view="projects">Ver projetos ${icon('arrow')}</button></div>${active ? activeProjects().slice(0, 2).map(projectRow).join('') : `<div class="lead-preview"><span class="lead-avatar">${icon('folder')}</span><div><strong>${escape(state.leads[0]?.title || 'Encontre sua próxima oportunidade')}</strong><p>${escape(state.leads[0]?.client || 'Uma boa conversa pode virar seu primeiro contrato.')}</p></div><button class="secondary-button" data-view="projects">Explorar oportunidades ${icon('arrow')}</button></div>`}`;
  document.querySelector('#activity-panel').innerHTML = `<div class="section-header"><div><div class="section-label">UM PASSO DE CADA VEZ</div><h3>Diário do fundador</h3></div><span class="tag">DIA ${String(state.day).padStart(2, '0')}</span></div><div class="activity-list">${(state.log || []).slice(0, 3).map((l, i) => `<div class="activity"><span class="activity-dot ${i === 0 ? 'current' : ''}"></span><span>${escape(l.message)}</span><small>D${l.day}</small></div>`).join('') || '<div class="activity"><span class="activity-dot current"></span><span>As portas estão abertas. A sua história começa hoje.</span><small>D1</small></div>'}</div>`;
  document.querySelector('#office-view').hidden = view !== 'office';
  document.querySelector('#management-view').hidden = view === 'office';
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.classList.contains('nav-item') && b.dataset.view === view));
  const titles = {
    office: ['Escritório', 'Seu primeiro escritório', 'Um notebook, uma ideia e muita coisa para construir.'],
    projects: ['Projetos', 'Uma conversa vira um projeto', 'Venda com cuidado. Entregue com orgulho. Seu tempo é limitado.'],
    team: ['Equipe', 'Gente boa muda o jogo', 'Delegar libera seu tempo. Contratar compromete seu caixa.'],
    finance: ['Financeiro', 'Cuide do seu próximo mês', 'Lucro no papel é bom. Dinheiro na conta mantém as portas abertas.'],
    furniture: ['Mobiliar', 'Um espaço para suas ideias', 'Faça seu escritório crescer junto com a sua empresa.'],
    product: ['Seu produto', 'Hoje serviço. Amanhã, produto', 'A próxima grande ideia pode nascer do problema de um cliente.'],
  };
  document.querySelector('#view-breadcrumb').textContent = titles[view][0];
  document.querySelector('#page-title').innerHTML = `${titles[view][1]}<span>.</span>`;
  document.querySelector('#page-subtitle').textContent = titles[view][2];
  if (view !== 'office') renderManagement();
  scene?.setState(state);
  if (view === 'office') requestAnimationFrame(() => scene?.resize());
}

function projectRow(p) {
  const progress = pct(p.progress / p.hours * 100);
  return `<div class="project-row"><div><strong>${escape(p.title)}</strong><small>${escape(p.client)} · ${money(p.price)} · prazo D${p.deadline}</small></div><div class="project-progress"><div class="mini-meter"><span style="width:${progress}%"></span></div><span>${Math.round(progress)}%</span></div></div>`;
}

function renderManagement() {
  const el = document.querySelector('#management-view');
  if (view === 'projects') {
    el.innerHTML = `<div class="management-grid"><section class="panel management-panel"><div class="section-header"><div><div class="section-label">SEU PIPELINE</div><h2>Oportunidades abertas</h2></div><button class="secondary-button" data-action="prospect">${icon('plus')} Prospectar</button></div><p class="muted small">Negocie um escopo inicial. O pagamento chega 3 dias depois da entrega.</p><div class="opportunity-list">${state.leads.length ? state.leads.map((l, i) => `<article class="opportunity"><div class="opportunity-top"><span class="client-monogram color-${i % 3}">${escape(l.client.slice(0, 2).toUpperCase())}</span><span><small>${escape(l.sector || 'NOVO CLIENTE')}</small><strong>${escape(l.client)}</strong></span><span class="tag">LEAD</span></div><h3>${escape(l.title)}</h3><p>${escape(l.description || 'Um projeto enxuto para transformar uma necessidade em resultado.')}</p><div class="opportunity-meta"><span>${icon('clock')} ${l.hours}h estimadas</span><span>${l.duration} dias</span></div><div class="opportunity-bottom"><strong>${money(l.price)}</strong><button class="primary-button compact" data-accept="${escape(l.id)}">Fechar contrato ${icon('arrow')}</button></div></article>`).join('') : '<div class="empty-state">Seu pipeline está vazio. Prospecte ou reserve horas de vendas para encontrar clientes.</div>'}</div></section><section class="panel management-panel"><div class="section-label">ENTREGA & QUALIDADE</div><h2>Na sua mesa</h2>${state.projects.length ? state.projects.map((p) => `<article class="project-card">${projectRow(p)}<div class="project-card-meta"><span class="status-pill ${p.status === 'delivered' ? 'success' : ''}">${p.status === 'delivered' ? 'Entregue' : `Em desenvolvimento · ${Math.max(0, p.deadline - state.day)} dias restantes`}</span><span>${Number(p.progress).toFixed(1)} / ${p.hours}h</span></div>${p.status !== 'delivered' ? `<label class="select-label">Modo de execução<select data-project-mode="${escape(p.id)}"><option value="fast" ${p.mode === 'fast' ? 'selected' : ''}>Rápido e sujo · menos horas, mais dívida</option><option value="standard" ${p.mode === 'standard' ? 'selected' : ''}>Padrão · ritmo equilibrado</option><option value="careful" ${p.mode === 'careful' ? 'selected' : ''}>Caprichado · mais horas, mais reputação</option></select></label>` : '<p class="muted small">Projeto entregue. Confira o recebimento no financeiro.</p>'}</article>`).join('') : `<div class="empty-state large">${icon('folder')}<h3>Uma mesa cheia começa com um sim.</h3><p>Feche uma oportunidade ao lado e aloque horas de desenvolvimento no escritório.</p></div>`}<div class="concept-note">${icon('bulb')}<p><strong>Velocidade × qualidade</strong><br/>Correr gera dívida técnica. Reserve horas de qualidade para evitar que os próximos projetos fiquem mais lentos.</p></div></section></div>`;
  } else if (view === 'team') {
    el.innerHTML = `<div class="management-section-heading"><div><div class="section-label">QUEM FAZ ACONTECER</div><h2>Sua equipe <span class="count-badge">${state.employees.length + 1}</span></h2></div><span class="muted">CLT custa 1,7× o salário · PJ custa 1,15×</span></div><div class="team-grid"><article class="panel person-card">${avatar(state.profile.avatarColor, 64, state.profile.name)}<span class="tag">FUNDADOR</span><h3>${escape(state.profile.name)}</h3><p>Dev, comercial e gestor. Por enquanto.</p><div class="person-footer"><span>Disponibilidade</span><strong>8h / dia</strong></div></article>${state.employees.map((e) => `<article class="panel person-card">${avatar(e.color || '#8ebdaa', 64, e.name)}<span class="tag">${escape(e.contract)}</span><h3>${escape(e.name)}</h3><p>${escape(e.role)} · ${escape(e.trait)}</p><div class="person-footer"><span>Custo mensal</span><strong>${money(e.salary * (e.contract === 'CLT' ? 1.7 : 1.15))}</strong></div></article>`).join('')}</div><div class="management-section-heading"><div><div class="section-label">SEU PRÓXIMO PASSO</div><h2>Talentos disponíveis</h2></div><span class="muted">Contratação inicial: até 2 pessoas. Mais mesas ampliam a equipe.</span></div><div class="team-grid">${CANDIDATES.filter((c) => !state.employees.some((e) => e.id === c.id)).map((c) => `<article class="panel person-card candidate">${avatar(c.color || '#cd9c7d', 64, c.name)}<h3>${escape(c.name)}</h3><p>${escape(c.role)}</p><span class="trait-pill">${escape(c.trait)}</span><div class="person-footer"><span>Salário-base / mês</span><strong>${money(c.salary)}</strong></div><div class="hire-actions"><button class="primary-button compact" data-hire="${escape(c.id)}" data-contract="PJ">Contratar PJ</button><button class="secondary-button compact" data-hire="${escape(c.id)}" data-contract="CLT">CLT</button></div></article>`).join('')}</div>`;
  } else if (view === 'finance') {
    const total = (state.receivables || []).reduce((s, r) => s + (r.amount || 0), 0);
    el.innerHTML = `<div class="finance-summary panel"><div><div class="section-label">VISIBILIDADE PARA DECIDIR</div><h2>Seu dinheiro, no tempo certo.</h2><p class="muted">Receber depois de entregar exige reserva de caixa.</p></div><div><span>A receber</span><strong>${money(total)}</strong></div><div><span>Custo por dia útil</span><strong>${money(dailyCost())}</strong></div><div><span>Receita recebida</span><strong>${money(state.stats.revenue)}</strong></div></div><div class="management-grid"><section class="panel management-panel"><div class="section-label">O QUE ENTRA E O QUE SAI</div><h2>Movimentações</h2><div class="ledger">${(state.ledger || []).slice(0, 30).map((l) => `<div class="ledger-row"><span class="ledger-icon ${l.amount >= 0 ? 'positive' : ''}">${icon(l.amount >= 0 ? 'trend' : 'wallet')}</span><span><strong>${escape(l.label)}</strong><small>Dia ${l.day}</small></span><b class="${l.amount >= 0 ? 'positive-text' : ''}">${l.amount >= 0 ? '+' : '−'}${money(Math.abs(l.amount))}</b></div>`).join('') || '<p class="muted">Sua primeira movimentação aparece ao encerrar o dia.</p>'}</div></section><section class="panel management-panel"><div class="section-label">ENTREGOU? AGORA AGUARDE.</div><h2>Recebimentos previstos</h2>${state.receivables?.length ? state.receivables.map((r) => `<div class="receivable"><div><strong>${escape(r.label || r.client || 'Pagamento de projeto')}</strong><small>Previsto no dia ${r.dueDay || r.day}</small></div><b>${money(r.amount)}</b></div>`).join('') : `<div class="empty-state">${icon('wallet')}<p>Nenhum recebimento pendente.<br/>Seu primeiro contrato começa a movimentar o caixa.</p></div>`}<div class="concept-note">${icon('bulb')}<p><strong>Caixa é fôlego</strong><br/>A folha vence mesmo quando o cliente não pagou. Caixa negativo abre avisos; 60 dias no vermelho levam à falência.</p></div><button class="danger-text" data-action="new-game">Começar uma nova história</button></section></div>`;
  } else if (view === 'furniture') {
    el.innerHTML = `<div class="management-section-heading"><div><div class="section-label">INVISTA NO SEU CANTO</div><h2>Conforto que também produz</h2></div><span class="muted">As melhorias aparecem no escritório e afetam o trabalho.</span></div><div class="furniture-grid">${FURNITURE.map((f, i) => { const owned = state.furniture.some((o) => (typeof o === 'string' ? o : o.id) === f.id); return `<article class="panel furniture-card"><div class="furniture-illustration illustration-${i}">${icon(['chair','plant','coffee','grid'][i % 4])}</div><div class="furniture-info"><h3>${escape(f.name)}</h3><p>${escape(f.description)}</p><div class="opportunity-bottom"><strong>${money(f.price)}</strong><button class="${owned ? 'secondary' : 'primary'}-button compact" data-buy="${escape(f.id)}" ${owned ? 'disabled' : ''}>${owned ? `${icon('check')} No escritório` : `Comprar ${icon('plus')}`}</button></div></div></article>`; }).join('')}</div>`;
  } else if (view === 'product') {
    el.innerHTML = `<section class="panel product-preview"><span class="big-bulb">${icon('bulb')}</span><div class="tag">PRÓXIMO CAPÍTULO · ESTÁGIO 03</div><h2>De vender horas<br/>a construir possibilidades<span>.</span></h2><p>Um problema se repete entre clientes. Você tem uma ideia. Sua equipe pode construir um produto próprio — mas cada hora investida é uma hora que deixa de faturar.</p><div class="product-roadmap">${['Ideia', 'MVP', 'Lançamento', 'Crescimento'].map((x, i) => `<span><b>0${i + 1}</b>${x}</span>`).join('')}</div><div class="concept-note">${icon('lock')}<p>O desenvolvimento de produto é um próximo capítulo. Nesta primeira versão, construa a base: venda, entregue, contrate e aprenda a cuidar do caixa.</p></div><button class="primary-button" data-view="office">Voltar ao meu escritório ${icon('arrow')}</button></section>`;
  }
}

function navigate(next) {
  view = next;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  openModal(`<div class="profile-layout"><div class="profile-intro"><a class="brand"><span class="brand-mark">${icon('code')}</span><span>devhouse<span class="brand-dot">.</span></span></a><span class="welcome-tag">CAPÍTULO 01 · A PRIMEIRA IDEIA</span><h2 id="modal-title">Toda grande<br/>empresa começa<br/>com <em>alguém.</em></h2><p>Você deixou a CLT. Tem um notebook,<br/>R$ 20 mil e uma ideia na cabeça.<br/>O próximo passo é seu.</p><div class="founder-preview"><div class="portrait-grid"></div><div id="profile-avatar">${avatar(p.avatarColor, 180, p.name)}</div><span class="portrait-label">${icon('plant')} FUTURO FUNDADOR</span></div><div class="intro-bottom"><span class="online-dot"></span> Construa algo que é seu.</div></div><form id="profile-form" class="profile-form"><div class="section-label">${isNew ? 'ANTES DE ABRIR AS PORTAS' : 'SUA IDENTIDADE'}</div><h3>${isNew ? 'Vamos conhecer o fundador.' : 'Do seu jeito.'}</h3><p class="muted">Dê um nome à sua próxima grande história.</p><label>Seu nome<input name="name" required maxlength="32" placeholder="Como podemos te chamar?" autocomplete="given-name" value="${isNew ? '' : escape(p.name)}" /></label><label>Nome da empresa<input name="company" required maxlength="40" placeholder="A próxima grande software house" autocomplete="organization" value="${isNew ? '' : escape(p.company)}" /></label><div class="profile-fields"><label>Sua idade<input name="age" type="number" min="18" max="80" required value="${p.age}" /></label><label>Seu ponto forte<select name="trait"><option value="balanced" ${p.trait === 'balanced' ? 'selected' : ''}>Um pouco de tudo</option><option value="technical" ${p.trait === 'technical' ? 'selected' : ''}>Dev de coração</option><option value="commercial" ${p.trait === 'commercial' ? 'selected' : ''}>Bom de conversa</option></select></label></div><fieldset class="color-fieldset"><legend>A cor do seu personagem</legend><div class="color-choices">${colors.map((c, i) => `<label class="color-choice" style="--swatch:${c}"><input type="radio" name="avatarColor" value="${c}" ${c === p.avatarColor || (!colors.includes(p.avatarColor) && i === 0) ? 'checked' : ''} aria-label="${['Verde', 'Azul', 'Lilás', 'Terracota', 'Mostarda'][i]}"/><span>${icon('check')}</span></label>`).join('')}<small>Um toque de personalidade.</small></div></fieldset><button type="submit" class="primary-button full">${isNew ? 'Abrir as portas' : 'Salvar meu perfil'} ${icon('arrow')}</button><p class="form-footnote">${icon('save')} Seu progresso fica salvo neste navegador.</p></form></div>`, true, !isNew);
  document.querySelector('#profile-form').addEventListener('change', (e) => { if (e.target.name === 'avatarColor') document.querySelector('#profile-avatar').innerHTML = avatar(e.target.value, 180); });
  document.querySelector('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const profile = { name: data.get('name').trim(), company: data.get('company').trim(), age: Number(data.get('age')), trait: data.get('trait'), avatarColor: data.get('avatarColor') };
    if (!profile.name || !profile.company) return toast('Preencha seu nome e o nome da empresa.', false);
    if (isNew) { state = createGame(profile); gameStarted = true; elapsed = 0; scene.resetPlayer(); }
    else state.profile = profile;
    persist(); closeModal(); render();
    toast(isNew ? `${profile.company} está de portas abertas. Bem-vindo, ${profile.name}!` : 'Seu perfil foi atualizado.');
  });
}

function showGuide() {
  openModal(`<div class="section-label">SEU MANUAL DE COMEÇO</div><h2 id="modal-title">Você vende tempo.<br/>Faça cada hora contar<span>.</span></h2><p class="muted">Explore o escritório com WASD, as setas ou um clique no chão. Chegue perto de um objeto e pressione E.</p><div class="guide-grid"><article>${icon('message')}<h3>1. Encontre um cliente</h3><p>Abra Projetos e feche um contrato. Reserve horas de prospecção para manter novas oportunidades chegando.</p></article><article>${icon('code')}<h3>2. Faça acontecer</h3><p>Divida suas 8h entre vendas, desenvolvimento e qualidade. O computador adianta o trabalho; o quadro mostra os projetos.</p></article><article>${icon('clock')}<h3>3. Viva um dia de cada vez</h3><p>Use play para o tempo correr ou “Encerrar o dia”. Um dia dura 2 minutos em 1×. No fim, confira entregas, energia e custos.</p></article><article>${icon('wallet')}<h3>4. Cresça com fôlego</h3><p>Recebimentos chegam em D+3 após a entrega. Contratar aumenta produtividade e folha. Melhorias ajudam sua rotina.</p></article></div><div class="concept-note">${icon('target')}<p>Vender × entregar. Velocidade × qualidade. Serviço × produto. Essas são as escolhas que constroem sua empresa.</p></div><button class="primary-button full" data-action="close-modal">Vamos construir ${icon('arrow')}</button>`);
}

function finishDay() {
  const before = { cash: state.cash, delivered: state.stats.delivered, hours: state.stats.hoursWorked };
  const result = advanceDay(state);
  if (result.ok === false) return toast(result.message, false);
  let skippedWeekend = 0;
  while ((state.day - 1) % 7 >= 5 && state.status !== 'bankrupt') {
    advanceDay(state);
    skippedWeekend += 1;
  }
  if (skippedWeekend) result.message += ' Fim de semana pulado: descanso recuperado e custos fixos contabilizados.';
  elapsed = 0;
  state.paused = true;
  persist(); render();
  openModal(`<div class="section-label">FECHOU O NOTEBOOK. RESPIRA.</div><h2 id="modal-title">Mais um dia construído<span>.</span></h2><p class="muted">${escape(result.message)}</p><div class="day-summary"><div><span>Horas trabalhadas</span><strong>${Number(state.stats.hoursWorked - before.hours).toFixed(1)}h</strong></div><div><span>Projetos entregues</span><strong>${state.stats.delivered - before.delivered}</strong></div><div><span>Variação no caixa</span><strong class="${state.cash >= before.cash ? 'positive-text' : ''}">${state.cash >= before.cash ? '+' : '−'}${money(Math.abs(state.cash - before.cash))}</strong></div><div><span>Energia para amanhã</span><strong>${Math.round(state.energy)}%</strong></div></div>${state.status === 'bankrupt' ? '<div class="concept-note warning">Sua empresa passou 60 dias no vermelho. Confira as decisões no financeiro e comece uma nova história.</div>' : `<div class="concept-note">${icon('bulb')}<p>${activeProjects().length ? 'Seu projeto avança nas horas reservadas para desenvolvimento. Não deixe as vendas pararem.' : 'O próximo dia começa com possibilidades. Encontre um cliente e faça seu tempo render.'}</p></div>`}<button class="primary-button full" data-action="close-modal">${state.status === 'bankrupt' ? 'Ver meu escritório' : 'Começar o próximo dia'} ${icon('arrow')}</button>`);
}

function handleAction(action) {
  if (action === 'guide') showGuide();
  else if (action === 'profile') showProfile();
  else if (action === 'close-modal') closeModal();
  else if (action === 'pause') { state.paused = !state.paused; persist(); render(); }
  else if (action === 'speed') { state.speed = ({ 1: 2, 2: 4, 4: 1 })[state.speed] || 1; persist(); render(); }
  else if (action === 'end-day') finishDay();
  else if (action === 'prospect') run(prospect);
  else if (action === 'new-game') openModal(`<div class="section-label">UM NOVO COMEÇO</div><h2 id="modal-title">Abrir uma nova empresa?</h2><p class="muted">A história atual será substituída neste navegador. Seu caixa, projetos, equipe e mobília serão reiniciados.</p><div class="confirm-actions"><button class="secondary-button" data-action="close-modal">Continuar minha história</button><button class="primary-button" data-action="confirm-new">Começar do zero ${icon('arrow')}</button></div>`);
  else if (action === 'confirm-new') showProfile(true);
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target || target.disabled) return;
  if (target.dataset.view) navigate(target.dataset.view);
  else if (target.dataset.action) handleAction(target.dataset.action);
  else if (target.dataset.accept) run(acceptProject, target.dataset.accept);
  else if (target.dataset.hire) run(hireEmployee, target.dataset.hire, target.dataset.contract);
  else if (target.dataset.buy) run(buyFurniture, target.dataset.buy);
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.allocation) run(setAllocation, e.target.dataset.allocation, Number(e.target.value));
  if (e.target.dataset.projectMode) run(setProjectMode, e.target.dataset.projectMode, e.target.value);
});
document.addEventListener('keydown', (e) => {
  const modal = document.querySelector('.modal');
  if (!modal) return;
  if (e.key === 'Escape' && modal.querySelector('[data-action="close-modal"]')) { e.preventDefault(); closeModal(); }
  if (e.key === 'Tab') {
    const all = [...modal.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')];
    const first = all[0], last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); navigate('office'); });
scene = new OfficeScene(document.querySelector('#office-canvas'), { onInteract: (action) => {
  if (action === 'board') navigate('projects');
  else if (action === 'finance') navigate('finance');
  else run(performAction, action);
} });
render();
if (!saved) showProfile(true);
setInterval(() => {
  if (state.paused || document.querySelector('.modal-overlay') || state.status === 'bankrupt') return;
  elapsed += state.speed || 1;
  if (elapsed >= 120) finishDay();
  else {
    const minute = Math.floor(elapsed / 120 * 480);
    document.querySelector('#day-time').textContent = `Dia ${String(state.day).padStart(2, '0')} · ${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  }
}, 1000);
window.addEventListener('beforeunload', () => { if (gameStarted) saveGame(state); });
