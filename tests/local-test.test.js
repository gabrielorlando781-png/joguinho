import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, saveGame, loadGame, expandOffice, getExpansionEligibility, getComputerEligibility, investProduct, purchaseOfficeItem, hireEmployee, CANDIDATES } from '../src/simulation.js';
import { enableLocalTest, isLocalTestState, TEST_SAVE_KEY } from '../src/local-test.js';

test('test permissions stay local to the registered company and cannot travel in a save', () => {
  const normal = createGame({ name: 'Ana', company: 'Normal', age: 28, trait: 'balanced' });
  const sandbox = enableLocalTest(structuredClone(normal), true);
  assert.equal(normal.cash, 20000);
  assert.equal(getExpansionEligibility(normal).ok, false);
  assert.equal(getComputerEligibility(normal, 'post-1').ok, false);
  assert.equal(getExpansionEligibility(sandbox).ok, true);
  assert.equal(getComputerEligibility(sandbox, 'post-1').ok, true);
  const imported = JSON.parse(JSON.stringify(sandbox));
  assert.equal(isLocalTestState(imported), false);
  assert.equal(getExpansionEligibility(imported).ok, false);
  assert.equal(imported.stats.delivered, 0);
});

test('test purchases, hiring and laboratory work without progression but retain real space costs', () => {
  const state = enableLocalTest(createGame({ name: 'Ana', company: 'Teste', age: 28, trait: 'balanced' }), true);
  assert.equal(expandOffice(state).ok, true);
  assert.equal(expandOffice(state).ok, true);
  assert.equal(state.office.stage, 'floor');
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  assert.equal(purchaseOfficeItem(state, 'chair').ok, true);
  assert.equal(hireEmployee(state, CANDIDATES[0].id).ok, true);
  assert.equal(investProduct(state, 'prototype').ok, true);
  assert.ok(state.cash < 1000000);
  assert.equal(state.stats.delivered, 0);
});

test('separate test save preserves normal company and reload requires explicit permission', () => {
  const original = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const normal = createGame({ name: 'Ana', company: 'Normal', age: 28, trait: 'balanced' });
    assert.equal(saveGame(normal).ok, true);
    const baseline = values.get('joguinho-save-v1');
    const sandbox = enableLocalTest(structuredClone(normal), true);
    assert.equal(expandOffice(sandbox).ok, true);
    assert.equal(saveGame(sandbox, TEST_SAVE_KEY).ok, true);
    assert.equal(values.get('joguinho-save-v1'), baseline);
    assert.equal(loadGame().cash, 20000);
    const restored = loadGame(TEST_SAVE_KEY);
    assert.equal(isLocalTestState(restored), false);
    assert.equal(getExpansionEligibility(restored).ok, false);
    enableLocalTest(restored);
    assert.equal(getExpansionEligibility(restored).ok, true);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});
