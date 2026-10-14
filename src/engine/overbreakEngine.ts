import {
  ConnectedSurveyProfile,
  Joint,
  OverbreakReasonCategory,
  OverbreakUndercutAnalysis,
  OverbreakUndercutRegion,
  Point2D,
  SurfaceType,
  SurveyControlPoint,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';

export function createDefaultConnectedSurveyProfile(
  surface: SurfaceType = 'face',
  defaultPullMeters: number | null = 3.5
): ConnectedSurveyProfile {
  return {
    surface,
    orderedControlPointIds: [],
    isClosed: true,
    visible: true,
    locked: false,
    pullIntervalMeters: defaultPullMeters && defaultPullMeters > 0 ? defaultPullMeters : null,
    useValidPullInterval: Boolean(defaultPullMeters && defaultPullMeters > 0),
    zoneReasonOverrides: {},
    overallOverbreakCategory: 'GEOLOGICAL',
    overallOverbreakReason:
      'Wedge detachment along intersecting discontinuity sets J1 & J2 at crown/shoulder',
    overallUndercutCategory: 'MECHANICAL_EXCAVATION',
    overallUndercutReason:
      'Tight perimeter excavation alignment / under-excavation at lower sidewall toe',
  };
}

/**
 * Shoelace formula for true 2D polygon area in square meters (m²).
 */
export function computePolygonAreaSqMeters(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return Number((Math.abs(sum) * 0.5).toFixed(3));
}

export function computePolylineLengthMeters(points: Point2D[], isClosed = false): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  if (isClosed && points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    len += Math.hypot(first.x - last.x, first.y - last.y);
  }
  return Number(len.toFixed(3));
}

export function getPolygonCentroidPoint(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  const sx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
  const sy = points.reduce((acc, p) => acc + p.y, 0) / points.length;
  return { x: Number(sx.toFixed(3)), y: Number(sy.toFixed(3)) };
}

/**
 * Sorts control points clockwise around the tunnel profile starting from left invert (-W/2, 0)
 * -> Left Wall -> Left Shoulder -> Crown -> Right Shoulder -> Right Wall -> Right Invert (+W/2, 0).
 */
export function sortControlPointsAroundPerimeter(
  points: SurveyControlPoint[],
  geometry: TunnelGeometry
): string[] {
  const centroid = getPolygonCentroidPoint(geometry.crossSectionPoints);
  const refCenterX = centroid.x;
  const refCenterY = Math.max(0.5, centroid.y);
  const withAngle = points.map((cp) => {
    // Angle measured clockwise starting from bottom-left (-PI*0.75)
    const dx = cp.point.x - refCenterX;
    const dy = cp.point.y - refCenterY;
    // Standard atan2 is counter-clockwise from +X; we convert to clockwise from bottom (-Y)
    const angleFromBottomCW = Math.atan2(dx, -dy);
    return { id: cp.id, angle: angleFromBottomCW };
  });
  withAngle.sort((a, b) => a.angle - b.angle);
  return withAngle.map((item) => item.id);
}

/**
 * Ray-segment intersection from origin (ox, oy) along unit direction (dx, dy) with segment AB.
 * Returns distance r >= 0 if intersected, or null.
 */
function intersectRayWithSegment(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  a: Point2D,
  b: Point2D
): { r: number; pt: Point2D } | null {
  const v1x = ox - a.x;
  const v1y = oy - a.y;
  const v2x = b.x - a.x;
  const v2y = b.y - a.y;
  const v3x = -dy;
  const v3y = dx;

  const dot = v2x * v3x + v2y * v3y;
  if (Math.abs(dot) < 1e-9) return null;

  const t1 = (v2x * v1y - v2y * v1x) / dot;
  const t2 = (v1x * v3x + v1y * v3y) / dot;

  if (t1 >= 0 && t2 >= -1e-5 && t2 <= 1 + 1e-5) {
    return {
      r: t1,
      pt: {
        x: ox + t1 * dx,
        y: oy + t1 * dy,
      },
    };
  }
  return null;
}

function intersectRayWithPolygon(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  poly: Point2D[],
  isClosed = true
): { r: number; pt: Point2D } | null {
  if (poly.length < 2) return null;
  let best: { r: number; pt: Point2D } | null = null;
  const segCount = isClosed ? poly.length : poly.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const hit = intersectRayWithSegment(ox, oy, dx, dy, a, b);
    if (hit && (!best || hit.r > best.r)) {
      best = hit;
    }
  }
  return best;
}

function classifyTunnelLocationLabel(pt: Point2D, geometry: TunnelGeometry): string {
  const halfW = geometry.width / 2;
  if (pt.y <= 0.35) return 'Invert / Floor';
  if (pt.y >= geometry.height * 0.84 && Math.abs(pt.x) <= halfW * 0.45) {
    return 'Crown Arch';
  }
  if (pt.y >= geometry.wallHeight * 0.9) {
    return pt.x < 0 ? 'Left Shoulder / Haunch' : 'Right Shoulder / Haunch';
  }
  return pt.x < 0 ? 'Left Sidewall' : 'Right Sidewall';
}

/**
 * Generates a realistic set of Survey Control Points (CP1 -> CP14) and connected profile
 * around the design tunnel geometry so the user can test Overbreak and Undercut immediately
 * or adjust individual points.
 */
export function generateRealisticSampleSurveyedProfile(
  geometry: TunnelGeometry,
  surface: SurfaceType = 'face',
  pullMeters = 3.5
): { controlPoints: SurveyControlPoint[]; profile: ConnectedSurveyProfile } {
  const designPoly = geometry.crossSectionPoints;
  const centroid = getPolygonCentroidPoint(designPoly);
  const refCenterX = centroid.x;
  const refCenterY = Math.max(0.5, centroid.y);

  // Sample 14 stations clockwise from left invert -> left wall -> crown -> right wall -> right invert
  // Radial offsets (m): positive = Overbreak (outside design), negative = Undercut (inside design)
  const stationSpecs: { angleFromTopCWDeg: number; radialOffsetMeters: number; note: string }[] = [
    { angleFromTopCWDeg: -132, radialOffsetMeters: 0.0, note: 'Left Invert Corner' },
    { angleFromTopCWDeg: -112, radialOffsetMeters: -0.14, note: 'Left Lower Wall (Undercut)' },
    { angleFromTopCWDeg: -92, radialOffsetMeters: -0.19, note: 'Left Mid Wall (Undercut)' },
    { angleFromTopCWDeg: -70, radialOffsetMeters: 0.04, note: 'Left Springline' },
    { angleFromTopCWDeg: -48, radialOffsetMeters: 0.24, note: 'Left Shoulder Overbreak' },
    { angleFromTopCWDeg: -24, radialOffsetMeters: 0.38, note: 'Left Crown Haunch Overbreak' },
    { angleFromTopCWDeg: 0, radialOffsetMeters: 0.44, note: 'Crown Apex Wedge Overbreak' },
    { angleFromTopCWDeg: 24, radialOffsetMeters: 0.49, note: 'Right Crown Wedge Overbreak' },
    { angleFromTopCWDeg: 48, radialOffsetMeters: 0.31, note: 'Right Shoulder Overbreak' },
    { angleFromTopCWDeg: 70, radialOffsetMeters: 0.03, note: 'Right Springline' },
    { angleFromTopCWDeg: 92, radialOffsetMeters: -0.22, note: 'Right Wall Undercut Toe' },
    { angleFromTopCWDeg: 112, radialOffsetMeters: -0.16, note: 'Right Lower Wall Undercut' },
    { angleFromTopCWDeg: 132, radialOffsetMeters: 0.0, note: 'Right Invert Corner' },
    { angleFromTopCWDeg: 180, radialOffsetMeters: 0.02, note: 'Centerline Invert Floor' },
  ];

  const cps: SurveyControlPoint[] = [];
  const ts = Date.now();

  stationSpecs.forEach((spec, idx) => {
    const rad = (spec.angleFromTopCWDeg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);
    const hit = intersectRayWithPolygon(refCenterX, refCenterY, dx, dy, designPoly, true);
    const baseR = hit ? hit.r : geometry.width * 0.45;
    const surveyR = Math.max(0.4, baseR + spec.radialOffsetMeters);
    const px = Number((refCenterX + dx * surveyR).toFixed(2));
    const py = Number(Math.max((geometry.minY ?? 0) - 0.25, refCenterY + dy * surveyR).toFixed(2));

    cps.push({
      id: `cp-asbuilt-${ts}-${idx + 1}`,
      label: `CP${idx + 1}`,
      surface,
      point: { x: px, y: py },
      note: spec.note,
      color: '#10B981',
      visible: true,
      locked: false,
    });
  });

  const profile: ConnectedSurveyProfile = {
    surface,
    orderedControlPointIds: cps.map((c) => c.id),
    isClosed: true,
    visible: true,
    locked: false,
    pullIntervalMeters: pullMeters > 0 ? pullMeters : null,
    useValidPullInterval: pullMeters > 0,
    zoneReasonOverrides: {},
    overallOverbreakCategory: 'GEOLOGICAL',
    overallOverbreakReason:
      'Wedge detachment controlled by intersecting J1 & J2 joints in crown & right shoulder',
    overallUndercutCategory: 'MECHANICAL_EXCAVATION',
    overallUndercutReason:
      'Under-excavated rock ledge at lower sidewalls due to inward perimeter alignment',
  };

  return { controlPoints: cps, profile };
}

/**
 * Parses CSV / TSV / whitespace-delimited survey control points:
 * Format supported:
 *   CP1, -4.20, 0.00
 *   CP2, -4.15, 2.10
 * or:
 *   -4.20 0.00
 */
export function parseSurveyControlPointsFromText(
  rawText: string,
  surface: SurfaceType = 'face',
  existingCount = 0
): SurveyControlPoint[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const results: SurveyControlPoint[] = [];
  const ts = Date.now();

  lines.forEach((line, idx) => {
    const parts = line.split(/[,;\t\s]+/).filter(Boolean);
    if (parts.length < 2) return;

    let label = `CP${existingCount + results.length + 1}`;
    let xVal = NaN;
    let yVal = NaN;

    const firstNum = parseFloat(parts[0]);
    const secondNum = parseFloat(parts[1]);
    if (!Number.isNaN(firstNum) && !Number.isNaN(secondNum) && parts.length === 2) {
      xVal = firstNum;
      yVal = secondNum;
    } else if (parts.length >= 3) {
      label = parts[0];
      xVal = parseFloat(parts[1]);
      yVal = parseFloat(parts[2]);
    }

    if (!Number.isNaN(xVal) && !Number.isNaN(yVal)) {
      results.push({
        id: `cp-imp-${ts}-${idx + 1}`,
        label,
        surface,
        point: {
          x: Number(xVal.toFixed(3)),
          y: Number(yVal.toFixed(3)),
        },
        color: '#10B981',
        visible: true,
        locked: false,
      });
    }
  });

  return results;
}

/**
 * Core Engineering Overbreak & Undercut Analysis Engine (Sections 1 to 7).
 *
 * Compares the authoritative DESIGN / REFERENCE TUNNEL PROFILE against the
 * SURVEYED / AS-BUILT TUNNEL PROFILE formed by connected survey control points
 * (CP1 -> CP2 -> CP3 -> ...).
 *
 * Note: Isolated control points alone do NOT define a profile; only connected
 * control-point sequences in `surveyProfile.orderedControlPointIds` are evaluated.
 */
export function analyzeOverbreakAndUndercut(
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  controlPoints: SurveyControlPoint[],
  surveyProfile: ConnectedSurveyProfile,
  joints: Joint[] = []
): OverbreakUndercutAnalysis {
  const designPoly = geometry.crossSectionPoints;
  const designAreaSqMeters = computePolygonAreaSqMeters(designPoly);
  const designPerimeterMeters = computePolylineLengthMeters(designPoly, true);

  // Map control points by ID for fast lookup
  const cpMap = new Map<string, SurveyControlPoint>();
  for (const cp of controlPoints) {
    if (cp.surface === surveyProfile.surface && cp.visible !== false) {
      cpMap.set(cp.id, cp);
    }
  }

  // Extract ordered connected points (CP1 -> CP2 -> CP3 -> ...), falling back to all visible surface control points sorted around the perimeter
  const connectedPolyline: Point2D[] = [];
  const usedIds = new Set<string>();
  for (const cpId of surveyProfile.orderedControlPointIds) {
    const cp = cpMap.get(cpId);
    if (cp) {
      connectedPolyline.push(cp.point);
      usedIds.add(cp.id);
    }
  }
  if (cpMap.size > connectedPolyline.length) {
    const allSortedIds = sortControlPointsAroundPerimeter(
      Array.from(cpMap.values()),
      geometry
    );
    if (connectedPolyline.length < 2) {
      connectedPolyline.length = 0;
      for (const id of allSortedIds) {
        const cp = cpMap.get(id);
        if (cp) connectedPolyline.push(cp.point);
      }
    } else {
      for (const id of allSortedIds) {
        if (!usedIds.has(id)) {
          const cp = cpMap.get(id);
          if (cp) connectedPolyline.push(cp.point);
        }
      }
    }
  }

  const hasValidVolumeInterval =
    Boolean(surveyProfile.useValidPullInterval) &&
    typeof surveyProfile.pullIntervalMeters === 'number' &&
    !Number.isNaN(surveyProfile.pullIntervalMeters) &&
    surveyProfile.pullIntervalMeters > 0;

  const effectivePullIntervalMeters = hasValidVolumeInterval
    ? Number(surveyProfile.pullIntervalMeters!.toFixed(2))
    : null;

  const volumeStatusMessage = hasValidVolumeInterval
    ? `Volume = Area × ${effectivePullIntervalMeters!.toFixed(2)} m pull/chainage interval`
    : 'Volume requires valid chainage/pull interval.';

  // Require at least 1 survey control point on the surface
  if (connectedPolyline.length < 1) {
    return {
      surface: surveyProfile.surface,
      hasConnectedProfile: false,
      hasValidSurveyProfile: false,
      connectedPointsCount: connectedPolyline.length,
      connectedPolyline,
      surveyedPolygon: connectedPolyline,
      closedAsBuiltPolygon: [],
      designAreaSqMeters,
      surveyedAreaSqMeters: 0,
      designPerimeterMeters,
      surveyedPerimeterMeters: 0,
      overbreakAreaSqMeters: 0,
      overbreakPercentage: 0,
      overbreakPercent: 0,
      maxRadialOverbreakMeters: 0,
      minRadialOverbreakMeters: 0,
      avgRadialOverbreakMeters: 0,
      overbreakPerimeterMeters: 0,
      affectedOverbreakPerimeterMeters: 0,
      overbreakVolumeCubicMeters: null,
      undercutAreaSqMeters: 0,
      undercutPercentage: 0,
      undercutPercent: 0,
      maxRadialUndercutMeters: 0,
      minRadialUndercutMeters: 0,
      avgRadialUndercutMeters: 0,
      undercutPerimeterMeters: 0,
      affectedUndercutPerimeterMeters: 0,
      undercutVolumeCubicMeters: null,
      hasValidVolumeInterval,
      effectivePullIntervalMeters,
      pullIntervalMeters: effectivePullIntervalMeters,
      designVolumeCubicMeters:
        hasValidVolumeInterval && effectivePullIntervalMeters !== null
          ? Number((designAreaSqMeters * effectivePullIntervalMeters).toFixed(2))
          : null,
      surveyedVolumeCubicMeters: null,
      overallOverbreakCategory: surveyProfile.overallOverbreakCategory || 'GEOLOGICAL',
      overallOverbreakReason:
        surveyProfile.overallOverbreakReason ||
        'Wedge detachment along intersecting discontinuity sets J1 & J2',
      overallUndercutCategory:
        surveyProfile.overallUndercutCategory || 'MECHANICAL_EXCAVATION',
      overallUndercutReason:
        surveyProfile.overallUndercutReason ||
        'Tight perimeter excavation alignment / under-excavation rock toe',
      volumeStatusMessage,
      chainageLocation: settings.faceChainage || settings.chainage,
      overbreakRegions: [],
      undercutRegions: [],
    };
  }

  const centroid = getPolygonCentroidPoint(designPoly);
  const refCenterX = centroid.x;
  const refCenterY = Math.max(0.5, centroid.y);

  // Build angular station metadata for each placed control point so both full-ring surveys
  // and local overcut/undercut control points (1 to 5 points) produce accurate boundary profiles
  const cpRadialMeta = connectedPolyline
    .map((pt) => {
      const dx = pt.x - refCenterX;
      const dy = pt.y - refCenterY;
      const angleRad = Math.atan2(dx, dy);
      const rCp = Math.hypot(dx, dy);
      const ux = rCp > 1e-6 ? dx / rCp : 0;
      const uy = rCp > 1e-6 ? dy / rCp : 1;
      const desHit = intersectRayWithPolygon(refCenterX, refCenterY, ux, uy, designPoly, true);
      const rDes = desHit ? desHit.r : rCp;
      return {
        pt,
        angleRad,
        rCp,
        rDes,
        deltaR: rCp - rDes,
      };
    })
    .sort((a, b) => a.angleRad - b.angleRad);

  const shortAngularDiff = (a: number, b: number) => {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };

  // Sample radial stations around the tunnel profile centroid (refCenterX, refCenterY)
  const numStations = 180;
  interface StationSample {
    idx: number;
    angleRad: number;
    designPt: Point2D;
    surveyPt: Point2D;
    rDesign: number;
    rSurvey: number;
    deltaR: number; // + = Overbreak (outside design), - = Undercut (inside design)
    validSurveyHit: boolean;
  }

  const isFullRingSurvey = connectedPolyline.length >= 6;
  const maxLocalChordAngleRad = (95 * Math.PI) / 180;
  const localTaperHalfWidthRad = (22 * Math.PI) / 180;

  const stations: StationSample[] = [];
  for (let i = 0; i < numStations; i++) {
    // Clockwise from bottom-center (-PI to +PI)
    const theta = -Math.PI + ((i + 0.5) / numStations) * 2 * Math.PI;
    const dx = Math.sin(theta);
    const dy = Math.cos(theta);

    const desHit = intersectRayWithPolygon(refCenterX, refCenterY, dx, dy, designPoly, true);
    if (!desHit) continue;

    let survHit: { r: number; pt: Point2D } | null = null;
    if (isFullRingSurvey) {
      survHit = intersectRayWithPolygon(
        refCenterX,
        refCenterY,
        dx,
        dy,
        connectedPolyline,
        surveyProfile.isClosed
      );
    } else if (connectedPolyline.length >= 2) {
      // Check only non-spanning segments whose angular span <= 95° so partial overcut/undercut chains don't cut across the tunnel center
      for (let sIdx = 0; sIdx < cpRadialMeta.length; sIdx++) {
        const nextIdx = (sIdx + 1) % cpRadialMeta.length;
        if (nextIdx === 0 && cpRadialMeta.length < 4) continue;
        const aMeta = cpRadialMeta[sIdx];
        const bMeta = cpRadialMeta[nextIdx];
        if (Math.abs(shortAngularDiff(bMeta.angleRad, aMeta.angleRad)) <= maxLocalChordAngleRad) {
          const hit = intersectRayWithSegment(
            refCenterX,
            refCenterY,
            dx,
            dy,
            aMeta.pt,
            bMeta.pt
          );
          if (hit && (!survHit || hit.r > survHit.r)) {
            survHit = hit;
          }
        }
      }
    }

    if (!survHit && cpRadialMeta.length >= 1) {
      // Smooth local radial wedge/pocket interpolation around nearest overcut/undercut survey point
      let nearest = cpRadialMeta[0];
      let minAbsAng = Math.abs(shortAngularDiff(theta, nearest.angleRad));
      for (const m of cpRadialMeta) {
        const dAng = Math.abs(shortAngularDiff(theta, m.angleRad));
        if (dAng < minAbsAng) {
          minAbsAng = dAng;
          nearest = m;
        }
      }
      if (minAbsAng <= localTaperHalfWidthRad && Math.abs(nearest.deltaR) > 0.012) {
        const weight = 0.5 * (1 + Math.cos((Math.PI * minAbsAng) / localTaperHalfWidthRad));
        const rSurv = Math.max(0.2, desHit.r + nearest.deltaR * weight);
        survHit = {
          r: rSurv,
          pt: {
            x: refCenterX + dx * rSurv,
            y: refCenterY + dy * rSurv,
          },
        };
      }
    }

    if (survHit) {
      const deltaR = survHit.r - desHit.r;
      stations.push({
        idx: i,
        angleRad: theta,
        designPt: desHit.pt,
        surveyPt: survHit.pt,
        rDesign: desHit.r,
        rSurvey: survHit.r,
        deltaR,
        validSurveyHit: true,
      });
    } else {
      stations.push({
        idx: i,
        angleRad: theta,
        designPt: desHit.pt,
        surveyPt: desHit.pt,
        rDesign: desHit.r,
        rSurvey: desHit.r,
        deltaR: 0,
        validSurveyHit: false,
      });
    }
  }

  // Group contiguous Overbreak (deltaR > 0.01m) and Undercut (deltaR < -0.01m) zones
  const THRESHOLD_M = 0.012;
  const overbreakRegions: OverbreakUndercutRegion[] = [];
  const undercutRegions: OverbreakUndercutRegion[] = [];

  const activeSetIds = Array.from(new Set(joints.map((j) => j.set))).slice(0, 2);
  const defaultJointSetStr = activeSetIds.length > 0 ? activeSetIds.join(' + ') : 'J1 + J2';

  const buildRegionFromRun = (
    run: StationSample[],
    type: 'OVERBREAK' | 'UNDERCUT',
    seqIndex: number
  ): OverbreakUndercutRegion | null => {
    if (run.length === 0) return null;

    // Build closed polygon between design arc and surveyed arc
    const outerPts = run.map((s) => (type === 'OVERBREAK' ? s.surveyPt : s.designPt));
    const innerPts = run
      .slice()
      .reverse()
      .map((s) => (type === 'OVERBREAK' ? s.designPt : s.surveyPt));

    const polygon: Point2D[] = [
      run[0].designPt,
      ...outerPts,
      run[run.length - 1].designPt,
      ...innerPts,
    ].map((p) => ({
      x: Number(p.x.toFixed(3)),
      y: Number(p.y.toFixed(3)),
    }));

    // Calculate true area via Shoelace formula + radial sector fallback for very thin slivers
    const shoelaceArea = computePolygonAreaSqMeters(polygon);
    const dTheta = (2 * Math.PI) / numStations;
    const sectorArea = run.reduce(
      (acc, s) => acc + 0.5 * Math.abs(s.rSurvey * s.rSurvey - s.rDesign * s.rDesign) * dTheta,
      0
    );
    const areaSqMeters = Number(Math.max(shoelaceArea, sectorArea * 0.95).toFixed(3));
    if (areaSqMeters < 0.005) return null;

    const absDeltas = run.map((s) => Math.abs(s.deltaR));
    const maxRadialMeters = Number(Math.max(...absDeltas).toFixed(3));
    const minRadialMeters = Number(Math.min(...absDeltas).toFixed(3));
    const avgRadialMeters = Number(
      (absDeltas.reduce((a, b) => a + b, 0) / absDeltas.length).toFixed(3)
    );

    // Affected perimeter length along the design boundary
    let affectedPerimeterMeters = 0;
    for (let k = 0; k < run.length - 1; k++) {
      affectedPerimeterMeters += Math.hypot(
        run[k + 1].designPt.x - run[k].designPt.x,
        run[k + 1].designPt.y - run[k].designPt.y
      );
    }
    if (run.length === 1) {
      affectedPerimeterMeters = run[0].rDesign * dTheta;
    }
    affectedPerimeterMeters = Number(affectedPerimeterMeters.toFixed(2));

    // Find station with maximum deviation
    let peakStation = run[0];
    for (const s of run) {
      if (Math.abs(s.deltaR) > Math.abs(peakStation.deltaR)) {
        peakStation = s;
      }
    }

    const regionId = `${type === 'OVERBREAK' ? 'OB' : 'UC'}-${seqIndex}`;
    const locationLabel = classifyTunnelLocationLabel(peakStation.designPt, geometry);
    const override = surveyProfile.zoneReasonOverrides[regionId];

    const defaultCategory: OverbreakReasonCategory =
      type === 'OVERBREAK'
        ? surveyProfile.overallOverbreakCategory || 'GEOLOGICAL'
        : surveyProfile.overallUndercutCategory || 'MECHANICAL_EXCAVATION';

    const defaultDetail =
      type === 'OVERBREAK'
        ? `${locationLabel}: Wedge / block overbreak along ${defaultJointSetStr}`
        : `${locationLabel}: Inward perimeter profile / under-excavation rock toe`;

    return {
      id: regionId,
      type,
      polygon,
      areaSqMeters,
      percentageOfDesign: Number(
        ((areaSqMeters / Math.max(0.1, designAreaSqMeters)) * 100).toFixed(2)
      ),
      maxRadialMeters,
      minRadialMeters,
      avgRadialMeters,
      affectedPerimeterMeters,
      locationLabel,
      chainage: settings.faceChainage || settings.chainage,
      centroid: getPolygonCentroidPoint(polygon),
      maxDeviationPoint: peakStation.surveyPt,
      maxRadialPoint: peakStation.surveyPt,
      designReferencePoint: peakStation.designPt,
      reasonCategory: override?.category || defaultCategory,
      reasonDetail: override?.reasonDetail || defaultDetail,
      linkedJointSets: override?.linkedJointSets || (type === 'OVERBREAK' ? defaultJointSetStr : 'N/A'),
    };
  };

  let currentRun: StationSample[] = [];
  let currentType: 'OVERBREAK' | 'UNDERCUT' | null = null;

  for (const st of stations) {
    const stType: 'OVERBREAK' | 'UNDERCUT' | null =
      st.validSurveyHit && st.deltaR > THRESHOLD_M
        ? 'OVERBREAK'
        : st.validSurveyHit && st.deltaR < -THRESHOLD_M
        ? 'UNDERCUT'
        : null;

    if (stType === currentType && stType !== null) {
      currentRun.push(st);
    } else {
      if (currentRun.length > 0 && currentType !== null) {
        if (currentType === 'OVERBREAK') {
          const reg = buildRegionFromRun(currentRun, 'OVERBREAK', overbreakRegions.length + 1);
          if (reg) overbreakRegions.push(reg);
        } else {
          const reg = buildRegionFromRun(currentRun, 'UNDERCUT', undercutRegions.length + 1);
          if (reg) undercutRegions.push(reg);
        }
      }
      currentRun = stType !== null ? [st] : [];
      currentType = stType;
    }
  }

  if (currentRun.length > 0 && currentType !== null) {
    if (currentType === 'OVERBREAK') {
      const reg = buildRegionFromRun(currentRun, 'OVERBREAK', overbreakRegions.length + 1);
      if (reg) overbreakRegions.push(reg);
    } else {
      const reg = buildRegionFromRun(currentRun, 'UNDERCUT', undercutRegions.length + 1);
      if (reg) undercutRegions.push(reg);
    }
  }

  // Aggregate total Overbreak & Undercut metrics
  const overbreakAreaSqMeters = Number(
    overbreakRegions.reduce((acc, r) => acc + r.areaSqMeters, 0).toFixed(2)
  );
  const undercutAreaSqMeters = Number(
    undercutRegions.reduce((acc, r) => acc + r.areaSqMeters, 0).toFixed(2)
  );

  const overbreakPercentage = Number(
    ((overbreakAreaSqMeters / Math.max(0.1, designAreaSqMeters)) * 100).toFixed(2)
  );
  const undercutPercentage = Number(
    ((undercutAreaSqMeters / Math.max(0.1, designAreaSqMeters)) * 100).toFixed(2)
  );

  const maxRadialOverbreakMeters =
    overbreakRegions.length > 0
      ? Number(Math.max(...overbreakRegions.map((r) => r.maxRadialMeters)).toFixed(3))
      : 0;
  const minRadialOverbreakMeters =
    overbreakRegions.length > 0
      ? Number(Math.min(...overbreakRegions.map((r) => r.minRadialMeters)).toFixed(3))
      : 0;
  const avgRadialOverbreakMeters =
    overbreakRegions.length > 0
      ? Number(
          (
            overbreakRegions.reduce((acc, r) => acc + r.avgRadialMeters * r.affectedPerimeterMeters, 0) /
            Math.max(
              0.01,
              overbreakRegions.reduce((acc, r) => acc + r.affectedPerimeterMeters, 0)
            )
          ).toFixed(3)
        )
      : 0;
  const overbreakPerimeterMeters = Number(
    overbreakRegions.reduce((acc, r) => acc + r.affectedPerimeterMeters, 0).toFixed(2)
  );

  const maxRadialUndercutMeters =
    undercutRegions.length > 0
      ? Number(Math.max(...undercutRegions.map((r) => r.maxRadialMeters)).toFixed(3))
      : 0;
  const minRadialUndercutMeters =
    undercutRegions.length > 0
      ? Number(Math.min(...undercutRegions.map((r) => r.minRadialMeters)).toFixed(3))
      : 0;
  const avgRadialUndercutMeters =
    undercutRegions.length > 0
      ? Number(
          (
            undercutRegions.reduce((acc, r) => acc + r.avgRadialMeters * r.affectedPerimeterMeters, 0) /
            Math.max(
              0.01,
              undercutRegions.reduce((acc, r) => acc + r.affectedPerimeterMeters, 0)
            )
          ).toFixed(3)
        )
      : 0;
  const undercutPerimeterMeters = Number(
    undercutRegions.reduce((acc, r) => acc + r.affectedPerimeterMeters, 0).toFixed(2)
  );

  const closedAsBuiltPolygon =
    isFullRingSurvey && surveyProfile.isClosed
      ? connectedPolyline
      : stations.map((s) => s.surveyPt);

  const surveyedAreaSqMeters =
    isFullRingSurvey && surveyProfile.isClosed
      ? computePolygonAreaSqMeters(connectedPolyline)
      : Number((designAreaSqMeters + overbreakAreaSqMeters - undercutAreaSqMeters).toFixed(2));

  const surveyedPerimeterMeters = computePolylineLengthMeters(
    closedAsBuiltPolygon,
    true
  );

  // VOLUME = AREA * RELEVANT PULL / CHAINAGE INTERVAL (Only if valid interval exists!)
  const overbreakVolumeCubicMeters =
    hasValidVolumeInterval && effectivePullIntervalMeters !== null
      ? Number((overbreakAreaSqMeters * effectivePullIntervalMeters).toFixed(2))
      : null;

  const undercutVolumeCubicMeters =
    hasValidVolumeInterval && effectivePullIntervalMeters !== null
      ? Number((undercutAreaSqMeters * effectivePullIntervalMeters).toFixed(2))
      : null;

  const designVolumeCubicMeters =
    hasValidVolumeInterval && effectivePullIntervalMeters !== null
      ? Number((designAreaSqMeters * effectivePullIntervalMeters).toFixed(2))
      : null;

  const surveyedVolumeCubicMeters =
    hasValidVolumeInterval && effectivePullIntervalMeters !== null
      ? Number((surveyedAreaSqMeters * effectivePullIntervalMeters).toFixed(2))
      : null;

  return {
    surface: surveyProfile.surface,
    hasConnectedProfile: true,
    hasValidSurveyProfile: true,
    connectedPointsCount: connectedPolyline.length,
    connectedPolyline,
    surveyedPolygon: closedAsBuiltPolygon,
    closedAsBuiltPolygon,
    designAreaSqMeters: Number(designAreaSqMeters.toFixed(2)),
    surveyedAreaSqMeters: Number(surveyedAreaSqMeters.toFixed(2)),
    designPerimeterMeters: Number(designPerimeterMeters.toFixed(2)),
    surveyedPerimeterMeters: Number(surveyedPerimeterMeters.toFixed(2)),
    overbreakAreaSqMeters,
    overbreakPercentage,
    overbreakPercent: overbreakPercentage,
    maxRadialOverbreakMeters,
    minRadialOverbreakMeters,
    avgRadialOverbreakMeters,
    overbreakPerimeterMeters,
    affectedOverbreakPerimeterMeters: overbreakPerimeterMeters,
    overbreakVolumeCubicMeters,
    undercutAreaSqMeters,
    undercutPercentage,
    undercutPercent: undercutPercentage,
    maxRadialUndercutMeters,
    minRadialUndercutMeters,
    avgRadialUndercutMeters,
    undercutPerimeterMeters,
    affectedUndercutPerimeterMeters: undercutPerimeterMeters,
    undercutVolumeCubicMeters,
    hasValidVolumeInterval,
    effectivePullIntervalMeters,
    pullIntervalMeters: effectivePullIntervalMeters,
    designVolumeCubicMeters,
    surveyedVolumeCubicMeters,
    overallOverbreakCategory: surveyProfile.overallOverbreakCategory || 'GEOLOGICAL',
    overallOverbreakReason:
      surveyProfile.overallOverbreakReason ||
      'Wedge detachment along intersecting discontinuity sets J1 & J2',
    overallUndercutCategory:
      surveyProfile.overallUndercutCategory || 'MECHANICAL_EXCAVATION',
    overallUndercutReason:
      surveyProfile.overallUndercutReason ||
      'Tight perimeter excavation alignment / under-excavation rock toe',
    volumeStatusMessage,
    chainageLocation: settings.faceChainage || settings.chainage,
    overbreakRegions,
    undercutRegions,
  };
}
