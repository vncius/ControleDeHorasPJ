# API REST

Base: `/api`. Todas as respostas são JSON. Exceto as rotas de autenticação marcadas como públicas, toda rota exige a sessão (cookie `sessao`, httpOnly) e opera **apenas sobre os dados do tenant logado** — o `tenantId` vem sempre da sessão, nunca do corpo ou da query string.

Toda requisição que altera estado (POST, PUT, PATCH, DELETE), inclusive o login, precisa do cabeçalho `X-Requested-With: XMLHttpRequest`. Sem ele a resposta é `403`.

O corpo de cada rota é validado por um schema Zod `.strict()` (`backend/src/schemas/index.ts`). Campo inválido responde `400 validacao.campoInvalido`, campo desconhecido responde `400 validacao.campoDesconhecido` (com `params.campo`) e chaves `$…`/`__proto__` respondem `400 validacao.chaveProibida`.

Erros respondem `{ erro, codigo, params? }`. `erro` é a mensagem em pt (fallback), `codigo` é a chave estável que o frontend traduz (`erros.<codigo>` em `frontend/src/i18n`) e `params` alimenta a interpolação. Status: `400` dado inválido, `401` sem sessão (`auth.naoAutenticado`), `403` sem cabeçalho CSRF, `404` não encontrado (inclusive de outro usuário), `409` conflito com o estado atual (ex.: `lancamento.jaEmAndamento`, `cliente.possuiProjetos`) e `500` erro interno genérico (`interno`). Excesso de requisições responde `429` com `Retry-After` (login: 20/min por IP; API: 600/min por IP; importação: 30 a cada 10 min por usuário). Corpo acima de 100 KB, ou 2 MB na importação, responde `413`.

## Autenticação

```
POST /api/auth/google        { credential }   ← pública: valida o ID token do Google e emite o cookie de sessão
POST /api/auth/logout                          ← pública: limpa o cookie
POST /api/auth/logout-todos                    ← invalida todas as sessões do usuário (todos os dispositivos)
GET  /api/auth/me                              → { email, nome }
```

## Auditoria

```
GET /api/auditoria   → os 100 eventos mais recentes do próprio usuário: { id, acao, ip, userAgent, detalhes: { metodo, caminho, consideradoPago? }, data }
```

Ações gravadas: `login`, `login_falhou` (sem identidade), `logout`, `logout_todos`, `exclusao` (todo DELETE bem-sucedido), `importacao`, `regularizacao` ("considerado pago" ligado ou desligado). Nunca o corpo da requisição.

## Dashboard

```
GET /api/dashboard           → horas faturáveis/não faturáveis (hoje, semana, mês), lançamento em andamento,
                               resumos de projetos a faturar e pagos, projetos próximos do limite
```

## Clientes

```
GET    /api/clientes
GET    /api/clientes/:id
POST   /api/clientes          { nome, observacoes? }
PUT    /api/clientes/:id      { nome?, observacoes? }
DELETE /api/clientes/:id                              ← recusa se houver projetos vinculados
```

## Projetos

```
GET    /api/projetos?clienteId=
GET    /api/projetos/:id
GET    /api/projetos/:id/resumo     → contratadas, extras aprovadas, trabalhadas, saldo, %, valores, status de pagamento
POST   /api/projetos                { clienteId, nome, dataInicio, horasContratadas?, valorHora?, status?, dataFim?,
                                      descricao?, observacoes?, consideradoPago? }
PUT    /api/projetos/:id            { ...mesmos campos, todos opcionais; horasContratadas: null = horas abertas }
DELETE /api/projetos/:id                              ← exclusão em cascata transacional
```

## Escopos (alterações de escopo)

```
GET    /api/escopos                                   ← todos do tenant
GET    /api/projetos/:projetoId/escopos
POST   /api/projetos/:projetoId/escopos   { titulo, horasAdicionais?, status?, descricaoDetalhada?, dataInicio?, dataFim?, observacoes? }
PUT    /api/escopos/:id
DELETE /api/escopos/:id
```

`horasAdicionais` ausente/`null` = escopo de **horas livres** (sem limite próprio).

## Pagamentos

```
GET    /api/pagamentos                                ← todos do tenant
GET    /api/projetos/:projetoId/pagamentos
POST   /api/projetos/:projetoId/pagamentos   { horasCobertas, dataPagamento, periodoApuracaoInicio, periodoApuracaoFim,
                                               valor?, numeroNF?, observacoes? }
PUT    /api/pagamentos/:id
DELETE /api/pagamentos/:id
```

## Lançamentos

```
GET    /api/lancamentos                               ← todos do tenant
GET    /api/lancamentos/em-andamento
GET    /api/lancamentos/:id
GET    /api/projetos/:projetoId/lancamentos           → cada item traz `faturavel` (calculado no backend)
GET    /api/projetos/:projetoId/ultima-descricao      → { descricao?, escopoId? }
POST   /api/projetos/:projetoId/iniciar               { descricao? }            ← controle de ponto
POST   /api/lancamentos/:id/finalizar                 { horaFim, descricao?, escopoId? }
POST   /api/lancamentos/:id/duplicar
POST   /api/lancamentos                               { projetoId, data, horaInicio, horaFim?, descricao, escopoId?, tipo? }
PUT    /api/lancamentos/:id                           { data?, horaInicio?, horaFim?, descricao?, escopoId?, tipo? }
DELETE /api/lancamentos/:id
```

## Importação de lançamentos

```
POST /api/projetos/:projetoId/lancamentos/importar-preview     { texto, ano }   → linhas com status valida/aviso/erro
POST /api/projetos/:projetoId/lancamentos/importar-confirmar   { linhas }       → lançamentos criados (tipo "Importado")
```

## Saúde

```
GET /health   → { status: "ok", timestamp }   (fora do prefixo /api)
```
