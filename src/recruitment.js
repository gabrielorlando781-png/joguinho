export const TALENT_TEMPLATES = [
  { name: 'Davi', role: 'Dev backend', salary: 3200, productivity: 6.5, trait: 'Gosta de sistemas confiáveis', color: '#7fa9ad' },
  { name: 'Joana', role: 'Analista de qualidade', salary: 2900, productivity: 5.4, trait: 'Encontra o detalhe antes do cliente', color: '#ba966a' },
  { name: 'Caio', role: 'Dev frontend', salary: 3000, productivity: 6, trait: 'Cuida da experiência em cada tela', color: '#8c93c4' },
  { name: 'Pri', role: 'Designer de produto', salary: 2700, productivity: 5, trait: 'Faz perguntas antes de desenhar', color: '#c48097' },
  { name: 'André', role: 'Dev fullstack', salary: 3800, productivity: 7.2, trait: 'Destrava entregas difíceis', color: '#84ad75' },
  { name: 'Sofia', role: 'Analista de testes', salary: 3100, productivity: 5.8, trait: 'Consegue reproduzir qualquer bug', color: '#c3a075' },
  { name: 'Iago', role: 'Dev backend', salary: 3400, productivity: 6.8, trait: 'Documenta para o próximo entender', color: '#7698b7' },
  { name: 'Luna', role: 'UX pesquisadora', salary: 2850, productivity: 5.2, trait: 'Ouve o usuário antes de assumir', color: '#ab89be' },
  { name: 'Pedro', role: 'Dev de produto', salary: 3600, productivity: 6.7, trait: 'Traduz problema em entrega', color: '#9dac78' },
  { name: 'Yasmin', role: 'Analista de qualidade', salary: 3050, productivity: 5.6, trait: 'Gosta de processos leves', color: '#c58a78' },
  { name: 'Noah', role: 'Dev de dados', salary: 3900, productivity: 7, trait: 'Transforma informação em decisão', color: '#79a4a0' },
  { name: 'Cecília', role: 'Designer de produto', salary: 2950, productivity: 5.3, trait: 'Enxerga o que torna a ferramenta humana', color: '#bc89a3' },
];

export const createRecruitment = () => ({ nextId: 1, candidates: [] });
const SURNAMES = ['Matos', 'Almeida', 'Ribeiro', 'Barros', 'Costa', 'Souza', 'Ferreira', 'Lima'];

export function refillCandidates(state, limit = 4) {
  state.recruitment ||= createRecruitment();
  while (state.recruitment.candidates.length < limit) {
    const serial = state.recruitment.nextId++;
    const template = TALENT_TEMPLATES[(serial - 1) % TALENT_TEMPLATES.length];
    state.recruitment.candidates.push({ ...template, id: `talent-${serial}`, name: serial <= TALENT_TEMPLATES.length ? template.name : `${template.name} ${SURNAMES[(Math.floor((serial - 1) / TALENT_TEMPLATES.length) - 1) % SURNAMES.length]}` });
  }
}

export function validRecruitment(recruitment) {
  if (recruitment === undefined) return true;
  if (!recruitment || !Number.isInteger(recruitment.nextId) || recruitment.nextId < 1 || !Array.isArray(recruitment.candidates) || recruitment.candidates.length > 8) return false;
  const ids = recruitment.candidates.map((candidate) => candidate.id);
  if (new Set(ids).size !== ids.length) return false;
  return recruitment.candidates.every((person) => person && /^talent-[1-9]\d*$/.test(person.id) && Number(person.id.slice(7)) < recruitment.nextId && typeof person.name === 'string' && person.name.length <= 50 && typeof person.role === 'string' && person.role.length <= 70 && typeof person.trait === 'string' && person.trait.length <= 160 && /^#[0-9a-f]{6}$/i.test(person.color) && Number.isFinite(person.salary) && person.salary >= 1 && person.salary <= 1000000 && Number.isFinite(person.productivity) && person.productivity > 0 && person.productivity <= 24);
}
