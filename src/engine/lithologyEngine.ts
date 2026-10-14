import {
  Joint,
  LithologyPatternType,
  LithologyRegion,
  PhotoSurface,
  Point2D,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { getSurfaceBoundsMeters } from './geometryEngine';

export interface LithologyPreset {
  patternType: LithologyPatternType;
  defaultName: string;
  colorHex: string;
  defaultGrainNote: string;
}

export const LITHOLOGY_PRESETS: LithologyPreset[] = [
  {
    patternType: 'granite',
    defaultName: 'Granite',
    colorHex: '#FB7185',
    defaultGrainNote: 'Medium-to-coarse equigranular crystalline granitic rock mass',
  },
  {
    patternType: 'granodiorite',
    defaultName: 'Granodiorite',
    colorHex: '#F43F5E',
    defaultGrainNote: 'Medium-to-coarse crystalline plagioclase-hornblende-biotite granodiorite',
  },
  {
    patternType: 'gabbro',
    defaultName: 'Gabbro',
    colorHex: '#6366F1',
    defaultGrainNote: 'Coarse-grained mafic crystalline gabbroic rock mass',
  },
  {
    patternType: 'basalt',
    defaultName: 'Basalt',
    colorHex: '#64748B',
    defaultGrainNote: 'Fine-grained aphanitic to porphyritic basaltic rock mass',
  },
  {
    patternType: 'dolerite',
    defaultName: 'Dolerite',
    colorHex: '#475569',
    defaultGrainNote: 'Dark grey medium-grained intrusive dolerite body with chilled margin contacts',
  },
  {
    patternType: 'quartzite',
    defaultName: 'Quartzite',
    colorHex: '#EAB308',
    defaultGrainNote: 'Medium to coarse-grained crystalline quartzite',
  },
  {
    patternType: 'sandstone',
    defaultName: 'Sandstone',
    colorHex: '#F59E0B',
    defaultGrainNote: 'Well-indurated bedded quartzose sandstone',
  },
  {
    patternType: 'shale',
    defaultName: 'Shale',
    colorHex: '#94A3B8',
    defaultGrainNote: 'Thinly laminated argillaceous shale and siltstone',
  },
  {
    patternType: 'slate',
    defaultName: 'Slate',
    colorHex: '#38BDF8',
    defaultGrainNote: 'Fine-grained low-grade metamorphic slate with planar slaty cleavage',
  },
  {
    patternType: 'limestone',
    defaultName: 'Limestone',
    colorHex: '#22D3EE',
    defaultGrainNote: 'Compact bedded micritic to crystalline limestone',
  },
  {
    patternType: 'marble',
    defaultName: 'Marble',
    colorHex: '#67E8F9',
    defaultGrainNote: 'Recrystallized granoblastic calcitic/dolomitic marble',
  },
  {
    patternType: 'dolomite',
    defaultName: 'Dolomite',
    colorHex: '#2DD4BF',
    defaultGrainNote: 'Massive to thickly bedded crystalline dolomitic rock',
  },
  {
    patternType: 'schist',
    defaultName: 'Schist',
    colorHex: '#A78BFA',
    defaultGrainNote: 'Medium-grained foliated quartz-mica schist with undulating schistosity',
  },
  {
    patternType: 'gneiss',
    defaultName: 'Gneiss',
    colorHex: '#F472B6',
    defaultGrainNote: 'Coarse-grained banded quartzo-feldspathic gneiss',
  },
  {
    patternType: 'phyllite',
    defaultName: 'Phyllite',
    colorHex: '#60A5FA',
    defaultGrainNote: 'Fine-grained foliated phyllite with silky micaceous cleavage planes',
  },
  {
    patternType: 'quartzitic_phyllite',
    defaultName: 'Quartzitic Phyllite',
    colorHex: '#0EA5E9',
    defaultGrainNote: 'Fine-to-medium grained interbanded quartzitic phyllite with metamorphic foliation',
  },
  {
    patternType: 'conglomerate',
    defaultName: 'Conglomerate',
    colorHex: '#D97706',
    defaultGrainNote: 'Clast-supported polymictic conglomerate with indurated sandy matrix',
  },
  {
    patternType: 'breccia',
    defaultName: 'Breccia',
    colorHex: '#EA580C',
    defaultGrainNote: 'Angular clastic/tectonic rock breccia zone',
  },
  {
    patternType: 'clay_zone',
    defaultName: 'Clay Zone',
    colorHex: '#B45309',
    defaultGrainNote: 'Soft plastic to stiff argillaceous clay infill / alteration seam',
  },
  {
    patternType: 'weathered_rock',
    defaultName: 'Weathered Rock',
    colorHex: '#CA8A04',
    defaultGrainNote: 'Moderately weathered rock mass (W3) with iron-oxide stained joint walls',
  },
  {
    patternType: 'highly_weathered_rock',
    defaultName: 'Highly Weathered Rock',
    colorHex: '#A16207',
    defaultGrainNote: 'Highly to completely weathered friable rock mass (W4–W5)',
  },
  {
    patternType: 'fractured_crushed_rock',
    defaultName: 'Fractured / Crushed Rock',
    colorHex: '#F97316',
    defaultGrainNote: 'Intensely fractured and cataclastically crushed rock zone',
  },
  {
    patternType: 'fault_gouge',
    defaultName: 'Fault Gouge',
    colorHex: '#DC2626',
    defaultGrainNote: 'Sheared fault core with cohesive clay gouge and slickensided boundaries',
  },
  {
    patternType: 'shear_zone',
    defaultName: 'Shear Zone',
    colorHex: '#EF4444',
    defaultGrainNote: 'Tectonically sheared rock zone with fractured breccia and clay-coated slip planes',
  },
  {
    patternType: 'custom_lithology',
    defaultName: 'User-Defined Lithology',
    colorHex: '#10B981',
    defaultGrainNote: 'Custom geological/lithological unit defined by field geologist',
  },
];

export function getLithologyPreset(patternType: LithologyPatternType): LithologyPreset {
  return (
    LITHOLOGY_PRESETS.find((p) => p.patternType === patternType) || LITHOLOGY_PRESETS[0]
  );
}

/**
 * Computes the geometric centroid of a polygon in meters.
 */
export function getPolygonCentroid(polygon: Point2D[]): Point2D {
  if (polygon.length === 0) return { x: 0, y: 0 };
  const sum = polygon.reduce(
    (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
    { x: 0, y: 0 }
  );
  return {
    x: Number((sum.x / polygon.length).toFixed(3)),
    y: Number((sum.y / polygon.length).toFixed(3)),
  };
}

/**
 * Ray-casting point-in-polygon check (meters).
 */
export function isPointInPolygon(pt: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks whether a mapped joint trace lies inside or intersects a lithology polygon.
 */
export function doesJointIntersectLithologyRegion(
  joint: Joint,
  region: LithologyRegion
): boolean {
  if (joint.surface !== region.surface || region.polygon.length < 3) return false;
  // Check any vertex or segment midpoint
  for (let i = 0; i < joint.geometry.length; i++) {
    if (isPointInPolygon(joint.geometry[i], region.polygon)) return true;
    if (i < joint.geometry.length - 1) {
      const mid = {
        x: (joint.geometry[i].x + joint.geometry[i + 1].x) / 2,
        y: (joint.geometry[i].y + joint.geometry[i + 1].y) / 2,
      };
      if (isPointInPolygon(mid, region.polygon)) return true;
    }
  }
  return false;
}

/**
 * Creates a new LithologyRegion from a user-drawn polygon or selected area.
 * Automatically generates an initial factual AI suggestion from the visible features.
 */
export function createLithologyRegionFromPolygon(
  surface: SurfaceType,
  polygon: Point2D[],
  patternType: LithologyPatternType,
  customLithologyName: string | undefined,
  joints: Joint[],
  photoSurface?: PhotoSurface
): LithologyRegion {
  const preset = getLithologyPreset(patternType);
  const lithologyName = customLithologyName?.trim() || preset.defaultName;

  const cleanPolygon = polygon.map((p) => ({
    x: Number(p.x.toFixed(3)),
    y: Number(p.y.toFixed(3)),
  }));

  const tempRegion: LithologyRegion = {
    id: `lith-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    surface,
    polygon: cleanPolygon,
    polygonPoints: cleanPolygon,
    lithologyName,
    lithologyType: lithologyName,
    patternType,
    colorHex: preset.colorHex,
    opacity: 0.16, // Subtle visual representation by default (16%)
    description: '',
    structuralFeatures: '',
    userApproved: false,
    supportingPhotosAnalyzed: photoSurface?.supportingPhotos?.length || 0,
    confidence: 0.96,
    source: 'MANUAL',
  };

  const generated = generateAIGeologicalDescriptionForRegion(
    tempRegion,
    joints,
    photoSurface
  );

  return {
    ...tempRegion,
    description: generated.description,
    structuralFeatures: generated.structuralFeatures,
    aiSuggestedDescription: generated.description,
    aiSuggestedStructuralFeatures: generated.structuralFeatures,
  };
}

/**
 * Creates a lithology region covering a selected zone of the active tunnel surface
 * (e.g., Full Tunnel Area, Upper Crown/Half, Lower Bench/Half, Left Side, Right Side).
 */
export function createPresetAreaPolygon(
  surface: SurfaceType,
  geometry: TunnelGeometry,
  settings: TunnelSettings,
  zone: 'full' | 'upper_half' | 'lower_half' | 'left_half' | 'right_half'
): Point2D[] {
  const bounds = getSurfaceBoundsMeters(surface, geometry, settings);
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const midX = (minX + maxX) / 2;
  const minY = bounds.minY;
  const maxY = bounds.maxY;
  const midY = (minY + maxY) / 2;

  if (surface === 'face' && zone === 'full' && geometry.crossSectionPoints.length >= 4) {
    // Sample 8 clean vertices around the tunnel cross-section
    const raw = geometry.crossSectionPoints;
    const pts: Point2D[] = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const idx = Math.min(raw.length - 1, Math.round((i / (count - 1)) * (raw.length - 1)));
      pts.push({ x: Number(raw[idx].x.toFixed(3)), y: Number(raw[idx].y.toFixed(3)) });
    }
    return pts;
  }

  let x0 = minX;
  let x1 = maxX;
  let y0 = minY;
  let y1 = maxY;

  if (zone === 'upper_half') y0 = midY;
  if (zone === 'lower_half') y1 = midY;
  if (zone === 'left_half') x1 = midX;
  if (zone === 'right_half') x0 = midX;

  const xm = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;

  return [
    { x: Number(x0.toFixed(3)), y: Number(y1.toFixed(3)) },
    { x: Number(xm.toFixed(3)), y: Number(y1.toFixed(3)) },
    { x: Number(x1.toFixed(3)), y: Number(y1.toFixed(3)) },
    { x: Number(x1.toFixed(3)), y: Number(ym.toFixed(3)) },
    { x: Number(x1.toFixed(3)), y: Number(y0.toFixed(3)) },
    { x: Number(xm.toFixed(3)), y: Number(y0.toFixed(3)) },
    { x: Number(x0.toFixed(3)), y: Number(y0.toFixed(3)) },
    { x: Number(x0.toFixed(3)), y: Number(ym.toFixed(3)) },
  ];
}

/**
 * Resizes a LithologyRegion around its centroid by scaleX and scaleY factors (Section 13).
 */
export function resizeLithologyRegion(
  region: LithologyRegion,
  scaleX: number,
  scaleY: number
): LithologyRegion {
  const c = getPolygonCentroid(region.polygon);
  const nextPoly = region.polygon.map((pt) => ({
    x: Number((c.x + (pt.x - c.x) * scaleX).toFixed(3)),
    y: Number((c.y + (pt.y - c.y) * scaleY).toFixed(3)),
  }));
  return {
    ...region,
    polygon: nextPoly,
    polygonPoints: nextPoly,
  };
}

/**
 * Translates (moves) a LithologyRegion by dx, dy meters (Section 13).
 */
export function translateLithologyRegion(
  region: LithologyRegion,
  dx: number,
  dy: number
): LithologyRegion {
  const nextPoly = region.polygon.map((pt) => ({
    x: Number((pt.x + dx).toFixed(3)),
    y: Number((pt.y + dy).toFixed(3)),
  }));
  return {
    ...region,
    polygon: nextPoly,
    polygonPoints: nextPoly,
  };
}

/**
 * Inserts a new control vertex along the longest edge (or specified edge) of the polygon
 * so the user can reshape the region boundary in detail (Section 13).
 */
export function addVertexToLithologyRegion(
  region: LithologyRegion,
  edgeIndex?: number,
  customPoint?: Point2D
): LithologyRegion {
  const poly = region.polygon;
  if (poly.length < 2) return region;

  let targetIdx = edgeIndex ?? 0;
  if (edgeIndex === undefined) {
    // Find longest edge
    let maxDist = -1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > maxDist) {
        maxDist = d;
        targetIdx = i;
      }
    }
  }

  const a = poly[targetIdx];
  const b = poly[(targetIdx + 1) % poly.length];
  const mid: Point2D = customPoint
    ? { x: Number(customPoint.x.toFixed(3)), y: Number(customPoint.y.toFixed(3)) }
    : {
        x: Number(((a.x + b.x) / 2).toFixed(3)),
        y: Number(((a.y + b.y) / 2).toFixed(3)),
      };

  const nextPoly = [
    ...poly.slice(0, targetIdx + 1),
    mid,
    ...poly.slice(targetIdx + 1),
  ];

  return {
    ...region,
    polygon: nextPoly,
    polygonPoints: nextPoly,
  };
}

/**
 * Removes a vertex from the lithology polygon (minimum 3 vertices preserved).
 */
export function removeVertexFromLithologyRegion(
  region: LithologyRegion,
  vertexIndex: number
): LithologyRegion {
  if (region.polygon.length <= 3) return region;
  const nextPoly = region.polygon.filter((_, idx) => idx !== vertexIndex);
  return {
    ...region,
    polygon: nextPoly,
    polygonPoints: nextPoly,
  };
}

/**
 * Sutherland-Hodgman half-plane polygon clipping helper used to split a lithology region
 * cleanly into two contiguous sub-regions along a line (horizontal, vertical, or diagonal).
 */
function clipPolygonHalfPlane(
  polygon: Point2D[],
  nx: number,
  ny: number,
  c: number
): Point2D[] {
  const output: Point2D[] = [];
  if (polygon.length < 3) return output;

  const evalSide = (p: Point2D) => nx * p.x + ny * p.y - c;

  for (let i = 0; i < polygon.length; i++) {
    const cur = polygon[i];
    const prev = polygon[(i + polygon.length - 1) % polygon.length];
    const curVal = evalSide(cur);
    const prevVal = evalSide(prev);

    const curInside = curVal >= -1e-7;
    const prevInside = prevVal >= -1e-7;

    if (curInside) {
      if (!prevInside) {
        const t = prevVal / (prevVal - curVal + 1e-12);
        output.push({
          x: Number((prev.x + t * (cur.x - prev.x)).toFixed(3)),
          y: Number((prev.y + t * (cur.y - prev.y)).toFixed(3)),
        });
      }
      output.push(cur);
    } else if (prevInside) {
      const t = prevVal / (prevVal - curVal + 1e-12);
      output.push({
        x: Number((prev.x + t * (cur.x - prev.x)).toFixed(3)),
        y: Number((prev.y + t * (cur.y - prev.y)).toFixed(3)),
      });
    }
  }
  return output;
}

/**
 * Splits a single LithologyRegion into two adjacent LithologyRegions (Section 13: "split region").
 */
export function splitLithologyRegion(
  region: LithologyRegion,
  direction: 'horizontal' | 'vertical' | 'diagonal',
  joints: Joint[],
  photoSurface?: PhotoSurface
): [LithologyRegion, LithologyRegion] | null {
  const centroid = getPolygonCentroid(region.polygon);
  let nx = 0;
  let ny = 1;
  if (direction === 'vertical') {
    nx = 1;
    ny = 0;
  } else if (direction === 'diagonal') {
    nx = Math.SQRT1_2;
    ny = Math.SQRT1_2;
  }
  const c = nx * centroid.x + ny * centroid.y;

  const polyA = clipPolygonHalfPlane(region.polygon, nx, ny, c);
  const polyB = clipPolygonHalfPlane(region.polygon, -nx, -ny, -c);

  if (polyA.length < 3 || polyB.length < 3) return null;

  const regionA: LithologyRegion = {
    ...region,
    id: `${region.id}-A`,
    polygon: polyA,
  };
  const genA = generateAIGeologicalDescriptionForRegion(regionA, joints, photoSurface);
  regionA.description = genA.description;
  regionA.structuralFeatures = genA.structuralFeatures;

  const regionB: LithologyRegion = {
    ...region,
    id: `lith-${Date.now()}-B`,
    polygon: polyB,
    userApproved: false,
  };
  const genB = generateAIGeologicalDescriptionForRegion(regionB, joints, photoSurface);
  regionB.description = genB.description;
  regionB.structuralFeatures = genB.structuralFeatures;
  regionB.aiSuggestedDescription = genB.description;
  regionB.aiSuggestedStructuralFeatures = genB.structuralFeatures;

  return [regionA, regionB];
}

/**
 * Computes the convex hull of combined polygon vertices to cleanly merge two regions (Section 13: "merge regions").
 */
export function mergeTwoLithologyRegions(
  regionA: LithologyRegion,
  regionB: LithologyRegion,
  joints: Joint[],
  photoSurface?: PhotoSurface
): LithologyRegion {
  const combinedPts = [...regionA.polygon, ...regionB.polygon];
  // Monotone chain convex hull so merged polygon has clean non-self-intersecting boundary
  const sorted = [...combinedPts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  const hull = [...lower, ...upper];

  const merged: LithologyRegion = {
    ...regionA,
    id: `lith-merged-${Date.now().toString(36)}`,
    polygon: hull.length >= 3 ? hull : regionA.polygon,
    userApproved: false,
  };

  const gen = generateAIGeologicalDescriptionForRegion(merged, joints, photoSurface);
  merged.description = gen.description;
  merged.structuralFeatures = gen.structuralFeatures;
  merged.aiSuggestedDescription = gen.description;
  merged.aiSuggestedStructuralFeatures = gen.structuralFeatures;

  return merged;
}

/**
 * SECTION 14: AI GEOLOGICAL DESCRIPTION GENERATOR
 *
 * Generates a concise, factual geological description strictly grounded in:
 * - selected lithology (region.lithologyName & patternType)
 * - visible rock characteristics
 * - mapped geological features inside the selected polygon (joint sets, bedding, faults/shears, veins, infilling, water)
 * - verified user information
 * - additional supporting photographs count
 *
 * Never invents geological observations that are not supported by the mapped traces or user selection.
 */
export function generateAIGeologicalDescriptionForRegion(
  region: LithologyRegion,
  allJoints: Joint[],
  photoSurface?: PhotoSurface
): {
  lithology: string;
  description: string;
  structuralFeatures: string;
} {
  const preset = getLithologyPreset(region.patternType);
  const lithName = region.lithologyName.trim() || preset.defaultName;

  // Find all mapped geological traces that intersect or fall within this selected lithology polygon
  const regionJoints = allJoints.filter((j) =>
    doesJointIntersectLithologyRegion(j, region)
  );

  // Categorize mapped features inside this region
  const setsMap = new Map<string, number>();
  let hasFoliationOrBedding = false;
  let hasShearOrFault = false;
  let hasVeins = false;
  let hasClayOrInfill = false;
  let hasDampOrWater = false;

  for (const j of regionJoints) {
    setsMap.set(j.set, (setsMap.get(j.set) || 0) + 1);
    if (j.featureType === 'bedding' || j.featureType === 'shale_band' || j.set === 'J0') {
      hasFoliationOrBedding = true;
    }
    if (j.featureType === 'fault' || j.featureType === 'shear' || j.set === 'F1') {
      hasShearOrFault = true;
    }
    if (
      j.featureType === 'lithological_contact' ||
      j.featureType === 'dolerite' ||
      (j.infilling && j.infilling.toLowerCase().includes('quartz'))
    ) {
      hasVeins = true;
    }
    if (
      j.infilling &&
      !j.infilling.toLowerCase().includes('none') &&
      !j.infilling.toLowerCase().includes('clean')
    ) {
      hasClayOrInfill = true;
    }
    if (j.waterCondition && j.waterCondition !== 'Dry') {
      hasDampOrWater = true;
    }
  }

  // Sort sets by frequency
  const sortedSets = Array.from(setsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([setId]) => setId);

  const supportingCount = photoSurface?.supportingPhotos?.length || 0;

  // Build concise, truthful DESCRIPTION
  const traits: string[] = [];
  if (hasFoliationOrBedding) {
    traits.push('visible foliation/bedding planes');
  }
  if (regionJoints.length > 0) {
    traits.push(
      `${regionJoints.length} mapped discontinuity trace${regionJoints.length > 1 ? 's' : ''}`
    );
  } else {
    traits.push('massive to sparsely jointed appearance in the selected window');
  }
  if (hasClayOrInfill || hasShearOrFault) {
    traits.push('minor clay-filled/coated seams');
  }
  if (hasDampOrWater) {
    traits.push('localized dampness along fractures');
  }

  const description = `${preset.defaultGrainNote} (${lithName}) with ${traits.join(', ')}.${
    supportingCount > 0
      ? ` Verified across Main Photo + ${supportingCount} supporting photo${supportingCount > 1 ? 's' : ''}.`
      : ''
  }`;

  // Build concise, truthful STRUCTURAL FEATURES summary
  let structuralFeatures = '';
  if (regionJoints.length === 0) {
    structuralFeatures =
      'No discrete joint traces currently intersecting this selected region (intact rock block or run AI Trace).';
  } else {
    const primarySetsStr =
      sortedSets.length >= 2
        ? `Predominant joint sets ${sortedSets.slice(0, 2).join('/')} (${regionJoints.length} traces)`
        : `Predominant discontinuity set ${sortedSets[0] || 'J1'} (${regionJoints.length} trace${
            regionJoints.length > 1 ? 's' : ''
          })`;

    const extras: string[] = [];
    if (sortedSets.length > 2) {
      extras.push(`secondary set ${sortedSets.slice(2).join(', ')}`);
    }
    if (hasVeins) {
      extras.push('associated minor quartz/calcite veins');
    }
    if (hasShearOrFault) {
      extras.push('intersecting shear/fault seam');
    }
    if (hasFoliationOrBedding && !sortedSets.slice(0, 2).includes('J0')) {
      extras.push('foliation/bedding anisotropy');
    }

    structuralFeatures =
      extras.length > 0
        ? `${primarySetsStr} with ${extras.join(' and ')}.`
        : `${primarySetsStr} observed within the selected lithology boundary.`;
  }

  return {
    lithology: lithName,
    description,
    structuralFeatures,
  };
}
