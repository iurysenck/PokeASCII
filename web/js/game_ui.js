"use strict";

// ============================================================================
// CONTROLADOR PRINCIPAL IDÊNTICO AO POKÉMON GO (REFS):
// - Mapa GPS 3D Limpo (Azul-Índigo + Ruas Reais OpenStreetMap com Borda Salmão)
// - Pinch-to-Zoom (Pinça no Mobile + Botões +/- + Scroll)
// - Pokémons 3D com Texto ASCII Contido na Silhueta + Silhueta 3D Escura na Pokédex/Nearby
// - Anel de Captura Grande + Animação Entrando na Pokébola e Saindo da Pokébola!
// ============================================================================

window.PokeGameUI = (function() {
  const E = window.Ascii3DEngine;
  const D = window.PokeData;
  const A = window.PokeAudio;
  const S = window.PokeStorage;
  const B = window.PokeBalance;

  let canvas, ctx, video, offCanvas, offCtx;
  let gameScene = "CITY_MAP"; // "CITY_MAP" ou "AR_CAPTURE"
  let useRealCamera = false;
  let hasImu = false;
  let imuYaw = 0, imuPitch = 0.05, imuRoll = 0, imuBaseAlpha = null;
  let emaFrameMs = 16.0;

  // Pose da Câmera AR no Encontro de Captura
  const pose = {
    pos: E.vec3(0, 0, 0),
    yaw: 0.0,
    pitch: 0.05,
    roll: 0.0
  };

  // Estado do Mapa GPS Real da Cidade (Ref: 22.18.13 (2).jpeg)
  const cityState = {
    playerX: 0.0,
    playerZ: 0.0,
    facingYaw: 0.0,
    camOrbitYaw: 0.0,
    camOrbitPitch: 0.68,  // Visão aérea inclinada 3D igual à ref 22.18.13 (2).jpeg!
    camOrbitDist: 9.5,    // Controlável por Pinch-to-Zoom no celular (3.5m até 20.0m)!
    isWalking: false,
    joyDx: 0,
    joyDy: 0,
    joyActive: false,
    gpsActive: false,
    baseLat: -23.5614,
    baseLon: -46.6559,
    cityName: "Toque para ativar seu GPS Real",
    osmRoads: [],         // Ruas reais do OpenStreetMap [{pts: [{x,z}, ...], name}]
    osmBuildings: [],     // Prédios 3D reais do OpenStreetMap [{pts: [{x,z}, ...]}]
    otherPlayers: [],
    pois: [
      { id: "p1", type: "pokestop", name: "PokéStop Praça Central",    x: -4.8, z: -6.5 },
      { id: "p2", type: "pokestop", name: "PokéStop Avenida Principal", x:  6.4, z: -4.8 },
      { id: "p3", type: "pokestop", name: "PokéStop Parque Municipal",  x: -6.2, z:  7.2 },
      { id: "p4", type: "pokestop", name: "PokéStop Esquina Cultural",  x:  5.0, z: -11.5 },
      { id: "g1", type: "gym",      name: "Ginásio Arena Central",      x: -2.2, z: -13.0, guardId: 26, cp: 1950 },
      { id: "r1", type: "raid",     name: "Raid 5★: MEWTWO",            x:  8.5, z: -12.0, bossId: 150, cp: 45800 },
      { id: "v1", type: "villain",  name: "Balão Equipe Rocket/Shadow", x: -3.2, z: -3.8,  bossId: 94,  cp: 2400 }
    ]
  };

  let wildSpawns = [];
  let activeWildIdx = 0;
  let activeBallType = "poke_ball";
  let clickableMapTargets = [];

  // Estado da Pokébola com Animações:
  // 0: Idle/Spinning no Dock
  // 1: Voando em 3D (com curva Magnus se Curveball)
  // 2: ENTRANDO NA POKÉBOLA (A Pokébola abre no ar, dispara feixe vermelho e suga o Pokémon!)
  // 3: Balançando no chão (1..3 shakes)
  // 4: Captura Concluída (Explosão de estrelas GOTCHA!)
  // 5: SAINDO DA POKÉBOLA (A Pokébola abre com clarão branco/vermelho e o Pokémon salta para fora!)
  const ball = {
    state: 0,
    pos: E.vec3(0, 0, 0),
    vel: E.vec3(0, 0, 0),
    spinAngle: 0,
    curveRpm: 0,
    curveDir: 1,
    isCurveball: false,
    ringRadius: 1.0, // Oscila de 1.0 até 0.15 cobrindo TODO o corpo do Pokémon!
    throwBonusLabel: "",
    throwBonusMult: 1.0,
    timer: 0,
    shakes: 0,
    shakesRequired: 3,
    willCatch: true,
    targetIdx: 0,
    lidOpenAngle: 0 // Ângulo de abertura da tampa superior da Pokébola!
  };

  let battleState = null;
  let deferredPwaPrompt = null;

  // ============================================================================
  // GPS REAL DO DISPOSITIVO + MAPA VETORIAL 3D DO OPENSTREETMAP
  // ============================================================================
  function latLonToMeters(lat, lon) {
    const dLat = (lat - cityState.baseLat) * 111320.0;
    const dLon = (lon - cityState.baseLon) * 111320.0 * Math.cos(cityState.baseLat * Math.PI / 180.0);
    return { x: dLon / 9.0, z: -dLat / 9.0 };
  }

  async function fetchRealCityFromOpenStreetMap(lat, lon) {
    cityState.baseLat = lat;
    cityState.baseLon = lon;

    const pill = document.getElementById("gps-pill");
    if (pill) pill.textContent = `📍 GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    // 1. Nome real da rua e bairro via Nominatim
    try {
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17`);
      if (nomRes.ok) {
        const nom = await nomRes.json();
        const addr = nom.address || {};
        const road = addr.road || addr.pedestrian || addr.suburb || "Sua Rua";
        const city = addr.city || addr.town || addr.municipality || addr.state || "";
        cityState.cityName = city ? `${road}, ${city}` : road;
        if (pill) pill.textContent = `📍 ${cityState.cityName}`;
      }
    } catch (_) {}

    // 2. Ruas reais e Prédios reais num raio de 420m via OpenStreetMap Overpass API
    try {
      const query = `[out:json][timeout:10];(way["highway"](around:420,${lat},${lon});way["building"](around:260,${lat},${lon});node["amenity"](around:420,${lat},${lon});node["shop"](around:420,${lat},${lon}););out body;>;out skel qt;`;
      const ovRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query)
      });
      if (!ovRes.ok) return;
      const ov = await ovRes.json();
      const nodes = new Map();
      const roads = [];
      const buildings = [];
      const realPois = [];

      for (const el of (ov.elements || [])) {
        if (el.type === "node") {
          nodes.set(el.id, el);
          if (el.tags && (el.tags.name || el.tags.amenity || el.tags.shop)) {
            realPois.push(el);
          }
        }
      }
      for (const el of (ov.elements || [])) {
        if (el.type === "way" && el.nodes && el.nodes.length >= 2) {
          const pts = [];
          for (const nid of el.nodes) {
            const n = nodes.get(nid);
            if (n) pts.push(latLonToMeters(n.lat, n.lon));
          }
          if (pts.length >= 2) {
            if (el.tags && el.tags.building) {
              buildings.push({ pts });
            } else {
              roads.push({ pts, name: (el.tags && el.tags.name) || "" });
            }
          }
        }
      }

      if (roads.length > 0) cityState.osmRoads = roads;
      if (buildings.length > 0) cityState.osmBuildings = buildings.slice(0, 120);

      if (realPois.length > 0) {
        for (let i = 0; i < Math.min(realPois.length, cityState.pois.length - 1); ++i) {
          const rp = realPois[i];
          const mp = latLonToMeters(rp.lat, rp.lon);
          cityState.pois[i].x = Math.max(-22, Math.min(22, mp.x));
          cityState.pois[i].z = Math.max(-22, Math.min(22, mp.z));
          if (rp.tags && rp.tags.name) cityState.pois[i].name = rp.tags.name;
        }
      }
      S.showToast(`🗺️ Mapa GPS Real carregado: ${cityState.cityName}!`, "info");
    } catch (_) {}
  }

  function startRealGpsTracking(userClicked = false) {
    const pill = document.getElementById("gps-pill");
    if (pill) pill.textContent = "📍 Obtendo GPS...";

    const fallbackIpLocation = async () => {
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          const ipd = await ipRes.json();
          if (ipd.latitude && ipd.longitude) {
            fetchRealCityFromOpenStreetMap(ipd.latitude, ipd.longitude);
            return;
          }
        }
      } catch (_) {}
      if (pill) pill.textContent = "📍 Mapa Urbano 3D (Toque p/ GPS)";
    };

    if (!("geolocation" in navigator)) {
      fallbackIpLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cityState.gpsActive = true;
        cityState.playerX = 0;
        cityState.playerZ = 0;
        fetchRealCityFromOpenStreetMap(pos.coords.latitude, pos.coords.longitude);
        navigator.geolocation.watchPosition(
          (wp) => {
            const mp = latLonToMeters(wp.coords.latitude, wp.coords.longitude);
            const dx = mp.x - cityState.playerX, dz = mp.z - cityState.playerZ;
            if (Math.hypot(dx, dz) > 0.12) {
              cityState.playerX = mp.x;
              cityState.playerZ = mp.z;
              cityState.facingYaw = Math.atan2(dx, -dz);
              cityState.isWalking = true;
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      },
      (err) => {
        if (userClicked) {
          S.showToast(`⚠️ GPS do navegador bloqueado (${err.message}). Usando localização aproximada da cidade.`, "warn");
        }
        fallbackIpLocation();
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }

  // Zoom no Mobile (Pinça ou Botões + / -)
  function adjustZoom(deltaDist) {
    A.playUiClick();
    cityState.camOrbitDist = Math.max(3.5, Math.min(20.0, cityState.camOrbitDist + deltaDist));
  }

  function spawnWildWave(includeAnomaly = false) {
    const prof = S.getProfile();
    const cfg = B.get();
    wildSpawns = [];
    const baseAngles = [0.4, -0.7, 1.6, -1.8, 2.6, -2.8];

    for (let i = 0; i < 6; ++i) {
      const isAnom = includeAnomaly && i === 0;
      const rolled = isAnom ? D.rollAnomalyUltraRareSpawn(cfg, prof.level) : D.rollWeightedSpawn(cfg, prof.level);
      const sp = D.getSpecies(rolled.speciesId);
      const dist = isAnom ? 2.1 : (2.2 + (i % 3) * 1.3);
      const ang = baseAngles[i];

      wildSpawns.push({
        data: rolled,
        species: sp,
        mapX: cityState.playerX + Math.sin(ang) * dist,
        mapZ: cityState.playerZ - Math.cos(ang) * dist,
        pos: E.vec3(0, -1.0, -3.4),
        visualScale: E.computeVisualScale(sp.height_m),
        jumpOffset: 0,
        actionTimer: i * 1.4,
        calmedByNanab: false,
        berryApplied: null,
        insideBall: false,
        morphProgress: 0 // 0: normal, 0->1: entrando/saindo da Pokébola!
      });
    }
    activeWildIdx = 0;
    updateNearbyPillIcons();
  }

  // ============================================================================
  // RENDERIZADOR 3D DO MAPA DA CIDADE (Ref: 22.18.13 (2).jpeg) & ENCONTRO AR
  // ============================================================================
  function getCityCameraEye() {
    const d = cityState.camOrbitDist;
    const pitch = cityState.camOrbitPitch;
    const yaw = cityState.camOrbitYaw;
    return E.vec3(
      cityState.playerX - Math.sin(yaw) * Math.cos(pitch) * d,
      Math.sin(pitch) * d,
      cityState.playerZ + Math.cos(yaw) * Math.cos(pitch) * d
    );
  }

  function renderMainViewport(timeSec) {
    const W = canvas.width, H = canvas.height;
    clickableMapTargets = [];

    if (gameScene === "CITY_MAP") {
      renderPokemonGo3DCityMap(W, H, timeSec);
    } else {
      renderPokemonGoArEncounter(W, H, timeSec);
    }
  }

  function renderPokemonGo3DCityMap(W, H, timeSec) {
    // 1. Fundo Azul-Índigo Noturno idêntico à referência 22.18.13 (2).jpeg + Textura Matrix ASCII sutil
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#1c2d6b");
    bgGrad.addColorStop(0.35, "#283c82");
    bgGrad.addColorStop(1, "#243678");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const aspect = W / Math.max(1, H);
    const eye = getCityCameraEye();
    const view = E.mat4View6DoF(eye, cityState.camOrbitYaw, -cityState.camOrbitPitch, 0);
    const proj = E.mat4Perspective(46 * Math.PI / 180, aspect, 0.3, 60.0);
    const vp = E.mat4Mul(proj, view);

    // 2. Grade de Coordenadas ASCII 3D sutil no chão da cidade
    ctx.save();
    ctx.font = "bold 10px 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "rgba(120, 175, 255, 0.14)";
    const gx0 = Math.floor(cityState.playerX - 18), gx1 = Math.ceil(cityState.playerX + 18);
    const gz0 = Math.floor(cityState.playerZ - 18), gz1 = Math.ceil(cityState.playerZ + 18);
    for (let gz = gz0; gz <= gz1; gz += 2) {
      for (let gx = gx0; gx <= gx1; gx += 2) {
        const p = E.projectPoint3D(vp, gx, 0, gz, W, H);
        if (p && p.x > 0 && p.x < W && p.y > 0 && p.y < H) {
          ctx.fillText((gx % 4 === 0 && gz % 4 === 0) ? "+" : "·", p.x, p.y);
        }
      }
    }
    ctx.restore();

    // 3. Prédios 3D do OpenStreetMap (ou quarteirões urbanos da cidade) em Azul-Claro (#3f569c)
    ctx.save();
    ctx.fillStyle = "rgba(68, 92, 162, 0.75)";
    ctx.strokeStyle = "rgba(110, 145, 220, 0.45)";
    ctx.lineWidth = 1.5;
    if (cityState.osmBuildings.length > 0) {
      for (const b of cityState.osmBuildings) {
        ctx.beginPath();
        let started = false;
        for (const pt of b.pts) {
          const p = E.projectPoint3D(vp, pt.x, 0.05, pt.z, W, H);
          if (!p) continue;
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
        if (started) { ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
    } else {
      // Quarteirões procedurais quando OpenStreetMap ainda está carregando
      for (let bz = -2; bz <= 2; ++bz) {
        for (let bx = -2; bx <= 2; ++bx) {
          const cx = bx * 9 + 4.5, cz = bz * 9 + 4.5;
          const corners = [
            E.projectPoint3D(vp, cx-2.6, 0.05, cz-2.6, W, H),
            E.projectPoint3D(vp, cx+2.6, 0.05, cz-2.6, W, H),
            E.projectPoint3D(vp, cx+2.6, 0.05, cz+2.6, W, H),
            E.projectPoint3D(vp, cx-2.6, 0.05, cz+2.6, W, H)
          ];
          if (corners.every(Boolean)) {
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let k = 1; k < 4; ++k) ctx.lineTo(corners[k].x, corners[k].y);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        }
      }
    }
    ctx.restore();

    // 4. Ruas Reais do OpenStreetMap (Borda Salmão/Dourada #8d606a + Interior Azul-Marinho #17255c igual à ref 22.18.13 (2).jpeg!)
    const drawRoadPolyline = (pts, widthScale, strokeStyle) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i + 1 < pts.length; ++i) {
        const p0 = E.projectPoint3D(vp, pts[i].x, 0.02, pts[i].z, W, H);
        const p1 = E.projectPoint3D(vp, pts[i+1].x, 0.02, pts[i+1].z, W, H);
        if (!p0 || !p1) continue;
        const avgDepth = Math.max(2.5, (p0.depth + p1.depth) * 0.5);
        ctx.lineWidth = Math.max(4, Math.min(54, (140 / avgDepth) * widthScale));
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    };

    ctx.save();
    let roadList = cityState.osmRoads;
    if (roadList.length === 0) {
      roadList = [];
      for (let k = -2; k <= 2; ++k) {
        roadList.push({ pts: [{x: -24, z: k*9}, {x: 24, z: k*9}] });
        roadList.push({ pts: [{x: k*9, z: -24}, {x: k*9, z: 24}] });
      }
    }
    for (const r of roadList) drawRoadPolyline(r.pts, 1.28, "#8e626c"); // Meio-fio Salmão Pokémon GO
    for (const r of roadList) drawRoadPolyline(r.pts, 0.92, "#17255c"); // Asfalto Azul-Marinho
    ctx.restore();

    // 5. Círculo Branco/Rosa Pulsante no Chão ao redor do seu Avatar (Ref: 22.18.13 (2).jpeg)
    const avatarScreen = E.projectPoint3D(vp, cityState.playerX, 0, cityState.playerZ, W, H);
    if (avatarScreen) {
      const ringEdge = E.projectPoint3D(vp, cityState.playerX + 3.2, 0, cityState.playerZ, W, H);
      const rx = ringEdge ? Math.hypot(ringEdge.x - avatarScreen.x, ringEdge.y - avatarScreen.y) : 130;
      ctx.save();
      ctx.strokeStyle = "rgba(245, 210, 240, 0.82)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(avatarScreen.x, avatarScreen.y, rx, rx * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Coleta todos os objetos 3D do Mapa (Avatar, Parceiro, Pokémons Selvagens, PokéStops, Ginásios, Raids, Balão Rocket)
    // e ordena por profundidade Z (Painter's Algorithm 3D) para oclusão perfeita!
    const renderQueue = [];
    const prof = S.getProfile();

    // 6a. Seu Avatar 3D no centro
    if (avatarScreen) {
      renderQueue.push({
        depth: avatarScreen.depth,
        draw: () => draw3DTrainerAvatarOnMap(avatarScreen.x, avatarScreen.y, avatarScreen.depth, prof, timeSec)
      });
    }

    // 6b. Seu Pokémon Parceiro (Buddy) caminhando ao lado do Avatar
    const buddyPk = prof.pokemonBox.find(p => p.uid === prof.buddyUid) || prof.pokemonBox[0];
    if (buddyPk) {
      const bx = cityState.playerX - Math.sin(cityState.facingYaw - 0.6) * 1.25;
      const bz = cityState.playerZ + Math.cos(cityState.facingYaw - 0.6) * 1.25;
      const bp = E.projectPoint3D(vp, bx, 0, bz, W, H);
      if (bp) {
        renderQueue.push({
          depth: bp.depth,
          draw: () => draw3DPokemonOnMap(bp.x, bp.y, bp.depth, buddyPk.speciesId, buddyPk.isShiny, 0.85, timeSec, true)
        });
      }
    }

    // 6c. Todos os Pokémons Selvagens em 3D ao redor do Avatar no Mapa!
    for (let i = 0; i < wildSpawns.length; ++i) {
      const w = wildSpawns[i];
      const wp = E.projectPoint3D(vp, w.mapX, 0, w.mapZ, W, H);
      if (!wp) continue;
      renderQueue.push({
        depth: wp.depth,
        draw: () => {
          const hitRadius = draw3DPokemonOnMap(wp.x, wp.y, wp.depth, w.data.speciesId, w.data.isShiny, w.visualScale, timeSec + i, false);
          clickableMapTargets.push({ x: wp.x, y: wp.y - hitRadius * 0.4, r: Math.max(36, hitRadius), type: "wild", index: i });
        }
      });
    }

    // 6d. PokéStops 3D, Ginásios 3D, Raids 3D e Balão Rocket 3D (Ref: 22.18.13 (2).jpeg)
    for (let i = 0; i < cityState.pois.length; ++i) {
      const poi = cityState.pois[i];
      const pp = E.projectPoint3D(vp, poi.x, 0, poi.z, W, H);
      if (!pp) continue;
      renderQueue.push({
        depth: pp.depth,
        draw: () => {
          const hitR = draw3DPoiOnMap(pp.x, pp.y, pp.depth, poi, timeSec);
          clickableMapTargets.push({ x: pp.x, y: pp.y - hitR * 0.5, r: Math.max(38, hitR), type: "poi", index: i });
        }
      });
    }

    renderQueue.sort((a, b) => b.depth - a.depth);
    for (const item of renderQueue) item.draw();
  }

  // Desenha o Pokémon 3D com Texto ASCII Contido na Silhueta + Anel Branco no Chão (Ref: 22.18.13 (2).jpeg)
  function draw3DPokemonOnMap(sx, sy, depth, speciesId, isShiny, scale, timeSec, isBuddy) {
    const sizePx = Math.max(38, Math.min(135, (380 / Math.max(2.2, depth)) * scale));
    const bounceY = Math.abs(Math.sin(timeSec * 3.2)) * (sizePx * 0.08);

    ctx.save();
    // Anel branco no chão sob o Pokémon (igual ao Munna na ref 22.18.13 (2).jpeg!)
    ctx.strokeStyle = isBuddy ? "rgba(255, 216, 72, 0.85)" : "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sizePx * 0.46, sizePx * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Sombra 3D no chão
    ctx.fillStyle = "rgba(8, 14, 35, 0.45)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, sizePx * 0.34, sizePx * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Escultura 3D ASCII do Pokémon
    const sculp = E.getPokemonAscii3DSculpture(speciesId, isShiny, false);
    ctx.drawImage(sculp, sx - sizePx * 0.5, sy - sizePx * 0.88 - bounceY, sizePx, sizePx);
    ctx.restore();
    return sizePx * 0.55;
  }

  // Desenha o Avatar 3D Personalizado do Treinador no Centro do Mapa
  function draw3DTrainerAvatarOnMap(sx, sy, depth, prof, timeSec) {
    const h = Math.max(46, Math.min(110, 390 / Math.max(2.5, depth)));
    const walkBob = cityState.isWalking ? Math.sin(timeSec * 12) * 4 : 0;
    const legSwing = cityState.isWalking ? Math.sin(timeSec * 12) * 7 : 0;

    ctx.save();
    // Sombra proyectada no chão
    ctx.fillStyle = "rgba(8, 15, 38, 0.52)";
    ctx.beginPath(); ctx.ellipse(sx + 6, sy + 2, h * 0.32, h * 0.14, 0.2, 0, Math.PI * 2); ctx.fill();

    // Pernas e tênis brancos
    ctx.strokeStyle = "#192848";
    ctx.lineWidth = h * 0.11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx - h*0.09, sy - h*0.36); ctx.lineTo(sx - h*0.11 + legSwing, sy - 4);
    ctx.moveTo(sx + h*0.09, sy - h*0.36); ctx.lineTo(sx + h*0.11 - legSwing, sy - 4);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sx - h*0.11 + legSwing, sy - 2, h*0.07, 0, Math.PI*2);
    ctx.arc(sx + h*0.11 - legSwing, sy - 2, h*0.07, 0, Math.PI*2);
    ctx.fill();

    // Jaqueta personalizada com textura ASCII interna
    ctx.fillStyle = (prof.avatar && prof.avatar.outfitColor) ? prof.avatar.outfitColor : "#ff8a8a";
    ctx.beginPath();
    ctx.roundRect(sx - h*0.18, sy - h*0.72 - walkBob, h*0.36, h*0.38, 8);
    ctx.fill();

    // Cabeça + Cabelo + Máscara/Visor estilo ref 22.18.10 (1).jpeg
    ctx.fillStyle = (prof.avatar && prof.avatar.skinColor) ? prof.avatar.skinColor : "#d99b72";
    ctx.beginPath(); ctx.arc(sx, sy - h*0.84 - walkBob, h*0.15, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#8a5cf5"; // Cabelo estilizado
    ctx.beginPath(); ctx.arc(sx, sy - h*0.89 - walkBob, h*0.16, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  // Desenha PokéStop 3D, Ginásio 3D e Balão da Equipe Rocket 3D (Ref: 22.18.13 (2).jpeg)
  function draw3DPoiOnMap(sx, sy, depth, poi, timeSec) {
    const scale = Math.max(26, Math.min(95, 340 / Math.max(2.5, depth)));
    ctx.save();

    if (poi.type === "pokestop") {
      // Anel branco no chão + Cubo Ciano 3D flutuante idêntico ao topo da ref 22.18.13 (2).jpeg!
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, scale * 0.55, scale * 0.28, 0, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - scale * 0.75); ctx.stroke();

      const cubeY = sy - scale * 0.95 + Math.sin(timeSec * 3) * 3;
      ctx.fillStyle = "#06b6d4";
      ctx.beginPath();
      ctx.moveTo(sx, cubeY - scale*0.26);
      ctx.lineTo(sx + scale*0.24, cubeY);
      ctx.lineTo(sx, cubeY + scale*0.26);
      ctx.lineTo(sx - scale*0.24, cubeY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#cffafe";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (poi.type === "gym" || poi.type === "raid") {
      // Estádio 3D Prata/Vermelho/Azul flutuante igual à ref 22.18.13 (2).jpeg!
      const isRaid = poi.type === "raid";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, scale * 0.7, scale * 0.36, 0, 0, Math.PI * 2); ctx.stroke();

      const topY = sy - scale * 1.15;
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath(); ctx.ellipse(sx, topY, scale * 0.72, scale * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isRaid ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Pokémon Guardião ou Raid Boss 3D no topo do Ginásio!
      const monId = isRaid ? (poi.bossId || 150) : (poi.guardId || 26);
      const sculp = E.getPokemonAscii3DSculpture(monId, false, false);
      ctx.drawImage(sculp, sx - scale*0.55, topY - scale*0.95, scale*1.1, scale*1.1);
    } else if (poi.type === "villain") {
      // Grande Balão Preto da Equipe Rocket com 'R' Laranja-Vermelho flutuando sobre o mapa (Ref: 22.18.13 (2).jpeg)!
      const floatY = sy - scale * 1.65 + Math.sin(timeSec * 2.2) * 6;
      const bRad = scale * 0.85;

      // Sombra no chão
      ctx.fillStyle = "rgba(8, 12, 28, 0.45)";
      ctx.beginPath(); ctx.ellipse(sx, sy, bRad * 0.45, bRad * 0.22, 0, 0, Math.PI * 2); ctx.fill();

      // Cesto
      ctx.fillStyle = "#475569";
      ctx.fillRect(sx - bRad*0.18, floatY + bRad*0.85, bRad*0.36, bRad*0.24);

      // Balão Esférico 3D Escuro
      const bGrad = ctx.createRadialGradient(sx - bRad*0.28, floatY - bRad*0.28, bRad*0.1, sx, floatY, bRad);
      bGrad.addColorStop(0, "#475582");
      bGrad.addColorStop(0.6, "#1e294b");
      bGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = bGrad;
      ctx.beginPath(); ctx.arc(sx, floatY, bRad, 0, Math.PI * 2); ctx.fill();

      // Letra 'R' Vermelha no Balão
      ctx.fillStyle = "#e11d48";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.font = `900 ${Math.round(bRad * 0.82)}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("R", sx, floatY + bRad * 0.12);
      ctx.strokeText("R", sx, floatY + bRad * 0.12);
    }

    ctx.restore();
    return scale;
  }

  // ============================================================================
  // TELA DE ENCONTRO DE CAPTURA AR 3D:
  // - Câmera ao Vivo em ASCII HD ou Parque 3D
  // - Pílula limpa com Nome e CP (Sem escala real!)
  // - Círculo de Captura GRANDE cobrindo todo o Pokémon!
  // - Animação 3D ENTRANDO na Pokébola e SAINDO da Pokébola!
  // ============================================================================
  function renderPokemonGoArEncounter(W, H, timeSec) {
    // 1. Fundo: Câmera Ao Vivo em ASCII ou Pradaria AR 3D Limpa
    if (useRealCamera && video && video.readyState >= 2) {
      const cw = 130, ch = Math.max(60, Math.round(130 * (H / W)));
      offCanvas.width = cw; offCanvas.height = ch;
      offCtx.drawImage(video, 0, 0, cw, ch);
      const img = offCtx.getImageData(0, 0, cw, ch).data;
      const cellW = W / cw, cellH = H / ch;

      ctx.fillStyle = "#09131c";
      ctx.fillRect(0, 0, W, H);
      ctx.font = `bold ${Math.ceil(cellH)}px 'Cascadia Mono', Consolas, monospace`;
      ctx.textBaseline = "top";

      const ramp = E.RAMP_INTERNAL;
      for (let r = 0; r < ch; ++r) {
        const py = r * cellH;
        for (let c = 0; c < cw; ++c) {
          const p = (r * cw + c) * 4;
          const cr = img[p], cg = img[p+1], cb = img[p+2];
          const lum = (0.299*cr + 0.587*cg + 0.114*cb) / 255;
          ctx.fillStyle = `rgb(${Math.round(cr*0.58)},${Math.round(cg*0.58)},${Math.round(cb*0.58)})`;
          ctx.fillRect(c * cellW, py, cellW + 0.5, cellH + 0.5);
          const chGlyph = ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))];
          ctx.fillStyle = `rgb(${Math.min(255,Math.round(cr*1.12))},${Math.min(255,Math.round(cg*1.12))},${Math.min(255,Math.round(cb*1.12))})`;
          ctx.fillText(chGlyph, c * cellW, py);
        }
      }
    } else {
      // Fundo Parque/Pradaria AR do Pokémon GO
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.52);
      sky.addColorStop(0, "#38bdf8");
      sky.addColorStop(1, "#bae6fd");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.52);

      const grass = ctx.createLinearGradient(0, H * 0.48, 0, H);
      grass.addColorStop(0, "#4ade80");
      grass.addColorStop(0.4, "#22c55e");
      grass.addColorStop(1, "#15803d");
      ctx.fillStyle = grass;
      ctx.fillRect(0, H * 0.48, W, H * 0.52);
    }

    const w = wildSpawns[activeWildIdx] || wildSpawns[0];
    if (!w) return;

    const monCenterX = W * 0.5 - pose.yaw * 220;
    const monCenterY = H * 0.46 + pose.pitch * 180 - w.jumpOffset * 65;
    const monSizePx = Math.min(W * 0.62, H * 0.36) * Math.max(0.88, Math.min(1.28, w.visualScale * 0.85));

    // Sombra no chão sob o Pokémon
    ctx.save();
    ctx.fillStyle = "rgba(10, 35, 20, 0.35)";
    ctx.beginPath();
    ctx.ellipse(monCenterX, H * 0.58, monSizePx * 0.44, monSizePx * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Desenha o Pokémon 3D (com Animação ENTRANDO na Pokébola state=2 ou SAINDO da Pokébola state=5!)
    if (!w.insideBall || ball.state === 2 || ball.state === 5) {
      ctx.save();
      let drawX = monCenterX;
      let drawY = monCenterY;
      let drawScale = 1.0;
      let drawRedBeamTint = false;

      if (ball.state === 2) {
        // ANIMAÇÃO ENTRANDO NA POKÉBOLA: O Pokémon vira energia vermelha, encolhe e voa em arco para dentro da Pokébola aberta!
        const t = Math.min(1.0, ball.timer / 0.68);
        const ballScreenX = W * 0.5;
        const ballScreenY = H * 0.34;
        drawX = monCenterX * (1 - t) + ballScreenX * t;
        drawY = monCenterY * (1 - t) + ballScreenY * t - Math.sin(t * Math.PI) * 55;
        drawScale = Math.max(0.06, 1.0 - t * 0.94);
        drawRedBeamTint = true;

        // Feixe laser vermelho conectando a Pokébola aberta ao Pokémon!
        ctx.strokeStyle = "rgba(255, 50, 90, 0.88)";
        ctx.lineWidth = 10 * (1 - t * 0.5);
        ctx.beginPath();
        ctx.moveTo(ballScreenX, ballScreenY);
        ctx.lineTo(drawX, drawY);
        ctx.stroke();
      } else if (ball.state === 5) {
        // ANIMAÇÃO SAINDO DA POKÉBOLA: A Pokébola explode em luz no chão e o Pokémon emerge crescendo de dentro dela!
        const t = Math.min(1.0, ball.timer / 0.65);
        const ballGroundX = W * 0.5;
        const ballGroundY = H * 0.60;
        drawX = ballGroundX * (1 - t) + monCenterX * t;
        drawY = ballGroundY * (1 - t) + monCenterY * t - Math.sin(t * Math.PI) * 70;
        drawScale = 0.08 + 0.92 * t;
        drawRedBeamTint = (t < 0.55);

        // Anel de choque luminoso da Pokébola abrindo!
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
        ctx.lineWidth = 8 * (1 - t);
        ctx.beginPath();
        ctx.arc(ballGroundX, ballGroundY, t * 140, 0, Math.PI * 2);
        ctx.stroke();
      }

      const sPx = monSizePx * drawScale;
      const sculp = E.getPokemonAscii3DSculpture(w.data.speciesId, w.data.isShiny, false);
      ctx.translate(drawX, drawY);
      if (ball.state === 2) ctx.rotate(ball.timer * 12);
      ctx.drawImage(sculp, -sPx * 0.5, -sPx * 0.5, sPx, sPx);

      if (drawRedBeamTint) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(255, 45, 95, 0.65)";
        ctx.fillRect(-sPx * 0.5, -sPx * 0.5, sPx, sPx);
      }
      ctx.restore();
    }

    // 3. PÍLULA LIMPA DE NOME E CP + ANEL DE CAPTURA GRANDE (Quando o Pokémon está livre mirando!)
    if (ball.state === 0 || ball.state === 1) {
      ctx.save();
      // Pílula de Nome + CP estilo Pokémon GO (Sem texto de escala real!)
      const pillW = 210, pillH = 44;
      const pillX = monCenterX - pillW * 0.5;
      const pillY = monCenterY - monSizePx * 0.58 - 54;

      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 22); ctx.fill();
      ctx.strokeStyle = "rgba(38, 204, 170, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#254a52";
      ctx.font = "800 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      const berryIcon = w.berryApplied ? ` ${D.ITEMS_CATALOG[w.berryApplied].icon}` : "";
      const shinyIcon = w.data.isShiny ? "✨ " : "";
      ctx.fillText(`${shinyIcon}${w.species.name}${berryIcon}`, monCenterX, pillY + 18);

      ctx.fillStyle = "#1c8c82";
      ctx.font = "800 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(`CP ${w.data.cp}`, monCenterX, pillY + 36);

      // CÍRCULO DE CAPTURA GRANDE (cobre todo o diâmetro do Pokémon!)
      const outerRadius = monSizePx * 0.54;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(monCenterX, monCenterY, outerRadius, 0, Math.PI * 2); ctx.stroke();

      const innerRadius = outerRadius * ball.ringRadius;
      const ringCol = ball.ringRadius <= 0.34 ? "#22c55e" : (ball.ringRadius <= 0.66 ? "#eab308" : "#f97316");
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(monCenterX, monCenterY, innerRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 4. Desenha a Pokébola 3D (No Dock, Voando, Abrindo para Sugar, Balançando no Chão ou Abrindo ao Escapar!)
    renderPokeball3DInEncounter(W, H, monCenterX, monCenterY, timeSec);
  }

  function renderPokeball3DInEncounter(W, H, monX, monY, timeSec) {
    ctx.save();
    let bx = W * 0.5, by = H - 88, bRad = 34, rot = 0, lidOpen = 0;

    if (ball.state === 0) {
      rot = ball.spinAngle * ball.curveDir;
    } else if (ball.state === 1) {
      // Projeta posição 3D de voo da Pokébola
      const tFlight = Math.min(1.0, ball.timer / 0.55);
      const curveOffsetX = ball.isCurveball ? Math.sin(tFlight * Math.PI) * 110 * ball.curveDir * ball.curveRpm : 0;
      bx = (W * 0.5) * (1 - tFlight) + (monX + ball.vel.x * 35) * tFlight + curveOffsetX;
      by = (H - 88) * (1 - tFlight) + monY * tFlight - Math.sin(tFlight * Math.PI) * 145;
      bRad = 34 * (1 - tFlight * 0.32);
      rot = timeSec * 16 * ball.curveDir;
    } else if (ball.state === 2) {
      // Pokébola ABERTA no ar sugando o Pokémon!
      bx = W * 0.5;
      by = H * 0.34;
      bRad = 28;
      lidOpen = Math.sin(Math.min(1, ball.timer / 0.68) * Math.PI);
    } else if (ball.state === 3 || ball.state === 4) {
      // Pokébola no chão balançando (1, 2, 3) ou capturada!
      bx = W * 0.5;
      by = H * 0.62;
      bRad = 28;
      if (ball.state === 3) {
        rot = 0.45 * Math.sin(ball.timer * 15) * Math.exp(-(ball.timer % 0.68) * 2.2);
      }
    } else if (ball.state === 5) {
      // Pokébola ABERTA no chão com o Pokémon saindo dela!
      bx = W * 0.5;
      by = H * 0.62;
      bRad = 28;
      lidOpen = 1.0 - Math.min(1, ball.timer / 0.65);
    }

    const ballColors = {
      poke_ball: "#ef4444", great_ball: "#3b82f6", ultra_ball: "#eab308", master_ball: "#a855f7"
    };
    const topColor = ballColors[activeBallType] || "#ef4444";

    ctx.translate(bx, by);
    ctx.rotate(rot);

    // Hemisfério inferior branco
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath(); ctx.arc(0, 0, bRad, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.stroke();

    // Se a Pokébola estiver ABERTA (entrando ou saindo), desenha o núcleo energético brilhante e a tampa articulada levantada!
    if (lidOpen > 0.05) {
      ctx.fillStyle = "#ffe4e6";
      ctx.beginPath(); ctx.ellipse(0, 0, bRad * 0.9, bRad * 0.35, 0, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.translate(-bRad * 0.75, -bRad * 0.15);
      ctx.rotate(-lidOpen * 1.15);
      ctx.translate(bRad * 0.75, 0);
      ctx.fillStyle = topColor;
      ctx.beginPath(); ctx.arc(0, 0, bRad, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    } else {
      // Tampa superior fechada
      ctx.fillStyle = topColor;
      ctx.beginPath(); ctx.arc(0, 0, bRad, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5; ctx.stroke();

      // Faixa central preta e botão
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-bRad, -bRad * 0.14, bRad * 2, bRad * 0.28);
      ctx.fillStyle = ball.state === 4 ? "#22c55e" : "#ffffff";
      ctx.beginPath(); ctx.arc(0, 0, bRad * 0.30, 0, Math.PI * 2); ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Faíscas de Curveball ou Estrelas de Captura Concluída!
    if (ball.state === 0 && ball.curveRpm > 0.18) {
      ctx.save();
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 18px sans-serif";
      for (let k = 0; k < 6; ++k) {
        const a = timeSec * 9 * ball.curveDir + k * (Math.PI / 3);
        ctx.fillText("✦", bx + Math.cos(a) * 48, by + Math.sin(a) * 48);
      }
      ctx.restore();
    } else if (ball.state === 4) {
      ctx.save();
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✨ ★ ✨", bx, by - 45 - ball.timer * 20);
      ctx.restore();
    }
  }

  // ============================================================================
  // FÍSICA DE CAPTURA COM ANIMAÇÃO ENTRANDO E SAINDO DA POKÉBOLA
  // ============================================================================
  function enterArEncounterWithWild(wildIdx) {
    if (wildIdx < 0 || wildIdx >= wildSpawns.length) return;
    activeWildIdx = wildIdx;
    const w = wildSpawns[wildIdx];
    w.insideBall = false;
    pose.yaw = 0;
    pose.pitch = 0;
    ball.state = 0;
    ball.curveRpm = 0;

    gameScene = "AR_CAPTURE";
    document.getElementById("map-overworld-hud").style.display = "none";
    document.getElementById("ar-encounter-hud").style.display = "block";
    A.playPokemonCry(w.data.speciesId);
  }

  function throwPokeball(speed = 7.4, yawOffset = 0.0) {
    if (ball.state !== 0) return;
    const prof = S.getProfile();
    if ((prof.bag[activeBallType] || 0) <= 0) {
      S.showToast(`⚠️ Você está sem ${D.ITEMS_CATALOG[activeBallType].name}! Gire um PokéStop no Mapa.`, "warn");
      return;
    }
    prof.bag[activeBallType]--;
    S.save();

    ball.isCurveball = ball.curveRpm > 0.35;
    ball.vel = E.vec3(yawOffset, speed, 0);
    ball.state = 1;
    ball.timer = 0;
    ball.shakes = 0;
    A.playThrow();
  }

  function updateCaptureAndWildPhysics(dt, timeSec) {
    // Anel grande encolhe continuamente de 1.0 até 0.16
    ball.ringRadius = 1.0 - ((timeSec * 0.58) % 0.84);

    for (let i = 0; i < wildSpawns.length; ++i) {
      const w = wildSpawns[i];
      if (w.calmedByNanab || w.insideBall) { w.jumpOffset = 0; continue; }
      w.actionTimer += dt;
      const cycle = w.actionTimer % 6.5;
      w.jumpOffset = (cycle > 5.2 && cycle < 5.9) ? Math.sin(((cycle - 5.2) / 0.7) * Math.PI) : 0;
    }

    if (ball.state === 0) {
      ball.curveRpm = Math.max(0, ball.curveRpm - dt * 0.25);
      ball.spinAngle += (2.0 + ball.curveRpm * 24.0) * dt;
      return;
    }

    if (ball.state === 1) {
      ball.timer += dt;
      if (ball.timer >= 0.55) {
        // Verifica acerto no Pokémon alvo
        const w = wildSpawns[activeWildIdx] || wildSpawns[0];
        if (Math.abs(ball.vel.x) < 0.85) {
          const cfg = B.get();
          const prof = S.getProfile();
          let throwMult = 1.0, throwLabel = "Nice!";
          if (ball.ringRadius <= 0.34) {
            throwMult = cfg.excellentThrowMult || 1.85;
            throwLabel = "Excellent!";
            prof.stats.excellentThrows++;
          } else if (ball.ringRadius <= 0.66) {
            throwMult = cfg.greatThrowMult || 1.50;
            throwLabel = "Great!";
          } else {
            throwMult = cfg.niceThrowMult || 1.15;
          }
          if (ball.isCurveball) {
            throwMult *= (cfg.curveballBonusMult || 1.70);
            throwLabel += " + Curveball!";
            prof.stats.curveballsLanded++;
          }

          const medal = D.getTypeMedalInfo(prof, w.species.types[0]);
          const ballItem = D.ITEMS_CATALOG[activeBallType] || D.ITEMS_CATALOG.poke_ball;
          const berryItem = w.berryApplied ? D.ITEMS_CATALOG[w.berryApplied] : null;
          const berryMult = berryItem ? (berryItem.catchMult || 1.0) : 1.0;
          const globalMult = cfg.catchRateMultiplier || 1.15;

          const catchProb = Math.min(1.0,
            1.0 - Math.pow(1.0 - Math.min(0.95, w.species.baseCatchRate * globalMult),
                           ballItem.catchMult * berryMult * throwMult * medal.catchBonus)
          );

          ball.willCatch = (activeBallType === "master_ball") || (Math.random() <= catchProb);
          ball.shakesRequired = ball.willCatch ? 3 : (1 + Math.floor(Math.random() * 2));
          ball.throwBonusLabel = throwLabel;
          ball.throwBonusMult = throwMult;
          ball.state = 2; // Inicia Animação ENTRANDO NA POKÉBOLA!
          ball.timer = 0;
          A.playBallHit();
          S.showToast(`🎯 ${throwLabel}`, "info");
        } else {
          ball.state = 0;
          ball.curveRpm = 0;
        }
      }
    } else if (ball.state === 2) {
      // Estado 2: Pokémon ENTRANDO na Pokébola aberta
      ball.timer += dt;
      if (ball.timer >= 0.68) {
        const w = wildSpawns[activeWildIdx] || wildSpawns[0];
        w.insideBall = true;
        ball.state = 3;
        ball.timer = 0;
        ball.shakes = 0;
      }
    } else if (ball.state === 3) {
      // Estado 3: Balançando no chão
      ball.timer += dt;
      const sh = Math.floor(ball.timer / 0.68);
      if (sh > ball.shakes && sh <= ball.shakesRequired) {
        ball.shakes = sh;
        A.playBallShake(sh);
      }
      if (ball.timer >= (ball.shakesRequired * 0.68 + 0.35)) {
        const w = wildSpawns[activeWildIdx] || wildSpawns[0];
        if (ball.willCatch) {
          ball.state = 4;
          ball.timer = 0;
          completePokemonCapture(w);
        } else {
          // Pokémon ESCAPOU: Inicia Estado 5 (Animação SAINDO DA POKÉBOLA aberta!)
          ball.state = 5;
          ball.timer = 0;
          A.playBreakout();
          A.playPokemonCry(w.data.speciesId);
          S.showToast(`💢 ${w.species.name} saiu da Pokébola!`, "warn");
        }
      }
    } else if (ball.state === 4) {
      ball.timer += dt;
      if (ball.timer >= 1.15) {
        ball.state = 0;
        ball.curveRpm = 0;
        const prof = S.getProfile();
        const rolled = D.rollWeightedSpawn(B.get(), prof.level);
        const sp = D.getSpecies(rolled.speciesId);
        const ang = Math.random() * Math.PI * 2;
        const dist = 2.4 + Math.random() * 2.2;
        wildSpawns[activeWildIdx] = {
          data: rolled, species: sp,
          mapX: cityState.playerX + Math.sin(ang) * dist,
          mapZ: cityState.playerZ - Math.cos(ang) * dist,
          pos: E.vec3(0, -1.0, -3.4),
          visualScale: E.computeVisualScale(sp.height_m),
          jumpOffset: 0, actionTimer: 0,
          calmedByNanab: false, berryApplied: null, insideBall: false
        };
        toggleSceneMode("CITY_MAP");
        showPokemonDetailCardModal(prof.pokemonBox[0].uid);
      }
    } else if (ball.state === 5) {
      // Estado 5: Animação do Pokémon SAINDO da Pokébola aberta!
      ball.timer += dt;
      if (ball.timer >= 0.65) {
        const w = wildSpawns[activeWildIdx] || wildSpawns[0];
        w.insideBall = false;
        ball.state = 0;
        ball.curveRpm = 0;
      }
    }
  }

  function completePokemonCapture(w) {
    A.playGotchaFanfare();
    const prof = S.getProfile();
    const cfg = B.get();

    const berryItem = w.berryApplied ? D.ITEMS_CATALOG[w.berryApplied] : null;
    const candyMult = (berryItem ? (berryItem.candyMult || 1) : 1) * (cfg.candyMultiplier || 1);
    const candiesEarned = Math.round(3 * candyMult);
    const dustEarned = Math.round(100 * (cfg.stardustMultiplier || 1));
    const xpEarned = Math.round((100 + (ball.isCurveball ? 50 : 0)) * ball.throwBonusMult);

    prof.pokemonBox.unshift(w.data);
    prof.pokedexCaught[w.data.speciesId] = (prof.pokedexCaught[w.data.speciesId] || 0) + 1;
    prof.candies[w.data.speciesId] = (prof.candies[w.data.speciesId] || 0) + candiesEarned;

    if (!prof.typeCounts) prof.typeCounts = {};
    for (const t of w.species.types) {
      prof.typeCounts[t] = (prof.typeCounts[t] || 0) + 1;
    }

    prof.anomalyCharge = Math.min(100, (prof.anomalyCharge || 0) + 20);
    prof.stardust += dustEarned;
    prof.stats.totalCaught++;
    S.addXp(xpEarned);
    S.save();

    S.showToast(`✨ GOTCHA! ${w.species.name} foi capturado! (+${xpEarned} XP, +${candiesEarned} Candies)`, "info");
    updateHudCounters();
  }

  function updateCityMovement(dt) {
    const moving = cityState.joyActive && (Math.abs(cityState.joyDx) > 0.02 || Math.abs(cityState.joyDy) > 0.02);
    cityState.isWalking = moving;
    if (!moving) return;

    const speedMps = 4.0;
    const camYaw = cityState.camOrbitYaw;
    const fwdX = Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
    const rightX = Math.cos(camYaw), rightZ = Math.sin(camYaw);

    const worldDx = (rightX * cityState.joyDx - fwdX * cityState.joyDy) * speedMps * dt;
    const worldDz = (rightZ * cityState.joyDx - fwdZ * cityState.joyDy) * speedMps * dt;

    cityState.playerX += worldDx;
    cityState.playerZ += worldDz;
    cityState.facingYaw = Math.atan2(worldDx, worldDz);

    const distMetersReal = Math.hypot(worldDx, worldDz) * 4.0;
    if (distMetersReal > 0.01) {
      const prof = S.getProfile();
      prof.distanceWalkedM = Number((prof.distanceWalkedM + distMetersReal).toFixed(1));
      prof.buddyWalkProgressM += distMetersReal;

      const buddyThreshold = B.get().buddyDistancePerCandyM || 250;
      if (prof.buddyWalkProgressM >= buddyThreshold) {
        prof.buddyWalkProgressM -= buddyThreshold;
        prof.anomalyCharge = Math.min(100, (prof.anomalyCharge || 0) + 15);
        const buddy = prof.pokemonBox.find(p => p.uid === prof.buddyUid) || prof.pokemonBox[0];
        if (buddy) {
          prof.candies[buddy.speciesId] = (prof.candies[buddy.speciesId] || 0) + 1;
          prof.stardust += 250;
          S.addXp(150);
          S.showToast(`💛 ${buddy.name} encontrou +1 Candy caminhando com você!`, "info");
        }
        spawnWildWave(false);
        updateHudCounters();
      }
    }
  }

  // ============================================================================
  // MENU RADIAL E MODAIS REDESENHADOS NO LAYOUT CLARO DO POKÉMON GO (REFS)
  // ============================================================================
  function openRadialMenu() {
    A.playUiClick();
    const prof = S.getProfile();
    const lbl = document.getElementById("radial-anomaly-lbl");
    if (lbl) lbl.textContent = `ANOMALY (${prof.anomalyCharge || 0}%)`;
    document.getElementById("pogo-radial-menu").style.display = "flex";
  }

  function closeRadialMenu() {
    A.playUiClick();
    document.getElementById("pogo-radial-menu").style.display = "none";
  }

  function openModal(title, htmlContent) {
    closeRadialMenu();
    A.playUiClick();
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = htmlContent;
    modal.classList.add("open");
  }

  function closeModal() {
    A.playUiClick();
    document.getElementById("game-modal").classList.remove("open");
  }

  // 1. Modal POKÉMON BOX (Grade de 3 Colunas idêntica à Ref 22.18.11 (1).jpeg)
  function showPokemonBoxModal(searchQuery = "") {
    const prof = S.getProfile();
    const q = (searchQuery || "").toLowerCase();
    const list = prof.pokemonBox.filter(p => !q || p.name.toLowerCase().includes(q) || String(p.speciesId) === q);

    let html = `
      <div style="display:flex;justify-content:space-around;font-size:12px;font-weight:800;color:#7a9a9e;margin-bottom:10px;">
        <span>TAGS</span>
        <span style="color:#254a52;border-bottom:3px solid #254a52;padding-bottom:4px;">POKÉMON (${prof.pokemonBox.length}/500)</span>
        <span onclick="window.PokeGameUI.showRareProgressAndMedalsModal()" style="cursor:pointer;">MEDALS</span>
      </div>
      <input class="pogo-search-bar" placeholder="🔍 Search Pokémon or #ID..." value="${searchQuery}"
        oninput="window.PokeGameUI.showPokemonBoxModal(this.value)"/>
      <div class="pogo-3col-grid">`;

    for (const pk of list) {
      const imgSrc = E.getPokemonCardImageSrc(pk.speciesId, pk.isShiny, false);
      html += `<div class="pogo-mon-cell ${pk.isShiny ? "shiny" : ""}" onclick="window.PokeGameUI.showPokemonDetailCardModal('${pk.uid}')">
        <div class="pogo-cp-top">CP <b>${pk.cp}</b></div>
        <img class="pogo-mon-img" src="${imgSrc}" alt="${pk.name}"/>
        <div class="pogo-mon-name">${pk.isShiny ? "✨" : ""}${pk.name}</div>
        <div class="pogo-hp-line"></div>
      </div>`;
    }
    html += `</div>`;
    openModal("POKÉMON", html);
  }

  // Ficha Completa do Pokémon (Com Peso, Altura, Tipo, CP, HP, IVs, Power Up e Evolução dentro do Card!)
  function showPokemonDetailCardModal(uid) {
    const prof = S.getProfile();
    const pk = prof.pokemonBox.find(p => p.uid === uid);
    if (!pk) return;
    const sp = D.getSpecies(pk.speciesId);
    const iv = D.evaluateIvStars(pk.ivAtk, pk.ivDef, pk.ivSta);
    const candies = prof.candies[pk.speciesId] || 0;
    const isBuddy = prof.buddyUid === pk.uid;
    const nextSp = sp.evolvesTo > 0 ? D.getSpecies(sp.evolvesTo) : null;
    const imgSrc = E.getPokemonCardImageSrc(pk.speciesId, pk.isShiny, false);

    const html = `
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-size:13px;color:#5a8288;font-weight:800;">CP <span style="font-size:28px;color:#254a52;">${pk.cp}</span></div>
        <img src="${imgSrc}" style="width:136px;height:136px;object-fit:contain;margin:4px auto;display:block;" onclick="window.PokeAudio.playPokemonCry(${sp.id})"/>
      </div>
      <div class="pogo-white-card" style="text-align:center;">
        <h2 style="font-size:22px;color:#254a52;">${pk.isShiny ? "✨ " : ""}${pk.name}</h2>
        <div style="width:55%;height:6px;background:#26ccaa;border-radius:3px;margin:8px auto 4px;"></div>
        <div style="font-size:12px;font-weight:800;color:#5a8288;">${pk.hp} / ${pk.maxHp} HP</div>

        <div class="stat-capsules-row">
          <div>
            <div class="stat-cap-val">${sp.weight_kg} kg</div>
            <div class="stat-cap-lbl">WEIGHT</div>
          </div>
          <div style="border-left:1px solid #e5f0ec;border-right:1px solid #e5f0ec;">
            <div class="stat-cap-val">${sp.types.join(" / ")}</div>
            <div class="stat-cap-lbl">TYPE</div>
          </div>
          <div>
            <div class="stat-cap-val">${sp.height_m} m</div>
            <div class="stat-cap-lbl">HEIGHT</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-around;font-size:13px;font-weight:800;margin-bottom:14px;">
          <span>✨ ${prof.stardust} STARDUST</span>
          <span>🍬 ${candies} ${sp.name.toUpperCase()} CANDY</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.powerUpPokemon('${pk.uid}')">
            POWER UP (250 ✨ + 1 🍬)
          </button>
          ${nextSp ? `<button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.evolvePokemon('${pk.uid}')">
            EVOLVE → ${nextSp.name.toUpperCase()} (${sp.candyCost} 🍬)
          </button>` : ""}
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.setBuddyPokemon('${pk.uid}')">
            ${isBuddy ? "💛 CURRENT BUDDY POKÉMON" : "🐾 SET AS BUDDY POKÉMON"}
          </button>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5f0ec;text-align:left;font-size:13px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <b>⚡ Fast Move: ${pk.fastMove}</b>
            <b>💥 Charged: ${pk.chargedMove}</b>
          </div>
          <div style="background:#f0faf6;padding:10px;border-radius:10px;margin-top:8px;">
            <div style="font-weight:800;color:#1c7c74;margin-bottom:4px;">APPRAISAL: ${iv.label}</div>
            <div style="font-size:11px;font-weight:700;color:#254a52;">
              ATTACK: ${pk.ivAtk}/15 • DEFENSE: ${pk.ivDef}/15 • HP: ${pk.ivSta}/15
            </div>
          </div>
        </div>
      </div>`;
    openModal(pk.name.toUpperCase(), html);
  }

  // 2. Modal POKÉDEX Com Banners Regionais e SILHUETA 3D ESCURA para Pokémons Não Encontrados (Ref: 22.18.12.jpeg)
  function showPokedexModal(page = 0) {
    const prof = S.getProfile();
    const perPage = 36;
    const startId = page * perPage + 1;
    const endId = Math.min(1025, startId + perPage - 1);
    const totalCaught = Object.keys(prof.pokedexCaught).length;

    let html = `
      <div class="pogo-region-banner">
        <div>
          <div class="pogo-region-title">NATIONAL DEX</div>
          <div class="pogo-region-sub">Caught: ${totalCaught} / 1025</div>
        </div>
        <button class="pogo-pill-btn" style="padding:8px 14px;font-size:11px;"
          onclick="window.PokeGameUI.syncCurrentPageWiki(${startId}, ${endId}, ${page})">
          🌐 SYNC WIKI
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <button class="pogo-pill-btn secondary" style="padding:6px 14px;" ${page === 0 ? "disabled" : ""}
          onclick="window.PokeGameUI.showPokedexModal(${page - 1})">◀ PREV</button>
        <b style="font-size:13px;">#${startId} – #${endId}</b>
        <button class="pogo-pill-btn secondary" style="padding:6px 14px;" ${endId >= 1025 ? "disabled" : ""}
          onclick="window.PokeGameUI.showPokedexModal(${page + 1})">NEXT ▶</button>
      </div>
      <div class="pogo-3col-grid">`;

    for (let id = startId; id <= endId; ++id) {
      const sp = D.getSpecies(id);
      const caughtCount = prof.pokedexCaught[id] || 0;
      const isUnseen = caughtCount === 0;
      // Se ainda não encontrou o Pokémon, gera a SILHUETA 3D ESCURA do monstro!
      const imgSrc = E.getPokemonCardImageSrc(id, false, isUnseen);

      html += `<div class="pogo-mon-cell" onclick="window.PokeAudio.playPokemonCry(${id})">
        <div class="pogo-cp-top">#${id}</div>
        <img class="pogo-mon-img" src="${imgSrc}" alt="${sp.name}"/>
        <div class="pogo-mon-name">${isUnseen ? "???" : sp.name}</div>
        <div style="font-size:10px;color:#7a9a9e;font-weight:700;">${isUnseen ? sp.types.join("/") : `Caught: ${caughtCount}`}</div>
      </div>`;
    }
    html += `</div>`;
    openModal("POKÉDEX", html);
  }

  // 3. Modal NEARBY TRACKER (Anéis Azuis Concentricos + Silhuetas 3D igual à Ref 22.18.13 (1).jpeg!)
  function showNearbyTrackerModal() {
    const prof = S.getProfile();
    let html = `
      <div style="display:flex;justify-content:space-around;font-size:12px;font-weight:800;color:#7a9a9e;margin-bottom:16px;border-bottom:1px solid #d5ebe4;padding-bottom:8px;">
        <span style="color:#254a52;border-bottom:3px solid #254a52;padding-bottom:6px;">POKÉMON</span>
        <span onclick="window.PokeGameUI.showBattleHubModal()" style="cursor:pointer;">RAID</span>
        <span onclick="window.PokeGameUI.triggerAnomalyScanner()" style="cursor:pointer;">ANOMALY</span>
      </div>
      <div class="pogo-3col-grid">`;

    for (let i = 0; i < wildSpawns.length; ++i) {
      const w = wildSpawns[i];
      const isUncaught = !prof.pokedexCaught[w.data.speciesId];
      const imgSrc = E.getPokemonCardImageSrc(w.data.speciesId, w.data.isShiny, isUncaught);
      html += `<div class="nearby-ring-cell" onclick="window.PokeGameUI.closeModal();window.PokeGameUI.enterArEncounterWithWild(${i});">
        <div class="nearby-blue-disc">
          <img src="${imgSrc}" alt="${w.species.name}"/>
        </div>
        <div style="font-size:11px;font-weight:800;margin-top:8px;color:#254a52;">
          ${isUncaught ? "???" : w.species.name}
        </div>
      </div>`;
    }
    html += `</div>`;
    openModal("NEARBY", html);
  }

  // 4. Modal PERFIL DO TREINADOR & MEDALHAS (Ref: 22.18.10 (1).jpeg & 22.18.09 (2).jpeg)
  function showTrainerProfileModal() {
    const prof = S.getProfile();
    const buddy = prof.pokemonBox.find(p => p.uid === prof.buddyUid) || prof.pokemonBox[0];
    const buddyImg = buddy ? E.getPokemonCardImageSrc(buddy.speciesId, buddy.isShiny, false) : "";
    const xpNeeded = prof.level < 50 ? (prof.level * 1200) : 65000;
    const xpPct = Math.min(100, Math.round((prof.xp / xpNeeded) * 100));

    let html = `
      <div class="pogo-white-card" style="text-align:center;">
        <div style="display:flex;justify-content:center;align-items:center;gap:16px;margin-bottom:10px;">
          <div>
            <h2 style="font-size:22px;color:#254a52;">${prof.trainerName}</h2>
            <div style="font-size:13px;font-weight:800;color:#1c8c82;">& ${buddy ? buddy.name : "Pikachu"} 💛</div>
          </div>
          ${buddyImg ? `<img src="${buddyImg}" style="width:92px;height:92px;object-fit:contain;"/>` : ""}
        </div>

        <div style="text-align:left;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;font-weight:800;">
            <span style="font-size:24px;color:#2563eb;">${prof.level} <small style="font-size:11px;">LEVEL</small></span>
            <span style="font-size:12px;color:#5a8288;">${prof.xp} / ${xpNeeded} XP</span>
          </div>
          <div style="width:100%;height:8px;background:#dbeafe;border-radius:4px;overflow:hidden;margin-top:4px;">
            <div style="width:${xpPct}%;height:100%;background:#3b82f6;"></div>
          </div>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5f0ec;text-align:left;font-size:13px;font-weight:700;">
          <div style="text-align:center;font-size:11px;color:#7a9a9e;letter-spacing:1px;margin-bottom:8px;">TOTAL ACTIVITY</div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>👣 Distance Walked</span><b>${((prof.distanceWalkedM || 0)/1000).toFixed(2)} km</b></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>🔴 Pokémon Caught</span><b>${prof.stats.totalCaught}</b></div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>🪙 PokéCoins</span><b>${prof.pokecoins}</b></div>
        </div>
      </div>

      <div style="text-align:center;font-size:12px;font-weight:800;color:#7a9a9e;letter-spacing:1px;margin:14px 0 8px;">MEDALS</div>
      <div class="pogo-3col-grid">`;

    for (const tName of Object.keys(D.TYPE_COLORS)) {
      const m = D.getTypeMedalInfo(prof, tName);
      html += `<div class="pogo-mon-cell">
        <div style="font-size:26px;">${m.icon}</div>
        <div class="pogo-mon-name">${tName}</div>
        <div style="font-size:10px;color:#1c8c82;font-weight:800;">${m.tier} (${m.count})</div>
      </div>`;
    }
    html += `</div>`;
    openModal("ME", html);
  }

  function showRareProgressAndMedalsModal() {
    showTrainerProfileModal();
  }

  // 5. Modal SHOP (Ref: 22.18.10 (3).jpeg — Daily Free Box + Itens por PokéCoins Grátis!)
  function showShopModal() {
    const prof = S.getProfile();
    const html = `
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:24px;font-weight:800;color:#254a52;">🪙 ${prof.pokecoins}</div>
        <div style="font-size:11px;color:#7a9a9e;font-weight:700;">100% FREE POKÉCOINS (EARNED IN GYMS & PASS)</div>
      </div>
      <div class="pogo-white-card" style="text-align:center;">
        <div style="font-size:38px;">🎁</div>
        <div style="font-weight:800;margin:6px 0;">DAILY FREE BOX</div>
        <button class="pogo-pill-btn" onclick="window.PokeGameUI.claimDailyFreeBox()">CLAIM FREE</button>
      </div>
      <div class="pogo-3col-grid">
        <div class="pogo-mon-cell" onclick="window.PokeGameUI.buyWithFreeCoins('poke_ball', 20, 50)">
          <div style="font-size:28px;">🔴</div>
          <div class="pogo-mon-name">20 Poké Balls</div>
          <div style="font-size:12px;font-weight:800;color:#1c8c82;margin-top:4px;">🪙 50</div>
        </div>
        <div class="pogo-mon-cell" onclick="window.PokeGameUI.buyWithFreeCoins('ultra_ball', 10, 80)">
          <div style="font-size:28px;">🟡</div>
          <div class="pogo-mon-name">10 Ultra Balls</div>
          <div style="font-size:12px;font-weight:800;color:#1c8c82;margin-top:4px;">🪙 80</div>
        </div>
        <div class="pogo-mon-cell" onclick="window.PokeGameUI.buyWithFreeCoins('incense', 2, 60)">
          <div style="font-size:28px;">🌸</div>
          <div class="pogo-mon-name">2 Incense</div>
          <div style="font-size:12px;font-weight:800;color:#1c8c82;margin-top:4px;">🪙 60</div>
        </div>
      </div>`;
    openModal("SHOP", html);
  }

  function claimDailyFreeBox() {
    const prof = S.getProfile();
    prof.bag.poke_ball = (prof.bag.poke_ball || 0) + 10;
    prof.bag.razz_berry = (prof.bag.razz_berry || 0) + 5;
    prof.stardust += 500;
    S.save();
    A.playGotchaFanfare();
    S.showToast("🎁 Daily Free Box resgatada! +10 Poké Balls, +5 Razz Berries e +500 Stardust!", "info");
    closeModal();
  }

  function buyWithFreeCoins(itemKey, qty, cost) {
    const prof = S.getProfile();
    if (prof.pokecoins < cost) {
      S.showToast("⚠️ PokéCoins insuficientes! Vença Ginásios ou suba de nível.", "warn");
      return;
    }
    prof.pokecoins -= cost;
    prof.bag[itemKey] = (prof.bag[itemKey] || 0) + qty;
    S.save();
    A.playGotchaFanfare();
    S.showToast(`🛍️ Adquirido +${qty} ${D.ITEMS_CATALOG[itemKey].name}!`, "info");
    showShopModal();
  }

  // 6. Modal ITEMS BAG (Ref: 22.18.10 (2).jpeg)
  function showBagModal(filterCat = null) {
    const prof = S.getProfile();
    let html = `<div style="display:flex;flex-direction:column;gap:10px;">`;
    for (const key of Object.keys(D.ITEMS_CATALOG)) {
      const it = D.ITEMS_CATALOG[key];
      if (filterCat && it.cat !== filterCat) continue;
      const count = prof.bag[key] || 0;
      html += `<div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">${it.icon}</span>
          <div>
            <div style="font-weight:800;font-size:14px;">${it.name} <span style="color:#1c8c82;">x${count}</span></div>
            <div style="font-size:11px;color:#5a8288;">${it.desc}</div>
          </div>
        </div>
        <button class="pogo-pill-btn" style="padding:8px 14px;font-size:11px;" onclick="window.PokeGameUI.useBagItem('${key}')">USE</button>
      </div>`;
    }
    html += `</div>`;
    openModal("ITEMS", html);
  }

  function useBagItem(itemKey) {
    const prof = S.getProfile();
    if ((prof.bag[itemKey] || 0) <= 0) {
      S.showToast("⚠️ Você não possui este item!", "warn");
      return;
    }
    const it = D.ITEMS_CATALOG[itemKey];
    if (it.cat === "ball") {
      activeBallType = itemKey;
      S.showToast(`${it.icon} ${it.name} equipada!`, "info");
      closeModal();
    } else if (it.cat === "berry") {
      const w = wildSpawns[activeWildIdx] || wildSpawns[0];
      if (!w || w.berryApplied) {
        S.showToast("⚠️ Já há uma fruta ativa neste Pokémon!", "warn");
        return;
      }
      prof.bag[itemKey]--;
      w.berryApplied = itemKey;
      if (it.calm) w.calmedByNanab = true;
      S.save();
      S.showToast(`${it.icon} ${it.name} aplicada em ${w.species.name}!`, "info");
      closeModal();
    } else if (itemKey === "incense") {
      prof.bag.incense--;
      spawnWildWave(false);
      S.save();
      S.showToast("🌸 Incense ativado! Novos Pokémons surgiram no Mapa!", "info");
      closeModal();
    } else {
      prof.bag[itemKey]--;
      S.addXp(250);
      S.save();
      S.showToast(`${it.icon} ${it.name} usado!`, "info");
      showBagModal();
    }
  }

  // 7. Modal GO BATTLE LEAGUE & RAIDS (Ref: 22.18.09.jpeg & 22.18.09 (1).jpeg)
  function showBattleHubModal() {
    const prof = S.getProfile();
    const html = `
      <div class="pogo-white-card" style="text-align:center;">
        <div style="font-size:13px;font-weight:800;color:#1c8c82;letter-spacing:1px;">GO BATTLE LEAGUE</div>
        <div style="font-size:12px;color:#5a8288;margin:4px 0 12px;">Wins: ${prof.stats.gymsWon + prof.stats.raidsWon} • Stardust Earned: ${prof.stardust}</div>
        <button class="pogo-pill-btn" style="width:100%;" onclick="window.PokeGameUI.startBattle('GYM', 26, 1850)">
          ⚔️ GREAT LEAGUE / GYM BATTLE (+50 🪙)
        </button>
      </div>
      <div class="pogo-white-card" style="text-align:center;">
        <div style="font-size:13px;font-weight:800;color:#e11d48;letter-spacing:1px;">5-STAR LEGENDARY RAIDS</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.startBattle('RAID', 150, 4200)">👹 RAID: MEWTWO (CP 4200)</button>
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.startBattle('RAID', 384, 4500)">🐉 RAID: RAYQUAZA (CP 4500)</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.startBattle('VILLAIN', 94, 2100)">🎈 TEAM ROCKET BALLOON (GENGAR)</button>
        </div>
      </div>`;
    openModal("BATTLE", html);
  }

  function startBattle(mode, enemySpeciesId, enemyCp) {
    const prof = S.getProfile();
    const myPk = prof.pokemonBox[0];
    const enemySp = D.getSpecies(enemySpeciesId);
    battleState = {
      mode, playerPk: myPk,
      playerHp: myPk.maxHp || 120, playerMaxHp: myPk.maxHp || 120, playerEnergy: 0,
      enemySpecies: enemySp, enemyCp,
      enemyMaxHp: Math.round(140 + enemyCp * 0.045),
      enemyHp: Math.round(140 + enemyCp * 0.045),
      log: `${myPk.name} vs ${enemySp.name}!`
    };
    renderActiveBattleModal();
  }

  function renderActiveBattleModal() {
    if (!battleState) return;
    const b = battleState;
    const pPct = Math.max(0, Math.round((b.playerHp / b.playerMaxHp) * 100));
    const ePct = Math.max(0, Math.round((b.enemyHp / b.enemyMaxHp) * 100));
    const cm = D.CHARGED_MOVES[b.playerPk.chargedMove] || D.CHARGED_MOVES.Thunderbolt;
    const canCharged = b.playerEnergy >= cm.energyCost;
    const enemyImg = E.getPokemonCardImageSrc(b.enemySpecies.id, false, false);
    const myImg = E.getPokemonCardImageSrc(b.playerPk.speciesId, b.playerPk.isShiny, false);

    const html = `
      <div class="pogo-white-card" style="text-align:center;">
        <div style="display:flex;justify-content:space-around;align-items:center;">
          <div>
            <img src="${enemyImg}" style="width:86px;height:86px;object-fit:contain;"/>
            <div style="font-weight:800;">${b.enemySpecies.name}</div>
            <div style="width:110px;height:7px;background:#fee2e2;border-radius:4px;overflow:hidden;margin:4px auto;">
              <div style="width:${ePct}%;height:100%;background:#ef4444;"></div>
            </div>
          </div>
          <div style="font-size:20px;font-weight:900;color:#1c8c82;">VS</div>
          <div>
            <img src="${myImg}" style="width:86px;height:86px;object-fit:contain;"/>
            <div style="font-weight:800;">${b.playerPk.name}</div>
            <div style="width:110px;height:7px;background:#d1fae5;border-radius:4px;overflow:hidden;margin:4px auto;">
              <div style="width:${pPct}%;height:100%;background:#10b981;"></div>
            </div>
          </div>
        </div>
        <div style="margin:12px 0;font-weight:800;color:#1c8c82;">${b.log}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="pogo-pill-btn" onclick="window.PokeGameUI.executeBattleTurn(false)">
            ⚡ FAST ATTACK: ${b.playerPk.fastMove}
          </button>
          <button class="pogo-pill-btn ${canCharged ? "" : "secondary"}" ${canCharged ? "" : "disabled"}
            onclick="window.PokeGameUI.executeBattleTurn(true)">
            💥 CHARGED: ${cm.name} (${b.playerEnergy}/${cm.energyCost})
          </button>
        </div>
      </div>`;
    openModal(`BATTLE (${b.mode})`, html);
  }

  function executeBattleTurn(useCharged) {
    if (!battleState) return;
    const b = battleState;
    const fm = D.FAST_MOVES[b.playerPk.fastMove] || D.FAST_MOVES.QuickAttack;
    const cm = D.CHARGED_MOVES[b.playerPk.chargedMove] || D.CHARGED_MOVES.Thunderbolt;
    const move = useCharged ? cm : fm;
    if (useCharged && b.playerEnergy < cm.energyCost) return;
    A.playAttack(useCharged);

    const eff = D.getTypeEffectiveness(move.type, b.enemySpecies.types);
    const dmg = Math.max(8, Math.round((useCharged ? move.power * 0.8 : move.power * 2.4) * eff * (1 + b.playerPk.cp / 1400)));
    b.enemyHp = Math.max(0, b.enemyHp - dmg);
    if (useCharged) b.playerEnergy -= cm.energyCost;
    else b.playerEnergy = Math.min(100, b.playerEnergy + fm.energyGain * 2);

    b.log = `${b.playerPk.name} used ${move.name} (${dmg} dmg)!`;

    if (b.enemyHp <= 0) {
      const prof = S.getProfile();
      const coins = B.get().gymCoinReward || 50;
      prof.pokecoins += coins;
      prof.stardust += 1000;
      prof.anomalyCharge = Math.min(100, (prof.anomalyCharge || 0) + 35);
      S.addXp(1000);
      prof.stats.gymsWon++;
      S.save();

      const bossWild = D.rollWeightedSpawn(Object.assign({}, B.get(), { wildIvFloor: 12 }), prof.level + 5);
      bossWild.speciesId = b.enemySpecies.id;
      bossWild.name = b.enemySpecies.name;
      bossWild.cp = D.calculateCP(b.enemySpecies.id, 25, bossWild.ivAtk, bossWild.ivDef, bossWild.ivSta);
      wildSpawns[0] = {
        data: bossWild, species: b.enemySpecies,
        mapX: cityState.playerX, mapZ: cityState.playerZ - 2.5,
        pos: E.vec3(0, -1.0, -3.4),
        visualScale: E.computeVisualScale(b.enemySpecies.height_m),
        jumpOffset: 0, actionTimer: 0,
        calmedByNanab: false, berryApplied: null, insideBall: false
      };

      A.playGotchaFanfare();
      S.showToast(`🏆 VICTORY! +${coins} PokéCoins & +1,000 Stardust! Catch ${b.enemySpecies.name}!`, "info");
      battleState = null;
      closeModal();
      enterArEncounterWithWild(0);
      updateHudCounters();
      return;
    }

    b.playerHp = Math.max(1, b.playerHp - Math.max(5, Math.round(10 + b.enemyCp * 0.004)));
    renderActiveBattleModal();
  }

  // 8. Modal GO PASS & FIELD RESEARCH (Ref: 22.18.11 (2).jpeg & 22.18.12 (2).jpeg)
  function showBattlePassModal() {
    const prof = S.getProfile();
    const xpPerTier = B.get().battlePassXpPerTier || 1000;
    const currentTier = Math.floor(prof.battlePassXp / xpPerTier) + 1;

    let html = `
      <div class="pogo-white-card" style="background:linear-gradient(135deg,#fb923c,#f59e0b);color:#ffffff;text-align:center;">
        <div style="font-size:16px;font-weight:800;">📦 Field Research & GO Pass</div>
        <div style="font-size:13px;margin-top:4px;">CURRENT RANK: <b>TIER ${currentTier}</b> (100% Free • Zero Gacha)</div>
      </div>`;

    const rewards = [
      { tier: 1,  label: "10x Great Balls + 500 Stardust", item: "great_ball", qty: 10, dust: 500 },
      { tier: 2,  label: "5x Pinap Berries + 2x Rare Candy", item: "rare_candy", qty: 2, dust: 500 },
      { tier: 3,  label: "10x Ultra Balls + 1,000 Stardust", item: "ultra_ball", qty: 10, dust: 1000 },
      { tier: 5,  label: "2x Incense + 1,500 Stardust", item: "incense", qty: 2, dust: 1500 },
      { tier: 10, label: "🟣 1x MASTER BALL + 5,000 Stardust", item: "master_ball", qty: 1, dust: 5000 }
    ];

    for (const r of rewards) {
      const unlocked = currentTier >= r.tier;
      const claimed = prof.battlePassClaimed.includes(r.tier);
      html += `<div class="pogo-white-card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:800;color:#1c8c82;">TIER ${r.tier}</div>
          <div style="font-size:13px;font-weight:700;">${r.label}</div>
        </div>
        <button class="pogo-pill-btn ${(!unlocked || claimed) ? "secondary" : ""}" ${(!unlocked || claimed) ? "disabled" : ""}
          onclick="window.PokeGameUI.claimBattlePassTier(${r.tier}, '${r.item}', ${r.qty}, ${r.dust})">
          ${claimed ? "CLAIMED ✓" : "CLAIM"}
        </button>
      </div>`;
    }
    openModal("GO PASS & RESEARCH", html);
  }

  function claimBattlePassTier(tier, itemKey, qty, dust) {
    const prof = S.getProfile();
    if (prof.battlePassClaimed.includes(tier)) return;
    prof.battlePassClaimed.push(tier);
    prof.bag[itemKey] = (prof.bag[itemKey] || 0) + qty;
    prof.stardust += dust;
    S.save();
    A.playGotchaFanfare();
    S.showToast(`🎁 Tier ${tier} resgatado!`, "info");
    showBattlePassModal();
  }

  // 9. Modal SETTINGS, SAVE BACKUP, SOM, BUG REPORT & ADMIN
  function showSystemAndCrowdfundingModal() {
    const html = `
      <div class="pogo-white-card">
        <h3 style="margin-bottom:8px;">🔊 Sound & Music</h3>
        <div style="display:flex;gap:8px;">
          <button class="pogo-pill-btn secondary" onclick="window.PokeAudio.toggleSound()">🔊 Toggle SFX</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeAudio.toggleBgm()">🎵 Toggle BGM</button>
        </div>
      </div>

      <div class="pogo-white-card">
        <h3 style="margin-bottom:8px;">💾 Save Backup (IndexedDB + JSON)</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="pogo-pill-btn" onclick="window.PokeStorage.exportSaveFile()">⬇️ Export Save (.JSON)</button>
          <button class="pogo-pill-btn secondary" onclick="document.getElementById('import-file-inp').click()">⬆️ Import Save</button>
        </div>
      </div>

      <div class="pogo-white-card">
        <h3 style="margin-bottom:8px;">🐞 Quick Bug Report (2 Clicks)</h3>
        <input id="bug-desc" class="pogo-search-bar" style="margin-bottom:8px;" placeholder="Descreva rapidamente (opcional)..."/>
        <button class="pogo-pill-btn" onclick="window.PokeGameUI.submitQuickBugReport()">🚀 Send Bug Report</button>
      </div>

      <div class="pogo-white-card">
        <h3 style="margin-bottom:8px;">⚙️ Admin & 1-Click PWA</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="pogo-pill-btn" onclick="window.open('admin.html', '_blank')">⚙️ Admin Balance Panel</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.installOneClickPwa()">📲 Install App</button>
          <button class="pogo-pill-btn secondary" onclick="window.PokeGameUI.uninstallOneClickPwa()">🗑️ Reset Cache</button>
        </div>
      </div>`;
    openModal("SETTINGS", html);
  }

  function submitQuickBugReport() {
    const desc = document.getElementById("bug-desc") ? document.getElementById("bug-desc").value : "";
    const report = {
      timestamp: new Date().toISOString(),
      category: "mobile_feedback",
      description: desc || "Reporte rápido em 2 cliques",
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      fps: Math.round(1000 / Math.max(1, emaFrameMs))
    };
    const existing = JSON.parse(localStorage.getItem("pokeascii_bug_reports") || "[]");
    existing.unshift(report);
    localStorage.setItem("pokeascii_bug_reports", JSON.stringify(existing));
    fetch("/api/bug-report", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report)
    }).catch(() => {});
    S.showToast("✅ Bug report enviado com sucesso!", "info");
    closeModal();
  }

  async function installOneClickPwa() {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice;
      deferredPwaPrompt = null;
    } else {
      S.showToast("📲 No iPhone use 'Compartilhar -> Adicionar à Tela de Início'.", "info");
    }
  }

  async function uninstallOneClickPwa() {
    if (!confirm("Limpar cache e reiniciar em 1 clique?")) return;
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    localStorage.clear();
    location.reload();
  }

  function triggerAnomalyScanner() {
    closeRadialMenu();
    const prof = S.getProfile();
    if ((prof.anomalyCharge || 0) < 100) {
      S.showToast(`📡 Scanner de Anomalia em ${prof.anomalyCharge || 0}% (Capture Pokémons ou gire PokéStops p/ chegar a 100%)!`, "info");
      return;
    }
    prof.anomalyCharge = 0;
    S.save();
    spawnWildWave(true);
    S.showToast(`🌌 ANOMALIA 3D DETECTADA! ${wildSpawns[0].species.name} surgiu ao seu lado no Mapa!`, "info");
  }

  function powerUpPokemon(uid) {
    const prof = S.getProfile();
    const pk = prof.pokemonBox.find(p => p.uid === uid);
    if (!pk) return;
    const candies = prof.candies[pk.speciesId] || 0;
    if (prof.stardust < 250 || candies < 1) {
      S.showToast("⚠️ Stardust (250) ou Candy (1) insuficiente!", "warn");
      return;
    }
    prof.stardust -= 250;
    prof.candies[pk.speciesId]--;
    pk.level++;
    pk.cp = D.calculateCP(pk.speciesId, pk.level, pk.ivAtk, pk.ivDef, pk.ivSta);
    pk.maxHp = D.calculateMaxHP(pk.speciesId, pk.level, pk.ivSta);
    pk.hp = pk.maxHp;
    S.save();
    A.playGotchaFanfare();
    showPokemonDetailCardModal(uid);
  }

  function evolvePokemon(uid) {
    const prof = S.getProfile();
    const pk = prof.pokemonBox.find(p => p.uid === uid);
    if (!pk) return;
    const sp = D.getSpecies(pk.speciesId);
    if (!sp.evolvesTo) return;
    const candies = prof.candies[pk.speciesId] || 0;
    if (candies < sp.candyCost) {
      S.showToast(`⚠️ Requer ${sp.candyCost} Candies!`, "warn");
      return;
    }
    prof.candies[pk.speciesId] -= sp.candyCost;
    const nextSp = D.getSpecies(sp.evolvesTo);
    pk.speciesId = nextSp.id;
    pk.name = nextSp.name;
    pk.fastMove = nextSp.fastMove;
    pk.chargedMove = nextSp.chargedMove;
    pk.cp = D.calculateCP(pk.speciesId, pk.level, pk.ivAtk, pk.ivDef, pk.ivSta);
    pk.maxHp = D.calculateMaxHP(pk.speciesId, pk.level, pk.ivSta);
    pk.hp = pk.maxHp;
    prof.pokedexCaught[nextSp.id] = (prof.pokedexCaught[nextSp.id] || 0) + 1;
    S.addXp(500);
    S.save();
    A.playGotchaFanfare();
    A.playPokemonCry(nextSp.id);
    showPokemonDetailCardModal(uid);
    updateHudCounters();
  }

  function setBuddyPokemon(uid) {
    const prof = S.getProfile();
    prof.buddyUid = uid;
    S.save();
    showPokemonDetailCardModal(uid);
    updateHudCounters();
  }

  async function syncCurrentPageWiki(startId, endId, page) {
    S.showToast(`🌐 Sincronizando #${startId}..#${endId} com a PokéAPI...`, "info");
    const promises = [];
    for (let id = startId; id <= endId; ++id) promises.push(D.syncSpeciesFromPokeAPI(id));
    await Promise.all(promises);
    B.save(Object.assign({}, B.get(), { activeDexLimit: Math.max(B.get().activeDexLimit, endId) }));
    showPokedexModal(page);
  }

  function updateHudCounters() {
    const prof = S.getProfile();
    const elLvl = document.getElementById("hud-level-num");
    if (elLvl) elLvl.textContent = prof.level;
    const elName = document.getElementById("hud-trainer-name");
    if (elName) elName.textContent = prof.trainerName;

    const buddy = prof.pokemonBox.find(p => p.uid === prof.buddyUid) || prof.pokemonBox[0];
    const elBuddy = document.getElementById("hud-buddy-icon");
    if (elBuddy && buddy) {
      elBuddy.innerHTML = `<img src="${E.getPokemonCardImageSrc(buddy.speciesId, buddy.isShiny, false)}" alt="Buddy"/>`;
    }
    updateNearbyPillIcons();
  }

  function updateNearbyPillIcons() {
    const prof = S.getProfile();
    const pill = document.getElementById("nearby-pill");
    if (!pill) return;
    let html = "";
    for (let i = 0; i < Math.min(3, wildSpawns.length); ++i) {
      const w = wildSpawns[i];
      const isUncaught = !prof.pokedexCaught[w.data.speciesId];
      html += `<img src="${E.getPokemonCardImageSrc(w.data.speciesId, false, isUncaught)}" alt="nearby"/>`;
    }
    pill.innerHTML = html;
  }

  function toggleSceneMode(forcedMode = null) {
    A.playUiClick();
    gameScene = forcedMode || (gameScene === "CITY_MAP" ? "AR_CAPTURE" : "CITY_MAP");
    document.getElementById("map-overworld-hud").style.display = gameScene === "CITY_MAP" ? "block" : "none";
    document.getElementById("ar-encounter-hud").style.display = gameScene === "AR_CAPTURE" ? "block" : "none";
    updateHudCounters();
  }

  async function toggleRealCamera() {
    A.playUiClick();
    if (useRealCamera) {
      useRealCamera = false;
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
      return;
    }
    const ok = await E.startCameraOnVideoElement(video, (msg, code, httpsUrl) => {
      S.showToast(msg, code === "ok" ? "info" : "warn");
      if (code === "https_required" && httpsUrl) {
        if (confirm("No iPhone, a Apple exige HTTPS para abrir a câmera. Abrir porta HTTPS (8443)?")) {
          location.href = httpsUrl;
        }
      }
    });
    useRealCamera = ok;
  }

  // ============================================================================
  // INTERAÇÕES TOUCH (PINCH-TO-ZOOM COM 2 DEDOS + ROTAÇÃO + CURVEBALL + JOYSTICK)
  // ============================================================================
  function setupInteractions() {
    let dragStart = null;
    let prevAngle = null;
    let pinchStartDist = null;
    let pinchStartOrbit = null;

    // Suporte a Pinça (Pinch-to-Zoom com 2 dedos no Mobile!)
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartOrbit = cityState.camOrbitDist;
      }
    }, { passive: true });

    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && pinchStartDist !== null) {
        const currDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = pinchStartDist / Math.max(20, currDist);
        cityState.camOrbitDist = Math.max(3.5, Math.min(20.0, pinchStartOrbit * scale));
      }
    }, { passive: true });

    canvas.addEventListener("touchend", () => {
      pinchStartDist = null;
    }, { passive: true });

    // Zoom com Roda do Mouse no PC
    canvas.addEventListener("wheel", (e) => {
      cityState.camOrbitDist = Math.max(3.5, Math.min(20.0, cityState.camOrbitDist + (e.deltaY > 0 ? 1.0 : -1.0)));
    }, { passive: true });

    canvas.addEventListener("pointerdown", (e) => {
      A.init();
      const bx = canvas.width * 0.5, by = canvas.height - 88;
      const distToBall = Math.hypot(e.clientX - bx, e.clientY - by);

      dragStart = {
        x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
        t: performance.now(),
        onBall: distToBall < 95 && gameScene === "AR_CAPTURE"
      };
      prevAngle = Math.atan2(e.clientY - by, e.clientX - bx);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!dragStart || e.buttons === 0 || pinchStartDist !== null) return;
      const bx = canvas.width * 0.5, by = canvas.height - 88;

      if (dragStart.onBall && gameScene === "AR_CAPTURE") {
        const ang = Math.atan2(e.clientY - by, e.clientX - bx);
        if (prevAngle !== null) {
          let dAng = ang - prevAngle;
          if (dAng > Math.PI) dAng -= Math.PI * 2;
          if (dAng < -Math.PI) dAng += Math.PI * 2;
          if (Math.abs(dAng) > 0.04 && Math.abs(dAng) < 1.2) {
            ball.curveDir = dAng >= 0 ? 1 : -1;
            ball.curveRpm = Math.min(1.0, ball.curveRpm + Math.abs(dAng) * 0.32);
            ball.spinAngle += dAng * 2.5;
            if (Math.random() < 0.35) A.playCurveballSpin(ball.curveRpm);
          }
        }
        prevAngle = ang;
      } else {
        const dx = e.clientX - dragStart.x;
        if (gameScene === "CITY_MAP") {
          cityState.camOrbitYaw -= dx * 0.0065;
        } else if (!hasImu) {
          pose.yaw -= dx * 0.005;
        }
        dragStart.x = e.clientX;
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!dragStart) return;
      const totalMove = Math.hypot(e.clientX - dragStart.startX, e.clientY - dragStart.startY);
      const dx = e.clientX - dragStart.startX, dy = e.clientY - dragStart.startY;
      const dtMs = Math.max(16, performance.now() - dragStart.t);

      if (gameScene === "CITY_MAP" && totalMove < 24) {
        for (const t of clickableMapTargets) {
          if (Math.hypot(e.clientX - t.x, e.clientY - t.y) <= t.r) {
            if (t.type === "wild") {
              enterArEncounterWithWild(t.index);
            } else if (t.type === "poi") {
              const poi = cityState.pois[t.index];
              if (poi.type === "pokestop") {
                const prof = S.getProfile();
                prof.bag.poke_ball = (prof.bag.poke_ball || 0) + 5;
                prof.bag.great_ball = (prof.bag.great_ball || 0) + 2;
                prof.bag.razz_berry = (prof.bag.razz_berry || 0) + 2;
                prof.anomalyCharge = Math.min(100, (prof.anomalyCharge || 0) + 15);
                S.addXp(100);
                S.save();
                A.playGotchaFanfare();
                S.showToast(`🟦 ${poi.name}: +5 Poké Balls, +2 Great Balls, +2 Razz Berries!`, "info");
              } else if (poi.type === "gym") {
                startBattle("GYM", poi.guardId || 26, poi.cp || 1950);
              } else if (poi.type === "raid") {
                startBattle("RAID", poi.bossId || 150, poi.cp || 45800);
              } else if (poi.type === "villain") {
                startBattle("VILLAIN", poi.bossId || 94, poi.cp || 2400);
              }
            }
            dragStart = null;
            return;
          }
        }
      }

      if (gameScene === "AR_CAPTURE" && dy < -35 && dtMs < 750) {
        const speed = Math.min(10.5, Math.max(6.0, (-dy / dtMs) * 7.4));
        const yawOff = (dx / window.innerWidth) * 0.85;
        throwPokeball(speed, yawOff);
      }
      dragStart = null;
      prevAngle = null;
    });

    const joyZone = document.getElementById("joystick-zone");
    const joyKnob = document.getElementById("joystick-knob");
    if (joyZone && joyKnob) {
      let joyCenter = null;
      joyZone.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const rect = joyZone.getBoundingClientRect();
        joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        cityState.joyActive = true;
        joyZone.setPointerCapture(e.pointerId);
      });
      joyZone.addEventListener("pointermove", (e) => {
        if (!cityState.joyActive || !joyCenter) return;
        const maxR = 26;
        let dx = e.clientX - joyCenter.x, dy = e.clientY - joyCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        cityState.joyDx = dx / maxR;
        cityState.joyDy = dy / maxR;
      });
      const resetJoy = () => {
        cityState.joyActive = false;
        cityState.joyDx = 0;
        cityState.joyDy = 0;
        joyKnob.style.transform = `translate(0px, 0px)`;
      };
      joyZone.addEventListener("pointerup", resetJoy);
      joyZone.addEventListener("pointercancel", resetJoy);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
    });
  }

  async function init() {
    canvas = document.getElementById("ascii-canvas");
    ctx = canvas.getContext("2d", { alpha: false });
    video = document.getElementById("cam-video");
    offCanvas = document.createElement("canvas");
    offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const prof = await S.initAndLoad();
    spawnWildWave(false);
    setupInteractions();
    startRealGpsTracking(false);
    updateHudCounters();

    // Atualiza ícones da pílula Nearby após os sprites oficiais carregarem
    setTimeout(updateHudCounters, 1500);
    setTimeout(updateHudCounters, 3500);

    if (!prof.created) {
      document.getElementById("onboarding-screen").style.display = "flex";
    }

    const importInp = document.getElementById("import-file-inp");
    if (importInp) {
      importInp.addEventListener("change", (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (S.importSaveJson(reader.result)) updateHudCounters();
        };
        reader.readAsText(f);
      });
    }

    let prevTime = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      emaFrameMs = emaFrameMs * 0.9 + (dt * 1000) * 0.1;
      const timeSec = now / 1000;

      updateCityMovement(dt);
      updateCaptureAndWildPhysics(dt, timeSec);
      renderMainViewport(timeSec);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function finishCharacterCreation() {
    A.init();
    A.playGotchaFanfare();
    const prof = S.getProfile();
    const nameVal = (document.getElementById("inp-trainer-name").value || "").trim();
    prof.trainerName = nameVal.length > 0 ? nameVal : "Treinador";
    prof.gender = document.getElementById("inp-gender").value;
    prof.avatar.skinColor = document.getElementById("inp-skin").value;
    prof.avatar.outfitColor = document.getElementById("inp-outfit").value;
    prof.avatar.team = document.getElementById("inp-team").value;
    prof.created = true;
    S.save();

    document.getElementById("onboarding-screen").style.display = "none";
    updateHudCounters();
  }

  return {
    init,
    finishCharacterCreation,
    openRadialMenu,
    closeRadialMenu,
    adjustZoom,
    throwPokeball,
    toggleSceneMode,
    toggleRealCamera,
    startRealGpsTracking,
    triggerAnomalyScanner,
    enterArEncounterWithWild,
    showTrainerProfileModal,
    showRareProgressAndMedalsModal,
    showPokemonBoxModal,
    showPokemonDetailCardModal,
    showPokedexModal,
    showNearbyTrackerModal,
    showShopModal,
    claimDailyFreeBox,
    buyWithFreeCoins,
    syncCurrentPageWiki,
    showBagModal,
    useBagItem,
    showBattleHubModal,
    startBattle,
    executeBattleTurn,
    showBattlePassModal,
    claimBattlePassTier,
    showSystemAndCrowdfundingModal,
    submitQuickBugReport,
    installOneClickPwa,
    uninstallOneClickPwa,
    powerUpPokemon,
    evolvePokemon,
    setBuddyPokemon,
    closeModal
  };
})();

window.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  window.PokeGameUI.init();
});
