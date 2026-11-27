# Créditos, Agradecimentos e Licenças Open-Source

Este projeto é **100% Open-Source, Educacional e Sem Fins Lucrativos**, desenvolvido para demonstrar como técnicas clássicas de Visão Computacional (Fluxo Óptico Lucas-Kanade / Sobel 3x3) e Rasterização 3D Offscreen podem rodar em grade de texto ASCII em qualquer dispositivo.

---

## 1. Dados Enciclopédicos e Wikis Open-Source
* **[PokéAPI](https://pokeapi.co/) (Paul Hallett & PokéAPI Contributors — BSD 3-Clause License):**
  Utilizada para sincronização dinâmica e catalogação dos **1.025 Pokémons** (status base, tipos, alturas, pesos, cadeias evolutivas e catálogo de itens).
* **[Bulbapedia](https://bulbapedia.bulbagarden.net/) & [Pokémon GO Wiki / GamePress](https://pokemongo.fandom.com/) (CC BY-NC-SA):**
  Referência matemática para as fórmulas de estudo de **CP (Combat Power)**, **Multiplicadores de Nível (CPM)**, **Avaliação de IVs (0–15 ATK/DEF/STA)**, **Bônus de Curveball / Nice / Great / Excellent** e tabelas de efetividade de tipos.

## 2. Inspiração Estética e Computação Gráfica ASCII
* **Asciiquarium (Kirk Baucom — GPLv2 / Artistic License):**
  Inspiração original para a arte animada em terminal, expandida neste projeto para um pipeline 3D real com G-Buffer, normais de superfície e filtro Sobel direcional (`|`, `-`, `/`, `\`).
* **Algoritmo de Lucas-Kanade (Bruce D. Lucas & Takeo Kanade, 1981) & Detector de Cantos de Harris (Chris Harris & Mike Stephens, 1988):**
  Base matemática do módulo `AdaptiveArTracker` (`ar_tracker.cpp` / `ascii_3d_engine.js`), que reaproveita as derivadas espaciais Sobel da quantização ASCII para ancorar objetos 3D no vídeo da câmera com custo quase zero de CPU.

## 3. Direitos Autorais de Franquia (Aviso Legal)
* **Nintendo / Creatures Inc. / GAME FREAK / Niantic, Inc.:**
  Todos os nomes de personagens, espécies Pokémon e termos correlatos pertencem aos seus respectivos detentores. Este repositório é um projeto de estudo não-comercial e não possui qualquer vínculo oficial com a The Pokémon Company ou Niantic.
