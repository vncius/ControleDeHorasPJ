# Horas PJ — Backend

API REST para controle de horas trabalhadas como PJ/freelancer.

## Requisitos

- Node.js 18+
- npm

## Setup

```bash
cd backend
npm install
npm run dev
```

O servidor inicia em `http://localhost:3001`.

## Endpoints disponíveis

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
POST   /api/projetos          { clienteId, nome, horasContratadas, ... }
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
POST   /api/projetos/:projetoId/iniciar     { descricao? }   ← Controle de ponto
POST   /api/lancamentos/:id/finalizar       { horaFim, descricao? }
POST   /api/lancamentos/:id/duplicar
POST   /api/lancamentos                     { projetoId, data, horaInicio, horaFim?, descricao, tipo? }
PUT    /api/lancamentos/:id
DELETE /api/lancamentos/:id
```

## Arquitetura

```
Frontend → API REST → Controller → Service → Repository → JSON
```

Os arquivos JSON ficam em `src/data/`.  
Para migrar para MongoDB: substitua apenas a camada `repositories/`.

## Regras de negócio implementadas

- Hora fim não pode ser anterior à hora início
- Apenas um lançamento em andamento por vez
- Somente escopos com status "Aprovada" somam ao total do projeto
- Cálculo decimal correto: 01:15 = 1.25, 01:30 = 1.50, etc.
- Última descrição salva por projeto e pré-carregada automaticamente
- Exclusão de cliente bloqueada se houver projetos vinculados
- Exclusão de projeto remove escopos e lançamentos em cascata


## Execução local e inicialização automática no Windows

Este projeto possui dois serviços:

- Backend: `D:\Projetos próprios\horas-pj\backend`
- Frontend: `D:\Projetos próprios\horas-pj\frontend`

---

## 1. Requisitos

powershell -ExecutionPolicy Bypass -File "D:\ProjetosProprios\horas-pj\configurar-horas-pj.ps1"