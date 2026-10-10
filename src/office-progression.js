import { validPlacement } from './office-placement.js';
import { isLocalTestState } from './local-test.js';
// One catalog feeds the shop, scene, economy and save validation.
export const OFFICE_STAGES = [
  { id: 'garage', name: 'Garagem', price: 0, slots: 6, maxPosts: 2, dailyRent: 55, requirements: {}, description: 'Uma sala compartilhada e dois postos possíveis. Aluguel de R$ 55 por dia, mais R$ 35 de internet e serviços.' },
  { id: 'commercial', name: 'Sala comercial', price: 6500, slots: 16, maxPosts: 5, dailyRent: 110, requirements: { delivered: 1, contracts: 2, reputation: 14 }, description: 'Até cinco postos e espaço para separar os setores. Aluguel de R$ 110 por dia, mais serviços e salas.' },
  { id: 'floor', name: 'Andar inteiro', price: 16000, slots: 58, maxPosts: 21, dailyRent: 230, requirements: { delivered: 4, contracts: 5, employees: 2, reputation: 24 }, description: 'Setores mais espaçosos, até 21 postos e espaço para salas de vidro e a sala do CEO. Aluguel de R$ 230 por dia, mais serviços e salas.' },
];

export const ROOM_LEVELS = [
  { id: 'open', name: 'Espaço aberto', price: 0, slots: 0, monthlyMaintenance: 0, dailyRent: 0, noise: 1, synergy: 1, description: 'Máxima sinergia e revisões rápidas. Negociações e vendas interrompem o desenvolvimento e aumentam o estresse.' },
  { id: 'partition', name: 'Divisórias', price: 650, slots: 1, monthlyMaintenance: 15, dailyRent: 0, noise: 0.5, synergy: 0.93, description: 'Reduz pela metade a transmissão de ruído deste setor. Usa uma posição e perde um pouco de sinergia.' },
  { id: 'dedicated', name: 'Sala dedicada', price: 2400, slots: 2, monthlyMaintenance: 100, dailyRent: 12, noise: 0, synergy: 0.78, description: 'Isola o ruído e libera o bônus pleno do setor. Usa duas posições, custa R$ 12/dia de aluguel extra e reduz a sinergia.' },
  { id: 'glass', name: 'Sala de vidro', price: 4200, slots: 2, monthlyMaintenance: 180, dailyRent: 16, noise: 0, synergy: 0.9, description: 'Mantém o isolamento e os bônus, recupera parte da sinergia e impressiona os clientes. Usa duas posições e custa R$ 16/dia extra.' },
];

export const OFFICE_SECTORS = [
  { id: 'development', name: 'Desenvolvimento', description: 'A sala dedicada melhora a qualidade e reduz em 40% o risco de bugs; vidro reduz em 55%. Divisórias exigem uma pessoa no time; sala dedicada exige duas.' },
  { id: 'sales', name: 'Comercial', description: 'Divisórias somam 2 pontos percentuais à chance de fechar, sala dedicada soma 8 e vidro soma 12. Exige dois contratos para divisórias e três para sala dedicada.' },
  { id: 'hr', name: 'RH', description: 'Candidatos entrevistados ganham 2/8/12 pontos de avaliação. A melhor seleção aumenta a produtividade de novas contratações. Exige uma pessoa para divisórias e duas para sala dedicada.' },
  { id: 'finance', name: 'Financeiro', description: 'A sala dedicada reduz atrasos de pagamentos em um dia; vidro em dois. Exige uma entrega para divisórias e duas para sala dedicada.' },
];

export const COMPUTER_LEVELS = [
  { id: 1, name: 'Básico', multiplier: 1, upgradePrice: 0, monthlyMaintenance: 20, description: 'Produtividade padrão e R$ 20 de manutenção a cada 28 dias.' },
  { id: 2, name: 'Profissional', multiplier: 1.15, upgradePrice: 1800, monthlyMaintenance: 70, description: 'Mais 15% de produtividade para quem usa este posto. R$ 70 de manutenção a cada 28 dias.' },
  { id: 3, name: 'Estação avançada', multiplier: 1.32, upgradePrice: 3600, monthlyMaintenance: 150, description: 'Mais 32% de produtividade para quem usa este posto. R$ 150 de manutenção a cada 28 dias.' },
];

export const SHOP_ITEMS = [
  { id: 'desk', name: 'Mesa com computador básico', price: 650, slots: 1, monthlyMaintenance: 20, requirements: {}, description: 'Ocupa uma posição. Inclui um computador básico; compre também a cadeira para liberar uma contratação.' },
  { id: 'chair', name: 'Cadeira de trabalho', price: 280, slots: 0, monthlyMaintenance: 0, requirements: {}, description: 'Completa uma mesa e libera um posto para contratar. Escolha a mesa que receberá a cadeira.' },
  { id: 'lounge', name: 'Área de descanso', price: 1500, slots: 2, monthlyMaintenance: 35, requirements: { employees: 1 }, description: 'Ocupa duas posições. Todos os dias: +2 de moral e −3 de estresse para a equipe; melhora descanso e recuperação do fundador.' },
  { id: 'floor', name: 'Piso confortável', price: 900, slots: 0, monthlyMaintenance: 0, requirements: { delivered: 1, reputation: 16 }, description: 'Muda o piso e acrescenta 0,3 de moral diária para cada funcionário.' },
  { id: 'decor', name: 'Plantas e decoração', price: 500, slots: 0, monthlyMaintenance: 0, requirements: { delivered: 1 }, description: 'Muda o escritório e acrescenta 0,5 de moral diária para cada funcionário.' },
  { id: 'banner', name: 'Banner da empresa', price: 750, slots: 0, monthlyMaintenance: 0, requirements: { contracts: 2, reputation: 14 }, description: 'Personalize texto e cor. A cada dia útil: +0,05 de reputação e 0,25 de progresso para novos contatos.' },
  { id: 'coffee-machine', name: 'Cafeteira', price: 900, slots: 1, monthlyMaintenance: 15, requirements: {}, description: 'Ocupa uma posição. Cada café recupera 22 de energia em vez de 14.' },
  { id: 'whiteboard', name: 'Quadro de ideias', price: 600, slots: 1, monthlyMaintenance: 5, requirements: {}, description: 'Ocupa uma posição. A hora de qualidade passa de 3 para 4 pontos de melhoria, antes da sinergia.' },
  { id: 'meeting', name: 'Sala de reunião', price: 3800, slots: 3, monthlyMaintenance: 120, requirements: { stage: 'commercial', employees: 2, delivered: 2, reputation: 18 }, description: 'Ocupa três posições, R$ 10/dia de aluguel extra. Libera alinhamento, apresentação ao cliente e integração: ações que usam as horas do fundador.' },
  { id: 'ceo', name: 'Sala do CEO', price: 8500, slots: 3, monthlyMaintenance: 200, requirements: { stage: 'floor', employees: 3, delivered: 6, reputation: 35, cash: 25000 }, description: 'Ocupa três posições, R$ 18/dia de aluguel extra. Permite foco (+14 energia e 15% de produção hoje), mas o isolamento repetido reduz a moral. Conviva com a equipe para compensar.' },
];

export const ROOM_ACTIONS = [
  { id: 'alignment', name: 'Alinhar a equipe', room: 'meeting', hours: 1, area: 'quality', cost: 0, description: 'Remove 3 de dívida, encurta bloqueios em um dia e melhora revisão e prevenção de bloqueios por três dias.' },
  { id: 'presentation', name: 'Apresentar ao cliente', room: 'meeting', hours: 1, area: 'sales', cost: 80, description: 'Por três dias, soma 8 pontos percentuais à chance de fechar novos contratos. Uma ação por dia.' },
  { id: 'onboarding', name: 'Integrar novos contratados', room: 'meeting', hours: 1, area: 'quality', cost: 0, description: 'Para pessoas contratadas nos últimos sete dias: +10 de moral, −10 de estresse e 20% de produtividade por três dias.' },
  { id: 'focus', name: 'Trabalhar com foco', room: 'ceo', hours: 1, area: 'delivery', cost: 0, description: 'Recupera 14 de energia e aumenta em 15% a produção do fundador hoje. Aumenta o isolamento; a partir do terceiro uso sem convívio, a moral cai.' },
  { id: 'team-time', name: 'Conversar com a equipe', room: 'ceo', hours: 1, area: 'sales', cost: 0, description: 'Reduz o isolamento em dois níveis e concede +3 de moral e −3 de estresse à equipe.' },
];

const stageIndex = (id) => OFFICE_STAGES.findIndex((entry) => entry.id === id);
const levelFor = (id) => ROOM_LEVELS.find((entry) => entry.id === id) || ROOM_LEVELS[0];
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const hasOldFurniture = (state, id) => state.furniture?.some((item) => (typeof item === 'string' ? item : item.id) === id);
const readyPost = (post) => post.desk && post.chair && post.computerLevel > 0;

export function createOffice(state, migrated = false) {
  const office = {
    stage: 'garage', workstations: [{ id: 'post-1', desk: true, chair: true, computerLevel: 1, employeeId: 'founder' }], nextWorkstationId: 2,
    rooms: Object.fromEntries(OFFICE_SECTORS.map(({ id }) => [id, 'open'])), special: { meeting: false, ceo: false },
    amenities: { lounge: false, floor: false, decor: false, banner: false }, banner: { text: state.profile.company.slice(0, 40), color: '#63866a' },
    nextMaintenanceDay: state.day + 28, bannerProgress: 0, ceoIsolation: 0, salesActivityHours: 0,
    actions: Object.fromEntries(ROOM_ACTIONS.map(({ id }) => [id, 0])),
    bonuses: { alignmentUntil: 0, presentationUntil: 0, onboardingUntil: 0, focusDay: 0 }, migrated,
  };
  if (migrated) {
    const staffPosts = Math.max(state.employees.length, hasOldFurniture(state, 'desk') ? 4 : 2);
    for (let index = 0; index < staffPosts; index += 1) {
      office.workstations.push({ id: `post-${office.nextWorkstationId++}`, desk: true, chair: true, computerLevel: 1, employeeId: state.employees[index]?.id || null });
    }
    if (hasOldFurniture(state, 'monitors')) office.workstations.forEach((post) => { post.computerLevel = 2; });
    office.amenities.lounge = hasOldFurniture(state, 'lounge');
    const oldExtras = ['coffee-machine', 'whiteboard'].filter((id) => hasOldFurniture(state, id)).length;
    const used = office.workstations.length + (office.amenities.lounge ? 2 : 0) + oldExtras;
    office.stage = OFFICE_STAGES.find((stage) => stage.maxPosts >= office.workstations.length && stage.slots >= used)?.id || 'floor';
  }
  return office;
}

export function getRoomEffects(state) {
  const rooms = state.office?.rooms || {};
  const development = levelFor(rooms.development);
  const sales = levelFor(rooms.sales);
  const index = (id) => Math.max(0, ROOM_LEVELS.findIndex((level) => level.id === rooms[id]));
  const synergy = OFFICE_SECTORS.reduce((total, sector) => total + levelFor(rooms[sector.id]).synergy, 0) / OFFICE_SECTORS.length;
  return {
    noise: development.noise * sales.noise, synergy,
    reviewMultiplier: 1 + (synergy - 0.78) * 0.65,
    blockerMultiplier: 0.75 + (1 - synergy) * 1.8,
    developmentQualityBonus: [0, 0.2, 1, 1.5][index('development')],
    salesChanceBonus: [0, 0.02, 0.08, 0.12][index('sales')],
    candidateScoreBonus: [0, 2, 8, 12][index('hr')],
    paymentDelayReduction: [0, 0, 1, 2][index('finance')],
    bugRisk: [1, 0.85, 0.6, 0.45][index('development')],
  };
}

export function getComputerMultiplier(state, employeeId = 'founder') {
  const post = state.office?.workstations.find((entry) => entry.employeeId === employeeId && readyPost(entry));
  return post ? COMPUTER_LEVELS[post.computerLevel - 1].multiplier : 0;
}

export function getOfficeOverview(state, includeEligibility = true) {
  const office = state.office;
  if (!office) return null;
  const stage = OFFICE_STAGES.find((entry) => entry.id === office.stage) || OFFICE_STAGES[0];
  const roomLevels = OFFICE_SECTORS.map((sector) => levelFor(office.rooms[sector.id]));
  const extras = ['coffee-machine', 'whiteboard'].filter((id) => hasOldFurniture(state, id));
  const usedSlots = office.workstations.length + roomLevels.reduce((sum, level) => sum + level.slots, 0)
    + (office.amenities.lounge ? 2 : 0) + (office.special.meeting ? 3 : 0) + (office.special.ceo ? 3 : 0) + extras.length;
  const capacity = office.workstations.filter((post) => post.employeeId !== 'founder' && readyPost(post)).length;
  const freePosts = office.workstations.filter((post) => post.employeeId === null && readyPost(post)).length;
  const dailyRent = stage.dailyRent + 35 + roomLevels.reduce((sum, level) => sum + level.dailyRent, 0) + (office.special.meeting ? 10 : 0) + (office.special.ceo ? 18 : 0);
  const monthlyMaintenance = office.workstations.reduce((sum, post) => sum + COMPUTER_LEVELS[post.computerLevel - 1].monthlyMaintenance, 0)
    + roomLevels.reduce((sum, level) => sum + level.monthlyMaintenance, 0) + (office.amenities.lounge ? 35 : 0)
    + (office.special.meeting ? 120 : 0) + (office.special.ceo ? 200 : 0) + extras.reduce((sum, id) => sum + SHOP_ITEMS.find((item) => item.id === id).monthlyMaintenance, 0);
  const effects = getRoomEffects(state);
  const overview = { stage, usedSlots, maxSlots: stage.slots, capacity, freePosts, dailyRent, monthlyMaintenance, nextMaintenanceDay: office.nextMaintenanceDay,
    noise: effects.noise, synergy: effects.synergy, nextStage: OFFICE_STAGES[stageIndex(stage.id) + 1] || null,
    rooms: OFFICE_SECTORS.map((sector) => ({ ...sector, level: levelFor(office.rooms[sector.id]) })),
    workstations: office.workstations.map((post) => ({ ...post, computer: COMPUTER_LEVELS[post.computerLevel - 1], occupantName: post.employeeId === 'founder' ? state.profile.name : [...state.employees, ...(state.management?.managers || [])].find((person) => person.id === post.employeeId)?.name || null })),
  };
  if (includeEligibility) {
    overview.expansion = getExpansionEligibility(state);
    overview.rooms.forEach((room) => { room.eligibility = getRoomEligibility(state, room.id); });
    overview.workstations.forEach((post) => {
      post.computerEligibility = getComputerEligibility(state, post.id);
      post.chairEligibility = getItemEligibility(state, 'chair', { workstationId: post.id });
    });
  }
  return overview;
}

function gateReason(state, requirements = {}) {
  if (isLocalTestState(state)) return '';
  const reasons = [];
  if (requirements.stage && stageIndex(state.office.stage) < stageIndex(requirements.stage)) reasons.push(`escritório ${OFFICE_STAGES.find((stage) => stage.id === requirements.stage).name}`);
  if (requirements.delivered && state.stats.delivered < requirements.delivered) reasons.push(`${requirements.delivered} entregas`);
  if (requirements.contracts && state.projects.length < requirements.contracts) reasons.push(`${requirements.contracts} contratos fechados`);
  if (requirements.employees && state.employees.length < requirements.employees) reasons.push(`${requirements.employees} pessoas no time`);
  if (requirements.reputation && state.reputation < requirements.reputation) reasons.push(`${requirements.reputation} de reputação`);
  if (requirements.cash && state.cash < requirements.cash) reasons.push(`R$ ${requirements.cash.toLocaleString('pt-BR')} em caixa`);
  return reasons.length ? `Requer ${reasons.join(', ')}.` : '';
}

function eligibility(state, entry, extraSlots, requirements, extra = {}) {
  const overview = getOfficeOverview(state, false);
  const reason = state.status === 'bankrupt' ? 'A empresa encerrou as atividades.' : gateReason(state, requirements)
    || (extraSlots > overview.maxSlots - overview.usedSlots ? `Faltam ${extraSlots - (overview.maxSlots - overview.usedSlots)} posições livres. Amplie o escritório.` : '')
    || (state.cash < entry.price ? 'O caixa não cobre essa compra.' : '');
  return { ok: !reason, reason, price: entry.price, slots: extraSlots, ...extra };
}

export function getItemEligibility(state, id, options = {}) {
  const item = SHOP_ITEMS.find((entry) => entry.id === id);
  if (!item || !state.office) return { ok: false, reason: 'Esse item não está na loja.', price: 0, slots: 0 };
  const office = state.office;
  let reason = '';
  let workstation = null;
  if (id === 'desk' && office.workstations.length >= getOfficeOverview(state).stage.maxPosts) reason = 'Todos os pontos de mesa deste mapa estão ocupados. Amplie o escritório.';
  else if (id === 'chair') {
    workstation = options.workstationId ? office.workstations.find((post) => post.id === options.workstationId) : office.workstations.find((post) => post.desk && !post.chair);
    if (!workstation || !workstation.desk) reason = 'Compre uma mesa e escolha esse posto antes da cadeira.';
    else if (workstation.chair) reason = 'Esse posto já tem cadeira.';
  } else if (['meeting', 'ceo'].includes(id) && office.special[id]) reason = 'Essa sala já está construída.';
  else if (Object.hasOwn(office.amenities, id) && office.amenities[id]) reason = 'Seu escritório já tem esse item.';
  else if (['coffee-machine', 'whiteboard'].includes(id) && hasOldFurniture(state, id)) reason = 'Seu escritório já tem esse item.';
  const base = eligibility(state, item, item.slots, item.requirements, { item, workstation });
  const owned = ['meeting', 'ceo'].includes(id) ? office.special[id] : Object.hasOwn(office.amenities, id) ? office.amenities[id] : ['coffee-machine', 'whiteboard'].includes(id) ? hasOldFurniture(state, id) : id === 'chair' ? !!workstation?.chair : false;
  return reason ? { ...base, ok: false, reason, owned } : { ...base, owned };
}

export function getExpansionEligibility(state) {
  const next = OFFICE_STAGES[stageIndex(state.office.stage) + 1];
  if (!next) return { ok: false, reason: 'Você já ocupa um andar inteiro.', price: 0, slots: 0, next: null };
  return eligibility(state, next, 0, next.requirements, { next });
}

export function getRoomEligibility(state, sectorId) {
  const sector = OFFICE_SECTORS.find((entry) => entry.id === sectorId);
  if (!sector) return { ok: false, reason: 'Escolha um setor válido.', price: 0, slots: 0, next: null };
  const current = levelFor(state.office.rooms[sectorId]);
  const next = ROOM_LEVELS[ROOM_LEVELS.indexOf(current) + 1];
  if (!next) return { ok: false, reason: 'O setor já tem uma sala de vidro.', price: 0, slots: 0, next: null, current, sector };
  const requirements = next.id === 'partition' ? (sectorId === 'sales' ? { contracts: 2 } : sectorId === 'finance' ? { delivered: 1 } : { employees: 1 })
    : next.id === 'dedicated' ? { stage: 'commercial', ...(sectorId === 'sales' ? { contracts: 3 } : sectorId === 'finance' ? { delivered: 2 } : { employees: 2 }) }
      : { stage: 'floor', delivered: 4, reputation: 25 };
  return eligibility(state, next, next.slots - current.slots, requirements, { next, current, sector });
}

export function getComputerEligibility(state, workstationId) {
  const workstation = state.office.workstations.find((post) => post.id === workstationId);
  if (!workstation) return { ok: false, reason: 'Escolha um posto de trabalho.', price: 0, slots: 0, next: null };
  const next = COMPUTER_LEVELS[workstation.computerLevel];
  if (!next) return { ok: false, reason: 'Esse computador já está no nível máximo.', price: 0, slots: 0, next: null, workstation };
  const requirements = next.id === 2 ? { delivered: 1 } : { stage: 'floor', delivered: 4, reputation: 25 };
  return eligibility(state, { ...next, price: next.upgradePrice }, 0, requirements, { next, workstation });
}

export function getRoomActionEligibility(state, action) {
  const definition = ROOM_ACTIONS.find((entry) => entry.id === action);
  if (!definition) return { ok: false, reason: 'Ação desconhecida.', cost: 0, hours: 0, area: 'none' };
  const consumed = definition.area === 'delivery' ? state.manualDeliveryHours + state.travelHours : definition.area === 'quality' ? state.manualQualityHours : state.manualSalesHours;
  const reason = state.status === 'bankrupt' ? 'A empresa encerrou as atividades.'
    : !state.office.special[definition.room] ? `Construa a ${definition.room === 'meeting' ? 'sala de reunião' : 'sala do CEO'} na loja.`
      : (state.day - 1) % 7 >= 5 ? 'A equipe retorna no próximo dia útil.'
        : state.office.actions[action] === state.day ? 'Essa ação já foi feita hoje.'
          : action === 'onboarding' && !state.employees.some((person) => state.day - person.hiredDay <= 7) ? 'Não há contratação dos últimos sete dias para integrar.'
            : action === 'team-time' && !state.employees.length ? 'Contrate uma equipe antes do convívio.'
              : definition.cost > 0 && state.cash < definition.cost ? 'O caixa não cobre essa ação.'
                : state.allocation[definition.area] - consumed + 0.00000001 < definition.hours ? `Reserve ${definition.hours}h livres de ${definition.area === 'sales' ? 'vendas' : definition.area === 'quality' ? 'qualidade' : 'entrega'} na rotina.` : '';
  return { ...definition, ok: !reason, reason };
}

export function validOffice(state) {
  const office = state.office;
  const integer = (value, min, max = 100000000) => Number.isInteger(value) && value >= min && value <= max;
  if (!office || !validPlacement(office.placement) || !OFFICE_STAGES.some((stage) => stage.id === office.stage) || typeof office.migrated !== 'boolean') return false;
  if (!Array.isArray(office.workstations) || !office.workstations.length || office.workstations.length > 21) return false;
  const posts = office.workstations;
  if (!posts.every((post) => post && /^post-\d+$/.test(post.id) && typeof post.desk === 'boolean' && post.desk && typeof post.chair === 'boolean' && integer(post.computerLevel, 1, 3) && (post.employeeId === null || post.employeeId === 'founder' || [...state.employees, ...(state.management?.managers || [])].some((person) => person.id === post.employeeId)) && (post.employeeId === null || readyPost(post)))) return false;
  if (new Set(posts.map((post) => post.id)).size !== posts.length || new Set(posts.filter((post) => post.employeeId !== null).map((post) => post.employeeId)).size !== posts.filter((post) => post.employeeId !== null).length) return false;
  if (posts.filter((post) => post.employeeId === 'founder').length !== 1 || ![...state.employees, ...(state.management?.managers || [])].every((person) => posts.some((post) => post.employeeId === person.id))) return false;
  if (!integer(office.nextWorkstationId, 2) || posts.some((post) => Number(post.id.slice(5)) >= office.nextWorkstationId)) return false;
  if (!office.rooms || !OFFICE_SECTORS.every((sector) => ROOM_LEVELS.some((level) => level.id === office.rooms[sector.id]))) return false;
  if (!office.special || !['meeting', 'ceo'].every((id) => typeof office.special[id] === 'boolean') || !office.amenities || !['lounge', 'floor', 'decor', 'banner'].every((id) => typeof office.amenities[id] === 'boolean')) return false;
  if (!office.banner || typeof office.banner.text !== 'string' || !office.banner.text.trim() || office.banner.text.length > 40 || !/^#[0-9a-f]{6}$/i.test(office.banner.color)) return false;
  if (!integer(office.nextMaintenanceDay, 1) || !finite(office.bannerProgress) || office.bannerProgress < 0 || office.bannerProgress > 100 || !integer(office.ceoIsolation, 0, 10) || !finite(office.salesActivityHours) || office.salesActivityHours < 0 || office.salesActivityHours > 8) return false;
  if (!office.actions || !ROOM_ACTIONS.every((action) => integer(office.actions[action.id], 0, state.day)) || !office.bonuses || !['alignmentUntil', 'presentationUntil', 'onboardingUntil', 'focusDay'].every((id) => integer(office.bonuses[id], 0))) return false;
  const overview = getOfficeOverview(state);
  if (posts.length > overview.stage.maxPosts || overview.usedSlots > overview.maxSlots) return false;
  if ((office.special.meeting && office.stage === 'garage') || (office.special.ceo && office.stage !== 'floor')) return false;
  if (office.stage === 'garage' && Object.values(office.rooms).some((id) => ['dedicated', 'glass'].includes(id))) return false;
  if (office.stage !== 'floor' && Object.values(office.rooms).includes('glass')) return false;
  return true;
}
