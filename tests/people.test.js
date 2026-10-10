import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, expandOffice, purchaseOfficeItem, getAvailableCandidates, interviewCandidate, hireEmployee, getProjectCapacity, advanceDay, getPromotionEligibility, promoteEmployee, recognizeEmployee, hireManager, conveneLeadership, leadershipOptions, resolveLeadershipMeeting, saveGame, loadGame } from '../src/simulation.js';
import { getPayroll } from '../src/finance-model.js';
import { enableLocalTest } from '../src/local-test.js';
import { personDialogue, staffExchange } from '../src/people.js';

function company() {
  const state = enableLocalTest(createGame({ name: 'Ana', company: 'Estúdio Ana' }), true);
  assert.equal(expandOffice(state).ok, true);
  assert.equal(expandOffice(state).ok, true);
  return state;
}

function prepareDesk(state) {
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  assert.equal(purchaseOfficeItem(state, 'chair').ok, true);
}

test('recruitment replenishes beyond the initial three people and larger teams can carry more contracts', () => {
  const state = company();
  assert.ok(getAvailableCandidates(state).length >= 7);
  state.allocation = { sales: 0, delivery: 1, quality: 7 };
  for (let i = 0; i < 7; i++) {
    prepareDesk(state);
    const candidate = getAvailableCandidates(state)[0];
    assert.equal(interviewCandidate(state, candidate.id).ok, true, candidate.id);
    assert.equal(hireEmployee(state, candidate.id).ok, true, candidate.id);
  }
  assert.equal(state.employees.length, 7);
  assert.equal(new Set(state.employees.map((person) => person.id)).size, 7);
  assert.equal(getProjectCapacity(state), 5);
  assert.ok(getPayroll(state).total > 0);
  assert.equal(advanceDay(state).ok, true);
  assert.ok(getAvailableCandidates(state).length >= 4, 'a new candidate round arrives');
});

test('promotion needs measured contribution, tenure and wellbeing, then increases real payroll and unlocks leadership', () => {
  const state = company();
  prepareDesk(state);
  assert.equal(hireEmployee(state, 'lucas').ok, true);
  const person = state.employees[0];
  assert.equal(getPromotionEligibility(state, person.id).ok, false);
  const project = { id: 'long-contract', title: 'Contrato longo', client: 'Cliente', status: 'active', phase: 'development', price: 20000, hours: 1000, progress: 0, deadline: 500, mode: 'standard', quality: 70, paid: false, eventTriggered: true, blockedUntil: 0, paymentDays: 3 };
  state.projects.push(project);
  const before = person.career.xp;
  assert.equal(advanceDay(state).ok, true);
  assert.ok(person.career.xp > before, 'real work adds experience');
  person.career.xp = 120;
  person.career.recentOutput = person.productivity;
  person.career.lastActiveDay = 30;
  person.morale = 85; person.stress = 8; state.day = 30;
  const initialSalary = person.salary;
  assert.equal(getPromotionEligibility(state, person.id).ok, true);
  assert.equal(promoteEmployee(state, person.id).ok, true);
  assert.ok(person.salary > initialSalary);
  assert.equal(getPromotionEligibility(state, person.id).ok, false, 'a second promotion requires new tenure');
  state.day = 45; person.career.lastActiveDay = 45;
  assert.equal(promoteEmployee(state, person.id).ok, true);
  state.day = 70; person.career.lastActiveDay = 70;
  assert.equal(promoteEmployee(state, person.id).ok, true);
  assert.equal(person.career.level, 'lead');
  assert.ok(person.role.includes('Liderança'));
  assert.equal(getPromotionEligibility(state, person.id).ok, false);
});

test('dialogue reflects live project, mood and career; recognition cannot be farmed', () => {
  const state = company();
  prepareDesk(state);
  hireEmployee(state, 'lucas');
  const person = state.employees[0];
  person.stress = 72;
  state.projects.push({ id: 'work', title: 'Agenda da clínica', client: 'Clínica', status: 'active', phase: 'development', price: 8000, hours: 40, progress: 18, deadline: 2, mode: 'standard', quality: 45, paid: false });
  person.assignment = 'work';
  assert.match(personDialogue(state, person, 'wellbeing'), /estresse.*72%/);
  assert.match(personDialogue(state, person, 'project'), /Agenda da clínica.*45%/);
  assert.match(personDialogue(state, person, 'growth'), /avaliação/);
  assert.match(staffExchange(state, person, { id: 'colleague', stress: 8, morale: 80 })[1].text, /revisar/);
  const morale = person.morale;
  assert.equal(recognizeEmployee(state, person.id).ok, true);
  assert.equal(person.morale, morale + 4);
  assert.equal(recognizeEmployee(state, person.id).ok, false);
});

test('leadership meeting summons managers and promoted leaders, costs one hour, applies a decision once and survives save', () => {
  const state = company();
  state.office.special.meeting = true;
  state.office.special.ceo = true;
  prepareDesk(state); prepareDesk(state);
  assert.equal(hireEmployee(state, 'lucas').ok, true);
  assert.equal(hireManager(state, 'sales').ok, true);
  const person = state.employees[0];
  person.career = { level: 'lead', xp: 100, recentOutput: 6, lastActiveDay: 1, lastPromotionDay: 1, lastSupportDay: 0 };
  person.baseRole = 'Dev frontend';
  const beforeHours = state.actionHours;
  assert.equal(conveneLeadership(state, 'people').ok, true);
  assert.equal(state.actionHours, beforeHours + 1);
  assert.deepEqual(state.management.meeting.attendees, ['manager:sales', 'lucas']);
  assert.equal(conveneLeadership(state, 'people').ok, false);
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    assert.equal(saveGame(state).ok, true);
    const restored = loadGame();
    assert.deepEqual(restored.management.meeting.attendees, ['manager:sales', 'lucas']);
    assert.deepEqual(leadershipOptions(restored).map((option) => option.id), ['rest', 'bonus']);
    const beforeStress = restored.employees[0].stress;
    assert.equal(resolveLeadershipMeeting(restored, 'rest').ok, true);
    assert.ok(restored.employees[0].stress < beforeStress);
    assert.equal(resolveLeadershipMeeting(restored, 'rest').ok, false);
    assert.equal(conveneLeadership(restored, 'strategy').ok, false, 'only one meeting per day');
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});
