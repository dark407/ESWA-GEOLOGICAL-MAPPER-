import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Box,
  Layers,
  RotateCcw,
  Shield,
  Sliders,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  ContinuousTunnelStripDataset,
  ContinuousPullFemDemResult,
  Continuous3DJointInspectionRecord,
} from '../engine/continuous3DStripEngine';
import { unrolledToTunnel3D } from './ContinuousTunnel3DCanvas';

export interface ContinuousFemDem3DViewportProps {
  dataset: ContinuousTunnelStripDataset;
  femDemProfile: ContinuousPullFemDemResult[];
  jointSchedule: Continuous3DJointInspectionRecord[];
  selectedPullId: string;
  onSelectPullId: (pullId: string) => void;
}

type ContourMetricMode = 'DISPLACEMENT_MM' | 'CONTINUUM_FOS' | 'PLASTIC_RADIUS_M';
type LayoutSplitMode = 'DUAL_SIDE_BY_SIDE' | 'BEFORE_ONLY' | 'AFTER_ONLY';

/** Engineering Rainbow/Jet Color Map (0 = cool blue/emerald safe, 1 = hot red/magenta critical) */
function mapNormalizedToEngineeringColor(tNorm: number): THREE.Color {
  const t = Math.max(0, Math.min(1, tNorm));
  const color = new THREE.Color();
  if (t < 0.25) {
    // Deep Blue (0.0) -> Cyan (0.25)
    const u = t / 0.25;
    color.setRGB(0.05 * (1 - u) + 0.02 * u, 0.35 * (1 - u) + 0.78 * u, 0.92);
  } else if (t < 0.5) {
    // Cyan (0.25) -> Emerald Green (0.5)
    const u = (t - 0.25) / 0.25;
    color.setRGB(0.02 * (1 - u) + 0.12 * u, 0.78 * (1 - u) + 0.85 * u, 0.92 * (1 - u) + 0.35 * u);
  } else if (t < 0.75) {
    // Emerald Green (0.5) -> Amber/Yellow (0.75)
    const u = (t - 0.5) / 0.25;
    color.setRGB(0.12 * (1 - u) + 0.96 * u, 0.85 * (1 - u) + 0.72 * u, 0.35 * (1 - u) + 0.08 * u);
  } else {
    // Amber (0.75) -> Crimson Red (1.0)
    const u = (t - 0.75) / 0.25;
    color.setRGB(0.96, 0.72 * (1 - u) + 0.14 * u, 0.08 * (1 - u) + 0.22 * u);
  }
  return color;
}

export const ContinuousFemDem3DViewport: React.FC<ContinuousFemDem3DViewportProps> = ({
  dataset,
  femDemProfile,
  jointSchedule,
  selectedPullId,
  onSelectPullId,
}) => {
  const beforeMountRef = useRef<HTMLDivElement | null>(null);
  const afterMountRef = useRef<HTMLDivElement | null>(null);

  const [layoutMode, setLayoutMode] = useState<LayoutSplitMode>('DUAL_SIDE_BY_SIDE');
  const [contourMetric, setContourMetric] = useState<ContourMetricMode>('DISPLACEMENT_MM');
  const [showPlasticHalo3D, setShowPlasticHalo3D] = useState<boolean>(true);
  const [showDemWedges3D, setShowDemWedges3D] = useState<boolean>(true);
  const [showSupportSystem3D, setShowSupportSystem3D] = useState<boolean>(true);
  const [showDispVectors3D, setShowDispVectors3D] = useState<boolean>(true);
  const [deformScale, setDeformScale] = useState<number>(15);

  const excavationMode: 'TUNNEL' | 'SHAFT' = dataset.excavationMode || 'TUNNEL';
  const isShaft = excavationMode === 'SHAFT';
  const isHalfShaft = Boolean(
    isShaft && dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE'
  );

  const fromRd = dataset.viewFromRd ?? 0;
  const toRd = dataset.viewToRd ?? 30;
  const totalLengthM = Math.max(2, toRd - fromRd);

  const leftWallHeight = dataset.leftWallHeightM || dataset.leftWallArcLengthM || 4.0;
  const crownWidth = dataset.crownWidthM || dataset.crownArcLengthM || 8.0;
  const rightWallHeight = dataset.rightWallHeightM || dataset.rightWallArcLengthM || 4.0;
  const tunnelWidth = dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 8.5;
  const totalPerimeterM =
    (dataset.upperZoneWidthM || 0) + (dataset.lowerZoneWidthM || 0) ||
    leftWallHeight + crownWidth + rightWallHeight;

  // Compute global max displacement & plastic radius for consistent color scale between Before and After
  const scaleBounds = useMemo(() => {
    const mapped = femDemProfile.filter((r) => r.status === 'MAPPED');
    const maxDisp = Math.max(
      15,
      ...mapped.map((r) => r.unreinforcedDispMm),
      ...mapped.map((r) => r.reinforcedDispMm)
    );
    const maxRp = Math.max(
      2.5,
      ...mapped.map((r) => r.unreinforcedPlasticRadiusM),
      ...mapped.map((r) => r.reinforcedPlasticRadiusM)
    );
    return { maxDisp, maxRp };
  }, [femDemProfile]);

  const activeSlice = useMemo(
    () =>
      femDemProfile.find((r) => r.pullId === selectedPullId && r.status === 'MAPPED') ||
      femDemProfile.find((r) => r.status === 'MAPPED') ||
      femDemProfile[0],
    [femDemProfile, selectedPullId]
  );

  // Shared Synchronized Camera Orbit State across Before & After 3D Viewports
  const sharedOrbitRef = useRef({
    radius: Math.max(24, totalLengthM * 0.95),
    theta: isShaft ? 0.65 : 0.72,
    phi: isShaft ? 1.15 : 1.08,
    target: new THREE.Vector3(
      0,
      isShaft ? totalLengthM * 0.5 : leftWallHeight * 0.65,
      isShaft ? 0 : totalLengthM * 0.5
    ),
  });

  const beforeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const afterCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const beforeSceneRef = useRef<THREE.Scene | null>(null);
  const afterSceneRef = useRef<THREE.Scene | null>(null);
  const beforeRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const afterRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const beforePickMeshesRef = useRef<THREE.Object3D[]>([]);
  const afterPickMeshesRef = useRef<THREE.Object3D[]>([]);

  const syncBothCameras = useCallback(() => {
    const { radius, theta, phi, target } = sharedOrbitRef.current;
    const cx = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const cy = target.y + radius * Math.cos(phi);
    const cz = target.z + radius * Math.sin(phi) * Math.cos(theta);

    if (beforeCameraRef.current) {
      beforeCameraRef.current.position.set(cx, cy, cz);
      beforeCameraRef.current.lookAt(target);
    }
    if (afterCameraRef.current) {
      afterCameraRef.current.position.set(cx, cy, cz);
      afterCameraRef.current.lookAt(target);
    }
    if (beforeRendererRef.current && beforeSceneRef.current && beforeCameraRef.current) {
      beforeRendererRef.current.render(beforeSceneRef.current, beforeCameraRef.current);
    }
    if (afterRendererRef.current && afterSceneRef.current && afterCameraRef.current) {
      afterRendererRef.current.render(afterSceneRef.current, afterCameraRef.current);
    }
  }, []);

  const resetCameraView = useCallback(
    (preset: 'iso' | 'front' | 'top' | 'side') => {
      sharedOrbitRef.current.target.set(
        0,
        isShaft ? totalLengthM * 0.5 : leftWallHeight * 0.65,
        isShaft ? 0 : totalLengthM * 0.5
      );
      sharedOrbitRef.current.radius = Math.max(22, totalLengthM * 0.92);

      if (preset === 'iso') {
        sharedOrbitRef.current.theta = 0.72;
        sharedOrbitRef.current.phi = 1.08;
      } else if (preset === 'front') {
        sharedOrbitRef.current.theta = 0;
        sharedOrbitRef.current.phi = Math.PI / 2;
      } else if (preset === 'top') {
        sharedOrbitRef.current.theta = 0;
        sharedOrbitRef.current.phi = 0.12;
      } else if (preset === 'side') {
        sharedOrbitRef.current.theta = Math.PI / 2;
        sharedOrbitRef.current.phi = Math.PI / 2;
      }
      syncBothCameras();
    },
    [isShaft, totalLengthM, leftWallHeight, syncBothCameras]
  );

  // Build scene contents for either BEFORE_SUPPORT or AFTER_SUPPORT
  const populateFemDemScene = useCallback(
    (
      scene: THREE.Scene,
      stageMode: 'BEFORE_SUPPORT' | 'AFTER_SUPPORT',
      pickTargetsOut: THREE.Object3D[]
    ) => {
      // Clear previous dynamic entities
      const toRemove: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj.userData?.isFemEntity) toRemove.push(obj);
      });
      toRemove.forEach((obj) => {
        scene.remove(obj);
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          if (Array.isArray((obj as any).material)) {
            (obj as any).material.forEach((m: any) => m.dispose());
          } else {
            (obj as any).material.dispose();
          }
        }
      });
      pickTargetsOut.length = 0;

      const uSegs = 36;
      const vSegsPerPull = 8;

      // Helper to compute point in 3D with optional radial inward deformation
      const computeDeformedPoint3D = (
        ch: number,
        yPerim: number,
        inwardDeformM: number,
        outwardOffsetM = 0
      ): THREE.Vector3 => {
        const basePt = unrolledToTunnel3D(
          ch,
          yPerim,
          fromRd,
          toRd,
          leftWallHeight,
          crownWidth,
          rightWallHeight,
          tunnelWidth,
          excavationMode,
          totalPerimeterM
        );

        // If Half-Circle Shaft, clamp X >= 0 or angle 0..PI
        if (isHalfShaft) {
          const totalDepth = Math.max(1, toRd - fromRd);
          const yHeight = Math.max(0, totalDepth - (ch - fromRd));
          const angle = (yPerim / Math.max(0.001, totalPerimeterM)) * Math.PI; // 0 to PI semicircular wall
          const rBase = tunnelWidth / 2 - inwardDeformM + outwardOffsetM;
          return new THREE.Vector3(rBase * Math.sin(angle), yHeight, -rBase * Math.cos(angle));
        }

        if (isShaft) {
          const rCurrent = Math.hypot(basePt.x, basePt.z) || 1;
          const rNew = Math.max(0.5, rCurrent - inwardDeformM + outwardOffsetM);
          return new THREE.Vector3(
            (basePt.x / rCurrent) * rNew,
            basePt.y,
            (basePt.z / rCurrent) * rNew
          );
        }

        // Tunnel radial direction from center of arch (0, leftWallHeight * 0.55, z)
        const centerY = leftWallHeight * 0.55;
        const dx = basePt.x;
        const dy = basePt.y - centerY;
        const dist = Math.hypot(dx, dy) || 1;
        // Crown deforms slightly more than walls
        const crownFactor =
          yPerim >= leftWallHeight && yPerim <= leftWallHeight + crownWidth ? 1.15 : 0.75;
        const deltaR = -inwardDeformM * crownFactor + outwardOffsetM;
        return new THREE.Vector3(
          basePt.x + (dx / dist) * deltaR,
          Math.max(0, basePt.y + (dy / dist) * deltaR),
          basePt.z
        );
      };

      // 1. Render each round / pull along the chainage or shaft depth
      femDemProfile.forEach((pullRes) => {
        const pStart = pullRes.fromRd;
        const pEnd = pullRes.toRd;
        const isSelectedPull = pullRes.pullId === activeSlice?.pullId;

        if (pullRes.status === 'MISSING_GAP') {
          // Render Blank Unlogged Gap with Dashed Boundary Rings
          for (const bRd of [pStart, pEnd]) {
            const ringPts: THREE.Vector3[] = [];
            for (let i = 0; i <= uSegs; i++) {
              const yP = (i / uSegs) * totalPerimeterM;
              ringPts.push(computeDeformedPoint3D(bRd, yP, 0, 0));
            }
            const gGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
            const gMat = new THREE.LineDashedMaterial({
              color: 0x64748b,
              dashSize: 0.45,
              gapSize: 0.3,
            });
            const gLine = new THREE.Line(gGeo, gMat);
            gLine.computeLineDistances();
            gLine.userData = { isFemEntity: true };
            scene.add(gLine);
          }
          return;
        }

        // Determine metric value and normalized [0..1] severity for this pull
        const dispMm =
          stageMode === 'BEFORE_SUPPORT'
            ? pullRes.unreinforcedDispMm
            : pullRes.reinforcedDispMm;
        const fosVal =
          stageMode === 'BEFORE_SUPPORT'
            ? pullRes.unreinforcedContinuumFos
            : pullRes.reinforcedContinuumFos;
        const rpM =
          stageMode === 'BEFORE_SUPPORT'
            ? pullRes.unreinforcedPlasticRadiusM
            : pullRes.reinforcedPlasticRadiusM;

        let baseNorm = 0.5;
        if (contourMetric === 'DISPLACEMENT_MM') {
          baseNorm = Math.min(1, dispMm / scaleBounds.maxDisp);
        } else if (contourMetric === 'CONTINUUM_FOS') {
          // Lower FoS (< 1.0) -> 1.0 (Red), Higher FoS (> 2.2) -> 0.0 (Blue/Green)
          baseNorm = Math.max(0, Math.min(1, (2.2 - fosVal) / 1.4));
        } else {
          baseNorm = Math.min(1, rpM / scaleBounds.maxRp);
        }

        // Visual inward displacement in meters (scaled by deformScale)
        const inwardDeformM = Math.min(
          tunnelWidth * 0.22,
          (dispMm / 1000) * deformScale
        );

        // Build 3D FEM Continuum Contour Mesh for this pull
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        for (let j = 0; j <= vSegsPerPull; j++) {
          const v = j / vSegsPerPull;
          const ch = pStart + v * (pEnd - pStart);
          for (let i = 0; i <= uSegs; i++) {
            const u = i / uSegs;
            const yP = u * totalPerimeterM;

            // Spatial variation around perimeter (crown/arch experiences higher stress concentration)
            const archConcentration = isShaft
              ? 0.92 + 0.16 * Math.sin(u * Math.PI * 2)
              : yP >= leftWallHeight && yP <= leftWallHeight + crownWidth
              ? 1.08
              : 0.82;

            const localDeformM = inwardDeformM * archConcentration;
            const pt = computeDeformedPoint3D(ch, yP, localDeformM, 0);
            positions.push(pt.x, pt.y, pt.z);

            const localNorm = Math.max(0, Math.min(1, baseNorm * archConcentration));
            const vCol = mapNormalizedToEngineeringColor(localNorm);
            colors.push(vCol.r, vCol.g, vCol.b);
          }
        }

        for (let j = 0; j < vSegsPerPull; j++) {
          for (let i = 0; i < uSegs; i++) {
            const a = j * (uSegs + 1) + i;
            const b = (j + 1) * (uSegs + 1) + i;
            const c = (j + 1) * (uSegs + 1) + (i + 1);
            const d = j * (uSegs + 1) + (i + 1);
            indices.push(a, b, d);
            indices.push(b, c, d);
          }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const meshMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.45,
          metalness: 0.08,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelectedPull ? 0.92 : 0.78,
        });
        const pullMesh = new THREE.Mesh(geo, meshMat);
        pullMesh.userData = { isFemEntity: true, pullId: pullRes.pullId };
        scene.add(pullMesh);
        pickTargetsOut.push(pullMesh);

        // Finite Element Mesh Grid Lines over the round
        const wireMat = new THREE.MeshBasicMaterial({
          color: isSelectedPull ? 0xffffff : 0x0f172a,
          wireframe: true,
          transparent: true,
          opacity: isSelectedPull ? 0.32 : 0.16,
        });
        const wireMesh = new THREE.Mesh(geo, wireMat);
        wireMesh.userData = { isFemEntity: true };
        scene.add(wireMesh);

        // 2. 3D Volumetric Elasto-Plastic Yield Zone Halo ($R_p$) around the excavation
        if (showPlasticHalo3D && rpM > 0.08) {
          const haloGeo = new THREE.BufferGeometry();
          const hPos: number[] = [];
          const hIdx: number[] = [];
          const visualHaloOffsetM = Math.min(4.5, rpM * 0.85);

          for (let j = 0; j <= 4; j++) {
            const ch = pStart + (j / 4) * (pEnd - pStart);
            for (let i = 0; i <= 24; i++) {
              const yP = (i / 24) * totalPerimeterM;
              const pt = computeDeformedPoint3D(ch, yP, 0, visualHaloOffsetM);
              hPos.push(pt.x, pt.y, pt.z);
            }
          }
          for (let j = 0; j < 4; j++) {
            for (let i = 0; i < 24; i++) {
              const a = j * 25 + i;
              const b = (j + 1) * 25 + i;
              const c = (j + 1) * 25 + (i + 1);
              const d = j * 25 + (i + 1);
              hIdx.push(a, b, d);
              hIdx.push(b, c, d);
            }
          }
          haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(hPos, 3));
          haloGeo.setIndex(hIdx);
          haloGeo.computeVertexNormals();

          const haloColor =
            stageMode === 'BEFORE_SUPPORT' ? 0xf43f5e : 0x10b981;
          const haloMat = new THREE.MeshStandardMaterial({
            color: haloColor,
            transparent: true,
            opacity: stageMode === 'BEFORE_SUPPORT' ? 0.18 : 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const haloMesh = new THREE.Mesh(haloGeo, haloMat);
          haloMesh.userData = { isFemEntity: true };
          scene.add(haloMesh);

          // Outer plastic boundary ring at mid-pull
          const midCh = (pStart + pEnd) / 2;
          const rpRingPts: THREE.Vector3[] = [];
          for (let i = 0; i <= 28; i++) {
            rpRingPts.push(
              computeDeformedPoint3D(midCh, (i / 28) * totalPerimeterM, 0, visualHaloOffsetM)
            );
          }
          const rpRingGeo = new THREE.BufferGeometry().setFromPoints(rpRingPts);
          const rpRingMat = new THREE.LineDashedMaterial({
            color: haloColor,
            dashSize: 0.35,
            gapSize: 0.2,
          });
          const rpRing = new THREE.Line(rpRingGeo, rpRingMat);
          rpRing.computeLineDistances();
          rpRing.userData = { isFemEntity: true };
          scene.add(rpRing);
        }

        // 3. 3D Installed Support System (Rock Bolts, Steel Ribs/Girders, Shotcrete Shell) in AFTER_SUPPORT
        if (stageMode === 'AFTER_SUPPORT' && showSupportSystem3D) {
          const boltRows = [pStart + (pEnd - pStart) * 0.28, pStart + (pEnd - pStart) * 0.72];
          const boltCountPerRow = isHalfShaft ? 6 : isShaft ? 10 : 7;
          const boltLengthM = Math.max(2.5, tunnelWidth * 0.35);

          boltRows.forEach((bCh) => {
            // 3D Steel Rib / Lattice Girder Arch at bolt row
            const ribPts: THREE.Vector3[] = [];
            for (let i = 0; i <= 32; i++) {
              const yP = (i / 32) * totalPerimeterM;
              ribPts.push(computeDeformedPoint3D(bCh, yP, inwardDeformM, -0.04));
            }
            const ribCurve = new THREE.CatmullRomCurve3(ribPts, isShaft && !isHalfShaft);
            const ribGeo = new THREE.TubeGeometry(ribCurve, 32, 0.055, 6, isShaft && !isHalfShaft);
            const ribMat = new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              metalness: 0.75,
              roughness: 0.25,
            });
            const ribMesh = new THREE.Mesh(ribGeo, ribMat);
            ribMesh.userData = { isFemEntity: true };
            scene.add(ribMesh);

            // 3D Radial Rock Bolts + Faceplates
            for (let bIdx = 0; bIdx < boltCountPerRow; bIdx++) {
              const frac = isShaft && !isHalfShaft
                ? bIdx / boltCountPerRow
                : (bIdx + 0.5) / boltCountPerRow;
              const yP = frac * totalPerimeterM;
              const collarPt = computeDeformedPoint3D(bCh, yP, inwardDeformM, 0);
              const anchorPt = computeDeformedPoint3D(bCh, yP, inwardDeformM, boltLengthM);

              const bLineGeo = new THREE.BufferGeometry().setFromPoints([collarPt, anchorPt]);
              const bLineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee });
              const bLine = new THREE.Line(bLineGeo, bLineMat);
              bLine.userData = { isFemEntity: true };
              scene.add(bLine);

              // Bolt anchor head / faceplate sphere
              const plateGeo = new THREE.SphereGeometry(0.09, 8, 8);
              const plateMat = new THREE.MeshStandardMaterial({
                color: 0x10b981,
                metalness: 0.6,
                roughness: 0.3,
              });
              const plateMesh = new THREE.Mesh(plateGeo, plateMat);
              plateMesh.position.copy(collarPt);
              plateMesh.userData = { isFemEntity: true };
              scene.add(plateMesh);
            }
          });
        }

        // 4. 3D Radial Displacement Vectors (Inward Convergence Arrows)
        if (showDispVectors3D) {
          const midCh = (pStart + pEnd) / 2;
          const arrowCount = isShaft ? 6 : 5;
          const arrowLen = Math.max(
            0.35,
            Math.min(2.2, (dispMm / scaleBounds.maxDisp) * 1.9)
          );
          const arrowColor =
            stageMode === 'BEFORE_SUPPORT' ? 0xfb7185 : 0x34d399;

          for (let aIdx = 0; aIdx < arrowCount; aIdx++) {
            const frac = (aIdx + 0.5) / arrowCount;
            const yP = frac * totalPerimeterM;
            const surfacePt = computeDeformedPoint3D(midCh, yP, inwardDeformM, 0);
            const innerPt = computeDeformedPoint3D(midCh, yP, inwardDeformM + arrowLen, 0);
            const dir = innerPt.clone().sub(surfacePt).normalize();
            const arrowHelper = new THREE.ArrowHelper(
              dir,
              surfacePt,
              arrowLen,
              arrowColor,
              Math.min(0.32, arrowLen * 0.35),
              0.16
            );
            arrowHelper.userData = { isFemEntity: true };
            scene.add(arrowHelper);
          }
        }
      });

      // 5. Render Crisp Joint Traces & 3D Discrete DEM Wedge Blocks
      (dataset.traces || []).forEach((trace) => {
        const pts = trace.points || [];
        if (pts.length < 2) return;

        const pts3D = pts.map((p) => computeDeformedPoint3D(p.x, p.y, 0, -0.02));
        const curve = new THREE.CatmullRomCurve3(pts3D, false, 'chordal');
        // Crisp, clutter-free 3D joint trace radius
        const tubeGeo = new THREE.TubeGeometry(curve, Math.max(10, pts.length * 3), 0.028, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: stageMode === 'BEFORE_SUPPORT' ? 0xfbbf24 : 0x38bdf8,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        tubeMesh.userData = { isFemEntity: true };
        scene.add(tubeMesh);

        if (showDemWedges3D) {
          const insp = jointSchedule.find((j) => j.traceId === trace.id);
          const apexH = insp ? insp.wedgeApexHeightM : 1.35;
          const centroid = new THREE.Vector3();
          pts3D.forEach((p) => centroid.add(p));
          centroid.divideScalar(pts3D.length);

          // Outward rock mass normal at centroid
          const pMid = computeDeformedPoint3D(
            pts[Math.floor(pts.length / 2)].x,
            Math.min(totalPerimeterM, pts[Math.floor(pts.length / 2)].y + 0.9),
            0,
            0
          );
          const pApex = computeDeformedPoint3D(
            pts[Math.floor(pts.length / 2)].x,
            pts[Math.floor(pts.length / 2)].y,
            // In BEFORE_SUPPORT, unreinforced wedges detach slightly inward toward the excavation!
            stageMode === 'BEFORE_SUPPORT' ? 0.25 : 0,
            apexH
          );

          const pStart = pts3D[0];
          const pEnd = pts3D[pts3D.length - 1];

          const wedgeGeo = new THREE.BufferGeometry();
          const wVerts = new Float32Array([
            pStart.x, pStart.y, pStart.z,
            pEnd.x, pEnd.y, pEnd.z,
            pMid.x, pMid.y, pMid.z,

            pStart.x, pStart.y, pStart.z,
            pMid.x, pMid.y, pMid.z,
            pApex.x, pApex.y, pApex.z,

            pMid.x, pMid.y, pMid.z,
            pEnd.x, pEnd.y, pEnd.z,
            pApex.x, pApex.y, pApex.z,

            pEnd.x, pEnd.y, pEnd.z,
            pStart.x, pStart.y, pStart.z,
            pApex.x, pApex.y, pApex.z,
          ]);
          wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wVerts, 3));
          wedgeGeo.computeVertexNormals();

          const wedgeColor =
            stageMode === 'BEFORE_SUPPORT' ? 0xef4444 : 0x10b981;
          const wedgeMat = new THREE.MeshStandardMaterial({
            color: wedgeColor,
            transparent: true,
            opacity: stageMode === 'BEFORE_SUPPORT' ? 0.58 : 0.42,
            roughness: 0.35,
            side: THREE.DoubleSide,
          });
          const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
          wedgeMesh.userData = { isFemEntity: true };
          scene.add(wedgeMesh);

          const edgeLines = new THREE.LineSegments(
            new THREE.EdgesGeometry(wedgeGeo),
            new THREE.LineBasicMaterial({
              color: stageMode === 'BEFORE_SUPPORT' ? 0xfecdd3 : 0xa7f3d0,
            })
          );
          edgeLines.userData = { isFemEntity: true };
          scene.add(edgeLines);
        }
      });

      // 6. Half-Circle Shaft Center Median Wall (Open vs Closed)
      if (isHalfShaft) {
        const medianGeo = new THREE.PlaneGeometry(tunnelWidth, totalLengthM);
        const isClosed = (dataset.shaftCenterMedianStatus || 'closed') === 'closed';
        const medianMat = new THREE.MeshStandardMaterial({
          color:
            stageMode === 'AFTER_SUPPORT' && isClosed
              ? 0x10b981
              : isClosed
              ? 0x64748b
              : 0xf59e0b,
          transparent: true,
          opacity: isClosed ? 0.45 : 0.18,
          side: THREE.DoubleSide,
        });
        const medianMesh = new THREE.Mesh(medianGeo, medianMat);
        medianMesh.rotation.y = Math.PI / 2;
        medianMesh.position.set(0, totalLengthM / 2, 0);
        medianMesh.userData = { isFemEntity: true };
        scene.add(medianMesh);
      }
    },
    [
      fromRd,
      toRd,
      leftWallHeight,
      crownWidth,
      rightWallHeight,
      tunnelWidth,
      excavationMode,
      totalPerimeterM,
      isHalfShaft,
      isShaft,
      femDemProfile,
      activeSlice?.pullId,
      contourMetric,
      scaleBounds,
      deformScale,
      showPlasticHalo3D,
      showSupportSystem3D,
      showDispVectors3D,
      dataset.traces,
      dataset.shaftCenterMedianStatus,
      showDemWedges3D,
      jointSchedule,
      totalLengthM,
    ]
  );

  // Initialize both WebGLRenderers once
  useEffect(() => {
    const setupViewport = (
      container: HTMLDivElement | null,
      sceneRefObj: React.MutableRefObject<THREE.Scene | null>,
      camRefObj: React.MutableRefObject<THREE.PerspectiveCamera | null>,
      renRefObj: React.MutableRefObject<THREE.WebGLRenderer | null>
    ) => {
      if (!container) return null;
      const w = Math.max(300, container.clientWidth || 520);
      const h = Math.max(280, container.clientHeight || 400);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060a12);
      sceneRefObj.current = scene;

      const camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 1000);
      camRefObj.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renRefObj.current = renderer;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Balanced studio engineering lighting
      const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.95);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.05);
      keyLight.position.set(28, 42, 26);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
      fillLight.position.set(-28, 18, -18);
      scene.add(fillLight);

      const grid = new THREE.GridHelper(
        Math.max(50, totalLengthM + 16),
        28,
        0x1e293b,
        0x0f172a
      );
      grid.position.set(0, -0.05, isShaft ? 0 : totalLengthM / 2);
      scene.add(grid);

      return { scene, camera, renderer, container };
    };

    const vBefore = setupViewport(
      beforeMountRef.current,
      beforeSceneRef,
      beforeCameraRef,
      beforeRendererRef
    );
    const vAfter = setupViewport(
      afterMountRef.current,
      afterSceneRef,
      afterCameraRef,
      afterRendererRef
    );

    syncBothCameras();

    const handleResize = () => {
      [vBefore, vAfter].forEach((v) => {
        if (!v || !v.container) return;
        const w = Math.max(200, v.container.clientWidth);
        const h = Math.max(200, v.container.clientHeight);
        v.camera.aspect = w / h;
        v.camera.updateProjectionMatrix();
        v.renderer.setSize(w, h);
      });
      syncBothCameras();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      [vBefore, vAfter].forEach((v) => {
        if (!v) return;
        v.renderer.dispose();
        if (v.container.contains(v.renderer.domElement)) {
          v.container.removeChild(v.renderer.domElement);
        }
      });
    };
  }, [totalLengthM, isShaft, syncBothCameras]);

  // Trigger resize when layoutSplitMode changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      [
        { c: beforeMountRef.current, cam: beforeCameraRef.current, ren: beforeRendererRef.current },
        { c: afterMountRef.current, cam: afterCameraRef.current, ren: afterRendererRef.current },
      ].forEach(({ c, cam, ren }) => {
        if (!c || !cam || !ren) return;
        const w = Math.max(200, c.clientWidth);
        const h = Math.max(200, c.clientHeight);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        ren.setSize(w, h);
      });
      syncBothCameras();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [layoutMode, syncBothCameras]);

  // Rebuild 3D meshes whenever parameters or dataset update
  useEffect(() => {
    if (beforeSceneRef.current) {
      populateFemDemScene(beforeSceneRef.current, 'BEFORE_SUPPORT', beforePickMeshesRef.current);
    }
    if (afterSceneRef.current) {
      populateFemDemScene(afterSceneRef.current, 'AFTER_SUPPORT', afterPickMeshesRef.current);
    }
    syncBothCameras();
  }, [populateFemDemScene, syncBothCameras]);

  // Synchronized Pointer Orbit / Pan / Raycast Handler
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };

    if (e.buttons === 1 && !e.shiftKey) {
      sharedOrbitRef.current.theta -= dx * 0.0075;
      sharedOrbitRef.current.phi = Math.max(
        0.12,
        Math.min(Math.PI - 0.12, sharedOrbitRef.current.phi - dy * 0.0075)
      );
    } else if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
      const panSpeed = 0.035;
      sharedOrbitRef.current.target.x -= dx * panSpeed;
      sharedOrbitRef.current.target.y += dy * panSpeed;
    }
    syncBothCameras();
  };

  const handlePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    which: 'BEFORE' | 'AFTER'
  ) => {
    isDraggingRef.current = false;
    const dist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (dist < 5) {
      const container =
        which === 'BEFORE' ? beforeMountRef.current : afterMountRef.current;
      const camera =
        which === 'BEFORE' ? beforeCameraRef.current : afterCameraRef.current;
      const targets =
        which === 'BEFORE'
          ? beforePickMeshesRef.current
          : afterPickMeshesRef.current;
      if (!container || !camera) return;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0 && hits[0].object.userData?.pullId) {
        onSelectPullId(hits[0].object.userData.pullId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    sharedOrbitRef.current.radius = Math.max(
      8,
      Math.min(120, sharedOrbitRef.current.radius + e.deltaY * 0.035)
    );
    syncBothCameras();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Top 3D FEM/DEM Control Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>
                Continuous 3D FEM / DEM Numerical Simulation — Before Support vs. After Support
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
                {isShaft
                  ? isHalfShaft
                    ? `3D Half-Circle Shaft (Median ${(dataset.shaftCenterMedianStatus || 'closed').toUpperCase()})`
                    : '3D Full-Circle Vertical Shaft'
                  : '3D NATM Horseshoe / Arch Tunnel'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Synchronized 3D elasto-plastic continuum contours, 3D plastic yield halo (R_p), 3D discrete tetrahedral wedges, and 3D installed bolts &amp; steel ribs.
            </p>
          </div>
        </div>

        {/* 3D Contour Metric & Layout Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Contour Metric Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-[10px] font-bold">
            <span className="px-1.5 text-slate-400 uppercase">3D Contour:</span>
            {(
              [
                { id: 'DISPLACEMENT_MM', label: 'Displacement u (mm)' },
                { id: 'CONTINUUM_FOS', label: 'Continuum FoS' },
                { id: 'PLASTIC_RADIUS_M', label: 'Plastic Radius Rp (m)' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setContourMetric(m.id)}
                className={`px-2 py-1 rounded cursor-pointer transition ${
                  contourMetric === m.id
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Split View Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setLayoutMode('DUAL_SIDE_BY_SIDE')}
              className={`px-2 py-1 rounded cursor-pointer ${
                layoutMode === 'DUAL_SIDE_BY_SIDE'
                  ? 'bg-cyan-600 text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dual 3D (Before + After)
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('BEFORE_ONLY')}
              className={`px-2 py-1 rounded cursor-pointer ${
                layoutMode === 'BEFORE_ONLY'
                  ? 'bg-rose-600 text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3D Before Support
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('AFTER_ONLY')}
              className={`px-2 py-1 rounded cursor-pointer ${
                layoutMode === 'AFTER_ONLY'
                  ? 'bg-emerald-600 text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3D After Support
            </button>
          </div>
        </div>
      </div>

      {/* Secondary 3D Layer & Camera Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showPlasticHalo3D}
              onChange={(e) => setShowPlasticHalo3D(e.target.checked)}
              className="rounded accent-amber-500"
            />
            <span>3D Plastic Yield Zone Shell (R_p)</span>
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showDemWedges3D}
              onChange={(e) => setShowDemWedges3D(e.target.checked)}
              className="rounded accent-amber-500"
            />
            <span>3D Discrete DEM Wedge Blocks</span>
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showSupportSystem3D}
              onChange={(e) => setShowSupportSystem3D(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>3D Rock Bolts &amp; Steel Ribs (After Support)</span>
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showDispVectors3D}
              onChange={(e) => setShowDispVectors3D(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            <span>3D Convergence Vectors</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Deformation Scale */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px]">
            <Sliders className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400">3D Deform Scale:</span>
            {[1, 10, 15, 30].map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setDeformScale(sc)}
                className={`px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                  deformScale === sc
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sc}x
              </button>
            ))}
          </div>

          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            {(['iso', 'front', 'side', 'top'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => resetCameraView(p)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Dual 3D WebGL Viewports (Before Support vs. After Support) */}
      <div
        className={`grid ${
          layoutMode === 'DUAL_SIDE_BY_SIDE' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        } bg-slate-950 relative`}
      >
        {/* VIEWPORT A: 3D BEFORE SUPPORT (UNREINFORCED) */}
        <div
          className={`relative h-[410px] border-b lg:border-b-0 lg:border-r border-slate-800 ${
            layoutMode === 'AFTER_ONLY' ? 'hidden' : 'block'
          }`}
        >
          {/* Top-Left Telemetry Badge */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none bg-slate-950/90 border border-rose-500/40 rounded-lg px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>3D BEFORE SUPPORT (UNREINFORCED ROCK MASS)</span>
            </div>
            {activeSlice && (
              <div className="text-[11px] font-mono text-slate-200">
                {isShaft ? 'Depth' : 'RD'} {activeSlice.fromRd}–{activeSlice.toRd}m:{' '}
                <span className="text-rose-300 font-bold">
                  u_max = {activeSlice.unreinforcedDispMm.toFixed(2)} mm
                </span>{' '}
                | R_p = {activeSlice.unreinforcedPlasticRadiusM.toFixed(2)} m |{' '}
                <span className="text-rose-400 font-black">
                  Cont FoS = {activeSlice.unreinforcedContinuumFos.toFixed(2)}
                </span>{' '}
                | Wedge FoS = {activeSlice.unreinforcedDiscreteWedgeFos.toFixed(2)}
              </div>
            )}
          </div>

          <div
            ref={beforeMountRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, 'BEFORE')}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />
        </div>

        {/* VIEWPORT B: 3D AFTER SUPPORT (REINFORCED) */}
        <div
          className={`relative h-[410px] ${
            layoutMode === 'BEFORE_ONLY' ? 'hidden' : 'block'
          }`}
        >
          {/* Top-Left Telemetry Badge */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none bg-slate-950/90 border border-emerald-500/40 rounded-lg px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3D AFTER SUPPORT (REINFORCED WITH BOLTS, RIBS &amp; SFRS)</span>
            </div>
            {activeSlice && (
              <div className="text-[11px] font-mono text-slate-200">
                {isShaft ? 'Depth' : 'RD'} {activeSlice.fromRd}–{activeSlice.toRd}m:{' '}
                <span className="text-emerald-300 font-bold">
                  u_sup = {activeSlice.reinforcedDispMm.toFixed(2)} mm (-
                  {activeSlice.dispReductionPct}%)
                </span>{' '}
                | R_p = {activeSlice.reinforcedPlasticRadiusM.toFixed(2)} m |{' '}
                <span className="text-emerald-400 font-black">
                  Cont FoS = {activeSlice.reinforcedContinuumFos.toFixed(2)}
                </span>{' '}
                | Wedge FoS = {activeSlice.reinforcedDiscreteWedgeFos.toFixed(2)}
              </div>
            )}
          </div>

          <div
            ref={afterMountRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, 'AFTER')}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>

      {/* Bottom Engineering Contour Colorbar & Active Round Selector Bar */}
      <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-400">
            {contourMetric === 'DISPLACEMENT_MM'
              ? `3D Radial Displacement u (0.0 → ${scaleBounds.maxDisp.toFixed(1)} mm)`
              : contourMetric === 'CONTINUUM_FOS'
              ? '3D Continuum Factor of Safety (2.2 Safe → 0.8 Yielding)'
              : `3D Plastic Yield Radius Rp (0.0 → ${scaleBounds.maxRp.toFixed(2)} m)`}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-sky-400">Low / Stable</span>
            <div
              className="w-44 h-3 rounded-sm border border-slate-700"
              style={{
                background:
                  'linear-gradient(90deg, #0d59eb 0%, #05c7eb 25%, #1fd959 50%, #f5b814 75%, #f52438 100%)',
              }}
            />
            <span className="text-[10px] font-mono text-rose-400">High / Critical</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Inspect Round in 3D:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {femDemProfile
              .filter((r) => r.status === 'MAPPED')
              .map((r) => (
                <button
                  key={r.pullId}
                  type="button"
                  onClick={() => onSelectPullId(r.pullId)}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer transition ${
                    r.pullId === activeSlice?.pullId
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {r.fromRd}–{r.toRd}m
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
