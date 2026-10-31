import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TunnelGeometry } from '../types/tunnel';
import { generateExactTunnelProfilePoints } from '../engine/advancedModelingAndAlignmentEngine';

export interface FutureAdvance3DViewportProps {
  geometry?: TunnelGeometry;
  spanW: number;
  heightH: number;
  benchHeight?: number;
  wallHeight?: number;
  pullLengthM?: number;
  pullLength?: number;
  currentChainage?: number;
  currentFaceChainage?: number;
  advanceDeltaM?: number;
  governingStrike: number;
  governingDip: number;
  governingDipDirection?: number;
  governingSet?: string;
  governingType?: string;
  driveAzimuth: number;
  apparentDipBetaApp?: number;
  apparentDipDeg?: number;
  advanceRatePerVerticalMeter?: number;
  projectedCenterY?: number;
  traceInsideFace?: boolean;
}

export const FutureAdvance3DViewport: React.FC<FutureAdvance3DViewportProps> = ({
  geometry,
  spanW: rawSpanW,
  heightH: rawHeightH,
  benchHeight: rawBenchHeight,
  wallHeight: rawWallHeight,
  pullLengthM: rawPullLengthM,
  pullLength: rawPullLength,
  currentChainage: rawCurrentChainage,
  currentFaceChainage: rawCurrentFaceChainage,
  advanceDeltaM: rawAdvanceDeltaM,
  governingStrike: rawGovStrike,
  governingDip: rawGovDip,
  governingSet: rawGovSet,
  driveAzimuth: rawDriveAzimuth,
  apparentDipBetaApp: rawApparentDipBetaApp,
  apparentDipDeg: rawApparentDipDeg,
  projectedCenterY: rawProjectedCenterY,
  traceInsideFace: rawTraceInsideFace,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [probeDistanceAhead, setProbeDistanceAhead] = React.useState<number>(
    Number.isFinite(rawAdvanceDeltaM) ? (rawAdvanceDeltaM as number) : 9.0
  );

  const spanW = Number.isFinite(rawSpanW) && rawSpanW > 0 ? rawSpanW : 8.4;
  const heightH = Number.isFinite(rawHeightH) && rawHeightH > 0 ? rawHeightH : 7.2;
  const benchHeight =
    Number.isFinite(rawBenchHeight) && (rawBenchHeight as number) > 0
      ? (rawBenchHeight as number)
      : Number.isFinite(rawWallHeight) && (rawWallHeight as number) > 0
      ? (rawWallHeight as number)
      : heightH * 0.52;
  const pullLengthM =
    Number.isFinite(rawPullLengthM) && (rawPullLengthM as number) > 0
      ? (rawPullLengthM as number)
      : Number.isFinite(rawPullLength) && (rawPullLength as number) > 0
      ? (rawPullLength as number)
      : 3.5;
  const currentChainage =
    Number.isFinite(rawCurrentChainage)
      ? (rawCurrentChainage as number)
      : Number.isFinite(rawCurrentFaceChainage)
      ? (rawCurrentFaceChainage as number)
      : 100.0;
  const advanceDeltaM = Number.isFinite(rawAdvanceDeltaM) ? (rawAdvanceDeltaM as number) : probeDistanceAhead;
  const governingStrike = Number.isFinite(rawGovStrike) ? rawGovStrike : 125;
  const governingDip = Number.isFinite(rawGovDip) ? rawGovDip : 60;
  const governingSet = rawGovSet || 'J1';
  const driveAzimuth = Number.isFinite(rawDriveAzimuth) ? rawDriveAzimuth : 45;
  const apparentDipBetaApp =
    Number.isFinite(rawApparentDipBetaApp)
      ? (rawApparentDipBetaApp as number)
      : Number.isFinite(rawApparentDipDeg)
      ? (rawApparentDipDeg as number)
      : 35.0;

  const tanApp = Math.tan((apparentDipBetaApp * Math.PI) / 180);
  const computedCenterY = Math.max(
    0.2,
    heightH - ((advanceDeltaM * Math.max(0.05, tanApp)) % (heightH * 1.15))
  );
  const projectedCenterY =
    Number.isFinite(rawProjectedCenterY) ? (rawProjectedCenterY as number) : computedCenterY;
  const traceInsideFace =
    typeof rawTraceInsideFace === 'boolean'
      ? rawTraceInsideFace
      : projectedCenterY >= 0.15 && projectedCenterY <= heightH - 0.15;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const getDims = () => ({
      width: Math.max(320, container.clientWidth || 560),
      height: Math.max(280, container.clientHeight || 380),
    });

    const { width, height } = getDims();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(spanW * 2.1, heightH * 1.55, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, heightH * 0.45, -advanceDeltaM * 0.5);

    // Neutral Geotechnical CAD Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.65);
    dir1.position.set(22, 36, 20);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xf8fafc, 0.4);
    dir2.position.set(-22, 18, -30);
    scene.add(dir2);

    // Floor Grid along Tunnel Drive Axis (Z = +10m excavated to Z = -32m ahead)
    const grid = new THREE.GridHelper(56, 28, 0x94a3b8, 0xe2e8f0);
    grid.position.set(0, -0.02, -10);
    scene.add(grid);

    const profilePts = generateExactTunnelProfilePoints(geometry, spanW, heightH, benchHeight);
    const shape = new THREE.Shape();
    if (profilePts.length >= 3) {
      shape.moveTo(profilePts[0].x, profilePts[0].y);
      for (let i = 1; i < profilePts.length; i++) {
        shape.lineTo(profilePts[i].x, profilePts[i].y);
      }
      shape.closePath();
    }

    // 1. Excavated Tunnel Section (Z = 0m back to Z = +10m)
    const excavatedLen = 10;
    const excGeo = new THREE.ExtrudeGeometry(shape, {
      depth: excavatedLen,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });
    const excMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.65,
      metalness: 0.05,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(excGeo, excMat));
    scene.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(excGeo, 15),
        new THREE.LineBasicMaterial({ color: 0x334155 })
      )
    );

    // 2. Unexcavated Ahead Forecast Corridor (Z = 0m forward to Z = -30m)
    const aheadLen = 30;
    const aheadGeo = new THREE.ExtrudeGeometry(shape, {
      depth: aheadLen,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });
    aheadGeo.translate(0, 0, -aheadLen);

    const aheadMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.7,
      metalness: 0.05,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(aheadGeo, aheadMat));
    scene.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(aheadGeo, 15),
        new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.45 })
      )
    );

    // Station Rings along Ahead Corridor every pullLengthM
    const stepM = Math.max(1.5, pullLengthM);
    for (let d = 0; d <= aheadLen; d += stepM) {
      const z = -d;
      const ringPts = profilePts.map((p) => new THREE.Vector3(p.x, p.y, z));
      if (ringPts.length > 0) ringPts.push(ringPts[0].clone());
      const isCurrentFace = d === 0;
      const ringMat = new THREE.LineBasicMaterial({
        color: isCurrentFace ? 0x0f172a : 0x94a3b8,
        transparent: !isCurrentFace,
        opacity: isCurrentFace ? 1.0 : 0.5,
      });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat));
    }

    // 3. Interactive Probe Advance Face Plane at Z = -advanceDeltaM
    const zProbe = -advanceDeltaM;
    const probeFaceGeo = new THREE.ShapeGeometry(shape, 24);
    probeFaceGeo.translate(0, 0, zProbe);

    const probeMat = new THREE.MeshBasicMaterial({
      color: traceInsideFace ? 0xd97706 : 0x0284c7,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    scene.add(new THREE.Mesh(probeFaceGeo, probeMat));

    const probeOutlinePts = profilePts.map((p) => new THREE.Vector3(p.x, p.y, zProbe));
    if (probeOutlinePts.length > 0) probeOutlinePts.push(probeOutlinePts[0].clone());
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(probeOutlinePts),
        new THREE.LineBasicMaterial({ color: traceInsideFace ? 0xb45309 : 0x0369a1 })
      )
    );

    // 4. 3D Projected Structural Plane & Exact Intersection Trace on Probe Face
    if (governingSet !== 'Unmapped' && governingDip > 0) {
      const clipPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), spanW * 0.65),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), spanW * 0.65),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), heightH * 1.15),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), excavatedLen),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), aheadLen),
      ];

      const planeGeo = new THREE.PlaneGeometry(36, 36, 16, 16);
      const relStrikeRad = (((governingStrike - driveAzimuth) * Math.PI) / 180);
      const dipRad = (governingDip * Math.PI) / 180;

      planeGeo.rotateY(-relStrikeRad);
      planeGeo.rotateX(dipRad);
      planeGeo.translate(0, projectedCenterY, zProbe);

      const planeMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.45,
        metalness: 0.05,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        clippingPlanes: clipPlanes,
      });
      scene.add(new THREE.Mesh(planeGeo, planeMat));

      // Intersection trace across the probe face at Z = zProbe
      if (traceInsideFace) {
        const slopeTan = Math.tan((apparentDipBetaApp * Math.PI) / 180) * 0.35;
        const halfSpan = spanW * 0.46;
        const yLeft = Math.max(0.1, Math.min(heightH - 0.1, projectedCenterY - halfSpan * slopeTan));
        const yRight = Math.max(0.1, Math.min(heightH - 0.1, projectedCenterY + halfSpan * slopeTan));

        const pStart = new THREE.Vector3(-halfSpan, yLeft, zProbe + 0.04);
        const pEnd = new THREE.Vector3(halfSpan, yRight, zProbe + 0.04);
        const curve = new THREE.LineCurve3(pStart, pEnd);
        const tubeGeo = new THREE.TubeGeometry(curve, 12, Math.max(0.07, spanW * 0.01), 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        scene.add(new THREE.Mesh(tubeGeo, tubeMat));
      }
    }

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const d = getDims();
      camera.aspect = d.width / d.height;
      camera.updateProjectionMatrix();
      renderer.setSize(d.width, d.height);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [
    geometry,
    spanW,
    heightH,
    benchHeight,
    pullLengthM,
    currentChainage,
    advanceDeltaM,
    governingStrike,
    governingDip,
    governingSet,
    driveAzimuth,
    apparentDipBetaApp,
    projectedCenterY,
    traceInsideFace,
  ]);

  const shapeLabel = (geometry?.crownGeometry || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-300 bg-white">
      <div ref={mountRef} className="w-full h-full min-h-[340px]" />

      {/* Top-Left CAD Telemetry Badge */}
      <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-xs rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-800 pointer-events-none space-y-0.5">
        <div className="text-slate-900 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
          3D AHEAD FORECAST CORRIDOR (+{advanceDeltaM.toFixed(1)}m)
        </div>
        <div className="text-slate-600">
          Shape: <strong className="text-slate-900">{shapeLabel}</strong> ({spanW.toFixed(2)}m × {heightH.toFixed(2)}m) | Probe Station: <strong className="text-slate-900">RD {(currentChainage + advanceDeltaM).toFixed(1)}m</strong>
        </div>
        <div className="text-slate-700">
          Apparent Dip β<sub>app</sub>: <strong>{apparentDipBetaApp.toFixed(1)}°</strong> | Center Elev Y: <strong>{projectedCenterY.toFixed(2)}m</strong>
        </div>
        <div className={traceInsideFace ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
          {traceInsideFace
            ? `ACTIVE FACE INTERSECTION AT +${advanceDeltaM.toFixed(1)}m`
            : 'PLANE EXITED TUNNEL BOUNDARY'}
        </div>
      </div>

      {/* Bottom-Left Probe Distance Slider */}
      <div className="absolute bottom-2 left-2.5 bg-white/95 border border-slate-300 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-800 shadow-xs flex items-center gap-2">
        <span className="font-bold text-slate-700">Probe +ΔZ:</span>
        <input
          type="range"
          min={0}
          max={30}
          step={0.5}
          value={advanceDeltaM}
          onChange={(e) => setProbeDistanceAhead(Number(e.target.value))}
          className="w-28 accent-sky-600 cursor-pointer"
        />
        <span className="font-bold text-sky-700 tabular-nums">+{advanceDeltaM.toFixed(1)}m</span>
      </div>

      {/* Bottom-Right CAD Controls Legend */}
      <div className="absolute bottom-2 right-2 bg-white/95 border border-slate-300 rounded px-2 py-1 text-[9px] font-mono text-slate-600 pointer-events-none shadow-2xs">
        CAD Orbit: Left-Drag | Zoom: Scroll | Pan: Right-Drag
      </div>
    </div>
  );
};
