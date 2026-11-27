"use strict";

// ============================================================================
// POKEASCII GO 3D — 100% PURE 3D G-BUFFER ASCII RENDERER + POKÉMON GO CLONE UI
// - Todas as cenas (CITY_MAP, AR_CAPTURE, LIVE_BATTLE, EVOLUTION_CUTSCENE) são
//   renderizadas 100% em Caracteres ASCII TrueColor (G-Buffer 3D + Sobel 3D)!
// - Anel de Raio de Ação 3D (3.5m) invariante à rotação da câmera + Zoom até 55m
// - Animação 3D em ASCII entrando na Pokébola (tampa abre + feixe laser) e saindo
// - Batalhas 3D em Tempo Real em ASCII + Cutscene 3D de Evolução com Morph
// - Clone completo do Pokémon GO: Mapa GPS/OSM, Radar Nearby (Pokémon/Raid/Anomaly),
//   Pesquisas & GO Pass (Today/Field/Special), Box (Tags/Pokémon/Eggs) e Appraisal IV
// ============================================================================

window.PokeGameUI = (function() {
  const E = window.PokeAsciiEngine || window.Ascii3DEngine;
  let canvas, ctx, videoEl;
  let sampleCanvas, sampleCtx;

  // Grade ASCII adaptativa por FPS (garante 60 FPS em qualquer celular ou PC)
  let cols = 128, rows = 70;
  let cellW = 10, cellH = 16;
  let fontLoaded = false;

  // Buffers do G-Buffer 3D e do Pós-Processador ASCII
  let camLuma, camR, camG, camB, camCellType, edgeMag, edgeDir;
  let gbZ, gbId, gbNx, gbNy, gbNz, gbColR, gbColG, gbColB, gbLight;

  // Biblioteca de Icones Vetoriais SVG Inline (Zero Emojis em todo o App!)
  function svgIcon(name, size = 16, color = "currentColor") {
    const paths = {
      gps: "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='3'/><line x1='12' y1='2' x2='12' y2='5'/><line x1='12' y1='19' x2='12' y2='22'/><line x1='2' y1='12' x2='5' y2='12'/><line x1='19' y1='12' x2='22' y2='12'/>",
      joy: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3.5'/><path d='M12 5v2M12 17v2M5 12h2M17 12h2'/>",
      star: "<polygon points='12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9'/>",
      bolt: "<polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/>",
      fire: "<path d='M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-6 3-8 1 2 2 3 3 3 0-3 0-4 0-6z'/>",
      water: "<path d='M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'/>",
      leaf: "<path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/>",
      shield: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>",
      sword: "<polyline points='14.5 17.5 3 6 3 3 6 3 17.5 14.5'/><line x1='13' y1='19' x2='19' y2='13'/><line x1='16' y1='16' x2='20' y2='20'/>",
      pokestop: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='4'/>",
      gym: "<path d='M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6'/>",
      coin: "<circle cx='12' cy='12' r='9'/><path d='M12 7v10M9 9.5h6M9 14.5h6'/>",
      dust: "<polygon points='12 2 15 10 22 12 15 14 12 22 9 14 2 12 9 10'/>",
      candy: "<circle cx='12' cy='12' r='6'/><path d='M4 8l3 4-3 4M20 8l-3 4 3 4'/>",
      egg: "<ellipse cx='12' cy='13' rx='7' ry='9'/>",
      heart: "<path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/>",
      berry: "<path d='M12 5c-4 0-7 3-7 8 0 4 3 7 7 7s7-3 7-7c0-5-3-8-7-8z'/><path d='M12 2v3'/>",
      user: "<circle cx='12' cy='8' r='4'/><path d='M5 20c0-4 3-7 7-7s7 3 7 7'/>",
      radar: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='4'/><line x1='12' y1='12' x2='19' y2='5'/>",
      check: "<polyline points='20 6 9 17 4 12'/>",
      lock: "<rect x='5' y='11' width='14' height='10' rx='2'/><path d='M8 11V7a4 4 0 0 1 8 0v4'/>",
      disc: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/>"
    };
    const p = paths[name] || paths.star;
    return `<svg class="pogo-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;display:inline-block;">${p}</svg>`;
  }

  // Estado da Cena:
  // "CITY_MAP" (Mapa 3D GPS em ASCII) | "AR_CAPTURE" (Captura 3D em ASCII)
  // "LIVE_BATTLE" (Arena 3D Ao Vivo em ASCII) | "EVOLUTION_CUTSCENE" (Evolução 3D Morph em ASCII)
  let gameScene = "CITY_MAP";

  // Câmera e Sensores AR
  let useRealCamera = false;
  let camYaw = 0, camPitch = 0.08, camRoll = 0;
  let camPos = { x: 0, y: 0.25, z: 0 };
  let isDraggingLook = false;
  let dragStartX = 0, dragStartY = 0;

  // Pinça de 2 Dedos (Pinch-to-Zoom) no Mobile
  let activePinchDist = null;

  // Estado do Mapa 3D da Cidade + GPS Real + Ruas OpenStreetMap + Células S2
  const cityState = {
    playerX: 0.0,
    playerZ: 0.0,
    facingYaw: 0.0,
    isMoving: false,
    walkCycle: 0.0,
    camOrbitYaw: 0.0,
    camOrbitPitch: 0.56,
    camOrbitDist: 10.5, // Zoom de 2.5m (perto) até 55.0m (visão estratégica ampla!)
    joyDx: 0.0,
    joyDz: 0.0,
    joyActive: false,
    // Modo de Navegação: "GPS_LIVE" (segue o GPS físico) | "JOYSTICK_FREE" (desprendido do GPS!)
    navMode: "GPS_LIVE",
    gpsActive: false,
    gpsWatchId: null,
    originLat: null,
    originLon: null,
    currentLat: null,
    currentLon: null,
    neighborhoodName: "Cidade ASCII Central",
    osmRoads: [],
    osmBuildings: [],
    osmFetched: false,
    generatedS2Cells: {},
    starterSpawnPos: { x: 0, z: 0 },
    pikachuEasterEggTriggered: false,
    pokestops: [],
    gyms: [],
    wildSpawns: [],
    floatingMapAnims: [],
    villainBalloon: { x: 8.0, y: 3.4, z: -9.0, active: true }
  };

  // Encontro de Captura AR 3D + Animações de Câmera/Fruta/Comportamento
  let wildMon = null;
  let wildAnchor = { x: 0.0, y: -1.10, z: -4.5 };
  let anchorLocked = true;
  let activeBerry = null;
  let activeBallType = "poke_ball";
  let targetRingPhase = 1.0;
  let encounterIntroT = 1.0; // 0..1 swoop de câmera ao entrar no encontro
  let berryThrowAnim = null; // { progress, icon } animação da fruta voando em arco
  let wildTauntTimer = 0.0;  // salto/investida periódica do Pokémon selvagem

  // Estado da Batalha 3D Ao Vivo em ASCII (LIVE_BATTLE)
  const liveBattle = {
    active: false,
    mode: "GYM",
    title: "GINÁSIO",
    timerSec: 100,
    lastTickTime: 0,
    playerMon: null,
    playerHp: 100,
    playerMaxHp: 100,
    playerEnergy: 0,
    playerShields: 2,
    shieldActiveUntil: 0,
    dodgeOffsetX: 0,
    dodgeUntil: 0,
    playerAttackAnimUntil: 0,
    enemyMon: null,
    enemyHp: 120,
    enemyMaxHp: 120,
    enemyNextAttackAt: 0,
    enemyIsChargingSpecial: false,
    enemySpecialFireAt: 0,
    enemyAttackAnimUntil: 0,
    vfxList: [],       // Projéteis e feixes elementais em ASCII
    floatingTexts: [], // Textos de dano flutuantes
    rewardCoins: 35,
    rewardDust: 900,
    rewardXp: 1200,
    isRaidEncounter: false
  };

  // Estado da Cutscene 3D de Evolução com Morph em ASCII (EVOLUTION_CUTSCENE)
  const evoScene = {
    active: false,
    monUid: null,
    fromSpeciesId: 25,
    toSpeciesId: 26,
    fromName: "Pikachu",
    toName: "Raichu",
    newCp: 1200,
    startTime: 0,
    durationSec: 6.8
  };

  // Física 3D da Pokébola + Animação Entrando (state=2) e Saindo (state=5)
  const ball = {
    // 0=Ready, 1=Flying, 2=EnteringBall (Tampa 3D abre + feixe laser), 3=Shaking, 4=Caught, 5=ExitingBall (Escapou!)
    state: 0,
    pos: { x: 0, y: -0.55, z: -1.35 },
    vel: { x: 0, y: 0, z: 0 },
    spinRpm: 0,
    curveDir: 0,
    rotAngle: 0,
    lidOpenAngle: 0,  // Ângulo 3D de abertura da tampa superior da Pokébola (0 .. 1.25 rad)
    morphProgress: 0, // 0..1 progresso do Pokémon entrando ou saindo da Pokébola
    shakeCount: 0,
    shakeTimer: 0,
    shakeTarget: 3,
    throwBonusLabel: "",
    throwBonusMult: 1.0,
    isDraggingBall: false,
    lastPointerX: 0,
    lastPointerY: 0,
    lastPointerTime: 0,
    spinHistory: [],
    trail: [],         // Rastro 3D da Pokébola durante o voo parabólico
    gotchaStarsTimer: 0 // Fogos/estrelas douradas ao capturar
  };

  // Projetados 2D para clique e etiquetas flutuantes
  let projectedClickTargets = [];
  let lastWildScreenBox = { x: 0, y: 0, radiusPx: 75 };

  // Escalador Dinâmico de FPS + Detecção Automática Mobile
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test((typeof navigator !== "undefined" && navigator.userAgent) || "") || (typeof window !== "undefined" && window.innerWidth <= 768);
  let fpsFrames = 0, fpsLastTime = performance.now(), currentFps = 60;
  let qualityTier = isMobileDevice ? 2 : 3;

  // Atlas Bitmap Anti-Aliased de Glifos ASCII + ImageData Uint32Array (30x mais rápido que fillText no Mobile!)
  const GLYPH_CHARS = " .',:;!~+-=*oO08#%W@|/\\·=";
  const CHAR_TO_IDX = new Map();
  for (let i = 0; i < GLYPH_CHARS.length; ++i) CHAR_TO_IDX.set(GLYPH_CHARS[i], i);
  let glyphAtlas = null;
  let frameImageData = null;
  let framePixels32 = null;

  function buildGlyphAtlas(cw, ch) {
    glyphAtlas = new Array(GLYPH_CHARS.length);
    const gc = document.createElement("canvas");
    gc.width = cw;
    gc.height = ch;
    const gctx = gc.getContext("2d", { willReadFrequently: true });
    for (let i = 0; i < GLYPH_CHARS.length; ++i) {
      const chStr = GLYPH_CHARS[i];
      if (chStr === " ") {
        glyphAtlas[i] = new Uint8Array(cw * ch);
        continue;
      }
      gctx.fillStyle = "#000000";
      gctx.fillRect(0, 0, cw, ch);
      gctx.font = `bold ${ch}px 'Cascadia Mono', 'Fira Code', Consolas, monospace`;
      gctx.textBaseline = "top";
      gctx.fillStyle = "#ffffff";
      gctx.fillText(chStr, 0, 0);
      const data = gctx.getImageData(0, 0, cw, ch).data;
      const mask = new Uint8Array(cw * ch);
      for (let p = 0; p < cw * ch; ++p) {
        // Ganho de nitidez sub-pixel (contraste 1.35x no glifo)
        mask[p] = Math.min(255, Math.round(data[p * 4] * 1.35));
      }
      glyphAtlas[i] = mask;
    }
  }

  function allocateAsciiBuffers(c, r) {
    cols = c; rows = r;
    const n = cols * rows;
    camLuma = new Float32Array(n);
    camR = new Float32Array(n);
    camG = new Float32Array(n);
    camB = new Float32Array(n);
    camCellType = new Uint8Array(n);
    edgeMag = new Float32Array(n);
    edgeDir = new Uint8Array(n);

    gbZ = new Float32Array(n);
    gbId = new Int32Array(n);
    gbNx = new Float32Array(n);
    gbNy = new Float32Array(n);
    gbNz = new Float32Array(n);
    gbColR = new Float32Array(n);
    gbColG = new Float32Array(n);
    gbColB = new Float32Array(n);
    gbLight = new Float32Array(n);
  }

  // Tabela LUT RGB 15-bit pré-computada (Zero alocação de strings em 60 FPS!)
  const RGB_LUT = new Array(32768);
  for (let r = 0; r < 32; ++r) {
    const rr = (r << 3) | (r >> 2);
    for (let g = 0; g < 32; ++g) {
      const gg = (g << 3) | (g >> 2);
      for (let b = 0; b < 32; ++b) {
        const bb = (b << 3) | (b >> 2);
        RGB_LUT[(r << 10) | (g << 5) | b] = `rgb(${rr},${gg},${bb})`;
      }
    }
  }
  function fastRgb(r, g, b) {
    const qr = Math.max(0, Math.min(31, r >> 3));
    const qg = Math.max(0, Math.min(31, g >> 3));
    const qb = Math.max(0, Math.min(31, b >> 3));
    return RGB_LUT[(qr << 10) | (qg << 5) | qb];
  }

  function resizeViewport() {
    if (!canvas) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Células Ultra-HD (5x7 no Tier 3, 6x8 no Tier 2, 7x9 no Tier 1) para definição máxima + 60 FPS no Mobile!
    const targetCellW = qualityTier === 3 ? 5 : (qualityTier === 2 ? 6 : 7);
    const targetCellH = Math.round(targetCellW * 1.34);
    cellW = targetCellW;
    cellH = targetCellH;

    const maxColsCap = isMobileDevice ? (qualityTier === 3 ? 170 : 140) : 260;
    const maxRowsCap = isMobileDevice ? (qualityTier === 3 ? 135 : 112) : 165;
    const newCols = Math.max(68, Math.min(maxColsCap, Math.floor(vw / cellW)));
    const newRows = Math.max(48, Math.min(maxRowsCap, Math.floor(vh / cellH)));
    canvas.width = newCols * cellW;
    canvas.height = newRows * cellH;
    allocateAsciiBuffers(newCols, newRows);
    buildGlyphAtlas(cellW, cellH);

    try {
      if (typeof ctx.createImageData === "function") {
        frameImageData = ctx.createImageData(canvas.width, canvas.height);
        framePixels32 = new Uint32Array(frameImageData.data.buffer);
      } else {
        frameImageData = null;
        framePixels32 = null;
      }
    } catch (_) {
      frameImageData = null;
      framePixels32 = null;
    }

    if (sampleCanvas) {
      sampleCanvas.width = newCols;
      sampleCanvas.height = newRows;
    }
    fontLoaded = false;
  }

  // ============================================================================
  // POPULAÇÃO DO MAPA 3D POR CÉLULAS S2 (NÍVEL 14 & NÍVEL 17) + TUTORIAL INICIAL
  // ============================================================================
  const TEAM_COLORS = {
    "Trovão": [0.95, 0.78, 0.15],
    "Chama":  [0.95, 0.25, 0.20],
    "Maré":   [0.20, 0.58, 0.98]
  };

  function createGymObject(id, name, team, x, z, guardSpeciesId, raidBossId, raidTier = 5) {
    const gSp = window.PokeData.getSpecies(guardSpeciesId);
    const d2Sp = window.PokeData.getSpecies((guardSpeciesId % 140) + 1);
    const d3Sp = window.PokeData.getSpecies(((guardSpeciesId + 35) % 140) + 1);
    return {
      id, name, team,
      color: TEAM_COLORS[team] || TEAM_COLORS["Trovão"],
      x, z,
      guardSpeciesId,
      raidBossId,
      raidTier,
      photoDiscCooldownUntil: 0,
      defenders: [
        { speciesId: gSp.id, name: gSp.name, cp: 1650, trainer: "Líder " + team, motivation: 92 },
        { speciesId: d2Sp.id, name: d2Sp.name, cp: 1420, trainer: "Guardião S2", motivation: 78 },
        { speciesId: d3Sp.id, name: d3Sp.name, cp: 1290, trainer: "Patrulheiro", motivation: 64 }
      ]
    };
  }

  function initCityEntities() {
    cityState.pokestops = [
      { id: "ps_1", name: "PokéStop Praça Matrix (S2 L17)", x: -5.5, z: -6.0, cooldownUntil: 0, hasLure: true },
      { id: "ps_2", name: "PokéStop Fonte Digital (S2 L17)", x: 6.5, z: -5.0, cooldownUntil: 0, hasLure: false },
      { id: "ps_3", name: "PokéStop Parque Central (S2 L17)", x: -6.0, z: 6.5, cooldownUntil: 0, hasLure: true },
      { id: "ps_4", name: "PokéStop Estação Norte (S2 L17)", x: 6.0, z: 6.5, cooldownUntil: 0, hasLure: false },
      { id: "ps_5", name: "PokéStop Avenida Cyber (S2 L17)", x: 0.0, z: -13.5, cooldownUntil: 0, hasLure: false },
      { id: "ps_6", name: "PokéStop Boulevard Sul (S2 L17)", x: 0.0, z: 13.5, cooldownUntil: 0, hasLure: false }
    ];

    cityState.gyms = [
      createGymObject("gym_1", "Ginásio Trovão (S2 L14)", "Trovão", -12.5, -12.5, 25, 145, 5),
      createGymObject("gym_2", "Ginásio Chama (S2 L14)", "Chama", 12.5, -12.5, 6, 146, 5),
      createGymObject("gym_3", "Ginásio Maré (S2 L14)", "Maré", 12.5, 12.5, 9, 150, 5)
    ];

    cityState.generatedS2Cells["0_0"] = true;
    const p = window.PokeStorage.getProfile();
    if (p && !p.starterChosen) {
      spawnStarterTutorialTrioOnMap();
    } else {
      refreshCityWildSpawns();
    }
  }

  // Primeiro Tutorial do Professor Willow: Spawna Bulbasaur (#1), Charmander (#4) e Squirtle (#7)
  // Se o jogador andar para longe (> 7.5m) sem pegar nenhum, ativa o Easter Egg do Pikachu (#25)!
  function spawnStarterTutorialTrioOnMap() {
    cityState.wildSpawns = [];
    cityState.starterSpawnPos = { x: cityState.playerX, z: cityState.playerZ };
    const starters = [
      { id: 1, dx: -2.2, dz: -2.2 }, // Bulbasaur
      { id: 4, dx:  0.0, dz: -2.8 }, // Charmander
      { id: 7, dx:  2.2, dz: -2.2 }  // Squirtle
    ];
    for (const st of starters) {
      const sp = window.PokeData.getSpecies(st.id);
      E.getPokemonMesh(st.id, false);
      cityState.wildSpawns.push({
        isStarterTutorial: true,
        mon: {
          uid: "starter_" + st.id + "_" + Date.now(),
          speciesId: st.id,
          name: sp.name,
          level: 5,
          ivAtk: 14, ivDef: 14, ivSta: 14,
          ivPercent: 93,
          isShiny: false,
          cp: window.PokeData.calculateCP(st.id, 5, 14, 14, 14),
          maxHp: window.PokeData.calculateMaxHP(st.id, 5, 14),
          hp: window.PokeData.calculateMaxHP(st.id, 5, 14),
          fastMove: sp.fastMoves[0],
          chargedMove: sp.chargedMoves[0],
          scaleVariation: 1.0,
          caughtAt: Date.now()
        },
        x: cityState.playerX + st.dx,
        z: cityState.playerZ + st.dz,
        rotY: 0,
        spawnedAt: performance.now()
      });
    }
    updateHud();
  }

  // Geração Procedural Geoespacial baseada nas Células S2 Nível 14 e Nível 17 da Niantic
  // Quando você anda pelo Joystick ou GPS para novos bairros, cria PokéStops e Ginásios!
  function ensureS2CellsAroundPlayer() {
    const l14Size = 28.0; // Célula S2 Nível 14 em escala do mapa 3D
    const cx = Math.floor((cityState.playerX + l14Size * 0.5) / l14Size);
    const cz = Math.floor((cityState.playerZ + l14Size * 0.5) / l14Size);

    for (let dx = -1; dx <= 1; ++dx) {
      for (let dz = -1; dz <= 1; ++dz) {
        const kx = cx + dx, kz = cz + dz;
        const key = `${kx}_${kz}`;
        if (cityState.generatedS2Cells[key]) continue;
        cityState.generatedS2Cells[key] = true;

        const baseX = kx * l14Size;
        const baseZ = kz * l14Size;
        const hash = Math.abs((kx * 73856093) ^ (kz * 19349663));

        // Regra S2 Nível 17: 3 PokéStops em sub-células L17 distintas dentro desta célula L14
        const poiNames = ["Praça", "Monumento", "Estação", "Mural", "Mirante", "Biblioteca", "Jardim", "Obelisco"];
        for (let s = 0; s < 3; ++s) {
          const subAngle = ((hash + s * 137) % 360) * Math.PI / 180;
          const subDist = 6.5 + ((hash >> (s * 2)) % 6);
          const px = baseX + Math.cos(subAngle) * subDist;
          const pz = baseZ + Math.sin(subAngle) * subDist;
          const pName = poiNames[(hash + s) % poiNames.length];
          cityState.pokestops.push({
            id: `ps_${key}_${s}`,
            name: `PokéStop ${pName} #${Math.abs(kx) + Math.abs(kz) + s + 1}`,
            x: px, z: pz,
            cooldownUntil: 0,
            hasLure: ((hash + s) % 3 === 0)
          });
        }

        // Regra S2 Nível 14 (2 a 5 POIs na célula L14 => 1 Ginásio 3D!)
        const teams = ["Trovão", "Chama", "Maré"];
        const team = teams[hash % 3];
        const guards = [6, 9, 25, 59, 65, 68, 94, 130, 131, 143, 149];
        const bosses = [144, 145, 146, 150, 151, 249, 250, 384];
        const gx = baseX + (((hash % 11) - 5) * 1.8);
        const gz = baseZ + ((((hash >> 3) % 11) - 5) * 1.8);
        cityState.gyms.push(
          createGymObject(
            `gym_${key}`,
            `Ginásio ${poiNames[(hash >> 2) % poiNames.length]} (${team})`,
            team,
            gx, gz,
            guards[hash % guards.length],
            bosses[hash % bosses.length],
            (hash % 2 === 0) ? 5 : 3
          )
        );
      }
    }
  }

  function refreshCityWildSpawns() {
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    while (cityState.wildSpawns.length < 6) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2.8 + Math.random() * 11.5;
      const mon = window.PokeData.rollWeightedSpawn(cfg, p.level, p);
      // Solicita o upgrade assíncrono da malha 3D volumétrica oficial da espécie
      E.getPokemonMesh(mon.speciesId, mon.isShiny);
      cityState.wildSpawns.push({
        mon,
        x: cityState.playerX + Math.cos(angle) * dist,
        z: cityState.playerZ + Math.sin(angle) * dist,
        rotY: Math.random() * Math.PI * 2,
        spawnedAt: performance.now()
      });
    }
    updateHud();
  }

  function latLonToMeters(lat, lon) {
    if (cityState.originLat === null || cityState.originLon === null) {
      cityState.originLat = lat;
      cityState.originLon = lon;
    }
    const dLat = (lat - cityState.originLat) * 111320.0;
    const dLon = (lon - cityState.originLon) * 111320.0 * Math.cos(cityState.originLat * Math.PI / 180.0);
    return { x: dLon * 0.35, z: -dLat * 0.35 };
  }

  async function fetchRealOpenStreetMapAround(lat, lon) {
    if (cityState.osmFetched) return;
    cityState.osmFetched = true;

    try {
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      if (nomRes.ok) {
        const nom = await nomRes.json();
        const addr = nom.address || {};
        const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.city || "Sua Localização GPS";
        const suburb = addr.suburb || addr.city_district || addr.town || addr.city || "";
        cityState.neighborhoodName = suburb ? `${road} • ${suburb}` : road;
        const pill = document.getElementById("gps-pill");
        if (pill) pill.textContent = `[LOC] ${cityState.neighborhoodName}`;
      }
    } catch (_) {}

    try {
      const query = `[out:json][timeout:10];(way["highway"](around:350,${lat},${lon});way["building"](around:250,${lat},${lon});node["amenity"](around:350,${lat},${lon}););out body;>;out skel qt;`;
      const ovRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query)
      });
      if (!ovRes.ok) return;
      const data = await ovRes.json();
      const nodes = new Map();
      const roads = [];
      const buildings = [];
      const amenities = [];

      for (const el of (data.elements || [])) {
        if (el.type === "node") {
          nodes.set(el.id, latLonToMeters(el.lat, el.lon));
          if (el.tags && (el.tags.name || el.tags.amenity)) {
            const pos = latLonToMeters(el.lat, el.lon);
            amenities.push({ name: el.tags.name || el.tags.amenity, x: pos.x, z: pos.z });
          }
        }
      }

      for (const el of (data.elements || [])) {
        if (el.type === "way" && el.nodes && el.nodes.length >= 2) {
          const pts = el.nodes.map(id => nodes.get(id)).filter(Boolean);
          if (pts.length < 2) continue;
          if (el.tags && el.tags.highway) {
            const isMajor = /primary|secondary|tertiary|trunk|residential/.test(el.tags.highway);
            roads.push({ pts, halfW: isMajor ? 1.55 : 0.95, name: el.tags.name || "" });
          } else if (el.tags && el.tags.building) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of pts) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.z < minZ) minZ = p.z;
              if (p.z > maxZ) maxZ = p.z;
            }
            buildings.push({ minX, maxX, minZ, maxZ });
          }
        }
      }

      if (roads.length > 0) {
        cityState.osmRoads = roads;
        cityState.osmBuildings = buildings;
        for (let i = 0; i < Math.min(amenities.length, cityState.pokestops.length); ++i) {
          cityState.pokestops[i].name = `PokéStop ${amenities[i].name}`;
          cityState.pokestops[i].x = amenities[i].x;
          cityState.pokestops[i].z = amenities[i].z;
        }
        window.PokeStorage.showToast(`[MAPA] Ruas reais carregadas em ASCII 3D: ${cityState.neighborhoodName}!`, "success");
      }
    } catch (_) {}
  }

  // Calcula as coordenadas GPS virtuais conforme o jogador anda pelo Joystick
  function getVirtualLatLon() {
    const baseLat = cityState.originLat !== null ? cityState.originLat : -23.5505;
    const baseLon = cityState.originLon !== null ? cityState.originLon : -46.6333;
    const vLat = baseLat - (cityState.playerZ / 0.35) / 111320.0;
    const vLon = baseLon + (cityState.playerX / 0.35) / (111320.0 * Math.cos(baseLat * Math.PI / 180.0));
    return { lat: vLat, lon: vLon };
  }

  function updateGpsPillUI() {
    const pill = document.getElementById("gps-pill");
    const btnMode = document.getElementById("btn-nav-mode");
    const coords = getVirtualLatLon();
    const isFree = cityState.navMode === "JOYSTICK_FREE";

    if (pill) {
      pill.innerHTML = isFree
        ? `${svgIcon("joy", 14, "#fde047")} JOYSTICK LIVRE • ${cityState.neighborhoodName} (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`
        : `${svgIcon("gps", 14, "#38bdf8")} GPS LIVE • ${cityState.neighborhoodName} (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`;
      pill.style.borderColor = isFree ? "#fde047" : "rgba(120, 220, 255, 0.45)";
    }
    if (btnMode) {
      btnMode.innerHTML = isFree ? svgIcon("joy", 19, "#d97706") : svgIcon("gps", 19, "#1c7c74");
      btnMode.style.borderColor = isFree ? "#f59e0b" : "#26ccaa";
    }
  }

  function toggleNavModeOrResyncGps() {
    window.PokeAudio.playUiClick();
    if (cityState.navMode === "JOYSTICK_FREE") {
      cityState.navMode = "GPS_LIVE";
      window.PokeStorage.showToast("[GPS] Modo GPS LIVE reativado! Sincronizando com sua posição física real...", "success");
      startRealGpsTracking(true);
    } else {
      cityState.navMode = "JOYSTICK_FREE";
      updateGpsPillUI();
      window.PokeStorage.showToast("[JOY] Modo JOYSTICK LIVRE ativado! O GPS não vai mais resetar sua posição enquanto você anda.", "info");
    }
  }

  function startRealGpsTracking(manualTrigger = false) {
    if (!navigator.geolocation) {
      cityState.navMode = "JOYSTICK_FREE";
      updateGpsPillUI();
      return;
    }

    if (manualTrigger) {
      cityState.navMode = "GPS_LIVE";
      const pill = document.getElementById("gps-pill");
      if (pill) pill.textContent = "[GPS] Sincronizando GPS Live...";
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        cityState.currentLat = lat;
        cityState.currentLon = lon;
        cityState.gpsActive = true;

        if (cityState.originLat === null) {
          cityState.originLat = lat;
          cityState.originLon = lon;
        }

        // CRÍTICO: Só move o personagem para o GPS se estiver em modo GPS_LIVE ou se o jogador pediu manualmente!
        // Se o jogador já mexeu no Joystick (JOYSTICK_FREE), NUNCA reseta playerX/playerZ!
        if (cityState.navMode === "GPS_LIVE" || manualTrigger) {
          if (manualTrigger) {
            cityState.originLat = lat;
            cityState.originLon = lon;
            cityState.playerX = 0;
            cityState.playerZ = 0;
          } else {
            const m = latLonToMeters(lat, lon);
            cityState.playerX = m.x;
            cityState.playerZ = m.z;
          }
        }

        updateGpsPillUI();
        fetchRealOpenStreetMapAround(lat, lon);
      },
      () => {
        cityState.navMode = "JOYSTICK_FREE";
        updateGpsPillUI();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    if (cityState.gpsWatchId === null) {
      cityState.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          cityState.currentLat = lat;
          cityState.currentLon = lon;
          if (cityState.originLat === null) {
            cityState.originLat = lat;
            cityState.originLon = lon;
          }

          // Se o jogador está usando o Joystick Livre, NÃO sobrescreve a posição dele!
          if (cityState.navMode !== "GPS_LIVE") return;

          const m = latLonToMeters(lat, lon);
          const dx = m.x - cityState.playerX;
          const dz = m.z - cityState.playerZ;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.25 && dist < 120) {
            cityState.facingYaw = Math.atan2(dx, -dz);
            cityState.playerX = m.x;
            cityState.playerZ = m.z;
            cityState.isMoving = true;
            onPlayerWalkedMeters(dist * 2.5);
            ensureS2CellsAroundPlayer();
            updateGpsPillUI();
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }
  }

  // ============================================================================
  // CAMINHADA NO MAPA: PARCEIRO (CANDY) + INCUBADORA DE OVOS (2KM / 5KM / 10KM)
  // ============================================================================
  function onPlayerWalkedMeters(meters) {
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    p.distanceWalkedM = (p.distanceWalkedM || 0) + meters;
    p.buddyWalkProgressM = (p.buddyWalkProgressM || 0) + meters;
    if (p.tasksProgress) {
      p.tasksProgress.walkedM = (p.tasksProgress.walkedM || 0) + meters;
    }

    // 1. Parceiro (Buddy) encontra Candy
    const needM = cfg.buddyDistancePerCandyM || 250;
    if (p.buddyWalkProgressM >= needM) {
      p.buddyWalkProgressM -= needM;
      const buddy = p.pokemonBox.find(m => m.uid === p.buddyUid) || p.pokemonBox[0];
      if (buddy) {
        const cGain = Math.round(2 * (cfg.candyMultiplier || 1));
        p.candies[buddy.speciesId] = (p.candies[buddy.speciesId] || 0) + cGain;
        p.stardust += 250;
        window.PokeAudio.playGotchaFanfare();
        window.PokeStorage.showToast(`[BUDDY] Seu parceiro ${buddy.name} encontrou +${cGain} Candies e +250 Stardust!`, "success");
      }
    }

    // 2. Incubadora de Ovos (2km / 5km / 10km)
    if (Array.isArray(p.eggs)) {
      const kmDelta = meters / 1000.0; // Em modo jogo aceleramos 4x para ser divertido testar
      for (let i = p.eggs.length - 1; i >= 0; --i) {
        const egg = p.eggs[i];
        if (!egg.incubating) continue;
        egg.kmWalked = (egg.kmWalked || 0) + kmDelta * 4.5;
        if (egg.kmWalked >= egg.kmRequired) {
          // Chocou o Ovo!
          p.eggs.splice(i, 1);
          const hatched = window.PokeData.rollWeightedSpawn(
            Object.assign({}, cfg, { wildIvFloor: 11, rareSpawnMultiplier: egg.kmRequired >= 10 ? 5.0 : 2.2 }),
            p.level,
            p
          );
          p.pokemonBox.push(hatched);
          p.pokedexCaught[hatched.speciesId] = (p.pokedexCaught[hatched.speciesId] || 0) + 1;
          p.candies[hatched.speciesId] = (p.candies[hatched.speciesId] || 0) + 12;
          p.stardust += Math.round(egg.kmRequired * 350);
          window.PokeStorage.addXp(Math.round(egg.kmRequired * 300));
          window.PokeAudio.playGotchaFanfare();
          window.PokeStorage.showToast(
            `[OVO] OVO DE ${egg.kmRequired}KM CHOCOU! Nasceu um ${hatched.name} (CP ${hatched.cp}, IV ${hatched.ivPercent}%)!`,
            "success"
          );
          // Coloca o próximo ovo na incubadora infinita automaticamente
          if (p.eggs.length > 0 && !p.eggs.some(e => e.incubating)) {
            p.eggs[0].incubating = true;
          }
        }
      }
    }
  }

  function updateCityMovement(dt) {
    if (gameScene !== "CITY_MAP") return;

    cityState.villainBalloon.x = cityState.playerX + Math.sin(performance.now() * 0.00025) * 8.5;
    cityState.villainBalloon.z = cityState.playerZ - 7.5 + Math.cos(performance.now() * 0.0002) * 3.5;

    for (const sp of cityState.wildSpawns) {
      const d = Math.hypot(sp.x - cityState.playerX, sp.z - cityState.playerZ);
      if (d > 24.0) {
        const ang = Math.random() * Math.PI * 2;
        const r = 3.0 + Math.random() * 9.0;
        sp.x = cityState.playerX + Math.cos(ang) * r;
        sp.z = cityState.playerZ + Math.sin(ang) * r;
      }
    }

    if (Math.abs(cityState.joyDx) < 0.05 && Math.abs(cityState.joyDz) < 0.05) {
      cityState.isMoving = false;
      return;
    }

    cityState.isMoving = true;
    cityState.walkCycle += dt * 9.0;
    const speed = 5.4;

    const sinY = Math.sin(cityState.camOrbitYaw);
    const cosY = Math.cos(cityState.camOrbitYaw);
    const worldDx = cityState.joyDx * cosY + cityState.joyDz * sinY;
    const worldDz = -cityState.joyDx * sinY + cityState.joyDz * cosY;

    cityState.playerX += worldDx * speed * dt;
    cityState.playerZ += worldDz * speed * dt;
    cityState.facingYaw = Math.atan2(worldDx, -worldDz);

    ensureS2CellsAroundPlayer();
    updateGpsPillUI();
    onPlayerWalkedMeters(Math.hypot(worldDx, worldDz) * speed * dt * 2.8);

    // Easter Egg Oficial do Pokémon GO: Caminhar para longe dos 3 iniciais faz surgir o Pikachu (#25)!
    const p = window.PokeStorage.getProfile();
    if (p && !p.starterChosen && !cityState.pikachuEasterEggTriggered) {
      const distFromStarters = Math.hypot(
        cityState.playerX - cityState.starterSpawnPos.x,
        cityState.playerZ - cityState.starterSpawnPos.z
      );
      if (distFromStarters > 7.5) {
        cityState.pikachuEasterEggTriggered = true;
        spawnStarterTutorialTrioOnMap();
        const pikaSp = window.PokeData.getSpecies(25);
        E.getPokemonMesh(25, false);
        cityState.wildSpawns.push({
          isStarterTutorial: true,
          mon: {
            uid: "starter_25_" + Date.now(),
            speciesId: 25,
            name: "Pikachu",
            level: 6,
            ivAtk: 15, ivDef: 15, ivSta: 15,
            ivPercent: 100,
            isShiny: false,
            cp: window.PokeData.calculateCP(25, 6, 15, 15, 15),
            maxHp: window.PokeData.calculateMaxHP(25, 6, 15),
            hp: window.PokeData.calculateMaxHP(25, 6, 15),
            fastMove: pikaSp.fastMoves[0],
            chargedMove: pikaSp.chargedMoves[0],
            scaleVariation: 1.0,
            caughtAt: Date.now()
          },
          x: cityState.playerX + 0.0,
          z: cityState.playerZ + 2.3,
          rotY: 0,
          spawnedAt: performance.now()
        });
        window.PokeAudio.playPokemonCry(25);
        window.PokeStorage.showToast("* EASTER EGG DO POKÉMON GO! Você caminhou para longe dos 3 iniciais e um Pikachu 4★ apareceu!", "warn");
      }
    }
  }

  // ============================================================================
  // SISTEMA DE TUTORIAIS CONTEXTUAIS (PROFESSOR WILLOW & LÍDERES DE EQUIPE)
  // + TRANSIÇÃO CINEMATOGRÁFICA ENTRE TELAS
  // ============================================================================
  const SCREEN_GUIDES = {
    MAP_WELCOME: {
      speaker: "[PROF] Professor Willow",
      avatar: "[PROF]",
      text: "Bem-vindo ao PokeASCII GO 3D! Ao seu redor surgiram Bulbasaur, Charmander e Squirtle em 3D! Toque em um deles para seu primeiro tutorial de captura (ou caminhe para longe com o Joystick para descobrir o Easter Egg do Pikachu!)."
    },
    AR_CAPTURE: {
      speaker: "[PROF] Professor Willow",
      avatar: "[PROF]",
      text: "Tutorial de Captura: Gire a Pokébola em círculos para ativar o bônus Curveball (+70%) e lance quando o anel colorido estiver pequeno para acertar Nice, Great ou Excellent! Use Frutas ([BERRY]) para facilitar a captura."
    },
    POKESTOP: {
      speaker: "[PROF] Professor Willow",
      avatar: "[PROF]",
      text: "PokéStops (Células S2 Nível 17): Cada célula de 90m abriga até 1 PokéStop! Quando o cubo 3D estiver Azul-Ciano, toque para girar o disco e ganhar Pokébolas, Berries, Ovos (2km/5km/10km) e Selos de Pesquisa. Após girar, ele fica Roxo enquanto recarrega!"
    },
    GYM: {
      speaker: "Líder da Sua Equipe",
      avatar: "[GYM]",
      text: "Ginásios (Células S2 Nível 14): Aqui as equipes Trovão *, Maré ~ e Chama * disputam território! Você pode: 1) Girar o Disco Fotográfico para ganhar Passe de Raid; 2) Alimentar os 6 Defensores com Frutas (HP  Motivação); 3) Colocar seu Pokémon para ganhar até 50 PokéCoins/dia; ou 4) Enfrentar o Raid Boss 5★!"
    },
    POKEMON_BOX: {
      speaker: "Líder da Sua Equipe",
      avatar: "*",
      text: "Caixa de Pokémon & Incubadora: Na aba POKÉMON, toque em qualquer monstrinho para abrir sua ficha, evoluir com Morph 3D ou clicar em 'AVALIAR IVs' (3 barras de Ataque, Defesa e PS). Na aba EGGS, coloque seus Ovos na Incubadora Infinita e caminhe para chocá-los!"
    },
    POKEDEX: {
      speaker: "[PROF] Professor Willow",
      avatar: "",
      text: "Pokédex Regional (Gerações 1 a 9): Registre todas as 1.025 espécies! Pokémons ainda não capturados aparecem como Silhuetas 3D Escuras em ASCII (# ?UNKNOWN?)."
    },
    NEARBY: {
      speaker: "[PROF] Professor Willow",
      avatar: "[SCAN]",
      text: "Radar Nearby: Acompanhe os Pokémons selvagens próximos aos PokéStops, veja quais Ginásios estão com Ovos/Chefes de Raid 5 Estrelas ativos e dispare o Scanner de Anomalia Rara quando atingir 100%!"
    },
    RESEARCH: {
      speaker: "[PROF] Professor Willow",
      avatar: "",
      text: "Pesquisas & GO Pass: Na aba TODAY você sobe de Rank no GO Pass 100% gratuito; em FIELD você junta 7 Selos para abrir a Caixa Lendária; e em SPECIAL você avança na campanha de história!"
    },
    LIVE_BATTLE: {
      speaker: "Líder da Sua Equipe",
      avatar: "[BATTLE]",
      text: "Batalha 3D Ao Vivo: Toque rápido na tela para disparar Golpes Rápidos e encher o Orbe Central até 100%. Arraste para os lados (ou toque em >>) para Esquivar em 3D, e use [SHIELD] para bloquear o Especial do Boss!"
    }
  };

  function getTeamLeaderInfo() {
    const p = window.PokeStorage.getProfile();
    const team = (p && p.avatar && p.avatar.team) || "Trovão";
    if (team === "Chama") return { name: "* Candela (Líder Equipe Chama / Valor)", icon: "*" };
    if (team === "Maré")  return { name: "~ Blanche (Líder Equipe Maré / Mystic)", icon: "~" };
    return { name: "* Spark (Líder Equipe Trovão / Instinct)", icon: "*" };
  }

  function maybeShowScreenGuide(guideKey, force = false) {
    const p = window.PokeStorage.getProfile();
    if (!p) return;
    p.seenGuides = p.seenGuides || {};
    if (!force && p.seenGuides[guideKey]) return;

    const g = SCREEN_GUIDES[guideKey];
    if (!g) return;
    p.seenGuides[guideKey] = true;
    window.PokeStorage.save();

    const leader = getTeamLeaderInfo();
    const speaker = g.speaker === "Líder da Sua Equipe" ? leader.name : g.speaker;
    const avatar = g.speaker === "Líder da Sua Equipe" ? leader.icon : g.avatar;

    const banner = document.getElementById("guide-banner-overlay");
    if (!banner) return;
    banner.innerHTML = `
      <div class="guide-avatar">${avatar}</div>
      <div style="flex:1;font-size:11.5px;color:#1e3a40;line-height:1.38;">
        <div style="font-weight:900;color:#1c7c74;margin-bottom:2px;">${speaker}</div>
        <div>${g.text}</div>
      </div>
      <button class="pogo-pill-btn" style="padding:7px 12px;font-size:11px;flex-shrink:0;"
        onclick="document.getElementById('guide-banner-overlay').style.display='none'">
        OK ✓
      </button>
    `;
    banner.style.display = "flex";
  }

  let transitionTimer1 = null;
  let transitionTimer2 = null;

  function syncSceneHudVisibility() {
    const mapHud = document.getElementById("map-overworld-hud");
    const arHud = document.getElementById("ar-encounter-hud");
    const battleHud = document.getElementById("live-battle-hud");
    if (mapHud) mapHud.style.display = gameScene === "CITY_MAP" ? "block" : "none";
    if (arHud) arHud.style.display = gameScene === "AR_CAPTURE" ? "block" : "none";
    if (battleHud) battleHud.style.display = gameScene === "LIVE_BATTLE" ? "block" : "none";
  }

  function triggerSceneTransition(label, onMidpoint) {
    const overlay = document.getElementById("scene-transition-overlay");
    if (window.PokeAudio.playTransitionShutter) window.PokeAudio.playTransitionShutter();
    if (transitionTimer1) { clearTimeout(transitionTimer1); transitionTimer1 = null; }
    if (transitionTimer2) { clearTimeout(transitionTimer2); transitionTimer2 = null; }

    if (!overlay) {
      if (onMidpoint) onMidpoint();
      return;
    }
    overlay.textContent = label || "";
    overlay.classList.add("active");
    transitionTimer1 = setTimeout(() => {
      transitionTimer1 = null;
      try {
        if (onMidpoint) onMidpoint();
      } finally {
        transitionTimer2 = setTimeout(() => {
          transitionTimer2 = null;
          overlay.classList.remove("active");
        }, 180);
      }
    }, 110);
  }

  // ============================================================================
  // ZOOM DO MAPA (DE 2.5m ATÉ 55.0m PARA VISÃO ESTRATÉGICA AMPLA!)
  // ============================================================================
  // Alternador Manual de Nivel de Detalhe ASCII (Normal HD / Ultra-Sharp 3D / Extreme Micro-ASCII)
  function cycleAsciiDetailTier() {
    window.PokeAudio.playUiClick();
    qualityTier = qualityTier >= 3 ? 2 : (qualityTier + 1);
    resizeViewport();
    const lbl = qualityTier === 3 ? "ULTRA-HD (Micro-ASCII 5x6px)" : "HD (Alta Definicao 6x8px)";
    const btn = document.getElementById("btn-hd-tier");
    if (btn) btn.textContent = qualityTier === 3 ? "UHD" : "HD";
    window.PokeStorage.showToast(`[GRAFICOS] Resolucao ASCII 3D ajustada para ${lbl} (${cols}x${rows} celulas)!`, "success");
  }

  let asciiUiMode = false;
  function applyAsciiUiModeState(active) {
    asciiUiMode = Boolean(active);
    if (document.body) {
      if (asciiUiMode) document.body.classList.add("ascii-ui-mode");
      else document.body.classList.remove("ascii-ui-mode");
    }
    const btn = document.getElementById("btn-ascii-ui-mode");
    if (btn) btn.textContent = asciiUiMode ? "GO" : "ASCII";
    const rLbl = document.getElementById("radial-ascii-ui-lbl");
    if (rLbl) rLbl.textContent = asciiUiMode ? "MENUS: MODO GO" : "MENUS: MODO ASCII";
  }

  function toggleAsciiUiMode() {
    window.PokeAudio.playUiClick();
    applyAsciiUiModeState(!asciiUiMode);
    try {
      localStorage.setItem("pokeascii_ui_mode_v1", asciiUiMode ? "1" : "0");
    } catch (_) {}
    window.PokeStorage.showToast(
      asciiUiMode
        ? "+-[ INTERFACE ASCII TERMINAL ATIVADA (Toque em 'GO' p/ voltar ao tema claro) ]-+"
        : "[UI] Interface padrao Pokemon GO ativada!",
      "success"
    );
  }

  function adjustZoom(deltaDist) {
    if (gameScene !== "CITY_MAP") return;
    cityState.camOrbitDist = Math.max(2.5, Math.min(55.0, cityState.camOrbitDist + deltaDist));
  }

  function toggleSceneMode(targetMode) {
    window.PokeAudio.playUiClick();
    const nextScene = targetMode || (gameScene === "CITY_MAP" ? "AR_CAPTURE" : "CITY_MAP");
    const labels = {
      CITY_MAP: "[MAPA] MAPA 3D GPS",
      AR_CAPTURE: "[BALL] ENCONTRO DE CAPTURA 3D",
      LIVE_BATTLE: "[BATTLE] ARENA 3D AO VIVO",
      EVOLUTION_CUTSCENE: "[EVO] EVOLUÇÃO MORPH 3D"
    };

    // Atualiza o estado da cena e os HUDs IMEDIATAMENTE (evita travamentos ou cliques duplos durante a transição!)
    if (nextScene === "CITY_MAP") {
      liveBattle.active = false;
      evoScene.active = false;
      ball.isDraggingBall = false;
      if (ball.state === 4) resetBall();
    }
    gameScene = nextScene;
    syncSceneHudVisibility();

    if (gameScene === "AR_CAPTURE") {
      encounterIntroT = 0.0;
      if (!wildMon) spawnWildPokemon();
      if (ball.state === 4) resetBall();
      maybeShowScreenGuide("AR_CAPTURE");
    } else if (gameScene === "LIVE_BATTLE") {
      maybeShowScreenGuide("LIVE_BATTLE");
    }
    updateHud();

    triggerSceneTransition(labels[nextScene] || "", () => {
      syncSceneHudVisibility();
      updateHud();
    });
  }

  function startWildEncounterFromMap(spawnIndex) {
    const entry = cityState.wildSpawns[spawnIndex];
    if (!entry) return;
    wildMon = entry.mon;
    cityState.wildSpawns.splice(spawnIndex, 1);
    setTimeout(refreshCityWildSpawns, 1500);

    activeBerry = null;
    resetBall();
    anchorWildPokemonInFront();
    toggleSceneMode("AR_CAPTURE");
    window.PokeAudio.playPokemonCry(wildMon.speciesId);

    const shinyTag = wildMon.isShiny ? "* SHINY " : "";
    window.PokeStorage.showToast(
      ` Um ${shinyTag}${wildMon.name} selvagem (CP ${wildMon.cp}) apareceu em ASCII 3D!`,
      wildMon.isShiny ? "warn" : "info"
    );
  }

  function spawnWildPokemon(forceSpeciesId = null, isRaidReward = false) {
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    if (forceSpeciesId) {
      const ivF = isRaidReward ? cfg.raidIvFloor : cfg.wildIvFloor;
      const sp = window.PokeData.getSpecies(forceSpeciesId);
      const ivA = ivF + Math.floor(Math.random() * (16 - ivF));
      const ivD = ivF + Math.floor(Math.random() * (16 - ivF));
      const ivS = ivF + Math.floor(Math.random() * (16 - ivF));
      const lvl = Math.min(50, Math.max(10, p.level + 2));
      wildMon = {
        uid: "mon_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
        speciesId: sp.id,
        name: sp.name,
        level: lvl,
        ivAtk: ivA, ivDef: ivD, ivSta: ivS,
        ivPercent: Math.round(((ivA + ivD + ivS) / 45) * 100),
        isShiny: Math.random() < (cfg.shinyProbability * (isRaidReward ? 5 : 1)),
        cp: window.PokeData.calculateCP(sp.id, lvl, ivA, ivD, ivS),
        maxHp: window.PokeData.calculateMaxHP(sp.id, lvl, ivS),
        hp: window.PokeData.calculateMaxHP(sp.id, lvl, ivS),
        fastMove: sp.fastMoves[0],
        chargedMove: sp.chargedMoves[0],
        scaleVariation: 1.0,
        caughtAt: Date.now()
      };
    } else {
      wildMon = window.PokeData.rollWeightedSpawn(cfg, p.level, p);
    }

    E.getPokemonMesh(wildMon.speciesId, wildMon.isShiny);
    activeBerry = null;
    resetBall();
    anchorWildPokemonInFront();
    window.PokeAudio.playPokemonCry(wildMon.speciesId);
    updateHud();
  }

  function anchorWildPokemonInFront() {
    const dist = 4.5;
    wildAnchor.x = camPos.x - Math.sin(camYaw) * dist;
    wildAnchor.y = -1.10;
    wildAnchor.z = camPos.z - Math.cos(camYaw) * dist;
    anchorLocked = true;
  }

  function resetBall() {
    ball.state = 0;
    ball.pos = { x: 0, y: -0.55, z: -1.35 };
    ball.vel = { x: 0, y: 0, z: 0 };
    ball.spinRpm = 0;
    ball.curveDir = 0;
    ball.lidOpenAngle = 0;
    ball.morphProgress = 0;
    ball.shakeCount = 0;
    ball.shakeTimer = 0;
    ball.isDraggingBall = false;
    ball.trail = [];
    ball.gotchaStarsTimer = 0;
  }

  async function toggleRealCamera() {
    window.PokeAudio.playUiClick();
    const btn = document.getElementById("btn-ar-cam");
    if (useRealCamera) {
      useRealCamera = false;
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(t => t.stop());
        videoEl.srcObject = null;
      }
      if (btn) btn.textContent = "[AR+] AR+ Câmera";
      window.PokeStorage.showToast("[3D] Fundo 3D ASCII Virtual ativado.", "info");
      return;
    }

    const ok = await E.startCameraOnVideoElement(videoEl, (msg, status, httpsUrl) => {
      window.PokeStorage.showToast(msg, status === "ok" ? "success" : "warn");
      if (status === "https_required" && httpsUrl) {
        setTimeout(() => {
          if (confirm("O iPhone/iOS exige conexão HTTPS segura para abrir a câmera.\nDeseja abrir a porta HTTPS (:8443) agora?")) {
            window.location.href = httpsUrl;
          }
        }, 400);
      }
    });

    if (ok) {
      useRealCamera = true;
      if (btn) btn.textContent = "[AR+] AR+ ON";
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then(state => {
          if (state === "granted") attachGyroListener();
        }).catch(() => {});
      } else {
        attachGyroListener();
      }
    }
  }

  let gyroAttached = false;
  function attachGyroListener() {
    if (gyroAttached) return;
    gyroAttached = true;
    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha !== null && e.beta !== null && gameScene === "AR_CAPTURE") {
        camYaw = (e.alpha * Math.PI / 180) * 0.35;
        camPitch = Math.max(-0.6, Math.min(0.6, ((e.beta - 65) * Math.PI / 180) * 0.45));
      }
    });
  }

  // ============================================================================
  // DISTÂNCIA PONTO-SEGMENTO PARA RUAS OPENSTREETMAP NO RAYCAST DO CHÃO 3D ASCII
  // ============================================================================
  function distToSegmentSq(px, pz, ax, az, bx, bz) {
    const l2 = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
    if (l2 === 0) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
    let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * (bx - ax);
    const qz = az + t * (bz - az);
    return (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
  }

  // ============================================================================
  // CACHE ESPACIAL O(1) DO MAPA TERRESTRE (256x256 TILES = 128m x 128m)
  // Elimina 5.000.000 de testes de segmento OSM por frame no Mobile (300x mais rápido!)
  // ============================================================================
  const OSM_GRID_SIZE = 256;
  const OSM_GRID_STEP = 0.5; // 0.5m por célula
  const osmGroundGrid = new Uint8Array(OSM_GRID_SIZE * OSM_GRID_SIZE);
  let osmGridCenterX = -99999;
  let osmGridCenterZ = -99999;
  let osmGridLastRoadCount = -1;

  function rebuildOsmGroundGrid() {
    osmGridCenterX = Math.round(cityState.playerX);
    osmGridCenterZ = Math.round(cityState.playerZ);
    osmGridLastRoadCount = cityState.osmRoads.length;
    osmGroundGrid.fill(0);
    if (cityState.osmRoads.length === 0) return;

    const halfSpan = (OSM_GRID_SIZE * OSM_GRID_STEP) * 0.5;
    const minWorldX = osmGridCenterX - halfSpan;
    const minWorldZ = osmGridCenterZ - halfSpan;

    // 1. Rasteriza plantas baixas planas dos edifícios (4 = interior planta baixa, 5 = parede perimetral)
    for (let bi = 0; bi < cityState.osmBuildings.length; ++bi) {
      const b = cityState.osmBuildings[bi];
      const gx0 = Math.max(0, Math.floor((b.minX - minWorldX) / OSM_GRID_STEP));
      const gx1 = Math.min(OSM_GRID_SIZE - 1, Math.ceil((b.maxX - minWorldX) / OSM_GRID_STEP));
      const gz0 = Math.max(0, Math.floor((b.minZ - minWorldZ) / OSM_GRID_STEP));
      const gz1 = Math.min(OSM_GRID_SIZE - 1, Math.ceil((b.maxZ - minWorldZ) / OSM_GRID_STEP));
      for (let gz = gz0; gz <= gz1; ++gz) {
        const isEdgeZ = (gz === gz0 || gz === gz1);
        const rowOff = gz * OSM_GRID_SIZE;
        for (let gx = gx0; gx <= gx1; ++gx) {
          osmGroundGrid[rowOff + gx] = (isEdgeZ || gx === gx0 || gx === gx1) ? 5 : 4;
        }
      }
    }

    // 2. Rasteriza ruas, meios-fios (3), asfalto (1) e faixa central (2)
    for (let ri = 0; ri < cityState.osmRoads.length; ++ri) {
      const road = cityState.osmRoads[ri];
      const hwSq = road.halfW * road.halfW;
      const curbR = road.halfW + 0.35;
      const curbSq = curbR * curbR;
      const pts = road.pts;
      for (let pi = 0; pi < pts.length - 1; ++pi) {
        const ax = pts[pi].x, az = pts[pi].z;
        const bx = pts[pi + 1].x, bz = pts[pi + 1].z;
        const segMinX = Math.min(ax, bx) - curbR, segMaxX = Math.max(ax, bx) + curbR;
        const segMinZ = Math.min(az, bz) - curbR, segMaxZ = Math.max(az, bz) + curbR;
        const gx0 = Math.max(0, Math.floor((segMinX - minWorldX) / OSM_GRID_STEP));
        const gx1 = Math.min(OSM_GRID_SIZE - 1, Math.ceil((segMaxX - minWorldX) / OSM_GRID_STEP));
        const gz0 = Math.max(0, Math.floor((segMinZ - minWorldZ) / OSM_GRID_STEP));
        const gz1 = Math.min(OSM_GRID_SIZE - 1, Math.ceil((segMaxZ - minWorldZ) / OSM_GRID_STEP));

        for (let gz = gz0; gz <= gz1; ++gz) {
          const wz = minWorldZ + (gz + 0.5) * OSM_GRID_STEP;
          const rowOff = gz * OSM_GRID_SIZE;
          for (let gx = gx0; gx <= gx1; ++gx) {
            const wx = minWorldX + (gx + 0.5) * OSM_GRID_STEP;
            const dSq = distToSegmentSq(wx, wz, ax, az, bx, bz);
            if (dSq < 0.05) {
              osmGroundGrid[rowOff + gx] = 2;
            } else if (dSq < hwSq) {
              if (osmGroundGrid[rowOff + gx] !== 2) osmGroundGrid[rowOff + gx] = 1;
            } else if (dSq < curbSq) {
              const cur = osmGroundGrid[rowOff + gx];
              if (cur !== 1 && cur !== 2) osmGroundGrid[rowOff + gx] = 3;
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // ESTÁGIO 1 DO PIPELINE 100% ASCII: FUNDO / CÂMERA AO VIVO / CHÃO 3D + SOBEL
  // Usa a EXATA MESMA base ortonormal (camBasis.s, camBasis.u, camBasis.f, camBasis.eye)
  // da matriz de projeção 3D para que o chão e todos os objetos 3D fiquem 100% soldados!
  // ============================================================================
  function captureCameraAndComputeSobel(timeSec, camBasis, fovY, aspect) {
    camCellType.fill(0);
    if (
      gameScene === "CITY_MAP" &&
      (cityState.osmRoads.length !== osmGridLastRoadCount ||
       Math.hypot(cityState.playerX - osmGridCenterX, cityState.playerZ - osmGridCenterZ) > 22.0)
    ) {
      rebuildOsmGroundGrid();
    }
    const osmMinWX = osmGridCenterX - (OSM_GRID_SIZE * OSM_GRID_STEP) * 0.5;
    const osmMinWZ = osmGridCenterZ - (OSM_GRID_SIZE * OSM_GRID_STEP) * 0.5;
    const hasOsm = cityState.osmRoads.length > 0;
    if (useRealCamera && gameScene === "AR_CAPTURE" && videoEl && videoEl.readyState >= 2) {
      sampleCtx.drawImage(videoEl, 0, 0, cols, rows);
      const img = sampleCtx.getImageData(0, 0, cols, rows).data;
      for (let i = 0, p = 0; i < cols * rows; ++i, p += 4) {
        const r = img[p] / 255, g = img[p + 1] / 255, b = img[p + 2] / 255;
        camR[i] = r; camG[i] = g; camB[i] = b;
        camLuma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    } else if (gameScene === "EVOLUTION_CUTSCENE") {
      // Câmara Cósmica 3D de Evolução em ASCII
      for (let r = 0; r < rows; ++r) {
        const ny = r / rows;
        for (let c = 0; c < cols; ++c) {
          const idx = r * cols + c;
          const nx = (c / cols) - 0.5;
          const beam = Math.exp(-nx * nx * 14.0) * (0.45 + 0.25 * Math.sin(ny * 22 - timeSec * 8));
          const wave = 0.08 * Math.sin(c * 0.35 + timeSec * 4) * Math.cos(r * 0.3 - timeSec * 3);
          const R = Math.min(1, 0.06 + beam * 0.45 + wave);
          const G = Math.min(1, 0.14 + beam * 0.85 + Math.max(0, wave));
          const B = Math.min(1, 0.32 + beam * 1.10);
          camR[idx] = R; camG[idx] = G; camB[idx] = B;
          camLuma[idx] = 0.299 * R + 0.587 * G + 0.114 * B;
        }
      }
    } else {
      // Raycast 3D do Céu e do Chão matematicamente idêntico à View-Projection 3D!
      const groundY = -1.25;
      const fovScale = Math.tan(fovY * 0.5);
      const s = camBasis.s, u = camBasis.u, f = camBasis.f, eye = camBasis.eye;

      for (let r = 0; r < rows; ++r) {
        const ndcY = (1.0 - 2.0 * ((r + 0.5) / rows)) * fovScale;
        for (let c = 0; c < cols; ++c) {
          const idx = r * cols + c;
          const ndcX = (2.0 * ((c + 0.5) / cols) - 1.0) * aspect * fovScale;

          // Raio no mundo = f + ndcX * s + ndcY * u (inversa exata de mat4Perspective * mat4LookAtBasis!)
          const rxW = f.x + ndcX * s.x + ndcY * u.x;
          const ryW = f.y + ndcX * s.y + ndcY * u.y;
          const rzW = f.z + ndcX * s.z + ndcY * u.z;

          if (ryW >= -0.008) {
            // Céu Crepuscular Pokémon GO (Ref: 22.18.13 (2).jpeg)
            const skyT = Math.min(1, Math.max(0, ryW * 2.2));
            let R = 0.78 * (1 - skyT) + 0.14 * skyT;
            let G = 0.48 * (1 - skyT) + 0.22 * skyT;
            let B = 0.56 * (1 - skyT) + 0.52 * skyT;
            if (gameScene === "LIVE_BATTLE") {
              const stadiumGlow = Math.max(0, Math.sin(c * 0.22 + timeSec * 2)) * (1 - skyT) * 0.25;
              R += stadiumGlow; G += stadiumGlow * 0.8; B += stadiumGlow * 1.2;
            }
            camR[idx] = Math.min(1, R);
            camG[idx] = Math.min(1, G);
            camB[idx] = Math.min(1, B);
            camLuma[idx] = 0.299 * R + 0.587 * G + 0.114 * B;
          } else {
            const tHit = (groundY - eye.y) / ryW;
            const wx = eye.x + rxW * tHit;
            const wz = eye.z + rzW * tHit;
            const fog = Math.exp(-Math.max(0, tHit) * 0.015);

            if (gameScene === "CITY_MAP") {
              // Paleta Oficial do Mapa Pokémon GO com Ruas, Faixas Centrais, Meio-Fio Salmão e Plantas Baixas Planas
              let gR = 0.12, gG = 0.19, gB = 0.42; // Terreno Índigo (#1f306b)
              const checker = ((Math.floor(wx * 0.5) + Math.floor(wz * 0.5)) & 1);
              if (checker) { gR += 0.02; gG += 0.025; gB += 0.04; }

              let ct = 0;
              if (hasOsm) {
                const gx = Math.floor((wx - osmMinWX) / OSM_GRID_STEP);
                const gz = Math.floor((wz - osmMinWZ) / OSM_GRID_STEP);
                if (gx >= 0 && gx < OSM_GRID_SIZE && gz >= 0 && gz < OSM_GRID_SIZE) {
                  ct = osmGroundGrid[(gz << 8) | gx];
                }
              } else {
                const roadX = Math.abs((wx % 12 + 12) % 12 - 6);
                const roadZ = Math.abs((wz % 12 + 12) % 12 - 6);
                if (roadX < 0.12 || roadZ < 0.12) {
                  ct = 2; // Faixa central
                } else if (roadX < 1.35 || roadZ < 1.35) {
                  ct = 1; // Asfalto
                } else if (roadX < 1.68 || roadZ < 1.68) {
                  ct = 3; // Meio-fio salmão
                } else if (roadX >= 2.5 && roadX <= 5.1 && roadZ >= 2.5 && roadZ <= 5.1) {
                  const isWall = (roadX < 2.75 || roadX > 4.85 || roadZ < 2.75 || roadZ > 4.85);
                  ct = isWall ? 5 : 4; // Planta baixa de edifício desenhada plana no chão!
                }
              }

              camCellType[idx] = ct;
              if (ct === 2) {
                gR = 0.25; gG = 0.78; gB = 0.92;
              } else if (ct === 1) {
                gR = 0.07; gG = 0.12; gB = 0.30;
              } else if (ct === 3) {
                gR = 0.72; gG = 0.45; gB = 0.50;
              } else if (ct === 5) {
                // Contorno arquitetônico plano do prédio no chão
                gR = 0.34; gG = 0.52; gB = 0.84;
              } else if (ct === 4) {
                // Interior plano do prédio no chão
                gR = 0.18; gG = 0.27; gB = 0.54;
              }

              camR[idx] = gR * fog + 0.22 * (1 - fog);
              camG[idx] = gG * fog + 0.24 * (1 - fog);
              camB[idx] = gB * fog + 0.44 * (1 - fog);
            } else if (gameScene === "LIVE_BATTLE") {
              const arenaRing = Math.abs(Math.hypot(wx, wz + 3.8) - 3.2) < 0.22;
              const centerLine = Math.abs(wz + 3.8) < 0.12 && Math.abs(wx) < 3.4;
              let gR = 0.10, gG = 0.18, gB = 0.34;
              if (arenaRing || centerLine) {
                gR = 0.25; gG = 0.85; gB = 0.78;
                camCellType[idx] = 2;
              } else if (((Math.floor(wx) + Math.floor(wz)) & 1) === 0) {
                gR = 0.13; gG = 0.22; gB = 0.40;
              }
              camR[idx] = gR * fog + 0.15 * (1 - fog);
              camG[idx] = gG * fog + 0.22 * (1 - fog);
              camB[idx] = gB * fog + 0.38 * (1 - fog);
            } else {
              const gx = Math.floor(wx * 1.4), gz = Math.floor(wz * 1.4);
              const checker = ((gx + gz) & 1) ? 0.18 : 0.13;
              const gR = (checker * 0.42) * fog + 0.15 * (1 - fog);
              const gG = (checker * 1.40) * fog + 0.32 * (1 - fog);
              const gB = (checker * 0.68) * fog + 0.35 * (1 - fog);
              camR[idx] = gR; camG[idx] = gG; camB[idx] = gB;
            }
            camLuma[idx] = 0.299 * camR[idx] + 0.587 * camG[idx] + 0.114 * camB[idx];
          }
        }
      }
    }

    // Filtro Sobel 3x3 no fundo para caracteres direcionais (| - / \)
    edgeMag.fill(0);
    edgeDir.fill(0);
    for (let r = 1; r < rows - 1; ++r) {
      for (let c = 1; c < cols - 1; ++c) {
        const i = r * cols + c;
        const gx = -camLuma[i - cols - 1] + camLuma[i - cols + 1]
                   - 2 * camLuma[i - 1]   + 2 * camLuma[i + 1]
                   - camLuma[i + cols - 1] + camLuma[i + cols + 1];
        const gy = -camLuma[i - cols - 1] - 2 * camLuma[i - cols] - camLuma[i - cols + 1]
                   + camLuma[i + cols - 1] + 2 * camLuma[i + cols] + camLuma[i + cols + 1];
        const mag = Math.hypot(gx, gy);
        edgeMag[i] = mag;
        if (mag > 0.15) {
          const deg = ((Math.atan2(gy, gx) * 180 / Math.PI) + 180) % 180;
          if (deg < 22.5 || deg >= 157.5) edgeDir[i] = 1;      // '|'
          else if (deg >= 67.5 && deg < 112.5) edgeDir[i] = 2; // '-'
          else if (deg >= 22.5 && deg < 67.5) edgeDir[i] = 3;  // '/'
          else edgeDir[i] = 4;                                 // '\'
        }
      }
    }
  }

  // ============================================================================
  // ESTÁGIO 2 DO PIPELINE 100% ASCII: RASTERIZADOR 3D G-BUFFER + SOBEL 3D
  // ============================================================================
  let vBufCap = 8192;
  let vBufSx = new Float32Array(vBufCap);
  let vBufSy = new Float32Array(vBufCap);
  let vBufSz = new Float32Array(vBufCap);
  let vBufOk = new Uint8Array(vBufCap);
  let vBufNx = new Float32Array(vBufCap);
  let vBufNy = new Float32Array(vBufCap);
  let vBufNz = new Float32Array(vBufCap);

  function rasterize3DScene(timeSec) {
    gbZ.fill(Infinity);
    gbId.fill(0);

    const fovY = 52 * Math.PI / 180;
    const aspect = (cols * cellW) / (rows * cellH);
    let camBasis;

    if (gameScene === "CITY_MAP") {
      const dist = cityState.camOrbitDist;
      const pitch = cityState.camOrbitPitch;
      const yaw = cityState.camOrbitYaw;
      // Alvo 3D fixo no centro do treinador no plano do chão!
      const target = { x: cityState.playerX, y: -0.85, z: cityState.playerZ };
      const eye = {
        x: target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        y: target.y + Math.sin(pitch) * dist,
        z: target.z + Math.cos(yaw) * Math.cos(pitch) * dist
      };
      camBasis = E.mat4LookAtBasis(eye, target);
    } else if (gameScene === "AR_CAPTURE") {
      if (encounterIntroT < 1.0) {
        encounterIntroT = Math.min(1.0, encounterIntroT + 0.032);
      }
      const ease = 1.0 - Math.pow(1.0 - encounterIntroT, 3);
      const eye = {
        x: camPos.x + (1.0 - ease) * 1.4,
        y: camPos.y + (1.0 - ease) * 1.1,
        z: camPos.z + (1.0 - ease) * 2.2
      };
      const target = {
        x: eye.x - Math.sin(camYaw) * Math.cos(camPitch) * 4.5,
        y: eye.y + Math.sin(camPitch) * 4.5,
        z: eye.z - Math.cos(camYaw) * Math.cos(camPitch) * 4.5
      };
      camBasis = E.mat4LookAtBasis(eye, target);
    } else if (gameScene === "LIVE_BATTLE") {
      camBasis = E.mat4LookAtBasis({ x: 0.45, y: 0.55, z: 0.45 }, { x: 0.0, y: -0.65, z: -3.8 });
    } else {
      camBasis = E.mat4LookAtBasis({ x: 0.0, y: 0.15, z: 0.0 }, { x: 0.0, y: -0.35, z: -4.2 });
    }

    captureCameraAndComputeSobel(timeSec, camBasis, fovY, aspect);

    const proj = E.mat4Perspective(fovY, aspect, 0.25, 180.0);
    const vp = E.mat4Mul(proj, camBasis.view);

    const drawCmds = [];
    projectedClickTargets = [];

    if (gameScene === "CITY_MAP") {
      const p = window.PokeStorage.getProfile();
      // Compensação de escala inteligente em zoom distante para manter todos os modelos 3D nítidos!
      const zoomComp = 1.0 + Math.max(0, (cityState.camOrbitDist - 10.0) * 0.032);

      // 1. ANEL 3D DE RAIO DE AÇÃO INVARIANTE À ROTAÇÃO DA CÂMERA (3.5m de raio no plano Y=-1.24)
      drawCmds.push({
        id: 7,
        mesh: E.buildAnchorRingMesh(3.5, 0.14, 36),
        model: E.mat4Translation(cityState.playerX, -1.24, cityState.playerZ)
      });
      const sonarPhase = (timeSec * 0.55) % 1.0;
      const sonarRadius = 0.45 + sonarPhase * 3.05;
      drawCmds.push({
        id: 7,
        mesh: E.buildAnchorRingMesh(sonarRadius, 0.07, 28),
        model: E.mat4Translation(cityState.playerX, -1.235, cityState.playerZ)
      });
      drawCmds.push({
        id: 7,
        mesh: E.buildAnchorRingMesh(0.75, 0.08, 24),
        model: E.mat4Translation(cityState.playerX, -1.23, cityState.playerZ)
      });

      // 2. AVATAR 3D DO TREINADOR NO CENTRO DO MAPA (Altura humana proporcional ~1.88m)
      const avScale = 1.08 * zoomComp;
      const avatarMesh = E.buildTrainerAvatarMesh(p.gender, p.avatar, cityState.walkCycle, cityState.isMoving);
      const mAvatar = E.mat4Mul(
        E.mat4Translation(cityState.playerX, -1.25, cityState.playerZ),
        E.mat4Mul(E.mat4RotY(cityState.facingYaw + Math.PI), E.mat4Scale(avScale, avScale, avScale))
      );
      drawCmds.push({ id: 10, mesh: avatarMesh, model: mAvatar });

      // 3. POKÉMON PARCEIRO (BUDDY) CAMINHANDO AO SEU LADO EM PROPORÇÃO REALISTA
      const buddyMon = p.pokemonBox.find(m => m.uid === p.buddyUid) || p.pokemonBox[0];
      if (buddyMon) {
        const bScale = E.computeVisualScale(buddyMon.speciesId, 1.0) * 0.82 * zoomComp;
        const bMesh = E.getPokemonMesh(buddyMon.speciesId, buddyMon.isShiny);
        const bx = cityState.playerX - Math.cos(cityState.facingYaw) * (1.25 * zoomComp);
        const bz = cityState.playerZ - Math.sin(cityState.facingYaw) * (1.25 * zoomComp);
        const by = -1.22 + Math.abs(Math.sin(timeSec * 5.0)) * 0.10;
        const mBuddy = E.mat4Mul(
          E.mat4Translation(bx, by, bz),
          E.mat4Mul(E.mat4RotY(cityState.facingYaw + Math.PI), E.mat4Scale(bScale, bScale, bScale))
        );
        drawCmds.push({ id: 11, mesh: bMesh, model: mBuddy, speciesId: buddyMon.speciesId });
      }

      // (Edifícios permanecem desenhados apenas planos no chão em captureCameraAndComputeSobel, sem obstruir Ginásios!)

      // 4. POKÉSTOPS 3D
      cityState.pokestops.forEach((ps, idx) => {
        const dPlayer = Math.hypot(ps.x - cityState.playerX, ps.z - cityState.playerZ);
        if (dPlayer > 56.0) return;
        const isCd = Date.now() < ps.cooldownUntil;
        const psMesh = E.buildPokestop3DMesh(isCd);
        const psScale = zoomComp;
        const mPs = E.mat4Mul(
          E.mat4Translation(ps.x, -1.25, ps.z),
          E.mat4Mul(E.mat4RotY(timeSec * (isCd ? 0.5 : 1.6) + idx), E.mat4Scale(psScale, psScale, psScale))
        );
        drawCmds.push({ id: 20 + (idx % 10), mesh: psMesh, model: mPs });
        const pt = E.projectPoint3D(vp, ps.x, -1.25 + 2.1 * psScale, ps.z, canvas.width, canvas.height);
        if (pt) {
          projectedClickTargets.push({
            type: "POKESTOP", index: idx, x: pt.x, y: pt.y, r: 44,
            dPlayer, depth: pt.depth,
            hasLure: !!ps.hasLure,
            label: `${isCd ? "[CD]" : "[STOP]"} ${ps.name}`,
            sub: isCd ? "Recarga" : (ps.hasLure ? "Lure" : "Girar")
          });
        }
      });

      // 5. GINÁSIOS 3D + GUARDIÃO 3D NO TOPO + BOSS DE RAID
      cityState.gyms.forEach((gym, idx) => {
        const dPlayer = Math.hypot(gym.x - cityState.playerX, gym.z - cityState.playerZ);
        if (dPlayer > 64.0) return;
        const gScale = zoomComp;
        const gMesh = E.buildGymTower3DMesh(gym.color);
        const mGym = E.mat4Mul(
          E.mat4Translation(gym.x, -1.25, gym.z),
          E.mat4Mul(E.mat4RotY(timeSec * 0.5 + idx), E.mat4Scale(gScale, gScale, gScale))
        );
        drawCmds.push({ id: 30 + (idx % 5), mesh: gMesh, model: mGym });

        const topDefenderId = (gym.defenders && gym.defenders[0]) ? gym.defenders[0].speciesId : gym.guardSpeciesId;
        const guardMesh = E.getPokemonMesh(topDefenderId, false);
        const guardScale = E.computeVisualScale(topDefenderId, 1.0) * 0.92 * gScale;
        const mGuard = E.mat4Mul(
          E.mat4Translation(gym.x, -1.25 + (2.68 + Math.sin(timeSec * 2.5) * 0.10) * gScale, gym.z),
          E.mat4Mul(E.mat4RotY(timeSec * 1.2), E.mat4Scale(guardScale, guardScale, guardScale))
        );
        drawCmds.push({ id: 35 + (idx % 5), mesh: guardMesh, model: mGuard, speciesId: topDefenderId, useLod: dPlayer > 14.0 });

        const pt = E.projectPoint3D(vp, gym.x, -1.25 + 3.4 * gScale, gym.z, canvas.width, canvas.height);
        if (pt) {
          projectedClickTargets.push({
            type: "GYM", index: idx, x: pt.x, y: pt.y, r: 54,
            dPlayer, depth: pt.depth,
            label: `[GYM] ${gym.name}`,
            sub: `${gym.team} (${(gym.defenders || []).length}/6) • Raid ${gym.raidTier || 5}*`
          });
        }
      });

      // 6. BALÃO 3D DOS VILÕES (TEAM ROCKET CYBER)
      if (cityState.villainBalloon.active) {
        const dPlayer = Math.hypot(cityState.villainBalloon.x - cityState.playerX, cityState.villainBalloon.z - cityState.playerZ);
        const vMesh = E.buildVillainBalloon3DMesh();
        const by = cityState.villainBalloon.y + Math.sin(timeSec * 1.8) * 0.25;
        const mBalloon = E.mat4Mul(
          E.mat4Translation(cityState.villainBalloon.x, by, cityState.villainBalloon.z),
          E.mat4RotY(timeSec * 0.7)
        );
        drawCmds.push({ id: 45, mesh: vMesh, model: mBalloon });
        const pt = E.projectPoint3D(vp, cityState.villainBalloon.x, by + 1.5, cityState.villainBalloon.z, canvas.width, canvas.height);
        if (pt) {
          projectedClickTargets.push({
            type: "VILLAIN", index: 0, x: pt.x, y: pt.y, r: 48,
            dPlayer, depth: pt.depth,
            label: "[VILAO] Balao Cyber",
            sub: "Duelo"
          });
        }
      }

      // 7. POKÉMONS SELVAGENS 3D EM VOLTA DO TREINADOR NO MAPA (Proporção fiel em relação ao Avatar!)
      const spawnRingMesh = E.buildAnchorRingMesh(0.68, 0.07, 20);
      cityState.wildSpawns.forEach((sp, idx) => {
        const dPlayer = Math.hypot(sp.x - cityState.playerX, sp.z - cityState.playerZ);
        if (dPlayer > 42.0) return;
        const wMesh = E.getPokemonMesh(sp.mon.speciesId, sp.mon.isShiny);
        const ageSec = Math.max(0.05, (performance.now() - (sp.spawnedAt || 0)) / 1000.0);
        const popElastic = ageSec < 0.65 ? Math.min(1.12, (ageSec / 0.5) * 1.12) : 1.0;
        const sScale = E.computeVisualScale(sp.mon.speciesId, sp.mon.scaleVariation) * popElastic * zoomComp;
        const hop = Math.abs(Math.sin(timeSec * 3.5 + idx)) * 0.08;
        const mWild = E.mat4Mul(
          E.mat4Translation(sp.x, -1.22 + hop, sp.z),
          E.mat4Mul(E.mat4RotY(sp.rotY + Math.sin(timeSec + idx) * 0.4), E.mat4Scale(sScale, sScale, sScale))
        );
        drawCmds.push({ id: 50 + idx, mesh: wMesh, model: mWild, speciesId: sp.mon.speciesId, useLod: dPlayer > 11.0 });
        drawCmds.push({ id: 7, mesh: spawnRingMesh, model: E.mat4Translation(sp.x, -1.24, sp.z) });

        const pt = E.projectPoint3D(vp, sp.x, -1.22 + 1.55 * sScale, sp.z, canvas.width, canvas.height);
        if (pt) {
          projectedClickTargets.push({
            type: "WILD", index: idx, x: pt.x, y: pt.y, r: 44,
            dPlayer, depth: pt.depth,
            isStarter: !!sp.isStarterTutorial,
            label: `${sp.isStarterTutorial ? "[INICIAL] " : ""}${sp.mon.isShiny ? "* " : ""}${sp.mon.name}`,
            sub: `CP ${sp.mon.cp}`
          });
        }
      });

    } else if (gameScene === "AR_CAPTURE" && wildMon) {
      // MODO ENCONTRO DE CAPTURA 100% EM ASCII 3D (Escala ampliada de close-up 1.52x!)
      const sp = window.PokeData.getSpecies(wildMon.speciesId);
      const baseScale = E.computeVisualScale(wildMon.speciesId, wildMon.scaleVariation) * 1.52;

      // 1. Anel de Ancoragem 3D no chão sob o Pokémon
      drawCmds.push({
        id: 2,
        mesh: E.buildAnchorRingMesh(1.15, 0.09, 28),
        model: E.mat4Translation(wildAnchor.x, wildAnchor.y, wildAnchor.z)
      });

      // 2. Animação do Pokémon 3D (Normal, Entrando na Pokébola em state=2, ou Saindo em state=5)
      if (ball.state !== 3 && ball.state !== 4) {
        let monX = wildAnchor.x;
        let monY = wildAnchor.y + (sp.types.includes("Flying") ? 0.45 + 0.18 * Math.sin(timeSec * 3.2) : Math.abs(Math.sin(timeSec * 2.6)) * 0.12);
        let monZ = wildAnchor.z;
        let morphScale = baseScale;
        let forceRedEnergy = false;

        if (ball.state === 2) {
          // ENTRANDO NA POKÉBOLA: O Pokémon encolhe em energia vermelha e voa para dentro da Pokébola aberta!
          const t = Math.min(1, ball.morphProgress);
          monX = wildAnchor.x * (1 - t) + ball.pos.x * t;
          monY = monY * (1 - t) + ball.pos.y * t;
          monZ = wildAnchor.z * (1 - t) + ball.pos.z * t;
          morphScale = baseScale * Math.max(0.08, 1.0 - t * 0.92);
          forceRedEnergy = true;
        } else if (ball.state === 5) {
          // SAINDO DA POKÉBOLA (BREAKOUT): Emerge de dentro da Pokébola aberta no chão de volta à posição 3D!
          const t = Math.min(1, ball.morphProgress);
          monX = ball.pos.x * (1 - t) + wildAnchor.x * t;
          monY = ball.pos.y * (1 - t) + monY * t;
          monZ = ball.pos.z * (1 - t) + wildAnchor.z * t;
          morphScale = baseScale * (0.08 + 0.92 * t);
          forceRedEnergy = t < 0.45;
        }

        const monRotY = Math.sin(timeSec * 1.3) * 0.32 + (ball.state === 2 ? ball.morphProgress * 8.0 : 0);
        const mMon = E.mat4Mul(
          E.mat4Translation(monX, monY, monZ),
          E.mat4Mul(E.mat4RotY(monRotY), E.mat4Scale(morphScale, morphScale, morphScale))
        );
        drawCmds.push({
          id: 1,
          mesh: E.getPokemonMesh(wildMon.speciesId, wildMon.isShiny),
          model: mMon,
          speciesId: wildMon.speciesId,
          tintRedLaser: forceRedEnergy
        });

        // Projeta a caixa 2D real do Pokémon 3D para o Anel de Captura cobrir o diâmetro do monstro!
        const centerPt = E.projectPoint3D(vp, monX, monY + 0.55 * baseScale, monZ, canvas.width, canvas.height);
        const topPt = E.projectPoint3D(vp, monX, monY + 1.15 * baseScale, monZ, canvas.width, canvas.height);
        if (centerPt && topPt) {
          lastWildScreenBox.x = centerPt.x;
          lastWildScreenBox.y = centerPt.y;
          lastWildScreenBox.radiusPx = Math.max(72, Math.min(185, Math.abs(centerPt.y - topPt.y) * 1.45));
        }
      }

      // 3. Pokébola 3D Articulada (A tampa superior abre em 3D quando ball.lidOpenAngle > 0!)
      const bScale = 0.25;
      const wobbleZ = ball.state === 3 ? Math.sin(ball.shakeTimer * 20) * 0.38 : 0;
      const mBall = E.mat4Mul(
        E.mat4Translation(ball.pos.x, ball.pos.y, ball.pos.z),
        E.mat4Mul(
          E.mat4RotZ(wobbleZ),
          E.mat4Mul(E.mat4RotY(ball.rotAngle), E.mat4Scale(bScale, bScale, bScale))
        )
      );
      drawCmds.push({
        id: 3,
        mesh: E.buildPokeballMesh(activeBallType, ball.lidOpenAngle),
        model: mBall
      });

    } else if (gameScene === "LIVE_BATTLE" && liveBattle.active) {
      // ARENA DE BATALHA 3D AO VIVO 100% EM ASCII!
      const now = performance.now();
      const pMon = liveBattle.playerMon;
      const eMon = liveBattle.enemyMon;

      // 1. Pokémon Inimigo / Raid Boss 3D ao fundo da arena
      if (eMon) {
        const eAttackT = now < liveBattle.enemyAttackAnimUntil ? Math.sin(((liveBattle.enemyAttackAnimUntil - now) / 360) * Math.PI) : 0;
        const eScale = E.computeVisualScale(eMon.speciesId, 1.0) * (liveBattle.isRaidEncounter ? 1.75 : 1.42);
        const ex = 0.55 - eAttackT * 0.35;
        const ey = -1.10 + Math.abs(Math.sin(timeSec * 3.0)) * 0.10 + eAttackT * 0.25;
        const ez = -5.2 + eAttackT * 1.35;
        const mEnemy = E.mat4Mul(
          E.mat4Translation(ex, ey, ez),
          E.mat4Mul(E.mat4RotY(-0.25), E.mat4Scale(eScale, eScale, eScale))
        );
        drawCmds.push({
          id: 61,
          mesh: E.getPokemonMesh(eMon.speciesId, eMon.isShiny),
          model: mEnemy,
          speciesId: eMon.speciesId
        });
        drawCmds.push({
          id: 7,
          mesh: E.buildAnchorRingMesh(1.35, 0.10, 28),
          model: E.mat4Translation(ex, -1.24, ez)
        });
      }

      // 2. Pokémon do Jogador 3D em primeiro plano (com investida 3D e esquiva lateral 3D!)
      if (pMon) {
        const pAttackT = now < liveBattle.playerAttackAnimUntil ? Math.sin(((liveBattle.playerAttackAnimUntil - now) / 280) * Math.PI) : 0;
        const dodgeX = now < liveBattle.dodgeUntil ? liveBattle.dodgeOffsetX : 0;
        const pScale = E.computeVisualScale(pMon.speciesId, 1.0) * 1.32;
        const px = -0.55 + dodgeX * 1.35 + pAttackT * 0.45;
        const py = -1.15 + Math.abs(Math.sin(timeSec * 3.6)) * 0.08 + pAttackT * 0.22;
        const pz = -2.45 - pAttackT * 1.15;
        const mPlayer = E.mat4Mul(
          E.mat4Translation(px, py, pz),
          E.mat4Mul(E.mat4RotY(Math.PI - 0.35), E.mat4Scale(pScale, pScale, pScale))
        );
        drawCmds.push({
          id: 60,
          mesh: E.getPokemonMesh(pMon.speciesId, pMon.isShiny),
          model: mPlayer,
          speciesId: pMon.speciesId
        });
        drawCmds.push({
          id: 7,
          mesh: E.buildAnchorRingMesh(1.10, 0.09, 24),
          model: E.mat4Translation(px, -1.24, pz)
        });

        // Escudo 3D se ativo
        if (now < liveBattle.shieldActiveUntil) {
          drawCmds.push({
            id: 7,
            mesh: E.buildAnchorRingMesh(1.45, 0.22, 28),
            model: E.mat4Translation(px, -0.55, pz)
          });
        }
      }

    } else if (gameScene === "EVOLUTION_CUTSCENE" && evoScene.active) {
      // CUTSCENE 3D DE EVOLUÇÃO COM MORPH DE SILHUETA 100% EM ASCII!
      const elapsed = (performance.now() - evoScene.startTime) / 1000.0;
      const progress = Math.min(1.0, elapsed / evoScene.durationSec);

      // Pedestal 3D de Energia
      drawCmds.push({
        id: 7,
        mesh: E.buildAnchorRingMesh(1.45, 0.14, 32),
        model: E.mat4Translation(0, -1.15, -4.2)
      });

      const rotY = timeSec * (1.5 + progress * 5.0);
      if (progress < 0.80) {
        // Fase de Morph 3D: oscila e interpola entre a malha 3D antiga e a malha 3D evoluída!
        const t = progress / 0.80;
        const freq = 3.0 + t * t * 38.0;
        const blend = 0.5 + 0.5 * Math.sin(elapsed * freq);
        const showNew = blend > (1.0 - t * 0.9);
        const activeSpeciesId = showNew ? evoScene.toSpeciesId : evoScene.fromSpeciesId;
        const pulseScale = E.computeVisualScale(activeSpeciesId, 1.0) * 1.45 * (0.95 + 0.22 * Math.sin(elapsed * freq * 1.3));
        const mEvo = E.mat4Mul(
          E.mat4Translation(0, -1.05 + t * 0.25, -4.2),
          E.mat4Mul(E.mat4RotY(rotY), E.mat4Scale(pulseScale, pulseScale, pulseScale))
        );
        drawCmds.push({
          id: 70,
          mesh: E.getPokemonMesh(activeSpeciesId, false),
          model: mEvo,
          speciesId: activeSpeciesId,
          tintEvolutionMorph: t > 0.12 // Brilho de silhueta 3D branca/ciano durante o morph!
        });
      } else {
        // Revelação Final do Pokémon 3D Evoluído em Cores Completas!
        const finalScale = E.computeVisualScale(evoScene.toSpeciesId, 1.0) * 1.62;
        const mFinal = E.mat4Mul(
          E.mat4Translation(0, -1.05, -4.2),
          E.mat4Mul(E.mat4RotY(Math.sin(timeSec * 1.6) * 0.35), E.mat4Scale(finalScale, finalScale, finalScale))
        );
        drawCmds.push({
          id: 71,
          mesh: E.getPokemonMesh(evoScene.toSpeciesId, false),
          model: mFinal,
          speciesId: evoScene.toSpeciesId
        });
      }
    }

    // Luz Direcional Sol + Rim Light 3D
    const lightDir = E.norm3({ x: 0.45, y: 0.82, z: 0.35 });

    for (const cmd of drawCmds) {
      const mvp = E.mat4Mul(vp, cmd.model);
      const m = cmd.model;
      const verts = cmd.mesh.verts;
      const indices = (cmd.useLod && cmd.mesh.lodIndices) ? cmd.mesh.lodIndices : cmd.mesh.indices;
      const isClosedGlb = Boolean(cmd.mesh.isReal3DGlb);
      const vLen = verts.length;

      if (vLen > vBufCap) {
        vBufCap = Math.max(vLen + 1024, vBufCap * 2);
        vBufSx = new Float32Array(vBufCap);
        vBufSy = new Float32Array(vBufCap);
        vBufSz = new Float32Array(vBufCap);
        vBufOk = new Uint8Array(vBufCap);
        vBufNx = new Float32Array(vBufCap);
        vBufNy = new Float32Array(vBufCap);
        vBufNz = new Float32Array(vBufCap);
      }

      // 1. Transforma todos os vértices da malha uma única vez por drawCmd (4x mais rápido que por triângulo!)
      let meshMinX = cols, meshMaxX = -1, meshMinY = rows, meshMaxY = -1, anyVisible = false;
      for (let vi = 0; vi < vLen; ++vi) {
        const v = verts[vi];
        const px = v.pos.x, py = v.pos.y, pz = v.pos.z;
        const cw = mvp[3] * px + mvp[7] * py + mvp[11] * pz + mvp[15];
        if (cw <= 0.15) {
          vBufOk[vi] = 0;
          continue;
        }
        vBufOk[vi] = 1;
        anyVisible = true;
        const invW = 1.0 / cw;
        const cx = mvp[0] * px + mvp[4] * py + mvp[8] * pz + mvp[12];
        const cy = mvp[1] * px + mvp[5] * py + mvp[9] * pz + mvp[13];
        const cz = mvp[2] * px + mvp[6] * py + mvp[10] * pz + mvp[14];
        const sx = ((cx * invW) * 0.5 + 0.5) * cols;
        const sy = ((cy * invW) * 0.5 + 0.5) * rows;
        vBufSx[vi] = sx;
        vBufSy[vi] = sy;
        vBufSz[vi] = cz * invW;
        if (sx < meshMinX) meshMinX = sx; if (sx > meshMaxX) meshMaxX = sx;
        if (sy < meshMinY) meshMinY = sy; if (sy > meshMaxY) meshMaxY = sy;

        const nm = v.norm;
        const nwx = m[0] * nm.x + m[4] * nm.y + m[8] * nm.z;
        const nwy = m[1] * nm.x + m[5] * nm.y + m[9] * nm.z;
        const nwz = m[2] * nm.x + m[6] * nm.y + m[10] * nm.z;
        const nl = Math.hypot(nwx, nwy, nwz) || 1.0;
        vBufNx[vi] = nwx / nl;
        vBufNy[vi] = nwy / nl;
        vBufNz[vi] = nwz / nl;
      }

      // Frustum culling da malha inteira
      if (!anyVisible || meshMaxX < 0 || meshMinX >= cols || meshMaxY < 0 || meshMinY >= rows) continue;

      const meshTextures = cmd.mesh.textures || null;

      for (let t = 0; t < indices.length; t += 3) {
        const i0 = indices[t], i1 = indices[t + 1], i2 = indices[t + 2];
        if (!vBufOk[i0] || !vBufOk[i1] || !vBufOk[i2]) continue;

        const sx0 = vBufSx[i0], sx1 = vBufSx[i1], sx2 = vBufSx[i2];
        const sy0 = vBufSy[i0], sy1 = vBufSy[i1], sy2 = vBufSy[i2];

        const area = (sx2 - sx0) * (sy1 - sy0) - (sy2 - sy0) * (sx1 - sx0);
        if (Math.abs(area) < 1e-4) continue;
        // Backface Culling rápido para malhas 3D fechadas (.glb)
        if (isClosedGlb && (vBufNz[i0] + vBufNz[i1] + vBufNz[i2]) < -0.85) continue;

        const minX = Math.max(0, Math.floor(Math.min(sx0, sx1, sx2)));
        const maxX = Math.min(cols - 1, Math.ceil(Math.max(sx0, sx1, sx2)));
        const minY = Math.max(0, Math.floor(Math.min(sy0, sy1, sy2)));
        const maxY = Math.min(rows - 1, Math.ceil(Math.max(sy0, sy1, sy2)));
        if (minX > maxX || minY > maxY) continue;

        const invArea = 1.0 / area;
        const sz0 = vBufSz[i0], sz1 = vBufSz[i1], sz2 = vBufSz[i2];
        const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
        const activeTex = (meshTextures && v0.texIdx !== undefined && v0.texIdx >= 0) ? meshTextures[v0.texIdx] : null;

        for (let py = minY; py <= maxY; ++py) {
          const pfy = py + 0.5;
          for (let px = minX; px <= maxX; ++px) {
            const pfx = px + 0.5;
            const w0 = ((pfx - sx1) * (sy2 - sy1) - (pfy - sy1) * (sx2 - sx1)) * invArea;
            const w1 = ((pfx - sx2) * (sy0 - sy2) - (pfy - sy2) * (sx0 - sx2)) * invArea;
            const w2 = 1.0 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;

            const z = w0 * sz0 + w1 * sz1 + w2 * sz2;
            const idx = py * cols + px;
            if (z >= gbZ[idx]) continue;

            let nx = vBufNx[i0] * w0 + vBufNx[i1] * w1 + vBufNx[i2] * w2;
            let ny = vBufNy[i0] * w0 + vBufNy[i1] * w1 + vBufNy[i2] * w2;
            const nz = vBufNz[i0] * w0 + vBufNz[i1] * w1 + vBufNz[i2] * w2;

            let texR = v0.col.x * w0 + v1.col.x * w1 + v2.col.x * w2;
            let texG = v0.col.y * w0 + v1.col.y * w1 + v2.col.y * w2;
            let texB = v0.col.z * w0 + v1.col.z * w1 + v2.col.z * w2;

            if (activeTex && E.sampleGlbTexture) {
              const tu = v0.u * w0 + v1.u * w1 + v2.u * w2;
              const tv = v0.v * w0 + v1.v * w1 + v2.v * w2;
              const s = E.sampleGlbTexture(activeTex, tu, tv);
              if (s) {
                // Alpha Cutout: descarta pixels transparentes de decals de íris/pupila/chamas
                // para não cobrir o branco do olho com retângulos pretos!
                if (s.a < 0.35) continue;
                texR = s.r;
                texG = s.g;
                texB = s.b;
                nx += s.dU * 2.35;
                ny += s.dV * 2.35;
              }
            }

            gbZ[idx] = z;
            gbId[idx] = cmd.id;
            gbNx[idx] = nx; gbNy[idx] = ny; gbNz[idx] = nz;

            const ndotl = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z);
            const hemi = 0.34 + 0.14 * (0.5 + 0.5 * ny);
            const rim = Math.pow(1.0 - Math.min(1, Math.abs(nz)), 2.2) * 0.38;
            const spec = Math.pow(Math.max(0, ndotl), 10.0) * 0.14;
            gbLight[idx] = Math.min(1.42, hemi + 0.72 * ndotl + rim + spec);

            if (cmd.tintRedLaser) {
              gbColR[idx] = 1.0;
              gbColG[idx] = 0.22;
              gbColB[idx] = 0.28;
            } else if (cmd.tintEvolutionMorph) {
              gbColR[idx] = 0.75;
              gbColG[idx] = 0.98;
              gbColB[idx] = 1.0;
              gbLight[idx] = 1.35;
            } else {
              gbColR[idx] = texR;
              gbColG[idx] = texG;
              gbColB[idx] = texB;
            }
          }
        }
      }
    }

    // Sobel 3D Duplo (Profundidade Z + Normais 3D + Relevo UV) sobre as Entidades 3D
    for (let r = 1; r < rows - 1; ++r) {
      for (let c = 1; c < cols - 1; ++c) {
        const i = r * cols + c;
        if (gbId[i] === 0) continue;

        const idDiff = (gbId[i - 1] !== gbId[i]) || (gbId[i + 1] !== gbId[i]) ||
                       (gbId[i - cols] !== gbId[i]) || (gbId[i + cols] !== gbId[i]);
        const nxDiff = Math.abs(gbNx[i + 1] - gbNx[i - 1]) + Math.abs(gbNy[i + cols] - gbNy[i - cols]);
        const zDiff = (!idDiff) ? (Math.abs(gbZ[i + 1] - gbZ[i - 1]) + Math.abs(gbZ[i + cols] - gbZ[i - cols])) : 0;

        if (idDiff || nxDiff > 0.36 || zDiff > 0.016) {
          edgeMag[i] = 1.0;
          const gx = (gbNx[i + 1] - gbNx[i - 1]) * 1.4 + (gbId[i + 1] - gbId[i - 1]) + (gbZ[i + 1] - gbZ[i - 1]) * 12.0;
          const gy = (gbNy[i + cols] - gbNy[i - cols]) * 1.4 + (gbId[i + cols] - gbId[i - cols]) + (gbZ[i + cols] - gbZ[i - cols]) * 12.0;
          const deg = ((Math.atan2(gy, gx) * 180 / Math.PI) + 180) % 180;
          if (deg < 22.5 || deg >= 157.5) edgeDir[i] = 1;
          else if (deg >= 67.5 && deg < 112.5) edgeDir[i] = 2;
          else if (deg >= 22.5 && deg < 67.5) edgeDir[i] = 3;
          else edgeDir[i] = 4;
        }
      }
    }
  }

  // ============================================================================
  // ESTÁGIO 3 DO PIPELINE 100% ASCII: RENDERIZADOR BITMAP GLYPH ATLAS (PUTIMAGEDATA)
  // 30x mais rápido no Mobile (1 única chamada putImageData em vez de 57.000 fillText)
  // + Glifos ASCII com Anti-Aliasing Sub-Pixel de Altíssima Nitidez!
  // ============================================================================
  function renderAsciiCanvas(timeSec) {
    const shadeRamp = " .',:;!~+-=*oO08#%W@";
    const shadeLen = shadeRamp.length;
    const dirChars = [" ", "|", "-", "/", "\\"];
    const useFastBlit = Boolean(framePixels32 && frameImageData && glyphAtlas);
    const canvasW = canvas.width;

    if (!useFastBlit) {
      ctx.fillStyle = "#081024";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!fontLoaded) {
        ctx.font = `bold ${cellH}px 'Cascadia Mono', 'Fira Code', Consolas, monospace`;
        ctx.textBaseline = "top";
        fontLoaded = true;
      }
    }

    for (let r = 0; r < rows; ++r) {
      const py = r * cellH;
      for (let c = 0; c < cols; ++c) {
        const i = r * cols + c;
        const px = c * cellW;
        const id = gbId[i];

        let fgR, fgG, fgB, bgR, bgG, bgB, ch;

        if (id > 0) {
          // CÉLULA DE ENTIDADE 3D (Pokémon, Avatar, Pokébola, Anel de Raio 3.5m, Ginásio, PokéStop)
          const lit = gbLight[i];
          let cr = gbColR[i] * lit;
          let cg = gbColG[i] * lit;
          let cb = gbColB[i] * lit;
          const maxC = Math.max(cr, cg, cb, 1.0);
          if (maxC > 1.0) {
            const spec = (maxC - 1.0) * 0.16;
            cr = Math.min(1.0, cr / maxC + spec);
            cg = Math.min(1.0, cg / maxC + spec);
            cb = Math.min(1.0, cb / maxC + spec);
          }

          const isOuterSilhouette =
            (c > 0 && gbId[i - 1] === 0) || (c < cols - 1 && gbId[i + 1] === 0) ||
            (r > 0 && gbId[i - cols] === 0) || (r < rows - 1 && gbId[i + cols] === 0);

          if (id === 7 || id === 2) {
            bgR = (cr * 115) | 0;
            bgG = (cg * 155) | 0;
            bgB = (cb * 175) | 0;
            fgR = Math.min(255, (cr * 255 + 75) | 0);
            fgG = Math.min(255, (cg * 255 + 75) | 0);
            fgB = Math.min(255, (cb * 255 + 75) | 0);
            ch = ((c + r) & 1) === 0 ? "o" : "+";
          } else if (isOuterSilhouette) {
            // Contorno de silhueta 3D de 1 célula com contraste escuro profundo + traço luminoso
            bgR = (cr * 48) | 0;
            bgG = (cg * 48) | 0;
            bgB = (cb * 62) | 0;
            fgR = Math.min(255, (cr * 255 + 108) | 0);
            fgG = Math.min(255, (cg * 255 + 108) | 0);
            fgB = Math.min(255, (cb * 255 + 115) | 0);
            ch = edgeDir[i] > 0 ? dirChars[edgeDir[i]] : "#";
          } else {
            // Sombreamento 3D anatômico de 20 níveis + vincos internos Sobel 3D (olhos, boca, garras, listras)
            bgR = (cr * 212) | 0;
            bgG = (cg * 212) | 0;
            bgB = (cb * 212) | 0;

            if (edgeMag[i] > 0.42 && edgeDir[i] > 0) {
              // Vinco anatômico interno com alto contraste
              bgR = (cr * 165) | 0;
              bgG = (cg * 165) | 0;
              bgB = (cb * 172) | 0;
              fgR = Math.min(255, (cr * 255 + 96) | 0);
              fgG = Math.min(255, (cg * 255 + 96) | 0);
              fgB = Math.min(255, (cb * 255 + 96) | 0);
              ch = dirChars[edgeDir[i]];
            } else {
              fgR = Math.min(255, (cr * 255 + 64) | 0);
              fgG = Math.min(255, (cg * 255 + 64) | 0);
              fgB = Math.min(255, (cb * 255 + 64) | 0);
              const luma = Math.min(1, 0.299 * cr + 0.587 * cg + 0.114 * cb);
              ch = shadeRamp[Math.min(shadeLen - 1, Math.max(1, (luma * (shadeLen - 1)) | 0))];
            }
          }
        } else {
          // CÉLULA DO AMBIENTE 3D EM ASCII (Mapa GPS Pokémon GO com Plantas Baixas Planas)
          const cr = camR[i], cg = camG[i], cb = camB[i];
          const ct = camCellType[i];
          bgR = (cr * 185) | 0;
          bgG = (cg * 185) | 0;
          bgB = (cb * 195) | 0;

          fgR = Math.min(255, (cr * 255 + 44) | 0);
          fgG = Math.min(255, (cg * 255 + 48) | 0);
          fgB = Math.min(255, (cb * 255 + 58) | 0);

          if (ct === 2) {
            ch = "=";
          } else if (ct === 3) {
            ch = "#";
          } else if (ct === 5) {
            // Parede perimetral da planta baixa plana do prédio no chão
            ch = "+";
          } else if (ct === 4) {
            // Interior da planta baixa plana do prédio no chão
            ch = ((r & 1) === 0 && (c & 1) === 0) ? ":" : ".";
          } else if (ct === 1) {
            ch = "·";
          } else if (edgeMag[i] > 0.20 && edgeDir[i] > 0) {
            ch = dirChars[edgeDir[i]];
          } else {
            ch = ((r + c) & 1) === 0 ? "." : ",";
          }
        }

        if (useFastBlit) {
          const ci = CHAR_TO_IDX.get(ch) || 0;
          const mask = glyphAtlas[ci];
          const bgPack = 0xFF000000 | (bgB << 16) | (bgG << 8) | bgR;
          const fgPack = 0xFF000000 | (fgB << 16) | (fgG << 8) | fgR;
          const dR = fgR - bgR, dG = fgG - bgG, dB = fgB - bgB;
          let mIdx = 0;
          for (let dy = 0; dy < cellH; ++dy) {
            let pIdx = (py + dy) * canvasW + px;
            for (let dx = 0; dx < cellW; ++dx, ++mIdx, ++pIdx) {
              const a = mask[mIdx];
              if (a === 0) {
                framePixels32[pIdx] = bgPack;
              } else if (a >= 245) {
                framePixels32[pIdx] = fgPack;
              } else {
                const pr = bgR + ((dR * a) >> 8);
                const pg = bgG + ((dG * a) >> 8);
                const pb = bgB + ((dB * a) >> 8);
                framePixels32[pIdx] = 0xFF000000 | (pb << 16) | (pg << 8) | pr;
              }
            }
          }
        } else {
          ctx.fillStyle = fastRgb(bgR, bgG, bgB);
          ctx.fillRect(px, py, cellW, cellH);
          ctx.fillStyle = fastRgb(fgR, fgG, fgB);
          ctx.fillText(ch, px, py);
        }
      }
    }

    if (useFastBlit) {
      ctx.putImageData(frameImageData, 0, 0);
    }

    // ============================================================================
    // EFEITOS VISUAIS EM ASCII SOBRE O GRID (FEIXE LASER DA POKÉBOLA, VFX DE BATALHA, DNA DE EVOLUÇÃO)
    // ============================================================================
    if (gameScene === "CITY_MAP") {
      drawCityFloatingLabels();
    } else if (gameScene === "AR_CAPTURE" && wildMon) {
      drawCaptureAsciiLaserAndRing(timeSec);
    } else if (gameScene === "LIVE_BATTLE" && liveBattle.active) {
      drawLiveBattleAsciiVfxAndHud(timeSec);
    } else if (gameScene === "EVOLUTION_CUTSCENE" && evoScene.active) {
      drawEvolutionAsciiHelixAndHud(timeSec);
    }
  }

  // Etiquetas flutuantes com Cone de FOV Central + Raio de Proximidade + Anti-Colisão 2D
  // (Mantém todos os pontos clicáveis no mapa, mas só exibe os títulos próximos no centro da visão!)
  function drawCityFloatingLabels() {
    const timeSec = performance.now() * 0.001;
    ctx.save();

    // 1. Efeitos leves de partículas ASCII no chão (Lure Sakura * e Grama \|/)
    for (const t of projectedClickTargets) {
      if (t.x < -20 || t.x > canvas.width + 20 || t.y < -20 || t.y > canvas.height + 20) continue;
      if (t.type === "POKESTOP" && t.hasLure && (t.dPlayer || 0) < 28.0) {
        ctx.font = "bold 13px 'Cascadia Mono', Consolas, monospace";
        const petals = ["*", "*", "·", "+"];
        for (let p = 0; p < 4; ++p) {
          const ang = timeSec * 1.8 + p * 1.55;
          const px = t.x + Math.cos(ang) * 24;
          const py = t.y - 8 + ((timeSec * 20 + p * 12) % 30);
          ctx.fillStyle = p % 2 === 0 ? "#f472b6" : "#fbcfe8";
          ctx.fillText(petals[p % petals.length], px, py);
        }
      }
      if (t.type === "WILD" && (t.dPlayer || 0) < 20.0) {
        ctx.font = "bold 12px 'Cascadia Mono', Consolas, monospace";
        ctx.fillStyle = "#4ade80";
        const sway = Math.sin(timeSec * 5 + t.index) > 0 ? "/" : "\\";
        ctx.fillText(`${sway}|${sway}`, t.x - 9, t.y + 14);
      }
    }

    // 2. Filtro de Cone de FOV Central + Distância Máxima para Títulos Flutuantes
    const fovMinX = canvas.width * 0.14, fovMaxX = canvas.width * 0.86;
    const fovMinY = canvas.height * 0.16, fovMaxY = canvas.height * 0.82;

    const visibleLabels = [];
    for (const t of projectedClickTargets) {
      const dist = t.dPlayer !== undefined ? t.dPlayer : 10.0;
      const maxDist = t.isStarter ? 24.0 : (t.type === "WILD" ? 13.5 : (t.type === "POKESTOP" ? 14.5 : 21.0));
      if (dist > maxDist) continue;
      if (!t.isStarter && (t.x < fovMinX || t.x > fovMaxX || t.y < fovMinY || t.y > fovMaxY)) continue;
      visibleLabels.push(t);
    }

    // Ordena por prioridade: Iniciais > Selvagens mais próximos > PokéStops/Ginásios mais próximos
    visibleLabels.sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      if ((a.type === "WILD") !== (b.type === "WILD")) return a.type === "WILD" ? -1 : 1;
      return (a.dPlayer || 0) - (b.dPlayer || 0);
    });

    const drawnBoxes = [];
    const maxLabelsOnScreen = 4;

    for (const t of visibleLabels) {
      if (drawnBoxes.length >= maxLabelsOnScreen) break;

      const isWild = t.type === "WILD";
      const dist = t.dPlayer || 0;
      const maxDist = t.isStarter ? 24.0 : (isWild ? 13.5 : (t.type === "POKESTOP" ? 14.5 : 21.0));
      const fadeAlpha = Math.max(0.35, Math.min(0.95, 1.15 - (dist / maxDist) * 0.65));

      ctx.font = asciiUiMode
        ? "bold 10px 'Cascadia Mono', Consolas, monospace"
        : "bold 10.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

      const shortText = dist < 8.5 ? `${t.label} (${t.sub})` : t.label;
      const text = asciiUiMode ? `[ ${shortText} ]` : shortText;
      const w = Math.max(68, ctx.measureText(text).width + 14);
      const h = 20;
      const bx = t.x - w / 2;
      const by = t.y - 28;

      // Anti-Colisão 2D: descarta título se colidir com outro título mais próximo já desenhado!
      let overlaps = false;
      for (let i = 0; i < drawnBoxes.length; ++i) {
        const b = drawnBoxes[i];
        if (bx < b.x1 + 6 && bx + w > b.x0 - 6 && by < b.y1 + 4 && by + h > b.y0 - 4) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      drawnBoxes.push({ x0: bx, y0: by, x1: bx + w, y1: by + h });

      ctx.globalAlpha = fadeAlpha;
      const bg = t.isStarter ? "rgba(217, 119, 6, 0.92)" :
                 (isWild ? "rgba(16, 120, 96, 0.88)" :
                 (t.type === "GYM" ? "rgba(140, 38, 56, 0.88)" :
                 (t.type === "VILLAIN" ? "rgba(105, 35, 165, 0.90)" : "rgba(18, 92, 168, 0.86)")));

      if (asciiUiMode) {
        const borderCol = t.isStarter ? "#fbbf24" : (isWild ? "#26ccaa" : (t.type === "GYM" ? "#f43f5e" : "#38bdf8"));
        ctx.fillStyle = "rgba(6, 13, 28, 0.92)";
        ctx.fillRect(bx, by, w, h);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(bx, by, w, h);
        ctx.fillStyle = borderCol;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, t.x, by + h / 2);
      } else {
        ctx.fillStyle = bg;
        ctx.strokeStyle = "rgba(255,255,255,0.88)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, t.x, by + h / 2);
      }
    }
    ctx.globalAlpha = 1.0;

    // 3. Bolhas Flutuantes de Recompensas ao Girar PokéStop / Ginásio
    for (let i = cityState.floatingMapAnims.length - 1; i >= 0; --i) {
      const fa = cityState.floatingMapAnims[i];
      fa.life -= 0.018;
      fa.y -= 1.4;
      if (fa.life <= 0) {
        cityState.floatingMapAnims.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, fa.life);
      ctx.font = "900 14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.strokeText(fa.text, fa.x, fa.y);
      ctx.fillText(fa.text, fa.x, fa.y);
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  // Feixe Laser ASCII da Pokébola (Entrando/Saindo) + Anel Grande de Bônus + Pílula Nome/CP
  function drawCaptureAsciiLaserAndRing(timeSec) {
    ctx.save();
    const cx = lastWildScreenBox.x || (canvas.width * 0.5);
    const cy = lastWildScreenBox.y || (canvas.height * 0.42);
    const baseRadius = Math.max(75, lastWildScreenBox.radiusPx || 88);

    // 1. FEIXE LASER EM CARACTERES ASCII QUANDO O POKÉMON ENTRA (state=2) OU SAI (state=5) DA POKÉBOLA
    if (ball.state === 2 || ball.state === 5) {
      const bx = canvas.width * 0.5 + ball.pos.x * 110;
      const by = canvas.height * 0.52 - ball.pos.y * 95;
      const steps = 18;
      const laserGlyphs = ["*", "+", "@", "#", "*", "="];
      ctx.font = `bold ${cellH + 4}px 'Cascadia Mono', Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let s = 0; s <= steps; ++s) {
        const u = s / steps;
        const lx = bx * (1 - u) + cx * u + Math.sin(u * 14 + timeSec * 25) * 10;
        const ly = by * (1 - u) + cy * u + Math.cos(u * 14 - timeSec * 25) * 10;
        ctx.fillStyle = s % 2 === 0 ? "#ff2a55" : "#ffffff";
        ctx.fillText(laserGlyphs[(s + Math.floor(timeSec * 30)) % laserGlyphs.length], lx, ly);
      }

      // Ondas de choque ASCII ao redor da Pokébola aberta
      const ringGlyphs = 12;
      const waveR = 24 + (ball.morphProgress * 55);
      for (let k = 0; k < ringGlyphs; ++k) {
        const ang = (k / ringGlyphs) * Math.PI * 2 + timeSec * 6;
        ctx.fillStyle = "#ff5e7e";
        ctx.fillText("*", bx + Math.cos(ang) * waveR, by + Math.sin(ang) * waveR);
      }
    }

    // 2. PÍLULA BRANCA COM NOME E CP CONTIDOS DENTRO DELA (Sem escala real!)
    const pillW = 246, pillH = 44;
    const pillX = cx - pillW / 2;
    const pillY = Math.max(58, cy - baseRadius - 58);

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = "#26ccaa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1c3d44";
    ctx.font = "800 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const shinyPrefix = wildMon.isShiny ? "* " : "";
    ctx.fillText(`${shinyPrefix}${wildMon.name}   CP ${wildMon.cp}`, cx, pillY + 16);

    const sp = window.PokeData.getSpecies(wildMon.speciesId);
    const berryTxt = activeBerry ? ` • [BERRY] ${activeBerry.replace("_", " ").toUpperCase()}` : "";
    ctx.fillStyle = "#158078";
    ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`Tipo: ${sp.types.join("/")}${berryTxt}`, cx, pillY + 33);

    // 3. ANEL DE MIRA E BÔNUS DE CAPTURA GRANDE (Cobre todo o diâmetro do Pokémon 3D!)
    if (ball.state === 0) {
      targetRingPhase -= 0.011;
      if (targetRingPhase < 0.18) targetRingPhase = 1.0;

      // Anel Branco Fixo Externo
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Anel Interno Colorido que Encolhe (Verde -> Amarelo -> Laranja -> Vermelho)
      const innerR = baseRadius * targetRingPhase;
      const cfg = window.PokeBalance.get();
      const catchDiff = Math.min(1, wildMon.cp / Math.max(250, 950 * cfg.catchRateMultiplier));
      const ringColor = catchDiff < 0.35 ? "#22c55e" : (catchDiff < 0.68 ? "#f59e0b" : "#ef4444");

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 5.0;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.stroke();

      // Indicador e Faíscas Espirais Douradas de Curveball se estiver girando a Pokébola
      if (ball.spinRpm > 0.25) {
        const bScreenX = canvas.width * 0.5 + ball.pos.x * 130;
        const bScreenY = canvas.height * 0.76 - (ball.pos.y + 0.55) * 120;
        const sparkChars = ["*", "*", "@", "+"];
        ctx.font = `bold ${cellH + 3}px 'Cascadia Mono', Consolas, monospace`;
        for (let sp = 0; sp < 8; ++sp) {
          const a = timeSec * 12 * (ball.curveDir || 1) + sp * (Math.PI / 4);
          const r = 34 + (sp % 3) * 12;
          ctx.fillStyle = sp % 2 === 0 ? "#fde047" : "#fb923c";
          ctx.fillText(sparkChars[sp % sparkChars.length], bScreenX + Math.cos(a) * r, bScreenY + Math.sin(a) * r);
        }
        ctx.fillStyle = "#fde047";
        ctx.font = "800 13px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("@ CURVEBALL ATIVA (+70% BÔNUS!)", cx, canvas.height - 135);
      }
    }

    // 4. Rastro 3D em ASCII durante o voo parabólico da Pokébola (state=1)
    if (ball.state === 1 && ball.trail.length > 0) {
      ctx.font = `bold ${cellH + 2}px 'Cascadia Mono', Consolas, monospace`;
      for (let ti = 0; ti < ball.trail.length; ++ti) {
        const pt = ball.trail[ti];
        ctx.fillStyle = ti % 2 === 0 ? "#38bdf8" : "#fde047";
        ctx.fillText(ti % 2 === 0 ? "*" : "*", pt.sx, pt.sy);
      }
    }

    // 5. Animação de Arremesso de Fruta (Berry [BERRY] -> Explosão de Corações HP  *)
    if (berryThrowAnim) {
      berryThrowAnim.progress += 0.038;
      const u = Math.min(1, berryThrowAnim.progress);
      const sx = 46 * (1 - u) + cx * u;
      const sy = (canvas.height - 46) * (1 - u) + cy * u - Math.sin(u * Math.PI) * 120;
      ctx.font = "28px sans-serif";
      if (u < 0.85) {
        ctx.fillText(berryThrowAnim.icon || "[BERRY]", sx, sy);
      } else {
        for (let h = 0; h < 6; ++h) {
          const ha = (h / 6) * Math.PI * 2 + timeSec * 5;
          const hr = (u - 0.85) * 340;
          ctx.fillText(h % 2 === 0 ? "HP " : "*", cx + Math.cos(ha) * hr, cy + Math.sin(ha) * hr);
        }
      }
      if (berryThrowAnim.progress >= 1.15) berryThrowAnim = null;
    }

    // 6. Estrelas e Fogos Dourados ao Capturar (state=4) ou Poeira nas Balançadas (state=3)
    if (ball.state === 3 && ball.shakeTimer < 0.25) {
      ctx.font = `bold ${cellH + 2}px 'Cascadia Mono', Consolas, monospace`;
      ctx.fillStyle = "#fde047";
      ctx.fillText("· o *   * o ·", cx, cy + 52);
    } else if (ball.state === 4) {
      ctx.font = "24px sans-serif";
      for (let st = 0; st < 5; ++st) {
        const ang = -Math.PI * 0.8 + (st / 4) * Math.PI * 0.6;
        const dist = 35 + Math.sin(timeSec * 8) * 15;
        ctx.fillText(st % 2 === 0 ? "*" : "*", cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist - 20);
      }
    }

    // Texto de Bônus de Arremesso (NICE! / GREAT! / EXCELLENT!)
    if (ball.throwBonusLabel && (ball.state === 2 || ball.state === 3)) {
      ctx.fillStyle = "#fde047";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 4;
      ctx.font = "900 26px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.strokeText(ball.throwBonusLabel, cx, cy - 30);
      ctx.fillText(ball.throwBonusLabel, cx, cy - 30);
    }

    ctx.restore();
  }

  // ============================================================================
  // FÍSICA 3D DA POKÉBOLA + TRANSIÇÕES ENTRANDO (state=2) E SAINDO (state=5)
  // ============================================================================
  function updatePokeballPhysics(dt) {
    if (gameScene !== "AR_CAPTURE" || !wildMon) return;

    if (ball.state === 0) {
      ball.spinRpm = Math.max(0, ball.spinRpm - dt * 1.4);
      ball.rotAngle += (1.2 + ball.spinRpm * 14.0) * dt;
      ball.lidOpenAngle = 0;
    } else if (ball.state === 1) {
      // Voo parabólico 3D com força Magnus (Curveball) + Rastro ASCII
      ball.pos.x += ball.vel.x * dt;
      ball.pos.y += ball.vel.y * dt;
      ball.pos.z += ball.vel.z * dt;
      ball.vel.y -= 9.2 * dt;
      ball.vel.x += ball.curveDir * ball.spinRpm * 3.0 * dt;
      ball.rotAngle += (6.0 + ball.spinRpm * 18.0) * dt;

      ball.trail.push({
        sx: canvas.width * 0.5 + (ball.pos.x / Math.max(0.5, -ball.pos.z * 0.45)) * 180,
        sy: canvas.height * 0.52 - (ball.pos.y / Math.max(0.5, -ball.pos.z * 0.45)) * 160
      });
      if (ball.trail.length > 10) ball.trail.shift();

      const dx = ball.pos.x - wildAnchor.x;
      const dy = ball.pos.y - (wildAnchor.y + 0.55);
      const dz = ball.pos.z - wildAnchor.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist < 1.25 && ball.pos.z <= wildAnchor.z + 0.9) {
        // ACERTOU O POKÉMON 3D! Inicia o Estágio 2: Tampa 3D da Pokébola abre + Feixe Laser ASCII!
        window.PokeAudio.playBallHit();
        ball.state = 2;
        ball.morphProgress = 0.0;
        ball.pos = { x: wildAnchor.x * 0.4, y: 0.25, z: wildAnchor.z + 0.85 };

        const cfg = window.PokeBalance.get();
        if (targetRingPhase < 0.34) {
          ball.throwBonusLabel = "EXCELLENT! *";
          ball.throwBonusMult = cfg.excellentThrowMult;
          window.PokeStorage.getProfile().stats.excellentThrows++;
        } else if (targetRingPhase < 0.65) {
          ball.throwBonusLabel = "GREAT! *";
          ball.throwBonusMult = cfg.greatThrowMult;
        } else if (targetRingPhase < 0.88) {
          ball.throwBonusLabel = "NICE! !";
          ball.throwBonusMult = cfg.niceThrowMult;
        } else {
          ball.throwBonusLabel = "";
          ball.throwBonusMult = 1.0;
        }
        if (ball.spinRpm > 0.35) {
          ball.throwBonusLabel = "@ CURVEBALL " + ball.throwBonusLabel;
        }
      } else if (ball.pos.y < -2.3 || ball.pos.z < -12.0) {
        window.PokeStorage.showToast(">> A Pokébola errou o alvo! Tente novamente.", "warn");
        resetBall();
      }
    } else if (ball.state === 2) {
      // ANIMAÇÃO 3D ENTRANDO NA POKÉBOLA: Tampa superior abre (1.18 rad) e suga o Pokémon em ASCII!
      ball.morphProgress += dt * 1.45;
      if (ball.morphProgress < 0.78) {
        ball.lidOpenAngle = Math.min(1.18, ball.morphProgress * 2.8);
      } else {
        // Tampa fecha de volta antes de cair no chão
        ball.lidOpenAngle = Math.max(0, 1.18 * (1.0 - (ball.morphProgress - 0.78) / 0.22));
      }

      if (ball.morphProgress >= 1.0) {
        ball.lidOpenAngle = 0;
        ball.state = 3;
        ball.pos = { x: wildAnchor.x, y: -1.08, z: wildAnchor.z + 0.4 };
        ball.shakeCount = 0;
        ball.shakeTimer = 0;
        evaluateCaptureProbability();
      }
    } else if (ball.state === 3) {
      // 3 Balançadas no chão
      ball.shakeTimer += dt;
      if (ball.shakeTimer >= 0.92) {
        ball.shakeTimer = 0;
        ball.shakeCount++;
        window.PokeAudio.playBallShake(ball.shakeCount);

        if (ball.shakeCount >= ball.shakeTarget) {
          if (ball.shakeTarget === 4) {
            completePokemonCapture();
          } else {
            // ESCAPOU! Inicia o Estágio 5: Tampa 3D abre no chão e o Pokémon emerge de dentro!
            window.PokeAudio.playBreakout();
            ball.state = 5;
            ball.morphProgress = 0.0;
          }
        }
      }
    } else if (ball.state === 5) {
      // ANIMAÇÃO 3D SAINDO DA POKÉBOLA (BREAKOUT): Tampa abre e o Pokémon cresce de volta!
      ball.morphProgress += dt * 1.65;
      ball.lidOpenAngle = Math.min(1.22, Math.sin(Math.min(1, ball.morphProgress) * Math.PI) * 1.25);
      if (ball.morphProgress >= 1.0) {
        window.PokeStorage.showToast(`! ${wildMon.name} abriu a Pokébola e escapou!`, "warn");
        activeBerry = null;
        resetBall();
      }
    }
  }

  function evaluateCaptureProbability() {
    const cfg = window.PokeBalance.get();
    const sp = window.PokeData.getSpecies(wildMon.speciesId);
    const ballItem = window.PokeData.ITEMS[activeBallType] || window.PokeData.ITEMS.poke_ball;
    const berryMult = activeBerry && window.PokeData.ITEMS[activeBerry] ? (window.PokeData.ITEMS[activeBerry].catchMult || 1.0) : 1.0;
    const curveMult = ball.spinRpm > 0.35 ? cfg.curveballBonusMult : 1.0;

    const totalChance = Math.min(
      0.99,
      sp.baseCatchRate * cfg.catchRateMultiplier * ballItem.catchMult * berryMult * curveMult * ball.throwBonusMult
    );

    if (Math.random() <= totalChance || activeBallType === "master_ball") {
      ball.shakeTarget = 4; // 3 shakes + Gotcha!
    } else {
      ball.shakeTarget = 1 + Math.floor(Math.random() * 2);
    }
  }

  function completePokemonCapture() {
    ball.state = 4;
    window.PokeAudio.playGotchaFanfare();

    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    const sp = window.PokeData.getSpecies(wildMon.speciesId);

    const isNewDex = !p.pokedexCaught[wildMon.speciesId];
    p.pokedexCaught[wildMon.speciesId] = (p.pokedexCaught[wildMon.speciesId] || 0) + 1;
    p.pokemonBox.push(wildMon);
    p.stats.totalCaught++;
    if (!p.starterChosen) {
      p.starterChosen = true;
      cityState.wildSpawns = [];
      refreshCityWildSpawns();
    }
    if (p.tasksProgress) {
      p.tasksProgress.caught = (p.tasksProgress.caught || 0) + 1;
      p.tasksProgress.throws = (p.tasksProgress.throws || 0) + 1;
    }

    for (const t of sp.types) {
      p.typeCounts = p.typeCounts || {};
      p.typeCounts[t] = (p.typeCounts[t] || 0) + 1;
    }
    p.anomalyCharge = Math.min(100, (p.anomalyCharge || 0) + 12);

    if (ball.spinRpm > 0.35) p.stats.curveballsLanded++;

    const candyMult = (activeBerry === "pinap_berry" ? 2 : 1) * (cfg.candyMultiplier || 1);
    const candyGain = Math.round(3 * candyMult);
    p.candies[wildMon.speciesId] = (p.candies[wildMon.speciesId] || 0) + candyGain;

    const dustGain = Math.round((100 + (isNewDex ? 200 : 0)) * (cfg.stardustMultiplier || 1));
    p.stardust += dustGain;

    let xpBase = 100 + (isNewDex ? 500 : 0) + (ball.spinRpm > 0.35 ? 50 : 0);
    if (ball.throwBonusLabel.includes("EXCELLENT")) xpBase += 1000;
    else if (ball.throwBonusLabel.includes("GREAT")) xpBase += 150;
    const xpGain = window.PokeStorage.addXp(xpBase);
    const caughtMon = wildMon;

    // Retorna automaticamente a cena de fundo para o Mapa 3D ao concluir a captura,
    // evitando que o jogador fique preso na tela de captura ao fechar o modal pelo (X) ou após avaliar IVs!
    resetBall();
    gameScene = "CITY_MAP";
    syncSceneHudVisibility();
    updateHud();

    openModal(" GOTCHA! POKÉMON CAPTURADO!", `
      <div class="pogo-white-card" style="text-align:center;">
        <img src="${E.getPokemonCardImageSrc(caughtMon.speciesId, false, caughtMon.isShiny)}" style="width:96px;height:96px;object-fit:contain;"/>
        <h3 style="color:#1c7c74;margin:4px 0;">
          ${caughtMon.isShiny ? "* SHINY " : ""}${caughtMon.name} (CP ${caughtMon.cp})
        </h3>
        <p style="font-size:12px;color:#527a80;font-weight:700;">
          ${isNewDex ? "[NEW] NOVO REGISTRO NA POKÉDEX!" : "Capturado com sucesso!"}
        </p>
        <div class="stat-capsules-row">
          <div><div class="stat-cap-val">+${xpGain}</div><div class="stat-cap-lbl">XP & GO Pass</div></div>
          <div><div class="stat-cap-val">+${dustGain}</div><div class="stat-cap-lbl">Stardust</div></div>
          <div><div class="stat-cap-val">+${candyGain}</div><div class="stat-cap-lbl">Candies</div></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:#254a52;margin-bottom:12px;">
          IVs: ATK ${caughtMon.ivAtk} / DEF ${caughtMon.ivDef} / STA ${caughtMon.ivSta} (${caughtMon.ivPercent}%)
        </div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.closeModal();">
            [MAPA] Continuar no Mapa
          </button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.showPokemonDetailSheet('${caughtMon.uid}')">
             Avaliar IVs
          </button>
        </div>
      </div>
    `);
  }

  // ============================================================================
  // ARENA DE BATALHA 3D AO VIVO EM ASCII (LIVE_BATTLE) + VFX ELEMENTAIS ASCII
  // ============================================================================
  function getElementVfxConfig(type) {
    const map = {
      Electric: { color: "#fde047", glow: "#f59e0b", icon: "*", chars: ["*", "*", "+", "#"], style: "LIGHTNING" },
      Fire:     { color: "#fb923c", glow: "#ef4444", icon: "*", chars: ["*", "@", "W", "*"], style: "FIREBALL" },
      Water:    { color: "#38bdf8", glow: "#0284c7", icon: "~", chars: ["~", "~", "O", "o"], style: "WAVE" },
      Grass:    { color: "#4ade80", glow: "#16a34a", icon: "%", chars: ["%", "%", "/", "*"], style: "LEAF" },
      Ice:      { color: "#bae6fd", glow: "#0ea5e9", icon: "*", chars: ["*", "*", "+", "o"], style: "ICE" },
      Psychic:  { color: "#f472b6", glow: "#a855f7", icon: "@", chars: ["@", "@", "@", "*"], style: "BEAM" },
      Ghost:    { color: "#c084fc", glow: "#581c87", icon: "#", chars: ["#", "#", "@", "~"], style: "SHADOW" },
      Dragon:   { color: "#818cf8", glow: "#4338ca", icon: "+", chars: ["+", "*", "#", "@"], style: "METEOR" }
    };
    return map[type] || { color: "#26ccaa", glow: "#0d9488", icon: "*", chars: ["*", "*", "#", "@"], style: "STRIKE" };
  }

  function startLiveBattle(mode, enemySpeciesId, enemyCp, title, rewardCoins = 35, rewardDust = 900, isRaid = false) {
    const p = window.PokeStorage.getProfile();
    if (!p.pokemonBox.length) return;
    closeModal();
    closeRadialMenu();

    const bestMon = [...p.pokemonBox].sort((a, b) => b.cp - a.cp)[0];
    const enemySp = window.PokeData.getSpecies(enemySpeciesId);
    E.getPokemonMesh(bestMon.speciesId, bestMon.isShiny);
    E.getPokemonMesh(enemySp.id, false);

    liveBattle.active = true;
    liveBattle.mode = mode;
    liveBattle.title = title;
    liveBattle.timerSec = isRaid ? 150 : 100;
    liveBattle.lastTickTime = performance.now();

    liveBattle.playerMon = bestMon;
    liveBattle.playerMaxHp = Math.max(90, bestMon.maxHp * 2);
    liveBattle.playerHp = liveBattle.playerMaxHp;
    liveBattle.playerEnergy = 0;
    liveBattle.playerShields = 2;
    liveBattle.shieldActiveUntil = 0;
    liveBattle.dodgeOffsetX = 0;
    liveBattle.dodgeUntil = 0;
    liveBattle.playerAttackAnimUntil = 0;

    liveBattle.enemyMon = {
      speciesId: enemySp.id,
      name: enemySp.name,
      cp: enemyCp,
      types: enemySp.types,
      fastMove: enemySp.fastMoves[0],
      chargedMove: enemySp.chargedMoves[0]
    };
    liveBattle.enemyMaxHp = Math.max(130, Math.round(enemyCp * 0.14));
    liveBattle.enemyHp = liveBattle.enemyMaxHp;
    liveBattle.enemyNextAttackAt = performance.now() + 1800;
    liveBattle.enemyIsChargingSpecial = false;
    liveBattle.enemySpecialFireAt = 0;
    liveBattle.enemyAttackAnimUntil = 0;

    liveBattle.vfxList = [];
    liveBattle.floatingTexts = [];
    liveBattle.rewardCoins = rewardCoins;
    liveBattle.rewardDust = rewardDust;
    liveBattle.rewardXp = isRaid ? 2500 : 1200;
    liveBattle.isRaidEncounter = isRaid;

    toggleSceneMode("LIVE_BATTLE");
    updateLiveBattleHudButtons();
    window.PokeAudio.playPokemonCry(enemySp.id);
    window.PokeStorage.showToast(`[BATTLE] BATALHA 3D EM ASCII: ${bestMon.name} vs ${enemySp.name}! Toque na tela para atacar!`, "info");
  }

  function updateLiveBattleHudButtons() {
    const btnCharged = document.getElementById("btn-live-charged");
    const lblIcon = document.getElementById("lbl-charged-icon");
    const lblName = document.getElementById("lbl-charged-name");
    const lblPct = document.getElementById("lbl-charged-pct");
    const btnShield = document.getElementById("btn-live-shield");

    if (!liveBattle.playerMon) return;
    const sp = window.PokeData.getSpecies(liveBattle.playerMon.speciesId);
    const vfx = getElementVfxConfig(sp.types[0]);
    const energy = Math.min(100, Math.round(liveBattle.playerEnergy));

    if (lblIcon) lblIcon.textContent = vfx.icon;
    if (lblName) lblName.textContent = (liveBattle.playerMon.chargedMove || "ESPECIAL").slice(0, 10).toUpperCase();
    if (lblPct) lblPct.textContent = energy >= 100 ? "PRONTO!" : `${energy}%`;
    if (btnCharged) {
      btnCharged.style.opacity = energy >= 100 ? "1.0" : "0.72";
      btnCharged.style.transform = energy >= 100 ? "scale(1.08)" : "scale(1.0)";
    }
    if (btnShield) {
      btnShield.textContent = `[SHIELD]${liveBattle.playerShields}`;
      btnShield.style.opacity = liveBattle.playerShields > 0 ? "1.0" : "0.45";
    }
  }

  function spawnBattleAsciiVfx(fromPlayer, elemType, isSpecial) {
    const vfx = getElementVfxConfig(elemType);
    const startX = fromPlayer ? canvas.width * 0.34 : canvas.width * 0.62;
    const startY = fromPlayer ? canvas.height * 0.65 : canvas.height * 0.36;
    const endX   = fromPlayer ? canvas.width * 0.62 : canvas.width * 0.34;
    const endY   = fromPlayer ? canvas.height * 0.36 : canvas.height * 0.65;

    liveBattle.vfxList.push({
      fromPlayer,
      isSpecial,
      color: vfx.color,
      glow: vfx.glow,
      chars: vfx.chars,
      startX, startY, endX, endY,
      progress: 0.0,
      speed: isSpecial ? 1.85 : 3.4
    });
  }

  function addBattleFloatingText(text, x, y, color = "#fde047", size = 18) {
    liveBattle.floatingTexts.push({ text, x, y, color, size, life: 1.0 });
  }

  function triggerPlayerAttack(isCharged = false) {
    if (gameScene !== "LIVE_BATTLE" || !liveBattle.active) return;
    const now = performance.now();
    const pMon = liveBattle.playerMon;
    const eMon = liveBattle.enemyMon;
    const pSp = window.PokeData.getSpecies(pMon.speciesId);
    const elemType = pSp.types[0];

    if (isCharged) {
      if (liveBattle.playerEnergy < 100) {
        window.PokeStorage.showToast(`* Energia em ${Math.round(liveBattle.playerEnergy)}%! Continue atacando para encher 100%!`, "info");
        return;
      }
      liveBattle.playerEnergy = 0;
      liveBattle.playerAttackAnimUntil = now + 450;
      window.PokeAudio.playAttack(true);
      spawnBattleAsciiVfx(true, elemType, true);

      const dmg = Math.max(26, Math.round((pMon.cp / 24) * (1.2 + pMon.ivAtk / 30)));
      liveBattle.enemyHp = Math.max(0, liveBattle.enemyHp - dmg);
      addBattleFloatingText(`* ${pMon.chargedMove.toUpperCase()}! -${dmg}`, canvas.width * 0.60, canvas.height * 0.26, "#fde047", 22);
    } else {
      liveBattle.playerEnergy = Math.min(100, liveBattle.playerEnergy + 14);
      liveBattle.playerAttackAnimUntil = now + 240;
      window.PokeAudio.playAttack(false);
      spawnBattleAsciiVfx(true, elemType, false);

      const dmg = Math.max(6, Math.round((pMon.cp / 82) * (1.0 + pMon.ivAtk / 45)));
      liveBattle.enemyHp = Math.max(0, liveBattle.enemyHp - dmg);
      addBattleFloatingText(`-${dmg}`, canvas.width * 0.62 + (Math.random() - 0.5) * 40, canvas.height * 0.32, "#ffffff", 16);
    }

    updateLiveBattleHudButtons();
    if (liveBattle.enemyHp <= 0) {
      finishLiveBattle(true);
    }
  }

  function triggerBattleDodge(dir = 1) {
    if (gameScene !== "LIVE_BATTLE" || !liveBattle.active) return;
    window.PokeAudio.playUiClick();
    liveBattle.dodgeOffsetX = dir >= 0 ? 1 : -1;
    liveBattle.dodgeUntil = performance.now() + 650;
    addBattleFloatingText(">> ESQUIVOU!", canvas.width * 0.34, canvas.height * 0.56, "#38bdf8", 18);
  }

  function triggerBattleShield() {
    if (gameScene !== "LIVE_BATTLE" || !liveBattle.active) return;
    if (liveBattle.playerShields <= 0) {
      window.PokeStorage.showToast("[SHIELD] Você já usou seus 2 Escudos Protetores!", "warn");
      return;
    }
    window.PokeAudio.playUiClick();
    liveBattle.playerShields--;
    liveBattle.shieldActiveUntil = performance.now() + 3500;
    updateLiveBattleHudButtons();
    addBattleFloatingText("[SHIELD] ESCUDO 3D ATIVO!", canvas.width * 0.34, canvas.height * 0.54, "#c084fc", 20);
  }

  function fleeLiveBattle() {
    liveBattle.active = false;
    toggleSceneMode("CITY_MAP");
  }

  function finishLiveBattle(playerWon) {
    liveBattle.active = false;
    const p = window.PokeStorage.getProfile();

    if (playerWon) {
      window.PokeAudio.playGotchaFanfare();
      p.pokecoins += liveBattle.rewardCoins;
      p.stardust += liveBattle.rewardDust;
      window.PokeStorage.addXp(liveBattle.rewardXp);
      if (p.tasksProgress) {
        p.tasksProgress.raids = (p.tasksProgress.raids || 0) + 1;
      }

      if (liveBattle.isRaidEncounter) {
        p.stats.raidsWon++;
        const bossId = liveBattle.enemyMon.speciesId;
        window.PokeStorage.showToast(`[WIN] BOSS DERROTADO! +${liveBattle.rewardCoins} PokéCoins! Capture o Boss em ASCII 3D!`, "success");
        spawnWildPokemon(bossId, true);
        toggleSceneMode("AR_CAPTURE");
      } else {
        p.stats.gymsWon++;
        toggleSceneMode("CITY_MAP");
        openModal("[WIN] VITÓRIA NA ARENA 3D ASCII!", `
          <div class="pogo-white-card" style="text-align:center;">
            <img src="${E.getPokemonCardImageSrc(liveBattle.playerMon.speciesId, false, liveBattle.playerMon.isShiny)}" style="width:92px;height:92px;"/>
            <h3 style="color:#1c7c74;margin:6px 0;">${liveBattle.title} VENCIDO!</h3>
            <div class="stat-capsules-row">
              <div><div class="stat-cap-val">+${liveBattle.rewardCoins}</div><div class="stat-cap-lbl"> PokéCoins</div></div>
              <div><div class="stat-cap-val">+${liveBattle.rewardDust}</div><div class="stat-cap-lbl">* Stardust</div></div>
              <div><div class="stat-cap-val">+${liveBattle.rewardXp}</div><div class="stat-cap-lbl">* XP</div></div>
            </div>
            <button class="pogo-pill-btn" onclick="window.PokeGameUI.closeModal()">Continuar no Mapa</button>
          </div>
        `);
      }
    } else {
      window.PokeAudio.playBreakout();
      p.stardust += 250;
      window.PokeStorage.addXp(300);
      toggleSceneMode("CITY_MAP");
      window.PokeStorage.showToast("[BATTLE] Fim do combate! Você ganhou +250 Stardust de participação.", "warn");
    }
    updateHud();
  }

  // Desenha os projéteis elementais em Caracteres ASCII e o HUD de HP da Batalha 3D Ao Vivo
  function drawLiveBattleAsciiVfxAndHud(timeSec) {
    const now = performance.now();
    const dt = Math.min(0.08, (now - liveBattle.lastTickTime) / 1000.0);
    liveBattle.lastTickTime = now;

    liveBattle.timerSec = Math.max(0, liveBattle.timerSec - dt);
    if (liveBattle.timerSec <= 0) {
      finishLiveBattle(liveBattle.enemyHp < liveBattle.playerHp);
      return;
    }

    // IA do Oponente em Tempo Real
    if (!liveBattle.enemyIsChargingSpecial && now >= liveBattle.enemyNextAttackAt) {
      if (Math.random() < 0.34) {
        liveBattle.enemyIsChargingSpecial = true;
        liveBattle.enemySpecialFireAt = now + 1700;
        addBattleFloatingText(`[!] ${liveBattle.enemyMon.name} CARREGANDO ${liveBattle.enemyMon.chargedMove.toUpperCase()}!`, canvas.width * 0.5, canvas.height * 0.20, "#fb7185", 16);
      } else {
        liveBattle.enemyAttackAnimUntil = now + 340;
        liveBattle.enemyNextAttackAt = now + 1500 + Math.random() * 600;
        window.PokeAudio.playAttack(false);
        spawnBattleAsciiVfx(false, liveBattle.enemyMon.types[0], false);

        const dodged = now < liveBattle.dodgeUntil;
        const rawDmg = Math.max(5, Math.round(liveBattle.enemyMon.cp / 95));
        const dmg = dodged ? Math.max(1, Math.round(rawDmg * 0.25)) : rawDmg;
        liveBattle.playerHp = Math.max(0, liveBattle.playerHp - dmg);
        addBattleFloatingText(dodged ? `>> -${dmg}` : `-${dmg}`, canvas.width * 0.34, canvas.height * 0.58, "#fb7185", 16);
      }
    } else if (liveBattle.enemyIsChargingSpecial && now >= liveBattle.enemySpecialFireAt) {
      liveBattle.enemyIsChargingSpecial = false;
      liveBattle.enemyAttackAnimUntil = now + 500;
      liveBattle.enemyNextAttackAt = now + 2200;
      window.PokeAudio.playAttack(true);
      spawnBattleAsciiVfx(false, liveBattle.enemyMon.types[0], true);

      const shielded = now < liveBattle.shieldActiveUntil;
      const dodged = now < liveBattle.dodgeUntil;
      const rawDmg = Math.max(22, Math.round(liveBattle.enemyMon.cp / 30));
      const dmg = shielded ? 0 : (dodged ? Math.round(rawDmg * 0.3) : rawDmg);
      liveBattle.playerHp = Math.max(0, liveBattle.playerHp - dmg);
      addBattleFloatingText(
        shielded ? "[SHIELD] BLOQUEADO (0 DANO)!" : `* ${liveBattle.enemyMon.chargedMove.toUpperCase()} -${dmg}`,
        canvas.width * 0.36, canvas.height * 0.54,
        shielded ? "#c084fc" : "#ef4444", 20
      );
    }

    if (liveBattle.playerHp <= 0) {
      finishLiveBattle(false);
      return;
    }

    ctx.save();
    // 1. Projéteis Elementais e Feixes Especiais em Caracteres ASCII!
    ctx.font = `bold ${cellH + 6}px 'Cascadia Mono', Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = liveBattle.vfxList.length - 1; i >= 0; --i) {
      const v = liveBattle.vfxList[i];
      v.progress += dt * v.speed;
      if (v.progress >= 1.0) {
        liveBattle.vfxList.splice(i, 1);
        continue;
      }
      const u = v.progress;
      const x = v.startX * (1 - u) + v.endX * u;
      const y = v.startY * (1 - u) + v.endY * u - Math.sin(u * Math.PI) * (v.isSpecial ? 60 : 25);

      const count = v.isSpecial ? 9 : 4;
      for (let k = 0; k < count; ++k) {
        const spread = (k - count / 2) * (v.isSpecial ? 14 : 9);
        const gx = x + spread * Math.cos(timeSec * 12 + k);
        const gy = y + spread * Math.sin(timeSec * 12 + k);
        ctx.fillStyle = k % 2 === 0 ? v.color : "#ffffff";
        ctx.fillText(v.chars[(k + Math.floor(timeSec * 25)) % v.chars.length], gx, gy);
      }
    }

    // 2. Textos de Dano Flutuantes
    for (let i = liveBattle.floatingTexts.length - 1; i >= 0; --i) {
      const ft = liveBattle.floatingTexts[i];
      ft.life -= dt * 0.95;
      ft.y -= dt * 36;
      if (ft.life <= 0) {
        liveBattle.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `900 ${ft.size}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.strokeStyle = "#091020";
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1.0;

    // 3. Barras Superiores de HP + Cronômetro da Arena 3D
    const drawHpCard = (x, y, name, cp, hp, maxHp) => {
      const w = Math.min(200, canvas.width * 0.41), h = 52;
      ctx.fillStyle = "rgba(15, 25, 48, 0.88)";
      ctx.strokeStyle = "#26ccaa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${name} (CP ${cp})`, x + 10, y + 17);

      const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      const barCol = pct > 0.5 ? "#22c55e" : (pct > 0.22 ? "#f59e0b" : "#ef4444");
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 10, y + 29, w - 20, 10);
      ctx.fillStyle = barCol;
      ctx.fillRect(x + 10, y + 29, (w - 20) * pct, 10);
    };

    drawHpCard(14, 64, liveBattle.playerMon.name, liveBattle.playerMon.cp, liveBattle.playerHp, liveBattle.playerMaxHp);
    drawHpCard(canvas.width - Math.min(200, canvas.width * 0.41) - 14, 64, liveBattle.enemyMon.name, liveBattle.enemyMon.cp, liveBattle.enemyHp, liveBattle.enemyMaxHp);

    ctx.fillStyle = "rgba(15, 25, 48, 0.9)";
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, 42, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.font = "900 16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(liveBattle.timerSec)}`, canvas.width * 0.5, 43);

    ctx.restore();
  }

  // ============================================================================
  // CUTSCENE 3D DE EVOLUÇÃO COM MORPH DE SILHUETA 100% EM ASCII
  // ============================================================================
  function startEvolutionCutscene(monUid, fromSpeciesId, toSpeciesId, fromName, toName, newCp) {
    closeModal();
    closeRadialMenu();
    E.getPokemonMesh(fromSpeciesId, false);
    E.getPokemonMesh(toSpeciesId, false);

    evoScene.active = true;
    evoScene.monUid = monUid;
    evoScene.fromSpeciesId = fromSpeciesId;
    evoScene.toSpeciesId = toSpeciesId;
    evoScene.fromName = fromName;
    evoScene.toName = toName;
    evoScene.newCp = newCp;
    evoScene.startTime = performance.now();

    toggleSceneMode("EVOLUTION_CUTSCENE");
    window.PokeAudio.playPokemonCry(fromSpeciesId);
  }

  function drawEvolutionAsciiHelixAndHud(timeSec) {
    const elapsed = (performance.now() - evoScene.startTime) / 1000.0;
    const progress = Math.min(1.0, elapsed / evoScene.durationSec);
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.46;

    ctx.save();
    ctx.font = `bold ${cellH + 4}px 'Cascadia Mono', Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Hélice Dupla 3D de DNA em Caracteres ASCII (A T G C * * +) girando em torno do Pokémon!
    const dnaChars = ["A", "T", "G", "C", "*", "*", "+"];
    for (let i = 0; i < 28; ++i) {
      const hFrac = (i / 28) - 0.5;
      const ang = hFrac * 7.5 + timeSec * (3.5 + progress * 8.0);
      const rad = 115 * (1.0 - Math.min(0.75, progress * 0.8));
      const x1 = cx + Math.cos(ang) * rad;
      const x2 = cx - Math.cos(ang) * rad;
      const y = cy + hFrac * 240;

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(dnaChars[i % dnaChars.length], x1, y);
      ctx.fillStyle = "#fde047";
      ctx.fillText(dnaChars[(i + 3) % dnaChars.length], x2, y);
    }

    // Supernova ASCII no instante da transformação (progress 0.76 .. 0.86)
    if (progress > 0.76 && progress < 0.88) {
      const burstR = ((progress - 0.76) / 0.12) * 220;
      for (let k = 0; k < 20; ++k) {
        const a = (k / 20) * Math.PI * 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillText("*", cx + Math.cos(a) * burstR, cy + Math.sin(a) * burstR);
      }
    }

    // Banner inferior com texto da evolução
    const cardW = Math.min(390, canvas.width - 28), cardH = 74;
    const cardX = cx - cardW / 2, cardY = canvas.height - 106;
    ctx.fillStyle = "rgba(12, 24, 48, 0.92)";
    ctx.strokeStyle = "#26ccaa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px -apple-system, BlinkMacSystemFont, sans-serif";
    if (progress < 0.80) {
      ctx.fillText(`* O quê? ${evoScene.fromName} está evoluindo em ASCII 3D!`, cx, cardY + 28);
      ctx.fillStyle = "#94eb9e";
      ctx.font = "700 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(`Morph 3D: ${Math.round((progress / 0.8) * 100)}%`, cx, cardY + 52);
    } else {
      ctx.fillStyle = "#fde047";
      ctx.fillText(` PARABÉNS! Seu ${evoScene.fromName} evoluiu para ${evoScene.toName}!`, cx, cardY + 28);
      ctx.fillStyle = "#94eb9e";
      ctx.font = "800 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(`Novo Poder de Combate: CP ${evoScene.newCp}`, cx, cardY + 52);
    }
    ctx.restore();

    if (progress >= 1.0) {
      evoScene.active = false;
      window.PokeAudio.playGotchaFanfare();
      window.PokeAudio.playPokemonCry(evoScene.toSpeciesId);
      toggleSceneMode("CITY_MAP");
      showPokemonDetailSheet(evoScene.monUid);
    }
  }

  // ============================================================================
  // INTERAÇÃO TOUCH & MOUSE: JOYSTICK, PINCH-TO-ZOOM, ROTAÇÃO 3D E CURVEBALL
  // ============================================================================
  function bindJoystickEvents() {
    const zone = document.getElementById("joystick-zone");
    const knob = document.getElementById("joystick-knob");
    if (!zone || !knob) return;

    const maxRadius = 25;
    const handleMove = (clientX, clientY) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      cityState.joyDx = dx / maxRadius;
      cityState.joyDz = dy / maxRadius;
    };

    const resetJoy = () => {
      cityState.joyActive = false;
      cityState.joyDx = 0;
      cityState.joyDz = 0;
      knob.style.transform = "translate(0px, 0px)";
    };

    zone.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      // CRÍTICO: Ao tocar no Joystick, desprende imediatamente o jogador do GPS Live!
      if (cityState.navMode !== "JOYSTICK_FREE") {
        cityState.navMode = "JOYSTICK_FREE";
        updateGpsPillUI();
        window.PokeStorage.showToast("[JOY] Joystick Livre ativado (desprendido do GPS)! Toque em [JOY] no topo para voltar ao GPS Live.", "info");
      }
      cityState.joyActive = true;
      zone.setPointerCapture(e.pointerId);
      handleMove(e.clientX, e.clientY);
    });
    zone.addEventListener("pointermove", (e) => {
      if (!cityState.joyActive) return;
      e.stopPropagation();
      handleMove(e.clientX, e.clientY);
    });
    zone.addEventListener("pointerup", resetJoy);
    zone.addEventListener("pointercancel", resetJoy);
  }

  function bindInputEvents() {
    bindJoystickEvents();

    // Pinch-to-Zoom de 2 dedos no Mobile
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2 && gameScene === "CITY_MAP") {
        activePinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && activePinchDist !== null && gameScene === "CITY_MAP") {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (activePinchDist - newDist) * 0.06;
        adjustZoom(delta);
        activePinchDist = newDist;
      }
    }, { passive: true });

    canvas.addEventListener("touchend", () => { activePinchDist = null; }, { passive: true });

    // Scroll do mouse para Zoom (2.5m até 55m!)
    canvas.addEventListener("wheel", (e) => {
      if (gameScene === "CITY_MAP") {
        adjustZoom(e.deltaY * 0.012);
      }
    }, { passive: true });

    canvas.addEventListener("pointerdown", (e) => {
      window.PokeAudio.init();
      const x = e.clientX, y = e.clientY;

      if (gameScene === "LIVE_BATTLE" && liveBattle.active) {
        dragStartX = x;
        dragStartY = y;
        isDraggingLook = true;
        return;
      }

      if (gameScene === "CITY_MAP") {
        for (const t of projectedClickTargets) {
          if (Math.hypot(x - t.x, y - (t.y - 12)) <= t.r) {
            handleCityEntityClick(t);
            return;
          }
        }
        isDraggingLook = true;
        dragStartX = x;
        dragStartY = y;
        return;
      }

      // Modo Captura AR: verifica se clicou na Pokébola 3D na parte inferior
      const ballScreenX = canvas.width * 0.5 + ball.pos.x * 130;
      const ballScreenY = canvas.height * 0.76;

      if (ball.state === 0 && Math.hypot(x - ballScreenX, y - ballScreenY) < 120) {
        ball.isDraggingBall = true;
        ball.lastPointerX = x;
        ball.lastPointerY = y;
        ball.lastPointerTime = performance.now();
        ball.spinHistory = [];
      } else {
        isDraggingLook = true;
        dragStartX = x;
        dragStartY = y;
      }
    });

    window.addEventListener("pointermove", (e) => {
      const x = e.clientX, y = e.clientY;
      if (ball.isDraggingBall && ball.state === 0 && gameScene === "AR_CAPTURE") {
        const now = performance.now();
        const dx = x - ball.lastPointerX;
        const dy = y - ball.lastPointerY;

        ball.pos.x = Math.max(-0.9, Math.min(0.9, (x - canvas.width * 0.5) / (canvas.width * 0.42)));
        ball.pos.y = Math.max(-0.9, Math.min(0.25, -0.55 - (canvas.height * 0.76 - y) / (canvas.height * 0.45)));

        const cx = canvas.width * 0.5, cy = canvas.height * 0.72;
        const cross = (ball.lastPointerX - cx) * (y - cy) - (ball.lastPointerY - cy) * (x - cx);
        if (Math.abs(cross) > 45) {
          ball.spinRpm = Math.min(2.6, ball.spinRpm + Math.abs(cross) * 0.00028);
          ball.curveDir = cross > 0 ? -1 : 1;
          if (Math.random() < 0.25) window.PokeAudio.playCurveballSpin(ball.spinRpm);
        }

        ball.spinHistory.push({ dx, dy, dt: Math.max(4, now - ball.lastPointerTime) });
        if (ball.spinHistory.length > 6) ball.spinHistory.shift();

        ball.lastPointerX = x;
        ball.lastPointerY = y;
        ball.lastPointerTime = now;
      } else if (isDraggingLook) {
        const dx = x - dragStartX;
        const dy = y - dragStartY;
        if (gameScene === "CITY_MAP") {
          cityState.camOrbitYaw -= dx * 0.0065;
          cityState.camOrbitPitch = Math.max(0.22, Math.min(1.28, cityState.camOrbitPitch + dy * 0.0045));
        } else if (gameScene === "AR_CAPTURE") {
          camYaw -= dx * 0.005;
          camPitch = Math.max(-0.65, Math.min(0.65, camPitch - dy * 0.004));
        }
        dragStartX = x;
        dragStartY = y;
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (gameScene === "LIVE_BATTLE" && liveBattle.active && isDraggingLook) {
        isDraggingLook = false;
        const dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 42) {
          triggerBattleDodge(dx > 0 ? 1 : -1);
        } else {
          triggerPlayerAttack(false);
        }
        return;
      }

      if (ball.isDraggingBall && ball.state === 0 && gameScene === "AR_CAPTURE") {
        ball.isDraggingBall = false;
        let avgVx = 0, avgVy = 0;
        for (const h of ball.spinHistory) {
          avgVx += h.dx / h.dt;
          avgVy += h.dy / h.dt;
        }
        if (ball.spinHistory.length > 0) {
          avgVx /= ball.spinHistory.length;
          avgVy /= ball.spinHistory.length;
        }

        if (avgVy < -0.16) {
          const p = window.PokeStorage.getProfile();
          if ((p.bag[activeBallType] || 0) <= 0) {
            window.PokeStorage.showToast("[!] Suas Pokébolas desse tipo acabaram! Gire um PokéStop no Mapa!", "warn");
            resetBall();
            return;
          }
          p.bag[activeBallType]--;
          updateHud();

          ball.state = 1;
          const speed = Math.min(2.2, Math.max(0.95, Math.abs(avgVy) * 1.15));
          ball.vel.x = avgVx * 2.2 - ball.curveDir * ball.spinRpm * 0.85;
          ball.vel.y = 3.25 * speed;
          ball.vel.z = -4.25 * speed;
          window.PokeAudio.playThrow();
        } else {
          resetBall();
        }
      }
      isDraggingLook = false;
    });
  }

  function handleCityEntityClick(target) {
    window.PokeAudio.playUiClick();
    if (target.type === "WILD") {
      startWildEncounterFromMap(target.index);
    } else if (target.type === "POKESTOP") {
      spinPokestopOnMap(target.index);
    } else if (target.type === "GYM") {
      showGymDetailModal(target.index);
    } else if (target.type === "VILLAIN") {
      startLiveBattle("VILLAIN", 150, 1750, "[VILAO] Líder Cyber Rocket", 40, 1000, false);
    }
  }

  function spinPokestopOnMap(index) {
    const ps = cityState.pokestops[index];
    if (!ps) return;
    maybeShowScreenGuide("POKESTOP");
    const dist = Math.hypot(ps.x - cityState.playerX, ps.z - cityState.playerZ);
    if (dist > 7.5) {
      window.PokeStorage.showToast(` Aproxime-se do ${ps.name} com o Joystick (${dist.toFixed(1)}m)!`, "warn");
      return;
    }
    if (Date.now() < ps.cooldownUntil) {
      window.PokeStorage.showToast(` ${ps.name} recarregando (${Math.ceil((ps.cooldownUntil - Date.now()) / 1000)}s).`, "info");
      return;
    }
    ps.cooldownUntil = Date.now() + 25000;
    const p = window.PokeStorage.getProfile();
    const balls = 3 + Math.floor(Math.random() * 3);
    p.bag.poke_ball = (p.bag.poke_ball || 0) + balls;
    p.bag.razz_berry = (p.bag.razz_berry || 0) + 2;
    p.stardust += 150;
    if (p.tasksProgress) p.tasksProgress.spins = (p.tasksProgress.spins || 0) + 1;
    p.researchStamps = Math.min(7, (p.researchStamps || 0) + 1);

    // Animação de Bolhas de Recompensa subindo no Mapa 3D!
    const targetPt = projectedClickTargets.find(t => t.type === "POKESTOP" && t.index === index);
    const fx = targetPt ? targetPt.x : canvas.width * 0.5;
    const fy = targetPt ? targetPt.y : canvas.height * 0.45;
    cityState.floatingMapAnims.push({ text: `+${balls} [BALL] Pokébolas  +2 [BERRY]  +150 *`, x: fx, y: fy - 15, life: 1.0 });

    // Se tiver menos de 9 ovos na caixa, chance de ganhar um Ovo 2km/5km/10km!
    let eggMsg = "";
    if (Array.isArray(p.eggs) && p.eggs.length < 9 && Math.random() < 0.45) {
      const kms = [2.0, 5.0, 10.0][Math.floor(Math.random() * 3)];
      p.eggs.push({ id: "egg_" + Date.now(), kmRequired: kms, kmWalked: 0, incubating: !p.eggs.some(e => e.incubating) });
      eggMsg = ` + [OVO] Ovo de ${kms}km`;
    }

    window.PokeStorage.addXp(150);
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.showToast(`[STOP] ${ps.name}: +${balls} Pokébolas, +2 Berries, +150 Stardust${eggMsg}!`, "success");
    updateHud();
  }

  // ============================================================================
  // ATUALIZAÇÃO DO HUD MOBILE MINIMALISTA (Ref: 22.18.13 (2).jpeg)
  // ============================================================================
  function updateHud() {
    const p = window.PokeStorage.getProfile();
    if (!p) return;

    const lvlEl = document.getElementById("hud-level-num");
    const nameEl = document.getElementById("hud-trainer-name");
    const buddyEl = document.getElementById("hud-buddy-icon");
    const nearbyEl = document.getElementById("nearby-pill");
    const anomalyLbl = document.getElementById("radial-anomaly-lbl");

    if (lvlEl) lvlEl.textContent = p.level;
    if (nameEl) nameEl.textContent = p.trainerName;

    const buddy = p.pokemonBox.find(m => m.uid === p.buddyUid) || p.pokemonBox[0];
    if (buddyEl && buddy) {
      buddyEl.innerHTML = `<img src="${E.getPokemonCardImageSrc(buddy.speciesId, false, buddy.isShiny)}" alt="${buddy.name}"/>`;
    }

    // Pílula Branca Nearby com 3 Silhuetas 3D em ASCII dos Pokémons ao redor
    if (nearbyEl) {
      const top3 = cityState.wildSpawns.slice(0, 3);
      nearbyEl.innerHTML = top3.map(sp => {
        const caught = !!p.pokedexCaught[sp.mon.speciesId];
        return `<img src="${E.getPokemonCardImageSrc(sp.mon.speciesId, !caught, false)}" alt="Nearby"/>`;
      }).join("");
    }

    if (anomalyLbl) {
      anomalyLbl.textContent = `ANOMALY (${p.anomalyCharge || 0}%)`;
    }
  }

  function openRadialMenu() {
    window.PokeAudio.playUiClick();
    updateHud();
    const el = document.getElementById("pogo-radial-menu");
    if (el) el.style.display = "flex";
  }

  function closeRadialMenu() {
    window.PokeAudio.playUiClick();
    const el = document.getElementById("pogo-radial-menu");
    if (el) el.style.display = "none";
  }

  function openModal(title, html) {
    closeRadialMenu();
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = html;
    document.getElementById("game-modal").classList.add("open");
  }

  function closeModal() {
    window.PokeAudio.playUiClick();
    document.getElementById("game-modal").classList.remove("open");
    // Watchdog de segurança ao fechar qualquer modal: se uma captura, batalha ou evolução já terminou, garante retorno ao Mapa!
    if (
      (gameScene === "AR_CAPTURE" && (!wildMon || ball.state === 4)) ||
      (gameScene === "LIVE_BATTLE" && !liveBattle.active) ||
      (gameScene === "EVOLUTION_CUTSCENE" && !evoScene.active)
    ) {
      gameScene = "CITY_MAP";
      syncSceneHudVisibility();
      updateHud();
    }
  }

  // ============================================================================
  // 1. POKÉMON BOX COM 3 ABAS (TAGS | POKÉMON | EGGS) + FICHA + APPRAISAL IV 3 BARRAS
  // ============================================================================
  function showPokemonBoxModal(activeTab = "POKEMON", searchQuery = "") {
    maybeShowScreenGuide("POKEMON_BOX");
    const p = window.PokeStorage.getProfile();
    const q = searchQuery.trim().toLowerCase();
    const eggs = p.eggs || [];

    const tabsHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:2px solid #cbe8de;margin-bottom:12px;text-align:center;font-size:12px;font-weight:800;">
        <div onclick="window.PokeGameUI.showPokemonBoxModal('TAGS')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'TAGS' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'TAGS' ? '3px solid #1c7c74' : 'none'};">
          TAGS
        </div>
        <div onclick="window.PokeGameUI.showPokemonBoxModal('POKEMON')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'POKEMON' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'POKEMON' ? '3px solid #1c7c74' : 'none'};">
          POKÉMON (${p.pokemonBox.length}/500)
        </div>
        <div onclick="window.PokeGameUI.showPokemonBoxModal('EGGS')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'EGGS' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'EGGS' ? '3px solid #1c7c74' : 'none'};">
          EGGS (${eggs.length}/12)
        </div>
      </div>
    `;

    if (activeTab === "EGGS") {
      const eggGrid = eggs.map((egg, idx) => {
        const col = egg.kmRequired >= 10 ? "#9333ea" : (egg.kmRequired >= 5 ? "#f59e0b" : "#10b981");
        const pct = Math.min(100, Math.round(((egg.kmWalked || 0) / egg.kmRequired) * 100));
        return `
          <div class="pogo-mon-cell" onclick="window.PokeGameUI.incubateEgg(${idx})" style="border:2px solid ${egg.incubating ? col : '#d5ece4'};">
            <div style="font-size:11px;font-weight:800;color:${col};">${egg.incubating ? "INCUBANDO" : "TOQUE P/ INCUBAR"}</div>
            <div style="margin:10px 0;">${svgIcon("egg", 42, col)}</div>
            <div class="pogo-mon-name">${(egg.kmWalked || 0).toFixed(1)} / ${egg.kmRequired.toFixed(1)} km</div>
            <div style="width:80%;height:6px;background:#e2f2ec;border-radius:3px;margin:6px auto 0;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${col};"></div>
            </div>
          </div>
        `;
      }).join("");

      openModal(`OVOS (${eggs.length}/12)`, `
        ${tabsHtml}
        <div class="pogo-white-card" style="font-size:12px;color:#527a80;text-align:center;">
           Caminhe pelo Mapa GPS ou use o Joystick para chocar seus Ovos na Incubadora Infinita! Gire PokéStops para encontrar novos ovos de 2km, 5km e 10km.
        </div>
        <div class="pogo-3col-grid">${eggGrid || "<p style='grid-column:1/-1;'>Gire um PokéStop no mapa para receber Ovos!</p>"}</div>
      `);
      return;
    }

    if (activeTab === "TAGS") {
      const shinyCount = p.pokemonBox.filter(m => m.isShiny).length;
      const star3Count = p.pokemonBox.filter(m => m.ivPercent >= 80).length;
      const highCpCount = p.pokemonBox.filter(m => m.cp >= 1000).length;
      openModal("TAGS DE POKÉMON", `
        ${tabsHtml}
        <div class="pogo-white-card" onclick="window.PokeGameUI.showPokemonBoxModal('POKEMON', 'shiny')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div><b style="color:#d97706;">* Pokémons Shiny</b><div style="font-size:11px;color:#688a8e;">Variantes cromáticas raras</div></div>
          <span class="pogo-pill-btn">${shinyCount}</span>
        </div>
        <div class="pogo-white-card" onclick="window.PokeGameUI.showPokemonBoxModal('POKEMON', '3*')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div><b style="color:#1c7c74;">* Top IV (3★ e 4★ / 80%+)</b><div style="font-size:11px;color:#688a8e;">Ideais para Raids e Ginásios</div></div>
          <span class="pogo-pill-btn">${star3Count}</span>
        </div>
        <div class="pogo-white-card" onclick="window.PokeGameUI.showPokemonBoxModal('POKEMON', 'cp1000')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
          <div><b style="color:#2563eb;">[BATTLE] Elite de Combate (CP 1000+)</b><div style="font-size:11px;color:#688a8e;">Campeões prontos para batalha</div></div>
          <span class="pogo-pill-btn">${highCpCount}</span>
        </div>
      `);
      return;
    }

    const sorted = [...p.pokemonBox]
      .filter(m => {
        if (!q) return true;
        if (q === "shiny") return m.isShiny;
        if (q === "3*") return m.ivPercent >= 80;
        if (q === "cp1000") return m.cp >= 1000;
        return m.name.toLowerCase().includes(q) || String(m.speciesId) === q;
      })
      .sort((a, b) => b.cp - a.cp);

    const gridHtml = sorted.map(m => `
      <div class="pogo-mon-cell ${m.isShiny ? 'shiny' : ''}" onclick="window.PokeGameUI.showPokemonDetailSheet('${m.uid}')">
        <div class="pogo-cp-top">CP <b>${m.cp}</b></div>
        <img class="pogo-mon-img" src="${E.getPokemonCardImageSrc(m.speciesId, false, m.isShiny)}" alt="${m.name}"/>
        <div class="pogo-mon-name">${m.isShiny ? "*" : ""}${m.name}</div>
        <div class="pogo-hp-line"></div>
      </div>
    `).join("");

    openModal(`POKÉMON (${p.pokemonBox.length}/500)`, `
      ${tabsHtml}
      <input class="pogo-search-bar" type="text" placeholder=" Buscar Pokémon, 'shiny', '3*'..."
        value="${searchQuery}" oninput="window.PokeGameUI.showPokemonBoxModal('POKEMON', this.value)"/>
      <div class="pogo-3col-grid">
        ${gridHtml || "<p style='grid-column:1/-1;color:#668a8e;'>Nenhum Pokémon encontrado.</p>"}
      </div>
    `);
  }

  function incubateEgg(eggIdx) {
    const p = window.PokeStorage.getProfile();
    if (!p.eggs || !p.eggs[eggIdx]) return;
    p.eggs.forEach((e, idx) => { e.incubating = (idx === eggIdx); });
    window.PokeStorage.save();
    window.PokeAudio.playUiClick();
    window.PokeStorage.showToast(`[OVO] Ovo de ${p.eggs[eggIdx].kmRequired}km colocado na Incubadora Infinita!`, "success");
    showPokemonBoxModal("EGGS");
  }

  function showPokemonDetailSheet(uid, showAppraisal = false) {
    const p = window.PokeStorage.getProfile();
    const m = p.pokemonBox.find(x => x.uid === uid);
    if (!m) return;
    const sp = window.PokeData.getSpecies(m.speciesId);
    const candies = p.candies[m.speciesId] || 0;
    const weight = (sp.weight_kg * (m.scaleVariation || 1)).toFixed(2);
    const height = (sp.height_m * (m.scaleVariation || 1)).toFixed(2);

    const stars = m.ivPercent === 100 ? "**** (4★ PERFEITO!)" :
                  (m.ivPercent >= 82 ? "*** (3★ Excelente)" :
                  (m.ivPercent >= 66 ? "** (2★ Bom)" : "* (1★ Básico)"));

    const ivBar = (label, val) => {
      const pct = Math.round((val / 15) * 100);
      const col = val === 15 ? "#ef4444" : "#f59e0b";
      return `
        <div style="margin:6px 0;text-align:left;">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#254a52;">
            <span>${label}</span><span>${val} / 15</span>
          </div>
          <div style="width:100%;height:10px;background:#e2f2ec;border-radius:5px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;">
            <div style="background:${pct >= 33 ? col : '#d5e8e0'};height:100%;"></div>
            <div style="background:${pct >= 66 ? col : '#d5e8e0'};height:100%;"></div>
            <div style="background:${pct >= 95 ? col : '#d5e8e0'};height:100%;"></div>
          </div>
        </div>
      `;
    };

    const appraisalCardHtml = showAppraisal ? `
      <div class="pogo-white-card" style="border:2px solid #24c8a8;background:#f4fdf9;">
        <div style="font-size:13px;font-weight:900;color:#1c7c74;margin-bottom:4px;">
          [PROF] AVALIAÇÃO DO LÍDER DA EQUIPE ${p.avatar.team.toUpperCase()}
        </div>
        <div style="font-size:14px;font-weight:900;color:#d97706;margin-bottom:8px;">${stars} • IV ${m.ivPercent}%</div>
        ${ivBar("ATAQUE (ATK)", m.ivAtk)}
        ${ivBar("DEFESA (DEF)", m.ivDef)}
        ${ivBar("PS / STAMINA (STA)", m.ivSta)}
      </div>
    ` : "";

    openModal(`CP ${m.cp}`, `
      <div class="pogo-white-card" style="text-align:center;">
        <img src="${E.getPokemonCardImageSrc(m.speciesId, false, m.isShiny)}" style="width:116px;height:116px;object-fit:contain;"/>
        <h2 style="color:#254a52;margin-top:4px;">${m.isShiny ? "* " : ""}${m.name}</h2>
        <div style="width:55%;height:6px;background:#34d399;border-radius:3px;margin:6px auto;"></div>
        <div style="font-size:12px;font-weight:800;color:#527a80;">${m.hp}/${m.maxHp} HP • Nível ${m.level}</div>

        <div class="stat-capsules-row">
          <div><div class="stat-cap-val">${weight}kg</div><div class="stat-cap-lbl">WEIGHT</div></div>
          <div><div class="stat-cap-val">${sp.types.join("/")}</div><div class="stat-cap-lbl">TYPE</div></div>
          <div><div class="stat-cap-val">${height}m</div><div class="stat-cap-lbl">HEIGHT</div></div>
        </div>

        <div style="display:flex;justify-content:space-around;background:#eef8f4;padding:10px;border-radius:12px;margin-bottom:12px;">
          <div><div style="font-size:15px;font-weight:800;">${svgIcon("dust", 16, "#0284c7")} ${p.stardust.toLocaleString()}</div><div class="stat-cap-lbl">STARDUST</div></div>
          <div><div style="font-size:15px;font-weight:800;">${svgIcon("candy", 16, "#10b981")} ${candies}</div><div class="stat-cap-lbl">${sp.name.toUpperCase()} CANDY</div></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.powerUpPokemon('${m.uid}')">
            POWER UP (400 Stardust + 2 Candy)
          </button>
          ${sp.evolvesTo ? `
            <button class="pogo-pill-btn" style="background:linear-gradient(90deg,#f59e0b,#ec4899);"
              onclick="window.PokeGameUI.evolvePokemon('${m.uid}')">
              EVOLVE COM MORPH 3D (${sp.evoCandyCost} Candy)
            </button>
          ` : ""}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.showPokemonDetailSheet('${m.uid}', ${!showAppraisal})">
              ${svgIcon("star", 14, "#1c7c74")} AVALIAR IVs
            </button>
            <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.setBuddy('${m.uid}')">
              ${svgIcon("heart", 14, "#1c7c74")} DEFINIR PARCEIRO
            </button>
          </div>
        </div>
      </div>

      ${appraisalCardHtml}

      <div class="pogo-white-card">
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-bottom:8px;">
          <span>* Golpe Rápido: ${m.fastMove}</span><span>12</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:13px;">
          <span>* Golpe Carregado: ${m.chargedMove}</span><span>65</span>
        </div>
      </div>
    `);
  }

  function powerUpPokemon(uid) {
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    const mon = p.pokemonBox.find(m => m.uid === uid);
    if (!mon) return;
    if (mon.level >= cfg.maxPokemonLevelCap) {
      return window.PokeStorage.showToast(`[!] Nível máximo (${cfg.maxPokemonLevelCap}) atingido!`, "warn");
    }
    if (p.stardust < 400 || (p.candies[mon.speciesId] || 0) < 2) {
      return window.PokeStorage.showToast("[!] Stardust (400) ou Candies (2) insuficientes!", "warn");
    }
    p.stardust -= 400;
    p.candies[mon.speciesId] -= 2;
    mon.level += 1;
    mon.cp = window.PokeData.calculateCP(mon.speciesId, mon.level, mon.ivAtk, mon.ivDef, mon.ivSta);
    mon.maxHp = window.PokeData.calculateMaxHP(mon.speciesId, mon.level, mon.ivSta);
    mon.hp = mon.maxHp;
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.save();
    showPokemonDetailSheet(uid, true);
  }

  function evolvePokemon(uid) {
    const p = window.PokeStorage.getProfile();
    const mon = p.pokemonBox.find(m => m.uid === uid);
    if (!mon) return;
    const sp = window.PokeData.getSpecies(mon.speciesId);
    if (!sp.evolvesTo) return;
    const cost = sp.evoCandyCost || 25;
    if ((p.candies[mon.speciesId] || 0) < cost) {
      return window.PokeStorage.showToast(`[!] Você precisa de ${cost} Candies para evoluir!`, "warn");
    }
    const oldSpeciesId = mon.speciesId;
    const oldName = mon.name;
    p.candies[oldSpeciesId] -= cost;
    const targetSp = window.PokeData.getSpecies(sp.evolvesTo);
    mon.speciesId = targetSp.id;
    mon.name = targetSp.name;
    mon.cp = window.PokeData.calculateCP(mon.speciesId, mon.level, mon.ivAtk, mon.ivDef, mon.ivSta);
    mon.maxHp = window.PokeData.calculateMaxHP(mon.speciesId, mon.level, mon.ivSta);
    mon.hp = mon.maxHp;
    mon.fastMove = targetSp.fastMoves[0];
    mon.chargedMove = targetSp.chargedMoves[0];

    p.pokedexCaught[mon.speciesId] = (p.pokedexCaught[mon.speciesId] || 0) + 1;
    p.candies[mon.speciesId] = (p.candies[mon.speciesId] || 0) + 5;
    window.PokeStorage.addXp(500);
    window.PokeStorage.save();

    startEvolutionCutscene(uid, oldSpeciesId, targetSp.id, oldName, targetSp.name, mon.cp);
  }

  function setBuddy(uid) {
    const p = window.PokeStorage.getProfile();
    p.buddyUid = uid;
    window.PokeStorage.save();
    updateHud();
    window.PokeStorage.showToast("[BUDDY] Novo Pokémon Parceiro caminhando ao seu lado no Mapa 3D ASCII!", "success");
    showPokemonDetailSheet(uid);
  }

  // ============================================================================
  // 2. POKÉDEX REGIONAL COM SILHUETAS 3D EM ASCII (Ref: 22.18.12.jpeg)
  // ============================================================================
  function showPokedexModal(genIndex = 0) {
    maybeShowScreenGuide("POKEDEX");
    const p = window.PokeStorage.getProfile();
    const gens = [
      { name: "KANTO", start: 1, end: 151 },
      { name: "JOHTO", start: 152, end: 251 },
      { name: "HOENN", start: 252, end: 386 },
      { name: "SINNOH", start: 387, end: 493 },
      { name: "UNOVA", start: 494, end: 649 },
      { name: "KALOS", start: 650, end: 721 },
      { name: "ALOLA", start: 722, end: 809 },
      { name: "GALAR", start: 810, end: 905 },
      { name: "PALDEA", start: 906, end: 1025 }
    ];
    const g = gens[genIndex] || gens[0];

    let caughtInGen = 0;
    for (let id = g.start; id <= g.end; ++id) {
      if (p.pokedexCaught[id]) caughtInGen++;
    }

    const tabsHtml = gens.map((gen, idx) => `
      <button class="pogo-pill-btn ${idx === genIndex ? '' : 'secondary'}"
        style="padding:6px 12px;font-size:11px;"
        onclick="window.PokeGameUI.showPokedexModal(${idx})">
        ${gen.name}
      </button>
    `).join("");

    let cellsHtml = "";
    for (let id = g.start; id <= g.end; ++id) {
      const sp = window.PokeData.getSpecies(id);
      const caught = !!p.pokedexCaught[id];
      const imgSrc = E.getPokemonCardImageSrc(id, !caught, false);

      cellsHtml += `
        <div class="pogo-mon-cell" style="opacity:${caught ? '1' : '0.88'};">
          <div class="pogo-cp-top">#${String(id).padStart(3, "0")}</div>
          <img class="pogo-mon-img" src="${imgSrc}" alt="${sp.name}" loading="lazy"/>
          <div class="pogo-mon-name">${caught ? sp.name : "???"}</div>
        </div>
      `;
    }

    openModal("POKÉDEX", `
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:12px;">
        ${tabsHtml}
      </div>
      <div class="pogo-region-banner">
        <div>
          <div class="pogo-region-title">${g.name}</div>
          <div class="pogo-region-sub">Caught: ${caughtInGen} / ${g.end - g.start + 1}</div>
        </div>
        <div style="display:flex;gap:4px;">
          <img src="${E.getPokemonCardImageSrc(g.start, false, false)}" style="width:46px;height:46px;"/>
          <img src="${E.getPokemonCardImageSrc(g.start + 3, false, false)}" style="width:46px;height:46px;"/>
          <img src="${E.getPokemonCardImageSrc(g.start + 6, false, false)}" style="width:46px;height:46px;"/>
        </div>
      </div>
      <div class="pogo-3col-grid">${cellsHtml}</div>
    `);
  }

  // ============================================================================
  // 3. RADAR NEARBY COM 3 ABAS: POKÉMON | RAID | ANOMALY (Ref: 22.18.13 (1).jpeg)
  // ============================================================================
  function showNearbyTrackerModal(activeTab = "POKEMON") {
    maybeShowScreenGuide("NEARBY");
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();

    const tabsHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:2px solid #cbe8de;margin-bottom:14px;text-align:center;font-weight:800;font-size:13px;">
        <div onclick="window.PokeGameUI.showNearbyTrackerModal('POKEMON')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'POKEMON' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'POKEMON' ? '3px solid #1c7c74' : 'none'};">
          POKÉMON (${cityState.wildSpawns.length})
        </div>
        <div onclick="window.PokeGameUI.showNearbyTrackerModal('RAID')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'RAID' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'RAID' ? '3px solid #1c7c74' : 'none'};">
          RAID (${cityState.gyms.length})
        </div>
        <div onclick="window.PokeGameUI.showNearbyTrackerModal('ANOMALY')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'ANOMALY' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'ANOMALY' ? '3px solid #1c7c74' : 'none'};">
          ANOMALY
        </div>
      </div>
    `;

    if (activeTab === "RAID") {
      const raidsHtml = cityState.gyms.map(gym => {
        const bossSp = window.PokeData.getSpecies(gym.raidBossId);
        return `
          <div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${E.getPokemonCardImageSrc(bossSp.id, false, false)}" style="width:64px;height:64px;"/>
              <div>
                <div style="font-weight:800;font-size:14px;color:#254a52;">***** ${bossSp.name}</div>
                <div style="font-size:11px;color:#527a80;">[LOC] ${gym.name} • CP 3400</div>
              </div>
            </div>
            <button class="pogo-pill-btn" onclick="window.PokeGameUI.startLiveBattle('RAID', ${bossSp.id}, 3400, '[BOSS] Raid Boss ${bossSp.name}', 60, 1500, true)">
              LUTAR
            </button>
          </div>
        `;
      }).join("");
      openModal("NEARBY RAIDS", `${tabsHtml}${raidsHtml}`);
      return;
    }

    if (activeTab === "ANOMALY") {
      const mult = window.PokeData.calculateRareProgressMultiplier(p, cfg).toFixed(2);
      openModal("SCANNER DE ANOMALIA RARA", `
        ${tabsHtml}
        <div class="pogo-white-card" style="text-align:center;">
          <div style="font-size:44px;">[SCAN]</div>
          <h3 style="color:#1c7c74;margin:6px 0;">Multiplicador de Raros Ativo: ${mult}x</h3>
          <p style="font-size:12px;color:#527a80;margin-bottom:12px;">
            Carga da Anomalia de Bioma: <b>${p.anomalyCharge || 0}% / 100%</b> (Enche +12% a cada captura!)
          </p>
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.triggerAnomalyScanner()">
            * DISPARAR ANOMALIA RARA AGORA
          </button>
        </div>
      `);
      return;
    }

    const nearbyCells = cityState.wildSpawns.map((sp, idx) => {
      const caught = !!p.pokedexCaught[sp.mon.speciesId];
      const imgSrc = E.getPokemonCardImageSrc(sp.mon.speciesId, !caught, sp.mon.isShiny);
      return `
        <div class="nearby-ring-cell" onclick="window.PokeGameUI.closeModal(); window.PokeGameUI.startWildEncounterFromMap(${idx});">
          <div class="nearby-blue-disc">
            <img src="${imgSrc}" alt="${sp.mon.name}"/>
          </div>
          <div style="font-size:12px;font-weight:800;margin-top:8px;color:#254a52;">
            ${caught ? sp.mon.name : "???"}
          </div>
          <div style="font-size:10px;color:#1c7c74;font-weight:700;"> Toque p/ Capturar</div>
        </div>
      `;
    }).join("");

    openModal("NEARBY", `
      ${tabsHtml}
      <div class="pogo-3col-grid">${nearbyCells}</div>
    `);
  }

  // ============================================================================
  // 4. PESQUISAS & GO PASS COM 3 ABAS: TODAY | FIELD | SPECIAL (Refs: 22.18.09.jpeg)
  // ============================================================================
  function showBattlePassModal(activeTab = "TODAY") {
    maybeShowScreenGuide("RESEARCH");
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    const currentTier = Math.floor(p.battlePassXp / cfg.battlePassXpPerTier) + 1;
    const progressPct = Math.round(((p.battlePassXp % cfg.battlePassXpPerTier) / cfg.battlePassXpPerTier) * 100);
    const tp = p.tasksProgress || { caught: 1, throws: 0, spins: 0, raids: 0, walkedM: 0, claimedIds: [] };

    const tabsHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:2px solid #cbe8de;margin-bottom:14px;text-align:center;font-weight:800;font-size:12px;">
        <div onclick="window.PokeGameUI.showBattlePassModal('TODAY')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'TODAY' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'TODAY' ? '3px solid #1c7c74' : 'none'};">
          TODAY & GO PASS
        </div>
        <div onclick="window.PokeGameUI.showBattlePassModal('FIELD')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'FIELD' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'FIELD' ? '3px solid #1c7c74' : 'none'};">
          FIELD (${p.researchStamps || 3}/7)
        </div>
        <div onclick="window.PokeGameUI.showBattlePassModal('SPECIAL')"
          style="padding:8px;cursor:pointer;color:${activeTab === 'SPECIAL' ? '#1c7c74' : '#8aa8ac'};border-bottom:${activeTab === 'SPECIAL' ? '3px solid #1c7c74' : 'none'};">
          SPECIAL (${p.specialResearchStage || 1}/4)
        </div>
      </div>
    `;

    if (activeTab === "FIELD") {
      const stamps = p.researchStamps || 3;
      let stampDots = "";
      for (let s = 1; s <= 7; ++s) {
        stampDots += `
          <div style="width:34px;height:34px;border-radius:50%;background:${s <= stamps ? '#f59e0b' : '#e2f2ec'};color:${s <= stamps ? '#fff' : '#7a9a9e'};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;">
            ${s <= stamps ? "✓" : s}
          </div>
        `;
      }

      openModal("PESQUISA DE CAMPO (FIELD)", `
        ${tabsHtml}
        <div class="pogo-white-card" style="text-align:center;background:linear-gradient(135deg,#fef3c7,#fffbeb);border:2px solid #f59e0b;">
          <div style="font-weight:900;font-size:14px;color:#b45309;margin-bottom:8px;"> DESCOBERTA EXTRAORDINÁRIA (${stamps}/7 SELOS)</div>
          <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px;">${stampDots}</div>
          <p style="font-size:11px;color:#92400e;margin-bottom:10px;">Gire PokéStops ou complete tarefas diárias para ganhar selos!</p>
          ${stamps >= 7 ? `
            <button class="pogo-pill-btn" onclick="window.PokeGameUI.claimBreakthroughBox()">
               ABRIR CAIXA LENDÁRIA + 3.000 STARDUST!
            </button>
          ` : ""}
        </div>

        <div class="pogo-white-card">
          <div style="font-weight:800;font-size:13px;color:#1c7c74;margin-bottom:8px;"> MISSÕES DE POKÉSTOP ATIVAS</div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eef6f2;">
            <span style="font-size:12px;font-weight:700;">Girar 3 PokéStops (${Math.min(3, tp.spins || 0)}/3)</span>
            <button class="pogo-pill-btn" style="padding:5px 12px;font-size:11px;" onclick="window.PokeGameUI.claimResearchTask('field_spin3', 500, 15)">
              RESGATAR
            </button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
            <span style="font-size:12px;font-weight:700;">Capturar 3 Pokémons (${Math.min(3, tp.caught || 1)}/3)</span>
            <button class="pogo-pill-btn" style="padding:5px 12px;font-size:11px;" onclick="window.PokeGameUI.claimResearchTask('field_catch3', 650, 20)">
              RESGATAR
            </button>
          </div>
        </div>
      `);
      return;
    }

    if (activeTab === "SPECIAL") {
      const stage = p.specialResearchStage || 1;
      const stories = [
        { title: "Etapa 1/4: Bem-vindo ao Mundo ASCII 3D!", desc: "Professor Willow descobriu que os Pokémons estão se materializando em malhas 3D de caracteres ASCII pela sua cidade! Explore as ruas e capture seus primeiros parceiros.", rewardMon: 133, rewardName: "Eevee" },
        { title: "Etapa 2/4: O Segredo do Filtro Sobel 3D!", desc: "Excelente trabalho, Treinador! As bordas direcionais (| - / \\) revelam a energia oculta dos Ginásios e PokéStops. Continue fortalecendo sua equipe!", rewardMon: 147, rewardName: "Dratini" },
        { title: "Etapa 3/4: Anomalias e Chefes de Raid!", desc: "Uma forte anomalia eletromagnética está atraindo Pokémons raros e Lendários para os Ginásios locais.", rewardMon: 143, rewardName: "Snorlax" },
        { title: "Etapa 4/4: Mestre Lendário do PokeASCII!", desc: "Você dominou todas as técnicas de lançamento Curveball, Evolução com Morph 3D e Batalhas Ao Vivo!", rewardMon: 151, rewardName: "Mew Mítico" }
      ];
      const st = stories[Math.min(stories.length - 1, stage - 1)];

      openModal("PESQUISA ESPECIAL (SPECIAL)", `
        ${tabsHtml}
        <div class="pogo-white-card" style="background:linear-gradient(135deg,#e0f2fe,#f0fdf4);border:2px solid #24c8a8;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="font-size:40px;">[PROF]</div>
            <div>
              <div style="font-weight:900;font-size:14px;color:#1c7c74;">PROFESSOR WILLOW</div>
              <div style="font-weight:800;font-size:12px;color:#254a52;">${st.title}</div>
            </div>
          </div>
          <p style="font-size:12px;color:#3b5e64;line-height:1.45;margin-bottom:12px;">"${st.desc}"</p>
          <button class="pogo-pill-btn" style="width:100%;" onclick="window.PokeGameUI.advanceSpecialResearch(${st.rewardMon})">
            * COMPLETAR ETAPA & ENCONTRAR ${st.rewardName.toUpperCase()} EM 3D!
          </button>
        </div>
      `);
      return;
    }

    // Aba TODAY: GO Pass + Weekly Tasks
    let tiersHtml = "";
    for (let t = 1; t <= Math.max(12, currentTier + 3); ++t) {
      const unlocked = t <= currentTier;
      const claimed = p.battlePassClaimed.includes(t);
      const rewardDesc = t % 5 === 0 ? "[BOSS] Encontro Lendário + 100 PokéCoins" :
                         (t % 2 === 0 ? "* 1.000 Stardust + 5 Ultra Balls" : " 35 PokéCoins + 3 Rare Candies");

      tiersHtml += `
        <div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;border-left:5px solid ${claimed ? '#22c55e' : (unlocked ? '#26ccaa' : '#cbd5e1')};">
          <div>
            <div style="font-weight:800;font-size:14px;color:#254a52;">RANK ${t}</div>
            <div style="font-size:12px;color:#527a80;">${rewardDesc}</div>
          </div>
          <div>
            ${claimed ? `<span style="color:#16a34a;font-weight:800;font-size:12px;">✓ RESGATADO</span>` :
              (unlocked ? `<button class="pogo-pill-btn" style="padding:7px 14px;font-size:11px;" onclick="window.PokeGameUI.claimPassTier(${t})">RESGATAR</button>` :
              `<span style="font-size:11px;color:#94a3b8;">[LOCK] Bloqueado</span>`)}
          </div>
        </div>
      `;
    }

    openModal("GO PASS & PESQUISAS", `
      ${tabsHtml}
      <div class="pogo-white-card" style="background:linear-gradient(135deg,#0284c7,#26ccaa);color:#ffffff;text-align:center;">
        <div style="font-size:12px;font-weight:800;letter-spacing:1px;">PASSE 100% GRATUITO (ZERO GACHA)</div>
        <div style="font-size:32px;font-weight:900;margin:4px 0;">RANK ${currentTier}</div>
        <div style="width:85%;height:10px;background:rgba(255,255,255,0.28);border-radius:5px;margin:8px auto;overflow:hidden;">
          <div style="width:${progressPct}%;height:100%;background:#fde047;"></div>
        </div>
        <div style="font-size:11px;font-weight:700;">Progresso para o próximo Rank: ${progressPct}%</div>
      </div>

      <div class="pogo-white-card">
        <div style="font-weight:800;font-size:13px;color:#1c7c74;margin-bottom:8px;"> TAREFAS SEMANAIS (AUTO-RASTREADAS)</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #e5f0ec;">
          <span>Capturar Pokémons (${tp.caught || 1}/15)</span><b style="color:#1c7c74;">+200 PTS</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #e5f0ec;">
          <span>Acertar Curveballs (${p.stats.curveballsLanded || 0}/5)</span><b style="color:#1c7c74;">+150 PTS</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #e5f0ec;">
          <span>Caminhar no Mapa (${Math.round(p.distanceWalkedM || 0)}/500m)</span><b style="color:#1c7c74;">+250 PTS</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;">
          <span>Vencer Ginásios ou Raids (${(p.stats.gymsWon || 0) + (p.stats.raidsWon || 0)}/3)</span><b style="color:#1c7c74;">+300 PTS</b>
        </div>
      </div>

      ${tiersHtml}
    `);
  }

  function claimResearchTask(taskId, dust, coins) {
    const p = window.PokeStorage.getProfile();
    p.stardust += dust;
    p.pokecoins += coins;
    p.researchStamps = Math.min(7, (p.researchStamps || 0) + 1);
    window.PokeStorage.addXp(400);
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.showToast(` Tarefa concluída! +${dust} Stardust, +${coins} PokéCoins e +1 Selo de Pesquisa!`, "success");
    showBattlePassModal("FIELD");
  }

  function claimBreakthroughBox() {
    const p = window.PokeStorage.getProfile();
    p.researchStamps = 0;
    p.stardust += 3000;
    p.pokecoins += 75;
    window.PokeStorage.save();
    closeModal();
    spawnWildPokemon(144, true); // Articuno Lendário!
    toggleSceneMode("AR_CAPTURE");
  }

  function advanceSpecialResearch(rewardSpeciesId) {
    const p = window.PokeStorage.getProfile();
    p.specialResearchStage = Math.min(4, (p.specialResearchStage || 1) + 1);
    p.stardust += 1500;
    window.PokeStorage.addXp(1000);
    window.PokeStorage.save();
    closeModal();
    spawnWildPokemon(rewardSpeciesId, true);
    toggleSceneMode("AR_CAPTURE");
  }

  function claimPassTier(tier) {
    const p = window.PokeStorage.getProfile();
    if (p.battlePassClaimed.includes(tier)) return;
    p.battlePassClaimed.push(tier);

    if (tier % 5 === 0) {
      p.pokecoins += 100;
      p.bag.master_ball = (p.bag.master_ball || 0) + 1;
      spawnWildPokemon(150, true);
      toggleSceneMode("AR_CAPTURE");
    } else if (tier % 2 === 0) {
      p.stardust += 1000;
      p.bag.ultra_ball = (p.bag.ultra_ball || 0) + 5;
    } else {
      p.pokecoins += 35;
      if (p.pokemonBox[0]) {
        const spId = p.pokemonBox[0].speciesId;
        p.candies[spId] = (p.candies[spId] || 0) + 5;
      }
    }
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.save();
    updateHud();
    showBattlePassModal("TODAY");
  }

  // ============================================================================
  // 5. MOCHILA DE ITENS (ITEMS) E LOJA GRATUITA (SHOP)
  // ============================================================================
  function showBagModal(filter = "all") {
    const p = window.PokeStorage.getProfile();
    const entries = Object.entries(window.PokeData.ITEMS).filter(([, item]) => {
      if (filter === "berry") return item.type === "berry";
      if (filter === "ball") return item.type === "ball";
      return true;
    });

    const listHtml = entries.map(([key, item]) => {
      const count = p.bag[key] || 0;
      return `
        <div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;"
          onclick="window.PokeGameUI.useItem('${key}')">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:30px;">${item.icon}</div>
            <div>
              <div style="font-weight:800;font-size:14px;color:#254a52;">${item.name}</div>
              <div style="font-size:11px;color:#527a80;">Quantidade: <b>x${count}</b></div>
            </div>
          </div>
          <button class="pogo-pill-btn" style="padding:7px 14px;font-size:11px;">USAR</button>
        </div>
      `;
    }).join("");

    openModal("ITEMS", listHtml);
  }

  function useItem(itemKey) {
    const p = window.PokeStorage.getProfile();
    const item = window.PokeData.ITEMS[itemKey];
    if (!item || (p.bag[itemKey] || 0) <= 0) {
      return window.PokeStorage.showToast("[!] Você não possui este item!", "warn");
    }

    if (item.type === "ball") {
      activeBallType = itemKey;
      window.PokeStorage.showToast(`${item.icon} ${item.name} equipada para captura!`, "success");
      closeModal();
    } else if (item.type === "berry") {
      if (gameScene !== "AR_CAPTURE") {
        toggleSceneMode("AR_CAPTURE");
      }
      p.bag[itemKey]--;
      activeBerry = itemKey;
      berryThrowAnim = { progress: 0.0, icon: item.icon || "[BERRY]" };
      if (window.PokeAudio.playBerryFeed) window.PokeAudio.playBerryFeed();
      if (p.tasksProgress) p.tasksProgress.berries = (p.tasksProgress.berries || 0) + 1;
      window.PokeStorage.save();
      window.PokeStorage.showToast(`${item.icon} ${item.name} lançada para ${wildMon ? wildMon.name : 'o Pokémon'}!`, "success");
      closeModal();
    } else {
      p.bag[itemKey]--;
      window.PokeStorage.addXp(250);
      window.PokeStorage.showToast(`${item.icon} ${item.name} ativado (+250 XP)!`, "success");
      showBagModal();
    }
  }

  function showShopModal() {
    const p = window.PokeStorage.getProfile();
    const listHtml = Object.entries(window.PokeData.ITEMS).map(([key, item]) => `
      <div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:28px;">${item.icon}</div>
          <div>
            <div style="font-weight:800;font-size:14px;">${item.name}</div>
            <div style="font-size:11px;color:#527a80;">Na mochila: x${p.bag[key] || 0}</div>
          </div>
        </div>
        <button class="pogo-pill-btn" style="padding:7px 14px;font-size:11px;"
          onclick="window.PokeGameUI.buyShopItem('${key}')">
           ${item.price}
        </button>
      </div>
    `).join("");

    openModal("SHOP (100% GRATUITA)", `
      <div class="pogo-white-card" style="text-align:center;background:#eef8f4;">
        <div style="font-size:18px;font-weight:900;color:#1c7c74;"> ${p.pokecoins} POKÉCOINS</div>
        <div style="font-size:11px;color:#527a80;">Ganhe moedas gratuitas em Ginásios, Raids e no GO Pass!</div>
      </div>
      ${listHtml}
    `);
  }

  function buyShopItem(itemKey) {
    const p = window.PokeStorage.getProfile();
    const item = window.PokeData.ITEMS[itemKey];
    if (!item) return;
    if (p.pokecoins < item.price) {
      return window.PokeStorage.showToast("[!] PokéCoins insuficientes! Vença um Ginásio ou Raid!", "warn");
    }
    p.pokecoins -= item.price;
    p.bag[itemKey] = (p.bag[itemKey] || 0) + 1;
    window.PokeAudio.playUiClick();
    window.PokeStorage.save();
    showShopModal();
  }

  // ============================================================================
  // 6. GINÁSIOS COMPLETOS (DISCO FOTOGRÁFICO, 6 DEFENSORES, CORAÇÕES DE MOTIVAÇÃO,
  //    ALIMENTAR COM FRUTAS, COLOCAR DEFENSOR +50 POKÉCOINS E RAIDS 5 ESTRELAS)
  // ============================================================================
  function showGymDetailModal(gymIdx) {
    maybeShowScreenGuide("GYM");
    const p = window.PokeStorage.getProfile();
    const gym = cityState.gyms[gymIdx] || cityState.gyms[0];
    if (!gym.defenders || gym.defenders.length === 0) {
      const gSp = window.PokeData.getSpecies(gym.guardSpeciesId || 25);
      gym.defenders = [{ speciesId: gSp.id, name: gSp.name, cp: 1580, trainer: "Líder " + gym.team, motivation: 88 }];
    }
    const guard = gym.defenders[0];
    const bossSp = window.PokeData.getSpecies(gym.raidBossId);
    const isSameTeam = (p.avatar && p.avatar.team === gym.team);

    const defendersHtml = gym.defenders.map((d, dIdx) => `
      <div style="background:#eef8f4;border-radius:12px;padding:8px 6px;text-align:center;border:1.5px solid #bce6d8;">
        <div style="font-size:10px;font-weight:800;color:#e11d48;">${svgIcon("heart", 12, "#e11d48")} ${d.motivation}%</div>
        <img src="${E.getPokemonCardImageSrc(d.speciesId, false, false)}" style="width:54px;height:54px;object-fit:contain;"/>
        <div style="font-size:11px;font-weight:800;color:#254a52;">${d.name}</div>
        <div style="font-size:10px;color:#527a80;">CP ${d.cp}</div>
      </div>
    `).join("");

    openModal(gym.name.toUpperCase(), `
      <!-- 1. Disco Fotografico do Ginasio (Photo Disc Spin) -->
      <div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#e0f2fe,#f0fdf4);">
        <div>
          <div style="font-weight:900;font-size:13px;color:#0284c7;">${svgIcon("disc", 16, "#0284c7")} DISCO FOTOGRÁFICO DO GINÁSIO</div>
          <div style="font-size:11px;color:#527a80;">Gire para itens + 1 Passe de Raid Gratuito (${isSameTeam ? "Bônus de Equipe Ativo!" : "Ginásio Rival"})</div>
        </div>
        <button class="pogo-pill-btn" style="padding:8px 14px;font-size:11px;"
          onclick="window.PokeGameUI.spinGymPhotoDisc(${gymIdx})">
          GIRAR DISCO
        </button>
      </div>

      <!-- 2. Controle da Equipe + 6 Slots de Defensores + Coracoes de Motivacao -->
      <div class="pogo-white-card" style="text-align:center;">
        <div style="font-size:12px;font-weight:900;color:#1c7c74;margin-bottom:6px;">
          ${svgIcon("gym", 16, "#1c7c74")} CONTROLADO PELA EQUIPE ${gym.team.toUpperCase()} (${gym.defenders.length}/6 DEFENSORES)
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
          ${defendersHtml}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <button class="pogo-pill-btn secondary" style="padding:8px 10px;font-size:11px;"
            onclick="window.PokeGameUI.feedGymDefenderBerry(${gymIdx})">
            ${svgIcon("berry", 14, "#e11d48")} DAR FRUTA (+200)
          </button>
          <button class="pogo-pill-btn secondary" style="padding:8px 10px;font-size:11px;"
            onclick="window.PokeGameUI.placePokemonInGym(${gymIdx})">
            ${svgIcon("shield", 14, "#1c7c74")} DEFENDER (+50)
          </button>
        </div>

        <button class="pogo-pill-btn" style="width:100%;"
          onclick="window.PokeGameUI.conquerOrTrainGym(${gymIdx})">
          ${svgIcon("sword", 14, "#ffffff")} ${isSameTeam ? "TREINAR NO GINÁSIO AO VIVO" : "CONQUISTAR GINÁSIO PARA SUA EQUIPE!"}
        </button>
      </div>

      <!-- 3. Raid Boss 5 Estrelas no Topo do Ginasio -->
      <div class="pogo-white-card" style="text-align:center;border:2px solid #f59e0b;">
        <div style="font-size:12px;font-weight:800;color:#d97706;">${svgIcon("star", 15, "#d97706")} RAID LENDÁRIA ${gym.raidTier || 5} ESTRELAS ATIVA!</div>
        <img src="${E.getPokemonCardImageSrc(bossSp.id, false, false)}" style="width:92px;height:92px;"/>
        <h3 style="margin:4px 0;">Raid Boss: ${bossSp.name} (CP 3600)</h3>
        <p style="font-size:11px;color:#527a80;margin-bottom:8px;">Derrote o Boss ao vivo para entrar no Desafio Bônus de Captura (IV 10-15)!</p>
        <button class="pogo-pill-btn" style="width:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);"
          onclick="window.PokeGameUI.startLiveBattle('RAID', ${bossSp.id}, 3600, '[BOSS] Raid Boss ${bossSp.name}', 60, 1500, true)">
          ENTRAR NA RAID 3D AO VIVO & CAPTURAR BOSS
        </button>
      </div>
    `);
  }

  function spinGymPhotoDisc(gymIdx) {
    const gym = cityState.gyms[gymIdx] || cityState.gyms[0];
    if (Date.now() < (gym.photoDiscCooldownUntil || 0)) {
      return window.PokeStorage.showToast(" O Disco Fotográfico deste Ginásio está recarregando!", "info");
    }
    gym.photoDiscCooldownUntil = Date.now() + 25000;
    const p = window.PokeStorage.getProfile();
    const isSameTeam = (p.avatar && p.avatar.team === gym.team);
    const balls = isSameTeam ? 5 : 3;
    p.bag.poke_ball = (p.bag.poke_ball || 0) + balls;
    p.bag.hyper_potion = (p.bag.hyper_potion || 0) + 2;
    p.bag.raid_pass = Math.max(1, (p.bag.raid_pass || 0) + 1);
    p.stardust += 200;
    window.PokeStorage.addXp(200);
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.showToast(`[DISC] Disco do ${gym.name}: +${balls} Pokébolas, +2 Hyper Potions, +1 Passe de Raid e +200 Stardust!`, "success");
    showGymDetailModal(gymIdx);
  }

  function feedGymDefenderBerry(gymIdx) {
    const p = window.PokeStorage.getProfile();
    const gym = cityState.gyms[gymIdx] || cityState.gyms[0];
    if ((p.bag.razz_berry || 0) <= 0) {
      return window.PokeStorage.showToast("[!] Você precisa de Razz Berries! Gire um PokéStop ou o Disco do Ginásio.", "warn");
    }
    p.bag.razz_berry--;
    (gym.defenders || []).forEach(d => { d.motivation = Math.min(100, (d.motivation || 70) + 20); });
    p.stardust += 200;
    window.PokeStorage.addXp(100);
    if (window.PokeAudio.playBerryFeed) window.PokeAudio.playBerryFeed();
    window.PokeStorage.showToast("[BERRY] Você alimentou os defensores do Ginásio! Motivação HP  restaurada (+200 Stardust)!", "success");
    showGymDetailModal(gymIdx);
  }

  function placePokemonInGym(gymIdx) {
    const p = window.PokeStorage.getProfile();
    const gym = cityState.gyms[gymIdx] || cityState.gyms[0];
    if (p.avatar.team !== gym.team) {
      return window.PokeStorage.showToast(`[BATTLE] Este Ginásio pertence à Equipe ${gym.team}! Vença a batalha primeiro para conquistá-lo para a Equipe ${p.avatar.team}!`, "warn");
    }
    if ((gym.defenders || []).length >= 6) {
      return window.PokeStorage.showToast("[!] Este Ginásio já possui o limite máximo de 6 Pokémons defensores!", "warn");
    }
    const best = [...p.pokemonBox].sort((a, b) => b.cp - a.cp)[0];
    if (!best) return;
    if (gym.defenders.some(d => d.speciesId === best.speciesId)) {
      return window.PokeStorage.showToast(`[!] Regra Oficial Pokémon GO: Já existe um ${best.name} defendendo este Ginásio!`, "warn");
    }
    gym.defenders.unshift({
      speciesId: best.speciesId,
      name: best.name,
      cp: best.cp,
      trainer: p.trainerName,
      motivation: 100
    });
    gym.guardSpeciesId = best.speciesId;
    p.pokecoins += 50;
    p.stardust += 500;
    window.PokeStorage.addXp(400);
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.showToast(`[SHIELD] ${best.name} colocado como Guardião 3D do Ginásio! Bônus Diário: +50 PokéCoins!`, "success");
    showGymDetailModal(gymIdx);
  }

  function conquerOrTrainGym(gymIdx) {
    const p = window.PokeStorage.getProfile();
    const gym = cityState.gyms[gymIdx] || cityState.gyms[0];
    const guard = (gym.defenders && gym.defenders[0]) || { speciesId: gym.guardSpeciesId, cp: 1580 };
    // Converte o Ginásio para a equipe do jogador ao iniciar/vencer a disputa!
    gym.team = p.avatar.team;
    gym.color = TEAM_COLORS[p.avatar.team] || TEAM_COLORS["Trovão"];
    startLiveBattle("GYM", guard.speciesId, guard.cp || 1580, gym.name, 50, 800, false);
  }

  function showBattleHubModal() {
    openModal("BATTLE LEAGUE & RAIDS 3D", `
      <div class="pogo-white-card" style="text-align:center;">
        <img src="${E.getPokemonCardImageSrc(150, false, false)}" style="width:88px;height:88px;"/>
        <h3 style="color:#1c7c74;">[BOSS] Raid Lendária: Mewtwo (CP 3850)</h3>
        <p style="font-size:12px;color:#527a80;margin:6px 0 10px;">Lute ao vivo em ASCII 3D e capture o Boss com IV 10-15!</p>
        <button class="pogo-pill-btn" style="width:100%;"
          onclick="window.PokeGameUI.startLiveBattle('RAID', 150, 3850, '[BOSS] Raid Lendária Mewtwo', 65, 1600, true)">
          ENTRAR NA RAID AO VIVO
        </button>
      </div>

      <div class="pogo-white-card" style="text-align:center;">
        <h3 style="color:#254a52;">[GYM] Ginásio Municipal</h3>
        <p style="font-size:12px;color:#527a80;margin:6px 0 10px;">Defenda sua Equipe e receba +50 PokéCoins gratuitas!</p>
        <button class="pogo-pill-btn" style="width:100%;"
          onclick="window.PokeGameUI.startLiveBattle('GYM', 149, 2100, '[GYM] Ginásio Municipal', 50, 900, false)">
          BATALHAR NO GINÁSIO AO VIVO
        </button>
      </div>

      <div class="pogo-white-card" style="text-align:center;">
        <h3 style="color:#7e22ce;">[VILAO] Líder Vilão Equipe Cyber</h3>
        <p style="font-size:12px;color:#527a80;margin:6px 0 10px;">Resgate Pokémons e ganhe Stardust extra!</p>
        <button class="pogo-pill-btn" style="width:100%;"
          onclick="window.PokeGameUI.startLiveBattle('VILLAIN', 94, 1850, '[VILAO] Líder Cyber Rocket', 40, 1000, false)">
          DUELAR CONTRA VILÃO AO VIVO
        </button>
      </div>
    `);
  }

  function showTrainerProfileModal() {
    const p = window.PokeStorage.getProfile();
    const cfg = window.PokeBalance.get();
    const rareMult = window.PokeData.calculateRareProgressMultiplier(p, cfg).toFixed(2);
    const buddy = p.pokemonBox.find(m => m.uid === p.buddyUid) || p.pokemonBox[0];

    openModal(`${p.trainerName} (NÍVEL ${p.level})`, `
      <div class="pogo-white-card" style="text-align:center;">
        <div style="font-size:48px;">${p.gender === "F" ? "[F]" : "[M]"}</div>
        <h3 style="color:#1c7c74;">Equipe ${p.avatar.team} • Prestígio #${p.prestigeRank || 0}</h3>
        <div class="stat-capsules-row">
          <div><div class="stat-cap-val">${(p.distanceWalkedM / 1000).toFixed(2)}km</div><div class="stat-cap-lbl">WALKED</div></div>
          <div><div class="stat-cap-val">${p.stats.totalCaught}</div><div class="stat-cap-lbl">CAUGHT</div></div>
          <div><div class="stat-cap-val">${rareMult}x</div><div class="stat-cap-lbl">RARE BOOST</div></div>
        </div>
        ${buddy ? `
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;background:#eef8f4;padding:10px;border-radius:14px;">
            <img src="${E.getPokemonCardImageSrc(buddy.speciesId, false, buddy.isShiny)}" style="width:52px;height:52px;"/>
            <div style="text-align:left;">
              <div style="font-weight:800;font-size:13px;">Parceiro: ${buddy.name} (CP ${buddy.cp})</div>
              <div style="font-size:11px;color:#1c7c74;">Progresso Candy: ${Math.round(p.buddyWalkProgressM)}m / ${cfg.buddyDistancePerCandyM}m</div>
            </div>
          </div>
        ` : ""}
      </div>
    `);
  }

  function triggerAnomalyScanner() {
    const p = window.PokeStorage.getProfile();
    if ((p.anomalyCharge || 0) < 100) {
      window.PokeStorage.showToast(`[SCAN] Scanner de Anomalia em ${p.anomalyCharge || 0}%! Capture Pokémons para carregar 100%!`, "info");
      return;
    }
    p.anomalyCharge = 0;
    const cfg = Object.assign({}, window.PokeBalance.get(), {
      rareSpawnMultiplier: 14.0,
      shinyProbability: 0.08,
      wildIvFloor: 12
    });
    wildMon = window.PokeData.rollWeightedSpawn(cfg, p.level + 5, p);
    E.getPokemonMesh(wildMon.speciesId, wildMon.isShiny);
    window.PokeStorage.save();
    closeRadialMenu();
    closeModal();
    toggleSceneMode("AR_CAPTURE");
    window.PokeAudio.playGotchaFanfare();
    window.PokeStorage.showToast(` ANOMALIA RARA ATIVADA! Um ${wildMon.name} (IV ${wildMon.ivPercent}%) surgiu em ASCII 3D!`, "warn");
  }

  function resetTutorialsAndGuides() {
    const p = window.PokeStorage.getProfile();
    p.seenGuides = {};
    p.starterChosen = false;
    cityState.pikachuEasterEggTriggered = false;
    spawnStarterTutorialTrioOnMap();
    window.PokeStorage.save();
    closeModal();
    maybeShowScreenGuide("MAP_WELCOME", true);
    window.PokeStorage.showToast("[PROF] Tutoriais do Professor Willow e os 3 Iniciais + Easter Egg do Pikachu foram reativados no Mapa!", "success");
  }

  function showSystemAndCrowdfundingModal() {
    openModal("SETTINGS & CROWDFUNDING", `
      <div class="pogo-white-card">
        <h4 style="color:#1c7c74;margin-bottom:8px;"> Áudio, Navegação GPS/Joystick & Tutoriais</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="pogo-pill-btn" onclick="window.PokeAudio.toggleSound()"> Som ON/OFF</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeAudio.toggleBgm()"> Música BGM</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.toggleNavModeOrResyncGps()">[GPS]/[JOY] Alternar GPS Live / Joystick</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.resetTutorialsAndGuides()">[PROF] Rever Tutoriais & Iniciais</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeStorage.exportSaveFile()"> Exportar Save</button>
          <button class="pogo-pill-btn secondary" onclick="document.getElementById('import-file-inp').click()"> Importar Save</button>
          <a href="admin.html" target="_blank" class="pogo-pill-btn secondary" style="text-decoration:none;"> Painel Admin</a>
        </div>
      </div>

      <div class="pogo-white-card">
        <h4 style="color:#1c7c74;margin-bottom:6px;">[VILAO] Crowdfunding & Créditos Open-Source (MIT)</h4>
        <p style="font-size:12px;color:#527a80;line-height:1.45;">
          Projeto educacional 100% gratuito e sem fins lucrativos.<br/>
          • <b>Meta 1:</b> Engine 3D G-Buffer/Sobel 100% ASCII + Mapa GPS OpenStreetMap (Concluído!)<br/>
          • <b>Meta 2:</b> Servidor Multiplayer WebSocket Global (PvP e Trocas ao vivo)<br/>
          • <b>Créditos:</b> Pokémon  Nintendo/Creatures Inc./GAME FREAK • Ruas  OpenStreetMap contributors • Sprites 3D Voxelizados  PokéAPI.
        </p>
      </div>
    `);
  }

  function finishCharacterCreation() {
    const p = window.PokeStorage.getProfile();
    p.trainerName = (document.getElementById("inp-trainer-name").value || "AshASCII").trim();
    p.gender = document.getElementById("inp-gender").value;
    p.avatar.skinColor = document.getElementById("inp-skin").value;
    p.avatar.outfitColor = document.getElementById("inp-outfit").value;
    p.avatar.team = document.getElementById("inp-team").value;
    p.created = true;
    window.PokeStorage.save();

    document.getElementById("onboarding-screen").style.display = "none";
    window.PokeAudio.init();
    window.PokeAudio.playGotchaFanfare();
    spawnStarterTutorialTrioOnMap();
    updateHud();
    startRealGpsTracking(false);
    maybeShowScreenGuide("MAP_WELCOME", true);
  }

  // ============================================================================
  // LOOP PRINCIPAL DE ANIMAÇÃO 60 FPS (100% PURE 3D G-BUFFER ASCII!)
  // ============================================================================
  let lastFrameTime = performance.now();
  function mainLoop(now) {
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    fpsFrames++;
    if (now - fpsLastTime >= 1000) {
      currentFps = fpsFrames;
      fpsFrames = 0;
      fpsLastTime = now;
      if (currentFps < 26 && qualityTier > 1) {
        qualityTier--;
        resizeViewport();
      }
    }

    const timeSec = now * 0.001;
    // Watchdog contínuo de cena: impede travamento caso batalha/evolução/captura encerre fora de ordem
    if (
      (gameScene === "LIVE_BATTLE" && !liveBattle.active) ||
      (gameScene === "EVOLUTION_CUTSCENE" && !evoScene.active) ||
      (gameScene === "AR_CAPTURE" && (!wildMon || ball.state === 4))
    ) {
      gameScene = "CITY_MAP";
      syncSceneHudVisibility();
    }
    updateCityMovement(dt);
    updatePokeballPhysics(dt);

    // 100% PURE 3D G-BUFFER ASCII RENDERING PIPELINE EM TODAS AS CENAS!
    rasterize3DScene(timeSec);
    renderAsciiCanvas(timeSec);

    requestAnimationFrame(mainLoop);
  }

  async function init() {
    canvas = document.getElementById("ascii-canvas");
    ctx = canvas.getContext("2d", { alpha: false });
    videoEl = document.getElementById("cam-video");

    sampleCanvas = document.createElement("canvas");
    sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

    resizeViewport();
    window.addEventListener("resize", resizeViewport);
    try {
      applyAsciiUiModeState(localStorage.getItem("pokeascii_ui_mode_v1") === "1");
    } catch (_) {}

    await window.PokeStorage.initAndLoad();
    const p = window.PokeStorage.getProfile();
    if (!p.created) {
      document.getElementById("onboarding-screen").style.display = "flex";
    }

    const fileInp = document.getElementById("import-file-inp");
    if (fileInp) {
      fileInp.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (window.PokeStorage.importSaveJson(reader.result)) {
            updateHud();
            closeModal();
          }
        };
        reader.readAsText(f);
      });
    }

    initCityEntities();
    spawnWildPokemon(25);
    bindInputEvents();
    updateHud();
    startRealGpsTracking(false);
    if (p.created) {
      maybeShowScreenGuide("MAP_WELCOME");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    requestAnimationFrame(mainLoop);
  }

  window.addEventListener("DOMContentLoaded", init);

  return {
    toggleRealCamera,
    toggleSceneMode,
    cycleAsciiDetailTier,
    toggleAsciiUiMode,
    adjustZoom,
    startRealGpsTracking,
    toggleNavModeOrResyncGps,
    maybeShowScreenGuide,
    resetTutorialsAndGuides,
    openRadialMenu,
    closeRadialMenu,
    startWildEncounterFromMap,
    spawnWildPokemon,
    startLiveBattle,
    triggerPlayerAttack,
    triggerBattleDodge,
    triggerBattleShield,
    fleeLiveBattle,
    startEvolutionCutscene,
    showPokemonBoxModal,
    incubateEgg,
    showPokemonDetailSheet,
    powerUpPokemon,
    evolvePokemon,
    setBuddy,
    showPokedexModal,
    showNearbyTrackerModal,
    showBagModal,
    useItem,
    showShopModal,
    buyShopItem,
    showBattleHubModal,
    showGymDetailModal,
    spinGymPhotoDisc,
    feedGymDefenderBerry,
    placePokemonInGym,
    conquerOrTrainGym,
    showBattlePassModal,
    claimResearchTask,
    claimBreakthroughBox,
    advanceSpecialResearch,
    claimPassTier,
    showTrainerProfileModal,
    triggerAnomalyScanner,
    showSystemAndCrowdfundingModal,
    finishCharacterCreation,
    closeModal
  };
})();
