import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  FIELD_JOINT_GROUP_COLORS,
  FieldExcavationRound,
  FieldPanelId,
  FieldTunnelLocationItem,
} from '../engine/fieldMappingEngine';
import {
  Geological3DFilterType,
  PhotogrammetryAnalysisResult,
  applyGeologicalFilterToCanvas,
} from '../engine/aiTunnelReconstructionEngine';

export interface Synced3DCameraState {
  theta: number;
  phi: number;
  radius: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  sourceId?: string;
}

export interface Synced3DHoverCoord {
  x: number;
  y: number;
  z: number;
  panel?: FieldPanelId;
  sourceId?: string;
}

interface Tunnel3DPhotoCanvasProps {
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  activePanel: FieldPanelId;
  photoUrl: string;
  brightness?: number;
  contrast?: number;
  filterType?: Geological3DFilterType;
  matlabFilter?: boolean;
  isLightMode?: boolean;
  sharedCameraState?: Synced3DCameraState;
  onCameraChange?: (state: Synced3DCameraState) => void;
  syncedHoverCoord?: Synced3DHoverCoord | null;
  onHoverCoordChange?: (coord: Synced3DHoverCoord | null) => void;
  isPeekingTraces?: boolean;
  onTriggerAiReconstruct?: () => void;
  aiAnalysisResult?: PhotogrammetryAnalysisResult | null;
  instanceId?: string;
}

/**
 * Creates an authentic geological rock wall canvas (horizontal bedding planes, blast half-barrels, rock texture).
 */
function createGeologicalWallCanvas(side: 'left' | 'right', isLightMode: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = isLightMode ? '#94A3B8' : '#1E293B';
  ctx.fillRect(0, 0, 1024, 512);

  // Noise grains
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 2 + 0.5;
    ctx.fillStyle = Math.random() > 0.5 ? (isLightMode ? '#CBD5E1' : '#334155') : (isLightMode ? '#64748B' : '#0F172A');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horizontal rock stratification & foliation bands
  for (let y = 30; y < 512; y += 45 + Math.random() * 25) {
    ctx.strokeStyle = isLightMode ? '#475569' : '#0F172A';
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 60; x <= 1024; x += 60) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 8);
    }
    ctx.stroke();
  }

  // Vertical perimeter blast half-barrel traces (half-cast factor)
  for (let x = 80; x < 1024; x += 140) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.fillRect(x - 6, 0, 12, 512);
    ctx.strokeStyle = isLightMode ? '#E2E8F0' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 6, 0, 12, 512);
  }

  // Label tag
  ctx.fillStyle = 'rgba(2, 132, 199, 0.7)';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(side === 'left' ? 'LEFT WALL (L-SPL)' : 'RIGHT WALL (R-SPL)', 30, 480);

  return canvas;
}

/**
 * Creates an authentic crown arch vault canvas (shotcrete texture, radial rock jointing, wire mesh shadow).
 */
function createGeologicalCrownCanvas(isLightMode: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = isLightMode ? '#A8B2C1' : '#182234';
  ctx.fillRect(0, 0, 1024, 512);

  // Sprayed shotcrete stipple
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 2.2 + 0.5;
    ctx.fillStyle = Math.random() > 0.6 ? (isLightMode ? '#E2E8F0' : '#334155') : (isLightMode ? '#64748B' : '#0B0F19');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radial jointing and steel weldmesh shadows
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 1024; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y < 512; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('CROWN ARCH (ROOF VAULT)', 30, 480);

  return canvas;
}

/**
 * Creates an authentic invert roadway canvas (graded tunnel floor, wheel ruts, central survey line, chainage markings).
 */
function createInvertRoadwayCanvas(chainageText: string, isLightMode: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = isLightMode ? '#788292' : '#0F172A';
  ctx.fillRect(0, 0, 1024, 512);

  // Gravel ballast stipple
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 3 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? (isLightMode ? '#94A3B8' : '#1E293B') : (isLightMode ? '#475569' : '#020617');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy equipment wheel / hauler tracks along the tunnel drive
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.fillRect(200, 0, 140, 512);
  ctx.fillRect(684, 0, 140, 512);

  // Center survey laser alignment line
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(512, 0);
  ctx.lineTo(512, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // Roadside water drainage ditch on the right
  ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
  ctx.fillRect(920, 0, 90, 512);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.strokeRect(920, 0, 90, 512);

  // Chainage label
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(chainageText, 40, 480);

  return canvas;
}

export const Tunnel3DPhotoCanvas: React.FC<Tunnel3DPhotoCanvasProps> = ({
  location,
  round,
  activePanel,
  photoUrl,
  brightness = 100,
  contrast = 100,
  filterType = 'normal',
  matlabFilter = false,
  isLightMode = true,
  sharedCameraState,
  onCameraChange,
  syncedHoverCoord,
  onHoverCoordChange,
  isPeekingTraces = false,
  onTriggerAiReconstruct,
  aiAnalysisResult,
  instanceId = 'photo_3d',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraView, setCameraView] = useState<'perspective' | 'face' | 'inside' | 'isometric'>('perspective');
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showSteelArch, setShowSteelArch] = useState<boolean>(true);
  const [showRockBolts, setShowRockBolts] = useState<boolean>(true);
  const [showSurveyLaser, setShowSurveyLaser] = useState<boolean>(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Dedicated photos per surface
  const collectedPhotos = round.collectedPhotos || [];
  const facePhotoUrl = useMemo(() => {
    const p = collectedPhotos.find((ph) => ph.panel === 'face')?.dataUrl;
    return p || photoUrl;
  }, [collectedPhotos, photoUrl]);

  const leftWallPhotoUrl = useMemo(() => {
    return collectedPhotos.find((ph) => ph.panel === 'left_wall')?.dataUrl || '';
  }, [collectedPhotos]);

  const rightWallPhotoUrl = useMemo(() => {
    return collectedPhotos.find((ph) => ph.panel === 'right_wall')?.dataUrl || '';
  }, [collectedPhotos]);

  const crownPhotoUrl = useMemo(() => {
    return collectedPhotos.find((ph) => ph.panel === 'crown')?.dataUrl || '';
  }, [collectedPhotos]);

  // Mutable camera controller state stored in refs to avoid re-mounting WebGL
  const controlsRef = useRef({
    theta: sharedCameraState?.theta ?? 0.45,
    phi: sharedCameraState?.phi ?? 0.3,
    radius: sharedCameraState?.radius ?? 14,
    target: new THREE.Vector3(
      sharedCameraState?.targetX ?? 0,
      sharedCameraState?.targetY ?? 3.5,
      sharedCameraState?.targetZ ?? -1.0
    ),
    isDragging: false,
    isPanning: false,
    prevX: 0,
    prevY: 0,
    startDist: 0,
    cameraView: 'perspective',
  });

  const updateCameraPositionRef = useRef<(() => void) | null>(null);
  const externalHoverReticleRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    controlsRef.current.cameraView = cameraView;
  }, [cameraView]);

  // Respond to sharedCameraState changes coming from the external Left Drawing Viewport
  useEffect(() => {
    if (!sharedCameraState || sharedCameraState.sourceId === instanceId) return;
    const c = controlsRef.current;
    if (c.isDragging || c.isPanning) return;

    c.theta = sharedCameraState.theta;
    c.phi = sharedCameraState.phi;
    c.radius = sharedCameraState.radius;
    c.target.set(
      sharedCameraState.targetX,
      sharedCameraState.targetY,
      sharedCameraState.targetZ
    );
    if (updateCameraPositionRef.current) {
      updateCameraPositionRef.current();
    }
  }, [sharedCameraState, instanceId]);

  // Respond to external syncedHoverCoord changes
  useEffect(() => {
    if (!externalHoverReticleRef.current) return;
    const reticle = externalHoverReticleRef.current;
    if (!syncedHoverCoord) {
      reticle.visible = false;
      return;
    }
    reticle.visible = true;
    reticle.position.set(syncedHoverCoord.x, syncedHoverCoord.y, syncedHoverCoord.z);
  }, [syncedHoverCoord]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // 1. Scene, Camera, WebGL Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLightMode ? 0xdfe6ee : 0x070b12);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. High-Fidelity Lighting Rig (Survey Floodlights & Natural Shadowing)
    const ambientLight = new THREE.AmbientLight(isLightMode ? 0xffffff : 0x8899aa, isLightMode ? 1.1 : 0.85);
    scene.add(ambientLight);

    // Key jumbo floodlight focused on the heading face
    const jumboSpot = new THREE.SpotLight(0xfff7ed, 3.8, 30, Math.PI / 2.8, 0.35, 1);
    jumboSpot.position.set(0, 4.2, 5.5);
    jumboSpot.target.position.set(0, 3.5, 0);
    jumboSpot.castShadow = true;
    scene.add(jumboSpot);
    scene.add(jumboSpot.target);

    // Secondary rim fill from tunnel portal
    const tunnelBackLight = new THREE.PointLight(0x38bdf8, 1.8, 25);
    tunnelBackLight.position.set(0, 2.5, -Number(round.pullLengthMeters || 3) * 1.5);
    scene.add(tunnelBackLight);

    const sunRim = new THREE.DirectionalLight(0xffedd5, 1.0);
    sunRim.position.set(8, 14, 10);
    scene.add(sunRim);

    // 3. Physical Metric Tunnel Dimensions & Profile Geometry
    const tunnelW = Math.max(3.0, location.widthM || 8.5);
    const tunnelH = Math.max(3.0, location.heightM || 7.5);
    const splH = Math.max(1.0, Math.min(tunnelH * 0.85, location.wallHeightM || 3.8));
    const pullDepth = Math.max(1.5, Number(round.pullLengthMeters) || 3.0);
    const shapeType = location.shape || 'horseshoe';

    const halfW = tunnelW / 2;
    const archH = Math.max(0.5, tunnelH - splH);

    // Tunnel 2D Cross-Section Shape
    const shape = new THREE.Shape();
    if (shapeType === 'circular') {
      const radius = tunnelW / 2;
      shape.absarc(0, radius, radius, 0, Math.PI * 2, false);
    } else if (shapeType === 'rectangular') {
      const r = Math.min(0.3, halfW * 0.08);
      shape.moveTo(-halfW + r, 0);
      shape.lineTo(halfW - r, 0);
      shape.quadraticCurveTo(halfW, 0, halfW, r);
      shape.lineTo(halfW, tunnelH - r);
      shape.quadraticCurveTo(halfW, tunnelH, halfW - r, tunnelH);
      shape.lineTo(-halfW + r, tunnelH);
      shape.quadraticCurveTo(-halfW, tunnelH, -halfW, tunnelH - r);
      shape.lineTo(-halfW, r);
      shape.quadraticCurveTo(-halfW, 0, -halfW + r, 0);
    } else {
      // D-Shaped or Horseshoe
      const invertSag = shapeType === 'horseshoe' ? 0.35 : 0;
      shape.moveTo(-halfW, 0);
      if (invertSag > 0) {
        shape.quadraticCurveTo(0, -invertSag, halfW, 0);
      } else {
        shape.lineTo(halfW, 0);
      }
      shape.lineTo(halfW, splH);
      const numArchPts = 32;
      for (let i = 1; i <= numArchPts; i++) {
        const theta = (i / numArchPts) * Math.PI;
        const x = halfW * Math.cos(theta);
        const y = splH + archH * Math.sin(theta);
        shape.lineTo(x, y);
      }
      shape.lineTo(-halfW, 0);
    }

    const tunnelGroup = new THREE.Group();
    scene.add(tunnelGroup);

    // 4. Dedicated Textures for Face, Left Wall, Right Wall, Crown Arch, and Invert
    // --- FACE TEXTURE & PHOTOGRAMMETRIC RELIEF ---
    const faceSourceCanvas = document.createElement('canvas');
    faceSourceCanvas.width = 1024;
    faceSourceCanvas.height = 1024;
    const faceSCtx = faceSourceCanvas.getContext('2d');

    const faceFilteredCanvas = document.createElement('canvas');
    faceFilteredCanvas.width = 1024;
    faceFilteredCanvas.height = 1024;

    const faceTexture = new THREE.CanvasTexture(faceFilteredCanvas);
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.wrapS = THREE.ClampToEdgeWrapping;
    faceTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Face mesh material
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.FrontSide,
      wireframe: showWireframe,
    });

    // Face geometry with 3D photogrammetric relief (dense triangulated subdivision)
    const faceGeom = new THREE.ShapeGeometry(shape, 24);
    // Align UVs exactly [0, 1] relative to tunnel width and height
    const posAttr = faceGeom.attributes.position;
    const faceUvs = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      const u = (px + halfW) / tunnelW;
      const v = py / tunnelH;
      faceUvs[i * 2] = Math.max(0, Math.min(1, u));
      faceUvs[i * 2 + 1] = Math.max(0, Math.min(1, v));
    }
    faceGeom.setAttribute('uv', new THREE.BufferAttribute(faceUvs, 2));

    const applyFacePhotoAndDisplacement = () => {
      applyGeologicalFilterToCanvas(
        faceSourceCanvas,
        faceFilteredCanvas,
        filterType,
        brightness,
        contrast
      );
      faceTexture.needsUpdate = true;

      // Extract photogrammetric 3D rock breakout relief from image luminance
      try {
        const imgData = faceFilteredCanvas.getContext('2d')?.getImageData(0, 0, 1024, 1024);
        if (imgData) {
          const d = imgData.data;
          for (let i = 0; i < posAttr.count; i++) {
            const u = faceUvs[i * 2];
            const v = faceUvs[i * 2 + 1];
            const imgX = Math.min(1023, Math.max(0, Math.floor(u * 1024)));
            const imgY = Math.min(1023, Math.max(0, Math.floor((1 - v) * 1024)));
            const idx = (imgY * 1024 + imgX) * 4;
            const lum = (0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]) / 255;
            // Rock blast break-out relief: ±0.15m real 3D depth into rock face
            const reliefZ = (lum - 0.5) * 0.22;
            posAttr.setZ(i, reliefZ);
          }
          posAttr.needsUpdate = true;
          faceGeom.computeVertexNormals();
        }
      } catch {
        // Fallback
      }
    };

    if (
      facePhotoUrl &&
      (facePhotoUrl.startsWith('data:') ||
        facePhotoUrl.startsWith('blob:') ||
        facePhotoUrl.startsWith('http:') ||
        facePhotoUrl.startsWith('https:') ||
        facePhotoUrl.startsWith('/') ||
        facePhotoUrl.length > 50)
    ) {
      const faceImg = new Image();
      faceImg.crossOrigin = 'anonymous';
      faceImg.onload = () => {
        if (faceSCtx) {
          faceSCtx.clearRect(0, 0, 1024, 1024);
          faceSCtx.drawImage(faceImg, 0, 0, 1024, 1024);
          applyFacePhotoAndDisplacement();
        }
      };
      faceImg.src = facePhotoUrl;
    } else {
      // Default authentic granite/schist face texture
      if (faceSCtx) {
        faceSCtx.fillStyle = isLightMode ? '#CBD5E1' : '#1E293B';
        faceSCtx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 7000; i++) {
          const x = Math.random() * 1024;
          const y = Math.random() * 1024;
          const r = Math.random() * 2.5 + 0.5;
          faceSCtx.fillStyle = Math.random() > 0.5 ? '#64748B' : '#94A3B8';
          faceSCtx.beginPath();
          faceSCtx.arc(x, y, r, 0, Math.PI * 2);
          faceSCtx.fill();
        }
        faceSCtx.strokeStyle = '#334155';
        faceSCtx.lineWidth = 2.5;
        for (let j = 0; j < 14; j++) {
          faceSCtx.beginPath();
          faceSCtx.moveTo(Math.random() * 1024, Math.random() * 1024);
          faceSCtx.lineTo(Math.random() * 1024, Math.random() * 1024);
          faceSCtx.stroke();
        }
      }
      applyFacePhotoAndDisplacement();
    }

    const faceMesh = new THREE.Mesh(faceGeom, faceMaterial);
    faceMesh.position.set(0, 0, 0);
    faceMesh.receiveShadow = true;
    tunnelGroup.add(faceMesh);

    // --- LEFT WALL MESH (Z = 0 to -pullDepth, Y = 0 to splH, X = -halfW) ---
    const leftWallCanvas = leftWallPhotoUrl
      ? document.createElement('canvas')
      : createGeologicalWallCanvas('left', isLightMode);
    const leftWallTexture = new THREE.CanvasTexture(leftWallCanvas);
    leftWallTexture.colorSpace = THREE.SRGBColorSpace;
    leftWallTexture.wrapS = THREE.ClampToEdgeWrapping;
    leftWallTexture.wrapT = THREE.ClampToEdgeWrapping;
    if (leftWallPhotoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = leftWallCanvas.getContext('2d');
        if (ctx) {
          leftWallCanvas.width = 1024;
          leftWallCanvas.height = 512;
          ctx.drawImage(img, 0, 0, 1024, 512);
          leftWallTexture.needsUpdate = true;
        }
      };
      img.src = leftWallPhotoUrl;
    }

    const leftWallGeom = new THREE.PlaneGeometry(pullDepth, splH, 16, 12);
    // Position plane at left wall facing inwards (+X)
    leftWallGeom.rotateY(Math.PI / 2);
    leftWallGeom.translate(-halfW, splH / 2, -pullDepth / 2);

    const leftWallMat = new THREE.MeshStandardMaterial({
      map: leftWallTexture,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.FrontSide,
      wireframe: showWireframe,
    });
    const leftWallMesh = new THREE.Mesh(leftWallGeom, leftWallMat);
    tunnelGroup.add(leftWallMesh);

    // --- RIGHT WALL MESH (Z = 0 to -pullDepth, Y = 0 to splH, X = +halfW) ---
    const rightWallCanvas = rightWallPhotoUrl
      ? document.createElement('canvas')
      : createGeologicalWallCanvas('right', isLightMode);
    const rightWallTexture = new THREE.CanvasTexture(rightWallCanvas);
    rightWallTexture.colorSpace = THREE.SRGBColorSpace;
    rightWallTexture.wrapS = THREE.ClampToEdgeWrapping;
    rightWallTexture.wrapT = THREE.ClampToEdgeWrapping;
    if (rightWallPhotoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = rightWallCanvas.getContext('2d');
        if (ctx) {
          rightWallCanvas.width = 1024;
          rightWallCanvas.height = 512;
          ctx.drawImage(img, 0, 0, 1024, 512);
          rightWallTexture.needsUpdate = true;
        }
      };
      img.src = rightWallPhotoUrl;
    }

    const rightWallGeom = new THREE.PlaneGeometry(pullDepth, splH, 16, 12);
    // Position plane at right wall facing inwards (-X)
    rightWallGeom.rotateY(-Math.PI / 2);
    rightWallGeom.translate(halfW, splH / 2, -pullDepth / 2);

    const rightWallMat = new THREE.MeshStandardMaterial({
      map: rightWallTexture,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.FrontSide,
      wireframe: showWireframe,
    });
    const rightWallMesh = new THREE.Mesh(rightWallGeom, rightWallMat);
    tunnelGroup.add(rightWallMesh);

    // --- CROWN ARCH VAULT MESH (Curved cylinder spanning between springlines) ---
    const crownCanvas = crownPhotoUrl
      ? document.createElement('canvas')
      : createGeologicalCrownCanvas(isLightMode);
    const crownTexture = new THREE.CanvasTexture(crownCanvas);
    crownTexture.colorSpace = THREE.SRGBColorSpace;
    crownTexture.wrapS = THREE.ClampToEdgeWrapping;
    crownTexture.wrapT = THREE.ClampToEdgeWrapping;
    if (crownPhotoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = crownCanvas.getContext('2d');
        if (ctx) {
          crownCanvas.width = 1024;
          crownCanvas.height = 512;
          ctx.drawImage(img, 0, 0, 1024, 512);
          crownTexture.needsUpdate = true;
        }
      };
      img.src = crownPhotoUrl;
    }

    // Build curved parametric arch vault
    const archSegsX = 32;
    const archSegsZ = 16;
    const crownGeom = new THREE.BufferGeometry();
    const crownVerts: number[] = [];
    const crownNorms: number[] = [];
    const crownUvsList: number[] = [];
    const crownIndices: number[] = [];

    for (let iz = 0; iz <= archSegsZ; iz++) {
      const v = iz / archSegsZ;
      const z = -v * pullDepth;

      for (let ix = 0; ix <= archSegsX; ix++) {
        const u = ix / archSegsX; // 0 = Left Springline, 0.5 = Apex, 1 = Right Springline
        const angle = (1 - u) * Math.PI;
        const x = halfW * Math.cos(angle);
        const y = splH + archH * Math.sin(angle);

        crownVerts.push(x, y, z);

        // Normal pointing inward toward tunnel center
        const nx = -Math.cos(angle);
        const ny = -Math.sin(angle);
        crownNorms.push(nx, ny, 0);

        crownUvsList.push(u, v);
      }
    }

    for (let iz = 0; iz < archSegsZ; iz++) {
      for (let ix = 0; ix < archSegsX; ix++) {
        const a = iz * (archSegsX + 1) + ix;
        const b = (iz + 1) * (archSegsX + 1) + ix;
        const c = (iz + 1) * (archSegsX + 1) + (ix + 1);
        const d = iz * (archSegsX + 1) + (ix + 1);

        // Inward facing winding
        crownIndices.push(a, b, d);
        crownIndices.push(b, c, d);
      }
    }

    crownGeom.setAttribute('position', new THREE.Float32BufferAttribute(crownVerts, 3));
    crownGeom.setAttribute('normal', new THREE.Float32BufferAttribute(crownNorms, 3));
    crownGeom.setAttribute('uv', new THREE.Float32BufferAttribute(crownUvsList, 2));
    crownGeom.setIndex(crownIndices);

    const crownMat = new THREE.MeshStandardMaterial({
      map: crownTexture,
      roughness: 0.88,
      metalness: 0.1,
      side: THREE.FrontSide,
      wireframe: showWireframe,
    });
    const crownMesh = new THREE.Mesh(crownGeom, crownMat);
    tunnelGroup.add(crownMesh);

    // --- INVERT ROADWAY FLOOR MESH (Y = 0, Z = 0 to -pullDepth) ---
    const chainageTitle = `CH. ${round.chainageFrom || '100.0'}m → PULL ${pullDepth}m`;
    const invertCanvas = createInvertRoadwayCanvas(chainageTitle, isLightMode);
    const invertTexture = new THREE.CanvasTexture(invertCanvas);
    invertTexture.colorSpace = THREE.SRGBColorSpace;

    const invertGeom = new THREE.PlaneGeometry(tunnelW, pullDepth, 16, 16);
    invertGeom.rotateX(-Math.PI / 2);
    invertGeom.translate(0, 0, -pullDepth / 2);

    const invertMat = new THREE.MeshStandardMaterial({
      map: invertTexture,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.FrontSide,
      wireframe: showWireframe,
    });
    const invertMesh = new THREE.Mesh(invertGeom, invertMat);
    tunnelGroup.add(invertMesh);

    // 5. Authentic NATM Mining Details: Steel Arch Ribs (Lattice Girders)
    const steelArchGroup = new THREE.Group();
    steelArchGroup.visible = showSteelArch;
    tunnelGroup.add(steelArchGroup);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.35,
    });

    const createArchRib = (zPos: number) => {
      const ribGroup = new THREE.Group();

      // Left leg
      const legGeom = new THREE.BoxGeometry(0.14, splH, 0.14);
      const leftLeg = new THREE.Mesh(legGeom, steelMat);
      leftLeg.position.set(-halfW + 0.07, splH / 2, zPos);
      ribGroup.add(leftLeg);

      // Right leg
      const rightLeg = new THREE.Mesh(legGeom, steelMat);
      rightLeg.position.set(halfW - 0.07, splH / 2, zPos);
      ribGroup.add(rightLeg);

      // Crown curved arch rib segments
      const numArchSegments = 16;
      for (let i = 0; i < numArchSegments; i++) {
        const u1 = i / numArchSegments;
        const u2 = (i + 1) / numArchSegments;
        const a1 = (1 - u1) * Math.PI;
        const a2 = (1 - u2) * Math.PI;

        const x1 = (halfW - 0.07) * Math.cos(a1);
        const y1 = splH + (archH - 0.07) * Math.sin(a1);
        const x2 = (halfW - 0.07) * Math.cos(a2);
        const y2 = splH + (archH - 0.07) * Math.sin(a2);

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const segGeom = new THREE.BoxGeometry(len, 0.12, 0.12);
        const seg = new THREE.Mesh(segGeom, steelMat);
        seg.position.set((x1 + x2) / 2, (y1 + y2) / 2, zPos);
        seg.rotation.z = Math.atan2(dy, dx);
        ribGroup.add(seg);
      }

      // Base plates at invert
      const baseGeom = new THREE.BoxGeometry(0.35, 0.05, 0.35);
      const bMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      const b1 = new THREE.Mesh(baseGeom, bMat);
      b1.position.set(-halfW + 0.07, 0.025, zPos);
      const b2 = new THREE.Mesh(baseGeom, bMat);
      b2.position.set(halfW - 0.07, 0.025, zPos);
      ribGroup.add(b1, b2);

      return ribGroup;
    };

    // Install steel arch at face cut (Z = 0) and at advance round start (Z = -pullDepth)
    steelArchGroup.add(createArchRib(0.02));
    steelArchGroup.add(createArchRib(-pullDepth + 0.02));

    // 6. Pattern Radial Rock Bolts & Face Plates
    const boltsGroup = new THREE.Group();
    boltsGroup.visible = showRockBolts;
    tunnelGroup.add(boltsGroup);

    const boltPlateGeom = new THREE.BoxGeometry(0.18, 0.18, 0.03);
    const boltPlateMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.3 });
    const boltShaftGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 8);
    const boltShaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

    const placeRockBolt = (x: number, y: number, z: number, angleRad: number) => {
      const b = new THREE.Group();
      b.position.set(x, y, z);
      b.rotation.z = angleRad - Math.PI / 2;

      const plate = new THREE.Mesh(boltPlateGeom, boltPlateMat);
      const shaft = new THREE.Mesh(boltShaftGeom, boltShaftMat);
      shaft.position.y = 0.22;
      b.add(plate, shaft);
      boltsGroup.add(b);
    };

    // Place radial bolts along crown arch at 1.0m intervals along depth
    for (let z = -pullDepth * 0.3; z >= -pullDepth * 0.9; z -= pullDepth * 0.4) {
      const angles = [0.25 * Math.PI, 0.4 * Math.PI, 0.5 * Math.PI, 0.6 * Math.PI, 0.75 * Math.PI];
      angles.forEach((ang) => {
        const x = (halfW - 0.08) * Math.cos(ang);
        const y = splH + (archH - 0.08) * Math.sin(ang);
        placeRockBolt(x, y, z, ang);
      });

      // Sidewall horizontal bolts
      placeRockBolt(-halfW + 0.08, splH * 0.55, z, 0);
      placeRockBolt(halfW - 0.08, splH * 0.55, z, Math.PI);
    }

    // 7. Total Station Survey Alignment Laser Beam
    const surveyLaserGroup = new THREE.Group();
    surveyLaserGroup.visible = showSurveyLaser;
    tunnelGroup.add(surveyLaserGroup);

    const laserZ1 = -pullDepth * 1.4;
    const laserZ2 = 0.05;
    const laserY = splH * 0.85;

    const laserGeom = new THREE.CylinderGeometry(0.012, 0.012, laserZ2 - laserZ1, 8);
    laserGeom.rotateX(Math.PI / 2);
    laserGeom.translate(0, laserY, (laserZ1 + laserZ2) / 2);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85 });
    const laserBeam = new THREE.Mesh(laserGeom, laserMat);
    surveyLaserGroup.add(laserBeam);

    // Laser survey dot on face
    const laserDotGeom = new THREE.RingGeometry(0.04, 0.08, 16);
    const laserDotMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const laserDot = new THREE.Mesh(laserDotGeom, laserDotMat);
    laserDot.position.set(0, laserY, 0.06);
    surveyLaserGroup.add(laserDot);

    // 8. Survey Coordinate Ground Reference Grid & Metric Scale Indicators
    const gridHelper = new THREE.GridHelper(tunnelW * 2.2, 12, 0x0284c7, isLightMode ? 0x94a3b8 : 0x334155);
    gridHelper.position.set(0, -0.05, -pullDepth / 2);
    scene.add(gridHelper);

    // 9. Peeking Confirmed Joint Traces onto Their Exact 3D Surfaces
    const peekingGroup = new THREE.Group();
    peekingGroup.visible = isPeekingTraces;
    tunnelGroup.add(peekingGroup);

    if (round.jointTraces && round.jointTraces.length > 0) {
      round.jointTraces.forEach((trace) => {
        if (!trace.points || trace.points.length < 2) return;
        const color = FIELD_JOINT_GROUP_COLORS[trace.setId]?.stroke || '#f59e0b';
        const pts3D: THREE.Vector3[] = [];

        trace.points.forEach((pt) => {
          if (trace.panel === 'face') {
            const x3d = ((pt.x - 500) / 1000) * tunnelW;
            const y3d = ((1000 - pt.y) / 1000) * tunnelH;
            pts3D.push(new THREE.Vector3(x3d, y3d, 0.06));
          } else if (trace.panel === 'left_wall') {
            const z3d = -((1000 - pt.x) / 1000) * pullDepth;
            const y3d = (pt.y / 1000) * splH;
            pts3D.push(new THREE.Vector3(-halfW + 0.04, y3d, z3d));
          } else if (trace.panel === 'right_wall') {
            const z3d = -((1000 - pt.x) / 1000) * pullDepth;
            const y3d = (pt.y / 1000) * splH;
            pts3D.push(new THREE.Vector3(halfW - 0.04, y3d, z3d));
          } else if (trace.panel === 'crown') {
            const z3d = -((1000 - pt.x) / 1000) * pullDepth;
            const u = pt.y / 1000;
            const angle = (1 - u) * Math.PI;
            const x3d = (halfW - 0.04) * Math.cos(angle);
            const y3d = splH + (archH - 0.04) * Math.sin(angle);
            pts3D.push(new THREE.Vector3(x3d, y3d, z3d));
          }
        });

        if (pts3D.length >= 2) {
          const traceGeom = new THREE.BufferGeometry().setFromPoints(pts3D);
          const traceMat = new THREE.LineBasicMaterial({ color, linewidth: 4 });
          const traceLine = new THREE.Line(traceGeom, traceMat);
          peekingGroup.add(traceLine);

          // Joint vertex spheres
          const dotGeom = new THREE.SphereGeometry(0.045, 8, 8);
          const dotMat = new THREE.MeshBasicMaterial({ color });
          pts3D.forEach((p) => {
            const dot = new THREE.Mesh(dotGeom, dotMat);
            dot.position.copy(p);
            peekingGroup.add(dot);
          });
        }
      });
    }

    // 10. Synced 3D Crosshair Reticle Indicator
    const hoverReticle = new THREE.Group();
    hoverReticle.visible = false;

    const ringGeom = new THREE.RingGeometry(0.12, 0.16, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    hoverReticle.add(ringMesh);

    const crossLineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.25, 0, 0),
      new THREE.Vector3(0.25, 0, 0),
      new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0, 0, -0.25),
      new THREE.Vector3(0, 0, 0.25),
    ]);
    const crossLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2.5 });
    const crossLines = new THREE.LineSegments(crossLineGeom, crossLineMat);
    hoverReticle.add(crossLines);

    scene.add(hoverReticle);
    externalHoverReticleRef.current = hoverReticle;

    // 11. Camera Orbit and Positioning
    const updateCameraPosition = () => {
      const c = controlsRef.current;
      const x = c.radius * Math.sin(c.theta) * Math.cos(c.phi);
      const y = c.radius * Math.sin(c.phi);
      const z = c.radius * Math.cos(c.theta) * Math.cos(c.phi);

      camera.position.set(x + c.target.x, y + c.target.y, z + c.target.z);
      camera.lookAt(c.target);
    };
    updateCameraPositionRef.current = updateCameraPosition;

    if (cameraView === 'face') {
      controlsRef.current.radius = tunnelW * 1.45;
      controlsRef.current.theta = 0;
      controlsRef.current.phi = 0.05;
      controlsRef.current.target.set(0, tunnelH / 2, 0);
    } else if (cameraView === 'inside') {
      controlsRef.current.radius = 2.8;
      controlsRef.current.theta = Math.PI;
      controlsRef.current.phi = 0.05;
      controlsRef.current.target.set(0, tunnelH * 0.45, 0);
    } else if (cameraView === 'isometric') {
      controlsRef.current.radius = Math.max(tunnelW, tunnelH) * 2.1;
      controlsRef.current.theta = 0.8;
      controlsRef.current.phi = 0.55;
      controlsRef.current.target.set(0, tunnelH * 0.45, -pullDepth / 2);
    } else {
      // Perspective
      controlsRef.current.radius = Math.max(tunnelW, tunnelH) * 1.85;
      controlsRef.current.theta = 0.45;
      controlsRef.current.phi = 0.3;
      controlsRef.current.target.set(0, tunnelH * 0.45, -pullDepth * 0.3);
    }
    updateCameraPosition();

    const broadcastCameraChange = () => {
      const c = controlsRef.current;
      onCameraChange?.({
        theta: c.theta,
        phi: c.phi,
        radius: c.radius,
        targetX: c.target.x,
        targetY: c.target.y,
        targetZ: c.target.z,
        sourceId: instanceId,
      });
    };

    // 12. Multi-Surface Raycasting for Cursor & Coordinate Sync
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const targetMeshes = [faceMesh, leftWallMesh, rightWallMesh, crownMesh, invertMesh];

    const onPointerDown = (e: PointerEvent) => {
      container.setPointerCapture(e.pointerId);
      controlsRef.current.isDragging = e.button === 0;
      controlsRef.current.isPanning = e.button === 2 || e.button === 1;
      controlsRef.current.prevX = e.clientX;
      controlsRef.current.prevY = e.clientY;
      setIsRotating(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mouse.x = (clientX / (rect.width || 1)) * 2 - 1;
      mouse.y = -(clientY / (rect.height || 1)) * 2 + 1;

      // Raycast to detect 3D position on individual tunnel surfaces
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(targetMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const pt = hit.point;
        hoverReticle.visible = true;
        hoverReticle.position.copy(pt);
        hoverReticle.quaternion.copy(camera.quaternion);

        let hitPanel: FieldPanelId = 'face';
        if (hit.object === leftWallMesh) hitPanel = 'left_wall';
        else if (hit.object === rightWallMesh) hitPanel = 'right_wall';
        else if (hit.object === crownMesh) hitPanel = 'crown';
        else if (hit.object === faceMesh) hitPanel = 'face';

        onHoverCoordChange?.({
          x: pt.x,
          y: pt.y,
          z: pt.z,
          panel: hitPanel,
          sourceId: instanceId,
        });
      }

      const c = controlsRef.current;
      if (!c.isDragging && !c.isPanning) return;

      const deltaX = e.clientX - c.prevX;
      const deltaY = e.clientY - c.prevY;
      c.prevX = e.clientX;
      c.prevY = e.clientY;

      if (c.isPanning) {
        const panFactor = c.radius * 0.0015;
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();

        const up = camera.up.clone();
        c.target.addScaledVector(right, -deltaX * panFactor);
        c.target.addScaledVector(up, deltaY * panFactor);
      } else if (c.isDragging) {
        c.theta -= deltaX * 0.008;
        c.phi = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, c.phi + deltaY * 0.008));
      }

      updateCameraPosition();
      broadcastCameraChange();
    };

    const onPointerUp = (e: PointerEvent) => {
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      controlsRef.current.isDragging = false;
      controlsRef.current.isPanning = false;
    };

    const onPointerLeave = () => {
      hoverReticle.visible = false;
      onHoverCoordChange?.(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
      controlsRef.current.radius = Math.max(0.2, Math.min(500, controlsRef.current.radius * zoomFactor));
      updateCameraPosition();
      broadcastCameraChange();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('wheel', onWheel, { passive: false });

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('contextmenu', onContextMenu);

    // 13. Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isRotating && !controlsRef.current.isDragging && !controlsRef.current.isPanning) {
        controlsRef.current.theta += 0.002;
        updateCameraPosition();
        broadcastCameraChange();
      }

      renderer.render(scene, camera);
    };
    animate();

    // 14. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);

      // Clean disposal
      faceGeom.dispose();
      faceMaterial.dispose();
      leftWallGeom.dispose();
      leftWallMat.dispose();
      rightWallGeom.dispose();
      rightWallMat.dispose();
      crownGeom.dispose();
      crownMat.dispose();
      invertGeom.dispose();
      invertMat.dispose();
      faceTexture.dispose();
      leftWallTexture.dispose();
      rightWallTexture.dispose();
      crownTexture.dispose();
      invertTexture.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      crossLineGeom.dispose();
      crossLineMat.dispose();
      renderer.dispose();
    };
  }, [
    location,
    round,
    activePanel,
    facePhotoUrl,
    leftWallPhotoUrl,
    rightWallPhotoUrl,
    crownPhotoUrl,
    brightness,
    contrast,
    filterType,
    matlabFilter,
    isLightMode,
    cameraView,
    showWireframe,
    showSteelArch,
    showRockBolts,
    showSurveyLaser,
    isRotating,
    isPeekingTraces,
  ]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-slate-950">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full h-full touch-none cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Navigation & Spec Controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 text-[10px] text-white shadow-md">
        <span className="font-bold text-cyan-400 font-mono px-1">3D Tunnel Mesh</span>
        <div className="inline-flex items-center rounded bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
          <button
            type="button"
            onClick={() => setCameraView('perspective')}
            className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
              cameraView === 'perspective' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Perspective
          </button>
          <button
            type="button"
            onClick={() => setCameraView('face')}
            className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
              cameraView === 'face' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Face Heading
          </button>
          <button
            type="button"
            onClick={() => setCameraView('inside')}
            className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
              cameraView === 'inside' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Walk-In
          </button>
          <button
            type="button"
            onClick={() => setCameraView('isometric')}
            className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
              cameraView === 'isometric' ? 'bg-purple-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            ISO Profile
          </button>
        </div>

        {/* Support Detail Toggles */}
        <button
          type="button"
          onClick={() => setShowSteelArch((s) => !s)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            showSteelArch ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle 3D Steel Lattice Girder Ribs"
        >
          Steel Ribs
        </button>

        <button
          type="button"
          onClick={() => setShowRockBolts((b) => !b)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            showRockBolts ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle 3D Radial Pattern Rock Bolts"
        >
          Rock Bolts
        </button>

        <button
          type="button"
          onClick={() => setShowSurveyLaser((l) => !l)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            showSurveyLaser ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle Total Station Survey Laser Alignment Beam"
        >
          Laser
        </button>

        <button
          type="button"
          onClick={() => setIsRotating((r) => !r)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            isRotating ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Toggle Turntable Auto-Rotation"
        >
          {isRotating ? 'Orbit: ON' : 'Orbit: OFF'}
        </button>

        <button
          type="button"
          onClick={() => setShowWireframe((w) => !w)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            showWireframe ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Toggle CAD Mesh Wireframe"
        >
          Wireframe
        </button>

        {/* AI Photogrammetry Reconstruction Trigger */}
        <button
          type="button"
          onClick={() => {
            if (onTriggerAiReconstruct) {
              onTriggerAiReconstruct();
            }
            setIsAiModalOpen(true);
          }}
          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1 cursor-pointer transition-all shadow-sm"
          title="Analyze photo and physical geometry with AI Photogrammetry Engine"
        >
          <span>⚡ AI 3D Reconstruct</span>
        </button>
      </div>

      {/* Surface Status Badges (Shows which photos are loaded on each 3D surface) */}
      <div className="absolute top-10 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/70 text-[9px] font-mono text-slate-300">
        <span className="text-slate-400 font-bold">Surfaces:</span>
        <span className={`px-1 rounded ${facePhotoUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          Face: {facePhotoUrl ? '✓ Photo' : 'Procedural'}
        </span>
        <span>·</span>
        <span className={`px-1 rounded ${leftWallPhotoUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          Left Wall: {leftWallPhotoUrl ? '✓ Photo' : 'Rock Wall'}
        </span>
        <span>·</span>
        <span className={`px-1 rounded ${crownPhotoUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          Crown: {crownPhotoUrl ? '✓ Photo' : 'Shotcrete'}
        </span>
        <span>·</span>
        <span className={`px-1 rounded ${rightWallPhotoUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
          Right Wall: {rightWallPhotoUrl ? '✓ Photo' : 'Rock Wall'}
        </span>
      </div>

      {/* Top Right AI Photogrammetry Match Badge */}
      {aiAnalysisResult && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/90 backdrop-blur-sm border border-cyan-500/40 text-[10px] text-slate-200 font-mono shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-cyan-300 font-bold">AI Match: {aiAnalysisResult.contourMatchPct}%</span>
          <span className="text-slate-500">|</span>
          <span className="text-amber-300 font-bold">Conf: {aiAnalysisResult.confidenceScore}%</span>
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="text-[9px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-1.5 py-0.5 rounded cursor-pointer ml-1"
          >
            Details
          </button>
        </div>
      )}

      {/* Physical Tunnel Size Badge & Navigation Help */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 text-[10px] text-slate-300 font-mono shadow-md pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">
            Profile: {location.shape.toUpperCase()} · Span: {location.widthM || 8.5}m · Height: {location.heightM || 7.5}m · Pull: {round.pullLengthMeters || 3.0}m
          </span>
        </div>
        <div className="text-slate-400 flex items-center gap-1.5">
          <span>🖱️ Left-Drag: Rotate</span>
          <span>·</span>
          <span>Right-Drag: Pan</span>
          <span>·</span>
          <span className="text-cyan-300 font-bold">Wheel: Infinite Zoom</span>
          <span>·</span>
          <span className="text-amber-300 font-bold">Hold Shift: Peek Traces</span>
        </div>
      </div>

      {/* AI Photogrammetry Analysis Detail Modal */}
      {isAiModalOpen && aiAnalysisResult && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-500/60 rounded-xl p-4 max-w-md w-full shadow-2xl text-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="font-black text-sm text-cyan-400 uppercase tracking-wide">
                  AI 3D Tunnel Reconstruction
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm px-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {aiAnalysisResult.summary}
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9.5px]">Contour Match</span>
                <span className="text-emerald-400 font-black text-sm">{aiAnalysisResult.contourMatchPct}%</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9.5px]">Confidence Score</span>
                <span className="text-cyan-400 font-black text-sm">{aiAnalysisResult.confidenceScore}%</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9.5px]">Detected Fractures</span>
                <span className="text-amber-400 font-black text-sm">{aiAnalysisResult.detectedFractureCount} traces</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9.5px]">Lighting Uniformity</span>
                <span className="text-purple-400 font-black text-sm">{aiAnalysisResult.lightingUniformity}%</span>
              </div>
            </div>

            <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800 space-y-1">
              <span className="text-amber-300 font-bold block text-[10px] uppercase">
                Estimated Rock Mass Quality:
              </span>
              <span className="text-white font-semibold">{aiAnalysisResult.estimatedRockQuality}</span>
            </div>

            {aiAnalysisResult.extractedJointHints && aiAnalysisResult.extractedJointHints.length > 0 && (
              <div className="space-y-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">
                  Detected Dominant Discontinuity Hints:
                </span>
                <div className="space-y-1">
                  {aiAnalysisResult.extractedJointHints.map((hint, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded text-[10px] font-mono text-cyan-300 border border-slate-800"
                    >
                      <span>
                        Dip: {hint.dipAmount}° / Dir: {hint.dipDirection}°
                      </span>
                      <span>Persistence: {hint.persistenceMeters}m</span>
                      <span className="text-emerald-400 font-bold">{hint.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer text-xs"
              >
                Close &amp; Inspect 3D Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
