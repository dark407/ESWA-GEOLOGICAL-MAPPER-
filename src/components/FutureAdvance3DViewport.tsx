// ============================================================================
// ESWA ADVANCED ANALYTICS — 3D FUTURE ADVANCE & GEOHAZARD FORECAST VIEWPORT
// Interactive Three.js 3D Viewport: Multi-round Forward Extrapolation
// (+3m, +6m, +9m, +15m, +30m), 3D Striking Discontinuity Plane Daylighting,
// Forward Probe Hole Arrays (5° Look-up), Mountain Overburden & Stress Halo.
// ============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  TrendingUp,
  Box,
  Layers,
  Compass,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

export interface FuturePredictionItem {
  advanceDelta: number;
  label: string;
  horizon: string;
  targetChainage: string;
  daylightDistanceM: number;
  willIntersectInHorizon: boolean;
  riskLevel: 'HIGH' | 'MODERATE' | 'LOW';
  predictedClass: string;
  waterForecast: string;
  recommendedSupport: string;
}

export interface FutureAdvance3DViewportProps {
  spanW: number;
  heightH: number;
  currentChainageNum: number;
  trueDip: number;
  trueDipDir: number;
  trueStrike: number;
  customDriveAzimuth: number;
  predictions: FuturePredictionItem[];
  overburdenDepthM: number;
  activeJointSet?: string;
}

export const FutureAdvance3DViewport: React.FC<FutureAdvance3DViewportProps> = ({
  spanW,
  heightH,
  currentChainageNum,
  trueDip,
  trueDipDir,
  trueStrike,
  customDriveAzimuth,
  predictions,
  overburdenDepthM,
  activeJointSet = 'J1',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // View state
  const [viewPreset, setViewPreset] = useState<'3D_AHEAD' | 'SIDE_PROFILE' | 'TOP_PLAN' | 'TUNNEL_INSIDE'>('3D_AHEAD');
  const [showProbeHoles, setShowProbeHoles] = useState<boolean>(true);
  const [showGeologicalPlanes, setShowGeologicalPlanes] = useState<boolean>(true);

  // Mouse orbit state
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0.65,
    phi: 1.15,
    radius: 36,
  });

  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, heightH * 0.45, 10));

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = orbitAngleRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi) + targetLookAt.current.y;
    const z = radius * Math.sin(phi) * Math.cos(theta) + targetLookAt.current.z;
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(targetLookAt.current);
  }, [heightH]);

  const setCameraPreset = (preset: '3D_AHEAD' | 'SIDE_PROFILE' | 'TOP_PLAN' | 'TUNNEL_INSIDE') => {
    setViewPreset(preset);
    if (preset === '3D_AHEAD') {
      orbitAngleRef.current = { theta: 0.65, phi: 1.15, radius: 36 };
      targetLookAt.current.set(0, heightH * 0.45, 10);
    } else if (preset === 'SIDE_PROFILE') {
      orbitAngleRef.current = { theta: 1.57, phi: 1.57, radius: 42 };
      targetLookAt.current.set(0, heightH * 0.45, 12);
    } else if (preset === 'TOP_PLAN') {
      orbitAngleRef.current = { theta: 0, phi: 0.05, radius: 45 };
      targetLookAt.current.set(0, 0, 12);
    } else if (preset === 'TUNNEL_INSIDE') {
      // Driver inside tunnel looking forward into mountain
      orbitAngleRef.current = { theta: 3.14, phi: 1.57, radius: 6 };
      targetLookAt.current.set(0, heightH * 0.4, 25);
    }
    updateCameraPosition();
  };

  // --------------------------------------------------------------------------
  // BUILD 3D SCENE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(20, 40, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight2.position.set(-20, 20, -20);
    scene.add(dirLight2);

    // Grid Floor
    const grid = new THREE.GridHelper(60, 30, 0x334155, 0x1e293b);
    grid.position.set(0, -0.01, 15);
    scene.add(grid);

    const halfW = spanW / 2;
    const wallH = heightH * 0.55;
    const archRadius = halfW;

    // Helper: Create 2D horseshoe shape
    const makeHorseshoeShape = () => {
      const shape = new THREE.Shape();
      shape.moveTo(-halfW, 0);
      shape.lineTo(-halfW, wallH);
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const angle = Math.PI - (i / steps) * Math.PI;
        const x = Math.cos(angle) * archRadius;
        const y = wallH + Math.sin(angle) * (heightH - wallH);
        shape.lineTo(x, y);
      }
      shape.lineTo(halfW, 0);
      shape.lineTo(-halfW, 0);
      return shape;
    };

    const hsShape = makeHorseshoeShape();

    // ------------------------------------------------------------------------
    // 1. EXCAVATED TUNNEL SECTION (Behind current face: Z from -12m to 0m)
    // ------------------------------------------------------------------------
    const excavatedGeo = new THREE.ExtrudeGeometry(hsShape, { depth: 14, bevelEnabled: false });
    excavatedGeo.translate(0, 0, -14); // Z: -14 to 0

    const excavatedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const excavatedMesh = new THREE.Mesh(excavatedGeo, excavatedMat);
    scene.add(excavatedMesh);

    const excavatedEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(excavatedGeo, 25),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    scene.add(excavatedEdges);

    // ------------------------------------------------------------------------
    // 2. ACTIVE EXCAVATION FACE (At Z = 0)
    // ------------------------------------------------------------------------
    const faceGeo = new THREE.ShapeGeometry(hsShape);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 0, 0);
    scene.add(faceMesh);

    // Glowing face boundary line
    const faceLineGeo = new THREE.BufferGeometry().setFromPoints(hsShape.getPoints());
    const faceLine = new THREE.Line(
      faceLineGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
    );
    scene.add(faceLine);

    // ------------------------------------------------------------------------
    // 3. PROJECTED ADVANCE ROUND RINGS (+3m, +6m, +9m, +15m, +30m)
    // ------------------------------------------------------------------------
    const advanceGroup = new THREE.Group();
    const roundDistances = [3, 6, 9, 15, 30];

    roundDistances.forEach((dist) => {
      // Ring boundary
      const ringLine = new THREE.Line(
        faceLineGeo,
        new THREE.LineBasicMaterial({
          color: dist <= 9 ? 0xf59e0b : dist === 15 ? 0x10b981 : 0xa855f7,
          transparent: true,
          opacity: 0.75,
        })
      );
      ringLine.position.set(0, 0, dist);
      advanceGroup.add(ringLine);

      // Station chainage marker post
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
      const postMat = new THREE.MeshBasicMaterial({ color: 0x64748b });
      const postMesh = new THREE.Mesh(postGeo, postMat);
      postMesh.position.set(-halfW - 0.4, 0.6, dist);
      advanceGroup.add(postMesh);
    });

    // Ghosted mountain rock mass wireframe block ahead
    const ghostGeo = new THREE.BoxGeometry(spanW * 1.6, heightH * 1.5, 30);
    ghostGeo.translate(0, heightH * 0.7, 15);
    const ghostEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(ghostGeo),
      new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 })
    );
    advanceGroup.add(ghostEdges);
    scene.add(advanceGroup);

    // ------------------------------------------------------------------------
    // 4. 3D PROJECTED DISCONTINUITY PLANE (Mapped Strike & Dip)
    // ------------------------------------------------------------------------
    const planeGroup = new THREE.Group();
    const planeW = spanW * 2.2;
    const planeH = heightH * 2.2;
    const discGeo = new THREE.PlaneGeometry(planeW, planeH);

    // Calculate rotation to match strike and dip relative to tunnel drive
    // In Three.js: Z is tunnel drive axis, X is lateral, Y is vertical
    const angleDiffRad = ((trueDipDir - customDriveAzimuth) * Math.PI) / 180;
    const dipRad = (trueDip * Math.PI) / 180;

    discGeo.rotateX(-dipRad);
    discGeo.rotateY(angleDiffRad);

    // Position plane where it daylights into crown ahead of face
    const daylightDist = predictions[0]?.daylightDistanceM || 6.0;
    discGeo.translate(0, heightH * 0.6, Math.min(26, daylightDist));

    const discMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.4,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    planeGroup.add(discMesh);

    const discEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(discGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );
    planeGroup.add(discEdges);
    scene.add(planeGroup);

    // ------------------------------------------------------------------------
    // 5. 3D FORWARD PROBE HOLE DRILLING ARRAY (15m @ 5° look-up)
    // ------------------------------------------------------------------------
    const probeGroup = new THREE.Group();
    const probeLength = 16.0;
    const probeGeo = new THREE.CylinderGeometry(0.04, 0.04, probeLength, 8);
    probeGeo.translate(0, probeLength / 2, 0);

    const probeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    // 3 probe holes: Center Crown (5° up), Left Arch (7° out), Right Arch (7° out)
    const probeAngles = [
      { rx: Math.PI / 2 - 0.09, ry: 0, px: 0, py: heightH * 0.8 },
      { rx: Math.PI / 2 - 0.09, ry: 0.12, px: halfW * 0.6, py: heightH * 0.75 },
      { rx: Math.PI / 2 - 0.09, ry: -0.12, px: -halfW * 0.6, py: heightH * 0.75 },
    ];

    probeAngles.forEach((p) => {
      const rod = new THREE.Mesh(probeGeo, probeMat);
      rod.position.set(p.px, p.py, 0);
      rod.rotation.x = p.rx;
      rod.rotation.y = p.ry;
      probeGroup.add(rod);
    });
    scene.add(probeGroup);

    // ------------------------------------------------------------------------
    // RENDER LOOP
    // ------------------------------------------------------------------------
    const renderLoop = () => {
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        container.innerHTML = '';
        rendererRef.current.dispose();
      }
      scene.clear();
    };
  }, [spanW, heightH, trueDip, trueDipDir, customDriveAzimuth, predictions, updateCameraPosition]);

  // Orbit controls listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    orbitAngleRef.current.theta -= deltaX * 0.008;
    orbitAngleRef.current.phi = Math.max(
      0.05,
      Math.min(Math.PI / 2 + 0.1, orbitAngleRef.current.phi - deltaY * 0.008)
    );
    updateCameraPosition();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    orbitAngleRef.current.radius = Math.max(
      12,
      Math.min(70, orbitAngleRef.current.radius + e.deltaY * 0.02)
    );
    updateCameraPosition();
  };

  return (
    <div className="relative w-full h-[360px] sm:h-[440px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col select-none">
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* TOP HUD BAR */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700/80 backdrop-blur-xs flex items-center gap-2 text-xs font-mono text-white">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>3D FORWARD ADVANCE &amp; DISCONTINUITY EXTRAPOLATION</span>
          </div>

          <span className="px-2 py-1 rounded text-xs font-mono font-bold backdrop-blur-xs border bg-slate-900/90 text-amber-300 border-amber-600/60">
            Active Face: RD {currentChainageNum}m
          </span>
        </div>

        {/* VIEW PRESET BUTTONS */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur-xs pointer-events-auto">
          {(
            [
              { id: '3D_AHEAD', label: '3D Ahead' },
              { id: 'SIDE_PROFILE', label: 'Side Profile' },
              { id: 'TOP_PLAN', label: 'Top Plan' },
              { id: 'TUNNEL_INSIDE', label: 'Driver View' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              onClick={() => setCameraPreset(preset.id)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors cursor-pointer ${
                viewPreset === preset.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM INFO BAR */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 backdrop-blur-xs pointer-events-auto">
          <span>Target Joint: <strong className="text-rose-400">{activeJointSet} ({trueDip}° ∠ {trueDipDir}°)</strong></span>
          <span className="text-slate-600">|</span>
          <span>Daylight Intercept: <strong className="text-white">+{predictions[0]?.daylightDistanceM.toFixed(1)}m ahead</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">Probe Array: <strong>15m @ 5° Look-up</strong></span>
          <span className="text-slate-600">|</span>
          <span>Cover: <strong>{overburdenDepthM}m Overburden</strong></span>
        </div>

        <button
          onClick={() => setCameraPreset('3D_AHEAD')}
          className="p-1.5 rounded bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer pointer-events-auto"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
