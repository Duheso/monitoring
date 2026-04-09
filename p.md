# 🚗 NavSP — Plano Evoluído: Percepção ADAS + Visualização 3D Simulada
**Evolução do p2.md com câmera ADAS e renderização de rua em tempo real (estilo simulador)**  
Stack: Python (FastAPI) + React (PWA) + PostgreSQL + Three.js + ONNX/TF.js | Self-Hosted | PT-BR

---

## 📌 Análise do Plano Atual (p2.md) — O que já funciona?

### ✅ Navegação estilo Google Maps — O plano atual JÁ cobre

| Funcionalidade | Status no p2.md | Como funciona |
|---|---|---|
| Mapa 3D com perspectiva inclinada | ✅ Cobertura total | MapLibre GL JS com `pitch: 60°`, `bearing` segue o heading do GPS |
| Câmera segue o usuário enquanto dirige | ✅ M2.2 | `easeTo()` suave a cada update de GPS |
| Turn-by-turn (setas de manobra) | ✅ M2.4 + M2.5 | Snap-to-route + próxima manobra calculada por segmento OSM |
| HUD de velocidade, ETA, distância | ✅ M2.6 | `<NavigationHUD />` com dados do GPS |
| Voz PT-BR | ✅ M2.7 | Web Speech API com TTS |
| Recalculo automático de rota | ✅ M2.9 | `isOffRoute()` + `useRerouting` |
| Tráfego em tempo real | ✅ Fase 4 | FCD (Floating Car Data) via probes GPS dos usuários |
| Rota plotada em 3D | ✅ M2.3 | deck.gl `PathLayer` azul elétrico sobre o mapa |

**Conclusão:** Para navegação turn-by-turn estilo Google Maps/Waze — o p2.md é completo e funciona.

---

### ❌ O que o plano atual NÃO cobre (nova demanda)

O usuário quer uma camada adicional: **visão sintética da rua em tempo real, plotada em 3D com cores de simulação**, usando câmera frontal (ADAS/dashcam). Isso é diferente do mapa de navegação — é um **modo de percepção do ambiente físico ao redor do carro**.

Analogia: Tesla Autopilot visualization — não mostra a câmera, mostra faixas, carros e guias desenhados como figuras geométricas coloridas.

---

## 🆕 Novo Módulo: NavSP Vision — Percepção ADAS + Renderização Sintética

### O que é e o que não é

| É | Não é |
|---|---|
| Detecção de faixas, veículos, guias, calçadas pela câmera | Vídeo real da câmera exibido na tela |
| Renderização 3D geométrica com cores de simulação | AR (realidade aumentada) sobreposta à câmera |
| Overlay sintético em tempo real durante a condução | Sistema de segurança (ADAS de alerta de colisão) |
| Complementa o mapa de navegação do p2.md | Substitui o mapa de navegação |

---

## 🏗️ Arquitetura Geral do Sistema Evoluído

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (PWA Mobile/Tablet)                       │
│                                                                          │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │    MAPA DE NAVEGAÇÃO        │  │    VISÃO SINTÉTICA (NavSP Vision) │  │
│  │  MapLibre GL JS (p2.md)     │  │  Three.js / React Three Fiber     │  │
│  │  Rota, GPS, HUD, Voz        │  │  Faixas, Veículos, Guias, Calçada│  │
│  │  Pitch 60°, bearing GPS     │  │  Cores simulação (sem câmera raw) │  │
│  └─────────────────────────────┘  └──────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PIPELINE DE PERCEPÇÃO                          │   │
│  │   getUserMedia() → frames → ONNX Runtime Web / TF.js             │   │
│  │   Lane Detection | Object Detection | Depth Estimation           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                              WebSocket                                   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ (fallback: backend processing)
┌─────────────────────────────────▼───────────────────────────────────────┐
│                    BACKEND VISION (FastAPI + CV)                         │
│  WebSocket endpoint → recebe frames JPEG → processa com PyTorch/ONNX    │
│  OpenCV + lane model + YOLO v8 + MiDaS depth                           │
│  Retorna: detections JSON → cliente renderiza em 3D                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📷 Fonte de Câmera — ADAS / Dashcam / Celular

O usuário mencionou câmera ADAS frontal (tipo dashcam de segurança).

### Opções de integração de câmera

| Fonte | Como capturar | Prós | Contras |
|---|---|---|---|
| **Câmera do próprio celular** (montado no para-brisa) | `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` | Sem hardware extra, direto no PWA | Câmera traseira do celular, limitado a 30fps no browser |
| **Câmera ADAS USB/IP** (dashcam em rede local) | `fetch` de stream MJPEG ou WebRTC local | Câmera melhor posicionada, qualidade superior | Requer configuração de rede local no carro |
| **ADAS via Bluetooth/USB** (ex.: câmeras ADAS aftermarket) | API nativa via React Native ou Capacitor | Integração total com câmera dedicada | Requer app nativo, não PWA puro |

### 🏆 Recomendação MVP
**Câmera do celular via `getUserMedia`** — funciona hoje no PWA, sem hardware adicional.  
Celular montado no suporte de para-brisa, câmera traseira apontada para a rua.

---

## 🧠 Pipeline de Percepção — Computer Vision em Tempo Real

### Três tarefas de visão computacional

```
Frame da câmera (720p, 15fps)
          │
          ├──► [1] LANE DETECTION  ──────► Coordenadas das faixas (polilinha 2D)
          │         UFLD / CLRNet          + tipo: faixa contínua, tracejada, guia
          │
          ├──► [2] OBJECT DETECTION ─────► Bounding boxes de veículos, pedestres
          │         YOLO v8 Nano           + classe (carro, moto, caminhão, pedestre)
          │         ou YOLOv11             + distância estimada
          │
          └──► [3] DEPTH ESTIMATION ─────► Mapa de profundidade 2D→3D
                    MiDaS Small            Converte detecções para posição 3D relativa
                    ou Depth Anything V2
```

### Estratégia de processamento: On-Device vs Backend

```
┌──────────────────────────────────────────────────────────────────┐
│                    DECISÃO DE PROCESSAMENTO                       │
│                                                                   │
│  ON-DEVICE (TF.js / ONNX.js)     BACKEND (Python + PyTorch)     │
│  ─────────────────────────────    ───────────────────────────    │
│  Lane Detection (UFLD nano)   → mais rápido (~30ms/frame)       │
│  Objetos (YOLO nano)          → sem latência de rede            │
│  Depth (MiDaS small)          → privacy-first (frame local)     │
│                                                                   │
│  Vantagem: latência <80ms, funciona sem internet                 │
│  Desvantagem: aquece o celular, modelos limitados               │
│                                                                   │
│  Se celular fraco → enviar frames ao backend via WebSocket      │
│  Backend com GPU processa e retorna detections JSON em ~50ms    │
└──────────────────────────────────────────────────────────────────┘
```

### Modelos ONNX recomendados (open source, licença permissiva)

| Tarefa | Modelo | Tamanho | Latência aprox. (mobile) |
|---|---|---|---|
| Detecção de faixas | UFLD-v2 (Ultra Fast Lane Detection) | ~7MB | ~25ms |
| Detecção de objetos | YOLOv8n (nano) ou YOLOv11n | ~6MB | ~30ms |
| Estimativa de profundidade | MiDaS Small (int8 quantizado) | ~12MB | ~40ms |
| Total (pipeline paralelo) | — | ~25MB | ~60–80ms |

**Todos exportáveis para ONNX → rodam no browser via `onnxruntime-web` com WebAssembly/WebGL.**

---

## 🎮 Camada de Renderização 3D Sintética — NavSP Vision

### Por que Three.js e não MapLibre/deck.gl para isso?

| Aspecto | MapLibre/deck.gl (p2.md) | Three.js + R3F (nova camada) |
|---|---|---|
| Propósito | Renderizar mapa geográfico + rota | Renderizar cena 3D sintética da rua |
| Sistema de coordenadas | Coordenadas GPS (WGS84) | Coordenadas relativas ao carro (metros) |
| Dados de entrada | Tiles vetoriais OSM + GeoJSON | Detecções da câmera (CV output) |
| Estilo visual | Cartográfico | Simulador / videogame |

**São duas camadas distintas que se complementam** — o mapa fica em um painel, a visão sintética em outro (ou em overlay 50% transparente).

### O que cada elemento renderiza

```
CENA 3D SINTÉTICA (câmera virtual atrás/acima do carro)
─────────────────────────────────────────────────────────

 [Faixas da via]
  • Geometria: PlaneGeometry longa e estreita
  • Cor: #FFFFFF (faixa contínua) | #FFDD00 (tracejada) | #FF4444 (guia/limite)
  • Posição: projetada da detecção 2D + depth map → 3D world space

 [Calçada / passeio]
  • Geometria: PlaneGeometry lateral, ligeiramente elevada (+0.1m)
  • Cor: #888888 (cinza claro)

 [Guard Rail / Guia de proteção]
  • Geometria: BoxGeometry estreita e alta (0.2m × 0.8m × comprimento)
  • Cor: #AAAAAA (prata metálico)

 [Outros Veículos]
  • Geometria: BoxGeometry proporcional (carro ~4.5m × 1.8m × 1.5m)
  • Cor por distância:
      < 10m  → #FF3300 (vermelho — alerta)
      10–30m → #FFAA00 (laranja — atenção)
      > 30m  → #00CC44 (verde — seguro)
  • Opacidade: 80%

 [Pista/Asfalto]
  • Geometria: PlaneGeometry grande, perspectiva em fuga
  • Cor: #1A1A2E (azul escuro estilo noite) | #2A2A2A (cinza escuro diurno)

 [Veículo do próprio usuário]
  • Silhueta simples do carro (sempre centralizada na cena)
  • Cor: #0066FF (azul)
```

### Stack de renderização

```
Three.js + React Three Fiber (R3F)
├── @react-three/fiber          — React bindings para Three.js
├── @react-three/drei           — helpers: câmera, luzes, geometrias
├── three                       — engine 3D WebGL
└── @react-three/postprocessing — efeitos: bloom nos veículos próximos
```

---

## 🔄 Fluxo de Dados: Câmera → Percepção → Renderização

```
1. getUserMedia() captura frame (720p, 15fps)
         │
2. Canvas offscreen → ImageData
         │
3. Pré-processamento:
   • Resize para 640×360 (modelo input size)
   • Normalize [0,1]
   • Converter para tensor Float32
         │
4. Inferência paralela (Web Workers, não bloqueia UI):
   ├── Worker 1: UFLD → lane_points[]  (polilíneas de faixas)
   ├── Worker 2: YOLOv8 → detections[] (bbox + classe + conf)
   └── Worker 3: MiDaS → depth_map[]  (tensor 2D de distâncias)
         │
5. Fusão de percepção:
   • Para cada detection: lookup depth_map na bbox center
   • Projeto perspectivo inverso → (x, y, z) relativo ao carro
   • Filtrar detections com conf < 0.4
         │
6. Postagem no estado React (zustand usePerceptionStore)
         │
7. Three.js re-render a 15fps:
   • Atualiza posições dos BoxGeometry (veículos)
   • Atualiza pontos dos PlaneGeometry (faixas)
   • Cor dos veículos baseada na distância Z
```

---

## 🖼️ Interface do Usuário — Layouts de Visualização

### Modo A — Split Screen (recomendado MVP)

```
┌─────────────────────────────────────────────┐
│        MAPA DE NAVEGAÇÃO (60% tela)          │
│   MapLibre 3D — rota, seta, HUD, GPS         │
│   pitch 60°, bearing segue o carro           │
├─────────────────────────────────────────────┤
│      VISÃO SINTÉTICA ADAS (40% tela)         │
│   Three.js — faixas, veículos, guias         │
│   Câmera virtual: 3m atrás, 2m acima do carro│
└─────────────────────────────────────────────┘
```

### Modo B — Overlay (alternativo)
- Mapa de navegação em tela cheia
- Visão sintética 3D em overlay com transparência 60%
- Botão toggle para alternar modos

### Modo C — Tela cheia ADAS (para foco na percepção)
- Apenas a cena 3D sintética + HUD mínimo de navegação (próxima manobra + distância)

---

## 📦 Evolução da Stack Tecnológica

### Frontend — Adições ao p2.md

| Tecnologia | Versão | Função |
|---|---|---|
| **three** | r160+ | Engine 3D WebGL para cena sintética |
| **@react-three/fiber** | 8+ | React renderer para Three.js |
| **@react-three/drei** | 9+ | Geometrias prontas, câmera helpers |
| **onnxruntime-web** | 1.18+ | Inferência ONNX no browser (WebAssembly + WebGL) |
| **@tensorflow/tfjs** | 4+ | Alternativa TF.js para modelos leves |
| **comlink** | 4+ | Comunicação com Web Workers (inferência non-blocking) |

### Backend — Adições ao p2.md

| Tecnologia | Versão | Função |
|---|---|---|
| **opencv-python-headless** | 4.9+ | Processamento de imagem (decode, resize, preprocess) |
| **onnxruntime** | 1.18+ | Inferência ONNX no servidor (CPU/GPU) |
| **torch** (opcional) | 2.3+ | Se quiser modelos PyTorch nativos |
| **numpy** | 1.26+ | Manipulação de tensores |
| **websockets** | 12+ | Stream bidirecional câmera ↔ backend |

### Docker — Novo serviço

```yaml
# docker-compose.yml (adição ao p2.md)
services:
  navsp-vision:
    build: ./vision-service
    ports:
      - "8765:8765"   # WebSocket endpoint
    environment:
      - MODEL_LANE=models/ufld_v2.onnx
      - MODEL_YOLO=models/yolov8n.onnx
      - MODEL_DEPTH=models/midas_small_int8.onnx
    volumes:
      - ./vision-service/models:/app/models
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]    # opcional, se tiver GPU
```

---

## 📁 Estrutura do Projeto — Adições ao p2.md

```
navsp/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Vision/                    # ← NOVO
│       │   │   ├── SyntheticScene.tsx     # Canvas Three.js principal
│       │   │   ├── LaneLines.tsx          # Renderiza faixas detectadas
│       │   │   ├── VehicleBox.tsx         # Renderiza veículos como boxes
│       │   │   ├── RoadSurface.tsx        # Asfalto simulado
│       │   │   ├── Guardrail.tsx          # Guard rails / guias
│       │   │   ├── SyntheticHUD.tsx       # Overlay de distâncias
│       │   │   └── __tests__/
│       │   └── Map/                       # Existente do p2.md
│       ├── hooks/
│       │   ├── useCameraStream.ts         # ← NOVO: getUserMedia wrapper
│       │   ├── usePerception.ts           # ← NOVO: orquestra workers de CV
│       │   └── __tests__/
│       ├── workers/                       # ← NOVO: Web Workers para inferência
│       │   ├── laneDetectionWorker.ts     # UFLD via ONNX
│       │   ├── objectDetectionWorker.ts   # YOLOv8 via ONNX
│       │   └── depthWorker.ts             # MiDaS via ONNX
│       ├── store/
│       │   └── usePerceptionStore.ts      # ← NOVO: estado das detecções
│       └── utils/
│           ├── projectionUtils.ts         # ← NOVO: 2D→3D projection math
│           └── perceptionFusion.ts        # ← NOVO: fusão lane+object+depth
│
├── vision-service/                        # ← NOVO: serviço backend de CV
│   ├── app/
│   │   ├── main.py                        # FastAPI + WebSocket endpoint
│   │   ├── models/
│   │   │   ├── lane_detector.py           # UFLD wrapper
│   │   │   ├── object_detector.py         # YOLO wrapper
│   │   │   └── depth_estimator.py         # MiDaS wrapper
│   │   ├── pipeline/
│   │   │   ├── frame_processor.py         # Orquestra os 3 modelos
│   │   │   └── perception_fusion.py       # Merge detections + depth
│   │   └── utils/
│   │       └── camera_math.py             # Projeção perspectiva inversa
│   ├── models/                            # Arquivos .onnx (não commitados)
│   │   ├── ufld_v2.onnx
│   │   ├── yolov8n.onnx
│   │   └── midas_small_int8.onnx
│   ├── tests/
│   │   ├── test_lane_detector.py
│   │   ├── test_object_detector.py
│   │   ├── test_depth_estimator.py
│   │   ├── test_frame_processor.py
│   │   └── test_perception_fusion.py
│   ├── requirements.txt
│   └── Dockerfile
│
└── (restante igual ao p2.md)
```

---

## 📊 Modelo de Dados — Adições ao p2.md

```sql
-- Calibração de câmera por usuário (necessária para projeção 3D precisa)
CREATE TABLE camera_calibration (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    -- Parâmetros intrínsecos
    focal_length_px REAL,
    principal_x     REAL,
    principal_y     REAL,
    -- Parâmetros extrínsecos (posição do celular no para-brisa)
    mount_height_m  REAL DEFAULT 1.3,    -- altura do celular do chão
    mount_pitch_deg REAL DEFAULT 0.0,    -- ângulo de inclinação
    -- Dimensões da imagem
    frame_width_px  INTEGER DEFAULT 1280,
    frame_height_px INTEGER DEFAULT 720,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Log de detecções (para tuning / debugging)
CREATE TABLE perception_logs (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    frame_ts    TIMESTAMPTZ NOT NULL,
    detections  JSONB NOT NULL,           -- { lanes: [...], objects: [...] }
    latency_ms  INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);
-- Particionamento diário, manter 7 dias de logs
```

---

## 🚀 Fases de Implementação Evoluídas

> As Fases 0–5 do p2.md permanecem **idênticas e válidas**. As fases abaixo são **adicionadas**.

---

### FASE 6 — Camera Stream + Percepção On-Device (MVP Vision)

**M6.1 — Hook `useCameraStream`**
- `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 15, facingMode: 'environment' } })`
- Retorna `MediaStream` + `HTMLVideoElement` ref
- Controle: `start()` / `stop()` / estado `{ streaming, error }`
- Verificar suporte do browser antes de ativar
- **Testes:** `useCameraStream.test.ts`:
  - `test_starts_stream_successfully` — mock `getUserMedia`
  - `test_returns_error_when_permission_denied`
  - `test_stops_stream_tracks_on_stop`
  - `test_returns_not_supported_when_api_unavailable`

**M6.2 — Web Workers: carregamento dos modelos ONNX**
- `laneDetectionWorker.ts`: carrega `ufld_v2.onnx` via `ort.InferenceSession.create()`
- `objectDetectionWorker.ts`: carrega `yolov8n.onnx`
- `depthWorker.ts`: carrega `midas_small_int8.onnx`
- Comunicação via `Comlink` (proxy assíncrono entre main thread e worker)
- Estratégia de carregamento: lazy (só carrega quando Vision Mode ativo)
- **Testes:** `*.worker.test.ts`:
  - `test_loads_model_on_init` — mock `ort.InferenceSession`
  - `test_returns_inference_result`
  - `test_handles_model_load_failure`

**M6.3 — Frame capture pipeline**
- Utilitário `captureFrame(videoEl: HTMLVideoElement): ImageData`
- Canvas offscreen → `drawImage` → `getImageData`
- Normalize + reshape para tensor input de cada modelo
- Throttle: processa apenas 1 frame a cada 66ms (~15fps)
- **Testes:** `frameCapture.test.ts`:
  - `test_captures_image_data_from_video`
  - `test_throttles_to_15fps`
  - `test_preprocesses_tensor_correctly`

**M6.4 — Lane Detection (UFLD)**
- Input: tensor `[1, 3, 288, 800]` (RGB normalizado)
- Output: lista de polilíneas `[{ points: [{x,y}], type: 'solid'|'dashed'|'boundary' }]`
- Post-processing: filtrar confiança < 0.5, interpolar pontos
- **Testes:** `laneDetectionWorker.test.ts`:
  - `test_returns_lane_polylines`
  - `test_filters_low_confidence_lanes`
  - `test_handles_no_lanes_detected`
  - `test_classifies_solid_vs_dashed`

**M6.5 — Object Detection (YOLOv8n)**
- Input: tensor `[1, 3, 640, 640]`
- Output: `[{ class: 'car'|'truck'|'motorcycle'|'person', bbox: {x1,y1,x2,y2}, confidence }]`
- Post-processing: NMS (Non-Maximum Suppression), filtrar classes irrelevantes
- **Testes:** `objectDetectionWorker.test.ts`:
  - `test_detects_cars_in_frame`
  - `test_applies_nms_correctly`
  - `test_filters_pedestrians_outside_road_area`
  - `test_handles_empty_frame`

**M6.6 — Depth Estimation (MiDaS Small)**
- Input: tensor `[1, 3, 256, 256]`
- Output: depth map `[256, 256]` com valores relativos (maior = mais longe)
- Calibração: converter profundidade relativa para metros usando `mount_height_m` do usuário
- **Testes:** `depthWorker.test.ts`:
  - `test_returns_depth_map_tensor`
  - `test_converts_relative_depth_to_meters`
  - `test_handles_uniform_surface_correctly`

**M6.7 — Fusão de percepção: 2D → 3D**
- Utilitário `projectToWorld(bbox_center: {x,y}, depth_m: number, calibration): Vec3`
- Fórmula de projeção perspectiva inversa:
  ```
  X = (x - cx) * depth / fx
  Y = (y - cy) * depth / fy
  Z = depth
  ```
  onde `cx, cy` = centro da imagem, `fx, fy` = focal length
- Output: posição 3D relativa ao carro `(X, Y, Z)` em metros
- **Testes:** `projectionUtils.test.ts`:
  - `test_projects_center_point_correctly`
  - `test_projects_left_point_to_negative_X`
  - `test_depth_maps_to_Z_axis`
  - `test_handles_zero_depth`

**M6.8 — Store Zustand: `usePerceptionStore`**
- Estado: `{ lanes: Lane[], vehicles: Vehicle[], isActive: boolean }`
- `Vehicle: { id, position3d: Vec3, class, distance_m, confidence }`
- `Lane: { points3d: Vec3[], type }`
- Atualiza a 15fps via `requestAnimationFrame`
- **Testes:** `usePerceptionStore.test.ts`:
  - `test_updates_lanes_on_new_detection`
  - `test_updates_vehicles_on_new_detection`
  - `test_clears_state_when_deactivated`

---

### FASE 7 — Renderização 3D Sintética (NavSP Vision Scene)

**M7.1 — Canvas Three.js: `<SyntheticScene />`**
- `<Canvas>` do React Three Fiber (canvas WebGL separado do MapLibre)
- Câmera virtual: `PerspectiveCamera` com `position={[0, 3, -8]}` (3m acima, 8m atrás do carro)
- Iluminação: `AmbientLight` (0.4) + `DirectionalLight` (0.8, de cima)
- Background: `#0D0D1A` (azul escuro noturno) ou `#1A1A1A` (cinza diurno, baseado na hora)
- **Testes:** `SyntheticScene.test.tsx`:
  - `test_renders_canvas_element`
  - `test_applies_dark_background`
  - `test_camera_position_is_behind_vehicle`

**M7.2 — `<RoadSurface />`**
- `PlaneGeometry(20, 80)` rotacionado em X (horizontal) — representa o asfalto à frente
- Material: `MeshStandardMaterial({ color: '#1A1A2E', roughness: 0.9 })`
- Faixas brancas pintadas diretamente na textura (procedural)
- Atualiza perspectiva baseado no heading GPS (rotaciona a cena conforme curvas)
- **Testes:** `RoadSurface.test.tsx`:
  - `test_renders_plane_geometry`
  - `test_applies_road_color`
  - `test_rotates_with_vehicle_heading`

**M7.3 — `<LaneLines />` (faixas detectadas)**
- Para cada `Lane` do `usePerceptionStore`:
  - Cria `TubeGeometry` ou `LineSegments` seguindo os `points3d`
  - Cor: `#FFFFFF` (faixa sólida) | `#FFDD00` (tracejada) | `#FF4444` (guia/limite)
  - Largura: 0.12m simulada via tube geometry
- Animação suave: interpola posição entre frames (lerp 0.3)
- **Testes:** `LaneLines.test.tsx`:
  - `test_renders_one_mesh_per_lane`
  - `test_applies_white_color_for_solid`
  - `test_applies_yellow_for_dashed`
  - `test_applies_red_for_boundary`
  - `test_interpolates_position_smoothly`

**M7.4 — `<VehicleBox />` (outros veículos)**
- Para cada `Vehicle` do `usePerceptionStore`:
  - `BoxGeometry(1.8, 1.5, 4.5)` posicionado em `position3d`
  - Cor por distância:
    - `distance_m < 10` → `#FF3300` + bloom effect
    - `distance_m < 30` → `#FFAA00`
    - `distance_m >= 30` → `#00CC44`
  - Material: `MeshStandardMaterial({ transparent: true, opacity: 0.8 })`
  - Escala proporcional à classe (caminhão = 1.5× escala)
- **Testes:** `VehicleBox.test.tsx`:
  - `test_renders_box_at_correct_position`
  - `test_applies_red_color_when_close`
  - `test_applies_orange_when_medium`
  - `test_applies_green_when_far`
  - `test_scales_larger_for_trucks`

**M7.5 — `<Guardrail />` (guard rails e guias)**
- Detectados como linha de limite (`boundary`) do UFLD
- `BoxGeometry(0.2, 0.8, comprimento)` ao longo da polilinha da guia
- Material: `MeshStandardMaterial({ color: '#AAAAAA', metalness: 0.6 })`
- **Testes:** `Guardrail.test.tsx`:
  - `test_renders_along_boundary_lane`
  - `test_applies_metallic_material`

**M7.6 — `<EgoVehicle />` (silhueta do carro do usuário)**
- Silhueta simples do carro (`BoxGeometry(1.8, 1.4, 4.2)`) sempre no centro da cena
- Cor: `#0066FF` com `wireframe: false`, bordas iluminadas
- Não se move (câmera virtual é que gira ao redor)
- **Testes:** `EgoVehicle.test.tsx`:
  - `test_renders_at_origin`
  - `test_applies_blue_color`

**M7.7 — `<SyntheticHUD />` (overlay HTML sobre o canvas 3D)**
- Distância do veículo mais próximo: "⚠️ 8m" em destaque se < 15m
- Número de faixas detectadas: "2 faixas"
- Indicador de status dos modelos: ícone verde/vermelho/carregando
- **Testes:** `SyntheticHUD.test.tsx`:
  - `test_shows_nearest_vehicle_distance`
  - `test_highlights_warning_when_close`
  - `test_shows_lane_count`
  - `test_shows_model_loading_indicator`

---

### FASE 8 — Integração Mapa + Visão (Layout Final)

**M8.1 — Split Screen container**
- Componente `<NavigationLayout />` com dois painéis redimensionáveis
- Painel superior (60%): `<MapView />` do p2.md (navegação turn-by-turn)
- Painel inferior (40%): `<SyntheticScene />` (percepção ADAS)
- Botão toggle para alternar layouts (split / mapa full / visão full)
- **Testes:** `NavigationLayout.test.tsx`:
  - `test_renders_both_panels`
  - `test_toggles_to_map_full`
  - `test_toggles_to_vision_full`

**M8.2 — Sincronização de heading entre painéis**
- O heading GPS (p2.md `useGeolocation`) alimenta TANTO o bearing do MapLibre QUANTO a rotação da cena Three.js
- Zustand store compartilhado: `useNavigationStore.heading`
- **Testes:** `headingSync.test.ts`:
  - `test_heading_updates_maplibre_bearing`
  - `test_heading_updates_threejs_scene_rotation`
  - `test_both_panels_show_same_heading`

**M8.3 — Detecção de veículos à frente no mapa**
- Veículos detectados pela câmera com distância < 50m → criar marcador temporário no MapLibre
- Calcular GPS do veículo usando: `GPS_atual + offset(heading, distância)`
- Exibir como ícone 🚗 no mapa de navegação
- **Testes:** `vehicleMapMarker.test.ts`:
  - `test_creates_marker_for_nearby_vehicles`
  - `test_calculates_gps_offset_correctly`
  - `test_removes_marker_when_vehicle_disappears`

---

### FASE 9 — Backend Vision Service (fallback para celulares fracos)

**M9.1 — WebSocket endpoint no backend**
- `WS /ws/vision` (FastAPI WebSocket)
- Recebe: frames JPEG comprimidos (base64 ou binary)
- Processa: pipeline ONNX (lane + yolo + midas)
- Retorna: JSON com `{ lanes, vehicles, latency_ms }`
- Rate limit: máx 15fps por conexão
- **Testes:** `test_vision_ws.py`:
  - `test_websocket_accepts_connection`
  - `test_processes_frame_and_returns_detections`
  - `test_rate_limits_to_15fps`
  - `test_returns_error_on_invalid_frame`

**M9.2 — Detector de faixas (backend Python)**
- Classe `LaneDetector(model_path: str)`
- `detect(frame: np.ndarray) -> List[Lane]`
- Usa `onnxruntime.InferenceSession`
- **Testes:** `test_lane_detector.py`:
  - `test_loads_model_successfully`
  - `test_returns_lanes_for_valid_frame`
  - `test_handles_empty_frame`
  - `test_filters_low_confidence`

**M9.3 — Detector de objetos (backend Python)**
- Classe `ObjectDetector(model_path: str)`
- `detect(frame: np.ndarray) -> List[Detection]`
- NMS implementado com `cv2.dnn.NMSBoxes`
- **Testes:** `test_object_detector.py`:
  - `test_detects_vehicle_in_frame`
  - `test_applies_nms`
  - `test_returns_correct_classes`
  - `test_confidence_threshold_filters`

**M9.4 — Estimador de profundidade (backend Python)**
- Classe `DepthEstimator(model_path: str)`
- `estimate(frame: np.ndarray) -> np.ndarray` (depth map float32)
- **Testes:** `test_depth_estimator.py`:
  - `test_returns_depth_map_same_dimensions`
  - `test_depth_values_are_positive`
  - `test_handles_uniform_color_frame`

**M9.5 — Frame processor (pipeline completo)**
- Classe `FrameProcessor(lane, object, depth detectors)`
- `process(jpeg_bytes: bytes) -> PerceptionResult`
- Roda os 3 modelos e fusiona os resultados
- **Testes:** `test_frame_processor.py`:
  - `test_processes_full_pipeline`
  - `test_fuses_depth_with_detections`
  - `test_returns_latency_measurement`
  - `test_handles_corrupt_jpeg`

---

## ⚠️ Limitações e Considerações Importantes

### Limitações Técnicas

| Limitação | Impacto | Mitigação |
|---|---|---|
| Celular pode superaquecer com inferência contínua | Degradação de performance | Reduzir para 10fps, pausar se temp > threshold |
| Precisão do depth monocular é ~15–30% de erro | Distâncias imprecisas | Mostrar range (ex: "8–12m") em vez de valor exato |
| UFLD pode falhar em vias sem marcação (comum em SP) | Faixas não detectadas | Fallback: mostrar apenas asfalto e veículos |
| YOLO nano tem menor precisão que modelos grandes | Falsos positivos/negativos | Threshold de confiança ≥ 0.5, múltiplos frames |
| getUserMedia não disponível em todos browsers | Sem câmera = sem Vision Mode | Feature detection + graceful degradation |
| Câmera traseira do celular ≠ câmera ADAS de carro | Ângulo de visão diferente | Calibração manual de altura e pitch |

### Considerações Legais / Segurança

> ⚠️ **AVISO IMPORTANTE:** Este sistema é uma **ferramenta de visualização experimental**, NÃO um sistema de segurança ADAS certificado. Não deve ser usado para tomada de decisões de segurança de trânsito. Exibir aviso explícito ao usuário na primeira ativação do Vision Mode.

### Performance Target

| Métrica | Target |
|---|---|
| Pipeline de percepção (on-device) | < 80ms por frame |
| Re-render Three.js | < 16ms (60fps) |
| Latência WebSocket (backend mode) | < 120ms |
| Consumo de bateria (1h de uso) | < 30% (celular moderno) |
| RAM usada pelos modelos ONNX | < 150MB |

---

## 🔬 MICRO IMPLEMENTAÇÕES — Resumo das Fases Novas

| Fase | Itens | Prioridade |
|---|---|---|
| Fase 6 — Camera + Percepção On-Device | M6.1 – M6.8 | Alta (MVP Vision) |
| Fase 7 — Renderização 3D Sintética | M7.1 – M7.7 | Alta (MVP Vision) |
| Fase 8 — Integração Mapa + Visão | M8.1 – M8.3 | Média |
| Fase 9 — Backend Vision (fallback) | M9.1 – M9.5 | Baixa (para celulares fracos) |

---

## 📋 Dependências entre as Fases Novas

```
Fase 0–5 (p2.md) → obrigatório antes de qualquer fase nova
       │
       ├──► M6.1 (useCameraStream) → M6.2 (workers) → M6.3 (frame capture)
       │         │
       │         ├──► M6.4 (lane) ─┐
       │         ├──► M6.5 (yolo) ─┤──► M6.7 (fusão 3D) → M6.8 (store)
       │         └──► M6.6 (depth)─┘
       │                                     │
       └──► M7.1 (canvas) ──────────────────►├──► M7.2 (road) → M7.3 (lanes) → M7.4 (vehicles) → M7.5 (guardrails)
                                              │
                                         M7.6 (ego) + M7.7 (HUD)
                                              │
                                         M8.1 (split screen) → M8.2 (heading sync) → M8.3 (markers)
                                              │
                                         M9.1–M9.5 (backend fallback — independente)
```

---

## 🏁 Resumo Executivo

| Pergunta | Resposta |
|---|---|
| O plano p2.md funciona para navegação estilo Google Maps? | **✅ Sim, totalmente** — MapLibre 3D + GPS + HUD + voz + rerouting já cobrem isso |
| Como o usuário navega a rota enquanto dirige? | **GPS feed → bearing/pitch no MapLibre → câmera 3D segue o carro suavemente** |
| Como desenhar a rua, guias, calçadas e veículos em tempo real? | **Câmera ADAS (celular) → ONNX models → detecções 3D → Three.js scene** |
| Como funciona sem mostrar a imagem real da câmera? | **Detecções → geometrias 3D coloridas (boxes, planes, tubes) — estilo Tesla/simulador** |
| Qual câmera usar? | **MVP: câmera do celular via getUserMedia; futuro: câmera ADAS dedicada** |
| On-device ou backend? | **Preferência on-device (privacidade + latência); backend como fallback** |
| Mudança na stack do p2.md? | **Adiciona: Three.js + R3F + ONNX Runtime Web + vision-service Python** |
