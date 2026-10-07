import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, expandBuilding, expandOffice, setOfficeLayout, moveOfficeLocation, purchaseOfficeItem, advanceDay, saveGame, loadGame, getOfficeOverview } from '../src/simulation.js';
import { createBuilding, validBuilding, getVerticalEligibility, locationForAction } from '../src/office-building.js';
import { createOfficeLayout, roomWalls } from '../src/office-layouts.js';
import { OfficeScene } from '../src/office.js';
import { createLayoutDraft, moveDraftSector } from '../src/layout-editor.js';
import { getCashForecast, getMonthlyStatement } from '../src/finance-model.js';

function company() {
  const state=createGame({name:'Ana',company:'Aurora',age:28,trait:'balanced'});
  state.office.stage='floor';state.cash=150000;state.stats.delivered=12;state.reputation=50;
  for(const id of ['lucas','marina','bia']) {
    state.employees.push({id,name:id,role:'Dev',salary:2400,productivity:5,contract:'CLT',color:'#8c79d9',morale:80,stress:0,hiredDay:1,assignment:'auto',assignmentRole:'delivery'});
    state.office.workstations.push({id:`post-${state.office.nextWorkstationId++}`,desk:true,chair:true,computerLevel:1,employeeId:id});
  }
  return state;
}
function navigation(office) {
  const s=Object.create(OfficeScene.prototype);s.state={office};s.layout=createOfficeLayout(office);s.obstacles=s.buildObstacles();s.hotspots=s.layout.stations;s.player={...s.layout.spawn};return s;
}
function checkRoutes(office) {
  const s=navigation(office);
  assert.ok(s.canStand(s.player.x,s.player.y),`Bad spawn ${s.layout.viewKey}`);
  for(const spot of s.hotspots) {
    assert.ok(s.canStand(spot.x,spot.y),`Blocked ${spot.action} in ${s.layout.viewKey}`);
    assert.ok(s.findPath(s.player,spot),`No route to ${spot.action} in ${s.layout.viewKey}`);
  }
}
test('vertical expansion enforces ownership, stage, progress, budget and the three-floor limit without partial purchases',()=>{
  const state=createGame(),before=JSON.stringify(state);
  assert.equal(expandBuilding(state,'floor-2').ok,false);assert.equal(expandBuilding(state,'elevator').ok,false);assert.equal(JSON.stringify(state),before);
  const s=company(),cash=s.cash;
  assert.equal(expandBuilding(s,'floor-3').ok,false);assert.equal(expandBuilding(s,'floor-2').ok,true);assert.equal(s.cash,cash-14000);
  const after=JSON.stringify(s);assert.equal(expandBuilding(s,'floor-2').ok,false);assert.equal(JSON.stringify(s),after);
  assert.equal(expandBuilding(s,'floor-3').ok,true);assert.equal(expandBuilding(s,'elevator').ok,true);assert.equal(s.office.building.floors,3);assert.equal(validBuilding(s.office),true);
  const final=JSON.stringify(s);assert.equal(expandBuilding(s,'floor-4').ok,false);assert.equal(JSON.stringify(s),final);
});
test('new floors add actual capacity, rent, maintenance and forecast debits; construction stays outside operating profit',()=>{
  const s=company(),before=getOfficeOverview(s),expenses=getMonthlyStatement(s).current.costs;
  expandBuilding(s,'floor-2');expandBuilding(s,'floor-3');expandBuilding(s,'elevator');
  const overview=getOfficeOverview(s);
  assert.equal(overview.maxSlots,before.maxSlots+32);assert.equal(overview.stage.maxPosts,21);
  assert.equal(overview.dailyRent,before.dailyRent+354);assert.equal(overview.monthlyMaintenance,before.monthlyMaintenance+340);
  assert.equal(getMonthlyStatement(s).current.costs,expenses);
  const predicted=getCashForecast(s,30);for(const day of predicted.daily){advanceDay(s);assert.equal(s.cash,day.balance);}
});
test('layout edits are drafts, swap occupied spaces and apply atomically with no billing or lost staff',()=>{
  const s=company();expandBuilding(s,'floor-2');const draft=createLayoutDraft(s.office),before=JSON.stringify(s),old={...draft.placements.development};
  draft.selected='development';moveDraftSector(draft,0,'se');
  assert.deepEqual(draft.placements.finance,{...old,door:'top'});assert.equal(JSON.stringify(s),before);
  draft.selected='finance';moveDraftSector(draft,1,'ne');draft.placements.finance.door='left';
  const cash=s.cash,staff=JSON.stringify(s.employees),posts=JSON.stringify(s.office.workstations);
  assert.equal(setOfficeLayout(s,draft.placements).ok,true);assert.equal(s.cash,cash);assert.equal(JSON.stringify(s.employees),staff);assert.equal(JSON.stringify(s.office.workstations),posts);
  const stored=JSON.stringify(s);const bad=structuredClone(draft.placements);bad.finance={...bad.sales};
  assert.equal(setOfficeLayout(s,bad).ok,false);assert.equal(JSON.stringify(s),stored);
  bad.finance.floor=3;assert.equal(setOfficeLayout(s,bad).ok,false);assert.equal(JSON.stringify(s),stored);
  draft.placements.finance.bay='sw';assert.equal(s.office.building.placements.finance.bay,'ne','Applied layout owns its copy.');
});
test('dedicated and glass departments become real door destinations, with their business station only inside',()=>{
  for(const level of ['dedicated','glass'])for(const [sector,action] of Object.entries({development:'work',sales:'sales',hr:'team',finance:'finance'})) {
    const s=company();s.office.rooms[sector]=level;
    const hall=createOfficeLayout(s.office);assert.equal(hall.stations.some(st=>st.action===action),false);assert.ok(hall.portals.some(p=>p.room===sector&&p.glass===(level==='glass')));
    assert.deepEqual(locationForAction(s.office,action),{floor:0,room:sector});
    assert.equal(moveOfficeLocation(s,`enter:${sector}`).ok,true);const inside=createOfficeLayout(s.office);assert.equal(inside.interior,true);assert.ok(inside.stations.some(st=>st.action===action));checkRoutes(s.office);
    assert.equal(moveOfficeLocation(s,'leave-room').ok,true);const scene=navigation(s.office);assert.ok(scene.canStand(s.officePosition.x,s.officePosition.y));scene.player={...s.officePosition};assert.ok(scene.isNearStation(`enter:${sector}`));
  }
});
test('all corridor sectors and four partition orientations remain reachable in every base map and rearrangement',()=>{
  for(const stage of ['garage','commercial','floor'])for(const door of ['top','right','bottom','left']) {
    const s=createGame();s.office.stage=stage;
    for(const sector of Object.keys(s.office.rooms)){s.office.rooms[sector]='partition';s.office.building.placements[sector].door=door;}
    checkRoutes(s.office);
    const draft=createLayoutDraft(s.office);draft.selected='development';moveDraftSector(draft,0,'se');setOfficeLayout(s,draft.placements);checkRoutes(s.office);
  }
});
test('upper floors, occupied private rooms, special rooms and support desks preserve physical circulation',()=>{
  const s=company();expandBuilding(s,'floor-2');expandBuilding(s,'floor-3');expandBuilding(s,'elevator');s.office.special={meeting:true,ceo:true};
  for(const floor of [0,1,2]) {
    s.office.building.location={floor,room:null};checkRoutes(s.office);
    for(const room of floor===0?['meeting','ceo']:['studio']) {s.office.building.location={floor,room};checkRoutes(s.office);}
  }
  s.office.building.location={floor:0,room:null};while(s.office.workstations.length<21){assert.equal(purchaseOfficeItem(s,'desk').ok,true);assert.equal(purchaseOfficeItem(s,'chair').ok,true);}
  assert.equal(purchaseOfficeItem(s,'desk').ok,false);s.office.building.location={floor:2,room:'studio'};
  assert.deepEqual(createOfficeLayout(s.office).posts.map(p=>p.index),[15,16,17,18,19,20]);checkRoutes(s.office);
});
test('stairs and elevator traverse acquired floors, account for real travel and never reset the daily cap',()=>{
  const s=company();expandBuilding(s,'floor-2');expandBuilding(s,'floor-3');expandBuilding(s,'elevator');
  assert.equal(moveOfficeLocation(s,'stairs:down').ok,false);assert.equal(moveOfficeLocation(s,'stairs:up').ok,true);assert.equal(s.travelHours,.1);
  assert.equal(moveOfficeLocation(s,'stairs:up').ok,true);assert.equal(s.travelHours,.2);const before=JSON.stringify(s);assert.equal(moveOfficeLocation(s,'stairs:up').ok,false);assert.equal(JSON.stringify(s),before);
  assert.equal(moveOfficeLocation(s,'elevator',0).ok,true);assert.equal(s.travelHours,.25);assert.equal(s.office.building.location.floor,0);
  assert.equal(moveOfficeLocation(s,'elevator',1).ok,true);assert.equal(s.travelHours,.275);
  moveOfficeLocation(s,'elevator',0);assert.equal(s.travelHours,.3);assert.equal(s.actionHours,.3);
  const scene=navigation(s.office);assert.ok(scene.canStand(s.officePosition.x,s.officePosition.y));
  s.travelHours=.74;moveOfficeLocation(s,'stairs:up');assert.equal(s.travelHours,.75);s.day=6;moveOfficeLocation(s,'stairs:down');assert.equal(s.travelHours,.75);
});
test('old saves migrate their geometry once and building/room locations survive reload; corrupt buildings preserve the last valid save',()=>{
  const old=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  try {
    const s=company();delete s.office.building;s.officePosition={x:600,y:500};assert.equal(saveGame(s).ok,true);
    const loaded=loadGame();assert.deepEqual(loaded.office.building,createBuilding());assert.deepEqual(loaded.officePosition,{x:0,y:0});assert.equal(loaded.cash,s.cash);
    expandBuilding(loaded,'floor-2');loaded.office.rooms.finance='glass';const draft=createLayoutDraft(loaded.office);draft.selected='finance';moveDraftSector(draft,1,'ne');setOfficeLayout(loaded,draft.placements);
    moveOfficeLocation(loaded,'stairs:up');moveOfficeLocation(loaded,'enter:finance');assert.equal(saveGame(loaded).ok,true);
    const restored=loadGame();assert.deepEqual(restored.office.building,loaded.office.building);assert.deepEqual(restored.officePosition,loaded.officePosition);
    const good=values.get('joguinho-save-v1');const missingRooms=structuredClone(restored.office);delete missingRooms.rooms;assert.equal(validBuilding(missingRooms),false);const missingSpecial=structuredClone(restored.office);missingSpecial.building.location={floor:0,room:'meeting'};delete missingSpecial.special;assert.equal(validBuilding(missingSpecial),false);loaded.office.building.placements.finance.floor=2;assert.equal(saveGame(loaded).ok,false);assert.equal(values.get('joguinho-save-v1'),good);
  } finally {if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
