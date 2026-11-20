import * as THREE from 'three';

// Module-scoped scratch helpers — zero allocations inside render ticks
const _upY = new THREE.Vector3(0, 1, 0);
const _upZ = new THREE.Vector3(0, 0, 1);
const _scratchDir = new THREE.Vector3();
const _scratchPos = new THREE.Vector3();
const _scratchNext = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3(1, 1, 1);
const _scratchMat4 = new THREE.Matrix4();
const _scratchColor = new THREE.Color();

export function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function afterDrawSync(
  renderer: THREE.WebGLRenderer,
  timerHandleRef: { id: number },
  cb: () => void
): void {
  try {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      timerHandleRef.id = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!sync) {
        timerHandleRef.id = window.setTimeout(cb, 80);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        timerHandleRef.id = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        timerHandleRef.id = window.setTimeout(cb, 80);
      }
    };
    timerHandleRef.id = window.setTimeout(poll, 5);
  } catch {
    timerHandleRef.id = window.setTimeout(cb, 80);
  }
}

export interface ProceduralPbrTextureSet {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Procedural 512x512 Stratified Rockmass Albedo + Linear Bump Map (Zero external 404 files)
 */
export function createProceduralRockTextures(
  anisotropy = 4,
  repeatX = 4,
  repeatY = 4
): ProceduralPbrTextureSet {
  const size = 512;
  const rand = seededRand(4072026);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (cCtx && bCtx) {
    cCtx.fillStyle = '#d8dee6';
    cCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Subtle stratified foliation bands wrapping seamlessly horizontally
    for (let band = 0; band < 42; band++) {
      const yBase = (band / 42) * size;
      const amp = 4 + rand() * 7;
      const freq = 1 + Math.floor(rand() * 3);
      const tone = 198 + Math.floor(rand() * 36);
      const bumpVal = 104 + Math.floor(rand() * 48);

      cCtx.strokeStyle = `rgba(${tone - 18}, ${tone - 12}, ${tone - 4}, 0.42)`;
      cCtx.lineWidth = 2 + rand() * 5;
      cCtx.beginPath();

      bCtx.strokeStyle = `rgba(${bumpVal}, ${bumpVal}, ${bumpVal}, 0.52)`;
      bCtx.lineWidth = cCtx.lineWidth;
      bCtx.beginPath();

      for (let x = 0; x <= size; x += 8) {
        const dy = Math.sin((x / size) * Math.PI * 2 * freq + band) * amp;
        if (x === 0) {
          cCtx.moveTo(x, yBase + dy);
          bCtx.moveTo(x, yBase + dy);
        } else {
          cCtx.lineTo(x, yBase + dy);
          bCtx.lineTo(x, yBase + dy);
        }
      }
      cCtx.stroke();
      bCtx.stroke();
    }

    // Fine fracture veins & mineral aggregate grain
    for (let k = 0; k < 2200; k++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.8 + rand() * 2.2;
      const isDark = rand() > 0.45;
      cCtx.fillStyle = isDark
        ? `rgba(100, 116, 139, ${0.12 + rand() * 0.16})`
        : `rgba(248, 250, 252, ${0.18 + rand() * 0.22})`;
      cCtx.fillRect(x, y, r, r);

      const bv = isDark ? 65 : 205;
      bCtx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.22)`;
      bCtx.fillRect(x, y, r, r);
    }

    // Sharp micro-joint hairline seams
    for (let s = 0; s < 18; s++) {
      const x0 = rand() * size;
      const y0 = rand() * size;
      const len = 35 + rand() * 90;
      const ang = (rand() - 0.5) * 1.1;
      const x1 = x0 + Math.cos(ang) * len;
      const y1 = y0 + Math.sin(ang) * len;
      cCtx.strokeStyle = 'rgba(71, 85, 105, 0.34)';
      cCtx.lineWidth = 1;
      cCtx.beginPath();
      cCtx.moveTo(x0, y0);
      cCtx.lineTo(x1, y1);
      cCtx.stroke();

      bCtx.strokeStyle = 'rgba(30, 30, 30, 0.55)';
      bCtx.lineWidth = 1.4;
      bCtx.beginPath();
      bCtx.moveTo(x0, y0);
      bCtx.lineTo(x1, y1);
      bCtx.stroke();
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(repeatX, repeatY);
  colorMap.anisotropy = Math.max(1, anisotropy);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  // Data map stays linear (NoColorSpace)
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = Math.max(1, anisotropy);

  return {
    colorMap,
    bumpMap,
    dispose: () => {
      colorMap.dispose();
      bumpMap.dispose();
    },
  };
}

/**
 * Procedural 512x512 Shotcrete / Sprayed Concrete Texture Set (Zero external 404 files)
 */
export function createProceduralShotcreteTextures(
  anisotropy = 4,
  repeatX = 4,
  repeatY = 4
): ProceduralPbrTextureSet {
  const size = 512;
  const rand = seededRand(9082026);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (cCtx && bCtx) {
    cCtx.fillStyle = '#cbd5e1';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1 + rand() * 2.5;
      const shade = 165 + Math.floor(rand() * 55);
      cCtx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 8}, 0.35)`;
      cCtx.fillRect(x, y, r, r);

      const bv = 70 + Math.floor(rand() * 120);
      bCtx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.35)`;
      bCtx.fillRect(x, y, r, r);
    }
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(repeatX, repeatY);
  colorMap.anisotropy = Math.max(1, anisotropy);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.anisotropy = Math.max(1, anisotropy);

  return {
    colorMap,
    bumpMap,
    dispose: () => {
      colorMap.dispose();
      bumpMap.dispose();
    },
  };
}

export interface TunnelSupportPointSample {
  position: THREE.Vector3;
  inwardNormal: THREE.Vector3;
}

export interface TunnelSupportBuildInput {
  boltStations: TunnelSupportPointSample[][];
  ribLoops: THREE.Vector3[][];
  boltLengthM?: number;
  includeShotcreteRibFlanges?: boolean;
}

/**
 * Builds composite multi-part InstancedMesh tunnel rock bolts (bearing plate + hex collar + shank)
 * and instanced Steel Arch / Lattice Girder segments cleanly from profile samples.
 */
export function buildInstancedTunnelSupports(
  input: TunnelSupportBuildInput
): THREE.Group {
  const group = new THREE.Group();
  const boltLengthM = input.boltLengthM ?? 1.45;
  const flatBolts = input.boltStations.flat();

  if (flatBolts.length > 0) {
    const plateGeom = new THREE.BoxGeometry(0.19, 0.19, 0.028);
    const collarGeom = new THREE.CylinderGeometry(0.032, 0.038, 0.048, 6);
    collarGeom.rotateX(Math.PI / 2);
    const shankGeom = new THREE.CylinderGeometry(0.015, 0.015, boltLengthM, 8);
    shankGeom.rotateX(Math.PI / 2);

    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.78,
      roughness: 0.28,
    });
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.22,
    });
    const shankMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.72,
      roughness: 0.36,
    });

    const platesMesh = new THREE.InstancedMesh(plateGeom, plateMat, flatBolts.length);
    const collarsMesh = new THREE.InstancedMesh(collarGeom, collarMat, flatBolts.length);
    const shanksMesh = new THREE.InstancedMesh(shankGeom, shankMat, flatBolts.length);

    for (let i = 0; i < flatBolts.length; i++) {
      const sample = flatBolts[i];
      _scratchDir.copy(sample.inwardNormal).normalize();
      if (_scratchDir.lengthSq() < 0.0001) {
        _scratchDir.set(0, -1, 0);
      }
      _scratchQuat.setFromUnitVectors(_upZ, _scratchDir);

      // Bearing plate flush on rock perimeter
      _scratchPos.copy(sample.position).addScaledVector(_scratchDir, 0.015);
      _scratchScale.set(1, 1, 1);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      platesMesh.setMatrixAt(i, _scratchMat4);
      _scratchColor.setHex(i % 2 === 0 ? 0x1d4ed8 : 0x0284c7);
      platesMesh.setColorAt(i, _scratchColor);

      // Hex washer & nut collar protruding inward slightly
      _scratchPos.copy(sample.position).addScaledVector(_scratchDir, 0.042);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      collarsMesh.setMatrixAt(i, _scratchMat4);

      // Radial rockbolt grouted shank extending outward into the rock mass
      _scratchPos.copy(sample.position).addScaledVector(_scratchDir, -boltLengthM * 0.45);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
      shanksMesh.setMatrixAt(i, _scratchMat4);
    }

    platesMesh.instanceMatrix.needsUpdate = true;
    collarsMesh.instanceMatrix.needsUpdate = true;
    shanksMesh.instanceMatrix.needsUpdate = true;
    if (platesMesh.instanceColor) platesMesh.instanceColor.needsUpdate = true;
    platesMesh.computeBoundingSphere();
    collarsMesh.computeBoundingSphere();
    shanksMesh.computeBoundingSphere();

    group.add(platesMesh, collarsMesh, shanksMesh);
  }

  // Arch Steel Ribs / Lattice Girders assembled via InstancedMesh segments for minimal draw calls
  let ribSegCount = 0;
  for (const loop of input.ribLoops) {
    if (loop.length >= 2) ribSegCount += loop.length - 1;
  }

  if (ribSegCount > 0) {
    const beamGeom = new THREE.BoxGeometry(0.11, 1.0, 0.13);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.74,
      roughness: 0.34,
    });
    const ribsMesh = new THREE.InstancedMesh(beamGeom, beamMat, ribSegCount);

    let idx = 0;
    for (const loop of input.ribLoops) {
      for (let k = 0; k < loop.length - 1; k++) {
        const a = loop[k];
        const b = loop[k + 1];
        _scratchNext.subVectors(b, a);
        const segLen = _scratchNext.length();
        if (segLen < 0.01) {
          _scratchScale.set(0.001, 0.001, 0.001);
          _scratchMat4.compose(a, _scratchQuat.identity(), _scratchScale);
          ribsMesh.setMatrixAt(idx++, _scratchMat4);
          continue;
        }
        _scratchDir.copy(_scratchNext).divideScalar(segLen);
        _scratchPos.addVectors(a, b).multiplyScalar(0.5);
        _scratchQuat.setFromUnitVectors(_upY, _scratchDir);
        _scratchScale.set(1, segLen * 1.04, 1);
        _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
        ribsMesh.setMatrixAt(idx++, _scratchMat4);
      }
    }

    ribsMesh.instanceMatrix.needsUpdate = true;
    ribsMesh.computeBoundingSphere();
    group.add(ribsMesh);
  }

  return group;
}

export function dampVector3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dtSec: number
): boolean {
  const safeDt = Math.min(Math.max(dtSec, 0.001), 0.05);
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, safeDt);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, safeDt);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, safeDt);
  return (
    Math.abs(current.x - target.x) > 0.004 ||
    Math.abs(current.y - target.y) > 0.004 ||
    Math.abs(current.z - target.z) > 0.004
  );
}
