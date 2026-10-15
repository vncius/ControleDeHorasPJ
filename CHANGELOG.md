# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Adicionado
- `npm run seed:demo` (backend): recria um tenant fictício num banco separado (recusa banco sem `demo` no nome) para demonstração e prints.
- Configuração `backend-demo` em `.claude/launch.json`.
- `docs/plano-melhorias.md`: plano de evolução em entregas (M0–M16), com decisões, status e definição de pronto.
- `docs/api.md` e `docs/domain-logic.md`: referência de endpoints e regras de negócio, que antes ficavam no README.
- Prints com dados fictícios em `docs/screenshots/`.

### Alterado
- README reescrito para portfólio: print principal, galeria, funcionalidades, decisões técnicas, stack e como rodar. Corrigidas informações desatualizadas: a seção de API não trazia Pagamentos, a regra de faturabilidade estava antiga e o CORS era descrito com uma origem só.

### Segurança
- O servidor não sobe sem `JWT_SECRET` e `GOOGLE_CLIENT_ID`. Em produção também recusa `JWT_SECRET` com menos de 32 bytes e os valores de exemplo (M2).
- `app.ts` separado de `server.ts` (app testável sem banco) e log de requisições com método, caminho sem query string, status e duração, sem corpo, cookies nem e-mail (M6).
- Limites de requisição em memória: login 20/min por IP, API 600/min por IP e importação 30 a cada 10 min por tenant (429 com `Retry-After`). Corpo JSON limitado a 100 KB, ou 2 MB na importação, com 413 e JSON inválido respondidos em JSON (M5).
- Dependências do Express atualizadas por `npm audit fix` (body-parser, proxy-addr, qs) (M5).
- Validação de entrada com Zod: um schema `.strict()` por rota com corpo (enums, datas, horas 00:00–23:59, tamanhos), campos desconhecidos recusados (ex.: `tenantId`, `geradoPorRegularizacao`), chaves `$…` e `__proto__` bloqueadas em qualquer nível, linhas da importação revalidadas e limitadas a 2000. Tipos dos DTOs gerados dos schemas (M8).
- Erros padronizados: services lançam `AppError` com status (400, 404 ou 409) e código estável, e a API responde `{ erro, codigo, params? }`. Erro inesperado vira 500 genérico, sem vazar detalhe do banco. Rotas `/api` inexistentes respondem 404 em JSON. O frontend traduz pelo código (pt/en/es), trata resposta que não é JSON e falha de rede, e redireciona ao login quando a sessão expira (M7).
- Cabeçalhos de segurança: `helmet` na API (CSP fechada, sem `X-Powered-By`) e `frontend/public/_headers` no Cloudflare Pages (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). O anti-flash de tema saiu do script inline para `public/tema-inicial.js` (M4).
- Proteção contra CSRF: toda requisição que altera estado exige `X-Requested-With: XMLHttpRequest` (403 sem ele), e o cookie de sessão passa a ser `SameSite=Lax` também em produção, configurável por `COOKIE_SAME_SITE` (M3).

### Corrigido
- Lançamentos aceitavam `escopoId` de outro tenant ou de outro projeto ao criar, editar ou finalizar. Agora o escopo é validado (M1).
- Ao trocar de projeto no controle de ponto, o modal oferecia os escopos do projeto da página para o lançamento de outro projeto. Agora o seletor só aparece no próprio projeto (M8).
- A exclusão de projeto deixava as preferências do projeto (última descrição e escopo) órfãs. Agora entram na cascata (M1).

### Removido
- E-mail pessoal do README.
