import { createOfficeLayout } from './office-layouts.js';
import { validPlacement } from './office-placement.js';
import { validateFloorPlan } from './office-navigation.js';
import { createOffice, validOffice, getOfficeOverview, getRoomEffects, getComputerMultiplier, getItemEligibility, getExpansionEligibility, getRoomEligibility, getComputerEligibility, getRoomActionEligibility } from './office-progression.js';
import { WORK_PUZZLE_COUNT, createWorkPuzzles, validWorkSession } from './work-puzzles.js';
import { isLocalTestState } from './local-test.js';
import { createFinance, ensureFinance, validFinance, noteFinanceMovement, noteFinanceRevenue, noteFinanceExpense, closeFinancePeriod, getPayroll, getCreditOverview, getReceivableAction, getReceivableRisk, receivableDefaults, FINANCE_CYCLE } from './finance-model.js';
import { MANAGER_PROFILES, managerProfile, managerId, createManagement, validManagement, activeManager, managerQueue } from './management.js';
export { MANAGER_PROFILES, managerQueue } from './management.js';
export { OFFICE_STAGES, ROOM_LEVELS, OFFICE_SECTORS, SHOP_ITEMS, COMPUTER_LEVELS, ROOM_ACTIONS, getOfficeOverview, getRoomEffects, getComputerMultiplier, getItemEligibility, getExpansionEligibility, getRoomEligibility, getComputerEligibility, getRoomActionEligibility } from './office-progression.js';

const SAVE_KEY = 'joguinho-save-v1';
const SAVE_VERSION = 3;
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
  { id: 'desk', name: 'Posto completo', price: 1500, description: 'Uma mesa com cadeira e computador básico para trazer uma pessoa para o time, respeitando o espaço disponível.' },
  { id: 'monitors', name: 'Computadores profissionais', price: 1800, description: 'Leva os computadores dos postos atuais ao nível profissional: 15% mais produtividade e manutenção mensal maior.' },
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
  noteFinanceMovement(state, amount, label);
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
    management: createManagement(),
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
    workSession: null,
  };
  state.office = createOffice(state);
  state.finance = createFinance(state);
  LEADS.slice(0, 3).forEach((lead) => state.leads.push(leadFromTemplate(state, lead)));
  return state;
}

export function saveGame(state, storageKey = SAVE_KEY) {
  try {
    if (typeof localStorage === 'undefined') return result(false, 'O salvamento não está disponível neste ambiente.');
    if (!validSave(state)) return result(false, 'O estado atual não pôde ser validado. Seu último salvamento foi preservado.');
    localStorage.setItem(storageKey, JSON.stringify({ version: SAVE_VERSION, state }));
    return result(true, 'Jogo salvo neste navegador.');
  } catch {
    return result(false, 'Não foi possível salvar. Verifique o espaço disponível no navegador.');
  }
}

// Validate the nested fields used by the simulation before trusting persisted data.
function validSave(state, legacy = false, previousVersion = null) {
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const string = (value) => typeof value === 'string';
  const bounded = (value, min, max) => finite(value) && value >= min && value <= max;
  const entries = (value, validate) => Array.isArray(value) && value.length <= 1000 && value.every(validate);
  if (!state || state.version !== (legacy ? 1 : previousVersion || SAVE_VERSION) || !state.profile || !state.allocation || !state.stats || !state.dailyActions) return false;
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
  if (previousVersion === 2) return true;
  if (!validOffice(state) || !validFinance(state.finance) || !validManagement(state.management)) return false;
  if (!state.receivables.every(r => (r.status === undefined || ['pending', 'renegotiated', 'defaulted'].includes(r.status)) && (r.riskScore === undefined || bounded(r.riskScore, 0, 100)) && (r.renegotiated === undefined || typeof r.renegotiated === 'boolean'))) return false;
  if (!validWorkSession(state)) return false;
  if (!state.employees.every((person) => person.onboardingUntil === undefined || (Number.isInteger(person.onboardingUntil) && bounded(person.onboardingUntil, 0, 100000000)))) return false;
  if (!state.leads.every((lead) => lead.negotiation === undefined || lead.negotiation === null || (lead.negotiation && Number.isInteger(lead.negotiation.day) && lead.negotiation.day > 0 && Object.hasOwn(PRICING, lead.negotiation.pricing) && bounded(lead.negotiation.chance, 0, 1) && bounded(lead.negotiation.roll, 0, 99) && lead.negotiation.closed === false))) return false;
  return true;
}

function migrateSave(state) {
  state.version = 2;
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

export function loadGame(storageKey = SAVE_KEY) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || ![1, 2, SAVE_VERSION].includes(saved.version)) return null;
    if (saved.version === 1) {
      if (!validSave(saved.state, true)) return null;
      saved.state = migrateSave(saved.state);
    } else if (!validSave(saved.state, false, saved.version === 2 ? 2 : null)) return null;
    if (saved.version < SAVE_VERSION) {
      saved.state.office = createOffice(saved.state, true);
      saved.state.version = SAVE_VERSION;
      if (!validSave(saved.state)) return null;
    }
    // Retire the previous vertical-expansion experiment without losing company assets.
    const building=saved.state.office?.building;
    if(building){
      const refund=building.version===1&&Number.isInteger(building.floors)&&building.floors>=1&&building.floors<=3 ? (building.floors>=2?14000:0)+(building.floors>=3?22000:0)+(building.elevator===true?6000:0) : 0;
      if(refund){recordMoney(saved.state,refund,'Prédio: devolução das expansões descontinuadas');addLog(saved.state,'O escritório voltou a um único mapa. Os andares e o elevador foram reembolsados; equipe e móveis foram preservados.');}
      delete saved.state.office.building;saved.state.officePosition={x:0,y:0};
    }
    // Never start advancing a restored company before the player presses play.
    if (saved.state.workSession === undefined) saved.state.workSession = null;
    if (saved.state.management === undefined) saved.state.management = createManagement();
    reconcileManagement(saved.state);
    saved.state.paused = true;
    ensureFinance(saved.state);
    return saved.state;
  } catch {
    return null;
  }
}

export function acceptProject(state, leadId) {
  return negotiateProject(state, leadId, 'standard');
}

export function getNegotiationChance(state, leadId, pricing = 'standard') {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead || !Object.hasOwn(PRICING, pricing)) return 0;
  return clamp(({ discount: 0.94, standard: 0.84, premium: 0.76 })[pricing]
    + Math.min(0.1, state.reputation * 0.001) + (lead.discovered ? 0.08 : 0)
    + (state.profile.trait === 'commercial' ? 0.03 : 0) + getRoomEffects(state).salesChanceBonus
    + (state.office.bonuses.presentationUntil >= state.day ? 0.08 : 0), 0, 0.99);
}

export function negotiateProject(state, leadId, pricing = 'standard') {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return result(false, 'Essa oportunidade já não está disponível.');
  if (!Object.hasOwn(PRICING, pricing)) return result(false, 'Escolha desconto, padrão ou premium.');
  if (lead.negotiation) return result(false, 'Este cliente já recusou a proposta. Outros contatos terão uma nova negociação.');
  if (pricing === 'premium' && state.reputation < 25 && !lead.discovered) return result(false, 'Faça a descoberta do escopo ou alcance 25 de reputação para justificar um contrato premium.');
  if (activeProjects(state).length >= 3) return result(false, 'Você já tem três projetos ativos. Entregue um antes de assumir outro.');
  const chance = getNegotiationChance(state, leadId, pricing);
  const roll = [...lead.id].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 100;
  state.office.salesActivityHours = Math.min(8, state.office.salesActivityHours + 0.5);
  if (roll / 100 >= chance) {
    lead.negotiation = { day: state.day, pricing, chance, roll, closed: false };
    addLog(state, `${lead.client} recusou a proposta ${pricing === 'premium' ? 'premium' : pricing === 'discount' ? 'com desconto' : 'padrão'}. A chance era de ${Math.round(chance * 100)}%.`);
    return result(false, `${lead.client} recusou a proposta (${Math.round(chance * 100)}% de chance). Melhore o comercial e a apresentação para os próximos contatos.`, { negotiated: true, chance });
  }
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
  if (lead.negotiation) return result(false, 'Este contato já encerrou a negociação.');
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
  const interview = { day: state.day, candidateId, score: Math.round(clamp(65 + candidate.productivity * 3 + getRoomEffects(state).candidateScoreBonus, 0, 100)), strength: candidate.trait, risk: candidateId === 'bia' ? 'Um salário maior exige um pipeline constante.' : candidateId === 'marina' ? 'Entrega menos horas de código, mas ajuda a validar a experiência.' : 'Precisará de revisões para crescer com segurança.' };
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
  if (!state.interviews[candidateId] && !isLocalTestState(state)) return result(false, 'Entreviste essa pessoa no RH antes de contratar.');
  const workstation = state.office.workstations.find((post) => post.employeeId === null && post.desk && post.chair && post.computerLevel > 0);
  if (!workstation) return result(false, 'Não há posto livre com mesa, cadeira e computador. Complete um posto na loja antes de contratar.');
  const dailyCost = round(candidate.salary / 20 * (contract === 'CLT' ? 1.7 : 1.15));
  if (state.cash < dailyCost * 5 + 550) return result(false, 'Reserve caixa para pelo menos cinco dias de trabalho antes de contratar.');
  const selectionBonus = Math.max(0, (state.interviews[candidateId]?.score ?? 0) - Math.round(65 + candidate.productivity * 3)) / 100;
  state.employees.push({ ...candidate, productivity: round(candidate.productivity * (1 + selectionBonus)), contract, hiredDay: state.day, assignment: 'auto', assignmentRole: 'delivery', morale: 75, stress: 15 });
  workstation.employeeId = candidateId;
  addLog(state, `${candidate.name} entrou para o time com contrato ${contract}. Custo por dia útil: R$ ${dailyCost.toFixed(2)}.`);
  return result(true, `${candidate.name} já pode começar. O salário é descontado a cada dia útil.`);
}

export function hireManager(state, area, contract = 'CLT') {
  const profile = managerProfile(area);
  if (!running(state) || !profile) return result(false, 'Gerente indisponível.');
  if (!state.office.special.ceo) return result(false, 'Construa a sala do CEO antes de trazer gerentes. É lá que as decisões chegam até você.');
  if (activeManager(state, area)) return result(false, `${profile.name} já lidera essa área.`);
  if (!['PJ', 'CLT'].includes(contract)) return result(false, 'Escolha um contrato PJ ou CLT.');
  const post = state.office.workstations.find((item) => item.employeeId === null && item.desk && item.chair && item.computerLevel > 0);
  if (!post) return result(false, 'Prepare um posto livre com mesa, cadeira e computador para o gerente.');
  const dailyCost = round(profile.salary * (contract === 'CLT' ? 1.7 : 1.15) / 20);
  if (state.cash < dailyCost * 5 + 550) return result(false, 'Reserve caixa para cinco dias de custos do gerente antes de contratar.');
  const person = { ...profile, id: managerId(area), contract, hiredDay: state.day };
  state.management.managers.push(person);
  post.employeeId = person.id;
  addLog(state, `${profile.name} assumiu ${profile.role.toLowerCase()}. Custo por dia útil: R$ ${dailyCost.toFixed(2)}.`);
  return result(true, `${profile.name} começou a organizar ${profile.role.toLowerCase()}. O custo entra na folha a cada dia útil.`);
}

function queueManager(state, area, kind, title, detail, ref = '') {
  if (!activeManager(state, area) || state.management.requests.some((item) => item.area === area)) return null;
  if (managerSnoozed(state, area, kind, ref)) return null;
  const request = { id: state.management.nextRequestId++, area, kind, title, detail, ref: String(ref), day: state.day };
  state.management.requests.push(request);
  addLog(state, `${managerProfile(area).name} pediu uma conversa na sala do CEO: ${title}.`);
  return request;
}

function managerSnoozed(state, area, kind, ref = '') {
  const paused = state.management?.snoozed?.[area];
  return paused?.kind === kind && paused?.ref === String(ref) && paused.untilDay >= state.day;
}

export function reconcileManagement(state) {
  if (!state.management) return;
  state.management.requests = state.management.requests.filter((request) => {
    if (request.kind === 'sales-contract') return state.leads.some((lead) => lead.id === request.ref && !lead.negotiation);
    if (request.kind === 'delivery-mode') return activeProjects(state).some((project) => project.id === request.ref && project.mode === 'fast');
    if (request.kind === 'project-event') return state.pendingEvents.some((event) => event.id === request.ref);
    if (request.kind === 'finance-collect') return state.receivables.some((item) => item.projectId === request.ref && item.status !== 'defaulted');
    if (request.kind === 'hr-hire') return !state.employees.some((person) => person.id === request.ref);
    return true;
  });
}

export function getManagerReport(state, area) {
  if (!activeManager(state, area)) return null;
  if (area === 'sales') return `Pipeline: ${state.leads.length} contatos; ${activeProjects(state).length}/3 contratos em execução. ${state.leads.filter((lead) => lead.discovered && !lead.negotiation).length} escopos já qualificados. Reputação: ${Math.round(state.reputation)}/100.`;
  if (area === 'development') return `${activeProjects(state).length} projetos ativos; dívida técnica ${Math.round(state.debt)}%. ${state.employees.filter((person) => person.assignmentRole === 'quality').length} pessoa(s) em revisão. ${state.pendingEvents.length} imprevisto(s) por resolver. Próximo prazo: ${activeProjects(state).sort((a, b) => a.deadline - b.deadline)[0]?.deadline ?? 'nenhum'}.`;
  if (area === 'finance') {
    const daily = getOfficeOverview(state).dailyRent + getPayroll(state).total / 20 + getOfficeOverview(state).monthlyMaintenance / 28;
    return `Caixa: R$ ${Math.round(state.cash)}. Fôlego estimado: ${Math.max(0, Math.floor(state.cash / Math.max(1, daily)))} dias. A receber: R$ ${Math.round(state.receivables.reduce((sum, item) => sum + item.amount, 0))}. Dívida: R$ ${Math.round(state.loan.balance)}.`;
  }
  return `Equipe: ${state.employees.length} profissionais e ${state.management.managers.length} gerentes. Postos livres: ${getOfficeOverview(state).freePosts}. Moral média: ${state.employees.length ? Math.round(state.employees.reduce((sum, person) => sum + person.morale, 0) / state.employees.length) : 0}%. Candidatos ainda disponíveis: ${CANDIDATES.filter((candidate) => !state.employees.some((person) => person.id === candidate.id)).length}.`;
}

export function callManager(state, area) {
  if (!state.office.special.ceo || !activeManager(state, area)) return result(false, 'Esse gerente não está disponível na sala do CEO.');
  const pending = state.management.requests.find((item) => item.area === area);
  if (pending) return result(false, `${managerProfile(area).name} já está aguardando para conversar.`);
  const request = queueManager(state, area, 'consult', 'Relatório da área', 'Trouxe os números atuais do setor para sua análise.');
  return result(true, `${managerProfile(area).name} está vindo à sala do CEO.`, { request });
}

export function respondManager(state, requestId, choice) {
  if (!running(state) || !state.office.special.ceo) return result(false, 'Entre na sala do CEO para responder.');
  const request = managerQueue(state)[0];
  if (!request || request.id !== requestId) return result(false, 'Converse primeiro com o gerente que entrou na sala.');
  const projectEvent = request.kind === 'project-event' ? state.pendingEvents.find((event) => event.id === request.ref) : null;
  if (request.kind === 'project-event' ? !projectEvent?.options.some((option) => option.id === choice) : !['approve', 'decline'].includes(choice)) return result(false, 'Escolha uma decisão disponível.');
  let outcome = result(true, 'Decisão registrada.');
  if (projectEvent) outcome = resolveProjectEvent(state, projectEvent.id, choice, { managed: true });
  else if (choice === 'approve') {
    if (request.kind === 'sales-contract') outcome = negotiateProject(state, request.ref, 'standard');
    else if (request.kind === 'delivery-mode') outcome = setProjectMode(state, request.ref, 'careful');
    else if (request.kind === 'finance-credit') outcome = takeLoan(state, Math.min(2000, getCreditOverview(state).available));
    else if (request.kind === 'finance-collect') {
      const receivable = state.receivables.find((item) => item.projectId === request.ref);
      if (!receivable || receivable.dueDay >= state.day) outcome = result(false, 'A cobrança já foi resolvida ou ainda não venceu.');
      else { receivable.followupCount = 1; receivable.paymentDay = Math.min(receivable.paymentDay, state.day + 1); addLog(state, `${managerProfile('finance').name} fez a cobrança cordial de ${receivable.client}.`); outcome = result(true, 'Cobrança feita sem usar as horas do fundador. O cliente recebeu um lembrete.'); }
    } else if (request.kind === 'hr-hire') outcome = hireEmployee(state, request.ref, 'CLT');
  }
  if (!outcome.ok) {
    if (!projectEvent) state.management.requests.shift();
    addLog(state, `${managerProfile(request.area).name}: ${outcome.message}`);
    return outcome;
  }
  if (choice === 'decline' && !projectEvent) {
    state.management.snoozed ||= {};
    state.management.snoozed[request.area] = { kind: request.kind, ref: request.ref, untilDay: state.day + 4 };
  }
  state.management.requests.shift();
  addLog(state, `${managerProfile(request.area).name}: ${choice === 'decline' && !projectEvent ? 'proposta recusada pelo fundador' : 'decisão executada pela área'}.`);
  return result(true, choice === 'decline' && !projectEvent ? 'O gerente recebeu sua decisão e voltou ao trabalho.' : outcome.message);
}

function runManagerRoutines(state) {
  if (!state.management?.managers.length) return;
  if (activeManager(state, 'sales')) {
    if (state.leads.length < 3) addLead(state);
    const lead = state.leads.find((item) => !item.negotiation && !item.discovered);
    if (lead) {
      lead.discovered = true;
      lead.qualification = { confidence: 80, scope: 'Escopo confirmado pelo gerente comercial.', risks: 'Prazo e capacidade devem ser aprovados pelo fundador.' };
    }
    const best = state.leads.filter((item) => !item.negotiation && item.discovered && !managerSnoozed(state, 'sales', 'sales-contract', item.id)).sort((a, b) => b.price / b.hours - a.price / a.hours)[0];
    if (best && activeProjects(state).length < 3) queueManager(state, 'sales', 'sales-contract', `Contrato de ${best.client}`, `Proposta padrão de R$ ${best.price}, prazo de ${best.duration} dias. ${best.title}. Aceitar autoriza a negociação; o cliente ainda pode recusar.`, best.id);
  }
  if (activeManager(state, 'development')) {
    const projects = activeProjects(state).sort((a, b) => a.deadline - b.deadline);
    for (const [index, person] of state.employees.entries()) {
      person.assignment = projects.length ? projects[index % projects.length].id : 'auto';
      person.assignmentRole = person.stress > 70 || (state.employees.length > 1 && state.debt > 35 && index === state.employees.length - 1) ? 'quality' : 'delivery';
    }
    const event = state.pendingEvents[0];
    if (event) queueManager(state, 'development', 'project-event', event.title, `${event.description} A equipe apresenta as alternativas para você decidir.`, event.id);
    const urgent = projects.find((project) => project.mode === 'fast' && (project.quality < 65 || state.debt > 50));
    if (urgent) queueManager(state, 'development', 'delivery-mode', `Revisar ${urgent.title}`, `O ritmo rápido elevou o risco. Mudar para caprichado melhora qualidade e reduz bugs, mas pode atrasar a entrega. Dívida técnica: ${Math.round(state.debt)}%.`, urgent.id);
  }
  if (activeManager(state, 'finance')) {
    const overdue = state.receivables.find((item) => item.dueDay < state.day && item.status !== 'defaulted' && item.followupCount === 0);
    if (overdue) queueManager(state, 'finance', 'finance-collect', `Cobrar ${overdue.client}`, `Pagamento de R$ ${Math.round(overdue.amount)} venceu no dia ${overdue.dueDay}. Uma cobrança cordial pode antecipar o recebimento; autorizar não usa suas horas.`, overdue.projectId);
    else {
      const daily = getOfficeOverview(state).dailyRent + getPayroll(state).total / 20 + getOfficeOverview(state).monthlyMaintenance / 28;
      if (state.cash / Math.max(1, daily) < 8 && getCreditOverview(state).available >= 1) queueManager(state, 'finance', 'finance-credit', 'Capital de giro em risco', `O caixa cobre cerca de ${Math.max(0, Math.floor(state.cash / Math.max(1, daily)))} dias. Um empréstimo de até R$ 2.000 dá fôlego, mas gera juros de ${(state.loan.interest * 100).toFixed(0)}% a cada 28 dias.`);
    }
  }
  if (activeManager(state, 'hr')) {
    state.employees.forEach((person) => { person.stress = round(clamp(person.stress - 2, 0, 100)); person.morale = round(clamp(person.morale + 1, 0, 100)); });
    const candidate = CANDIDATES.find((person) => !state.employees.some((employee) => employee.id === person.id) && !managerSnoozed(state, 'hr', 'hr-hire', person.id));
    if (candidate && !state.interviews[candidate.id]) state.interviews[candidate.id] = { day: state.day, candidateId: candidate.id, score: Math.round(clamp(65 + candidate.productivity * 3 + getRoomEffects(state).candidateScoreBonus, 0, 100)), strength: candidate.trait, risk: 'Custo fixo adicional exige contratos suficientes.' };
    if (candidate && getOfficeOverview(state).freePosts > 0) queueManager(state, 'hr', 'hr-hire', `Contratar ${candidate.name}`, `${candidate.role}, salário-base de R$ ${candidate.salary}/mês. Contrato CLT custará cerca de R$ ${Math.round(candidate.salary * 1.7)}/mês com encargos.`, candidate.id);
  }
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
  if (item.id === 'desk') {
    const ready = getItemEligibility(state, 'desk');
    if (!ready.ok) return result(false, ready.reason);
    state.office.workstations.push({ id: `post-${state.office.nextWorkstationId++}`, desk: true, chair: true, computerLevel: 1, employeeId: null });
  } else if (item.id === 'monitors') {
    state.office.workstations.forEach((post) => { post.computerLevel = Math.max(2, post.computerLevel); });
  } else {
    const ready = getItemEligibility(state, item.id);
    if (!ready.ok) return result(false, ready.reason);
    if (item.id === 'lounge') state.office.amenities.lounge = true;
  }
  recordMoney(state, -item.price, item.name);
  state.furniture.push({ ...item, purchasedDay: state.day });
  addLog(state, `${item.name} chegou ao escritório.`);
  return result(true, `${item.name} comprado. ${item.description}`);
}

export function purchaseOfficeItem(state, id, options = {}) {
  const allowed = getItemEligibility(state, id, options);
  if (!allowed.ok) return result(false, allowed.reason);
  const item = allowed.item;
  if (id === 'desk') state.office.workstations.push({ id: `post-${state.office.nextWorkstationId++}`, desk: true, chair: false, computerLevel: 1, employeeId: null });
  else if (id === 'chair') allowed.workstation.chair = true;
  else if (['meeting', 'ceo'].includes(id)) state.office.special[id] = true;
  else if (Object.hasOwn(state.office.amenities, id)) state.office.amenities[id] = true;
  if (FURNITURE.some((entry) => entry.id === id) && !hasFurniture(state, id)) state.furniture.push({ id, purchasedDay: state.day });
  recordMoney(state, -item.price, `Escritório: ${item.name}`);
  addLog(state, `${item.name} instalado. ${item.description}`);
  return result(true, `${item.name} comprado. ${item.description}`, { item });
}

export function expandOffice(state, targetStage = null) {
  const allowed = getExpansionEligibility(state);
  if (!allowed.ok) return result(false, allowed.reason);
  if (targetStage !== null && targetStage !== allowed.next.id) return result(false, 'O próximo estágio mudou. Consulte a loja novamente.');
  state.office.stage = allowed.next.id;
  state.officePosition = { x: 0, y: 0 };
  recordMoney(state, -allowed.price, `Mudança: ${allowed.next.name}`);
  addLog(state, `A empresa mudou para ${allowed.next.name}. ${allowed.next.description}`);
  return result(true, `Mudança concluída: ${allowed.next.name}. O novo aluguel já entra no próximo fechamento.`, { stage: allowed.next });
}

export function applyOfficePlacement(state,items){
  if(!running(state))return result(false,'A empresa está encerrada.');
  const placement=structuredClone(state.office.placement||{version:1,stages:{}});
  placement.stages[state.office.stage]=structuredClone(items);
  if(!validPlacement(placement))return result(false,'A planta contém posições inválidas.');
  const office={...state.office,placement},check=validateFloorPlan(createOfficeLayout(office),office);
  if(!check.ok)return result(false,check.message);
  state.office.placement=placement;state.officePosition={...check.spawn};
  addLog(state,'A planta do escritório foi reorganizada. Móveis, equipamentos e equipe mantidos.');
  return result(true,'Planta aplicada.',{spawn:check.spawn});
}

export function upgradeRoom(state, sectorId, targetLevel = null) {
  const allowed = getRoomEligibility(state, sectorId);
  if (!allowed.ok) return result(false, allowed.reason);
  if (targetLevel !== null && targetLevel !== allowed.next.id) return result(false, 'O nível atual mudou. Consulte a loja novamente.');
  state.office.rooms[sectorId] = allowed.next.id;
  recordMoney(state, -allowed.price, `Sala: ${allowed.sector.name} — ${allowed.next.name}`);
  addLog(state, `${allowed.sector.name}: ${allowed.next.name}. ${allowed.next.description}`);
  return result(true, `${allowed.sector.name} agora tem ${allowed.next.name.toLowerCase()}.`, { room: allowed.next });
}

export function upgradeComputer(state, workstationId, targetLevel = null) {
  const allowed = getComputerEligibility(state, workstationId);
  if (!allowed.ok) return result(false, allowed.reason);
  if (targetLevel !== null && Number(targetLevel) !== allowed.next.id) return result(false, 'O computador já mudou de nível. Consulte a loja novamente.');
  allowed.workstation.computerLevel = allowed.next.id;
  recordMoney(state, -allowed.price, `Computador: ${workstationId} — ${allowed.next.name}`);
  addLog(state, `${workstationId} recebeu um computador ${allowed.next.name.toLowerCase()}. A manutenção mensal desse posto passou para R$ ${allowed.next.monthlyMaintenance}.`);
  return result(true, `Computador ${allowed.next.name.toLowerCase()} instalado neste posto.`, { computer: allowed.next });
}

export function customizeBanner(state, text, color) {
  if (!running(state) || !state.office.amenities.banner) return result(false, 'Compre o banner na loja antes de personalizar.');
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 40 || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return result(false, 'Use um texto de 1 a 40 caracteres e uma cor hexadecimal válida.');
  state.office.banner = { text: text.trim(), color };
  return result(true, 'O banner foi atualizado no escritório.');
}

export function performRoomAction(state, action) {
  const allowed = getRoomActionEligibility(state, action);
  if (!allowed.ok) return result(false, allowed.reason);
  if (!spendHours(state, allowed.area, allowed.hours)) return result(false, 'As horas necessárias já foram usadas hoje.');
  if (allowed.cost) recordMoney(state, -allowed.cost, `Sala: ${allowed.name}`);
  state.office.actions[action] = state.day;
  if (action === 'alignment') {
    state.debt = round(Math.max(0, state.debt - 3));
    activeProjects(state).forEach((project) => { project.blockedUntil = Math.max(state.day, project.blockedUntil - 1); });
    state.office.bonuses.alignmentUntil = state.day + 2;
  } else if (action === 'presentation') state.office.bonuses.presentationUntil = state.day + 2;
  else if (action === 'onboarding') {
    state.employees.filter((person) => state.day - person.hiredDay <= 7).forEach((person) => { person.morale = clamp(person.morale + 10, 0, 100); person.stress = clamp(person.stress - 10, 0, 100); person.onboardingUntil = state.day + 2; });
    state.office.bonuses.onboardingUntil = state.day + 2;
  } else if (action === 'focus') {
    state.energy = clamp(state.energy + 14, 0, 100);
    state.office.bonuses.focusDay = state.day;
    state.office.ceoIsolation = Math.min(10, state.office.ceoIsolation + 1);
  } else {
    state.office.ceoIsolation = Math.max(0, state.office.ceoIsolation - 2);
    state.employees.forEach((person) => { person.morale = clamp(person.morale + 3, 0, 100); person.stress = clamp(person.stress - 3, 0, 100); });
  }
  addLog(state, `${allowed.name}: ${allowed.description}`);
  return result(true, `${allowed.name} concluído. ${allowed.hours}h da rotina foram usadas.`);
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
  const effects = getRoomEffects(state);
  const risk = type === 'bug' ? effects.bugRisk : type === 'blocker' ? Math.min(1, effects.blockerMultiplier) * (state.office.bonuses.alignmentUntil >= state.day ? 0.55 : 1) : 1;
  const riskRoll = (hash * 17 + 23) % 100;
  if (riskRoll >= risk * 100) {
    project.eventTriggered = true;
    addLog(state, `${project.client}: ${type === 'bug' ? 'a revisão do setor evitou um bug' : 'a sinergia e o alinhamento evitaram um bloqueio'} antes de afetar a entrega.`);
    return;
  }
  const definition = EVENT_TYPES[type];
  project.eventTriggered = true;
  state.pendingEvents.push({ id: `${project.id}-event`, projectId: project.id, type, title: definition.title, description: definition.description, createdDay: state.day, options: definition.options.map((option) => ({ ...option })) });
  addLog(state, `${project.client}: ${definition.title} Decida como o time deve reagir na área de projetos.`);
}

export function resolveProjectEvent(state, eventId, choice, { managed = false } = {}) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const event = state.pendingEvents.find((item) => item.id === eventId);
  const project = event && activeProjects(state).find((item) => item.id === event.projectId);
  const option = event && EVENT_TYPES[event.type].options.find((item) => item.id === choice);
  if (!project || !option) return result(false, 'Esse evento ou essa decisão não está disponível.');
  if (option.cost > 0 && state.cash < option.cost) return result(false, 'O caixa não cobre essa decisão.');
  if (option.hours > 0 && !managed && !spendHours(state, option.area, option.hours)) return result(false, `A decisão precisa de ${option.hours}h livres de ${option.area === 'sales' ? 'vendas' : option.area === 'quality' ? 'qualidade' : 'entrega'} em um dia útil.`);
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

export function collectReceivable(state, projectId, style = 'polite') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const receivable = state.receivables.find(item => item.projectId === projectId);
  const action = style === 'firm' ? 'firm' : style === 'polite' ? 'collect' : 'unknown';
  const allowed = getReceivableAction(state, receivable, action);
  if (!allowed.ok) return result(false, allowed.reason);
  if (!spendHours(state, 'quality', allowed.hours)) return result(false, 'Reserve horas de gestão em um dia útil.');
  receivable.followupCount = 1;
  if (style === 'firm') state.reputation = clamp(state.reputation - 1, 0, 100);
  if (style === 'firm' || receivable.paymentDay <= state.day || state.day > receivable.dueDay) {
    receivePayment(state, receivable);
    return result(true, `Cobrança concluída: R$ ${receivable.amount} entraram no caixa.${style === 'firm' ? ' A pressão custou 1 ponto de reputação.' : ''}`, { amount: receivable.amount });
  }
  receivable.paymentDay = Math.max(receivable.dueDay, Math.min(receivable.paymentDay, state.day + 1));
  addLog(state, `Cobrança enviada a ${receivable.client}. Previsão antecipada para o dia ${receivable.paymentDay}.`);
  return result(true, `Cobrança enviada. Pagamento previsto para D${receivable.paymentDay}; ${allowed.hours}h de gestão utilizadas.`);
}

export function renegotiateReceivable(state, projectId, days = 3) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const receivable = state.receivables.find(item => item.projectId === projectId);
  const allowed = getReceivableAction(state, receivable, 'renegotiate', days);
  if (!allowed.ok) return result(false, allowed.reason);
  if (!spendHours(state, 'quality', allowed.hours)) return result(false, 'Reserve horas de gestão em um dia útil.');
  const risk = allowed.risk.score;
  receivable.amount = allowed.net;
  receivable.dueDay = Math.max(state.day, receivable.dueDay) + days;
  receivable.paymentDay = Math.max(receivable.paymentDay, receivable.dueDay);
  receivable.renegotiated = true;
  receivable.status = 'renegotiated';
  receivable.riskScore = Math.max(5, risk - 10);
  noteFinanceExpense(state, 'fees', allowed.fee);
  const project = state.projects.find(p => p.id === projectId);
  if (project) { project.dueDay = receivable.dueDay; project.invoiceAmount = receivable.amount; }
  addLog(state, `${receivable.client}: prazo renegociado para D${receivable.dueDay}, com 2% de desconto e risco menor.`);
  return result(true, `Novo vencimento D${receivable.dueDay}. A receber: R$ ${receivable.amount.toFixed(2)}; desconto de R$ ${allowed.fee.toFixed(2)}.`);
}

export function anticipateReceivable(state, projectId) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const receivable = state.receivables.find(item => item.projectId === projectId);
  const allowed = getReceivableAction(state, receivable, 'anticipate');
  if (!allowed.ok) return result(false, allowed.reason);
  if (!spendHours(state, 'quality', allowed.hours)) return result(false, 'Reserve horas de gestão em um dia útil.');
  receivePayment(state, receivable);
  recordMoney(state, -allowed.fee, `Antecipação: ${receivable.client}`);
  const project = state.projects.find(p => p.id === projectId);
  if (project) project.settlementMethod = 'anticipated';
  addLog(state, `Recebível antecipado sem recurso: R$ ${allowed.net.toFixed(2)} líquidos, com desconto de R$ ${allowed.fee.toFixed(2)}. O banco assume o risco do cliente.`);
  return result(true, `R$ ${allowed.net.toFixed(2)} líquidos no caixa. Desconto: ${(allowed.discountRate * 100).toFixed(1)}%. Este recebível não será pago novamente.`, { amount: allowed.net, fee: allowed.fee });
}

export function investProduct(state, focus = 'prototype') {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  if (state.stats.delivered < 2 && !isLocalTestState(state)) return result(false, 'Entregue dois projetos para usar a experiência no seu próprio produto.');
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

export function takeLoan(state, amount = null) {
  if (!running(state)) return result(false, 'A empresa está encerrada.');
  const credit = getCreditOverview(state);
  if (amount === null) amount = Math.min(2000, credit.available);
  if (!Number.isFinite(amount) || amount < 1 || amount > credit.available || Math.abs(round(amount) - amount) > 1e-8) return result(false, 'Escolha um valor dentro do limite disponível, com até duas casas decimais.');
  if (state.loan.balance === 0) state.loan.nextInterestDay = state.day + FINANCE_CYCLE;
  state.loan.taken = true;
  state.loan.balance = round(state.loan.balance + amount);
  recordMoney(state, amount, 'Empréstimo de capital de giro');
  addLog(state, `Crédito de R$ ${amount.toFixed(2)} liberado. Juros de ${(state.loan.interest * 100).toFixed(0)}% a cada 28 dias; limite baseado em reputação e faturamento recebido.`);
  return result(true, `R$ ${amount.toFixed(2)} entraram no caixa. Saldo devedor: R$ ${state.loan.balance.toFixed(2)}.`);
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
  noteFinanceRevenue(state, project.invoiceAmount);
  state.receivables.push({ projectId: project.id, client: project.client, amount: project.invoiceAmount, dueDay: project.dueDay, paymentDay: project.dueDay + Math.max(0, (project.pricing === 'premium' ? 2 : 0) - getRoomEffects(state).paymentDelayReduction), followupCount: 0 });
  state.pendingEvents = state.pendingEvents.filter((event) => event.projectId !== project.id);
  const invoice = state.receivables.at(-1);
  invoice.riskScore = getReceivableRisk(state, invoice).score;
  invoice.status = 'pending';
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

function applyWork(state, project, hours, employeeId = 'founder') {
  if (!project || project.status !== 'active' || hours <= 0) return 0;
  if (project.blockedUntil > state.day) return 0;
  const mode = MODES[project.mode];
  const energyFactor = 0.55 + state.energy / 100 * 0.45;
  const debtFactor = Math.max(0.55, 1 - state.debt / 160);
  const furnitureFactor = getComputerMultiplier(state, employeeId);
  if (furnitureFactor <= 0) return 0;
  const traitFactor = employeeId === 'founder' && state.profile.trait === 'technical' ? 1.05 : 1;
  const focusFactor = employeeId === 'founder' && state.office.bonuses.focusDay === state.day ? 1.15 : 1;
  const event = state.pendingEvents.find((item) => item.projectId === project.id);
  const eventFactor = event?.type === 'blocker' ? 0.15 : event?.type === 'bug' ? 0.65 : event ? 0.8 : 1;
  const output = Math.min(project.hours - project.progress, hours * mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor * eventFactor * focusFactor);
  project.progress = round(Math.min(project.hours, project.progress + output));
  project.quality = round(clamp(project.quality + output * (mode.quality + getRoomEffects(state).developmentQualityBonus * 0.08 - (event?.type === 'bug' ? 0.2 : 0)), 0, 100));
  state.debt = round(clamp(state.debt + output * mode.debt, 0, 100));
  // Only count the time actually needed to finish; remaining capacity can serve another client.
  const usedHours = output / (mode.speed * energyFactor * debtFactor * furnitureFactor * traitFactor * eventFactor * focusFactor);
  state.stats.hoursWorked = round(state.stats.hoursWorked + usedHours);
  updatePhase(project);
  completeProject(state, project);
  return usedHours;
}

export function getWorkSession(state) {
  const session = state.workSession;
  if (!session) return null;
  const project = state.projects.find((entry) => entry.id === session.projectId);
  const puzzle = session.puzzles[session.index];
  return {
    id: session.id, projectId: session.projectId, projectTitle: project?.title || 'Projeto', client: project?.client || 'Cliente',
    day: session.day, hours: session.hours, total: session.total, index: session.index, mistakes: session.mistakes, status: session.status,
    currentPuzzle: puzzle ? { id: puzzle.id, kind: puzzle.kind, title: puzzle.title, prompt: puzzle.prompt, options: puzzle.options.map((option) => ({ ...option })) } : null,
    lastFeedback: session.lastFeedback ? { ...session.lastFeedback } : null, completed: session.index === session.total,
  };
}

export function getWorkSessionEligibility(state, projectId = null) {
  const session = state.workSession;
  const selectedId = projectId || session?.projectId || state.focusProjectId;
  const project = selectedId ? activeProjects(state).find((entry) => entry.id === selectedId) : activeProjects(state).sort((a, b) => a.deadline - b.deadline)[0];
  const hours = Math.min(session?.hours ?? 2, 2 - state.dailyActions.workHours, availableHours(state, 'delivery'));
  const reason = !running(state) ? 'A empresa encerrou as atividades.'
    : !isWeekday(state.day) ? 'Hoje é fim de semana. A equipe volta na segunda-feira.'
      : !project ? 'Escolha um projeto ativo antes de desenvolver.'
        : session && session.day !== state.day ? 'Este bloco pertence a outro dia e já expirou.'
          : session && project.id !== session.projectId ? 'Conclua o bloco em andamento antes de trocar de projeto.'
            : project.blockedUntil > state.day ? `Este contrato aguarda o cliente até o dia ${project.blockedUntil}. Resolva o bloqueio antes de desenvolver.`
              : hours <= 0 ? 'O bloco manual de até 2h ou as horas de entrega de hoje já foram usados.'
                : session && hours + 0.00000001 < session.hours ? `Este bloco precisa das ${hoursText(session.hours)}h reservadas no início. Restam ${hoursText(hours)}h; restaure a rotina de entrega antes de finalizar.`
                : state.energy < 10 ? 'Sua energia está muito baixa. Faça uma pausa antes de desenvolver.' : '';
  return { ok: !reason, reason, hours: Math.max(0, hours), projectId: project?.id || null, project: project || null, resumable: !!session && !reason };
}

export function startWorkSession(state, projectId = null) {
  const allowed = getWorkSessionEligibility(state, projectId);
  if (!allowed.ok) return result(false, allowed.reason);
  if (state.workSession) return result(true, 'Seu bloco de desenvolvimento foi retomado.', { session: getWorkSession(state) });
  const id = `work-${state.day}-${allowed.projectId}-${state.dailyActions.work}`;
  state.workSession = {
    id, projectId: allowed.projectId, day: state.day, hours: allowed.hours,
    total: WORK_PUZZLE_COUNT, index: 0, mistakes: 0, answers: [],
    puzzles: createWorkPuzzles(state, allowed.project, id), lastFeedback: null, status: 'active',
  };
  return result(true, 'Resolva cinco decisões rápidas de escritório para concluir este bloco de trabalho.', { session: getWorkSession(state) });
}

export function answerWorkPuzzle(state, answerId) {
  const session = state.workSession;
  if (!session) return result(false, 'Abra um bloco de desenvolvimento antes de responder.');
  const allowed = getWorkSessionEligibility(state, session.projectId);
  if (!allowed.ok) return result(false, allowed.reason);
  if (session.index >= session.total) return result(false, 'As cinco decisões já estão concluídas. Finalize o bloco para registrar o trabalho.');
  const puzzle = session.puzzles[session.index];
  const answer = puzzle.options.find((option) => option.id === answerId);
  if (!answer) return result(false, 'Essa alternativa não pertence à decisão atual.');
  const correct = answer.id === puzzle.correctAnswerId;
  session.answers.push({ questionId: puzzle.id, answerId: answer.id, correct });
  session.index += 1;
  if (!correct) session.mistakes += 1;
  session.lastFeedback = { correct, message: `${correct ? 'Boa decisão.' : 'Essa escolha traz um risco.'} ${puzzle.explanation}` };
  session.status = session.index === session.total ? 'ready' : 'active';
  return result(true, session.lastFeedback.message, { correct, finished: session.status === 'ready', session: getWorkSession(state) });
}

export function completeWorkSession(state) {
  const session = state.workSession;
  if (!session) return result(false, 'Não há bloco de desenvolvimento para finalizar.');
  const allowed = getWorkSessionEligibility(state, session.projectId);
  if (!allowed.ok) return result(false, allowed.reason);
  if (session.index !== session.total) return result(false, 'Resolva as cinco decisões antes de registrar o trabalho.');
  const previousQuality = allowed.project.quality;
  const qualityDelta = 2 - session.mistakes;
  allowed.project.quality = round(clamp(previousQuality + qualityDelta, 0, 100));
  const completed = performAction(state, { type: 'work', projectId: session.projectId, hoursLimit: session.hours });
  if (!completed.ok) {
    allowed.project.quality = previousQuality;
    return completed;
  }
  const report = { projectId: session.projectId, hours: completed.hours, correct: session.total - session.mistakes, mistakes: session.mistakes, qualityDelta: round(allowed.project.quality - previousQuality) };
  state.workSession = null;
  addLog(state, `Bloco de desenvolvimento: ${report.correct}/5 decisões corretas e ${hoursText(report.hours)}h dedicadas a ${allowed.project.client}.`);
  return result(true, `Bloco concluído: ${report.correct}/5 boas decisões, ${hoursText(report.hours)}h de trabalho registradas.`, { report });
}

const hoursText = (hours) => Number(hours.toFixed(2)).toLocaleString('pt-BR');

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
    const requestedLimit = typeof action === 'object' && action.hoursLimit !== undefined ? action.hoursLimit : 2;
    if (typeof requestedLimit !== 'number' || !Number.isFinite(requestedLimit) || requestedLimit <= 0) return result(false, 'O bloco precisa de uma quantidade válida de horas.');
    const hours = Math.min(requestedLimit, 2 - state.dailyActions.workHours, availableHours(state, 'delivery'));
    if (hours <= 0) return result(false, 'Seu bloco de trabalho manual já foi usado. Avance o dia para continuar.');
    if (state.energy < 10) return result(false, 'Sua energia está muito baixa. Faça uma pausa antes de trabalhar.');
    applyWork(state, project, hours);
    spendHours(state, 'delivery', hours);
    state.dailyActions.workHours = Math.round((state.dailyActions.workHours + hours) * 1000000) / 1000000;
    state.dailyActions.work += 1;
    return result(true, `${hours}h dedicadas a ${project.title}. Essas horas fazem parte da rotina de hoje.`, { hours });
  }
  if (type === 'review') {
    if (state.dailyActions.review >= 1) return result(false, 'Você já revisou o código hoje.');
    if (availableHours(state, 'quality') < 1) return result(false, 'Reserve uma hora para qualidade antes de revisar.');
    if (state.debt <= 0 && activeProjects(state).length === 0) return result(false, 'Ainda não há código para revisar.');
    state.debt = round(Math.max(0, state.debt - 6));
    activeProjects(state).forEach((project) => { project.quality = round(clamp(project.quality + 3 * getRoomEffects(state).reviewMultiplier, 0, 100)); });
    spendHours(state, 'quality', 1);
    state.dailyActions.review += 1;
    return result(true, 'Código revisado: menos dívida técnica e mais qualidade. Uma hora da rotina foi usada.');
  }
  return result(false, 'Ação desconhecida.');
}

export function advanceDay(state) {
  if (!running(state)) return result(false, 'A empresa encerrou as atividades. Comece uma nova história.');
  if (state.workSession) {
    addLog(state, 'O bloco de decisões do computador expirou com o fechamento do dia. Ele não concedeu trabalho manual nem bônus de qualidade.');
    state.workSession = null;
  }
  const day = state.day;
  const weekday = isWeekday(day);
  const summary = { day, hoursWorked: 0, projectsDelivered: 0, revenue: 0, costs: 0, energy: state.energy, weekend: !weekday, travelHours: state.travelHours, productRevenue: 0, maintenance: 0, noiseLostHours: 0 };
  const office = getOfficeOverview(state);
  const effects = getRoomEffects(state);
  for (const receivable of state.receivables.filter(item => item.paymentDay <= day && item.status !== 'defaulted')) {
    if (receivableDefaults(state, receivable)) {
      receivable.status = 'defaulted';
      noteFinanceExpense(state, 'losses', receivable.amount);
      addLog(state, `${receivable.client} não honrou o pagamento. R$ ${receivable.amount.toFixed(2)} baixados por calote no financeiro.`);
      continue;
    }
    summary.revenue = round(summary.revenue + receivable.amount);
    receivePayment(state, receivable);
  }
  state.receivables.filter((item) => item.dueDay === day && item.paymentDay > day).forEach((receivable) => addLog(state, `${receivable.client} atrasou o pagamento. Nova previsão: dia ${receivable.paymentDay}. A cobrança está disponível no financeiro.`));
  let productSupport = 0;
  if (state.product.stage === 'launched' && state.product.nextPaymentDay <= day) {
    noteFinanceRevenue(state, state.product.mrr);
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
    noteFinanceExpense(state, 'interest', interest);
    state.loan.balance = round(state.loan.balance + interest);
    state.loan.nextInterestDay = day + 28;
    addLog(state, `R$ ${interest.toFixed(2)} de juros foram incorporados ao empréstimo. Saldo: R$ ${state.loan.balance.toFixed(2)}.`);
  }

  const beforeWorked = state.stats.hoursWorked;
  const beforeDelivered = state.stats.delivered;
  if (weekday) {
    runManagerRoutines(state);
    const projects = activeProjects(state).sort((a, b) => a.deadline - b.deadline);
    const qualityHours = availableHours(state, 'quality');
    const qualityBoost = (hasFurniture(state, 'whiteboard') ? 4 : 3) * effects.reviewMultiplier * (state.office.bonuses.alignmentUntil >= day ? 1.15 : 1);
    projects.forEach((project) => {
      project.quality = round(clamp(project.quality + qualityHours * qualityBoost / projects.length, 0, 100));
    });
    state.debt = round(Math.max(0, state.debt - qualityHours * 2.5));
    const rawFounderHours = availableHours(state, 'delivery');
    const noiseExposure = Math.min(1.5, (state.office.salesActivityHours * 0.35 + availableHours(state, 'sales') * 0.15) * effects.noise);
    const founderHours = Math.max(0, rawFounderHours - noiseExposure);
    summary.noiseLostHours = round(rawFounderHours - founderHours);
    if (summary.noiseLostHours > 0.1) addLog(state, `O ruído do comercial consumiu ${summary.noiseLostHours.toFixed(2)}h de entrega do fundador. Divisórias e salas reduzem essa interferência.`);
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
      const onboardingFactor = person.onboardingUntil >= day ? 1.2 : day - person.hiredDay <= 3 ? 0.85 : 1;
      const capacity = person.productivity * (0.7 + person.morale / 100 * 0.3) * (1 - person.stress / 100 * 0.25) * onboardingFactor;
      if (person.assignmentRole === 'quality') {
        target.quality = round(clamp(target.quality + capacity * 1.5 * getComputerMultiplier(state, person.id) * effects.reviewMultiplier, 0, 100));
        state.debt = round(Math.max(0, state.debt - capacity));
      } else applyWork(state, target, capacity, person.id);
      const pressure = target.mode === 'fast' ? 7 : target.mode === 'careful' ? 1 : 3;
      person.stress = round(clamp(person.stress + pressure + noiseExposure * 2 + (target.deadline - day <= 2 ? 4 : 0) + (state.pendingEvents.some((event) => event.projectId === target.id) ? 3 : 0), 0, 100));
      person.morale = round(clamp(person.morale + (target.mode === 'careful' ? 1 : 0) - person.stress / 35, 0, 100));
    }
    const salesHours = availableHours(state, 'sales');
    state.salesProgress += salesHours * (state.profile.trait === 'commercial' ? 1.05 : 1);
    if (state.office.amenities.banner) {
      state.reputation = round(clamp(state.reputation + 0.05, 0, 100));
      state.salesProgress += 0.25;
      state.office.bannerProgress = round(state.office.bannerProgress + 0.25);
      if (state.office.bannerProgress >= 8) {
        state.office.bannerProgress -= 8;
        addLog(state, 'O banner da empresa completou mais um ciclo de divulgação e alimentou a chegada de contatos.');
      }
    }
    while (state.salesProgress >= 8 && state.leads.length < MAX_LEADS) {
      addLead(state);
      state.salesProgress -= 8;
    }
    state.salesProgress = Math.min(16, state.salesProgress);
    const energySpent = founderHours * 2.5 + salesHours + qualityHours * 1.5;
    const recovery = state.office.amenities.lounge ? 13 : 8;
    state.energy = round(clamp(state.energy - energySpent + recovery, 0, 100));
    scheduleProjectEvent(state);
    if (activeManager(state, 'development') && state.pendingEvents.length) {
      const event = state.pendingEvents[0];
      queueManager(state, 'development', 'project-event', event.title, `${event.description} A equipe apresenta as alternativas para você decidir.`, event.id);
    }
  } else {
    state.energy = clamp(state.energy + 25, 0, 100);
    state.employees.forEach((person) => {
      person.stress = clamp(person.stress - 12, 0, 100);
      person.morale = clamp(person.morale + 4, 0, 100);
    });
  }

  const comfortMorale = (state.office.amenities.lounge ? 2 : 0) + (state.office.amenities.floor ? 0.3 : 0) + (state.office.amenities.decor ? 0.5 : 0);
  const isolationPenalty = state.office.ceoIsolation >= 3 ? Math.min(2, (state.office.ceoIsolation - 2) * 0.3) : 0;
  state.employees.forEach((person) => {
    person.morale = round(clamp(person.morale + comfortMorale - isolationPenalty, 0, 100));
    if (state.office.amenities.lounge) person.stress = round(clamp(person.stress - 3, 0, 100));
  });
  if (weekday && isolationPenalty > 0 && state.employees.length) addLog(state, `O isolamento do fundador reduziu em ${isolationPenalty.toFixed(1)} a moral do time. Converse com a equipe na sala do CEO.`);

  const payrollDetail = getPayroll(state);
  const payroll = weekday ? payrollDetail.dailySalary + payrollDetail.dailyCharges : 0;
  recordMoney(state, -office.dailyRent, 'Aluguel, internet e custos fixos');
  if (state.office.nextMaintenanceDay <= day) {
    summary.maintenance = office.monthlyMaintenance;
    recordMoney(state, -office.monthlyMaintenance, 'Manutenção mensal de computadores e salas');
    state.office.nextMaintenanceDay = day + 28;
    addLog(state, `Manutenção mensal: R$ ${office.monthlyMaintenance}. Próximo ciclo no dia ${state.office.nextMaintenanceDay}.`);
  }
  if (weekday && payrollDetail.total > 0) {
    recordMoney(state, -payrollDetail.dailySalary, 'Salários e contratos');
    recordMoney(state, -payrollDetail.dailyCharges, 'Encargos da folha');
  }
  const finance = ensureFinance(state);
  summary.taxes = 0;
  if (finance.taxDueDay <= day) {
    summary.taxes = finance.taxAccrued;
    if (summary.taxes) recordMoney(state, -summary.taxes, 'Impostos sobre faturamento');
    finance.taxAccrued = 0;
    finance.taxDueDay = day + FINANCE_CYCLE;
  }
  summary.costs = round(office.dailyRent + payroll + productSupport + summary.maintenance + summary.taxes);
  summary.hoursWorked = round(state.stats.hoursWorked - beforeWorked);
  summary.projectsDelivered = state.stats.delivered - beforeDelivered;
  summary.energy = state.energy;
  const expired = state.leads.filter((lead) => lead.expiresDay <= day);
  if (expired.length) addLog(state, `${expired.length} oportunidade${expired.length > 1 ? 's expiraram' : ' expirou'}. Outros clientes ainda vão aparecer.`);
  state.leads = state.leads.filter((lead) => lead.expiresDay > day);
  reconcileManagement(state);

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
  closeFinancePeriod(state);
  state.history.push({ day, cash: state.cash, revenue: state.stats.revenue, debt: state.debt, reputation: state.reputation });
  state.history = state.history.slice(-120);
  state.day += 1;
  state.actionHours = 0;
  state.manualDeliveryHours = 0;
  state.manualQualityHours = 0;
  state.manualSalesHours = 0;
  state.travelHours = 0;
  state.office.salesActivityHours = 0;
  state.dailyActions = { coffee: 0, rest: 0, work: 0, workHours: 0, review: 0, prospect: 0, product: 0 };
  const message = state.bankrupt
    ? 'Após 60 dias seguidos no vermelho, a empresa encerrou as atividades.'
    : `Dia ${day} encerrado: ${summary.hoursWorked.toFixed(1)}h de entrega, R$ ${summary.costs.toFixed(0)} de custos${summary.revenue ? ` e R$ ${summary.revenue.toFixed(0)} recebidos` : ''}.`;
  return result(true, message, { summary });
}
