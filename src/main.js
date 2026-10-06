import './style.css';
import { OfficeScene } from './office.js';
import { icon, escape, money, pct, avatar } from './ui.js';
import { CANDIDATES, FURNITURE, createGame, loadGame, saveGame, advanceDay, prospect, hireEmployee, buyFurniture, setAllocation, setProjectMode, performAction, negotiateProject, discoverLead, interviewCandidate, assignEmployee, resolveProjectEvent, setProjectPriority, collectReceivable, investProduct, recordTravel, takeLoan, repayLoan } from './simulation.js';

const saved = loadGame();
let gameStarted = Boolean(saved);
let state = saved || createGame({ name: 'Alex', company: 'Sua empresa', age: 26, avatarColor: '#adc972', trait: 'balanced' });
state.paused = true;
let elapsed = 0;
let scene;
let currentStation = null;
let panelWasPaused = true;
let panelTab = 'main';
let pendingSummary = null;
let toastTimer;
let positionTimer;
let lastModalTrigger;
let lastPrompt = '';
const stations = {
  work: { title: 'Estação de desenvolvimento', subtitle: 'Seu notebook · rotina, foco e qualidade', icon: 'code', short: 'Desenvolvimento' },
  sales: { title: 'Mesa comercial', subtitle: 'Converse, descubra o escopo e negocie', icon: 'message', short: 'Comercial' },
  board: { title: 'Quadro de projetos', subtitle: 'Prazos, entregas e decisões do time', icon: 'folder', short: 'Projetos' },
  finance: { title: 'Setor financeiro', subtitle: 'Fluxo de caixa, cobranças e crédito', icon: 'wallet', short: 'Financeiro' },
  team: { title: 'Pessoas & cultura', subtitle: 'Entreviste, contrate e distribua responsabilidades', icon: 'people', short: 'RH' },
  furniture: { title: 'Bancada de arquitetura', subtitle: 'Invista no espaço e na produtividade', icon: 'chair', short: 'Mobília' },
  coffee: { title: 'Copa', subtitle: 'Uma pequena pausa também faz parte do trabalho', icon: 'coffee', short: 'Café' },
  rest: { title: 'Cantinho de descanso', subtitle: 'Uma equipe descansada constrói melhor', icon: 'sun', short: 'Descanso' },
  product: { title: 'Laboratório de produto', subtitle: 'Transforme problemas conhecidos em uma aposta sua', icon: 'bulb', short: 'Laboratório' },
  reception: { title: 'Diário do fundador', subtitle: 'Sua trajetória, reputação e próximos passos', icon: 'book', short: 'Diário' },
  exit: { title: 'Fechamento do escritório', subtitle: 'Confira a rotina antes de fechar as portas', icon: 'clock', short: 'Fechar o dia' },
};

document.querySelector('#app').innerHTML = `<main class="game-shell"><section id="world-stage" class="world-stage" aria-label="Escritório da sua empresa"><canvas id="office-canvas" tabindex="0"></canvas><header class="world-topbar"><a class="brand" href="#" aria-label="devhouse"><span class="brand-mark">${icon('code')}</span><span>devhouse<span class="brand-dot">.</span></span></a><div class="world-identity"><strong id="company-name"></strong><small>SEU ESCRITÓRIO · SUA HISTÓRIA</small></div><div class="world-time"><strong id="day-date"></strong><span id="day-time"></span></div><div class="time-controls"><button class="icon-button" id="pause-button" data-action="pause" aria-label="Retomar tempo">${icon('play')}</button><button class="speed-button" id="speed-button" data-action="speed" title="Alterar velocidade">1×</button><span class="hud-divider"></span><button class="icon-button" data-travel="reception" aria-label="Ir ao diário e ao guia do fundador">${icon('book')}</button><span id="save-status" class="save-status" title="Salvamento automático">${icon('check')}</span></div></header><div class="world-bottom"><div class="walk-help"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar</span><span><kbd>E</kbd> consultar</span><span><kbd>Esc</kbd> voltar</span></div><div id="context-prompt" class="context-prompt">Clique em um setor para caminhar até ele.</div><nav class="office-compass" aria-label="Caminhar até um setor">${Object.entries(stations).map(([key, s]) => `<button data-travel="${key}" title="Caminhar até ${s.short}" aria-label="Caminhar até ${s.short}">${icon(s.icon)}<span>${s.short}</span></button>`).join('')}</nav></div><div class="world-watermark">CAPÍTULO 02 · A EMPRESA ACONTECE AQUI</div><section id="station-panel" class="station-panel" hidden aria-label="Consulta no setor do escritório"></section></section></main>`;

function activeProjects() { return state.projects.filter((p) => p.status === 'active'); }
function dailyCost() { return 110 + state.employees.reduce((sum, e) => sum + e.salary * (e.contract === 'CLT' ? 1.7 : 1.15) / 20, 0); }
function toast(message, ok = true) {
  document.querySelector('#toast-root').innerHTML = `<div class="toast ${ok ? '' : 'toast-error'}">${icon(ok ? 'check' : 'message')}<span>${escape(message)}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { document.querySelector('#toast-root').innerHTML = ''; }, 5000);
}
function persist() {
  if (!gameStarted) return;
  const result = saveGame(state);
  document.querySelector('#save-status').innerHTML = icon(result?.ok === false ? 'message' : 'check');
  document.querySelector('#save-status').title = result?.ok === false ? 'Navegador não permitiu salvar. Mantenha esta aba aberta.' : 'Salvo neste navegador';
}
function renderClock() {
  document.querySelector('#company-name').textContent = state.profile.company;
  const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  document.querySelector('#day-date').textContent = weekdays[(state.day - 1) % 7];
  const minute = Math.floor(Math.min(elapsed, 120) / 120 * 480);
  document.querySelector('#day-time').textContent = `DIA ${String(state.day).padStart(2, '0')} · ${String(9 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${currentStation ? '· EM CONSULTA' : state.paused ? '· PAUSADO' : ''}`;
  document.querySelector('#pause-button').innerHTML = icon(state.paused ? 'play' : 'pause');
  document.querySelector('#pause-button').setAttribute('aria-label', state.paused ? 'Retomar tempo' : 'Pausar tempo');
  document.querySelector('#speed-button').textContent = `${state.speed || 1}×`;
}
function render() {
  renderClock();
  scene?.setState(state);
  if (currentStation) renderStation();
}
function run(fn, ...args) {
  if (!currentStation || !scene.isNearStation(currentStation)) return toast('Chegue perto do setor para tomar essa decisão.', false);
  const focused = document.activeElement;
  const focusKey = ['allocation', 'projectMode', 'employeeAssignment', 'employeeRole'].find((key) => focused?.dataset?.[key]);
  const focusValue = focusKey ? focused.dataset[focusKey] : null;
  const result = fn(state, ...args);
  persist(); render();
  if (result?.message) toast(result.message, result.ok !== false);
  if (focusKey) {
    const attr = focusKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    document.querySelector(`[data-${attr}="${CSS.escape(focusValue)}"]`)?.focus();
  }
  return result;
}
function openStation(action) {
  if (!gameStarted || !stations[action]) return;
  if (!scene.isNearStation(action)) { scene.requestInteraction(action); return; }
  if (currentStation !== action) {
    panelWasPaused = state.paused;
    panelTab = 'main';
  }
  currentStation = action;
  state.paused = true;
  scene.setInteractionOpen(true);
  renderStation();
  renderClock();
  persist();
  requestAnimationFrame(() => document.querySelector('#station-panel .station-close')?.focus());
}
function closeStation() {
  if (!currentStation) return;
  currentStation = null;
  document.querySelector('#station-panel').hidden = true;
  scene.setInteractionOpen(false);
  state.paused = state.status === 'bankrupt' ? true : panelWasPaused;
  renderClock(); persist();
  document.querySelector('#office-canvas').focus({ preventScroll: true });
}
function travelTo(action) {
  if (!gameStarted) return;
  if (currentStation) closeStation();
  const result = scene.requestInteraction(action);
  if (result === false) toast('Não foi possível encontrar um caminho até esse setor.', false);
}
function positionPanel() {
  const panel = document.querySelector('#station-panel');
  if (!currentStation || window.innerWidth <= 760) { panel.style.left = ''; panel.style.top = ''; return; }
  const anchor = scene.getScreenPoint(currentStation);
  const width = panel.getBoundingClientRect().width || Math.min(610, window.innerWidth - 48);
  const height = Math.min(panel.offsetHeight || 560, window.innerHeight - 185);
  const left = anchor.x > window.innerWidth / 2 ? anchor.x - width - 28 : anchor.x + 28;
  panel.style.left = `${Math.max(24, Math.min(window.innerWidth - width - 24, left))}px`;
  panel.style.top = `${Math.max(100, Math.min(window.innerHeight - height - 84, anchor.y - height / 2))}px`;
}
function stats(items) {
  return `<div class="stat-grid">${items.map(([label, value, detail]) => `<div class="station-stat"><small>${label}</small><strong>${value}</strong>${detail ? `<span>${detail}</span>` : ''}</div>`).join('')}</div>`;
}
function tabs(items) {
  return `<nav class="in-world-tabs" aria-label="Opções deste setor">${items.map(([id, label]) => `<button data-station-tab="${id}" class="${panelTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>`;
}
function projectRow(p) {
  const progress = pct(p.progress / p.hours * 100);
  return `<div class="project-row"><div><strong>${escape(p.title)}</strong><small>${escape(p.client)} · ${money(p.price)} · prazo D${p.deadline}</small></div><div class="project-progress"><div class="mini-meter"><span style="width:${progress}%"></span></div><span>${Math.round(progress)}%</span></div></div>`;
}
function renderStation() {
  const el = document.querySelector('#station-panel');
  const s = stations[currentStation];
  const previousScroll = el.querySelector('.station-body')?.scrollTop || 0;
  el.hidden = false;
  el.dataset.station = currentStation;
  el.innerHTML = `<div class="station-frame"><header class="station-header"><span class="station-icon">${icon(s.icon)}</span><div class="station-heading"><div class="section-label">${escape(state.profile.name)} ESTÁ CONSULTANDO</div><h2>${s.title}</h2><p class="station-subtitle">${s.subtitle}</p></div><button class="station-close icon-button" data-action="close-station" aria-label="Voltar ao escritório">${icon('close')}</button></header><div class="station-body">${stationContent(currentStation)}</div><footer class="station-status"><span class="online-dot"></span> Consulta no local · tempo pausado <span><kbd>Esc</kbd> voltar ao escritório</span></footer></div>`;
  el.querySelector('.station-body').scrollTop = previousScroll;
  requestAnimationFrame(positionPanel);
}
function stationContent(action) {
  if (action === 'work') {
    const categories = [['sales', 'Vender & descobrir', 'message'], ['delivery', 'Desenvolver & criar', 'code'], ['quality', 'Revisar & gerir', 'target']];
    return `${tabs([['main', 'Rotina de hoje'], ['focus', 'Foco & código']])}${stats([['ENERGIA', `${Math.round(state.energy)}%`, 'Café e descanso recuperam'], ['DÍVIDA TÉCNICA', `${Math.round(state.debt)}%`, 'Qualidade reduz o custo futuro'], ['DESLOCAMENTO', `${(state.travelHours || 0).toFixed(2)}h`, 'Tempo que sai da capacidade de entrega']])}${panelTab === 'focus' ? `<h3 class="subheading">Em qual projeto você vai se concentrar?</h3><p class="muted">Seu foco define a prioridade das horas do fundador. O RH distribui o trabalho da equipe.</p>${activeProjects().map((p) => `<article class="project-card">${projectRow(p)}<button class="${state.focusProjectId === p.id ? 'primary' : 'secondary'}-button compact full" data-project-priority="${escape(p.id)}">${state.focusProjectId === p.id ? `${icon('check')} Foco atual` : 'Priorizar este projeto'}</button></article>`).join('') || '<div class="empty-state">Nenhum contrato na mesa. Vá ao comercial para fechar seu primeiro projeto.</div>'}<div class="action-grid"><button class="primary-button" data-action="work">${icon('code')} Trabalhar 2h</button><button class="secondary-button" data-action="review">${icon('target')} Revisar 1h</button></div>` : `<h3 class="subheading">Oito horas. Escolhas que competem.</h3><p class="muted">Discovery e propostas usam vendas; entrevistas e pesquisa usam qualidade; protótipos e código usam desenvolvimento.</p><div class="allocation-bar">${categories.map(([key]) => `<span class="${key}" style="flex:${state.allocation[key]}"></span>`).join('')}</div><div class="allocation-rows">${categories.map(([key, label, glyph]) => `<div class="allocation-row"><div class="allocation-label"><span class="allocation-icon ${key}">${icon(glyph)}</span><strong>${label}</strong><b>${state.allocation[key]}h</b></div><input class="range ${key}" type="range" min="0" max="8" step="1" value="${state.allocation[key]}" data-allocation="${key}" aria-label="Horas para ${label}"/></div>`).join('')}</div><div class="action-grid"><button class="primary-button" data-action="work">${icon('code')} Trabalhar 2h</button><button class="secondary-button" data-action="review">${icon('target')} Revisar 1h</button></div><div class="concept-note">${icon('clock')}<p>Trabalho manual adianta as horas reservadas; não cria horas extras. Ao fechar o escritório, a rotina restante e as tarefas da equipe são executadas.</p></div>`}`;
  }
  if (action === 'sales') {
    return `${stats([['CONTATOS', state.leads.length, 'Até 6 oportunidades abertas'], ['REPUTAÇÃO', `${Math.round(state.reputation)}/100`, 'Influencia propostas premium'], ['TEMPO COMERCIAL', `${state.allocation.sales}h`, 'Discovery usa uma hora da rotina']])}<div class="section-header"><h3 class="subheading">Qual problema vale sua próxima hora?</h3><button class="secondary-button compact" data-action="prospect">${icon('plus')} Prospectar</button></div><p class="muted">Investigar antes de vender diminui incerteza. O preço também muda prazo e recebimento.</p>${state.leads.map((l, i) => `<article class="opportunity-card"><div class="opportunity-top"><span class="client-monogram color-${i % 3}">${escape(l.client.slice(0, 2).toUpperCase())}</span><div><small>${escape(l.sector)}</small><strong>${escape(l.client)}</strong></div><span class="tag">${l.discovered ? 'ESCOPO DESCOBERTO' : 'CONTATO ABERTO'}</span></div><h3>${escape(l.title)}</h3><p>${escape(l.description)}</p><div class="opportunity-meta"><span>${icon('clock')} ${l.estimateMin || Math.floor(l.hours * .85)}–${l.estimateMax || Math.ceil(l.hours * 1.25)}h estimadas</span><span>${l.duration} dias</span></div>${l.discovered ? `<div class="discovery-note"><strong>Discovery concluído</strong><p>${escape(l.qualification?.scope || 'O cliente confirmou o escopo e as necessidades prioritárias.')}</p><small>${escape(l.qualification?.risks || 'Menos incerteza para defender sua proposta.')}</small></div>` : `<button class="secondary-button compact full" data-discover="${escape(l.id)}">${icon('message')} Investigar o escopo · 1h de vendas</button>`}<div class="proposal-options"><button data-negotiate="${escape(l.id)}" data-pricing="discount"><small>COMPETITIVA</small><strong>${money(l.price * .85)}</strong><span>+2 dias de prazo · recebe D+2</span></button><button data-negotiate="${escape(l.id)}" data-pricing="standard" class="recommended"><small>EQUILIBRADA</small><strong>${money(l.price)}</strong><span>Prazo base · recebe D+3</span></button><button data-negotiate="${escape(l.id)}" data-pricing="premium" ${!l.discovered && state.reputation < 25 ? 'disabled' : ''}><small>PREMIUM</small><strong>${money(l.price * 1.2)}</strong><span>−2 dias de prazo · recebe D+5</span></button></div></article>`).join('') || '<div class="empty-state">Seu pipeline está vazio. Prospecte ou reserve mais horas de vendas.</div>'}`;
  }
  if (action === 'board') {
    const events = state.pendingEvents || [];
    return `${tabs([['main', 'Quadro & entregas'], ['events', `Decisões pendentes (${events.length})`]])}${panelTab === 'events' ? events.map((event) => `<article class="event-card"><span class="tag">DECISÃO DO FUNDADOR</span><h3>${escape(event.title)}</h3><p>${escape(event.description)}</p><div class="event-options">${event.options.map((o) => `<button class="secondary-button" data-event="${escape(event.id)}" data-choice="${escape(o.id)}"><strong>${escape(o.label)}</strong><small>${escape(o.description)}</small></button>`).join('')}</div></article>`).join('') || '<div class="empty-state">Nenhum imprevisto pendente. Continue acompanhando seus projetos.</div>' : `${events.length ? `<div class="event-alert">${icon('message')} ${events.length} decisão aguardando você no quadro. <button class="text-button" data-station-tab="events">Resolver agora ${icon('arrow')}</button></div>` : ''}<div class="kanban-strip"><span>A DESENVOLVER</span><span>EM EXECUÇÃO</span><span>REVISÃO</span><span>ENTREGUE</span></div>${state.projects.length ? state.projects.slice().reverse().map((p) => `<article class="project-card">${projectRow(p)}<div class="project-card-meta"><span class="status-pill ${p.status === 'delivered' ? 'success' : ''}">${p.status === 'delivered' ? 'Entregue' : ({ backlog: 'A desenvolver', development: 'Em execução', review: 'Em revisão' }[p.phase] || 'Em execução')}</span><span>Qualidade ${Math.round(p.quality)}% · ${p.progress.toFixed(1)}/${p.hours}h</span></div>${p.status === 'active' ? `<label class="select-label">Ritmo de execução<select data-project-mode="${escape(p.id)}"><option value="fast" ${p.mode === 'fast' ? 'selected' : ''}>Rápido · mais dívida e risco de bugs</option><option value="standard" ${p.mode === 'standard' ? 'selected' : ''}>Padrão · equilíbrio entre prazo e qualidade</option><option value="careful" ${p.mode === 'careful' ? 'selected' : ''}>Caprichado · mais qualidade, menos velocidade</option></select></label><button class="secondary-button compact full" data-project-priority="${escape(p.id)}">${state.focusProjectId === p.id ? 'Prioridade do fundador' : 'Definir como prioridade'}</button>` : `<p class="muted">${p.paid ? 'Pagamento recebido.' : `Recebimento previsto para D${p.dueDay}. Consulte o financeiro.`}</p>`}</article>`).join('') : '<div class="empty-state">O primeiro post-it começa na mesa comercial. Caminhe até lá e feche um contrato.</div>'}`}`;
  }
  if (action === 'finance') {
    const receivables = state.receivables || [];
    const balance = state.loan?.balance || 0;
    return `${tabs([['main', 'Caixa & recebimentos'], ['ledger', 'Movimentações'], ['credit', 'Reserva & crédito']])}${stats([['CAIXA', money(state.cash), `${Math.max(0, Math.floor(state.cash / dailyCost()))} dias de fôlego estimado`], ['A RECEBER', money(receivables.reduce((sum, r) => sum + r.amount, 0)), 'Entregar e receber são momentos diferentes'], ['CUSTO POR DIA ÚTIL', money(dailyCost()), 'Fixo + salários e contratos']])}${panelTab === 'ledger' ? `<div class="ledger">${state.ledger.slice(0, 35).map((l) => `<div class="ledger-row"><span class="ledger-icon ${l.amount >= 0 ? 'positive' : ''}">${icon(l.amount >= 0 ? 'trend' : 'wallet')}</span><div><strong>${escape(l.label)}</strong><small>Dia ${l.day}</small></div><b class="${l.amount >= 0 ? 'positive-text' : ''}">${l.amount >= 0 ? '+' : '−'}${money(Math.abs(l.amount))}</b></div>`).join('')}</div>` : panelTab === 'credit' ? `<article class="loan-card"><h3>Crédito de emergência</h3><p class="muted">Uma única linha de R$ 2.000 para a empresa. O saldo cobra 2% de juros a cada 28 dias e compromete sua reserva futura. O empréstimo ajuda a atravessar um atraso, mas não substitui contratos saudáveis.</p>${stats([['SALDO DO EMPRÉSTIMO', money(balance), 'Juros de 2% por ciclo financeiro'], ['DIAS NO VERMELHO', state.consecutiveNegativeDays || 0, '60 dias seguidos encerram a empresa']])}<div class="action-grid"><button class="primary-button" data-action="take-loan" ${state.loan?.taken ? 'disabled' : ''}>${state.loan?.taken ? 'Crédito inicial utilizado' : 'Contratar R$ 2.000'}</button><button class="secondary-button" data-action="repay-loan" ${balance <= 0 ? 'disabled' : ''}>Quitar ${money(balance)}</button></div></article>` : `<h3 class="subheading">Recebimentos previstos</h3>${receivables.length ? receivables.map((r) => `<article class="receivable"><div><strong>${escape(r.client)}</strong><small>${r.dueDay < state.day ? 'Pagamento atrasado' : 'Previsto'} · D${r.dueDay}</small></div><b>${money(r.amount)}</b>${r.dueDay <= state.day ? `<button class="secondary-button compact" data-collect="${escape(r.projectId)}">Cobrar cliente</button>` : ''}</article>`).join('') : '<div class="empty-state">Nenhuma nota a receber. O comercial encontra contratos e o quadro acompanha as entregas.</div>'}<div class="concept-note">${icon('wallet')}<p>Custos fixos continuam no fim de semana. A folha é paga nos dias úteis. Contratos competitivos, padrão e premium recebem em D+2, D+3 e D+5 após a entrega.</p></div>`}`;
  }
  if (action === 'team') {
    return `${tabs([['main', 'Equipe & responsabilidades'], ['candidates', 'Entrevistas & vagas']])}${panelTab === 'candidates' ? `<p class="muted">Conhecer a pessoa custa 1h de qualidade e gestão. Planeje sua rotina no computador antes de entrevistar.</p>${CANDIDATES.filter((c) => !state.employees.some((e) => e.id === c.id)).map((c) => { const interview = state.interviews?.[c.id]; return `<article class="person-card"><div class="person-top">${avatar(c.color, 52, c.name)}<div><h3>${escape(c.name)}</h3><p>${escape(c.role)}</p></div><span class="trait-pill">${money(c.salary)}/mês</span></div><p class="muted">${escape(c.trait)}</p>${interview ? `<div class="interview-note"><strong>Entrevista concluída · ${Math.round(interview.score)}/100</strong><p>${escape(interview.strength)}</p><small>${escape(interview.risk)}</small></div>` : `<button class="secondary-button full" data-interview="${escape(c.id)}">Entrevistar · 1h de gestão</button>`}<div class="hire-actions"><button class="primary-button compact" data-hire="${escape(c.id)}" data-contract="PJ" ${!interview ? 'disabled' : ''}>PJ · ${money(c.salary * 1.15)}/mês</button><button class="secondary-button compact" data-hire="${escape(c.id)}" data-contract="CLT" ${!interview ? 'disabled' : ''}>CLT · ${money(c.salary * 1.7)}/mês</button></div></article>`; }).join('') || '<div class="empty-state">Todos os talentos deste primeiro grupo já fazem parte da sua equipe.</div>'}` : `<article class="person-card"><div class="person-top">${avatar(state.profile.avatarColor, 48, state.profile.name)}<div><h3>${escape(state.profile.name)}</h3><p>Fundador · vende, entrega e decide</p></div><span class="tag">8H / DIA</span></div></article>${state.employees.map((e) => `<article class="person-card"><div class="person-top">${avatar(e.color, 48, e.name)}<div><h3>${escape(e.name)}</h3><p>${escape(e.role)} · ${e.contract}</p></div><span class="status-pill ${e.stress > 60 ? '' : 'success'}">${e.stress > 60 ? 'Sobrecarregado' : 'Em equilíbrio'}</span></div>${stats([['MORAL', `${Math.round(e.morale ?? 80)}%`], ['ESTRESSE', `${Math.round(e.stress ?? 10)}%`], ['FOLHA / DIA', money(e.salary * (e.contract === 'CLT' ? 1.7 : 1.15) / 20)]])}<div class="station-grid"><label class="select-label">Responsabilidade<select data-employee-assignment="${escape(e.id)}"><option value="auto" ${!e.assignment || e.assignment === 'auto' ? 'selected' : ''}>Ajudar na fila prioritária</option>${activeProjects().map((p) => `<option value="${escape(p.id)}" ${e.assignment === p.id ? 'selected' : ''}>${escape(p.title)}</option>`).join('')}</select></label><label class="select-label">Papel no projeto<select data-employee-role="${escape(e.id)}"><option value="delivery" ${e.assignmentRole !== 'quality' ? 'selected' : ''}>Desenvolver</option><option value="quality" ${e.assignmentRole === 'quality' ? 'selected' : ''}>Revisar & testar</option></select></label></div></article>`).join('') || '<div class="empty-state">Você ainda faz tudo. Consulte a aba de entrevistas para trazer a primeira pessoa.</div>'}<div class="concept-note">${icon('people')}<p>Distribuir pessoas entre entregas e revisão muda o resultado. Sobrecarga eleva estresse e reduz produtividade; a equipe não é apenas uma soma de horas.</p></div>`}`;
  }
  if (action === 'furniture') {
    return `<p class="muted">A bancada reúne melhorias que entram no escritório e mudam a rotina. Escolha de acordo com o caixa e o tamanho da equipe.</p><div class="furniture-grid">${FURNITURE.map((f, i) => { const owned = state.furniture.some((o) => (typeof o === 'string' ? o : o.id) === f.id); return `<article class="furniture-card"><div class="furniture-illustration illustration-${i}">${icon(['chair', 'code', 'coffee', 'folder', 'sun'][i % 5])}</div><div class="furniture-info"><h3>${escape(f.name)}</h3><p>${escape(f.description)}</p><div class="opportunity-bottom"><strong>${money(f.price)}</strong><button class="${owned ? 'secondary' : 'primary'}-button compact" data-buy="${escape(f.id)}" ${owned ? 'disabled' : ''}>${owned ? 'No escritório' : 'Comprar'}</button></div></div></article>`; }).join('')}</div>`;
  }
  if (action === 'coffee' || action === 'rest') {
    const coffee = action === 'coffee';
    return `${stats([['SUA ENERGIA', `${Math.round(state.energy)}%`, state.energy < 35 ? 'O cansaço já afeta suas entregas' : 'Energia influencia a produtividade'], ['PAUSAS HOJE', state.dailyActions?.[coffee ? 'coffee' : 'rest'] || 0, coffee ? 'Até 2 cafés por dia' : 'Uma pausa de descanso por dia']])}<div class="rest-illustration">${icon(coffee ? 'coffee' : 'sun')}</div><h3 class="subheading">${coffee ? 'Uma conversa. Um café. Uma nova ideia.' : 'Feche os olhos antes de abrir outra tarefa.'}</h3><p class="muted">${coffee ? 'R$ 15 recuperam energia. Uma cafeteira melhor torna essa pausa mais eficiente.' : 'R$ 40 cobrem um lanche e o descanso. Um lounge confortável melhora essa recuperação e as noites seguintes.'}</p><button class="primary-button full" data-action="${coffee ? 'coffee' : 'rest'}">${coffee ? 'Preparar café · R$ 15' : 'Descansar e fazer um lanche · R$ 40'} ${icon('arrow')}</button>`;
  }
  if (action === 'product') {
    const product = state.product || { unlocked: false, progress: 0, research: 0, users: 0, mrr: 0, stage: 'locked' };
    return `${product.unlocked ? `<span class="tag">${product.stage === 'launched' ? 'PRODUTO LANÇADO' : 'IDEIA EM CONSTRUÇÃO'}</span><h3 class="subheading">Sua próxima receita pode ser recorrente.</h3>${stats([['MVP', `${Math.round(product.progress)}%`, 'Construção e validação'], ['PESQUISAS', product.research, 'Duas validações para lançar'], ['MRR', money(product.mrr), `${product.users} usuários`]])}<div class="mini-meter product-meter"><span style="width:${pct(product.progress)}%"></span></div><p class="muted">O laboratório disputa as mesmas horas que pagam seus contratos. Um protótipo usa 2h de desenvolvimento e R$ 300; pesquisar usa 1h de qualidade e R$ 150. Cabe um investimento por dia.</p>${product.stage === 'launched' ? `<div class="discovery-note"><strong>MVP lançado</strong><p>Próxima receita prevista: D${product.nextPaymentDay}. O ciclo de 28 dias cobra R$ 100 de suporte.</p></div>` : ''}<div class="action-grid"><button class="primary-button" data-product="prototype" ${product.stage === 'launched' || product.progress >= 100 || state.dailyActions.product >= 1 ? 'disabled' : ''}>${icon('code')} Construir protótipo</button><button class="secondary-button" data-product="research" ${product.stage === 'launched' || state.dailyActions.product >= 1 ? 'disabled' : ''}>${icon('message')} Validar com usuários</button></div>` : `<div class="product-locked">${icon('lock')}<h3>Conheça clientes antes de apostar.</h3><p>Entregue dois projetos para liberar seu laboratório. As dores que você descobriu podem se transformar em produto.</p><span class="tag">${state.stats.delivered} / 2 ENTREGAS</span></div>`}<div class="product-roadmap"><span>01 · IDEIA</span><span>02 · MVP</span><span>03 · LANÇAMENTO</span><span>04 · RECORRÊNCIA</span></div><div class="concept-note">${icon('bulb')}<p>Serviço paga as contas hoje. Produto consome caixa e capacidade antes de começar a gerar receita. O desafio é escolher o momento.</p></div>`;
  }
  if (action === 'reception') {
    return `${tabs([['main', pendingSummary ? 'Fechamento & diário' : 'Diário & conquistas'], ['guide', 'Guia & identidade']])}${panelTab === 'guide' ? `<div class="guide-grid"><article>${icon('message')}<h3>Vender exige presença</h3><p>Vá ao comercial. Descubra o escopo e escolha preço, prazo e recebimento.</p></article><article>${icon('code')}<h3>Seu dia tem oito horas</h3><p>Organize a rotina no computador. Caminhar, entrevistar e construir competem com as entregas.</p></article><article>${icon('folder')}<h3>Projetos pedem decisões</h3><p>O quadro mostra progresso, qualidade e imprevistos. Resolva pedidos extras e bloqueios antes que custem prazo.</p></article><article>${icon('people')}<h3>Delegar tem consequências</h3><p>Entreviste no RH e escolha quem desenvolve ou revisa cada projeto. Equipe custa folha e precisa de equilíbrio.</p></article></div><div class="action-grid"><button class="secondary-button" data-action="profile">${avatar(state.profile.avatarColor, 28)} Meu fundador</button><button class="secondary-button" data-action="new-game">Começar outra história</button></div>` : `${pendingSummary ? summaryMarkup() : ''}${stats([['REPUTAÇÃO', `${Math.round(state.reputation)}/100`, 'Sobe com qualidade, cai com atrasos'], ['ENTREGAS', state.stats.delivered, 'Seu portfólio cresce a cada cliente'], ['HORAS DE ENTREGA', `${state.stats.hoursWorked.toFixed(1)}h`, 'Tempo transformado em resultado']])}<ol class="mission-checklist"><li class="done">${icon('check')} Abra as portas da empresa.</li><li class="${state.projects.length ? 'done' : ''}">${icon(state.projects.length ? 'check' : 'target')} Feche seu primeiro contrato no comercial.</li><li class="${state.stats.delivered ? 'done' : ''}">${icon(state.stats.delivered ? 'check' : 'target')} Faça a primeira entrega pelo quadro.</li><li class="${state.employees.length ? 'done' : ''}">${icon(state.employees.length ? 'check' : 'target')} Entreviste e traga uma pessoa pelo RH.</li><li class="${state.product?.unlocked ? 'done' : ''}">${icon(state.product?.unlocked ? 'check' : 'target')} Entregue dois projetos e libere o laboratório.</li></ol><h3 class="subheading">Diário do fundador</h3><div class="activity-list">${state.log.slice(0, 12).map((l) => `<div class="activity"><span class="activity-dot"></span><p>${escape(l.message)}</p><small>D${l.day}</small></div>`).join('')}</div>`}`;
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
  openModal(`<div class="profile-layout"><div class="profile-intro"><a class="brand"><span class="brand-mark">${icon('code')}</span><span>devhouse<span class="brand-dot">.</span></span></a><span class="welcome-tag">CAPÍTULO 01 · A PRIMEIRA IDEIA</span><h2 id="modal-title">Toda grande<br/>empresa começa<br/>com <em>alguém.</em></h2><p>Você deixou a CLT. Tem um notebook,<br/>R$ 20 mil e uma ideia na cabeça.<br/>O próximo passo é seu.</p><div class="founder-preview"><div class="portrait-grid"></div><div id="profile-avatar">${avatar(p.avatarColor, 180, p.name)}</div><span class="portrait-label">${icon('plant')} FUTURO FUNDADOR</span></div><div class="intro-bottom"><span class="online-dot"></span> Construa algo que é seu.</div></div><form id="profile-form" class="profile-form"><div class="section-label">${isNew ? 'ANTES DE ABRIR AS PORTAS' : 'SUA IDENTIDADE'}</div><h3>${isNew ? 'Vamos conhecer o fundador.' : 'Do seu jeito.'}</h3><p class="muted">Dê um nome à sua próxima grande história.</p><label>Seu nome<input name="name" required maxlength="32" placeholder="Como podemos te chamar?" autocomplete="given-name" value="${isNew ? '' : escape(p.name)}" /></label><label>Nome da empresa<input name="company" required maxlength="40" placeholder="A próxima grande software house" autocomplete="organization" value="${isNew ? '' : escape(p.company)}" /></label><div class="profile-fields"><label>Sua idade<input name="age" type="number" min="18" max="80" required value="${p.age}" /></label><label>Seu ponto forte<select name="trait"><option value="balanced" ${p.trait === 'balanced' ? 'selected' : ''}>Um pouco de tudo</option><option value="technical" ${p.trait === 'technical' ? 'selected' : ''}>Dev de coração</option><option value="commercial" ${p.trait === 'commercial' ? 'selected' : ''}>Bom de conversa</option></select></label></div><fieldset class="color-fieldset"><legend>A cor do seu personagem</legend><div class="color-choices">${colors.map((c, i) => `<label class="color-choice" style="--swatch:${c}"><input type="radio" name="avatarColor" value="${c}" ${c === p.avatarColor || (!colors.includes(p.avatarColor) && i === 0) ? 'checked' : ''} aria-label="${['Verde', 'Azul', 'Lilás', 'Terracota', 'Mostarda'][i]}"/><span>${icon('check')}</span></label>`).join('')}<small>Um toque de personalidade.</small></div></fieldset><button type="submit" class="primary-button full">${isNew ? 'Abrir as portas' : 'Salvar meu perfil'} ${icon('arrow')}</button><p class="form-footnote">${icon('save')} Seu progresso fica salvo neste navegador.</p></form></div>`, true, !isNew);
  document.querySelector('#profile-form').addEventListener('change', (e) => { if (e.target.name === 'avatarColor') document.querySelector('#profile-avatar').innerHTML = avatar(e.target.value, 180); });
  document.querySelector('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const profile = { name: data.get('name').trim(), company: data.get('company').trim(), age: Number(data.get('age')), trait: data.get('trait'), avatarColor: data.get('avatarColor') };
    if (!profile.name || !profile.company) return toast('Preencha seu nome e o nome da empresa.', false);
    if (isNew) {
      currentStation = null;
      document.querySelector('#station-panel').hidden = true;
      scene.setInteractionOpen(false);
      panelWasPaused = true;
      state = createGame(profile);
      gameStarted = true;
      elapsed = 0;
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
function handleAction(action) {
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
  else if (action === 'work' && currentStation === 'work') run(performAction, 'work');
  else if (action === 'review' && currentStation === 'work') run(performAction, 'review');
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
  if (target.dataset.travel) return travelTo(target.dataset.travel);
  if (target.dataset.action) return handleAction(target.dataset.action);
  if (!currentStation || !scene.isNearStation(currentStation)) return;
  if (target.dataset.stationTab) { panelTab = target.dataset.stationTab; return renderStation(); }
  if (target.dataset.discover && currentStation === 'sales') run(discoverLead, target.dataset.discover);
  else if (target.dataset.negotiate && currentStation === 'sales') run(negotiateProject, target.dataset.negotiate, target.dataset.pricing);
  else if (target.dataset.interview && currentStation === 'team') run(interviewCandidate, target.dataset.interview);
  else if (target.dataset.hire && currentStation === 'team') run(hireEmployee, target.dataset.hire, target.dataset.contract);
  else if (target.dataset.buy && currentStation === 'furniture') run(buyFurniture, target.dataset.buy);
  else if (target.dataset.event && currentStation === 'board') run(resolveProjectEvent, target.dataset.event, target.dataset.choice);
  else if (target.dataset.projectPriority && ['work', 'board'].includes(currentStation)) run(setProjectPriority, target.dataset.projectPriority);
  else if (target.dataset.collect && currentStation === 'finance') run(collectReceivable, target.dataset.collect);
  else if (target.dataset.product && currentStation === 'product') run(investProduct, target.dataset.product);
});
document.addEventListener('change', (e) => {
  if (!currentStation || !scene.isNearStation(currentStation)) return;
  const t = e.target;
  if (t.dataset.allocation && currentStation === 'work') run(setAllocation, t.dataset.allocation, Number(t.value));
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
    else if (!modal && currentStation) { e.preventDefault(); closeStation(); }
  }
  const container = modal || (!document.querySelector('#station-panel').hidden ? document.querySelector('#station-panel') : null);
  if (e.key !== 'Tab' || !container) return;
  const all = [...container.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')];
  const first = all[0], last = all.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
});
document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); if (gameStarted) travelTo('reception'); });
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
else toast('Bem-vindo de volta. Sua empresa foi preservada; agora todas as decisões acontecem nos setores.');
setInterval(() => {
  if (state.paused || currentStation || document.querySelector('.modal-overlay') || state.status === 'bankrupt') return;
  elapsed += state.speed || 1;
  if (elapsed >= 120) finishDay(true);
  else renderClock();
}, 1000);
setInterval(() => {
  if (!scene || currentStation || document.querySelector('.modal-overlay')) return;
  const nearby = Object.keys(stations).find((action) => scene.isNearStation(action));
  const text = nearby ? `E · Consultar ${stations[nearby].short.toLowerCase()}` : 'Clique em um setor para caminhar até ele.';
  if (text !== lastPrompt) { document.querySelector('#context-prompt').textContent = text; lastPrompt = text; }
}, 250);
window.addEventListener('beforeunload', () => { if (gameStarted) saveGame(state); });
