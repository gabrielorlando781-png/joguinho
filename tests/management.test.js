import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, expandOffice, purchaseOfficeItem, hireManager, callManager, respondManager, getManagerReport, managerQueue, advanceDay, saveGame, loadGame } from '../src/simulation.js';
import { getPayroll } from '../src/finance-model.js';
import { enableLocalTest } from '../src/local-test.js';

function staffedCompany() {
  const state = enableLocalTest(createGame({ name: 'Ana', company: 'Estúdio Ana' }), true);
  assert.equal(expandOffice(state).ok, true);
  assert.equal(expandOffice(state).ok, true);
  assert.equal(purchaseOfficeItem(state, 'ceo').ok, true);
  for (let i = 0; i < 4; i++) {
    assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
    assert.equal(purchaseOfficeItem(state, 'chair').ok, true);
  }
  return state;
}

test('manager requires the CEO room and a real workstation, occupies one place, and joins payroll', () => {
  const fresh = createGame();
  const before = JSON.stringify(fresh);
  assert.equal(hireManager(fresh, 'sales').ok, false);
  assert.equal(JSON.stringify(fresh), before);
  const state = staffedCompany();
  assert.equal(hireManager(state, 'sales', 'CLT').ok, true);
  assert.equal(hireManager(state, 'sales', 'PJ').ok, false);
  assert.equal(state.office.workstations.filter((post) => post.employeeId === 'manager:sales').length, 1);
  assert.equal(getPayroll(state).rows.find((row) => row.id === 'manager:sales').charges, 2940);
  assert.equal(getPayroll(state).total, 7140);
});

test('four managers run their own routines and queue one decision each', () => {
  const state = staffedCompany();
  for (const area of ['sales', 'development', 'finance', 'hr']) assert.equal(hireManager(state, area).ok, true);
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  assert.equal(purchaseOfficeItem(state, 'chair').ok, true);
  const project = { id: 'urgent', title: 'Site urgente', client: 'Cliente', status: 'active', phase: 'development', price: 5000, hours: 300, progress: 1, deadline: 50, mode: 'fast', quality: 40, paid: false, eventTriggered: true, blockedUntil: 0, paymentDays: 3 };
  state.projects.push(project);
  state.debt = 60;
  state.cash = 600;
  const leadCount = state.leads.length;
  assert.equal(advanceDay(state).ok, true);
  assert.equal(state.leads.length >= leadCount, true);
  assert.equal(state.leads.some((lead) => lead.discovered), true);
  assert.equal(state.interviews.lucas.candidateId, 'lucas');
  assert.deepEqual(managerQueue(state).map((request) => request.area), ['sales', 'development', 'finance', 'hr']);
  assert.equal(managerQueue(state)[1].kind, 'delivery-mode');
  assert.equal(respondManager(state, managerQueue(state)[1].id, 'approve').ok, false, 'Only the visitor inside may be answered');
  assert.equal(respondManager(state, managerQueue(state)[0].id, 'decline').ok, true);
  assert.equal(managerQueue(state)[0].area, 'development');
  assert.equal(respondManager(state, managerQueue(state)[0].id, 'approve').ok, true);
  assert.equal(project.mode, 'careful');
  assert.equal(getManagerReport(state, 'finance').includes('Fôlego estimado'), true);
});

test('consultations use the same queue, saved visits reload, and older saves gain management', () => {
  const state = staffedCompany();
  hireManager(state, 'finance');
  hireManager(state, 'sales');
  assert.equal(callManager(state, 'finance').ok, true);
  assert.equal(callManager(state, 'sales').ok, true);
  assert.equal(callManager(state, 'finance').ok, false);
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    assert.equal(saveGame(state).ok, true);
    const restored = loadGame();
    assert.deepEqual(managerQueue(restored).map((request) => request.area), ['finance', 'sales']);
    assert.equal(respondManager(restored, managerQueue(restored)[0].id, 'approve').ok, true);
    assert.equal(managerQueue(restored)[0].area, 'sales');
    const legacy = createGame();
    delete legacy.management;
    values.set('joguinho-save-v1', JSON.stringify({ version: 3, state: legacy }));
    assert.deepEqual(loadGame().management, { managers: [], requests: [], nextRequestId: 1, snoozed: {}, meeting: null, lastMeetingDay: 0 });
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

test('development manager carries a project incident to the CEO and executes the chosen response', () => {
  const state = staffedCompany();
  assert.equal(hireManager(state, 'development').ok, true);
  state.projects.push({ id: 'client-work', title: 'Entrega', client: 'Cliente', status: 'active', phase: 'development', price: 5000, hours: 300, progress: 1, deadline: 90, mode: 'standard', quality: 48, paid: false, eventTriggered: true, blockedUntil: 0, paymentDays: 3 });
  state.pendingEvents.push({ id: 'client-bug', projectId: 'client-work', type: 'bug', title: 'Bug na revisão', description: 'Uma falha apareceu.', createdDay: 1, options: [{ id: 'fix', label: 'Corrigir a causa', description: 'Melhora a entrega', cost: 0, hours: 2, area: 'quality' }] });
  state.allocation = { sales: 2, delivery: 6, quality: 0 };
  assert.equal(advanceDay(state).ok, true);
  const request = managerQueue(state)[0];
  assert.equal(request.kind, 'project-event');
  const before = { quality: state.projects[0].quality, debt: state.debt, hours: state.actionHours };
  assert.equal(respondManager(state, request.id, 'fix').ok, true);
  assert.equal(state.pendingEvents.length, 0);
  assert.ok(state.projects[0].quality > before.quality);
  assert.ok(state.debt < before.debt);
  assert.equal(state.actionHours, before.hours, 'The manager executes the work without taking founder hours');
});
