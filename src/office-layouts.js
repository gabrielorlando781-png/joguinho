import { applyPlacement } from './office-placement.js';
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
const FLOOR_MANAGER_POSTS = {
  sales: { x: 1440, y: 270, w: 110 },
  finance: { x: 1820, y: 435, w: 110 },
  hr: { x: 1440, y: 1170, w: 110 },
};

// Authored starting plans; the placement editor can reposition their owned objects.
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
    name:'ANDAR INTEIRO',subtitle:'',
    floor:{x:65,y:181,w:2180,h:1320},walk:{x:85,y:201,w:2140,h:1280},spawn:{x:1300,y:760},
    sectors:{development:{x:96,y:202,w:1030,h:650,door:'bottom',doorSize:160},sales:{x:1150,y:202,w:455,h:470,door:'bottom',doorSize:140},finance:{x:1630,y:202,w:580,h:470,door:'bottom',doorSize:150},hr:{x:1190,y:1050,w:420,h:400,door:'top',doorSize:130}},
    posts:Array.from({length:21},(_,i)=>({x:120+(i%7)*140,y:245+Math.floor(i/7)*190,w:110})),
    tables:{sales:table(1235,340,170,'sales'),finance:table(1780,340,180,'finance'),team:table(1240,1120,120,'team'),furniture:table(1500,850,126,'furniture'),product:table(1645,1180,156,'product'),reception:table(1220,790,122,'reception')},
    coffee:{x:120,y:1080},lounge:{x:295,y:1120,w:140,h:66},board:{x:1160,y:103},
    meeting:{x:435,y:1000,w:470,h:450,door:'right',doorSize:150,table:table(560,1080,220,'meeting'),station:station('meeting',670,1260,670,990,{x:550,y:1050,w:230,h:120})},
    ceo:{x:1820,y:1040,w:390,h:410,door:'top',doorSize:145,table:table(1950,1130,110,'ceo'),station:station('ceo',2005,1260,2005,1025,{x:1940,y:1100,w:130,h:120})},
    stations:[station('work',175,350,175,206,{x:112,y:205,w:120,h:135}),station('board',1228,228,1228,89,{x:1160,y:103,w:140,h:87}),station('sales',1320,445,1320,190,{x:1229,y:311,w:182,h:108}),station('finance',1920,415,1920,190,{x:1820,y:291,w:200,h:108}),station('team',1300,1225,1300,1035,{x:1233,y:1090,w:134,h:110}),station('furniture',1563,955,1563,820,{x:1494,y:821,w:140,h:108}),station('product',1723,1285,1723,1145,{x:1639,y:1151,w:170,h:108}),station('coffee',171,1190,161,1052,{x:116,y:1033,w:88,h:149}),station('rest',365,1215,365,1093,{x:290,y:1092,w:152,h:108}),station('reception',1281,885,1281,765,{x:1214,y:763,w:134,h:108}),station('exit',2185,795,2185,750,{x:2169,y:765,w:32,h:47})],
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
  if (layout.stage === 'floor') layout.posts.forEach((post, index) => {
    const area = office.workstations?.[index]?.employeeId?.startsWith('manager:') ? office.workstations[index].employeeId.slice(8) : null;
    if (FLOOR_MANAGER_POSTS[area]) Object.assign(post, FLOOR_MANAGER_POSTS[area]);
  });
  layout.rooms = Object.entries(layout.sectors).map(([sector, bounds]) => ({ ...bounds, sector, level: office.rooms?.[sector] || 'open', baseEnclosed: sector === 'finance' }));
  for (const key of ['meeting', 'ceo']) {
    if (office.special?.[key] && layout[key]) {
      layout.rooms.push({ ...layout[key], sector: key, level: 'dedicated' });
      layout.tables[key] = layout[key].table;
      layout.stations.push(layout[key].station);
    }
  }
  if (office.special?.meeting && layout.stage !== 'garage') {
    layout.lounge = layout.stage === 'floor' ? { x: 295, y: 1120, w: 140, h: 66 } : { x: 164, y: 699, w: 104, h: 37 };
    const rest = layout.stations.find((item) => item.action === 'rest');
    Object.assign(rest, layout.stage === 'floor'
      ? { x: 365, y: 1215, labelX: 365, labelY: 1093, bounds: { x: 290, y: 1092, w: 152, h: 108 } }
      : { x: 217, y: 747, labelX: 217, labelY: 718, bounds: { x: 158, y: 688, w: 114, h: 49 } });
  }
  return applyPlacement(layout,office);
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
