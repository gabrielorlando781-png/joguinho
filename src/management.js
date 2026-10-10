export const MANAGER_PROFILES = [
  { area: 'sales', name: 'Clara', role: 'Gerente comercial', salary: 4200, color: '#c47e63', station: 'sales' },
  { area: 'development', name: 'Ravi', role: 'Gerente de desenvolvimento', salary: 5200, color: '#7294b8', station: 'board' },
  { area: 'finance', name: 'Lívia', role: 'Gerente financeiro', salary: 4700, color: '#b6a668', station: 'finance' },
  { area: 'hr', name: 'Nina', role: 'Gerente de pessoas', salary: 3900, color: '#a987b6', station: 'team' },
];

export const managerProfile = (area) => MANAGER_PROFILES.find((person) => person.area === area);
export const managerId = (area) => `manager:${area}`;
export const createManagement = () => ({ managers: [], requests: [], nextRequestId: 1, snoozed: {}, meeting: null, lastMeetingDay: 0 });
export const managerQueue = (state) => state.management?.requests || [];
export const activeManager = (state, area) => state.management?.managers.find((person) => person.area === area);

export function validManagement(management) {
  if (management === undefined) return true; // Saves written before managers existed.
  if (!management || !Array.isArray(management.managers) || !Array.isArray(management.requests) || !Number.isInteger(management.nextRequestId) || management.nextRequestId < 1) return false;
  const areas = MANAGER_PROFILES.map((person) => person.area);
  if (management.managers.length > areas.length || new Set(management.managers.map((person) => person.area)).size !== management.managers.length) return false;
  if (management.snoozed !== undefined && (management.snoozed === null || Array.isArray(management.snoozed) || typeof management.snoozed !== 'object' || !Object.entries(management.snoozed).every(([area, entry]) => areas.includes(area) && entry && typeof entry.kind === 'string' && typeof entry.ref === 'string' && Number.isInteger(entry.untilDay) && entry.untilDay > 0))) return false;
  if (management.lastMeetingDay !== undefined && (!Number.isInteger(management.lastMeetingDay) || management.lastMeetingDay < 0)) return false;
  if (management.meeting !== undefined && management.meeting !== null && (!Number.isInteger(management.meeting.day) || management.meeting.day < 1 || !['delivery', 'people', 'strategy'].includes(management.meeting.agenda) || !Array.isArray(management.meeting.attendees) || management.meeting.attendees.length < 1 || management.meeting.attendees.length > 21 || new Set(management.meeting.attendees).size !== management.meeting.attendees.length || !management.meeting.attendees.every((id) => typeof id === 'string' && id.length <= 80))) return false;
  if (!management.managers.every((person) => person && areas.includes(person.area) && person.id === managerId(person.area) && person.name === managerProfile(person.area).name && person.role === managerProfile(person.area).role && person.salary === managerProfile(person.area).salary && person.color === managerProfile(person.area).color && ['PJ', 'CLT'].includes(person.contract) && Number.isInteger(person.hiredDay) && person.hiredDay > 0)) return false;
  if (management.requests.length > 12 || new Set(management.requests.map((request) => request.id)).size !== management.requests.length) return false;
  return management.requests.every((request) => request && Number.isInteger(request.id) && request.id > 0 && request.id < management.nextRequestId && areas.includes(request.area) && management.managers.some((person) => person.area === request.area) && ['sales-contract', 'delivery-mode', 'project-event', 'finance-credit', 'finance-collect', 'hr-hire', 'consult'].includes(request.kind) && typeof request.title === 'string' && request.title.length <= 160 && typeof request.detail === 'string' && request.detail.length <= 500 && typeof request.ref === 'string' && request.ref.length <= 120 && typeof request.day === 'number' && Number.isInteger(request.day) && request.day > 0);
}
