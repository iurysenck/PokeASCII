# 📜 CREDITS_AND_LICENSES — Créditos e licenças

> Este arquivo lista **tudo o que usamos ou planejamos usar** e sob qual licença. Atualize-o a cada nova dependência.
> Pesquisa em 2026-11-26. Links são páginas canônicas das fontes; **confirme a versão atual da licença antes de redistribuir**.

## ⚖️ AVISO LEGAL

**PokéStudy AR é um projeto de estudo, independente, sem fins lucrativos, sem afiliação, patrocínio ou endosso de Nintendo, Game Freak, Creatures Inc., The Pokémon Company (TPC), The Pokémon Company International, Niantic ou Scopely.**

- *Pokémon*, os nomes, personagens, sprites, artworks, sons e demais elementos relacionados são **marcas registradas e/ou propriedade** de Nintendo, Game Freak, Creatures Inc. e The Pokémon Company. Todos os direitos reservados aos seus titulares.
- *Pokémon GO* é produto de Niantic/Scopely/TPC; **não usamos** código, dados, servidores, APIs não oficiais nem assets dele.
- O **código-fonte** deste repositório é licenciado sob **MIT** ([LICENSE](../LICENSE)). A licença MIT **não** se estende a nenhum conteúdo de terceiros — em especial **sprites, artworks, nomes e dados de Pokémon, que não são nossos para licenciar**.
- O jogo **não vende** Pokémon, itens ou vantagens; **não há dinheiro real** dentro dele. Eventuais doações voluntárias ao projeto (ver [CROWDFUNDING_PLAN](CROWDFUNDING_PLAN.md)) **não dão direito a qualquer conteúdo de terceiros**.
- Se você é titular de direitos e deseja remoção de algum conteúdo, abra uma *issue* ou escreva ao contato do repositório; atenderemos com prioridade.
- Isto **não é aconselhamento jurídico**.

---

## 1. Dados e imagens de Pokémon

| Recurso | Uso | Licença / status | Fonte |
|---|---|---|---|
| **PokeAPI** (código e infraestrutura) | Dados de espécies, tipos, golpes, evoluções | **BSD-3-Clause** (código). Dados são fatos agregados; os *direitos sobre os nomes/IP* permanecem com os titulares | https://github.com/PokeAPI/pokeapi · https://pokeapi.co/docs/v2 |
| **PokeAPI/sprites** | Sprites/artworks por URL ou espelho local | Repositório de compilação; **imagens são propriedade de Nintendo/Game Freak/Creatures/TPC**. A licença do repositório **não licencia** o conteúdo | https://github.com/PokeAPI/sprites |
| Nomes e dados de Pokémon | Exibição na Pokédex | Marca/IP de terceiros. Uso aqui é **de estudo, não comercial**; ver plano de mitigação (pacote de dados opcional) | https://www.pokemon.com/us/legal/ |

### Política de uso justo da PokeAPI (obrigatório seguir)
Fonte: https://pokeapi.co/docs/v2 (seção *Fair Use Policy*)
1. **Cachear localmente** todo recurso solicitado (IndexedDB + Cache Storage do service worker). Nunca refazer pedido igual.
2. Limitar paralelismo (3–5 requisições simultâneas), com espaçamento e *backoff exponencial*.
3. Não "hotlinkar" sprites em massa; preferir espelho próprio (ver risco legal) ou carregar sob demanda e cachear.
4. Não revender a API nem apresentá-la como nossa. Citar a PokeAPI nos créditos do jogo.
5. Abuso (rajadas/DoS) pode levar a bloqueio de IP.
6. Considerar **doar à PokeAPI** (https://github.com/sponsors/PokeAPI) se o tráfego crescer.

**Boas práticas do projeto:** pré-baixar um *snapshot* mínimo (id, nome, tipos, stats, cadeia de evolução) em um arquivo JSON versionado, em vez de consultar a API em tempo de jogo.

## 2. Mapas e dados geográficos

### OpenStreetMap
- **Licença dos dados: ODbL 1.0** — https://opendatacommons.org/licenses/odbl/1-0/ · https://www.openstreetmap.org/copyright
- **Atribuição obrigatória, visível no mapa:** `© OpenStreetMap contributors` com link para https://www.openstreetmap.org/copyright (diretrizes: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).
- **Compartilhamento pela mesma licença:** bancos derivados (ex.: nossa lista de Pontos de Parada extraída do OSM) ficam sob ODbL se redistribuídos.
- **Política de tiles `tile.openstreetmap.org`** — https://operations.osmfoundation.org/policies/tiles/
  - Uso "pesado" **proibido** sem permissão; o servidor é mantido por doações e **não é para apps de massa**.
  - Enviar `User-Agent` identificável **ou** `Referer` válido (web); não mascarar.
  - Respeitar cache HTTP; ≥ 7 dias se não conseguir ler cabeçalhos; **proibido** pré-baixar regiões inteiras.
  - Violação → bloqueio sem aviso (tile de erro / HTTP 403).
  - **Decisão:** em produção **não usar** `tile.openstreetmap.org` como mapa do jogo. Usar as alternativas abaixo.

### Alternativas de mapa

| Opção | Licença | Notas | Fonte |
|---|---|---|---|
| **OpenFreeMap** | Código MIT; dados ODbL; estilo/esquema OpenMapTiles CC-BY 4.0 | Tiles vetoriais gratuitos, sem chave, sem cadastro; atribuição exigida | https://openfreemap.org |
| **Protomaps / PMTiles** | Especificação CC0; ferramentas BSD-3; design do basemap CC0; dados ODbL | Arquivo único estático hospedável no GitHub Pages/Cloudflare R2; sem servidor de tiles | https://protomaps.com · https://docs.protomaps.com/pmtiles/ |
| **MapLibre GL JS** | BSD-3-Clause | Renderizador vetorial (fork aberto do Mapbox GL v1) | https://maplibre.org · https://github.com/maplibre/maplibre-gl-js |
| **Leaflet** | BSD-2-Clause | Mapa raster simples e leve | https://leafletjs.com · https://github.com/Leaflet/Leaflet |
| Provedores comerciais de tiles OSM (Stadia, Jawg, Thunderforest, MapTiler) | Termos próprios | Têm plano gratuito limitado; exigem chave e atribuição | sites dos provedores |

### Overpass API
- Dados OSM sob ODbL. **Política de uso:** https://dev.overpass-api.de/overpass-doc/en/preface/commons.html · https://wiki.openstreetmap.org/wiki/Overpass_API
- Guia: uso casual < ~10 000 consultas/dia e < 1 GB/dia; uso automatizado regular **muito menor**; **o total conta por aplicativo**, não por usuário; identificar com `User-Agent`/`Referer`; no máx. 2 slots simultâneos por IP; em 429/504 aguardar.
- **Decisão:** não consultar Overpass a partir do cliente de cada jogador em massa. Gerar **arquivos estáticos de Pontos de Parada por cidade** (script offline) e publicá-los no próprio site; o cliente só lê JSON estático.

### Clima (planejado v0.2)
- **Open-Meteo** — dados CC BY 4.0; API gratuita para uso não comercial com atribuição — https://open-meteo.com/en/license *(verificar limites atuais)*.

## 3. Referências de conteúdo (somente consulta)

| Fonte | Licença | Como usamos |
|---|---|---|
| **Bulbapedia** | **CC BY-NC-SA 2.5** — https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights | **Só referência.** Não copiamos texto. Se algum trecho for adaptado, creditar, manter BY-NC-SA e **não comercial** (o que conflita com nossa licença MIT para o código — por isso **não** adaptamos) |
| **PokéWiki** (PT/DE) | Verificar (geralmente CC BY-NC-SA) | Só referência |
| Pokémon GO Hub, LeekDuck, Serebii, Pokémon GO Wiki (Fandom) | © dos autores; Fandom CC BY-SA | Só leitura para entender mecânicas; **sem cópia** de texto/imagens |
| Pokémon GO oficial | © Niantic/TPC | Referência pública de regras |

## 4. Algoritmos, visão computacional e filtros

| Item | Referência | Licença |
|---|---|---|
| **Lucas–Kanade** (fluxo óptico) | B. D. Lucas & T. Kanade, *"An Iterative Image Registration Technique with an Application to Stereo Vision"*, IJCAI 1981, pp. 674–679 | Algoritmo publicado (sem licença de código); implementação própria |
| **LK piramidal** | J.-Y. Bouguet, *"Pyramidal Implementation of the Lucas Kanade Feature Tracker"*, Intel Corp., 2001 | idem |
| **Shi–Tomasi** (Good Features to Track) | J. Shi & C. Tomasi, *"Good Features to Track"*, IEEE CVPR 1994, pp. 593–600 | idem |
| **Filtro One Euro (1€)** | G. Casiez, N. Roussel, D. Vogel, *"1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"*, ACM CHI 2012, pp. 2527–2530 — https://gery.casiez.net/1euro/ | Algoritmo publicado; implementações de referência sob BSD/MIT *(se copiar código, conferir a licença)* |
| **OpenCV** (se adotado) | https://opencv.org/license/ | Apache-2.0 (4.5+) |
| Fórmula de captura / conversão CPM | Comunidade (Bulbapedia/GO Hub) | Fato matemático; sem cópia de texto |

> O motor C++ (`pokemon_ar_tracker`, `postproc`, etc.) é **implementação própria** destes algoritmos clássicos, sob MIT.

## 5. Fontes tipográficas, padrões web e bibliotecas

| Item | Uso | Licença | Fonte |
|---|---|---|---|
| **Cascadia Mono / Cascadia Code** | Fonte monoespaçada do ASCII/terminal | **SIL OFL 1.1** (pode embutir e redistribuir; não vender isoladamente; manter aviso e nome reservado) | https://github.com/microsoft/cascadia-code |
| **WebXR Device API** | AR nativo no navegador (futuro) | Especificação W3C (licença W3C) | https://www.w3.org/TR/webxr/ |
| getUserMedia / DeviceOrientation / Geolocation | Câmera, sensores, GPS | Padrões W3C/WHATWG | https://developer.mozilla.org/ |
| **xterm.js** (v1.0 terminal web) | Terminal no navegador | MIT | https://github.com/xtermjs/xterm.js |
| **Vulkan headers/loader** (motor nativo) | Renderizador GPU | Apache-2.0 / MIT *(verificar o conjunto exato usado)* | https://github.com/KhronosGroup |
| **MapLibre GL JS / Leaflet** | Mapas | ver §2 | — |
| Ferramentas de build (CMake, GitHub Actions) | CI/CD | BSD-3 / termos do GitHub | https://cmake.org · https://docs.github.com/actions |

## 6. Projetos de código aberto semelhantes / inspirações

*(Listados pelo GitHub em 2026-11-26; popularidade e licença de cada um devem ser conferidos antes de qualquer reuso — **não copiamos código deles**.)*

| Projeto | O que é | Licença | Como inspira |
|---|---|---|---|
| **smogon/pokemon-showdown** | Simulador de batalhas competitivas (servidor) | **MIT** (servidor); o cliente `pokemon-showdown-client` é **AGPL-3.0** | Referência de lógica de batalha para PvP (v0.3/v0.4); **dados e sprites não são livres** — ver abaixo — https://github.com/smogon/pokemon-showdown |
| **PokeAPI/pokeapi** | API REST de dados | BSD-3-Clause | Fonte de dados e política de cache — https://github.com/PokeAPI/pokeapi |
| **lucasvegi/PokemonGoCloneOffline** | Clone didático Android (GPS + sensores) | Verificar no repositório | Estrutura de spawn por localização e uso de sensores — https://github.com/lucasvegi/PokemonGoCloneOffline |
| **skandertebo/pokemon-go** | Clone web (React/TS, Symfony, Three.js) | Verificar | Arquitetura web com mapa + 3D — https://github.com/skandertebo/pokemon-go |
| **souwell/PokemonGO-clone** | Clone React/Node/Supabase | Verificar | Uso de Supabase para multiplayer leve — https://github.com/souwell/PokemonGO-clone |
| **colyseus/colyseus** | Framework de servidor de jogo multiplayer (Node) | **MIT** | Candidato a servidor autoritativo (v0.4) — https://github.com/colyseus/colyseus |
| **Pokémon Uranium** (fan game) | Jogo de fã com criaturas originais; **encerrado por pedido da Nintendo (2016)** | — | **Lição legal** (ver [CROWDFUNDING_PLAN](CROWDFUNDING_PLAN.md)) |

Observação: o **código** do Showdown é MIT, mas **seus dados de espécies/golpes e sprites** refletem IP de terceiros; reutilizar apenas a *ideia* e a *estrutura* de batalha, com dados próprios ou do pacote opcional do usuário.

## 7. Nosso código e contribuições

- Código do projeto: **MIT** — © PokéStudy AR contributors ([LICENSE](../LICENSE)).
- Avatar, UI, textos de jogo, vilões e criaturas "originais" do projeto: **MIT** (código) / **CC BY 4.0** (arte e textos originais, quando indicado em `NOTICE.md`).
- Contribuições: ao enviar um *pull request*, o contribuidor declara ter o direito de cedê-la sob MIT e **não incluir assets de terceiros** sem licença compatível.

## 8. Checklist antes de cada release

- [ ] `NOTICE.md` atualizado com todas as dependências distribuídas
- [ ] Atribuição OSM visível no mapa e na tela de créditos
- [ ] Nenhum sprite/artwork da Nintendo **versionado** no repositório (carregar por URL ou pacote do usuário)
- [ ] Nome/logotipo do projeto sem marcas de terceiros (revisar "Poké…")
- [ ] Texto de AVISO LEGAL visível no menu Créditos e no README
