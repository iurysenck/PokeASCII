# 🗺️ ROADMAP — PokéStudy AR

> Projeto **aberto, de estudo, sem fins lucrativos**, sem gacha, sem loot paga e **sem dinheiro real dentro do jogo**.
> Este arquivo é a fonte única de progresso: marque `- [x]` ao concluir e rode `docs/roadmap_progress.ps1` para atualizar a tabela (ou edite à mão).
> Documentos relacionados: [FEATURES_REFERENCE](FEATURES_REFERENCE.md) · [CREDITS_AND_LICENSES](CREDITS_AND_LICENSES.md) · [CROWDFUNDING_PLAN](CROWDFUNDING_PLAN.md) · [DEPLOY_GITHUB](DEPLOY_GITHUB.md) · [MULTIPLAYER_ARCHITECTURE](MULTIPLAYER_ARCHITECTURE.md)

## 📊 Status geral

<!-- PROGRESS:START -->
| Fase | Nome | Feitas | Total | % | Estado |
|---|---|---:|---:|---:|---|
| v0.0 | Fundação (já existe hoje) | 8 | 8 | 100% | ✅ concluída |
| v0.1 | "Jogável no GitHub" (web, offline, 1 jogador) | 1 | 27 | 4% | 🚧 em andamento |
| v0.2 | Caminhar, evoluir, explorar | 0 | 10 | 0% | ⏳ não iniciada |
| v0.3 | Combate PvE e mundo vivo | 0 | 7 | 0% | ⏳ não iniciada |
| v0.4 | Servidor (multiplayer) | 0 | 10 | 0% | ⏳ não iniciada |
| v1.0 | Terminal ASCII nativo (FUTURO, opcional) | 0 | 4 | 0% | 🔮 futuro opcional |
| **Total (sem v1.0)** | | **9** | **62** | **15%** | |
<!-- PROGRESS:END -->

Legenda de estado: ✅ concluída · 🚧 em andamento · ⏳ não iniciada · 🔮 futuro opcional.

**Definição de "etapa jogável para o GitHub" = v0.1.** Quando todos os itens da v0.1 estiverem `[x]`, o jogo abre em `https://<usuario>.github.io/<repo>/` (HTTPS), roda no iPhone/Android/PC, **sem servidor, sem conta, sem pagamento**, com câmera ao vivo opcional. Detalhes em [DEPLOY_GITHUB](DEPLOY_GITHUB.md#etapa-jogavel-para-o-github--v01).

---

## v0.0 — Fundação (já existe hoje)

- [x] Motor C++20 nativo em terminal (evolução do projeto `aquario` → `pokemon_ar`): módulos `math`, `mesh`, `renderer` (GPU/Vulkan), `postproc` ASCII, `tracker` AR, `tty` (ANSI TrueColor)
- [x] Jogo de captura em C++ (`src/game/ar_game.cpp`) e pré-visualização (`pokemon_ar_preview`)
- [x] Testes unitários C++ (`tests/test_math`, `test_mesh`, `test_renderer`, `test_tracker`, `test_tty`, `test_postproc`)
- [x] Protótipo web antigo (`web/legacy/prototipo-v0.html`) — referência de lógica, será substituído
- [x] Estado, dados e integração PokeAPI no web novo (`web/js/state.js`, `web/js/data.js`)
- [x] Logo (`web/assets/logo.svg`), favicon (`web/favicon.svg`) e `manifest.webmanifest`
- [x] Documentação base: `docs/*.md`, `README.md`, `LICENSE` (MIT), `NOTICE.md`
- [x] Workflow GitHub Pages criado (`.github/workflows/pages.yml`)

## v0.1 — "Jogável no GitHub" (web, offline, 1 jogador)

Meta: qualquer pessoa abre a URL pública e joga o ciclo completo *criar personagem → andar → encontrar → arremessar → capturar → evoluir coleção*.

### Entrada e perfil
- [ ] Tela inicial (splash + título + menu: Jogar, Créditos, Configurações)
- [ ] Cadastro **só com nome**, 100% offline (`localStorage`/IndexedDB; sem e-mail, sem senha)
- [ ] Criação de personagem **homem/mulher** (avatar ASCII/low-poly original)
- [ ] Personalização: cabelo, pele, roupa, boné/acessório, cores
- [ ] Perfil do treinador (nível, XP, estatísticas, medalhas)

### Mundo
- [ ] Mapa da cidade (grade/ruas estilizadas, canvas) com avatar
- [ ] Joystick virtual (touch) + teclado (WASD/setas) + opção GPS real (opt-in)
- [ ] Spawn de Pokémon **determinístico por célula + hora** (mesma semente → mesmos spawns; base do multiplayer futuro)
- [ ] Indicadores no mapa (sombras de Pokémon próximos, raridade, tempo restante)

### Encontro e captura
- [ ] Encontro AR **com câmera ao vivo** (`getUserMedia` + giroscópio, HTTPS)
- [ ] Encontro AR **sem câmera** (fundo gerado + giroscópio ou arrasto) — fallback obrigatório
- [ ] Arremesso com física: rotação (spin), curva (curveball) e alvo em anel
- [ ] Qualidade do arremesso **Nice / Great / Excellent** (anel encolhendo) com bônus de chance e XP
- [ ] Captura: fórmula de chance, balançar 1–3x, fuga, cliques de bola
- [ ] Bolas (3 tipos) e bagas (Razz / Nanab / Pinap equivalentes originais) com efeitos

### Coleção e economia (só moeda do jogo)
- [ ] Pokédex (visto/capturado, filtros, detalhes via PokeAPI com cache local)
- [ ] Mochila (itens, uso, descarte)
- [ ] Loja **somente com moeda do jogo** (ganha jogando; nenhuma compra com dinheiro real)
- [ ] Passe de batalha **grátis** (trilha única, sem trilha paga)
- [ ] Missões diárias (3/dia, renovam à meia-noite local) + conquistas básicas

### Plataforma
- [ ] PWA: manifest + service worker + funciona offline após 1º acesso
- [x] Favicon e logo
- [ ] Cache local da PokeAPI (IndexedDB) respeitando a política de uso justo
- [ ] Tela de **Créditos e Aviso Legal** dentro do jogo (link para NOTICE/licenças)
- [ ] Publicar no GitHub Pages (ativar *Settings → Pages → Source: GitHub Actions*) e validar URL HTTPS
- [ ] Testes de permissão em iPhone (Safari e Chrome iOS) e Android (Chrome)
- [ ] Acessibilidade mínima (contraste, tamanho de fonte, reduzir movimento, modo sem câmera)

## v0.2 — Caminhar, evoluir, explorar

- [ ] Pokémon **parceiro/buddy** exibido no mapa e no AR
- [ ] Caminhada → **doces** (1/3/5/20 km conforme espécie; estado "empolgado" reduz distância)
- [ ] **Poeira estelar** (ganhar capturando/chocando/missões) e **Power Up**
- [ ] **Evoluir** (doces por espécie; evoluções especiais por item/distância)
- [ ] **Ovos** (2/5/10 km) com incubadoras; distância por GPS real ou passos simulados
- [ ] **Pontos de Parada** a partir do OpenStreetMap (Overpass → cache; filtros de segurança)
- [ ] Mapa real com tiles legais (OpenFreeMap/PMTiles + MapLibre), atribuição "© OpenStreetMap contributors"
- [x] **Clima** (Open-Meteo) afetando spawns e visual — `web/js/weather.js`: céu/nuvens/estrelas por horário e clima reais, chuva/garoa/neve/névoa/tempestade (relâmpago respeita `prefers-reduced-motion`), tipos favorecidos x1.8; toque na pílula `[CLIMA]` simula outros climas
- [ ] Anti-abuso de caminhada (limite de velocidade: acima de ~10 m/s não conta)
- [ ] Modo "Caminhada comunitária": metas semanais de distância (local, sem servidor)

## v0.3 — Combate PvE e mundo vivo

- [ ] **Ginásios** locais (PvE contra treinadores NPC, selos bronze/prata/ouro)
- [ ] **Raids** PvE (chefe, tempo limite, captura bônus)
- [ ] **Vilões** estilo Equipe Rocket (originais: nome, uniforme e falas próprias), recrutas, líderes, chefe
- [ ] Pokémon "sombrio/corrompido" + purificação (mecânica própria)
- [ ] **Batalhas treinador PvE** (3×3, tipos, golpes rápido/carregado, escudos)
- [ ] Motor de batalha determinístico e testado (base para PvP)
- [ ] Missões de pesquisa / eventos temporários locais (sem FOMO pago)

## v0.4 — Servidor (multiplayer)

Requer decisão de hospedagem e plano de privacidade — ver [MULTIPLAYER_ARCHITECTURE](MULTIPLAYER_ARCHITECTURE.md) e [CROWDFUNDING_PLAN](CROWDFUNDING_PLAN.md).

- [ ] Login simples (apelido + código/passkey; sem dado pessoal; opcional OAuth)
- [ ] Servidor WebSocket com salas por célula geográfica (encontros compartilhados)
- [ ] Lista de **amigos** (código de amizade) e presença
- [ ] **Trocas** (transação atômica + custo em poeira estelar; sem dinheiro real)
- [ ] **Batalhas PvP** (servidor autoritativo, ligas Pequena/Grande/Mestre)
- [ ] Ranking sazonal e passe sazonal (grátis)
- [ ] Anti-cheat básico (validação de velocidade GPS, rate limit, servidor autoritativo)
- [ ] Moderação: denúncia, bloqueio, filtros de nome, sem chat livre para menores
- [ ] Política de privacidade/LGPD publicada e consentimento parental onde aplicável
- [ ] Painel de transparência de custos (Open Collective)

## v1.0 — 🔮 Terminal ASCII nativo (FUTURO, opcional)

- [ ] Cliente C++ nativo no terminal conectado ao servidor (reuso de `pokemon_ar_game`)
- [ ] Terminal web (xterm.js + renderer ASCII em WebAssembly/Canvas)
- [ ] Pacote de dados e criaturas originais completo (ver plano de mitigação)
- [ ] Empacotamento (winget/Scoop/Homebrew) e releases assinados
