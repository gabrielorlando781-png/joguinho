# devhouse.

Uma primeira versão jogável da simulação de software house: você sai da CLT, abre uma empresa com R$ 20.000 e precisa transformar suas oito horas diárias em clientes, entregas e caixa.

## Acessar pelo GitHub

O código está neste repositório. A versão pronta para o navegador fica em `docs/index.html`, com código, estilos e imagens embutidos. Você pode baixar esse arquivo pelo GitHub e abri-lo no Chrome ou Edge, sem instalar dependências.

Para publicar um endereço jogável, abra **Settings → Pages**, escolha **Deploy from a branch**, selecione a branch **main** e a pasta **/docs**, e salve. Depois que o GitHub concluir a publicação, o endereço será `https://gabrielorlando781-png.github.io/joguinho/`.

`npm run build` atualiza tanto `dist/` quanto `docs/`. Envie a pasta `docs/` junto com mudanças no código para atualizar a versão publicada.

## Executar

Requisitos: Node.js 20.19+ ou 22.12+, npm e um navegador moderno. O ambiente na nuvem foi validado com Node.js 24.

```sh
git clone https://github.com/gabrielorlando781-png/joguinho.git
cd joguinho
npm ci
npm run dev -- --port 5173 --strictPort
```

O servidor atende na porta 5173. O comando `npm run build` gera a versão estática em `dist/`; `npm run preview -- --port 4173 --strictPort` serve essa compilação para validação.

## Jogar

1. Escolha nome, empresa, idade, ponto forte e cor do personagem.
2. Explore o escritório com **WASD**, **setas** ou um **clique/toque no chão**. Pressione **E** perto de um objeto; clicar em uma estação também caminha até ela e interage.
3. Abra **Projetos**, escolha uma oportunidade e feche um contrato. Não há pagamento antecipado.
4. Distribua as **8 horas** entre vendas, desenvolvimento e qualidade. Os controles sempre preservam esse orçamento.
5. Trabalhe no computador, tome café ou descanse. Trabalho manual usa as horas já alocadas, sem duplicar a capacidade do dia.
6. Use **play**, as velocidades **1×, 2× e 4×**, ou **Encerrar o dia**. Um dia dura dois minutos em 1×; o resumo pausa o tempo para as próximas decisões.
7. Entregue, aguarde o pagamento, contrate e melhore o escritório. Comprar mobília muda o cenário e seus efeitos de produção.

As estações são computador, café, quadro de projetos, financeiro e descanso. A personagem se move com colisões e encontra caminhos em volta dos móveis. Contratações aparecem nas mesas; a expansão reposiciona o personagem se um móvel ocupar seu lugar.

## Conceitos presentes

- **Vender × entregar:** prospecção gera oportunidades e consome parte do tempo do fundador.
- **Velocidade × qualidade:** os modos rápido, padrão e caprichado mudam produtividade, dívida técnica e qualidade. Atrasos e entregas ruins reduzem pagamento e reputação.
- **Pessoas × caixa:** funcionários aumentam a capacidade de entrega; contratos PJ custam 1,15× o salário e CLT, 1,7×. A folha é contabilizada por dia útil, com salário dividido por 20.
- **Caixa × faturamento:** nesta versão, os pagamentos chegam três dias corridos depois da entrega. Custos fixos são R$ 110 por dia, incluindo fins de semana. Sábados e domingos são pulados pela interface, com recuperação de energia e contabilização de custos/recebimentos.
- **Reserva × crise:** caixa negativo é recuperável. A empresa encerra as atividades apenas após 60 dias consecutivos no vermelho. O financeiro permite começar uma nova história, com confirmação.
- **Serviço × produto:** a tela de produto apresenta o caminho ideia → MVP → lançamento → crescimento. A construção de SaaS fica para uma próxima versão; ainda não é uma mecânica jogável.

O progresso é salvo automaticamente no `localStorage` do navegador. Recarregar restaura empresa, perfil, equipe, projetos, mobília e financeiro com o tempo pausado. Limpar os dados do navegador apaga esse progresso; ainda não há conta, sincronização entre dispositivos ou salvamento no servidor.

Esta versão usa contratos pequenos, contratação imediata e parâmetros econômicos simplificados para testar o ciclo central. Entrevistas, negociação detalhada, escopos ocultos, montagem livre no grid, eventos complexos, expansão de estágios, produto SaaS e fechamento mensal completo são próximos capítulos.

## Verificação

```sh
npm test
npm run build
npm run test:browser
```

A suíte Node cobre 21 cenários de negócio e persistência. O teste de navegador usa Python Playwright e Chromium, já disponíveis nesta imagem de nuvem. Ele sobe um servidor de teste separado na porta 5199, utiliza contextos isolados e verifica cadastro, movimentos, interações, entrega, pagamento, folha, compras, salvamento, tempo e layout móvel. Encerra apenas o servidor que iniciou. `GAME_TEST_ARTIFACTS` permite escolher a pasta das capturas.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.js` | Interface em português, perfil, navegação e ciclo de tempo |
| `src/office.js` | Escritório em Canvas 2D, personagem, caminhos e colisões |
| `src/simulation.js` | Regras econômicas, projetos, ações e salvamento versionado |
| `src/style.css` | Aparência, diálogos e layout responsivo |
| `tests/` | Testes de regras e jornadas reais no navegador |
| `scripts/export.mjs` | Gera uma página única para distribuição e GitHub Pages |
| `docs/` | Build pronto para publicar pelo GitHub Pages |

O jogo roda inteiramente no navegador. Não precisa de banco de dados, API externa ou credenciais. Vite é a única dependência de desenvolvimento; as versões estão fixadas no lockfile.
