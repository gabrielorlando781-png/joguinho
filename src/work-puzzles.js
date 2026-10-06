// Short decisions from a software house's working day. This module is pure:
// starting, answering and crediting work belong to the simulation.
export const WORK_PUZZLE_COUNT = 5;
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
const hours = (value) => Number(value.toFixed(2)).toLocaleString('pt-BR');
const hash = (text) => [...text].reduce((value, letter) => (Math.imul(value, 31) + letter.charCodeAt(0)) >>> 0, 2166136261);

function shuffled(values, seed) {
  const copy = [...values];
  let random = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    const swap = (random >>> 0) % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function definitions(state, project) {
  const client = project.client;
  const company = state.profile.company;
  const remaining = Math.ceil(project.hours - project.progress);
  const days = Math.max(0, project.deadline - state.day);
  const delivery = state.allocation.delivery;
  const dailyRemaining = Math.max(0, delivery - state.manualDeliveryHours - state.travelHours);
  const due = state.day + project.paymentDays;
  const urgent = state.projects.filter((item) => item.status === 'active').sort((a, b) => a.deadline - b.deadline)[0];
  return [
    { kind: 'priorities', title: 'Organize a fila', variants: [
      { prompt: `A ${company} precisa continuar a entrega de ${client}: faltam cerca de ${remaining}h e o prazo está a ${days} dias. Um cliente já foi avisado de que receberá uma versão para validar. Qual tarefa vem primeiro?`, choices: ['Preparar uma versão utilizável do escopo combinado e pedir a validação.', 'Trocar o piso do escritório antes de terminar a versão.', 'Adicionar uma animação que ninguém pediu, sem atualizar o prazo.', 'Começar um produto próprio e deixar o cliente sem resposta.'], correct: 0, explanation: 'Entregar uma versão utilizável permite validar o combinado antes do prazo. Novidades e compras não substituem essa entrega.' },
      { prompt: `${urgent?.client || client} tem o prazo ativo mais próximo (dia ${urgent?.deadline || project.deadline}). A tarefa crítica precisa de feedback do cliente e outra tarefa só muda a cor de um botão. Como organizar a sequência?`, choices: ['Fazer primeiro a tarefa crítica e enviar o pedido de feedback.', 'Deixar o pedido de feedback para o último dia, depois do detalhe visual.', 'Interromper tudo até aparecer outro contrato.', 'Gastar todo o bloco escolhendo uma nova cor para o escritório.'], correct: 0, explanation: 'Antecipar uma dependência externa evita esperar pelo cliente no último dia. O detalhe visual pode vir depois.' },
      { prompt: `Na entrega de ${client}, o login bloqueia a validação e um relatório opcional pode esperar. Só existe este bloco de trabalho livre. Qual plano reduz o risco do prazo?`, choices: ['Destravar o login, testar o acesso e avisar o cliente.', 'Fazer o relatório opcional e deixar o acesso bloqueado.', 'Marcar tudo como entregue para melhorar os números do quadro.', 'Contratar alguém sem verificar posto e caixa.'], correct: 0, explanation: 'A tarefa que bloqueia a validação deve vir antes da melhoria opcional. O quadro acompanha o trabalho real.' },
    ] },
    { kind: 'scope', title: 'Proteja o combinado', variants: [
      { prompt: `${client} pediu uma integração extra que não aparece no contrato de ${money(project.price)}. A entrega já está em andamento. O que protege o caixa e torna a mudança clara para os dois lados?`, choices: ['Negociar um aditivo com trabalho, preço e prazo antes de incluir a integração.', 'Prometer a integração sem custo e manter o mesmo prazo, mesmo sem capacidade.', 'Esconder a mudança no quadro para a equipe não perceber.', 'Emitir uma cobrança extra sem conversar com o cliente.'], correct: 0, explanation: 'Um aditivo torna o trabalho extra explícito e permite combinar preço e prazo. Prometer ou cobrar sem acordo cria risco.' },
      { prompt: `O contrato de ${client} inclui cadastro e consulta. O cliente agora pede um painel novo, com mais ${Math.max(3, Math.ceil(project.hours * 0.2))}h de trabalho. Qual registro mantém o projeto organizado?`, choices: ['Registrar o pedido fora do escopo e alinhar um aditivo antes de assumir as horas.', 'Apagar as horas extras do planejamento para o prazo parecer igual.', 'Dizer que o painel já estava pronto, mesmo sem começar.', 'Usar o dinheiro de uma fatura ainda não paga para justificar a promessa.'], correct: 0, explanation: 'O escopo define o compromisso. Registrar e negociar a mudança evita transformar horas extras em uma surpresa.' },
      { prompt: `${client} quer antecipar a entrega do contrato para amanhã. Para isso, propõe retirar uma função secundária. Qual resposta preserva uma relação profissional?`, choices: ['Confirmar por escrito o novo escopo e o prazo que a equipe consegue cumprir.', 'Aceitar qualquer prazo e decidir depois o que será entregue.', 'Manter duas versões diferentes do combinado sem avisar a equipe.', 'Excluir a função principal para encerrar o projeto mais rápido.'], correct: 0, explanation: 'Prazo e escopo precisam mudar juntos com um acordo claro. A equipe deve trabalhar com a mesma versão do combinado.' },
    ] },
    { kind: 'schedule', title: 'Faça caber no dia', variants: [
      { prompt: `A rotina de ${state.profile.name} soma 8h: ${state.allocation.sales}h de vendas e ${state.allocation.quality}h de qualidade. Sem mudar essa rotina, quantas horas ficam reservadas para entrega?`, choices: [`${delivery}h de entrega.`, `${delivery + 2}h de entrega, além das outras áreas.`, '8h de entrega mais as horas de vendas e qualidade.', 'As horas de entrega não entram no limite do dia.'], correct: 0, explanation: `O dia tem oito horas ao todo. 8 − ${state.allocation.sales} − ${state.allocation.quality} = ${delivery}h para entrega.` },
      { prompt: `Hoje há ${delivery}h reservadas para entrega. Você já usou ${hours(state.manualDeliveryHours)}h em ações e ${hours(state.travelHours)}h em deslocamentos. Quanto ainda cabe nesse mesmo orçamento?`, choices: [`${hours(dailyRemaining)}h; as ações e o deslocamento usam a mesma reserva.`, `${delivery}h; as ações nunca reduzem a reserva.`, `${hours(dailyRemaining + 2)}h; abrir o aplicativo acrescenta duas horas.`, 'Uma jornada extra completa porque a consulta está pausada.'], correct: 0, explanation: `${delivery} − ${hours(state.manualDeliveryHours)} − ${hours(state.travelHours)} = ${hours(dailyRemaining)}h. Pausar o relógio não cria capacidade.` },
      { prompt: `${state.profile.name} quer planejar o próximo dia útil com 8h no total. É preciso reservar 2h de vendas e 1h de revisão. Qual plano cabe inteiro?`, choices: ['2h de vendas + 5h de entrega + 1h de revisão.', '2h de vendas + 6h de entrega + 1h de revisão.', '3h de vendas + 6h de entrega + 1h de revisão.', '8h de entrega + 2h de vendas + 1h de revisão.'], correct: 0, explanation: 'O primeiro plano soma oito horas. Os outros prometem uma capacidade que o fundador não tem.' },
    ] },
    { kind: 'cash', title: 'Confira o caixa', variants: [
      { prompt: `A ${company} tem ${money(state.cash)} em caixa. O contrato de ${client} vale ${money(project.price)}, mas o cliente só paga ${project.paymentDays} dias depois da entrega. Quanto desse contrato está disponível hoje para pagar uma compra?`, choices: ['Nada ainda: o valor só entra no caixa quando o pagamento acontecer.', `Os ${money(project.price)} completos, porque o contrato está assinado.`, 'Metade automaticamente, mesmo sem um sinal combinado.', 'Todo o valor previsto, desde que o jogador abra o financeiro.'], correct: 0, explanation: 'Contrato fechado e dinheiro recebido são momentos diferentes. Uma compra usa o caixa atual, não uma receita prevista.' },
      { prompt: `Imagine que ${client} receba a entrega hoje, no dia ${state.day}, com prazo de pagamento D+${project.paymentDays}. Sem atraso, em que dia o valor pode ser usado como dinheiro recebido?`, choices: [`No dia ${due}, quando o pagamento entrar.`, `No dia ${state.day}, só por marcar a entrega no quadro.`, `No dia ${due + 28}, obrigatoriamente junto da manutenção.`, 'Antes da entrega, porque a receita está prevista.'], correct: 0, explanation: `D+${project.paymentDays} significa ${project.paymentDays} dias após a entrega: dia ${due}. A fatura continua sendo uma previsão até o recebimento.` },
      { prompt: `A folha e o aluguel da ${company} vencem antes da fatura de ${client}. O projeto está entregue, mas o dinheiro ainda não entrou. Qual informação decide se a empresa consegue pagar agora?`, choices: ['O saldo de caixa e as datas reais de entradas e despesas.', 'Somente o preço total dos contratos assinados.', 'A quantidade de mesas compradas, sem olhar o saldo.', 'O número de projetos no quadro, mesmo sem recebimentos.'], correct: 0, explanation: 'O fluxo de caixa compara o dinheiro disponível com os pagamentos e recebimentos nas suas datas reais.' },
    ] },
    { kind: 'quality', title: 'Prepare a entrega', variants: [
      { prompt: `A versão de ${client} funciona na sua máquina. A próxima etapa é a validação do cliente. Qual checklist reduz bugs e retrabalho?`, choices: ['Testar o fluxo principal, conferir critérios do escopo e registrar limitações antes de enviar.', 'Enviar sem abrir o fluxo principal, porque o prazo está perto.', 'Apagar relatos de erro para a qualidade parecer maior.', 'Trocar o nome da versão e considerar isso uma revisão.'], correct: 0, explanation: 'Testes do fluxo principal e critérios claros verificam o que o cliente vai usar. Esconder falhas não corrige a entrega.' },
      { prompt: `No projeto de ${client}, surgiu uma falha no caminho que o cliente usa todos os dias. Uma melhoria visual também está pendente. O que deve entrar no checklist de hoje?`, choices: ['Corrigir a falha principal, testar de novo e comunicar o resultado.', 'Ignorar a falha e gastar o bloco inteiro na melhoria visual.', 'Entregar a falha em silêncio para não precisar conversar.', 'Aumentar o preço da fatura como se isso corrigisse o erro.'], correct: 0, explanation: 'Uma falha no fluxo principal afeta o uso real. Corrigir e verificar a causa reduz retrabalho e protege a confiança do cliente.' },
      { prompt: `${client} validou a função principal, mas ainda há duas limitações conhecidas. Qual entrega encerra o trabalho com clareza?`, choices: ['Conferir o escopo aceito e enviar instruções, limitações e próximos passos por escrito.', 'Afirmar que não há limitações, mesmo sabendo delas.', 'Mudar o escopo depois da aprovação sem avisar.', 'Fechar a comunicação e esperar que o cliente descubra como usar.'], correct: 0, explanation: 'Uma entrega inclui o combinado e a orientação necessária para usar o resultado. Limitações claras evitam surpresa e retrabalho.' },
    ] },
  ];
}

export function createWorkPuzzles(state, project, sessionId) {
  const seed = hash(sessionId);
  return shuffled(definitions(state, project), seed).map((definition, index) => {
    const selected = definition.variants[(seed + index * 7 + state.day) % definition.variants.length];
    const id = `${sessionId}-q${index + 1}`;
    const ordered = shuffled(selected.choices.map((label, position) => ({ label, correct: position === selected.correct })), hash(`${id}-choices`));
    const options = ordered.map((choice, position) => ({ id: `${id}-a${position + 1}`, label: choice.label }));
    return { id, kind: definition.kind, title: definition.title, prompt: selected.prompt, options,
      correctAnswerId: options[ordered.findIndex((choice) => choice.correct)].id, explanation: selected.explanation };
  });
}

export function validWorkSession(state) {
  const session = state.workSession;
  // Existing v3 saves predate the desktop and normalize this absence to null.
  if (session === undefined || session === null) return true;
  const text = (value, max = 1800) => typeof value === 'string' && value.length > 0 && value.length <= max;
  if (!session || typeof session !== 'object' || Array.isArray(session) || !text(session.id, 200) || !text(session.projectId, 100)) return false;
  if (!state.projects.some((project) => project.id === session.projectId) || session.day !== state.day || typeof session.hours !== 'number' || !Number.isFinite(session.hours) || session.hours <= 0 || session.hours > 2) return false;
  if (session.total !== WORK_PUZZLE_COUNT || !Number.isInteger(session.index) || session.index < 0 || session.index > WORK_PUZZLE_COUNT || !Number.isInteger(session.mistakes) || session.mistakes < 0 || session.mistakes > session.index) return false;
  if (session.status !== (session.index === WORK_PUZZLE_COUNT ? 'ready' : 'active') || !Array.isArray(session.puzzles) || session.puzzles.length !== WORK_PUZZLE_COUNT || !Array.isArray(session.answers) || session.answers.length !== session.index) return false;
  const kinds = ['priorities', 'scope', 'schedule', 'cash', 'quality'];
  if (new Set(session.puzzles.map((puzzle) => puzzle?.kind)).size !== WORK_PUZZLE_COUNT || !session.puzzles.every((puzzle, index) => puzzle && puzzle.id === `${session.id}-q${index + 1}` && kinds.includes(puzzle.kind) && text(puzzle.title, 100) && text(puzzle.prompt) && text(puzzle.explanation) && Array.isArray(puzzle.options) && puzzle.options.length === 4 && puzzle.options.every((option, position) => option && option.id === `${puzzle.id}-a${position + 1}` && text(option.label, 1000)) && puzzle.options.some((option) => option.id === puzzle.correctAnswerId))) return false;
  if (!session.answers.every((answer, index) => answer && answer.questionId === session.puzzles[index].id && session.puzzles[index].options.some((option) => option.id === answer.answerId) && typeof answer.correct === 'boolean' && answer.correct === (answer.answerId === session.puzzles[index].correctAnswerId))) return false;
  if (session.mistakes !== session.answers.filter((answer) => !answer.correct).length) return false;
  if (session.index === 0) return session.lastFeedback === null;
  const last = session.answers.at(-1);
  return session.lastFeedback && typeof session.lastFeedback.correct === 'boolean' && session.lastFeedback.correct === last.correct && text(session.lastFeedback.message);
}
