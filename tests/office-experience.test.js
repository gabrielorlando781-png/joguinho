import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,applyOfficePlacement,purchaseOfficeItem,saveGame,loadGame} from '../src/simulation.js';
import {createOfficeLayout} from '../src/office-layouts.js';
import {describeLayout,movePlacement,validPlacement} from '../src/office-placement.js';
import {validateFloorPlan,LayoutNavigation} from '../src/office-navigation.js';
import {syncStaff,updateStaff,createRoomDoors,updateDoors} from '../src/staff-motion.js';
function company(){const s=createGame();s.office.stage='floor';s.cash=150000;return s;}
test('the two original early offices are preserved and the last level has a larger single map with reachable owned furniture',()=>{
 for(const [stage,w,h]of [['garage',776,506],['commercial',1010,540],['floor',1700,980]]){const s=company();s.office.stage=stage;const l=createOfficeLayout(s.office);assert.equal(l.floor.w,w);assert.equal(l.floor.h,h);assert.equal(l.portals,undefined);assert.equal(validateFloorPlan(l,s.office).ok,true);}
 const s=company();for(const id of Object.keys(s.office.rooms))s.office.rooms[id]='glass';s.office.special={meeting:true,ceo:true};while(s.office.workstations.length<21){assert.equal(purchaseOfficeItem(s,'desk').ok,true);purchaseOfficeItem(s,'chair');}assert.equal(validateFloorPlan(createOfficeLayout(s.office),s.office).ok,true);
});
test('free placement is a draft, moves an individual PC to arbitrary coordinates, attaches its interaction and preserves resources',()=>{
 const s=company(),before=JSON.stringify(s),l=createOfficeLayout(s.office),items=movePlacement(l,s.office,{},'post:post-1',1103,625);
 assert.equal(JSON.stringify(s),before);assert.equal(items['post:post-1'].x,1103);
 assert.equal(applyOfficePlacement(s,items).ok,true);const moved=createOfficeLayout(s.office);assert.equal(moved.posts[0].x,1103);assert.equal(moved.stations.find(o=>o.action==='work').x,1148);assert.equal(s.cash,150000);assert.equal(s.travelHours,0);assert.equal(s.manualDeliveryHours,0);
 items['post:post-1'].x=999;assert.equal(s.office.placement.stages.floor['post:post-1'].x,1103);
});
test('moving a department carries its furniture, including individually edited pieces, and changing doors preserves circulation',()=>{
 const s=company();s.office.rooms.hr='dedicated';let l=createOfficeLayout(s.office),draft=movePlacement(l,s.office,{},'room:hr',860,765,'left');assert.equal(applyOfficePlacement(s,draft).ok,true);l=createOfficeLayout(s.office);assert.equal(l.tables.team.x,954);assert.equal(l.rooms.find(r=>r.sector==='hr').door,'left');assert.equal(validateFloorPlan(l,s.office).ok,true);
 draft=movePlacement(l,s.office,draft,'table:team',963,835);s.office.placement.stages.floor=draft;l=createOfficeLayout(s.office);draft=movePlacement(l,s.office,draft,'room:hr',840,765);const next=createOfficeLayout({...s.office,placement:{version:1,stages:{floor:draft}}});assert.equal(next.tables.team.x,943);
});
test('overlapping furniture, outside positions and sealed business stations cannot overwrite a valid plant',()=>{
 const s=company();purchaseOfficeItem(s,'desk');const l=createOfficeLayout(s.office),valid=movePlacement(l,s.office,{},'post:post-2',860,650);assert.equal(applyOfficePlacement(s,valid).ok,true);const before=JSON.stringify(s);
 for(const items of [{'post:post-2':{x:116,y:237}},{'post:post-1':{x:3999,y:3999}},{'post:post-1':{x:NaN,y:200}}]){assert.equal(applyOfficePlacement(s,items).ok,false);assert.equal(JSON.stringify(s),before);}
 s.office.amenities.decor=true;assert.equal(applyOfficePlacement(s,{'decor:plant-1':{x:3000,y:3000}}).ok,false);
 assert.equal(validPlacement({version:1,stages:{floor:{unowned:{x:10,y:10}}}}),false);
});
test('edited positions survive save/reload and obsolete floors refund once while preserving all purchased desks',()=>{
 const previous=globalThis.localStorage,m=new Map();globalThis.localStorage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
 try{const s=company();applyOfficePlacement(s,{'post:post-1':{x:1103,y:625}});saveGame(s);assert.deepEqual(loadGame().office.placement,s.office.placement);
 const old=company();while(old.office.workstations.length<21){purchaseOfficeItem(old,'desk');purchaseOfficeItem(old,'chair');}old.office.building={version:1,floors:3,elevator:true};old.cash=10000;saveGame(old);const loaded=loadGame();assert.equal(loaded.cash,52000);assert.equal(loaded.office.workstations.length,21);assert.equal(loaded.office.building,undefined);assert.equal(saveGame(loaded).ok,true);assert.equal(loadGame().cash,52000);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('employees walk real routes, take breaks, return to desks and freeze with the clock without spending founder resources',()=>{
 const s=company();purchaseOfficeItem(s,'desk');purchaseOfficeItem(s,'chair');s.office.workstations[1].employeeId='lucas';s.employees=[{id:'lucas',name:'Lucas',color:'#8c79d9'}];s.paused=false;
 const nav=new LayoutNavigation(createOfficeLayout(s.office),s.office);Object.assign(nav,{state:s,player:{...nav.layout.spawn},staff:new Map(),getStation:action=>nav.layout.stations.find(o=>o.action===action),employees:()=>s.employees});syncStaff(nav);const npc=nav.staff.get('lucas'),home={x:npc.x,y:npc.y};let moved=false,returned=false,hadBreak=false;const cash=s.cash;
 for(let i=0;i<5000;i++){updateStaff(nav,.04);assert.ok(nav.canStand(npc.x,npc.y));if(Math.hypot(npc.x-home.x,npc.y-home.y)>30)moved=true;if(npc.phase==='break')hadBreak=true;if(moved&&hadBreak&&npc.seated&&npc.phase==='working'){returned=true;break;}}
 assert.equal(moved,true);assert.equal(returned,true);s.paused=true;const stopped={x:npc.x,y:npc.y};for(let i=0;i<100;i++)updateStaff(nav,.04);assert.equal(npc.x,stopped.x);assert.equal(npc.y,stopped.y);assert.equal(s.cash,cash);assert.equal(s.travelHours,0);
});
test('wood and glass doors open before passage, remain open for nearby staff and close after everyone leaves',()=>{
 const s=company();s.office.rooms.sales='glass';const layout=createOfficeLayout(s.office),scene={doors:createRoomDoors(layout),player:{x:1050,y:690},staff:new Map()};const d=scene.doors.find(d=>d.id==='sales');assert.equal(d.progress,0);assert.equal(d.glass,true);
 scene.player={...d.center};for(let i=0;i<20;i++)updateDoors(scene,.05);assert.equal(d.progress,1);scene.player={x:100,y:1100};scene.staff.set('lucas',{...d.center});for(let i=0;i<40;i++)updateDoors(scene,.05);assert.equal(d.progress,1);scene.staff.clear();for(let i=0;i<40;i++)updateDoors(scene,.05);assert.equal(d.progress,0);
});
