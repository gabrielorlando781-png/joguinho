import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADS, CANDIDATES, FURNITURE,
  createGame, loadGame, saveGame, advanceDay, acceptProject,
  prospect, hireEmployee, buyFurniture, setAllocation, setProjectMode, performAction,
  negotiateProject, discoverLead, interviewCandidate, assignEmployee, resolveProjectEvent,
  collectReceivable, investProduct, recordTravel, takeLoan, repayLoan, setProjectPriority,
  purchaseOfficeItem,
} from '../src/simulation.js';

const originalStorage = globalThis.localStorage;
afterEach(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

function fakeStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}

function projectGame() {
  const state = createGame({ name: 'Ana', company: 'Acme', age: 29, trait: 'balanced' });
  const accepted = acceptProject(state, state.leads[0].id);
  assert.equal(accepted.ok, true);
  // These original core tests isolate delivery/accounting from event decisions.
  // Dedicated event tests below exercise new contracts with events enabled.
  accepted.project.eventTriggered = true;
  return { state, project: accepted.project };
}

function interviewAndHire(state, candidateId, contract = 'PJ') {
  // Core delivery/accounting tests start in an equipped commercial office.
  // Dedicated office tests exercise the real purchase and progression gates.
  state.office.stage = 'commercial';
  if (!state.office.workstations.some((post) => post.desk && post.chair && post.employeeId === null)) {
    state.office.workstations.push({ id: `post-${state.office.nextWorkstationId++}`, desk: true, chair: true, computerLevel: 1, employeeId: null });
  }
  if (state.allocation.quality - state.manualQualityHours < 1) {
    assert.equal(setAllocation(state, 'quality', state.manualQualityHours + 1).ok, true);
  }
  assert.equal(interviewCandidate(state, candidateId).ok, true);
  return hireEmployee(state, candidateId, contract);
}

function resolvePendingEvents(state) {
  for (const event of [...state.pendingEvents]) {
    const resolved = event.options.some((option) => resolveProjectEvent(state, event.id, option.id).ok);
    assert.equal(resolved, true, 'Every event must offer an affordable way to continue');
  }
}

function finishFirstProject(state, project) {
  for (let guard = 0; guard < 60 && project.status !== 'delivered'; guard += 1) {
    resolvePendingEvents(state);
    advanceDay(state);
  }
  assert.equal(project.status, 'delivered');
}

test('new companies have independent state, a sanitized profile and the agreed starting budget', () => {
  const state = createGame({ name: ' Ana ', company: ' Acme ', age: 999, trait: 'technical', avatarColor: '#123abc' });
  const other = createGame();
  assert.deepEqual(state.profile, { name: 'Ana', company: 'Acme', age: 85, avatarColor: '#123abc', trait: 'technical' });
  assert.equal(state.cash, 20000);
  assert.equal(state.day, 1);
  assert.equal(state.energy, 100);
  assert.equal(state.reputation, 12);
  assert.deepEqual(state.allocation, { sales: 2, delivery: 5, quality: 1 });
  assert.equal(state.leads.length, 3);
  state.leads[0].price = 1;
  state.allocation.delivery = 2;
  assert.equal(other.leads[0].price, LEADS[0].price);
  assert.equal(other.allocation.delivery, 5);
});

test('accepting contracts never credits their price immediately and caps concurrent work at three', () => {
  const state = createGame();
  for (const lead of [...state.leads]) assert.equal(acceptProject(state, lead.id).ok, true);
  assert.equal(state.cash, 20000);
  assert.equal(state.projects.length, 3);
  assert.equal(prospect(state).ok, true);
  assert.equal(acceptProject(state, state.leads[0].id).ok, false);
  assert.equal(state.projects.length, 3);
  assert.equal(acceptProject(state, 'missing').ok, false);
});

test('daily manual work cannot be spammed or added on top of the eight-hour allocation', () => {
  const { state, project } = projectGame();
  assert.equal(performAction(state, 'work').ok, true);
  const progress = project.progress;
  assert.equal(state.manualDeliveryHours, 2);
  assert.equal(performAction(state, 'work').ok, false);
  assert.equal(project.progress, progress);
  advanceDay(state);
  assert.ok(state.stats.hoursWorked <= 5.01, `Actual delivery work was ${state.stats.hoursWorked}h`);
  assert.ok(project.progress <= 5.01);
  assert.equal(state.actionHours, 0);
  assert.equal(performAction(state, 'work').ok, true);
});

test('allocation changes rebalance a finite eight-hour budget and respect time already spent', () => {
  const { state } = projectGame();
  assert.equal(setAllocation(state, 'sales', 4).ok, true);
  assert.deepEqual(state.allocation, { sales: 4, delivery: 3, quality: 1 });
  performAction(state, 'work');
  const unchanged = { ...state.allocation };
  assert.equal(setAllocation(state, 'delivery', 0).ok, false);
  assert.deepEqual(state.allocation, unchanged);
  assert.equal(setAllocation(state, 'sales', 8).ok, false);
  advanceDay(state);
  for (const [key, value] of [['quality', 6], ['sales', 8], ['delivery', 9], ['delivery', -3]]) {
    assert.equal(setAllocation(state, key, value).ok, true);
    assert.equal(Object.values(state.allocation).reduce((sum, hours) => sum + hours, 0), 8);
    assert.ok(Object.values(state.allocation).every((hours) => Number.isInteger(hours) && hours >= 0 && hours <= 8));
  }
  assert.equal(setAllocation(state, 'unknown', 2).ok, false);
  assert.equal(setAllocation(state, 'delivery', NaN).ok, false);
});

test('completed projects become receivables and are paid only on their due day', () => {
  const { state, project } = projectGame();
  finishFirstProject(state, project);
  assert.equal(project.paid, false);
  assert.equal(state.stats.delivered, 1);
  assert.equal(state.stats.revenue, 0);
  assert.equal(state.receivables.length, 1);
  assert.equal(project.dueDay - project.completedDay, 3);
  while (state.day < project.dueDay) {
    const { summary } = advanceDay(state);
    assert.equal(summary.revenue, 0);
  }
  const before = state.cash;
  const paid = advanceDay(state);
  assert.equal(paid.summary.revenue, project.invoiceAmount);
  assert.equal(state.cash, before + project.invoiceAmount - paid.summary.costs);
  assert.equal(state.stats.revenue, project.invoiceAmount);
  assert.equal(project.paid, true);
  assert.equal(state.receivables.length, 0);
  assert.equal(advanceDay(state).summary.revenue, 0);
});

test('late, low-quality delivery reduces the invoice and reputation', () => {
  const { state, project } = projectGame();
  project.deadline = 1;
  project.quality = 30;
  setAllocation(state, 'quality', 0);
  finishFirstProject(state, project);
  assert.ok(project.invoiceAmount < project.price);
  assert.ok(project.completedDay > project.deadline);
  assert.ok(state.reputation < 12);
  assert.equal(project.invoiceAmount, Math.round(project.price * 0.9 * 0.85));
});

test('rushing is faster but creates more technical debt and lower quality than careful work', () => {
  const fast = projectGame();
  const careful = projectGame();
  setAllocation(fast.state, 'quality', 0);
  setAllocation(careful.state, 'quality', 0);
  assert.equal(setProjectMode(fast.state, fast.project.id, 'fast').ok, true);
  assert.equal(setProjectMode(careful.state, careful.project.id, 'careful').ok, true);
  finishFirstProject(fast.state, fast.project);
  finishFirstProject(careful.state, careful.project);
  assert.ok(fast.project.completedDay < careful.project.completedDay);
  assert.ok(fast.state.debt > careful.state.debt);
  assert.ok(fast.project.quality < careful.project.quality);
  assert.equal(setProjectMode(fast.state, fast.project.id, 'standard').ok, false);
  assert.equal(setProjectMode(careful.state, 'missing', '__proto__').ok, false);
});

test('review consumes quality time, lowers debt, and cannot be repeated within a day', () => {
  const { state, project } = projectGame();
  state.debt = 15;
  const quality = project.quality;
  assert.equal(performAction(state, 'review').ok, true);
  assert.equal(state.debt, 9);
  assert.ok(project.quality > quality);
  assert.equal(state.manualQualityHours, 1);
  assert.equal(performAction(state, 'review').ok, false);
  assert.equal(setAllocation(state, 'quality', 0).ok, false);
  advanceDay(state);
  assert.equal(performAction(state, 'review').ok, true);
});

test('coffee and rest cost money, cap energy, and have daily limits', () => {
  const state = createGame();
  assert.equal(performAction(state, 'coffee').ok, false);
  state.energy = 20;
  assert.equal(performAction(state, 'coffee').ok, true);
  assert.equal(state.cash, 19985);
  assert.equal(state.energy, 34);
  assert.equal(performAction(state, 'coffee').ok, true);
  assert.equal(performAction(state, 'coffee').ok, false);
  assert.equal(performAction(state, 'rest').ok, true);
  assert.equal(state.energy, 78);
  assert.equal(state.cash, 19930);
  assert.equal(performAction(state, 'rest').ok, false);
  state.cash = 0;
  advanceDay(state);
  assert.equal(performAction(state, 'coffee').ok, false);
});

test('prospecting yields unique contacts, consumes sales time, and prevents repeated free leads', () => {
  const state = createGame();
  assert.equal(prospect(state).ok, true);
  const count = state.leads.length;
  const nextId = state.nextLeadId;
  for (let i = 0; i < 20; i += 1) assert.equal(prospect(state).ok, false);
  assert.equal(state.leads.length, count);
  assert.equal(state.nextLeadId, nextId);
  assert.equal(setAllocation(state, 'sales', 0).ok, false);
  advanceDay(state);
  assert.equal(prospect(state).ok, true);
  const ids = state.leads.map((lead) => lead.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(state.leads.length <= 6);
});

test('sales allocation creates contacts over time and zero sales creates none', () => {
  const selling = createGame();
  const deliveryOnly = createGame();
  setAllocation(deliveryOnly, 'sales', 0);
  for (let i = 0; i < 5; i += 1) {
    advanceDay(selling);
    advanceDay(deliveryOnly);
  }
  assert.equal(deliveryOnly.leads.length, 3);
  assert.equal(selling.leads.length, 4);
});

test('weekends stop delivery and payroll while recovering energy and charging fixed costs', () => {
  const { state, project } = projectGame();
  interviewAndHire(state, CANDIDATES[0].id);
  state.day = 6;
  state.energy = 30;
  const before = project.progress;
  const day = advanceDay(state);
  assert.equal(day.summary.weekend, true);
  assert.equal(day.summary.hoursWorked, 0);
  assert.equal(day.summary.costs, 145);
  assert.equal(project.progress, before);
  assert.equal(state.energy, 55);
  assert.equal(performAction(state, 'work').ok, false);
  assert.equal(prospect(state).ok, false);
});

test('staff increase delivery capacity and daily payroll distinguishes PJ and CLT', () => {
  const pj = projectGame();
  const clt = projectGame();
  assert.equal(interviewAndHire(pj.state, 'lucas', 'PJ').ok, true);
  assert.equal(interviewAndHire(clt.state, 'lucas', 'CLT').ok, true);
  assert.equal(pj.state.cash, 20000);
  assert.equal(hireEmployee(pj.state, 'lucas').ok, false);
  assert.equal(hireEmployee(pj.state, 'missing').ok, false);
  assert.equal(hireEmployee(pj.state, 'bia', 'invalid').ok, false);
  const pjDay = advanceDay(pj.state);
  const cltDay = advanceDay(clt.state);
  assert.equal(pjDay.summary.costs, 145 + CANDIDATES[0].salary / 20 * 1.15);
  assert.equal(cltDay.summary.costs, 145 + CANDIDATES[0].salary / 20 * 1.7);
  assert.ok(pj.project.progress > 5);
  assert.ok(pjDay.summary.hoursWorked > 5);
});

test('legacy furniture remains a one-time purchase with an actual productivity effect', () => {
  const state = createGame();
  assert.equal(buyFurniture(state, 'desk').ok, true);
  assert.equal(state.cash, 20000 - FURNITURE.find((item) => item.id === 'desk').price);
  assert.equal(interviewCandidate(state, 'bia').ok, true);
  assert.equal(hireEmployee(state, 'bia').ok, true);
  const balance = state.cash;
  assert.equal(buyFurniture(state, 'desk').ok, false);
  assert.equal(state.cash, balance);
  const plain = projectGame();
  const equipped = projectGame();
  buyFurniture(equipped.state, 'monitors');
  advanceDay(plain.state);
  advanceDay(equipped.state);
  assert.ok(equipped.project.progress > plain.project.progress);
});

test('trait bonuses affect the corresponding activity', () => {
  const technical = projectGame();
  const balanced = projectGame();
  technical.state.profile.trait = 'technical';
  advanceDay(technical.state);
  advanceDay(balanced.state);
  assert.ok(technical.project.progress > balanced.project.progress);
  const commercial = createGame({ trait: 'commercial' });
  advanceDay(commercial);
  assert.ok(commercial.salesProgress > balanced.state.salesProgress);
});

test('sixty consecutive days with negative cash lead to bankruptcy and stop further mutations', () => {
  const state = createGame();
  interviewAndHire(state, 'lucas', 'CLT');
  interviewAndHire(state, 'bia', 'CLT');
  for (let day = 0; day < 60 && state.cash >= 0; day += 1) advanceDay(state);
  assert.ok(state.cash < 0);
  assert.equal(state.consecutiveNegativeDays, 1);
  assert.equal(state.bankrupt, false);
  while (state.consecutiveNegativeDays < 59) advanceDay(state);
  assert.equal(state.bankrupt, false);
  advanceDay(state);
  assert.equal(state.consecutiveNegativeDays, 60);
  assert.equal(state.bankrupt, true);
  assert.equal(state.status, 'bankrupt');
  assert.equal(state.paused, true);
  const snapshot = JSON.stringify(state);
  assert.equal(advanceDay(state).ok, false);
  assert.equal(acceptProject(state, state.leads[0]?.id).ok, false);
  assert.equal(buyFurniture(state, 'desk').ok, false);
  assert.equal(hireEmployee(state, 'marina').ok, false);
  assert.equal(setAllocation(state, 'sales', 8).ok, false);
  assert.equal(discoverLead(state, state.leads[0]?.id).ok, false);
  assert.equal(interviewCandidate(state, 'marina').ok, false);
  assert.equal(assignEmployee(state, 'lucas', 'auto', 'quality').ok, false);
  assert.equal(resolveProjectEvent(state, 'missing', 'wait').ok, false);
  assert.equal(collectReceivable(state, 'missing').ok, false);
  assert.equal(investProduct(state, 'prototype').ok, false);
  assert.equal(recordTravel(state, 100).ok, false);
  assert.equal(takeLoan(state).ok, false);
  assert.equal(repayLoan(state, 100).ok, false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('recovering positive cash resets the bankruptcy countdown', () => {
  const { state, project } = projectGame();
  finishFirstProject(state, project);
  state.cash = -100;
  advanceDay(state);
  assert.equal(state.consecutiveNegativeDays, 1);
  while (state.day <= project.dueDay) advanceDay(state);
  assert.equal(project.paid, true);
  assert.ok(state.cash > 0);
  assert.equal(state.consecutiveNegativeDays, 0);
  assert.equal(state.bankrupt, false);
});

test('energy, reputation, debt, histories, and lead counts stay bounded in a long company run', () => {
  const state = createGame();
  setAllocation(state, 'quality', 0);
  for (let day = 0; day < 130 && !state.bankrupt; day += 1) {
    if (state.leads.length && state.projects.filter((p) => p.status === 'active').length < 2) {
      const { project } = acceptProject(state, state.leads[0].id);
      setProjectMode(state, project.id, 'fast');
    }
    resolvePendingEvents(state);
    advanceDay(state);
    for (const key of ['energy', 'reputation', 'debt']) assert.ok(state[key] >= 0 && state[key] <= 100);
    assert.ok(state.leads.length <= 6);
  }
  assert.ok(state.history.length <= 120);
  assert.ok(state.log.length <= 80);
  assert.ok(state.ledger.length <= 200);
});

test('versioned saves round-trip the company and restore it paused', () => {
  const storage = fakeStorage();
  const { state } = projectGame();
  performAction(state, 'work');
  state.paused = false;
  assert.equal(saveGame(state).ok, true);
  assert.equal(JSON.parse(storage.get('joguinho-save-v1')).version, 3);
  const restored = loadGame();
  assert.deepEqual(restored, { ...state, paused: true });
  assert.equal(advanceDay(restored).ok, true);
});

test('malformed, incompatible, or corrupted nested saves are rejected safely', () => {
  const storage = fakeStorage();
  assert.equal(loadGame(), null);
  const valid = createGame();
  saveGame(valid);
  const [key] = storage.keys();
  for (const value of ['{', 'null', '{}', JSON.stringify({ version: 999, state: valid })]) {
    storage.set(key, value);
    assert.equal(loadGame(), null);
  }
  const mutations = [
    (state) => { state.projects = [{ status: 'active' }]; },
    (state) => { state.employees = [{ id: 'lucas' }]; },
    (state) => { state.allocation.delivery = 100; },
    (state) => { state.receivables = [{ dueDay: 'tomorrow' }]; },
    (state) => { state.stats = null; },
    (state) => { state.profile = null; },
    (state) => { state.debt = -10; },
    (state) => { state.dailyActions = null; },
    (state) => { state.manualSalesHours = 'invalid'; },
  ];
  for (const mutate of mutations) {
    const corrupted = structuredClone(valid);
    mutate(corrupted);
    storage.set(key, JSON.stringify({ version: 3, state: corrupted }));
    assert.equal(loadGame(), null);
  }
});

test('storage unavailability or browser storage errors never crash the simulation', () => {
  delete globalThis.localStorage;
  assert.equal(loadGame(), null);
  assert.equal(saveGame(createGame()).ok, false);
  globalThis.localStorage = {
    getItem() { throw new Error('Denied'); },
    setItem() { throw new Error('Quota exceeded'); },
  };
  assert.equal(loadGame(), null);
  assert.equal(saveGame(createGame()).ok, false);
});

test('new companies initialize independent current progression, travel, interviews, and credit state', () => {
  const first = createGame();
  const second = createGame();
  assert.equal(first.version, 3);
  assert.deepEqual(first.interviews, {});
  assert.deepEqual(first.pendingEvents, []);
  assert.deepEqual(first.officePosition, { x: 0, y: 0 });
  assert.equal(first.travelHours, 0);
  assert.equal(first.product.unlocked, false);
  assert.equal(first.product.progress, 0);
  assert.equal(first.product.research, 0);
  assert.equal(first.loan.balance, 0);
  assert.equal(first.loan.interest, 0.02);
  first.officePosition.x = 40;
  first.product.progress = 10;
  assert.equal(second.officePosition.x, 0);
  assert.equal(second.product.progress, 0);
});

test('discovery reveals scope and estimates once and shares finite sales time with prospecting', () => {
  const state = createGame();
  const lead = state.leads[0];
  assert.equal(setAllocation(state, 'sales', 1).ok, true);
  assert.equal(discoverLead(state, 'missing').ok, false);
  assert.equal(discoverLead(state, lead.id).ok, true);
  assert.equal(lead.discovered, true);
  assert.ok(lead.estimateMin > 0);
  assert.ok(lead.estimateMax >= lead.estimateMin);
  assert.ok(lead.qualification.confidence > 0);
  assert.equal(typeof lead.qualification.scope, 'string');
  assert.equal(typeof lead.qualification.risks, 'string');
  assert.equal(state.manualSalesHours, 1);
  assert.equal(state.actionHours, 1);
  const afterDiscovery = JSON.stringify(state);
  assert.equal(discoverLead(state, lead.id).ok, false);
  assert.equal(discoverLead(state, state.leads[1].id).ok, false);
  assert.equal(prospect(state).ok, false);
  assert.equal(JSON.stringify(state), afterDiscovery);
  assert.equal(setAllocation(state, 'sales', 0).ok, false);
  advanceDay(state);
  assert.equal(discoverLead(state, lead.id).ok, false);
  assert.equal(discoverLead(state, state.leads[1].id).ok, true);
});

test('negotiating signs exactly one contract with the selected price and never credits cash upfront', () => {
  const prices = {};
  for (const pricing of ['standard', 'discount', 'premium']) {
    const state = createGame();
    state.reputation = 30;
    const lead = state.leads[0];
    const originalPrice = lead.price;
    const { project, ok } = negotiateProject(state, lead.id, pricing);
    assert.equal(ok, true);
    assert.equal(state.cash, 20000);
    assert.equal(state.projects.length, 1);
    assert.equal(project.pricing, pricing);
    prices[pricing] = project.price;
    if (pricing === 'standard') assert.equal(project.price, originalPrice);
    assert.equal(negotiateProject(state, lead.id, 'discount').ok, false);
    assert.equal(state.projects.length, 1);
  }
  assert.ok(prices.discount < prices.standard);
  assert.ok(prices.premium > prices.standard);
  const state = createGame();
  const lead = state.leads[0];
  const baseline = lead.price;
  assert.equal(negotiateProject(state, lead.id, 'premium').ok, false);
  assert.equal(discoverLead(state, lead.id).ok, true);
  const premium = negotiateProject(state, lead.id, 'premium');
  assert.equal(premium.ok, true);
  assert.ok(premium.project.price > baseline);
  assert.equal(negotiateProject(state, lead.id, 'standard').ok, false);
  assert.equal(premium.project.pricing, 'premium');
  assert.equal(negotiateProject(state, 'missing', 'standard').ok, false);
  assert.equal(negotiateProject(state, state.leads[0].id, '__proto__').ok, false);
});

test('founder priorities concentrate delivery on the selected project and can return to deadline order', () => {
  const state = createGame();
  const first = acceptProject(state, state.leads[0].id).project;
  const second = acceptProject(state, state.leads[0].id).project;
  first.eventTriggered = true;
  second.eventTriggered = true;
  assert.equal(setProjectPriority(state, second.id).ok, true);
  advanceDay(state);
  assert.equal(first.progress, 0);
  assert.ok(second.progress > 0);
  const progress = second.progress;
  assert.equal(setProjectPriority(state, 'auto').ok, true);
  advanceDay(state);
  assert.ok(first.progress > 0);
  assert.equal(second.progress, progress);
  assert.equal(state.focusProjectId, null);
  assert.equal(setProjectPriority(state, 'missing').ok, false);
});

test('hiring requires an interview and interviews share quality time with code review', () => {
  const { state } = projectGame();
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  const post = state.office.workstations.find((item) => item.employeeId === null);
  assert.equal(purchaseOfficeItem(state, 'chair', { workstationId: post.id }).ok, true);
  const before = JSON.stringify(state);
  assert.equal(hireEmployee(state, 'lucas').ok, false);
  assert.equal(interviewCandidate(state, 'missing').ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(interviewCandidate(state, 'lucas').ok, true);
  const interview = state.interviews.lucas;
  assert.equal(interview.candidateId, 'lucas');
  assert.equal(interview.day, state.day);
  assert.ok(Number.isFinite(interview.score));
  assert.equal(typeof interview.strength, 'string');
  assert.equal(typeof interview.risk, 'string');
  assert.equal(state.manualQualityHours, 1);
  assert.equal(performAction(state, 'review').ok, false);
  assert.equal(interviewCandidate(state, 'marina').ok, false);
  assert.equal(setAllocation(state, 'quality', 0).ok, false);
  assert.equal(hireEmployee(state, 'lucas', 'CLT').ok, true);
  assert.equal(state.employees[0].assignment, 'auto');
  assert.equal(state.employees[0].assignmentRole, 'delivery');
  assert.ok(state.employees[0].morale >= 0 && state.employees[0].morale <= 100);
  assert.ok(state.employees[0].stress >= 0 && state.employees[0].stress <= 100);
  advanceDay(state);
  assert.equal(interviewCandidate(state, 'lucas').ok, false);
  assert.equal(interviewCandidate(state, 'marina').ok, true);
});

test('employee delivery assignments target a chosen client and automatic assignments prioritize deadlines', () => {
  const state = createGame();
  assert.equal(interviewAndHire(state, 'lucas').ok, true);
  advanceDay(state);
  const first = acceptProject(state, state.leads[0].id).project;
  const second = acceptProject(state, state.leads[0].id).project;
  first.eventTriggered = true;
  second.eventTriggered = true;
  assert.ok(first.deadline < second.deadline);
  assert.equal(setAllocation(state, 'sales', 8).ok, true);
  assert.equal(assignEmployee(state, 'lucas', second.id, 'delivery').ok, true);
  advanceDay(state);
  assert.equal(first.progress, 0);
  assert.ok(second.progress > 0);
  const progress = second.progress;
  assert.equal(assignEmployee(state, 'lucas', 'auto', 'delivery').ok, true);
  advanceDay(state);
  assert.ok(first.progress > 0);
  assert.equal(second.progress, progress);
  const snapshot = JSON.stringify(state);
  assert.equal(assignEmployee(state, 'missing', first.id, 'delivery').ok, false);
  assert.equal(assignEmployee(state, 'lucas', 'missing', 'delivery').ok, false);
  assert.equal(assignEmployee(state, 'lucas', first.id, 'sales').ok, false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('employees assigned to quality improve a project without contributing delivery hours', () => {
  const state = createGame();
  assert.equal(interviewAndHire(state, 'lucas').ok, true);
  advanceDay(state);
  const project = acceptProject(state, state.leads[0].id).project;
  project.quality = 40;
  state.debt = 35;
  assert.equal(setAllocation(state, 'sales', 8).ok, true);
  assert.equal(assignEmployee(state, 'lucas', project.id, 'quality').ok, true);
  advanceDay(state);
  assert.equal(project.progress, 0);
  assert.ok(project.quality > 40);
  assert.ok(state.debt < 35);
});

test('project events are deterministic, require a valid decision, and occur only once per contract', () => {
  const state = createGame();
  const project = acceptProject(state, state.leads[0].id).project;
  const same = structuredClone(state);
  for (let guard = 0; guard < 20 && !state.pendingEvents.length; guard += 1) {
    advanceDay(state);
    advanceDay(same);
  }
  assert.equal(state.pendingEvents.length, 1);
  assert.deepEqual(state.pendingEvents, same.pendingEvents);
  const event = state.pendingEvents[0];
  assert.equal(event.projectId, project.id);
  assert.ok(project.progress >= project.hours * 0.3);
  assert.ok(event.options.length >= 2);
  assert.equal(new Set(event.options.map((option) => option.id)).size, event.options.length);
  const before = JSON.stringify(state);
  assert.equal(resolveProjectEvent(state, event.id, 'missing-choice').ok, false);
  assert.equal(resolveProjectEvent(state, 'missing-event', event.options[0].id).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(setAllocation(state, 'quality', 3).ok, true);
  const consequences = JSON.stringify({ project, cash: state.cash, debt: state.debt, energy: state.energy });
  resolvePendingEvents(state);
  assert.equal(state.pendingEvents.length, 0);
  assert.notEqual(JSON.stringify({ project, cash: state.cash, debt: state.debt, energy: state.energy }), consequences);
  assert.equal(resolveProjectEvent(state, event.id, event.options[0].id).ok, false);
  assert.equal(project.eventTriggered, true);
  for (let guard = 0; guard < 60 && project.status !== 'delivered'; guard += 1) {
    advanceDay(state);
    assert.equal(state.pendingEvents.some((pending) => pending.projectId === project.id), false);
  }
  assert.equal(project.status, 'delivered');
  assert.equal(state.pendingEvents.length, 0);
});

test('receivable follow-up cannot collect before maturity or credit an invoice twice', () => {
  const { state, project } = projectGame();
  finishFirstProject(state, project);
  const before = JSON.stringify(state);
  assert.equal(collectReceivable(state, project.id).ok, false);
  assert.equal(collectReceivable(state, 'missing').ok, false);
  assert.equal(JSON.stringify(state), before);
  // Skip directly to an overdue invoice to isolate collection from automatic settlement.
  state.day = project.dueDay + 1;
  const cash = state.cash;
  const revenue = state.stats.revenue;
  assert.equal(collectReceivable(state, project.id).ok, true);
  assert.equal(project.paid, true);
  assert.equal(state.cash, cash + project.invoiceAmount);
  assert.equal(state.stats.revenue, revenue + project.invoiceAmount);
  assert.equal(collectReceivable(state, project.id).ok, false);
  assert.equal(state.cash, cash + project.invoiceAmount);
  assert.equal(advanceDay(state).summary.revenue, 0);
});

test('a premium invoice can be delayed and one follow-up brings the confirmed payment forward', () => {
  const state = createGame();
  state.reputation = 30;
  const project = negotiateProject(state, state.leads[0].id, 'premium').project;
  project.eventTriggered = true;
  finishFirstProject(state, project);
  const receivable = state.receivables[0];
  assert.ok(receivable.paymentDay > receivable.dueDay);
  // Financial actions consume management hours on business days.
  while ((receivable.dueDay - 1) % 7 >= 5) receivable.dueDay += 1;
  receivable.paymentDay = receivable.dueDay + 2;
  while (state.day < receivable.dueDay) advanceDay(state);
  assert.equal(project.paid, false);
  const originalPaymentDay = receivable.paymentDay;
  const cash = state.cash;
  assert.equal(collectReceivable(state, project.id).ok, true);
  assert.equal(receivable.followupCount, 1);
  assert.ok(receivable.paymentDay < originalPaymentDay);
  assert.equal(state.cash, cash);
  const afterFollowUp = JSON.stringify(state);
  assert.equal(collectReceivable(state, project.id).ok, false);
  assert.equal(JSON.stringify(state), afterFollowUp);
  while (state.day < receivable.paymentDay) assert.equal(advanceDay(state).summary.revenue, 0);
  assert.equal(advanceDay(state).summary.revenue, project.invoiceAmount);
  assert.equal(project.paid, true);
});

function nextWorkDay(state) {
  advanceDay(state);
  while ((state.day - 1) % 7 >= 5) advanceDay(state);
}

test('a product unlocks after two deliveries and needs research as well as a funded prototype to launch', () => {
  const { state, project } = projectGame();
  const initial = JSON.stringify(state);
  assert.equal(investProduct(state, 'prototype').ok, false);
  assert.equal(JSON.stringify(state), initial);
  finishFirstProject(state, project);
  assert.equal(state.product.unlocked, false);
  assert.equal(investProduct(state, 'research').ok, false);
  const second = acceptProject(state, state.leads[0].id).project;
  second.eventTriggered = true;
  finishFirstProject(state, second);
  assert.equal(state.product.unlocked, true);
  if ((state.day - 1) % 7 >= 5) nextWorkDay(state);
  const cash = state.cash;
  assert.equal(investProduct(state, 'research').ok, true);
  assert.equal(state.product.research, 1);
  assert.equal(state.cash, cash - 150);
  assert.equal(state.manualQualityHours, 1);
  assert.equal(investProduct(state, 'prototype').ok, false);
  for (let count = 0; count < 10; count += 1) {
    nextWorkDay(state);
    const cashBefore = state.cash;
    assert.equal(investProduct(state, 'prototype').ok, true);
    assert.equal(state.cash, cashBefore - 300);
    assert.equal(state.manualDeliveryHours, 2);
    assert.equal(state.product.progress, (count + 1) * 10);
    assert.equal(investProduct(state, 'prototype').ok, false);
  }
  assert.equal(state.product.mrr, 0);
  nextWorkDay(state);
  assert.equal(investProduct(state, 'research').ok, true);
  assert.equal(state.product.research, 2);
  assert.ok(state.product.mrr > 0);
  assert.ok(state.product.users > 0);
  const dueDay = state.product.nextPaymentDay;
  assert.ok(dueDay > state.day);
  while (state.day < dueDay) advanceDay(state);
  const revenue = state.stats.revenue;
  advanceDay(state);
  assert.ok(state.stats.revenue > revenue);
  assert.ok(state.product.nextPaymentDay > dueDay);
});

test('product investment consumes allocated founder hours and rejects invalid or unfunded work', () => {
  const { state, project } = projectGame();
  state.stats.delivered = 2;
  state.product.unlocked = true;
  assert.equal(investProduct(state, 'prototype').ok, true);
  assert.equal(setAllocation(state, 'delivery', 1).ok, false);
  assert.equal(performAction(state, 'work').ok, true);
  assert.equal(state.manualDeliveryHours, 4);
  advanceDay(state);
  assert.ok(project.progress <= 3.01, `Only three of five founder hours were available to this client: ${project.progress}`);
  const before = JSON.stringify(state);
  assert.equal(investProduct(state, 'missing').ok, false);
  assert.equal(JSON.stringify(state), before);
  state.cash = 100;
  assert.equal(investProduct(state, 'research').ok, false);
  assert.equal(investProduct(state, 'prototype').ok, false);
});

test('office travel caps at forty-five minutes and reduces the same founder delivery budget', () => {
  const plain = projectGame();
  const walking = projectGame();
  const before = JSON.stringify(walking.state);
  assert.equal(recordTravel(walking.state, -1).ok, false);
  assert.equal(recordTravel(walking.state, NaN).ok, false);
  assert.equal(JSON.stringify(walking.state), before);
  assert.equal(recordTravel(walking.state, 700).ok, true);
  assert.equal(walking.state.travelHours, 0.5);
  assert.equal(recordTravel(walking.state, 1400).ok, true);
  assert.equal(walking.state.travelHours, 0.75);
  recordTravel(walking.state, 1400);
  assert.equal(walking.state.travelHours, 0.75);
  advanceDay(plain.state);
  advanceDay(walking.state);
  assert.ok(walking.project.progress < plain.project.progress);
  assert.ok(walking.state.stats.hoursWorked <= 4.26);
  assert.equal(walking.state.travelHours, 0);
});

test('working-capital credit is bounded by its revolving limit, supports partial repayment, and never silently spends excess cash', () => {
  const state = createGame();
  assert.equal(takeLoan(state).ok, true);
  assert.equal(state.cash, 22000);
  assert.equal(state.loan.balance, 2000);
  const afterLoan = JSON.stringify(state);
  assert.equal(takeLoan(state).ok, false);
  assert.equal(JSON.stringify(state), afterLoan);
  assert.equal(repayLoan(state, 500).ok, true);
  assert.equal(state.cash, 21500);
  assert.equal(state.loan.balance, 1500);
  const afterPartial = JSON.stringify(state);
  assert.equal(repayLoan(state, -1).ok, false);
  assert.equal(repayLoan(state, NaN).ok, false);
  assert.equal(JSON.stringify(state), afterPartial);
  state.cash = 50;
  const lowCash = JSON.stringify(state);
  assert.equal(repayLoan(state, 100).ok, false);
  assert.equal(JSON.stringify(state), lowCash);
  state.cash = 2000;
  assert.equal(repayLoan(state).ok, true);
  assert.equal(state.cash, 500);
  assert.equal(state.loan.balance, 0);
  assert.equal(repayLoan(state).ok, false);
  assert.equal(takeLoan(state).ok, true);
});

test('loan interest accrues on the outstanding balance and stops after full repayment', () => {
  const state = createGame();
  takeLoan(state);
  repayLoan(state, 500);
  const dueDay = state.loan.nextInterestDay;
  while (state.day < dueDay) advanceDay(state);
  assert.equal(state.loan.balance, 1500);
  const balance = state.loan.balance;
  const cash = state.cash;
  const interestDay = advanceDay(state);
  assert.equal(state.loan.balance, Math.round(balance * (1 + state.loan.interest) * 100) / 100);
  assert.equal(state.cash, cash - interestDay.summary.costs);
  assert.ok(state.loan.nextInterestDay > dueDay);
  repayLoan(state);
  const nextDueDay = state.loan.nextInterestDay;
  while (state.day <= nextDueDay) advanceDay(state);
  assert.equal(state.loan.balance, 0);
});

test('v1 saves migrate in the original storage key while preserving the company and adding safe current defaults', () => {
  const storage = fakeStorage();
  const { state, project } = projectGame();
  interviewAndHire(state, 'lucas', 'CLT');
  state.cash = 12345;
  state.officePosition = { x: 400, y: 300 };
  const oldKeys = [
    'version', 'profile', 'day', 'cash', 'reputation', 'energy', 'debt', 'allocation',
    'projects', 'leads', 'employees', 'furniture', 'receivables', 'ledger', 'log', 'history',
    'stats', 'speed', 'paused', 'status', 'bankrupt', 'consecutiveNegativeDays', 'nextLeadId',
    'salesProgress', 'actionHours', 'manualDeliveryHours', 'manualQualityHours', 'manualSalesHours', 'dailyActions',
  ];
  const legacy = structuredClone(Object.fromEntries(oldKeys.map((key) => [key, state[key]])));
  legacy.version = 1;
  delete legacy.projects[0].eventTriggered;
  for (const employee of legacy.employees) {
    for (const key of ['morale', 'stress', 'assignment', 'assignmentRole']) delete employee[key];
  }
  legacy.dailyActions = { coffee: 0, rest: 0, work: 0, review: 0, prospect: 0 };
  storage.set('joguinho-save-v1', JSON.stringify({ version: 1, state: legacy }));
  const restored = loadGame();
  assert.ok(restored);
  assert.equal(restored.version, 3);
  assert.equal(restored.paused, true);
  assert.equal(restored.cash, 12345);
  assert.deepEqual(restored.profile, state.profile);
  assert.equal(restored.projects[0].id, project.id);
  assert.equal(restored.projects[0].progress, project.progress);
  assert.equal(restored.projects[0].eventTriggered, true);
  assert.equal(restored.employees[0].contract, 'CLT');
  assert.equal(restored.employees[0].assignment, 'auto');
  assert.ok(Number.isFinite(restored.employees[0].morale));
  assert.deepEqual(restored.officePosition, { x: 0, y: 0 });
  assert.deepEqual(restored.pendingEvents, []);
  assert.equal(restored.travelHours, 0);
  assert.equal(restored.loan.balance, 0);
  assert.equal(advanceDay(restored).ok, true);
  assert.equal(saveGame(restored).ok, true);
  assert.equal(JSON.parse(storage.get('joguinho-save-v1')).version, 3);
  const corruptLegacy = structuredClone(legacy);
  corruptLegacy.profile = null;
  storage.set('joguinho-save-v1', JSON.stringify({ version: 1, state: corruptLegacy }));
  assert.equal(loadGame(), null);
});

test('current saves reject corrupt nested fields rather than trusting invalid economy or event data', () => {
  const storage = fakeStorage();
  const valid = createGame();
  interviewAndHire(valid, 'lucas');
  const mutations = [
    (state) => { state.travelHours = 12; },
    (state) => { state.officePosition.x = 'outside'; },
    (state) => { state.loan.balance = -100; },
    (state) => { state.product.progress = 101; },
    (state) => { state.product.research = -1; },
    (state) => { state.interviews = null; },
    (state) => { state.interviews.lucas = { candidateId: 'missing' }; },
    (state) => { state.employees[0].morale = 101; },
    (state) => { state.employees[0].stress = 'overworked'; },
    (state) => { state.pendingEvents = [{ id: 'broken', options: null }]; },
  ];
  for (const mutate of mutations) {
    const corrupted = structuredClone(valid);
    mutate(corrupted);
    storage.set('joguinho-save-v1', JSON.stringify({ version: 3, state: corrupted }));
    assert.equal(loadGame(), null);
  }
});

test('a current save resumes office position, travel, interviewed staff, loan, and a pending project decision', () => {
  fakeStorage();
  const state = createGame();
  const project = acceptProject(state, state.leads[0].id).project;
  interviewAndHire(state, 'lucas');
  assignEmployee(state, 'lucas', project.id, 'quality');
  for (let guard = 0; guard < 20 && !state.pendingEvents.length; guard += 1) advanceDay(state);
  assert.equal(state.pendingEvents.length, 1);
  assert.equal(takeLoan(state).ok, true);
  assert.equal(recordTravel(state, 350).ok, true);
  state.officePosition = { x: 400, y: 250 };
  state.paused = false;
  assert.equal(saveGame(state).ok, true);
  const restored = loadGame();
  assert.deepEqual(restored, { ...state, paused: true });
  assert.equal(restored.employees[0].assignmentRole, 'quality');
  resolvePendingEvents(restored);
  assert.equal(advanceDay(restored).ok, true);
});

test('multiple partial work actions preserve the save and the same two-hour manual budget', () => {
  fakeStorage();
  const { state } = projectGame();
  setAllocation(state, 'delivery', 1);
  recordTravel(state, 1050);
  assert.equal(performAction(state, 'work').ok, true);
  setAllocation(state, 'delivery', 2);
  assert.equal(performAction(state, 'work').ok, true);
  setAllocation(state, 'delivery', 3);
  assert.equal(performAction(state, 'work').ok, true);
  assert.equal(state.dailyActions.work, 3);
  assert.equal(state.dailyActions.workHours, 2);
  assert.equal(performAction(state, 'work').ok, false);
  assert.equal(saveGame(state).ok, true);
  assert.deepEqual(loadGame(), { ...state, paused: true });
});

test('small travel steps and partial work keep fractional time within the daily budget', () => {
  fakeStorage();
  const { state } = projectGame();
  setAllocation(state, 'delivery', 1);
  recordTravel(state, 5.6);
  assert.equal(performAction(state, 'work').ok, true);
  assert.ok(state.manualDeliveryHours + state.travelHours <= 1.000001);
  assert.equal(state.manualDeliveryHours, 0.996);
  assert.equal(saveGame(state).ok, true);
  assert.ok(loadGame());
});

test('a company in negative cash can still resolve a project event without spending money', () => {
  const state = createGame();
  acceptProject(state, state.leads[0].id);
  while (!state.pendingEvents.length) advanceDay(state);
  const event = state.pendingEvents[0];
  state.cash = -100;
  const option = event.options.find((entry) => entry.cost === 0 && entry.hours === 0);
  assert.ok(option);
  assert.equal(resolveProjectEvent(state, event.id, option.id).ok, true);
  assert.equal(state.cash, -100);
  assert.equal(state.pendingEvents.length, 0);
});

test('saving a corrupt state never overwrites the last valid company', () => {
  const storage = fakeStorage();
  const state = createGame({ company: 'Meu progresso' });
  assert.equal(saveGame(state).ok, true);
  const previous = storage.get('joguinho-save-v1');
  state.product.progress = 999;
  assert.equal(saveGame(state).ok, false);
  assert.equal(storage.get('joguinho-save-v1'), previous);
  assert.equal(loadGame().profile.company, 'Meu progresso');
});
