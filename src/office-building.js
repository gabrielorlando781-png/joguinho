import { isLocalTestState } from './local-test.js';

export const BUILDING_SECTORS = ['development', 'sales', 'hr', 'finance'];
export const BUILDING_BAYS = ['nw', 'ne', 'sw', 'se'];
export const BAY_NAMES = { nw: 'Noroeste', ne: 'Nordeste', sw: 'Sudoeste', se: 'Sudeste' };
export const SECTOR_NAMES = { development: 'Desenvolvimento', sales: 'Comercial', hr: 'RH', finance: 'Financeiro', meeting: 'Reuniões', ceo: 'CEO', studio: 'Estúdio de apoio' };
export const VERTICAL_EXPANSIONS = [
  { id: 'floor-2', name: 'Segundo andar', floors: 2, price: 14000, slots: 16, posts: 6, dailyRent: 160, monthlyMaintenance: 70, requirements: { delivered: 6, employees: 2, reputation: 28 }, description: 'Um novo pavimento com quatro espaços para setores, estúdio de apoio e escada incluída. Acrescenta 16 posições e até seis postos, com R$ 160/dia de aluguel e R$ 70 por ciclo de manutenção.' },
  { id: 'floor-3', name: 'Terceiro andar', floors: 3, price: 22000, slots: 16, posts: 6, dailyRent: 190, monthlyMaintenance: 90, requirements: { delivered: 10, employees: 3, reputation: 40 }, description: 'Mais um pavimento completo, ligado pela escada. Transfira setores pela planta e distribua a empresa entre três andares. Acrescenta 16 posições e seis postos.' },
  { id: 'elevator', name: 'Elevador do prédio', price: 6000, slots: 0, posts: 0, dailyRent: 4, monthlyMaintenance: 180, requirements: {}, description: 'Conecta todos os andares adquiridos. Escolha o destino no painel da cabine; a viagem usa um quarto do tempo das escadas. R$ 4/dia e R$ 180 por ciclo de manutenção.' },
];
export const floorName = floor => floor === 0 ? 'Térreo' : `${floor + 1}º andar`;
export function createBuilding() {
  return { version: 1, floors: 1, elevator: false,
    placements: Object.fromEntries(BUILDING_SECTORS.map((id, i) => [id, { floor: 0, bay: BUILDING_BAYS[i], door: BUILDING_BAYS[i].startsWith('n') ? 'bottom' : 'top' }])),
    location: { floor: 0, room: null }, revision: 0 };
}
export function ensureBuilding(state) {
  if (!state.office.building) {
    state.office.building = createBuilding();
    // Old positions belong to the former map, not to the new corridors.
    state.officePosition = { x: 0, y: 0 };
  }
  return state.office.building;
}
export function buildingCosts(office) {
  const b = office.building || createBuilding(), floors = VERTICAL_EXPANSIONS.filter(e => e.floors && e.floors <= b.floors);
  const entries = [...floors, ...(b.elevator ? [VERTICAL_EXPANSIONS[2]] : [])];
  return { extraSlots: entries.reduce((n, e) => n + e.slots, 0), extraPosts: entries.reduce((n, e) => n + e.posts, 0),
    dailyRent: entries.reduce((n, e) => n + e.dailyRent, 0), monthlyMaintenance: entries.reduce((n, e) => n + e.monthlyMaintenance, 0) };
}
export function validPlacements(placements, floors) {
  return Boolean(placements && Object.keys(placements).length === 4 && BUILDING_SECTORS.every(id => {
    const p = placements[id];
    return p && Number.isInteger(p.floor) && p.floor >= 0 && p.floor < floors && BUILDING_BAYS.includes(p.bay) && ['top', 'bottom', 'left', 'right'].includes(p.door);
  }) && new Set(BUILDING_SECTORS.map(id => `${placements[id].floor}:${placements[id].bay}`)).size === 4);
}
export function roomExists(office, room, floor) {
  const b = office.building || createBuilding();
  if (BUILDING_SECTORS.includes(room)) return ['dedicated', 'glass'].includes(office.rooms?.[room]) && b.placements[room].floor === floor;
  return room === 'studio' ? floor > 0 && floor < b.floors : ['meeting', 'ceo'].includes(room) && office.special?.[room] && floor === 0;
}
export function validBuilding(office) {
  const b = office.building;
  if (b === undefined) return true;
  return Boolean(b && b.version === 1 && Number.isInteger(b.floors) && b.floors >= 1 && b.floors <= 3
    && (b.floors === 1 || office.stage === 'floor') && typeof b.elevator === 'boolean' && (!b.elevator || b.floors > 1)
    && validPlacements(b.placements, b.floors) && Number.isInteger(b.revision) && b.revision >= 0
    && b.location && Number.isInteger(b.location.floor) && b.location.floor >= 0 && b.location.floor < b.floors
    && (b.location.room === null || roomExists(office, b.location.room, b.location.floor)));
}
export function getVerticalEligibility(state, id) {
  const entry = VERTICAL_EXPANSIONS.find(e => e.id === id), b = state.office.building || createBuilding();
  if (!entry) return { ok: false, reason: 'Expansão desconhecida.', price: 0 };
  const owned = entry.floors ? b.floors >= entry.floors : b.elevator;
  const needed = Object.entries(entry.requirements).filter(([key, n]) => (key === 'employees' ? state.employees.length : key === 'reputation' ? state.reputation : state.stats[key]) < n)
    .map(([key, n]) => `${n} ${key === 'employees' ? 'pessoas no time' : key === 'reputation' ? 'de reputação' : 'entregas'}`);
  const reason = state.status === 'bankrupt' ? 'A empresa está encerrada.' : owned ? 'Esta expansão já está instalada.'
    : state.office.stage !== 'floor' ? 'Mude para um andar inteiro antes de ampliar o prédio.'
      : entry.floors && entry.floors !== b.floors + 1 ? 'Adquira o segundo andar primeiro.'
        : !entry.floors && b.floors < 2 ? 'O elevador exige pelo menos dois andares.'
          : !isLocalTestState(state) && needed.length ? `Requer ${needed.join(', ')}.` : state.cash < entry.price ? 'O caixa não cobre essa expansão.' : '';
  return { ...entry, entry, ok: !reason, reason, owned };
}
export function locationForAction(office, action) {
  const b = office.building || createBuilding();
  const sector = { work: 'development', sales: 'sales', team: 'hr', finance: 'finance' }[action];
  if (sector) return { floor: b.placements[sector].floor, room: ['dedicated', 'glass'].includes(office.rooms?.[sector]) ? sector : null };
  if (['meeting', 'ceo'].includes(action)) return office.special?.[action] ? { floor: 0, room: action } : null;
  return ['board', 'furniture', 'coffee', 'rest', 'product', 'reception', 'exit'].includes(action) ? { floor: 0, room: null } : null;
}
