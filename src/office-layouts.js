const STATION_META = {
  work: ['DESENVOLVIMENTO', 'Sentar e trabalhar'], board: ['PROJETOS', 'Consultar os projetos'],
  sales: ['COMERCIAL', 'Conversar com clientes'], finance: ['FINANCEIRO', 'Consultar o quadro financeiro'],
  team: ['PESSOAS & CULTURA', 'Cuidar da equipe'], furniture: ['LOJA DO ESCRITÓRIO', 'Planejar o escritório'],
  coffee: ['CAFÉ', 'Preparar um café'], rest: ['DESCANSO', 'Fazer uma pausa'],
  product: ['LABORATÓRIO', 'Desenvolver um produto'], reception: ['DIÁRIO', 'Abrir o diário do fundador'],
  exit: ['SAÍDA', 'Encerrar o expediente'], meeting: ['REUNIÕES', 'Reunir a equipe'], ceo: ['SALA DO CEO', 'Cuidar da liderança'],
};

const station = (action, x, y, labelX, labelY, bounds, range = 39) => ({
  action, label: STATION_META[action][0], verb: STATION_META[action][1], x, y, labelX, labelY, bounds, range,
});
const table = (x, y, w, kind) => ({ x, y, w, h: 62, kind });
const clone = (value) => JSON.parse(JSON.stringify(value));

// Every purchase uses one of these authored positions. There is no layout editor.
const MAPS = {
  garage: {
    name: 'GARAGEM', subtitle: 'UM COMEÇO PEQUENO. UMA IDEIA GRANDE.',
    floor: { x: 252, y: 253, w: 776, h: 506 }, walk: { x: 274, y: 276, w: 733, h: 469 }, spawn: { x: 697, y: 491 },
    sectors: {
      development: { x: 282, y: 277, w: 293, h: 195, door: 'bottom', doorSize: 96 },
      sales: { x: 594, y: 277, w: 189, h: 195, door: 'bottom', doorSize: 88 },
      finance: { x: 800, y: 277, w: 204, h: 195, door: 'bottom', doorSize: 90 },
      hr: { x: 507, y: 531, w: 174, h: 159, door: 'top', doorSize: 90 },
    },
    posts: [{ x: 324, y: 322, w: 110 }, { x: 454, y: 322, w: 110 }],
    tables: {
      sales: table(627, 337, 112, 'sales'), finance: table(835, 337, 116, 'finance'),
      team: table(551, 558, 85, 'team'), furniture: table(718, 558, 116, 'furniture'), product: table(852, 558, 120, 'product'),
      reception: table(513, 687, 122, 'reception'),
    },
    coffee: { x: 287, y: 514 }, lounge: { x: 376, y: 661, w: 96, h: 42 }, board: { x: 590, y: 178 },
    stations: [
      station('work', 367, 421, 428, 288, { x: 302, y: 299, w: 272, h: 122 }),
      station('board', 628, 296, 658, 164, { x: 590, y: 178, w: 140, h: 87 }),
      station('sales', 683, 431, 686, 299, { x: 621, y: 309, w: 126, h: 104 }),
      station('finance', 893, 431, 893, 299, { x: 830, y: 309, w: 128, h: 104 }),
      station('team', 595, 645, 595, 528, { x: 526, y: 536, w: 137, h: 90 }),
      station('furniture', 764, 645, 764, 528, { x: 712, y: 536, w: 128, h: 90 }),
      station('product', 912, 645, 912, 528, { x: 846, y: 536, w: 132, h: 90 }),
      station('coffee', 340, 627, 331, 486, { x: 283, y: 467, w: 88, h: 145 }),
      station('rest', 424, 729, 425, 634, { x: 371, y: 636, w: 105, h: 75 }, 34),
      station('reception', 574, 742, 574, 673, { x: 507, y: 679, w: 134, h: 50 }, 31),
      station('exit', 995, 730, 989, 685, { x: 977, y: 700, w: 32, h: 47 }, 32),
    ],
  },
  commercial: {
    name: 'SALA COMERCIAL', subtitle: 'A PRIMEIRA SEDE. ESPAÇO PARA CRESCER.',
    floor: { x: 135, y: 219, w: 1010, h: 540 }, walk: { x: 155, y: 240, w: 969, h: 507 }, spawn: { x: 638, y: 489 },
    sectors: {
      development: { x: 163, y: 241, w: 344, h: 292, door: 'bottom', doorSize: 100 },
      sales: { x: 520, y: 241, w: 264, h: 228, door: 'bottom', doorSize: 100 },
      finance: { x: 798, y: 241, w: 310, h: 228, door: 'bottom', doorSize: 100 },
      hr: { x: 531, y: 594, w: 185, h: 146, door: 'top', doorSize: 98 },
    },
    posts: [{ x: 184, y: 250, w: 110 }, { x: 348, y: 250, w: 110 }, { x: 184, y: 343, w: 110 }, { x: 348, y: 343, w: 110 }, { x: 184, y: 436, w: 110 }],
    tables: {
      sales: table(583, 282, 150, 'sales'), finance: table(888, 282, 150, 'finance'),
      team: table(574, 618, 100, 'team'), furniture: table(754, 618, 126, 'furniture'), product: table(948, 618, 156, 'product'),
      reception: table(574, 507, 116, 'reception'),
    },
    coffee: { x: 167, y: 578 }, lounge: { x: 280, y: 672, w: 115, h: 42 }, board: { x: 568, y: 127 },
    meeting: { x: 284, y: 560, w: 213, h: 178, door: 'right', doorSize: 100, table: table(336, 594, 112, 'meeting'), station: station('meeting', 393, 691, 393, 560, { x: 324, y: 572, w: 136, h: 92 }) },
    ceo: { x: 735, y: 482, w: 162, h: 119, door: 'right', doorSize: 84, table: table(759, 501, 110, 'ceo'), station: station('ceo', 815, 585, 815, 483, { x: 750, y: 481, w: 125, h: 80 }) },
    stations: [
      station('work', 239, 330, 335, 217, { x: 180, y: 215, w: 282, h: 105 }),
      station('board', 635, 268, 636, 113, { x: 568, y: 127, w: 140, h: 87 }),
      station('sales', 658, 375, 658, 251, { x: 578, y: 253, w: 160, h: 106 }),
      station('finance', 963, 375, 963, 251, { x: 883, y: 253, w: 160, h: 106 }),
      station('team', 624, 711, 624, 592, { x: 553, y: 593, w: 143, h: 100 }),
      station('furniture', 817, 711, 817, 592, { x: 749, y: 593, w: 137, h: 100 }),
      station('product', 1026, 711, 1026, 592, { x: 943, y: 593, w: 167, h: 100 }),
      station('coffee', 214, 687, 209, 549, { x: 163, y: 529, w: 88, h: 149 }),
      station('rest', 337, 737, 338, 645, { x: 276, y: 648, w: 124, h: 68 }, 31),
      station('reception', 631, 577, 631, 481, { x: 569, y: 487, w: 127, h: 73 }),
      station('exit', 1117, 724, 1107, 679, { x: 1099, y: 697, w: 30, h: 48 }, 33),
    ],
  },
  floor: {
    name: 'ANDAR INTEIRO', subtitle: 'UM ESTÚDIO COM A CARA DA EMPRESA.',
    floor: { x: 65, y: 181, w: 1153, h: 591 }, walk: { x: 85, y: 201, w: 1110, h: 553 }, spawn: { x: 757, y: 530 },
    sectors: {
      development: { x: 96, y: 202, w: 405, h: 304, door: 'bottom', doorSize: 100 },
      sales: { x: 515, y: 202, w: 309, h: 250, door: 'bottom', doorSize: 104 },
      finance: { x: 838, y: 202, w: 353, h: 250, door: 'bottom', doorSize: 104 },
      hr: { x: 505, y: 586, w: 203, h: 161, door: 'top', doorSize: 100 },
    },
    posts: Array.from({ length: 9 }, (_, i) => ({ x: 116 + (i % 3) * 136, y: 237 + Math.floor(i / 3) * 85, w: 90 })),
    tables: {
      sales: table(603, 260, 146, 'sales'), finance: table(1001, 260, 146, 'finance'),
      team: table(564, 615, 100, 'team'), furniture: table(750, 615, 111, 'furniture'), product: table(1102, 615, 80, 'product'),
      reception: table(568, 517, 122, 'reception'),
    },
    coffee: { x: 108, y: 591 }, lounge: { x: 299, y: 638, w: 184, h: 66 }, board: { x: 565, y: 103 },
    meeting: { x: 280, y: 581, w: 211, h: 166, door: 'right', doorSize: 104, table: table(315, 619, 140, 'meeting'), station: station('meeting', 385, 715, 385, 579, { x: 305, y: 593, w: 160, h: 107 }) },
    ceo: { x: 901, y: 581, w: 162, h: 166, door: 'top', doorSize: 86, table: table(942, 618, 80, 'ceo'), station: station('ceo', 981, 715, 981, 579, { x: 934, y: 593, w: 98, h: 103 }) },
    stations: [
      station('work', 161, 315, 298, 213, { x: 112, y: 209, w: 366, h: 102 }),
      station('board', 633, 228, 633, 89, { x: 565, y: 103, w: 140, h: 87 }),
      station('sales', 676, 353, 676, 225, { x: 598, y: 230, w: 156, h: 107 }),
      station('finance', 1074, 353, 1074, 225, { x: 996, y: 230, w: 157, h: 107 }),
      station('team', 614, 711, 614, 584, { x: 539, y: 590, w: 151, h: 105 }),
      station('furniture', 811, 711, 811, 584, { x: 745, y: 590, w: 133, h: 105 }),
      station('product', 1136, 713, 1136, 584, { x: 1085, y: 590, w: 102, h: 105 }),
      station('coffee', 159, 704, 149, 560, { x: 104, y: 542, w: 88, h: 149 }),
      station('rest', 391, 736, 391, 610, { x: 294, y: 612, w: 194, h: 102 }, 33),
      station('reception', 629, 574, 629, 489, { x: 563, y: 492, w: 133, h: 75 }),
      station('exit', 1174, 531, 1165, 484, { x: 1155, y: 506, w: 30, h: 47 }, 34),
    ],
  },
};

export function createOfficeLayout(office = {}) {
  const layout = clone(MAPS[office.stage] || MAPS.garage);
  layout.stage = MAPS[office.stage] ? office.stage : 'garage';
  const financialRoom = layout.sectors.finance;
  const deskWidth = Math.floor((financialRoom.w - 84) / 2);
  const deskY = financialRoom.y + 104;
  layout.tables.finance = table(financialRoom.x + 12, deskY, deskWidth, 'finance');
  layout.tables.financeAccounts = table(financialRoom.x + financialRoom.w - 12 - deskWidth, deskY, deskWidth, 'finance-accounts');
  layout.financeBoard = { x: financialRoom.x + 12, y: financialRoom.y + 15, w: financialRoom.w - 24, h: 68 };
  Object.assign(layout.stations.find(spot => spot.action === 'finance'), {
    x: financialRoom.x + financialRoom.w / 2, y: financialRoom.y + 88,
    labelX: financialRoom.x + financialRoom.w / 2, labelY: financialRoom.y - 12,
    bounds: { ...layout.financeBoard }, range: 38,
  });
  layout.posts = layout.posts.slice(0, Array.isArray(office.workstations) ? office.workstations.length : 1);
  layout.rooms = Object.entries(layout.sectors).map(([sector, bounds]) => ({ ...bounds, sector, level: office.rooms?.[sector] || 'open', baseEnclosed: sector === 'finance' }));
  for (const key of ['meeting', 'ceo']) {
    if (office.special?.[key] && layout[key]) {
      layout.rooms.push({ ...layout[key], sector: key, level: 'dedicated' });
      layout.tables[key] = layout[key].table;
      layout.stations.push(layout[key].station);
    }
  }
  if (office.special?.meeting && layout.stage !== 'garage') {
    layout.lounge = layout.stage === 'floor' ? { x: 228, y: 612, w: 39, h: 83 } : { x: 164, y: 699, w: 104, h: 37 };
    const rest = layout.stations.find((item) => item.action === 'rest');
    Object.assign(rest, layout.stage === 'floor'
      ? { x: 241, y: 729, labelX: 237, labelY: 578, bounds: { x: 207, y: 595, w: 58, h: 105 } }
      : { x: 217, y: 747, labelX: 217, labelY: 718, bounds: { x: 158, y: 688, w: 114, h: 49 } });
  }
  return layout;
}

export function roomWalls(room) {
  if (room.level === 'open' && !room.baseEnclosed) return [];
  const { x, y, w, h, door = 'bottom', doorSize = 96 } = room;
  const segments = [];
  const wall = (side, sx, sy, sw, sh) => {
    if (room.level === 'partition' && side === door) return;
    if (side !== door) { segments.push({ x: sx, y: sy, w: sw, h: sh, side, room }); return; }
    const total = side === 'left' || side === 'right' ? sh : sw;
    const edge = (total - doorSize) / 2;
    segments.push({ x: sx, y: sy, w: side === 'left' || side === 'right' ? sw : edge, h: side === 'left' || side === 'right' ? edge : sh, side, room });
    segments.push({ x: sx + (side === 'left' || side === 'right' ? 0 : edge + doorSize), y: sy + (side === 'left' || side === 'right' ? edge + doorSize : 0), w: side === 'left' || side === 'right' ? sw : edge, h: side === 'left' || side === 'right' ? edge : sh, side, room });
  };
  wall('top', x, y, w, 6); wall('bottom', x, y + h - 6, w, 6);
  wall('left', x, y, 6, h); wall('right', x + w - 6, y, 6, h);
  return segments.filter((item) => item.w > 0 && item.h > 0);
}
