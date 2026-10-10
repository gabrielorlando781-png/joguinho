import { getOfficeOverview, getRoomEffects, ROOM_ACTIONS } from './office-progression.js';

export const FINANCE_CYCLE = 28;
export const TAX_RATE = .06;
export const EXPENSE_LABELS = {
  salary: 'Salários e contratos', charges: 'Encargos da folha', rent: 'Aluguel', utilities: 'Internet e serviços',
  maintenance: 'Manutenção', tax: 'Impostos sobre faturamento', interest: 'Juros', support: 'Suporte do produto',
  product: 'Pesquisa e desenvolvimento', events: 'Imprevistos', comfort: 'Pausas e alimentação', fees: 'Descontos financeiros',
  losses: 'Perdas com clientes', other: 'Outras despesas',
};
const round = n => Math.round(n * 100) / 100;
export const periodId = day => Math.floor((day - 1) / FINANCE_CYCLE) + 1;
const weekday = day => (day - 1) % 7 < 5;
const zeroExpenses = () => Object.fromEntries(Object.keys(EXPENSE_LABELS).map(key => [key, 0]));
function period(id, cash = null) {
  return { id, startDay: (id - 1) * FINANCE_CYCLE + 1, endDay: id * FINANCE_CYCLE, revenue: 0, receipts: 0,
    cashOut: 0, expenses: zeroExpenses(), openingCash: cash, closingCash: null, closed: false };
}
export function expenseCategory(label) {
  if (/Capital inicial|Empréstimo|Amortização|Pagamento:|Produto: receita/.test(label)) return null;
  if (/^(Posto completo|Computadores profissionais|Cantinho de descanso)$/.test(label)) return null;
  if (ROOM_ACTIONS.some(action => label === `Sala: ${action.name}`)) return 'other';
  if (/Manutenção/.test(label)) return 'maintenance';
  if (/Salários/.test(label)) return 'salary';
  if (/Encargos/.test(label)) return 'charges';
  if (/Aluguel/.test(label)) return 'rent';
  if (/Juros/.test(label)) return 'interest';
  if (/Imposto/.test(label)) return null; // Recognized on billing; payment settles the provision.
  if (/infraestrutura e suporte/.test(label)) return 'support';
  if (/Produto:/.test(label)) return 'product';
  if (/Imprevisto:/.test(label)) return 'events';
  if (/Pausa|Descanso/.test(label)) return 'comfort';
  if (/Antecipação|Renegociação/.test(label)) return 'fees';
  if (/Prédio:|Escritório:|Mudança:|Sala:|Computador:|Cafeteira|Quadro de ideias|Mesa compartilhada|Cadeira|Servidor/.test(label)) return null;
  return 'other';
}
export function createFinance(state, imported = false) {
  const finance = { version: 1, taxAccrued: 0, taxDueDay: periodId(state.day) * FINANCE_CYCLE,
    importedBeforeDay: imported ? state.day : 0, periods: [period(periodId(state.day), state.cash)] };
  if (!imported) return finance;
  const map = new Map();
  const get = day => {
    const id = periodId(day);
    if (!map.has(id)) map.set(id, period(id));
    return map.get(id);
  };
  for (const entry of state.ledger || []) {
    if (/Capital inicial/.test(entry.label)) continue;
    const p = get(entry.day);
    if (entry.amount > 0) p.receipts = round(p.receipts + entry.amount);
    else {
      p.cashOut = round(p.cashOut - entry.amount);
      const category = expenseCategory(entry.label);
      if (category === 'rent') {
        p.expenses.rent = round(p.expenses.rent + Math.max(0, -entry.amount - 35));
        p.expenses.utilities = round(p.expenses.utilities + Math.min(35, -entry.amount));
      } else if (category) p.expenses[category] = round(p.expenses[category] - entry.amount);
    }
    if (entry.amount > 0 && /Produto: receita/.test(entry.label)) p.revenue = round(p.revenue + entry.amount);
  }
  for (const project of state.projects || []) {
    if (project.status === 'delivered' && Number.isInteger(project.completedDay) && Number.isFinite(project.invoiceAmount)) {
      const p = get(project.completedDay);
      p.revenue = round(p.revenue + project.invoiceAmount);
    }
  }
  get(state.day);
  for (const p of map.values()) {
    p.closed = p.id < periodId(state.day);
    p.openingCash = state.history?.find(h => h.day === p.startDay - 1)?.cash ?? (p.id === 1 ? 20000 : null);
    p.closingCash = p.closed ? state.history?.find(h => h.day === p.endDay)?.cash ?? null : null;
  }
  finance.periods = [...map.values()].sort((a, b) => a.id - b.id).slice(-24);
  return finance;
}
export function ensureFinance(state) { return state.finance ||= createFinance(state, true); }
function currentPeriod(state) {
  const finance = ensureFinance(state), id = periodId(state.day);
  let p = finance.periods.find(entry => entry.id === id);
  if (!p) { p = period(id, state.cash); finance.periods.push(p); finance.periods = finance.periods.slice(-24); }
  return p;
}
export function noteFinanceExpense(state, category, amount) {
  const p = currentPeriod(state);
  p.expenses[category] = round(p.expenses[category] + amount);
}
export function noteFinanceRevenue(state, amount) {
  const p = currentPeriod(state), finance = ensureFinance(state), tax = round(amount * TAX_RATE);
  p.revenue = round(p.revenue + amount);
  finance.taxAccrued = round(finance.taxAccrued + tax);
  noteFinanceExpense(state, 'tax', tax);
}
export function noteFinanceMovement(state, amount, label, category = expenseCategory(label)) {
  const p = currentPeriod(state);
  if (amount >= 0) p.receipts = round(p.receipts + amount);
  else p.cashOut = round(p.cashOut - amount);
  if (amount < 0 && category === 'rent') {
    noteFinanceExpense(state, 'rent', Math.max(0, -amount - 35));
    noteFinanceExpense(state, 'utilities', Math.min(35, -amount));
  } else if (amount < 0 && category) noteFinanceExpense(state, category, -amount);
}
export function closeFinancePeriod(state) {
  const p = currentPeriod(state);
  if (state.day === p.endDay) { p.closed = true; p.closingCash = state.cash; }
}
export function validFinance(finance) {
  if (finance === undefined) return true; // Old saves initialize on load, without retrospective tax.
  const money = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e12;
  const cash = n => n === null || typeof n === 'number' && Number.isFinite(n);
  const day = n => Number.isInteger(n) && n > 0;
  return Boolean(finance && finance.version === 1 && money(finance.taxAccrued) && day(finance.taxDueDay)
    && Number.isInteger(finance.importedBeforeDay) && finance.importedBeforeDay >= 0
    && Array.isArray(finance.periods) && finance.periods.length > 0 && finance.periods.length <= 24
    && new Set(finance.periods.map(p => p?.id)).size === finance.periods.length
    && finance.periods.every(p => p && day(p.id) && p.startDay === (p.id - 1) * FINANCE_CYCLE + 1
      && p.endDay === p.id * FINANCE_CYCLE && money(p.revenue) && money(p.receipts) && money(p.cashOut)
      && cash(p.openingCash) && cash(p.closingCash) && typeof p.closed === 'boolean'
      && p.expenses && Object.keys(EXPENSE_LABELS).every(key => money(p.expenses[key]))));
}
export function getPayroll(state) {
  const rows = [...state.employees, ...(state.management?.managers || [])].map(person => ({ id: person.id, name: person.name, contract: person.contract,
    salary: person.salary, charges: round(person.salary * (person.contract === 'CLT' ? .7 : .15)) }));
  const salary = round(rows.reduce((sum, person) => sum + person.salary, 0));
  const charges = round(rows.reduce((sum, person) => sum + person.charges, 0));
  return { rows, salary, charges, total: round(salary + charges), dailySalary: round(salary / 20), dailyCharges: round(charges / 20) };
}
export function getCreditOverview(state) {
  const historyBonus = Math.min(4000, Math.floor(state.stats.revenue / 1000) * 100 + state.stats.delivered * 500);
  const limit = Math.min(15000, 2000 + Math.max(0, Math.floor(state.reputation - 12)) * 100 + historyBonus);
  const available = Math.max(0, round(limit - state.loan.balance));
  return { limit, available, balance: state.loan.balance, interest: state.loan.interest,
    nextInterestDay: state.loan.nextInterestDay || state.day + FINANCE_CYCLE,
    nextInterest: round(state.loan.balance * state.loan.interest), historyBonus };
}
export function getReceivableRisk(state, receivable) {
  const project = state.projects.find(p => p.id === receivable.projectId);
  const score = receivable.riskScore ?? Math.min(50, Math.max(5, Math.round((100 - (project?.quality ?? 80)) * .3 + Math.max(0, (project?.completedDay ?? 0) - (project?.deadline ?? 0)) * 4 - getRoomEffects(state).paymentDelayReduction * 5)));
  return { score, label: score >= 30 ? 'Alto' : score >= 15 ? 'Moderado' : 'Baixo', defaulted: receivable.status === 'defaulted',
    late: receivable.dueDay < state.day, expectedDay: Math.max(state.day, receivable.paymentDay) };
}
export function getReceivableAction(state, receivable, action, option = 3) {
  if (!receivable) return { ok: false, reason: 'Recebível não encontrado.' };
  const risk = getReceivableRisk(state, receivable);
  const hours = action === 'firm' ? 1 : .5;
  const discountRate = action === 'anticipate' ? Math.min(.2, Math.round((.06 + Math.max(0, receivable.paymentDay - state.day) * .002 + risk.score * .001) * 10000) / 10000) : action === 'renegotiate' ? .02 : 0;
  const fee = round(receivable.amount * discountRate), net = round(receivable.amount - fee);
  let reason = state.status === 'bankrupt' ? 'A empresa está encerrada.' : risk.defaulted ? 'Este recebível foi baixado por calote.'
    : !weekday(state.day) ? 'Ação disponível em dia útil.'
      : state.allocation.quality - state.manualQualityHours + 1e-8 < hours ? `Reserve ${hours}h de gestão na rotina do PC.`
        : ['collect', 'firm'].includes(action) && state.day < receivable.dueDay ? 'O prazo ainda não venceu.'
          : ['collect', 'firm'].includes(action) && receivable.followupCount >= 1 ? 'A cobrança já foi enviada.'
            : action === 'renegotiate' && receivable.renegotiated ? 'Este prazo já foi renegociado.'
              : action === 'renegotiate' && ![3, 7].includes(option) ? 'Escolha 3 ou 7 dias.' : '';
  if (!['collect', 'firm', 'renegotiate', 'anticipate'].includes(action)) reason = 'Ação financeira desconhecida.';
  return { ok: !reason, reason, hours, fee, net, discountRate, risk };
}
export function receivableDefaults(state, receivable) {
  const risk = getReceivableRisk(state, receivable);
  if (risk.score < 30) return false;
  const key = `${receivable.projectId}:${receivable.client}`;
  let hash = 17;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 100 < Math.floor(risk.score / 2);
}
export function getCashForecast(state, days = 30, includeReceipts = true, stress = false) {
  const office = getOfficeOverview(state), payroll = getPayroll(state), finance = state.finance || createFinance(state, true);
  let cash = state.cash, tax = finance.taxAccrued, taxDay = finance.taxDueDay, maintenanceDay = office.nextMaintenanceDay;
  let productDay = state.product.stage === 'launched' ? state.product.nextPaymentDay : Infinity;
  let interestDay = state.loan.balance > 0 ? state.loan.nextInterestDay : Infinity, debt = state.loan.balance;
  const daily = [], points = [{ day: state.day - 1, balance: cash }];
  const pending = state.receivables.filter(r => r.status !== 'defaulted');
  for (let day = state.day; day < state.day + days; day++) {
    const events = [], add = (category, label, amount) => { events.push({ category, label, amount: round(amount) }); cash = round(cash + amount); };
    if (includeReceipts) for (const r of pending) if (Math.max(state.day, r.paymentDay) === day && (!stress || getReceivableRisk(state, r).score < 30)) add('receipts', r.client, r.amount);
    if (includeReceipts && productDay <= day) {
      add('product', 'Receita do produto', state.product.mrr); tax = round(tax + state.product.mrr * TAX_RATE);
      add('support', 'Suporte do produto', -100); productDay = day + FINANCE_CYCLE;
    } else if (!includeReceipts && productDay <= day) { add('support', 'Suporte do produto', -100); productDay = day + FINANCE_CYCLE; }
    add('rent', 'Aluguel', -(office.dailyRent - 35)); add('utilities', 'Internet e serviços', -35);
    if (weekday(day) && payroll.total) { add('salary', 'Salários', -payroll.dailySalary); add('charges', 'Encargos', -payroll.dailyCharges); }
    if (maintenanceDay <= day) { add('maintenance', 'Manutenção', -office.monthlyMaintenance); maintenanceDay = day + FINANCE_CYCLE; }
    if (taxDay <= day) { if (tax) add('tax', 'Impostos', -tax); tax = 0; taxDay = day + FINANCE_CYCLE; }
    if (interestDay <= day) { const interest = round(debt * state.loan.interest); debt = round(debt + interest); events.push({ category: 'interest', label: 'Juros incorporados à dívida', amount: 0, debtIncrease: interest }); interestDay = day + FINANCE_CYCLE; }
    const incoming = round(events.reduce((sum, e) => sum + Math.max(0, e.amount), 0));
    const outgoing = round(events.reduce((sum, e) => sum + Math.max(0, -e.amount), 0));
    daily.push({ day, incoming, outgoing, balance: cash, events, debt }); points.push({ day, balance: cash });
  }
  return { daily, points, closingBalance: cash, minBalance: Math.min(state.cash, ...daily.map(d => d.balance)),
    firstNegativeDay: state.cash < 0 ? state.day : daily.find(d => d.balance < 0)?.day ?? null,
    incoming: round(daily.reduce((sum, d) => sum + d.incoming, 0)), outgoing: round(daily.reduce((sum, d) => sum + d.outgoing, 0)) };
}
export function getFinanceOverview(state) {
  const forecast = getCashForecast(state), survival = getCashForecast(state, 365, false);
  const runway = state.cash <= 0 ? 0 : survival.firstNegativeDay === null ? 365 : survival.firstNegativeDay - state.day;
  return { forecast, runway, runwayCapped: state.cash > 0 && survival.firstNegativeDay === null,
    dailyBurn: round(getCashForecast(state, FINANCE_CYCLE, false).outgoing / FINANCE_CYCLE),
    receivableTotal: round(state.receivables.filter(r => r.status !== 'defaulted').reduce((sum, r) => sum + r.amount, 0)),
    upcoming: forecast.daily.filter(d => d.incoming > 0 || d.events.some(e => ['tax', 'maintenance', 'interest'].includes(e.category))).slice(0, 6) };
}
export function getMonthlyStatement(state, id = periodId(state.day)) {
  const finance = state.finance || createFinance(state, true);
  const p = finance.periods.find(p => p.id === id) || period(id);
  const previous = finance.periods.find(p => p.id === id - 1);
  const summarize = entry => { const costs = round(Object.values(entry.expenses).reduce((sum, n) => sum + n, 0)); return { ...entry, costs, profit: round(entry.revenue - costs) }; };
  return { current: summarize(p), previous: previous ? summarize(previous) : null };
}
