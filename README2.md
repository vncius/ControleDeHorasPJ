# Horas PJ — Controle de Horas para Freelancers

Sistema web fullstack para controle de horas trabalhadas como PJ/freelancer. Substitui planilhas por uma ferramenta profissional com controle de ponto, lançamentos, dashboard gerencial e relatórios com separação de horas faturáveis e não faturáveis.

---

## Stack tecnológica

### Backend
- **Node.js** com **Express**
- **TypeScript**
- Persistência em **arquivos JSON locais** (simulando coleções MongoDB)
- Camada de repositório preparada para migração futura para MongoDB real

### Frontend
- **React 18** com **TypeScript**
- **Vite** como bundler e dev server
- **React Router DOM v6** para navegação
- CSS puro com variáveis (design system próprio, sem biblioteca de UI)
- Fontes: `Sora` (UI) e `DM Mono` (dados numéricos)

---

## Arquitetura

```
Browser (React/Vite :5173)
        ↓ HTTP fetch /api/*
Express API (Node.js :3001)
        ↓
  Controllers → Services → Repositories → JSON files
```

**Regra de ouro:** o frontend nunca acessa os arquivos JSON diretamente. Toda comunicação passa pela API REST. A camada `Repository` é a única que toca os arquivos JSON. Para migrar para MongoDB basta substituir os repositórios sem alterar nenhuma outra camada.

---

## Estrutura de pastas

```
horas-pj/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts
│       ├── types/index.ts               ← todas as interfaces e DTOs
│       ├── utils/tempo.ts               ← cálculos HH:MM, decimal, validações
│       ├── repositories/
│       │   ├── baseRepository.ts        ← CRUD genérico JSON
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
│           ├── clientes.json
│           ├── projetos.json
│           ├── alteracoesEscopo.json
│           ├── lancamentosHoras.json
│           └── preferenciasProjeto.json
│
└── frontend/
    ├── package.json
    ├── vite.config.ts                   ← proxy /api → :3001
    ├── index.html
    └── src/
        ├── App.tsx
        ├── index.css                    ← design system completo
        ├── types/index.ts
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
  horasContratadas?: number  // undefined = horas em aberto (sem limite)
  valorHora?: number
  status: 'Ativo' | 'Pausado' | 'Finalizado' | 'Cancelado'
  pago: boolean              // true = recebido, horas não faturáveis
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
  dataCriacao: string
  observacoes?: string
}
```

### Lançamento de Horas
```typescript
{
  id: string
  projetoId: string
  data: string           // YYYY-MM-DD
  horaInicio: string     // HH:MM
  horaFim?: string       // undefined = lançamento em andamento
  totalHHMM?: string     // "01:30"
  totalDecimal?: number  // 1.5
  descricao: string
  tipo: 'Automatico' | 'Manual' | 'Ajuste' | 'Importado'
  dataCriacao: string
  dataAtualizacao: string
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
POST   /api/clientes
PUT    /api/clientes/:id
DELETE /api/clientes/:id
```

### Projetos
```
GET    /api/projetos?clienteId=
GET    /api/projetos/:id
GET    /api/projetos/:id/resumo
POST   /api/projetos
PUT    /api/projetos/:id
DELETE /api/projetos/:id
```

### Escopos
```
GET    /api/projetos/:projetoId/escopos
POST   /api/projetos/:projetoId/escopos
PUT    /api/escopos/:id
DELETE /api/escopos/:id
```

### Lançamentos
```
GET    /api/lancamentos/em-andamento
GET    /api/projetos/:projetoId/lancamentos
GET    /api/projetos/:projetoId/ultima-descricao
POST   /api/projetos/:projetoId/iniciar          { descricao? }
POST   /api/lancamentos/:id/finalizar            { horaFim, descricao? }
POST   /api/lancamentos/:id/duplicar
POST   /api/lancamentos
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
- `pago: true` → horas não faturáveis, sem alerta de limite, separadas no dashboard e relatórios
- Ordenados do mais antigo ao mais novo por `dataInicio`
- Exclusão em cascata: remove todos os escopos e lançamentos vinculados

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
- Apenas **um lançamento em andamento por vez** em todo o sistema
- Ao iniciar com outro lançamento já aberto em **outro projeto**: sistema pergunta se deseja encerrar → abre modal de finalização → ao confirmar, encerra o anterior e inicia o novo automaticamente
- `horaFim` não pode ser anterior a `horaInicio`
- Total HH:MM e decimal calculados automaticamente pelo backend
- Última descrição por projeto salva e pré-carregada no próximo lançamento
- Lançamento em andamento pode ser cancelado (excluído sem salvar)

### Cálculo decimal
```
01:00 = 1,00  |  01:15 = 1,25  |  01:30 = 1,50  |  01:45 = 1,75
```

### Dashboard — tempo real
- Horas hoje/semana/mês incluem o tempo decorrido do lançamento em aberto
- Auto-refresh a cada 60 segundos
- Projetos `pago: true` ficam em grupo separado
- "Próximos do Limite": apenas projetos faturáveis com ≥ 80% consumido

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
- Meses: `jan fev mar abr mai jun jul ago set out nov dez`
- Total recalculado pelo sistema; tolerância de `0,02` para arredondamento
- Status por linha: **Válida** / **Aviso** (total diverge, descrição vazia) / **Erro** (data/hora inválida, colunas insuficientes)
- Linhas com erro são ignoradas; linhas com aviso são importadas
- Tipo dos lançamentos importados: `'Importado'`

---

## Funcionalidades por tela

### Dashboard
- Cards faturáveis (verde): hoje / semana / mês
- Cards não faturáveis (azul): visíveis somente quando há projetos pagos ativos
- Alerta de lançamento em andamento com finalização rápida
- Projetos faturáveis com barra de progresso e saldo
- Projetos pagos em seção separada
- Alertas de limite (≥ 80%)
- Filtro por nome/cliente em cada seção

### Clientes
- CRUD completo com busca em tempo real

### Projetos
- Filtros por cliente e status
- Badge "Pago" e coluna "Aberto" na listagem
- Campos: datas de início/fim, horas abertas (checkbox), flag pago

### Detalhe do Projeto
- Barra de progresso (ou banner de horas abertas)
- Cards de horas e financeiros
- Controle de ponto com troca inteligente entre projetos
- Botão de importação de planilha
- Aba **Lançamentos**: edição inline, duplicar, excluir, lançamento manual
- Aba **Escopos**: CRUD com status e total aprovado

### Relatórios
- Filtros: período, cliente, projeto
- Atalhos: este mês, último mês, 3 meses, 6 meses
- Agrupamento: cliente / projeto / dia
- **Cards separados**: faturável (verde) e não faturável (azul)
- **Abas**: Todos / Faturáveis / Não faturáveis
- Coluna "Faturável" (Sim/Não) na visão "Todos"
- Exportação CSV (separador `;`, UTF-8 BOM, pt-BR, inclui coluna Faturável)

---

## Design System

| Variável | Cor | Uso |
|---|---|---|
| `--accent` | `#a8ff3e` | Ações, dados faturáveis |
| `--info` | `#5cc8ff` | Projetos pagos, não faturáveis |
| `--danger` | `#ff5c7a` | Erros, saldo negativo |
| `--warning` | `#ffd166` | Limite próximo |
| `--font-ui` | Sora | Textos e labels |
| `--font-mono` | DM Mono | Números e dados |

---

## Detalhes técnicos importantes

- **IDs:** UUID string gerados pelo pacote `uuid` no backend
- **Datas gerais:** string ISO 8601 (`"2026-05-25T10:30:00.000Z"`)
- **Datas de projeto:** string `YYYY-MM-DD` (`"2026-05-25"`)
- **Horas:** string `HH:MM` (`"09:30"`)
- **`horasContratadas` ausente no JSON** = projeto em horas abertas (`undefined` não é serializado pelo `JSON.stringify`)
- **`baseRepository.update`** deleta explicitamente chaves com valor `undefined` no partial para permitir remoção de campos opcionais
- **`pago: false`** é o valor padrão para novos projetos
- O frontend envia `horasContratadas: null` (não `undefined`) para sinalizar remoção do campo no backend
- Sem autenticação — sistema single-user local
- Sem variáveis de ambiente necessárias para rodar localmente

## Migração para MongoDB

Para migrar, substitua apenas `backend/src/repositories/baseRepository.ts` mantendo a mesma interface pública:

```typescript
findAll(): T[]
findById(id: string): T | undefined
findBy(predicate: (item: T) => boolean): T[]
findOneBy(predicate: (item: T) => boolean): T | undefined
create(item: T): T
update(id: string, partial: Partial<T>): T | null
delete(id: string): boolean
exists(id: string): boolean
```

Nenhum outro arquivo precisa ser alterado.
