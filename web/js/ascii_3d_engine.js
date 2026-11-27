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
    const f = norm3({x: -sy*cp, y: sp, z: -cy*cp});
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const upT = norm3({x: sr*cy, y: cr, z: -sr*sy});
    const s = norm3(cross3(f, upT));
    const u = cross3(s, f);
    const m = mat4Identity();
    m[0]=s.x; m[4]=s.y; m[8]=s.z;   m[12]=-dot3(s, pos);
    m[1]=u.x; m[5]=u.y; m[9]=u.z;   m[13]=-dot3(u, pos);
    m[2]=-f.x;m[6]=-f.y;m[10]=-f.z; m[14]=dot3(f, pos);
    return m;
  }

  // Gera a Matriz View e a Base Ortonormal (right=s, up=u, forward=f) exatamente alinhadas
  // para que o Raycast do Chão 3D e as Malhas 3D fiquem 100% soldados no mapa ao girar/dar zoom!
  function mat4LookAtBasis(eye, target) {
    const f = norm3(sub3(target, eye));
    let s = cross3(f, {x: 0, y: 1, z: 0});
    if (Math.hypot(s.x, s.y, s.z) < 1e-5) s = {x: 1, y: 0, z: 0};
    else s = norm3(s);
    const u = norm3(cross3(s, f));
    const view = mat4Identity();
    view[0]=s.x;  view[4]=s.y;  view[8]=s.z;   view[12]=-dot3(s, eye);
    view[1]=u.x;  view[5]=u.y;  view[9]=u.z;   view[13]=-dot3(u, eye);
    view[2]=-f.x; view[6]=-f.y; view[10]=-f.z; view[14]=dot3(f, eye);
    return { view, s, u, f, eye };
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
  const GLB_LOADING = new Set();
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

    // Mapa de luminancia para Micro-Relevo Anatomico 3D (olhos, boca, listras, barriga e garras ganham relevo 3D real!)
    const lumaField = new Float32Array(gridW * gridH);
    for (let i = 0; i < gridW * gridH; ++i) {
      if (!mask[i]) continue;
      const r = rgbaData[i * 4 + 0] / 255;
      const g = rgbaData[i * 4 + 1] / 255;
      const b = rgbaData[i * 4 + 2] / 255;
      lumaField[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    for (let y = 0; y < gridH; ++y) {
      for (let x = 0; x < gridW; ++x) {
        const i = y * gridW + x;
        if (!mask[i]) continue;

        const r = rgbaData[i * 4 + 0] / 255;
        const g = rgbaData[i * 4 + 1] / 255;
        const b = rgbaData[i * 4 + 2] / 255;
        const col = vec3(r, g, b);

        const normDist = Math.min(1.0, distField[i] / Math.max(1.5, maxD * 0.72));
        const microRelief = 0.76 + 0.34 * lumaField[i];
        const domeZ = maxDepthZ * Math.sqrt(Math.max(0.10, 1.0 - Math.pow(1.0 - normDist, 2))) * microRelief;

        const dLeft  = x > 0 ? distField[i - 1] : 0;
        const dRight = x + 1 < gridW ? distField[i + 1] : 0;
        const dUp    = y > 0 ? distField[i - gridW] : 0;
        const dDown  = y + 1 < gridH ? distField[i + gridW] : 0;

        const lLeft  = (x > 0 && mask[i - 1]) ? lumaField[i - 1] : lumaField[i];
        const lRight = (x + 1 < gridW && mask[i + 1]) ? lumaField[i + 1] : lumaField[i];
        const lUp    = (y > 0 && mask[i - gridW]) ? lumaField[i - gridW] : lumaField[i];
        const lDown  = (y + 1 < gridH && mask[i + gridW]) ? lumaField[i + gridW] : lumaField[i];

        // Gradiente normal combina curvatura do corpo + vincos anatomicos internos (olhos, boca, detalhes)
        const nx = (dLeft - dRight) * 0.38 + (lLeft - lRight) * 1.45;
        const ny = (dDown - dUp) * 0.38 + (lDown - lUp) * 1.45;
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
        // Face Superior e Inferior (Fecha 100% os voxels quando vistos de cima na camera do Mapa 3D!)
        if (y === 0 || !mask[i - gridW]) {
          const bu = m.verts.length;
          const nU = vec3(0, 1, 0);
          m.verts.push(
            { pos: vec3(wx0, wy1, wzFront), norm: nU, uv: animW, col },
            { pos: vec3(wx1, wy1, wzFront), norm: nU, uv: animW, col },
            { pos: vec3(wx1, wy1, wzBack),  norm: nU, uv: animW, col },
            { pos: vec3(wx0, wy1, wzBack),  norm: nU, uv: animW, col }
          );
          addQuad(m, bu, bu+1, bu+2, bu+3);
        }
        if (y === gridH - 1 || !mask[i + gridW]) {
          const bd = m.verts.length;
          const nD = vec3(0, -1, 0);
          m.verts.push(
            { pos: vec3(wx0, wy0, wzBack),  norm: nD, uv: animW, col },
            { pos: vec3(wx1, wy0, wzBack),  norm: nD, uv: animW, col },
            { pos: vec3(wx1, wy0, wzFront), norm: nD, uv: animW, col },
            { pos: vec3(wx0, wy0, wzFront), norm: nD, uv: animW, col }
          );
          addQuad(m, bd, bd+1, bd+2, bd+3);
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
        const rawC = document.createElement("canvas");
        rawC.width = img.width || 96;
        rawC.height = img.height || 96;
        const rawCx = rawC.getContext("2d");
        rawCx.drawImage(img, 0, 0);
        const rawData = rawCx.getImageData(0, 0, rawC.width, rawC.height).data;
        let minX = rawC.width, maxX = 0, minY = rawC.height, maxY = 0;
        for (let y = 0; y < rawC.height; ++y) {
          for (let x = 0; x < rawC.width; ++x) {
            if (rawData[(y * rawC.width + x) * 4 + 3] > 32) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = rawC.width - 1; maxY = rawC.height - 1; }
        const cropW = Math.max(8, maxX - minX + 1);
        const cropH = Math.max(8, maxY - minY + 1);

        // Grade Volumétrica 52x52 de Alta Definição (6 faces fechadas + micro-relevo 3D)
        const gridW = 52, gridH = 52;
        const c = document.createElement("canvas");
        c.width = gridW; c.height = gridH;
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, minX, minY, cropW, cropH, 1, 1, gridW - 2, gridH - 2);
        const imgData = cx.getImageData(0, 0, gridW, gridH).data;
        const volMesh = buildVolumetricMeshFromPixelGrid(gridW, gridH, imgData, 1.72, 1.82, 0.68);
        if (volMesh.verts.length > 40) {
          const existing = MESH_CACHE.get(key);
          if (!existing || !existing.isReal3DGlb) {
            MESH_CACHE.set(key, volMesh);
            ASCII_PORTRAIT_CACHE.delete(`${key}_0`);
            ASCII_PORTRAIT_CACHE.delete(`${key}_1`);
          }
        }
      } catch (_) {}
    };
  }

  // ============================================================================
  // CARREGADOR E PARSER BINÁRIO DE MODELOS 3D REAIS (.GLB / glTF 2.0)
  // Extrai milhares de triângulos 3D reais, normais, coordenadas UV e texturas
  // PNG embutidas diretamente para o G-Buffer 100% ASCII!
  // ============================================================================
  async function decodeGlbImageToTextureBuffer(pngBytes, mimeType) {
    const texW = 128, texH = 128;
    const blob = new Blob([pngBytes], { type: mimeType || "image/png" });
    let c = document.createElement("canvas");
    c.width = texW;
    c.height = texH;
    const cx = c.getContext("2d");

    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(blob);
      cx.drawImage(bmp, 0, 0, texW, texH);
      if (bmp.close) bmp.close();
    } else {
      await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          cx.drawImage(img, 0, 0, texW, texH);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });
    }

    const rgba = cx.getImageData(0, 0, texW, texH).data;
    const luma = new Float32Array(texW * texH);
    for (let i = 0; i < texW * texH; ++i) {
      const r = rgba[i * 4 + 0] / 255;
      const g = rgba[i * 4 + 1] / 255;
      const b = rgba[i * 4 + 2] / 255;
      luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return { width: texW, height: texH, rgba, luma };
  }

  function sampleGlbTexture(tex, u, v) {
    if (!tex || !tex.rgba) return null;
    let wu = u - Math.floor(u);
    let wv = v - Math.floor(v);
    if (wu < 0) wu += 1;
    if (wv < 0) wv += 1;
    const tx = Math.min(tex.width - 1, Math.max(0, Math.floor(wu * tex.width)));
    const ty = Math.min(tex.height - 1, Math.max(0, Math.floor(wv * tex.height)));
    const idx = ty * tex.width + tx;
    const p = idx * 4;

    const txL = tx > 0 ? tx - 1 : tx;
    const txR = tx + 1 < tex.width ? tx + 1 : tx;
    const tyU = ty > 0 ? ty - 1 : ty;
    const tyD = ty + 1 < tex.height ? ty + 1 : ty;
    const dU = tex.luma[ty * tex.width + txR] - tex.luma[ty * tex.width + txL];
    const dV = tex.luma[tyD * tex.width + tx] - tex.luma[tyU * tex.width + tx];

    return {
      r: tex.rgba[p] / 255,
      g: tex.rgba[p + 1] / 255,
      b: tex.rgba[p + 2] / 255,
      dU,
      dV
    };
  }

  async function parseAndBuildReal3DGlbMesh(arrayBuffer, isShiny) {
    const dv = new DataView(arrayBuffer);
    if (arrayBuffer.byteLength < 28) return null;
    const magic = dv.getUint32(0, true);
    if (magic !== 0x46546C67) return null; // "glTF"

    const chunk0Len = dv.getUint32(12, true);
    const chunk0Type = dv.getUint32(16, true);
    if (chunk0Type !== 0x4E4F534A) return null; // "JSON"

    const jsonBytes = new Uint8Array(arrayBuffer, 20, chunk0Len);
    const gltf = JSON.parse(new TextDecoder("utf-8").decode(jsonBytes));
    const binStart = 20 + chunk0Len + 8;

    function getTypedAccessor(accIdx) {
      if (accIdx === undefined || accIdx === null) return null;
      const acc = gltf.accessors[accIdx];
      if (!acc || acc.bufferView === undefined) return null;
      const bv = gltf.bufferViews[acc.bufferView];
      const byteOffset = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const numComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type] || 1;
      const stride = bv.byteStride || 0;
      const count = acc.count;

      const compBytes = acc.componentType === 5126 ? 4 : (acc.componentType === 5125 ? 4 : (acc.componentType === 5123 ? 2 : 1));
      if (stride && stride !== numComp * compBytes) {
        const out = new Float32Array(count * numComp);
        for (let i = 0; i < count; ++i) {
          const base = byteOffset + i * stride;
          for (let c = 0; c < numComp; ++c) {
            if (acc.componentType === 5126) out[i * numComp + c] = dv.getFloat32(base + c * 4, true);
            else if (acc.componentType === 5123) out[i * numComp + c] = dv.getUint16(base + c * 2, true);
            else if (acc.componentType === 5125) out[i * numComp + c] = dv.getUint32(base + c * 4, true);
            else if (acc.componentType === 5121) out[i * numComp + c] = dv.getUint8(base + c);
          }
        }
        return { data: out, count, numComp };
      }

      const total = count * numComp;
      let arr = null;
      if (acc.componentType === 5126) arr = new Float32Array(arrayBuffer, byteOffset, total);
      else if (acc.componentType === 5123) arr = new Uint16Array(arrayBuffer, byteOffset, total);
      else if (acc.componentType === 5125) arr = new Uint32Array(arrayBuffer, byteOffset, total);
      else if (acc.componentType === 5121) arr = new Uint8Array(arrayBuffer, byteOffset, total);
      return arr ? { data: arr, count, numComp } : null;
    }

    const textures = [];
    if (Array.isArray(gltf.images)) {
      for (let i = 0; i < gltf.images.length; ++i) {
        try {
          const img = gltf.images[i];
          if (img && img.bufferView !== undefined) {
            const bv = gltf.bufferViews[img.bufferView];
            const bytes = new Uint8Array(arrayBuffer, binStart + (bv.byteOffset || 0), bv.byteLength);
            const texBuf = await decodeGlbImageToTextureBuffer(bytes, img.mimeType || "image/png");
            textures.push(texBuf);
          } else {
            textures.push(null);
          }
        } catch (_) {
          textures.push(null);
        }
      }
    }

    const rawVerts = [];
    const rawIndices = [];
    const eyeCheckIndices = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const mesh of (gltf.meshes || [])) {
      const mName = mesh.name || "";
      if (/vine|effect|shadow|plane|aura/i.test(mName)) continue;

      for (const prim of (mesh.primitives || [])) {
        if (prim.mode !== undefined && prim.mode !== 4) continue;
        const posAcc = getTypedAccessor(prim.attributes && prim.attributes.POSITION);
        if (!posAcc) continue;
        const normAcc = getTypedAccessor(prim.attributes && prim.attributes.NORMAL);
        const uvAcc = getTypedAccessor(prim.attributes && prim.attributes.TEXCOORD_0);
        const colAcc = getTypedAccessor(prim.attributes && prim.attributes.COLOR_0);
        const idxAcc = getTypedAccessor(prim.indices);

        let texIdx = -1;
        let baseFactor = [1, 1, 1];
        let matName = mName;
        if (prim.material !== undefined && gltf.materials && gltf.materials[prim.material]) {
          const mat = gltf.materials[prim.material];
          matName += " " + (mat.name || "");
          if (/effect|shadow|plane|aura/i.test(matName)) continue;
          const pbr = mat.pbrMetallicRoughness || {};
          if (Array.isArray(pbr.baseColorFactor)) {
            baseFactor = [pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2]];
          }
          const texInfo = pbr.baseColorTexture || mat.emissiveTexture;
          if (texInfo && gltf.textures && gltf.textures[texInfo.index]) {
            const srcIdx = gltf.textures[texInfo.index].source;
            if (srcIdx !== undefined && textures[srcIdx]) texIdx = srcIdx;
          }
        }
        const isEyeOrFace = /eye|iris|pupil|mouth|face/i.test(matName);

        const baseVertex = rawVerts.length;
        const pData = posAcc.data;
        const nData = normAcc ? normAcc.data : null;
        const uData = uvAcc ? uvAcc.data : null;
        const cData = colAcc ? colAcc.data : null;
        const cComp = colAcc ? colAcc.numComp : 3;

        for (let i = 0; i < posAcc.count; ++i) {
          const px = pData[i * 3 + 0];
          const py = pData[i * 3 + 1];
          const pz = pData[i * 3 + 2];
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;

          const nx = nData ? nData[i * 3 + 0] : 0;
          const ny = nData ? nData[i * 3 + 1] : 1;
          const nz = nData ? nData[i * 3 + 2] : 0;
          const u = uData ? uData[i * 2 + 0] : 0;
          const v = uData ? uData[i * 2 + 1] : 0;

          let cr = baseFactor[0], cg = baseFactor[1], cb = baseFactor[2];
          if (texIdx >= 0 && textures[texIdx]) {
            const s = sampleGlbTexture(textures[texIdx], u, v);
            if (s) {
              cr *= s.r;
              cg *= s.g;
              cb *= s.b;
            }
          } else if (cData) {
            cr *= cData[i * cComp + 0];
            cg *= cData[i * cComp + 1];
            cb *= cData[i * cComp + 2];
          }

          if (isEyeOrFace) eyeCheckIndices.push(rawVerts.length);
          rawVerts.push({
            pos: { x: px, y: py, z: pz },
            norm: { x: nx, y: ny, z: nz },
            u,
            v,
            texIdx,
            col: { x: cr, y: cg, z: cb }
          });
        }

        if (idxAcc) {
          const iData = idxAcc.data;
          for (let i = 0; i + 2 < idxAcc.count; i += 3) {
            rawIndices.push(baseVertex + iData[i], baseVertex + iData[i + 1], baseVertex + iData[i + 2]);
          }
        } else {
          for (let i = 0; i + 2 < posAcc.count; i += 3) {
            rawIndices.push(baseVertex + i, baseVertex + i + 1, baseVertex + i + 2);
          }
        }
      }
    }

    if (rawVerts.length < 12 || rawIndices.length < 12) return null;

    // Detecção Automática de Eixo Vertical (Y_UP vs Z_UP vs X_UP) por Simetria Bilateral + Plano dos Pés
    const spanX = Math.max(1e-4, maxX - minX);
    const spanY = Math.max(1e-4, maxY - minY);
    const spanZ = Math.max(1e-4, maxZ - minZ);
    const symX = Math.abs(minX + maxX) / spanX;
    let axisMode = "Y_UP";
    if (symX > 0.35) {
      axisMode = "X_UP";
    } else if ((minZ / spanZ) > (minY / spanY) + 0.12) {
      axisMode = "Z_UP";
    }

    let wMinX = Infinity, wMaxX = -Infinity;
    let wMinY = Infinity, wMaxY = -Infinity;
    let wMinZ = Infinity, wMaxZ = -Infinity;

    for (let i = 0; i < rawVerts.length; ++i) {
      const rv = rawVerts[i];
      const lx = rv.pos.x, ly = rv.pos.y, lz = rv.pos.z;
      const lnx = rv.norm.x, lny = rv.norm.y, lnz = rv.norm.z;
      let wx = lx, wy = ly, wz = lz;
      let nx = lnx, ny = lny, nz = lnz;

      if (axisMode === "X_UP") {
        wx = ly;  wy = lx;  wz = lz;
        nx = lny; ny = lnx; nz = lnz;
      } else if (axisMode === "Z_UP") {
        wx = lx;  wy = lz;  wz = -ly;
        nx = lnx; ny = lnz; nz = -lny;
      }

      rv.pos.x = wx; rv.pos.y = wy; rv.pos.z = wz;
      rv.norm = norm3({ x: nx, y: ny, z: nz });
      if (wx < wMinX) wMinX = wx; if (wx > wMaxX) wMaxX = wx;
      if (wy < wMinY) wMinY = wy; if (wy > wMaxY) wMaxY = wy;
      if (wz < wMinZ) wMinZ = wz; if (wz > wMaxZ) wMaxZ = wz;
    }

    const wSpanX = Math.max(1e-4, wMaxX - wMinX);
    const wSpanY = Math.max(1e-4, wMaxY - wMinY);
    const wSpanZ = Math.max(1e-4, wMaxZ - wMinZ);
    const normScale = 1.78 / Math.max(wSpanX * 0.92, wSpanY, wSpanZ * 0.82);
    const cx = (wMinX + wMaxX) * 0.5;
    const cz = (wMinZ + wMaxZ) * 0.5;

    for (let i = 0; i < rawVerts.length; ++i) {
      const rv = rawVerts[i];
      rv.pos.x = (rv.pos.x - cx) * normScale;
      rv.pos.y = (rv.pos.y - wMinY) * normScale;
      rv.pos.z = (rv.pos.z - cz) * normScale;
      rv.uv = Math.max(0, Math.min(1, rv.pos.y / 1.78));
    }

    // Garante que o rosto/olhos do modelo 3D apontem sempre para +Z (em direção à câmera/jogador)
    if (eyeCheckIndices.length > 0) {
      let avgEyeZ = 0;
      for (let i = 0; i < eyeCheckIndices.length; ++i) {
        avgEyeZ += rawVerts[eyeCheckIndices[i]].pos.z;
      }
      avgEyeZ /= eyeCheckIndices.length;
      if (avgEyeZ < -0.02) {
        for (let i = 0; i < rawVerts.length; ++i) {
          rawVerts[i].pos.z = -rawVerts[i].pos.z;
          rawVerts[i].pos.x = -rawVerts[i].pos.x;
          rawVerts[i].norm.z = -rawVerts[i].norm.z;
          rawVerts[i].norm.x = -rawVerts[i].norm.x;
        }
      }
    }

    return {
      verts: rawVerts,
      indices: rawIndices,
      textures,
      isReal3DGlb: true
    };
  }

  function fetchAndUpgradeReal3DGlbPokemonMesh(speciesId, isShiny) {
    const key = `${speciesId}_${isShiny ? 1 : 0}`;
    if (GLB_LOADING.has(key)) return;
    GLB_LOADING.add(key);

    const folder = isShiny ? "shiny" : "regular";
    const primaryUrl = `https://raw.githubusercontent.com/Sudhanshu-Ambastha/Pokemon-3D/main/models/glb/${folder}/${speciesId}.glb`;
    const fallbackUrl = `https://raw.githubusercontent.com/Sudhanshu-Ambastha/Pokemon-3D/main/models/glb/regular/${speciesId}.glb`;

    fetch(primaryUrl)
      .then((res) => {
        if (!res.ok && isShiny) return fetch(fallbackUrl);
        return res;
      })
      .then((res) => (res && res.ok ? res.arrayBuffer() : null))
      .then((buf) => (buf ? parseAndBuildReal3DGlbMesh(buf, isShiny) : null))
      .then((glbMesh) => {
        if (glbMesh && glbMesh.verts.length > 20) {
          MESH_CACHE.set(key, glbMesh);
          ASCII_PORTRAIT_CACHE.delete(`${key}_0`);
          ASCII_PORTRAIT_CACHE.delete(`${key}_1`);
        }
      })
      .catch(() => {});
  }

  function appendEyes3D(m, headY, headZ, spreadX, eyeSize, eyeCol) {
    const wht = vec3(1.0, 1.0, 1.0), pup = vec3(0.06, 0.06, 0.10);
    appendBox(m, -spreadX, headY, headZ, eyeSize*1.2, eyeSize*1.35, 0.06, wht, 0.25);
    appendBox(m,  spreadX, headY, headZ, eyeSize*1.2, eyeSize*1.35, 0.06, wht, 0.25);
    appendBox(m, -spreadX*0.88, headY, headZ+0.05, eyeSize*0.65, eyeSize*0.80, 0.04, eyeCol || pup, 0.25);
    appendBox(m,  spreadX*0.88, headY, headZ+0.05, eyeSize*0.65, eyeSize*0.80, 0.04, eyeCol || pup, 0.25);
  }

  function computeVisualScale(speciesIdOrHeight, scaleVariation = 1.0) {
    let h = 1.0;
    if (window.PokeData && Number.isInteger(speciesIdOrHeight) && speciesIdOrHeight >= 1) {
      const sp = window.PokeData.getSpecies(speciesIdOrHeight);
      h = (sp && sp.height_m) ? sp.height_m : 1.0;
    } else {
      h = Math.max(0.25, speciesIdOrHeight || 1.0);
    }
    return Math.max(0.72, Math.min(1.85, (0.68 + 0.42 * Math.sqrt(h)) * (scaleVariation || 1.0)));
  }

  function getPokemonMesh(speciesId, isShiny = false) {
    const key = `${speciesId}_${isShiny ? 1 : 0}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);

    // 1. Dispara carregamento do Modelo 3D Real (.GLB com milhares de triângulos + texturas UV)
    fetchAndUpgradeReal3DGlbPokemonMesh(speciesId, isShiny);
    // 2. Dispara fallback rápido de Relevo Volumétrico 3D 52x52 de 6 faces
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
    const dark = vec3(0.14, 0.22, 0.38);
    // Pedestal escalonado 3D
    appendEllipsoid(m, 0, 0.08, 0, 0.72, 0.08, 0.72, dark, 6, 14, 0);
    appendEllipsoid(m, 0, 0.20, 0, 0.52, 0.10, 0.52, poleCol, 6, 14, 0);
    appendEllipsoid(m, 0, 0.34, 0, 0.32, 0.08, 0.32, wht, 6, 12, 0);
    // Coluna central com aneis luminosos
    appendBox(m, 0, 0.92, 0, 0.13, 0.62, 0.13, poleCol, 0);
    appendEllipsoid(m, 0, 0.85, 0, 0.24, 0.06, 0.24, wht, 5, 10, 0.2);
    appendEllipsoid(m, 0, 1.25, 0, 0.24, 0.06, 0.24, topCol, 5, 10, 0.4);
    // Anel Holografico Externo + Nucleo Cubico 3D + Antena Superior
    appendEllipsoid(m, 0, 1.88, 0, 0.76, 0.76, 0.13, wht, 10, 18, 0.5);
    appendEllipsoid(m, 0, 1.88, 0, 0.56, 0.56, 0.16, poleCol, 8, 16, 0.6);
    appendBox(m, 0, 1.88, 0, 0.36, 0.36, 0.36, topCol, 0.8);
    appendCone(m, 0, 2.58, 0, 0, 3.05, 0, 0.12, topCol, wht, 0.9);
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
    const dark = vec3(0.22, 0.28, 0.38);
    const wht = vec3(0.96, 0.98, 1.0);
    // Base de Coliseu em 3 aneis
    appendEllipsoid(m, 0, 0.18, 0, 1.25, 0.18, 1.25, dark, 8, 16, 0);
    appendEllipsoid(m, 0, 0.48, 0, 0.96, 0.28, 0.96, slv, 8, 16, 0);
    appendEllipsoid(m, 0, 0.78, 0, 0.75, 0.15, 0.75, teamCol, 8, 16, 0.2);
    // 4 Pilares inclinados de sustentacao do estadio + nucleo energetico
    appendBox(m,  0.00, 1.55,  0.00, 0.36, 0.85, 0.36, slv, 0.2);
    appendBox(m, -0.52, 1.45, -0.52, 0.12, 0.85, 0.12, teamCol, 0.3);
    appendBox(m,  0.52, 1.45, -0.52, 0.12, 0.85, 0.12, teamCol, 0.3);
    appendBox(m, -0.52, 1.45,  0.52, 0.12, 0.85, 0.12, teamCol, 0.3);
    appendBox(m,  0.52, 1.45,  0.52, 0.12, 0.85, 0.12, teamCol, 0.3);
    // Plataforma Superior de Batalha + Torres de Cristal da Equipe
    appendEllipsoid(m, 0, 2.42, 0, 1.28, 0.28, 1.28, teamCol, 10, 18, 0.6);
    appendEllipsoid(m, 0, 2.62, 0, 1.02, 0.16, 1.02, wht, 8, 16, 0.7);
    appendCone(m, -0.92, 2.55, 0, -1.18, 3.45, 0, 0.20, teamCol, wht, 0.9);
    appendCone(m,  0.92, 2.55, 0,  1.18, 3.45, 0, 0.20, teamCol, wht, 0.9);
    appendCone(m, 0, 2.55, -0.92, 0, 3.35, -1.15, 0.16, slv, teamCol, 0.9);
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

  // Edificios Arquitetonicos 3D e Arvores 3D para dar volume urbano real ao Mapa GPS!
  function buildCityBuilding3DMesh(variant = 0) {
    const key = `city_bldg_${variant}`;
    if (MESH_CACHE.has(key)) return MESH_CACHE.get(key);
    const m = createMesh();
    const wall = variant % 2 === 0 ? vec3(0.26, 0.36, 0.64) : vec3(0.22, 0.32, 0.58);
    const roof = vec3(0.36, 0.48, 0.78);
    const win  = vec3(0.55, 0.82, 0.98);
    const h = 1.35 + (variant % 3) * 0.55;
    // Corpo principal do predio + cornija do telhado + faixas de janelas iluminadas
    appendBox(m, 0, h * 0.5, 0, 1.05, h * 0.5, 1.05, wall, 0);
    appendBox(m, 0, h + 0.06, 0, 1.12, 0.06, 1.12, roof, 0);
    appendBox(m, 0.25, h + 0.22, -0.20, 0.24, 0.16, 0.24, roof, 0);
    for (let fl = 0.45; fl < h - 0.2; fl += 0.55) {
      appendBox(m, 0, fl,  1.06, 0.78, 0.12, 0.02, win, 0);
      appendBox(m, 0, fl, -1.06, 0.78, 0.12, 0.02, win, 0);
      appendBox(m,  1.06, fl, 0, 0.02, 0.12, 0.78, win, 0);
      appendBox(m, -1.06, fl, 0, 0.02, 0.12, 0.78, win, 0);
    }
    recomputeNormals(m);
    MESH_CACHE.set(key, m);
    return m;
  }

  function buildCityTree3DMesh() {
    if (MESH_CACHE.has("city_tree")) return MESH_CACHE.get("city_tree");
    const m = createMesh();
    const trunk = vec3(0.45, 0.30, 0.18);
    const leaf1 = vec3(0.16, 0.68, 0.48);
    const leaf2 = vec3(0.24, 0.84, 0.58);
    appendBox(m, 0, 0.35, 0, 0.12, 0.35, 0.12, trunk, 0);
    appendCone(m, 0, 0.55, 0, 0, 1.45, 0, 0.58, leaf1, leaf2, 0.3);
    appendCone(m, 0, 1.05, 0, 0, 1.85, 0, 0.44, leaf1, leaf2, 0.6);
    recomputeNormals(m);
    MESH_CACHE.set("city_tree", m);
    return m;
  }

  // ============================================================================
  // GERADOR DE RETRATOS 100% ASCII 3D DE ALTA DEFINIÇÃO (36x34 CÉLULAS ASCII)
  // Usa rampa de sombreamento anatômico (@ # % * + = - : .) + Sobel 3D!
  // ============================================================================
  function getPokemonCardImageSrc(speciesId, isSilhouette = false, isShiny = false) {
    const cacheKey = `${speciesId}_${isShiny ? 1 : 0}_${isSilhouette ? 1 : 0}`;
    if (ASCII_PORTRAIT_CACHE.has(cacheKey)) return ASCII_PORTRAIT_CACHE.get(cacheKey);

    const mesh = getPokemonMesh(speciesId, isShiny);
    const gw = 44, gh = 42;
    const cellW = 3, cellH = 4;
    const c = document.createElement("canvas");
    c.width = gw * cellW;
    c.height = gh * cellH;
    const ctx = c.getContext("2d");

    const pR = new Float32Array(gw * gh);
    const pG = new Float32Array(gw * gh);
    const pB = new Float32Array(gw * gh);
    const pZ = new Float32Array(gw * gh);
    const pNx = new Float32Array(gw * gh);
    const pNy = new Float32Array(gw * gh);
    const pHit = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; ++i) pZ[i] = 1.0;

    const basis = mat4LookAtBasis(vec3(0.32, 1.02, 2.35), vec3(0, 0.85, 0));
    const proj = mat4Perspective(44 * Math.PI / 180, (gw * cellW) / (gh * cellH), 0.2, 10.0);
    const mvp = mat4Mul(proj, basis.view);
    const lightDir = norm3({x: 0.38, y: 0.78, z: 0.52});

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

          let nx = v0.norm.x*w0 + v1.norm.x*w1 + v2.norm.x*w2;
          let ny = v0.norm.y*w0 + v1.norm.y*w1 + v2.norm.y*w2;
          const nz = v0.norm.z*w0 + v1.norm.z*w1 + v2.norm.z*w2;

          let cr = v0.col.x*w0 + v1.col.x*w1 + v2.col.x*w2;
          let cg = v0.col.y*w0 + v1.col.y*w1 + v2.col.y*w2;
          let cb = v0.col.z*w0 + v1.col.z*w1 + v2.col.z*w2;

          if (mesh.textures && v0.texIdx !== undefined && v0.texIdx >= 0 && mesh.textures[v0.texIdx]) {
            const tu = v0.u*w0 + v1.u*w1 + v2.u*w2;
            const tv = v0.v*w0 + v1.v*w1 + v2.v*w2;
            const s = sampleGlbTexture(mesh.textures[v0.texIdx], tu, tv);
            if (s) {
              cr = s.r;
              cg = s.g;
              cb = s.b;
              nx += s.dU * 2.2;
              ny += s.dV * 2.2;
            }
          }

          pNx[idx] = nx; pNy[idx] = ny;
          const lit = Math.min(1.42, 0.44 + 0.74 * Math.max(0, nx*lightDir.x + ny*lightDir.y + nz*lightDir.z));

          pR[idx] = Math.min(1, cr * lit);
          pG[idx] = Math.min(1, cg * lit);
          pB[idx] = Math.min(1, cb * lit);
        }
      }
    }

    ctx.font = `bold ${cellH}px 'Cascadia Mono', Consolas, monospace`;
    ctx.textBaseline = "top";
    const shadeRamp = ".:-=+*#%@";

    for (let r = 0; r < gh; ++r) {
      for (let col = 0; col < gw; ++col) {
        const i = r * gw + col;
        if (!pHit[i]) continue;

        const isEdge = (col === 0 || !pHit[i-1]) || (col === gw-1 || !pHit[i+1]) ||
                       (r === 0 || !pHit[i-gw]) || (r === gh-1 || !pHit[i+gw]);

        if (isSilhouette) {
          ctx.fillStyle = isEdge ? "#0c2238" : "#153250";
          ctx.fillRect(col * cellW, r * cellH, cellW, cellH);
          ctx.fillStyle = isEdge ? "#38bdf8" : "#2563eb";
          ctx.fillText(isEdge ? "#" : "?", col * cellW, r * cellH);
        } else {
          const cr = Math.round(pR[i]*255), cg = Math.round(pG[i]*255), cb = Math.round(pB[i]*255);
          const luma = 0.299 * pR[i] + 0.587 * pG[i] + 0.114 * pB[i];
          const ch = isEdge ? "#" : shadeRamp[Math.min(shadeRamp.length - 1, Math.floor(luma * shadeRamp.length))];
          ctx.fillStyle = `rgb(${Math.round(cr*0.82)},${Math.round(cg*0.82)},${Math.round(cb*0.82)})`;
          ctx.fillRect(col * cellW, r * cellH, cellW, cellH);
          ctx.fillStyle = isEdge ? "#0f172a" : `rgb(${Math.min(255,cr+48)},${Math.min(255,cg+48)},${Math.min(255,cb+48)})`;
          ctx.fillText(ch, col * cellW, r * cellH);
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
        `[HTTPS] iPhone/iOS exige HTTPS para liberar a camera! Redirecionando para ${httpsUrl}`,
        "https_required",
        httpsUrl
      );
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onStatus("[AVISO] API de camera bloqueada pelo navegador (use HTTPS ou GitHub Pages).", "error");
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
      onStatus("[ERRO] Nao foi possivel abrir a camera: " + (lastErr ? lastErr.message : "Permissao negada"), "error");
      return false;
    }

    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (_) {}

    onStatus("[AR+] Camera Ao Vivo em Alta Definicao ASCII ativada!", "ok");
    return true;
  }

  return {
    RAMP_HD,
    RAMP_STD,
    vec3, add3, sub3, mul3, dot3, cross3, norm3,
    mat4Identity, mat4Mul, mat4Vec4, mat4Translation, mat4Scale, mat4RotX, mat4RotY, mat4RotZ,
    mat4View6DoF, mat4LookAtBasis, mat4Perspective, projectPoint3D,
    computeVisualScale,
    getPokemonMesh,
    sampleGlbTexture,
    buildPokeballMesh,
    buildAnchorRingMesh,
    buildTrainerAvatarMesh,
    buildPokestop3DMesh,
    buildGymTower3DMesh,
    buildVillainBalloon3DMesh,
    buildCityBuilding3DMesh,
    buildCityTree3DMesh,
    getPokemonCardImageSrc,
    startCameraOnVideoElement
  };
})();
