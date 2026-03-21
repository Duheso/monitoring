# 🗺️ NavSP — Plano de Implementação
**Aplicativo de Navegação 3D para São Paulo**  
Stack: Python (FastAPI) + React (PWA) + SQLite | Idioma: PT-BR

---

## 📌 Visão Geral do Produto

NavSP é um Progressive Web App (PWA) mobile-first de navegação turn-by-turn para São Paulo com renderização 3D estilo Tesla/carros chineses. O mapa exibe perspectiva inclinada da pista, sinalização antecipada de manobras, dados de tráfego em tempo real e recalculo automático de rota. O usuário pode salvar locais e rotas favoritas, fazer login via Google/Apple e ouvir instruções de voz opcionais em PT-BR.

---

## 🧱 Decisões de Escopo (Confirmadas)

| Atributo | Decisão |
|---|---|
| Plataforma | PWA mobile-first (roda no browser do celular) |
| Cobertura | São Paulo + região metropolitana (MVP) |
| Visual 3D | Perspectiva inclinada (pitch + bearing) — estilo Tesla |
| GPS | Automático (Geolocation API) + digitação manual |
| Favoritos | Locais + rotas favoritas |
| Transporte | Somente carro |
| Tráfego | Tempo real + recalculo automático de rota |
| Offline | Não (somente online) |
| Auth | Login social: Google OAuth2 + Apple Sign-In |
| Voz | Opcional (toggle ligar/desligar), TTS PT-BR |
| Backend | Python + FastAPI |
| Banco | SQLite + SQLAlchemy |
| Idioma UI | Português Brasileiro (PT-BR) |
| Deploy | A definir (opções documentadas abaixo) |

---

## 🗺️ APIs Disponíveis: Análise Completa

### Opção A — Free Tier (Início rápido, sem infra extra)

| API | Função | Free Tier | Limite | Link |
|---|---|---|---|---|
| **MapLibre GL JS** | Renderizador 3D | 100% grátis | Open source | maplibre.org |
| **OpenFreeMap** | Tiles (camadas do mapa) | 100% grátis | CDN Cloudflare | openfreemap.org |
| **Maptiler Cloud** | Tiles alternativos | 100k req/mês | Sim | maptiler.com |
| **OpenRouteService** | Roteamento (carro) | 2.000 req/dia, 40/min | Sim | openrouteservice.org |
| **Nominatim (OSM)** | Geocoding (busca endereço) | Grátis | 1 req/segundo | nominatim.org |
| **Photon** | Geocoding alternativo | Grátis (hosted) | Sem SLA | photon.komoot.io |
| **HERE Maps Traffic API** | Tráfego em tempo real | 250.000 trans/mês | Sim | developer.here.com |

**✅ Prós do Free Tier:** Início rápido, sem servidor adicional, sem custo  
**❌ Contras do Free Tier:** Limites de requisições, dependência de terceiros, SLA não garantido, risco de cobrança ao escalar

---

### Opção B — Self-Hosted (Controle total, sem limites de API)

| Solução | Função | Requisitos de Infra | Complexidade |
|---|---|---|---|
| **OpenMapTiles** | Tile server (mapa) | 4 vCPU, 8GB RAM, 60GB SSD | Média |
| **OSRM** | Roteamento carro | 16–32GB RAM, 100GB SSD, 4 vCPU | Alta |
| **Valhalla** | Roteamento alternativo (mais flexível) | 8–16GB RAM, 60GB SSD | Alta |
| **Photon self-hosted** | Geocoding | 4GB RAM, 60GB SSD | Média |
| **Nominatim self-hosted** | Geocoding completo | 32GB RAM, 500GB SSD (BR) | Muito Alta |

**Custo estimado de VPS para self-hosted completo:** ~$80–$150/mês (ex.: Hetzner CPX51 ou AWS c6a.2xlarge)

**✅ Prós do Self-Hosted:** Sem limites de uso, sem vendor lock-in, dados ficam na sua infra, LGPD-friendly  
**❌ Contras do Self-Hosted:** Alto consumo de RAM/disco, manutenção de infra, atualizações de dados OSM periódicas, setup complexo

---

### 🏆 Recomendação por Fase

| Fase | Estratégia | Motivo |
|---|---|---|
| MVP / Desenvolvimento | Free Tier (OpenFreeMap + OpenRouteService + HERE) | Custo zero, início rápido |
| Produto em Produção | Migrar para Self-Hosted OSRM + OpenMapTiles | Escalabilidade e controle |
| Tráfego em tempo real | HERE Maps (manter free tier ou pagar) | Alternativa self-hosted não existe gratuita |

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE (PWA)                        │
│  React + TypeScript + Vite                               │
│  MapLibre GL JS (3D render) + deck.gl (overlays)         │
│  react-maplibre + Zustand + TailwindCSS                  │
│  Web Geolocation API + Web Speech API (TTS PT-BR)        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS (REST + JWT)
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  Python 3.12 + FastAPI + Uvicorn                         │
│  SQLAlchemy + SQLite (favoritos, usuários, rotas)        │
│  Authlib (OAuth2 Google/Apple) + JWT                     │
│  httpx (proxy para APIs externas)                        │
└──┬──────────────────────────────────────────────────┬───┘
   │                                                  │
   ▼                                                  ▼
APIs de Roteamento                          APIs de Tráfego
OpenRouteService / OSRM                     HERE Maps Traffic API
Nominatim / Photon (geocoding)
OpenFreeMap / Maptiler (tiles via frontend)
```

---

## 🛠️ Stack Tecnológica Completa

### Frontend
| Tecnologia | Versão | Função |
|---|---|---|
| React | 18+ | Framework UI |
| TypeScript | 5+ | Tipagem estática |
| Vite | 5+ | Build tool (PWA plugin) |
| MapLibre GL JS | 4+ | Renderizador de mapa 3D WebGL |
| deck.gl | 9+ | Overlays 3D (pista, rota, animações) |
| react-maplibre | Latest | Wrapper React para MapLibre |
| Zustand | 4+ | Gerenciamento de estado |
| TailwindCSS | 3+ | Estilização |
| React Query | 5+ | Cache e fetch de dados |
| Vite PWA Plugin | Latest | Service Worker + Manifest |
| Web Speech API | Browser native | Narração de voz TTS PT-BR |
| Geolocation API | Browser native | GPS do dispositivo |

### Backend
| Tecnologia | Versão | Função |
|---|---|---|
| Python | 3.12+ | Linguagem base |
| FastAPI | 0.110+ | Framework web async |
| Uvicorn | 0.29+ | ASGI server |
| SQLAlchemy | 2.0+ | ORM para SQLite |
| Alembic | Latest | Migrations de banco |
| Authlib | 1.3+ | OAuth2 (Google/Apple) |
| python-jose | Latest | JWT tokens |
| httpx | Latest | Cliente HTTP async |
| Pydantic v2 | 2+ | Validação de dados |
| python-dotenv | Latest | Variáveis de ambiente |

### DevOps / Infra
| Tecnologia | Função |
|---|---|
| Docker + Docker Compose | Ambiente de desenvolvimento local |
| GitHub Actions | CI/CD pipeline |
| Nginx (produção) | Reverse proxy + HTTPS |

---

## 📦 Estrutura do Projeto (Monorepo)

```
navsp/
├── frontend/                    # React PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/             # MapLibre + deck.gl
│   │   │   ├── Navigation/      # HUD de navegação, manobras
│   │   │   ├── Search/          # Busca de endereço (autocomplete)
│   │   │   ├── Favorites/       # Lista de favoritos
│   │   │   ├── Auth/            # Login Google/Apple
│   │   │   └── UI/              # Botões, modais, toasts
│   │   ├── hooks/               # useGeolocation, useNavigation, useRoute
│   │   ├── store/               # Zustand stores
│   │   ├── services/            # API clients (backend, HERE, ORS)
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # Helpers (coords, formatação)
│   ├── public/
│   │   └── icons/               # PWA icons
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py      # OAuth2 endpoints
│   │   │   │   ├── favorites.py # CRUD de locais favoritos
│   │   │   │   ├── routes.py    # CRUD de rotas favoritas
│   │   │   │   └── proxy.py     # Proxy para APIs externas
│   │   ├── core/
│   │   │   ├── config.py        # Settings (env vars)
│   │   │   ├── security.py      # JWT, OAuth helpers
│   │   │   └── database.py      # SQLAlchemy setup
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── main.py              # FastAPI app entry
│   ├── alembic/                 # Migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📊 Modelo de Banco de Dados (SQLite)

```sql
-- Usuários
CREATE TABLE users (
    id          TEXT PRIMARY KEY,      -- UUID
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    avatar_url  TEXT,
    provider    TEXT NOT NULL,         -- 'google' | 'apple'
    provider_id TEXT UNIQUE NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Locais Favoritos
CREATE TABLE favorite_places (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    name       TEXT NOT NULL,          -- apelido do usuário
    address    TEXT,
    latitude   REAL NOT NULL,
    longitude  REAL NOT NULL,
    icon       TEXT DEFAULT 'star',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rotas Favoritas
CREATE TABLE favorite_routes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    origin_name     TEXT NOT NULL,
    origin_lat      REAL NOT NULL,
    origin_lng      REAL NOT NULL,
    dest_name       TEXT NOT NULL,
    dest_lat        REAL NOT NULL,
    dest_lng        REAL NOT NULL,
    distance_meters INTEGER,
    duration_secs   INTEGER,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 MACRO FASES DE IMPLEMENTAÇÃO

### Fase 0 — Fundação e Setup
Setup completo do ambiente, monorepo, Docker, CI/CD.

### Fase 1 — Mapa Base + Rota
Mapa 2D funcional com busca de endereço e rota calculada plotada.

### Fase 2 — Navegação 3D Turn-by-Turn
Modo navegação com perspectiva 3D, GPS tracking, HUD, voz e recalculo.

### Fase 3 — Autenticação + Favoritos
Login Google/Apple, salvar locais e rotas, API REST com JWT.

### Fase 4 — Tráfego em Tempo Real
Overlay de tráfego, congestionamento colorido, recalculo considerando tráfego.

### Fase 5 — PWA + Polimento
Instalação como app, service worker, performance, testes E2E.

---

## 🔬 MICRO IMPLEMENTAÇÕES (Detalhado por Fase)

---

### FASE 0 — Fundação e Setup

**M0.1 — Estrutura do monorepo**
- Criar estrutura de diretórios `navsp/frontend` e `navsp/backend`
- Inicializar Git com `.gitignore` para Python e Node
- Criar `README.md` com instruções de setup

**M0.2 — Scaffold do frontend**
- `npm create vite@latest frontend -- --template react-ts`
- Instalar dependências: `maplibre-gl`, `react-maplibre`, `deck.gl`, `tailwindcss`, `zustand`, `@tanstack/react-query`
- Configurar TailwindCSS + PostCSS
- Configurar `vite-plugin-pwa` (Workbox)
- Configurar aliases de path (`@/components`, `@/hooks`, etc.)

**M0.3 — Scaffold do backend**
- Criar `backend/` com estrutura FastAPI
- `requirements.txt`: `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `alembic`, `authlib`, `python-jose[cryptography]`, `httpx`, `pydantic[email]`, `python-dotenv`
- Criar `app/main.py` com FastAPI, CORS configurado para dev
- Criar `app/core/config.py` com `pydantic-settings`

**M0.4 — Banco de dados e migrations**
- Configurar `app/core/database.py` com SQLAlchemy + SQLite async
- Criar models: `User`, `FavoritePlace`, `FavoriteRoute`
- Configurar Alembic com `alembic init`
- Criar primeira migration: `alembic revision --autogenerate -m "initial"`
- Rodar migration: `alembic upgrade head`

**M0.5 — Docker Compose (desenvolvimento)**
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend:/app", "./backend_data:/data"]
    env_file: .env
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes: ["./frontend:/app"]
```

**M0.6 — Variáveis de ambiente**
- Criar `.env.example` com todas as chaves necessárias:
  - `DATABASE_URL=sqlite+aiosqlite:///./data/navsp.db`
  - `SECRET_KEY=`
  - `GOOGLE_CLIENT_ID=` / `GOOGLE_CLIENT_SECRET=`
  - `APPLE_CLIENT_ID=` / `APPLE_TEAM_ID=` / `APPLE_KEY_ID=`
  - `HERE_API_KEY=`
  - `ORS_API_KEY=` (OpenRouteService)
  - `FRONTEND_URL=http://localhost:5173`

**M0.7 — GitHub Actions CI**
- Workflow de CI: lint + type check no frontend (ESLint, tsc)
- Workflow de CI: lint + tests no backend (ruff, pytest)

---

### FASE 1 — Mapa Base + Rota

**M1.1 — Integrar MapLibre GL JS com tiles**
- Criar componente `<MapView />` com `react-maplibre`
- Configurar estilo de mapa: `https://tiles.openfreemap.org/styles/liberty` (gratuito)
- Viewport inicial centrado em São Paulo: `{ lng: -46.6333, lat: -23.5505, zoom: 12 }`
- Habilitar controles básicos: zoom, bússola, localização

**M1.2 — Busca de endereço (Geocoding)**
- Criar componente `<SearchBar />` com autocomplete debounced (300ms)
- Integrar Photon API (`https://photon.komoot.io/api/?q=...&lat=-23.5&lon=-46.6`)
- Filtrar resultados dentro de bbox de São Paulo/Grande SP
- Ao selecionar resultado: mover câmera para coordenada

**M1.3 — Input de partida e destino**
- Criar componente `<RouteInputPanel />` com dois campos: Partida e Destino
- Campo "Minha localização" como atalho para GPS
- Estado no Zustand: `originCoords`, `destinationCoords`

**M1.4 — Calcular rota (OpenRouteService)**
- Backend: criar endpoint `GET /api/v1/proxy/route`
  - Recebe: `origin`, `destination` (coords)
  - Chama ORS Directions API: `https://api.openrouteservice.org/v2/directions/driving-car`
  - Retorna: GeoJSON da rota + steps + distância + duração
- Frontend: hook `useRoute(origin, destination)` com React Query

**M1.5 — Plotar rota no mapa**
- Criar layer `route-line` no MapLibre com GeoJSON source
- Estilo: linha azul sólida, largura 6px, borda branca 8px
- Animar entrada da rota (fade in)

**M1.6 — Painel de resumo da rota**
- Componente `<RouteSummary />`: distância (km), tempo estimado (min), botão "Iniciar Navegação"
- Formatar em PT-BR (ex.: "23 min · 8,4 km")

---

### FASE 2 — Navegação 3D Turn-by-Turn

**M2.1 — Geolocation API (GPS do dispositivo)**
- Hook `useGeolocation()`: `navigator.geolocation.watchPosition()`
- Estado: `{ lat, lng, speed, heading, accuracy }`
- Fallback gracioso se permissão negada

**M2.2 — Modo de navegação (câmera 3D)**
- Ao clicar "Iniciar Navegação", ativar modo nav:
  - `pitch: 60°` (inclinação — estilo Tesla)
  - `bearing: heading do usuário` (direção do movimento)
  - `zoom: 17–18` (pista próxima)
  - `center: posição GPS atual`
- Câmera segue suavemente a posição GPS (`flyTo` com easing)
- Botão de saída do modo de navegação

**M2.3 — deck.gl PathLayer (pista em 3D)**
- Instalar `@deck.gl/react` e `@deck.gl/mapbox`
- Criar `PathLayer` com a geometria da rota
  - Largura: 8m, cor azul elétrico `[0, 120, 255]`
  - Elevação: 2m acima do nível da rua (efeito elevado)
- `MapboxOverlay` com `interleaved: true`

**M2.4 — Snap na rota (map matching)**
- Algoritmo de projeção do ponto GPS na polyline mais próxima
- Calcular qual segmento da rota o usuário está
- Determinar próxima manobra (next step)

**M2.5 — Painel HUD de manobra antecipada**
- Componente `<TurnInstruction />` sobreposto no topo do mapa
- Exibe: ícone de manobra (virar esquerda/direita/reto/retorno) + texto + distância
- Ícones SVG customizados para cada manobra
- Antecipação: avisa 300m antes de rodovias, 100m em vias locais

**M2.6 — HUD inferior de status**
- Componente `<NavigationHUD />` na parte inferior da tela
- Exibe: velocidade atual (GPS), distância restante, horário de chegada (ETA)
- Design minimalista, fundo escuro semi-transparente (estilo carro)

**M2.7 — Narração de voz (TTS PT-BR)**
- Usar `window.speechSynthesis.speak()` — browser nativo, sem custo
- Voz: `lang: 'pt-BR'`, selecionar voz disponível no dispositivo
- Narrar: "Em 300 metros, vire à direita na Avenida Paulista"
- Fila de falas: não sobrepor, cancelar anterior ao falar novo

**M2.8 — Toggle de voz**
- Botão de microfone no HUD (ícone muted/unmuted)
- Estado salvo em `localStorage` (persiste entre sessões)

**M2.9 — Detecção de desvio e recalculo**
- Se distância do ponto GPS para a rota > 50m por 3 segundos
- Exibir toast: "Recalculando rota…"
- Chamar novamente endpoint de rota com nova origem (posição atual)
- Atualizar rota no mapa animatamente

---

### FASE 3 — Autenticação + Favoritos

**M3.1 — Backend: OAuth2 Google**
- Endpoint `GET /api/v1/auth/google` → redireciona para Google
- Endpoint `GET /api/v1/auth/google/callback` → troca code por token
- Criar/atualizar usuário no banco
- Retornar JWT próprio (access token + refresh token)

**M3.2 — Backend: Apple Sign-In**
- Endpoint `GET /api/v1/auth/apple`
- Endpoint `POST /api/v1/auth/apple/callback` (Apple usa POST)
- Validar identity token JWT da Apple
- Criar/atualizar usuário no banco

**M3.3 — Backend: JWT middleware**
- Middleware `get_current_user` via FastAPI `Depends()`
- Validar Bearer token em cada rota protegida
- Refresh token endpoint: `POST /api/v1/auth/refresh`

**M3.4 — Backend: API de Locais Favoritos**
```
GET    /api/v1/favorites/places       → listar todos
POST   /api/v1/favorites/places       → criar novo
PATCH  /api/v1/favorites/places/{id}  → renomear
DELETE /api/v1/favorites/places/{id}  → remover
```

**M3.5 — Backend: API de Rotas Favoritas**
```
GET    /api/v1/favorites/routes       → listar todas
POST   /api/v1/favorites/routes       → salvar rota
DELETE /api/v1/favorites/routes/{id}  → remover
```

**M3.6 — Frontend: Modal de Login**
- Componente `<AuthModal />`
- Botão "Entrar com Google" (estilo oficial)
- Botão "Entrar com Apple" (estilo oficial)
- Fluxo: redirect → callback → JWT salvo em `localStorage`

**M3.7 — Frontend: Tela de Favoritos**
- Aba/tela `<FavoritesScreen />`
- Seção "Locais Favoritos": lista com ícone + nome + endereço
- Seção "Rotas Favoritas": origem → destino + distância
- Ao tocar em favorito: abre no mapa diretamente

**M3.8 — Frontend: Salvar Favorito do Mapa**
- Ao pressionar longo (long press) em ponto do mapa → modal
- Opção: "Salvar como local favorito" → abre input de nome
- Botão de coração no painel de destino para salvar rota

---

### FASE 4 — Tráfego em Tempo Real

**M4.1 — Backend: Proxy para HERE Traffic API**
- Endpoint `GET /api/v1/proxy/traffic`
- Parâmetros: `bbox` (área visível do mapa)
- Chama HERE Traffic Flow API v7
- Retorna GeoJSON com segmentos e jam factor (0–10)

**M4.2 — Overlay de tráfego no mapa**
- Criar layer `traffic-flow` no MapLibre
- Colorir segmentos de rua por congestionamento:
  - 🟢 Verde: fluindo (jam 0–3)
  - 🟡 Amarelo: lento (jam 4–6)
  - 🔴 Vermelho: congestionado (jam 7–10)
- Toggle de tráfego (ligar/desligar overlay)
- Atualizar a cada 60 segundos (polling)

**M4.3 — Roteamento com tráfego**
- No endpoint de rota, adicionar parâmetro `avoid_traffic: true`
- OpenRouteService suporta `avoid_features` mas não tráfego real
- Estratégia: calcular rota alternativa quando HERE detectar jam > 7 na rota atual
- Oferecer ao usuário: "Há uma rota mais rápida. Deseja recalcular?"

**M4.4 — Alertas de incidentes**
- Chamar HERE Traffic Incidents API
- Exibir ícones de incidente no mapa (acidente, obra, bloqueio)
- Toast de alerta: "Acidente à frente na Marginal Pinheiros"

---

### FASE 5 — PWA + Polimento

**M5.1 — Web App Manifest**
- `manifest.webmanifest`: nome, ícones 192x192 e 512x512, `theme_color`, `display: standalone`
- Splash screen para iOS e Android

**M5.2 — Service Worker (Workbox)**
- Cache de assets estáticos (JS, CSS, fontes)
- Cache de tiles do mapa (stale-while-revalidate)
- Cache de resposta do backend (favoritos)

**M5.3 — Prompt de instalação**
- Capturar evento `beforeinstallprompt`
- Exibir banner: "Adicionar NavSP à tela inicial"
- Para iOS: instrução manual com botão de compartilhar

**M5.4 — Performance**
- Code splitting por rota (lazy loading de telas)
- Preload de fontes e ícones críticos
- Bundle analyzer (`rollup-plugin-visualizer`)
- Lighthouse audit: score > 90 em Performance e PWA

**M5.5 — Testes**
- **Frontend**: Vitest + React Testing Library (unit + integration)
  - Testar: cálculo de rota, detecção de desvio, store de favoritos
- **Backend**: Pytest + httpx AsyncClient
  - Testar: endpoints de favoritos, auth JWT, proxy de rota
- **E2E**: Playwright
  - Fluxo: buscar endereço → calcular rota → iniciar navegação → desviar → recalcular

---

## 🌐 Opções de Deploy

### Opção 1 — Simples e Barato (Recomendado para MVP)
| Componente | Serviço | Custo |
|---|---|---|
| Frontend (PWA) | Vercel / Netlify | Grátis |
| Backend (FastAPI) | Railway / Render | Grátis–$5/mês |
| Banco (SQLite) | Incluso no backend (volume) | Grátis |

**Prós:** Setup em minutos, SSL automático, CI/CD integrado  
**Contras:** SQLite em serviço gerenciado pode ter limitações de volume persistente

### Opção 2 — VPS Dedicada (Produção)
| Componente | Serviço | Custo |
|---|---|---|
| Tudo | Hetzner CX21 (2vCPU, 4GB) | ~€5/mês |
| Self-hosted OSRM (futuro) | Hetzner CPX41 (8vCPU, 16GB) | ~€30/mês |

**Prós:** Controle total, dados na sua infra, fácil escalar  
**Contras:** Gerenciar updates de SO, SSL manual (Let's Encrypt)

### Opção 3 — Docker Compose (On-premise / Self-hosted total)
- Rodar tudo em servidor próprio com Docker Compose
- Nginx como reverse proxy
- Certbot para SSL
- Ideal para: dados sensíveis, compliance, LGPD

---

## 📋 Dependências entre Tarefas

```
M0.1 → M0.2, M0.3
M0.3 → M0.4
M0.2, M0.4 → M0.5
M0.5 → M1.1
M1.1 → M1.2, M1.3
M1.2, M1.3 → M1.4
M1.4 → M1.5, M1.6
M1.5, M1.6 → M2.1
M2.1 → M2.2, M2.3
M2.2, M2.3 → M2.4
M2.4 → M2.5, M2.6, M2.7, M2.8, M2.9
M0.3, M0.4 → M3.1, M3.2
M3.1, M3.2 → M3.3
M3.3 → M3.4, M3.5
M3.4, M3.5 → M3.6, M3.7, M3.8
Fase 2 completa → M4.1
M4.1 → M4.2, M4.3, M4.4
Fase 3, Fase 4 completas → Fase 5
```

---

## 🔑 Chaves de API Necessárias para Registrar

1. **HERE Developer** → Traffic API: https://developer.here.com (free tier: 250k trans/mês)
2. **OpenRouteService** → Routing: https://openrouteservice.org/dev/#/signup (free: 2k req/dia)
3. **Google Cloud Console** → OAuth2: https://console.cloud.google.com (Google Sign-In)
4. **Apple Developer** → Sign In with Apple: https://developer.apple.com ($99/ano necessário)
5. **Maptiler** (opcional) → Tiles alternativos: https://maptiler.com/cloud (free: 100k/mês)

> OpenFreeMap (tiles) e Nominatim/Photon (geocoding) **não requerem registro**.

---

## ⚠️ Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| ORS rate limit (2k req/dia) | Alto em produção | Migrar para OSRM self-hosted ou GraphHopper |
| HERE Traffic coverage em SP | Médio | Testar cobertura antes de depender |
| Apple Sign-In: $99/ano developer | Médio | Lançar MVP só com Google, adicionar Apple depois |
| SQLite em produção (concorrência) | Médio | Migrar para PostgreSQL se >10 usuários simultâneos |
| GPS impreciso em cânions urbanos (SP) | Alto | Implementar Kalman filter ou suavização de posição |
| Permissão de localização negada | Alto | UX clara explicando necessidade, modo manual como fallback |
