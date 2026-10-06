import { icon, escape, avatar } from './ui.js';

const APPS = [
  { id: 'expansion', name: 'Expansão', glyph: 'grid', color: 'gold', description: 'Espaço, equipamentos e salas', detail: 'Faça o escritório crescer junto com a empresa.' },
  { id: 'development', name: 'Desenvolvimento', glyph: 'code', color: 'blue', description: 'Rotina, foco e trabalho', detail: 'Transforme decisões do dia a dia em entregas.' },
  { id: 'laboratory', name: 'Laboratório', glyph: 'bulb', color: 'purple', description: 'Produto, MVP e validação', detail: 'Construa uma aposta que pode gerar receita recorrente.' },
];
const displayHours = (hours) => Number(hours ?? 2).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function companyColor(state) {
  const color = state.office?.amenities?.banner ? state.office.banner.color : state.profile.avatarColor;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#adc972';
}

function taskbar(state, activeApp, clock) {
  return `<footer class="computer-taskbar" aria-label="Barra de tarefas do computador">
    <button class="computer-start ${activeApp === 'desktop' ? 'active' : ''}" data-computer-app="desktop" aria-label="Voltar à área de trabalho">${icon('grid')}<span>Início</span></button>
    <span class="computer-task-divider"></span>
    <nav class="computer-pinned-apps" aria-label="Aplicativos do computador">${APPS.map((app) => `<button class="computer-task-app app-${app.color} ${activeApp === app.id ? 'active' : ''}" data-computer-app="${app.id}" title="Abrir ${app.name}" aria-label="Abrir ${app.name}" ${activeApp === app.id ? 'aria-current="page"' : ''}>${icon(app.glyph)}<span>${app.name}</span></button>`).join('')}</nav>
    <span class="computer-session-indicator" title="O tempo fica pausado enquanto você usa o computador"><span class="online-dot"></span> Consulta local</span>
    <div class="computer-clock"><strong>${escape(clock || 'Pausado')}</strong><small>DIA ${String(state.day).padStart(2, '0')}</small></div>
  </footer>`;
}

function desktop(state, session) {
  const projects = state.projects.filter((project) => project.status === 'active');
  const next = projects.slice().sort((a, b) => a.deadline - b.deadline)[0];
  const company = state.office?.amenities?.banner ? state.office.banner.text : state.profile.company;
  return `<div class="computer-desktop">
    <div class="computer-desktop-top"><span class="computer-os-label">${icon('code')} devOS <span>WORKSPACE</span></span><span class="computer-user">${avatar(state.profile.avatarColor, 29, state.profile.name)}<span>${escape(state.profile.name)}<small>No computador</small></span></span></div>
    <div class="computer-wallpaper-mark" aria-hidden="true"><span class="wallpaper-orbit orbit-one"></span><span class="wallpaper-orbit orbit-two"></span><span class="wallpaper-orbit orbit-three"></span></div>
    <div class="computer-desktop-heading"><span>SEU TRABALHO COMEÇA AQUI</span><h3>${escape(company)}</h3><p>Abra um aplicativo para planejar, produzir ou crescer.</p></div>
    <div class="computer-desktop-apps">${APPS.map((app) => `<button class="computer-desktop-app app-${app.color}" data-computer-app="${app.id}" aria-label="Abrir ${app.name}"><span class="computer-app-symbol">${icon(app.glyph)}</span><strong>${app.name}</strong><small>${app.description}</small></button>`).join('')}</div>
    <div class="computer-desktop-notes"><article><span>${icon('folder')} SUA PRÓXIMA ENTREGA</span><strong>${escape(next?.title || 'A primeira oportunidade está no comercial')}</strong><small>${next ? `${escape(next.client)} · prazo D${next.deadline} · ${Math.round(next.progress / next.hours * 100)}% concluído` : 'Converse com um cliente para trazer trabalho ao computador.'}</small></article><article><span>${icon(session ? 'play' : 'clock')} ${session ? 'TRABALHO EM ANDAMENTO' : 'SUA ROTINA DE HOJE'}</span><strong>${session ? `${session.index} / ${session.total} decisões respondidas` : `${state.allocation.delivery}h para desenvolver`}</strong><small>${session ? 'Abra Desenvolvimento para continuar a sessão salva.' : 'Vendas e qualidade dividem as mesmas oito horas do dia.'}</small>${session ? '<button class="text-button" data-computer-app="development">Continuar sessão ' + icon('arrow') + '</button>' : ''}</article></div>
  </div>`;
}

/** Virtual desktop shown only while the founder uses their physical workstation. */
export function renderComputer(state, options = {}) {
  if (typeof options === 'string') options = { app: options };
  const { app = 'desktop', content = '', session = null, clock = '' } = options;
  const definition = APPS.find((entry) => entry.id === app);
  const activeApp = definition ? definition.id : 'desktop';
  const screen = activeApp === 'desktop' ? desktop(state, session) : `<section class="computer-window app-${definition.color}" data-computer-window="${activeApp}" aria-label="Aplicativo ${definition.name}"><header class="computer-window-bar"><span class="computer-window-symbol">${icon(definition.glyph)}</span><div><strong>${definition.name}</strong><small>${definition.description}</small></div><button class="computer-window-home" data-computer-app="desktop" aria-label="Fechar aplicativo e voltar à área de trabalho" title="Voltar à área de trabalho">${icon('close')}</button></header><div class="computer-window-content">${content || `<div class="empty-state">${icon(definition.glyph)}<h3>${definition.name}</h3><p>${definition.detail}</p></div>`}</div></section>`;
  return `<div class="computer-monitor" data-computer-app-active="${activeApp}" style="--company-color:${companyColor(state)}"><header class="computer-bezel"><span>${icon('code')} DEVHOUSE WORKSTATION</span><button data-action="close-station" class="computer-power" aria-label="Levantar e voltar ao escritório" title="Levantar e voltar ao escritório">${icon('close')}<span>Voltar ao escritório</span></button></header><div class="computer-screen">${screen}${taskbar(state, activeApp, clock)}</div><footer class="computer-monitor-foot"><span class="computer-power-led"></span><span>Você está no computador do fundador.</span><span><kbd>Esc</kbd> levantar</span></footer></div>`;
}

function feedback(session) {
  if (!session?.lastFeedback) return '';
  const { correct, message } = session.lastFeedback;
  const explanation = message.replace(/^(Boa decisão\. |Essa escolha traz um risco\. )/, '');
  return `<div class="puzzle-feedback ${correct ? 'correct' : 'incorrect'}" data-correct="${correct}" role="status">${icon(correct ? 'check' : 'message')}<div><strong>${correct ? 'Boa decisão' : 'Um ajuste para a próxima entrega'}</strong><p>${escape(explanation)}</p></div></div>`;
}

function steps(session) {
  return `<ol class="puzzle-steps" aria-label="Progresso da sessão de trabalho">${Array.from({ length: session.total || 5 }, (_, index) => `<li class="puzzle-step ${index < session.index ? 'complete' : index === session.index ? 'current' : ''}" data-step="${index + 1}" ${index === session.index ? 'aria-current="step"' : ''}><span>${index < session.index ? icon('check') : index + 1}</span><small>${index < session.index ? 'Concluída' : index === session.index ? 'Agora' : 'A seguir'}</small></li>`).join('')}</ol>`;
}

/** Answers and session mutations remain in main.js and the simulation. */
export function renderWorkPuzzle(state, session, eligibility = {}) {
  if (!session) {
    const project = eligibility.project;
    return `<section class="work-puzzle puzzle-intro"><div class="puzzle-intro-symbol">${icon('code')}</div><span class="section-label">SESSÃO DE TRABALHO</span><h3>Trabalhar também é decidir.</h3><p>Resolva cinco situações de uma software house: planejar horas, definir escopo, escolher prioridades, cuidar do caixa e conferir qualidade. Suas decisões mudam o resultado da sessão.</p>${project ? `<div class="puzzle-project"><span>${icon('folder')} PROJETO EM FOCO</span><strong>${escape(project.title)}</strong><small>${escape(project.client)}</small></div>` : ''}<div class="puzzle-session-facts"><span>${icon('clock')}${displayHours(eligibility.hours)}h de desenvolvimento</span><span>${icon('target')}5 decisões</span><span>${icon('save')}Progresso salvo</span></div><button class="primary-button full" data-action="start-work-session" ${eligibility.ok ? '' : 'disabled'}>${icon('play')} Iniciar sessão de trabalho</button>${!eligibility.ok ? `<p class="store-eligibility">${icon('lock')}<span>${escape(eligibility.reason || 'Feche um contrato e reserve horas de desenvolvimento para começar.')}</span></p>` : ''}<p class="puzzle-footnote">Conclua a sessão para aplicar a produção ao projeto. Você pode sair do computador e continuar no mesmo dia.</p></section>`;
  }
  const total = session.total || 5;
  const available = eligibility.ok !== false;
  const blocked = available ? '' : `<p class="store-eligibility">${icon('lock')}<span>${escape(eligibility.reason || 'Confira o projeto e restaure as horas da sessão na rotina.')}</span></p>`;
  const heading = `<div class="puzzle-session-head"><div><span class="section-label">SESSÃO DE TRABALHO · ${displayHours(session.hours)}H</span><h3>${escape(session.projectTitle)}</h3><small>${escape(session.client)}</small></div><span class="puzzle-session-count">${session.index} / ${total}</span></div>${steps(session)}${blocked}`;
  if (session.completed || session.status === 'ready') {
    return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}${feedback(session)}<div class="puzzle-results"><div class="puzzle-results-symbol">${icon('check')}</div><span class="section-label">RESULTADO DO SEU BLOCO DE TRABALHO</span><h3>Sessão pronta para concluir.</h3><p>As respostas foram registradas. Agora aplique o resultado ao projeto e confira o progresso no quadro.</p><div class="puzzle-result-metrics"><div><span>Decisões acertadas</span><strong>${Math.max(0, total - session.mistakes)} / ${total}</strong></div><div><span>Decisões a rever</span><strong>${session.mistakes}</strong></div></div><button class="primary-button full" data-action="complete-work-session" ${available ? '' : 'disabled'}>${icon('check')} Concluir e aplicar o trabalho</button><p class="puzzle-footnote">A produção entra uma vez no projeto. A qualidade considera suas respostas.</p></div></section>`;
  }
  const puzzle = session.currentPuzzle;
  if (!puzzle) return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}<div class="empty-state">Sua sessão está sendo preparada. Volte à área de trabalho e abra Desenvolvimento novamente.</div></section>`;
  return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}${feedback(session)}<article class="puzzle-question" data-puzzle="${escape(puzzle.id)}"><span class="puzzle-question-label">DECISÃO ${session.index + 1} DE ${total}</span><h3>${escape(puzzle.title)}</h3><p>${escape(puzzle.prompt)}</p><div class="puzzle-choices">${puzzle.options.map((option, index) => `<button class="puzzle-choice" data-puzzle-answer="${escape(option.id)}" ${available ? '' : 'disabled'}><span>${String.fromCharCode(65 + index)}</span><strong>${escape(option.label)}</strong>${icon('arrow')}</button>`).join('')}</div><p class="puzzle-footnote">Escolha uma resposta para avançar. Cada decisão influencia o resultado final.</p></article></section>`;
}
