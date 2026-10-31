import type {
  FieldTunnelLocationItem,
  FieldExcavationRound,
  FieldPanelId,
  FieldPoint2D,
  FieldPanelCanvasGeometry,
  FieldTransformStageMode,
} from './fieldMappingEngine';

/**
 * ============================================================================
 * DEDICATED VERTICAL SHAFT ENGINE (COMPLETELY ISOLATED FROM HORIZONTAL TUNNEL)
 * ============================================================================
 * This module contains ALL geometry, panel layout, circumference quadrant math,
 * half-face / center-median boundary rules, 3D joint trace orientation math,
 * and validation rules exclusively for Vertical Shaft mode
 * (`undergroundSubMode === 'vertical_shaft'`).
 *
 * Horizontal Tunnel mode NEVER calls or depends on internal changes here unless
 * `isVerticalShaftLocation(location)` is explicitly true.
 */

export type VerticalShaftHalfSide = 'left_half' | 'right_half';
export type VerticalShaftCenterMedianStatus = 'closed' | 'open';

export const VERTICAL_SHAFT_EXCAVATION_APPROACHES = [
  'Full Face',
  'Half Face',
] as const;

export type VerticalShaftExcavationApproach =
  (typeof VERTICAL_SHAFT_EXCAVATION_APPROACHES)[number];

export interface VerticalShaftQuadrantMeta {
  panelId: Exclude<FieldPanelId, 'face'>;
  quadrantIndex: 1 | 2 | 3 | 4;
  shortCode: 'NE' | 'ES' | 'SW' | 'WN';
  shortLabel: string;
  fullLabel: string;
  numberedLabel: string;
  badgeLabel: string;
  azStartDeg: number;
  azEndDeg: number;
  midAzimuthDeg: number;
  inwardNormalAzimuthDeg: number;
  wallStrikeAzimuthDeg: number;
  wallDipDeg: number;
}

export const VERTICAL_SHAFT_QUADRANT_META_MAP: Record<
  Exclude<FieldPanelId, 'face'>,
  VerticalShaftQuadrantMeta
> = {
  left_wall: {
    panelId: 'left_wall',
    quadrantIndex: 1,
    shortCode: 'NE',
    shortLabel: 'NE (0°–90°)',
    fullLabel: 'NORTH-EAST (0°–90°)',
    numberedLabel: '2. NORTH-EAST (0°–90°)',
    badgeLabel: 'NE 0°–90°',
    azStartDeg: 0,
    azEndDeg: 90,
    midAzimuthDeg: 45,
    inwardNormalAzimuthDeg: 225,
    wallStrikeAzimuthDeg: 135,
    wallDipDeg: 90,
  },
  crown: {
    panelId: 'crown',
    quadrantIndex: 2,
    shortCode: 'ES',
    shortLabel: 'ES (90°–180°)',
    fullLabel: 'EAST-SOUTH (90°–180°)',
    numberedLabel: '3. EAST-SOUTH (90°–180°)',
    badgeLabel: 'ES 90°–180°',
    azStartDeg: 90,
    azEndDeg: 180,
    midAzimuthDeg: 135,
    inwardNormalAzimuthDeg: 315,
    wallStrikeAzimuthDeg: 225,
    wallDipDeg: 90,
  },
  right_wall: {
    panelId: 'right_wall',
    quadrantIndex: 3,
    shortCode: 'SW',
    shortLabel: 'SW (180°–270°)',
    fullLabel: 'SOUTH-WEST (180°–270°)',
    numberedLabel: '4. SOUTH-WEST (180°–270°)',
    badgeLabel: 'SW 180°–270°',
    azStartDeg: 180,
    azEndDeg: 270,
    midAzimuthDeg: 225,
    inwardNormalAzimuthDeg: 45,
    wallStrikeAzimuthDeg: 315,
    wallDipDeg: 90,
  },
  shaft_sn: {
    panelId: 'shaft_sn',
    quadrantIndex: 4,
    shortCode: 'WN',
    shortLabel: 'WN (270°–360°)',
    fullLabel: 'WEST-NORTH (270°–360°)',
    numberedLabel: '5. WEST-NORTH (270°–360°)',
    badgeLabel: 'WN 270°–360°',
    azStartDeg: 270,
    azEndDeg: 360,
    midAzimuthDeg: 315,
    inwardNormalAzimuthDeg: 135,
    wallStrikeAzimuthDeg: 45,
    wallDipDeg: 90,
  },
};

export function getVerticalShaftQuadrantMeta(
  panel: FieldPanelId
): VerticalShaftQuadrantMeta | null {
  if (panel === 'face') return null;
  return VERTICAL_SHAFT_QUADRANT_META_MAP[panel] ?? null;
}

export function isVerticalShaftLocation(
  location?: Pick<
    FieldTunnelLocationItem,
    'mappingDomain' | 'undergroundSubMode'
  > | null
): boolean {
  return (
    (!location?.mappingDomain || location.mappingDomain === 'TUNNEL') &&
    location?.undergroundSubMode === 'vertical_shaft'
  );
}

export function normalizeVerticalShaftExcavationApproach(
  approach?: string | null
): VerticalShaftExcavationApproach {
  if (approach && approach.toLowerCase().includes('half')) return 'Half Face';
  return 'Full Face';
}

export function normalizeVerticalShaftHalfSide(
  halfSide?: string | null
): VerticalShaftHalfSide {
  if (halfSide === 'right_half') return 'right_half';
  return 'left_half';
}

export function normalizeVerticalShaftCenterMedianStatus(
  status?: string | null
): VerticalShaftCenterMedianStatus {
  if (status === 'open') return 'open';
  return 'closed';
}

/**
 * Returns the active panels for a Vertical Shaft excavation round:
 * - Full Face: ['face', 'left_wall', 'crown', 'right_wall', 'shaft_sn']
 *   (Face + all 4 compass quadrants NE 0°–90°, ES 90°–180°, SW 180°–270°, WN 270°–360°)
 * - Half Face + Left Half ('left_half'): ['face', 'right_wall', 'shaft_sn']
 *   (Left/West Half semi-circle 180°–360° -> Q3 SW 180°–270° & Q4 WN 270°–360°)
 * - Half Face + Right Half ('right_half'): ['face', 'left_wall', 'crown']
 *   (Right/East Half semi-circle 0°–180° -> Q1 NE 0°–90° & Q2 ES 90°–180°)
 */
export function getActiveVerticalShaftPanels(
  round?: Pick<
    FieldExcavationRound,
    'excavationApproach' | 'shaftHalfSide'
  > | null
): FieldPanelId[] {
  const approach = normalizeVerticalShaftExcavationApproach(
    round?.excavationApproach
  );
  if (approach === 'Half Face') {
    const halfSide = normalizeVerticalShaftHalfSide(round?.shaftHalfSide);
    if (halfSide === 'right_half') {
      // Right Half = East semi-circle (0°–180°): First & Second Quadrants (NE 0°–90°, ES 90°–180°)
      return ['face', 'left_wall', 'crown'];
    }
    // Left Half = West semi-circle (180°–360°): Third & Fourth Quadrants (SW 180°–270°, WN 270°–360°)
    return ['face', 'right_wall', 'shaft_sn'];
  }
  return ['face', 'left_wall', 'crown', 'right_wall', 'shaft_sn'];
}

export function isVerticalShaftPanelActive(
  panel: FieldPanelId,
  round?: Pick<
    FieldExcavationRound,
    'excavationApproach' | 'shaftHalfSide'
  > | null
): boolean {
  return getActiveVerticalShaftPanels(round).includes(panel);
}

export interface VerticalShaftCircumferenceBreakdown {
  diameterM: number;
  radiusM: number;
  fullCircumferenceM: number;
  circumferenceM: number;
  quadrantArcLengthM: number;
  activePerimeterM: number;
  activeFaceAreaM2: number;
  fullFaceAreaM2: number;
  pullLengthM: number;
  excavationApproach: VerticalShaftExcavationApproach;
  isHalfFace: boolean;
  halfSide: VerticalShaftHalfSide;
  centerMedianStatus: VerticalShaftCenterMedianStatus;
  centerMedianLengthM: number;
  activePanels: FieldPanelId[];
  activeQuadrantPanels: Exclude<FieldPanelId, 'face'>[];
  activeQuadrantLabels: string[];
}

export function computeVerticalShaftCircumferenceBreakdown(
  location?: Pick<FieldTunnelLocationItem, 'widthM'> | null,
  round?: Pick<
    FieldExcavationRound,
    | 'excavationApproach'
    | 'shaftHalfSide'
    | 'shaftCenterMedianStatus'
    | 'pullLengthMeters'
  > | null
): VerticalShaftCircumferenceBreakdown {
  const diameterM = Math.max(1.5, Number(location?.widthM) || 8.0);
  const radiusM = diameterM / 2;
  const fullCircumferenceM = Math.PI * diameterM;
  const quadrantArcLengthM = fullCircumferenceM / 4;
  const fullFaceAreaM2 = Math.PI * radiusM * radiusM;
  const pullLengthM = Math.max(0.5, Number(round?.pullLengthMeters) || 3.0);
  const excavationApproach = normalizeVerticalShaftExcavationApproach(
    round?.excavationApproach
  );
  const halfSide = normalizeVerticalShaftHalfSide(round?.shaftHalfSide);
  const centerMedianStatus = normalizeVerticalShaftCenterMedianStatus(
    round?.shaftCenterMedianStatus
  );
  const activePanels = getActiveVerticalShaftPanels(round);
  const isHalfFace = excavationApproach === 'Half Face';
  const activeFaceAreaM2 = isHalfFace ? fullFaceAreaM2 / 2 : fullFaceAreaM2;
  const activePerimeterM = isHalfFace
    ? fullCircumferenceM / 2 + (centerMedianStatus === 'closed' ? diameterM : 0)
    : fullCircumferenceM;
  const activeQuadrantPanels = activePanels.filter(
    (p): p is Exclude<FieldPanelId, 'face'> => p !== 'face'
  );
  const activeQuadrantLabels = activeQuadrantPanels.map(
    (p) => VERTICAL_SHAFT_QUADRANT_META_MAP[p].fullLabel
  );

  return {
    diameterM: Number(diameterM.toFixed(2)),
    radiusM: Number(radiusM.toFixed(2)),
    fullCircumferenceM: Number(fullCircumferenceM.toFixed(2)),
    circumferenceM: Number(fullCircumferenceM.toFixed(2)),
    quadrantArcLengthM: Number(quadrantArcLengthM.toFixed(2)),
    activePerimeterM: Number(activePerimeterM.toFixed(2)),
    activeFaceAreaM2: Number(activeFaceAreaM2.toFixed(2)),
    fullFaceAreaM2: Number(fullFaceAreaM2.toFixed(2)),
    pullLengthM: Number(pullLengthM.toFixed(2)),
    excavationApproach,
    isHalfFace,
    halfSide,
    centerMedianStatus,
    centerMedianLengthM: isHalfFace ? Number(diameterM.toFixed(2)) : 0,
    activePanels,
    activeQuadrantPanels,
    activeQuadrantLabels,
  };
}

/**
 * Returns the surface configuration for a Vertical Shaft location & round:
 * Always Circular cross-section, with active compass quadrants determined by Full Face vs. Half Face.
 */
export function getVerticalShaftSurfaceConfig(
  location: FieldTunnelLocationItem,
  round?: Pick<
    FieldExcavationRound,
    'excavationApproach' | 'shaftHalfSide'
  > | null
) {
  const diameterM = Math.max(1.5, Number(location.widthM) || 8.0);
  const quadrantArcM = Number(((Math.PI * diameterM) / 4).toFixed(2));
  const activePanels = getActiveVerticalShaftPanels(round);
  const hasLeftWall = activePanels.includes('left_wall');
  const hasCrown = activePanels.includes('crown');
  const hasRightWall = activePanels.includes('right_wall');
  const hasShaftSn = activePanels.includes('shaft_sn');

  return {
    isCustom: false,
    isClosed: true,
    hasLeftWall,
    hasRightWall,
    hasCrown,
    hasInvert: false,
    leftWallLengthM: hasLeftWall ? quadrantArcM : 0,
    rightWallLengthM: hasRightWall ? quadrantArcM : 0,
    crownLengthM: hasCrown ? quadrantArcM : 0,
    invertLengthM: 0,
    splHeightM: quadrantArcM,
    tunnelW: diameterM,
    tunnelH: diameterM,
    isVerticalShaft: true,
    shaftSnLengthM: hasShaftSn ? quadrantArcM : 0,
    hasShaftSn,
  };
}

/**
 * Computes the exact proportional bounding box (boxX, boxY, boxW, boxH) inside the 1000×1000 canvas
 * for Vertical Shaft mode:
 * - Face: Circular/Semi-Circular cross-section of diameter D × D
 * - 4 Quadrant Wall Panels (NE 0°–90°, ES 90°–180°, SW 180°–270°, WN 270°–360°):
 *   In Stage 4 single-panel view, Width = Pull Depth (pullM), Height = Quadrant Arc Length (πD/4).
 */
export function computeVerticalShaftPanelCanvasGeometry(
  panel: FieldPanelId,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound
): FieldPanelCanvasGeometry {
  const surf = getVerticalShaftSurfaceConfig(location, round);
  const diameterM = surf.tunnelW;
  const quadrantArcM = surf.splHeightM;
  const pullM = Math.max(0.5, Number(round.pullLengthMeters) || 3.0);

  let panelWidthM = diameterM;
  let panelHeightM = diameterM;
  if (panel === 'crown') {
    // In Vertical Shaft mode, 'crown' slot is Quadrant 2: EAST-SOUTH (90°–180°).
    // Like the other quadrant walls, canonical base has crownLengthM = quadrantArcM and pullM = pullM.
    panelWidthM = quadrantArcM;
    panelHeightM = pullM;
  } else if (
    panel === 'left_wall' ||
    panel === 'right_wall' ||
    panel === 'shaft_sn'
  ) {
    panelWidthM = pullM;
    panelHeightM = quadrantArcM;
  }

  const maxBoxW = 845;
  const maxBoxH = 810;
  const centerX = 500;
  const centerY = 495;
  const pxPerMeter = Math.min(maxBoxW / panelWidthM, maxBoxH / panelHeightM);

  const boxW = Number((panelWidthM * pxPerMeter).toFixed(1));
  const boxH = Number((panelHeightM * pxPerMeter).toFixed(1));
  const boxX = Number((centerX - boxW / 2).toFixed(1));
  const boxY = Number((centerY - boxH / 2).toFixed(1));

  return {
    boxX,
    boxY,
    boxW,
    boxH,
    panelWidthM,
    panelHeightM,
    tunnelW: diameterM,
    tunnelH: diameterM,
    splHeightM: quadrantArcM,
    leftWallLengthM: quadrantArcM,
    rightWallLengthM: quadrantArcM,
    crownRiseM: Number((diameterM / 2).toFixed(2)),
    splRatio: 0.5,
    pullM,
    crownLengthM: quadrantArcM,
    pxPerMeter,
    hasLeftWall: surf.hasLeftWall,
    hasRightWall: surf.hasRightWall,
    hasCrown: surf.hasCrown,
    hasInvert: false,
    isClosed: true,
  };
}

/**
 * Computes the Unfolded Layout for Vertical Shaft mode inside the 1000×1000 SVG viewBox:
 * Top Center: Circular / Semi-Circular Shaft Face
 * Bottom Row: Active Quadrant Wall Strips
 * - Full Face: 4 equal quadrant wall strips [NE (0°–90°), ES (90°–180°), SW (180°–270°), WN (270°–360°)]
 * - Half Face (Left Half): 2 active quadrant wall strips [SW (180°–270°), WN (270°–360°)]
 * - Half Face (Right Half): 2 active quadrant wall strips [NE (0°–90°), ES (90°–180°)]
 */
export function computeVerticalShaftTCanvasLayout(
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  computePanelOrientationReferenceMeta: (
    panel: FieldPanelId,
    round: FieldExcavationRound | null | undefined,
    splHeightM: number,
    crownLengthM: number,
    pullM: number,
    stageMode: FieldTransformStageMode
  ) => {
    tr: { tOffsetX: number; tOffsetY: number };
    widthM: number;
    heightM: number;
  }
) {
  const faceGeom = computeVerticalShaftPanelCanvasGeometry(
    'face',
    location,
    round
  );
  const crownGeom = computeVerticalShaftPanelCanvasGeometry(
    'crown',
    location,
    round
  );
  const leftWallGeom = computeVerticalShaftPanelCanvasGeometry(
    'left_wall',
    location,
    round
  );
  const rightWallGeom = computeVerticalShaftPanelCanvasGeometry(
    'right_wall',
    location,
    round
  );
  const shaftSnGeom = computeVerticalShaftPanelCanvasGeometry(
    'shaft_sn',
    location,
    round
  );

  const diameterM = faceGeom.tunnelW;
  const quadrantArcM = faceGeom.splHeightM;
  const pullM = faceGeom.pullM;
  const pullSpanM = Math.max(pullM, 1.5);
  const quadSpanM = Math.max(quadrantArcM, 1.5);

  const activePanels = getActiveVerticalShaftPanels(round);
  const activeWallPanels = activePanels.filter(
    (p): p is Exclude<FieldPanelId, 'face'> => p !== 'face'
  );

  const panelGapX = 24;
  const verticalGap = 72;

  const metaByWall: Record<
    Exclude<FieldPanelId, 'face'>,
    {
      tr: { tOffsetX: number; tOffsetY: number };
      widthM: number;
      heightM: number;
    }
  > = {
    left_wall: computePanelOrientationReferenceMeta(
      'left_wall',
      round,
      quadSpanM,
      quadSpanM,
      pullSpanM,
      'joint_grouping'
    ),
    crown: computePanelOrientationReferenceMeta(
      'crown',
      round,
      quadSpanM,
      quadSpanM,
      pullSpanM,
      'joint_grouping'
    ),
    right_wall: computePanelOrientationReferenceMeta(
      'right_wall',
      round,
      quadSpanM,
      quadSpanM,
      pullSpanM,
      'joint_grouping'
    ),
    shaft_sn: computePanelOrientationReferenceMeta(
      'shaft_sn',
      round,
      quadSpanM,
      quadSpanM,
      pullSpanM,
      'joint_grouping'
    ),
  };

  const totalBottomMetersW = activeWallPanels.reduce(
    (acc, p) => acc + metaByWall[p].widthM,
    0
  );
  const maxBottomMetersH = Math.max(
    1,
    ...activeWallPanels.map((p) => metaByWall[p].heightM)
  );

  const availBottomW =
    1000 - 70 - Math.max(0, activeWallPanels.length - 1) * panelGapX;
  const availBottomH = 440;
  const stripPxPerM = Math.min(
    availBottomW / Math.max(1, totalBottomMetersW),
    availBottomH / Math.max(1, maxBottomMetersH)
  );

  // Top Center Shaft Face: 1:1 isotropic circle
  const facePxPerM = Math.min(380 / diameterM, 250 / diameterM);
  const faceW = Number((diameterM * facePxPerM).toFixed(1));
  const faceH = Number((diameterM * facePxPerM).toFixed(1));

  const wMap: Record<Exclude<FieldPanelId, 'face'>, number> = {
    left_wall: activeWallPanels.includes('left_wall')
      ? Number((metaByWall.left_wall.widthM * stripPxPerM).toFixed(1))
      : 0,
    crown: activeWallPanels.includes('crown')
      ? Number((metaByWall.crown.widthM * stripPxPerM).toFixed(1))
      : 0,
    right_wall: activeWallPanels.includes('right_wall')
      ? Number((metaByWall.right_wall.widthM * stripPxPerM).toFixed(1))
      : 0,
    shaft_sn: activeWallPanels.includes('shaft_sn')
      ? Number((metaByWall.shaft_sn.widthM * stripPxPerM).toFixed(1))
      : 0,
  };

  const hMap: Record<Exclude<FieldPanelId, 'face'>, number> = {
    left_wall: activeWallPanels.includes('left_wall')
      ? Number((metaByWall.left_wall.heightM * stripPxPerM).toFixed(1))
      : 0,
    crown: activeWallPanels.includes('crown')
      ? Number((metaByWall.crown.heightM * stripPxPerM).toFixed(1))
      : 0,
    right_wall: activeWallPanels.includes('right_wall')
      ? Number((metaByWall.right_wall.heightM * stripPxPerM).toFixed(1))
      : 0,
    shaft_sn: activeWallPanels.includes('shaft_sn')
      ? Number((metaByWall.shaft_sn.heightM * stripPxPerM).toFixed(1))
      : 0,
  };

  const stripH = Math.max(
    hMap.left_wall,
    hMap.crown,
    hMap.right_wall,
    hMap.shaft_sn
  );
  const totalGapsW = Math.max(0, activeWallPanels.length - 1) * panelGapX;
  const totalBottomW =
    wMap.left_wall + wMap.crown + wMap.right_wall + wMap.shaft_sn + totalGapsW;
  const totalLayoutH = stripH > 0 ? faceH + verticalGap + stripH : faceH;

  const faceX = Number(((1000 - faceW) / 2).toFixed(1));
  const faceY = Number(
    Math.max(46, (1000 - totalLayoutH) / 2 - 12).toFixed(1)
  );
  const stripY = Number((faceY + faceH + verticalGap).toFixed(1));

  let cursorX = (1000 - totalBottomW) / 2;
  const xMap: Record<Exclude<FieldPanelId, 'face'>, number> = {
    left_wall: 0,
    crown: 0,
    right_wall: 0,
    shaft_sn: 0,
  };
  const yMap: Record<Exclude<FieldPanelId, 'face'>, number> = {
    left_wall: stripY,
    crown: stripY,
    right_wall: stripY,
    shaft_sn: stripY,
  };

  for (const wallId of activeWallPanels) {
    xMap[wallId] = Number(
      (cursorX + metaByWall[wallId].tr.tOffsetX).toFixed(1)
    );
    yMap[wallId] = Number(
      (stripY + metaByWall[wallId].tr.tOffsetY).toFixed(1)
    );
    cursorX += wMap[wallId] + panelGapX;
  }

  const boxes: Record<
    FieldPanelId,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      geom: FieldPanelCanvasGeometry;
    }
  > = {
    face: { x: faceX, y: faceY, w: faceW, h: faceH, geom: faceGeom },
    left_wall: {
      x: xMap.left_wall,
      y: yMap.left_wall,
      w: wMap.left_wall,
      h: hMap.left_wall,
      geom: leftWallGeom,
    },
    crown: {
      x: xMap.crown,
      y: yMap.crown,
      w: wMap.crown,
      h: hMap.crown,
      geom: crownGeom,
    },
    right_wall: {
      x: xMap.right_wall,
      y: yMap.right_wall,
      w: wMap.right_wall,
      h: hMap.right_wall,
      geom: rightWallGeom,
    },
    shaft_sn: {
      x: xMap.shaft_sn,
      y: yMap.shaft_sn,
      w: wMap.shaft_sn,
      h: hMap.shaft_sn,
      geom: shaftSnGeom,
    },
  };

  return {
    faceGeom,
    crownGeom,
    leftWallGeom,
    rightWallGeom,
    shaftSnGeom,
    tunnelW: diameterM,
    tunnelH: diameterM,
    splHeightM: quadrantArcM,
    splRatio: 0.5,
    crownLengthM: quadrantArcM,
    pullM,
    wallW: wMap.left_wall || wMap.right_wall || wMap.shaft_sn,
    wallH: hMap.left_wall || hMap.right_wall || hMap.shaft_sn,
    leftWallW: wMap.left_wall,
    leftWallH: hMap.left_wall,
    rightWallW: wMap.right_wall,
    rightWallH: hMap.right_wall,
    crownW: wMap.crown,
    crownH: hMap.crown,
    stripH,
    faceX,
    faceW,
    faceH,
    leftWallX: xMap.left_wall,
    leftWallY: yMap.left_wall,
    crownX: xMap.crown,
    crownY: yMap.crown,
    rightWallX: xMap.right_wall,
    rightWallY: yMap.right_wall,
    stripY,
    faceY,
    panelGapX,
    verticalGap,
    boxes,
  };
}

/**
 * Checks whether a 2D canvas point lies inside the active Vertical Shaft panel outline.
 * On 'face', when Half Face is active, restricts drawing to the active semi-circle:
 * - left_half (West 180°–360°): pt.x <= cx
 * - right_half (East 0°–180°): pt.x >= cx
 */
export function isPointInsideVerticalShaftPanelOutline(
  pt: FieldPoint2D,
  panel: FieldPanelId,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  tolerancePx = 0
): boolean {
  if (!isVerticalShaftPanelActive(panel, round)) {
    return false;
  }

  const geom = computeVerticalShaftPanelCanvasGeometry(panel, location, round);
  const left = geom.boxX - tolerancePx;
  const right = geom.boxX + geom.boxW + tolerancePx;
  const top = geom.boxY - tolerancePx;
  const bottom = geom.boxY + geom.boxH + tolerancePx;

  if (pt.x < left || pt.x > right || pt.y < top || pt.y > bottom) {
    return false;
  }

  if (panel !== 'face') {
    return true;
  }

  const cx = geom.boxX + geom.boxW / 2;
  const cy = geom.boxY + geom.boxH / 2;
  const rx = Math.max(1, geom.boxW / 2 + tolerancePx);
  const ry = Math.max(1, geom.boxH / 2 + tolerancePx);
  const norm =
    ((pt.x - cx) * (pt.x - cx)) / (rx * rx) +
    ((pt.y - cy) * (pt.y - cy)) / (ry * ry);
  if (norm > 1.0) {
    return false;
  }

  const approach = normalizeVerticalShaftExcavationApproach(
    round?.excavationApproach
  );
  if (approach === 'Half Face') {
    const halfSide = normalizeVerticalShaftHalfSide(round?.shaftHalfSide);
    const medianTol = Math.min(0, tolerancePx);
    if (halfSide === 'left_half' && pt.x > cx - medianTol) {
      return false;
    }
    if (halfSide === 'right_half' && pt.x < cx + medianTol) {
      return false;
    }
  }

  return true;
}

/**
 * Returns the exact closed perimeter polygon loop for a Vertical Shaft panel.
 * In Half Face mode on 'face', returns the active semi-circle + subdivided points along the vertical Center Median line (x = cx).
 */
export function getVerticalShaftPanelPerimeterLoop(
  panel: FieldPanelId,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound
): FieldPoint2D[] {
  if (!isVerticalShaftPanelActive(panel, round)) {
    return [];
  }

  const geom = computeVerticalShaftPanelCanvasGeometry(panel, location, round);
  const { boxX, boxY, boxW, boxH } = geom;

  if (panel !== 'face') {
    const rectPts: FieldPoint2D[] = [];
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      rectPts.push({
        x: Number((boxX + (boxW * i) / steps).toFixed(1)),
        y: Number(boxY.toFixed(1)),
      });
    }
    for (let i = 0; i < steps; i++) {
      rectPts.push({
        x: Number((boxX + boxW).toFixed(1)),
        y: Number((boxY + (boxH * i) / steps).toFixed(1)),
      });
    }
    for (let i = 0; i < steps; i++) {
      rectPts.push({
        x: Number((boxX + boxW - (boxW * i) / steps).toFixed(1)),
        y: Number((boxY + boxH).toFixed(1)),
      });
    }
    for (let i = 0; i < steps; i++) {
      rectPts.push({
        x: Number(boxX.toFixed(1)),
        y: Number((boxY + boxH - (boxH * i) / steps).toFixed(1)),
      });
    }
    return rectPts;
  }

  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;
  const rx = boxW / 2;
  const ry = boxH / 2;
  const approach = normalizeVerticalShaftExcavationApproach(
    round?.excavationApproach
  );
  const halfSide = normalizeVerticalShaftHalfSide(round?.shaftHalfSide);

  if (approach === 'Half Face') {
    const pts: FieldPoint2D[] = [];
    const arcSteps = 48;
    const medianSteps = 20;
    if (halfSide === 'left_half') {
      // Top North (cx, boxY) counter-clockwise through West (boxX, cy) to Bottom South (cx, boxY+boxH)
      for (let i = 0; i <= arcSteps; i++) {
        const theta = -Math.PI / 2 - (Math.PI * i) / arcSteps;
        pts.push({
          x: Number((cx + rx * Math.cos(theta)).toFixed(1)),
          y: Number((cy + ry * Math.sin(theta)).toFixed(1)),
        });
      }
      // Subdivide up the vertical Center Median from Bottom South (cx, boxY+boxH) to Top North (cx, boxY)
      for (let s = 1; s < medianSteps; s++) {
        const t = s / medianSteps;
        pts.push({
          x: Number(cx.toFixed(1)),
          y: Number((boxY + boxH - t * boxH).toFixed(1)),
        });
      }
      return pts;
    } else {
      // Right Half: Top North (cx, boxY) clockwise through East (boxX+boxW, cy) to Bottom South (cx, boxY+boxH)
      for (let i = 0; i <= arcSteps; i++) {
        const theta = -Math.PI / 2 + (Math.PI * i) / arcSteps;
        pts.push({
          x: Number((cx + rx * Math.cos(theta)).toFixed(1)),
          y: Number((cy + ry * Math.sin(theta)).toFixed(1)),
        });
      }
      // Subdivide up the vertical Center Median from Bottom South (cx, boxY+boxH) to Top North (cx, boxY)
      for (let s = 1; s < medianSteps; s++) {
        const t = s / medianSteps;
        pts.push({
          x: Number(cx.toFixed(1)),
          y: Number((boxY + boxH - t * boxH).toFixed(1)),
        });
      }
      return pts;
    }
  }

  // Full Face 360° circle
  const pts: FieldPoint2D[] = [];
  const steps = 80;
  for (let i = 0; i < steps; i++) {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / steps;
    pts.push({
      x: Number((cx + rx * Math.cos(theta)).toFixed(1)),
      y: Number((cy + ry * Math.sin(theta)).toFixed(1)),
    });
  }
  return pts;
}
