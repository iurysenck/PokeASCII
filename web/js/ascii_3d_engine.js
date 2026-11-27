"use strict";

// ============================================================================
// MOTOR GRÁFICO 100% ASCII-3D PURO (VOLUMETRIC 3D VOXEL RELIEF & G-BUFFER)
// Todas as entidades (Pokémons, Avatar H/M, PokéStops, Ginásios, Balão Rocket,
// Pokébola Articulada que Abre/Fecha, Anéis de Ação 3D e Retratos da Pokédex)
// são malhas 3D reais rasterizadas no G-Buffer e quantizadas em caracteres ASCII!
// ============================================================================

window.PokeAsciiEngine = window.Ascii3DEngine = (function() {

  const RAMP_HD = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const RAMP_STD = " .,:;+*%#@";

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
      w: m[3]*x + m[7]*y + m[11]*z + m[15]*w
    };
  }
  function mat4Translation(x, y, z) {
    const m = mat4Identity(); m[12]=x; m[13]=y; m[14]=z; return m;
  }
  function mat4Scale(sx, sy, sz) {
    const m = mat4Identity(); m[0]=sx; m[5]=sy; m[10]=sz; return m;
  }
  function mat4RotX(a) {
    const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
    m[5]=c; m[6]=s; m[9]=-s; m[10]=c; return m;
  }
  function mat4RotY(a) {
    const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
    m[0]=c; m[2]=-s; m[8]=s; m[10]=c; return m;
  }
  function mat4RotZ(a) {
    const m = mat4Identity(), c = Math.cos(a), s = Math.sin(a);
    m[0]=c; m[1]=s; m[4]=-s; m[5]=c; return m;
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

  const MESH_CACHE = new Map();
  const SPRITE_LOADING = new Set();
  const ASCII_PORTRAIT_CACHE = new Map();

  function createMesh() { return { verts: [], indices: [] }; }
  function addQuad(m, i0, i1, i2, i3) { m.indices.push(i0, i1, i2, i0, i2, i3); }

  function appendBox(m, cx, cy, cz, hx, hy, hz, col, animW=0) {
    const b = m.verts.length;
    const x0=cx-hx, x1=cx+hx, y0=cy-hy, y1=cy+hy, z0=cz-hz, z1=cz+hz;
    const pts = [
      [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
      [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]
    ];
    for (let i=0; i<8; ++i) {
      m.verts.push({ pos: vec3(pts[i][0], pts[i][1], pts[i][2]), norm: vec3(0,1,0), uv: animW, col });
    }
    addQuad(m, b+0,b+1,b+2,b+3); addQuad(m, b+5,b+4,b+7,b+6);
    addQuad(m, b+4,b+0,b+3,b+7); addQuad(m, b+1,b+5,b+6,b+2);
    addQuad(m, b+3,b+2,b+6,b+7); addQuad(m, b+4,b+5,b+1,b+0);
  }

  function appendEllipsoid(m, cx, cy, cz, rx, ry, rz, col, rings=8, sectors=14, animW=0.15) {
    const b = m.verts.length;
    for (let r=0; r<=rings; ++r) {
      const v = r / rings, phi = v * Math.PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (let s=0; s<=sectors; ++s) {
        const th = (s / sectors) * Math.PI * 2;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        m.verts.push({
          pos: vec3(cx + nx*rx, cy + ny*ry, cz + nz*rz),
          norm: norm3({x:nx, y:ny, z:nz}),
          uv: animW, col
        });
      }
    }
    const stride = sectors + 1;
    for (let r=0; r<rings; ++r) {
      for (let s=0; s<sectors; ++s) {
        const i0 = b + r*stride + s, i1 = i0 + 1;
        const i2 = b + (r+1)*stride + (s+1), i3 = b + (r+1)*stride + s;
        addQuad(m, i0, i2, i1, i3);
      }
    }
  }

  function appendCone(m, bx, by, bz, tx, ty, tz, rad, colBase, colTip, animTip=0.9) {
    const b = m.verts.length;
    const baseC = vec3(bx,by,bz), tip = vec3(tx,ty,tz);
    const axis = norm3(sub3(tip, baseC));
    const helper = Math.abs(axis.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0);
    const right = mul3(norm3(cross3(axis, helper)), rad);
    const fwd = mul3(norm3(cross3(right, axis)), rad);
    m.verts.push(
      { pos: add3(baseC, right), norm: right, uv: 0.2, col: colBase },
      { pos: add3(baseC, fwd),   norm: fwd,   uv: 0.2, col: colBase },
      { pos: sub3(baseC, right), norm: right, uv: 0.2, col: colBase },
      { pos: sub3(baseC, fwd),   norm: fwd,   uv: 0.2, col: colBase },
      { pos: tip,                norm: axis,  uv: animTip, col: colTip }
    );
    m.indices.push(b+0,b+1,b+4, b+1,b+2,b+4, b+2,b+3,b+4, b+3,b+0,b+4);
    addQuad(m, b+3,b+2,b+1,b+0);
  }

  function recomputeNormals(m) {
    for (const v of m.verts) v.norm = vec3(0,0,0);
    for (let i=0; i<m.indices.length; i+=3) {
      const v0 = m.verts[m.indices[i]], v1 = m.verts[m.indices[i+1]], v2 = m.verts[m.indices[i+2]];
      const fn = cross3(sub3(v1.pos, v0.pos), sub3(v2.pos, v0.pos));
      v0.norm = add3(v0.norm, fn); v1.norm = add3(v1.norm, fn); v2.norm = add3(v2.norm, fn);
    }
    for (const v of m.verts) v.norm = norm3(v.norm);
    return m;
  }

  // ============================================================================
  // ESCULTOR DE MALHAS 3D VOLUMÉTRICAS (VOXEL RELIEF 3D) PARA O G-BUFFER ASCII
  // ============================================================================
  function buildVolumetricMeshFromPixelGrid(gridW, gridH, rgbaData, widthMeters = 1.75, heightMeters = 1.85, maxDepthZ = 0.62) {
    const m = createMesh();
    const mask = new Uint8Array(gridW * gridH);
    const distField = new Float32Array(gridW * gridH);

    for (let y = 0; y < gridH; ++y) {
      for (let x = 0; x < gridW; ++x) {
        const a = rgbaData[(y * gridW + x) * 4 + 3];
        if (a > 40) {
          mask[y * gridW + x] = 1;
          distField[y * gridW + x] = 999;
        }
      }
    }

    for (let y = 0; y < gridH; ++y) {
      for (let x = 0; x < gridW; ++x) {
        const i = y * gridW + x;
        if (!mask[i]) { distField[i] = 0; continue; }
        if (x === 0 || y === 0 || x === gridW-1 || y === gridH-1) { distField[i] = 1; continue; }
        const dL = distField[i - 1] + 1;
        const dU = distField[i - gridW] + 1;
        if (dL < distField[i]) distField[i] = dL;
        if (dU < distField[i]) distField[i] = dU;
      }
    }
    let maxD = 1.0;
    for (let y = gridH - 1; y >= 0; --y) {
      for (let x = gridW - 1; x >= 0; --x) {
        const i = y * gridW + x;
        if (!mask[i]) continue;
        if (x + 1 < gridW && distField[i + 1] + 1 < distField[i]) distField[i] = distField[i + 1] + 1;
        if (y + 1 < gridH && distField[i + gridW] + 1 < distField[i]) distField[i] = distField[i + gridW] + 1;
        if (distField[i] > maxD) maxD = distField[i];
      }
    }

    const cellW = widthMeters / gridW;
    const cellH = heightMeters / gridH;

    for (let y = 0; y < gridH; ++y) {
      for (let x = 0; x < gridW; ++x) {
        const i = y * gridW + x;
        if (!mask[i]) continue;

        const r = rgbaData[i * 4 + 0] / 255;
        const g = rgbaData[i * 4 + 1] / 255;
        const b = rgbaData[i * 4 + 2] / 255;
        const col = vec3(r, g, b);

        const normDist = Math.min(1.0, distField[i] / Math.max(1.5, maxD * 0.75));
        const domeZ = maxDepthZ * Math.sqrt(Math.max(0.08, 1.0 - Math.pow(1.0 - normDist, 2)));

        const dLeft  = x > 0 ? distField[i - 1] : 0;
        const dRight = x + 1 < gridW ? distField[i + 1] : 0;
        const dUp    = y > 0 ? distField[i - gridW] : 0;
        const dDown  = y + 1 < gridH ? distField[i + gridW] : 0;
        const nx = (dLeft - dRight) * 0.45;
        const ny = (dDown - dUp) * 0.45;
        const frontNorm = norm3({ x: nx, y: ny, z: 1.0 });
        const backNorm  = norm3({ x: nx, y: ny, z: -1.0 });

        const wx0 = (x - gridW * 0.5) * cellW;
        const wx1 = wx0 + cellW;
        const wy1 = (gridH - y) * cellH;
        const wy0 = wy1 - cellH;
        const wzFront = domeZ * 0.5;
        const wzBack  = -domeZ * 0.5;
        const animW   = Math.max(0, Math.min(1, (gridH - y) / gridH));

        const bf = m.verts.length;
        m.verts.push(
          { pos: vec3(wx0, wy0, wzFront), norm: frontNorm, uv: animW, col },
          { pos: vec3(wx1, wy0, wzFront), norm: frontNorm, uv: animW, col },
          { pos: vec3(wx1, wy1, wzFront), norm: frontNorm, uv: animW, col },
          { pos: vec3(wx0, wy1, wzFront), norm: frontNorm, uv: animW, col }
        );
        addQuad(m, bf, bf+1, bf+2, bf+3);

        const bb = m.verts.length;
        m.verts.push(
          { pos: vec3(wx1, wy0, wzBack), norm: backNorm, uv: animW, col },
          { pos: vec3(wx0, wy0, wzBack), norm: backNorm, uv: animW, col },
          { pos: vec3(wx0, wy1, wzBack), norm: backNorm, uv: animW, col },
          { pos: vec3(wx1, wy1, wzBack), norm: backNorm, uv: animW, col }
        );
        addQuad(m, bb, bb+1, bb+2, bb+3);

        if (x === 0 || !mask[i - 1]) {
          const bl = m.verts.length;
          const nL = vec3(-1, 0, 0);
          m.verts.push(
            { pos: vec3(wx0, wy0, wzBack),  norm: nL, uv: animW, col },
            { pos: vec3(wx0, wy0, wzFront), norm: nL, uv: animW, col },
            { pos: vec3(wx0, wy1, wzFront), norm: nL, uv: animW, col },
            { pos: vec3(wx0, wy1, wzBack),  norm: nL, uv: animW, col }
          );
          addQuad(m, bl, bl+1, bl+2, bl+3);
        }
        if (x === gridW - 1 || !mask[i + 1]) {
          const br = m.verts.length;
          const nR = vec3(1, 0, 0);
          m.verts.push(
            { pos: vec3(wx1, wy0, wzFront), norm: nR, uv: animW, col },
            { pos: vec3(wx1, wy0, wzBack),  norm: nR, uv: animW, col },
            { pos: vec3(wx1, wy1, wzBack),  norm: nR, uv: animW, col },
            { pos: vec3(wx1, wy1, wzFront), norm: nR, uv: animW, col }
          );
          addQuad(m, br, br+1, br+2, br+3);
        }
      }
    }
    return m;
  }

  function fetchAndUpgradeVolumetricPokemonMesh(speciesId, isShiny) {
    const key = `${speciesId}_${isShiny ? 1 : 0}`;
    if (SPRITE_LOADING.has(key)) return;
    SPRITE_LOADING.add(key);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    const folder = isShiny ? "shiny/" : "";
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${folder}${speciesId}.png`;

    img.onload = () => {
      try {
        const gridW = 36, gridH = 36;
        const c = document.createElement("canvas");
        c.width = gridW; c.height = gridH;
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 0, 0, gridW, gridH);
        const imgData = cx.getImageData(0, 0, gridW, gridH).data;
        const volMesh = buildVolumetricMeshFromPixelGrid(gridW, gridH, imgData, 1.75, 1.85, 0.58);
        if (volMesh.verts.length > 40) {
          MESH_CACHE.set(key, volMesh);
          ASCII_PORTRAIT_CACHE.delete(`${key}_0`);
          ASCII_PORTRAIT_CACHE.delete(`${key}_1`);
        }
      } catch (_) {}
    };
  }

  function appendEyes3D(m, headY, headZ, spreadX, eyeSize, eyeCol) {
    const wht = vec3(1.0, 1.0, 1.0), pup = vec3(0.06, 0.06, 0.10);
    appendBox(m, -spreadX, headY, headZ, eyeSize*1.2, eyeSize*1.35, 0.06, wht, 0.25);
    appendBox(m,  spreadX, headY, headZ, eyeSize*1.2, eyeSize*1.35, 0.06, wht, 0.25);
    appendBox(m, -spreadX*0.88, headY, headZ+0.05, eyeSize*0.65, eyeSize*0.80, 0.04, eyeCol || pup, 0.25);
    appendBox(m,  spreadX*0.88, headY, headZ+0.05, eyeSize*0.65, eyeSize*0.80, 0.04, eyeCol || pup, 0.25);
  }

  function computeVisualScale(heightMeters) {
    const h = Math.max(0.25, heightMeters || 1.0);
    return Math.max(0.75, Math.min(2.25, 0.65 + 0.50 * Math.sqrt(h)));
  }

  function getPokemonMesh(speciesId, isShiny = false) {
    const key = `${speciesId}_${isShiny ? 1 : 0}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);

    fetchAndUpgradeVolumetricPokemonMesh(speciesId, isShiny);

    const sp = window.PokeData.getSpecies(speciesId);
    const t1 = window.PokeData.TYPE_COLORS[sp.types[0]] || window.PokeData.TYPE_COLORS.Normal;
    const t2 = sp.types[1] ? window.PokeData.TYPE_COLORS[sp.types[1]] : t1;

    let cMain = vec3(t1.main[0], t1.main[1], t1.main[2]);
    let cSec  = vec3(t2.sec[0],  t2.sec[1],  t2.sec[2]);
    let cAcc  = vec3(t1.accent[0], t1.accent[1], t1.accent[2]);

    if (isShiny) {
      cMain = vec3(Math.min(1, cMain.z*0.5 + 0.55), Math.min(1, cMain.x*0.6 + 0.38), Math.min(1, cMain.y*0.7 + 0.2));
      cAcc  = vec3(1.0, 0.92, 0.25);
    }

    const m = createMesh();
    const arch = sp.archetype || "biped_mouse_ears";

    if (arch === "biped_mouse_ears") {
      appendBox(m, -0.22, 0.10, 0.10, 0.12, 0.10, 0.20, cSec, 0);
      appendBox(m,  0.22, 0.10, 0.10, 0.12, 0.10, 0.20, cSec, 0);
      appendEllipsoid(m, 0, 0.54, 0, 0.44, 0.46, 0.38, cMain, 9, 16, 0.15);
      appendEllipsoid(m, 0, 0.52, 0.20, 0.28, 0.32, 0.22, cSec, 7, 12, 0.15);
      appendEllipsoid(m, 0, 1.12, 0.08, 0.42, 0.39, 0.38, cMain, 9, 16, 0.3);
      appendEyes3D(m, 1.16, 0.42, 0.18, 0.085);
      appendBox(m, -0.29, 1.00, 0.40, 0.11, 0.11, 0.07, cAcc, 0.35);
      appendBox(m,  0.29, 1.00, 0.40, 0.11, 0.11, 0.07, cAcc, 0.35);
      appendBox(m, -0.42, 0.66, 0.18, 0.12, 0.14, 0.14, cMain, 0.25);
      appendBox(m,  0.42, 0.66, 0.18, 0.12, 0.14, 0.14, cMain, 0.25);
      appendCone(m, -0.24, 1.40, 0.05, -0.58, 2.06, 0.08, 0.14, cMain, vec3(0.12,0.12,0.15), 0.9);
      appendCone(m,  0.24, 1.40, 0.05,  0.58, 2.06, 0.08, 0.14, cMain, vec3(0.12,0.12,0.15), 0.9);
      appendBox(m, 0, 0.45, -0.40, 0.07, 0.11, 0.18, cSec, 0.5);
      appendBox(m, 0, 0.76, -0.64, 0.08, 0.20, 0.20, cMain, 0.75);
      appendBox(m, 0, 1.16, -0.92, 0.10, 0.30, 0.28, cAcc, 1.0);
    } else if (arch === "biped_tail_flame") {
      appendBox(m, -0.24, 0.18, 0.06, 0.14, 0.18, 0.19, cMain, 0);
      appendBox(m,  0.24, 0.18, 0.06, 0.14, 0.18, 0.19, cMain, 0);
      appendEllipsoid(m, 0, 0.64, 0, 0.41, 0.48, 0.37, cMain, 9, 16, 0.15);
      appendBox(m, 0, 0.62, 0.31, 0.27, 0.35, 0.09, cSec, 0.15);
      appendEllipsoid(m, 0, 1.22, 0.10, 0.38, 0.35, 0.38, cMain, 9, 16, 0.25);
      appendBox(m, 0, 1.13, 0.42, 0.24, 0.15, 0.20, cMain, 0.28);
      appendEyes3D(m, 1.26, 0.43, 0.18, 0.08);
      appendBox(m, -0.44, 0.78, 0.18, 0.11, 0.13, 0.19, cMain, 0.3);
      appendBox(m,  0.44, 0.78, 0.18, 0.11, 0.13, 0.19, cMain, 0.3);
      appendBox(m, 0, 0.38, -0.46, 0.15, 0.15, 0.28, cMain, 0.5);
      appendBox(m, 0, 0.58, -0.82, 0.12, 0.13, 0.26, cMain, 0.75);
      appendCone(m, 0, 0.70, -1.00, 0, 1.44, -1.08, 0.28, cAcc, vec3(1, 0.18, 0.04), 1.0);
    } else if (arch === "quad_bulb") {
      appendBox(m, -0.36, 0.22,  0.36, 0.16, 0.22, 0.16, cSec, 0);
      appendBox(m,  0.36, 0.22,  0.36, 0.16, 0.22, 0.16, cSec, 0);
      appendBox(m, -0.36, 0.22, -0.36, 0.16, 0.22, 0.16, cSec, 0);
      appendBox(m,  0.36, 0.22, -0.36, 0.16, 0.22, 0.16, cSec, 0);
      appendEllipsoid(m, 0, 0.55, 0, 0.52, 0.38, 0.60, cSec, 9, 16, 0.15);
      appendEllipsoid(m, 0, 0.72, 0.58, 0.42, 0.34, 0.36, cSec, 9, 16, 0.25);
      appendEyes3D(m, 0.78, 0.88, 0.20, 0.085, vec3(0.92, 0.15, 0.15));
      appendEllipsoid(m, 0, 0.98, -0.10, 0.58, 0.46, 0.58, cMain, 9, 16, 0.6);
      appendCone(m, 0, 1.26, -0.10, 0, 1.72, -0.10, 0.34, cMain, cAcc, 0.95);
    } else if (arch === "winged_dragon" || arch === "bird_winged") {
      appendBox(m, -0.26, 0.22, 0.05, 0.15, 0.22, 0.19, cMain, 0);
      appendBox(m,  0.26, 0.22, 0.05, 0.15, 0.22, 0.19, cMain, 0);
      appendEllipsoid(m, 0, 0.76, 0, 0.46, 0.54, 0.40, cMain, 9, 16, 0.15);
      appendBox(m, 0, 0.74, 0.32, 0.28, 0.40, 0.09, cSec, 0.15);
      appendEllipsoid(m, 0, 1.44, 0.16, 0.35, 0.32, 0.38, cMain, 9, 14, 0.28);
      appendCone(m, 0, 1.42, 0.42, 0, 1.38, 0.82, 0.20, cMain, cAcc, 0.3);
      appendEyes3D(m, 1.50, 0.46, 0.16, 0.075);
      appendCone(m, -0.35, 1.05, -0.10, -1.55, 1.80, -0.25, 0.46, cMain, cAcc, 0.95);
      appendCone(m,  0.35, 1.05, -0.10,  1.55, 1.80, -0.25, 0.46, cMain, cAcc, 0.95);
      appendCone(m, 0, 0.45, -0.35, 0, 0.88, -1.30, 0.22, cMain, cAcc, 1.0);
    } else if (arch === "ghost_orb") {
      appendEllipsoid(m, 0, 1.05, 0, 0.60, 0.60, 0.60, cMain, 10, 18, 0.45);
      appendEyes3D(m, 1.14, 0.55, 0.22, 0.15, cAcc);
      appendCone(m, -0.60, 1.10, -0.15, -1.12, 1.66, -0.35, 0.26, cSec, cAcc, 1.0);
      appendCone(m,  0.60, 1.10, -0.15,  1.12, 1.66, -0.35, 0.26, cSec, cAcc, 1.0);
      appendCone(m,  0.00, 1.50, -0.25,  0.00, 2.08, -0.45, 0.28, cSec, cAcc, 1.0);
    } else {
      appendBox(m, -0.28, 0.22,  0.28, 0.14, 0.22, 0.14, cMain, 0);
      appendBox(m,  0.28, 0.22,  0.28, 0.14, 0.22, 0.14, cMain, 0);
      appendBox(m, -0.28, 0.22, -0.28, 0.14, 0.22, 0.14, cMain, 0);
      appendBox(m,  0.28, 0.22, -0.28, 0.14, 0.22, 0.14, cMain, 0);
      appendEllipsoid(m, 0, 0.62, 0, 0.44, 0.40, 0.54, cMain, 9, 16, 0.15);
      appendEllipsoid(m, 0, 0.84, 0.36, 0.38, 0.30, 0.32, cSec, 7, 12, 0.2);
      appendEllipsoid(m, 0, 1.12, 0.44, 0.36, 0.34, 0.36, cMain, 9, 14, 0.3);
      appendEyes3D(m, 1.16, 0.76, 0.16, 0.08);
      appendCone(m, -0.22, 1.35, 0.42, -0.46, 1.82, 0.45, 0.13, cMain, cAcc, 0.85);
      appendCone(m,  0.22, 1.35, 0.42,  0.46, 1.82, 0.45, 0.13, cMain, cAcc, 0.85);
      appendCone(m, 0, 0.68, -0.45, 0, 1.28, -1.10, 0.26, cSec, cAcc, 1.0);
    }

    recomputeNormals(m);
    MESH_CACHE.set(key, m);
    return m;
  }

  // Pokébola 3D Articulada (Suporta abrir a tampa superior em 3D durante as animações Entrando/Saindo da Pokébola!)
  function buildPokeballMesh(ballType = "poke_ball", openAngleRad = 0.0) {
    const qOpen = Math.round(openAngleRad * 10);
    const key = `ball_${ballType}_${qOpen}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);

    const m = createMesh();
    const rad = 0.32, rings = 10, sectors = 16;
    let topCol = vec3(0.96, 0.14, 0.14);
    if (ballType === "great_ball") topCol = vec3(0.16, 0.48, 0.96);
    else if (ballType === "ultra_ball") topCol = vec3(0.96, 0.82, 0.12);
    else if (ballType === "master_ball") topCol = vec3(0.68, 0.18, 0.92);

    const wht = vec3(0.96, 0.96, 0.98), blk = vec3(0.12, 0.12, 0.15), coreGlow = vec3(1.0, 0.55, 0.75);
    const cosO = Math.cos(-openAngleRad), sinO = Math.sin(-openAngleRad);

    for (let r=0; r<=rings; ++r) {
      const phi = (r / rings) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
      const isUpper = cp >= 0;
      const col = Math.abs(cp) <= 0.14 ? blk : (cp > 0.14 ? topCol : wht);

      for (let s=0; s<=sectors; ++s) {
        const th = (s / sectors) * Math.PI * 2;
        const n = norm3({x: sp*Math.cos(th), y: cp, z: sp*Math.sin(th)});
        let px = n.x * rad, py = n.y * rad, pz = n.z * rad;

        // Se a Pokébola estiver aberta (openAngleRad > 0), articula o hemisfério superior para trás!
        if (isUpper && openAngleRad > 0.02) {
          const dy = py, dz = pz + rad;
          py = dy * cosO - dz * sinO;
          pz = (dy * sinO + dz * cosO) - rad;
        }
        m.verts.push({ pos: vec3(px, py, pz), norm: n, uv: 0, col });
      }
    }
    const stride = sectors + 1;
    for (let r=0; r<rings; ++r) {
      for (let s=0; s<sectors; ++s) {
        const i0 = r*stride + s, i1 = i0+1, i2 = (r+1)*stride + (s+1), i3 = (r+1)*stride + s;
        addQuad(m, i0, i2, i1, i3);
      }
    }
    if (openAngleRad > 0.1) {
      // Núcleo energético brilhante dentro da Pokébola aberta!
      appendEllipsoid(m, 0, 0.05, 0, rad*0.65, rad*0.45, rad*0.65, coreGlow, 6, 10, 0);
    } else {
      appendBox(m, 0, 0, rad*0.96, rad*0.24, rad*0.24, rad*0.14, wht, 0);
    }
    recomputeNormals(m);
    MESH_CACHE.set(key, m);
    return m;
  }

  // Anel 3D no Plano do Chão (Invariante à rotação de câmera 360 graus!)
  function buildAnchorRingMesh(outerR = 0.96, thickness = 0.14, segs = 28) {
    const key = `ring_${outerR.toFixed(2)}_${thickness.toFixed(2)}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);
    const m = createMesh();
    const innerR = Math.max(0.1, outerR - thickness), cyan = vec3(0.25, 0.95, 0.88);
    for (let s=0; s<=segs; ++s) {
      const a = (s / segs) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      m.verts.push(
        { pos: vec3(innerR*c, 0.03, innerR*sn), norm: vec3(0,1,0), uv: 0, col: cyan },
        { pos: vec3(outerR*c, 0.03, outerR*sn), norm: vec3(0,1,0), uv: 0, col: cyan }
      );
    }
    for (let s=0; s<segs; ++s) {
      const b = s*2;
      addQuad(m, b+0, b+2, b+3, b+1);
    }
    MESH_CACHE.set(key, m);
    return m;
  }

  function hexToVec3(hex, fallback = vec3(0.9, 0.3, 0.3)) {
    if (!hex || typeof hex !== "string" || hex.length < 7) return fallback;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;
    return vec3(r, g, b);
  }

  function buildTrainerAvatarMesh(gender = "M", avatarCfg = {}, isWalking = false, timeSec = 0) {
    const m = createMesh();
    const skin   = hexToVec3(avatarCfg.skinColor,   vec3(0.96, 0.78, 0.65));
    const outfit = hexToVec3(avatarCfg.outfitColor, vec3(0.95, 0.38, 0.38));
    const hair   = hexToVec3(avatarCfg.hairColor,   vec3(0.45, 0.28, 0.85));
    const white  = vec3(0.96, 0.96, 0.98);
    const pants  = vec3(0.14, 0.22, 0.38);
    const visor  = vec3(0.15, 0.98, 0.85);
    const gold   = vec3(1.0, 0.84, 0.22);

    const swing = isWalking ? (0.34 * Math.sin(timeSec * 10.5)) : 0.0;

    appendBox(m, -0.18, 0.32,  swing, 0.11, 0.28, 0.12, pants, 0);
    appendBox(m,  0.18, 0.32, -swing, 0.11, 0.28, 0.12, pants, 0);
    appendBox(m, -0.18, 0.09,  swing + 0.06, 0.13, 0.09, 0.18, outfit, 0);
    appendBox(m,  0.18, 0.09, -swing + 0.06, 0.13, 0.09, 0.18, outfit, 0);
    appendBox(m, -0.18, 0.03,  swing + 0.08, 0.14, 0.03, 0.19, white, 0);
    appendBox(m,  0.18, 0.03, -swing + 0.08, 0.14, 0.03, 0.19, white, 0);

    if (gender === "F") {
      appendCone(m, 0, 0.52, 0, 0, 1.12, 0, 0.36, outfit, outfit, 0.1);
      appendEllipsoid(m, 0, 0.96, 0, 0.28, 0.32, 0.22, outfit, 8, 14, 0.1);
    } else {
      appendBox(m, 0, 0.92, 0, 0.30, 0.36, 0.21, outfit, 0.1);
    }
    appendBox(m, 0, 0.92, 0.19, 0.10, 0.34, 0.05, white, 0.1);
    appendBox(m, 0, 0.60, 0.00, 0.31, 0.05, 0.22, vec3(0.15, 0.15, 0.18), 0.1);
    appendEllipsoid(m, 0.16, 0.60, 0.22, 0.07, 0.07, 0.07, gold, 5, 8, 0.1);
    appendBox(m, 0, 0.94, -0.24, 0.22, 0.26, 0.12, vec3(0.22, 0.28, 0.35), 0.1);

    appendEllipsoid(m, -0.38, 1.16, 0, 0.12, 0.12, 0.12, outfit, 6, 10, 0.15);
    appendEllipsoid(m,  0.38, 1.16, 0, 0.12, 0.12, 0.12, outfit, 6, 10, 0.15);
    appendBox(m, -0.40, 0.88, -swing * 0.85, 0.10, 0.28, 0.11, outfit, 0.2);
    appendBox(m,  0.40, 0.88,  swing * 0.85, 0.10, 0.28, 0.11, outfit, 0.2);
    appendBox(m, -0.40, 0.56, -swing * 0.85, 0.10, 0.09, 0.10, visor, 0.2);
    appendBox(m,  0.40, 0.56,  swing * 0.85, 0.10, 0.09, 0.10, visor, 0.2);

    appendBox(m, 0, 1.30, 0, 0.11, 0.08, 0.11, skin, 0.2);
    appendEllipsoid(m, 0, 1.54, 0.02, 0.27, 0.28, 0.27, skin, 9, 16, 0.2);
    appendEyes3D(m, 1.54, 0.26, 0.11, 0.055);

    appendEllipsoid(m, 0, 1.70, -0.02, 0.29, 0.18, 0.29, outfit, 8, 14, 0.25);
    appendBox(m, 0, 1.72, 0.18, 0.12, 0.08, 0.12, white, 0.25);
    appendBox(m, 0, 1.66, 0.26, 0.24, 0.04, 0.18, outfit, 0.25);
    appendBox(m, 0, 1.54, 0.28, 0.22, 0.06, 0.03, visor, 0.25);

    if (gender === "F") {
      appendCone(m, -0.24, 1.55, 0.0, -0.34, 1.18, 0.08, 0.10, hair, hair, 0.6);
      appendCone(m,  0.24, 1.55, 0.0,  0.34, 1.18, 0.08, 0.10, hair, hair, 0.6);
      appendCone(m,  0.00, 1.62, -0.26, 0.00, 1.12, -0.56, 0.15, hair, hair, 0.95);
    } else {
      appendCone(m, -0.24, 1.60, 0.05, -0.38, 1.48, 0.12, 0.09, hair, hair, 0.4);
      appendCone(m,  0.24, 1.60, 0.05,  0.38, 1.48, 0.12, 0.09, hair, hair, 0.4);
    }

    return recomputeNormals(m);
  }

  function buildPokestop3DMesh(isCooldown = false) {
    const key = isCooldown ? "poi_pokestop_cd" : "poi_pokestop_ready";
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);
    const m = createMesh();
    const topCol = isCooldown ? vec3(0.66, 0.33, 0.97) : vec3(0.15, 0.88, 1.0);
    const poleCol = isCooldown ? vec3(0.48, 0.22, 0.78) : vec3(0.10, 0.48, 0.96);
    const wht = vec3(0.95, 0.99, 1.0);
    appendEllipsoid(m, 0, 0.12, 0, 0.55, 0.12, 0.55, poleCol, 6, 12, 0);
    appendBox(m, 0, 0.75, 0, 0.12, 0.75, 0.12, poleCol, 0);
    appendBox(m, 0, 1.85, 0, 0.44, 0.44, 0.44, topCol, 0.8);
    appendEllipsoid(m, 0, 1.85, 0, 0.68, 0.68, 0.12, wht, 8, 16, 0.5);
    recomputeNormals(m);
    MESH_CACHE.set(key, m);
    return m;
  }

  function buildGymTower3DMesh(teamColArr) {
    const c = teamColArr || [1.0, 0.84, 0.20];
    const key = `poi_gym_${c[0].toFixed(2)}_${c[1].toFixed(2)}_${c[2].toFixed(2)}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);
    const m = createMesh();
    const teamCol = vec3(c[0], c[1], c[2]);
    const slv = vec3(0.78, 0.84, 0.92);
    appendEllipsoid(m, 0, 0.45, 0, 0.92, 0.45, 0.92, slv, 8, 14, 0);
    appendBox(m, 0, 1.40, 0, 0.40, 0.90, 0.40, slv, 0.2);
    appendEllipsoid(m, 0, 2.45, 0, 1.15, 0.35, 1.15, teamCol, 8, 16, 0.6);
    appendCone(m, -0.82, 2.55, 0, -1.05, 3.25, 0, 0.18, teamCol, slv, 0.9);
    appendCone(m,  0.82, 2.55, 0,  1.05, 3.25, 0, 0.18, teamCol, slv, 0.9);
    recomputeNormals(m);
    MESH_CACHE.set(key, m);
    return m;
  }

  function buildVillainBalloon3DMesh() {
    if (MESH_CACHE.has("poi_villain")) return MESH_CACHE.get("poi_villain");
    const m = createMesh();
    const dark = vec3(0.24, 0.18, 0.36), red = vec3(0.98, 0.18, 0.24), basket = vec3(0.58, 0.44, 0.28);
    appendBox(m, 0, 1.30, 0, 0.26, 0.22, 0.26, basket, 0.4);
    appendEllipsoid(m, 0, 2.60, 0, 0.92, 1.08, 0.92, dark, 9, 16, 0.8);
    appendBox(m, 0, 2.60, 0.86, 0.34, 0.44, 0.09, red, 0.8);
    recomputeNormals(m);
    MESH_CACHE.set("poi_villain", m);
    return m;
  }

  // ============================================================================
  // GERADOR DE RETRATOS 100% ASCII 3D PARA A POKÉDEX, BOX E NEARBY!
  // Rasteriza a malha 3D do Pokémon em um mini-G-Buffer (26x22 células ASCII)
  // com Sobel 3D e caracteres do Nome/Tipo (ou Silhueta 3D Escura se não visto!)
  // ============================================================================
  function getPokemonCardImageSrc(speciesId, isShiny = false, isSilhouette = false) {
    const cacheKey = `${speciesId}_${isShiny ? 1 : 0}_${isSilhouette ? 1 : 0}`;
    if (ASCII_PORTRAIT_CACHE.has(cacheKey)) return ASCII_PORTRAIT_CACHE.get(cacheKey);

    const mesh = getPokemonMesh(speciesId, isShiny);
    const sp = window.PokeData.getSpecies(speciesId);
    const gw = 24, gh = 22;
    const cellW = 5, cellH = 6;
    const c = document.createElement("canvas");
    c.width = gw * cellW;
    c.height = gh * cellH;
    const ctx = c.getContext("2d");

    const pR = new Float32Array(gw * gh);
    const pG = new Float32Array(gw * gh);
    const pB = new Float32Array(gw * gh);
    const pZ = new Float32Array(gw * gh);
    const pHit = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; ++i) pZ[i] = 1.0;

    const view = mat4View6DoF(vec3(0, 0.95, 2.55), 0.15, -0.05, 0);
    const proj = mat4Perspective(45 * Math.PI / 180, (gw * cellW) / (gh * cellH), 0.2, 10.0);
    const mvp = mat4Mul(proj, view);
    const lightDir = norm3({x: 0.35, y: 0.8, z: 0.45});

    const verts = mesh.verts, indices = mesh.indices;
    for (let t = 0; t < indices.length; t += 3) {
      const v0 = verts[indices[t]], v1 = verts[indices[t+1]], v2 = verts[indices[t+2]];
      const raw = [v0, v1, v2];
      const sx = [0,0,0], sy = [0,0,0], sz = [0,0,0];
      let behind = false;
      for (let k = 0; k < 3; ++k) {
        const clip = mat4Vec4(mvp, raw[k].pos.x, raw[k].pos.y, raw[k].pos.z, 1.0);
        if (clip.w <= 0.1) { behind = true; break; }
        const iw = 1.0 / clip.w;
        sx[k] = ((clip.x * iw) * 0.5 + 0.5) * gw;
        sy[k] = ((clip.y * iw) * 0.5 + 0.5) * gh;
        sz[k] = clip.z * iw;
      }
      if (behind) continue;
      const area = (sx[2]-sx[0])*(sy[1]-sy[0]) - (sy[2]-sy[0])*(sx[1]-sx[0]);
      if (Math.abs(area) < 1e-5) continue;
      const invA = 1.0 / area;

      const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
      const x1 = Math.min(gw-1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
      const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
      const y1 = Math.min(gh-1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));

      for (let py = y0; py <= y1; ++py) {
        for (let px = x0; px <= x1; ++px) {
          const pfx = px + 0.5, pfy = py + 0.5;
          const w0 = ((pfx-sx[1])*(sy[2]-sy[1]) - (pfy-sy[1])*(sx[2]-sx[1])) * invA;
          const w1 = ((pfx-sx[2])*(sy[0]-sy[2]) - (pfy-sy[2])*(sx[0]-sx[2])) * invA;
          const w2 = 1.0 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0*sz[0] + w1*sz[1] + w2*sz[2];
          const idx = py * gw + px;
          if (z >= pZ[idx]) continue;
          pZ[idx] = z;
          pHit[idx] = 1;

          const nx = v0.norm.x*w0 + v1.norm.x*w1 + v2.norm.x*w2;
          const ny = v0.norm.y*w0 + v1.norm.y*w1 + v2.norm.y*w2;
          const nz = v0.norm.z*w0 + v1.norm.z*w1 + v2.norm.z*w2;
          const lit = Math.min(1.35, 0.38 + 0.72 * Math.max(0, nx*lightDir.x + ny*lightDir.y + nz*lightDir.z));

          pR[idx] = Math.min(1, (v0.col.x*w0 + v1.col.x*w1 + v2.col.x*w2) * lit);
          pG[idx] = Math.min(1, (v0.col.y*w0 + v1.col.y*w1 + v2.col.y*w2) * lit);
          pB[idx] = Math.min(1, (v0.col.z*w0 + v1.col.z*w1 + v2.col.z*w2) * lit);
        }
      }
    }

    // Renderiza as células 3D do retrato exclusivamente com caracteres ASCII!
    ctx.font = `bold ${cellH}px 'Cascadia Mono', Consolas, monospace`;
    ctx.textBaseline = "top";
    const nameChars = isSilhouette ? `?UNKNOWN#${sp.id}?` : `${sp.name.toUpperCase()}#@*+`;
    let cIdx = 0;

    for (let r = 0; r < gh; ++r) {
      for (let col = 0; col < gw; ++col) {
        const i = r * gw + col;
        if (!pHit[i]) continue;

        const isEdge = (col === 0 || !pHit[i-1]) || (col === gw-1 || !pHit[i+1]) ||
                       (r === 0 || !pHit[i-gw]) || (r === gh-1 || !pHit[i+gw]);

        if (isSilhouette) {
          // Silhueta 3D Escura em ASCII para Pokémons ainda não capturados!
          ctx.fillStyle = isEdge ? "#0f2942" : "#16324f";
          ctx.fillRect(col * cellW, r * cellH, cellW, cellH);
          ctx.fillStyle = isEdge ? "#38bdf8" : "#4785a8";
          ctx.fillText(isEdge ? "#" : nameChars[cIdx++ % nameChars.length], col * cellW, r * cellH);
        } else {
          const cr = Math.round(pR[i]*255), cg = Math.round(pG[i]*255), cb = Math.round(pB[i]*255);
          ctx.fillStyle = `rgb(${Math.round(cr*0.78)},${Math.round(cg*0.78)},${Math.round(cb*0.78)})`;
          ctx.fillRect(col * cellW, r * cellH, cellW, cellH);
          ctx.fillStyle = isEdge ? "#101820" : `rgb(${Math.min(255,cr+40)},${Math.min(255,cg+40)},${Math.min(255,cb+40)})`;
          ctx.fillText(isEdge ? "@" : nameChars[cIdx++ % nameChars.length], col * cellW, r * cellH);
        }
      }
    }

    const url = c.toDataURL();
    ASCII_PORTRAIT_CACHE.set(cacheKey, url);
    return url;
  }

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
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 260 }, height: { ideal: 180 } }, audio: false },
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
    RAMP_HD,
    RAMP_STD,
    vec3, add3, sub3, mul3, dot3, cross3, norm3,
    mat4Identity, mat4Mul, mat4Vec4, mat4Translation, mat4Scale, mat4RotX, mat4RotY, mat4RotZ,
    mat4View6DoF, mat4Perspective, projectPoint3D,
    computeVisualScale,
    getPokemonMesh,
    buildPokeballMesh,
    buildAnchorRingMesh,
    buildTrainerAvatarMesh,
    buildPokestop3DMesh,
    buildGymTower3DMesh,
    buildVillainBalloon3DMesh,
    getPokemonCardImageSrc,
    startCameraOnVideoElement
  };
})();
