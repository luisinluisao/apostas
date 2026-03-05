# ⚽ Múltiplas do Dia

Gerador automático de múltiplas esportivas com dados **reais** de hoje.

---

## 🚀 Início Rápido (5 minutos)

### 1. Obtenha sua API Key gratuita

Acesse **https://the-odds-api.com** → Sign Up → copie sua chave.

> Plano gratuito: 500 requisições/mês. Suficiente para uso diário.

---

### 2. Opção A — Só o Frontend (mais simples)

Abra o arquivo `frontend/src/App.jsx` como um **React Artifact** no Claude.ai,
ou sirva localmente:

```bash
cd frontend
npm install
npm start
```

Na tela inicial, cole sua API key. Os jogos de hoje são carregados direto da The Odds API.

---

### 3. Opção B — Docker Completo (backend + frontend)

#### Pré-requisitos
- Docker e Docker Compose instalados
- API key da The Odds API

#### Passos

```bash
# Clone/baixe o projeto
cd multiplas-do-dia

# Configure a API key
cp .env.example .env
# Edite .env e coloque sua chave em ODDS_API_KEY=

# Suba tudo
docker compose up --build

# Acesse
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
```

---

## 📡 Endpoints da API (Backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do servidor |
| GET | `/api/games` | Jogos de hoje com odds e probabilidades |
| GET | `/api/multiples` | Múltiplas geradas automaticamente |
| GET | `/api/sports` | Ligas disponíveis |

### Parâmetros `/api/games`
| Param | Default | Descrição |
|-------|---------|-----------|
| `min_prob` | `0.50` | Probabilidade mínima (0.0–1.0) |
| `sport` | todos | Filtrar por esporte |

### Parâmetros `/api/multiples`
| Param | Default | Descrição |
|-------|---------|-----------|
| `mode` | `safe` | `safe` ou `ev` |
| `size_min` | `8` | Mínimo de seleções |
| `size_max` | `14` | Máximo de seleções |
| `count` | `6` | Quantidade de múltiplas |
| `stake` | `10.0` | Valor da aposta (R$) |
| `min_prob` | `0.50` | Probabilidade mínima |

---

## 🧠 Como Funciona o Modelo

### 1. Coleta de Odds
Busca odds de até 3 casas de apostas da região EU via The Odds API e calcula a média.

### 2. Remoção da Vig
```
prob_implícita = (1/odd) / Σ(1/odd_i)
```
Remove a margem da casa e obtém a probabilidade justa.

### 3. Ajuste do Modelo
```
prob_modelo = prob_implícita + ajuste_casa + ruído_forma
```
- Time da casa recebe +3%
- Time visitante recebe -2%
- Empate mantém a probabilidade de mercado

### 4. Cálculo de EV
```
EV = p × (odd − 1) − (1 − p)
```
Apenas apostas com `EV > 0` são elegíveis no **Modo EV+**.

### 5. Geração de Múltiplas
**Modo Seguro:** maximiza `∏ prob_i` (maior chance de acerto)

**Modo EV+:** maximiza `Σ EV_i` (maior valor esperado)

Regras:
- 1 seleção por jogo
- Máximo 3 seleções por liga
- Entre 8 e 14 pernas por padrão

---

## 📁 Estrutura do Projeto

```
multiplas-do-dia/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI endpoints
│   │   ├── probability.py   # Modelo probabilístico
│   │   ├── generator.py     # Gerador de múltiplas
│   │   └── models.py        # Schemas Pydantic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       └── App.jsx          # React dashboard completo
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## ⚠️ Aviso Legal

Este sistema é desenvolvido para fins **educacionais e analíticos**.
Apostas esportivas envolvem risco de perda financeira.
Jogue com responsabilidade. Se tiver problema com jogo compulsivo,
ligue para o CVV: **188**.
