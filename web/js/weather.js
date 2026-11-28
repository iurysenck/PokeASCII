"use strict";

// ============================================================================
// SISTEMA DE CLIMA — clima real do local do jogador (Open-Meteo, sem chave) + visual ASCII
// - Busca o clima atual (WMO weather_code, nuvens, vento, nascer/pôr do sol) e cacheia 15 min.
// - Privacidade: as coordenadas são ARREDONDADAS a 2 casas (~1 km) antes de sair do aparelho;
//   nenhum identificador é enviado. Dados: Open-Meteo.com (CC BY 4.0).
// - Sem rede/GPS: cai para o relógio do aparelho (dia/noite) e céu limpo.
// - Expõe `visual` (cores de céu/névoa, nuvens, precipitação, relâmpago) lido pelo renderer
//   e `spawnMult(types)` (tipos favorecidos pelo clima, como no jogo de referência).
// ============================================================================

window.PokeWeather = (function () {
  const API = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "pokeascii_weather_v1";
  const TTL_MS = 15 * 60 * 1000;
  const RETRY_MS = [60000, 180000, 600000];
  const SPAWN_MULT = 1.8;
  const WINDY_KMH = 32;

  const KINDS = ["clear", "partly", "overcast", "fog", "drizzle", "rain", "storm", "snow"];
  const LABELS_PT = {
    clear: "Céu limpo", partly: "Parcialmente nublado", overcast: "Nublado", fog: "Neblina",
    drizzle: "Garoa", rain: "Chuva", storm: "Tempestade", snow: "Neve"
  };
  const SPAWN_TYPES = {
    clear: ["Grass", "Ground", "Fire"],
    partly: ["Normal", "Rock"],
    overcast: ["Fairy", "Fighting", "Poison"],
    fog: ["Dark", "Ghost"],
    drizzle: ["Water", "Electric", "Bug"],
    rain: ["Water", "Electric", "Bug"],
    storm: ["Water", "Electric", "Bug"],
    snow: ["Ice", "Steel"]
  };
  const WINDY_TYPES = ["Dragon", "Flying", "Psychic"];

  // Por tipo de clima: [cinza (dessaturação), brilho do céu, névoa extra, escurecimento do chão, luz das entidades]
  const WX_LOOK = {
    clear:    { gray: 0.00, bright: 1.00, fog: 0.000, ground: 1.00, light: 1.00 },
    partly:   { gray: 0.15, bright: 0.97, fog: 0.002, ground: 1.00, light: 0.98 },
    overcast: { gray: 0.60, bright: 0.85, fog: 0.004, ground: 0.94, light: 0.93 },
    fog:      { gray: 0.70, bright: 0.90, fog: 0.050, ground: 0.95, light: 0.92 },
    drizzle:  { gray: 0.65, bright: 0.80, fog: 0.012, ground: 0.92, light: 0.90 },
    rain:     { gray: 0.80, bright: 0.68, fog: 0.020, ground: 0.88, light: 0.85 },
    storm:    { gray: 0.90, bright: 0.50, fog: 0.028, ground: 0.84, light: 0.80 },
    snow:     { gray: 0.60, bright: 0.88, fog: 0.025, ground: 1.02, light: 0.96 }
  };

  const NIGHT = { zen: [0.015, 0.03, 0.12], hor: [0.07, 0.09, 0.24], cloud: [0.10, 0.12, 0.20] };
  const DUSK  = { zen: [0.14, 0.22, 0.52],  hor: [0.78, 0.48, 0.56], cloud: [0.70, 0.45, 0.50] };
  const DAY   = { zen: [0.16, 0.42, 0.88],  hor: [0.62, 0.80, 0.96], cloud: [0.97, 0.97, 1.00] };
  const FOG_BASE = [0.22, 0.24, 0.44];

  const state = {
    kind: "clear", realKind: "clear", code: 0, tempC: null, cloud: 0.05, cover: 0.05, windKmh: 0, windDir: 0, intensity: 0,
    isDay: true, sunriseMs: null, sunsetMs: null, utcOffsetSec: null,
    source: "device", updatedAt: 0, lat: null, lon: null, label: LABELS_PT.clear
  };

  // Lido pelo renderer a cada frame (objeto reaproveitado: zero alocação por frame)
  const visual = {
    zenith: new Float32Array(3), horizon: new Float32Array(3), cloudCol: new Float32Array(3),
    fogCol: new Float32Array(3), cover: 0.05, starAmt: 1, fogK: 0.015, groundMul: 1, lightMul: 1,
    snowAmt: 0, dayFactor: 1, cloudScrollX: 0, cloudScrollZ: 0, motion: 1, // motion: 1 normal, 0.25 com prefers-reduced-motion
    precip: 0, precipDens: 0, precipSlant: 0, precipLen: 3, // precip: 0 nenhuma, 1 chuva, 2 neve, 3 garoa
    flash: 0
  };

  let override = null;
  let reducedMotion = false;
  try {
    const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (mq) {
      reducedMotion = Boolean(mq.matches);
      const onMq = (e) => { reducedMotion = Boolean(e.matches); visual.motion = reducedMotion ? 0.25 : 1; };
      if (mq.addEventListener) mq.addEventListener("change", onMq);
    }
  } catch (_) {}
  visual.motion = reducedMotion ? 0.25 : 1;
  let optOut = false;
  try { optOut = localStorage.getItem("pokeascii_weather_optout") === "1"; } catch (_) {}
  const listeners = [];
  let retryIdx = 0, retryTimer = null, inflight = false, pendingForce = false;
  const MAX_STALE_MS = 3 * 60 * 60 * 1000;
  let lastDayCalcAt = 0, nextFlashAt = 0, flashPulse2At = 0, flashTarget = 0, lastTickSec = 0;
  let scrollX = 0, scrollZ = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function mix3(out, a, b, t) { for (let i = 0; i < 3; ++i) out[i] = a[i] + (b[i] - a[i]) * t; }

  // Código WMO (Open-Meteo) -> tipo + intensidade 0..1 + cobertura de nuvens 0..1
  function classify(code, cloudPct) {
    const cloud = clamp(cloudPct / 100, 0.04, 0.98);
    switch (code) {
      case 0: case 1: return { kind: cloud >= 0.7 ? "overcast" : (cloud >= 0.3 ? "partly" : "clear"), intensity: 0, cover: cloud };
      case 2: return { kind: cloud >= 0.75 ? "overcast" : "partly", intensity: 0, cover: Math.max(0.35, cloud) };
      case 3: return { kind: "overcast", intensity: 0, cover: Math.max(0.85, cloud) };
      case 45: case 48: return { kind: "fog", intensity: 0.7, cover: 0.8 };
      case 51: return { kind: "drizzle", intensity: 0.25, cover: 0.85 };
      case 53: case 56: return { kind: "drizzle", intensity: 0.4, cover: 0.88 };
      case 55: case 57: return { kind: "drizzle", intensity: 0.6, cover: 0.9 };
      case 61: case 80: return { kind: "rain", intensity: 0.45, cover: 0.88 };
      case 63: case 81: case 66: return { kind: "rain", intensity: 0.75, cover: 0.92 };
      case 65: case 82: case 67: return { kind: "rain", intensity: 1.0, cover: 0.96 };
      case 71: case 77: return { kind: "snow", intensity: 0.35, cover: 0.88 };
      case 73: case 85: return { kind: "snow", intensity: 0.65, cover: 0.92 };
      case 75: case 86: return { kind: "snow", intensity: 1.0, cover: 0.96 };
      case 95: case 96: case 99: return { kind: "storm", intensity: 1.0, cover: 1.0 };
      default: return { kind: "clear", intensity: 0, cover: cloud };
    }
  }

  // "2026-11-28T05:28" (horário local do lugar) -> ms tratando como UTC "ingênuo"
  function parseLocalIso(str) {
    if (typeof str !== "string") return null;
    const ms = Date.parse(str.length === 16 ? str + ":00Z" : (/Z$/.test(str) ? str : str + "Z"));
    return Number.isFinite(ms) ? ms : null;
  }

  let dayOverride = null; // 0..1 para testes/simulação (null = hora real do local)

  const DAY_MS = 86400000;
  const timeOfDay = (ms) => ((ms % DAY_MS) + DAY_MS) % DAY_MS;

  // Compara a HORA DO DIA (não a data absoluta): nascer/pôr do sol de ontem continuam válidos (±minutos)
  // se o app ficou aberto/offline após a meia-noite.
  function computeDayFactor(nowMs) {
    if (dayOverride !== null) return dayOverride;
    if (state.sunriseMs !== null && state.sunsetMs !== null && state.utcOffsetSec !== null) {
      const rise0 = timeOfDay(state.sunriseMs), set0 = timeOfDay(state.sunsetMs);
      if (rise0 < set0) {
        const local = timeOfDay(nowMs + state.utcOffsetSec * 1000);
        const rise = smooth((local - (rise0 - 30 * 60e3)) / (60 * 60e3));
        const set = smooth((local - (set0 - 30 * 60e3)) / (60 * 60e3));
        return clamp(rise - set, 0, 1);
      }
    }
    const d = new Date(nowMs);
    const h = d.getHours() + d.getMinutes() / 60;
    return clamp(smooth((h - 5.5) / 1.0) - smooth((h - 17.5) / 1.0), 0, 1);
  }

  const tmpA = new Float32Array(3);

  function recomputeVisual(dayF) {
    const look = WX_LOOK[state.kind] || WX_LOOK.clear;
    const i = state.intensity;
    visual.dayFactor = dayF;
    visual.cover = clamp(state.cover, 0.03, 1);

    // céu: noite -> crepúsculo -> dia
    if (dayF < 0.5) {
      mix3(visual.zenith, NIGHT.zen, DUSK.zen, dayF * 2);
      mix3(visual.horizon, NIGHT.hor, DUSK.hor, dayF * 2);
      mix3(visual.cloudCol, NIGHT.cloud, DUSK.cloud, dayF * 2);
    } else {
      mix3(visual.zenith, DUSK.zen, DAY.zen, (dayF - 0.5) * 2);
      mix3(visual.horizon, DUSK.hor, DAY.hor, (dayF - 0.5) * 2);
      mix3(visual.cloudCol, DUSK.cloud, DAY.cloud, (dayF - 0.5) * 2);
    }
    if (state.kind === "fog") {
      tmpA[0] = tmpA[1] = tmpA[2] = 0.30 + 0.45 * dayF;
      mix3(visual.horizon, visual.horizon, tmpA, 0.7);
    }
    const desat = (c) => {
      const gray = (c[0] + c[1] + c[2]) / 3;
      for (let k = 0; k < 3; ++k) c[k] = (gray + (c[k] - gray) * (1 - look.gray)) * look.bright;
    };
    desat(visual.zenith);
    desat(visual.horizon);
    for (let k = 0; k < 3; ++k) visual.cloudCol[k] *= 0.55 + 0.45 * look.bright;

    // névoa: cor do horizonte misturada com a base do jogo
    for (let k = 0; k < 3; ++k) {
      visual.fogCol[k] = visual.horizon[k] * 0.75 + FOG_BASE[k] * 0.25 * (0.4 + 0.6 * (1 - dayF));
    }
    visual.fogK = 0.015 + look.fog * (state.kind === "fog" ? 1 : (0.5 + 0.5 * i));

    visual.groundMul = (0.80 + 0.30 * dayF) * look.ground;
    visual.lightMul = (0.80 + 0.22 * dayF) * look.light;
    visual.snowAmt = state.kind === "snow" ? 0.25 + 0.35 * i : 0;
    visual.starAmt = Math.pow(1 - dayF, 1.5) * (1 - clamp(visual.cover * 1.1, 0, 1));

    // precipitação (sobreposição em células)
    const windy = clamp(state.windKmh / 60, 0, 1);
    const sign = Math.sin(state.windDir * Math.PI / 180) >= 0 ? 1 : -1;
    visual.precipSlant = (state.kind === "storm" ? 0.30 : 0.12 * windy + 0.04) * sign * (state.kind === "snow" ? 0.4 : 1);
    switch (state.kind) {
      case "drizzle": visual.precip = 3; visual.precipDens = 0.05 + 0.07 * i; visual.precipLen = 2; break;
      case "rain": visual.precip = 1; visual.precipDens = 0.08 + 0.14 * i; visual.precipLen = 3; break;
      case "storm": visual.precip = 1; visual.precipDens = 0.24; visual.precipLen = 4; break;
      case "snow": visual.precip = 2; visual.precipDens = 0.05 + 0.10 * i; visual.precipLen = 1; break;
      default: visual.precip = 0; visual.precipDens = 0; visual.precipLen = 0;
    }
  }

  // Em modo simulado usa intensidade/nuvens típicas do tipo escolhido
  function applyOverrideShape() {
    if (!override) return;
    const sim = {
      clear: [0, 0.05], partly: [0, 0.45], overcast: [0, 0.9], fog: [0.7, 0.8],
      drizzle: [0.5, 0.88], rain: [0.8, 0.92], storm: [1, 1], snow: [0.8, 0.92]
    }[override];
    state.kind = override;
    state.intensity = sim[0];
    state.cover = sim[1];
    state.label = LABELS_PT[override];
  }

  function describe() {
    const t = state.tempC === null ? "" : ` ${Math.round(state.tempC)}°C`;
    const sim = override ? " (simulado)" : (state.isDefaultLoc ? " (local padrão: GPS off)" : "");
    return {
      kind: state.kind, label: state.label, tempC: state.tempC,
      text: `[CLIMA] ${state.label}${t}${sim}`, source: state.source, simulated: Boolean(override)
    };
  }

  function fireChange() {
    const d = describe();
    for (const cb of listeners) { try { cb(d); } catch (_) {} }
  }

  function applyData(d, source) {
    const cls = classify(d.code, d.cloud);
    state.code = d.code;
    state.tempC = d.tempC;
    state.windKmh = d.windKmh;
    state.windDir = d.windDir;
    state.isDay = d.isDay;
    state.sunriseMs = d.sunriseMs;
    state.sunsetMs = d.sunsetMs;
    state.utcOffsetSec = d.utcOffsetSec;
    state.cloud = clamp(d.cloud / 100, 0, 1);
    state.updatedAt = d.at || Date.now();
    state.source = source;
    state.realKind = cls.kind;
    if (override) {
      applyOverrideShape();
    } else {
      state.kind = cls.kind;
      state.intensity = cls.intensity;
      state.cover = cls.cover;
      state.label = LABELS_PT[cls.kind];
    }
    recomputeVisual(computeDayFactor(Date.now()));
    fireChange();
  }

  // Cache também é entrada não confiável (pode ser antigo/editado): normaliza campo a campo
  function normalizeData(d) {
    if (!d || typeof d !== "object") return null;
    const num = (v, lo, hi, dflt) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : dflt);
    const code = num(d.code, 0, 99, null);
    if (code === null) return null;
    return {
      code: Math.round(code),
      tempC: num(d.tempC, -90, 60, null),
      cloud: num(d.cloud, 0, 100, 20),
      windKmh: num(d.windKmh, 0, 400, 0),
      windDir: num(d.windDir, 0, 360, 0),
      isDay: d.isDay === true,
      sunriseMs: num(d.sunriseMs, 0, 4e12, null),
      sunsetMs: num(d.sunsetMs, 0, 4e12, null),
      utcOffsetSec: num(d.utcOffsetSec, -50400, 50400, null),
      at: num(d.at, 0, 4e12, Date.now())
    };
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || c.key !== key || typeof c.at !== "number") return null;
      const data = normalizeData(c.data);
      return data ? { key: c.key, at: c.at, data } : null;
    } catch (_) {
      return null;
    }
  }

  function writeCache(key, data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), data })); } catch (_) {}
  }

  // Valida e normaliza a resposta externa (dados não confiáveis): só números finitos e limites sãos.
  function parseResponse(json) {
    const cur = json && json.current;
    if (!cur) return null;
    const num = (v, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : null);
    const code = num(cur.weather_code, 0, 99);
    if (code === null) return null;
    const daily = json.daily || {};
    const cloud = num(cur.cloud_cover, 0, 100);
    const wind = num(cur.wind_speed_10m, 0, 400);
    const dir = num(cur.wind_direction_10m, 0, 360);
    return {
      code: Math.round(code),
      tempC: num(cur.temperature_2m, -90, 60),
      cloud: cloud === null ? 20 : cloud,
      windKmh: wind === null ? 0 : wind,
      windDir: dir === null ? 0 : dir,
      isDay: cur.is_day === 1 || cur.is_day === true,
      sunriseMs: parseLocalIso(Array.isArray(daily.sunrise) ? daily.sunrise[0] : null),
      sunsetMs: parseLocalIso(Array.isArray(daily.sunset) ? daily.sunset[0] : null),
      utcOffsetSec: num(json.utc_offset_seconds, -50400, 50400),
      at: Date.now()
    };
  }

  function scheduleRefresh(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => refresh(true), Math.max(5000, ms));
  }

  async function refresh(force) {
    if (state.lat === null || optOut) return;
    if (inflight) {
      // Um fix de GPS pode chegar durante a 1ª consulta (local padrão): refaz assim que terminar
      if (force) pendingForce = true;
      return;
    }
    const latR = state.lat, lonR = state.lon; // já arredondados a 0,01° em setLocation
    const key = `${latR.toFixed(1)},${lonR.toFixed(1)}`;
    const cached = readCache(key);
    if (!force && cached && Date.now() - cached.at < TTL_MS) {
      if (state.updatedAt !== cached.data.at) applyData(cached.data, "cache");
      scheduleRefresh(TTL_MS - (Date.now() - cached.at)); // sem isso o clima congelaria após um cache hit
      return;
    }
    inflight = true;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 8000);
    try {
      const url = `${API}?latitude=${latR.toFixed(2)}&longitude=${lonR.toFixed(2)}` +
        "&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day" +
        "&daily=sunrise,sunset&timezone=auto&forecast_days=1";
      // Sem Referer/cookies: só o IP (inevitável em qualquer requisição) e as coordenadas arredondadas saem
      const opts = { referrerPolicy: "no-referrer", credentials: "omit" };
      if (ctl) opts.signal = ctl.signal;
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = parseResponse(await res.json());
      if (!data) throw new Error("resposta inválida");
      writeCache(key, data);
      retryIdx = 0;
      applyData(data, "live");
      scheduleRefresh(TTL_MS);
    } catch (_) {
      // Dado em cache só serve se tiver menos de 3 h (senão o clima/dia de ontem apareceria hoje)
      if (cached && Date.now() - cached.at < MAX_STALE_MS && state.updatedAt !== cached.data.at) applyData(cached.data, "cache");
      scheduleRefresh(RETRY_MS[Math.min(retryIdx++, RETRY_MS.length - 1)]);
    } finally {
      clearTimeout(timer);
      inflight = false;
      if (pendingForce) { pendingForce = false; refresh(true); }
    }
  }

  function setLocation(lat, lon, isDefault) {
    state.isDefaultLoc = Boolean(isDefault);
    if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    // Guarda só a coordenada arredondada (~1 km): a posição exata do GPS nunca fica neste módulo
    const latR = Math.round(clamp(lat, -90, 90) * 100) / 100, lonR = Math.round(clamp(lon, -180, 180) * 100) / 100;
    const moved = state.lat === null || Math.abs(latR - state.lat) > 0.1 || Math.abs(lonR - state.lon) > 0.1;
    state.lat = latR;
    state.lon = lonR;
    refresh(moved);
  }

  // Opt-out de rede: o clima fica só no relógio do aparelho (dia/noite) e céu limpo
  function setOptOut(v) {
    optOut = Boolean(v);
    try { localStorage.setItem("pokeascii_weather_optout", optOut ? "1" : "0"); } catch (_) {}
    if (!optOut) refresh(true);
  }

  function setOverride(kind) {
    override = (kind && KINDS.indexOf(kind) >= 0) ? kind : null;
    if (override) {
      applyOverrideShape();
    } else {
      const cls = classify(state.code, state.cloud * 100);
      state.kind = cls.kind;
      state.realKind = cls.kind;
      state.intensity = cls.intensity;
      state.cover = cls.cover;
      state.label = LABELS_PT[cls.kind];
    }
    recomputeVisual(computeDayFactor(Date.now()));
    fireChange();
  }

  // Força o período do dia (0 = noite, 0.5 = crepúsculo, 1 = dia); null volta à hora real do local
  function setDayOverride(f) {
    dayOverride = (typeof f === "number" && Number.isFinite(f)) ? clamp(f, 0, 1) : null;
    recomputeVisual(computeDayFactor(Date.now()));
  }

  function cycleOverride() {
    const order = [null].concat(KINDS);
    setOverride(order[(order.indexOf(override) + 1) % order.length]);
    return describe();
  }

  // Tipos favorecidos pelo clima atual -> multiplicador do peso de spawn
  function spawnMult(types) {
    if (!types || !types.length) return 1;
    // Só o clima REAL influencia spawns: o modo "simulado" (toque na pílula) é puramente visual
    const boost = SPAWN_TYPES[state.realKind] || [];
    const windy = state.windKmh >= WINDY_KMH;
    for (let i = 0; i < types.length; ++i) {
      if (boost.indexOf(types[i]) >= 0 || (windy && WINDY_TYPES.indexOf(types[i]) >= 0)) return SPAWN_MULT;
    }
    return 1;
  }

  function boostedTypes() {
    const list = (SPAWN_TYPES[state.realKind] || []).slice();
    if (state.windKmh >= WINDY_KMH) list.push(...WINDY_TYPES);
    return list;
  }

  // Chamado a cada frame: nuvens, dia/noite (a cada 5 s) e relâmpagos
  function tick(timeSec) {
    const dt = lastTickSec ? Math.min(0.1, timeSec - lastTickSec) : 0.016;
    lastTickSec = timeSec;
    if (timeSec - lastDayCalcAt > 5) {
      lastDayCalcAt = timeSec;
      const df = computeDayFactor(Date.now());
      if (Math.abs(df - visual.dayFactor) > 0.004) recomputeVisual(df);
    }
    const wind = (0.004 + clamp(state.windKmh / 80, 0, 1) * 0.02) * visual.motion;
    scrollX += dt * wind;
    scrollZ += dt * wind * 0.35;
    visual.cloudScrollX = scrollX;
    visual.cloudScrollZ = scrollZ;

    // Relâmpago: amplitude baixa (≤ ~10% de brilho), subida suave (~3 frames) e no máx. 2 pulsos a cada 6+ s
    // (muito abaixo do limite de 3 clarões/s das diretrizes de fotossensibilidade). Desligado com reduced-motion.
    if (state.kind === "storm" && !reducedMotion) {
      if (nextFlashAt === 0) nextFlashAt = timeSec + 4 + Math.random() * 6;
      if (timeSec >= nextFlashAt) {
        flashTarget = 0.28;
        flashPulse2At = timeSec + 0.18;
        nextFlashAt = timeSec + 6 + Math.random() * 10;
      } else if (flashPulse2At > 0 && timeSec >= flashPulse2At) {
        flashTarget = 0.16;
        flashPulse2At = 0;
      }
    } else {
      nextFlashAt = 0;
      flashTarget = 0;
    }
    if (flashTarget > 0) {
      visual.flash += (flashTarget - visual.flash) * Math.min(1, dt * 40);
      if (visual.flash >= flashTarget * 0.92) flashTarget = 0;
    } else if (visual.flash > 0.004) {
      visual.flash *= Math.exp(-dt * 7.5);
    } else {
      visual.flash = 0;
    }
  }

  // Volta a ficar online / app volta ao primeiro plano: renova se o cache já venceu
  try {
    window.addEventListener("online", () => refresh(false));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(false); });
  } catch (_) {}

  function onChange(cb) { if (typeof cb === "function") listeners.push(cb); }

  recomputeVisual(computeDayFactor(Date.now()));

  return {
    KINDS, state, visual, tick, setLocation, refresh, setOptOut, setOverride, setDayOverride, cycleOverride, onChange,
    describe, spawnMult, boostedTypes, labels: LABELS_PT
  };
})();
