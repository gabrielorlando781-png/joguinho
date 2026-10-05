import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADS, CANDIDATES, FURNITURE,
  createGame, loadGame, saveGame, advanceDay, acceptProject,
  prospect, hireEmployee, buyFurniture, setAllocation, setProjectMode, performAction,
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
  return { state, project: accepted.project };
}

function finishFirstProject(state, project) {
  for (let guard = 0; guard < 60 && project.status !== 'delivered'; guard += 1) advanceDay(state);
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
  hireEmployee(state, CANDIDATES[0].id);
  state.day = 6;
  state.energy = 30;
  const before = project.progress;
  const day = advanceDay(state);
  assert.equal(day.summary.weekend, true);
  assert.equal(day.summary.hoursWorked, 0);
  assert.equal(day.summary.costs, 110);
  assert.equal(project.progress, before);
  assert.equal(state.energy, 55);
  assert.equal(performAction(state, 'work').ok, false);
  assert.equal(prospect(state).ok, false);
});

test('staff increase delivery capacity and daily payroll distinguishes PJ and CLT', () => {
  const pj = projectGame();
  const clt = projectGame();
  assert.equal(hireEmployee(pj.state, 'lucas', 'PJ').ok, true);
  assert.equal(hireEmployee(clt.state, 'lucas', 'CLT').ok, true);
  assert.equal(pj.state.cash, 20000);
  assert.equal(hireEmployee(pj.state, 'lucas').ok, false);
  assert.equal(hireEmployee(pj.state, 'missing').ok, false);
  assert.equal(hireEmployee(pj.state, 'bia', 'invalid').ok, false);
  const pjDay = advanceDay(pj.state);
  const cltDay = advanceDay(clt.state);
  assert.equal(pjDay.summary.costs, 110 + CANDIDATES[0].salary / 20 * 1.15);
  assert.equal(cltDay.summary.costs, 110 + CANDIDATES[0].salary / 20 * 1.7);
  assert.ok(pj.project.progress > 5);
  assert.ok(pjDay.summary.hoursWorked > 5);
});

test('furniture costs cash once, expands capacity, and has an actual productivity effect', () => {
  const state = createGame();
  hireEmployee(state, 'lucas');
  hireEmployee(state, 'marina');
  assert.equal(hireEmployee(state, 'bia').ok, false);
  assert.equal(buyFurniture(state, 'desk').ok, true);
  assert.equal(state.cash, 20000 - FURNITURE.find((item) => item.id === 'desk').price);
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
  hireEmployee(state, 'lucas', 'CLT');
  hireEmployee(state, 'bia', 'CLT');
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
    advanceDay(state);
    for (const key of ['energy', 'reputation', 'debt']) assert.ok(state[key] >= 0 && state[key] <= 100);
    assert.ok(state.leads.length <= 6);
  }
  assert.ok(state.history.length <= 120);
  assert.ok(state.log.length <= 80);
  assert.ok(state.ledger.length <= 200);
});

test('versioned saves round-trip the company and restore it paused', () => {
  fakeStorage();
  const { state } = projectGame();
  performAction(state, 'work');
  state.paused = false;
  assert.equal(saveGame(state).ok, true);
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
    storage.set(key, JSON.stringify({ version: 1, state: corrupted }));
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
