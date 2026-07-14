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

## Onde estão as regras de negócio (não duplicar)

- **Faturabilidade** (projeto e lançamento): `backend/src/utils/faturamento.ts` é a única fonte. O campo `faturavel` em `LancamentoHoras` é computado por `lancamentosService.listarPorProjeto` e devolvido pela API — o frontend consome esse campo (`Relatorios.tsx`), nunca reimplementa a regra.
- **Cálculos de tempo** (hora atual, tempo decorrido, soma de horas): `backend/src/utils/tempo.ts` e, no frontend, `frontend/src/utils/tempo.ts`. São dois arquivos (backend/frontend não compartilham runtime), mas dentro de cada lado é a única implementação.
- **Cores/labels de status de projeto**: `frontend/src/constants/statusProjeto.ts`.
- Antes de adicionar uma regra de cálculo/validação nova, verifique se ela já existe em um desses arquivos.

## Dados sensíveis

`backend/src/data/*.json` (sem sufixo `.example`) contêm dados **reais** de clientes, projetos e faturamento do usuário — são ignorados pelo git (ver `.gitignore`). Nunca:
- reproduza o conteúdo desses arquivos em respostas, commits ou documentação;
- remova o `.gitignore` que os protege;
- use-os como fonte de exemplo em docs (use os `*.example.json` para isso).

## Dívida técnica conhecida

- Um projeto real (`projetos.json`) tem `status: "Pausado"` — valor legado que não existe mais no tipo `StatusProjeto` atual. Não normaliza sozinho porque a chave não é "encerrado"; se for tocar em migração de dados, considerar isso.
- A camada `repositories/` é **síncrona** (`findAll(): T[]`). Antes da migração para MongoDB, ela precisa virar `Promise`-based — ver plano de refatoração abaixo.
- CORS fixo para `http://localhost:5173` em `backend/src/server.ts` — não é configurável ainda.
- "Um lançamento em andamento por vez" é uma regra **global**, não por usuário — só deixa de ser problema depois do multi-tenant.

## Estado da refatoração em andamento

Este projeto está passando por uma sequência de melhorias arquiteturais (rodadas uma por vez, cada uma commitada e aprovada antes da próxima):

1. ✅ `.gitignore` + dados de exemplo
2. ✅ Correção dos erros de build TypeScript
3. ✅ Unificação da regra de "faturável" + remoção do campo morto `AlteracaoEscopo.faturavel`
4. ✅ Remoção de duplicação de `STATUS_COR` e helpers de hora no frontend
5. ✅ Esta consolidação de documentação + este arquivo
6. ⬜ Conversão de `repositories`/`services` para `async/await` (preparação para Mongo)
7. ⬜ Login com Google (OAuth)
8. ⬜ Isolamento multi-tenant (`tenantId` em todas as entidades)
9. ⬜ Migração de JSON para MongoDB

Se for continuar esse trabalho, comece pelo próximo item não marcado — os anteriores já mudaram comportamento (ex.: a regra de faturável não é mais a mesma do README antigo).
