import { icon, escape, avatar } from './ui.js';

const APPS = [
  { id: 'expansion', name: 'Expansão', glyph: 'grid', color: 'gold', description: 'Espaço, equipamentos e salas' },
  { id: 'development', name: 'Desenvolver', glyph: 'code', color: 'blue', description: 'Terminal de trabalho' },
  { id: 'laboratory', name: 'Laboratório', glyph: 'bulb', color: 'purple', description: 'Produto, MVP e validação' },
];
const displayHours = (hours) => Number(hours ?? 2).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const PROMPT = 'C:\\EMPRESA\\DESENVOLVER>';

/* Small original pixel icons keep the desktop legible even on the phone. */
function pixelIcon(type, cls = '') {
  const drawings = {
    desktop: '<path fill="#242424" d="M5 2h22v18H5zM12 20h8v4h-8zM8 24h16v3H8z"/><path fill="#eee" d="M6 3h20v15H6z"/><path fill="#085d8d" d="M8 5h16v11H8z"/><path fill="#7fc9df" d="M10 7h12v2H10z"/><path fill="#777" d="M9 25h14v1H9z"/><path fill="#ccc" d="M3 28h26v3H3z"/>',
    expansion: '<path fill="#51401b" d="M3 8h10V5h10v4h6v19H3z"/><path fill="#ffffbd" d="M4 9h10V6h8v4h6v17H4z"/><path fill="#d9a83b" d="M6 12h24l-4 15H3z"/><path fill="#ffe082" d="M7 13h21l-3 12H4z"/><path fill="#fff3b2" d="M7 13h21v2H7z"/>',
    development: '<path fill="#161616" d="M2 5h28v23H2z"/><path fill="#f5f5f5" d="M3 6h26v21H3z"/><path fill="#000080" d="M4 7h24v4H4z"/><path fill="#080d08" d="M4 12h24v13H4z"/><path fill="#66ed71" d="m7 15 4 3-4 3v-2l2-1-2-1zM13 20h6v2h-6z"/><path fill="#c0c0c0" d="M24 8h3v2h-3z"/>',
    laboratory: '<path fill="#172b50" d="M11 3h10v3h-2v10l9 12v2H4v-2l9-12V6h-2z"/><path fill="#d8f4ff" d="M14 6h4v11l8 11H6l8-11z"/><path fill="#7568df" d="M11 21h10l4 6H7z"/><path fill="#e2e2ff" d="M12 23h3v2h-3zM16 19h2v2h-2z"/><path fill="#ccc" d="M12 4h8v1h-8z"/>',
    lock: '<path fill="#474747" d="M8 13V7h3V4h10v3h3v6h3v17H5V13z"/><path fill="#dedede" d="M10 7h2V6h8v1h2v6h-3V9h-6v4h-3z"/><path fill="#d6ae45" d="M6 14h20v15H6z"/><path fill="#f7d679" d="M7 15h18v2H7z"/><path fill="#333" d="M14 19h4v4h-1v3h-2v-3h-1z"/>',
  };
  return `<svg class="computer-pixel-icon ${cls}" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${drawings[type] || drawings.desktop}</svg>`;
}

function systemMark() {
  return '<span class="computer-system-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
}

function companyColor(state) {
  const color = state.office?.amenities?.banner ? state.office.banner.color : state.profile.avatarColor;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#adc972';
}

function startMenu(state) {
  return `<nav class="computer-start-menu" aria-label="Menu Iniciar"><div class="computer-start-brand"><strong>DevHouse</strong> 98</div><div class="computer-start-items"><div class="computer-start-user">${avatar(state.profile.avatarColor, 27, state.profile.name)}<span>${escape(state.profile.name)}<small>${escape(state.profile.company)}</small></span></div>${APPS.map((app) => `<button data-computer-app="${app.id}">${pixelIcon(app.id)}<strong>${app.name}</strong><span aria-hidden="true">›</span></button>`).join('')}<hr><button data-computer-app="desktop">${pixelIcon('desktop')}<strong>Área de trabalho</strong></button><button data-computer-command="lock">${pixelIcon('lock')}<strong>Bloquear computador</strong></button><hr><button data-action="close-station">${icon('close')}<strong>Desligar e levantar</strong></button></div></nav>`;
}

function taskbar(state, activeApp, clock, menuOpen) {
  return `<footer class="computer-taskbar" aria-label="Barra de tarefas do computador">${menuOpen ? startMenu(state) : ''}<button class="computer-start ${menuOpen ? 'active' : ''}" data-computer-command="start-menu" aria-expanded="${menuOpen}" aria-label="Abrir menu Iniciar">${systemMark()}<strong>Iniciar</strong></button><span class="computer-task-divider"></span><nav class="computer-pinned-apps" aria-label="Aplicativos do computador"><button class="computer-task-home" data-computer-app="desktop" title="Mostrar área de trabalho" aria-label="Mostrar área de trabalho">${pixelIcon('desktop')}</button>${APPS.map((app) => `<button class="computer-task-app app-${app.color} ${activeApp === app.id ? 'active' : ''}" data-computer-app="${app.id}" title="Abrir ${app.name}" aria-label="Abrir ${app.name}" ${activeApp === app.id ? 'aria-current="page"' : ''}>${pixelIcon(app.id)}<span>${app.name}</span></button>`).join('')}</nav><div class="computer-clock" title="Dia ${state.day} · tempo pausado no computador">${icon('clock')}<strong>${escape(clock || '09:00')}</strong><small>D${state.day}</small></div></footer>`;
}

function desktop(state, session) {
  const next = state.projects.filter((project) => project.status === 'active').sort((a, b) => a.deadline - b.deadline)[0];
  const company = state.office?.amenities?.banner ? state.office.banner.text : state.profile.company;
  return `<div class="computer-desktop"><nav class="computer-desktop-apps" aria-label="Ícones da área de trabalho"><button class="computer-desktop-app" data-computer-app="desktop" aria-label="Mostrar Meu Computador">${pixelIcon('desktop')}<strong>Meu Computador</strong></button>${APPS.map((app) => `<button class="computer-desktop-app app-${app.color}" data-computer-app="${app.id}" aria-label="Abrir ${app.name}" title="${app.description}">${pixelIcon(app.id)}<strong>${app.name}</strong></button>`).join('')}</nav><div class="computer-wallpaper-mark" aria-hidden="true">${systemMark()}<span>DevHouse<strong>98</strong></span><small>${escape(company)}</small></div><aside class="computer-desktop-note" aria-label="Resumo do computador"><header>${pixelIcon('desktop')}<strong>Meu Computador — ${escape(state.profile.company)}</strong></header><div><p>Bem-vindo, <strong>${escape(state.profile.name)}</strong>.</p><p>Abra <button class="computer-inline-link" data-computer-app="development">Desenvolver</button> para trabalhar no terminal.</p>${next ? `<p class="computer-next-project"><span>Próxima entrega</span><strong>${escape(next.title)}</strong><small>${escape(next.client)} · prazo D${next.deadline} · ${Math.round(next.progress / next.hours * 100)}% concluído</small></p>` : '<p class="computer-next-project">Converse com um cliente no Comercial para trazer o primeiro projeto.</p>'}${session ? `<button class="computer-classic-button" data-computer-app="development">Continuar sessão · ${session.index}/${session.total}</button>` : `<small>${displayHours(state.allocation.delivery)}h reservadas para desenvolver hoje.</small>`}</div><footer>${icon('save')} Seus arquivos são salvos automaticamente.</footer></aside></div>`;
}

function loginScreen(state, mode, error) {
  const setup = mode === 'setup';
  const reset = mode === 'reset';
  const title = setup ? 'Primeiro acesso ao computador' : reset ? 'Redefinir senha do computador' : 'Bem-vindo ao DevHouse 98';
  return `<div class="computer-login-screen"><div class="computer-login-wallpaper" aria-hidden="true">${systemMark()}<span>DevHouse <strong>98</strong></span></div><section class="computer-login-dialog" aria-label="${title}"><header class="computer-login-title">${pixelIcon('lock')}<strong>${title}</strong></header><div class="computer-login-body"><div class="computer-login-welcome">${pixelIcon('lock')}<p>${setup ? 'Este PC é seu. Crie uma senha para entrar na sua área de trabalho.' : reset ? 'Escolha uma nova senha para este PC. Seus projetos e sua empresa continuam salvos.' : 'Digite sua senha para entrar na área de trabalho.'}</p></div><form id="computer-login-form"><label class="computer-login-row"><span>Nome de usuário:</span><input name="username" value="${escape(state.profile.name)}" readonly autocomplete="off"></label><label class="computer-login-row"><span>${reset ? 'Nova senha:' : 'Senha:'}</span><input id="computer-password" name="password" type="password" minlength="4" maxlength="24" required autocomplete="${setup || reset ? 'new-password' : 'off'}" aria-describedby="computer-login-help${error ? ' computer-login-error' : ''}"></label>${setup || reset ? '<label class="computer-login-row"><span>Confirmar senha:</span><input name="confirm" type="password" minlength="4" maxlength="24" required autocomplete="new-password"></label>' : ''}<p id="computer-login-help" class="computer-login-help">${setup || reset ? 'Senha deste computador no jogo · 4 a 24 caracteres.' : 'Sua sessão de trabalho continua de onde você parou.'}</p>${error ? `<p id="computer-login-error" class="computer-login-error" role="alert">${icon('message')}${escape(error)}</p>` : ''}<div class="computer-login-actions"><button class="computer-classic-button computer-default-button" type="submit">${setup ? 'Criar senha e entrar' : reset ? 'Salvar nova senha' : 'Entrar'}</button><button class="computer-classic-button" type="button" ${reset ? 'data-computer-command="cancel-reset"' : 'data-action="close-station"'}>Cancelar</button></div></form>${!setup && !reset ? '<button class="computer-password-reset" data-computer-command="reset-password">Esqueci a senha deste PC</button>' : ''}</div><footer>DevHouse 98 · computador de ${escape(state.profile.company)}</footer></section></div>`;
}

/** Virtual desktop shown only while the founder uses their physical workstation. */
export function renderComputer(state, options = {}) {
  if (typeof options === 'string') options = { app: options };
  const { app = 'desktop', content = '', session = null, clock = '', locked = false, loginMode = 'setup', loginError = '', startMenuOpen = false, maximized = false } = options;
  const definition = APPS.find((entry) => entry.id === app);
  const activeApp = locked ? 'login' : definition ? definition.id : 'desktop';
  let screen;
  if (locked) screen = loginScreen(state, loginMode, loginError);
  else if (activeApp === 'desktop') screen = desktop(state, session);
  else screen = `<section class="computer-window app-${definition.color} ${maximized ? 'computer-window-maximized' : ''}" data-computer-window="${activeApp}" aria-label="Aplicativo ${definition.name}"><header class="computer-window-bar"><span class="computer-window-symbol">${pixelIcon(definition.id)}</span><strong>${definition.id === 'development' ? 'C:\\EMPRESA\\DESENVOLVER.EXE' : definition.name + ' — ' + escape(state.profile.company)}</strong><div class="computer-window-controls"><button data-computer-command="minimize" aria-label="Minimizar aplicativo" title="Minimizar"><span class="computer-minimize-symbol" aria-hidden="true"></span></button><button data-computer-command="maximize" aria-label="${maximized ? 'Restaurar janela' : 'Maximizar janela'}" title="${maximized ? 'Restaurar' : 'Maximizar'}"><span class="computer-maximize-symbol ${maximized ? 'restore' : ''}" aria-hidden="true"></span></button><button class="computer-window-home" data-computer-app="desktop" aria-label="Fechar aplicativo e voltar à área de trabalho" title="Fechar">${icon('close')}</button></div></header><nav class="computer-window-menu" aria-label="Menu do aplicativo"><button data-computer-app="desktop">Área de trabalho</button>${definition.id === 'development' ? '<button data-terminal-command="trabalhar">Trabalho</button><button data-terminal-command="rotina">Rotina</button><button data-terminal-command="ajuda">Ajuda</button>' : '<button data-computer-command="lock">Bloquear PC</button>'}</nav><div class="computer-window-content ${definition.id === 'development' ? 'computer-terminal-content' : ''}">${content || '<div class="empty-state">Abra um aplicativo pela área de trabalho.</div>'}</div><footer class="computer-window-status"><span>${definition.id === 'development' ? 'Terminal de trabalho · digite ajuda para começar' : definition.description}</span><span>D${state.day} · sessão local</span><i aria-hidden="true"></i></footer></section>`;
  return `<div class="computer-monitor ${locked ? 'computer-locked' : ''}" data-computer-app-active="${activeApp}" style="--company-color:${companyColor(state)}"><header class="computer-bezel"><span>DEVHOUSE <b>PERSONAL COMPUTER</b></span><button data-action="close-station" class="computer-power" aria-label="Levantar e voltar ao escritório" title="Levantar e voltar ao escritório">${icon('close')}<span>Voltar ao escritório</span></button></header><div class="computer-screen">${screen}${locked ? '' : taskbar(state, activeApp, clock, startMenuOpen)}</div><footer class="computer-monitor-foot"><span class="computer-power-led"></span><span>${escape(state.profile.name)} está sentado no seu PC.</span><span><kbd>Esc</kbd> levantar</span></footer></div>`;
}

function feedback(session) {
  if (!session?.lastFeedback) return '';
  const { correct, message } = session.lastFeedback;
  const explanation = message.replace(/^(Boa decisão\. |Essa escolha traz um risco\. )/, '');
  return `<div class="puzzle-feedback ${correct ? 'correct' : 'incorrect'}" data-correct="${correct}" role="status"><span aria-hidden="true">[${correct ? 'OK' : 'ATENÇÃO'}]</span><div><strong>${correct ? 'Boa decisão' : 'Um ajuste para a próxima entrega'}</strong><p>${escape(explanation)}</p></div></div>`;
}

function steps(session) {
  return `<ol class="puzzle-steps" aria-label="Progresso da sessão de trabalho">${Array.from({ length: session.total || 5 }, (_, index) => `<li class="puzzle-step ${index < session.index ? 'complete' : index === session.index ? 'current' : ''}" data-step="${index + 1}" ${index === session.index ? 'aria-current="step"' : ''}><span>${index < session.index ? '✓' : index + 1}</span><small>${index < session.index ? 'Concluída' : index === session.index ? 'Agora' : 'A seguir'}</small></li>`).join('')}</ol>`;
}

/** Answers and session mutations remain in main.js and the simulation. */
export function renderWorkPuzzle(state, session, eligibility = {}) {
  if (!session) {
    const project = eligibility.project;
    return `<section class="work-puzzle puzzle-intro"><span class="section-label">[ NOVO BLOCO DE TRABALHO ]</span><h3>Cinco decisões. Uma entrega melhor.</h3><p>Organize horas, escopo, prioridades, caixa e qualidade em cinco situações rápidas do escritório.</p>${project ? `<div class="puzzle-project"><span>PROJETO EM FOCO</span><strong>${escape(project.title)}</strong><small>${escape(project.client)}</small></div>` : ''}<div class="puzzle-session-facts"><span>RESERVA: ${displayHours(eligibility.hours)}h</span><span>ETAPAS: 5</span><span>AUTOSAVE: ATIVO</span></div><button class="primary-button full" data-action="start-work-session" ${eligibility.ok ? '' : 'disabled'}>▶ Iniciar sessão de trabalho</button>${!eligibility.ok ? `<p class="store-eligibility"><span>[BLOQUEADO] ${escape(eligibility.reason || 'Feche um contrato e reserve horas de desenvolvimento para começar.')}</span></p>` : ''}<p class="puzzle-footnote">Digite trabalhar ou clique em iniciar. A produção entra no projeto ao concluir a sessão.</p></section>`;
  }
  const total = session.total || 5;
  const available = eligibility.ok !== false;
  const blocked = available ? '' : `<p class="store-eligibility"><span>[BLOQUEADO] ${escape(eligibility.reason || 'Confira o projeto e restaure as horas da sessão na rotina.')}</span></p>`;
  const heading = `<div class="puzzle-session-head"><div><span class="section-label">[ SESSÃO ATIVA · ${displayHours(session.hours)}H ]</span><h3>${escape(session.projectTitle)}</h3><small>CLIENTE: ${escape(session.client)}</small></div><span class="puzzle-session-count">${session.index}/${total}</span></div>${steps(session)}${blocked}`;
  if (session.completed || session.status === 'ready') {
    return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}${feedback(session)}<div class="puzzle-results"><span class="section-label">[ PROCESSAMENTO CONCLUÍDO ]</span><h3>Sessão pronta para concluir.</h3><p>As cinco respostas foram registradas. Aplique o resultado ao projeto.</p><div class="puzzle-result-metrics"><div><span>Decisões acertadas</span><strong>${Math.max(0, total - session.mistakes)}/${total}</strong></div><div><span>Decisões a rever</span><strong>${session.mistakes}</strong></div></div><button class="primary-button full" data-action="complete-work-session" ${available ? '' : 'disabled'}>✓ Concluir e aplicar o trabalho</button><p class="puzzle-footnote">Digite concluir ou use o botão. A produção entra uma vez no projeto.</p></div></section>`;
  }
  const puzzle = session.currentPuzzle;
  if (!puzzle) return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}<p>Sua sessão está sendo preparada. Reabra Desenvolver para continuar.</p></section>`;
  return `<section class="work-puzzle" data-session="${escape(session.id)}">${heading}${feedback(session)}<article class="puzzle-question" data-puzzle="${escape(puzzle.id)}"><span class="puzzle-question-label">TAREFA ${session.index + 1} DE ${total}</span><h3>${escape(puzzle.title)}</h3><p>${escape(puzzle.prompt)}</p><div class="puzzle-choices">${puzzle.options.map((option, index) => `<button class="puzzle-choice" data-puzzle-answer="${escape(option.id)}" ${available ? '' : 'disabled'}><span>[${index + 1}]</span><strong>${escape(option.label)}</strong><span class="puzzle-choice-arrow" aria-hidden="true">↵</span></button>`).join('')}</div><p class="puzzle-footnote">Digite 1–${puzzle.options.length} no prompt ou clique em uma opção. Cada decisão influencia o resultado.</p></article></section>`;
}

function terminalHistory(history) {
  if (!history.length) return '';
  return `<div class="terminal-history" aria-label="Histórico dos comandos" aria-live="polite">${history.slice(-12).map((entry) => {
    if (typeof entry === 'string') return `<p class="terminal-output">${escape(entry)}</p>`;
    return `${entry.command ? `<p class="terminal-command-echo"><span>${escape(PROMPT)}</span> ${escape(entry.command)}</p>` : ''}${entry.output ? `<p class="terminal-output">${escape(entry.output)}</p>` : ''}`;
  }).join('')}</div>`;
}

export function renderDevelopmentTerminal(state, options = {}) {
  const { session = null, eligibility = {}, routine = '', view = 'work', history = [] } = options;
  return `<div class="development-terminal" data-terminal-view="${escape(view)}"><header class="terminal-boot"><strong>DevHouse Trabalho [versão 1.0]</strong><p>Sistema de produção da ${escape(state.profile.company)}.</p><p>Digite <b>ajuda</b> para ver os comandos. Respostas das tarefas: <b>1, 2, 3 ou 4</b>.</p></header><nav class="terminal-shortcuts" aria-label="Comandos rápidos do terminal"><button data-terminal-command="trabalhar" class="${view === 'work' ? 'active' : ''}">trabalhar</button><button data-terminal-command="rotina" class="${view === 'routine' ? 'active' : ''}">rotina</button><button data-terminal-command="foco">foco</button><button data-terminal-command="revisar">revisar</button><button data-terminal-command="status">status</button><button data-terminal-command="ajuda">ajuda</button></nav><div class="terminal-output-area">${terminalHistory(Array.isArray(history) ? history : [])}<div class="terminal-active-output">${view === 'routine' ? `<div class="terminal-routine"><div class="terminal-section-command">${escape(PROMPT)} rotina.exe</div>${routine}</div>` : renderWorkPuzzle(state, session, eligibility)}</div></div><form id="terminal-command-form" class="terminal-command-form"><label for="terminal-command"><span>${escape(PROMPT)}</span><span class="sr-only">Comando do terminal</span></label><input id="terminal-command" name="command" type="text" autocomplete="off" spellcheck="false" autocapitalize="none" maxlength="100" placeholder="Digite um comando..." aria-label="Comando do terminal"><button type="submit" aria-label="Executar comando" title="Executar comando">↵<span>Executar</span></button></form><p class="terminal-input-hint">Enter executa · seus projetos continuam salvos ao sair do PC.</p></div>`;
}
