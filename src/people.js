export const CAREER_LEVELS = [
  { id: 'junior', label: 'Júnior', xp: 0, days: 0, score: 0 },
  { id: 'mid', label: 'Pleno', xp: 14, days: 3, score: 55 },
  { id: 'senior', label: 'Sênior', xp: 42, days: 10, score: 65 },
  { id: 'lead', label: 'Liderança', xp: 90, days: 20, score: 75 },
];

export const createCareer = () => ({ level: 'junior', xp: 0, recentOutput: 0, lastActiveDay: 0, lastPromotionDay: 0, lastSupportDay: 0 });

export function ensureCareers(state) {
  for (const person of state.employees || []) {
    person.baseRole ||= person.role;
    person.career ||= createCareer();
  }
}

export function validCareer(person) {
  if (person.career === undefined && person.baseRole === undefined) return true;
  const career = person.career;
  return typeof person.baseRole === 'string' && person.baseRole.length > 0 && person.baseRole.length <= 70
    && career && CAREER_LEVELS.some((level) => level.id === career.level)
    && Number.isFinite(career.xp) && career.xp >= 0 && career.xp <= 1000000
    && Number.isFinite(career.recentOutput) && career.recentOutput >= 0 && career.recentOutput <= 24
    && ['lastActiveDay', 'lastPromotionDay', 'lastSupportDay'].every((key) => Number.isInteger(career[key]) && career[key] >= 0);
}

export function employeeEvaluation(state, person) {
  const career = person.career || createCareer();
  const activeRecently = career.lastActiveDay >= state.day - 5;
  const output = activeRecently ? career.recentOutput : 0;
  const score = Math.max(0, Math.min(100, Math.round(30 + Math.min(35, output / Math.max(1, person.productivity) * 35) + person.morale * .2 - person.stress * .18 + Math.min(10, Math.max(0, state.day - person.hiredDay) / 3))));
  const index = CAREER_LEVELS.findIndex((level) => level.id === career.level);
  const next = CAREER_LEVELS[index + 1] || null;
  const days = Math.max(0, state.day - (career.lastPromotionDay || person.hiredDay));
  const reasons = [];
  if (next) {
    if (career.xp < next.xp) reasons.push(`${Math.ceil(next.xp - career.xp)} pontos de experiência`);
    if (days < next.days) reasons.push(`${next.days - days} dias de exercício`);
    if (score < next.score) reasons.push(`avaliação ${next.score}/100`);
    if (person.morale < 45) reasons.push('moral mínima de 45');
    if (person.stress > 75) reasons.push('estresse abaixo de 76');
  }
  return { score, level: CAREER_LEVELS[index] || CAREER_LEVELS[0], next, days, xp: career.xp, ready: !!next && reasons.length === 0, reasons };
}

export function personDialogue(state, person, topic) {
  const manager = Boolean(person.area);
  const project = state.projects.find((entry) => entry.id === person.assignment && entry.status === 'active')
    || state.projects.filter((entry) => entry.status === 'active').sort((a, b) => a.deadline - b.deadline)[0];
  const evaluation = manager ? null : employeeEvaluation(state, person);
  const name = person.name.split(' ')[0];
  if (topic === 'greeting') return `Oi, ${state.profile.name}. Pode falar comigo. O que você gostaria de saber?`;
  if (topic === 'wellbeing') {
    if (manager) {
      if (person.area === 'sales') return `O comercial tem ${state.leads.length} contatos na fila. Estou bem, mas preciso saber quantos projetos a equipe consegue assumir antes de prometer novos prazos.`;
      if (person.area === 'finance') return `O caixa está em R$ ${Math.round(state.cash).toLocaleString('pt-BR')}. Estou acompanhando folha e recebíveis; crescer agora precisa caber no próximo mês.`;
      if (person.area === 'hr') return `Temos ${state.employees.length} pessoas na equipe. ${state.employees.some((member) => member.stress > 65) ? 'Algumas estão sobrecarregadas; eu reduziria a pressão.' : 'O clima está estável, mas vale ouvir cada pessoa antes de acelerar.'}`;
      return `As entregas estão ${state.projects.some((item) => item.status === 'active' && item.deadline - state.day < 3) ? 'apertadas no prazo' : 'andando'}. A dívida técnica está em ${Math.round(state.debt)}; quero equilibrar velocidade com revisão.`;
    }
    if (person.stress >= 65) return `Estou cansado, para ser sincero. O projeto ${project?.title || 'da vez'} tem consumido minha atenção e meu estresse está em ${Math.round(person.stress)}%. Uma pausa ou um ritmo melhor ajudaria.`;
    if (person.morale < 45) return `Tenho feito meu trabalho, mas não estou muito animado. Minha moral está em ${Math.round(person.morale)}%. Gostaria de entender meu espaço aqui e para onde posso crescer.`;
    return `Estou bem. Tenho conseguido trabalhar com calma e contribuir. Minha moral está em ${Math.round(person.morale)}% e o estresse em ${Math.round(person.stress)}%.`;
  }
  if (topic === 'project') {
    if (!project) return manager ? 'Ainda não temos um contrato em andamento. Minha equipe está preparando a próxima oportunidade.' : 'No momento não tenho uma entrega ativa. Posso ajudar a revisar o próximo contrato quando entrar.';
    const remaining = Math.max(0, project.hours - project.progress);
    const deadline = project.deadline - state.day;
    const concern = deadline < 3 && remaining > 8 ? 'O prazo está apertado e precisamos decidir o que priorizar.' : project.quality < 55 ? 'A qualidade precisa de revisão antes de entregar.' : 'O andamento parece sob controle.';
    return `${project.title} está em ${Math.round(project.progress / project.hours * 100)}%, faltam ${Math.round(remaining)}h e o prazo é D${project.deadline}. ${concern}`;
  }
  if (topic === 'company') {
    const office = state.office.stage === 'floor' ? 'andar inteiro' : state.office.stage === 'commercial' ? 'sala comercial' : 'garagem';
    if (manager) return `Estamos no ${office}. Vejo espaço para crescer, mas precisamos manter contratos e custos em equilíbrio. ${state.management.managers.length > 1 ? 'Ter outros líderes facilita o alinhamento.' : 'Ainda concentramos muitas decisões em poucas mãos.'}`;
    if (person.morale < 45) return `Gosto da ideia da empresa, mas o ambiente tem pesado. Queria ver mais reconhecimento e espaço para conversar antes de acelerar tudo.`;
    return `Gosto de construir algo nosso aqui no ${office}. Quando sei por que um projeto importa e recebo retorno sobre meu trabalho, consigo contribuir melhor.`;
  }
  if (topic === 'growth') {
    if (manager) return `Estou acompanhando entregas e pessoas na minha área. Reuniões com a liderança ajudam a perceber riscos antes de eles virarem urgência.`;
    return evaluation.next ? `Quero chegar a ${evaluation.next.label}. Hoje minha avaliação é ${evaluation.score}/100 e acumulei ${Math.round(evaluation.xp)} pontos de experiência.${evaluation.ready ? ' Acredito que já posso assumir mais responsabilidade.' : ` Ainda preciso de ${evaluation.reasons.join(', ')}.`}` : 'Como líder, quero ajudar outras pessoas a crescer. Me chame para as reuniões quando precisar alinhar o time.';
  }
  if (topic === 'help') {
    if (manager) return `Posso resumir minha área quando você me procurar e levar decisões ao gabinete. Se reunir a liderança, conseguimos olhar o problema juntos.`;
    if (person.stress > 55) return `Uma carga mais sustentável faria diferença. Se a equipe revisar prioridades, consigo trabalhar melhor sem correr tanto.`;
    if (project?.quality < 60) return `Eu colocaria um pouco mais de tempo em revisão de ${project.title}. Entregar com bugs vai custar mais depois.`;
    return `Por enquanto estou conseguindo avançar. Uma conversa sobre os próximos passos da empresa já me ajuda.`;
  }
  return `${name} escuta você e espera a próxima pergunta.`;
}

export function staffExchange(state, first, second) {
  const project = state.projects.filter((entry) => entry.status === 'active').sort((a, b) => a.deadline - b.deadline)[0];
  if (project) {
    const remaining = Math.max(0, Math.round(project.hours - project.progress));
    return [
      { id: first.id, text: `Como vamos com ${project.title}?` },
      { id: second.id, text: project.quality < 55 ? `Faltam ${remaining}h. Precisamos revisar bem.` : `Faltam ${remaining}h. Vamos priorizar o prazo D${project.deadline}.` },
    ];
  }
  if (second.stress >= 55 || second.morale < 50) return [
    { id: first.id, text: 'Você parece cansado. Tudo bem?' },
    { id: second.id, text: 'A carga pesou. Vamos conversar sobre as prioridades.' },
  ];
  return [
    { id: first.id, text: 'Como está o dia por aqui?' },
    { id: second.id, text: 'Bem. Quero ajudar na próxima entrega.' },
  ];
}
