# Horas PJ — Controle de Horas para Freelancers

Sistema web fullstack para controle de horas trabalhadas como PJ/freelancer. Substitui planilhas por uma ferramenta com controle de ponto, lançamentos, dashboard gerencial e relatórios com separação de horas faturáveis e não faturáveis.

---

## Stack tecnológica

### Backend
- **Node.js** com **Express**
- **TypeScript**
- Persistência em **arquivos JSON locais** (`backend/src/data/`), simulando coleções de um banco de documentos
- Camada de repositório (`baseRepository.ts`) isolando o acesso a disco — pensada para facilitar uma futura migração para MongoDB

### Frontend
- **React 18** com **TypeScript**
- **Vite** como bundler e dev server
- **React Router DOM v6** para navegação
- CSS puro com variáveis (design system próprio, sem biblioteca de UI)

---

## Arquitetura

```
Browser (React/Vite :5173)
        ↓ HTTP fetch /api/*
Express API (Node.js :3001)
        ↓
  Controllers → Services → Repositories → JSON files
```

**Regra de ouro:** o frontend nunca acessa os arquivos JSON diretamente. Toda comunicação passa pela API REST. A camada `Repository` é a única que toca os arquivos JSON.

---

## Estrutura de pastas

```
ControleDeHorasPJ/
├── backend/
│   └── src/
│       ├── server.ts
│       ├── types/index.ts               ← todas as interfaces e DTOs
│       ├── utils/tempo.ts               ← cálculos HH:MM, decimal, validações de data/hora
│       ├── utils/faturamento.ts         ← fonte única da regra de "faturável" (projeto e lançamento)
│       ├── repositories/
│       │   ├── baseRepository.ts        ← CRUD genérico sobre JSON
│       │   └── index.ts
│       ├── services/
│       │   ├── clientesService.ts
│       │   ├── projetosService.ts
│       │   ├── escoposService.ts
│       │   ├── lancamentosService.ts
│       │   ├── dashboardService.ts
│       │   └── importacaoService.ts
│       ├── controllers/index.ts
│       ├── routes/index.ts
│       └── data/
│           ├── clientes.json            ← dados reais, ignorado pelo git
│           ├── projetos.json            ← dados reais, ignorado pelo git
│           ├── alteracoesEscopo.json    ← dados reais, ignorado pelo git
│           ├── lancamentosHoras.json    ← dados reais, ignorado pelo git
│           ├── preferenciasProjeto.json ← dados reais, ignorado pelo git
│           └── *.example.json           ← versões fictícias versionadas (referência de shape)
│
└── frontend/
    └── src/
        ├── App.tsx
        ├── index.css                    ← design system completo
        ├── types/index.ts
        ├── constants/statusProjeto.ts   ← cores por status (fonte única)
        ├── utils/tempo.ts               ← hora atual / tempo decorrido (fonte única)
        ├── hooks/useToast.ts
        ├── services/api.ts              ← todas as chamadas HTTP
        ├── components/
        │   ├── Layout.tsx
        │   ├── ControlePonto.tsx
        │   ├── TabelaLancamentos.tsx
        │   └── ModalImportacao.tsx
        └── pages/
            ├── Dashboard.tsx
            ├── Clientes.tsx
            ├── Projetos.tsx
            ├── ProjetoDetalhe.tsx
            └── Relatorios.tsx
```

---

## Como instalar e rodar

### Pré-requisitos
- Node.js 18 ou superior
- npm

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev
# http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### Variáveis de ambiente

Nenhuma é obrigatória para rodar localmente. A única reconhecida hoje:

| Variável | Onde | Padrão | Uso |
|---|---|---|---|
| `PORT` | backend | `3001` | Porta do servidor Express |

### Build de produção

```bash
cd backend && npm run build   # tsc → dist/
cd frontend && npm run build  # tsc && vite build → dist/
```

Rode `npx tsc --noEmit` em cada pacote antes de considerar uma tarefa concluída — é a forma mais rápida de pegar erros de tipo sem esperar o build completo.

---

## Dados de exemplo vs. dados reais

Os arquivos em `backend/src/data/*.json` (sem sufixo `.example`) guardam dados reais de clientes, projetos e faturamento e **não são versionados** (ver `.gitignore`). Ao clonar o repositório do zero, o backend inicia com dados vazios — os arquivos `*.example.json` existem apenas como referência do formato, não são lidos automaticamente pela aplicação.

---

## Entidades e modelo de dados

### Cliente
```typescript
{
  id: string           // UUID
  nome: string         // obrigatório
  observacoes?: string
  dataCriacao: string  // ISO 8601
}
```

### Projeto
```typescript
{
  id: string
  clienteId: string
  nome: string
  descricao?: string
  horasContratadas?: number  // ausente = horas em aberto (sem limite)
  valorHora?: number
  status: 'Aguardando início' | 'Em desenvolvimento' | 'Com impedimento'
        | 'Em testes' | 'Entregue' | 'Finalizado' | 'Cancelado'
  pago: boolean              // true = recebido
  dataPagamento?: string     // YYYY-MM-DD — linha de corte de faturabilidade
  dataInicio: string         // YYYY-MM-DD, obrigatório
  dataFim?: string           // YYYY-MM-DD, opcional
  dataCriacao: string
  observacoes?: string
}
```

### Alteração de Escopo
```typescript
{
  id: string
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais: number
  status: 'Pendente' | 'Aprovada' | 'Cancelada'
  dataInicio?: string
  dataFim?: string
  dataCriacao: string
  observacoes?: string
}
```

### Lançamento de Horas
```typescript
{
  id: string
  projetoId: string
  escopoId?: string      // associação opcional a uma alteração de escopo
  data: string           // YYYY-MM-DD
  horaInicio: string     // HH:MM
  horaFim?: string       // ausente = lançamento em andamento
  totalHHMM?: string     // "01:30"
  totalDecimal?: number  // 1.5
  descricao: string
  tipo: 'Automatico' | 'Manual' | 'Ajuste' | 'Importado'
  dataCriacao: string
  dataAtualizacao: string
  faturavel?: boolean    // computado na leitura pelo backend — não persistido
}
```

### Preferências do Projeto
```typescript
{
  id: string
  projetoId: string
  ultimaDescricaoLancamento?: string
}
```

---

## API REST

### Dashboard
```
GET  /api/dashboard
```

### Clientes
```
GET    /api/clientes
GET    /api/clientes/:id
POST   /api/clientes          { nome, observacoes? }
PUT    /api/clientes/:id      { nome?, observacoes? }
DELETE /api/clientes/:id
```

### Projetos
```
GET    /api/projetos?clienteId=
GET    /api/projetos/:id
GET    /api/projetos/:id/resumo
POST   /api/projetos          { clienteId, nome, horasContratadas?, ... }
PUT    /api/projetos/:id
DELETE /api/projetos/:id
```

### Escopos
```
GET    /api/projetos/:projetoId/escopos
POST   /api/projetos/:projetoId/escopos   { titulo, horasAdicionais, status?, ... }
PUT    /api/escopos/:id
DELETE /api/escopos/:id
```

### Lançamentos
```
GET    /api/lancamentos/em-andamento
GET    /api/projetos/:projetoId/lancamentos
GET    /api/projetos/:projetoId/ultima-descricao
POST   /api/projetos/:projetoId/iniciar          { descricao? }   ← Controle de ponto
POST   /api/lancamentos/:id/finalizar            { horaFim, descricao? }
POST   /api/lancamentos/:id/duplicar
POST   /api/lancamentos                          { projetoId, data, horaInicio, horaFim?, descricao, tipo? }
PUT    /api/lancamentos/:id
DELETE /api/lancamentos/:id
```

### Importação
```
POST   /api/projetos/:projetoId/lancamentos/importar-preview    { texto, ano }
POST   /api/projetos/:projetoId/lancamentos/importar-confirmar  { linhas }
```

---

## Regras de negócio

### Clientes
- Nome obrigatório
- Não é possível excluir cliente com projetos vinculados

### Projetos
- Nome, cliente e `dataInicio` obrigatórios
- `dataFim` não pode ser anterior a `dataInicio`
- `horasContratadas` opcional — ausente = projeto em horas abertas
- Ordenados do mais antigo ao mais novo por `dataInicio`
- Exclusão em cascata: remove todos os escopos e lançamentos vinculados

### Faturabilidade (fonte única: `backend/src/utils/faturamento.ts`)
Um **lançamento** é faturável quando, simultaneamente:
1. o projeto não está com status `Finalizado` ou `Cancelado`;
2. o projeto não está marcado como `pago: true` sem uma `dataPagamento` definida;
3. a data do lançamento é anterior à `dataPagamento` do projeto (quando ela existe).

Essa é a única implementação da regra — usada pelo dashboard e exposta via API (campo `faturavel` em cada lançamento retornado por `GET /api/projetos/:id/lancamentos`). O frontend não reimplementa esse cálculo.

Um **projeto** é considerado faturável (ainda a receber) quando não está pago e não está encerrado — usado para separar os cards do dashboard.

### Escopos
- Apenas `status: 'Aprovada'` soma ao total disponível do projeto
- `Pendente` e `Cancelada` são ignorados no cálculo

```
Horas contratadas:    245h
Escopo aprovado:      +12h
Escopo pendente:      ignorado
Total disponível:     257h
```

### Lançamentos — Controle de Ponto
- Apenas **um lançamento em andamento por vez por usuário (tenant)** — não por projeto, mas cada usuário tem seu próprio controle independente dos demais
- Ao iniciar com outro lançamento já aberto em **outro projeto**: o sistema abre um modal de finalização → ao confirmar, encerra o anterior e inicia o novo automaticamente
- `horaFim` não pode ser anterior a `horaInicio`
- Total HH:MM e decimal calculados automaticamente pelo backend
- Última descrição por projeto salva e pré-carregada no próximo lançamento
- Lançamento em andamento pode ser cancelado (excluído sem salvar)

### Cálculo decimal
```
01:00 = 1,00  |  01:15 = 1,25  |  01:30 = 1,50  |  01:45 = 1,75
```

### Resumo do projeto

**Com limite de horas:**
```
totalDisponivel = horasContratadas + sum(escoposAprovados)
saldo = totalDisponivel - totalTrabalhado
percentual = totalTrabalhado / totalDisponivel * 100
```

**Horas abertas** (`horasContratadas` ausente):
- Sem barra de progresso, sem saldo, sem alerta
- Apenas total trabalhado exibido

### Importação de lançamentos
- Texto colado do Excel/Google Sheets (colunas separadas por TAB)
- Formato: `Data | Descrição | Hora início | Hora fim | HH:MM | Decimal`
- Data sem ano → usuário informa o ano de referência
- Total recalculado pelo sistema; tolerância de `0,02` para arredondamento
- Status por linha: **Válida** / **Aviso** (total diverge, descrição vazia) / **Erro** (data/hora inválida, colunas insuficientes)
- Linhas com erro são ignoradas; linhas com aviso são importadas
- Tipo dos lançamentos importados: `'Importado'`

---

## Funcionalidades por tela

### Dashboard
- Cards faturáveis (verde) e não faturáveis (azul): hoje / semana / mês
- Alerta de lançamento em andamento com finalização rápida
- Projetos faturáveis com barra de progresso e saldo; pagos em seção separada
- Alertas de limite (≥ 80%)

### Clientes
- CRUD completo com busca em tempo real

### Projetos
- Filtros por cliente e status
- Campos: datas de início/fim, horas abertas (checkbox), flag pago, `dataPagamento`

### Detalhe do Projeto
- Barra de progresso (ou banner de horas abertas)
- Controle de ponto com troca inteligente entre projetos
- Botão de importação de planilha
- Aba **Lançamentos**: edição inline, duplicar, excluir, lançamento manual
- Aba **Escopos**: CRUD com status e total aprovado

### Relatórios
- Filtros: período, cliente, projeto
- Agrupamento: cliente / projeto / dia
- Cards e abas separando faturável / não faturável (usa o campo `faturavel` vindo da API)
- Exportação CSV (separador `;`, UTF-8 BOM, pt-BR)

---

## Detalhes técnicos importantes

- **IDs:** UUID string gerados pelo pacote `uuid` no backend
- **Datas gerais:** string ISO 8601 (`"2026-05-25T10:30:00.000Z"`)
- **Datas de projeto/lançamento:** string `YYYY-MM-DD`
- **Horas:** string `HH:MM`
- **`horasContratadas` ausente no JSON** = projeto em horas abertas (`undefined` não é serializado pelo `JSON.stringify`)
- **`baseRepository.update`** deleta explicitamente chaves com valor `undefined` no partial, para permitir remoção de campos opcionais (equivalente a um `$unset` do MongoDB)
- **`pago: false`** é o valor padrão para novos projetos
- O frontend envia `horasContratadas: null` (não `undefined`) para sinalizar remoção do campo — ver `Omit<Partial<Projeto>, 'horasContratadas'> & { horasContratadas?: number | null }` em `frontend/src/services/api.ts`
- Autenticação via Google OAuth + sessão própria (JWT em cookie httpOnly); acesso restrito por allowlist de e-mails (`ALLOWED_EMAILS`)
- Isolamento multi-tenant por e-mail: cada usuário aprovado enxerga só os próprios dados (`tenantId` em toda entidade — ver seção seguinte)
- Sem variáveis de ambiente obrigatórias além das de autenticação (ver `.env.example`)

## Autenticação e multi-tenant

- Login com Google (Google Identity Services) — o backend valida o ID token via `google-auth-library` e só aceita e-mails presentes em `ALLOWED_EMAILS` (lista separada por vírgula, em `backend/.env`).
- Após o login, o backend emite sua própria sessão (JWT assinado, cookie `sessao` httpOnly) — o token do Google não é reutilizado nas chamadas seguintes.
- Cada e-mail aprovado é um **tenant** isolado (`tenantId` = o próprio e-mail). Todas as entidades (`Cliente`, `Projeto`, `AlteracaoEscopo`, `LancamentoHoras`, `PreferenciasProjeto`) carregam esse campo, e toda leitura/escrita é filtrada por ele — a checagem de posse é centralizada em `baseRepository.ts` (`findAllByTenant`/`findByIdAndTenant`/`updateForTenant`/`deleteForTenant`/`existsForTenant`), nunca reimplementada manualmente nos services.
- Não existe conceito de "organização"/equipe — é um tenant por e-mail. Um novo e-mail aprovado começa com workspace vazio; os dados existentes antes desta mudança pertencem a `v.vieira.go@gmail.com`.
- Para aprovar um novo usuário: adicione o e-mail em `ALLOWED_EMAILS` (`backend/.env`) — não precisa de nenhuma outra configuração, o tenant é criado implicitamente no primeiro uso.

## Limitações conhecidas / roadmap

- **Persistência em JSON**: sem transação e sem lock de escrita — adequado para poucos usuários simultâneos, não para concorrência real em escala. Migração para MongoDB está planejada; a camada `repositories/` foi desenhada para isolar essa troca.
- **CORS** configurável via `CORS_ORIGIN` (padrão `http://localhost:5173`) — ainda assume um único domínio de frontend; revisar antes de qualquer deploy com múltiplos ambientes.
- **Sem refresh/rotação de sessão**: o cookie de sessão dura 7 dias fixos; não há renovação automática nem revogação individual de sessões.

## Migração para MongoDB

A interface pública já é assíncrona (`Promise`-based) e já inclui os métodos com checagem de tenant — a troca de banco deve substituir só `backend/src/repositories/baseRepository.ts`, mantendo a mesma interface:

```typescript
findAll(): Promise<T[]>
findById(id: string): Promise<T | undefined>
findBy(predicate: (item: T) => boolean): Promise<T[]>
findOneBy(predicate: (item: T) => boolean): Promise<T | undefined>
create(item: T): Promise<T>
update(id: string, partial: Partial<T>): Promise<T | null>
delete(id: string): Promise<boolean>
exists(id: string): Promise<boolean>

// convenções com checagem de tenant — usadas por todos os services
findAllByTenant(tenantId: string): Promise<T[]>
findByIdAndTenant(id: string, tenantId: string): Promise<T | undefined>
updateForTenant(id: string, tenantId: string, partial: Partial<T>): Promise<T | null>
deleteForTenant(id: string, tenantId: string): Promise<boolean>
existsForTenant(id: string, tenantId: string): Promise<boolean>
```

Ao migrar, crie índices compostos começando por `tenantId` (ex.: `{tenantId: 1, projetoId: 1}` em `lancamentosHoras`, `{tenantId: 1}` único onde fizer sentido) — toda consulta relevante já filtra por tenant primeiro.
