// Pure TypeScript 2D Plane-Strain Constant Strain Triangle (CST) Finite Element Solver
// + Conformal Tunnel-to-Box Graded Mesh Generator + Marching-Triangles Iso-Contour Extractor
// Operates in true physical meters (x right, y up) on the exact original tunnel shape & size.

export interface MetricPoint2D {
  x: number;
  y: number;
}

export interface TunnelMeshDomain {
  cxSvg: number;
  cySvg: number;
  pxPerMeter: number;
  domHalfW: number;
  domTopY: number;
  domBotY: number;
  plotW: number;
  svgH: number;
  nRings: number;
  nSectors: number;
  nodes: ConformalNode2D[];
  elements: ConformalTriElement[];
  nodeGrid: ConformalNode2D[][];
  perimeterMeters: MetricPoint2D[];
  boundaryEdges: { nodeA: number; nodeB: number; midM: MetricPoint2D; lenM: number; nxIntoVoid: number; nyIntoVoid: number; isCrown: boolean; isWall: boolean; isInvert: boolean }[];
}

export interface ConformalNode2D {
  index: number;
  id: string;
  xM: number;
  yM: number;
  xSvg: number;
  ySvg: number;
  ringIndex: number;
  sectorIndex: number;
  radiusNorm: number;
  angleRad: number;
  isOnTunnelBoundary: boolean;
  isOnOuterBoundary: boolean;
  isOuterLeft: boolean;
  isOuterRight: boolean;
  isOuterTop: boolean;
  isOuterBot: boolean;
}

export interface ConformalTriElement {
  index: number;
  id: string;
  nodeIndices: [number, number, number];
  centroidM: MetricPoint2D;
  centroidSvg: MetricPoint2D;
  areaM2: number;
  radiusNorm: number;
  sectorAngleDeg: number;
  eModulusMpa: number;
  poissonRatio: number;
  cohesionMpa: number;
  frictionDeg: number;
  unitWeightKnM3: number;
  ucsCmMpa: number;
  lithologyName: string;
  lithologyColor: string;
}

export interface FemBoltBarInput {
  x1M: number;
  y1M: number;
  x2M: number;
  y2M: number;
  zone: 'crown' | 'wall';
  steelAreaM2: number;
  steelModulusMpa: number;
  spacingLongM: number;
  tensileCapacityKn: number;
}

export interface FemLinerInput {
  enabled: boolean;
  scope: 'crown_only' | 'crown_wall' | 'full';
  thicknessM: number;
  linerModulusMpa: number;
  ribEquivalentPressureMpa: number;
  wireMeshRetentionMpa: number;
}

export interface FemStageSolution {
  nodeUxMm: Float64Array;
  nodeUyMm: Float64Array;
  nodeDispMm: Float64Array;
  nodeSigmaThetaMpa: Float64Array;
  nodeStrainPct: Float64Array;
  nodeFos: Float64Array;
  elemSigma1Mpa: Float64Array;
  elemSigma3Mpa: Float64Array;
  elemSigmaThetaMpa: Float64Array;
  elemSigmaRadialMpa: Float64Array;
  elemTauMaxMpa: Float64Array;
  elemDispMm: Float64Array;
  elemStrainPct: Float64Array;
  elemFos: Float64Array;
  elemYielded: Uint8Array;
  boltForcesKn: number[];
  boltUtilizationsPct: number[];
  pcgIterations: number;
  plasticIterations: number;
  maxDispMm: number;
  crownDispMm: number;
  wallDispMm: number;
  invertHeaveMm: number;
  maxSigmaThetaMpa: number;
  maxShearStrainPct: number;
  yieldedAreaPct: number;
  maxPlasticDepthM: number;
  continuumFos: number;
}

export function polygonAreaSigned2D(pts: MetricPoint2D[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return 0.5 * s;
}

export function pointInPolygon2D(px: number, py: number, poly: MetricPoint2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function segmentsIntersect2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): { hit: boolean; t: number; u: number; x: number; y: number } {
  const rdx = bx - ax;
  const rdy = by - ay;
  const sdx = dx - cx;
  const sdy = dy - cy;
  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-10) return { hit: false, t: 0, u: 0, x: 0, y: 0 };
  const t = ((cx - ax) * sdy - (cy - ay) * sdx) / denom;
  const u = ((cx - ax) * rdy - (cy - ay) * rdx) / denom;
  if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
    return {
      hit: true,
      t: Math.max(0, Math.min(1, t)),
      u: Math.max(0, Math.min(1, u)),
      x: ax + t * rdx,
      y: ay + t * rdy,
    };
  }
  return { hit: false, t: 0, u: 0, x: 0, y: 0 };
}

/**
 * Casts a ray from (ox, oy) in direction (dx, dy) against a closed polygon.
 * Returns the closest positive intersection t > 0 (or largest t if concave self-test).
 */
function rayIntersectPolygonFirst(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  poly: MetricPoint2D[]
): { pt: MetricPoint2D; t: number } | null {
  let bestT = Infinity;
  let bestPt: MetricPoint2D | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((a.x - ox) * sy - (a.y - oy) * sx) / denom;
    const u = ((a.x - ox) * dy - (a.y - oy) * dx) / denom;
    if (t > 1e-5 && u >= -1e-4 && u <= 1 + 1e-4) {
      if (t < bestT) {
        bestT = t;
        bestPt = { x: ox + t * dx, y: oy + t * dy };
      }
    }
  }
  return bestPt ? { pt: bestPt, t: bestT } : null;
}

/**
 * Builds a graded conformal 2D triangular finite element mesh directly in physical meters
 * from the exact original tunnel perimeter (D-Shape, Horseshoe, Circular, Box, Custom, or Shaft)
 * out to the full rectangular rock-mass domain.
 */
export function buildConformalTunnelMesh(params: {
  rawPerimeterMeters: MetricPoint2D[]; // closed loop in true physical meters (x right, y up)
  spanWidthM: number;
  totalHeightM: number;
  splHeightFromInvertM: number;
  overburdenDepthM: number;
  isVertShaft: boolean;
  lithologyAssigner: (xM: number, yM: number, fracFromTop: number) => {
    lithologyName: string;
    lithologyColor: string;
    eModulusMpa: number;
    poissonRatio: number;
    cohesionMpa: number;
    frictionDeg: number;
    unitWeightKnM3: number;
    ucsCmMpa: number;
  };
  plotW?: number;
  svgH?: number;
}): TunnelMeshDomain {
  const {
    rawPerimeterMeters,
    spanWidthM,
    totalHeightM,
    splHeightFromInvertM,
    overburdenDepthM,
    isVertShaft,
    lithologyAssigner,
    plotW = 492,
    svgH = 440,
  } = params;

  // Ensure perimeter is closed & counter-clockwise in metric (x right, y up) coords
  let cleanPerim = rawPerimeterMeters.filter(
    (p, idx, arr) =>
      idx === 0 || Math.hypot(p.x - arr[idx - 1].x, p.y - arr[idx - 1].y) > 1e-4
  );
  if (cleanPerim.length < 8) {
    cleanPerim = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return { x: (spanWidthM / 2) * Math.cos(a), y: (totalHeightM / 2) * Math.sin(a) };
    });
  }
  if (polygonAreaSigned2D(cleanPerim) < 0) {
    cleanPerim = cleanPerim.slice().reverse();
  }

  // Normalize perimeter bounding box to exact [-spanWidthM/2 .. +spanWidthM/2] and [-totalHeightM/2 .. +totalHeightM/2]
  // so the tunnel profile has the exact physical width & height and is centered at (0, 0)
  let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
  for (const p of cleanPerim) {
    if (p.x < rawMinX) rawMinX = p.x;
    if (p.x > rawMaxX) rawMaxX = p.x;
    if (p.y < rawMinY) rawMinY = p.y;
    if (p.y > rawMaxY) rawMaxY = p.y;
  }
  const rawW = Math.max(1e-3, rawMaxX - rawMinX);
  const rawH = Math.max(1e-3, rawMaxY - rawMinY);
  const rawCx = (rawMinX + rawMaxX) * 0.5;
  const rawCy = (rawMinY + rawMaxY) * 0.5;

  cleanPerim = cleanPerim.map((p) => ({
    x: ((p.x - rawCx) / rawW) * spanWidthM,
    y: ((p.y - rawCy) / rawH) * totalHeightM,
  }));

  const minX = -spanWidthM * 0.5;
  const maxX = spanWidthM * 0.5;
  const minY = -totalHeightM * 0.5;
  const maxY = totalHeightM * 0.5;
  const ox = 0;
  const oy = 0;

  // Physical domain bounds in meters around tunnel center (0, 0)
  // Sized so the domain fills plotW x svgH with strictly 1:1 isotropic metric scaling (pxPerMeter_X === pxPerMeter_Y)!
  const plotAspect = plotW / Math.max(1, svgH);
  const totalDomW = isVertShaft
    ? Math.max(spanWidthM * 2.55, spanWidthM * 2.35 * plotAspect)
    : Math.max(spanWidthM * 2.55, totalHeightM * 2.45 * plotAspect);
  const totalDomH = totalDomW / plotAspect;
  const domHalfW = Number((totalDomW * 0.5).toFixed(4));
  const domTopY = Number((isVertShaft ? totalDomH * 0.5 : totalDomH * 0.55).toFixed(4));
  const domBotY = Number((isVertShaft ? totalDomH * 0.5 : totalDomH * 0.45).toFixed(4));

  // Exact isotropic 1:1 metric scale: 1m horizontally === 1m vertically!
  const pxPerMeter = plotW / totalDomW;
  const cxSvg = domHalfW * pxPerMeter;
  const cySvg = domTopY * pxPerMeter;

  const toSvg = (xM: number, yM: number): MetricPoint2D => ({
    x: Number((cxSvg + xM * pxPerMeter).toFixed(1)),
    y: Number((cySvg - yM * pxPerMeter).toFixed(1)),
  });

  // Explicitly lock onto the 4 outer domain corners + tunnel invert corners + springline transitions + apex
  const splYMetric = minY + Math.max(0.15 * totalHeightM, Math.min(0.85 * totalHeightM, splHeightFromInvertM));
  const cornerAngles = [
    Math.atan2(domTopY - oy, domHalfW - ox),
    Math.atan2(domTopY - oy, -domHalfW - ox),
    Math.atan2(-domBotY - oy, -domHalfW - ox),
    Math.atan2(-domBotY - oy, domHalfW - ox),
  ];
  const keyProfileAngles = isVertShaft
    ? [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]
    : [
        Math.atan2(minY, minX), // Left Invert Corner
        Math.atan2(minY, maxX), // Right Invert Corner
        Math.atan2(splYMetric, minX), // Left Springline (SPL)
        Math.atan2(splYMetric, maxX), // Right Springline (SPL)
        Math.atan2(maxY, 0), // Crown Apex
        Math.atan2(minY, 0), // Invert Center
      ];

  // Detect any additional sharp corners in cleanPerim (turn angle > 18 deg)
  const sharpAngles: number[] = [...keyProfileAngles];
  for (let i = 0; i < cleanPerim.length; i++) {
    const pPrev = cleanPerim[(i - 1 + cleanPerim.length) % cleanPerim.length];
    const pCurr = cleanPerim[i];
    const pNext = cleanPerim[(i + 1) % cleanPerim.length];
    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;
    const d1 = Math.hypot(v1x, v1y);
    const d2 = Math.hypot(v2x, v2y);
    if (d1 > 1e-4 && d2 > 1e-4) {
      const cosA = (v1x * v2x + v1y * v2y) / (d1 * d2);
      if (cosA < 0.95) {
        sharpAngles.push(Math.atan2(pCurr.y - oy, pCurr.x - ox));
      }
    }
  }

  // Generate base uniform angles and merge locked corner angles cleanly
  const targetSectorCount = 64;
  const angleSet: number[] = [];
  for (let i = 0; i < targetSectorCount; i++) {
    angleSet.push(-Math.PI + (i / targetSectorCount) * 2 * Math.PI);
  }
  const snapLockAngle = (ang: number) => {
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < angleSet.length; i++) {
      let diff = Math.abs(angleSet[i] - ang);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    angleSet[bestIdx] = ang;
  };
  for (const ca of cornerAngles) snapLockAngle(ca);
  for (const sa of sharpAngles) snapLockAngle(sa);

  // Deduplicate near-identical angles and sort strictly CCW (-pi .. +pi)
  angleSet.sort((a, b) => a - b);
  const sectorAngles: number[] = [];
  for (const a of angleSet) {
    if (sectorAngles.length === 0 || Math.abs(a - sectorAngles[sectorAngles.length - 1]) > 0.012) {
      sectorAngles.push(a);
    }
  }
  const nSectors = sectorAngles.length;

  // Build ray inner (tunnel) & outer (domain rectangle) endpoints in meters
  const innerPtsM: MetricPoint2D[] = [];
  const outerPtsM: MetricPoint2D[] = [];
  for (let s = 0; s < nSectors; s++) {
    const ang = sectorAngles[s];
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const hitIn = rayIntersectPolygonFirst(ox, oy, dx, dy, cleanPerim);
    const pIn = hitIn
      ? hitIn.pt
      : { x: ox + (spanWidthM / 2) * dx, y: oy + (totalHeightM / 2) * dy };

    const tRight = dx > 1e-6 ? (domHalfW - ox) / dx : Infinity;
    const tLeft = dx < -1e-6 ? (-domHalfW - ox) / dx : Infinity;
    const tTop = dy > 1e-6 ? (domTopY - oy) / dy : Infinity;
    const tBot = dy < -1e-6 ? (-domBotY - oy) / dy : Infinity;
    const tOut = Math.min(tRight, tLeft, tTop, tBot);
    const pOut = {
      x: Number((ox + tOut * dx).toFixed(4)),
      y: Number((oy + tOut * dy).toFixed(4)),
    };
    innerPtsM.push(pIn);
    outerPtsM.push(pOut);
  }

  // Graded radial blending from fine near-tunnel boundary layer (1.02..1.05x) to far-field rectangle
  const ringFracs = [0.0, 0.028, 0.07, 0.13, 0.215, 0.33, 0.48, 0.66, 0.84, 1.0];
  const nRings = ringFracs.length - 1;

  const nodes: ConformalNode2D[] = [];
  const nodeGrid: ConformalNode2D[][] = [];
  const rEqApprox = Math.max(0.5, Math.sqrt((spanWidthM * totalHeightM) / Math.PI));

  for (let r = 0; r <= nRings; r++) {
    const eta = ringFracs[r];
    const row: ConformalNode2D[] = [];
    for (let s = 0; s < nSectors; s++) {
      const pIn = innerPtsM[s];
      const pOut = outerPtsM[s];
      const xM = pIn.x + eta * (pOut.x - pIn.x);
      const yM = pIn.y + eta * (pOut.y - pIn.y);
      const pSvg = toSvg(xM, yM);
      const rFromCenter = Math.hypot(xM - ox, yM - oy);
      const rIn = Math.max(0.25, Math.hypot(pIn.x - ox, pIn.y - oy));
      const radiusNorm = r === 0 ? 1.0 : Math.max(1.01, rFromCenter / rIn);
      const isOuter = r === nRings;

      const node: ConformalNode2D = {
        index: nodes.length,
        id: `nd-${r}-${s}`,
        xM: Number(xM.toFixed(4)),
        yM: Number(yM.toFixed(4)),
        xSvg: pSvg.x,
        ySvg: pSvg.y,
        ringIndex: r,
        sectorIndex: s,
        radiusNorm: Number((radiusNorm * (rIn / rEqApprox) + (1 - rIn / rEqApprox)).toFixed(3)),
        angleRad: sectorAngles[s],
        isOnTunnelBoundary: r === 0,
        isOnOuterBoundary: isOuter,
        isOuterLeft: isOuter && xM <= -domHalfW + 0.04,
        isOuterRight: isOuter && xM >= domHalfW - 0.04,
        isOuterTop: isOuter && yM >= domTopY - 0.04,
        isOuterBot: isOuter && yM <= -domBotY + 0.04,
      };
      nodes.push(node);
      row.push(node);
    }
    nodeGrid.push(row);
  }

  // Construct 2 * nRings * nSectors CST triangular elements with alternating diagonals to remove mesh directional bias
  const elements: ConformalTriElement[] = [];
  const pushTri = (id: string, na: ConformalNode2D, nb: ConformalNode2D, nc: ConformalNode2D) => {
    const twoA = (nb.xM - na.xM) * (nc.yM - na.yM) - (nc.xM - na.xM) * (nb.yM - na.yM);
    // Ensure positive CCW orientation
    const n1 = twoA >= 0 ? na : na;
    const n2 = twoA >= 0 ? nb : nc;
    const n3 = twoA >= 0 ? nc : nb;
    const areaM2 = Math.max(1e-5, Math.abs(twoA) * 0.5);

    const cxM = (n1.xM + n2.xM + n3.xM) / 3;
    const cyM = (n1.yM + n2.yM + n3.yM) / 3;
    const cSvg = toSvg(cxM, cyM);
    const fracFromTop = Math.max(0, Math.min(0.999, (domTopY - cyM) / Math.max(0.1, domTopY + domBotY)));
    const props = lithologyAssigner(cxM, cyM, fracFromTop);

    const elemR = (n1.radiusNorm + n2.radiusNorm + n3.radiusNorm) / 3;
    const angDeg = Math.round(((Math.atan2(cyM - oy, cxM - ox) * 180) / Math.PI + 360) % 360);

    elements.push({
      index: elements.length,
      id,
      nodeIndices: [n1.index, n2.index, n3.index],
      centroidM: { x: Number(cxM.toFixed(3)), y: Number(cyM.toFixed(3)) },
      centroidSvg: cSvg,
      areaM2: Number(areaM2.toFixed(4)),
      radiusNorm: Number(elemR.toFixed(2)),
      sectorAngleDeg: angDeg,
      ...props,
    });
  };

  for (let r = 0; r < nRings; r++) {
    for (let s = 0; s < nSectors; s++) {
      const nextS = (s + 1) % nSectors;
      const n00 = nodeGrid[r][s];
      const n01 = nodeGrid[r][nextS];
      const n10 = nodeGrid[r + 1][s];
      const n11 = nodeGrid[r + 1][nextS];

      if ((r + s) % 2 === 0) {
        pushTri(`tri-${r}-${s}-a`, n00, n01, n10);
        pushTri(`tri-${r}-${s}-b`, n01, n11, n10);
      } else {
        pushTri(`tri-${r}-${s}-a`, n00, n01, n11);
        pushTri(`tri-${r}-${s}-b`, n00, n11, n10);
      }
    }
  }

  // Extract boundary edges on Ring 0 with inward-into-void unit normals and zone classification
  const boundaryEdges = nodeGrid[0].map((na, s) => {
    const nb = nodeGrid[0][(s + 1) % nSectors];
    const ex = nb.xM - na.xM;
    const ey = nb.yM - na.yM;
    const lenM = Math.max(1e-4, Math.hypot(ex, ey));
    // Left-hand normal of CCW loop points INWARD into the void!
    let nx = -ey / lenM;
    let ny = ex / lenM;
    const midX = (na.xM + nb.xM) * 0.5;
    const midY = (na.yM + nb.yM) * 0.5;
    // Verify pointing toward cavity centroid (ox, oy)
    if (nx * (ox - midX) + ny * (oy - midY) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const isInvert = !isVertShaft && midY <= minY + (maxY - minY) * 0.14 && ny > 0.45;
    const isCrown = isVertShaft || (!isInvert && midY >= splYMetric - 0.08);
    const isWall = !isInvert && !isCrown;
    return {
      nodeA: na.index,
      nodeB: nb.index,
      midM: { x: midX, y: midY },
      lenM,
      nxIntoVoid: nx,
      nyIntoVoid: ny,
      isCrown,
      isWall,
      isInvert,
    };
  });

  return {
    cxSvg,
    cySvg,
    pxPerMeter,
    domHalfW,
    domTopY,
    domBotY,
    plotW,
    svgH,
    nRings,
    nSectors,
    nodes,
    elements,
    nodeGrid,
    perimeterMeters: innerPtsM,
    boundaryEdges,
  };
}

/**
 * Solves a symmetric positive-definite linear system Ax = b stored in sparse map rows
 * via Jacobi-Preconditioned Conjugate Gradient (PCG).
 */
function solveSparseSymmetricPCG(
  n: number,
  rows: Map<number, number>[],
  b: Float64Array,
  maxIter = 240,
  tol = 1e-6
): { x: Float64Array; iters: number } {
  const x = new Float64Array(n);
  const r = new Float64Array(n);
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const Ap = new Float64Array(n);
  const invDiag = new Float64Array(n);

  // Extract Jacobi preconditioner M^-1 = 1 / diag(A)
  let bNormSq = 0;
  for (let i = 0; i < n; i++) {
    const d = rows[i].get(i) || 1.0;
    invDiag[i] = d > 1e-12 ? 1.0 / d : 1.0;
    r[i] = b[i];
    z[i] = invDiag[i] * r[i];
    p[i] = z[i];
    bNormSq += b[i] * b[i];
  }

  let rzOld = 0;
  for (let i = 0; i < n; i++) rzOld += r[i] * z[i];
  const targetSq = Math.max(1e-16, bNormSq * tol * tol);

  let it = 0;
  for (; it < maxIter; it++) {
    let rNormSq = 0;
    for (let i = 0; i < n; i++) rNormSq += r[i] * r[i];
    if (rNormSq <= targetSq) break;

    // Ap = A * p
    let pAp = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      rows[i].forEach((val, col) => {
        sum += val * p[col];
      });
      Ap[i] = sum;
      pAp += p[i] * sum;
    }

    if (Math.abs(pAp) < 1e-20) break;
    const alpha = rzOld / pAp;

    let rzNew = 0;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
      z[i] = invDiag[i] * r[i];
      rzNew += r[i] * z[i];
    }

    if (rzOld < 1e-24) break;
    const beta = rzNew / rzOld;
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
    rzOld = rzNew;
  }

  return { x, iters: it };
}

/**
 * Full 2D Plane-Strain Elasto-Plastic Finite Element Solver ([K]{u} = {F})
 * on the conformal tunnel-to-box triangular mesh.
 */
export function solveFemPlaneStrain2D(params: {
  mesh: TunnelMeshDomain;
  overburdenDepthM: number;
  unitWeightKnM3: number;
  k0: number;
  poreWaterKpa: number;
  sigmaV_Mpa: number;
  sigmaH_Mpa: number;
  isVertShaft: boolean;
  isShaftHalfFace: boolean;
  shaftHalfSide: 'left_half' | 'right_half';
  shaftMedianStatus: 'open' | 'closed';
  bolts: FemBoltBarInput[];
  liner: FemLinerInput;
  hoekBrownMb: number;
  hoekBrownS: number;
  hoekBrownA: number;
  intactUcsMpa: number;
}): FemStageSolution {
  const {
    mesh,
    overburdenDepthM,
    unitWeightKnM3,
    k0,
    poreWaterKpa,
    sigmaV_Mpa,
    sigmaH_Mpa,
    isVertShaft,
    isShaftHalfFace,
    shaftHalfSide,
    shaftMedianStatus,
    bolts,
    liner,
  } = params;

  const nNodes = mesh.nodes.length;
  const nElem = mesh.elements.length;
  const nDof = nNodes * 2;
  const uwMpa = poreWaterKpa / 1000;

  // Map each bolt to its nearest boundary node and deepest interior node along the bolt vector
  const boltBarCouplings: {
    boltIdx: number;
    nStart: number;
    nEnd: number;
    dirX: number;
    dirY: number;
    kAxialMpaPerM: number; // MN/m per meter tunnel advance
    lengthM: number;
    steelModulusMpa: number;
    steelAreaM2: number;
    tensileCapacityKn: number;
  }[] = [];

  const findNearestNode = (tx: number, ty: number, ringMin: number, ringMax: number): number => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (const nd of mesh.nodes) {
      if (nd.ringIndex < ringMin || nd.ringIndex > ringMax) continue;
      const d = Math.hypot(nd.xM - tx, nd.yM - ty);
      if (d < bestD) {
        bestD = d;
        bestIdx = nd.index;
      }
    }
    return bestIdx;
  };

  bolts.forEach((b, bIdx) => {
    const nStart = findNearestNode(b.x1M, b.y1M, 0, 0);
    const nEnd = findNearestNode(b.x2M, b.y2M, 2, mesh.nRings - 1);
    if (nStart !== nEnd) {
      const p1 = mesh.nodes[nStart];
      const p2 = mesh.nodes[nEnd];
      const dx = p2.xM - p1.xM;
      const dy = p2.yM - p1.yM;
      const L = Math.max(0.5, Math.hypot(dx, dy));
      // Stiffness per linear meter of tunnel axis = (E_s * A_s) / (L * spacingLongM)
      const kAxial = (b.steelModulusMpa * b.steelAreaM2) / (L * Math.max(0.4, b.spacingLongM));
      boltBarCouplings.push({
        boltIdx: bIdx,
        nStart,
        nEnd,
        dirX: dx / L,
        dirY: dy / L,
        kAxialMpaPerM: kAxial,
        lengthM: L,
        steelModulusMpa: b.steelModulusMpa,
        steelAreaM2: b.steelAreaM2,
        tensileCapacityKn: b.tensileCapacityKn,
      });
    }
  });

  // Compute initial in-situ geostatic stress field (compression positive in MPa)
  const elemInitSx = new Float64Array(nElem);
  const elemInitSy = new Float64Array(nElem);
  const avgE_Mpa =
    mesh.elements.reduce((acc, el) => acc + el.eModulusMpa, 0) / Math.max(1, nElem);

  for (let e = 0; e < nElem; e++) {
    const el = mesh.elements[e];
    if (isVertShaft) {
      elemInitSy[e] = Math.max(0.1, sigmaH_Mpa * (k0 >= 1 ? 0.9 : 0.96));
      elemInitSx[e] = Math.max(0.1, sigmaH_Mpa);
    } else {
      const localDepthM = Math.max(1.5, overburdenDepthM - el.centroidM.y);
      const sv = Math.max(0.05, (unitWeightKnM3 * localDepthM) / 1000);
      elemInitSy[e] = sv;
      elemInitSx[e] = Math.max(0.03, sv * k0);
    }
  }

  // Excavation unloading force vector {F_exc} in MN per meter out-of-plane
  const fExc = new Float64Array(nDof);
  for (const edge of mesh.boundaryEdges) {
    // Support internal confining pressure if passive ribs/mesh/liner pressure applies
    let supportTractionMpa = 0;
    if (liner.enabled) {
      const appliesHere =
        liner.scope === 'full' ||
        (liner.scope === 'crown_only' && edge.isCrown) ||
        (liner.scope === 'crown_wall' && (edge.isCrown || edge.isWall));
      if (appliesHere) {
        supportTractionMpa = liner.ribEquivalentPressureMpa + liner.wireMeshRetentionMpa;
      }
    }

    let edgeSigmaY = sigmaV_Mpa;
    let edgeSigmaX = sigmaH_Mpa;
    if (!isVertShaft) {
      const depthAtEdge = Math.max(1.2, overburdenDepthM - edge.midM.y);
      edgeSigmaY = (unitWeightKnM3 * depthAtEdge) / 1000;
      edgeSigmaX = edgeSigmaY * k0;
    } else {
      edgeSigmaY = sigmaH_Mpa * 0.94;
      edgeSigmaX = sigmaH_Mpa;
    }

    // Half-face shaft closed median buttresses opposite wall
    let edgeActiveMult = 1.0;
    if (isVertShaft && isShaftHalfFace && shaftMedianStatus === 'closed') {
      const onClosedSide =
        shaftHalfSide === 'right_half' ? edge.midM.x < -0.05 : edge.midM.x > 0.05;
      if (onClosedSide) edgeActiveMult = 0.25;
    }

    const effSigX = Math.max(0.02, (edgeSigmaX + uwMpa * 0.45 - supportTractionMpa) * edgeActiveMult);
    const effSigY = Math.max(0.02, (edgeSigmaY + uwMpa * 0.45 - supportTractionMpa) * edgeActiveMult);

    const tx = effSigX * edge.nxIntoVoid;
    const ty = effSigY * edge.nyIntoVoid;

    // Consistent nodal force per boundary edge = (L / 2) * t
    const fxHalf = 0.5 * edge.lenM * tx;
    const fyHalf = 0.5 * edge.lenM * ty;
    fExc[edge.nodeA * 2] += fxHalf;
    fExc[edge.nodeA * 2 + 1] += fyHalf;
    fExc[edge.nodeB * 2] += fxHalf;
    fExc[edge.nodeB * 2 + 1] += fyHalf;
  }

  // Secant modulus multipliers per element (updated in elasto-plastic iterations)
  const elemSecantScale = new Float64Array(nElem).fill(1.0);
  const elemPlasticBodyY = new Float64Array(nElem).fill(0);
  const elemYielded = new Uint8Array(nElem);

  const elemSigma1 = new Float64Array(nElem);
  const elemSigma3 = new Float64Array(nElem);
  const elemSigmaTheta = new Float64Array(nElem);
  const elemSigmaRadial = new Float64Array(nElem);
  const elemTauMax = new Float64Array(nElem);
  const elemStrainPct = new Float64Array(nElem);
  const elemFos = new Float64Array(nElem);
  const elemDispMm = new Float64Array(nElem);

  const nPlasticPasses = 3;
  let lastU: Float64Array<ArrayBufferLike> = new Float64Array(nDof);
  let totalPcgIters = 0;

  for (let pass = 0; pass < nPlasticPasses; pass++) {
    const rows: Map<number, number>[] = Array.from({ length: nDof }, () => new Map<number, number>());
    const addK = (rIdx: number, cIdx: number, val: number) => {
      if (Math.abs(val) < 1e-14) return;
      rows[rIdx].set(cIdx, (rows[rIdx].get(cIdx) || 0) + val);
    };

    const fTotal = new Float64Array(fExc);

    // 1. Assemble all CST triangular elements
    for (let e = 0; e < nElem; e++) {
      const el = mesh.elements[e];
      const [i0, i1, i2] = el.nodeIndices;
      const n0 = mesh.nodes[i0];
      const n1 = mesh.nodes[i1];
      const n2 = mesh.nodes[i2];

      const twoA = (n1.xM - n0.xM) * (n2.yM - n0.yM) - (n2.xM - n0.xM) * (n1.yM - n0.yM);
      const area = Math.max(1e-5, Math.abs(twoA) * 0.5);
      const inv2A = 1.0 / (Math.abs(twoA) + 1e-9);

      const b = [n1.yM - n2.yM, n2.yM - n0.yM, n0.yM - n1.yM];
      const c = [n2.xM - n1.xM, n0.xM - n2.xM, n1.xM - n0.xM];

      const E = Math.max(40, el.eModulusMpa * elemSecantScale[e]);
      const nu = Math.max(0.12, Math.min(0.42, el.poissonRatio));
      const coeff = E / ((1 + nu) * (1 - 2 * nu));
      const d11 = coeff * (1 - nu);
      const d12 = coeff * nu;
      const d33 = coeff * (1 - 2 * nu) * 0.5;

      // k_e = area * B^T * D * B = (1 / (4 * area)) * (B_raw^T * D * B_raw)
      const factor = area * inv2A * inv2A;
      const dofs = [i0 * 2, i0 * 2 + 1, i1 * 2, i1 * 2 + 1, i2 * 2, i2 * 2 + 1];

      // Rows of B_raw (scaled by inv2A inside factor)
      const Bx = [b[0], 0, b[1], 0, b[2], 0];
      const By = [0, c[0], 0, c[1], 0, c[2]];
      const Bxy = [c[0], b[0], c[1], b[1], c[2], b[2]];

      for (let p = 0; p < 6; p++) {
        const db0 = d11 * Bx[p] + d12 * By[p];
        const db1 = d12 * Bx[p] + d11 * By[p];
        const db2 = d33 * Bxy[p];
        for (let q = p; q < 6; q++) {
          const val = factor * (Bx[q] * db0 + By[q] * db1 + Bxy[q] * db2);
          addK(dofs[p], dofs[q], val);
          if (p !== q) addK(dofs[q], dofs[p], val);
        }
      }

      // Apply downward gravity loosening body force inside yielded crown zones
      if (elemPlasticBodyY[e] > 0) {
        const fyNode = -(elemPlasticBodyY[e] * area) / 3;
        fTotal[i0 * 2 + 1] += fyNode;
        fTotal[i1 * 2 + 1] += fyNode;
        fTotal[i2 * 2 + 1] += fyNode;
      }
    }

    // 2. Assemble Stage B Rockbolt 1D Axial Bar Elements
    for (const bc of boltBarCouplings) {
      const d0 = bc.nStart * 2;
      const d1 = bc.nStart * 2 + 1;
      const d2 = bc.nEnd * 2;
      const d3 = bc.nEnd * 2 + 1;
      const k = bc.kAxialMpaPerM;
      const cxx = k * bc.dirX * bc.dirX;
      const cxy = k * bc.dirX * bc.dirY;
      const cyy = k * bc.dirY * bc.dirY;

      addK(d0, d0, cxx); addK(d0, d1, cxy); addK(d1, d0, cxy); addK(d1, d1, cyy);
      addK(d2, d2, cxx); addK(d2, d3, cxy); addK(d3, d2, cxy); addK(d3, d3, cyy);
      addK(d0, d2, -cxx); addK(d2, d0, -cxx);
      addK(d1, d3, -cyy); addK(d3, d1, -cyy);
      addK(d0, d3, -cxy); addK(d3, d0, -cxy);
      addK(d1, d2, -cxy); addK(d2, d1, -cxy);
    }

    // 3. Assemble Stage B Shotcrete / Liner Tangential Membrane & Radial Restraint Elements
    if (liner.enabled && liner.thicknessM > 0) {
      for (const edge of mesh.boundaryEdges) {
        const appliesHere =
          liner.scope === 'full' ||
          (liner.scope === 'crown_only' && edge.isCrown) ||
          (liner.scope === 'crown_wall' && (edge.isCrown || edge.isWall));
        if (!appliesHere) continue;

        const na = mesh.nodes[edge.nodeA];
        const nb = mesh.nodes[edge.nodeB];
        const dx = nb.xM - na.xM;
        const dy = nb.yM - na.yM;
        const L = Math.max(0.05, Math.hypot(dx, dy));
        const tx = dx / L;
        const ty = dy / L;
        const kLiner = (liner.linerModulusMpa * liner.thicknessM) / L;

        const d0 = edge.nodeA * 2;
        const d1 = edge.nodeA * 2 + 1;
        const d2 = edge.nodeB * 2;
        const d3 = edge.nodeB * 2 + 1;
        const cxx = kLiner * tx * tx;
        const cxy = kLiner * tx * ty;
        const cyy = kLiner * ty * ty;

        addK(d0, d0, cxx); addK(d0, d1, cxy); addK(d1, d0, cxy); addK(d1, d1, cyy);
        addK(d2, d2, cxx); addK(d2, d3, cxy); addK(d3, d2, cxy); addK(d3, d3, cyy);
        addK(d0, d2, -cxx); addK(d2, d0, -cxx);
        addK(d1, d3, -cyy); addK(d3, d1, -cyy);
        addK(d0, d3, -cxy); addK(d3, d0, -cxy);
        addK(d1, d2, -cxy); addK(d2, d1, -cxy);

        // Radial flexural ring stiffness around tunnel liner
        const kRad = (liner.linerModulusMpa * Math.pow(liner.thicknessM, 2) * 1.4) / Math.max(1, mesh.domHalfW * 0.25);
        addK(d0, d0, kRad * edge.nxIntoVoid * edge.nxIntoVoid * 0.5);
        addK(d1, d1, kRad * edge.nyIntoVoid * edge.nyIntoVoid * 0.5);
        addK(d2, d2, kRad * edge.nxIntoVoid * edge.nxIntoVoid * 0.5);
        addK(d3, d3, kRad * edge.nyIntoVoid * edge.nyIntoVoid * 0.5);
      }
    }

    // 4. Far-Field Boundary Conditions (Elastic Half-Space / Fixed Base / Lateral Rollers)
    const kPenalty = avgE_Mpa * 1e4;
    const isShallowNearSurface = !isVertShaft && overburdenDepthM <= mesh.domTopY * 1.35;
    const farFieldTopSpring = isShallowNearSurface
      ? 0.0
      : (avgE_Mpa / Math.max(mesh.domTopY * 2.5, overburdenDepthM)) * 0.85;
    const sectorAvgEdgeM = (mesh.domHalfW * 2) / (mesh.nSectors * 0.25);

    for (const nd of mesh.nodes) {
      if (!nd.isOnOuterBoundary) continue;
      const uxDof = nd.index * 2;
      const uyDof = nd.index * 2 + 1;

      if (isVertShaft) {
        // Horizontal rock mass far-field elastic spring on all 4 sides
        const kFar = (avgE_Mpa / Math.max(4, mesh.domHalfW * 1.8)) * sectorAvgEdgeM;
        addK(uxDof, uxDof, kFar);
        addK(uyDof, uyDof, kFar);
      } else {
        if (nd.isOuterBot) {
          addK(uyDof, uyDof, kPenalty); // u_y = 0 at base
          if (nd.isOuterLeft || nd.isOuterRight) {
            addK(uxDof, uxDof, kPenalty);
          } else {
            addK(uxDof, uxDof, (avgE_Mpa / Math.max(4, mesh.domHalfW)) * sectorAvgEdgeM * 0.35);
          }
        }
        if (nd.isOuterLeft || nd.isOuterRight) {
          addK(uxDof, uxDof, kPenalty); // u_x = 0 horizontal roller
          addK(uyDof, uyDof, (avgE_Mpa / Math.max(6, overburdenDepthM)) * sectorAvgEdgeM * 0.45);
        }
        if (nd.isOuterTop && farFieldTopSpring > 0) {
          addK(uyDof, uyDof, farFieldTopSpring * sectorAvgEdgeM);
        }
      }
    }

    // Solve [K]{u} = {fTotal}
    const { x: uSol, iters } = solveSparseSymmetricPCG(nDof, rows, fTotal, 220, 1e-6);
    lastU = uSol;
    totalPcgIters += iters;

    // 5. Recover element strains, stresses & check Mohr-Coulomb / Hoek-Brown yield for next plastic pass
    for (let e = 0; e < nElem; e++) {
      const el = mesh.elements[e];
      const [i0, i1, i2] = el.nodeIndices;
      const n0 = mesh.nodes[i0];
      const n1 = mesh.nodes[i1];
      const n2 = mesh.nodes[i2];

      const twoA = (n1.xM - n0.xM) * (n2.yM - n0.yM) - (n2.xM - n0.xM) * (n1.yM - n0.yM);
      const inv2A = 1.0 / (Math.abs(twoA) + 1e-9);
      const signFix = twoA >= 0 ? 1 : -1;

      const b = [(n1.yM - n2.yM) * signFix, (n2.yM - n0.yM) * signFix, (n0.yM - n1.yM) * signFix];
      const c = [(n2.xM - n1.xM) * signFix, (n0.xM - n2.xM) * signFix, (n1.xM - n0.xM) * signFix];

      const u0x = lastU[i0 * 2], u0y = lastU[i0 * 2 + 1];
      const u1x = lastU[i1 * 2], u1y = lastU[i1 * 2 + 1];
      const u2x = lastU[i2 * 2], u2y = lastU[i2 * 2 + 1];

      const epsX = (b[0] * u0x + b[1] * u1x + b[2] * u2x) * inv2A;
      const epsY = (c[0] * u0y + c[1] * u1y + c[2] * u2y) * inv2A;
      const gamXY = (c[0] * u0x + b[0] * u0y + c[1] * u1x + b[1] * u1y + c[2] * u2x + b[2] * u2y) * inv2A;

      const E = Math.max(40, el.eModulusMpa * elemSecantScale[e]);
      const nu = Math.max(0.12, Math.min(0.42, el.poissonRatio));
      const coeff = E / ((1 + nu) * (1 - 2 * nu));
      const d11 = coeff * (1 - nu);
      const d12 = coeff * nu;
      const d33 = coeff * (1 - 2 * nu) * 0.5;

      // Compression-positive stress change: Δσ_comp = -D * ε
      const dSx = -(d11 * epsX + d12 * epsY);
      const dSy = -(d12 * epsX + d11 * epsY);
      const dTxy = -(d33 * gamXY);

      const sx = elemInitSx[e] + dSx;
      const sy = elemInitSy[e] + dSy;
      const txy = dTxy;

      const sMean = 0.5 * (sx + sy);
      const radiusStress = Math.sqrt(Math.pow(0.5 * (sx - sy), 2) + txy * txy);
      const s1 = sMean + radiusStress;
      const s3 = sMean - radiusStress;

      // Project into radial & tangential components relative to tunnel center
      const ang = Math.atan2(el.centroidM.y, el.centroidM.x);
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const sigR = sx * cosA * cosA + sy * sinA * sinA + 2 * txy * sinA * cosA;
      const sigTheta = sx * sinA * sinA + sy * cosA * cosA - 2 * txy * sinA * cosA;

      const gammaMax = Math.sqrt(Math.pow(epsX - epsY, 2) + gamXY * gamXY);

      // Mohr-Coulomb / Hoek-Brown Strength Capacity
      const phiRad = (el.frictionDeg * Math.PI) / 180;
      const kPhi = (1 + Math.sin(phiRad)) / (1 - Math.sin(phiRad));
      const effS3 = Math.max(0, s3 - uwMpa * 0.35);
      const strengthCap = Math.max(0.15, el.ucsCmMpa + kPhi * effS3);
      const localFos = Math.max(0.35, Math.min(4.8, strengthCap / Math.max(0.12, s1)));

      const dispAvgMm =
        ((Math.hypot(u0x, u0y) + Math.hypot(u1x, u1y) + Math.hypot(u2x, u2y)) / 3) * 1000;

      elemSigma1[e] = Number(s1.toFixed(2));
      elemSigma3[e] = Number(s3.toFixed(2));
      elemSigmaTheta[e] = Number(Math.max(0.02, Math.abs(sigTheta)).toFixed(2));
      elemSigmaRadial[e] = Number(Math.max(0, sigR).toFixed(2));
      elemTauMax[e] = Number(radiusStress.toFixed(2));
      elemStrainPct[e] = Number((gammaMax * 100).toFixed(3));
      elemFos[e] = Number(localFos.toFixed(2));
      elemDispMm[e] = Number(dispAvgMm.toFixed(2));

      const isYielding = localFos < 1.05 || (s3 < -0.15 * el.cohesionMpa && el.radiusNorm < 2.2);
      elemYielded[e] = isYielding ? 1 : 0;

      if (pass < nPlasticPasses - 1 && isYielding) {
        // Reduce secant stiffness in yielded zone to redistribute arch stress outward
        const softTarget = Math.max(0.22, Math.min(0.85, 0.25 + 0.58 * localFos));
        elemSecantScale[e] = Math.min(elemSecantScale[e], softTarget);
        // Add gravity dead-load loosening for yielded crown arch elements
        if (!isVertShaft && el.centroidM.y > 0) {
          elemPlasticBodyY[e] = (el.unitWeightKnM3 / 1000) * 0.45 * (1 - Math.min(1, localFos));
        }
      }
    }
  }

  // Extract nodal displacements (mm) and area-weighted nodal smoothed stress/strain/FoS
  const nodeUxMm = new Float64Array(nNodes);
  const nodeUyMm = new Float64Array(nNodes);
  const nodeDispMm = new Float64Array(nNodes);
  for (let i = 0; i < nNodes; i++) {
    const ux = lastU[i * 2] * 1000;
    const uy = lastU[i * 2 + 1] * 1000;
    nodeUxMm[i] = Number(ux.toFixed(2));
    nodeUyMm[i] = Number(uy.toFixed(2));
    nodeDispMm[i] = Number(Math.hypot(ux, uy).toFixed(2));
  }

  const nodeSigAccum = new Float64Array(nNodes);
  const nodeStrainAccum = new Float64Array(nNodes);
  const nodeFosAccum = new Float64Array(nNodes);
  const nodeWeightAccum = new Float64Array(nNodes);

  for (let e = 0; e < nElem; e++) {
    const el = mesh.elements[e];
    const w = Math.max(1e-4, el.areaM2);
    for (const ni of el.nodeIndices) {
      nodeSigAccum[ni] += elemSigmaTheta[e] * w;
      nodeStrainAccum[ni] += elemStrainPct[e] * w;
      nodeFosAccum[ni] += elemFos[e] * w;
      nodeWeightAccum[ni] += w;
    }
  }

  const nodeSigmaThetaMpa = new Float64Array(nNodes);
  const nodeStrainPct = new Float64Array(nNodes);
  const nodeFos = new Float64Array(nNodes);
  for (let i = 0; i < nNodes; i++) {
    const w = Math.max(1e-5, nodeWeightAccum[i]);
    nodeSigmaThetaMpa[i] = Number((nodeSigAccum[i] / w).toFixed(2));
    nodeStrainPct[i] = Number((nodeStrainAccum[i] / w).toFixed(3));
    nodeFos[i] = Number((nodeFosAccum[i] / w).toFixed(2));
  }

  // Evaluate bolt axial forces directly from solved nodal elongation ΔL along each bolt axis
  const boltForcesKn: number[] = [];
  const boltUtilizationsPct: number[] = [];
  for (const bc of boltBarCouplings) {
    const duX = lastU[bc.nStart * 2] - lastU[bc.nEnd * 2];
    const duY = lastU[bc.nStart * 2 + 1] - lastU[bc.nEnd * 2 + 1];
    // Elongation is inward displacement at collar minus displacement at anchor
    const dL = Math.abs(duX * -bc.dirX + duY * -bc.dirY);
    const forceMn = ((bc.steelModulusMpa * bc.steelAreaM2) / bc.lengthM) * dL;
    const forceKn = Math.min(bc.tensileCapacityKn, Math.max(0, forceMn * 1000));
    boltForcesKn.push(Number(forceKn.toFixed(1)));
    boltUtilizationsPct.push(
      Number(Math.min(100, (forceKn / Math.max(1, bc.tensileCapacityKn)) * 100).toFixed(1))
    );
  }

  // Summarize key boundary & rock-mass response metrics directly from solved FEA state
  let maxDispMm = 0;
  let crownDispMm = 0;
  let wallDispMm = 0;
  let invertHeaveMm = 0;
  for (const edge of mesh.boundaryEdges) {
    const dA = nodeDispMm[edge.nodeA];
    const dB = nodeDispMm[edge.nodeB];
    const d = Math.max(dA, dB);
    if (d > maxDispMm) maxDispMm = d;
    if (edge.isCrown && d > crownDispMm) crownDispMm = d;
    if (edge.isWall && d > wallDispMm) wallDispMm = d;
    if (edge.isInvert && d > invertHeaveMm) invertHeaveMm = d;
  }

  let maxSigmaThetaMpa = 0;
  let maxShearStrainPct = 0;
  let totalArea = 0;
  let yieldedArea = 0;
  let maxPlasticDepthM = 0;
  let minEdgeFos = 4.5;

  for (let e = 0; e < nElem; e++) {
    const el = mesh.elements[e];
    totalArea += el.areaM2;
    if (elemSigmaTheta[e] > maxSigmaThetaMpa) maxSigmaThetaMpa = elemSigmaTheta[e];
    if (elemStrainPct[e] > maxShearStrainPct) maxShearStrainPct = elemStrainPct[e];
    if (elemYielded[e]) {
      yieldedArea += el.areaM2;
      // Distance from centroid to nearest Ring 0 boundary node
      let minDistBoundary = Infinity;
      for (const bNode of mesh.nodeGrid[0]) {
        const d = Math.hypot(el.centroidM.x - bNode.xM, el.centroidM.y - bNode.yM);
        if (d < minDistBoundary) minDistBoundary = d;
      }
      if (minDistBoundary > maxPlasticDepthM) maxPlasticDepthM = minDistBoundary;
    }
    if (el.radiusNorm <= 1.45 && elemFos[e] < minEdgeFos) {
      minEdgeFos = elemFos[e];
    }
  }

  const yieldedAreaPct = (yieldedArea / Math.max(1e-3, totalArea)) * 100;

  return {
    nodeUxMm,
    nodeUyMm,
    nodeDispMm,
    nodeSigmaThetaMpa,
    nodeStrainPct,
    nodeFos,
    elemSigma1Mpa: elemSigma1,
    elemSigma3Mpa: elemSigma3,
    elemSigmaThetaMpa: elemSigmaTheta,
    elemSigmaRadialMpa: elemSigmaRadial,
    elemTauMaxMpa: elemTauMax,
    elemDispMm,
    elemStrainPct,
    elemFos,
    elemYielded,
    boltForcesKn,
    boltUtilizationsPct,
    pcgIterations: totalPcgIters,
    plasticIterations: nPlasticPasses,
    maxDispMm: Number(maxDispMm.toFixed(2)),
    crownDispMm: Number(crownDispMm.toFixed(2)),
    wallDispMm: Number(wallDispMm.toFixed(2)),
    invertHeaveMm: Number(invertHeaveMm.toFixed(2)),
    maxSigmaThetaMpa: Number(maxSigmaThetaMpa.toFixed(2)),
    maxShearStrainPct: Number(maxShearStrainPct.toFixed(3)),
    yieldedAreaPct: Number(yieldedAreaPct.toFixed(1)),
    maxPlasticDepthM: Number(maxPlasticDepthM.toFixed(2)),
    continuumFos: Number(minEdgeFos.toFixed(2)),
  };
}

interface ScalarVertex2D {
  x: number;
  y: number;
  v: number;
}

function clipPolyAgainstHalfPlane(
  poly: ScalarVertex2D[],
  threshold: number,
  keepGreaterOrEqual: boolean
): ScalarVertex2D[] {
  if (poly.length === 0) return [];
  const out: ScalarVertex2D[] = [];
  const isInside = (val: number) =>
    keepGreaterOrEqual ? val >= threshold - 1e-9 : val <= threshold + 1e-9;

  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const curIn = isInside(cur.v);
    const nxtIn = isInside(nxt.v);

    if (curIn && nxtIn) {
      out.push(nxt);
    } else if (curIn && !nxtIn) {
      const denom = nxt.v - cur.v;
      const t = Math.abs(denom) > 1e-12 ? (threshold - cur.v) / denom : 0;
      const ct = Math.max(0, Math.min(1, t));
      out.push({
        x: cur.x + ct * (nxt.x - cur.x),
        y: cur.y + ct * (nxt.y - cur.y),
        v: threshold,
      });
    } else if (!curIn && nxtIn) {
      const denom = nxt.v - cur.v;
      const t = Math.abs(denom) > 1e-12 ? (threshold - cur.v) / denom : 0;
      const ct = Math.max(0, Math.min(1, t));
      out.push({
        x: cur.x + ct * (nxt.x - cur.x),
        y: cur.y + ct * (nxt.y - cur.y),
        v: threshold,
      });
      out.push(nxt);
    }
  }
  return out;
}

/**
 * Generates exact Marching-Triangles discrete iso-contour polygons for each triangle
 * across `palette.length` evenly spaced bands in `[minVal, maxVal]`.
 * Zero smoothed approximation or fake blobs — every color band edge lies on an exact FEA contour line!
 */
export function buildMarchingTriangleIsoBands(
  triVerts: [ScalarVertex2D, ScalarVertex2D, ScalarVertex2D][],
  minVal: number,
  maxVal: number,
  palette: string[]
): { color: string; pathD: string }[] {
  const nBands = palette.length;
  const span = Math.max(1e-6, maxVal - minVal);
  const step = span / nBands;
  const buckets: string[][] = Array.from({ length: nBands }, () => []);

  for (let tIdx = 0; tIdx < triVerts.length; tIdx++) {
    const tri = triVerts[tIdx];
    const vMin = Math.min(tri[0].v, tri[1].v, tri[2].v);
    const vMax = Math.max(tri[0].v, tri[1].v, tri[2].v);

    const bStart = Math.max(0, Math.min(nBands - 1, Math.floor((vMin - minVal) / step)));
    const bEnd = Math.max(0, Math.min(nBands - 1, Math.floor((vMax - minVal) / step)));

    if (bStart === bEnd) {
      buckets[bStart].push(
        `M${tri[0].x.toFixed(1)} ${tri[0].y.toFixed(1)}L${tri[1].x.toFixed(1)} ${tri[1].y.toFixed(1)}L${tri[2].x.toFixed(1)} ${tri[2].y.toFixed(1)}Z`
      );
      continue;
    }

    for (let b = bStart; b <= bEnd; b++) {
      let poly: ScalarVertex2D[] = tri;
      if (b > 0) {
        poly = clipPolyAgainstHalfPlane(poly, minVal + b * step, true);
      }
      if (b < nBands - 1 && poly.length >= 3) {
        poly = clipPolyAgainstHalfPlane(poly, minVal + (b + 1) * step, false);
      }
      if (poly.length >= 3) {
        let d = `M${poly[0].x.toFixed(1)} ${poly[0].y.toFixed(1)}`;
        for (let k = 1; k < poly.length; k++) {
          d += `L${poly[k].x.toFixed(1)} ${poly[k].y.toFixed(1)}`;
        }
        d += 'Z';
        buckets[b].push(d);
      }
    }
  }

  return palette
    .map((color, idx) => ({
      color,
      pathD: buckets[idx].join(''),
    }))
    .filter((b) => b.pathD.length > 0);
}
