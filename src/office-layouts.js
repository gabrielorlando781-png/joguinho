import { createBuilding, BUILDING_SECTORS, BUILDING_BAYS, SECTOR_NAMES, floorName } from './office-building.js';

const META = { work: ['DESENVOLVIMENTO', 'Sentar e trabalhar'], sales: ['COMERCIAL', 'Conversar com clientes'], team: ['PESSOAS & CULTURA', 'Cuidar da equipe'], finance: ['FINANCEIRO', 'Consultar o quadro financeiro'], board: ['PROJETOS', 'Consultar os projetos'], furniture: ['LOJA DO ESCRITÓRIO', 'Planejar o escritório'], coffee: ['CAFÉ', 'Preparar um café'], rest: ['DESCANSO', 'Fazer uma pausa'], product: ['LABORATÓRIO', 'Desenvolver um produto'], reception: ['DIÁRIO', 'Abrir o diário'], exit: ['SAÍDA', 'Encerrar o expediente'], meeting: ['REUNIÕES', 'Reunir a equipe'], ceo: ['SALA DO CEO', 'Cuidar da liderança'] };
const actionFor = { development: 'work', sales: 'sales', hr: 'team', finance: 'finance', meeting: 'meeting', ceo: 'ceo' };
const table = (x,y,w,kind) => ({x,y,w,h:62,kind});
function station(action,x,y,labelX,labelY,bounds,range=42,custom=null) {
  const [label,verb] = custom || META[action] || [action,'Usar passagem'];
  return { action,x,y,labelX,labelY,bounds,range,label,verb };
}
function base(stage, location) {
  const small=stage==='garage';
  const floor=small ? {x:180,y:180,w:1000,h:1040} : {x:80,y:180,w:1340,h:1180};
  return {stage, location:{...location}, viewKey:`${stage}:${location.floor}:${location.room || 'hall'}`, name:location.room ? SECTOR_NAMES[location.room] : floorName(location.floor),
    width:1560,height:1480, floor, walk:{x:floor.x+20,y:floor.y+20,w:floor.w-40,h:floor.h-40}, spawn:{x:floor.x+floor.w/2,y:small?550:625},
    sectors:{},rooms:[],tables:{},posts:[],stations:[],portals:[],structures:[],fixtures:[],emptyBays:[],coffee:null,lounge:null,board:null,financeBoard:null};
}
export function getLayoutBays(stage='garage') {
  const small=stage==='garage';
  return Object.fromEntries(BUILDING_BAYS.map((id,i)=>[id,{x:small?(i%2?810:220):(i%2?940:120),y:i<2?220:(small?650:760),w:small?330:440,h:small?280:350}]));
}
function postsIn(layout, area, indices, interior=false) {
  const cols=indices.length<=2?2:3, width=interior?136:90;
  const spacing=interior?220:(area.w-60-width)/(cols-1), row=interior?155:100;
  indices.forEach((index,i)=>layout.posts.push({x:area.x+30+(i%cols)*spacing,y:area.y+(interior?80:45)+Math.floor(i/cols)*row,w:width,index}));
  const founder=layout.posts.find(p=>p.index===0);
  if (founder) {
    const x=founder.x+founder.w/2,y=founder.y+65*(founder.w/136)+28;
    layout.stations.push(station('work',x,y,area.x+area.w/2,area.y+15,{x:founder.x-5,y:founder.y-45,w:founder.w+10,h:110},45));
  }
}
function sectorContents(layout, sector, area, office, interior=false) {
  const {x,y,w,h}=area;
  if(sector==='development') postsIn(layout,area,Array.from({length:Math.min(9,office.workstations?.length||1)},(_,i)=>i),interior);
  else if(sector==='finance') {
    const deskWidth=interior?240:Math.floor((w-100)/2), deskY=y+(interior?225:130);
    layout.tables.finance=table(x+20,deskY,deskWidth,'finance');layout.tables.financeAccounts=table(x+w-20-deskWidth,deskY,deskWidth,'finance-accounts');
    layout.financeBoard={x:x+20,y:y+24,w:w-40,h:interior?110:75};
    layout.stations.push(station('finance',x+w/2,y+(interior?170:104),x+w/2,y+12,{...layout.financeBoard},42));
  } else {
    const kind=sector==='hr'?'team':sector;
    const deskWidth=interior?270:Math.min(180,w-100), deskY=y+(interior?180:75);
    layout.tables[kind]=table(x+(w-deskWidth)/2,deskY,deskWidth,kind);
    layout.stations.push(station(actionFor[sector],x+w/2,deskY+90,x+w/2,y+15,{x:x+(w-deskWidth)/2-5,y:deskY-30,w:deskWidth+10,h:95},45));
  }
}
function portal(layout,room,bounds,glass=false,side='bottom') {
  const x=bounds.x+bounds.w/2,y=side==='top'?bounds.y-27:bounds.y+bounds.h+27;
  const item={room,...bounds,glass,side};layout.portals.push(item);
  layout.stations.push(station(`enter:${room}`,x,y,x,side==='top'?bounds.y+20:bounds.y+bounds.h-23,{x:x-42,y:side==='top'?bounds.y-4:bounds.y+bounds.h-55,w:84,h:60},44,[SECTOR_NAMES[room].toUpperCase(),'Entrar pela porta']));
}
function support(layout,office) {
  const f=layout.floor, y=f.y+f.h-120;
  layout.coffee={x:f.x+35,y};layout.stations.push(station('coffee',f.x+78,y+97,f.x+75,y-35,{x:f.x+30,y:y-40,w:91,h:132}));
  layout.lounge={x:f.x+170,y:y+27,w:120,h:45};layout.stations.push(station('rest',f.x+230,y+95,f.x+230,y-3,{x:f.x+165,y:y+15,w:130,h:65}));
  if(layout.location.floor===0) {
    [['furniture',.42,120],['reception',.64,120],['product',.85,120]].forEach(([kind,p,w])=>{
      const x=f.x+f.w*p;
      layout.tables[kind]=table(x-w/2,y+2,w,kind);
      layout.stations.push(station(kind,x,y+92,x,y-29,{x:x-w/2-4,y:y-21,w:w+8,h:85}));
    });
    const x=f.x+f.w-35;layout.stations.push(station('exit',x,y+99,x,y+60,{x:x-16,y:y+77,w:32,h:40},40));
    layout.board={x:f.x+f.w/2-70,y:f.y-100};layout.stations.push(station('board',f.x+f.w/2,f.y+35,f.x+f.w/2,f.y-112,{...layout.board,w:140,h:88},50));
  }
  const b=office.building||createBuilding(), cx=f.x+f.w/2;
  if(b.floors>1) {
    if(layout.location.floor<b.floors-1) {
      layout.structures.push({kind:'stairs-up',x:cx-185,y:f.y+140,w:100,h:115});
      layout.stations.push(station('stairs:up',cx-135,f.y+285,cx-135,f.y+120,{x:cx-185,y:f.y+140,w:100,h:115},45,['ESCADA ↑','Subir um andar']));
    }
    if(layout.location.floor>0) {
      layout.structures.push({kind:'stairs-down',x:cx+85,y:f.y+140,w:100,h:115});
      layout.stations.push(station('stairs:down',cx+135,f.y+285,cx+135,f.y+120,{x:cx+85,y:f.y+140,w:100,h:115},45,['ESCADA ↓','Descer um andar']));
    }
    if(b.elevator) {
      layout.structures.push({kind:'elevator',x:cx-50,y:f.y+315,w:100,h:90});
      layout.stations.push(station('elevator',cx,f.y+432,cx,f.y+295,{x:cx-50,y:f.y+315,w:100,h:90},45,['ELEVADOR','Escolher andar']));
    }
  }
}
function interior(office,b) {
  const room=b.location.room, layout=base(office.stage||'garage',b.location);
  const wide=room==='development'||room==='studio', roomWidth=wide?1040:900, roomHeight=room==='development'?760:room==='studio'?680:620;
  layout.width=1280;layout.height=1060;layout.floor={x:100,y:190,w:roomWidth,h:roomHeight};layout.walk={x:120,y:210,w:roomWidth-40,h:roomHeight-40};layout.spawn={x:100+roomWidth/2,y:190+roomHeight-85};
  layout.interior=true;layout.glass=office.rooms?.[room]==='glass';
  const area={x:180,y:235,w:roomWidth-160,h:roomHeight-190};
  layout.rooms.push({...area,sector:room==='studio'?'development':room,level:'open'});
  if(BUILDING_SECTORS.includes(room)) {layout.sectors[room]={...area};sectorContents(layout,room,area,office,true);}
  else if(room==='studio') {
    const start=9+(b.location.floor-1)*6, count=Math.max(0,Math.min(6,(office.workstations?.length||1)-start));
    postsIn(layout,area,Array.from({length:count},(_,i)=>start+i),true);
    layout.fixtures.push({kind:'cabinet',x:layout.floor.x+35,y:layout.floor.y+90,w:65,h:100});
  } else {
    const kind=room, w=room==='meeting'?440:290,x=layout.floor.x+layout.floor.w/2-w/2,y=410;
    layout.tables[kind]=table(x,y,w,kind);layout.stations.push(station(kind,x+w/2,y+95,x+w/2,y-50,{x,y:y-20,w,h:100},45));
  }
  layout.fixtures.push({kind:'cabinet',x:layout.floor.x+layout.floor.w-85,y:layout.floor.y+90,w:55,h:100});
  layout.fixtures.push({kind:'plant',x:layout.floor.x+30,y:layout.floor.y+280,w:48,h:60});
  if(room!=='development'&&room!=='studio') {
    layout.fixtures.push({kind:'sofa',x:layout.floor.x+40,y:layout.floor.y+layout.floor.h-100,w:150,h:45});
    if(room!=='finance')for(const dx of [-205,165])layout.fixtures.push({kind:'visitor-chair',x:layout.floor.x+layout.floor.w/2+dx,y:535,w:38,h:36});
  }
  const f=layout.floor, door={x:f.x+f.w/2-43,y:f.y+f.h-38,w:86,h:30};
  layout.returnDoor=door;layout.stations.push(station('leave-room',f.x+f.w/2,f.y+f.h-66,f.x+f.w/2,f.y+f.h-13,{...door},48,['CORREDOR','Sair pela porta']));
  return layout;
}
export function createOfficeLayout(office={}) {
  const b=office.building||createBuilding();
  if(b.location.room) return interior(office,b);
  const layout=base(office.stage||'garage',b.location), bays=getLayoutBays(layout.stage);
  for(const sector of BUILDING_SECTORS) {
    const p=b.placements[sector];if(p.floor!==b.location.floor)continue;
    const area=bays[p.bay],level=office.rooms?.[sector]||'open';layout.sectors[sector]={...area,door:p.door,doorSize:100};
    if(['dedicated','glass'].includes(level)) portal(layout,sector,area,level==='glass',p.bay.startsWith('n')?'bottom':'top');
    else {layout.rooms.push({...area,sector,level,door:p.door,doorSize:100});sectorContents(layout,sector,area,office);}
  }
  for(const bay of BUILDING_BAYS) if(!BUILDING_SECTORS.some(s=>b.placements[s].floor===b.location.floor&&b.placements[s].bay===bay))layout.emptyBays.push({...bays[bay],bay});
  const cx=layout.floor.x+layout.floor.w/2;
  if(b.location.floor===0) {
    if(office.special?.meeting)portal(layout,'meeting',{x:cx-170,y:630,w:120,h:70});
    if(office.special?.ceo)portal(layout,'ceo',{x:cx+50,y:630,w:120,h:70});
  } else portal(layout,'studio',{x:cx-90,y:650,w:180,h:70});
  support(layout,office);
  return layout;
}
export function roomWalls(room) {
  if(room.level==='open')return [];
  const {x,y,w,h,door='bottom',doorSize=100}=room, result=[];
  for(const [side,sx,sy,sw,sh] of [['top',x,y,w,6],['bottom',x,y+h-6,w,6],['left',x,y,6,h],['right',x+w-6,y,6,h]]) {
    if(side===door&&room.level==='partition')continue;
    if(side!==door){result.push({x:sx,y:sy,w:sw,h:sh,side,room});continue;}
    const vertical=side==='left'||side==='right',edge=((vertical?sh:sw)-doorSize)/2;
    result.push({x:sx,y:sy,w:vertical?sw:edge,h:vertical?edge:sh,side,room},{x:sx+(vertical?0:edge+doorSize),y:sy+(vertical?edge+doorSize:0),w:vertical?sw:edge,h:vertical?edge:sh,side,room});
  }
  return result;
}
