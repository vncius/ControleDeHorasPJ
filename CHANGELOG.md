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
- Proteção contra CSRF: toda requisição que altera estado exige `X-Requested-With: XMLHttpRequest` (403 sem ele), e o cookie de sessão passa a ser `SameSite=Lax` também em produção, configurável por `COOKIE_SAME_SITE` (M3).

### Corrigido
- Lançamentos aceitavam `escopoId` de outro tenant ou de outro projeto ao criar, editar ou finalizar. Agora o escopo é validado (M1).
- A exclusão de projeto deixava as preferências do projeto (última descrição e escopo) órfãs. Agora entram na cascata (M1).

### Removido
- E-mail pessoal do README.
