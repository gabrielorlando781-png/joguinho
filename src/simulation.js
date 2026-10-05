const SAVE_KEY = 'joguinho-save-v1';
const SAVE_VERSION = 1;
const MAX_LEADS = 6;
const MAX_LOG = 80;
const MODES = {
  fast: { speed: 1.3, quality: -0.4, debt: 0.45, label: 'rápido' },
  standard: { speed: 1, quality: 0.04, debt: 0.08, label: 'equilibrado' },
  careful: { speed: 0.8, quality: 0.35, debt: 0.01, label: 'caprichado' },
};

export const LEADS = [
  { id: 'cafe-site', title: 'Um site com aroma de café', client: 'Café Aurora', sector: 'Comércio', price: 4800, hours: 22, duration: 8, description: 'Site institucional, cardápio e formulário de contato para uma cafeteria do bairro.' },
  { id: 'clinica-agenda', title: 'Agenda sem papel', client: 'Clínica Viver', sector: 'Saúde', price: 8200, hours: 38, duration: 14, description: 'Um sistema simples para organizar consultas, pacientes e horários disponíveis.' },
  { id: 'loja-vitrine', title: 'A loja entra na internet', client: 'Estúdio Ponto', sector: 'Varejo', price: 6500, hours: 30, duration: 11, description: 'Catálogo digital de produtos com painel de edição e pedidos por mensagem.' },
  { id: 'padaria-caixa', title: 'O caixa da padaria', client: 'Pão de Casa', sector: 'Comércio', price: 5800, hours: 27, duration: 11, description: 'Controle de vendas e um relatório diário para uma pequena padaria.' },
  { id: 'escola-painel', title: 'Uma turma mais organizada', client: 'Escola Horizonte', sector: 'Educação', price: 10500, hours: 48, duration: 18, description: 'Painel de matrículas, turmas e comunicados para uma escola independente.' },
  { id: 'oficina-ordens', title: 'Nada de ordem perdida', client: 'Oficina Norte', sector: 'Serviços', price: 7400, hours: 34, duration: 13, description: 'Sistema de ordens de serviço, prazos e histórico de clientes.' },
];

export const CANDIDATES = [
  { id: 'lucas', name: 'Lucas', role: 'Dev frontend', salary: 2800, productivity: 6, trait: 'Transforma café em interfaces', color: '#8c79d9' },
  { id: 'marina', name: 'Marina', role: 'Designer de produto', salary: 2400, productivity: 4.5, trait: 'Enxerga os detalhes que faltam', color: '#db8c6b' },
  { id: 'bia', name: 'Bia', role: 'Dev fullstack', salary: 3600, productivity: 7, trait: 'Resolve um pouco de tudo', color: '#66a894' },
];

export const FURNITURE = [
  { id: 'desk', name: 'Mesa compartilhada', price: 1500, description: 'Mais duas vagas para trazer gente nova para o time.' },
  { id: 'monitors', name: 'Monitor extra', price: 1800, description: 'Aumenta em 10% a produtividade de todo o escritório.' },
  { id: 'coffee-machine', name: 'Cafeteira', price: 900, description: 'Cada café recupera 22 de energia em vez de 14.' },
  { id: 'whiteboard', name: 'Quadro de ideias', price: 600, description: 'Cada hora de qualidade melhora ainda mais as entregas.' },
  { id: 'lounge', name: 'Cantinho de descanso', price: 1200, description: 'Descansar recupera mais energia, e as noites ficam melhores.' },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 100) / 100;
const isWeekday = (day) => (day - 1) % 7 < 5;
const activeProjects = (state) => state.projects.filter((project) => project.status === 'active');
const hasFurniture = (state, id) => state.furniture.some((item) => (typeof item === 'string' ? item : item.id) === id);
const result = (ok, message, extra = {}) => ({ ok, message, ...extra });
const running = (state) => state && state.status !== 'bankrupt';

function addLog(state, message) {
  state.log.unshift({ day: state.day, message });
  state.log.length = Math.min(state.log.length, MAX_LOG);
}

function recordMoney(state, amount, label) {
  state.cash = round(state.cash + amount);
  state.ledger.unshift({ day: state.day, label, amount: round(amount) });
  state.ledger.length = Math.min(state.ledger.length, 200);
}

function leadFromTemplate(state, template) {
  const serial = state.nextLeadId++;
  const variation = serial < 4 ? 1 : 1 + Math.floor((serial - 1) / LEADS.length) * 0.05;
  return {
    ...template,
    id: `${template.id}-${serial}`,
    price: Math.round(template.price * variation / 50) * 50,
    receivedDay: state.day,
    expiresDay: state.day + 18,
  };
}

function addLead(state) {
  if (state.leads.length >= MAX_LEADS) return null;
  const template = LEADS[(state.nextLeadId - 1) % LEADS.length];
  const lead = leadFromTemplate(state, template);
  state.leads.push(lead);
  addLog(state, `Novo contato: ${lead.client} procura ${lead.title.toLowerCase()}.`);
  return lead;
}

export function createGame(profile = {}) {
  const text = (value, fallback, max = 50) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
  const age = Number(profile.age);
  const state = {
    version: SAVE_VERSION,
    profile: {
      name: text(profile.name, 'Alex'),
      company: text(profile.company, 'Pequeno Estúdio', 64),
      age: Number.isFinite(age) ? clamp(Math.round(age), 18, 85) : 25,
      avatarColor: /^#[0-9a-f]{6}$/i.test(profile.avatarColor || '') ? profile.avatarColor : '#de936f',
      trait: ['technical', 'commercial', 'balanced'].includes(profile.trait) ? profile.trait : 'balanced',
    },
    day: 1,
    cash: 20000,
    reputation: 12,
    energy: 100,
    debt: 0,
    allocation: { sales: 2, delivery: 5, quality: 1 },
    projects: [],
    leads: [],
    employees: [],
    furniture: [],
    receivables: [],
    ledger: [{ day: 1, label: 'Capital inicial', amount: 20000 }],
    log: [{ day: 1, message: 'As portas estão abertas. Seu primeiro cliente está a uma conversa de distância.' }],
    history: [{ day: 1, cash: 20000, revenue: 0, debt: 0, reputation: 12 }],
    stats: { revenue: 0, delivered: 0, hoursWorked: 0 },
    speed: 1,
    paused: true,
    status: 'active',
    bankrupt: false,
    consecutiveNegativeDays: 0,
    nextLeadId: 1,
    salesProgress: 0,
    actionHours: 0,
    manualDeliveryHours: 0,
    manualQualityHours: 0,
    manualSalesHours: 0,
    dailyActions: { coffee: 0, rest: 0, work: 0, review: 0, prospect: 0 },
  };
  LEADS.slice(0, 3).forEach((lead) => state.leads.push(leadFromTemplate(state, lead)));
  return state;
}

export function saveGame(state) {
  try {
    if (typeof localStorage === 'undefined') return result(false, 'O salvamento não está disponível neste ambiente.');
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return result(true, 'Jogo salvo neste navegador.');
  } catch {
    return result(false, 'Não foi possível salvar. Verifique o espaço disponível no navegador.');
  }
}

// Validate the nested fields used by the simulation before trusting persisted data.
function validSave(state) {
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const string = (value) => typeof value === 'string';
  const bounded = (value, min, max) => finite(value) && value >= min && value <= max;
  const entries = (value, validate) => Array.isArray(value) && value.length <= 1000 && value.every(validate);
  if (!state || state.version !== SAVE_VERSION || !state.profile || !state.allocation || !state.stats || !state.dailyActions) return false;
  if (!string(state.profile.name) || !string(state.profile.company) || !bounded(state.profile.age, 18, 85) || !string(state.profile.avatarColor) || !['technical', 'commercial', 'balanced'].includes(state.profile.trait)) return false;
  if (!Number.isInteger(state.day) || state.day < 1 || !finite(state.cash) || !bounded(state.reputation, 0, 100) || !bounded(state.energy, 0, 100) || !bounded(state.debt, 0, 100)) return false;
  if (!['active', 'bankrupt'].includes(state.status) || typeof state.bankrupt !== 'boolean' || typeof state.paused !== 'boolean' || !bounded(state.speed, 0.1, 20)) return false;
  if (!Number.isInteger(state.consecutiveNegativeDays) || !bounded(state.consecutiveNegativeDays, 0, 60)) return false;
  if (!['sales', 'delivery', 'quality'].every((key) => Number.isInteger(state.allocation[key]) && bounded(state.allocation[key], 0, 8)) || Object.values(state.allocation).reduce((sum, hours) => sum + hours, 0) !== 8) return false;
  if (!Number.isInteger(state.nextLeadId) || state.nextLeadId < 1 || !bounded(state.salesProgress, 0, 10000) || !bounded(state.actionHours, 0, 8) || !bounded(state.manualDeliveryHours, 0, 2) || !bounded(state.manualQualityHours, 0, 1) || !bounded(state.manualSalesHours, 0, 1)) return false;
  if (!['coffee', 'rest', 'work', 'review', 'prospect'].every((key) => Number.isInteger(state.dailyActions[key]) && bounded(state.dailyActions[key], 0, 2))) return false;
  if (!['revenue', 'delivered', 'hoursWorked'].every((key) => finite(state.stats[key]) && state.stats[key] >= 0)) return false;
  if (!entries(state.projects, (p) => p && string(p.id) && string(p.title) && string(p.client) && bounded(p.price, 1, 100000000) && bounded(p.hours, 1, 1000000) && bounded(p.progress, 0, p.hours) && Number.isInteger(p.deadline) && p.deadline > 0 && Object.hasOwn(MODES, p.mode) && bounded(p.quality, 0, 100) && typeof p.paid === 'boolean' && ['active', 'delivered'].includes(p.status))) return false;
  if (!entries(state.leads, (l) => l && string(l.id) && string(l.title) && string(l.client) && string(l.sector) && string(l.description) && bounded(l.price, 1, 100000000) && bounded(l.hours, 1, 1000000) && Number.isInteger(l.duration) && l.duration > 0 && Number.isInteger(l.expiresDay))) return false;
  if (!entries(state.employees, (e) => e && CANDIDATES.some((c) => c.id === e.id) && string(e.name) && string(e.role) && string(e.color) && bounded(e.salary, 1, 1000000) && bounded(e.productivity, 0, 24) && ['PJ', 'CLT'].includes(e.contract))) return false;
  if (!entries(state.furniture, (item) => item && FURNITURE.some((f) => f.id === (typeof item === 'string' ? item : item.id)))) return false;
  if (!entries(state.receivables, (r) => r && string(r.projectId) && finite(r.amount) && r.amount >= 0 && Number.isInteger(r.dueDay) && r.dueDay > 0 && string(r.client))) return false;
  if (!entries(state.ledger, (e) => e && Number.isInteger(e.day) && string(e.label) && finite(e.amount)) || !entries(state.log, (e) => e && Number.isInteger(e.day) && string(e.message))) return false;
  if (!entries(state.history, (h) => h && Number.isInteger(h.day) && finite(h.cash) && finite(h.revenue) && finite(h.debt) && finite(h.reputation))) return false;
  return true;
}

export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.version !== SAVE_VERSION || !validSave(saved.state)) return null;
    // Never start advancing a restored company before the player presses play.
    saved.state.paused = true;
    return saved.state;
  } catch {
    return null;
  }
}

export function acceptProject(state, leadId) {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return result(false, 'Essa oportunidade já não está disponível.');
  if (activeProjects(state).length >= 3) return result(false, 'Você já tem três projetos ativos. Entregue um antes de assumir outro.');
  const project = {
    ...lead,
    progress: 0,
    deadline: state.day + lead.duration,
    mode: 'standard',
    quality: 68,
    paid: false,
    status: 'active',
    startedDay: state.day,
  };
  state.projects.push(project);
  state.leads = state.leads.filter((item) => item.id !== leadId);
  addLog(state, `Contrato fechado com ${lead.client}. O pagamento chega três dias após a entrega.`);
  return result(true, `${lead.title}: prazo de ${lead.duration} dias, pagamento após a entrega.`, { project });
}

export function prospect(state) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (state.leads.length >= MAX_LEADS) return result(false, 'Há seis propostas na caixa de entrada. Avalie uma delas primeiro.');
  if (!isWeekday(state.day)) return result(false, 'Os clientes voltam a conversar na segunda-feira.');
  if (state.allocation.sales === 0) return result(false, 'Reserve ao menos uma hora para vendas antes de prospectar.');
  if (state.dailyActions.prospect) return result(false, 'Você já prospectou hoje. Os próximos contatos chegam com o tempo dedicado a vendas.');
  // Prospecting costs an hour of today's sales allocation, never a free repeated lead.
  state.dailyActions.prospect = 1;
  state.manualSalesHours = 1;
  state.actionHours += 1;
  state.energy = clamp(state.energy - 3, 0, 100);
  const lead = addLead(state);
  return result(true, `Nova oportunidade de ${lead.client}.`, { lead });
}

export function hireEmployee(state, candidateId, contract = 'PJ') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const candidate = CANDIDATES.find((person) => person.id === candidateId);
  if (!candidate) return result(false, 'Essa pessoa não está disponível para contratação.');
  if (!['PJ', 'CLT'].includes(contract)) return result(false, 'Escolha um contrato PJ ou CLT.');
  if (state.employees.some((person) => person.id === candidateId)) return result(false, `${candidate.name} já faz parte do time.`);
  const capacity = hasFurniture(state, 'desk') ? 4 : 2;
  if (state.employees.length >= capacity) return result(false, 'As mesas estão ocupadas. Compre uma mesa compartilhada para ampliar o time.');
  const dailyCost = round(candidate.salary / 20 * (contract === 'CLT' ? 1.7 : 1.15));
  if (state.cash < dailyCost * 5 + 550) return result(false, 'Reserve caixa para pelo menos cinco dias de trabalho antes de contratar.');
  state.employees.push({ ...candidate, contract, hiredDay: state.day });
  addLog(state, `${candidate.name} entrou para o time com contrato ${contract}. Custo por dia útil: R$ ${dailyCost.toFixed(2)}.`);
  return result(true, `${candidate.name} já pode começar. O salário é descontado a cada dia útil.`);
}

export function buyFurniture(state, itemId) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const item = FURNITURE.find((entry) => entry.id === itemId);
  if (!item) return result(false, 'Esse item não está na loja.');
  if (hasFurniture(state, item.id)) return result(false, 'Seu escritório já tem esse item.');
  if (state.cash < item.price) return result(false, 'O caixa ainda não cobre essa compra.');
  recordMoney(state, -item.price, item.name);
  state.furniture.push({ ...item, purchasedDay: state.day });
  addLog(state, `${item.name} chegou ao escritório.`);
  return result(true, `${item.name} comprado. ${item.description}`);
}

export function setAllocation(state, key, value) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (!['sales', 'delivery', 'quality'].includes(key) || !Number.isFinite(Number(value))) return result(false, 'Escolha uma área e uma quantidade válida de horas.');
  const hours = clamp(Math.round(Number(value)), 0, 8);
  const minimum = key === 'delivery' ? state.manualDeliveryHours : key === 'quality' ? state.manualQualityHours : (state.manualSalesHours || 0);
  if (hours < minimum) return result(false, 'Essas horas já foram usadas hoje. Ajuste a rotina após avançar o dia.');
  const delta = hours - state.allocation[key];
  const priorities = ['delivery', 'sales', 'quality'].filter((area) => area !== key);
  const allocation = { ...state.allocation, [key]: hours };
  if (delta > 0) {
    let remaining = delta;
    for (const area of priorities) {
      const consumed = area === 'delivery' ? state.manualDeliveryHours : area === 'quality' ? state.manualQualityHours : (state.manualSalesHours || 0);
      const available = Math.max(0, allocation[area] - consumed);
      const take = Math.min(remaining, available);
      allocation[area] -= take;
      remaining -= take;
    }
    if (remaining > 0) return result(false, 'Parte dessas horas já foi usada hoje. Redistribua no próximo dia.');
  } else if (delta < 0) {
    allocation[priorities[0]] -= delta;
  }
  state.allocation = allocation;
  return result(true, 'Rotina atualizada: oito horas de trabalho distribuídas por dia útil.');
}

export function setProjectMode(state, projectId, mode) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const project = state.projects.find((item) => item.id === projectId && item.status === 'active');
  if (!project || !Object.hasOwn(MODES, mode)) return result(false, 'Escolha um projeto ativo e um ritmo válido.');
  project.mode = mode;
  return result(true, `Projeto no ritmo ${MODES[mode].label}.`);
}

function completeProject(state, project) {
  if (project.status !== 'active' || project.progress < project.hours) return null;
  const lateDays = Math.max(0, state.day - project.deadline);
  project.progress = project.hours;
  project.status = 'delivered';
  project.completedDay = state.day;
  project.quality = round(clamp(project.quality - lateDays * 3, 0, 100));
  const priceFactor = (lateDays > 0 ? 0.9 : 1) * (project.quality < 55 ? 0.85 : 1);
  project.invoiceAmount = Math.round(project.price * priceFactor);
  project.dueDay = state.day + 3;
  state.receivables.push({ projectId: project.id, client: project.client, amount: project.invoiceAmount, dueDay: project.dueDay });
  const reputationGain = (project.quality >= 80 ? 3 : project.quality >= 65 ? 2 : project.quality >= 50 ? 0 : -3) - (lateDays > 0 ? 2 : 0);
  state.reputation = clamp(state.reputation + reputationGain, 0, 100);
  state.stats.delivered += 1;
  addLog(state, `${project.title} entregue com qualidade ${Math.round(project.quality)}%. R$ ${project.invoiceAmount} previstos para o dia ${project.dueDay}.${lateDays ? ' O atraso reduziu o pagamento.' : ''}`);
  return project;
}

function applyWork(state, project, hours) {
  if (!project || project.status !== 'active' || hours <= 0) return 0;
  const mode = MODES[project.mode];
  const energyFactor = 0.55 + state.energy / 100 * 0.45;
  const debtFactor = Math.max(0.55, 1 - state.debt / 160);
  const furnitureFactor = hasFurniture(state, 'monitors') ? 1.1 : 1;
  const traitFactor = state.profile.trait === 'technical' ? 1.05 : 1;
  const output = Math.min(project.hours - project.progress, hours * mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor);
  project.progress = round(Math.min(project.hours, project.progress + output));
  project.quality = round(clamp(project.quality + output * mode.quality, 0, 100));
  state.debt = round(clamp(state.debt + output * mode.debt, 0, 100));
  // Only count the time actually needed to finish; remaining capacity can serve another client.
  const usedHours = output / (mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor);
  state.stats.hoursWorked = round(state.stats.hoursWorked + usedHours);
  completeProject(state, project);
  return usedHours;
}

export function performAction(state, action) {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades.');
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'coffee') {
    if (state.dailyActions.coffee >= 2) return result(false, 'Dois cafés por dia já são suficientes.');
    if (state.energy >= 100) return result(false, 'Sua energia já está cheia.');
    if (state.cash < 15) return result(false, 'Faltam R$ 15 no caixa para o café.');
    recordMoney(state, -15, 'Pausa para café');
    state.energy = clamp(state.energy + (hasFurniture(state, 'coffee-machine') ? 22 : 14), 0, 100);
    state.dailyActions.coffee += 1;
    return result(true, 'Café passado. Energia recuperada por R$ 15.');
  }
  if (type === 'rest') {
    if (state.dailyActions.rest >= 1) return result(false, 'Você já fez sua pausa de descanso hoje.');
    if (state.energy >= 100) return result(false, 'Você já está com a energia cheia.');
    if (state.cash < 40) return result(false, 'Reserve R$ 40 para um descanso e um lanche.');
    recordMoney(state, -40, 'Descanso e lanche');
    state.energy = clamp(state.energy + (hasFurniture(state, 'lounge') ? 40 : 30), 0, 100);
    state.dailyActions.rest += 1;
    return result(true, 'Uma pausa e um lanche. Você voltou com mais energia.');
  }
  if (!isWeekday(state.day)) return result(false, 'Hoje é fim de semana. A equipe volta na segunda-feira.');
  if (type === 'work') {
    const project = typeof action === 'object' && action.projectId
      ? activeProjects(state).find((item) => item.id === action.projectId)
      : activeProjects(state).sort((a, b) => a.deadline - b.deadline)[0];
    if (!project) return result(false, 'Aceite um projeto antes de trabalhar.');
    const hours = Math.min(2 - state.manualDeliveryHours, state.allocation.delivery - state.manualDeliveryHours);
    if (hours <= 0) return result(false, 'Seu bloco de trabalho manual já foi usado. Avance o dia para continuar.');
    if (state.energy < 10) return result(false, 'Sua energia está muito baixa. Faça uma pausa antes de trabalhar.');
    applyWork(state, project, hours);
    state.energy = clamp(state.energy - hours * 2.5, 0, 100);
    state.manualDeliveryHours += hours;
    state.actionHours += hours;
    state.dailyActions.work += 1;
    return result(true, `${hours}h dedicadas a ${project.title}. Essas horas fazem parte da rotina de hoje.`);
  }
  if (type === 'review') {
    if (state.dailyActions.review >= 1) return result(false, 'Você já revisou o código hoje.');
    if (state.allocation.quality - state.manualQualityHours < 1) return result(false, 'Reserve uma hora para qualidade antes de revisar.');
    if (state.debt <= 0 && activeProjects(state).length === 0) return result(false, 'Ainda não há código para revisar.');
    state.debt = round(Math.max(0, state.debt - 6));
    activeProjects(state).forEach((project) => { project.quality = round(clamp(project.quality + 3, 0, 100)); });
    state.manualQualityHours += 1;
    state.actionHours += 1;
    state.dailyActions.review += 1;
    state.energy = clamp(state.energy - 2, 0, 100);
    return result(true, 'Código revisado: menos dívida técnica e mais qualidade. Uma hora da rotina foi usada.');
  }
  return result(false, 'Ação desconhecida.');
}

export function advanceDay(state) {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  const day = state.day;
  const weekday = isWeekday(day);
  const summary = { day, hoursWorked: 0, projectsDelivered: 0, revenue: 0, costs: 0, energy: state.energy, weekend: !weekday };
  for (const receivable of state.receivables.filter((item) => item.dueDay <= day)) {
    recordMoney(state, receivable.amount, `Pagamento: ${receivable.client}`);
    state.stats.revenue = round(state.stats.revenue + receivable.amount);
    summary.revenue = round(summary.revenue + receivable.amount);
    const project = state.projects.find((item) => item.id === receivable.projectId);
    if (project) project.paid = true;
    addLog(state, `${receivable.client} pagou R$ ${receivable.amount}. O dinheiro entrou no caixa.`);
  }
  state.receivables = state.receivables.filter((item) => item.dueDay > day);

  const beforeWorked = state.stats.hoursWorked;
  const beforeDelivered = state.stats.delivered;
  if (weekday) {
    const projects = activeProjects(state).sort((a, b) => a.deadline - b.deadline);
    const qualityHours = Math.max(0, state.allocation.quality - state.manualQualityHours);
    const qualityBoost = hasFurniture(state, 'whiteboard') ? 4 : 3;
    projects.forEach((project) => {
      project.quality = round(clamp(project.quality + qualityHours * qualityBoost / projects.length, 0, 100));
    });
    state.debt = round(Math.max(0, state.debt - qualityHours * 2.5));
    const founderHours = Math.max(0, state.allocation.delivery - state.manualDeliveryHours);
    const teamHours = state.employees.reduce((total, person) => total + person.productivity, 0);
    let hours = founderHours + teamHours;
    for (const project of projects) {
      if (hours <= 0) break;
      hours = Math.max(0, hours - applyWork(state, project, hours));
    }
    const salesHours = Math.max(0, state.allocation.sales - (state.manualSalesHours || 0));
    state.salesProgress += salesHours * (state.profile.trait === 'commercial' ? 1.05 : 1);
    while (state.salesProgress >= 8 && state.leads.length < MAX_LEADS) {
      addLead(state);
      state.salesProgress -= 8;
    }
    state.salesProgress = Math.min(16, state.salesProgress);
    const energySpent = founderHours * 2.5 + salesHours + qualityHours * 1.5;
    const recovery = hasFurniture(state, 'lounge') ? 13 : 8;
    state.energy = round(clamp(state.energy - energySpent + recovery, 0, 100));
  } else {
    state.energy = clamp(state.energy + 25, 0, 100);
  }

  const payroll = weekday ? state.employees.reduce((total, person) => total + person.salary / 20 * (person.contract === 'CLT' ? 1.7 : 1.15), 0) : 0;
  recordMoney(state, -110, 'Aluguel, internet e custos fixos');
  if (payroll > 0) recordMoney(state, -payroll, 'Salários e contratos');
  summary.costs = round(110 + payroll);
  summary.hoursWorked = round(state.stats.hoursWorked - beforeWorked);
  summary.projectsDelivered = state.stats.delivered - beforeDelivered;
  summary.energy = state.energy;
  const expired = state.leads.filter((lead) => lead.expiresDay <= day);
  if (expired.length) addLog(state, `${expired.length} oportunidade${expired.length > 1 ? 's expiraram' : ' expirou'}. Outros clientes ainda vão aparecer.`);
  state.leads = state.leads.filter((lead) => lead.expiresDay > day);

  state.consecutiveNegativeDays = state.cash < 0 ? state.consecutiveNegativeDays + 1 : 0;
  if (state.consecutiveNegativeDays >= 60) {
    state.status = 'bankrupt';
    state.bankrupt = true;
    state.paused = true;
    addLog(state, 'Após 60 dias seguidos no vermelho, a empresa fechou. Sua próxima história pode começar com o que você aprendeu.');
  } else if (state.consecutiveNegativeDays === 1) {
    addLog(state, 'O caixa entrou no vermelho. Você tem 60 dias para recuperar o saldo antes de encerrar as atividades.');
  } else if (state.cash < 2000 && day % 5 === 0) {
    addLog(state, 'O caixa está abaixo de R$ 2.000. Entregue contratos e cuide dos recebimentos antes de gastar.');
  }
  state.history.push({ day, cash: state.cash, revenue: state.stats.revenue, debt: state.debt, reputation: state.reputation });
  state.history = state.history.slice(-120);
  state.day += 1;
  state.actionHours = 0;
  state.manualDeliveryHours = 0;
  state.manualQualityHours = 0;
  state.manualSalesHours = 0;
  state.dailyActions = { coffee: 0, rest: 0, work: 0, review: 0, prospect: 0 };
  const message = state.bankrupt
    ? 'Após 60 dias seguidos no vermelho, a empresa encerrou as atividades.'
    : `Dia ${day} encerrado: ${summary.hoursWorked.toFixed(1)}h de entrega, R$ ${summary.costs.toFixed(0)} de custos${summary.revenue ? ` e R$ ${summary.revenue.toFixed(0)} recebidos` : ''}.`;
  return result(true, message, { summary });
}
