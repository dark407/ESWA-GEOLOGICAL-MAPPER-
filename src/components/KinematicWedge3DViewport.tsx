// ============================================================================
// ESWA ADVANCED ANALYTICS — 3D KINEMATIC WEDGE & KEYBLOCK VIEWPORT
// Interactive Three.js 3D Viewport: Real-time 3D Tunnel Arch, Daylighting
// Tetrahedral Wedge, Parametric Pattern Rock Bolts, Shotcrete Shell,
// Gravity Vector & Sliding Displacement Simulation.
// ============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  Play,
  Pause,
  Box,
  Layers,
  ShieldCheck,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

export interface KinematicWedge3DViewportProps {
  spanW: number;
  heightH: number;
  pullL: number;
  trueDip: number;
  trueDipDir: number;
  trueStrike: number;
  wedgeVolume: number;
  wedgeWeightKn: number;
  drivingForceKn: number;
  supportedFos: number;
  unboltedFos: number;
  boltSpacingM: number;
  boltCapacityKn: number;
  shotcreteMm: number;
  jointSetLabel?: string;
}

export const KinematicWedge3DViewport: React.FC<KinematicWedge3DViewportProps> = ({
  spanW,
  heightH,
  pullL,
  trueDip,
  trueDipDir,
  trueStrike,
  wedgeVolume,
  wedgeWeightKn,
  drivingForceKn,
  supportedFos,
  unboltedFos,
  boltSpacingM,
  boltCapacityKn,
  shotcreteMm,
  jointSetLabel = 'J1',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Dynamic mesh references for slider reactions
  const wedgeMeshRef = useRef<THREE.Mesh | null>(null);
  const boltsGroupRef = useRef<THREE.Group | null>(null);
  const shotcreteMeshRef = useRef<THREE.Mesh | null>(null);

  // Interactive controls state
  const [isSlidingSimActive, setIsSlidingSimActive] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [viewPreset, setViewPreset] = useState<'ISO' | 'FRONT' | 'SIDE' | 'TOP'>('ISO');

  // Mouse orbit state
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0.78, // ~45 deg
    phi: 1.1,
    radius: 18,
  });

  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, heightH * 0.45, 0));

  // Update camera position from spherical coords
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = orbitAngleRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi) + targetLookAt.current.y;
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(targetLookAt.current);
  }, [heightH]);

  // View Presets
  const setCameraPreset = (preset: 'ISO' | 'FRONT' | 'SIDE' | 'TOP') => {
    setViewPreset(preset);
    if (preset === 'ISO') {
      orbitAngleRef.current = { theta: 0.78, phi: 1.1, radius: 18 };
    } else if (preset === 'FRONT') {
      orbitAngleRef.current = { theta: 0, phi: 1.57, radius: 16 };
    } else if (preset === 'SIDE') {
      orbitAngleRef.current = { theta: 1.57, phi: 1.57, radius: 18 };
    } else if (preset === 'TOP') {
      orbitAngleRef.current = { theta: 0, phi: 0.05, radius: 20 };
    }
    updateCameraPosition();
  };

  // --------------------------------------------------------------------------
  // INITIALIZE THREE.JS SCENE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120); // Dark Engineering Viewport (slate-950)
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight2.position.set(-15, 10, -10);
    scene.add(dirLight2);

    // 5. Ground Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 6. Coordinate Compass / Axes Helper at origin
    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-spanW * 0.7, 0, pullL);
    scene.add(axesHelper);

    // ------------------------------------------------------------------------
    // BUILD 3D TUNNEL TUBE (HORSESHOE GEOMETRY)
    // ------------------------------------------------------------------------
    const tunnelGroup = new THREE.Group();
    const halfW = spanW / 2;
    const wallH = heightH * 0.55;
    const archRadius = halfW;

    // Build 2D cross section shape
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, 0);
    shape.lineTo(-halfW, wallH);
    // Upper horseshoe arch
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const angle = Math.PI - (i / steps) * Math.PI;
      const x = Math.cos(angle) * archRadius;
      const y = wallH + Math.sin(angle) * (heightH - wallH);
      shape.lineTo(x, y);
    }
    shape.lineTo(halfW, 0);
    shape.lineTo(-halfW, 0);

    // Extrude tunnel geometry along Z-axis (Pull Length)
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: pullL * 2,
      bevelEnabled: false,
    };
    const tunnelGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center geometry on Z
    tunnelGeo.translate(0, 0, -pullL);

    // Wireframe perimeter edges
    const edgesGeo = new THREE.EdgesGeometry(tunnelGeo, 25);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    tunnelGroup.add(edgesMesh);

    // Transparent tunnel wall surface
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const tunnelMesh = new THREE.Mesh(tunnelGeo, wallMat);
    tunnelGroup.add(tunnelMesh);
    scene.add(tunnelGroup);

    // ------------------------------------------------------------------------
    // BUILD 3D CRITICAL KEYBLOCK / WEDGE (TETRAHEDRAL MESH)
    // ------------------------------------------------------------------------
    const wedgeGeo = new THREE.BufferGeometry();
    const apexH = heightH;
    const wedgeBaseHalfW = halfW * 0.55;
    const wedgeBaseY = wallH + (heightH - wallH) * 0.5;

    // Vertices of the tetrahedral wedge (Apex at crown, base daylighting into tunnel)
    const vApex = new THREE.Vector3(0, apexH, 0);
    const vLeftFront = new THREE.Vector3(-wedgeBaseHalfW, wedgeBaseY, pullL * 0.6);
    const vRightFront = new THREE.Vector3(wedgeBaseHalfW, wedgeBaseY, pullL * 0.6);
    const vLeftBack = new THREE.Vector3(-wedgeBaseHalfW, wedgeBaseY, -pullL * 0.6);
    const vRightBack = new THREE.Vector3(wedgeBaseHalfW, wedgeBaseY, -pullL * 0.6);

    // Create 6 triangular faces for the 3D block
    const positions: number[] = [
      // Base Face 1 (Daylighting into crown)
      vLeftFront.x, vLeftFront.y, vLeftFront.z,
      vRightFront.x, vRightFront.y, vRightFront.z,
      vRightBack.x, vRightBack.y, vRightBack.z,
      // Base Face 2
      vLeftFront.x, vLeftFront.y, vLeftFront.z,
      vRightBack.x, vRightBack.y, vRightBack.z,
      vLeftBack.x, vLeftBack.y, vLeftBack.z,
      // Left Joint Plane (J1)
      vApex.x, vApex.y, vApex.z,
      vLeftBack.x, vLeftBack.y, vLeftBack.z,
      vLeftFront.x, vLeftFront.y, vLeftFront.z,
      // Right Joint Plane (J2)
      vApex.x, vApex.y, vApex.z,
      vRightFront.x, vRightFront.y, vRightFront.z,
      vRightBack.x, vRightBack.y, vRightBack.z,
      // Front Tunnel Face Joint
      vApex.x, vApex.y, vApex.z,
      vLeftFront.x, vLeftFront.y, vLeftFront.z,
      vRightFront.x, vRightFront.y, vRightFront.z,
      // Back Joint Plane
      vApex.x, vApex.y, vApex.z,
      vRightBack.x, vRightBack.y, vRightBack.z,
      vLeftBack.x, vLeftBack.y, vLeftBack.z,
    ];

    wedgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    wedgeGeo.computeVertexNormals();

    const wedgeColor = supportedFos >= 1.5 ? 0x10b981 : supportedFos >= 1.0 ? 0xf59e0b : 0xf43f5e;
    const wedgeMat = new THREE.MeshStandardMaterial({
      color: wedgeColor,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
    wedgeMeshRef.current = wedgeMesh;
    scene.add(wedgeMesh);

    // Wedge edges highlight
    const wedgeEdgesGeo = new THREE.EdgesGeometry(wedgeGeo);
    const wedgeEdgesMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const wedgeEdgesMesh = new THREE.LineSegments(wedgeEdgesGeo, wedgeEdgesMat);
    wedgeMesh.add(wedgeEdgesMesh);

    // Driving Force Vector Arrow (Downward Gravity + Sliding component)
    const arrowDir = new THREE.Vector3(0, -1, 0.35).normalize();
    const arrowOrigin = new THREE.Vector3(0, apexH * 0.82, 0);
    const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowOrigin, 2.8, 0xf43f5e, 0.6, 0.3);
    scene.add(arrowHelper);

    // ------------------------------------------------------------------------
    // 3D DYNAMIC ROCK BOLT ARRAY (GROUP)
    // ------------------------------------------------------------------------
    const boltsGroup = new THREE.Group();
    boltsGroupRef.current = boltsGroup;
    scene.add(boltsGroup);

    // ------------------------------------------------------------------------
    // SHOTCRETE SHELL (CURVED RIBBON MESH)
    // ------------------------------------------------------------------------
    const shotcreteGeo = new THREE.CylinderGeometry(
      archRadius + 0.05,
      archRadius + 0.05,
      pullL * 1.8,
      32,
      1,
      true,
      0,
      Math.PI
    );
    shotcreteGeo.rotateZ(Math.PI / 2);
    shotcreteGeo.translate(0, wallH, 0);
    const shotcreteMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: Math.min(0.7, shotcreteMm / 150),
      side: THREE.DoubleSide,
    });
    const shotcreteMesh = new THREE.Mesh(shotcreteGeo, shotcreteMat);
    shotcreteMeshRef.current = shotcreteMesh;
    scene.add(shotcreteMesh);

    // ------------------------------------------------------------------------
    // ANIMATION & RENDER LOOP
    // ------------------------------------------------------------------------
    let slideOffset = 0;
    const renderLoop = () => {
      // If sliding simulation is active, animate the wedge dropping along plunge vector
      if (wedgeMeshRef.current) {
        if (isSlidingSimActive && unboltedFos < 1.0) {
          slideOffset = (slideOffset + 0.015) % 1.5;
          wedgeMeshRef.current.position.y = -slideOffset * 1.2;
          wedgeMeshRef.current.position.z = slideOffset * 0.5;
        } else {
          // Keep firmly pinned by rock bolts
          wedgeMeshRef.current.position.set(0, 0, 0);
        }
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // ------------------------------------------------------------------------
    // RESIZE OBSERVER
    // ------------------------------------------------------------------------
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
  }, [spanW, heightH, pullL, supportedFos, unboltedFos, updateCameraPosition]);

  // --------------------------------------------------------------------------
  // RE-BUILD BOLTS & SHOTCRETE WHEN SLIDERS CHANGE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const boltsGroup = boltsGroupRef.current;
    if (!boltsGroup) return;

    // Clear existing bolts
    while (boltsGroup.children.length > 0) {
      const child = boltsGroup.children[0];
      boltsGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    const halfW = spanW / 2;
    const wallH = heightH * 0.55;
    const boltLength = 4.0; // 4.0m standard radial bolt

    // Calculate number of radial rows along crown arch based on spacing
    const numRadialBolts = Math.max(3, Math.min(9, Math.round(spanW / boltSpacingM)));
    const numPullRows = Math.max(2, Math.round(pullL / boltSpacingM));

    const boltGeo = new THREE.CylinderGeometry(0.04, 0.04, boltLength, 8);
    boltGeo.translate(0, boltLength / 2, 0); // Origin at bearing plate

    const plateGeo = new THREE.BoxGeometry(0.25, 0.04, 0.25);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let r = 0; r < numPullRows; r++) {
      const z = -pullL * 0.6 + r * boltSpacingM;
      for (let i = 0; i < numRadialBolts; i++) {
        // Angle along arch (from -60 deg to +60 deg from vertical)
        const angle = -Math.PI / 3 + (i / (numRadialBolts - 1)) * ((2 * Math.PI) / 3);
        const px = Math.sin(angle) * halfW;
        const py = wallH + Math.cos(angle) * (heightH - wallH);

        const singleBolt = new THREE.Group();
        singleBolt.position.set(px, py, z);

        // Orient bolt outward perpendicular to the arch
        singleBolt.rotation.z = -angle;

        const rodMesh = new THREE.Mesh(boltGeo, boltMat);
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        singleBolt.add(rodMesh);
        singleBolt.add(plateMesh);

        boltsGroup.add(singleBolt);
      }
    }

    // Update shotcrete thickness opacity
    if (shotcreteMeshRef.current) {
      const mat = shotcreteMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = shotcreteMm > 0 ? Math.min(0.7, 0.2 + shotcreteMm / 200) : 0;
      mat.visible = shotcreteMm > 0;
    }
  }, [spanW, heightH, pullL, boltSpacingM, boltCapacityKn, shotcreteMm]);

  // Update wireframe mode
  useEffect(() => {
    if (wedgeMeshRef.current) {
      const mat = wedgeMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.wireframe = wireframeMode;
    }
  }, [wireframeMode]);

  // --------------------------------------------------------------------------
  // POINTER & MOUSE DRAG LISTENERS FOR ORBITING
  // --------------------------------------------------------------------------
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
    } catch {
      // Ignored
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    orbitAngleRef.current.radius = Math.max(
      6,
      Math.min(40, orbitAngleRef.current.radius + e.deltaY * 0.02)
    );
    updateCameraPosition();
  };

  return (
    <div className="relative w-full h-[360px] sm:h-[440px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col select-none">
      {/* 3D CANVAS VIEWPORT CONTAINER */}
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
            <span
              className={`w-2 h-2 rounded-full ${
                supportedFos >= 1.5 ? 'bg-emerald-400' : 'bg-rose-400'
              } animate-pulse`}
            />
            <span>3D KINEMATIC WEDGE STABILITY CORE</span>
          </div>

          <span
            className={`px-2 py-1 rounded text-xs font-mono font-bold backdrop-blur-xs border ${
              supportedFos >= 1.5
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                : 'bg-rose-950/80 text-rose-300 border-rose-600/60'
            }`}
          >
            FoS: {supportedFos.toFixed(2)} ({supportedFos >= 1.5 ? 'PASS SAFE' : 'CRITICAL'})
          </span>
        </div>

        {/* VIEW PRESET BUTTONS */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur-xs pointer-events-auto">
          {(['ISO', 'FRONT', 'SIDE', 'TOP'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors cursor-pointer ${
                viewPreset === preset ? 'bg-sky-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM OVERLAY INFO & SIMULATION CONTROLS */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 backdrop-blur-xs pointer-events-auto">
          <span>Wedge: <strong>{wedgeVolume} m³ ({wedgeWeightKn} kN)</strong></span>
          <span className="text-slate-600">|</span>
          <span>Joint: <strong>{jointSetLabel} (Dip {trueDip}° ∠ {trueDipDir}°)</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-300">Bolts: <strong>@{boltSpacingM.toFixed(1)}m c/c</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-purple-300">SFRS: <strong>{shotcreteMm}mm</strong></span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 p-1 rounded-lg backdrop-blur-xs pointer-events-auto">
          {/* Wireframe toggle */}
          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              wireframeMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Wireframe Mesh"
          >
            <Box className="w-4 h-4" />
          </button>

          {/* Sliding Simulation Toggle */}
          <button
            onClick={() => setIsSlidingSimActive(!isSlidingSimActive)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer ${
              isSlidingSimActive
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Simulate Gravitational Keyblock Release"
          >
            {isSlidingSimActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSlidingSimActive ? 'Simulating Release' : 'Simulate Release'}</span>
          </button>

          {/* Reset Camera */}
          <button
            onClick={() => setCameraPreset('ISO')}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
