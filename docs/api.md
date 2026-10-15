# API REST

Base: `/api`. Todas as respostas são JSON. Exceto as rotas de autenticação marcadas como públicas, toda rota exige a sessão (cookie `sessao`, httpOnly) e opera **apenas sobre os dados do tenant logado** — o `tenantId` vem sempre da sessão, nunca do corpo ou da query string.

Toda requisição que altera estado (POST, PUT, PATCH, DELETE), inclusive o login, precisa do cabeçalho `X-Requested-With: XMLHttpRequest`. Sem ele a resposta é `403`.

Erros hoje respondem `400 { erro: string }` (401 quando não há sessão). A padronização de status e códigos de erro está planejada em [`plano-melhorias.md`](plano-melhorias.md) (M7).

## Autenticação

```
POST /api/auth/google        { credential }   ← pública: valida o ID token do Google e emite o cookie de sessão
POST /api/auth/logout                          ← pública: limpa o cookie
GET  /api/auth/me                              → { email }
```

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
