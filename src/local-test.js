// Runtime-only permission: save files cannot turn cheats on by themselves.
const testStates = new WeakSet();
export const TEST_SAVE_KEY = 'joguinho-local-test-save-v1';
export const TEST_MODE_KEY = 'joguinho-local-test-enabled';

export function isLocalTestState(state) { return testStates.has(state); }

export function enableLocalTest(state, fresh = false) {
  testStates.add(state);
  if (fresh) {
    state.cash = 1000000;
    state.reputation = 100;
    state.status = 'active';
  }
  state.product.unlocked = true;
  if (state.product.stage === 'locked') state.product.stage = 'prototype';
  return state;
}
