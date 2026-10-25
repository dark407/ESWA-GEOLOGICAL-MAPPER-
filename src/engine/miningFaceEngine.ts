// ============================================================================
// ESWA UNDERGROUND MINING FACE & GRADE CONTROL GEOTECHNICAL ENGINE
// ============================================================================
// Covers all underground mining excavation shapes (D-arch, Horseshoe,
// Rectangular / Flat-roof, Shanty, Gothic arch, Parametric & DXF boundaries),
// Face-only clipping, Channel sample true thickness & mass-weighted composites,
// Laubscher MRMR, Mathews-Potvin Stope Stability (N vs HR), Surpac/Deswik DXF & CSV
// ============================================================================

import {
  MiningGeologicalPoint,
  MiningStopeShape,
  MiningGeologicalFeature,
  MiningStopeItem,
} from '../types/mining';
import { FaceChannelSampleRecord } from '../types/tunnel';

// ----------------------------------------------------------------------------
// 1. STOPE PROFILE POLYGON GENERATORS
// ----------------------------------------------------------------------------

export interface StopeProfileMetrics {
  points: MiningGeologicalPoint[];
  widthM: number;
  heightM: number;
  wallHeightM: number;
  areaM2: number;
  perimeterM: number;
  hydraulicRadiusM: number; // HR = Area / Perimeter
  svgPath: string;
}

/**
 * Generates an ordered closed polygon of points in metric units (x in [0, width], y in [0, height]).
 * The bottom floor is centered horizontally or at [0, 0].
 */
export function generateMiningStopePolygon(
  shape: MiningStopeShape,
  width: number,
  height: number,
  wallHeight?: number,
  crownRadius?: number,
  customPoints?: MiningGeologicalPoint[]
): StopeProfileMetrics {
  const w = Math.max(1.5, width || 4.8);
  const h = Math.max(1.5, height || 4.2);
  const wh = Math.min(h - 0.2, Math.max(0.5, wallHeight ?? h * 0.65));

  // If custom DXF points or custom polygon provided
  if ((shape === 'custom_parametric' || shape === 'dxf_import') && customPoints && customPoints.length >= 3) {
    const pts = normalizeCustomPointsToEnvelope(customPoints, w, h);
    return calculatePolygonMetrics(pts, w, h, wh);
  }

  const pts: MiningGeologicalPoint[] = [];

  switch (shape) {
    case 'rectangular_flat': {
      // Room & Pillar / Cut & Fill flat back stope
      pts.push({ x: 0, y: 0 });
      pts.push({ x: 0, y: h });
      pts.push({ x: w, y: h });
      pts.push({ x: w, y: 0 });
      break;
    }

    case 'horseshoe': {
      // High-stress deep level drive (curved sidewalls and rounded invert corners)
      pts.push({ x: 0.1 * w, y: 0 });
      pts.push({ x: 0, y: 0.2 * h });
      pts.push({ x: 0, y: wh });
      // Crown arc
      const numCrownSteps = 12;
      const crownCenterY = wh;
      const rX = w / 2;
      const rY = h - wh;
      for (let i = 0; i <= numCrownSteps; i++) {
        const theta = Math.PI - (i / numCrownSteps) * Math.PI;
        const cx = w / 2 + rX * Math.cos(theta);
        const cy = crownCenterY + rY * Math.sin(theta);
        pts.push({ x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) });
      }
      pts.push({ x: w, y: 0.2 * h });
      pts.push({ x: 0.9 * w, y: 0 });
      break;
    }

    case 'shanty': {
      // Asymmetric crown for weak hangingwall/footwall shear zones
      // Left wall higher or right wall higher
      pts.push({ x: 0, y: 0 });
      pts.push({ x: 0, y: wh * 1.15 }); // Higher HW side
      pts.push({ x: 0.3 * w, y: h }); // Apex shifted to one side
      pts.push({ x: w, y: wh * 0.75 }); // Lower FW side
      pts.push({ x: w, y: 0 });
      break;
    }

    case 'gothic_arch': {
      // High vertical stress arched stope (pointed ogive arch)
      pts.push({ x: 0, y: 0 });
      pts.push({ x: 0, y: wh });
      // Left arch to peak
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = (w / 2) * t;
        const py = wh + (h - wh) * Math.sin((t * Math.PI) / 2);
        pts.push({ x: Number(px.toFixed(3)), y: Number(py.toFixed(3)) });
      }
      // Peak apex
      pts.push({ x: w / 2, y: h });
      // Right arch from peak
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = w / 2 + (w / 2) * t;
        const py = h - (h - wh) * (1 - Math.cos((t * Math.PI) / 2));
        pts.push({ x: Number(px.toFixed(3)), y: Number(py.toFixed(3)) });
      }
      pts.push({ x: w, y: wh });
      pts.push({ x: w, y: 0 });
      break;
    }

    case 'd_arch':
    default: {
      // Standard D-Arch / arched roof with vertical sidewalls
      pts.push({ x: 0, y: 0 });
      pts.push({ x: 0, y: wh });
      // Semi-elliptical or circular crown arc
      const numCrownSteps = 14;
      const rX = w / 2;
      const rY = h - wh;
      for (let i = 0; i <= numCrownSteps; i++) {
        const theta = Math.PI - (i / numCrownSteps) * Math.PI;
        const cx = w / 2 + rX * Math.cos(theta);
        const cy = wh + rY * Math.sin(theta);
        pts.push({ x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) });
      }
      pts.push({ x: w, y: wh });
      pts.push({ x: w, y: 0 });
      break;
    }
  }

  return calculatePolygonMetrics(pts, w, h, wh);
}

/**
 * Normalizes an arbitrary set of polygon points into the [0, w] x [0, h] envelope
 */
function normalizeCustomPointsToEnvelope(
  points: MiningGeologicalPoint[],
  targetW: number,
  targetH: number
): MiningGeologicalPoint[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const origW = Math.max(0.01, maxX - minX);
  const origH = Math.max(0.01, maxY - minY);

  return points.map((p) => ({
    x: Number((((p.x - minX) / origW) * targetW).toFixed(3)),
    y: Number((((p.y - minY) / origH) * targetH).toFixed(3)),
  }));
}

/**
 * Computes Area, Perimeter, and Hydraulic Radius of a closed polygon
 */
function calculatePolygonMetrics(
  pts: MiningGeologicalPoint[],
  w: number,
  h: number,
  wh: number
): StopeProfileMetrics {
  let areaSum = 0;
  let perimeter = 0;
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    areaSum += p1.x * p2.y - p2.x * p1.y;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  const areaM2 = Math.abs(areaSum) / 2;
  const hydraulicRadiusM = perimeter > 0 ? areaM2 / perimeter : 0;

  // Build SVG path string in local metric coordinates
  const svgPath =
    pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';

  return {
    points: pts,
    widthM: w,
    heightM: h,
    wallHeightM: wh,
    areaM2: Number(areaM2.toFixed(2)),
    perimeterM: Number(perimeter.toFixed(2)),
    hydraulicRadiusM: Number(hydraulicRadiusM.toFixed(2)),
    svgPath,
  };
}

// ----------------------------------------------------------------------------
// 2. DXF BOUNDARY PARSER
// ----------------------------------------------------------------------------

export function parseDxfStopeBoundary(dxfContent: string): MiningGeologicalPoint[] {
  const points: MiningGeologicalPoint[] = [];
  const lines = dxfContent.split(/\r?\n/).map((l) => l.trim());

  let inEntities = false;
  let inPolyline = false;
  let currentX: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const code = lines[i];
    const val = lines[i + 1];

    if (code === '2' && val === 'ENTITIES') {
      inEntities = true;
      i++;
      continue;
    }
    if (code === '0' && val === 'ENDSEC') {
      inEntities = false;
    }

    if (!inEntities) continue;

    if (code === '0' && (val === 'LWPOLYLINE' || val === 'POLYLINE')) {
      inPolyline = true;
      i++;
      continue;
    }

    if (inPolyline) {
      if (code === '0' && (val === 'LWPOLYLINE' || val === 'LINE' || val === 'ENDSEC' || val === 'EOF')) {
        inPolyline = false;
      } else if (code === '10') {
        currentX = parseFloat(val);
        i++;
      } else if (code === '20' && currentX !== null) {
        const currentY = parseFloat(val);
        if (!isNaN(currentX) && !isNaN(currentY)) {
          points.push({ x: currentX, y: currentY });
        }
        currentX = null;
        i++;
      }
    }
  }

  return points;
}

// ----------------------------------------------------------------------------
// 3. CHANNEL SAMPLING & COMPOSITE ASSAY CALCULATOR
// ----------------------------------------------------------------------------

export interface CompositeGradeResult {
  sampleCount: number;
  totalApparentLengthM: number;
  totalTrueThicknessM: number;
  weightedGrade: number; // Mass or length-weighted grade (e.g. g/t or %)
  oreLengthM: number;
  wasteLengthM: number;
  oreGrade: number;
  wasteGrade: number;
  estimatedTonnesPerRound: number;
  containedMetalUnits: number; // e.g. grams or kg
  dilutionPercentByMass: number;
  dilutionPercentOverOre: number;
  verdict: 'MILL' | 'LOW_GRADE_STOCKPILE' | 'WASTE_DUMP';
  verdictDescription: string;
}

export function calculateCompositeFaceAssays(
  samples: FaceChannelSampleRecord[],
  faceAreaM2: number,
  blastPullM: number,
  defaultOreSg = 3.35,
  defaultWasteSg = 2.72,
  cutoffGrade = 2.50
): CompositeGradeResult {
  const valid = samples.filter(
    (s) =>
      (typeof s.assayGrade === 'number' && !isNaN(s.assayGrade)) ||
      (s.gradeValue && !isNaN(parseFloat(s.gradeValue)))
  );

  if (valid.length === 0) {
    return {
      sampleCount: 0,
      totalApparentLengthM: 0,
      totalTrueThicknessM: 0,
      weightedGrade: 0,
      oreLengthM: 0,
      wasteLengthM: 0,
      oreGrade: 0,
      wasteGrade: 0,
      estimatedTonnesPerRound: 0,
      containedMetalUnits: 0,
      dilutionPercentByMass: 0,
      dilutionPercentOverOre: 0,
      verdict: 'WASTE_DUMP',
      verdictDescription: 'No channel sample assays available on face.',
    };
  }

  let totalOreMass = 0;
  let totalOreGradeProduct = 0;
  let totalWasteMass = 0;
  let totalWasteGradeProduct = 0;
  let oreLen = 0;
  let wasteLen = 0;
  let totalTrueThick = 0;

  for (const s of valid) {
    const len = Math.max(0.01, s.sampleLengthMeters || (s.toMeter - s.fromMeter) || 1.0);
    const grade = typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(s.gradeValue || '0') || 0;
    const isWaste = s.zoneCategory === 'WASTE';
    const sg = s.specificGravity || (isWaste ? defaultWasteSg : defaultOreSg);
    const mass = len * sg;

    // True thickness (if strike/dip provided or default true thickness)
    const trueThick = s.trueThicknessMeters || len;
    totalTrueThick += trueThick;

    if (isWaste) {
      totalWasteMass += mass;
      totalWasteGradeProduct += mass * grade;
      wasteLen += len;
    } else {
      totalOreMass += mass;
      totalOreGradeProduct += mass * grade;
      oreLen += len;
    }
  }

  const oreGrade = totalOreMass > 0 ? totalOreGradeProduct / totalOreMass : 0;
  const wasteGrade = totalWasteMass > 0 ? totalWasteGradeProduct / totalWasteMass : 0;
  const totalMinedMass = totalOreMass + totalWasteMass;
  const weightedGrade = totalMinedMass > 0 ? (totalOreGradeProduct + totalWasteGradeProduct) / totalMinedMass : 0;

  const totalLen = oreLen + wasteLen;
  const oreFrac = totalLen > 0 ? oreLen / totalLen : 0;
  const wasteFrac = totalLen > 0 ? wasteLen / totalLen : 0;

  const oreArea = faceAreaM2 * oreFrac;
  const wasteArea = faceAreaM2 * wasteFrac;
  const roundOreTonnes = oreArea * blastPullM * defaultOreSg;
  const roundWasteTonnes = wasteArea * blastPullM * defaultWasteSg;
  const estimatedTonnesPerRound = roundOreTonnes + roundWasteTonnes;

  const dilutionPercentByMass = estimatedTonnesPerRound > 0 ? (roundWasteTonnes / estimatedTonnesPerRound) * 100 : 0;
  const dilutionPercentOverOre = roundOreTonnes > 0 ? (roundWasteTonnes / roundOreTonnes) * 100 : 0;

  const containedMetalUnits = estimatedTonnesPerRound * weightedGrade;

  let verdict: 'MILL' | 'LOW_GRADE_STOCKPILE' | 'WASTE_DUMP' = 'MILL';
  let verdictDescription = '';

  if (weightedGrade >= cutoffGrade) {
    verdict = 'MILL';
    verdictDescription = `Head grade (${weightedGrade.toFixed(2)}) >= Cutoff (${cutoffGrade.toFixed(2)}). Dispatch to primary crusher.`;
  } else if (weightedGrade >= cutoffGrade * 0.5) {
    verdict = 'LOW_GRADE_STOCKPILE';
    verdictDescription = `Marginal mineralization (${weightedGrade.toFixed(2)}) below mill cutoff. Dispatch to low-grade stockpile.`;
  } else {
    verdict = 'WASTE_DUMP';
    verdictDescription = `Sub-economic grade (${weightedGrade.toFixed(2)}). Dispatch to waste dump / cemented rockfill.`;
  }

  return {
    sampleCount: valid.length,
    totalApparentLengthM: Number(totalLen.toFixed(2)),
    totalTrueThicknessM: Number(totalTrueThick.toFixed(2)),
    weightedGrade: Number(weightedGrade.toFixed(2)),
    oreLengthM: Number(oreLen.toFixed(2)),
    wasteLengthM: Number(wasteLen.toFixed(2)),
    oreGrade: Number(oreGrade.toFixed(2)),
    wasteGrade: Number(wasteGrade.toFixed(2)),
    estimatedTonnesPerRound: Number(estimatedTonnesPerRound.toFixed(1)),
    containedMetalUnits: Number(containedMetalUnits.toFixed(1)),
    dilutionPercentByMass: Number(dilutionPercentByMass.toFixed(1)),
    dilutionPercentOverOre: Number(dilutionPercentOverOre.toFixed(1)),
    verdict,
    verdictDescription,
  };
}

// ----------------------------------------------------------------------------
// 4. LAUBSCHER MRMR (MINING ROCK MASS RATING)
// ----------------------------------------------------------------------------

export interface MrmrDesignResult {
  baseRmr: number; // 0 - 100
  totalAdjustmentMultiplier: number;
  designMrmr: number; // 0 - 100
  rockMassClass: 'Class I' | 'Class II' | 'Class III' | 'Class IV' | 'Class V';
  description: string;
  recommendedSupport: string;
  hydraulicRadiusLimitM: number; // Maximum unsupported HR
}

export function calculateLaubscherMrmr(
  baseRmr: number,
  weatheringPct: number, // 80 - 100
  inducedStressPct: number, // 60 - 120
  jointOrientationPct: number, // 70 - 100
  blastingDamagePct: number // 80 - 100
): MrmrDesignResult {
  const wAdj = Math.max(0.7, Math.min(1.0, weatheringPct / 100));
  const sAdj = Math.max(0.6, Math.min(1.2, inducedStressPct / 100));
  const oAdj = Math.max(0.7, Math.min(1.0, jointOrientationPct / 100));
  const bAdj = Math.max(0.8, Math.min(1.0, blastingDamagePct / 100));

  const totalMultiplier = wAdj * sAdj * oAdj * bAdj;
  const designMrmr = Math.max(0, Math.min(100, Math.round(baseRmr * totalMultiplier)));

  let rockMassClass: MrmrDesignResult['rockMassClass'] = 'Class II';
  let description = '';
  let recommendedSupport = '';
  let hydraulicRadiusLimitM = 5.0;

  if (designMrmr >= 81) {
    rockMassClass = 'Class I';
    description = 'Very Good Rock — Massive, tight joints, negligible stress damage';
    recommendedSupport = 'Generally unsupported; spot friction bolts (Split-Sets 2.1m) on loose blocks only.';
    hydraulicRadiusLimitM = 9.5;
  } else if (designMrmr >= 61) {
    rockMassClass = 'Class II';
    description = 'Good Rock — Blocky, moderately spaced joints, stable stope back';
    recommendedSupport = 'Pattern Split-Sets (2.1m, 1.5m spacing) + welded wire mesh in roof.';
    hydraulicRadiusLimitM = 7.0;
  } else if (designMrmr >= 41) {
    rockMassClass = 'Class III';
    description = 'Fair Rock — Blocky/seamy, some clay or chlorite infill';
    recommendedSupport = 'Resin rebar bolts (2.4m, 1.2m spacing) + 5.6mm mesh + 50mm shotcrete.';
    hydraulicRadiusLimitM = 4.8;
  } else if (designMrmr >= 21) {
    rockMassClass = 'Class IV';
    description = 'Poor Rock — Heavy shearing, high blast disturbance';
    recommendedSupport = 'Heavy yielding bolts + 75-100mm steel-fiber reinforced shotcrete (SFRS) + spiling.';
    hydraulicRadiusLimitM = 3.2;
  } else {
    rockMassClass = 'Class V';
    description = 'Very Poor Rock — Squeezing ground, fault gouge, complete ravelling';
    recommendedSupport = 'Steel sets / lattice girders + heavy forepoling spiles + full invert closure.';
    hydraulicRadiusLimitM = 1.8;
  }

  return {
    baseRmr,
    totalAdjustmentMultiplier: Number(totalMultiplier.toFixed(2)),
    designMrmr,
    rockMassClass,
    description,
    recommendedSupport,
    hydraulicRadiusLimitM,
  };
}

// ----------------------------------------------------------------------------
// 5. MATHEWS / POTVIN STOPE STABILITY GRAPH
// ----------------------------------------------------------------------------

export interface MathewsPotvinResult {
  qPrime: number;
  stabilityNumberN: number;
  hydraulicRadiusM: number;
  zone: 'STABLE_UNSUPPORTED' | 'STABLE_SUPPORTED' | 'TRANSITION_SLOUGHING' | 'CAVING_FAILURE';
  zoneLabel: string;
  supportRecommendation: string;
}

export function evaluateMathewsStability(
  rqd: number,
  jn: number,
  jr: number,
  ja: number,
  factorA: number, // Rock stress factor (0.1 - 1.0)
  factorB: number, // Joint orientation factor (0.2 - 1.0)
  factorC: number, // Gravity adjustment factor (1.0 - 8.0)
  hydraulicRadius: number
): MathewsPotvinResult {
  // Q' = (RQD / Jn) * (Jr / Ja)
  const qPrime = (Math.max(10, rqd) / Math.max(0.5, jn)) * (Math.max(0.5, jr) / Math.max(0.75, ja));
  const stabilityNumberN = qPrime * factorA * factorB * factorC;

  let zone: MathewsPotvinResult['zone'] = 'STABLE_UNSUPPORTED';
  let zoneLabel = 'Stable (Unsupported)';
  let supportRecommendation = 'Stable stope span. Spot friction bolts on structural intersections only.';

  if (stabilityNumberN < 1.0 || (stabilityNumberN < 3.0 && hydraulicRadius > 8.0)) {
    zone = 'CAVING_FAILURE';
    zoneLabel = 'Caving / Unstable Failure Zone';
    supportRecommendation = 'Massive unentry failure risk. Non-entry bulk stoping or cemented rock backfill (CRF) required.';
  } else if (stabilityNumberN < 4.0 || hydraulicRadius > 7.5) {
    zone = 'TRANSITION_SLOUGHING';
    zoneLabel = 'Transition (Sloughing Dilution Risk)';
    supportRecommendation = 'High hangingwall dilution expected. Pre-stressed twin-strand cable bolts (8-10m, 2.0x2.0m grid) + fiber shotcrete.';
  } else if (stabilityNumberN < 12.0 || hydraulicRadius > 5.5) {
    zone = 'STABLE_SUPPORTED';
    zoneLabel = 'Stable (Supported)';
    supportRecommendation = 'Pattern rock bolting (2.0m x 2.0m grid) + heavy weldmesh in roof and hangingwall.';
  } else {
    zone = 'STABLE_UNSUPPORTED';
    zoneLabel = 'Stable (Unsupported Span)';
    supportRecommendation = 'Stope geometry is naturally self-supporting. Spot support only.';
  }

  return {
    qPrime: Number(qPrime.toFixed(2)),
    stabilityNumberN: Number(stabilityNumberN.toFixed(2)),
    hydraulicRadiusM: Number(hydraulicRadius.toFixed(2)),
    zone,
    zoneLabel,
    supportRecommendation,
  };
}

// ----------------------------------------------------------------------------
// 6. SURPAC & DESWIK 3D DXF EXPORTER
// ----------------------------------------------------------------------------

export function generateMineDesignDxf(
  stope: MiningStopeItem | undefined,
  stopePolygon: MiningGeologicalPoint[],
  features: MiningGeologicalFeature[],
  channelSamples: FaceChannelSampleRecord[]
): string {
  let dxf = '0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';

  // Base elevation RL and coordinates
  const levelRl = stope?.levelElevationMrl || 620;

  // Stope Face Boundary Polyline
  if (stopePolygon.length >= 3) {
    dxf += `0\nLWPOLYLINE\n8\nSTOPE_PERIMETER\n90\n${stopePolygon.length}\n70\n1\n`;
    stopePolygon.forEach((p) => {
      dxf += `10\n${p.x.toFixed(3)}\n20\n${p.y.toFixed(3)}\n30\n${levelRl.toFixed(3)}\n`;
    });
  }

  // Geological Features (Veins, Faults, Contacts)
  features
    .filter((f) => f.visible && f.points.length >= 2)
    .forEach((f) => {
      const isClosed = f.geometryType === 'POLYGON';
      const layerName =
        f.featureType === 'ORE_BOUNDARY'
          ? 'ORE_VEIN'
          : f.featureType === 'FAULT'
          ? 'STRUCT_FAULT'
          : f.featureType === 'JOINT'
          ? 'STRUCT_JOINT'
          : 'LITH_CONTACT';

      dxf += `0\nLWPOLYLINE\n8\n${layerName}\n90\n${f.points.length}\n70\n${isClosed ? '1' : '0'}\n`;
      f.points.forEach((p) => {
        dxf += `10\n${p.x.toFixed(3)}\n20\n${p.y.toFixed(3)}\n30\n${levelRl.toFixed(3)}\n`;
      });
    });

  // Channel Sampling Lines and Text Tags
  channelSamples.forEach((cs) => {
    const yVal = 1.5; // baseline cut height
    dxf += `0\nLINE\n8\nCHANNEL_SAMPLES\n`;
    dxf += `10\n${cs.fromMeter.toFixed(3)}\n20\n${yVal.toFixed(3)}\n30\n${levelRl.toFixed(3)}\n`;
    dxf += `11\n${cs.toMeter.toFixed(3)}\n21\n${yVal.toFixed(3)}\n31\n${levelRl.toFixed(3)}\n`;

    const grade = typeof cs.assayGrade === 'number' ? cs.assayGrade.toFixed(2) : cs.gradeValue || '0.00';
    const midX = (cs.fromMeter + cs.toMeter) / 2;
    dxf += `0\nTEXT\n8\nCHANNEL_LABELS\n10\n${midX.toFixed(3)}\n20\n${(yVal + 0.15).toFixed(3)}\n30\n${levelRl.toFixed(3)}\n40\n0.18\n1\n${cs.sampleNumber} (${grade}g/t)\n`;
  });

  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

// ----------------------------------------------------------------------------
// 7. CSV CHANNEL ASSAYS EXPORTER
// ----------------------------------------------------------------------------

export function generateChannelAssayCsv(
  stope: MiningStopeItem | undefined,
  samples: FaceChannelSampleRecord[],
  composites: CompositeGradeResult
): string {
  let csv = 'Mine Project,Mine Level,Stope / Drift ID,Chainage,Commodity,Cutoff Grade\n';
  csv += `"${stope?.projectId || 'PRJ-MIN-001'}","${stope?.mineLevel || '620mRL'}","${stope?.stopeOrDriftId || 'HW-DRV-04'}","${stope?.currentHeadingRdChainage || 'CH 0.0m'}","Gold (Au)",${stope?.targetCutoffGrade || 2.50}\n\n`;

  csv += 'Sample ID,From (m),To (m),Interval Length (m),True Thickness (m),Assay Grade,Unit,SG,Zone Category,Lithology,Description\n';
  samples.forEach((s) => {
    const len = s.sampleLengthMeters || s.toMeter - s.fromMeter;
    const trueThick = s.trueThicknessMeters || len;
    const grade = typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue || '0.00';
    const sg = s.specificGravity || (s.zoneCategory === 'WASTE' ? 2.72 : 3.35);
    csv += `"${s.sampleNumber}",${s.fromMeter.toFixed(2)},${s.toMeter.toFixed(2)},${len.toFixed(2)},${trueThick.toFixed(2)},${grade},"g/t",${sg.toFixed(2)},"${s.zoneCategory || 'ORE'}","${s.lithologyOrVein || 'Quartz Vein'}","${s.notes || ''}"\n`;
  });

  csv += '\n--- SUMMARY COMPOSITES ---\n';
  csv += `Sample Count,${composites.sampleCount}\n`;
  csv += `Total Channel Length (m),${composites.totalApparentLengthM}\n`;
  csv += `True Vein Thickness (m),${composites.totalTrueThicknessM}\n`;
  csv += `Mass-Weighted Face Grade (g/t),${composites.weightedGrade}\n`;
  csv += `Ore Length (m),${composites.oreLengthM}\n`;
  csv += `Waste Length (m),${composites.wasteLengthM}\n`;
  csv += `Ore Grade (g/t),${composites.oreGrade}\n`;
  csv += `Waste Grade (g/t),${composites.wasteGrade}\n`;
  csv += `Blast Round ROM Tonnes,${composites.estimatedTonnesPerRound}\n`;
  csv += `Contained Metal,${composites.containedMetalUnits}\n`;
  csv += `Face Dilution % (by Mass),${composites.dilutionPercentByMass}%\n`;
  csv += `Muck Destination Verdict,${composites.verdict}\n`;

  return csv;
}
