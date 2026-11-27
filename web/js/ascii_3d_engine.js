"use strict";

// ============================================================================
// MOTOR GRÁFICO 3D ASCII DE ALTA DEFINIÇÃO (TEXTO ASCII CONTIDO DENTRO DA
// SILHUETA 3D DO POKÉMON + SILHUETA 3D MISTERIOSA NA POKÉDEX/NEARBY)
// ============================================================================

window.Ascii3DEngine = (function() {

  const RAMP_INTERNAL = " .:+*#%@";
  const SPRITE_CACHE = new Map();
  const SILHOUETTE_CACHE = new Map();

  function vec3(x=0, y=0, z=0) { return {x, y, z}; }
  function add3(a, b) { return {x: a.x+b.x, y: a.y+b.y, z: a.z+b.z}; }
  function sub3(a, b) { return {x: a.x-b.x, y: a.y-b.y, z: a.z-b.z}; }
  function mul3(a, s) { return {x: a.x*s, y: a.y*s, z: a.z*s}; }
  function dot3(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
  function cross3(a, b) {
    return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x };
  }
  function norm3(a) {
    const l = Math.hypot(a.x, a.y, a.z);
    return l > 1e-6 ? {x: a.x/l, y: a.y/l, z: a.z/l} : {x: 0, y: 1, z: 0};
  }

  function mat4Identity() {
    const m = new Float32Array(16);
    m[0]=1; m[5]=1; m[10]=1; m[15]=1;
    return m;
  }
  function mat4Mul(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; ++c) {
      for (let r = 0; r < 4; ++r) {
        out[c*4 + r] = a[0*4 + r]*b[c*4 + 0] + a[1*4 + r]*b[c*4 + 1] + a[2*4 + r]*b[c*4 + 2] + a[3*4 + r]*b[c*4 + 3];
      }
    }
    return out;
  }
  function mat4Vec4(m, x, y, z, w) {
    return {
      x: m[0]*x + m[4]*y + m[8]*z  + m[12]*w,
      y: m[1]*x + m[5]*y + m[9]*z  + m[13]*w,
      z: m[2]*x + m[6]*y + m[10]*z + m[14]*w,
      w: m[3]*x + m[7]*y +M15(m, w)
    };
  }
  function M15(m, w) { return m[15]*w; }

  function projectPoint3D(vp, wx, wy, wz, screenW, screenH) {
    const cx = vp[0]*wx + vp[4]*wy + vp[8]*wz  + vp[12];
    const cy = vp[1]*wx + vp[5]*wy + vp[9]*wz  + vp[13];
    const cz = vp[2]*wx + vp[6]*wy + vp[10]*wz + vp[14];
    const cw = vp[3]*wx + vp[7]*wy + vp[11]*wz + vp[15];
    if (cw <= 0.15) return null;
    const invW = 1.0 / cw;
    return {
      x: ((cx * invW) * 0.5 + 0.5) * screenW,
      y: ((cy * invW) * 0.5 + 0.5) * screenH,
      z: cz * invW,
      depth: cw
    };
  }

  function mat4View6DoF(pos, yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const f = norm3({x: sy*cp, y: sp, z: -cy*cp});
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const upT = norm3({x: sr*cy, y: cr, z: sr*sy});
    const s = norm3(cross3(f, upT));
    const u = cross3(s, f);
    const m = mat4Identity();
    m[0]=s.x; m[4]=s.y; m[8]=s.z;   m[12]=-dot3(s, pos);
    m[1]=u.x; m[5]=u.y; m[9]=u.z;   m[13]=-dot3(u, pos);
    m[2]=-f.x;m[6]=-f.y;m[10]=-f.z; m[14]=dot3(f, pos);
    return m;
  }

  function mat4Perspective(fovY, aspect, zNear, zFar) {
    const f = 1.0 / Math.tan(fovY * 0.5);
    const rangeInv = 1.0 / (zNear - zFar);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = -f;
    m[10] = zFar * rangeInv; m[11] = -1.0;
    m[14] = zNear * zFar * rangeInv;
    return m;
  }

  // ============================================================================
  // GERADOR DE ESCULTURA 3D COM TEXTO ASCII CONTIDO DENTRO DO POKÉMON!
  // Cada Pokémon possui uma forma 3D nítida (com iluminação 3D esférica, borda
  // definida e caracteres ASCII do nome/tipo/luminância contidos DENTRO do corpo!)
  // Também gera a Silhueta 3D Escura Misteriosa para Pokémons ainda não capturados!
  // ============================================================================
  function buildProceduralPokemonCanvas(speciesId, isShiny, isSilhouette) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const sp = window.PokeData.getSpecies(speciesId);
    const t1 = window.PokeData.TYPE_COLORS[sp.types[0]] || window.PokeData.TYPE_COLORS.Normal;
    const t2 = sp.types[1] ? window.PokeData.TYPE_COLORS[sp.types[1]] : t1;

    const r1 = Math.round(t1.main[0]*255), g1 = Math.round(t1.main[1]*255), b1 = Math.round(t1.main[2]*255);
    const r2 = Math.round(t2.sec[0]*255),  g2 = Math.round(t2.sec[1]*255),  b2 = Math.round(t2.sec[2]*255);
    const ra = Math.round(t1.accent[0]*255), ga = Math.round(t1.accent[1]*255), ba = Math.round(t1.accent[2]*255);

    const colMain = isShiny ? `rgb(${Math.min(255,b1+80)},${Math.min(255,r1+50)},60)` : `rgb(${r1},${g1},${b1})`;
    const colSec  = `rgb(${r2},${g2},${b2})`;
    const colAcc  = `rgb(${ra},${ga},${ba})`;

    ctx.save();
    ctx.translate(64, 68);

    // Desenha a forma anatômica 3D base do arquétipo para fallback instantâneo antes do sprite oficial carregar
    ctx.fillStyle = colMain;
    ctx.strokeStyle = "#101c24";
    ctx.lineWidth = 4;

    const arch = sp.archetype || "biped_mouse_ears";
    ctx.beginPath();
    if (arch === "biped_mouse_ears") {
      // Orelhas longas, cabeça, bochechas, corpo e cauda raio
      ctx.moveTo(-18, -18); ctx.lineTo(-36, -54); ctx.lineTo(-10, -32);
      ctx.moveTo( 18, -18); ctx.lineTo( 36, -54); ctx.lineTo( 10, -32);
      ctx.arc(0, -16, 24, 0, Math.PI * 2);
      ctx.arc(0, 18, 28, 0, Math.PI * 2);
    } else if (arch === "winged_dragon" || arch === "bird_winged") {
      // Asas abertas, corpo, cabeça e cauda
      ctx.moveTo(0, -10); ctx.lineTo(-54, -38); ctx.lineTo(-42, 10); ctx.lineTo(0, 12);
      ctx.moveTo(0, -10); ctx.lineTo( 54, -38); ctx.lineTo( 42, 10); ctx.lineTo(0, 12);
      ctx.arc(0, -24, 18, 0, Math.PI * 2);
      ctx.arc(0, 16, 26, 0, Math.PI * 2);
    } else if (arch === "ghost_orb") {
      ctx.arc(0, -4, 38, 0, Math.PI * 2);
    } else {
      ctx.arc(0, -18, 22, 0, Math.PI * 2);
      ctx.arc(0, 16, 30, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    if (!isSilhouette) {
      // Barriga secundária + Olhos expressivos nítidos
      ctx.fillStyle = colSec;
      ctx.beginPath(); ctx.arc(0, 20, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(-9, -20, 6, 0, Math.PI * 2); ctx.arc(9, -20, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#101820";
      ctx.beginPath(); ctx.arc(-8, -20, 3.2, 0, Math.PI * 2); ctx.arc(8, -20, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colAcc;
      ctx.beginPath(); ctx.arc(-16, -12, 4.5, 0, Math.PI * 2); ctx.arc(16, -12, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    return apply3DAsciiInsideSilhouette(c, sp, isShiny, isSilhouette);
  }

  // Aplica Sombreamento 3D Volumétrico + Texto ASCII (Nome/Tipo/Caracteres) CONTIDO DENTRO da silhueta do Pokémon!
  function apply3DAsciiInsideSilhouette(sourceCanvas, sp, isShiny, isSilhouette) {
    const size = 128;
    const out = document.createElement("canvas");
    out.width = size; out.height = size;
    const octx = out.getContext("2d");

    // 1. Lê pixels originais para calcular mapa de relevo 3D (distância até a borda) e luminância
    const sctx = sourceCanvas.getContext("2d");
    const imgData = sctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Se for Silhueta 3D (Pokémon não encontrado ainda na Pokédex/Nearby), converte corpo para Azul-Noturno 3D!
    if (isSilhouette) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 30) {
          // Sombreamento 3D volumétrico escuro na silhueta
          const px = ((i / 4) % size) / size - 0.5;
          const py = Math.floor((i / 4) / size) / size - 0.5;
          const rim = Math.min(1, Math.hypot(px, py) * 2.1);
          data[i + 0] = Math.round(14 + rim * 22);
          data[i + 1] = Math.round(32 + rim * 45);
          data[i + 2] = Math.round(52 + rim * 68);
        }
      }
      sctx.putImageData(imgData, 0, 0);
    }

    // 2. Desenha a base 3D com iluminação volumétrica
    octx.drawImage(sourceCanvas, 0, 0);

    // 3. Sobrepõe a malha de caracteres ASCII (contendo o NOME, TIPO e glifos 3D) ESTRITAMENTE DENTRO do Pokémon!
    octx.save();
    octx.globalCompositeOperation = "source-atop";

    // Gradiente de iluminação esférica 3D (luz vinda do topo-esquerda + rim light na borda inferior)
    const grad3D = octx.createRadialGradient(44, 38, 6, 64, 64, 62);
    if (isSilhouette) {
      grad3D.addColorStop(0, "rgba(60, 180, 220, 0.25)");
      grad3D.addColorStop(0.7, "rgba(15, 35, 55, 0.45)");
      grad3D.addColorStop(1, "rgba(80, 220, 255, 0.55)");
    } else {
      grad3D.addColorStop(0, "rgba(255, 255, 255, 0.32)");
      grad3D.addColorStop(0.6, "rgba(0, 0, 0, 0.05)");
      grad3D.addColorStop(1, "rgba(0, 15, 30, 0.48)");
    }
    octx.fillStyle = grad3D;
    octx.fillRect(0, 0, size, size);

    // Caracteres ASCII contidos dentro do corpo do Pokémon!
    const patternText = isSilhouette
      ? `?${sp.id}?UNKNOWN?ASCII3D?`
      : `${sp.name.toUpperCase()}#${sp.id}*${sp.types.join("")}@#%+*`;
    octx.font = "bold 8px 'Cascadia Mono', 'Consolas', monospace";
    octx.textBaseline = "top";

    let charIdx = 0;
    for (let y = 4; y < size - 4; y += 7) {
      for (let x = 4; x < size - 4; x += 6) {
        const pIdx = (y * size + x) * 4;
        if (data[pIdx + 3] < 80) continue;
        const lum = (0.299 * data[pIdx] + 0.587 * data[pIdx+1] + 0.114 * data[pIdx+2]) / 255;
        const ch = patternText[charIdx % patternText.length];
        charIdx++;

        if (isSilhouette) {
          octx.fillStyle = "rgba(95, 225, 255, 0.42)";
        } else {
          octx.fillStyle = lum > 0.55 ? "rgba(255, 255, 255, 0.42)" : "rgba(10, 25, 35, 0.38)";
        }
        octx.fillText(ch, x, y);
      }
    }
    octx.restore();

    return out;
  }

  // Obtém (e atualiza com o Sprite Oficial da PokéAPI) a Escultura 3D ASCII do Pokémon (Colorida ou Silhueta 3D!)
  function getPokemonAscii3DSculpture(speciesId, isShiny = false, isSilhouette = false) {
    const cache = isSilhouette ? SILHOUETTE_CACHE : SPRITE_CACHE;
    const key = `${speciesId}_${isShiny ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);

    // Gera versão procedural imediata e dispara download da arte oficial Open-Source da PokéAPI
    const fallbackCanvas = buildProceduralPokemonCanvas(speciesId, isShiny, isSilhouette);
    cache.set(key, fallbackCanvas);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    const folder = (!isSilhouette && isShiny) ? "shiny/" : "";
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${folder}${speciesId}.png`;

    img.onload = () => {
      try {
        const size = 128;
        const rawC = document.createElement("canvas");
        rawC.width = size; rawC.height = size;
        const rctx = rawC.getContext("2d");
        rctx.imageSmoothingEnabled = false;
        rctx.drawImage(img, 4, 4, size - 8, size - 8);
        const sp = window.PokeData.getSpecies(speciesId);
        const detailed = apply3DAsciiInsideSilhouette(rawC, sp, isShiny, isSilhouette);
        cache.set(key, detailed);
      } catch (_) {}
    };

    return fallbackCanvas;
  }

  // Gera um DataURL (PNG) da Escultura 3D ASCII ou da Silhueta 3D Escura para usar nos cards da Pokédex, Box e Nearby!
  function getPokemonCardImageSrc(speciesId, isShiny = false, isSilhouette = false) {
    const canvas3d = getPokemonAscii3DSculpture(speciesId, isShiny, isSilhouette);
    return canvas3d.toDataURL();
  }

  function computeVisualScale(heightMeters) {
    const h = Math.max(0.3, heightMeters || 1.0);
    return Math.max(0.85, Math.min(2.1, 0.75 + 0.38 * Math.sqrt(h)));
  }

  // ============================================================================
  // CORREÇÃO COMPLETA DE CÂMERA PARA IPHONE (CHROME / SAFARI WEBKIT) & ANDROID/PC
  // ============================================================================
  async function startCameraOnVideoElement(videoEl, onStatus) {
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      const httpsUrl = `https://${location.hostname}:8443${location.pathname}${location.search}`;
      onStatus(
        `⚠️ iPhone/iOS exige HTTPS para liberar a câmera! Redirecionando para ${httpsUrl}`,
        "https_required",
        httpsUrl
      );
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onStatus("⚠️ API de câmera bloqueada pelo navegador (use HTTPS ou GitHub Pages).", "error");
      return false;
    }

    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("webkit-playsinline", "true");
    videoEl.setAttribute("muted", "true");
    videoEl.setAttribute("autoplay", "true");
    videoEl.muted = true;

    const constraintsList = [
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
      { video: { facingMode: "environment" }, audio: false },
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false }
    ];

    let stream = null;
    let lastErr = null;
    for (const c of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        if (stream) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!stream) {
      onStatus("❌ Não foi possível abrir a câmera: " + (lastErr ? lastErr.message : "Permissão negada"), "error");
      return false;
    }

    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (_) {}

    onStatus("📷 Câmera Ao Vivo em Alta Definição ASCII ativada!", "ok");
    return true;
  }

  return {
    RAMP_INTERNAL,
    vec3, add3, sub3, mul3, dot3, cross3, norm3,
    mat4Identity, mat4Mul, mat4View6DoF, mat4Perspective, projectPoint3D,
    computeVisualScale,
    getPokemonAscii3DSculpture,
    getPokemonCardImageSrc,
    startCameraOnVideoElement
  };
})();
