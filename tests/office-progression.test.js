import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, acceptProject, negotiateProject, discoverLead, interviewCandidate,
  hireEmployee, setAllocation, assignEmployee, performAction, advanceDay,
  purchaseOfficeItem, expandOffice, upgradeRoom, upgradeComputer,
  customizeBanner, performRoomAction, saveGame, loadGame,
  getOfficeOverview,
} from '../src/simulation.js';

const originalStorage = globalThis.localStorage;
afterEach(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

function storage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}

function unchanged(state, action) {
  const before = JSON.stringify(state);
  assert.equal(action().ok, false);
  assert.equal(JSON.stringify(state), before, 'A rejected decision must not spend money, time, or space');
}

function seatEmployee(state, id) {
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  const post = state.office.workstations.find((item) => item.employeeId === null && !item.chair);
  assert.ok(post);
  assert.equal(purchaseOfficeItem(state, 'chair', { workstationId: post.id }).ok, true);
  assert.equal(interviewCandidate(state, id).ok, true);
  assert.equal(hireEmployee(state, id).ok, true);
  assert.equal(post.employeeId, id);
  return post;
}

function matureCompany({ team = 0, stage = 'commercial' } = {}) {
  const state = createGame({ name: 'Ana', company: 'Empresa de teste', trait: 'balanced' });
  const first = acceptProject(state, state.leads[0].id).project;
  assert.ok(first);
  // Completed contract fixtures isolate office progression from delivery speed.
  // Equipment, staffing, expansions, and rooms are bought through public actions.
  state.projects = Array.from({ length: 8 }, (_, index) => ({
    ...structuredClone(first), id: `completed-${index + 1}`, status: 'delivered',
    phase: 'delivered', progress: first.hours, paid: true, completedDay: 1,
    dueDay: 4, invoiceAmount: first.price, eventTriggered: true,
  }));
  state.stats.delivered = 8;
  state.reputation = 60;
  state.cash = 100000;
  if (stage !== 'garage') assert.equal(expandOffice(state, 'commercial').ok, true);
  if (team) assert.equal(setAllocation(state, 'quality', team).ok, true);
  for (const id of ['lucas', 'marina', 'bia'].slice(0, team)) seatEmployee(state, id);
  if (stage === 'floor') assert.equal(expandOffice(state, 'floor').ok, true);
  state.manualQualityHours = 0;
  state.actionHours = 0;
  return state;
}

function longProject(state) {
  const accepted = acceptProject(state, state.leads[0].id);
  assert.equal(accepted.ok, true);
  accepted.project.hours = 500;
  accepted.project.deadline = 500;
  accepted.project.eventTriggered = true;
  return accepted.project;
}

test('new offices have one founder workstation, independent rooms, and a small garage', () => {
  const first = createGame();
  const second = createGame();
  assert.equal(first.version, 3);
  assert.equal(first.office.stage, 'garage');
  assert.equal(first.office.workstations.length, 1);
  assert.deepEqual(first.office.workstations[0], {
    id: 'post-1', desk: true, chair: true, computerLevel: 1, employeeId: 'founder',
  });
  assert.deepEqual(first.office.rooms, { development: 'open', sales: 'open', hr: 'open', finance: 'open' });
  first.office.rooms.sales = 'partition';
  first.office.workstations[0].computerLevel = 3;
  assert.equal(second.office.rooms.sales, 'open');
  assert.equal(second.office.workstations[0].computerLevel, 1);
  assert.equal(advanceDay(second).summary.costs, 90);
});

test('an interview and affordable payroll do not replace a complete free desk and chair', () => {
  const state = createGame();
  assert.equal(interviewCandidate(state, 'lucas').ok, true);
  unchanged(state, () => hireEmployee(state, 'lucas'));
  assert.equal(purchaseOfficeItem(state, 'desk').ok, true);
  const post = state.office.workstations.find((item) => item.employeeId === null);
  assert.ok(post && !post.chair);
  unchanged(state, () => hireEmployee(state, 'lucas'));
  unchanged(state, () => purchaseOfficeItem(state, 'chair', { workstationId: 'missing' }));
  assert.equal(purchaseOfficeItem(state, 'chair', { workstationId: post.id }).ok, true);
  unchanged(state, () => purchaseOfficeItem(state, 'chair', { workstationId: post.id }));
  const cash = state.cash;
  assert.equal(hireEmployee(state, 'lucas').ok, true);
  assert.equal(state.cash, cash, 'Hiring starts recurring payroll rather than billing a second equipment purchase');
  assert.equal(post.employeeId, 'lucas');
  unchanged(state, () => purchaseOfficeItem(state, 'desk'));
});

test('expansion requires business progress, charges the advertised price, and increases ongoing rent', () => {
  const fresh = createGame();
  unchanged(fresh, () => expandOffice(fresh, 'commercial'));
  unchanged(fresh, () => expandOffice(fresh, 'floor'));
  unchanged(fresh, () => expandOffice(fresh, 'castle'));
  const state = matureCompany({ stage: 'garage' });
  state.cash = 6499;
  unchanged(state, () => expandOffice(state, 'commercial'));
  state.cash = 20000;
  assert.equal(expandOffice(state, 'commercial').ok, true);
  assert.equal(state.cash, 13500);
  assert.equal(state.office.stage, 'commercial');
  unchanged(state, () => expandOffice(state, 'commercial'));
  assert.equal(advanceDay(state).summary.costs, 145);
  unchanged(state, () => expandOffice(state, 'floor'));
  const larger = matureCompany({ team: 2 });
  const cash = larger.cash;
  assert.equal(expandOffice(larger, 'floor').ok, true);
  assert.equal(larger.cash, cash - 16000);
  assert.equal(larger.office.stage, 'floor');
  unchanged(larger, () => expandOffice(larger, 'commercial'));
});

test('computer tiers improve only the owner output and more powerful hardware has higher upkeep', () => {
  const base = matureCompany();
  base.office.stage = 'floor';
  const project = longProject(base);
  assert.equal(setAllocation(base, 'quality', 0).ok, true);
  assert.equal(setAllocation(base, 'sales', 0).ok, true);
  const tier2 = structuredClone(base);
  const tier3 = structuredClone(base);
  assert.equal(upgradeComputer(tier2, 'post-1', 2).ok, true);
  assert.equal(upgradeComputer(tier3, 'post-1', 2).ok, true);
  assert.equal(upgradeComputer(tier3, 'post-1', 3).ok, true);
  unchanged(tier3, () => upgradeComputer(tier3, 'post-1', 3));
  unchanged(tier3, () => upgradeComputer(tier3, 'post-1', 1));
  unchanged(tier3, () => upgradeComputer(tier3, 'missing', 2));
  assert.equal(performAction(base, 'work').ok, true);
  assert.equal(performAction(tier2, 'work').ok, true);
  assert.equal(performAction(tier3, 'work').ok, true);
  const progress = (company) => company.projects.find((item) => item.id === project.id).progress;
  assert.ok(progress(base) < progress(tier2));
  assert.ok(progress(tier2) < progress(tier3));
  for (const company of [base, tier2, tier3]) company.day = company.office.nextMaintenanceDay;
  const upkeep = [base, tier2, tier3].map((company) => advanceDay(company).summary.costs - 265);
  assert.deepEqual(upkeep, [20, 70, 150]);
});

test('upgrading an employee computer does not multiply the founder workstation', () => {
  const original = matureCompany({ team: 1 });
  const project = longProject(original);
  const equipped = structuredClone(original);
  const employeePost = equipped.office.workstations.find((item) => item.employeeId === 'lucas');
  assert.equal(upgradeComputer(equipped, employeePost.id, 2).ok, true);
  const founderOriginal = structuredClone(original);
  const founderEquipped = structuredClone(equipped);
  assert.equal(performAction(founderOriginal, 'work').ok, true);
  assert.equal(performAction(founderEquipped, 'work').ok, true);
  assert.equal(founderOriginal.projects.at(-1).progress, founderEquipped.projects.at(-1).progress);
  for (const company of [original, equipped]) {
    assert.equal(setAllocation(company, 'sales', 8).ok, true);
    assert.equal(assignEmployee(company, 'lucas', project.id).ok, true);
  }
  advanceDay(original);
  advanceDay(equipped);
  assert.ok(equipped.projects.at(-1).progress > original.projects.at(-1).progress);
});

test('monthly hardware maintenance is charged once on weekends and scheduled for the next 28-day cycle', () => {
  const state = createGame();
  state.day = 6;
  state.office.nextMaintenanceDay = 6;
  const cash = state.cash;
  const saturday = advanceDay(state);
  assert.equal(saturday.summary.weekend, true);
  assert.equal(saturday.summary.costs, 110);
  assert.equal(state.cash, cash - 110);
  assert.equal(state.office.nextMaintenanceDay, 34);
  assert.equal(advanceDay(state).summary.costs, 90);
  const entries = () => state.ledger.filter((entry) => /manuten/i.test(entry.label));
  assert.equal(entries().length, 1);
  while (state.day < 34) advanceDay(state);
  assert.equal(entries().length, 1);
  assert.equal(advanceDay(state).summary.costs, 110);
  assert.equal(entries().length, 2);
  assert.equal(state.office.nextMaintenanceDay, 62);
});

test('desks, lounge, and equipment compete with room partitions for the same finite floor space', () => {
  const state = matureCompany({ stage: 'garage' });
  assert.equal(setAllocation(state, 'quality', 1).ok, true);
  seatEmployee(state, 'lucas');
  assert.equal(purchaseOfficeItem(state, 'lounge').ok, true);
  assert.equal(purchaseOfficeItem(state, 'coffee-machine').ok, true);
  assert.equal(purchaseOfficeItem(state, 'whiteboard').ok, true);
  assert.equal(getOfficeOverview(state).usedSlots, 6);
  assert.equal(getOfficeOverview(state).maxSlots, 6);
  unchanged(state, () => upgradeRoom(state, 'development', 'partition'));
  assert.equal(purchaseOfficeItem(state, 'decor').ok, true);
  assert.equal(getOfficeOverview(state).usedSlots, 6, 'Wall decoration uses no furniture position');
  assert.equal(expandOffice(state, 'commercial').ok, true);
  assert.equal(upgradeRoom(state, 'development', 'partition').ok, true);
  assert.equal(getOfficeOverview(state).usedSlots, 7);
  assert.equal(getOfficeOverview(state).maxSlots, 16);
});

test('room construction belongs to each sector and its progress gates reject incomplete companies atomically', () => {
  const fresh = createGame();
  unchanged(fresh, () => upgradeRoom(fresh, 'development', 'partition'));
  unchanged(fresh, () => upgradeRoom(fresh, 'finance', 'dedicated'));
  unchanged(fresh, () => upgradeRoom(fresh, 'sales', 'glass'));
  unchanged(fresh, () => upgradeRoom(fresh, '__proto__', 'partition'));
  const state = matureCompany({ team: 2 });
  assert.equal(upgradeRoom(state, 'development', 'partition').ok, true);
  assert.equal(state.office.rooms.development, 'partition');
  assert.equal(state.office.rooms.sales, 'open');
  assert.equal(upgradeRoom(state, 'development', 'dedicated').ok, true);
  assert.equal(state.office.rooms.development, 'dedicated');
  unchanged(state, () => upgradeRoom(state, 'development', 'partition'));
  unchanged(state, () => upgradeRoom(state, 'development', 'dedicated'));
  unchanged(state, () => upgradeRoom(state, 'development', 'glass'));
  assert.equal(expandOffice(state, 'floor').ok, true);
  assert.equal(upgradeRoom(state, 'development', 'glass').ok, true);
  assert.equal(state.office.rooms.development, 'glass');
  assert.equal(state.office.rooms.finance, 'open');
});

test('insufficient construction cash never partially adds a room, an expansion, or an amenity', () => {
  const state = matureCompany({ team: 2 });
  state.cash = 0;
  unchanged(state, () => upgradeRoom(state, 'sales', 'partition'));
  unchanged(state, () => upgradeRoom(state, 'development', 'dedicated'));
  unchanged(state, () => expandOffice(state, 'floor'));
  unchanged(state, () => purchaseOfficeItem(state, 'lounge'));
  unchanged(state, () => upgradeComputer(state, 'post-1', 2));
  unchanged(state, () => purchaseOfficeItem(state, 'meeting'));
});

test('an improved HR room changes both interview quality and the hired employee capability', () => {
  const baseline = matureCompany({ team: 2 });
  const improved = structuredClone(baseline);
  assert.equal(upgradeRoom(improved, 'hr', 'partition').ok, true);
  assert.equal(upgradeRoom(improved, 'hr', 'dedicated').ok, true);
  for (const company of [baseline, improved]) {
    assert.equal(setAllocation(company, 'quality', 1).ok, true);
    assert.equal(purchaseOfficeItem(company, 'desk').ok, true);
    const post = company.office.workstations.find((item) => item.employeeId === null);
    assert.equal(purchaseOfficeItem(company, 'chair', { workstationId: post.id }).ok, true);
    assert.equal(interviewCandidate(company, 'bia').ok, true);
    assert.equal(hireEmployee(company, 'bia').ok, true);
  }
  assert.ok(improved.interviews.bia.score > baseline.interviews.bia.score);
  const bia = (company) => company.employees.find((item) => item.id === 'bia');
  assert.ok(bia(improved).productivity > bia(baseline).productivity);
});

test('a dedicated commercial room can close a contract that the shared office loses without permitting retries', () => {
  const baseline = matureCompany();
  const improved = structuredClone(baseline);
  assert.equal(upgradeRoom(improved, 'sales', 'partition').ok, true);
  assert.equal(upgradeRoom(improved, 'sales', 'dedicated').ok, true);
  // This contact has a deterministic 87/100 negotiation roll; the room's
  // promised eight percentage points cross the otherwise losing threshold.
  for (const company of [baseline, improved]) {
    company.reputation = 12;
    company.leads[0].id = 'aZ';
  }
  const cash = baseline.cash;
  assert.equal(negotiateProject(baseline, 'aZ', 'standard').ok, false);
  assert.equal(baseline.cash, cash);
  assert.equal(baseline.projects.length, 8);
  assert.equal(baseline.leads[0].negotiation.closed, false);
  unchanged(baseline, () => negotiateProject(baseline, 'aZ', 'discount'));
  const successfulCash = improved.cash;
  assert.equal(negotiateProject(improved, 'aZ', 'standard').ok, true);
  assert.equal(improved.cash, successfulCash, 'A signed contract still is not immediate revenue');
  assert.equal(improved.projects.length, 9);
});

test('financial room upgrades shorten actual premium collection delays without changing the invoice value', () => {
  const open = matureCompany();
  const dedicated = structuredClone(open);
  const glass = structuredClone(open);
  glass.office.stage = 'floor';
  for (const company of [dedicated, glass]) {
    assert.equal(upgradeRoom(company, 'finance', 'partition').ok, true);
    assert.equal(upgradeRoom(company, 'finance', 'dedicated').ok, true);
  }
  assert.equal(upgradeRoom(glass, 'finance', 'glass').ok, true);
  for (const company of [open, dedicated, glass]) {
    const accepted = negotiateProject(company, company.leads[0].id, 'premium');
    assert.equal(accepted.ok, true);
    const project = accepted.project;
    project.progress = project.hours - 0.1;
    project.eventTriggered = true;
    project.quality = 80;
    assert.equal(performAction(company, 'work').ok, true);
    assert.equal(project.status, 'delivered');
  }
  const invoice = (company) => company.receivables[0];
  assert.deepEqual([open, dedicated, glass].map((company) => invoice(company).paymentDay - invoice(company).dueDay), [2, 1, 0]);
  assert.equal(invoice(open).amount, invoice(dedicated).amount);
  assert.equal(invoice(open).amount, invoice(glass).amount);
  for (const company of [open, dedicated, glass]) {
    while (company.day < invoice(company).dueDay) advanceDay(company);
  }
  assert.equal(advanceDay(open).summary.revenue, 0);
  assert.equal(advanceDay(dedicated).summary.revenue, 0);
  assert.ok(advanceDay(glass).summary.revenue > 0);
});

test('development partitions trade review synergy for less noise, while glass recovers part of that synergy', () => {
  const open = matureCompany({ team: 2, stage: 'floor' });
  longProject(open).quality = 35;
  const partition = structuredClone(open);
  const dedicated = structuredClone(open);
  const glass = structuredClone(open);
  for (const company of [partition, dedicated, glass]) assert.equal(upgradeRoom(company, 'development', 'partition').ok, true);
  for (const company of [dedicated, glass]) assert.equal(upgradeRoom(company, 'development', 'dedicated').ok, true);
  assert.equal(upgradeRoom(glass, 'development', 'glass').ok, true);
  const reviewGain = [];
  const developmentGain = [];
  for (const company of [open, partition, dedicated, glass]) {
    const review = structuredClone(company);
    assert.equal(setAllocation(review, 'quality', 1).ok, true);
    const quality = review.projects.at(-1).quality;
    assert.equal(performAction(review, 'review').ok, true);
    reviewGain.push(review.projects.at(-1).quality - quality);
    const production = structuredClone(company);
    assert.equal(performAction(production, 'work').ok, true);
    developmentGain.push(production.projects.at(-1).quality - quality);
    assert.equal(setAllocation(company, 'quality', 0).ok, true);
    assert.equal(setAllocation(company, 'sales', 4).ok, true);
    for (const person of company.employees) assert.equal(assignEmployee(company, person.id, 'auto', 'quality').ok, true);
  }
  assert.ok(reviewGain[0] > reviewGain[1]);
  assert.ok(reviewGain[1] > reviewGain[2]);
  assert.ok(reviewGain[3] > reviewGain[2], 'Glass restores some of the collaboration lost with solid walls');
  assert.ok(reviewGain[0] > reviewGain[3], 'Glass still has a collaboration tradeoff');
  assert.ok(developmentGain[2] > developmentGain[0], 'Dedicated development improves quality during implementation');
  const summaries = [open, partition, dedicated, glass].map((company) => advanceDay(company).summary);
  assert.equal(summaries[1].noiseLostHours, Math.round(summaries[0].noiseLostHours * 50) / 100);
  assert.equal(summaries[2].noiseLostHours, 0);
  assert.equal(summaries[3].noiseLostHours, 0);
  assert.ok(partition.projects.at(-1).progress > open.projects.at(-1).progress);
  assert.ok(dedicated.projects.at(-1).progress > partition.projects.at(-1).progress);
  assert.ok(open.employees[0].stress > dedicated.employees[0].stress);
  assert.ok(summaries[2].costs > summaries[0].costs, 'The quieter room also has recurring rent');
});

test('a dedicated development room prevents an actual deterministic bug that arises in an open office', () => {
  const open = matureCompany({ team: 2 });
  const project = longProject(open);
  // This contract deterministically schedules a bug with risk roll 60/100.
  project.id = 'bug-b';
  project.progress = project.hours * 0.3;
  project.phase = 'development';
  project.eventTriggered = false;
  const dedicated = structuredClone(open);
  assert.equal(upgradeRoom(dedicated, 'development', 'partition').ok, true);
  assert.equal(upgradeRoom(dedicated, 'development', 'dedicated').ok, true);
  for (const company of [open, dedicated]) {
    assert.equal(setAllocation(company, 'sales', 8).ok, true);
    for (const person of company.employees) assert.equal(assignEmployee(company, person.id, 'auto', 'quality').ok, true);
    advanceDay(company);
  }
  assert.equal(open.pendingEvents.length, 1);
  assert.equal(open.pendingEvents[0].type, 'bug');
  assert.equal(dedicated.pendingEvents.length, 0);
  assert.equal(dedicated.projects.at(-1).eventTriggered, true);
  assert.ok(dedicated.log.some((entry) => /evitou um bug/.test(entry.message)));
});

test('meeting actions spend the same quality and sales hours as normal company work', () => {
  const state = matureCompany({ team: 2 });
  unchanged(state, () => performRoomAction(state, 'alignment'));
  assert.equal(purchaseOfficeItem(state, 'meeting').ok, true);
  const project = longProject(state);
  project.blockedUntil = state.day + 1;
  state.debt = 20;
  assert.equal(setAllocation(state, 'quality', 2).ok, true);
  const morale = state.employees[0].morale;
  const stress = state.employees[0].stress;
  assert.equal(performRoomAction(state, 'alignment').ok, true);
  assert.equal(state.debt, 17);
  assert.equal(project.blockedUntil, state.day);
  assert.equal(state.manualQualityHours, 1);
  unchanged(state, () => performRoomAction(state, 'alignment'));
  assert.equal(performRoomAction(state, 'onboarding').ok, true);
  assert.equal(state.manualQualityHours, 2);
  assert.equal(state.employees[0].morale, morale + 10);
  assert.equal(state.employees[0].stress, Math.max(0, stress - 10));
  unchanged(state, () => performAction(state, 'review'));
  const cash = state.cash;
  assert.equal(performRoomAction(state, 'presentation').ok, true);
  assert.equal(state.cash, cash - 80);
  assert.equal(state.manualSalesHours, 1);
  assert.equal(state.actionHours, 3);
  unchanged(state, () => performRoomAction(state, 'presentation'));
  unchanged(state, () => setAllocation(state, 'quality', 0));
  assert.equal(Object.values(state.allocation).reduce((sum, value) => sum + value, 0), 8);
  assert.equal(performAction(state, 'work').ok, true, 'Alignment unblocked delivery, but does not add free hours');
});

test('meeting presentations improve actual negotiation while onboarding expires after its advertised period', () => {
  const baseline = matureCompany({ team: 2 });
  assert.equal(purchaseOfficeItem(baseline, 'meeting').ok, true);
  const presentation = structuredClone(baseline);
  for (const company of [baseline, presentation]) {
    company.reputation = 12;
    company.leads[0].id = 'aZ';
  }
  assert.equal(performRoomAction(presentation, 'presentation').ok, true);
  assert.equal(negotiateProject(baseline, 'aZ').ok, false);
  assert.equal(negotiateProject(presentation, 'aZ').ok, true);
  const newcomer = matureCompany({ team: 2 });
  assert.equal(purchaseOfficeItem(newcomer, 'meeting').ok, true);
  assert.equal(performRoomAction(newcomer, 'onboarding').ok, true);
  assert.equal(newcomer.office.bonuses.onboardingUntil, newcomer.day + 2);
  newcomer.day = newcomer.employees[0].hiredDay + 8;
  unchanged(newcomer, () => performRoomAction(newcomer, 'onboarding'));
});

test('onboarding on the last eligible hiring day improves all three promised days of employee work', () => {
  const boosted = matureCompany({ team: 2 });
  assert.equal(purchaseOfficeItem(boosted, 'meeting').ok, true);
  longProject(boosted);
  boosted.day = boosted.employees[0].hiredDay + 7;
  assert.equal(setAllocation(boosted, 'quality', 1).ok, true);
  assert.equal(setAllocation(boosted, 'sales', 7).ok, true);
  const baseline = structuredClone(boosted);
  assert.equal(performRoomAction(boosted, 'onboarding').ok, true);
  baseline.manualQualityHours = boosted.manualQualityHours;
  baseline.actionHours = boosted.actionHours;
  for (let day = 0; day < 4; day += 1) {
    for (const company of [baseline, boosted]) {
      company.debt = 0;
      company.energy = 100;
      for (const person of company.employees) {
        person.morale = 70;
        person.stress = 20;
      }
    }
    const oldBaseline = baseline.projects.at(-1).progress;
    const oldBoosted = boosted.projects.at(-1).progress;
    advanceDay(baseline);
    advanceDay(boosted);
    const ordinaryOutput = baseline.projects.at(-1).progress - oldBaseline;
    const boostedOutput = boosted.projects.at(-1).progress - oldBoosted;
    if (day < 3) assert.ok(boostedOutput > ordinaryOutput * 1.15, `Onboarding benefit was lost on promised day ${day + 1}`);
    else assert.ok(Math.abs(boostedOutput - ordinaryOutput) <= 0.02, 'The temporary production bonus must end after three days');
  }
});

test('an active company in negative cash can use free room actions, while paid presentations still need cash', () => {
  const state = matureCompany({ team: 3, stage: 'floor' });
  assert.equal(purchaseOfficeItem(state, 'meeting').ok, true);
  assert.equal(purchaseOfficeItem(state, 'ceo').ok, true);
  assert.equal(setAllocation(state, 'quality', 2).ok, true);
  state.cash = -100;
  assert.equal(performRoomAction(state, 'alignment').ok, true);
  assert.equal(performRoomAction(state, 'onboarding').ok, true);
  assert.equal(performRoomAction(state, 'focus').ok, true);
  assert.equal(state.cash, -100);
  unchanged(state, () => performRoomAction(state, 'presentation'));
});

test('a bankrupt company cannot buy, expand, rebuild rooms, customize signs, or use room actions', () => {
  const state = matureCompany({ team: 3, stage: 'floor' });
  assert.equal(purchaseOfficeItem(state, 'meeting').ok, true);
  assert.equal(purchaseOfficeItem(state, 'ceo').ok, true);
  assert.equal(purchaseOfficeItem(state, 'banner').ok, true);
  state.status = 'bankrupt';
  state.bankrupt = true;
  for (const action of [
    () => purchaseOfficeItem(state, 'desk'),
    () => purchaseOfficeItem(state, 'decor'),
    () => expandOffice(state),
    () => upgradeRoom(state, 'sales'),
    () => upgradeComputer(state, 'post-1'),
    () => customizeBanner(state, 'Um novo nome', '#123abc'),
    ...['alignment', 'presentation', 'onboarding', 'focus', 'team-time'].map((id) => () => performRoomAction(state, id)),
  ]) unchanged(state, action);
});

test('the CEO room unlocks late, improves a founder work block, and repeated isolation lowers team morale', () => {
  const early = matureCompany({ team: 2 });
  unchanged(early, () => purchaseOfficeItem(early, 'ceo'));
  const baseline = matureCompany({ team: 3, stage: 'floor' });
  assert.equal(purchaseOfficeItem(baseline, 'ceo').ok, true);
  const isolated = structuredClone(baseline);
  const social = structuredClone(baseline);
  for (const company of [isolated, social]) {
    longProject(company);
    company.energy = 50;
  }
  assert.equal(performRoomAction(isolated, 'focus').ok, true);
  assert.equal(isolated.energy, 50 + 14 - 2.5, 'The focus recovery also pays the ordinary energy cost of one delivery hour');
  assert.equal(isolated.manualDeliveryHours, 1);
  unchanged(isolated, () => performRoomAction(isolated, 'focus'));
  assert.equal(performAction(isolated, 'work').ok, true);
  assert.equal(performAction(social, 'work').ok, true);
  assert.ok(isolated.projects.at(-1).progress > social.projects.at(-1).progress);
  const withdrawn = structuredClone(baseline);
  const connected = structuredClone(baseline);
  for (let day = 0; day < 3; day += 1) {
    assert.equal(performRoomAction(withdrawn, 'focus').ok, true);
    assert.equal(performRoomAction(connected, 'focus').ok, true);
    assert.equal(performRoomAction(connected, 'team-time').ok, true);
    advanceDay(withdrawn);
    advanceDay(connected);
  }
  assert.equal(withdrawn.office.ceoIsolation, 3);
  assert.equal(connected.office.ceoIsolation, 0);
  assert.ok(withdrawn.employees[0].morale < connected.employees[0].morale);
});

test('lounge, floor, and decorations improve daily morale and stress rather than only changing appearance', () => {
  const baseline = matureCompany({ team: 1 });
  const improved = structuredClone(baseline);
  for (const id of ['lounge', 'floor', 'decor']) assert.equal(purchaseOfficeItem(improved, id).ok, true);
  const project = longProject(baseline);
  improved.projects.push(structuredClone(project));
  for (const company of [baseline, improved]) {
    company.employees[0].morale = 50;
    company.employees[0].stress = 40;
    assert.equal(assignEmployee(company, 'lucas', project.id).ok, true);
  }
  advanceDay(baseline);
  advanceDay(improved);
  assert.ok(improved.employees[0].morale > baseline.employees[0].morale);
  assert.ok(improved.employees[0].stress < baseline.employees[0].stress);
  assert.ok(improved.energy > baseline.energy);
  unchanged(improved, () => purchaseOfficeItem(improved, 'lounge'));
  unchanged(improved, () => purchaseOfficeItem(improved, 'floor'));
  unchanged(improved, () => purchaseOfficeItem(improved, 'decor'));
});

test('a personalized banner slowly produces real reputation and contacts, with invalid edits leaving it intact', () => {
  const baseline = matureCompany();
  const banner = structuredClone(baseline);
  unchanged(banner, () => customizeBanner(banner, 'Minha empresa', '#123abc'));
  assert.equal(purchaseOfficeItem(banner, 'banner').ok, true);
  assert.equal(customizeBanner(banner, '  Empresa Azul  ', '#123abc').ok, true);
  assert.deepEqual(banner.office.banner, { text: 'Empresa Azul', color: '#123abc' });
  unchanged(banner, () => customizeBanner(banner, '', '#123abc'));
  unchanged(banner, () => customizeBanner(banner, 'x'.repeat(41), '#123abc'));
  unchanged(banner, () => customizeBanner(banner, 'Nome válido', 'red'));
  for (const company of [baseline, banner]) {
    assert.equal(setAllocation(company, 'sales', 0).ok, true);
    company.leads = [];
  }
  for (let guard = 0; guard < 44; guard += 1) {
    advanceDay(baseline);
    advanceDay(banner);
  }
  assert.ok(banner.reputation > baseline.reputation);
  assert.ok(banner.leads.length > baseline.leads.length, 'The banner brings a new actual contact even without allocated sales hours');
});

test('v3 office saves restore purchases, assignments, per-sector rooms, banner, and maintenance without loss', () => {
  storage();
  const state = matureCompany({ team: 2, stage: 'floor' });
  assert.equal(upgradeRoom(state, 'development', 'partition').ok, true);
  assert.equal(upgradeRoom(state, 'development', 'dedicated').ok, true);
  assert.equal(upgradeRoom(state, 'development', 'glass').ok, true);
  assert.equal(upgradeComputer(state, 'post-1', 2).ok, true);
  assert.equal(purchaseOfficeItem(state, 'banner').ok, true);
  assert.equal(customizeBanner(state, 'Empresa da Ana', '#123abc').ok, true);
  state.paused = false;
  assert.equal(saveGame(state).ok, true);
  assert.deepEqual(loadGame(), { ...state, paused: true });
});

test('invalid office saves cannot overwrite the previous valid company', () => {
  const values = storage();
  const valid = matureCompany({ team: 1 });
  assert.equal(saveGame(valid).ok, true);
  const previous = values.get('joguinho-save-v1');
  const corruptions = [
    (state) => { state.office = null; },
    (state) => { state.office.stage = 'penthouse'; },
    (state) => { state.office.rooms.development = 'basement'; },
    (state) => { state.office.workstations[0].computerLevel = 4; },
    (state) => { state.office.workstations[1].id = state.office.workstations[0].id; },
    (state) => { state.office.workstations[1].employeeId = 'founder'; },
    (state) => { state.office.workstations[1].employeeId = null; },
    (state) => { state.office.workstations[1].employeeId = 'unknown'; },
    (state) => { state.office.nextMaintenanceDay = -1; },
    (state) => { state.office.banner.color = 'broken-color'; },
    (state) => { state.office.actions.focus = 4; },
  ];
  for (const corrupt of corruptions) {
    const state = structuredClone(valid);
    corrupt(state);
    assert.equal(saveGame(state).ok, false);
    assert.equal(values.get('joguinho-save-v1'), previous);
    values.set('joguinho-save-v1', JSON.stringify({ version: 3, state }));
    assert.equal(loadGame(), null);
    values.set('joguinho-save-v1', previous);
  }
  assert.equal(loadGame().employees[0].id, 'lucas');
});

for (const version of [1, 2]) {
  test(`published v${version} companies preserve their progress and all existing posts in an open office`, () => {
    const values = storage();
    const legacy = structuredClone(publishedV2Company);
    legacy.version = version;
    if (version === 1) {
      for (const key of ['interviews', 'pendingEvents', 'officePosition', 'travelHours', 'focusProjectId', 'product', 'loan']) delete legacy[key];
      for (const key of ['workHours', 'product']) delete legacy.dailyActions[key];
      for (const project of legacy.projects) {
        for (const key of ['phase', 'paymentDays', 'eventTriggered', 'blockedUntil']) delete project[key];
      }
      for (const person of legacy.employees) {
        for (const key of ['assignment', 'assignmentRole', 'morale', 'stress']) delete person[key];
      }
      for (const invoice of legacy.receivables) {
        for (const key of ['paymentDay', 'followupCount']) delete invoice[key];
      }
      for (const lead of legacy.leads) {
        for (const key of ['discovered', 'estimateMin', 'estimateMax', 'qualification']) delete lead[key];
      }
    }
    values.set('joguinho-save-v1', JSON.stringify({ version, state: legacy }));
    const restored = loadGame();
    assert.ok(restored);
    assert.equal(restored.version, 3);
    assert.equal(restored.paused, true);
    for (const key of ['profile', 'day', 'cash', 'reputation', 'energy', 'debt', 'allocation', 'stats', 'ledger', 'history', 'furniture']) {
      assert.deepEqual(restored[key], legacy[key], `Migration must preserve ${key}`);
    }
    assert.equal(restored.projects.length, legacy.projects.length);
    for (let index = 0; index < legacy.projects.length; index += 1) {
      for (const key of ['id', 'client', 'price', 'progress', 'status', 'paid', 'deadline', 'completedDay', 'invoiceAmount', 'dueDay']) {
        assert.equal(restored.projects[index][key], legacy.projects[index][key]);
      }
    }
    assert.equal(restored.receivables[0].amount, legacy.receivables[0].amount);
    assert.equal(restored.receivables[0].dueDay, legacy.receivables[0].dueDay);
    assert.equal(restored.office.stage, 'commercial');
    assert.equal(restored.office.workstations.length, 5, 'The original four staff posts plus the founder remain available');
    assert.equal(getOfficeOverview(restored).capacity, 4);
    assert.equal(getOfficeOverview(restored).freePosts, 1);
    assert.deepEqual(restored.office.rooms, { development: 'open', sales: 'open', hr: 'open', finance: 'open' });
    assert.ok(restored.office.workstations.every((post) => post.desk && post.chair && post.computerLevel === 2));
    assert.equal(restored.office.nextMaintenanceDay, legacy.day + 28, 'An old company is not billed retroactively');
    if (version === 2) {
      for (const key of ['officePosition', 'travelHours', 'interviews', 'loan', 'product', 'pendingEvents']) assert.deepEqual(restored[key], legacy[key]);
      assert.equal(restored.employees.find((person) => person.id === 'marina').assignmentRole, 'quality');
    }
    assert.equal(saveGame(restored).ok, true);
    assert.deepEqual(loadGame(), restored);
    assert.equal(advanceDay(restored).ok, true);
  });
}

// Captured with the published v2 engine before office progression existed.
const publishedV2Company = {"version":2,"profile":{"name":"Ana","company":"Legado real","age":34,"avatarColor":"#de936f","trait":"technical"},"day":3,"cash":15584,"reputation":14,"energy":88,"debt":1.65,"allocation":{"sales":2,"delivery":3,"quality":3},"projects":[{"id":"cafe-site-1","title":"Um site com aroma de café","client":"Café Aurora","sector":"Comércio","price":4800,"hours":22,"duration":8,"description":"Site institucional, cardápio e formulário de contato para uma cafeteria do bairro.","receivedDay":1,"expiresDay":19,"discovered":false,"estimateMin":16,"estimateMax":30,"qualification":null,"progress":22,"deadline":9,"mode":"standard","quality":73.38,"paid":false,"status":"delivered","startedDay":1,"pricing":"standard","paymentDays":3,"phase":"delivered","eventTriggered":true,"blockedUntil":0,"completedDay":2,"invoiceAmount":4800,"dueDay":5},{"id":"clinica-agenda-2","title":"Agenda sem papel","client":"Clínica Viver","sector":"Saúde","price":8200,"hours":38,"duration":14,"description":"Um sistema simples para organizar consultas, pacientes e horários disponíveis.","receivedDay":1,"expiresDay":19,"discovered":false,"estimateMin":28,"estimateMax":52,"qualification":null,"progress":19.57,"deadline":15,"mode":"standard","quality":73.29,"paid":false,"status":"active","startedDay":1,"pricing":"standard","paymentDays":3,"phase":"development","eventTriggered":true,"blockedUntil":0}],"leads":[{"id":"loja-vitrine-3","title":"A loja entra na internet","client":"Estúdio Ponto","sector":"Varejo","price":6500,"hours":30,"duration":11,"description":"Catálogo digital de produtos com painel de edição e pedidos por mensagem.","receivedDay":1,"expiresDay":19,"discovered":false,"estimateMin":22,"estimateMax":41,"qualification":null}],"employees":[{"id":"lucas","name":"Lucas","role":"Dev frontend","salary":2800,"productivity":6,"trait":"Transforma café em interfaces","color":"#8c79d9","contract":"CLT","hiredDay":1,"assignment":"auto","assignmentRole":"delivery","morale":73.89,"stress":21},{"id":"marina","name":"Marina","role":"Designer de produto","salary":2400,"productivity":4.5,"trait":"Enxerga os detalhes que faltam","color":"#db8c6b","contract":"CLT","hiredDay":1,"assignment":"clinica-agenda-2","assignmentRole":"quality","morale":73.89,"stress":21},{"id":"bia","name":"Bia","role":"Dev fullstack","salary":3600,"productivity":7,"trait":"Resolve um pouco de tudo","color":"#66a894","contract":"CLT","hiredDay":1,"assignment":"auto","assignmentRole":"delivery","morale":73.89,"stress":21}],"furniture":[{"id":"desk","name":"Mesa compartilhada","price":1500,"description":"Mais duas vagas para trazer gente nova para o time.","purchasedDay":1},{"id":"monitors","name":"Monitor extra","price":1800,"description":"Aumenta em 10% a produtividade de todo o escritório.","purchasedDay":1},{"id":"coffee-machine","name":"Cafeteira","price":900,"description":"Cada café recupera 22 de energia em vez de 14.","purchasedDay":1}],"receivables":[{"projectId":"cafe-site-1","client":"Café Aurora","amount":4800,"dueDay":5,"paymentDay":5,"followupCount":0}],"ledger":[{"day":2,"label":"Salários e contratos","amount":-748},{"day":2,"label":"Aluguel, internet e custos fixos","amount":-110},{"day":1,"label":"Salários e contratos","amount":-748},{"day":1,"label":"Aluguel, internet e custos fixos","amount":-110},{"day":1,"label":"Amortização do empréstimo","amount":-500},{"day":1,"label":"Empréstimo inicial","amount":2000},{"day":1,"label":"Cafeteira","amount":-900},{"day":1,"label":"Monitor extra","amount":-1800},{"day":1,"label":"Mesa compartilhada","amount":-1500},{"day":1,"label":"Capital inicial","amount":20000}],"log":[{"day":3,"message":"Marina foi alocado em qualidade de Agenda sem papel."},{"day":2,"message":"Um site com aroma de café entregue com qualidade 73%. R$ 4800 previstos para o dia 5."},{"day":1,"message":"Crédito de R$ 2.000 liberado. O saldo da dívida cresce 2% a cada 28 dias até a quitação."},{"day":1,"message":"Cafeteira chegou ao escritório."},{"day":1,"message":"Monitor extra chegou ao escritório."},{"day":1,"message":"Contrato padrão fechado com Clínica Viver: R$ 8200, 14 dias de prazo e pagamento 3 dias após a entrega."},{"day":1,"message":"Contrato padrão fechado com Café Aurora: R$ 4800, 8 dias de prazo e pagamento 3 dias após a entrega."},{"day":1,"message":"Bia entrou para o time com contrato CLT. Custo por dia útil: R$ 306.00."},{"day":1,"message":"Mesa compartilhada chegou ao escritório."},{"day":1,"message":"Entrevista com Bia concluída. A contratação está disponível no RH."},{"day":1,"message":"Marina entrou para o time com contrato CLT. Custo por dia útil: R$ 204.00."},{"day":1,"message":"Entrevista com Marina concluída. A contratação está disponível no RH."},{"day":1,"message":"Lucas entrou para o time com contrato CLT. Custo por dia útil: R$ 238.00."},{"day":1,"message":"Entrevista com Lucas concluída. A contratação está disponível no RH."},{"day":1,"message":"As portas estão abertas. Seu primeiro cliente está a uma conversa de distância."}],"history":[{"day":1,"cash":20000,"revenue":0,"debt":0,"reputation":12},{"day":1,"cash":16442,"revenue":0,"debt":1.67,"reputation":12},{"day":2,"cash":15584,"revenue":0,"debt":1.65,"reputation":14}],"stats":{"revenue":0,"delivered":1,"hoursWorked":37.01},"speed":1,"paused":false,"status":"active","bankrupt":false,"consecutiveNegativeDays":0,"nextLeadId":4,"salesProgress":4,"actionHours":0,"manualDeliveryHours":0,"manualQualityHours":0,"manualSalesHours":0,"dailyActions":{"coffee":0,"rest":0,"work":0,"workHours":0,"review":0,"prospect":0,"product":0},"interviews":{"lucas":{"day":1,"candidateId":"lucas","score":83,"strength":"Transforma café em interfaces","risk":"Precisará de revisões para crescer com segurança."},"marina":{"day":1,"candidateId":"marina","score":79,"strength":"Enxerga os detalhes que faltam","risk":"Entrega menos horas de código, mas ajuda a validar a experiência."},"bia":{"day":1,"candidateId":"bia","score":86,"strength":"Resolve um pouco de tudo","risk":"Um salário maior exige um pipeline constante."}},"pendingEvents":[],"officePosition":{"x":400,"y":310},"travelHours":0,"focusProjectId":null,"product":{"unlocked":false,"stage":"locked","progress":0,"research":0,"mrr":0,"users":0,"nextPaymentDay":0},"loan":{"balance":1500,"interest":0.02,"nextInterestDay":29,"taken":true}};
