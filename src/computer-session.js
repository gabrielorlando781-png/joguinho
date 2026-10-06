const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SALT_PATTERN = /^[a-f0-9]{32}$/;

function validComputerConfig(state) {
  const config = state?.computer;
  return config && typeof config === 'object' && !Array.isArray(config)
    && typeof config.passwordHash === 'string' && HASH_PATTERN.test(config.passwordHash)
    && typeof config.passwordSalt === 'string' && SALT_PATTERN.test(config.passwordSalt);
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function passwordDigest(password, salt) {
  const data = new TextEncoder().encode(`devhouse-pc-v1:${salt}:${password}`);
  return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data)));
}

export function getComputerLoginMode(state) {
  return validComputerConfig(state) ? 'login' : 'setup';
}

export async function configureComputerPassword(state, password, confirm) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, message: 'Não foi possível configurar este computador.' };
  }
  if (typeof password !== 'string' || password.length < 4 || password.length > 24) {
    return { ok: false, message: 'Escolha uma senha com 4 a 24 caracteres.' };
  }
  if (password !== confirm) {
    return { ok: false, message: 'As senhas não coincidem. Digite a mesma senha nos dois campos.' };
  }
  try {
    const salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordDigest(password, salt);
    state.computer = { passwordHash: hash, passwordSalt: salt };
    return { ok: true, message: 'Senha do computador definida. Bem-vindo à sua área de trabalho.' };
  } catch {
    return { ok: false, message: 'Não foi possível salvar a senha. Tente abrir o jogo pelo endereço HTTPS.' };
  }
}

export async function authenticateComputer(state, password) {
  if (!validComputerConfig(state)) {
    return { ok: false, message: 'Defina uma senha para começar a usar este computador.' };
  }
  if (typeof password !== 'string' || password.length < 4 || password.length > 24) {
    return { ok: false, message: 'Senha incorreta. Tente novamente.' };
  }
  try {
    const hash = await passwordDigest(password, state.computer.passwordSalt);
    return hash === state.computer.passwordHash
      ? { ok: true, message: 'Acesso autorizado. Bem-vindo à sua área de trabalho.' }
      : { ok: false, message: 'Senha incorreta. Tente novamente.' };
  } catch {
    return { ok: false, message: 'Não foi possível verificar a senha. Tente abrir o jogo pelo endereço HTTPS.' };
  }
}

const COMMANDS = {
  ajuda: 'ajuda', help: 'ajuda', '?': 'ajuda',
  status: 'status',
  trabalhar: 'trabalhar', iniciar: 'trabalhar',
  rotina: 'rotina', foco: 'foco', revisar: 'revisar',
  concluir: 'concluir', limpar: 'limpar', cls: 'limpar',
};

export function parseTerminalCommand(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return { command: '' };
  const normalized = raw.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (/^[1-4]$/.test(normalized)) return { command: 'answer', argument: Number(normalized) - 1 };
  if (Object.hasOwn(COMMANDS, normalized)) return { command: COMMANDS[normalized] };
  return { command: 'unknown', argument: raw.slice(0, 120) };
}
