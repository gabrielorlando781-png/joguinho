const SAVE_KEY = 'joguinho-save-v1';
const SAVE_VERSION = 2;
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
const PRICING = {
  discount: { factor: 0.85, extraDays: 2, paymentDays: 2, label: 'desconto' },
  standard: { factor: 1, extraDays: 0, paymentDays: 3, label: 'padrão' },
  premium: { factor: 1.2, extraDays: -2, paymentDays: 5, label: 'premium' },
};
const consumedHours = (state, area) => area === 'delivery'
  ? state.manualDeliveryHours + state.travelHours
  : area === 'quality' ? state.manualQualityHours : state.manualSalesHours;
const availableHours = (state, area) => Math.max(0, state.allocation[area] - consumedHours(state, area));

function spendHours(state, area, hours) {
  if (!isWeekday(state.day) || availableHours(state, area) + 0.00000001 < hours) return false;
  const field = area === 'delivery' ? 'manualDeliveryHours' : area === 'quality' ? 'manualQualityHours' : 'manualSalesHours';
  state[field] = Math.round((state[field] + hours) * 1000000) / 1000000;
  state.actionHours = Math.round((state.actionHours + hours) * 1000000) / 1000000;
  state.energy = clamp(state.energy - hours * (area === 'delivery' ? 2.5 : 1.5), 0, 100);
  return true;
}

function updatePhase(project) {
  project.phase = project.status === 'delivered' ? 'delivered'
    : project.progress === 0 ? 'backlog' : project.progress / project.hours >= 0.8 ? 'review' : 'development';
}

function decorateLead(lead) {
  lead.discovered = false;
  lead.estimateMin = Math.floor(lead.hours * 0.75);
  lead.estimateMax = Math.ceil(lead.hours * 1.35);
  lead.qualification = null;
  return lead;
}

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
  return decorateLead({
    ...template,
    id: `${template.id}-${serial}`,
    price: Math.round(template.price * variation / 50) * 50,
    receivedDay: state.day,
    expiresDay: state.day + 18,
  });
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
    dailyActions: { coffee: 0, rest: 0, work: 0, workHours: 0, review: 0, prospect: 0, product: 0 },
    interviews: {},
    pendingEvents: [],
    officePosition: { x: 0, y: 0 },
    travelHours: 0,
    focusProjectId: null,
    product: { unlocked: false, stage: 'locked', progress: 0, research: 0, mrr: 0, users: 0, nextPaymentDay: 0 },
    loan: { balance: 0, interest: 0.02, nextInterestDay: 0, taken: false },
  };
  LEADS.slice(0, 3).forEach((lead) => state.leads.push(leadFromTemplate(state, lead)));
  return state;
}

export function saveGame(state) {
  try {
    if (typeof localStorage === 'undefined') return result(false, 'O salvamento não está disponível neste ambiente.');
    if (!validSave(state)) return result(false, 'O estado atual não pôde ser validado. Seu último salvamento foi preservado.');
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return result(true, 'Jogo salvo neste navegador.');
  } catch {
    return result(false, 'Não foi possível salvar. Verifique o espaço disponível no navegador.');
  }
}

// Validate the nested fields used by the simulation before trusting persisted data.
function validSave(state, legacy = false) {
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const string = (value) => typeof value === 'string';
  const bounded = (value, min, max) => finite(value) && value >= min && value <= max;
  const entries = (value, validate) => Array.isArray(value) && value.length <= 1000 && value.every(validate);
  if (!state || state.version !== (legacy ? 1 : SAVE_VERSION) || !state.profile || !state.allocation || !state.stats || !state.dailyActions) return false;
  if (!string(state.profile.name) || !string(state.profile.company) || !bounded(state.profile.age, 18, 85) || !string(state.profile.avatarColor) || !['technical', 'commercial', 'balanced'].includes(state.profile.trait)) return false;
  if (!Number.isInteger(state.day) || state.day < 1 || !finite(state.cash) || !bounded(state.reputation, 0, 100) || !bounded(state.energy, 0, 100) || !bounded(state.debt, 0, 100)) return false;
  if (!['active', 'bankrupt'].includes(state.status) || typeof state.bankrupt !== 'boolean' || typeof state.paused !== 'boolean' || !bounded(state.speed, 0.1, 20)) return false;
  if (!Number.isInteger(state.consecutiveNegativeDays) || !bounded(state.consecutiveNegativeDays, 0, 60)) return false;
  if (!['sales', 'delivery', 'quality'].every((key) => Number.isInteger(state.allocation[key]) && bounded(state.allocation[key], 0, 8)) || Object.values(state.allocation).reduce((sum, hours) => sum + hours, 0) !== 8) return false;
  if (!Number.isInteger(state.nextLeadId) || state.nextLeadId < 1 || !bounded(state.salesProgress, 0, 10000) || !bounded(state.actionHours, 0, 8) || !bounded(state.manualDeliveryHours, 0, legacy ? 2 : 8) || !bounded(state.manualQualityHours, 0, legacy ? 1 : 8) || !bounded(state.manualSalesHours, 0, legacy ? 1 : 8)) return false;
  if (!['coffee', 'rest', 'work', 'review', 'prospect'].every((key) => Number.isInteger(state.dailyActions[key]) && bounded(state.dailyActions[key], 0, !legacy && key === 'work' ? 8 : 2))) return false;
  if (!['revenue', 'delivered', 'hoursWorked'].every((key) => finite(state.stats[key]) && state.stats[key] >= 0)) return false;
  if (!entries(state.projects, (p) => p && string(p.id) && string(p.title) && string(p.client) && bounded(p.price, 1, 100000000) && bounded(p.hours, 1, 1000000) && bounded(p.progress, 0, p.hours) && Number.isInteger(p.deadline) && p.deadline > 0 && Object.hasOwn(MODES, p.mode) && bounded(p.quality, 0, 100) && typeof p.paid === 'boolean' && ['active', 'delivered'].includes(p.status))) return false;
  if (!entries(state.leads, (l) => l && string(l.id) && string(l.title) && string(l.client) && string(l.sector) && string(l.description) && bounded(l.price, 1, 100000000) && bounded(l.hours, 1, 1000000) && Number.isInteger(l.duration) && l.duration > 0 && Number.isInteger(l.expiresDay))) return false;
  if (!entries(state.employees, (e) => e && CANDIDATES.some((c) => c.id === e.id) && string(e.name) && string(e.role) && string(e.color) && bounded(e.salary, 1, 1000000) && bounded(e.productivity, 0, 24) && ['PJ', 'CLT'].includes(e.contract))) return false;
  if (!entries(state.furniture, (item) => item && FURNITURE.some((f) => f.id === (typeof item === 'string' ? item : item.id)))) return false;
  if (!entries(state.receivables, (r) => r && string(r.projectId) && finite(r.amount) && r.amount >= 0 && Number.isInteger(r.dueDay) && r.dueDay > 0 && string(r.client))) return false;
  if (!entries(state.ledger, (e) => e && Number.isInteger(e.day) && string(e.label) && finite(e.amount)) || !entries(state.log, (e) => e && Number.isInteger(e.day) && string(e.message))) return false;
  if (!entries(state.history, (h) => h && Number.isInteger(h.day) && finite(h.cash) && finite(h.revenue) && finite(h.debt) && finite(h.reputation))) return false;
  if (legacy) return true;
  if (!state.officePosition || !finite(state.officePosition.x) || !finite(state.officePosition.y) || !bounded(state.travelHours, 0, 0.75)) return false;
  if (state.focusProjectId !== null && !string(state.focusProjectId)) return false;
  if (!state.product || typeof state.product.unlocked !== 'boolean' || !['locked', 'prototype', 'launched'].includes(state.product.stage) || !bounded(state.product.progress, 0, 100) || !Number.isInteger(state.product.research) || !bounded(state.product.research, 0, 100) || !bounded(state.product.mrr, 0, 1000000) || !bounded(state.product.users, 0, 1000000) || !Number.isInteger(state.product.nextPaymentDay) || state.product.nextPaymentDay < 0) return false;
  if (!state.loan || !bounded(state.loan.balance, 0, 100000000) || !bounded(state.loan.interest, 0, 1) || !Number.isInteger(state.loan.nextInterestDay) || state.loan.nextInterestDay < 0 || typeof state.loan.taken !== 'boolean') return false;
  if (!bounded(state.dailyActions.workHours, 0, 2) || !bounded(state.dailyActions.product, 0, 1)) return false;
  if (!state.interviews || Array.isArray(state.interviews) || typeof state.interviews !== 'object' || !Object.entries(state.interviews).every(([id, info]) => CANDIDATES.some((candidate) => candidate.id === id) && info && info.candidateId === id && Number.isInteger(info.day) && bounded(info.score, 0, 100) && string(info.strength) && string(info.risk))) return false;
  if (!state.projects.every((p) => ['backlog', 'development', 'review', 'delivered'].includes(p.phase) && Number.isInteger(p.paymentDays) && bounded(p.paymentDays, 1, 90) && typeof p.eventTriggered === 'boolean' && Number.isInteger(p.blockedUntil) && p.blockedUntil >= 0)) return false;
  if (!state.leads.every((l) => typeof l.discovered === 'boolean' && bounded(l.estimateMin, 0, l.estimateMax) && finite(l.estimateMax) && (l.qualification === null || (l.qualification && bounded(l.qualification.confidence, 0, 100) && string(l.qualification.scope) && string(l.qualification.risks))))) return false;
  if (!state.employees.every((e) => string(e.assignment) && ['delivery', 'quality'].includes(e.assignmentRole) && bounded(e.morale, 0, 100) && bounded(e.stress, 0, 100))) return false;
  if (!state.receivables.every((r) => Number.isInteger(r.paymentDay) && r.paymentDay >= r.dueDay && Number.isInteger(r.followupCount) && bounded(r.followupCount, 0, 1))) return false;
  if (!entries(state.pendingEvents, (e) => e && string(e.id) && string(e.projectId) && ['scope', 'blocker', 'bug'].includes(e.type) && string(e.title) && string(e.description) && Number.isInteger(e.createdDay) && entries(e.options, (o) => o && string(o.id) && string(o.label) && string(o.description) && bounded(o.cost, 0, 1000000) && bounded(o.hours, 0, 8) && ['sales', 'delivery', 'quality', 'none'].includes(o.area))) || state.pendingEvents.length > 1) return false;
  return true;
}

function migrateSave(state) {
  state.version = SAVE_VERSION;
  state.interviews = {};
  state.pendingEvents = [];
  state.officePosition = { x: 0, y: 0 };
  state.travelHours = 0;
  state.focusProjectId = null;
  state.product = { unlocked: state.stats.delivered >= 2, stage: state.stats.delivered >= 2 ? 'prototype' : 'locked', progress: 0, research: 0, mrr: 0, users: 0, nextPaymentDay: 0 };
  state.loan = { balance: 0, interest: 0.02, nextInterestDay: 0, taken: false };
  state.dailyActions.workHours = state.manualDeliveryHours;
  state.dailyActions.product = 0;
  state.leads.forEach(decorateLead);
  state.projects.forEach((project) => {
    updatePhase(project);
    project.paymentDays = 3;
    project.eventTriggered = true;
    project.blockedUntil = 0;
  });
  state.employees.forEach((person) => Object.assign(person, { assignment: 'auto', assignmentRole: 'delivery', morale: 75, stress: 15 }));
  state.receivables.forEach((receivable) => Object.assign(receivable, { paymentDay: receivable.dueDay, followupCount: 0 }));
  return state;
}

export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || ![1, SAVE_VERSION].includes(saved.version)) return null;
    if (saved.version === 1) {
      if (!validSave(saved.state, true)) return null;
      saved.state = migrateSave(saved.state);
    } else if (!validSave(saved.state)) return null;
    // Never start advancing a restored company before the player presses play.
    saved.state.paused = true;
    return saved.state;
  } catch {
    return null;
  }
}

export function acceptProject(state, leadId) {
  return negotiateProject(state, leadId, 'standard');
}

export function negotiateProject(state, leadId, pricing = 'standard') {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return result(false, 'Essa oportunidade já não está disponível.');
  if (!Object.hasOwn(PRICING, pricing)) return result(false, 'Escolha desconto, padrão ou premium.');
  if (pricing === 'premium' && state.reputation < 25 && !lead.discovered) return result(false, 'Faça a descoberta do escopo ou alcance 25 de reputação para justificar um contrato premium.');
  if (activeProjects(state).length >= 3) return result(false, 'Você já tem três projetos ativos. Entregue um antes de assumir outro.');
  const terms = PRICING[pricing];
  const duration = Math.max(3, lead.duration + terms.extraDays);
  const project = {
    ...lead,
    price: Math.round(lead.price * terms.factor),
    duration,
    progress: 0,
    deadline: state.day + duration,
    mode: 'standard',
    quality: 68,
    paid: false,
    status: 'active',
    startedDay: state.day,
    pricing,
    paymentDays: terms.paymentDays,
    phase: 'backlog',
    eventTriggered: false,
    blockedUntil: 0,
  };
  state.projects.push(project);
  state.leads = state.leads.filter((item) => item.id !== leadId);
  addLog(state, `Contrato ${terms.label} fechado com ${lead.client}: R$ ${project.price}, ${duration} dias de prazo e pagamento ${terms.paymentDays} dias após a entrega.`);
  return result(true, `${lead.title}: ${duration} dias de prazo, R$ ${project.price}, recebimento D+${terms.paymentDays}.`, { project });
}

export function discoverLead(state, leadId) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return result(false, 'Essa oportunidade já não está disponível.');
  if (lead.discovered) return result(false, 'O escopo deste cliente já foi descoberto.');
  if (!spendHours(state, 'sales', 1)) return result(false, 'A descoberta precisa de uma hora disponível de vendas em um dia útil.');
  lead.discovered = true;
  lead.estimateMin = Math.floor(lead.hours * 0.95);
  lead.estimateMax = Math.ceil(lead.hours * 1.05);
  lead.qualification = { confidence: 95, scope: lead.description, risks: 'Mudanças de escopo e dependência de feedback precisam ser negociadas antes da entrega.' };
  addLog(state, `Descoberta com ${lead.client}: estimativa mais confiável e justificativa para uma proposta premium.`);
  return result(true, `Escopo descoberto: estimativa entre ${lead.estimateMin} e ${lead.estimateMax} horas.`, { lead });
}

export function interviewCandidate(state, candidateId) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const candidate = CANDIDATES.find((person) => person.id === candidateId);
  if (!candidate) return result(false, 'Essa pessoa não está disponível.');
  if (state.interviews[candidateId]) return result(false, 'Você já entrevistou essa pessoa. Consulte suas anotações.');
  if (state.employees.some((person) => person.id === candidateId)) return result(false, 'Essa pessoa já está no time.');
  if (!spendHours(state, 'quality', 1)) return result(false, 'A entrevista usa uma hora de qualidade em um dia útil.');
  const interview = { day: state.day, candidateId, score: Math.round(65 + candidate.productivity * 3), strength: candidate.trait, risk: candidateId === 'bia' ? 'Um salário maior exige um pipeline constante.' : candidateId === 'marina' ? 'Entrega menos horas de código, mas ajuda a validar a experiência.' : 'Precisará de revisões para crescer com segurança.' };
  state.interviews[candidateId] = interview;
  addLog(state, `Entrevista com ${candidate.name} concluída. A contratação está disponível no RH.`);
  return result(true, `${candidate.name}: ${interview.strength}. ${interview.risk}`, { interview });
}

export function prospect(state) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (state.leads.length >= MAX_LEADS) return result(false, 'Há seis propostas na caixa de entrada. Avalie uma delas primeiro.');
  if (!isWeekday(state.day)) return result(false, 'Os clientes voltam a conversar na segunda-feira.');
  if (availableHours(state, 'sales') < 1) return result(false, 'Reserve ao menos uma hora livre para vendas antes de prospectar.');
  if (state.dailyActions.prospect) return result(false, 'Você já prospectou hoje. Os próximos contatos chegam com o tempo dedicado a vendas.');
  // Prospecting costs an hour of today's sales allocation, never a free repeated lead.
  state.dailyActions.prospect = 1;
  spendHours(state, 'sales', 1);
  const lead = addLead(state);
  return result(true, `Nova oportunidade de ${lead.client}.`, { lead });
}

export function hireEmployee(state, candidateId, contract = 'PJ') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const candidate = CANDIDATES.find((person) => person.id === candidateId);
  if (!candidate) return result(false, 'Essa pessoa não está disponível para contratação.');
  if (!['PJ', 'CLT'].includes(contract)) return result(false, 'Escolha um contrato PJ ou CLT.');
  if (state.employees.some((person) => person.id === candidateId)) return result(false, `${candidate.name} já faz parte do time.`);
  if (!state.interviews[candidateId]) return result(false, 'Entreviste essa pessoa no RH antes de contratar.');
  const capacity = hasFurniture(state, 'desk') ? 4 : 2;
  if (state.employees.length >= capacity) return result(false, 'As mesas estão ocupadas. Compre uma mesa compartilhada para ampliar o time.');
  const dailyCost = round(candidate.salary / 20 * (contract === 'CLT' ? 1.7 : 1.15));
  if (state.cash < dailyCost * 5 + 550) return result(false, 'Reserve caixa para pelo menos cinco dias de trabalho antes de contratar.');
  state.employees.push({ ...candidate, contract, hiredDay: state.day, assignment: 'auto', assignmentRole: 'delivery', morale: 75, stress: 15 });
  addLog(state, `${candidate.name} entrou para o time com contrato ${contract}. Custo por dia útil: R$ ${dailyCost.toFixed(2)}.`);
  return result(true, `${candidate.name} já pode começar. O salário é descontado a cada dia útil.`);
}

export function assignEmployee(state, employeeId, projectId = 'auto', role = 'delivery') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const person = state.employees.find((employee) => employee.id === employeeId);
  if (!person || !['delivery', 'quality'].includes(role) || (projectId !== 'auto' && !activeProjects(state).some((project) => project.id === projectId))) return result(false, 'Escolha uma pessoa, um projeto ativo e entrega ou qualidade.');
  person.assignment = projectId;
  person.assignmentRole = role;
  addLog(state, `${person.name} foi alocado em ${role === 'quality' ? 'qualidade' : 'entrega'}${projectId === 'auto' ? ' automática' : ` de ${state.projects.find((project) => project.id === projectId).title}`}.`);
  return result(true, 'Alocação atualizada. O trabalho, a qualidade e o estresse serão calculados no próximo dia.');
}

export function setProjectPriority(state, projectId = null) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (projectId !== null && projectId !== 'auto' && !activeProjects(state).some((project) => project.id === projectId)) return result(false, 'Escolha um projeto ativo.');
  state.focusProjectId = projectId === 'auto' ? null : projectId;
  return result(true, state.focusProjectId ? 'O fundador vai concentrar suas horas de entrega neste projeto.' : 'O fundador volta a priorizar os prazos mais próximos.');
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
  const minimum = Math.ceil(consumedHours(state, key) - 0.00000001);
  if (hours < minimum) return result(false, 'Essas horas já foram usadas hoje. Ajuste a rotina após avançar o dia.');
  const delta = hours - state.allocation[key];
  const priorities = ['delivery', 'sales', 'quality'].filter((area) => area !== key);
  const allocation = { ...state.allocation, [key]: hours };
  if (delta > 0) {
    let remaining = delta;
    for (const area of priorities) {
      const consumed = Math.ceil(consumedHours(state, area) - 0.00000001);
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

const EVENT_TYPES = {
  scope: {
    title: 'Só mais uma funcionalidade…', description: 'O cliente pediu uma função fora do escopo. Enquanto a decisão não chega, o time perde foco.',
    options: [
      { id: 'renegotiate', label: 'Negociar um aditivo', description: 'Usa 1h de vendas. Acrescenta escopo, 20% ao preço e três dias ao prazo.', cost: 0, hours: 1, area: 'sales' },
      { id: 'absorb', label: 'Absorver o pedido', description: 'Mais 20% de trabalho sem cobrar nem ampliar o prazo. O cliente aprecia o gesto.', cost: 0, hours: 0, area: 'none' },
      { id: 'decline', label: 'Manter o contrato', description: 'Preserva escopo e prazo, mas reduz a reputação em 2.', cost: 0, hours: 0, area: 'none' },
    ],
  },
  blocker: {
    title: 'Acesso ainda não chegou', description: 'Sem a credencial do cliente, a entrega fica muito mais lenta. A folha continua correndo.',
    options: [
      { id: 'call', label: 'Ligar para o cliente', description: 'Usa 1h de vendas para destravar o acesso hoje.', cost: 0, hours: 1, area: 'sales' },
      { id: 'alternative', label: 'Criar uma alternativa', description: 'Usa 1h de entrega e R$ 250 para trabalhar com um ambiente temporário.', cost: 250, hours: 1, area: 'delivery' },
      { id: 'wait', label: 'Aguardar o acesso', description: 'Sem custo imediato. O projeto fica bloqueado por dois dias.', cost: 0, hours: 0, area: 'none' },
    ],
  },
  bug: {
    title: 'Um bug apareceu na revisão', description: 'Uma falha na versão de teste reduz a velocidade e a qualidade até o time decidir como corrigir.',
    options: [
      { id: 'fix', label: 'Corrigir a causa', description: 'Usa 2h de qualidade. Melhora a entrega e remove 8 de dívida técnica.', cost: 0, hours: 2, area: 'quality' },
      { id: 'patch', label: 'Aplicar um remendo', description: 'Usa 1h de entrega. Resolve a trava, mas soma 10 de dívida e perde 5 de qualidade.', cost: 0, hours: 1, area: 'delivery' },
      { id: 'explain', label: 'Documentar a limitação', description: 'Sem custo imediato. O cliente aceita com perda de reputação e qualidade.', cost: 0, hours: 0, area: 'none' },
    ],
  },
};

function scheduleProjectEvent(state) {
  if (state.pendingEvents.length) return;
  const project = activeProjects(state).find((item) => !item.eventTriggered && item.progress / item.hours >= 0.3);
  if (!project) return;
  const hash = [...project.id].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const type = ['scope', 'blocker', 'bug'][hash % 3];
  const definition = EVENT_TYPES[type];
  project.eventTriggered = true;
  state.pendingEvents.push({ id: `${project.id}-event`, projectId: project.id, type, title: definition.title, description: definition.description, createdDay: state.day, options: definition.options.map((option) => ({ ...option })) });
  addLog(state, `${project.client}: ${definition.title} Decida como o time deve reagir na área de projetos.`);
}

export function resolveProjectEvent(state, eventId, choice) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const event = state.pendingEvents.find((item) => item.id === eventId);
  const project = event && activeProjects(state).find((item) => item.id === event.projectId);
  const option = event && EVENT_TYPES[event.type].options.find((item) => item.id === choice);
  if (!project || !option) return result(false, 'Esse evento ou essa decisão não está disponível.');
  if (option.cost > 0 && state.cash < option.cost) return result(false, 'O caixa não cobre essa decisão.');
  if (option.hours > 0 && !spendHours(state, option.area, option.hours)) return result(false, `A decisão precisa de ${option.hours}h livres de ${option.area === 'sales' ? 'vendas' : option.area === 'quality' ? 'qualidade' : 'entrega'} em um dia útil.`);
  if (option.cost) recordMoney(state, -option.cost, `Imprevisto: ${project.client}`);
  if (event.type === 'scope') {
    if (choice === 'renegotiate' || choice === 'absorb') project.hours = round(project.hours * 1.2);
    if (choice === 'renegotiate') {
      project.price = Math.round(project.price * 1.2);
      project.deadline += 3;
    } else if (choice === 'absorb') state.reputation = clamp(state.reputation + 1, 0, 100);
    else state.reputation = clamp(state.reputation - 2, 0, 100);
  } else if (event.type === 'blocker') {
    if (choice === 'wait') project.blockedUntil = state.day + 2;
    if (choice === 'alternative') project.quality = Math.max(0, project.quality - 1);
  } else if (choice === 'fix') {
    state.debt = Math.max(0, state.debt - 8);
    project.quality = clamp(project.quality + 5, 0, 100);
  } else if (choice === 'patch') {
    state.debt = clamp(state.debt + 10, 0, 100);
    project.quality = Math.max(0, project.quality - 5);
  } else {
    state.reputation = Math.max(0, state.reputation - 2);
    project.quality = Math.max(0, project.quality - 3);
  }
  state.pendingEvents = state.pendingEvents.filter((item) => item.id !== eventId);
  updatePhase(project);
  addLog(state, `${project.client}: ${option.label.toLowerCase()}. ${option.description}`);
  return result(true, `${option.label}. A consequência já está no contrato e no orçamento de hoje.`);
}

function receivePayment(state, receivable) {
  recordMoney(state, receivable.amount, `Pagamento: ${receivable.client}`);
  state.stats.revenue = round(state.stats.revenue + receivable.amount);
  const project = state.projects.find((item) => item.id === receivable.projectId);
  if (project) project.paid = true;
  state.receivables = state.receivables.filter((item) => item.projectId !== receivable.projectId);
  addLog(state, `${receivable.client} pagou R$ ${receivable.amount}. O dinheiro entrou no caixa.`);
}

export function collectReceivable(state, projectId) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const receivable = state.receivables.find((item) => item.projectId === projectId);
  if (!receivable) return result(false, 'Não há recebimento pendente para esse projeto.');
  if (state.day < receivable.dueDay) return result(false, 'O prazo de pagamento ainda não venceu.');
  if (receivable.followupCount >= 1) return result(false, 'Essa cobrança já foi feita. O próximo pagamento segue a previsão atualizada.');
  receivable.followupCount = 1;
  if (receivable.paymentDay <= state.day || state.day > receivable.dueDay) {
    receivePayment(state, receivable);
    return result(true, `Cobrança concluída: R$ ${receivable.amount} entraram no caixa.`, { amount: receivable.amount });
  }
  receivable.paymentDay = Math.min(receivable.paymentDay, state.day + 1);
  addLog(state, `Cobrança enviada a ${receivable.client}. Previsão antecipada para o dia ${receivable.paymentDay}.`);
  return result(true, `O cliente confirmou pagamento para o dia ${receivable.paymentDay}.`);
}

export function investProduct(state, focus = 'prototype') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (state.stats.delivered < 2) return result(false, 'Entregue dois projetos para usar a experiência no seu próprio produto.');
  if (!['prototype', 'research'].includes(focus)) return result(false, 'Escolha protótipo ou pesquisa.');
  if (state.product.stage === 'launched') return result(false, 'Seu MVP já foi lançado e tem receita recorrente.');
  if (state.dailyActions.product >= 1) return result(false, 'Você já investiu no produto hoje. Preserve tempo para os clientes.');
  if (focus === 'prototype' && state.product.progress >= 100) return result(false, 'O protótipo está pronto. Faça duas pesquisas de mercado para lançar.');
  if (focus === 'research' && state.product.research >= 100) return result(false, 'A pesquisa já está completa.');
  const cost = focus === 'prototype' ? 300 : 150;
  const area = focus === 'prototype' ? 'delivery' : 'quality';
  const hours = focus === 'prototype' ? 2 : 1;
  if (state.cash < cost) return result(false, `Reserve R$ ${cost} para esse investimento.`);
  if (!spendHours(state, area, hours)) return result(false, `O investimento precisa de ${hours}h livres de ${area === 'delivery' ? 'entrega' : 'qualidade'} em um dia útil.`);
  recordMoney(state, -cost, focus === 'prototype' ? 'Produto: protótipo' : 'Produto: pesquisa de mercado');
  state.product.unlocked = true;
  state.product.stage = 'prototype';
  if (focus === 'prototype') state.product.progress = clamp(state.product.progress + 10, 0, 100);
  else state.product.research += 1;
  state.dailyActions.product += 1;
  if (state.product.progress >= 100 && state.product.research >= 2) {
    state.product.stage = 'launched';
    state.product.users = 20 + state.product.research * 5;
    state.product.mrr = 1200 + state.product.research * 100;
    state.product.nextPaymentDay = state.day + 28;
    addLog(state, `Seu MVP foi lançado! ${state.product.users} usuários e R$ ${state.product.mrr} de receita mensal recorrente prevista.`);
    return result(true, `MVP lançado: MRR de R$ ${state.product.mrr}. Primeiro recebimento no dia ${state.product.nextPaymentDay}.`);
  }
  addLog(state, `Produto próprio: ${state.product.progress}% de protótipo e ${state.product.research} pesquisa${state.product.research === 1 ? '' : 's'} com clientes.`);
  return result(true, 'Investimento realizado. Essas horas foram retiradas do trabalho disponível para os contratos.');
}

export function recordTravel(state, distance) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) return result(false, 'Distância inválida.');
  if (!isWeekday(state.day)) return result(true, 'Passeio de fim de semana: sem consumir horas de entrega.', { hours: 0 });
  const hours = Math.min(Math.max(0, 0.75 - state.travelHours), availableHours(state, 'delivery'), distance / 1400);
  state.travelHours = Math.round((state.travelHours + hours) * 1000000) / 1000000;
  state.actionHours = Math.round((state.actionHours + hours) * 1000000) / 1000000;
  return result(true, 'O deslocamento reduz o tempo restante do fundador para entregar hoje.', { hours });
}

export function takeLoan(state) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (state.loan.taken) return result(false, 'A linha de crédito inicial de R$ 2.000 já foi usada.');
  state.loan.taken = true;
  state.loan.balance = 2000;
  state.loan.nextInterestDay = state.day + 28;
  recordMoney(state, 2000, 'Empréstimo inicial');
  addLog(state, 'Crédito de R$ 2.000 liberado. O saldo da dívida cresce 2% a cada 28 dias até a quitação.');
  return result(true, 'R$ 2.000 entraram no caixa. Os juros são de 2% a cada 28 dias.');
}

export function repayLoan(state, amount = state?.loan?.balance) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > state.loan.balance) return result(false, 'Escolha um valor positivo até o saldo da dívida.');
  if (state.cash < amount) return result(false, 'O caixa não cobre esse pagamento.');
  recordMoney(state, -amount, 'Amortização do empréstimo');
  state.loan.balance = round(state.loan.balance - amount);
  return result(true, state.loan.balance === 0 ? 'Empréstimo quitado.' : `Pagamento realizado. Saldo devedor: R$ ${state.loan.balance.toFixed(2)}.`);
}

function completeProject(state, project) {
  if (project.status !== 'active' || project.progress < project.hours) return null;
  const lateDays = Math.max(0, state.day - project.deadline);
  project.progress = project.hours;
  project.status = 'delivered';
  updatePhase(project);
  project.completedDay = state.day;
  project.quality = round(clamp(project.quality - lateDays * 3, 0, 100));
  const priceFactor = (lateDays > 0 ? 0.9 : 1) * (project.quality < 55 ? 0.85 : 1);
  project.invoiceAmount = Math.round(project.price * priceFactor);
  project.dueDay = state.day + project.paymentDays;
  state.receivables.push({ projectId: project.id, client: project.client, amount: project.invoiceAmount, dueDay: project.dueDay, paymentDay: project.dueDay + (project.pricing === 'premium' ? 2 : 0), followupCount: 0 });
  state.pendingEvents = state.pendingEvents.filter((event) => event.projectId !== project.id);
  const reputationGain = (project.quality >= 80 ? 3 : project.quality >= 65 ? 2 : project.quality >= 50 ? 0 : -3) - (lateDays > 0 ? 2 : 0);
  state.reputation = clamp(state.reputation + reputationGain, 0, 100);
  state.stats.delivered += 1;
  if (state.stats.delivered >= 2 && !state.product.unlocked) {
    state.product.unlocked = true;
    state.product.stage = 'prototype';
    addLog(state, 'Dois projetos entregues. Agora sua experiência pode virar um produto próprio na bancada de produto.');
  }
  addLog(state, `${project.title} entregue com qualidade ${Math.round(project.quality)}%. R$ ${project.invoiceAmount} previstos para o dia ${project.dueDay}.${lateDays ? ' O atraso reduziu o pagamento.' : ''}`);
  return project;
}

function applyWork(state, project, hours) {
  if (!project || project.status !== 'active' || hours <= 0) return 0;
  if (project.blockedUntil > state.day) return 0;
  const mode = MODES[project.mode];
  const energyFactor = 0.55 + state.energy / 100 * 0.45;
  const debtFactor = Math.max(0.55, 1 - state.debt / 160);
  const furnitureFactor = hasFurniture(state, 'monitors') ? 1.1 : 1;
  const traitFactor = state.profile.trait === 'technical' ? 1.05 : 1;
  const event = state.pendingEvents.find((item) => item.projectId === project.id);
  const eventFactor = event?.type === 'blocker' ? 0.15 : event?.type === 'bug' ? 0.65 : event ? 0.8 : 1;
  const output = Math.min(project.hours - project.progress, hours * mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor * eventFactor);
  project.progress = round(Math.min(project.hours, project.progress + output));
  project.quality = round(clamp(project.quality + output * (mode.quality - (event?.type === 'bug' ? 0.2 : 0)), 0, 100));
  state.debt = round(clamp(state.debt + output * mode.debt, 0, 100));
  // Only count the time actually needed to finish; remaining capacity can serve another client.
  const usedHours = output / (mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor * eventFactor);
  state.stats.hoursWorked = round(state.stats.hoursWorked + usedHours);
  updatePhase(project);
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
      : activeProjects(state).find((item) => item.id === state.focusProjectId) || activeProjects(state).sort((a, b) => a.deadline - b.deadline)[0];
    if (!project) return result(false, 'Aceite um projeto antes de trabalhar.');
    if (project.blockedUntil > state.day) return result(false, `Esse projeto aguarda o acesso do cliente até o dia ${project.blockedUntil}. Trabalhe em outro contrato enquanto isso.`);
    const hours = Math.min(2 - state.dailyActions.workHours, availableHours(state, 'delivery'));
    if (hours <= 0) return result(false, 'Seu bloco de trabalho manual já foi usado. Avance o dia para continuar.');
    if (state.energy < 10) return result(false, 'Sua energia está muito baixa. Faça uma pausa antes de trabalhar.');
    applyWork(state, project, hours);
    spendHours(state, 'delivery', hours);
    state.dailyActions.workHours = Math.round((state.dailyActions.workHours + hours) * 1000000) / 1000000;
    state.dailyActions.work += 1;
    return result(true, `${hours}h dedicadas a ${project.title}. Essas horas fazem parte da rotina de hoje.`);
  }
  if (type === 'review') {
    if (state.dailyActions.review >= 1) return result(false, 'Você já revisou o código hoje.');
    if (availableHours(state, 'quality') < 1) return result(false, 'Reserve uma hora para qualidade antes de revisar.');
    if (state.debt <= 0 && activeProjects(state).length === 0) return result(false, 'Ainda não há código para revisar.');
    state.debt = round(Math.max(0, state.debt - 6));
    activeProjects(state).forEach((project) => { project.quality = round(clamp(project.quality + 3, 0, 100)); });
    spendHours(state, 'quality', 1);
    state.dailyActions.review += 1;
    return result(true, 'Código revisado: menos dívida técnica e mais qualidade. Uma hora da rotina foi usada.');
  }
  return result(false, 'Ação desconhecida.');
}

export function advanceDay(state) {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  const day = state.day;
  const weekday = isWeekday(day);
  const summary = { day, hoursWorked: 0, projectsDelivered: 0, revenue: 0, costs: 0, energy: state.energy, weekend: !weekday, travelHours: state.travelHours, productRevenue: 0 };
  for (const receivable of state.receivables.filter((item) => item.paymentDay <= day)) {
    summary.revenue = round(summary.revenue + receivable.amount);
    receivePayment(state, receivable);
  }
  state.receivables.filter((item) => item.dueDay === day && item.paymentDay > day).forEach((receivable) => addLog(state, `${receivable.client} atrasou o pagamento. Nova previsão: dia ${receivable.paymentDay}. A cobrança está disponível no financeiro.`));
  let productSupport = 0;
  if (state.product.stage === 'launched' && state.product.nextPaymentDay <= day) {
    recordMoney(state, state.product.mrr, 'Produto: receita recorrente');
    state.stats.revenue = round(state.stats.revenue + state.product.mrr);
    summary.productRevenue = state.product.mrr;
    summary.revenue = round(summary.revenue + state.product.mrr);
    productSupport = 100;
    recordMoney(state, -productSupport, 'Produto: infraestrutura e suporte');
    state.product.nextPaymentDay = day + 28;
    addLog(state, `Seu produto recebeu R$ ${state.product.mrr} de assinaturas. R$ 100 foram usados em infraestrutura e suporte.`);
  }
  if (state.loan.balance > 0 && state.loan.nextInterestDay <= day) {
    const interest = round(state.loan.balance * state.loan.interest);
    state.loan.balance = round(state.loan.balance + interest);
    state.loan.nextInterestDay = day + 28;
    addLog(state, `R$ ${interest.toFixed(2)} de juros foram incorporados ao empréstimo. Saldo: R$ ${state.loan.balance.toFixed(2)}.`);
  }

  const beforeWorked = state.stats.hoursWorked;
  const beforeDelivered = state.stats.delivered;
  if (weekday) {
    const projects = activeProjects(state).sort((a, b) => a.deadline - b.deadline);
    const qualityHours = availableHours(state, 'quality');
    const qualityBoost = hasFurniture(state, 'whiteboard') ? 4 : 3;
    projects.forEach((project) => {
      project.quality = round(clamp(project.quality + qualityHours * qualityBoost / projects.length, 0, 100));
    });
    state.debt = round(Math.max(0, state.debt - qualityHours * 2.5));
    const founderHours = availableHours(state, 'delivery');
    const focused = projects.find((project) => project.id === state.focusProjectId);
    let hours = founderHours;
    for (const project of focused ? [focused] : projects) {
      if (hours <= 0) break;
      hours = Math.max(0, hours - applyWork(state, project, hours));
    }
    for (const person of state.employees) {
      const availableProjects = activeProjects(state).sort((a, b) => a.deadline - b.deadline);
      const target = person.assignment === 'auto' ? availableProjects[0] : availableProjects.find((project) => project.id === person.assignment);
      if (!target || target.blockedUntil > day) {
        person.stress = clamp(person.stress - 6, 0, 100);
        person.morale = clamp(person.morale + 2, 0, 100);
        continue;
      }
      const capacity = person.productivity * (0.7 + person.morale / 100 * 0.3) * (1 - person.stress / 100 * 0.25);
      if (person.assignmentRole === 'quality') {
        target.quality = round(clamp(target.quality + capacity * 1.5, 0, 100));
        state.debt = round(Math.max(0, state.debt - capacity));
      } else applyWork(state, target, capacity);
      const pressure = target.mode === 'fast' ? 7 : target.mode === 'careful' ? 1 : 3;
      person.stress = round(clamp(person.stress + pressure + (target.deadline - day <= 2 ? 4 : 0) + (state.pendingEvents.some((event) => event.projectId === target.id) ? 3 : 0) - (hasFurniture(state, 'lounge') ? 2 : 0), 0, 100));
      person.morale = round(clamp(person.morale + (target.mode === 'careful' ? 1 : 0) - person.stress / 35, 0, 100));
    }
    const salesHours = availableHours(state, 'sales');
    state.salesProgress += salesHours * (state.profile.trait === 'commercial' ? 1.05 : 1);
    while (state.salesProgress >= 8 && state.leads.length < MAX_LEADS) {
      addLead(state);
      state.salesProgress -= 8;
    }
    state.salesProgress = Math.min(16, state.salesProgress);
    const energySpent = founderHours * 2.5 + salesHours + qualityHours * 1.5;
    const recovery = hasFurniture(state, 'lounge') ? 13 : 8;
    state.energy = round(clamp(state.energy - energySpent + recovery, 0, 100));
    scheduleProjectEvent(state);
  } else {
    state.energy = clamp(state.energy + 25, 0, 100);
    state.employees.forEach((person) => {
      person.stress = clamp(person.stress - 12, 0, 100);
      person.morale = clamp(person.morale + 4, 0, 100);
    });
  }

  const payroll = weekday ? state.employees.reduce((total, person) => total + person.salary / 20 * (person.contract === 'CLT' ? 1.7 : 1.15), 0) : 0;
  recordMoney(state, -110, 'Aluguel, internet e custos fixos');
  if (payroll > 0) recordMoney(state, -payroll, 'Salários e contratos');
  summary.costs = round(110 + payroll + productSupport);
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
  state.travelHours = 0;
  state.dailyActions = { coffee: 0, rest: 0, work: 0, workHours: 0, review: 0, prospect: 0, product: 0 };
  const message = state.bankrupt
    ? 'Após 60 dias seguidos no vermelho, a empresa encerrou as atividades.'
    : `Dia ${day} encerrado: ${summary.hoursWorked.toFixed(1)}h de entrega, R$ ${summary.costs.toFixed(0)} de custos${summary.revenue ? ` e R$ ${summary.revenue.toFixed(0)} recebidos` : ''}.`;
  return result(true, message, { summary });
}
