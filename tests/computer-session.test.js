import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getComputerLoginMode, configureComputerPassword, authenticateComputer, parseTerminalCommand,
} from '../src/computer-session.js';
import { createGame, saveGame, loadGame } from '../src/simulation.js';

const originalStorage = globalThis.localStorage;
afterEach(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

test('first login stores a salted digest, authenticates exact passwords and never keeps the plaintext', async () => {
  const state = { cash: 20000, day: 7, projects: [{ id: 'customer-project' }] };
  assert.equal(getComputerLoginMode(state), 'setup');
  assert.equal((await configureComputerPassword(state, 'Mesa 123!', 'Mesa 123!')).ok, true);
  assert.equal(getComputerLoginMode(state), 'login');
  assert.match(state.computer.passwordHash, /^[a-f0-9]{64}$/);
  assert.match(state.computer.passwordSalt, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(state).includes('Mesa 123!'), false);
  assert.equal((await authenticateComputer(state, 'Mesa 123!')).ok, true);
  for (const wrong of ['mesa 123!', 'Mesa 123! ', '', null]) {
    const before = JSON.stringify(state);
    assert.equal((await authenticateComputer(state, wrong)).ok, false);
    assert.equal(JSON.stringify(state), before, 'Failed logins cannot modify the company or password');
  }
});

test('setup rejects short, long, nonstring and mismatching passwords without changing existing settings', async () => {
  const state = { day: 3, cash: 7500 };
  assert.equal((await configureComputerPassword(state, '1234', '1234')).ok, true);
  const before = JSON.stringify(state);
  for (const [password, confirmation] of [
    ['123', '123'], ['x'.repeat(25), 'x'.repeat(25)], [null, null], [1234, 1234], ['valid-password', 'different'],
  ]) {
    assert.equal((await configureComputerPassword(state, password, confirmation)).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal((await configureComputerPassword(null, '1234', '1234')).ok, false);
  assert.equal((await configureComputerPassword([], '1234', '1234')).ok, false);
});

test('password reset replaces only PC settings and random salt prevents identical persisted credentials', async () => {
  const state = createGame({ name: 'Ana', company: 'Minha software house', trait: 'balanced' });
  const businessBefore = structuredClone(state);
  assert.equal((await configureComputerPassword(state, 'senha inicial', 'senha inicial')).ok, true);
  const originalConfig = structuredClone(state.computer);
  assert.equal((await configureComputerPassword(state, 'nova senha', 'nova senha')).ok, true);
  assert.equal((await authenticateComputer(state, 'senha inicial')).ok, false);
  assert.equal((await authenticateComputer(state, 'nova senha')).ok, true);
  assert.notEqual(state.computer.passwordSalt, originalConfig.passwordSalt);
  const { computer, ...businessAfter } = state;
  assert.deepEqual(businessAfter, businessBefore);

  const another = {};
  assert.equal((await configureComputerPassword(another, 'nova senha', 'nova senha')).ok, true);
  assert.notEqual(another.computer.passwordSalt, computer.passwordSalt);
  assert.notEqual(another.computer.passwordHash, computer.passwordHash);
});

test('malformed or older PC configuration offers setup and can be repaired without breaking business progress', async () => {
  for (const computer of [undefined, null, [], {}, { passwordHash: 'plaintext', passwordSalt: 'short' },
    { passwordHash: 'a'.repeat(64), passwordSalt: false },
    { passwordHash: 'Z'.repeat(64), passwordSalt: 'a'.repeat(32) }]) {
    const state = { day: 9, cash: 1000, computer };
    assert.equal(getComputerLoginMode(state), 'setup');
    assert.equal((await authenticateComputer(state, '1234')).ok, false);
    assert.equal((await configureComputerPassword(state, '1234', '1234')).ok, true);
    assert.equal((await authenticateComputer(state, '1234')).ok, true);
    assert.equal(state.day, 9);
    assert.equal(state.cash, 1000);
  }
});

test('configured password survives the actual game save and load without saving authentication', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const state = createGame({ name: 'Ana', company: 'Empresa salva', trait: 'balanced' });
  assert.equal((await configureComputerPassword(state, 'cadeira azul', 'cadeira azul')).ok, true);
  saveGame(state);
  const restored = loadGame();
  assert.ok(restored);
  assert.equal(getComputerLoginMode(restored), 'login');
  assert.equal((await authenticateComputer(restored, 'cadeira azul')).ok, true);
  assert.equal(Array.from(values.values()).some((value) => value.includes('cadeira azul')), false);
  assert.deepEqual(restored.computer, state.computer);
  assert.equal(restored.profile.company, 'Empresa salva');
});

test('terminal understands Portuguese accents, spacing, aliases and numbered answers', () => {
  for (const [input, command] of [
    ['  AJUDA  ', 'ajuda'], ['HELP', 'ajuda'], ['?', 'ajuda'], ['Státus', 'status'],
    ['trabalhar', 'trabalhar'], ['INICIAR', 'trabalhar'], ['rotina', 'rotina'], ['FOCO', 'foco'],
    ['revisar', 'revisar'], ['concluir', 'concluir'], ['limpar', 'limpar'], ['CLS', 'limpar'],
  ]) assert.deepEqual(parseTerminalCommand(input), { command });
  for (let answer = 1; answer <= 4; answer += 1) {
    assert.deepEqual(parseTerminalCommand(` ${answer} `), { command: 'answer', argument: answer - 1 });
  }
  for (const blank of ['', '   ', null, undefined, 2]) assert.deepEqual(parseTerminalCommand(blank), { command: '' });
});

test('unknown terminal input remains display data with a strict length bound', () => {
  assert.deepEqual(parseTerminalCommand('  rm -rf /  '), { command: 'unknown', argument: 'rm -rf /' });
  assert.deepEqual(parseTerminalCommand('<script>erro</script>'), { command: 'unknown', argument: '<script>erro</script>' });
  assert.deepEqual(parseTerminalCommand('5'), { command: 'unknown', argument: '5' });
  assert.equal(parseTerminalCommand('x'.repeat(1000)).argument.length, 120);
});
