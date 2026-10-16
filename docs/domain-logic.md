# Lógica de domínio

Regras de negócio do Horas PJ e onde cada uma está implementada. Antes de criar uma regra nova, confira se ela já existe num dos arquivos citados — cada regra tem **uma única implementação** por lado (backend/frontend).

## Entidades

Todas têm `id` (UUID, usado também como `_id` no Mongo) e `tenantId` (UUID do usuário logado, da coleção `usuarios`; até a M13 era o e-mail). Datas de negócio são `YYYY-MM-DD`, horas são `HH:MM`, datas de auditoria (`dataCriacao`, `dataAtualizacao`) são ISO 8601.

| Entidade | Coleção | Campos principais |
|---|---|---|
| `Cliente` | `clientes` | `nome`, `observacoes?` |
| `Projeto` | `projetos` | `clienteId`, `nome`, `status`, `dataInicio`, `dataFim?`, `horasContratadas?`, `valorHora?`, `consideradoPago?` |
| `AlteracaoEscopo` | `alteracoesEscopo` | `projetoId`, `titulo`, `horasAdicionais?`, `status` (`Pendente`/`Aprovada`/`Cancelada`), período próprio |
| `Pagamento` | `pagamentos` | `projetoId`, `horasCobertas`, `valor?`, `dataPagamento`, `periodoApuracaoInicio/Fim`, `numeroNF?`, `geradoPorRegularizacao?` |
| `LancamentoHoras` | `lancamentosHoras` | `projetoId`, `escopoId?`, `data`, `horaInicio`, `horaFim?`, `totalHHMM`, `totalDecimal`, `descricao`, `tipo` |
| `PreferenciasProjeto` | `preferenciasProjeto` | `projetoId`, `ultimaDescricaoLancamento?`, `ultimoEscopoLancamento?` |

Tipos completos: `backend/src/types/index.ts` (espelhados em `frontend/src/types/index.ts`).

Status de projeto: `Aguardando início`, `Em desenvolvimento`, `Com impedimento`, `Em testes`, `Entregue`, `Finalizado`, `Cancelado` (cores e rótulos em `frontend/src/constants/statusProjeto.ts`).

## Horas contratadas, escopos e saldo

- `horasContratadas` ausente = **horas abertas**: projeto sem limite (sustentação, banco de horas). É estado válido, não erro — não há barra de progresso, saldo nem alerta.
- Só escopos `Aprovada` com `horasAdicionais` somam ao total disponível. `Pendente` e `Cancelada` são ignorados; escopo sem `horasAdicionais` é de **horas livres** (registra trabalho sem aumentar o limite).

```
totalDisponivel = horasContratadas + Σ horasAdicionais (escopos aprovados)
saldo           = totalDisponivel − totalTrabalhado
percentual      = totalTrabalhado / totalDisponivel × 100      (alerta no dashboard a partir de 80%)
```

Cálculo em `projetosService.calcularResumo`.

## Faturabilidade e pagamentos — `backend/src/utils/faturamento.ts`

A nota fiscal é emitida pelo total de horas de um **período de apuração** (dia 16 a dia 15 — `periodoApuracao` em `utils/tempo.ts`), então um projeto pode ter vários pagamentos parciais.

- **Status de pagamento do projeto:** `Pago` se `consideradoPago` ou se `Σ horasCobertas ≥ horas trabalhadas`; `Parcial` se cobre parte; `Não pago` se não há pagamento.
- **Lançamento faturável:** os pagamentos cobrem as horas em ordem **FIFO** (as mais antigas primeiro). Um lançamento é faturável enquanto o acumulado até ele ultrapassa as horas cobertas. Em projeto `Finalizado`/`Cancelado` ou `consideradoPago`, nada é faturável.
- O backend devolve o campo `faturavel` em cada lançamento (`lancamentosService.listarPorProjeto`); dashboard e relatórios consomem esse campo — **o frontend nunca reimplementa a regra**.

### Regularização (`consideradoPago`)

Para projetos históricos sem os pagamentos registrados. Marcar a opção (`PUT /api/projetos/:id`) gera um pagamento cobrindo o saldo em aberto, com período do primeiro ao último lançamento (`gerarPagamentoDeRegularizacao` em `projetosService`). Desmarcar remove só os pagamentos com `geradoPorRegularizacao: true`; os registrados à mão ficam.

## Controle de ponto

- **Um lançamento em andamento por usuário** (não por projeto). Iniciar outro projeto com um aberto abre o modal de finalização; ao confirmar, encerra o anterior e inicia o novo.
- Descrição obrigatória. A última descrição e o último escopo de cada projeto ficam em `PreferenciasProjeto` e são pré-carregados no próximo lançamento (o escopo só é reaproveitado se ainda estiver `Aprovada`).
- `horaFim` menor que `horaInicio` = virada da meia-noite; o lançamento pertence ao dia em que começou.
- Um lançamento em andamento não pode começar no futuro.
- Totais (`HH:MM` e decimal) são sempre calculados pelo backend (`calcularDiferenca` em `utils/tempo.ts`): `01:15 = 1,25`, `01:30 = 1,50`, `01:45 = 1,75`.
- O servidor fixa `TZ=America/Sao_Paulo` para que "hoje" e "agora" não dependam do fuso da hospedagem.

## Importação de planilha — `backend/src/services/importacaoService.ts`

- Texto colado do Excel/Google Sheets, colunas separadas por TAB: `Data | Descrição | Hora início | Hora fim | HH:MM | Decimal`.
- Data sem ano → o usuário informa o ano de referência.
- O total é recalculado; divergência acima de `0,02` vira **aviso**. Data/hora inválida, colunas insuficientes ou **descrição vazia** viram **erro** (linha ignorada). A descrição é obrigatória como no lançamento manual. O confirmar também descarta linha sem descrição, mesmo que o cliente tenha alterado o status. Linhas válidas e com aviso são importadas com `tipo: "Importado"`.

## Exclusões

- Cliente com projetos vinculados não pode ser excluído.
- Excluir projeto remove escopos, lançamentos, pagamentos e preferências numa transação (`withTransaction` em `mongoClient.ts`).
- O `escopoId` de um lançamento precisa ser de um escopo do **mesmo tenant e do mesmo projeto** (`validarEscopo` em `lancamentosService`).

## Multi-tenant

Toda leitura e escrita é filtrada por `tenantId`. A checagem de posse é centralizada em `backend/src/repositories/mongoRepository.ts` (`findAllByTenant`, `findByIdAndTenant`, `updateForTenant`, `deleteForTenant`, `existsForTenant`) — inclusive para validar referências entre entidades (o `clienteId` de um projeto precisa existir **no mesmo tenant**).

`findAll`/`findBy`/`findOneBy` buscam a coleção inteira e filtram em JavaScript (predicados arbitrários não viram query nativa). Os métodos `*ByTenant`/`*ForTenant`, que são o caminho principal, usam query nativa com índice. Trade-off documentado no topo de `mongoRepository.ts`.
