# devhouse.

Uma simulação de software house em que o escritório é o jogo. Você começa em uma garagem com R$ 20.000 e oito horas por dia: caminha entre os setores, negocia contratos, desenvolve, cuida da equipe e decide quando investir em produto próprio.

## Acessar pelo GitHub

Jogue em **https://gabrielorlando781-png.github.io/joguinho/**. O GitHub Pages usa a branch **main**, pasta **/docs**. Cada atualização enviada com a compilação dessa pasta inicia uma nova publicação.

A versão pronta fica em `docs/index.html`, com código, estilos e imagens embutidos. Também pode ser baixada e aberta em um navegador moderno. Não há dependências externas para jogar.

`npm run build` atualiza tanto `dist/` quanto `docs/`. Envie a pasta `docs/` junto com mudanças no código para atualizar a versão publicada.

## Jogar

1. Escolha nome, empresa, idade, ponto forte e cor do personagem.
2. Ande com **WASD**, **setas** ou um **clique/toque no chão**. Pressione **E** perto do setor para consultar. Clicar em uma mesa ou no nome de um setor faz o personagem caminhar até ele e abrir a consulta ao chegar.
3. Vá ao **Comercial**. Investigue o escopo e escolha entre proposta competitiva, equilibrada e premium. A interface mostra a chance de fechar: discovery, reputação, salas e apresentações ajudam. Há uma tentativa por contato; uma recusa não permite repetir a proposta.
4. Vá ao **Meu PC**: o fundador se senta diante do computador. Na primeira visita, crie a senha do PC do jogo; nas seguintes, entre com ela. Abra **Desenvolver** e digite `rotina` para distribuir oito horas, `foco` para escolher o projeto e `trabalhar` para iniciar cinco puzzles de escritório. Discovery, entrevistas, deslocamento e protótipos disputam esse orçamento.
5. Consulte o **Quadro de projetos** para acompanhar entregas, escolher o ritmo e resolver pedidos extras, bloqueios ou bugs. Na **Loja**, compre uma mesa e uma cadeira para abrir uma vaga. No **RH**, entreviste antes de contratar e distribua pessoas entre desenvolvimento e revisão.
6. Faça pausas na **Copa** e no **Descanso**. Compre melhorias na **Loja**: elas aparecem no cenário, ocupam espaço e afetam produção, moral, negociações e custos.
7. Vá a **Fechar o dia** para executar a rotina restante, contabilizar custos e consultar o resumo. Também pode usar play e velocidades **1×, 2× e 4×**; um dia dura dois minutos em 1×. Consultar um setor pausa o tempo.
8. Confira pagamentos e cobranças no **Financeiro**. Consulte o **Diário** para ver reputação, histórico, objetivos, guia e identidade do fundador.
9. Depois de duas entregas, abra **Meu PC → Laboratório**: construa um MVP, valide com usuários e lance uma receita recorrente.

**Esc** fecha uma consulta. O escritório permanece visível durante as consultas. O computador tem área de trabalho, aplicativos, janelas e barra de tarefas; sair dele levanta o personagem. O personagem encontra caminhos em volta dos móveis. A câmera acompanha o personagem e preenche a tela com a área útil do escritório. As configurações ficam na engrenagem do canto superior direito; ali estão a tela cheia, o perfil e os controles do jogo.

## Seu computador e as sessões de trabalho

Caminhe até **Meu PC** e pressione **E**, ou clique no setor. O fundador fica sentado diante do equipamento, com uma animação de uso. A tela abre o **DevHouse 98**, inspirado no Windows clássico: monitor de época, tela de senha, ícones, menu Iniciar, janelas e barra de tarefas.

Na primeira visita, defina e confirme uma senha de **4 a 24 caracteres** para esse computador do jogo. A senha é pedida novamente ao voltar ao PC ou recarregar a página. **Esqueci minha senha** permite criar outra sem perder a empresa. A configuração acompanha o save; a senha em texto não é salva.

Depois de entrar, abra um dos três aplicativos:

- **Internet:** navegador clássico que abre a loja **Espaço & Cia.**, com expansões, postos, computadores, salas e identidade da empresa.
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

## A loja no navegador do PC

Entre em **Meu PC → Internet**. A Espaço & Cia. abre como um site dentro do computador: barra de endereço, voltar, avançar, atualizar, favoritos e uma vitrine com imagens, preços e disponibilidade. O PC mantém a área de trabalho cinza, os ícones e as janelas clássicas.

| Departamento | O que encontrar |
| --- | --- |
| Expansões de área | Garagem, sala comercial e andar inteiro, com capacidade e aluguel |
| Andares e circulação | Segundo e terceiro andar, escadas incluídas e elevador para todos os pavimentos |
| Salas e divisórias | Divisórias, salas dedicadas, vidro e salas especiais, separadas por classe e setor |
| Mesas e cadeiras | Novos postos e cadeiras destinadas a uma mesa específica |
| Computadores | Três níveis de equipamento para cada posto existente |
| Conforto e rotina | Descanso, cafeteira e quadro de ideias |
| Piso e identidade | Piso, decoração e banner personalizável |

Busque pelo nome ou efeito do produto. O catálogo permite ordenar por preço ou nome, mostrar apenas itens disponíveis e filtrar as classes de salas. No celular, deslize a faixa de departamentos e use **Filtrar e ordenar**; a página rola dentro da tela do PC.

Clique em um produto para consultar imagem, preço, espaço, aluguel e manutenção. Os bloqueios mostram o requisito que falta; as ofertas seguem as mesmas regras de progresso e caixa do escritório. **Comprar e instalar** aplica a compra e abre um comprovante com total pago, saldo, espaço ocupado e próxima manutenção. Atualizar o comprovante não cobra novamente.

O favorito **Meu escritório** mostra o endereço, capacidade, postos livres e custos contínuos. A barra de endereço navega pelas páginas da loja simulada; o site faz parte do jogo e também funciona offline. A loja física do escritório continua disponível.

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

O custo fixo acompanha o endereço: aluguel, R$ 35 de internet e serviços por dia e os adicionais das salas construídas, incluindo fins de semana. A folha usa salário dividido por 20 dias úteis, com multiplicador **1,15 para PJ** e **1,7 para CLT**. Sábados e domingos são pulados pela interface, com descanso, custos e recebimentos contabilizados. A linha de crédito começa em **R$ 2.000**, cresce com reputação e histórico e permite novos saques conforme a dívida é amortizada. Os juros de **2% a cada 28 dias** são incorporados à dívida até a quitação. Caixa negativo pode ser recuperado; a empresa fecha após 60 dias consecutivos no vermelho.

O laboratório libera após duas entregas. Cada dia permite um investimento: protótipo custa **2h de desenvolvimento e R$ 300**, pesquisa custa **1h de qualidade e R$ 150**. Completar o protótipo e duas pesquisas lança o MVP. A receita recorrente é recebida em ciclos de 28 dias, com R$ 100 de suporte por ciclo.

## Quadro do Financeiro

Caminhe até a sala Financeiro e clique no quadro ou pressione **E**. O espaço tem duas mesas de trabalho, cadeiras, calculadora, documentos e um quadro com números e gráfico do caixa.

As seis abas do quadro mostram informações e ações separadas:

- **Caixa e fôlego:** saldo, dias de operação sem novas entradas e próximos movimentos.
- **Fluxo previsto:** gráfico de 30 dias, cenário de risco e detalhes de cada dia. Só inclui recebíveis já emitidos e obrigações conhecidas; novos contratos não são receita garantida.
- **A receber:** vencimento, risco e situação de cada nota. Cobrar usa 0,5h de gestão; cobrança firme usa 1h e reduz a reputação. Renegociar usa 0,5h, concede 2% de desconto e estende o prazo em três ou sete dias. Antecipar usa 0,5h e recebe o líquido do desconto mostrado, transferindo o risco ao banco. Cada nota é liquidada uma vez.
- **A pagar:** salários e encargos separados, aluguel, serviços, manutenção e impostos. Encargos simplificados: 15% para PJ e 70% para CLT. O imposto é 6% sobre novas entregas e receita de produto, provisionado no faturamento e pago no fechamento do ciclo.
- **Crédito:** limite, saldo devedor, próxima incidência de juros, empréstimo por valor e amortização parcial ou total.
- **Fechamento mensal:** receita, despesas por categoria, resultado e comparação com o período anterior. O mês do jogo tem 28 dias. Financiamentos e compras de expansão movimentam o caixa sem virarem lucro ou despesa operacional.

Notas de alto risco podem resultar em calote; renegociar reduz o risco, sem garantir o recebimento. O fechamento reconhece a perda e mantém a nota identificada no quadro. Consultar relatórios não consome dinheiro ou horas.

Saves anteriores continuam funcionando, sem cobrança retroativa de impostos. O histórico financeiro disponível é importado e identificado no fechamento.

## Evolução do escritório

O espaço é limitado. Mesas, salas, descanso e equipamentos disputam posições; cadeiras completam uma mesa existente. Piso, decoração e banner usam as superfícies e cantos já reservados no mapa. Cada compra mostra seu efeito, requisitos, ocupação e custo contínuo antes da decisão.

| Endereço | Posições | Limite de postos, incluindo fundador | Custo da mudança | Aluguel base diário |
| --- | --- | --- | --- | --- |
| Garagem | 6 | 2 | Inicial | R$ 55 |
| Sala comercial | 16 | 5 | R$ 6.500 | R$ 110 |
| Andar inteiro | 26 | 9 | R$ 16.000 | R$ 230 |

Internet e serviços somam **R$ 35 por dia**. Ampliar não depende apenas do dinheiro: a sala comercial pede uma entrega, dois contratos e reputação 14; o andar inteiro pede quatro entregas, cinco contratos, duas pessoas no time e reputação 24. Cada endereço troca o mapa e preserva a distribuição escolhida na planta. O escritório tem corredores mais amplos e espaços separados para cada setor.

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

O Comercial melhora a chance de fechar propostas; Desenvolvimento reduz bugs e melhora a qualidade; RH melhora a avaliação e a produtividade das novas contratações; Financeiro reduz atrasos de pagamentos. Ruído tira capacidade de desenvolvimento e eleva o estresse. Sinergia ajuda revisões e previne bloqueios. Divisórias ficam no ambiente comum, com colisões e abertura escolhida na planta. Salas dedicadas e de vidro têm uma porta no corredor: clique ou pressione E para entrar no interior e caminhe até a mesa ou quadro para consultar o setor. Entrar na sala não abre o relatório automaticamente. A porta Corredor leva de volta ao mesmo ponto do andar. As salas de vidro têm fachada transparente e interior com acabamento de vidro. Reuniões e CEO também possuem cômodos próprios.

### Salas especiais

A **sala de reunião** custa R$ 3.800, ocupa três posições, acrescenta R$ 10/dia de aluguel e R$ 120 por ciclo de manutenção. Exige endereço comercial, duas pessoas, duas entregas e reputação 18. Caminhe até ela para:

- Alinhar a equipe: 1h de qualidade, menos dívida e bloqueios, com efeito por três dias.
- Apresentar ao cliente: 1h de vendas e R$ 80, melhor chance de negociação por três dias.
- Integrar novos contratados: 1h de qualidade, melhor moral, menos estresse e mais produtividade nos primeiros dias.

A **sala do CEO** custa R$ 8.500, ocupa três posições, acrescenta R$ 18/dia e R$ 200 por ciclo. Exige andar inteiro, três funcionários, seis entregas, reputação 35 e R$ 25 mil em caixa. Foco consome 1h de desenvolvimento e melhora energia e produção do fundador no dia; usar repetidamente aumenta o isolamento e prejudica a moral. Conversar com a equipe usa 1h de vendas e reduz esse isolamento.

Cada ação especial tem limite diário e usa o mesmo orçamento de oito horas. A manutenção é lançada no financeiro a cada 28 dias, inclusive se a data cair no fim de semana. A consulta **Financeiro → A pagar** mostra os valores e a próxima cobrança.

## Planta e andares

No computador, abra **Internet → Espaço & Cia. → Planta**, ou **Meu escritório → Editar planta**. A loja física também oferece **Editar planta**.

1. Selecione Desenvolvimento, Comercial, RH ou Financeiro.
2. Escolha um andar adquirido e clique no espaço desejado. Se houver outro setor, as posições serão trocadas.
3. Em setores abertos ou com divisórias, escolha a abertura norte, sul, leste ou oeste. Salas dedicadas mantêm a porta voltada para o corredor.
4. **Aplicar planta** instala a distribuição; **Cancelar** descarta o rascunho. Reorganizar não cobra outra compra, e mesas, equipamentos, equipe e progresso acompanham o setor.

Corredores, escadas e elevador permanecem reservados para preservar a circulação. A planta e o cômodo atual são salvos. Saves antigos recebem a distribuição inicial e uma posição segura, preservando a empresa e seu histórico financeiro.

A categoria **Andares e circulação** oferece:

| Expansão | Compra | Posições / postos adicionais | Aluguel diário adicional | Manutenção por 28 dias | Requisitos |
| --- | --- | --- | --- | --- | --- |
| Segundo andar | R$ 14.000 | 16 / 6 | R$ 160 | R$ 70 | Andar inteiro, 6 entregas, 2 pessoas e reputação 28 |
| Terceiro andar | R$ 22.000 | 16 / 6 | R$ 190 | R$ 90 | Segundo andar, 10 entregas, 3 pessoas e reputação 40 |
| Elevador | R$ 6.000 | Conecta todos os pavimentos | R$ 4 | R$ 180 | Pelo menos dois andares |

Escadas vêm com o novo pavimento. Clique ou use **E** para subir ou descer um andar; no elevador, escolha o destino no painel. Escadas usam 0,1h por pavimento e o elevador 0,025h em dias úteis, respeitando o limite diário de 0,75h junto com as caminhadas.

O prédio completo oferece até **58 posições e 21 postos**. Os primeiros nove acompanham Desenvolvimento; os seis seguintes ficam no estúdio de apoio do segundo andar e os últimos seis no terceiro. O grupo de candidatos permanece o atual. Os setores podem ser transferidos entre quatro espaços por pavimento; copa e descanso completam cada andar. Reuniões, CEO e os serviços de gestão permanecem no térreo.

## Salvamento

O progresso fica no `localStorage` deste navegador. Empresa, perfil, equipe, projetos, mobília, financeiro, posição do personagem e sessões de puzzles são salvos automaticamente. Recarregar restaura a partida com o tempo pausado. Jogos das versões 1 e 2 são migrados preservando o progresso. O escritório antigo vira uma sala aberta no menor endereço capaz de acomodar todos os postos e melhorias existentes. A primeira manutenção é agendada para 28 dias após a migração, sem cobrança retroativa.

Limpar os dados do navegador apaga a partida. Não há conta, sincronização entre dispositivos ou salvamento no servidor. Você pode começar outra história pelo **Diário → Guia & identidade**, com confirmação antes de substituir a empresa.

Esta versão aprofunda contratos, equipe, eventos, produto e evolução do escritório, usando parâmetros econômicos simplificados. O editor organiza os setores em espaços seguros de até três pavimentos. Montagem livre de cada móvel, concorrentes e expansão do SaaS após o MVP continuam fora desta versão. Os modelos de contrato e o grupo de candidatos continuam limitados.

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

Para verificar apenas o navegador e as compras da loja: `GAME_BROWSER_SUITE=shop npm run test:browser`.

A suíte Node cobre 111 cenários de negócio, orçamento de horas, puzzles, senha do PC, comandos do terminal, imprevistos, crédito, produto, progressão do escritório, efeitos das salas, manutenção e migração dos saves. O teste de navegador usa Python Playwright e Chromium, disponíveis nesta imagem de nuvem. Ele inicia seu próprio servidor Vite em uma porta livre, usa contextos isolados e percorre os setores com o personagem, verificando contratos, equipe, entregas, recebimentos, compras, ampliações, salas, ações especiais, senha e recuperação do PC, comandos digitados, janelas, salvamento, migração e layout móvel. Encerra apenas o servidor que iniciou. `GAME_TEST_ARTIFACTS` permite escolher a pasta das capturas.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.js` | Consultas nos setores, perfil e ciclo de tempo |
| `src/ui.js` | Ícones, retratos e formatação da interface |
| `src/office.js` | Escritório em Canvas 2D, personagem, câmera, caminhos e colisões |
| `src/office-layouts.js` | Corredores, espaços reorganizáveis, interiores, portas e circulação por andar |
| `src/office-building.js` | Andares, elevador, planta, custos e validação de localização |
| `src/layout-editor.js` | Rascunho da planta, troca de setores e orientação das divisórias |
| `src/office-progression.js` | Catálogo, requisitos, ocupação, custos e efeitos do escritório |
| `src/store-ui.js` | Loja contextual com custos, vagas, salas e identidade |
| `src/computer-ui.js` | Área de trabalho, aplicativos e interface dos puzzles |
| `src/computer-session.js` | Senha do PC e interpretação dos comandos do terminal |
| `src/shop-browser.js` | Navegador, histórico, catálogo visual, detalhes e comprovantes da loja |
| `src/work-puzzles.js` | Situações de escritório, respostas e validação das sessões |
| `src/simulation.js` | Regras econômicas, projetos, ações e salvamento versionado |
| `src/style.css` | Aparência, consultas, diálogos e layout responsivo |
| `tests/` | Testes de regras e jornadas no navegador |
| `scripts/export.mjs` | Gera uma página única para distribuição e GitHub Pages |
| `docs/` | Compilação pronta para GitHub Pages |

O jogo roda inteiramente no navegador. Não precisa de banco de dados, API externa ou credenciais. Vite é a única dependência de desenvolvimento; as versões estão fixadas no lockfile.
