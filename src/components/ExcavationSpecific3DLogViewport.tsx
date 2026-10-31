import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ExcavationStageType,
  computeStageElevationBounds,
  unwrappedToSkin3D,
  generateExactTunnelProfilePoints,
  clipProfilePolygonToYBand,
} from '../engine/advancedModelingAndAlignmentEngine';
import { TunnelGeometry } from '../types/tunnel';

export interface ExcavationSpecific3DLogViewportProps {
  geometry?: TunnelGeometry;
  spanW: number;
  heightH: number;
  benchHeight?: number;
  crownRadius?: number;
  pullLengthM?: number;
  pullLength?: number;
  chainageStart?: number;
  activeStage: ExcavationStageType;
  governingStrike?: number;
  governingDip?: number;
  governingSet?: string;
  driveAzimuth: number;
  mappedTraces?: {
    id?: string;
    set?: string;
    type?: string;
    strike?: number;
    dip: number;
    dipDirection: number;
  }[];
  onStageSelect?: (stage: ExcavationStageType) => void;
}

export const ExcavationSpecific3DLogViewport: React.FC<ExcavationSpecific3DLogViewportProps> = ({
  geometry,
  spanW: rawSpanW,
  heightH: rawHeightH,
  benchHeight: rawBenchHeight,
  pullLengthM: rawPullLengthM,
  pullLength: rawPullLength,
  chainageStart: rawChainageStart,
  activeStage,
  governingStrike: rawGovStrike,
  governingDip: rawGovDip,
  governingSet: rawGovSet,
  driveAzimuth: rawDriveAzimuth,
  mappedTraces = [],
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const spanW = Number.isFinite(rawSpanW) && rawSpanW > 0 ? rawSpanW : 8.4;
  const heightH = Number.isFinite(rawHeightH) && rawHeightH > 0 ? rawHeightH : 7.2;
  const benchHeight =
    Number.isFinite(rawBenchHeight) && (rawBenchHeight as number) > 0
      ? (rawBenchHeight as number)
      : heightH * 0.5;
  const pullLengthM =
    Number.isFinite(rawPullLengthM) && (rawPullLengthM as number) > 0
      ? (rawPullLengthM as number)
      : Number.isFinite(rawPullLength) && (rawPullLength as number) > 0
      ? (rawPullLength as number)
      : 3.5;
  const chainageStart = Number.isFinite(rawChainageStart) ? (rawChainageStart as number) : 100;
  const driveAzimuth = Number.isFinite(rawDriveAzimuth) ? rawDriveAzimuth : 45;

  const firstTrace = mappedTraces[0];
  const governingDip =
    Number.isFinite(rawGovDip)
      ? (rawGovDip as number)
      : firstTrace
      ? firstTrace.dip
      : 55;
  const governingStrike =
    Number.isFinite(rawGovStrike)
      ? (rawGovStrike as number)
      : firstTrace
      ? firstTrace.strike ?? ((firstTrace.dipDirection - 90 + 360) % 360)
      : 125;
  const governingSet =
    rawGovSet || (firstTrace ? firstTrace.set || 'J1' : 'J1');

  const fullProfilePts = generateExactTunnelProfilePoints(geometry, spanW, heightH, benchHeight);
  const bounds = computeStageElevationBounds(
    activeStage,
    spanW,
    heightH,
    benchHeight,
    chainageStart,
    chainageStart + pullLengthM,
    geometry
  );

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
    const maxDim = Math.max(spanW, heightH, pullLengthM);
    camera.position.set(maxDim * 1.45, maxDim * 0.95, maxDim * 1.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, heightH * 0.45, 0);

    // Neutral Engineering CAD Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.65);
    keyLight.position.set(20, 35, 25);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf8fafc, 0.4);
    fillLight.position.set(-20, 15, -20);
    scene.add(fillLight);

    // Technical Floor Datum Grid on White Canvas
    const gridSpan = Math.ceil(Math.max(spanW * 2.4, pullLengthM * 2.6, 16) / 2) * 2;
    const grid = new THREE.GridHelper(gridSpan, gridSpan, 0x94a3b8, 0xe2e8f0);
    grid.position.y = -0.02;
    scene.add(grid);

    // Coordinate Axes Reference at Left Invert
    const axesOrigin = new THREE.Vector3(-spanW * 0.65, 0, pullLengthM / 2);
    const arrowLen = Math.max(1.2, maxDim * 0.16);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), axesOrigin, arrowLen, 0xdc2626, 0.28, 0.16));
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), axesOrigin, arrowLen, 0x16a34a, 0.28, 0.16));
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), axesOrigin, arrowLen, 0x2563eb, 0.28, 0.16));

    // 1. Full Tunnel Reference Ghost Wireframe (Start & End Station Rings + Longitudinal Stringers)
    const ghostGroup = new THREE.Group();
    const zFront = pullLengthM / 2;
    const zBack = -pullLengthM / 2;

    const ringPtsFront = fullProfilePts.map((p) => new THREE.Vector3(p.x, p.y, zFront));
    if (ringPtsFront.length > 0) ringPtsFront.push(ringPtsFront[0].clone());
    const ringPtsBack = fullProfilePts.map((p) => new THREE.Vector3(p.x, p.y, zBack));
    if (ringPtsBack.length > 0) ringPtsBack.push(ringPtsBack[0].clone());

    const ghostMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
    ghostGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPtsFront), ghostMat));
    ghostGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPtsBack), ghostMat));

    // Intermediate station rings every 1.0m
    const ringStep = Math.max(0.5, pullLengthM / Math.max(2, Math.round(pullLengthM)));
    for (let z = zBack + ringStep; z < zFront - 0.05; z += ringStep) {
      const midRing = fullProfilePts.map((p) => new THREE.Vector3(p.x, p.y, z));
      if (midRing.length > 0) midRing.push(midRing[0].clone());
      const midMat = new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5 });
      ghostGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(midRing), midMat));
    }

    // Longitudinal CAD stringers around perimeter
    const stride = Math.max(1, Math.floor(fullProfilePts.length / 12));
    for (let i = 0; i < fullProfilePts.length; i += stride) {
      const p = fullProfilePts[i];
      const stringerGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.x, p.y, zFront),
        new THREE.Vector3(p.x, p.y, zBack),
      ]);
      ghostGroup.add(new THREE.Line(stringerGeo, ghostMat));
    }
    scene.add(ghostGroup);

    // 2. Active Stage Exact Clipped 3D Solid & Crisp CAD Wireframe
    const stagePolyPts = clipProfilePolygonToYBand(fullProfilePts, bounds.yMin, bounds.yMax);
    if (stagePolyPts.length >= 3) {
      const shape = new THREE.Shape();
      shape.moveTo(stagePolyPts[0].x, stagePolyPts[0].y);
      for (let i = 1; i < stagePolyPts.length; i++) {
        shape.lineTo(stagePolyPts[i].x, stagePolyPts[i].y);
      }
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: pullLengthM,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
      });
      extrudeGeo.translate(0, 0, -pullLengthM / 2);

      const stageColorMap: Record<ExcavationStageType, number> = {
        FULL_FACE: 0x0284c7,
        TOP_HEADING: 0xd97706,
        BENCH: 0x059669,
        INVERT: 0x4f46e5,
      };
      const stageAccent = stageColorMap[activeStage] || 0x0284c7;

      const stageMat = new THREE.MeshStandardMaterial({
        color: stageAccent,
        roughness: 0.55,
        metalness: 0.05,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const stageMesh = new THREE.Mesh(extrudeGeo, stageMat);
      scene.add(stageMesh);

      // Bold CAD Edges for the Active Stage Prism
      const edgesGeo = new THREE.EdgesGeometry(extrudeGeo, 12);
      const edgesLine = new THREE.LineSegments(
        edgesGeo,
        new THREE.LineBasicMaterial({ color: 0x0f172a })
      );
      scene.add(edgesLine);

      // Front & Back Stage Face Outlines
      const frontStagePts = stagePolyPts.map((p) => new THREE.Vector3(p.x, p.y, zFront));
      frontStagePts.push(frontStagePts[0].clone());
      const backStagePts = stagePolyPts.map((p) => new THREE.Vector3(p.x, p.y, zBack));
      backStagePts.push(backStagePts[0].clone());

      const stageOutlineMat = new THREE.LineBasicMaterial({ color: stageAccent });
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(frontStagePts), stageOutlineMat));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(backStagePts), stageOutlineMat));
    }

    // 3. Bench / Top-Heading Cut Plane (Horizontal Datum)
    const clampedBenchH = Math.min(Math.max(0.8, benchHeight), heightH - 0.8);
    if (activeStage === 'TOP_HEADING' || activeStage === 'BENCH') {
      const benchPlaneGeo = new THREE.PlaneGeometry(spanW * 1.06, pullLengthM * 1.04);
      benchPlaneGeo.rotateX(-Math.PI / 2);
      benchPlaneGeo.translate(0, clampedBenchH, 0);

      const benchPlaneMat = new THREE.MeshBasicMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(benchPlaneGeo, benchPlaneMat));

      const benchEdge = new THREE.EdgesGeometry(benchPlaneGeo);
      scene.add(
        new THREE.LineSegments(benchEdge, new THREE.LineBasicMaterial({ color: 0xb45309 }))
      );
    }

    // 4. Governing Structural Discontinuity Plane & 3D Skin Trace
    if (governingSet !== 'Unmapped' && governingDip > 0) {
      const clipPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), spanW * 0.52),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), spanW * 0.52),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.yMin),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.yMax),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), pullLengthM * 0.52),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), pullLengthM * 0.52),
      ];

      const planeSpan = Math.max(spanW, heightH, pullLengthM) * 1.6;
      const jointGeo = new THREE.PlaneGeometry(planeSpan, planeSpan, 12, 12);
      const relStrikeRad = (((governingStrike - driveAzimuth) * Math.PI) / 180);
      const dipRad = (governingDip * Math.PI) / 180;

      jointGeo.rotateY(-relStrikeRad);
      jointGeo.rotateX(dipRad);
      jointGeo.translate(0, (bounds.yMin + bounds.yMax) * 0.5, 0);

      const jointMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.4,
        metalness: 0.05,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        clippingPlanes: clipPlanes,
      });
      scene.add(new THREE.Mesh(jointGeo, jointMat));

      // 3D Skin Trace projected via unwrappedToSkin3D
      const skinTracePts: THREE.Vector3[] = [];
      const halfPerim = (Math.PI * (spanW / 2)) / 2 + Math.max(0.5, heightH - spanW / 2);
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const s = -halfPerim * 0.85 + u * (halfPerim * 1.7);
        const zOffset =
          Math.sin(u * Math.PI * 1.4 + relStrikeRad) *
          (pullLengthM * 0.38) *
          Math.cos(dipRad * 0.5);
        const pt3d = unwrappedToSkin3D(s, zOffset, spanW, heightH, geometry);
        if (pt3d.y >= bounds.yMin - 0.05 && pt3d.y <= bounds.yMax + 0.05) {
          skinTracePts.push(new THREE.Vector3(pt3d.x, pt3d.y, pt3d.z));
        }
      }

      if (skinTracePts.length >= 2) {
        const traceCurve = new THREE.CatmullRomCurve3(skinTracePts);
        const tubeGeo = new THREE.TubeGeometry(traceCurve, 40, Math.max(0.05, spanW * 0.009), 8, false);
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
    chainageStart,
    activeStage,
    governingStrike,
    governingDip,
    governingSet,
    driveAzimuth,
    bounds.yMin,
    bounds.yMax,
  ]);

  const shapeLabel = (geometry?.crownGeometry || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-300 bg-white">
      <div ref={mountRef} className="w-full h-full min-h-[340px]" />

      {/* Top-Left CAD Telemetry Badge */}
      <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-xs rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-800 pointer-events-none space-y-0.5">
        <div className="text-slate-900 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-600 inline-block" />
          3D STAGE CAD SOLID ({activeStage.replace('_', ' ')})
        </div>
        <div className="text-slate-600">
          Shape: <strong className="text-slate-900">{shapeLabel}</strong> | W={spanW.toFixed(2)}m × H={heightH.toFixed(2)}m | Pull={pullLengthM.toFixed(2)}m
        </div>
        <div className="text-slate-700">
          Elev: [{bounds.yMin.toFixed(2)}m, {bounds.yMax.toFixed(2)}m] | Area: <strong>{bounds.crossSectionArea.toFixed(2)} m²</strong> | Vol: <strong>{bounds.volume.toFixed(1)} m³</strong>
        </div>
        <div className="text-rose-700 font-semibold">
          {governingSet !== 'Unmapped'
            ? `Plane ${governingSet}: Strike ${governingStrike}° / Dip ${governingDip}°`
            : 'No Mapped Discontinuity Plane'}
        </div>
      </div>

      {/* Bottom-Right CAD Controls Legend */}
      <div className="absolute bottom-2 right-2 bg-white/95 border border-slate-300 rounded px-2 py-1 text-[9px] font-mono text-slate-600 pointer-events-none shadow-2xs">
        CAD Orbit: Left-Drag | Zoom: Scroll | Pan: Right-Drag
      </div>
    </div>
  );
};
