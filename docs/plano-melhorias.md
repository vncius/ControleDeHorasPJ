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

### D8 — Descrição em linha importada — *a confirmar com o usuário*
Hoje a importação aceita linha sem descrição (status "aviso") e grava o lançamento com descrição vazia, enquanto o lançamento manual e o controle de ponto exigem descrição. Opções: (a) manter, já que a planilha antiga pode não ter descrição; (b) virar "erro" no preview, e a linha não é importada; (c) exigir que o usuário preencha antes de confirmar. A M8 manteve o comportamento atual.

### D3 — Erros com código traduzível
`AppError(status, codigo, mensagem?)` + `errorHandler` único: `ZodError → 400 validacao.*`, `AppError → status próprio`, JSON inválido → 400, corpo grande → 413, resto → 500 genérico (detalhe só no log). O frontend traduz `codigo` via i18n; mensagem do Mongo nunca chega ao cliente.

### D4 — CSRF sem quebrar o iPhone
Produção já usa o proxy same-origin (`frontend/functions/api/[[path]].ts`), então o cookie vira `SameSite=Lax` (configurável por `COOKIE_SAME_SITE`). Toda requisição que altera estado exige `X-Requested-With: XMLHttpRequest`.

### D5 — Limites
Em memória (processo único, sem dependência nova). Por IP: login 20/min, geral 600/min. Por tenant: importação 30 a cada 10 min (pré-visualizar e confirmar contam as duas). Corpo JSON 100 KB por padrão, 2 MB na importação.

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
| M3 | CSRF (SameSite=Lax + cabeçalho) | — | P | ✅ | 2026-10-15 | e659629 |
| M4 | Cabeçalhos de segurança (helmet + `_headers`) | — | P | ✅ | 2026-10-15 | 6e1e205 |
| M5 | Rate limit e limite de corpo | — | P | ✅ | 2026-10-15 | f892005 |
| M6 | `app.ts`/`server.ts` + log de requisições | — | P | ✅ | 2026-10-15 | fdba622 |
| M7 | Erros padronizados + cliente HTTP robusto | M6 | M | ✅ | 2026-10-15 | 5ae84e5 |
| M8 | Validação com Zod | M7 | M | ✅ | 2026-10-15 | (este commit) |
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

### M4
- Backend: `helmet` 8 em `server.ts` antes do CORS, com CSP `default-src 'none'; frame-ancestors 'none'` (a API só devolve JSON), `X-Frame-Options: DENY` e os padrões do helmet (HSTS, nosniff). `X-Powered-By` saiu das respostas.
- Frontend: `public/_headers` (Cloudflare Pages) com CSP para o próprio domínio, o Google Identity Services e o Google Fonts, mais HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e COOP `same-origin-allow-popups` (popup do login Google).
- O script inline anti-flash de tema do `index.html` virou `public/tema-inicial.js`, para a CSP não precisar de `'unsafe-inline'` em `script-src`. `style-src` mantém `'unsafe-inline'` porque o GIS injeta estilos.
- `vite preview` (porta 4173, configuração `frontend-preview` do `launch.json`) aplica o `_headers` e faz proxy de `/api` como o Cloudflare, para testar a CSP localmente: `VITE_API_URL= npm run build`.
- Verificado no preview com o backend de demo: login (script e iframe do Google, fontes, tema), dashboard, projetos e relatórios sem nenhuma violação de CSP no console. A exportação de PDF não foi exercitada (geraria download).
- **Ação de deploy (mesma da M3):** a CSP tem `connect-src 'self'`. Se o Cloudflare Pages definir `VITE_API_URL` apontando para o Render, inclua essa URL em `connect-src` no `_headers`, senão todas as chamadas à API serão bloqueadas.

### M5
- `npm audit fix` no backend atualizou dependências do Express: body-parser 1.20.8 (limite de corpo ignorado com valor inválido), proxy-addr 2.0.8 (spoofing de IP via IPv6 mapeado) e qs 6.16.1.
  - Sobra, em produção, um alerta moderado do `uuid` < 11.1.1. Ele afeta só v3/v5/v6 com `buf`, e o projeto usa só `v4`; atualizar exige versão major.
  - Em dev sobram vitest, esbuild e tinypool, que também exigem `--force` e versão major. Ficam para a M9, junto do CI.
- `middleware/rateLimit.ts` (`criarLimitador`, janela fixa em memória, limpeza periódica com `unref`):
  - geral: 600/min por IP em `/api`, depois do CORS (assim o 429 leva os cabeçalhos CORS);
  - login: 20/min por IP em `/auth/google`;
  - importação: 30 a cada 10 min por tenant;
  - toda resposta 429 traz `Retry-After`.
- **Limitação conhecida:** atrás do proxy do Cloudflare, `req.ip` (com `trust proxy` 1) é o IP de saída do Cloudflare, compartilhado entre usuários. Por isso os limites por IP são folgados e o de importação é por tenant. O IP real do cliente exige o esquema `X-Client-IP` com segredo compartilhado da referência e fica como item futuro.
- `middleware/corpo.ts`: corpo de 100 KB por padrão e de 2 MB nas duas rotas de importação (o parser específico roda antes do global). `errosDeCorpo` converte 413 e JSON inválido em respostas JSON (antes saía HTML do Express).
- Verificado no servidor real: 20 logins inválidos recebem 401 e o 21º recebe 429 com `Retry-After` e `Access-Control-Allow-Origin`; um POST de 150 KB recebe 413 em JSON.

### M6
- `app.ts` exporta `criarApp(env)`, que monta o Express (middlewares, rotas e health) sem banco nem porta. `server.ts` virou só o ponto de entrada: TZ, dotenv, `validarAmbiente`, `conectarMongo` e `listen`. O `TZ` continua sendo fixado antes de qualquer `require` no JS compilado (conferido em `dist/server.js`).
- `src/app.test.ts` sobe o app numa porta efêmera, sem MongoDB, e cobre health com cabeçalhos do helmet, 401 sem sessão, 403 sem cabeçalho CSRF, cookie de logout `SameSite=Lax`/`HttpOnly`, CORS só para a origem configurada e 413. Testes que precisam do banco (services de verdade) ficam para a M9.
- `middleware/logRequisicoes.ts` gera uma linha por requisição, `[http] MÉTODO caminho status duração`, com o caminho cortado no `?`. Nunca registra corpo, cookies, cabeçalhos nem e-mail. `/health` não é registrado, e o log fica desligado com `NODE_ENV=test`.
- O `export default app` de `server.ts` saiu; nada o importava.

### M7
- `errors/AppError.ts`: `AppError(status, codigo, mensagem, params?)` e os atalhos `invalido` (400), `naoAutorizado` (401), `naoEncontrado` (404) e `conflito` (409). Os 57 `throw new Error` dos services e os 4 dos controllers viraram `AppError`, com 43 códigos no total.
  - "Não encontrado" e "falha ao atualizar" (registro sumiu entre a leitura e a escrita) viraram 404. Já em andamento, já finalizado e cliente com projetos viraram 409. O restante virou 400.
  - As mensagens perderam ids internos (antes, "Projeto não encontrado: <uuid>").
- `middleware/errorHandler.ts` é montado por último em `app.ts` e absorveu o `errosDeCorpo` da M5:
  - `AppError` responde `{ erro, codigo, params? }`;
  - erros do body-parser respondem 413 ou 400;
  - qualquer outro erro responde 500 genérico (`codigo: interno`);
  - o log do 500 registra tipo, código e stack, **sem a mensagem**, porque erros do Mongo (chave duplicada) a montam com valores dos documentos, inclusive o e-mail do tenant;
  - `rotaNaoEncontrada` responde 404 em JSON para `/api` inexistente.
- Controllers: `handle(res, next, fn, status)` repassa o erro ao `next` (antes respondia sempre 400 com `err.message`). `requireAuth`, CSRF e rate limit também passaram a mandar `codigo`.
- Frontend (`services/api.ts`):
  - `ErroApi(status, codigo, mensagem)`, com a mensagem traduzida de `erros.<codigo>` no idioma ativo (fallback: o `erro` em pt do backend; interpolação com `params`, inclusive plural);
  - só faz parse de JSON quando o `content-type` é JSON, então 502/500 de proxy viram `respostaInvalida` em vez de `SyntaxError`;
  - falha de rede vira `rede`;
  - um 401 fora de `/auth/*` chama `definirAoExpirarSessao`, que o `AuthContext` usa para limpar o usuário e levar ao `/login`.
- Traduções `erros.*` em pt/en/es. Uma verificação manual (script fora do repo) confirmou os 43 códigos nos três idiomas. Transformar isso em teste automatizado fica para a M9/M11.
- Verificado no navegador (preview com CSP e backend de demo):
  - excluir cliente com 2 projetos recebe 409, com a mensagem "Cannot delete: the client has 2 linked projects." (en, com plural);
  - apagar o cookie e navegar recebe 401 e redireciona para `/login`;
  - com o backend derrubado, o POST recebe 500 do proxy, sem JSON, e a tela mostra a mensagem de resposta inesperada, sem `SyntaxError`.

### M8
- Zod 3.25 com `backend/src/schemas/index.ts`, um schema por DTO, todos `.strict()`. Os tipos `Criar*DTO`/`Atualizar*DTO` saem de `z.infer` e `types/index.ts` só os reexporta, sem duplicação. `CriarEscopoDTO`/`CriarPagamentoDTO` acrescentam `projetoId` (vem da URL), e `geradoPorRegularizacao` só existe no tipo interno, nunca no schema.
- Validação de **formato**:
  - enums de status, tipo e status de escopo;
  - datas `YYYY-MM-DD` e horas `HH:MM` de 00:00 a 23:59 (o service aceitava `25:00`);
  - números positivos;
  - tamanhos máximos;
  - `trim` e não-vazio em nome, título e descrição do lançamento manual;
  - `null` só onde tem significado: `horasContratadas` no update, `horasAdicionais` e `escopoId`.
- As regras de **negócio** (posse, fim depois do início, saldo) continuam nos services. As checagens de formato dos services foram mantidas como defesa em profundidade, porque o `seed:demo` e futuros jobs chamam os services direto.
- `middleware/validacao.ts`:
  - `validarCorpo(schema)` nas 15 rotas com corpo; substitui `req.body` pelo resultado já com trim e coerção;
  - `bloquearChavesProibidas` (global, logo após o parser) recusa chaves `$…`, `__proto__`, `constructor` e `prototype` em qualquer nível.
- O `errorHandler` converte `ZodError` em 400 `validacao.campoInvalido` ou `validacao.campoDesconhecido` com `params.campo`, usando o primeiro problema encontrado.
- Importação:
  - preview: `texto` obrigatório (até 500 mil caracteres) e `ano` 2000–2100;
  - confirmar: até 2000 linhas, cada uma com data e horas revalidadas, porque o cliente pode ter adulterado o que o preview devolveu;
  - as checagens manuais dos controllers de importação e login saíram, e com elas 4 códigos de erro e suas traduções;
  - linha sem descrição continua sendo importada (ver D8).
- Bug de frontend encontrado no teste e corrigido (`ControlePonto.tsx`): ao trocar de projeto, o modal que finaliza o lançamento aberto em **outro** projeto oferecia os escopos do projeto da página.
  - Antes da M1, escolher um deles gravava um escopo de outro projeto sem avisar; depois da M1, o backend passou a recusar.
  - Agora o seletor só aparece quando o lançamento é do projeto da página, e o escopo original é mantido.
- Verificado pela interface com o backend de demo (banco restaurado com `seed:demo` no fim), sem nenhum 4xx/5xx inesperado:
  - editar projeto com horas abertas;
  - criar projeto;
  - lançamento manual com escopo: criar, editar removendo o escopo e excluir;
  - escopo: criar, editar removendo as horas e excluir;
  - pagamento: criar, editar e excluir;
  - importação: pré-visualizar e confirmar;
  - troca de projeto no ponto: finalizar e iniciar.
- `schemas.test.ts` tem 15 casos: o que o frontend envia passa; `tenantId`, `geradoPorRegularizacao`, enum inválido, data/hora fora do formato, descrição vazia, número como texto, linha adulterada, excesso de linhas, `$ne` e `__proto__` são recusados.
- **Instabilidade observada:** uma execução de `npm test` terminou com 67/74, e os 7 que faltaram batem com o total do `app.test.ts`. O detalhe da falha não foi capturado. Não reproduziu em 8 rodadas seguidas. Na M9, investigar se a subida do app na porta efêmera do `beforeAll` dispara timeout em máquina lenta, e considerar `supertest` ou um `testTimeout` maior.
