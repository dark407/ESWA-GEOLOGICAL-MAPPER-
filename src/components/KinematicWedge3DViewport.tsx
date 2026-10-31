import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TunnelGeometry } from '../types/tunnel';
import {
  generateExactTunnelProfilePoints,
  getCrownArchYAtX,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface KinematicWedge3DViewportProps {
  geometry?: TunnelGeometry;
  spanW: number;
  heightH: number;
  benchHeight?: number;
  wallHeight?: number;
  pullLengthM?: number;
  apexHeightM: number;
  wedgeVolumeM3: number;
  wedgeWeightMN?: number;
  wedgeWeightKn?: number;
  fosUnbolted: number;
  fosBolted: number;
  boltSpacingM: number;
  boltLengthM: number;
  boltCapacityMN?: number;
  governingStrike: number;
  governingDip: number;
  governingDipDirection?: number;
  driveAzimuth: number;
  failureMode?: string;
}

export const KinematicWedge3DViewport: React.FC<KinematicWedge3DViewportProps> = ({
  geometry,
  spanW: rawSpanW,
  heightH: rawHeightH,
  benchHeight: rawBenchHeight,
  wallHeight: rawWallHeight,
  pullLengthM: rawPullLengthM,
  apexHeightM: rawApexHeightM,
  wedgeVolumeM3: rawWedgeVolumeM3,
  wedgeWeightMN: rawWedgeWeightMN,
  wedgeWeightKn: rawWedgeWeightKn,
  fosUnbolted: rawFosUnbolted,
  fosBolted: rawFosBolted,
  boltSpacingM: rawBoltSpacingM,
  boltLengthM: rawBoltLengthM,
  governingStrike: rawGovStrike,
  governingDip: rawGovDip,
  driveAzimuth: rawDriveAzimuth,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

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
      : 3.5;
  const apexHeightM = Number.isFinite(rawApexHeightM) && rawApexHeightM > 0 ? rawApexHeightM : 1.8;
  const wedgeVolumeM3 = Number.isFinite(rawWedgeVolumeM3) ? rawWedgeVolumeM3 : 12.5;
  const wedgeWeightMN =
    Number.isFinite(rawWedgeWeightMN)
      ? (rawWedgeWeightMN as number)
      : Number.isFinite(rawWedgeWeightKn)
      ? (rawWedgeWeightKn as number) / 1000
      : (wedgeVolumeM3 * 26.5) / 1000;
  const fosUnbolted = Number.isFinite(rawFosUnbolted) ? rawFosUnbolted : 0.85;
  const fosBolted = Number.isFinite(rawFosBolted) ? rawFosBolted : 1.75;
  const boltSpacingM = Number.isFinite(rawBoltSpacingM) && rawBoltSpacingM > 0 ? rawBoltSpacingM : 1.5;
  const boltLengthM = Number.isFinite(rawBoltLengthM) && rawBoltLengthM > 0 ? rawBoltLengthM : 4.0;
  const governingStrike = Number.isFinite(rawGovStrike) ? rawGovStrike : 125;
  const governingDip = Number.isFinite(rawGovDip) ? rawGovDip : 60;
  const driveAzimuth = Number.isFinite(rawDriveAzimuth) ? rawDriveAzimuth : 45;

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
    const maxDim = Math.max(spanW, heightH, pullLengthM * 2);
    camera.position.set(maxDim * 1.25, heightH * 1.15, maxDim * 1.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, heightH * 0.68, 0);

    // Neutral Geotechnical CAD Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.65);
    dir1.position.set(18, 32, 24);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xf8fafc, 0.4);
    dir2.position.set(-18, 16, -20);
    scene.add(dir2);

    // Reference Floor Grid on White Canvas
    const corridorLen = Math.max(8, pullLengthM * 2.5);
    const gridSpan = Math.ceil(Math.max(spanW * 2.4, corridorLen * 1.6, 16) / 2) * 2;
    const grid = new THREE.GridHelper(gridSpan, gridSpan, 0x94a3b8, 0xe2e8f0);
    grid.position.y = -0.02;
    scene.add(grid);

    // 1. Exact Fed Tunnel Excavation Shell & Station Rings
    const profilePts = generateExactTunnelProfilePoints(geometry, spanW, heightH, benchHeight);
    if (profilePts.length >= 3) {
      const shape = new THREE.Shape();
      shape.moveTo(profilePts[0].x, profilePts[0].y);
      for (let i = 1; i < profilePts.length; i++) {
        shape.lineTo(profilePts[i].x, profilePts[i].y);
      }
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: corridorLen,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
      });
      extrudeGeo.translate(0, 0, -corridorLen / 2);

      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.7,
        metalness: 0.05,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(extrudeGeo, shellMat));

      const shellEdges = new THREE.EdgesGeometry(extrudeGeo, 15);
      scene.add(
        new THREE.LineSegments(
          shellEdges,
          new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.65 })
        )
      );

      // Station rings every 2.0m along the corridor
      const ringMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
      for (let z = -corridorLen / 2; z <= corridorLen / 2 + 0.05; z += Math.max(1.5, pullLengthM * 0.5)) {
        const ringPts = profilePts.map((p) => new THREE.Vector3(p.x, p.y, z));
        ringPts.push(ringPts[0].clone());
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat));
      }
    }

    // 2. Exact 3D Tetrahedral Crown Wedge Conforming to Fed Crown Arch
    const clampedApex = Math.max(0.5, Math.min(heightH * 0.75, apexHeightM));
    const relAngleRad = (((governingStrike - driveAzimuth) * Math.PI) / 180);
    const dipScale = Math.max(0.55, Math.cos(((governingDip - 50) * Math.PI) / 180));
    const halfBaseX = Math.min(spanW * 0.44, Math.max(spanW * 0.2, clampedApex * 1.15 * dipScale));
    const halfBaseZ = Math.min(corridorLen * 0.36, Math.max(1.2, clampedApex * 1.25));

    const skewX = Math.sin(relAngleRad) * (halfBaseX * 0.22);
    const skewZ = Math.cos(relAngleRad) * (halfBaseZ * 0.16);

    // Base perimeter vertices sit on the exact crown arch elevation y(x)
    const x1 = -halfBaseX;
    const z1 = -halfBaseZ * 0.65;
    const y1 = getCrownArchYAtX(geometry, x1, spanW, heightH, benchHeight);

    const x2 = halfBaseX;
    const z2 = -halfBaseZ * 0.65;
    const y2 = getCrownArchYAtX(geometry, x2, spanW, heightH, benchHeight);

    const x3 = skewX * 0.4;
    const z3 = halfBaseZ * 0.95;
    const y3 = getCrownArchYAtX(geometry, x3, spanW, heightH, benchHeight);

    // Apex V0 inside the overlying crown rock mass at heightH + clampedApex
    const v0 = new THREE.Vector3(skewX, heightH + clampedApex, skewZ);
    const v1 = new THREE.Vector3(x1, y1, z1);
    const v2 = new THREE.Vector3(x2, y2, z2);
    const v3 = new THREE.Vector3(x3, y3, z3);

    const wedgeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      // Joint Plane 1 (Left-Front)
      v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v3.x, v3.y, v3.z,
      // Joint Plane 2 (Right-Front)
      v0.x, v0.y, v0.z, v3.x, v3.y, v3.z, v2.x, v2.y, v2.z,
      // Joint Plane 3 (Rear Release)
      v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v1.x, v1.y, v1.z,
      // Excavation Daylighting Base Triangle
      v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z,
    ]);
    wedgeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    wedgeGeo.computeVertexNormals();

    const wedgeFillColor =
      fosBolted < 1.0 ? 0xdc2626 : fosBolted < 1.5 ? 0xd97706 : 0x059669;

    const wedgeMat = new THREE.MeshStandardMaterial({
      color: wedgeFillColor,
      roughness: 0.45,
      metalness: 0.05,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    });
    scene.add(new THREE.Mesh(wedgeGeo, wedgeMat));

    // Bold Black CAD Wireframe of the Tetrahedral Wedge
    const wedgeEdgePts = [
      v0, v1,
      v0, v2,
      v0, v3,
      v1, v2,
      v2, v3,
      v3, v1,
    ];
    const wedgeEdgeGeo = new THREE.BufferGeometry().setFromPoints(wedgeEdgePts);
    scene.add(
      new THREE.LineSegments(
        wedgeEdgeGeo,
        new THREE.LineBasicMaterial({ color: 0x0f172a })
      )
    );

    // Gravity Load Vector Arrow from Wedge Centroid
    const centroid = new THREE.Vector3()
      .add(v0)
      .add(v1)
      .add(v2)
      .add(v3)
      .multiplyScalar(0.25);
    const loadArrowLen = Math.max(1.1, Math.min(2.4, clampedApex * 0.75));
    scene.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        centroid,
        loadArrowLen,
        0xb91c1c,
        0.36,
        0.22
      )
    );

    // 3. Radial Rock Bolts & Face Bearing Plates Anchored to Exact Arch Surface
    const safeSpacing = Math.max(0.8, Math.min(3.0, boltSpacingM));
    const safeBoltLen = Math.max(1.5, Math.min(8.0, boltLengthM));
    const boltGroup = new THREE.Group();

    const numRowsZ = Math.max(2, Math.min(5, Math.floor((halfBaseZ * 1.8) / safeSpacing) + 1));
    const numColsX = Math.max(2, Math.min(5, Math.floor((halfBaseX * 1.9) / safeSpacing) + 1));

    const boltStemMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.4,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.6,
    });

    for (let rz = 0; rz < numRowsZ; rz++) {
      const zPos =
        -halfBaseZ * 0.55 +
        (numRowsZ > 1 ? (rz / (numRowsZ - 1)) * (halfBaseZ * 1.35) : 0);
      for (let cx = 0; cx < numColsX; cx++) {
        const xPos =
          -halfBaseX * 0.78 +
          (numColsX > 1 ? (cx / (numColsX - 1)) * (halfBaseX * 1.56) : 0);
        const yArch = getCrownArchYAtX(geometry, xPos, spanW, heightH, benchHeight);

        const collarPos = new THREE.Vector3(xPos, yArch, zPos);
        const outwardNormal = new THREE.Vector3(xPos * 0.28, 1.0, 0).normalize();
        const anchorTip = collarPos.clone().addScaledVector(outwardNormal, safeBoltLen);

        const boltDir = new THREE.Vector3().subVectors(anchorTip, collarPos);
        const len = boltDir.length();
        const cylGeo = new THREE.CylinderGeometry(0.045, 0.045, len, 10);
        const cylMesh = new THREE.Mesh(cylGeo, boltStemMat);

        const midPt = new THREE.Vector3().addVectors(collarPos, anchorTip).multiplyScalar(0.5);
        cylMesh.position.copy(midPt);
        cylMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          boltDir.clone().normalize()
        );
        boltGroup.add(cylMesh);

        // Bearing plate at excavation collar
        const plateGeo = new THREE.BoxGeometry(0.28, 0.06, 0.28);
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.copy(collarPos);
        plateMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          boltDir.clone().normalize()
        );
        boltGroup.add(plateMesh);
      }
    }
    scene.add(boltGroup);

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
    apexHeightM,
    wedgeVolumeM3,
    wedgeWeightMN,
    fosUnbolted,
    fosBolted,
    boltSpacingM,
    boltLengthM,
    governingStrike,
    governingDip,
    driveAzimuth,
  ]);

  const shapeLabel = (geometry?.crownGeometry || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-300 bg-white">
      <div ref={mountRef} className="w-full h-full min-h-[340px]" />

      {/* Top-Left CAD Telemetry Badge */}
      <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-xs rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-800 pointer-events-none space-y-0.5">
        <div className="text-slate-900 font-bold flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              fosBolted < 1.0 ? 'bg-rose-600' : fosBolted < 1.5 ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
          />
          3D KINEMATIC TETRAHEDRAL WEDGE &amp; BOLT ANCHORAGE
        </div>
        <div className="text-slate-600">
          Shape: <strong className="text-slate-900">{shapeLabel}</strong> ({spanW.toFixed(2)}m × {heightH.toFixed(2)}m) | Apex h<sub>w</sub>: <strong className="text-slate-900">{apexHeightM.toFixed(2)}m</strong>
        </div>
        <div className="text-slate-700">
          Vol: <strong>{wedgeVolumeM3.toFixed(1)} m³</strong> | Weight: <strong>{wedgeWeightMN.toFixed(2)} MN</strong> | Bolts: <strong>L={boltLengthM}m @ {boltSpacingM}m×{boltSpacingM}m</strong>
        </div>
        <div className={fosBolted >= 1.5 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
          FoS Unbolted: {fosUnbolted.toFixed(2)} ➔ Bolted FoS: {fosBolted.toFixed(2)}
        </div>
      </div>

      {/* Bottom-Right CAD Controls Legend */}
      <div className="absolute bottom-2 right-2 bg-white/95 border border-slate-300 rounded px-2 py-1 text-[9px] font-mono text-slate-600 pointer-events-none shadow-2xs">
        CAD Orbit: Left-Drag | Zoom: Scroll | Pan: Right-Drag
      </div>
    </div>
  );
};
