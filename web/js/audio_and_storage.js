"use strict";

// ============================================================================
// MOTOR DE ÁUDIO WEBAUDIO PROCEDURAL (ZERO ASSETS) + SALVAMENTO RESILIENTE
// (IndexedDB + localStorage + StorageManager Persist + Export/Import + Cloud Sync)
// ============================================================================

window.PokeAudio = (function() {
  let ctx = null;
  let enabled = true;
  let bgmTimer = null;
  let bgmPlaying = false;

  function init() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function playTone(freqStart, freqEnd, durationSec, type = "sine", gainVal = 0.14, delaySec = 0) {
    if (!enabled) return;
    init();
    if (!ctx) return;

    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart), t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + durationSec);
    }

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(gainVal, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  // Sintetiza o grito único (Cry) de qualquer Pokémon (1..1025) baseado em seu ID, peso e tipo
  function playPokemonCry(speciesId) {
    const sp = window.PokeData ? window.PokeData.getSpecies(speciesId) : { id: 25, weight_kg: 6 };
    const baseFreq = Math.max(140, Math.min(880, 620 - sp.weight_kg * 2.2 + ((speciesId * 37) % 240)));
    playTone(baseFreq, baseFreq * 1.38, 0.14, "sawtooth", 0.12, 0.0);
    playTone(baseFreq * 1.35, baseFreq * 0.82, 0.18, "triangle", 0.14, 0.12);
    playTone(baseFreq * 1.15, baseFreq * 1.48, 0.16, "square", 0.09, 0.28);
  }

  function playCurveballSpin(rpmFactor) {
    const f = 240 + Math.min(600, rpmFactor * 380);
    playTone(f, f * 1.18, 0.07, "sine", 0.06, 0);
  }

  function playThrow() {
    playTone(220, 680, 0.18, "sine", 0.15, 0);
    playTone(540, 180, 0.16, "triangle", 0.10, 0.12);
  }

  function playBallHit() {
    playTone(480, 140, 0.12, "square", 0.16, 0);
    playTone(620, 920, 0.15, "sine", 0.12, 0.08);
  }

  function playBallShake(shakeNum) {
    const f = 320 + shakeNum * 75;
    playTone(f, f * 1.12, 0.11, "triangle", 0.13, 0);
  }

  function playGotchaFanfare() {
    // Clássica fanfarra de captura em 4 notas!
    playTone(523.25, 523.25, 0.13, "square", 0.14, 0.00); // C5
    playTone(523.25, 523.25, 0.13, "square", 0.14, 0.14); // C5
    playTone(523.25, 523.25, 0.13, "square", 0.14, 0.28); // C5
    playTone(659.25, 783.99, 0.45, "triangle", 0.18, 0.42); // E5 -> G5
  }

  function playBreakout() {
    playTone(440, 150, 0.28, "sawtooth", 0.16, 0);
  }

  function playUiClick() {
    playTone(720, 960, 0.05, "sine", 0.08, 0);
  }

  function playTransitionShutter() {
    playTone(300, 740, 0.14, "sine", 0.10, 0);
    playTone(740, 420, 0.12, "triangle", 0.08, 0.10);
  }

  function playBerryFeed() {
    playTone(520, 680, 0.09, "sine", 0.11, 0);
    playTone(680, 920, 0.14, "triangle", 0.12, 0.09);
  }

  function playAttack(isCharged = false) {
    if (isCharged) {
      playTone(180, 880, 0.25, "sawtooth", 0.18, 0);
      playTone(880, 110, 0.35, "square", 0.20, 0.22);
    } else {
      playTone(360, 140, 0.09, "triangle", 0.14, 0);
    }
  }

  function toggleSound() {
    enabled = !enabled;
    if (!enabled && bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
      bgmPlaying = false;
    }
    if (enabled) playUiClick();
    return enabled;
  }

  function toggleBgm() {
    if (bgmPlaying) {
      clearInterval(bgmTimer);
      bgmTimer = null;
      bgmPlaying = false;
      return false;
    }
    enabled = true;
    init();
    bgmPlaying = true;
    const notes = [261.6, 329.6, 392.0, 523.2, 392.0, 329.6, 293.7, 349.2, 440.0, 587.3, 440.0, 349.2];
    let step = 0;
    bgmTimer = setInterval(() => {
      if (!enabled || !bgmPlaying) return;
      const n = notes[step % notes.length];
      playTone(n, n * 1.01, 0.22, "triangle", 0.045, 0);
      step++;
    }, 280);
    return true;
  }

  return {
    init,
    playPokemonCry,
    playCurveballSpin,
    playThrow,
    playBallHit,
    playBallShake,
    playGotchaFanfare,
    playBreakout,
    playUiClick,
    playTransitionShutter,
    playBerryFeed,
    playAttack,
    toggleSound,
    toggleBgm,
    isEnabled: () => enabled
  };
})();

// ============================================================================
// CONFIGURAÇÃO DE BALANCEAMENTO GLOBAL (EDITÁVEL EM TEMPO REAL NO ADMIN.HTML)
// ============================================================================
window.PokeBalance = (function() {
  const STORAGE_KEY = "pokeascii_balance_config_v2";
  const DEFAULT_CONFIG = {
    activeDexLimit: 151,          // 151 (Kanto) até 1025 (Todas as Gerações 1..9)
    rareSpawnMultiplier: 1.0,     // Multiplicador de peso para Pokémons raros/lendários
    shinyProbability: 0.004,      // ~1/250 chance base de Shiny
    wildIvFloor: 0,               // Piso de IV para Pokémons selvagens (0..15)
    raidIvFloor: 10,              // Piso de IV para Bosses de Raid / Recompensas (10..15)
    catchRateMultiplier: 1.15,    // Multiplicador global de facilidade de captura
    curveballBonusMult: 1.70,     // Bônus de captura ao girar a Pokébola (Curveball)
    niceThrowMult: 1.15,
    greatThrowMult: 1.50,
    excellentThrowMult: 1.85,
    xpMultiplier: 1.0,
    stardustMultiplier: 1.0,
    candyMultiplier: 1.0,
    battlePassXpPerTier: 1000,
    maxPokemonLevelCap: 50,       // Limite anti-quebra para manter equilíbrio em PvP/Raids
    buddyDistancePerCandyM: 250,  // Metros caminhados no mapa para o Parceiro achar 1 Candy
    gymCoinReward: 50,
    raidBossHpMultiplier: 1.0
  };

  let current = Object.assign({}, DEFAULT_CONFIG);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        current = Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
      }
    } catch (_) {}
    return current;
  }

  function save(newCfg) {
    current = Object.assign({}, DEFAULT_CONFIG, newCfg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (_) {}
    // Tenta publicar no servidor externo se estiver rodando com backend
    fetch("/api/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current)
    }).catch(() => {});
    return current;
  }

  function reset() {
    return save(DEFAULT_CONFIG);
  }

  load();
  return { get: () => current, load, save, reset, DEFAULT_CONFIG };
})();

// ============================================================================
// SISTEMA DE SALVAMENTO RESILIENTE (INDEXEDDB + LOCALSTORAGE + CLOUD + ARQUIVO)
// ============================================================================
window.PokeStorage = (function() {
  const SAVE_KEY = "pokeascii_player_save_v2";
  const IDB_NAME = "PokeAsciiResilientDB";
  const IDB_STORE = "saves";

  function createDefaultProfile() {
    const starter = window.PokeData.rollWeightedSpawn(window.PokeBalance.get(), 5);
    starter.speciesId = 25;
    starter.name = "Pikachu";
    starter.ivAtk = 14; starter.ivDef = 14; starter.ivSta = 15;
    starter.level = 8;
    starter.cp = window.PokeData.calculateCP(25, 8, 14, 14, 15);
    starter.maxHp = window.PokeData.calculateMaxHP(25, 8, 15);
    starter.hp = starter.maxHp;

    return {
      version: 2,
      created: false,
      trainerName: "Treinador",
      gender: "M", // "M" (Homem) ou "F" (Mulher)
      avatar: {
        skinColor: "#f5c6a5",
        hairColor: "#261c14",
        outfitColor: "#e62e2e",
        hatStyle: "visor_ar",
        team: "Trovão" // Chama, Trovão, Maré
      },
      level: 1,
      xp: 0,
      prestigeRank: 0, // Progressão infinita sem quebrar o nível máximo 50 de combate
      stardust: 2500,
      pokecoins: 150,  // Moeda 100% gratuita ganha em Ginásios, Raids e Passe de Batalha
      distanceWalkedM: 0,
      buddyWalkProgressM: 0,
      buddyUid: starter.uid,
      battlePassXp: 0,
      battlePassClaimed: [],
      bag: {
        poke_ball: 35,
        great_ball: 10,
        ultra_ball: 5,
        master_ball: 1,
        razz_berry: 12,
        nanab_berry: 8,
        pinap_berry: 8,
        golden_razz: 3,
        potion: 10,
        hyper_potion: 5,
        max_revive: 3,
        incense: 2,
        lucky_egg: 1,
        star_piece: 1,
        rare_candy: 3,
        evo_stone: 2,
        charged_tm: 2,
        raid_pass: 3
      },
      candies: { 25: 30, 1: 25, 4: 25, 7: 25, 92: 25, 133: 25 },
      pokedexCaught: { 25: 1 },
      typeCounts: { Electric: 1 },
      anomalyCharge: 40,
      pokemonBox: [starter],
      eggs: [
        { id: "egg_1", kmRequired: 2.0, kmWalked: 0.45, incubating: true },
        { id: "egg_2", kmRequired: 5.0, kmWalked: 0.0, incubating: false },
        { id: "egg_3", kmRequired: 10.0, kmWalked: 0.0, incubating: false }
      ],
      researchStamps: 3,
      specialResearchStage: 1,
      starterChosen: false,
      starterWalkAwayCount: 0,
      dailyDefenderCoinsEarned: 0,
      seenGuides: {},
      tasksProgress: {
        caught: 1,
        throws: 0,
        spins: 0,
        raids: 0,
        berries: 0,
        walkedM: 0,
        claimedIds: []
      },
      stats: {
        totalCaught: 1,
        curveballsLanded: 0,
        excellentThrows: 0,
        gymsWon: 0,
        raidsWon: 0,
        villainsDefeated: 0
      },
      lastSavedAt: Date.now()
    };
  }

  let profile = createDefaultProfile();
  let idbInstance = null;

  // Solicita ao navegador armazenamento persistente para não apagar o cache automaticamente
  async function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }
    } catch (_) {}
  }

  function openIdb() {
    return new Promise((resolve) => {
      if (idbInstance) return resolve(idbInstance);
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = (e) => {
        idbInstance = e.target.result;
        resolve(idbInstance);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function initAndLoad() {
    requestPersistentStorage();
    let loaded = null;

    // 1. Tenta carregar do localStorage
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (_) {}

    // 2. Tenta carregar do IndexedDB (se o localStorage foi limpo ou se o IDB for mais recente)
    try {
      const db = await openIdb();
      if (db) {
        const idbData = await new Promise((resolve) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const getReq = tx.objectStore(IDB_STORE).get("primary");
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        });
        if (idbData && (!loaded || (idbData.lastSavedAt || 0) > (loaded.lastSavedAt || 0))) {
          loaded = idbData;
        }
      }
    } catch (_) {}

    if (loaded) {
      const def = createDefaultProfile();
      profile = Object.assign(def, loaded);
      profile.bag = Object.assign(def.bag, loaded.bag || {});
      profile.avatar = Object.assign(def.avatar, loaded.avatar || {});
      profile.stats = Object.assign(def.stats, loaded.stats || {});
      profile.tasksProgress = Object.assign(def.tasksProgress, loaded.tasksProgress || {});
      profile.seenGuides = Object.assign({}, loaded.seenGuides || {});
      if (!Array.isArray(profile.eggs) || profile.eggs.length === 0) {
        profile.eggs = def.eggs;
      }
    }
    return profile;
  }

  async function save() {
    profile.lastSavedAt = Date.now();
    const json = JSON.stringify(profile);

    try {
      localStorage.setItem(SAVE_KEY, json);
    } catch (_) {}

    try {
      const db = await openIdb();
      if (db) {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(profile, "primary");
      }
    } catch (_) {}

    // Sincronização opcional com servidor externo
    if (profile.created) {
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json
      }).catch(() => {});
    }
  }

  // Adiciona XP com Progressão Infinita (Níveis 1..50 + Ranks de Prestígio Infinitos)
  function addXp(amount) {
    const mult = window.PokeBalance.get().xpMultiplier || 1.0;
    const gain = Math.round(amount * mult);
    profile.xp += gain;
    profile.battlePassXp += gain;

    const xpNeeded = profile.level < 50 ? (profile.level * 1200) : 65000;
    if (profile.xp >= xpNeeded) {
      profile.xp -= xpNeeded;
      if (profile.level < 50) {
        profile.level++;
        profile.pokecoins += 25;
        profile.bag.ultra_ball = (profile.bag.ultra_ball || 0) + 3;
        showToast(`🎉 LEVEL UP! Você alcançou o Nível ${profile.level} (+25 PokéCoins + 3 Ultra Balls)!`, "success");
      } else {
        profile.prestigeRank++;
        profile.pokecoins += 50;
        profile.stardust += 2000;
        showToast(`👑 PRESTÍGIO INFINITO #${profile.prestigeRank}! (+50 PokéCoins + 2.000 Stardust)!`, "success");
      }
    }
    save();
    return gain;
  }

  function exportSaveFile() {
    save();
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokeascii_save_${profile.trainerName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("💾 Arquivo de Save exportado com sucesso!", "success");
  }

  function importSaveJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !parsed.pokemonBox) throw new Error("Formato inválido");
      profile = Object.assign(createDefaultProfile(), parsed);
      save();
      showToast("✅ Progresso restaurado com sucesso!", "success");
      return true;
    } catch (e) {
      showToast("❌ Erro ao importar save: " + e.message, "error");
      return false;
    }
  }

  // Sistema de Notificações Toast Não-Intrusivas
  function showToast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-10px)";
      setTimeout(() => el.remove(), 300);
    }, 3400);
  }

  return {
    initAndLoad,
    getProfile: () => profile,
    save,
    addXp,
    exportSaveFile,
    importSaveJson,
    showToast,
    resetProfile: () => {
      profile = createDefaultProfile();
      save();
      return profile;
    }
  };
})();
