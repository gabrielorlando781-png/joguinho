import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, acceptProject, advanceDay, performAction, setAllocation, recordTravel,
  getWorkSessionEligibility, startWorkSession, answerWorkPuzzle, completeWorkSession,
  getWorkSession, saveGame, loadGame,
} from '../src/simulation.js';

const originalStorage = globalThis.localStorage;
afterEach(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

function storage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}

function projectGame() {
  const state = createGame({ name: 'Ana', company: 'Estúdio Azul', trait: 'balanced' });
  const accepted = acceptProject(state, state.leads[0].id);
  assert.equal(accepted.ok, true);
  const project = accepted.project;
  project.hours = 200;
  project.deadline = 500;
  project.eventTriggered = true;
  return { state, project };
}

function unchanged(state, action) {
  const previous = JSON.stringify(state);
  assert.equal(action().ok, false);
  assert.equal(JSON.stringify(state), previous);
}

function answerRemaining(state, wrong = false) {
  while (state.workSession.index < state.workSession.total) {
    const puzzle = state.workSession.puzzles[state.workSession.index];
    const id = wrong ? puzzle.options.find((option) => option.id !== puzzle.correctAnswerId).id : puzzle.correctAnswerId;
    assert.equal(answerWorkPuzzle(state, id).ok, true);
  }
  assert.equal(state.workSession.status, 'ready');
}

function readySession(state, projectId, wrong = false) {
  assert.equal(startWorkSession(state, projectId).ok, true);
  answerRemaining(state, wrong);
}

test('work sessions require an active reachable project, available delivery hours, energy, and a business day', () => {
  const empty = createGame();
  assert.equal(empty.workSession, null);
  assert.equal(getWorkSessionEligibility(empty).ok, false);
  unchanged(empty, () => startWorkSession(empty));
  const { state, project } = projectGame();
  unchanged(state, () => startWorkSession(state, 'missing-project'));
  project.blockedUntil = state.day + 1;
  unchanged(state, () => startWorkSession(state, project.id));
  project.blockedUntil = 0;
  state.energy = 5;
  unchanged(state, () => startWorkSession(state, project.id));
  state.energy = 100;
  assert.equal(setAllocation(state, 'delivery', 0).ok, true);
  unchanged(state, () => startWorkSession(state, project.id));
  assert.equal(setAllocation(state, 'delivery', 5).ok, true);
  state.day = 6;
  unchanged(state, () => startWorkSession(state, project.id));
  state.day = 1;
  state.status = 'bankrupt';
  state.bankrupt = true;
  unchanged(state, () => startWorkSession(state, project.id));
});

test('starting and answering five business questions produces no free work before final completion', () => {
  const { state, project } = projectGame();
  const cash = state.cash;
  const energy = state.energy;
  assert.equal(startWorkSession(state, project.id).ok, true);
  assert.equal(state.workSession.projectId, project.id);
  assert.equal(state.workSession.total, 5);
  assert.equal(state.workSession.puzzles.length, 5);
  assert.equal(state.workSession.index, 0);
  assert.equal(state.workSession.mistakes, 0);
  assert.equal(state.workSession.hours, 2);
  assert.equal(project.progress, 0);
  assert.equal(state.actionHours, 0);
  assert.equal(state.energy, energy);
  unchanged(state, () => completeWorkSession(state));
  answerRemaining(state);
  assert.equal(state.workSession.answers.length, 5);
  assert.equal(state.workSession.mistakes, 0);
  assert.equal(project.progress, 0);
  assert.equal(state.stats.hoursWorked, 0);
  assert.equal(state.actionHours, 0);
  assert.equal(state.cash, cash);
  assert.equal(completeWorkSession(state).ok, true);
  assert.equal(state.workSession, null);
  assert.ok(project.progress > 0);
  assert.equal(state.manualDeliveryHours, 2);
  assert.equal(state.dailyActions.workHours, 2);
  assert.equal(state.dailyActions.work, 1);
  assert.equal(state.actionHours, 2);
  assert.ok(state.stats.hoursWorked <= 2);
  unchanged(state, () => completeWorkSession(state));
  unchanged(state, () => startWorkSession(state, project.id));
});

test('wrong choices advance with explanation and consequences, without answer retries or session resets', () => {
  const { state: correct, project } = projectGame();
  const mistaken = structuredClone(correct);
  assert.equal(startWorkSession(correct, project.id).ok, true);
  assert.equal(startWorkSession(mistaken, project.id).ok, true);
  const first = mistaken.workSession.puzzles[0];
  const wrong = first.options.find((option) => option.id !== first.correctAnswerId).id;
  assert.equal(answerWorkPuzzle(mistaken, wrong).ok, true);
  assert.equal(mistaken.workSession.index, 1);
  assert.equal(mistaken.workSession.mistakes, 1);
  assert.equal(mistaken.workSession.answers[0].correct, false);
  assert.ok(typeof mistaken.workSession.lastFeedback.message === 'string' && mistaken.workSession.lastFeedback.message.includes(first.explanation));
  unchanged(mistaken, () => answerWorkPuzzle(mistaken, wrong));
  unchanged(mistaken, () => answerWorkPuzzle(mistaken, first.correctAnswerId));
  const id = mistaken.workSession.id;
  assert.equal(startWorkSession(mistaken, project.id).ok, true);
  assert.equal(mistaken.workSession.id, id);
  assert.equal(mistaken.workSession.index, 1);
  assert.equal(mistaken.workSession.mistakes, 1);
  answerRemaining(correct);
  answerRemaining(mistaken, true);
  assert.equal(mistaken.workSession.mistakes, 5);
  assert.equal(completeWorkSession(correct).ok, true);
  assert.equal(completeWorkSession(mistaken).ok, true);
  assert.equal(correct.manualDeliveryHours, mistaken.manualDeliveryHours);
  assert.equal(correct.dailyActions.workHours, 2);
  assert.ok(correct.projects[0].quality > mistaken.projects[0].quality || correct.debt < mistaken.debt, 'Mistakes must have a real delivery consequence');
});

test('decision quality changes the actual invoice when the work block completes a borderline delivery', () => {
  const { state: correct, project } = projectGame();
  project.hours = 1;
  project.quality = 54;
  const mistaken = structuredClone(correct);
  readySession(correct, project.id);
  readySession(mistaken, project.id, true);
  assert.equal(completeWorkSession(correct).ok, true);
  assert.equal(completeWorkSession(mistaken).ok, true);
  assert.equal(correct.projects[0].status, 'delivered');
  assert.equal(mistaken.projects[0].status, 'delivered');
  assert.ok(correct.projects[0].quality >= 55);
  assert.ok(mistaken.projects[0].quality < 55);
  assert.equal(correct.receivables[0].amount, project.price);
  assert.equal(mistaken.receivables[0].amount, Math.round(project.price * 0.85));
  assert.equal(correct.cash, mistaken.cash, 'Neither invoice is cash before the client pays');
});

test('the session cannot switch clients or accept an option from another question', () => {
  const { state, project } = projectGame();
  const other = acceptProject(state, state.leads[0].id).project;
  assert.ok(other);
  assert.equal(startWorkSession(state, project.id).ok, true);
  unchanged(state, () => startWorkSession(state, other.id));
  unchanged(state, () => answerWorkPuzzle(state, 'missing-answer'));
  const later = state.workSession.puzzles[1].options[0].id;
  unchanged(state, () => answerWorkPuzzle(state, later));
  const exposed = getWorkSession(state);
  assert.ok(exposed);
  assert.equal(exposed.projectId, project.id);
  assert.ok(!JSON.stringify(exposed).includes('correctAnswerId'), 'The rendering model must not expose the answer key');
  assert.ok(state.workSession.puzzles.every((question) => question.options.some((option) => option.id === question.correctAnswerId)));
  const label = state.workSession.puzzles[0].options[0].label;
  exposed.currentPuzzle.options[0].label = 'Changed by a view';
  assert.equal(state.workSession.puzzles[0].options[0].label, label);
});

test('five office domains use real company context and varied question and answer positions', () => {
  const correctPositions = new Set();
  const questionOrders = new Set();
  for (let index = 0; index < 20; index += 1) {
    const { state, project } = projectGame();
    state.day = index * 7 + 1;
    assert.equal(startWorkSession(state, project.id).ok, true);
    const questions = state.workSession.puzzles;
    assert.deepEqual([...new Set(questions.map((question) => question.kind))].sort(), ['cash', 'priorities', 'quality', 'schedule', 'scope']);
    assert.ok(questions.some((question) => question.prompt.includes(project.client)));
    assert.ok(questions.some((question) => question.kind === 'schedule' && /8h|8 horas|reservad/.test(question.prompt)));
    const choices = questions.flatMap((question) => question.options.map((option) => option.id));
    assert.equal(choices.length, 20);
    assert.equal(new Set(choices).size, 20);
    for (const question of questions) correctPositions.add(question.options.findIndex((option) => option.id === question.correctAnswerId));
    questionOrders.add(questions.map((question) => question.kind).join(','));
  }
  assert.ok(correctPositions.size >= 3, 'A player must read the choice rather than always selecting the same position');
  assert.ok(questionOrders.size > 1, 'New working days should vary the sequence of office decisions');
});

test('saving midway restores the same questions, choices, answers, and shared-hour session', () => {
  const values = storage();
  const { state, project } = projectGame();
  assert.equal(startWorkSession(state, project.id).ok, true);
  assert.equal(answerWorkPuzzle(state, state.workSession.puzzles[0].correctAnswerId).ok, true);
  const next = state.workSession.puzzles[1];
  assert.equal(answerWorkPuzzle(state, next.options.find((option) => option.id !== next.correctAnswerId).id).ok, true);
  const snapshot = structuredClone(state.workSession);
  state.paused = false;
  assert.equal(saveGame(state).ok, true);
  assert.equal(JSON.parse(values.get('joguinho-save-v1')).version, 3);
  const restored = loadGame();
  assert.ok(restored);
  assert.equal(restored.paused, true);
  assert.deepEqual(restored.workSession, snapshot);
  assert.equal(startWorkSession(restored, project.id).ok, true);
  assert.deepEqual(restored.workSession, snapshot);
  answerRemaining(restored);
  assert.equal(completeWorkSession(restored).ok, true);
  assert.equal(restored.manualDeliveryHours, 2);
  assert.equal(restored.dailyActions.workHours, 2);
  assert.equal(restored.projects[0].progress > 0, true);
  assert.equal(saveGame(restored).ok, true);
  assert.equal(loadGame().workSession, null);
});

test('partial delivery hours and travel allow several sessions but never more than the same two-hour manual block', () => {
  const { state, project } = projectGame();
  assert.equal(setAllocation(state, 'delivery', 1).ok, true);
  assert.equal(recordTravel(state, 1050).ok, true);
  readySession(state, project.id);
  assert.equal(state.workSession.hours, 0.25);
  assert.equal(completeWorkSession(state).ok, true);
  assert.equal(state.manualDeliveryHours, 0.25);
  assert.equal(setAllocation(state, 'delivery', 2).ok, true);
  readySession(state, project.id);
  assert.equal(state.workSession.hours, 1);
  assert.equal(completeWorkSession(state).ok, true);
  assert.equal(state.manualDeliveryHours, 1.25);
  assert.equal(setAllocation(state, 'delivery', 3).ok, true);
  readySession(state, project.id);
  assert.equal(state.workSession.hours, 0.75);
  assert.equal(completeWorkSession(state).ok, true);
  assert.equal(state.dailyActions.work, 3);
  assert.equal(state.dailyActions.workHours, 2);
  assert.equal(state.manualDeliveryHours, 2);
  assert.equal(state.actionHours, 2.75);
  assert.equal(state.travelHours, 0.75);
  assert.ok(state.manualDeliveryHours + state.travelHours <= state.allocation.delivery);
  unchanged(state, () => startWorkSession(state, project.id));
});

test('closing the day expires unfinished questions and adds no production beyond the ordinary allocation', () => {
  const { state, project } = projectGame();
  const ordinary = structuredClone(state);
  assert.equal(startWorkSession(state, project.id).ok, true);
  assert.equal(answerWorkPuzzle(state, state.workSession.puzzles[0].correctAnswerId).ok, true);
  const oldOption = state.workSession.puzzles[1].correctAnswerId;
  advanceDay(state);
  advanceDay(ordinary);
  assert.equal(state.workSession, null);
  assert.equal(state.projects[0].progress, ordinary.projects[0].progress);
  assert.equal(state.stats.hoursWorked, ordinary.stats.hoursWorked);
  assert.equal(state.projects[0].quality, ordinary.projects[0].quality);
  unchanged(state, () => completeWorkSession(state));
  unchanged(state, () => answerWorkPuzzle(state, oldOption));
  assert.equal(startWorkSession(state, project.id).ok, true);
  assert.equal(state.workSession.index, 0);
  assert.equal(state.workSession.day, state.day);
  unchanged(state, () => answerWorkPuzzle(state, oldOption));
});

test('completion revalidates project status and hours instead of awarding stale work', () => {
  const { state, project } = projectGame();
  readySession(state, project.id);
  state.allocation = { sales: 6, delivery: 1, quality: 1 };
  const progress = project.progress;
  unchanged(state, () => completeWorkSession(state));
  assert.equal(project.progress, progress);
  assert.equal(state.manualDeliveryHours, 0);
  assert.equal(state.stats.hoursWorked, 0);
  assert.equal(setAllocation(state, 'delivery', 2).ok, true);
  assert.equal(completeWorkSession(state).ok, true, 'Restoring the original time budget makes the existing finished block usable');
  assert.equal(state.manualDeliveryHours, 2);
  assert.equal(state.workSession, null);
  const { state: alreadyDelivered, project: finishing } = projectGame();
  finishing.hours = 1;
  readySession(alreadyDelivered, finishing.id);
  assert.equal(performAction(alreadyDelivered, 'work').ok, true);
  assert.equal(finishing.status, 'delivered');
  const revenue = alreadyDelivered.stats.revenue;
  const hours = alreadyDelivered.stats.hoursWorked;
  assert.equal(completeWorkSession(alreadyDelivered).ok, false);
  assert.equal(alreadyDelivered.stats.hoursWorked, hours);
  assert.equal(alreadyDelivered.stats.revenue, revenue);
  assert.equal(alreadyDelivered.receivables.length, 1);
});

test('corrupted work sessions never replace the previous valid company', () => {
  const values = storage();
  const { state, project } = projectGame();
  assert.equal(startWorkSession(state, project.id).ok, true);
  assert.equal(answerWorkPuzzle(state, state.workSession.puzzles[0].correctAnswerId).ok, true);
  assert.equal(saveGame(state).ok, true);
  const previous = values.get('joguinho-save-v1');
  const corruptions = [
    (company) => { company.workSession.index = 6; },
    (company) => { company.workSession.total = 100; },
    (company) => { company.workSession.hours = 9; },
    (company) => { company.workSession.day = company.day + 1; },
    (company) => { company.workSession.mistakes = -1; },
    (company) => { company.workSession.status = 'paid'; },
    (company) => { company.workSession.projectId = 'unknown'; },
    (company) => { company.workSession.puzzles.pop(); },
    (company) => { company.workSession.puzzles[0].correctAnswerId = 'unknown'; },
    (company) => { company.workSession.puzzles[0].options = null; },
    (company) => { company.workSession.answers[0].answerId = 'unknown'; },
    (company) => { company.workSession.answers[0].correct = 'yes'; },
    (company) => { company.workSession.index = 2; },
  ];
  for (const corrupt of corruptions) {
    const company = structuredClone(state);
    corrupt(company);
    assert.equal(saveGame(company).ok, false);
    assert.equal(values.get('joguinho-save-v1'), previous);
    values.set('joguinho-save-v1', JSON.stringify({ version: 3, state: company }));
    assert.equal(loadGame(), null);
    values.set('joguinho-save-v1', previous);
  }
  assert.deepEqual(loadGame().workSession, state.workSession);
});

test('older v3 saves without work sessions resume with no session and preserve company progress', () => {
  const values = storage();
  const { state, project } = projectGame();
  assert.equal(performAction(state, 'work').ok, true);
  const old = structuredClone(state);
  delete old.workSession;
  values.set('joguinho-save-v1', JSON.stringify({ version: 3, state: old }));
  const restored = loadGame();
  assert.ok(restored);
  assert.equal(restored.workSession, null);
  assert.equal(restored.cash, state.cash);
  assert.equal(restored.projects[0].progress, project.progress);
  assert.equal(restored.manualDeliveryHours, 2);
  assert.equal(saveGame(restored).ok, true);
});
