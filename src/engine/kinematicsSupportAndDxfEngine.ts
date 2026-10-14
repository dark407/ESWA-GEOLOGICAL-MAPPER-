import {
  GsiParameters,
  Joint,
  JointSet,
  Point2D,
  QIndexParameters,
  RmrParameters,
  RockMassClassificationMethodId,
  SavedProjectRecord,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  calculateBieniawskiRmr,
  calculateHoekGsi,
  evaluateQSystemWithValidation,
} from './rockMassClassificationEngine';

// ============================================================================
// 1. UNFOLDED PERIMETER PROJECTION STRIP (LEFT WALL <-> CROWN <-> RIGHT WALL)
//    Auto-projects joints that cross the face/crown/wall boundaries using the
//    3D Dip / Dip-Direction Plane Intersection Equation:
//    n_x (X - X0) + n_y (Y - Y0) + n_z (Z - Z0) = 0
// ============================================================================

export interface ProjectedPerimeterTrace {
  id: string;
  sourceJointId: string;
  set: string;
  featureType: Joint['featureType'];
  dip: number;
  dipDirection: number;
  sourceSurface: SurfaceType;
  targetSurface: 'leftWall' | 'crown' | 'rightWall';
  // Points in the target surface's real-world meter frame (x = span/height, y = pull 0..roundLength)
  points: Point2D[];
  boundaryEntryCoordM: number;
  apparentStrikeOnWallDeg: number;
  alreadyCommitted: boolean;
}

/**
 * Converts Dip (0..90) and Dip Direction (0..360) relative to Tunnel Drive Azimuth
 * into a unit normal vector (nx, ny, nz) in the Tunnel Frame:
 *   X = Transverse right from centerline (-W/2 .. +W/2)
 *   Y = Vertical elevation above invert (0 .. H)
 *   Z = Longitudinal chainage/pull into the face (0 .. roundLength)
 */
export function dipAndDirectionToTunnelNormal(
  dipDeg: number,
  dipDirectionDeg: number,
  driveAzimuthDeg: number
): { nx: number; ny: number; nz: number } {
  const dipRad = (Math.max(1, Math.min(89, dipDeg)) * Math.PI) / 180;
  // Relative azimuth of dip direction wrt tunnel drive direction:
  // relAz = 0° -> dipping in drive direction (+Z)
  // relAz = 90° -> dipping toward Right Wall (+X)
  // relAz = 270° -> dipping toward Left Wall (-X)
  const relAzRad = (((dipDirectionDeg - driveAzimuthDeg + 360) % 360) * Math.PI) / 180;

  const horiz = Math.sin(dipRad);
  const nx = horiz * Math.sin(relAzRad);
  const nz = horiz * Math.cos(relAzRad);
  const ny = Math.cos(dipRad);
  return { nx, ny, nz };
}

/**
 * Computes auto-projected traces across Left Wall <-> Crown <-> Right Wall
 * for joints mapped on the Face (or Crown) that intersect or approach the perimeter.
 */
export function computeUnfoldedPerimeterProjections(
  joints: Joint[],
  geometry: TunnelGeometry,
  settings: TunnelSettings
): ProjectedPerimeterTrace[] {
  const halfW = Math.max(1.5, geometry.width / 2);
  const H = Math.max(2.0, geometry.height);
  const wallH = Math.max(1.0, Math.min(H - 0.5, geometry.wallHeight));
  const crownW = Math.max(2.0, geometry.crownArcLength || geometry.width * 1.25);
  const pullL = Math.max(1.0, settings.roundLength || 3.5);

  const projections: ProjectedPerimeterTrace[] = [];

  // Consider face joints (at Z = 0) and crown joints that approach boundaries
  const faceJoints = joints.filter((j) => j.surface === 'face' && j.geometry.length >= 2);

  for (const fj of faceJoints) {
    const { nx, ny, nz } = dipAndDirectionToTunnelNormal(
      fj.dip,
      fj.dipDirection,
      settings.driveDirection
    );
    // Avoid dividing by zero if plane is strictly parallel to face (nz ~ 0)
    const safeNz = Math.abs(nz) < 0.08 ? (nz >= 0 ? 0.08 : -0.08) : nz;

    // Pick anchor point (X0, Y0, Z0=0) on the face closest to the tunnel perimeter
    let bestPt = fj.geometry[0];
    let minBoundaryDist = Infinity;
    for (const pt of fj.geometry) {
      const distLeft = Math.abs(pt.x - -halfW);
      const distRight = Math.abs(pt.x - halfW);
      const distCrown = Math.abs(pt.y - H) + Math.max(0, Math.abs(pt.x) - halfW * 0.5) * 0.4;
      const d = Math.min(distLeft, distRight, distCrown);
      if (d < minBoundaryDist) {
        minBoundaryDist = d;
        bestPt = pt;
      }
    }

    const X0 = bestPt.x;
    const Y0 = bestPt.y;

    // 1. Project onto CROWN (Y ~ H, X in [-halfW, +halfW], Z in [0, pullL])
    // Plane equation: nx*(X - X0) + ny*(Y_crown(X) - Y0) + nz*(Z - 0) = 0
    // => Z(X) = - [ nx*(X - X0) + ny*(Y_crown(X) - Y0) ] / safeNz
    const crownPts: Point2D[] = [];
    const numSteps = 12;
    for (let i = 0; i <= numSteps; i++) {
      const u = -1 + (2 * i) / numSteps; // -1 (left shoulder) .. +1 (right shoulder)
      const X = u * halfW;
      const Ycrown = wallH + (H - wallH) * Math.max(0, 1 - u * u);
      const Z = -(nx * (X - X0) + ny * (Ycrown - Y0)) / safeNz;
      if (Z >= -0.2 && Z <= pullL + 0.2) {
        const clampedZ = Number(Math.max(0, Math.min(pullL, Z)).toFixed(3));
        const crownTransverseX = Number((u * (crownW / 2)).toFixed(3));
        crownPts.push({ x: crownTransverseX, y: clampedZ });
      }
    }

    if (crownPts.length >= 2) {
      const first = crownPts[0];
      const last = crownPts[crownPts.length - 1];
      if (Math.hypot(last.x - first.x, last.y - first.y) >= 0.35) {
        const already = joints.some(
          (j) =>
            j.surface === 'crown' &&
            j.set === fj.set &&
            Math.abs(j.dip - fj.dip) <= 6 &&
            Math.abs(j.dipDirection - fj.dipDirection) <= 10
        );
        projections.push({
          id: `proj-crown-${fj.id}`,
          sourceJointId: fj.id,
          set: fj.set,
          featureType: fj.featureType,
          dip: fj.dip,
          dipDirection: fj.dipDirection,
          sourceSurface: 'face',
          targetSurface: 'crown',
          points: [first, crownPts[Math.floor(crownPts.length / 2)], last],
          boundaryEntryCoordM: Number(first.x.toFixed(2)),
          apparentStrikeOnWallDeg: Number(
            (((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI + 360) % 360).toFixed(1)
          ),
          alreadyCommitted: already,
        });
      }
    }

    // 2. Project onto LEFT WALL (X = -halfW, Y in [0, wallH], Z in [0, pullL])
    // In Left Wall surface coordinates: x in [-wallH/2, +wallH/2], y in [0, pullL]
    if (bestPt.x <= 0.5) {
      const lwPts: Point2D[] = [];
      for (let i = 0; i <= 8; i++) {
        const Y = (wallH * i) / 8;
        const Z = -(nx * (-halfW - X0) + ny * (Y - Y0)) / safeNz;
        if (Z >= -0.15 && Z <= pullL + 0.15) {
          const clampedZ = Number(Math.max(0, Math.min(pullL, Z)).toFixed(3));
          const wallLocalX = Number((Y - wallH / 2).toFixed(3));
          lwPts.push({ x: wallLocalX, y: clampedZ });
        }
      }
      if (lwPts.length >= 2) {
        const first = lwPts[0];
        const last = lwPts[lwPts.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) >= 0.35) {
          const already = joints.some(
            (j) =>
              j.surface === 'leftWall' &&
              j.set === fj.set &&
              Math.abs(j.dip - fj.dip) <= 6 &&
              Math.abs(j.dipDirection - fj.dipDirection) <= 10
          );
          projections.push({
            id: `proj-lw-${fj.id}`,
            sourceJointId: fj.id,
            set: fj.set,
            featureType: fj.featureType,
            dip: fj.dip,
            dipDirection: fj.dipDirection,
            sourceSurface: 'face',
            targetSurface: 'leftWall',
            points: [first, last],
            boundaryEntryCoordM: Number((first.x + wallH / 2).toFixed(2)),
            apparentStrikeOnWallDeg: Number(
              (((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI + 360) % 360).toFixed(1)
            ),
            alreadyCommitted: already,
          });
        }
      }
    }

    // 3. Project onto RIGHT WALL (X = +halfW, Y in [0, wallH], Z in [0, pullL])
    if (bestPt.x >= -0.5) {
      const rwPts: Point2D[] = [];
      for (let i = 0; i <= 8; i++) {
        const Y = (wallH * i) / 8;
        const Z = -(nx * (halfW - X0) + ny * (Y - Y0)) / safeNz;
        if (Z >= -0.15 && Z <= pullL + 0.15) {
          const clampedZ = Number(Math.max(0, Math.min(pullL, Z)).toFixed(3));
          const wallLocalX = Number((wallH / 2 - Y).toFixed(3));
          rwPts.push({ x: wallLocalX, y: clampedZ });
        }
      }
      if (rwPts.length >= 2) {
        const first = rwPts[0];
        const last = rwPts[rwPts.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) >= 0.35) {
          const already = joints.some(
            (j) =>
              j.surface === 'rightWall' &&
              j.set === fj.set &&
              Math.abs(j.dip - fj.dip) <= 6 &&
              Math.abs(j.dipDirection - fj.dipDirection) <= 10
          );
          projections.push({
            id: `proj-rw-${fj.id}`,
            sourceJointId: fj.id,
            set: fj.set,
            featureType: fj.featureType,
            dip: fj.dip,
            dipDirection: fj.dipDirection,
            sourceSurface: 'face',
            targetSurface: 'rightWall',
            points: [first, last],
            boundaryEntryCoordM: Number((wallH / 2 - first.x).toFixed(2)),
            apparentStrikeOnWallDeg: Number(
              (((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI + 360) % 360).toFixed(1)
            ),
            alreadyCommitted: already,
          });
        }
      }
    }
  }

  return projections;
}

/**
 * Converts un-committed `ProjectedPerimeterTrace` items into actual `Joint` records
 * on `leftWall`, `crown`, and `rightWall`.
 */
export function buildProjectedPerimeterJoints(
  existingJoints: Joint[],
  projections: ProjectedPerimeterTrace[]
): Joint[] {
  const toAdd: Joint[] = [];
  let seq = existingJoints.length + 1;

  for (const p of projections) {
    if (p.alreadyCommitted) continue;
    const src = existingJoints.find((j) => j.id === p.sourceJointId);
    const len = p.points.reduce((acc, pt, i) => {
      if (i === 0) return 0;
      return acc + Math.hypot(pt.x - p.points[i - 1].x, pt.y - p.points[i - 1].y);
    }, 0);

    toAdd.push({
      id: `J-PROJ-${p.targetSurface}-${Date.now()}-${seq}`,
      jointNumber: `J${seq}`,
      surface: p.targetSurface,
      set: p.set,
      featureType: p.featureType,
      geometry: p.points,
      traceAngle: p.apparentStrikeOnWallDeg % 180,
      dip: p.dip,
      dipDirection: p.dipDirection,
      strike: (p.dipDirection - 90 + 360) % 360,
      persistenceMeters: Number(Math.max(0.4, len).toFixed(2)),
      apertureMm: src?.apertureMm ?? '1 - 5 mm',
      roughness: src?.roughness ?? 'Rough / Irregular, Undulating',
      infilling: src?.infilling ?? 'Unaltered / Surface Staining',
      weathering: src?.weathering ?? 'Slightly Weathered (W2)',
      waterCondition: src?.waterCondition ?? 'Dry',
      confidence: 'High',
      confidenceScore: 0.92,
      confidenceBreakdown: {
        detection: 92,
        trace: 90,
        geometric: 95,
        orientation: 92,
      },
      source: 'AI_HYBRID',
      accepted: false,
      orientationStatus: 'GEOMETRICALLY_CALCULATED',
      customLabel: `${p.set} (Proj from Face)`,
    });
    seq++;
  }

  return [...existingJoints, ...toAdd];
}

// ============================================================================
// 2. GROUNDWATER / SEEPAGE ZONE SKETCHING & RATING LINK
//    Links Dry / Damp / Dripping / Flowing seepage zones (L/min) to Q-System Jw
//    and Bieniawski RMR Groundwater ratings.
// ============================================================================

export type SeepageConditionType = 'DRY' | 'DAMP' | 'DRIPPING' | 'FLOWING' | 'HIGH_PRESSURE';

export interface GroundwaterSeepageZone {
  id: string;
  surface: SurfaceType;
  condition: SeepageConditionType;
  inflowLPerMin: number; // Estimated inflow L/min per 10m tunnel length
  locationX: number;     // Center X on surface (m)
  locationY: number;     // Center Y on surface (m)
  radiusMeters: number;  // Zone radius on surface (m)
  notes: string;
}

export const SEEPAGE_CONDITION_CATALOG: Record<
  SeepageConditionType,
  {
    label: string;
    defaultInflowLMin: number;
    colorHex: string;
    recommendedJw: number;
    jwLabel: string;
    recommendedRmrGwRating89: number;
    rmrGwLabel: string;
  }
> = {
  DRY: {
    label: 'Completely Dry',
    defaultInflowLMin: 0,
    colorHex: '#10B981',
    recommendedJw: 1.0,
    jwLabel: '1.0 — Dry excavation or minor inflow (< 5 L/min locally)',
    recommendedRmrGwRating89: 15,
    rmrGwLabel: 'Completely Dry (0 L/min per 10m) → Rating 15',
  },
  DAMP: {
    label: 'Damp / Wet Staining',
    defaultInflowLMin: 3,
    colorHex: '#38BDF8',
    recommendedJw: 1.0,
    jwLabel: '1.0 — Damp rock surface, < 5 L/min locally',
    recommendedRmrGwRating89: 10,
    rmrGwLabel: 'Damp (< 10 L/min per 10m) → Rating 10',
  },
  DRIPPING: {
    label: 'Dripping / Continuous Seepage',
    defaultInflowLMin: 18,
    colorHex: '#0284C7',
    recommendedJw: 0.66,
    jwLabel: '0.66 — Medium inflow or pressure, occasional outwash of joint fillings',
    recommendedRmrGwRating89: 7,
    rmrGwLabel: 'Wet / Dripping (10–25 L/min per 10m) → Rating 7',
  },
  FLOWING: {
    label: 'Flowing Water (25–125 L/min)',
    defaultInflowLMin: 55,
    colorHex: '#2563EB',
    recommendedJw: 0.5,
    jwLabel: '0.50 — Large inflow or high pressure in competent rock',
    recommendedRmrGwRating89: 4,
    rmrGwLabel: 'Dripping / Flowing (25–125 L/min per 10m) → Rating 4',
  },
  HIGH_PRESSURE: {
    label: 'High Pressure Gusher (> 125 L/min)',
    defaultInflowLMin: 160,
    colorHex: '#EF4444',
    recommendedJw: 0.33,
    jwLabel: '0.33 — Large inflow with considerable outwash of joint fillings',
    recommendedRmrGwRating89: 0,
    rmrGwLabel: 'Flowing (> 125 L/min per 10m) → Rating 0',
  },
};

export function evaluateStationGroundwaterFromZones(zones: GroundwaterSeepageZone[]): {
  totalInflowLPerMin10m: number;
  governingCondition: SeepageConditionType;
  recommendedJw: number;
  jwDescription: string;
  recommendedRmrRating: number;
  rmrDescription: string;
} {
  if (zones.length === 0) {
    const meta = SEEPAGE_CONDITION_CATALOG.DRY;
    return {
      totalInflowLPerMin10m: 0,
      governingCondition: 'DRY',
      recommendedJw: meta.recommendedJw,
      jwDescription: meta.jwLabel,
      recommendedRmrRating: meta.recommendedRmrGwRating89,
      rmrDescription: meta.rmrGwLabel,
    };
  }

  const totalInflow = Number(
    zones.reduce((sum, z) => sum + Math.max(0, z.inflowLPerMin), 0).toFixed(1)
  );

  let governing: SeepageConditionType = 'DRY';
  if (totalInflow > 125 || zones.some((z) => z.condition === 'HIGH_PRESSURE')) {
    governing = 'HIGH_PRESSURE';
  } else if (totalInflow >= 25 || zones.some((z) => z.condition === 'FLOWING')) {
    governing = 'FLOWING';
  } else if (totalInflow >= 10 || zones.some((z) => z.condition === 'DRIPPING')) {
    governing = 'DRIPPING';
  } else if (totalInflow > 0 || zones.some((z) => z.condition === 'DAMP')) {
    governing = 'DAMP';
  }

  const meta = SEEPAGE_CONDITION_CATALOG[governing];
  return {
    totalInflowLPerMin10m: totalInflow,
    governingCondition: governing,
    recommendedJw: meta.recommendedJw,
    jwDescription: meta.jwLabel,
    recommendedRmrRating: meta.recommendedRmrGwRating89,
    rmrDescription: meta.rmrGwLabel,
  };
}

// ============================================================================
// 3. EMPIRICAL SUPPORT RECOMMENDATION ENGINE (BARTON Q-CHART & RMR89)
// ============================================================================

export interface EmpiricalSupportRecommendation {
  spanMeters: number;
  esr: number;
  equivalentDimensionDe: number; // De = Span / ESR
  maxUnsupportedSpanMeters: number;
  // Barton & Grimstad (1993) Q-Chart Support Prescription
  qValue: number | null;
  qSupportCategoryNumber: number; // 1 .. 9
  qSupportCategoryTitle: string;
  boltLengthMeters: number;       // L = 2 + 0.15 * B / ESR
  boltSpacingMeters: number;      // e.g. 1.2m .. 2.5m c/c
  shotcreteThicknessMm: number;   // e.g. 0, 50, 75, 100, 150, 200 mm Sfr
  steelRibsPrescription: string;
  // Bieniawski (1989) RMR89 Support Prescription
  rmrValue: number | null;
  rmrClassLabel: string;
  rmrExcavationMethod: string;
  rmrBoltPrescription: string;
  rmrShotcretePrescription: string;
  rmrSteelSetsPrescription: string;
}

export function computeEmpiricalSupportRecommendation(
  geometry: TunnelGeometry,
  qParams: QIndexParameters,
  rmrParams: RmrParameters,
  qComplete: boolean,
  qComputedValue: number | null,
  rmrComputedValue: number | null
): EmpiricalSupportRecommendation {
  const span = Math.max(2.0, geometry.width || 8.4);
  const esr = Math.max(0.5, qParams.esr || 1.0);
  const De = Number((span / esr).toFixed(2));
  const boltLength = Number((2 + (0.15 * span) / esr).toFixed(2));

  const qVal = qComplete && qComputedValue !== null ? Math.max(0.001, qComputedValue) : null;
  const maxUnsupportedSpan =
    qVal !== null ? Number((2 * esr * Math.pow(qVal, 0.4)).toFixed(2)) : 0;

  // Determine Grimstad & Barton (1993) Category 1..9 from Q and De
  let catNum = 1;
  let catTitle = 'Category 1 — Unsupported or Spot Bolting';
  let boltSpacing = 2.5;
  let shotcreteMm = 0;
  let ribs = 'None required';

  if (qVal !== null) {
    if (qVal >= 40) {
      catNum = 1;
      catTitle = 'Category 1 — Unsupported / Local Spot Bolting';
      boltSpacing = 2.5;
      shotcreteMm = 0;
      ribs = 'None';
    } else if (qVal >= 10) {
      catNum = De > 9 ? 3 : 2;
      catTitle =
        catNum === 3
          ? 'Category 3 — Systematic Bolting + Unreinforced Shotcrete (40–50 mm)'
          : 'Category 2 — Spot to Systematic Bolting';
      boltSpacing = 2.1;
      shotcreteMm = catNum === 3 ? 50 : 0;
      ribs = 'None';
    } else if (qVal >= 4) {
      catNum = 4;
      catTitle = 'Category 4 — Systematic Bolting + Fiber Shotcrete (50–60 mm Sfr)';
      boltSpacing = 1.8;
      shotcreteMm = 60;
      ribs = 'None';
    } else if (qVal >= 1) {
      catNum = 5;
      catTitle = 'Category 5 — Systematic Bolting + Fiber Shotcrete (60–90 mm Sfr)';
      boltSpacing = 1.6;
      shotcreteMm = 80;
      ribs = 'Bolt-anchored straps if heavily jointed';
    } else if (qVal >= 0.4) {
      catNum = 6;
      catTitle = 'Category 6 — Systematic Bolting + Fiber Shotcrete (90–120 mm Sfr)';
      boltSpacing = 1.4;
      shotcreteMm = 110;
      ribs = 'Light steel ribs / lattice girders if span > 10m';
    } else if (qVal >= 0.1) {
      catNum = 7;
      catTitle = 'Category 7 — Fiber Shotcrete (120–150 mm Sfr) + Bolting + Steel Ribs';
      boltSpacing = 1.25;
      shotcreteMm = 140;
      ribs = 'Steel Ribs / Lattice Girders @ 1.5m c/c';
    } else if (qVal >= 0.01) {
      catNum = 8;
      catTitle = 'Category 8 — Fiber Shotcrete (150–250 mm Sfr) + Heavy Steel Ribs + Invert Arch';
      boltSpacing = 1.1;
      shotcreteMm = 200;
      ribs = 'Heavy Steel Ribs (ISMB) @ 1.0m c/c + Spiling';
    } else {
      catNum = 9;
      catTitle = 'Category 9 — Cast Concrete / Heavy Squeezing Support (> 250 mm Sfr)';
      boltSpacing = 1.0;
      shotcreteMm = 250;
      ribs = 'Heavy Yielding Steel Ribs @ 0.75m c/c + Forepoling + Invert Strut';
    }
  }

  // Bieniawski (1989) RMR89 Support Table (10m span reference)
  let rmrClassLabel = 'Unassessed';
  let rmrExcavation = 'Verify RMR inputs';
  let rmrBolts = '—';
  let rmrShotcrete = '—';
  let rmrRibs = '—';

  if (rmrComputedValue !== null) {
    if (rmrComputedValue >= 81) {
      rmrClassLabel = 'Class I — Very Good Rock (81–100)';
      rmrExcavation = 'Full face, 3.0 m advance';
      rmrBolts = 'Generally no support required except occasional spot bolting';
      rmrShotcrete = 'None';
      rmrRibs = 'None';
    } else if (rmrComputedValue >= 61) {
      rmrClassLabel = 'Class II — Good Rock (61–80)';
      rmrExcavation = 'Full face, 1.5–3.0 m advance; complete support 20 m from face';
      rmrBolts = `Locally bolts in crown, L = 3.0 m, spaced 2.5 m with occasional wire mesh`;
      rmrShotcrete = '50 mm in crown where required';
      rmrRibs = 'None';
    } else if (rmrComputedValue >= 41) {
      rmrClassLabel = 'Class III — Fair Rock (41–60)';
      rmrExcavation = 'Top heading and bench, 1.5–3.0 m advance in top heading';
      rmrBolts = `Systematic bolts L = 4.0 m, spaced 1.5–2.0 m in crown and walls with wire mesh`;
      rmrShotcrete = '50–100 mm in crown and 30 mm in sides';
      rmrRibs = 'None';
    } else if (rmrComputedValue >= 21) {
      rmrClassLabel = 'Class IV — Poor Rock (21–40)';
      rmrExcavation = 'Top heading and bench, 1.0–1.5 m advance; install support concurrently';
      rmrBolts = `Systematic bolts L = 4.0–5.0 m, spaced 1.0–1.5 m in crown and walls with mesh`;
      rmrShotcrete = '100–150 mm in crown and 100 mm in sides';
      rmrRibs = 'Light to medium ribs spaced 1.5 m where required';
    } else {
      rmrClassLabel = 'Class V — Very Poor Rock (< 20)';
      rmrExcavation = 'Multiple drifts, 0.5–1.5 m advance; shotcrete immediately after excavation';
      rmrBolts = `Systematic bolts L = 5.0–6.0 m, spaced 1.0–1.5 m in crown and walls + invert bolts`;
      rmrShotcrete = '150–200 mm in crown, 150 mm in sides, and 50 mm on face';
      rmrRibs = 'Medium to heavy ribs spaced 0.75 m with steel lagging and forepoling + closed invert';
    }
  }

  return {
    spanMeters: span,
    esr,
    equivalentDimensionDe: De,
    maxUnsupportedSpanMeters: maxUnsupportedSpan,
    qValue: qVal,
    qSupportCategoryNumber: catNum,
    qSupportCategoryTitle: catTitle,
    boltLengthMeters: boltLength,
    boltSpacingMeters: boltSpacing,
    shotcreteThicknessMm: shotcreteMm,
    steelRibsPrescription: ribs,
    rmrValue: rmrComputedValue,
    rmrClassLabel,
    rmrExcavationMethod: rmrExcavation,
    rmrBoltPrescription: rmrBolts,
    rmrShotcretePrescription: rmrShotcrete,
    rmrSteelSetsPrescription: rmrRibs,
  };
}

// ============================================================================
// 4. CHAINAGE LOG STRIP (LONGITUDINAL SUMMARY ACROSS STATIONS)
// ============================================================================

export interface LongitudinalStationLogRow {
  id: string;
  chainageMeters: number;
  chainageLabel: string;
  tunnelName: string;
  location: string;
  rmrValue: number | null;
  rmrClass: string;
  qValue: number | null;
  qClass: string;
  rqdPct: number;
  supportCategory: string;
  isWeakOrFaultZone: boolean;
  isCurrentStation: boolean;
}

export function buildLongitudinalChainageLog(
  savedProjects: SavedProjectRecord[],
  currentSettings: TunnelSettings,
  currentGeometry: TunnelGeometry,
  currentQParams: QIndexParameters,
  currentRmrParams: RmrParameters,
  currentQVal: number | null,
  currentRmrVal: number | null
): LongitudinalStationLogRow[] {
  const rows: LongitudinalStationLogRow[] = [];

  const parseCh = (str: string): number => {
    const cleaned = str.replace(/,/g, '');
    const plusMatch = cleaned.match(/(\d+)\s*\+\s*(\d+(\.\d+)?)/);
    if (plusMatch) {
      return Number(plusMatch[1]) * 1000 + Number(plusMatch[2]);
    }
    const numMatch = cleaned.match(/(\d+(\.\d+)?)/);
    return numMatch ? Number(numMatch[1]) : 132.0;
  };

  for (const rec of savedProjects) {
    const rmrRes = rec.rmrParams ? calculateBieniawskiRmr(rec.rmrParams) : null;
    const qVal = rec.qIndexParams
      ? Number(
          (
            (rec.qIndexParams.rqd / Math.max(0.5, rec.qIndexParams.jn)) *
            (rec.qIndexParams.jr / Math.max(0.5, rec.qIndexParams.ja)) *
            (rec.qIndexParams.jw / Math.max(0.5, rec.qIndexParams.srf))
          ).toFixed(2)
        )
      : null;
    const rqd = rec.rmrParams?.rqdPercent ?? rec.qIndexParams?.rqd ?? 65;
    const hasFault = (rec.joints || []).some((j) => j.featureType === 'fault' || j.set === 'F1');
    const isWeak =
      hasFault ||
      (rmrRes?.finalRmr !== null && rmrRes?.finalRmr !== undefined && rmrRes.finalRmr < 40) ||
      (qVal !== null && qVal < 1.0);

    const sup = computeEmpiricalSupportRecommendation(
      rec.geometry,
      rec.qIndexParams,
      rec.rmrParams || currentRmrParams,
      qVal !== null,
      qVal,
      rmrRes?.finalRmr ?? null
    );

    const recChainageM = rec.numericChainageMeters || parseCh(rec.faceChainage || rec.chainage);
    rows.push({
      id: rec.id,
      chainageMeters: recChainageM,
      chainageLabel: rec.faceChainage || `RD ${recChainageM.toFixed(1)}m`,
      tunnelName: rec.tunnelName,
      location: rec.location,
      rmrValue: rmrRes?.finalRmr ?? null,
      rmrClass: rmrRes?.rockMassClassLabel || '—',
      qValue: qVal,
      qClass: qVal !== null ? (qVal >= 10 ? 'Good' : qVal >= 4 ? 'Fair' : qVal >= 1 ? 'Poor' : 'Very Poor') : '—',
      rqdPct: rqd,
      supportCategory: `Cat ${sup.qSupportCategoryNumber} (${sup.shotcreteThicknessMm}mm Sfr)`,
      isWeakOrFaultZone: isWeak,
      isCurrentStation: false,
    });
  }

  // Always include or update the active station
  const activeCh = parseCh(currentSettings.faceChainage || currentSettings.chainage);
  const activeSup = computeEmpiricalSupportRecommendation(
    currentGeometry,
    currentQParams,
    currentRmrParams,
    currentQVal !== null,
    currentQVal,
    currentRmrVal
  );
  const activeRqd = currentRmrParams.rqdPercent ?? currentQParams.rqd ?? 68;
  const activeWeak =
    (currentRmrVal !== null && currentRmrVal < 40) || (currentQVal !== null && currentQVal < 1.0);

  const existingIdx = rows.findIndex((r) => Math.abs(r.chainageMeters - activeCh) < 0.05);
  const activeRow: LongitudinalStationLogRow = {
    id: 'current-active-station',
    chainageMeters: activeCh,
    chainageLabel: currentSettings.faceChainage || `RD ${activeCh.toFixed(1)}m`,
    tunnelName: currentSettings.tunnelName,
    location: currentSettings.locationName || 'Main Heading',
    rmrValue: currentRmrVal,
    rmrClass:
      currentRmrVal !== null
        ? currentRmrVal >= 81
          ? 'Class I'
          : currentRmrVal >= 61
          ? 'Class II'
          : currentRmrVal >= 41
          ? 'Class III'
          : currentRmrVal >= 21
          ? 'Class IV'
          : 'Class V'
        : 'Unconfirmed',
    qValue: currentQVal,
    qClass:
      currentQVal !== null
        ? currentQVal >= 10
          ? 'Good'
          : currentQVal >= 4
          ? 'Fair'
          : currentQVal >= 1
          ? 'Poor'
          : 'Very Poor'
        : 'Unconfirmed',
    rqdPct: activeRqd,
    supportCategory: `Cat ${activeSup.qSupportCategoryNumber} (L=${activeSup.boltLengthMeters}m, ${activeSup.shotcreteThicknessMm}mm)`,
    isWeakOrFaultZone: activeWeak,
    isCurrentStation: true,
  };

  if (existingIdx >= 0) {
    rows[existingIdx] = activeRow;
  } else {
    rows.push(activeRow);
  }

  return rows.sort((a, b) => a.chainageMeters - b.chainageMeters);
}

// ============================================================================
// 5. ONE-CLICK DXF EXPORT OF MAPPED GEOLOGICAL SHEET (AUTOCAD / CIVIL 3D)
//    Exports Tunnel Profile + Unfolded Perimeter + Mapped Joint Traces +
//    Dip/Dip-Direction Callouts + Seepage Zones + Classification & Support Block
// ============================================================================

export function exportMappedGeologicalSheetToDXF(params: {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  seepageZones?: GroundwaterSeepageZone[];
  selectedMethod: RockMassClassificationMethodId;
  qIndexParams: QIndexParameters;
  rmrParams: RmrParameters;
  gsiParams: GsiParameters;
  qValue: number | null;
  rmrValue: number | null;
}): string {
  const {
    geometry,
    settings,
    joints,
    seepageZones = [],
    selectedMethod,
    qIndexParams,
    rmrParams,
    qValue,
    rmrValue,
  } = params;

  const support = computeEmpiricalSupportRecommendation(
    geometry,
    qIndexParams,
    rmrParams,
    qValue !== null,
    qValue,
    rmrValue
  );

  const lines: string[] = [];
  const pushPair = (code: number, val: string | number) => {
    lines.push(String(code), String(val));
  };

  const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number, color = 7) => {
    pushPair(0, 'LINE');
    pushPair(8, layer);
    pushPair(62, color);
    pushPair(10, x1.toFixed(4));
    pushPair(20, y1.toFixed(4));
    pushPair(30, '0.0');
    pushPair(11, x2.toFixed(4));
    pushPair(21, y2.toFixed(4));
    pushPair(31, '0.0');
  };

  const addCircle = (layer: string, cx: number, cy: number, r: number, color = 7) => {
    pushPair(0, 'CIRCLE');
    pushPair(8, layer);
    pushPair(62, color);
    pushPair(10, cx.toFixed(4));
    pushPair(20, cy.toFixed(4));
    pushPair(30, '0.0');
    pushPair(40, r.toFixed(4));
  };

  const addText = (
    layer: string,
    x: number,
    y: number,
    height: number,
    text: string,
    color = 7
  ) => {
    pushPair(0, 'TEXT');
    pushPair(8, layer);
    pushPair(62, color);
    pushPair(10, x.toFixed(4));
    pushPair(20, y.toFixed(4));
    pushPair(30, '0.0');
    pushPair(40, height.toFixed(3));
    pushPair(1, text.replace(/[^\x20-\x7E]/g, ' '));
  };

  // DXF Header & Entities Section
  pushPair(0, 'SECTION');
  pushPair(2, 'HEADER');
  pushPair(9, '$INSUNITS');
  pushPair(70, 6); // 6 = Meters
  pushPair(0, 'ENDSEC');

  pushPair(0, 'SECTION');
  pushPair(2, 'ENTITIES');

  // 1. Tunnel Face Cross-Section Profile (Centered at X=0, Y=0..H)
  const pts = geometry.crossSectionPoints;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    addLine('TUNNEL_PROFILE_FACE', a.x, a.y, b.x, b.y, 4); // Cyan
  }

  // Centerline & Invert Datum axes
  const halfW = geometry.width / 2;
  addLine('DATUM_AXES', -halfW - 1.0, 0, halfW + 1.0, 0, 8);
  addLine('DATUM_AXES', 0, -0.8, 0, geometry.height + 1.0, 8);
  addText('DATUM_AXES', 0.15, geometry.height + 0.5, 0.25, `CL (0.00m) - SPAN ${geometry.width.toFixed(2)}m x HT ${geometry.height.toFixed(2)}m`, 4);

  // 2. Unfolded Perimeter Panels Above Face (Left Wall | Crown | Right Wall)
  const pullL = Math.max(1.5, settings.roundLength || 3.5);
  const crownW = geometry.crownArcLength || geometry.width;
  const wallH = geometry.wallHeight || geometry.height * 0.6;
  const baseUnfoldedY = geometry.height + 2.5;

  // Crown Box: X in [-crownW/2, +crownW/2], Y in [baseUnfoldedY, baseUnfoldedY + pullL]
  const drawRect = (layer: string, xMin: number, yMin: number, w: number, h: number, color: number, title: string) => {
    addLine(layer, xMin, yMin, xMin + w, yMin, color);
    addLine(layer, xMin + w, yMin, xMin + w, yMin + h, color);
    addLine(layer, xMin + w, yMin + h, xMin, yMin + h, color);
    addLine(layer, xMin, yMin + h, xMin, yMin, color);
    addText(layer, xMin + 0.2, yMin + h + 0.25, 0.22, title, color);
  };

  drawRect('UNFOLDED_PERIMETER', -crownW / 2, baseUnfoldedY, crownW, pullL, 3, `CROWN ARCH (${crownW.toFixed(2)}m x ${pullL.toFixed(2)}m)`);
  drawRect('UNFOLDED_PERIMETER', -crownW / 2 - wallH - 0.5, baseUnfoldedY, wallH, pullL, 3, `LEFT WALL (${wallH.toFixed(2)}m)`);
  drawRect('UNFOLDED_PERIMETER', crownW / 2 + 0.5, baseUnfoldedY, wallH, pullL, 3, `RIGHT WALL (${wallH.toFixed(2)}m)`);

  // Helper to transform surface coordinates into CAD sheet coordinates
  const surfacePtToCad = (pt: Point2D, surf: SurfaceType): Point2D => {
    if (surf === 'face') return pt;
    if (surf === 'crown') {
      return { x: pt.x, y: baseUnfoldedY + pt.y };
    }
    if (surf === 'leftWall') {
      return { x: -crownW / 2 - 0.5 - wallH / 2 + pt.x, y: baseUnfoldedY + pt.y };
    }
    return { x: crownW / 2 + 0.5 + wallH / 2 + pt.x, y: baseUnfoldedY + pt.y };
  };

  // 3. Mapped Discontinuity Traces + Dip/Dip-Direction Callouts
  const setColorsDxf: Record<string, number> = {
    J1: 1, // Red
    J2: 3, // Green
    J3: 5, // Blue
    J4: 2, // Yellow
    J5: 6, // Magenta
    J0: 4, // Cyan
    F1: 1, // Red
  };

  for (const j of joints) {
    if (j.geometry.length < 2) continue;
    const layer = `GEOLOGY_${j.set}_${j.surface.toUpperCase()}`;
    const col = setColorsDxf[j.set] || 7;
    const cadPts = j.geometry.map((pt) => surfacePtToCad(pt, j.surface));

    for (let i = 0; i < cadPts.length - 1; i++) {
      addLine(layer, cadPts[i].x, cadPts[i].y, cadPts[i + 1].x, cadPts[i + 1].y, col);
    }

    const mid = cadPts[Math.floor(cadPts.length / 2)];
    const labelStr = `${j.jointNumber || j.id} [${j.set}] ${Math.round(j.dip)}d/${String(Math.round(j.dipDirection)).padStart(3, '0')}d`;
    addText(`${layer}_LABELS`, mid.x + 0.12, mid.y + 0.1, 0.18, labelStr, col);
  }

  // 4. Groundwater Seepage Zones
  for (const z of seepageZones) {
    const c = surfacePtToCad({ x: z.locationX, y: z.locationY }, z.surface);
    addCircle('GROUNDWATER_SEEPAGE', c.x, c.y, Math.max(0.25, z.radiusMeters), 5);
    addText(
      'GROUNDWATER_SEEPAGE',
      c.x + 0.15,
      c.y + 0.15,
      0.18,
      `WATER [${z.condition}] ${z.inflowLPerMin} L/min`,
      5
    );
  }

  // 5. Engineering Classification & Support Block (To the right of the Face)
  const blockX = Math.max(halfW + 3.0, crownW / 2 + wallH + 2.5);
  let cursorY = geometry.height + pullL + 2.0;
  const lineStep = 0.42;

  const writeBlockLine = (txt: string, col = 7, h = 0.24) => {
    addText('ENGINEERING_TITLE_BLOCK', blockX, cursorY, h, txt, col);
    cursorY -= lineStep;
  };

  writeBlockLine(`TUNNEL GEOLOGICAL MAPPING & CLASSIFICATION SHEET`, 4, 0.32);
  writeBlockLine(`Tunnel: ${settings.tunnelName} | Location: ${settings.locationName || 'Main Drive'}`);
  writeBlockLine(`Station / Chainage: ${settings.faceChainage} | Drive Azimuth: N ${Math.round(settings.driveDirection)} deg E`);
  writeBlockLine(`Profile: ${geometry.profileName || geometry.crownGeometry} (${geometry.width.toFixed(2)}m W x ${geometry.height.toFixed(2)}m H)`);
  writeBlockLine(`------------------------------------------------------------------`, 8);
  writeBlockLine(`SELECTED CLASSIFICATION METHOD: ${selectedMethod}`, 3, 0.26);

  if (selectedMethod === 'RMR' || selectedMethod === 'BOTH_RMR_AND_Q') {
    writeBlockLine(
      `RMR (${rmrParams.version}): ${rmrValue !== null ? rmrValue : 'Required input not available'} | ${support.rmrClassLabel}`,
      2
    );
  }
  if (selectedMethod === 'Q_SYSTEM' || selectedMethod === 'BOTH_RMR_AND_Q') {
    writeBlockLine(
      `Barton Q-System: Q = ${qValue !== null ? qValue.toFixed(2) : 'Required input not available'} (RQD=${qIndexParams.rqd}%, Jn=${qIndexParams.jn}, Jr=${qIndexParams.jr}, Ja=${qIndexParams.ja}, Jw=${qIndexParams.jw}, SRF=${qIndexParams.srf})`,
      4
    );
  }
  writeBlockLine(`------------------------------------------------------------------`, 8);
  writeBlockLine(`EMPIRICAL SUPPORT RECOMMENDATION (De = ${support.equivalentDimensionDe}m):`, 3, 0.26);
  writeBlockLine(`Q Support Category: ${support.qSupportCategoryTitle}`);
  writeBlockLine(
    `Rockbolts: L = ${support.boltLengthMeters} m @ ${support.boltSpacingMeters} m c/c | Shotcrete: ${support.shotcreteThicknessMm} mm Sfr`
  );
  writeBlockLine(`Steel Ribs / Girders: ${support.steelRibsPrescription}`);

  pushPair(0, 'ENDSEC');
  pushPair(0, 'EOF');

  return lines.join('\n');
}

export function triggerDownloadDXFSheet(filename: string, dxfContent: string): void {
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
