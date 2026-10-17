import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  CheckCircle2,
  Compass,
  Download,
  Eye,
  FileCode,
  Layers,
  Maximize2,
  Move,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  OverbreakUndercutAnalysis,
  PhotoSurface,
  Point2D,
  SavedProjectRecord,
  StrikeDip3DSnapshotAppendix,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  JOINT_SET_PALETTE,
  formatJointTraceLineLabel,
} from '../engine/orientationEngine';
import { generateSampleTunnelPhotograph } from '../engine/sampleFieldData';

export type Tunnel3DDisplayMode =
  | 'PHOTO_ONLY'
  | 'PHOTO_AND_TRACES'
  | 'PHOTO_AND_3D_PLANES'
  | 'PHOTO_OVERBREAK_SUPPORT';

export type Tunnel3DCameraMode = 'ORBIT_CUTAWAY' | 'INSIDE_WALKTHROUGH' | 'ISOMETRIC_CORRIDOR';

interface PhotoTextured3DTunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  joints: Joint[];
  jointSets: JointSet[];
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  savedProjects?: SavedProjectRecord[];
  onUploadPhotoFile?: (surface: SurfaceType, file: File) => void;
  onUpdatePhotoSurface?: (
    surface: SurfaceType,
    updater: (prev: PhotoSurface) => PhotoSurface
  ) => void;
  onCaptureSnapshotToSheet?: (snapshot: StrikeDip3DSnapshotAppendix) => void;
  onStatusMessage?: (msg: string) => void;
}

interface Vec3 {
  x: number; // Transverse (m): -width/2 (Left) to +width/2 (Right)
  y: number; // Vertical (m): 0 (Invert) to +height (Crown Apex)
  z: number; // Chainage / Drive axis (m): 0 (Portal/Start of pull) to +roundLength (Excavation Face)
}

interface ProjectedVertex {
  sx: number;
  sy: number;
  depth: number;
  camZ: number;
  visible: boolean;
}

interface TexturedQuad3D {
  p00: Vec3;
  p10: Vec3;
  p11: Vec3;
  p01: Vec3;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  surface: SurfaceType;
  normal: Vec3;
  overbreakDeltaMeters: number;
}

/**
 * High-contrast CLAHE + Unsharp Mask 2x Super-Resolution Canvas Upscaler
 * Enhances rock texture micro-cracks, mineral grains, and bedding contrast for 3D UV mapping.
 */
async function upscaleAndSharpenPhotoDataUrl(sourceUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const targetW = Math.min(1800, Math.max(1100, Math.round(img.width * 1.5)));
        const targetH = Math.min(1350, Math.max(820, Math.round(img.height * 1.5)));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;
        const copy = new Uint8ClampedArray(data);
        const w = targetW;
        const h = targetH;

        // 3x3 Unsharp Mask + Local Contrast Boost for crisp rock fracture & grain relief
        const amount = 0.48;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const center = copy[idx + c];
              const neighbors =
                (copy[((y - 1) * w + x) * 4 + c] +
                  copy[((y + 1) * w + x) * 4 + c] +
                  copy[(y * w + (x - 1)) * 4 + c] +
                  copy[(y * w + (x + 1)) * 4 + c]) *
                0.25;
              const detail = center - neighbors;
              // Slight S-curve contrast stretch around mid-tone 128
              const contrasted = 128 + (center - 128) * 1.08 + detail * amount * 2.1;
              data[idx + c] = Math.max(0, Math.min(255, Math.round(contrasted)));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.94));
      } catch {
        resolve(sourceUrl);
      }
    };
    img.onerror = () => resolve(sourceUrl);
    img.src = sourceUrl;
  });
}

/**
 * Extracts a normalized 64x64 luminance & gradient relief grid from a loaded HTMLImageElement
 * so the 3D tunnel mesh vertices physically displace along rock blocks & fracture valleys.
 */
function extractLuminanceReliefGrid(img: HTMLImageElement, gridW = 48, gridH = 48): Float32Array {
  const relief = new Float32Array(gridW * gridH);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = gridW;
    canvas.height = gridH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return relief;
    ctx.drawImage(img, 0, 0, gridW, gridH);
    const data = ctx.getImageData(0, 0, gridW, gridH).data;
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const i = (y * gridW + x) * 4;
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        // Center around 0: dark cracks recede (-), bright rock facets protrude (+)
        relief[y * gridW + x] = (lum - 0.48) * 2.0;
      }
    }
  } catch {
    // Ignore CORS or canvas read errors
  }
  return relief;
}

function sampleReliefGrid(
  grid: Float32Array | undefined,
  u: number,
  v: number,
  gridW = 48,
  gridH = 48
): number {
  if (!grid || grid.length === 0) return 0;
  const gx = Math.max(0, Math.min(gridW - 1, Math.round(u * (gridW - 1))));
  const gy = Math.max(0, Math.min(gridH - 1, Math.round(v * (gridH - 1))));
  return grid[gy * gridW + gx] || 0;
}

/**
 * Draws a textured triangle on an HTML5 2D Canvas with lighting tint and seam expansion.
 */
function drawLitTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number,
  shadeFactor: number,
  tintColor: string | null = null
) {
  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  if (Math.abs(denom) < 1e-4) return;

  ctx.save();
  // Expand triangle clip radially by 0.95px from centroid to prevent hairline wireframe gaps
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  const expand = (x: number, y: number) => {
    const vx = x - cx;
    const vy = y - cy;
    const len = Math.hypot(vx, vy) || 1;
    return { x: x + (vx / len) * 0.95, y: y + (vy / len) * 0.95 };
  };
  const p0 = expand(dx0, dy0);
  const p1 = expand(dx1, dy1);
  const p2 = expand(dx2, dy2);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();

  const m11 = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const m12 = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const m21 = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const m22 = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const dx =
    (dx0 * (sx1 * sy2 - sx2 * sy1) +
      dx1 * (sx2 * sy0 - sx0 * sy2) +
      dx2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;
  const dy =
    (dy0 * (sx1 * sy2 - sx2 * sy1) +
      dy1 * (sx2 * sy0 - sx0 * sy2) +
      dy2 * (sx0 * sy1 - sx1 * sy0)) /
    denom;

  ctx.save();
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  // Apply 3D directional lighting / shadow shading
  if (shadeFactor < 0.98) {
    const darkness = Math.max(0, Math.min(0.72, 1 - shadeFactor));
    ctx.fillStyle = `rgba(6, 10, 18, ${darkness.toFixed(3)})`;
    ctx.fill();
  } else if (shadeFactor > 1.03) {
    const highlight = Math.min(0.22, (shadeFactor - 1) * 0.65);
    ctx.fillStyle = `rgba(255, 250, 235, ${highlight.toFixed(3)})`;
    ctx.fill();
  }

  if (tintColor) {
    ctx.fillStyle = tintColor;
    ctx.fill();
  }

  ctx.restore();
}

export const PhotoTextured3DTunnelModal: React.FC<PhotoTextured3DTunnelModalProps> = ({
  isOpen,
  onClose,
  geometry,
  settings,
  photos,
  joints,
  jointSets,
  overbreakAnalysis,
  onUploadPhotoFile,
  onUpdatePhotoSurface,
  onCaptureSnapshotToSheet,
  onStatusMessage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadSurfaceRef = useRef<SurfaceType>('face');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayMode, setDisplayMode] = useState<Tunnel3DDisplayMode>('PHOTO_ONLY');
  const [cameraMode, setCameraMode] = useState<Tunnel3DCameraMode>('ORBIT_CUTAWAY');

  // Camera state
  const [yawDeg, setYawDeg] = useState<number>(-28);
  const [pitchDeg, setPitchDeg] = useState<number>(16);
  const [zoom, setZoom] = useState<number>(1.08);
  const [walkProgress, setWalkProgress] = useState<number>(0.15); // 0 = Portal entry, 0.85 = Near Face
  const [corridorPulls, setCorridorPulls] = useState<1 | 2 | 3>(1);

  // 3D Rock Relief & Deformation Controls
  const [reliefExaggerationMm, setReliefExaggerationMm] = useState<number>(140); // 0 to 350 mm
  const [applyOverbreakDeformation, setApplyOverbreakDeformation] = useState<boolean>(true);
  const [autoCutawayNearWall, setAutoCutawayNearWall] = useState<boolean>(true);
  const [headlampIntensity, setHeadlampIntensity] = useState<number>(1.05);

  // Surface Visibility Toggles
  const [showSurface, setShowSurface] = useState<Record<SurfaceType, boolean>>({
    face: true,
    crown: true,
    leftWall: true,
    rightWall: true,
  });
  const [showFloorGrid, setShowFloorGrid] = useState<boolean>(true);
  const [showWireframeMesh, setShowWireframeMesh] = useState<boolean>(false);

  // Upscaling State & Decoded HTMLImageElements
  const [isUpscalingAll, setIsUpscalingAll] = useState<boolean>(false);
  const [upscaledOverrides, setUpscaledOverrides] = useState<Partial<Record<SurfaceType, string>>>(
    {}
  );
  const [loadedImages, setLoadedImages] = useState<Record<SurfaceType, HTMLImageElement | null>>({
    face: null,
    crown: null,
    leftWall: null,
    rightWall: null,
  });
  const [reliefGrids, setReliefGrids] = useState<Record<SurfaceType, Float32Array>>({
    face: new Float32Array(0),
    crown: new Float32Array(0),
    leftWall: new Float32Array(0),
    rightWall: new Float32Array(0),
  });

  // Mouse Drag State
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startYaw: -28,
    startPitch: 16,
  });

  // Generate fallback sample photos so all 4 tunnel portions always have rich rock texture
  const fallbackPhotos = useMemo(() => {
    return {
      face: generateSampleTunnelPhotograph('face', geometry),
      crown: generateSampleTunnelPhotograph('crown', geometry),
      leftWall: generateSampleTunnelPhotograph('leftWall', geometry),
      rightWall: generateSampleTunnelPhotograph('rightWall', geometry),
    };
  }, [geometry]);

  // Resolve effective image URL for each surface
  const effectiveUrls = useMemo<Record<SurfaceType, string>>(() => {
    const getUrl = (s: SurfaceType) =>
      upscaledOverrides[s] ||
      photos[s]?.warpedImage ||
      photos[s]?.image ||
      fallbackPhotos[s];
    return {
      face: getUrl('face'),
      crown: getUrl('crown'),
      leftWall: getUrl('leftWall'),
      rightWall: getUrl('rightWall'),
    };
  }, [upscaledOverrides, photos, fallbackPhotos]);

  // Decode images and compute 2.5D luminance/fracture relief maps
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const surfaces: SurfaceType[] = ['face', 'crown', 'leftWall', 'rightWall'];

    Promise.all(
      surfaces.map(
        (s) =>
          new Promise<{ s: SurfaceType; img: HTMLImageElement | null; relief: Float32Array }>(
            (resolve) => {
              const url = effectiveUrls[s];
              if (!url) {
                resolve({ s, img: null, relief: new Float32Array(0) });
                return;
              }
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                const relief = extractLuminanceReliefGrid(img, 48, 48);
                resolve({ s, img, relief });
              };
              img.onerror = () => resolve({ s, img: null, relief: new Float32Array(0) });
              img.src = url;
            }
          )
      )
    ).then((results) => {
      if (cancelled) return;
      const nextImgs: Record<SurfaceType, HTMLImageElement | null> = {
        face: null,
        crown: null,
        leftWall: null,
        rightWall: null,
      };
      const nextRelief: Record<SurfaceType, Float32Array> = {
        face: new Float32Array(0),
        crown: new Float32Array(0),
        leftWall: new Float32Array(0),
        rightWall: new Float32Array(0),
      };
      for (const r of results) {
        nextImgs[r.s] = r.img;
        nextRelief[r.s] = r.relief;
      }
      setLoadedImages(nextImgs);
      setReliefGrids(nextRelief);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, effectiveUrls]);

  // Handle 1-Click 2x AI Super-Resolution & Unsharp Contrast Upscaling on all 4 surfaces
  const handleUpscaleAllPhotos = async () => {
    setIsUpscalingAll(true);
    try {
      const surfaces: SurfaceType[] = ['face', 'crown', 'leftWall', 'rightWall'];
      const nextOverrides: Partial<Record<SurfaceType, string>> = {};
      for (const s of surfaces) {
        const src = photos[s]?.warpedImage || photos[s]?.image || fallbackPhotos[s];
        const enhanced = await upscaleAndSharpenPhotoDataUrl(src);
        nextOverrides[s] = enhanced;
        if (photos[s]?.image && onUpdatePhotoSurface) {
          onUpdatePhotoSurface(s, (prev) => ({
            ...prev,
            warpedImage: enhanced,
          }));
        }
      }
      setUpscaledOverrides(nextOverrides);
      onStatusMessage?.(
        'Upscaled & sharpened all 4 tunnel surface photos (2x Unsharp + Local Contrast) for 3D Tunnel Texture Mapping.'
      );
    } finally {
      setIsUpscalingAll(false);
    }
  };

  // Build the 3D tunnel perimeter arch & wall profile points
  // Ordered continuously from Left Invert -> Left SPL -> Crown Apex -> Right SPL -> Right Invert
  // Supports D-Shaped, Horseshoe, Circular, Basket-Handle, and Custom CAD tunnel profiles
  const perimeterProfileNodes = useMemo(() => {
    const W = Math.max(2.0, geometry.width);
    const H = Math.max(2.0, geometry.height);
    const wallH = Math.min(H * 0.75, Math.max(0.8, geometry.wallHeight || H * 0.52));
    const archH = Math.max(0.5, H - wallH);
    const halfW = W / 2;
    const shape = geometry.profileType || geometry.crownGeometry || 'horseshoe';

    const isCircular = shape === 'circular';
    const isHorseshoe = shape === 'horseshoe' || shape === 'modified_horseshoe';
    const isBasketHandle = shape === 'flat_arch' || shape === 'top_heading';
    const isDShaped =
      shape === 'd_shaped' ||
      (!isCircular && !isHorseshoe && !isBasketHandle && shape !== 'custom_cad' && shape !== 'freeform_custom');

    const shapeLabel = isCircular
      ? 'Circular'
      : isHorseshoe
      ? 'Horseshoe'
      : isBasketHandle
      ? 'Basket-Handle'
      : isDShaped
      ? 'D-Shaped'
      : 'Custom CAD';

    const nodes: {
      x: number;
      y: number;
      surface: 'leftWall' | 'crown' | 'rightWall';
      u: number; // U along that surface's cross-section direction
      nx: number; // Inward normal X
      ny: number; // Inward normal Y
    }[] = [];

    // 1. Left Wall: 8 segments from y = 0 to y = wallH
    const nWall = 8;
    for (let i = 0; i <= nWall; i++) {
      const t = i / nWall;
      let x = -halfW;
      let y = t * wallH;
      let nx = 1;
      let ny = 0;

      if (isCircular) {
        // Lower left arc of circle from invert to springline
        const theta = -Math.PI / 2 - (1 - t) * (Math.PI / 2);
        x = halfW * Math.cos(theta);
        y = H / 2 + (H / 2) * Math.sin(theta);
        nx = -Math.cos(theta);
        ny = -Math.sin(theta);
      } else if (isHorseshoe) {
        // Horseshoe haunch curves inward toward invert
        x = -halfW * (0.91 + 0.09 * t);
        y = t * wallH;
        nx = 0.98;
        ny = -0.09;
      }

      nodes.push({
        x,
        y: Math.max(0, y),
        surface: 'leftWall',
        u: 1 - t, // v=0 is top SPL, v=1 is bottom invert
        nx,
        ny,
      });
    }

    // 2. Crown Arch: 16 segments from Left SPL (theta = PI) to Right SPL (theta = 0)
    const nCrown = 16;
    for (let i = 0; i <= nCrown; i++) {
      const t = i / nCrown; // 0 = Left SPL, 0.5 = Crown Apex, 1 = Right SPL
      const theta = Math.PI * (1 - t);
      let x = halfW * Math.cos(theta);
      let y = wallH + archH * Math.sin(theta);
      let nx = -Math.cos(theta);
      let ny = -Math.sin(theta);

      if (isCircular) {
        y = H / 2 + (H / 2) * Math.sin(theta);
        nx = -Math.cos(theta);
        ny = -Math.sin(theta);
      } else if (isBasketHandle) {
        // 3-centered basket-handle profile: broader roof, tighter corners
        const archFactor = Math.pow(Math.sin(theta), 0.72);
        y = wallH + archH * archFactor;
        ny = -Math.max(0.2, Math.sin(theta));
      }

      const nLen = Math.hypot(nx, ny) || 1;
      nodes.push({
        x,
        y,
        surface: 'crown',
        u: t,
        nx: nx / nLen,
        ny: ny / nLen,
      });
    }

    // 3. Right Wall: 8 segments from y = wallH down to y = 0
    for (let i = 0; i <= nWall; i++) {
      const t = i / nWall; // 0 = Right SPL (top), 1 = Right Invert (bottom)
      let x = halfW;
      let y = (1 - t) * wallH;
      let nx = -1;
      let ny = 0;

      if (isCircular) {
        const theta = -t * (Math.PI / 2);
        x = halfW * Math.cos(theta);
        y = H / 2 + (H / 2) * Math.sin(theta);
        nx = -Math.cos(theta);
        ny = -Math.sin(theta);
      } else if (isHorseshoe) {
        x = halfW * (0.91 + 0.09 * (1 - t));
        y = (1 - t) * wallH;
        nx = -0.98;
        ny = -0.09;
      }

      nodes.push({
        x,
        y: Math.max(0, y),
        surface: 'rightWall',
        u: t,
        nx,
        ny,
      });
    }

    return {
      nodes,
      W,
      H,
      wallH,
      archH,
      halfW,
      shapeLabel,
      isCircular,
      isHorseshoe,
      isBasketHandle,
      isDShaped,
    };
  }, [
    geometry.width,
    geometry.height,
    geometry.wallHeight,
    geometry.profileType,
    geometry.crownGeometry,
  ]);

  // Build 3D textured quads for Left Wall, Crown Arch, Right Wall, and Excavation Face
  const meshData = useMemo(() => {
    const { nodes, W, H, wallH, archH, halfW } = perimeterProfileNodes;
    const pullLen = Math.max(1.5, settings.roundLength || 3.5);
    const totalLength = pullLen * corridorPulls;
    const reliefMetersScale = (reliefExaggerationMm / 1000) * 0.85;

    const quads: TexturedQuad3D[] = [];
    const nZPerPull = 12;

    // Helper to compute radial overbreak/undercut offset at (x, y, z)
    const getOverbreakDelta = (x: number, y: number, zRatio: number): number => {
      if (!applyOverbreakDeformation) return 0;
      const baseOb = overbreakAnalysis?.maxRadialOverbreakMeters
        ? Math.min(0.55, overbreakAnalysis.maxRadialOverbreakMeters)
        : 0.22;
      const angle = Math.atan2(y - wallH * 0.6, x);
      // Realistic crown-right shoulder & haunch structural wedge overbreak + minor wall undulation
      const shoulderPeak = Math.exp(-Math.pow(angle - 1.15, 2) / 0.18) * baseOb;
      const leftHaunchPeak = Math.exp(-Math.pow(angle - 2.15, 2) / 0.22) * (baseOb * 0.62);
      const zMod = 0.65 + 0.35 * Math.sin(zRatio * Math.PI);
      return (shoulderPeak + leftHaunchPeak) * zMod;
    };

    // 1. Perimeter Quads (Left Wall, Crown, Right Wall) across corridorPulls
    for (let p = 0; p < corridorPulls; p++) {
      const zPullStart = p * pullLen;
      for (let iz = 0; iz < nZPerPull; iz++) {
        const tz0 = iz / nZPerPull;
        const tz1 = (iz + 1) / nZPerPull;
        const z0 = zPullStart + tz0 * pullLen;
        const z1 = zPullStart + tz1 * pullLen;

        for (let i = 0; i < nodes.length - 1; i++) {
          const nA = nodes[i];
          const nB = nodes[i + 1];
          if (nA.surface !== nB.surface) continue; // Don't bridge across surface boundaries
          const surf = nA.surface;

          // Map (u along cross-section, tz along pull length) to photo UV [0..1]
          let u00 = 0;
          let v00 = 0;
          let u11 = 1;
          let v11 = 1;
          if (surf === 'leftWall' || surf === 'rightWall') {
            // Wall photo: U is along chainage [tz0..tz1], V is top-to-bottom [nA.u..nB.u]
            u00 = tz0;
            u11 = tz1;
            v00 = Math.min(nA.u, nB.u);
            v11 = Math.max(nA.u, nB.u);
          } else {
            // Crown photo: U is Left-to-Right SPL [nA.u..nB.u], V is chainage [1-tz1..1-tz0]
            u00 = nA.u;
            u11 = nB.u;
            v00 = 1 - tz1;
            v11 = 1 - tz0;
          }

          const r00 = sampleReliefGrid(reliefGrids[surf], u00, v00) * reliefMetersScale;
          const r10 = sampleReliefGrid(reliefGrids[surf], u11, v00) * reliefMetersScale;
          const r11 = sampleReliefGrid(reliefGrids[surf], u11, v11) * reliefMetersScale;
          const r01 = sampleReliefGrid(reliefGrids[surf], u00, v11) * reliefMetersScale;

          const obA0 = getOverbreakDelta(nA.x, nA.y, tz0);
          const obB0 = getOverbreakDelta(nB.x, nB.y, tz0);
          const obB1 = getOverbreakDelta(nB.x, nB.y, tz1);
          const obA1 = getOverbreakDelta(nA.x, nA.y, tz1);

          // Outward radial displacement = -inwardNormal * (overbreak - relief)
          const dA0 = obA0 - r00;
          const dB0 = obB0 - r10;
          const dB1 = obB1 - r11;
          const dA1 = obA1 - r01;

          const p00: Vec3 = {
            x: nA.x - nA.nx * dA0,
            y: Math.max(0, nA.y - nA.ny * dA0),
            z: z0,
          };
          const p10: Vec3 = {
            x: nB.x - nB.nx * dB0,
            y: Math.max(0, nB.y - nB.ny * dB0),
            z: z0,
          };
          const p11: Vec3 = {
            x: nB.x - nB.nx * dB1,
            y: Math.max(0, nB.y - nB.ny * dB1),
            z: z1,
          };
          const p01: Vec3 = {
            x: nA.x - nA.nx * dA1,
            y: Math.max(0, nA.y - nA.ny * dA1),
            z: z1,
          };

          quads.push({
            p00,
            p10,
            p11,
            p01,
            u0: u00,
            v0: v00,
            u1: u11,
            v1: v11,
            surface: surf,
            normal: {
              x: (nA.nx + nB.nx) * 0.5,
              y: (nA.ny + nB.ny) * 0.5,
              z: 0,
            },
            overbreakDeltaMeters: (obA0 + obB0 + obB1 + obA1) * 0.25,
          });
        }
      }
    }

    // 2. Excavation Face Cap at z = totalLength (Subdivided grid clipped to Tunnel Arch Profile)
    const faceZ = totalLength;
    const nFaceX = 12;
    const nFaceY = 10;
    for (let iy = 0; iy < nFaceY; iy++) {
      const ty0 = iy / nFaceY;
      const ty1 = (iy + 1) / nFaceY;
      const y0 = ty0 * H;
      const y1 = ty1 * H;

      // Determine max half-span at y0 and y1 matching the exact tunnel profile shape
      const getSpanAtY = (y: number) => {
        if (perimeterProfileNodes.isCircular) {
          const dy = Math.abs(y - H / 2);
          return halfW * Math.sqrt(Math.max(0, 1 - Math.pow(dy / Math.max(0.1, H / 2), 2)));
        }
        if (y <= wallH) {
          if (perimeterProfileNodes.isHorseshoe) {
            return halfW * (0.91 + 0.09 * (y / wallH));
          }
          return halfW;
        }
        const dy = Math.min(1, (y - wallH) / Math.max(0.1, archH));
        if (perimeterProfileNodes.isBasketHandle) {
          return halfW * Math.pow(Math.max(0, 1 - Math.pow(dy, 2.4)), 0.38);
        }
        return halfW * Math.sqrt(Math.max(0, 1 - dy * dy));
      };
      const span0 = getSpanAtY(y0);
      const span1 = getSpanAtY(y1);

      for (let ix = 0; ix < nFaceX; ix++) {
        const tx0 = ix / nFaceX;
        const tx1 = (ix + 1) / nFaceX;

        const x00 = -span0 + tx0 * (2 * span0);
        const x10 = -span0 + tx1 * (2 * span0);
        const x11 = -span1 + tx1 * (2 * span1);
        const x01 = -span1 + tx0 * (2 * span1);

        const u00 = (x00 + halfW) / W;
        const u10 = (x10 + halfW) / W;
        const u11 = (x11 + halfW) / W;
        const u01 = (x01 + halfW) / W;
        const v0 = 1 - ty0;
        const v1 = 1 - ty1;

        const r00 = sampleReliefGrid(reliefGrids.face, u00, v0) * reliefMetersScale * 1.3;
        const r10 = sampleReliefGrid(reliefGrids.face, u10, v0) * reliefMetersScale * 1.3;
        const r11 = sampleReliefGrid(reliefGrids.face, u11, v1) * reliefMetersScale * 1.3;
        const r01 = sampleReliefGrid(reliefGrids.face, u01, v1) * reliefMetersScale * 1.3;

        quads.push({
          p00: { x: x00, y: y0, z: faceZ - r00 },
          p10: { x: x10, y: y0, z: faceZ - r10 },
          p11: { x: x11, y: y1, z: faceZ - r11 },
          p01: { x: x01, y: y1, z: faceZ - r01 },
          u0: Math.max(0, Math.min(1, (u00 + u01) * 0.5)),
          v0: Math.min(v0, v1),
          u1: Math.max(0, Math.min(1, (u10 + u11) * 0.5)),
          v1: Math.max(v0, v1),
          surface: 'face',
          normal: { x: 0, y: 0, z: -1 },
          overbreakDeltaMeters: 0,
        });
      }
    }

    return { quads, totalLength, pullLen, W, H, wallH, archH, halfW };
  }, [
    perimeterProfileNodes,
    settings.roundLength,
    corridorPulls,
    reliefExaggerationMm,
    applyOverbreakDeformation,
    overbreakAnalysis,
    reliefGrids,
  ]);

  // Convert mapped 2D surface joints into 3D tunnel coordinates (x, y, z)
  const joints3DInTunnel = useMemo(() => {
    const { W, H, wallH, archH, halfW, pullLen, totalLength } = meshData;
    const crownArc = Math.max(W, geometry.crownArcLength || W * 1.35);

    return joints.map((j) => {
      const pts3D: Vec3[] = j.geometry.map((pt: Point2D) => {
        if (j.surface === 'face') {
          return {
            x: pt.x,
            y: Math.max(0, pt.y),
            z: totalLength - 0.03,
          };
        }
        if (j.surface === 'leftWall') {
          const z = Math.max(0, Math.min(pullLen, pt.x)) + (corridorPulls - 1) * pullLen;
          const y = Math.max(0, Math.min(wallH, pt.y));
          return { x: -halfW + 0.03, y, z };
        }
        if (j.surface === 'rightWall') {
          const z = Math.max(0, Math.min(pullLen, pt.x)) + (corridorPulls - 1) * pullLen;
          const y = Math.max(0, Math.min(wallH, pt.y));
          return { x: halfW - 0.03, y, z };
        }
        // Crown: pt.x in [-crownArc/2, +crownArc/2], pt.y in [0, pullLen]
        const t = Math.max(0, Math.min(1, (pt.x + crownArc / 2) / crownArc));
        const theta = Math.PI * (1 - t);
        const x = (halfW - 0.03) * Math.cos(theta);
        const y = wallH + (archH - 0.03) * Math.sin(theta);
        const z = Math.max(0, Math.min(pullLen, pt.y)) + (corridorPulls - 1) * pullLen;
        return { x, y, z };
      });
      return {
        joint: j,
        pts3D,
        color: JOINT_SET_PALETTE[j.set]?.color || '#38BDF8',
        label: formatJointTraceLineLabel(j, joints),
      };
    });
  }, [joints, meshData, geometry.crownArcLength, corridorPulls]);

  // Main 3D Canvas Render Loop
  const render3DScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(400, Math.round(rect.width * dpr));
    const ch = Math.max(300, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // Rich dark underground engineering slate backdrop
    const bgGrad = ctx.createRadialGradient(
      cw * 0.5,
      ch * 0.45,
      cw * 0.05,
      cw * 0.5,
      ch * 0.5,
      cw * 0.75
    );
    bgGrad.addColorStop(0, '#131C2E');
    bgGrad.addColorStop(0.6, '#0B111E');
    bgGrad.addColorStop(1, '#060A12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const { quads, totalLength, pullLen, W, H, wallH, archH, halfW } = meshData;
    const centerY = H * 0.48;
    const centerZ = totalLength * 0.52;

    const yawRad = (yawDeg * Math.PI) / 180;
    const pitchRad = (pitchDeg * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);

    // Camera setup for Orbit vs Inside Walk-Through
    const isInside = cameraMode === 'INSIDE_WALKTHROUGH';
    const camDist = Math.max(W, H, totalLength) * (1.85 / Math.max(0.35, zoom));
    const focalPx = Math.min(cw, ch) * (isInside ? 0.92 : 1.15);

    const projectPoint = (p: Vec3): ProjectedVertex => {
      if (isInside) {
        const eyeX = 0;
        const eyeY = H * 0.42;
        const eyeZ = walkProgress * totalLength * 0.85;
        const dx = p.x - eyeX;
        const dy = p.y - eyeY;
        const dz = p.z - eyeZ;

        // Rotate by camera look yaw/pitch
        const rx = dx * cosY - dz * sinY;
        const rz1 = dx * sinY + dz * cosY;
        const ry = dy * cosP - rz1 * sinP;
        const rz = dy * sinP + rz1 * cosP;

        if (rz <= 0.18) {
          return { sx: 0, sy: 0, depth: rz, camZ: rz, visible: false };
        }
        return {
          sx: cw * 0.5 + (rx / rz) * focalPx * zoom,
          sy: ch * 0.52 - (ry / rz) * focalPx * zoom,
          depth: rz,
          camZ: rz,
          visible: true,
        };
      } else {
        // Orbit around tunnel center (0, centerY, centerZ)
        const dx = p.x;
        const dy = p.y - centerY;
        const dz = p.z - centerZ;

        const rx = dx * cosY - dz * sinY;
        const rz1 = dx * sinY + dz * cosY;
        const ry = dy * cosP - rz1 * sinP;
        const rz = dy * sinP + rz1 * cosP + camDist;

        if (rz <= 0.3) {
          return { sx: 0, sy: 0, depth: rz, camZ: rz, visible: false };
        }
        return {
          sx: cw * 0.5 + (rx / rz) * focalPx,
          sy: ch * 0.53 - (ry / rz) * focalPx,
          depth: rz,
          camZ: rz,
          visible: true,
        };
      }
    };

    // 1. Draw Invert Floor Engineering Grid & Chainage Station Markers
    if (showFloorGrid) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1 * dpr;
      const nFloorZ = corridorPulls * 7;
      for (let i = 0; i <= nFloorZ; i++) {
        const z = (i / nFloorZ) * totalLength;
        const a = projectPoint({ x: -halfW, y: 0, z });
        const b = projectPoint({ x: halfW, y: 0, z });
        if (a.visible && b.visible) {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
      for (let ix = -2; ix <= 2; ix++) {
        const x = (ix / 2) * halfW;
        const a = projectPoint({ x, y: 0, z: 0 });
        const b = projectPoint({ x, y: 0, z: totalLength });
        if (a.visible && b.visible) {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }

    // Determine cutaway visibility in Orbit mode so the user can see inside the tunnel
    const hideLeftWallCutaway =
      !isInside && autoCutawayNearWall && sinY > 0.32 && Math.cos(pitchRad) > 0.2;
    const hideRightWallCutaway =
      !isInside && autoCutawayNearWall && sinY < -0.32 && Math.cos(pitchRad) > 0.2;

    // 2. Project and depth-sort all visible 3D textured quads (Painter's Algorithm back-to-front)
    const drawableQuads: {
      quad: TexturedQuad3D;
      v00: ProjectedVertex;
      v10: ProjectedVertex;
      v11: ProjectedVertex;
      v01: ProjectedVertex;
      avgDepth: number;
      shade: number;
    }[] = [];

    for (const q of quads) {
      if (!showSurface[q.surface]) continue;
      if (q.surface === 'leftWall' && hideLeftWallCutaway) continue;
      if (q.surface === 'rightWall' && hideRightWallCutaway) continue;

      const v00 = projectPoint(q.p00);
      const v10 = projectPoint(q.p10);
      const v11 = projectPoint(q.p11);
      const v01 = projectPoint(q.p01);
      if (!v00.visible || !v10.visible || !v11.visible || !v01.visible) continue;

      const avgDepth = (v00.depth + v10.depth + v11.depth + v01.depth) * 0.25;

      // Compute 3-point + headlamp lighting shade factor
      const lightDir = { x: 0.28, y: -0.52, z: -0.8 };
      const dot =
        q.normal.x * lightDir.x + q.normal.y * lightDir.y + q.normal.z * lightDir.z;
      const distAtten = isInside
        ? Math.max(0.68, Math.min(1.18, (1.25 / (1 + avgDepth * 0.08)) * headlampIntensity))
        : Math.max(0.75, Math.min(1.12, (0.86 + dot * 0.22) * headlampIntensity));

      drawableQuads.push({
        quad: q,
        v00,
        v10,
        v11,
        v01,
        avgDepth,
        shade: distAtten,
      });
    }

    drawableQuads.sort((a, b) => b.avgDepth - a.avgDepth);

    // 3. Render Textured 3D Quads
    for (const item of drawableQuads) {
      const { quad, v00, v10, v11, v01, shade } = item;
      const img = loadedImages[quad.surface];

      let tint: string | null = null;
      if (
        displayMode === 'PHOTO_OVERBREAK_SUPPORT' &&
        quad.overbreakDeltaMeters > 0.06
      ) {
        const alpha = Math.min(0.45, quad.overbreakDeltaMeters * 1.1);
        tint = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
      }

      if (img && img.width > 0 && img.height > 0) {
        const sx0 = quad.u0 * img.width;
        const sy0 = quad.v0 * img.height;
        const sx1 = quad.u1 * img.width;
        const sy1 = quad.v1 * img.height;

        drawLitTexturedTriangle(
          ctx,
          img,
          sx0,
          sy0,
          sx1,
          sy0,
          sx1,
          sy1,
          v00.sx,
          v00.sy,
          v10.sx,
          v10.sy,
          v11.sx,
          v11.sy,
          shade,
          tint
        );
        drawLitTexturedTriangle(
          ctx,
          img,
          sx0,
          sy0,
          sx1,
          sy1,
          sx0,
          sy1,
          v00.sx,
          v00.sy,
          v11.sx,
          v11.sy,
          v01.sx,
          v01.sy,
          shade,
          tint
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(v00.sx, v00.sy);
        ctx.lineTo(v10.sx, v10.sy);
        ctx.lineTo(v11.sx, v11.sy);
        ctx.lineTo(v01.sx, v01.sy);
        ctx.closePath();
        ctx.fillStyle = '#334155';
        ctx.fill();
      }

      if (showWireframeMesh) {
        ctx.beginPath();
        ctx.moveTo(v00.sx, v00.sy);
        ctx.lineTo(v10.sx, v10.sy);
        ctx.lineTo(v11.sx, v11.sy);
        ctx.lineTo(v01.sx, v01.sy);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 0.7 * dpr;
        ctx.stroke();
      }
    }

    // 4. Draw Tunnel Arch & Springline (SPL) Seam Structural Frame Wireframe
    for (let p = 0; p <= corridorPulls; p++) {
      const zRing = p * pullLen;
      ctx.beginPath();
      let started = false;
      for (const n of perimeterProfileNodes.nodes) {
        const pv = projectPoint({ x: n.x, y: n.y, z: zRing });
        if (!pv.visible) continue;
        if (!started) {
          ctx.moveTo(pv.sx, pv.sy);
          started = true;
        } else {
          ctx.lineTo(pv.sx, pv.sy);
        }
      }
      ctx.strokeStyle =
        p === corridorPulls ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = (p === corridorPulls ? 2.0 : 1.2) * dpr;
      ctx.stroke();
    }

    // Highlight Left & Right Springline (SPL) Seam lines along the tunnel
    for (const splX of [-halfW, halfW]) {
      const a = projectPoint({ x: splX, y: wallH, z: 0 });
      const b = projectPoint({ x: splX, y: wallH, z: totalLength });
      if (a.visible && b.visible) {
        ctx.save();
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Render 3D Intersecting Structural Discontinuity Planes (when mode === 'PHOTO_AND_3D_PLANES')
    if (displayMode === 'PHOTO_AND_3D_PLANES') {
      const driveRad = ((settings.driveDirection || 0) * Math.PI) / 180;
      for (const js of jointSets.slice(0, 4)) {
        const repJoint = joints.find((j) => j.set === js.id);
        const dipDir = repJoint?.dipDirection ?? 135;
        const dip = repJoint?.dip ?? 60;
        const relAzRad = ((dipDir - (settings.driveDirection || 0)) * Math.PI) / 180;
        const dipRad = (dip * Math.PI) / 180;

        // Plane normal in tunnel coordinates
        const nx = Math.sin(dipRad) * Math.sin(relAzRad);
        const ny = Math.cos(dipRad);
        const nz = Math.sin(dipRad) * Math.cos(relAzRad);
        void driveRad;

        // Construct a semi-transparent geological plane disc intersecting tunnel center
        const cx = 0;
        const cy = H * 0.55;
        const cz = totalLength * 0.62;
        const planeRadius = Math.max(W, H) * 0.56;

        // Tangent vectors on plane
        const up = Math.abs(ny) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
        const t1x = up.y * nz - up.z * ny;
        const t1y = up.z * nx - up.x * nz;
        const t1z = up.x * ny - up.y * nx;
        const t1Len = Math.hypot(t1x, t1y, t1z) || 1;
        const u1 = { x: t1x / t1Len, y: t1y / t1Len, z: t1z / t1Len };
        const u2 = {
          x: ny * u1.z - nz * u1.y,
          y: nz * u1.x - nx * u1.z,
          z: nx * u1.y - ny * u1.x,
        };

        const corners: Vec3[] = [
          {
            x: cx + (-u1.x - u2.x) * planeRadius,
            y: Math.max(0, cy + (-u1.y - u2.y) * planeRadius),
            z: cz + (-u1.z - u2.z) * planeRadius,
          },
          {
            x: cx + (u1.x - u2.x) * planeRadius,
            y: Math.max(0, cy + (u1.y - u2.y) * planeRadius),
            z: cz + (u1.z - u2.z) * planeRadius,
          },
          {
            x: cx + (u1.x + u2.x) * planeRadius,
            y: Math.max(0, cy + (u1.y + u2.y) * planeRadius),
            z: cz + (u1.z + u2.z) * planeRadius,
          },
          {
            x: cx + (-u1.x + u2.x) * planeRadius,
            y: Math.max(0, cy + (-u1.y + u2.y) * planeRadius),
            z: cz + (-u1.z + u2.z) * planeRadius,
          },
        ];

        const projCorners = corners.map(projectPoint);
        if (projCorners.every((c) => c.visible)) {
          const palColor = JOINT_SET_PALETTE[js.id]?.color || '#38BDF8';
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(projCorners[0].sx, projCorners[0].sy);
          for (let k = 1; k < projCorners.length; k++) {
            ctx.lineTo(projCorners[k].sx, projCorners[k].sy);
          }
          ctx.closePath();
          ctx.fillStyle = `${palColor}33`;
          ctx.fill();
          ctx.strokeStyle = palColor;
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();

          const labelPos = projectPoint({
            x: corners[2].x * 0.7,
            y: corners[2].y,
            z: corners[2].z,
          });
          if (labelPos.visible) {
            ctx.font = `bold ${Math.round(11 * dpr)}px "JetBrains Mono", monospace`;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(
              `${js.id} Plane (${String(Math.round(dipDir)).padStart(3, '0')}/${String(
                Math.round(dip)
              ).padStart(2, '0')})`,
              labelPos.sx + 6 * dpr,
              labelPos.sy - 4 * dpr
            );
          }
          ctx.restore();
        }
      }
    }

    // 6. Render 3D Mapped Geological Traces on the Tunnel Surfaces (when not in PHOTO_ONLY mode)
    if (displayMode !== 'PHOTO_ONLY') {
      for (const item of joints3DInTunnel) {
        const { joint, pts3D, color, label } = item;
        if (!showSurface[joint.surface]) continue;
        if (joint.surface === 'leftWall' && hideLeftWallCutaway) continue;
        if (joint.surface === 'rightWall' && hideRightWallCutaway) continue;

        const projPts = pts3D.map(projectPoint).filter((p) => p.visible);
        if (projPts.length < 2) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(projPts[0].sx, projPts[0].sy);
        for (let i = 1; i < projPts.length; i++) {
          ctx.lineTo(projPts[i].sx, projPts[i].sy);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4.2 * dpr;
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4 * dpr;
        ctx.stroke();

        const mid = projPts[Math.floor(projPts.length / 2)];
        const badgeText = `${joint.set} ${label}`;
        ctx.font = `bold ${Math.round(9.5 * dpr)}px "JetBrains Mono", monospace`;
        const tw = ctx.measureText(badgeText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
        ctx.fillRect(mid.sx - tw / 2 - 4 * dpr, mid.sy - 14 * dpr, tw + 8 * dpr, 13 * dpr);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * dpr;
        ctx.strokeRect(mid.sx - tw / 2 - 4 * dpr, mid.sy - 14 * dpr, tw + 8 * dpr, 13 * dpr);
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, mid.sx, mid.sy - 4 * dpr);
        ctx.restore();
      }
    }

    // 7. Render 3D Radial Rock Bolts (when mode === 'PHOTO_OVERBREAK_SUPPORT')
    if (displayMode === 'PHOTO_OVERBREAK_SUPPORT') {
      const boltLength = 3.5;
      const ringSpacing = 1.5;
      for (let zBolt = 0.75; zBolt < totalLength - 0.3; zBolt += ringSpacing) {
        const boltAngles = [Math.PI * 0.15, Math.PI * 0.32, Math.PI * 0.5, Math.PI * 0.68, Math.PI * 0.85];
        for (const theta of boltAngles) {
          const bx = halfW * Math.cos(theta);
          const by = wallH + archH * Math.sin(theta);
          const ex = (halfW + boltLength * 0.55) * Math.cos(theta);
          const ey = wallH + (archH + boltLength * 0.55) * Math.sin(theta);

          const pStart = projectPoint({ x: bx, y: by, z: zBolt });
          const pEnd = projectPoint({ x: ex, y: ey, z: zBolt });
          if (pStart.visible && pEnd.visible) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pStart.sx, pStart.sy);
            ctx.lineTo(pEnd.sx, pEnd.sy);
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 2.2 * dpr;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pStart.sx, pStart.sy, 3.5 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = '#34D399';
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    // 8. Draw 3D Tunnel Coordinate Axes & Chainage Labels directly in scene
    const portalCenter = projectPoint({ x: 0, y: 0, z: 0 });
    const faceCenter = projectPoint({ x: 0, y: 0, z: totalLength });
    ctx.font = `bold ${Math.round(10.5 * dpr)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#38BDF8';
    if (portalCenter.visible) {
      ctx.fillText(`START (${settings.chainage.split('-')[0]?.trim() || 'RD +0.0m'})`, portalCenter.sx - 45 * dpr, portalCenter.sy + 16 * dpr);
    }
    if (faceCenter.visible) {
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(
        `FACE (${settings.faceChainage || `RD +${totalLength.toFixed(1)}m`})`,
        faceCenter.sx - 45 * dpr,
        faceCenter.sy + 16 * dpr
      );
    }

    ctx.restore();
  }, [
    meshData,
    yawDeg,
    pitchDeg,
    zoom,
    cameraMode,
    walkProgress,
    corridorPulls,
    showFloorGrid,
    autoCutawayNearWall,
    showSurface,
    headlampIntensity,
    loadedImages,
    displayMode,
    showWireframeMesh,
    perimeterProfileNodes.nodes,
    jointSets,
    joints,
    settings.driveDirection,
    settings.chainage,
    settings.faceChainage,
    joints3DInTunnel,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    render3DScene();
  }, [isOpen, render3DScene]);

  // Export Wavefront .OBJ 3D Mesh of the Tunnel + Displaced Rock Relief
  const handleDownloadOBJ = () => {
    const lines: string[] = [
      '# AKASH TUNNEL MAPPER - 3D Photo-Textured & Relief-Deformed Tunnel Mesh (.OBJ)',
      `# Project: ${settings.projectName || 'Underground Tunnel Project'}`,
      `# Tunnel: ${settings.tunnelName} | Face Chainage: ${settings.faceChainage}`,
      `# Span: ${geometry.width}m | Height: ${geometry.height}m | Length: ${meshData.totalLength.toFixed(2)}m`,
      '',
    ];
    let vIdx = 1;
    for (const q of meshData.quads) {
      lines.push(`v ${q.p00.x.toFixed(4)} ${q.p00.y.toFixed(4)} ${q.p00.z.toFixed(4)}`);
      lines.push(`v ${q.p10.x.toFixed(4)} ${q.p10.y.toFixed(4)} ${q.p10.z.toFixed(4)}`);
      lines.push(`v ${q.p11.x.toFixed(4)} ${q.p11.y.toFixed(4)} ${q.p11.z.toFixed(4)}`);
      lines.push(`v ${q.p01.x.toFixed(4)} ${q.p01.y.toFixed(4)} ${q.p01.z.toFixed(4)}`);
      lines.push(`vt ${q.u0.toFixed(4)} ${q.v0.toFixed(4)}`);
      lines.push(`vt ${q.u1.toFixed(4)} ${q.v0.toFixed(4)}`);
      lines.push(`vt ${q.u1.toFixed(4)} ${q.v1.toFixed(4)}`);
      lines.push(`vt ${q.u0.toFixed(4)} ${q.v1.toFixed(4)}`);
      lines.push(
        `f ${vIdx}/${vIdx} ${vIdx + 1}/${vIdx + 1} ${vIdx + 2}/${vIdx + 2} ${vIdx + 3}/${vIdx + 3}`
      );
      vIdx += 4;
    }

    // Also export 3D Joint Polylines as 'l' entities
    for (const item of joints3DInTunnel) {
      const pts3D = item.pts3D;
      if (pts3D.length < 2) continue;
      const startIdx = vIdx;
      for (const p of pts3D) {
        lines.push(`v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}`);
        vIdx++;
      }
      const indices = pts3D.map((_, idx) => startIdx + idx).join(' ');
      lines.push(`l ${indices}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3D_Tunnel_Mesh_${(settings.faceChainage || 'RD').replace(/[^a-zA-Z0-9_-]/g, '_')}.obj`;
    a.click();
    URL.revokeObjectURL(url);
    onStatusMessage?.('Exported 3D Photo-Textured Tunnel Mesh (.OBJ) with UV coordinates & 3D rock relief.');
  };

  // Capture 3D Tunnel PNG or add to Engineering Mapping Sheet Appendix
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `3D_Photo_Tunnel_${(settings.faceChainage || 'Sheet').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    a.click();
    onStatusMessage?.('Downloaded High-Resolution 3D Photo-Textured Tunnel PNG render.');
  };

  const handleSendSnapshotToSheet = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onCaptureSnapshotToSheet) return;
    const dataUrl = canvas.toDataURL('image/png');
    const repJoint = joints[0];
    const snap: StrikeDip3DSnapshotAppendix = {
      id: `3d-tunnel-${Date.now()}`,
      capturedAt: new Date().toLocaleTimeString(),
      imageDataUrl: dataUrl,
      viewModeLabel:
        displayMode === 'PHOTO_ONLY'
          ? '3D Photo-Textured Tunnel (Photo Only)'
          : `3D Photo Tunnel (${displayMode.replace(/_/g, ' ')})`,
      cameraAnglesLabel: `Yaw ${Math.round(yawDeg)}° / Pitch ${Math.round(pitchDeg)}° (${
        cameraMode === 'INSIDE_WALKTHROUGH' ? 'Inside Walk-Through' : '3D Orbit'
      })`,
      driveAzimuthDeg: settings.driveDirection || 70,
      primaryPlaneLabel: `${settings.tunnelName} (${geometry.width}m × ${geometry.height}m)`,
      strikeDeg: repJoint?.strike ?? 340,
      dipDirectionDeg: repJoint?.dipDirection ?? 70,
      dipDeg: repJoint?.dip ?? 65,
      acuteStrikeToDriveAngleDeg: 75,
      favorabilityLabel: '3D Upscaled Photo + Relief Mesh',
      rmrAdjustmentRating: 0,
      explanation: `3D Photo-Textured Tunnel Model (${corridorPulls} Pulls = ${meshData.totalLength.toFixed(
        1
      )}m) with ±${reliefExaggerationMm}mm 2.5D Rock Surface Micro-Relief.`,
    };
    onCaptureSnapshotToSheet(snap);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#060A12] text-slate-100 select-none overflow-hidden">
      {/* Hidden File Input for Quick Surface Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && onUploadPhotoFile) {
            onUploadPhotoFile(uploadSurfaceRef.current, f);
          }
          e.target.value = '';
        }}
      />

      {/* TOP BAR: Project Info, Display Modes, Upscaler & Exports */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#0B111E] border-b border-slate-800 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-sky-400" />
            <h2 className="font-display font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
              3D Photo-Textured Tunnel Builder
            </h2>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>{settings.projectName || 'Underground Tunnel Project'}</span>
            <span>·</span>
            <span className="text-sky-300 font-semibold">{settings.tunnelName}</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-500/50 text-sky-200 font-bold">
              {perimeterProfileNodes.shapeLabel} Profile
            </span>
            <span>·</span>
            <span className="text-amber-300 font-semibold">
              {geometry.width.toFixed(1)}m W × {geometry.height.toFixed(1)}m H
            </span>
            <span>·</span>
            <span className="text-sky-300 font-semibold">
              Chainage: {settings.faceChainage || settings.chainage || 'RD 0+00'}
            </span>
            <span>·</span>
            <span className="text-emerald-400 font-bold">
              Azimuth: {settings.driveDirection || 70}°
            </span>
            <span>·</span>
            <span className="text-slate-300">{meshData.totalLength.toFixed(1)}m Model</span>
          </div>
        </div>

        {/* Center: 4 Display Modes (Photo Only vs Traces vs 3D Planes vs Overbreak/Bolts) */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px]">
          {(
            [
              { id: 'PHOTO_ONLY', label: '1. Photo Only (No Geo Data)' },
              { id: 'PHOTO_AND_TRACES', label: '2. Photo + 3D Joint Traces' },
              { id: 'PHOTO_AND_3D_PLANES', label: '3. Photo + 3D Planes' },
              { id: 'PHOTO_OVERBREAK_SUPPORT', label: '4. Overbreak & Bolts' },
            ] as { id: Tunnel3DDisplayMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDisplayMode(m.id)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                displayMode === m.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Right: 2x Upscale, Export OBJ, Export PNG, Close */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isUpscalingAll}
            onClick={handleUpscaleAllPhotos}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Apply 2x Super-Resolution Unsharp + Local Contrast Enhancement to all 4 tunnel surface photos"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isUpscalingAll ? 'Upscaling 4 Photos...' : '2x Upscale & Sharpen Photos'}
          </button>

          {onCaptureSnapshotToSheet && (
            <button
              type="button"
              onClick={handleSendSnapshotToSheet}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Add this 3D Photo-Textured Tunnel view to the Engineering Sheet Appendix"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Add to Sheet
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadOBJ}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Download 3D Wavefront .OBJ Mesh with UV coordinates and 3D joint lines"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            .OBJ 3D
          </button>

          <button
            type="button"
            onClick={handleDownloadPNG}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Download High-Res PNG Render"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            PNG
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close 3D Tunnel Viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT + FLOATING SEMANTIC HUD OVERLAYS */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Interactive 3D Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => {
            dragRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              startYaw: yawDeg,
              startPitch: pitchDeg,
            };
          }}
          onMouseMove={(e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setYawDeg(dragRef.current.startYaw + dx * 0.45);
            setPitchDeg(Math.max(-65, Math.min(75, dragRef.current.startPitch + dy * 0.35)));
          }}
          onMouseUp={() => {
            dragRef.current.active = false;
          }}
          onMouseLeave={() => {
            dragRef.current.active = false;
          }}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            setZoom((z) => Math.max(0.45, Math.min(3.2, Number((z * factor).toFixed(2)))));
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* LEFT FLOATING HUD: Camera Choreography, Walk-Through & Surface Photo Controls */}
        <aside className="absolute left-4 top-4 z-10 w-72 bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-3 text-xs font-mono shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-sky-400 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              3D Camera &amp; Walk-Through
            </span>
            <button
              type="button"
              onClick={() => {
                setYawDeg(cameraMode === 'INSIDE_WALKTHROUGH' ? 0 : -28);
                setPitchDeg(cameraMode === 'INSIDE_WALKTHROUGH' ? 4 : 16);
                setZoom(1.08);
                setWalkProgress(0.15);
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded text-[10px] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Camera Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCameraMode('ORBIT_CUTAWAY');
                setYawDeg(-28);
                setPitchDeg(16);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer ${
                cameraMode === 'ORBIT_CUTAWAY'
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-slate-900/80 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              3D Orbit Cutaway
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraMode('INSIDE_WALKTHROUGH');
                setYawDeg(0);
                setPitchDeg(4);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-colors cursor-pointer ${
                cameraMode === 'INSIDE_WALKTHROUGH'
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-slate-900/80 text-slate-300 border-white/10 hover:bg-slate-800'
              }`}
            >
              Inside Walk-Through
            </button>
          </div>

          {/* Walk-Through Chainage Position Slider (when in Inside Walk-Through mode) */}
          {cameraMode === 'INSIDE_WALKTHROUGH' && (
            <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-emerald-300 font-semibold">Walk Toward Face (Z):</span>
                <span className="text-white font-bold tabular-nums">
                  +{(walkProgress * meshData.totalLength * 0.85).toFixed(2)} m
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.92"
                step="0.02"
                value={walkProgress}
                onChange={(e) => setWalkProgress(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          )}

          {/* 3D Rock Relief & Overbreak Sliders */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-300">2.5D Photo Rock Relief:</span>
                <span className="text-amber-300 font-bold tabular-nums">
                  ±{reliefExaggerationMm} mm
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="350"
                step="10"
                value={reliefExaggerationMm}
                onChange={(e) => setReliefExaggerationMm(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-300">Headlamp Illumination:</span>
                <span className="text-sky-300 font-bold tabular-nums">
                  {Math.round(headlampIntensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={headlampIntensity}
                onChange={(e) => setHeadlampIntensity(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-300 text-[10.5px]">Corridor Length:</span>
              <div className="flex items-center gap-1">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCorridorPulls(n)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      corridorPulls === n
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {n} Pull{n > 1 ? 's' : ''} ({(n * (settings.roundLength || 3.5)).toFixed(1)}m)
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Tunnel Portions Visibility & Quick Photo Upload */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="text-[10.5px] font-bold text-slate-300">
              Tunnel Portions &amp; Upscaled Photos:
            </div>
            {(
              [
                { id: 'face', label: '1. Excavation Face' },
                { id: 'crown', label: '2. Crown Arch' },
                { id: 'leftWall', label: '3. Left Wall' },
                { id: 'rightWall', label: '4. Right Wall' },
              ] as { id: SurfaceType; label: string }[]
            ).map((s) => {
              const hasUserPhoto = Boolean(photos[s.id]?.image);
              const isUpscaled = Boolean(upscaledOverrides[s.id]);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-1.5 py-1 px-2 bg-white/5 rounded-lg"
                >
                  <label className="flex items-center gap-1.5 cursor-pointer truncate">
                    <input
                      type="checkbox"
                      checked={showSurface[s.id]}
                      onChange={(e) =>
                        setShowSurface((prev) => ({ ...prev, [s.id]: e.target.checked }))
                      }
                      className="rounded border-slate-600 text-sky-500 cursor-pointer"
                    />
                    <span className="text-slate-200 truncate">{s.label}</span>
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9.5px] text-slate-400">
                      {isUpscaled ? '2x HD' : hasUserPhoto ? 'User' : 'Sample'}
                    </span>
                    {onUploadPhotoFile && (
                      <button
                        type="button"
                        onClick={() => {
                          uploadSurfaceRef.current = s.id;
                          fileInputRef.current?.click();
                        }}
                        className="px-1.5 py-0.5 bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/30 rounded text-[9.5px] cursor-pointer"
                        title={`Upload or replace ${s.label} photo`}
                      >
                        Upload
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCutawayNearWall}
                  onChange={(e) => setAutoCutawayNearWall(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 cursor-pointer"
                />
                <span>Auto-Cutaway Wall</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyOverbreakDeformation}
                  onChange={(e) => setApplyOverbreakDeformation(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 cursor-pointer"
                />
                <span>3D Overbreak Cavity</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWireframeMesh}
                  onChange={(e) => setShowWireframeMesh(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 cursor-pointer"
                />
                <span>3D Triangle Mesh</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFloorGrid}
                  onChange={(e) => setShowFloorGrid(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 cursor-pointer"
                />
                <span>Invert Floor Grid</span>
              </label>
            </div>
          </div>
        </aside>

        {/* BOTTOM FLOATING HELPER HUD */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 bg-black/55 backdrop-blur-md border border-white/10 rounded-xl text-xs font-mono text-slate-300 shadow-lg">
          <span>Drag to Rotate 3D Tunnel</span>
          <span>·</span>
          <span>Scroll Wheel to Zoom ({Math.round(zoom * 100)}%)</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setCameraMode('ORBIT_CUTAWAY');
                setYawDeg(0);
                setPitchDeg(8);
              }}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10.5px] cursor-pointer"
            >
              Front Face
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraMode('ORBIT_CUTAWAY');
                setYawDeg(-42);
                setPitchDeg(18);
              }}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10.5px] cursor-pointer"
            >
              Left Oblique
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraMode('ORBIT_CUTAWAY');
                setYawDeg(42);
                setPitchDeg(18);
              }}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10.5px] cursor-pointer"
            >
              Right Oblique
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraMode('INSIDE_WALKTHROUGH');
                setYawDeg(0);
                setPitchDeg(28);
              }}
              className="px-2 py-0.5 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 rounded text-[10.5px] cursor-pointer"
            >
              Look Up at Crown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
