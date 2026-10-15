# Plano: Padrão comercial (camadas, segurança, usabilidade)

> Plano de execução incremental. Cada entrega (M0, M1, …) é fechada: compila, passa nos testes, mantém a aplicação funcional e pode ser commitada sozinha.
> **Este arquivo é a fonte de verdade do andamento.** Qualquer sessão (humana ou IA) deve conseguir continuar o trabalho lendo só este documento + o código.

---

## Como continuar (protocolo para cada sessão)

1. Leia este arquivo inteiro — principalmente **Decisões** e **Status**.
2. Escolha a **primeira entrega ⬜ cujas dependências estão todas ✅** (ou a que o usuário pedir).
3. Mude o status dela para 🟡 antes de começar.
4. Implemente seguindo o **Escopo** (os arquivos citados são ponto de partida, confirme no código).
5. Valide com a **Definição de pronto**.
6. Ao concluir: status → ✅ com data e commit; registre descobertas em **Notas de implementação**; entrada no `CHANGELOG.md` (`[Unreleased]`); **um commit por entrega**. Não fazer push sem o usuário pedir.
7. Decisão de produto nova (ou marcada como *a confirmar*) → perguntar ao usuário e registrar em **Decisões**.

### Definição de pronto

- [ ] `cd backend && npx tsc --noEmit && npm test && npm run build` verde.
- [ ] Se tocou no frontend: `cd frontend && npx tsc --noEmit && npm run build` verde; textos novos nos três idiomas (`frontend/src/i18n/{pt,en,es}.ts`).
- [ ] Variável de ambiente nova documentada em `backend/.env.example` e no `README.md`.
- [ ] Nenhum fluxo existente quebrado: login Google, controle de ponto (iniciar/trocar/finalizar), importação, pagamentos/regularização, relatórios (CSV/PDF), proxy `/api` do Cloudflare.
- [ ] Regras do `.claude/CLAUDE.md` respeitadas (fonte única de regras, checagem de tenant só via `*ForTenant`, nada de dado real em docs/commits).

---

## Objetivo

Trazer para o Horas PJ as diretrizes já aplicadas no projeto **Gestão Financeira** (`D:\ProjetosProprios\GestaoFinanceiraDev`) — camadas bem definidas, validação e erros padronizados, segurança de borda, testes/CI, LGPD e documentação de portfólio — **sem copiar a complexidade que não se paga aqui** (ver D1). Origem: comparação dos dois projetos feita em 2026-10-15.

---

## Decisões

### D1 — Simplicidade: manter a estrutura atual
Continua `routes → controllers → services → repositories`, nomes em português. **Não** importar da referência: container de DI, módulos por domínio, TanStack Query, criptografia de campos, camada de IA. Peças novas entram em pastas planas: `backend/src/errors/`, `backend/src/schemas/`, `backend/src/middleware/`, `backend/src/migrations/`, `backend/src/scripts/`.

### D2 — Validação na borda com Zod
Um schema por DTO em `backend/src/schemas/<entidade>.ts`, `.strict()` (rejeita campo desconhecido — inclusive `tenantId` e `geradoPorRegularizacao`). O tipo do DTO passa a ser `z.infer<typeof schema>`, eliminando a duplicação em `types/index.ts`. Regras de negócio (faturabilidade, saldo, posse por tenant) continuam nos services/utils — o schema só garante **formato**.

### D3 — Erros com código traduzível
`AppError(status, codigo, mensagem?)` + `errorHandler` único: `ZodError → 400 validacao.*`, `AppError → status próprio`, JSON inválido → 400, corpo grande → 413, resto → 500 genérico (detalhe só no log). O frontend traduz `codigo` via i18n; mensagem do Mongo nunca chega ao cliente.

### D4 — CSRF sem quebrar o iPhone
Produção já usa o proxy same-origin (`frontend/functions/api/[[path]].ts`), então o cookie vira `SameSite=Lax` (configurável por `COOKIE_SAME_SITE`). Toda requisição que altera estado exige `X-Requested-With: XMLHttpRequest`.

### D5 — Limites
Em memória (processo único, sem dependência nova). Por IP: login 20/min, geral 600/min. Por tenant: importação 10 a cada 10 min. Corpo JSON 100 KB por padrão, 2 MB na importação.

### D6 — Sessão e identidade — *a confirmar com o usuário*
Proposta: coleção `usuarios` com `tenantId` gerado (UUID) e `googleSub`; sessão de 24h com `versaoSessao` (revogação + "sair de todos os dispositivos"). Exige migração de todos os documentos (`tenantId` = e-mail → UUID).

### D7 — LGPD — *a confirmar com o usuário*
Proposta: termos/política com aceite versionado no primeiro acesso, exportação completa dos dados (JSON) e exclusão da conta. Relevante porque já existem usuários além do dono (test users do OAuth).

---

## Entregas

### M0 — Documentação de portfólio + dados de demonstração
- `backend/src/scripts/seed-demo.ts` (`npm run seed:demo`): recusa banco sem `demo` no nome; apaga e recria um tenant fictício com clientes, projetos (horas contratadas e abertas), escopos, lançamentos de ~3 meses, pagamentos e um lançamento em andamento. Idempotente.
- `.claude/launch.json`: configuração `backend-demo` (banco `horas-pj-demo`).
- Prints em `docs/screenshots/` (desktop claro/escuro e celular), só com dados do seed.
- `README.md` reescrito para portfólio (print no topo, galeria, funcionalidades, decisões técnicas, stack, como rodar). Conteúdo técnico detalhado movido para `docs/api.md` e `docs/domain-logic.md`. `CHANGELOG.md` criado.
- **Aceite:** README renderiza no GitHub com as imagens; nenhuma imagem/doc mostra dado real (inclusive e-mail do dono); seed roda duas vezes sem duplicar.

### M1 — Bugs de isolamento e cascata
- `lancamentosService.criar/atualizar/finalizarTrabalho`: validar `escopoId` com `escoposRepo.findByIdAndTenant` **e** `escopo.projetoId === lancamento.projetoId`.
- `projetosService.excluir`: incluir `preferenciasProjeto` (e conferir `pagamentos`) na transação.
- Teste cobrindo os dois casos.

### M2 — Segredos validados no boot
`JWT_SECRET` e `GOOGLE_CLIENT_ID` obrigatórios; em produção `JWT_SECRET` ≥ 32 bytes e diferente do valor do `.env.example`. Servidor não sobe se falhar.

### M3 — CSRF (D4)
`middleware/csrf.ts` + `OPCOES_COOKIE_SESSAO` com `COOKIE_SAME_SITE` (default `lax`); `frontend/src/services/api.ts` envia o cabeçalho.

### M4 — Cabeçalhos de segurança
Backend: `helmet` (API só JSON; CSP `default-src 'none'`), `x-powered-by` desligado. Frontend: `frontend/public/_headers` (CSP liberando o próprio domínio, Google Identity Services e Google Fonts; HSTS; `X-Frame-Options: DENY`; `Referrer-Policy`; `Permissions-Policy`).

### M5 — Rate limit e limite de corpo (D5)
`middleware/rateLimit.ts` (janela fixa em memória) e `express.json({ limit })` por rota.

### M6 — `app.ts` separado de `server.ts` + log de requisições
`app.ts` monta o Express (testável com supertest sem subir banco); `server.ts` conecta o Mongo e dá `listen`. Logger de requisição: método, `req.path` (sem query string), status, duração — sem corpo nem e-mail.

### M7 — Erros padronizados (D3) + cliente HTTP robusto
`errors/AppError.ts`, `middleware/errorHandler.ts`, `utils/asyncHandler.ts`; remover o `handle()` de `controllers/index.ts`; services lançam `AppError` (404 para não encontrado, 409 para conflito). Frontend: `api.ts` checa `res.ok` antes de `res.json()`, trata resposta não-JSON (502/429), redireciona para `/login` em 401 e traduz `codigo`.
**Depende:** M6.

### M8 — Validação com Zod (D2)
Schemas para clientes, projetos, escopos (status em enum), pagamentos (sem `geradoPorRegularizacao`), lançamentos (data `YYYY-MM-DD`, hora `HH:MM`, descrição obrigatória) e importação (revalidar cada linha, máximo de linhas). Middleware que rejeita chaves `$…`/`__proto__` como rede de proteção.
**Depende:** M7.

### M9 — Testes + CI
Testes (Vitest + supertest): `utils/faturamento.ts`, parser de importação, `*ForTenant` (isolamento entre dois tenants, banco `-test`), defesas HTTP (CSRF, limites, 401, 413, schema). `.github/workflows/ci.yml` (typecheck, test, build, `npm audit --omit=dev`), `.github/dependabot.yml`, Gitleaks.
**Depende:** M1–M8 (os testes HTTP cobrem o que elas criarem).

### M10 — Migrações idempotentes no boot
`migrations/` executadas em `server.ts` após conectar; primeira: normalizar `status: "Pausado"` legado (valor alvo *a confirmar*: provavelmente `Com impedimento`).

### M11 — Exportações e i18n
CSV com campos entre aspas, escape de `"` e neutralização de fórmula (`= + - @`). `en.ts`/`es.ts` tipados contra `pt.ts` (chave faltando = erro de compilação). Datas/números dos relatórios e cabeçalho do CSV pelo idioma ativo.

### M12 — Acessibilidade
Componente `Modal` único (`role="dialog"`, `aria-modal`, Esc fecha, foco preso e devolvido) substituindo os modais inline; toasts com `aria-live="polite"`.

### M13 — Identidade e sessão (D6)
Coleção `usuarios`, migração de `tenantId`, sessão 24h com `versaoSessao`, `POST /auth/logout-todos`.
**Depende:** M10, decisão D6.

### M14 — Auditoria
Coleção `auditoria`: login, logout, exclusões e regularização de pagamento — quem, quando, IP, rota; nunca o corpo.
**Depende:** M6, M13.

### M15 — LGPD (D7)
Termos/política com aceite versionado; "Meus dados": exportar tudo (JSON) e excluir conta (dados + usuário + anonimiza auditoria).
**Depende:** M13, M14, decisão D7.

### M16 — Documentação de deploy e ADRs
`docs/deploy.md` (Render + Cloudflare Pages + Atlas, variáveis por ambiente), `docs/adr/` com as decisões já tomadas (Mongo sem ODM, `findBy` em memória, tenant por e-mail, proxy same-origin).

---

## Status

| # | Entrega | Depende | Esforço | Status | Concluída em | Commit |
|---|---|---|---|---|---|---|
| M0 | Documentação de portfólio + dados de demonstração | — | M | ✅ | 2026-10-15 | cb8095e |
| M1 | Bugs de isolamento (`escopoId`) e cascata (preferências) | — | P | ✅ | 2026-10-15 | cdca188 |
| M2 | Segredos validados no boot | — | P | ✅ | 2026-10-15 | 9b3bd04 |
| M3 | CSRF (SameSite=Lax + cabeçalho) | — | P | ✅ | 2026-10-15 | (este commit) |
| M4 | Cabeçalhos de segurança (helmet + `_headers`) | — | P | ⬜ | | |
| M5 | Rate limit e limite de corpo | — | P | ⬜ | | |
| M6 | `app.ts`/`server.ts` + log de requisições | — | P | ⬜ | | |
| M7 | Erros padronizados + cliente HTTP robusto | M6 | M | ⬜ | | |
| M8 | Validação com Zod | M7 | M | ⬜ | | |
| M9 | Testes + CI | M1–M8 | M | ⬜ | | |
| M10 | Migrações idempotentes no boot | — | P | ⬜ | | |
| M11 | CSV seguro + i18n tipado | — | P | ⬜ | | |
| M12 | Acessibilidade de modais e toasts | — | M | ⬜ | | |
| M13 | Identidade (`usuarios`) e sessão revogável | M10, D6 | M | ⬜ | | |
| M14 | Auditoria | M6, M13 | M | ⬜ | | |
| M15 | LGPD | M13, M14, D7 | G | ⬜ | | |
| M16 | Deploy e ADRs | — | P | ⬜ | | |

Ordem sugerida: M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9; depois M10–M12; M13–M15 só após decidir D6/D7.

---

## Notas de implementação

*(preencher ao concluir cada entrega)*

### M0
- `seed:demo` grava lançamentos direto via `insertMany` (o `lancamentosService.criar` faria ~4 idas ao Atlas por lançamento) e usa os services para clientes, projetos, escopos, pagamentos e a regularização.
- Prints tirados com Edge headless (puppeteer-core, script fora do repositório) e um JWT de sessão local para o tenant `demo@horaspj.dev`. Desktop 1440×900 @2x, celular 390×844 @3x.
- Neste ambiente o Node resolvia DNS por `127.0.0.1` e falhava no `querySrv` do Atlas (`ECONNREFUSED`). Contornado só no processo local com `dns.setServers`, sem mudar código.

### M1
- `validarEscopo` em `lancamentosService` é chamado em `criar`, `atualizar` e `finalizarTrabalho`: o escopo precisa existir no tenant **e** ser do mesmo projeto. `null`/vazio continua significando escopo principal. Não exige `status: Aprovada`; isso seria regra de produto nova, não correção.
- `projetosService.excluir` agora remove também `preferenciasProjeto` na transação (pagamentos já eram removidos).
- `src/services/isolamento.test.ts` usa repositórios em memória (`vi.mock`), sem banco. Os 5 casos do bug falhavam no código anterior.

### M2
- `validarAmbiente` (`backend/src/utils/ambiente.ts`, chamada `validarSegredos` até a M3) roda em `server.ts` antes de conectar no Mongo e lista todos os problemas de uma vez. Em qualquer ambiente, `JWT_SECRET` e `GOOGLE_CLIENT_ID` são obrigatórios (só espaços conta como ausente). Em produção, `JWT_SECRET` precisa de 32 bytes ou mais, e nenhum dos dois pode ser o valor do `.env.example`.
- O log de falha no boot deixou de dizer "Falha ao conectar no MongoDB" para qualquer erro: agora é "Falha ao iniciar o servidor" com a mensagem.
- **Ação de deploy:** confirmar que o `JWT_SECRET` do Render tem 32 bytes ou mais antes de publicar, senão o backend não sobe. Trocar o segredo derruba as sessões abertas.

### M3
- `middleware/csrf.ts` (`exigirCabecalhoCsrf`) é montado em `/api` antes das rotas e vale também para `/auth/google` e `/auth/logout`. Métodos que não sejam GET, HEAD ou OPTIONS sem `X-Requested-With: XMLHttpRequest` recebem 403.
- O cookie passou a ser `SameSite=Lax` por padrão, inclusive em produção (antes era `none`), e é configurável por `COOKIE_SAME_SITE` (`lax`, `strict` ou `none`, validado no boot). `none` força `secure`. As opções vêm de `opcoesCookieSessao(env)`, que é testável.
- O frontend envia o cabeçalho em todas as chamadas (`CABECALHOS` em `frontend/src/services/api.ts`). O proxy do Cloudflare repassa os cabeçalhos da requisição, e o preflight CORS libera `x-requested-with` só para `CORS_ORIGIN`.
- Verificado com o backend de demo:
  - POST com sessão e sem o cabeçalho recebe 403;
  - um POST de formulário com Origin de terceiro em `/auth/logout` recebe 403;
  - o `Set-Cookie` sai com `SameSite=Lax`;
  - criar e excluir cliente pela interface retornam 201 e 200.
- **Ação de deploy:** confirmar que o Cloudflare Pages **não** define `VITE_API_URL` apontando para o Render, ou seja, que o frontend usa o proxy same-origin `/api`. Se usar o Render direto (cross-site), defina `COOKIE_SAME_SITE=none` no Render, senão o login para de funcionar. A proteção por cabeçalho vale nos dois cenários.
