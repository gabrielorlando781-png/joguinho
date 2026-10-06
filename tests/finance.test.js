import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, acceptProject, advanceDay, takeLoan, repayLoan, collectReceivable, renegotiateReceivable,
  anticipateReceivable, purchaseOfficeItem, buyFurniture, performRoomAction, hireEmployee, interviewCandidate, CANDIDATES, saveGame, loadGame } from '../src/simulation.js';
import { getCashForecast, getFinanceOverview, getMonthlyStatement, getReceivableAction, getCreditOverview, getPayroll,
  receivableDefaults, noteFinanceRevenue, validFinance } from '../src/finance-model.js';

const originalStorage = globalThis.localStorage;
afterEach(() => { if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage; });
function invoiceGame() {
  const state = createGame({ name: 'Ana', company: 'Aurora', age: 28, trait: 'balanced' });
  const project = acceptProject(state, state.leads[0].id).project;
  project.eventTriggered = true;
  while (project.status === 'active') advanceDay(state);
  return { state, project, invoice: state.receivables[0] };
}
function equipAndHire(state, contract = 'CLT') {
  state.office.stage = 'commercial';
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  assert.equal(purchaseOfficeItem(state, 'chair').ok, true);
  assert.equal(interviewCandidate(state, CANDIDATES[0].id).ok, true);
  assert.equal(hireEmployee(state, CANDIDATES[0].id, contract).ok, true);
}

test('30-day forecast reconciles each real day, including weekends, payroll, tax, maintenance, product and capitalized debt', () => {
  const { state, invoice } = invoiceGame();
  assert.ok(invoice);
  equipAndHire(state);
  assert.equal(takeLoan(state).ok, true);
  state.allocation = { sales: 0, delivery: 0, quality: 8 };
  Object.assign(state.product, { unlocked: true, stage: 'launched', progress: 100, research: 2, users: 30, mrr: 1400, nextPaymentDay: state.day + 5 });
  const forecast = getCashForecast(state);
  const baseline = JSON.stringify(state);
  assert.equal(forecast.daily.length, 30);
  assert.equal(JSON.stringify(state), baseline, 'Forecast is read-only.');
  for (const expected of forecast.daily) {
    assert.equal(state.day, expected.day);
    advanceDay(state);
    assert.equal(state.cash, expected.balance, `Cash on D${expected.day}`);
    assert.equal(state.loan.balance, expected.debt, `Debt on D${expected.day}`);
  }
});

test('runway accounts for calendar expenses and scheduled bills without inventing income', () => {
  const state = createGame();
  state.cash = 180;
  assert.equal(getFinanceOverview(state).runway, 2);
  state.finance.taxAccrued = 100;
  state.finance.taxDueDay = state.day;
  assert.equal(getFinanceOverview(state).runway, 0);
  state.cash = 0;
  assert.equal(getFinanceOverview(state).runway, 0);
  state.cash = 1000000;
  assert.equal(getFinanceOverview(state).runwayCapped, true);
});

test('new deliveries provision turnover tax before receipt and the cycle settles it exactly once', () => {
  const { state, project } = invoiceGame();
  const tax = Math.round(project.invoiceAmount * .06 * 100) / 100;
  assert.equal(state.finance.taxAccrued, tax);
  assert.equal(getMonthlyStatement(state).current.revenue, project.invoiceAmount);
  const due = state.finance.taxDueDay;
  while (state.day < due) advanceDay(state);
  const before = state.cash;
  const closing = advanceDay(state).summary;
  assert.equal(closing.taxes, tax);
  assert.equal(state.cash, Math.round((before - closing.costs) * 100) / 100);
  assert.equal(state.finance.taxAccrued, 0);
  assert.equal(state.finance.taxDueDay, due + 28);
  assert.equal(state.finance.periods[0].closed, true);
  advanceDay(state);
  assert.equal(state.ledger.filter(e => e.label === 'Impostos sobre faturamento').length, 1);
});

test('advancing an invoice transfers client risk, applies the quoted fee and cannot pay twice', () => {
  const { state, project, invoice } = invoiceGame();
  const allowed = getReceivableAction(state, invoice, 'anticipate');
  const before = state.cash, hours = state.manualQualityHours;
  assert.equal(anticipateReceivable(state, project.id).ok, true);
  assert.equal(state.cash, Math.round((before + allowed.net) * 100) / 100);
  assert.equal(state.manualQualityHours, hours + .5);
  assert.equal(project.paid, true);
  assert.equal(project.settlementMethod, 'anticipated');
  assert.equal(state.receivables.length, 0);
  assert.equal(getMonthlyStatement(state).current.expenses.fees, allowed.fee);
  const after = JSON.stringify(state);
  assert.equal(anticipateReceivable(state, project.id).ok, false);
  assert.equal(JSON.stringify(state), after);
  while (state.day <= invoice.paymentDay) assert.equal(advanceDay(state).summary.revenue, 0);
});

test('renegotiation moves both promised dates, discounts the note and costs real management time once', () => {
  const { state, project, invoice } = invoiceGame();
  const before = state.cash, due = invoice.dueDay, gross = invoice.amount;
  invoice.riskScore = 30;
  assert.equal(renegotiateReceivable(state, project.id, 7).ok, true);
  assert.equal(invoice.dueDay, due + 7);
  assert.ok(invoice.paymentDay >= invoice.dueDay);
  assert.equal(invoice.amount, Math.round(gross * .98 * 100) / 100);
  assert.equal(invoice.riskScore, 20);
  assert.equal(state.cash, before);
  assert.equal(state.manualQualityHours, .5);
  const after = JSON.stringify(state);
  assert.equal(renegotiateReceivable(state, project.id, 3).ok, false);
  assert.equal(JSON.stringify(state), after);
  while (state.day < invoice.paymentDay) assert.equal(advanceDay(state).summary.revenue, 0);
  assert.equal(advanceDay(state).summary.revenue, invoice.amount);
});

test('missing hours, weekends, unknown titles and premature collections leave all financial fields untouched', () => {
  const { state, project, invoice } = invoiceGame();
  state.manualQualityHours = state.allocation.quality;
  let before = JSON.stringify(state);
  assert.equal(anticipateReceivable(state, project.id).ok, false);
  assert.equal(renegotiateReceivable(state, project.id, 3).ok, false);
  assert.equal(collectReceivable(state, project.id).ok, false);
  assert.equal(JSON.stringify(state), before);
  state.manualQualityHours = 0;
  state.day = 6;
  before = JSON.stringify(state);
  assert.equal(anticipateReceivable(state, project.id).ok, false);
  assert.equal(JSON.stringify(state), before);
  state.day = 1;
  invoice.dueDay = 8;
  before = JSON.stringify(state);
  assert.equal(collectReceivable(state, project.id, 'firm').ok, false);
  assert.equal(collectReceivable(state, 'missing').ok, false);
  assert.equal(renegotiateReceivable(state, project.id, 2).ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('firm collection uses one hour, harms reputation and settles immediately after maturity', () => {
  const { state, project, invoice } = invoiceGame();
  state.day = 8;
  invoice.dueDay = 8; invoice.paymentDay = 10;
  const cash = state.cash, reputation = state.reputation;
  assert.equal(collectReceivable(state, project.id, 'firm').ok, true);
  assert.equal(state.cash, cash + invoice.amount);
  assert.equal(state.reputation, reputation - 1);
  assert.equal(state.manualQualityHours, 1);
});

test('CLT salary and charges are separate, sum to the real debit and do not charge on weekends', () => {
  const state = createGame();
  equipAndHire(state);
  const payroll = getPayroll(state);
  assert.equal(payroll.salary, 2800);
  assert.equal(payroll.charges, 1960);
  const before = state.cash;
  const summary = advanceDay(state).summary;
  assert.equal(summary.costs - summary.maintenance, 145 + 238);
  assert.equal(before - state.cash, summary.costs);
  assert.equal(getMonthlyStatement(state).current.expenses.salary, 140);
  assert.equal(getMonthlyStatement(state).current.expenses.charges, 98);
  state.day = 6;
  assert.equal(advanceDay(state).summary.costs, 145);
});

test('revolving credit respects history limits, accepts cents, cannot overdraw and new draws keep the existing interest date', () => {
  const state = createGame();
  assert.equal(getCreditOverview(state).limit, 2000);
  assert.equal(takeLoan(state, 1000.10).ok, true);
  const due = state.loan.nextInterestDay;
  state.day += 3;
  assert.equal(takeLoan(state, 999.90).ok, true);
  assert.equal(state.loan.nextInterestDay, due);
  const before = JSON.stringify(state);
  assert.equal(takeLoan(state, 1).ok, false);
  assert.equal(takeLoan(state, NaN).ok, false);
  assert.equal(takeLoan(state, 1.001).ok, false);
  assert.equal(JSON.stringify(state), before);
  repayLoan(state, 500);
  assert.equal(getCreditOverview(state).available, 500);
  state.reputation = 40; state.stats.delivered = 3; state.stats.revenue = 12000;
  assert.ok(getCreditOverview(state).limit > 2000);
  assert.equal(takeLoan(state, 1000).ok, true);
});

test('income is counted once, capital movements stay outside profit, and closed results remain stable', () => {
  const { state, project } = invoiceGame();
  const billed = getMonthlyStatement(state).current.revenue;
  assert.equal(billed, project.invoiceAmount);
  takeLoan(state);
  purchaseOfficeItem(state, 'desk');
  assert.equal(getMonthlyStatement(state).current.revenue, billed);
  assert.equal(buyFurniture(state, 'monitors').ok, true);
  assert.equal(getMonthlyStatement(state).current.expenses.other, 0);
  state.office.special.meeting = true;
  assert.equal(performRoomAction(state, 'presentation').ok, true);
  assert.equal(getMonthlyStatement(state).current.expenses.other, 80, 'Client presentations are operating expenses, not construction.');
  while (state.day <= 28) advanceDay(state);
  const closed = structuredClone(getMonthlyStatement(state, 1).current);
  assert.equal(closed.closed, true);
  assert.equal(closed.revenue, billed);
  assert.equal(getMonthlyStatement(state, 2).previous.revenue, billed);
  noteFinanceRevenue(state, 1000);
  advanceDay(state);
  assert.deepEqual(getMonthlyStatement(state, 1).current, closed);
});

test('old saves gain financial history without retrospective taxes, and corrupt finance never overwrites a valid save', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const { state } = invoiceGame();
  delete state.finance;
  assert.equal(saveGame(state).ok, true);
  const restored = loadGame();
  assert.ok(validFinance(restored.finance));
  assert.equal(restored.finance.taxAccrued, 0);
  assert.equal(restored.cash, state.cash);
  assert.equal(restored.finance.importedBeforeDay, state.day);
  assert.equal(saveGame(restored).ok, true);
  const before = values.get('joguinho-save-v1');
  restored.finance.periods[0].expenses.tax = NaN;
  assert.equal(saveGame(restored).ok, false);
  assert.equal(values.get('joguinho-save-v1'), before);
});

test('high-risk defaults are a real write-off, excluded from forecasts and immune to duplicate loss or payment', () => {
  const { state, invoice, project } = invoiceGame();
  invoice.riskScore = 50;
  // Find one deterministic customer outcome; assertions exercise the full settlement path.
  for (let i = 0; i < 100; i++) { invoice.client = `Cliente ${i}`; if (receivableDefaults(state, invoice)) break; }
  assert.equal(receivableDefaults(state, invoice), true);
  state.day = invoice.paymentDay;
  const revenue = state.stats.revenue;
  advanceDay(state);
  assert.equal(invoice.status, 'defaulted');
  assert.equal(project.paid, false);
  assert.equal(state.stats.revenue, revenue);
  assert.equal(getFinanceOverview(state).receivableTotal, 0);
  const losses = getMonthlyStatement(state).current.expenses.losses;
  assert.equal(losses, invoice.amount);
  assert.equal(collectReceivable(state, project.id).ok, false);
  assert.equal(anticipateReceivable(state, project.id).ok, false);
  advanceDay(state);
  assert.equal(getMonthlyStatement(state).current.expenses.losses, losses);
});
