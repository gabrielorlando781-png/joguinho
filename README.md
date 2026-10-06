# devhouse.

Uma simulação de software house em que o escritório é o jogo. Você começa com R$ 20.000 e oito horas por dia: caminha entre os setores, negocia contratos, desenvolve, cuida da equipe e decide quando investir em produto próprio.

## Acessar pelo GitHub

Jogue em **https://gabrielorlando781-png.github.io/joguinho/**. O GitHub Pages usa a branch **main**, pasta **/docs**. Cada atualização enviada com a compilação dessa pasta inicia uma nova publicação.

A versão pronta fica em `docs/index.html`, com código, estilos e imagens embutidos. Também pode ser baixada e aberta em um navegador moderno. Não há dependências externas para jogar.

`npm run build` atualiza tanto `dist/` quanto `docs/`. Envie a pasta `docs/` junto com mudanças no código para atualizar a versão publicada.

## Jogar

1. Escolha nome, empresa, idade, ponto forte e cor do personagem.
2. Ande com **WASD**, **setas** ou um **clique/toque no chão**. Pressione **E** perto do setor para consultar. Clicar no nome de um setor ou no atalho inferior faz o personagem caminhar até ele e abrir a consulta ao chegar.
3. Vá ao **Comercial**. Investigue o escopo e escolha entre proposta competitiva, equilibrada e premium. Preço, prazo e dia do recebimento mudam conforme a negociação.
4. No **Desenvolvimento**, distribua oito horas entre vendas, desenvolvimento e qualidade. Escolha seu projeto prioritário, trabalhe ou revise. Discovery, entrevistas, deslocamento e protótipos disputam esse orçamento.
5. Consulte o **Quadro de projetos** para acompanhar entregas, escolher o ritmo e resolver pedidos extras, bloqueios ou bugs. No **RH**, entreviste antes de contratar e distribua pessoas entre desenvolvimento e revisão.
6. Faça pausas na **Copa** e no **Descanso**. Compre melhorias na **Mobília**: elas aparecem no cenário e afetam a produção.
7. Vá a **Fechar o dia** para executar a rotina restante, contabilizar custos e consultar o resumo. Também pode usar play e velocidades **1×, 2× e 4×**; um dia dura dois minutos em 1×. Consultar um setor pausa o tempo.
8. Confira pagamentos e cobranças no **Financeiro**. Consulte o **Diário** para ver reputação, histórico, objetivos, guia e identidade do fundador.
9. Depois de duas entregas, explore o **Laboratório**: construa um MVP, valide com usuários e lance uma receita recorrente.

**Esc** fecha uma consulta. O escritório permanece visível durante as consultas; não há um painel externo de gestão. O personagem encontra caminhos em volta dos móveis. No celular, a câmera acompanha o personagem e os atalhos permitem caminhar até setores fora da tela.

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

Custos fixos são **R$ 110 por dia**, incluindo fins de semana. A folha usa salário dividido por 20 dias úteis, com multiplicador **1,15 para PJ** e **1,7 para CLT**. Sábados e domingos são pulados pela interface, com descanso, custos e recebimentos contabilizados. A linha de crédito inicial é de **R$ 2.000**, disponível uma vez, com juros de **2% a cada 28 dias** até a quitação. Caixa negativo pode ser recuperado; a empresa fecha após 60 dias consecutivos no vermelho.

O laboratório libera após duas entregas. Cada dia permite um investimento: protótipo custa **2h de desenvolvimento e R$ 300**, pesquisa custa **1h de qualidade e R$ 150**. Completar o protótipo e duas pesquisas lança o MVP. A receita recorrente é recebida em ciclos de 28 dias, com R$ 100 de suporte por ciclo.

## Salvamento

O progresso fica no `localStorage` deste navegador. Empresa, perfil, equipe, projetos, mobília, financeiro e posição do personagem são salvos automaticamente. Recarregar restaura a partida com o tempo pausado. Jogos da primeira versão são migrados preservando o progresso.

Limpar os dados do navegador apaga a partida. Não há conta, sincronização entre dispositivos ou salvamento no servidor. Você pode começar outra história pelo **Diário → Guia & identidade**, com confirmação antes de substituir a empresa.

Esta versão aprofunda contratos, equipe, eventos e produto, usando parâmetros econômicos simplificados. A mobília ainda ocupa posições planejadas; montagem livre do escritório, novos andares, concorrentes e expansão do SaaS após o MVP ficam para próximos capítulos.

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

A suíte Node cobre 43 cenários de negócio, orçamento de horas, imprevistos, crédito, produto e persistência. O teste de navegador usa Python Playwright e Chromium, disponíveis nesta imagem de nuvem. Ele inicia seu próprio servidor Vite em uma porta livre, usa contextos isolados e percorre os setores com o personagem, verificando contratos, equipe, entregas, recebimentos, compras, salvamento, migração e layout móvel. Encerra apenas o servidor que iniciou. `GAME_TEST_ARTIFACTS` permite escolher a pasta das capturas.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.js` | Consultas nos setores, perfil e ciclo de tempo |
| `src/ui.js` | Ícones, retratos e formatação da interface |
| `src/office.js` | Escritório em Canvas 2D, personagem, câmera, caminhos e colisões |
| `src/simulation.js` | Regras econômicas, projetos, ações e salvamento versionado |
| `src/style.css` | Aparência, consultas, diálogos e layout responsivo |
| `tests/` | Testes de regras e jornadas no navegador |
| `scripts/export.mjs` | Gera uma página única para distribuição e GitHub Pages |
| `docs/` | Compilação pronta para GitHub Pages |

O jogo roda inteiramente no navegador. Não precisa de banco de dados, API externa ou credenciais. Vite é a única dependência de desenvolvimento; as versões estão fixadas no lockfile.
