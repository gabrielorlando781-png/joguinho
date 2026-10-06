# devhouse.

Uma simulação de software house em que o escritório é o jogo. Você começa em uma garagem com R$ 20.000 e oito horas por dia: caminha entre os setores, negocia contratos, desenvolve, cuida da equipe e decide quando investir em produto próprio.

## Acessar pelo GitHub

Jogue em **https://gabrielorlando781-png.github.io/joguinho/**. O GitHub Pages usa a branch **main**, pasta **/docs**. Cada atualização enviada com a compilação dessa pasta inicia uma nova publicação.

A versão pronta fica em `docs/index.html`, com código, estilos e imagens embutidos. Também pode ser baixada e aberta em um navegador moderno. Não há dependências externas para jogar.

`npm run build` atualiza tanto `dist/` quanto `docs/`. Envie a pasta `docs/` junto com mudanças no código para atualizar a versão publicada.

## Jogar

1. Escolha nome, empresa, idade, ponto forte e cor do personagem.
2. Ande com **WASD**, **setas** ou um **clique/toque no chão**. Pressione **E** perto do setor para consultar. Clicar no nome de um setor ou no atalho inferior faz o personagem caminhar até ele e abrir a consulta ao chegar.
3. Vá ao **Comercial**. Investigue o escopo e escolha entre proposta competitiva, equilibrada e premium. A interface mostra a chance de fechar: discovery, reputação, salas e apresentações ajudam. Há uma tentativa por contato; uma recusa não permite repetir a proposta.
4. Vá ao **Meu PC**: o fundador se senta diante do computador. Na primeira visita, crie a senha do PC do jogo; nas seguintes, entre com ela. Abra **Desenvolver** e digite `rotina` para distribuir oito horas, `foco` para escolher o projeto e `trabalhar` para iniciar cinco puzzles de escritório. Discovery, entrevistas, deslocamento e protótipos disputam esse orçamento.
5. Consulte o **Quadro de projetos** para acompanhar entregas, escolher o ritmo e resolver pedidos extras, bloqueios ou bugs. Na **Loja**, compre uma mesa e uma cadeira para abrir uma vaga. No **RH**, entreviste antes de contratar e distribua pessoas entre desenvolvimento e revisão.
6. Faça pausas na **Copa** e no **Descanso**. Compre melhorias na **Loja**: elas aparecem no cenário, ocupam espaço e afetam produção, moral, negociações e custos.
7. Vá a **Fechar o dia** para executar a rotina restante, contabilizar custos e consultar o resumo. Também pode usar play e velocidades **1×, 2× e 4×**; um dia dura dois minutos em 1×. Consultar um setor pausa o tempo.
8. Confira pagamentos e cobranças no **Financeiro**. Consulte o **Diário** para ver reputação, histórico, objetivos, guia e identidade do fundador.
9. Depois de duas entregas, abra **Meu PC → Laboratório**: construa um MVP, valide com usuários e lance uma receita recorrente.

**Esc** fecha uma consulta. O escritório permanece visível durante as consultas. O computador tem área de trabalho, aplicativos, janelas e barra de tarefas; sair dele levanta o personagem. O personagem encontra caminhos em volta dos móveis. No celular, a câmera acompanha o personagem e os atalhos permitem caminhar até setores fora da tela.

## Seu computador e as sessões de trabalho

Caminhe até **Meu PC** e pressione **E**, ou clique no setor. O fundador fica sentado diante do equipamento, com uma animação de uso. A tela abre o **DevHouse 98**, inspirado no Windows clássico: monitor de época, tela de senha, ícones, menu Iniciar, janelas e barra de tarefas.

Na primeira visita, defina e confirme uma senha de **4 a 24 caracteres** para esse computador do jogo. A senha é pedida novamente ao voltar ao PC ou recarregar a página. **Esqueci minha senha** permite criar outra sem perder a empresa. A configuração acompanha o save; a senha em texto não é salva.

Depois de entrar, abra um dos três aplicativos:

- **Expansão:** loja, ampliação, postos de trabalho, computadores, salas e identidade da empresa.
- **Desenvolver:** terminal interativo, rotina de oito horas, foco, revisão e sessões de trabalho.
- **Laboratório:** protótipo, pesquisa e lançamento do MVP.

Clique nos ícones, no menu **Iniciar** ou na barra de tarefas para trocar de aplicativo. Os botões da janela permitem minimizar, maximizar e fechar. **Bloquear** volta à tela de senha; **Voltar ao escritório** e **Esc** fecham o computador e levantam o fundador. O tempo fica pausado durante o uso. Financeiro, RH e os outros setores continuam sendo consultados no escritório.

Em **Desenvolver**, digite um comando e pressione **Enter**, ou use os botões correspondentes:

| Comando | Ação |
| --- | --- |
| `ajuda` | Lista os comandos |
| `status` | Consulta projeto, rotina e sessão salva |
| `trabalhar` | Inicia ou retoma os cinco puzzles |
| `1`, `2`, `3`, `4` | Escolhe a resposta da decisão atual |
| `concluir` | Aplica ao projeto uma sessão respondida |
| `rotina` | Abre a distribuição das oito horas |
| `foco` | Abre a escolha do projeto prioritário |
| `revisar` | Usa uma hora disponível de revisão |
| `limpar` | Limpa o histórico de comandos |

Trabalhar exige **cinco puzzles rápidos**, com situações relacionadas ao projeto e à empresa: agenda e orçamento de horas, negociação de escopo, prioridades, recebimentos e conferência de qualidade. As situações e a posição das respostas variam. Cada resposta recebe uma explicação; erros são registrados e afetam a qualidade da entrega.

Responder não produz trabalho imediatamente. Ao concluir os cinco puzzles, use **Concluir e aplicar o trabalho** para usar as horas disponíveis e aplicar a produção uma única vez. O bloco manual total continua limitado a **2h por dia** e faz parte das oito horas da rotina. Se você mudar a alocação, precisa restaurar as horas anunciadas para concluir a sessão.

Uma sessão incompleta é salva e pode ser retomada no mesmo dia, mesmo depois de sair do PC ou recarregar a página. Fechar o dia encerra uma sessão incompleta sem aplicar produção extra.

## Decisões e consequências

| Decisão | Consequência |
| --- | --- |
| Descobrir o escopo | Consome 1h de vendas, melhora a estimativa e libera propostas premium |
| Negociar preço | Competitiva paga 85% e dá mais prazo; premium paga 120%, exige prazo menor e pode atrasar o pagamento |
| Escolher ritmo | Rápido aumenta produção e risco; caprichado melhora qualidade e reduz velocidade |
| Resolver imprevistos | Pedidos extras, dependências e bugs exigem escolhas que afetam caixa, horas, qualidade e prazo |
| Distribuir a equipe | Pessoas podem desenvolver ou revisar um projeto; moral e estresse influenciam a produtividade |
| Caminhar entre setores | Usa parte da capacidade de desenvolvimento, limitada a 0,75h por dia |
| Construir produto | Disputa horas e caixa com os clientes antes de gerar receita recorrente |

O fundador tem **8h por dia útil**. Trabalho manual adianta as horas reservadas, sem duplicar a produção ao fechar o dia. O restante da rotina e as tarefas da equipe são processados no fechamento.

Entregar e receber são momentos diferentes. Contratos competitivos, equilibrados e premium têm vencimento em **D+2, D+3 e D+5** após a entrega. O financeiro permite cobrar valores vencidos; contratos premium podem atrasar. Atrasos na entrega e qualidade baixa reduzem pagamento e reputação.

O custo fixo acompanha o endereço: aluguel, R$ 35 de internet e serviços por dia e os adicionais das salas construídas, incluindo fins de semana. A folha usa salário dividido por 20 dias úteis, com multiplicador **1,15 para PJ** e **1,7 para CLT**. Sábados e domingos são pulados pela interface, com descanso, custos e recebimentos contabilizados. A linha de crédito inicial é de **R$ 2.000**, disponível uma vez, com juros de **2% a cada 28 dias** até a quitação. Caixa negativo pode ser recuperado; a empresa fecha após 60 dias consecutivos no vermelho.

O laboratório libera após duas entregas. Cada dia permite um investimento: protótipo custa **2h de desenvolvimento e R$ 300**, pesquisa custa **1h de qualidade e R$ 150**. Completar o protótipo e duas pesquisas lança o MVP. A receita recorrente é recebida em ciclos de 28 dias, com R$ 100 de suporte por ciclo.

## Evolução do escritório

O espaço é limitado. Mesas, salas, descanso e equipamentos disputam posições; cadeiras completam uma mesa existente. Piso, decoração e banner usam as superfícies e cantos já reservados no mapa. Cada compra mostra seu efeito, requisitos, ocupação e custo contínuo antes da decisão.

| Endereço | Posições | Limite de postos, incluindo fundador | Custo da mudança | Aluguel base diário |
| --- | --- | --- | --- | --- |
| Garagem | 6 | 2 | Inicial | R$ 55 |
| Sala comercial | 16 | 5 | R$ 6.500 | R$ 110 |
| Andar inteiro | 26 | 9 | R$ 16.000 | R$ 230 |

Internet e serviços somam **R$ 35 por dia**. Ampliar não depende apenas do dinheiro: a sala comercial pede uma entrega, dois contratos e reputação 14; o andar inteiro pede quatro entregas, cinco contratos, duas pessoas no time e reputação 24. Cada endereço troca o mapa; os móveis e as salas permanecem nas posições planejadas.

Uma mesa com computador básico custa **R$ 650**, e a cadeira, **R$ 280**. Sem um posto completo livre não há contratação. O computador pertence ao posto e afeta apenas quem o utiliza:

| Computador | Produção | Preço da melhoria | Manutenção a cada 28 dias |
| --- | --- | --- | --- |
| Básico | Padrão | Incluído na mesa | R$ 20 |
| Profissional | +15% | R$ 1.800 | R$ 70 |
| Estação avançada | +32% | R$ 3.600 | R$ 150 |

As melhorias avançadas também têm requisitos de progresso. A área de descanso melhora a moral e reduz o estresse diariamente; piso e decoração concedem bônus pequenos de moral. O banner permite texto e cor próprios, aumenta lentamente a reputação e ajuda a atrair contatos.

### Divisão dos setores

Desenvolvimento, Comercial, RH e Financeiro evoluem de forma independente:

| Formato | Custo de construção | Ocupação | Manutenção por ciclo | Troca |
| --- | --- | --- | --- | --- |
| Espaço aberto | Inicial | 0 | R$ 0 | Sinergia máxima, com ruído e interrupções |
| Divisórias | R$ 650 | 1 | R$ 15 | Menos ruído, leve perda de sinergia |
| Sala dedicada | R$ 2.400 | 2 | R$ 100 | Isolamento e bônus do setor; menos colaboração e R$ 12/dia adicionais |
| Sala de vidro | R$ 4.200 | 2 | R$ 180 | Recupera parte da sinergia; R$ 16/dia adicionais |

O custo de construção é pago a cada avanço de nível. Cada nível substitui a ocupação e os custos contínuos do anterior. Divisórias dependem do progresso do setor; salas dedicadas exigem endereço comercial e salas de vidro exigem andar inteiro, quatro entregas e reputação 25.

O Comercial melhora a chance de fechar propostas; Desenvolvimento reduz bugs e melhora a qualidade; RH melhora a avaliação e a produtividade das novas contratações; Financeiro reduz atrasos de pagamentos. Ruído tira capacidade de desenvolvimento e eleva o estresse. Sinergia ajuda revisões e previne bloqueios. As paredes e portas aparecem no mapa; o vidro fica transparente.

### Salas especiais

A **sala de reunião** custa R$ 3.800, ocupa três posições, acrescenta R$ 10/dia de aluguel e R$ 120 por ciclo de manutenção. Exige endereço comercial, duas pessoas, duas entregas e reputação 18. Caminhe até ela para:

- Alinhar a equipe: 1h de qualidade, menos dívida e bloqueios, com efeito por três dias.
- Apresentar ao cliente: 1h de vendas e R$ 80, melhor chance de negociação por três dias.
- Integrar novos contratados: 1h de qualidade, melhor moral, menos estresse e mais produtividade nos primeiros dias.

A **sala do CEO** custa R$ 8.500, ocupa três posições, acrescenta R$ 18/dia e R$ 200 por ciclo. Exige andar inteiro, três funcionários, seis entregas, reputação 35 e R$ 25 mil em caixa. Foco consome 1h de desenvolvimento e melhora energia e produção do fundador no dia; usar repetidamente aumenta o isolamento e prejudica a moral. Conversar com a equipe usa 1h de vendas e reduz esse isolamento.

Cada ação especial tem limite diário e usa o mesmo orçamento de oito horas. A manutenção é lançada no financeiro a cada 28 dias, inclusive se a data cair no fim de semana. A consulta **Financeiro → Custos do espaço** mostra os valores e a próxima cobrança.

## Salvamento

O progresso fica no `localStorage` deste navegador. Empresa, perfil, equipe, projetos, mobília, financeiro, posição do personagem e sessões de puzzles são salvos automaticamente. Recarregar restaura a partida com o tempo pausado. Jogos das versões 1 e 2 são migrados preservando o progresso. O escritório antigo vira uma sala aberta no menor endereço capaz de acomodar todos os postos e melhorias existentes. A primeira manutenção é agendada para 28 dias após a migração, sem cobrança retroativa.

Limpar os dados do navegador apaga a partida. Não há conta, sincronização entre dispositivos ou salvamento no servidor. Você pode começar outra história pelo **Diário → Guia & identidade**, com confirmação antes de substituir a empresa.

Esta versão aprofunda contratos, equipe, eventos, produto e evolução do escritório, usando parâmetros econômicos simplificados. Os layouts são planejados; montagem livre do escritório, novos andares, concorrentes e expansão do SaaS após o MVP ficam para próximos capítulos. Os modelos de contrato e o grupo de candidatos continuam limitados.

## Executar

Requisitos: Node.js 20.19+ ou 22.12+, npm e um navegador moderno. O ambiente na nuvem foi validado com Node.js 24.

```sh
git clone https://github.com/gabrielorlando781-png/joguinho.git
cd joguinho
npm ci
npm run dev -- --port 5173 --strictPort
```

O servidor atende na porta 5173. `npm run build` gera a versão estática e a página única para GitHub Pages; `npm run preview -- --port 4173 --strictPort` serve a compilação para validação.

## Verificação

```sh
npm test
npm run build
npm run test:browser
```

A suíte Node cobre 88 cenários de negócio, orçamento de horas, puzzles, senha do PC, comandos do terminal, imprevistos, crédito, produto, progressão do escritório, efeitos das salas, manutenção e migração dos saves. O teste de navegador usa Python Playwright e Chromium, disponíveis nesta imagem de nuvem. Ele inicia seu próprio servidor Vite em uma porta livre, usa contextos isolados e percorre os setores com o personagem, verificando contratos, equipe, entregas, recebimentos, compras, ampliações, salas, ações especiais, senha e recuperação do PC, comandos digitados, janelas, salvamento, migração e layout móvel. Encerra apenas o servidor que iniciou. `GAME_TEST_ARTIFACTS` permite escolher a pasta das capturas.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.js` | Consultas nos setores, perfil e ciclo de tempo |
| `src/ui.js` | Ícones, retratos e formatação da interface |
| `src/office.js` | Escritório em Canvas 2D, personagem, câmera, caminhos e colisões |
| `src/office-layouts.js` | Mapas planejados, postos, paredes e portas por estágio |
| `src/office-progression.js` | Catálogo, requisitos, ocupação, custos e efeitos do escritório |
| `src/store-ui.js` | Loja contextual com custos, vagas, salas e identidade |
| `src/computer-ui.js` | Área de trabalho, aplicativos e interface dos puzzles |
| `src/computer-session.js` | Senha do PC e interpretação dos comandos do terminal |
| `src/work-puzzles.js` | Situações de escritório, respostas e validação das sessões |
| `src/simulation.js` | Regras econômicas, projetos, ações e salvamento versionado |
| `src/style.css` | Aparência, consultas, diálogos e layout responsivo |
| `tests/` | Testes de regras e jornadas no navegador |
| `scripts/export.mjs` | Gera uma página única para distribuição e GitHub Pages |
| `docs/` | Compilação pronta para GitHub Pages |

O jogo roda inteiramente no navegador. Não precisa de banco de dados, API externa ou credenciais. Vite é a única dependência de desenvolvimento; as versões estão fixadas no lockfile.
