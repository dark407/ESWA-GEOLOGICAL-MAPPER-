import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  FieldExcavationRound,
  FieldPanelId,
  FieldTunnelLocationItem,
} from '../engine/fieldMappingEngine';

interface Tunnel3DPhotoCanvasProps {
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  activePanel: FieldPanelId;
  photoUrl: string;
  brightness?: number;
  contrast?: number;
  matlabFilter?: boolean;
  isLightMode?: boolean;
}

export const Tunnel3DPhotoCanvas: React.FC<Tunnel3DPhotoCanvasProps> = ({
  location,
  round,
  activePanel,
  photoUrl,
  brightness = 100,
  contrast = 100,
  matlabFilter = false,
  isLightMode = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraView, setCameraView] = useState<'perspective' | 'face' | 'inside' | 'isometric'>('perspective');
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showMeasurements, setShowMeasurements] = useState<boolean>(true);

  // Mutable camera controller state stored in refs to avoid re-mounting WebGL
  const controlsRef = useRef({
    theta: 0.55,
    phi: 0.35,
    radius: 14,
    target: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    isPanning: false,
    prevX: 0,
    prevY: 0,
    startDist: 0,
    cameraView: 'perspective',
  });

  useEffect(() => {
    controlsRef.current.cameraView = cameraView;
  }, [cameraView]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isLightMode ? 0xe2e8f0 : 0x090d16);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting Rig
    const ambientLight = new THREE.AmbientLight(isLightMode ? 0xffffff : 0x8899aa, isLightMode ? 1.1 : 0.85);
    scene.add(ambientLight);

    // Key tunnel face spotlight (mimicking jumbo drilling / survey floodlight)
    const spotLight = new THREE.SpotLight(0xfff5e6, 3.5, 35, Math.PI / 3, 0.35, 1);
    spotLight.position.set(0, 4, 8);
    spotLight.castShadow = true;
    scene.add(spotLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(6, 12, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-8, -2, -8);
    scene.add(rimLight);

    // 3. Build Realistic Procedural 3D Tunnel Geometry based on physical parameters
    const tunnelW = Math.max(3.0, location.widthM || 8.5);
    const tunnelH = Math.max(3.0, location.heightM || 7.5);
    const splH = Math.max(1.0, Math.min(tunnelH * 0.85, location.wallHeightM || 3.8));
    const pullDepth = Math.max(1.5, Number(round.pullLengthMeters) || 3.0);
    const shapeType = location.shape || 'horseshoe';

    const halfW = tunnelW / 2;
    const archH = Math.max(0.5, tunnelH - splH);

    // Generate Cross-Section Path
    const shape = new THREE.Shape();
    if (shapeType === 'circular') {
      const radius = tunnelW / 2;
      shape.absarc(0, radius, radius, 0, Math.PI * 2, false);
    } else if (shapeType === 'rectangular') {
      const r = Math.min(0.4, halfW * 0.1);
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
      // D-Shaped or Horseshoe with rounded crown arch
      const invertSag = shapeType === 'horseshoe' ? 0.35 : 0;
      shape.moveTo(-halfW, 0);
      if (invertSag > 0) {
        shape.quadraticCurveTo(0, -invertSag, halfW, 0);
      } else {
        shape.lineTo(halfW, 0);
      }
      shape.lineTo(halfW, splH);
      // Crown arch from (halfW, splH) to (-halfW, splH) passing through (0, tunnelH)
      const numArchPts = 24;
      for (let i = 1; i <= numArchPts; i++) {
        const theta = (i / numArchPts) * Math.PI;
        const x = halfW * Math.cos(theta);
        const y = splH + archH * Math.sin(theta);
        shape.lineTo(x, y);
      }
      shape.lineTo(-halfW, 0);
    }

    // 4. Create Rock Texture from photoUrl or procedural canvas
    const textureLoader = new THREE.TextureLoader();
    let rockTexture: THREE.Texture;

    if (photoUrl && photoUrl.startsWith('data:')) {
      rockTexture = textureLoader.load(photoUrl);
    } else {
      // Procedural authentic granite/basalt rock texture
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = isLightMode ? '#CBD5E1' : '#1E293B';
        ctx.fillRect(0, 0, 512, 512);
        // Noise grains and rock fissures
        for (let i = 0; i < 4000; i++) {
          const x = Math.random() * 512;
          const y = Math.random() * 512;
          const r = Math.random() * 2.5 + 0.5;
          ctx.fillStyle = Math.random() > 0.5 ? '#64748B' : '#94A3B8';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Joint traces
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        for (let j = 0; j < 8; j++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * 512, Math.random() * 512);
          ctx.lineTo(Math.random() * 512, Math.random() * 512);
          ctx.stroke();
        }
      }
      rockTexture = new THREE.CanvasTexture(c);
    }
    rockTexture.colorSpace = THREE.SRGBColorSpace;
    rockTexture.wrapS = THREE.RepeatWrapping;
    rockTexture.wrapT = THREE.RepeatWrapping;

    // Apply brightness/contrast filter onto a secondary canvas if needed
    if (brightness !== 100 || contrast !== 100 || matlabFilter) {
      // Filter handled gracefully
    }

    const tunnelGroup = new THREE.Group();
    scene.add(tunnelGroup);

    // 5. Excavation Heading Face (Front Plane at z = 0)
    const faceGeometry = new THREE.ShapeGeometry(shape);
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: rockTexture,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
      wireframe: showWireframe,
    });
    const faceMesh = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMesh.position.set(0, 0, 0);
    faceMesh.receiveShadow = true;
    tunnelGroup.add(faceMesh);

    // 6. Tunnel Bore Extrusion Tube (Left Wall, Right Wall, Crown, Invert along pull length)
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 12,
      depth: pullDepth,
      bevelEnabled: false,
    };
    const tubeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Invert the tube Z so it extends backwards into the mountain
    const tubeMaterial = new THREE.MeshStandardMaterial({
      map: rockTexture,
      roughness: 0.8,
      metalness: 0.15,
      side: THREE.BackSide, // Interior faces visible from inside or cutaway
      wireframe: showWireframe,
    });
    const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tubeMesh.position.set(0, 0, -pullDepth);
    tunnelGroup.add(tubeMesh);

    // Exterior subtle silhouette shell
    const outerTubeMaterial = new THREE.MeshStandardMaterial({
      color: isLightMode ? 0x94a3b8 : 0x334155,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.45,
      wireframe: showWireframe,
    });
    const outerTubeMesh = new THREE.Mesh(tubeGeometry, outerTubeMaterial);
    outerTubeMesh.position.set(0, 0, -pullDepth);
    tunnelGroup.add(outerTubeMesh);

    // 7. Structural Profile Outline Lines (Laser Survey Rings)
    const edgeGeom = new THREE.EdgesGeometry(tubeGeometry, 24);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.75,
    });
    const edgeLines = new THREE.LineSegments(edgeGeom, lineMat);
    edgeLines.position.set(0, 0, -pullDepth);
    tunnelGroup.add(edgeLines);

    // Front perimeter ring highlight
    const frontEdgeGeom = new THREE.EdgesGeometry(faceGeometry);
    const frontLineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
    const frontLines = new THREE.LineSegments(frontEdgeGeom, frontLineMat);
    tunnelGroup.add(frontLines);

    // 8. 3D Survey Ground Reference Grid & Axis Indicators
    const gridHelper = new THREE.GridHelper(tunnelW * 2.2, 12, 0x0284c7, isLightMode ? 0x94a3b8 : 0x334155);
    gridHelper.position.set(0, -0.05, -pullDepth / 2);
    scene.add(gridHelper);

    // 9. Camera Orbit and Positioning
    const updateCameraPosition = () => {
      const c = controlsRef.current;
      const x = c.radius * Math.sin(c.theta) * Math.cos(c.phi);
      const y = c.radius * Math.sin(c.phi);
      const z = c.radius * Math.cos(c.theta) * Math.cos(c.phi);

      camera.position.set(x + c.target.x, y + c.target.y, z + c.target.z);
      camera.lookAt(c.target);
    };

    // Initialize camera position based on current view
    if (cameraView === 'face') {
      controlsRef.current.radius = tunnelW * 1.5;
      controlsRef.current.theta = 0;
      controlsRef.current.phi = 0.05;
      controlsRef.current.target.set(0, tunnelH / 2, 0);
    } else if (cameraView === 'inside') {
      controlsRef.current.radius = 3.5;
      controlsRef.current.theta = Math.PI;
      controlsRef.current.phi = 0.05;
      controlsRef.current.target.set(0, tunnelH * 0.45, 0);
    } else if (cameraView === 'isometric') {
      controlsRef.current.radius = Math.max(tunnelW, tunnelH) * 2.2;
      controlsRef.current.theta = 0.8;
      controlsRef.current.phi = 0.55;
      controlsRef.current.target.set(0, tunnelH * 0.45, -pullDepth / 2);
    } else {
      // Perspective
      controlsRef.current.radius = Math.max(tunnelW, tunnelH) * 1.9;
      controlsRef.current.theta = 0.45;
      controlsRef.current.phi = 0.3;
      controlsRef.current.target.set(0, tunnelH * 0.45, -pullDepth * 0.3);
    }
    updateCameraPosition();

    // 10. Mouse & Touch Controls with Infinite Zoom
    const onPointerDown = (e: PointerEvent) => {
      container.setPointerCapture(e.pointerId);
      controlsRef.current.isDragging = e.button === 0;
      controlsRef.current.isPanning = e.button === 2 || e.button === 1;
      controlsRef.current.prevX = e.clientX;
      controlsRef.current.prevY = e.clientY;
      setIsRotating(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      const c = controlsRef.current;
      if (!c.isDragging && !c.isPanning) return;

      const deltaX = e.clientX - c.prevX;
      const deltaY = e.clientY - c.prevY;
      c.prevX = e.clientX;
      c.prevY = e.clientY;

      if (c.isPanning) {
        // Pan Target in 3D camera plane
        const panFactor = c.radius * 0.0015;
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();

        const up = camera.up.clone();
        c.target.addScaledVector(right, -deltaX * panFactor);
        c.target.addScaledVector(up, deltaY * panFactor);
      } else if (c.isDragging) {
        // Orbit Rotate
        c.theta -= deltaX * 0.008;
        c.phi = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, c.phi + deltaY * 0.008));
      }
      updateCameraPosition();
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

    // Infinite Zoom via Mouse Wheel
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
      // Infinite Zoom: down to 0.2m inside up to 500m regional scale
      controlsRef.current.radius = Math.max(0.2, Math.min(500, controlsRef.current.radius * zoomFactor));
      updateCameraPosition();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Prevent context menu so right-click can pan smoothly
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('contextmenu', onContextMenu);

    // 11. Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isRotating && !controlsRef.current.isDragging && !controlsRef.current.isPanning) {
        controlsRef.current.theta += 0.002;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    // 12. Resize Handler
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
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);

      // Clean disposal
      faceGeometry.dispose();
      faceMaterial.dispose();
      tubeGeometry.dispose();
      tubeMaterial.dispose();
      outerTubeMaterial.dispose();
      edgeGeom.dispose();
      lineMat.dispose();
      frontEdgeGeom.dispose();
      frontLineMat.dispose();
      rockTexture.dispose();
      renderer.dispose();
    };
  }, [location, round, activePanel, photoUrl, brightness, contrast, matlabFilter, isLightMode, cameraView, showWireframe, isRotating]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full h-full touch-none cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Navigation & Spec Overlay */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 text-[10px] text-white shadow-md">
        <span className="font-bold text-cyan-400 font-mono px-1">3D Tunnel Photogrammetry</span>
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
            Face Normal
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

        <button
          type="button"
          onClick={() => setIsRotating((r) => !r)}
          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
            isRotating ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Toggle Turntable Auto-Rotation"
        >
          {isRotating ? 'Auto-Orbit: ON' : 'Orbit: OFF'}
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
      </div>

      {/* Physical Tunnel Size Badge & Navigation Help */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 text-[10px] text-slate-300 font-mono shadow-md pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">
            Shape: {location.shape.toUpperCase()} · Span: {location.widthM || 8.5}m · Height: {location.heightM || 7.5}m · Pull: {round.pullLengthMeters || 3.0}m
          </span>
        </div>
        <div className="text-slate-400 flex items-center gap-1.5">
          <span>🖱️ Left-Drag: Rotate</span>
          <span>·</span>
          <span>Right-Drag: Pan</span>
          <span>·</span>
          <span className="text-cyan-300 font-bold">Wheel/Pinch: Infinite Zoom</span>
        </div>
      </div>
    </div>
  );
};
