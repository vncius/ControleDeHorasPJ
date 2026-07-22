# Horas PJ — contexto para Claude Code

Sistema de controle de horas para trabalho PJ/freelancer (controle de ponto, projetos, escopos, faturamento). Documentação completa em [README.md](../README.md) — este arquivo cobre apenas o que um agente de código precisa saber antes de mexer no repositório.

## Comandos

```bash
cd backend  && npm run dev    # :3001
cd frontend && npm run dev    # :5173 (proxy /api -> :3001)
```

Antes de considerar qualquer tarefa concluída, rode em cada pacote:
```bash
npx tsc --noEmit   # backend e frontend têm builds separados, tipos não compartilhados
npm run build      # build de produção real (já pegou bugs que o dev server não pega)
```

## Convenções do domínio

- Nomes de entidades e campos são em **português** (`Cliente`, `Projeto`, `AlteracaoEscopo`/"escopo", `LancamentoHoras`, `pago`, `faturavel`, `horasAbertas`, `dataPagamento`) — não traduza para inglês.
- Datas de projeto/lançamento: string `YYYY-MM-DD`. Datas de auditoria (`dataCriacao` etc.): ISO 8601 completo. Horas: string `HH:MM`.
- `horasContratadas` ausente = "horas abertas" (projeto sem limite contratado) — é um estado de negócio válido, não um bug.
- `tenantId` (= e-mail do usuário autenticado) existe em toda entidade persistida. Nunca aceite `tenantId` vindo do corpo da requisição/query string — sempre de `req.usuario.email` (preenchido pelo `requireAuth`).

## Onde estão as regras de negócio (não duplicar)

- **Faturabilidade** (projeto e lançamento): `backend/src/utils/faturamento.ts` é a única fonte. O campo `faturavel` em `LancamentoHoras` é computado por `lancamentosService.listarPorProjeto` e devolvido pela API — o frontend consome esse campo (`Relatorios.tsx`), nunca reimplementa a regra.
- **Cálculos de tempo** (hora atual, tempo decorrido, soma de horas): `backend/src/utils/tempo.ts` e, no frontend, `frontend/src/utils/tempo.ts`. São dois arquivos (backend/frontend não compartilham runtime), mas dentro de cada lado é a única implementação.
- **Cores/labels de status de projeto**: `frontend/src/constants/statusProjeto.ts`.
- **Checagem de posse por tenant**: centralizada em `backend/src/repositories/mongoRepository.ts` (`findAllByTenant`, `findByIdAndTenant`, `updateForTenant`, `deleteForTenant`, `existsForTenant`). Nunca reimplemente `item.tenantId === tenantId` manualmente num service — use esses métodos, inclusive para validar referências entre entidades (ex.: `clienteId` de um `Projeto` precisa existir *no mesmo tenant*, não só existir).
- Antes de adicionar uma regra de cálculo/validação nova, verifique se ela já existe em um desses arquivos.

## Dados sensíveis

Os dados **reais** de clientes, projetos e faturamento do usuário vivem hoje no **MongoDB Atlas** (banco `horas-pj`, connection string em `backend/.env`, gitignored). `backend/src/data/*.json` (sem sufixo `.example`) deixaram de ser lidos/escritos pela aplicação e viram **backup histórico** do estado anterior à migração — continuam no disco e ignorados pelo git (ver `.gitignore`). Nunca:
- reproduza o conteúdo real desses dados (JSON ou Mongo) em respostas, commits ou documentação;
- remova o `.gitignore` que protege `backend/.env` e `backend/src/data/*.json`;
- use os JSON reais como fonte de exemplo em docs (use os `*.example.json` para isso);
- commit a `MONGODB_URI` real fora de `backend/.env`.

## Dívida técnica conhecida

- Um projeto real (banco Mongo) tem `status: "Pausado"` — valor legado que não existe mais no tipo `StatusProjeto` atual. Não normaliza sozinho porque a chave não é "encerrado"; se for tocar em migração de dados, considerar isso.
- Sessão sem refresh/rotação: o cookie JWT dura 7 dias fixos, sem renovação automática nem revogação individual.
- Acesso não usa allowlist própria — qualquer login Google com `email_verified` é aceito e vira tenant. Quem pode logar de fato é controlado no Google Cloud Console (OAuth consent screen: test users em modo "Testing", ou restrição de domínio em modo "Internal").
- `findAll`/`findBy`/`findOneBy` em `mongoRepository.ts` fazem fetch completo da coleção (predicado em JS, não query nativa) — trade-off consciente documentado no topo do arquivo e no README.

## Estado da refatoração em andamento

A sequência de 9 melhorias arquiteturais planejadas foi **concluída**:

1. ✅ `.gitignore` + dados de exemplo
2. ✅ Correção dos erros de build TypeScript
3. ✅ Unificação da regra de "faturável" + remoção do campo morto `AlteracaoEscopo.faturavel`
4. ✅ Remoção de duplicação de `STATUS_COR` e helpers de hora no frontend
5. ✅ Consolidação de documentação + este arquivo
6. ✅ Conversão de `repositories`/`services` para `async/await` (preparação para Mongo)
7. ✅ Login com Google (OAuth); controle de quem pode logar delegado ao Google Cloud Console
8. ✅ Isolamento multi-tenant (`tenantId` em todas as entidades, checagem centralizada no repository)
9. ✅ Migração de JSON para MongoDB Atlas (`mongoRepository.ts`/`mongoClient.ts`, banco `horas-pj`), incluindo exclusão em cascata de projeto transacional (`withTransaction`)

Não há próximo item planejado nesta sequência. Se for continuar evoluindo a arquitetura, avalie a dívida técnica conhecida acima (fetch completo em `findBy`/`findOneBy`) como candidato natural.
