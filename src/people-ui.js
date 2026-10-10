import { avatar, escape } from './ui.js';

const TOPICS = [
  ['wellbeing', 'Como você está?'],
  ['project', 'Como está o projeto?'],
  ['company', 'O que acha da empresa?'],
  ['growth', 'E sua carreira?'],
  ['help', 'O que ajudaria agora?'],
];

export const topicQuestion = (topic) => TOPICS.find(([id]) => id === topic)?.[1] || 'Quero te ouvir.';

export function renderPersonConversation(state, person, conversation) {
  const lines = conversation?.lines?.slice(-8) || [];
  const manager = Boolean(person.area);
  return `<div class="station-frame pixel-dialogue-frame"><header class="pixel-dialogue-title"><span>CONVERSA · ${escape(state.profile.company)}</span><button data-action="close-station" aria-label="Encerrar conversa">×</button></header><div class="pixel-dialogue-character">${avatar(person.color, 64, person.name)}<div><strong>${escape(person.name)}</strong><small>${escape(person.role)}</small></div></div><div class="pixel-dialogue-log" role="log" aria-label="Conversa com ${escape(person.name)}">${lines.map((line) => `<div class="pixel-speech ${line.from === 'founder' ? 'founder' : 'colleague'}"><span>${escape(line.from === 'founder' ? state.profile.name : person.name)}</span><p>${escape(line.text)}</p></div>`).join('')}</div><div class="pixel-dialogue-prompts"><span>PERGUNTAR</span><div>${TOPICS.map(([topic, label]) => `<button data-dialogue-topic="${topic}">${escape(label)}</button>`).join('')}${manager ? '<button data-dialogue-topic="report">Como está sua área?</button>' : `<button data-dialogue-recognize="${escape(person.id)}" ${person.career?.lastSupportDay === state.day ? 'disabled' : ''}>Ouvir e reconhecer o trabalho</button>`}</div></div><div class="pixel-dialogue-footer"><span>▲ escolha uma resposta para continuar</span><button data-action="close-station">Encerrar conversa</button></div></div>`;
}
