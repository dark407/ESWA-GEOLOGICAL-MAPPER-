import type {
  FieldExcavationRound,
  FieldLocationSurfaceConfig,
  FieldPanelCanvasGeometry,
  FieldPanelId,
  FieldTransformStageMode,
  FieldTunnelLocationItem,
} from './fieldMappingEngine';

/**
 * Isolated Vertical Shaft Engine
 * All Vertical Shaft geometry, 5-panel quadrant calculations (Face + NE, ES, SE, SN),
 * and T-Canvas layout live exclusively in this module so that changes to Vertical Shaft
 * can NEVER alter, mutate, or affect Tunnel mode.
 */

export function isVerticalShaftLocation(
  location?: FieldTunnelLocationItem | null
): boolean {
  return Boolean(location && location.undergroundSubMode === 'vertical_shaft');
}

export function getVerticalShaftSurfaceConfig(
  location: FieldTunnelLocationItem
): FieldLocationSurfaceConfig {
  const shaftD = Math.max(1, Number(location.widthM) || 8.0);
  const quadrantArcM = Number(Math.max(0.5, (Math.PI * shaftD) / 4).toFixed(2));
  return {
    isCustom: false,
    isClosed: true,
    hasLeftWall: true,
    hasRightWall: true,
    hasCrown: true,
    hasInvert: true,
    leftWallLengthM: quadrantArcM,
    rightWallLengthM: quadrantArcM,
    crownLengthM: quadrantArcM,
    invertLengthM: quadrantArcM,
    splHeightM: quadrantArcM,
    tunnelW: shaftD,
    tunnelH: shaftD,
    isVerticalShaft: true,
    shaftSnLengthM: quadrantArcM,
  };
}

export function computeVerticalShaftPanelCanvasGeometry(
  panel: FieldPanelId,
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound
): FieldPanelCanvasGeometry {
  const surf = getVerticalShaftSurfaceConfig(location);
  const {
    tunnelW,
    tunnelH,
    splHeightM,
    leftWallLengthM,
    rightWallLengthM,
    crownLengthM,
    hasLeftWall,
    hasRightWall,
    hasCrown,
    hasInvert,
    isClosed,
  } = surf;
  const crownRiseM = Number(Math.max(0.2, tunnelH * 0.5).toFixed(2));
  const splRatio = 0.5;
  const pullM = Math.max(0.5, Number(round.pullLengthMeters) || 3.0);
  const quadArcM = Math.max(0.5, Number(((Math.PI * tunnelW) / 4).toFixed(2)));

  let panelWidthM = tunnelW;
  let panelHeightM = tunnelH;
  if (panel === 'face') {
    panelWidthM = tunnelW;
    panelHeightM = tunnelH;
  } else {
    // NE ('left_wall'), ES ('crown'), SE ('right_wall'), SN ('shaft_sn')
    panelWidthM = pullM;
    panelHeightM = quadArcM;
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
    tunnelW,
    tunnelH,
    splHeightM: quadArcM,
    leftWallLengthM: Math.max(0.5, leftWallLengthM || splHeightM),
    rightWallLengthM: Math.max(0.5, rightWallLengthM || splHeightM),
    crownRiseM,
    splRatio,
    pullM,
    crownLengthM: Math.max(0.5, crownLengthM || quadArcM),
    pxPerMeter,
    hasLeftWall,
    hasRightWall,
    hasCrown,
    hasInvert,
    isClosed,
  };
}

export function computeVerticalShaftTCanvasLayout(
  location: FieldTunnelLocationItem,
  round: FieldExcavationRound,
  computeOrientationMeta: (
    panel: FieldPanelId,
    round: FieldExcavationRound | null | undefined,
    splHeightM: number,
    crownLengthM: number,
    pullM: number,
    stageMode?: FieldTransformStageMode
  ) => {
    widthM: number;
    heightM: number;
    tr: { tOffsetX: number; tOffsetY: number };
  }
) {
  const faceGeom = computeVerticalShaftPanelCanvasGeometry('face', location, round);
  const crownGeom = computeVerticalShaftPanelCanvasGeometry('crown', location, round);
  const leftWallGeom = computeVerticalShaftPanelCanvasGeometry('left_wall', location, round);
  const rightWallGeom = computeVerticalShaftPanelCanvasGeometry('right_wall', location, round);
  const shaftSnGeom = computeVerticalShaftPanelCanvasGeometry('shaft_sn', location, round);

  const tunnelW = faceGeom.tunnelW;
  const tunnelH = faceGeom.tunnelH;
  const splHeightM = faceGeom.splHeightM;
  const splRatio = faceGeom.splRatio;
  const crownLengthM = faceGeom.crownLengthM;
  const pullM = faceGeom.pullM;

  const pullSpanM = Math.max(pullM, 1.5);
  const quadSpanM = Math.max(splHeightM, 1.5);
  const faceWidthM = Math.max(tunnelW, 2);
  const faceHeightM = Math.max(tunnelH, 2);

  const panelGapX = 24;
  const verticalGap = 68;

  const lwMeta = computeOrientationMeta(
    'left_wall',
    round,
    quadSpanM,
    quadSpanM,
    pullSpanM,
    'joint_grouping'
  );
  const crMeta = computeOrientationMeta(
    'crown',
    round,
    quadSpanM,
    quadSpanM,
    pullSpanM,
    'joint_grouping'
  );
  const rwMeta = computeOrientationMeta(
    'right_wall',
    round,
    quadSpanM,
    quadSpanM,
    pullSpanM,
    'joint_grouping'
  );
  const snMeta = computeOrientationMeta(
    'shaft_sn',
    round,
    quadSpanM,
    quadSpanM,
    pullSpanM,
    'joint_grouping'
  );

  // All 4 quadrant wall panels (NE, ES, SE, SN) sit in the bottom row below the circular shaft Face
  const totalBottomMetersW =
    lwMeta.widthM + crMeta.widthM + rwMeta.widthM + snMeta.widthM;
  const maxBottomMetersH = Math.max(
    lwMeta.heightM,
    crMeta.heightM,
    rwMeta.heightM,
    snMeta.heightM,
    1
  );

  const availBottomW = 1000 - 64 - panelGapX * 3;
  const availBottomH = 460;
  const stripPxPerM = Math.min(
    availBottomW / Math.max(1, totalBottomMetersW),
    availBottomH / Math.max(1, maxBottomMetersH)
  );

  const facePxPerM = Math.min(400 / faceWidthM, 260 / faceHeightM);
  const faceW = Number((faceWidthM * facePxPerM).toFixed(1));
  const faceH = Number((faceHeightM * facePxPerM).toFixed(1));

  const leftWallW = Number((lwMeta.widthM * stripPxPerM).toFixed(1));
  const leftWallH = Number((lwMeta.heightM * stripPxPerM).toFixed(1));
  const crownW = Number((crMeta.widthM * stripPxPerM).toFixed(1));
  const crownH = Number((crMeta.heightM * stripPxPerM).toFixed(1));
  const rightWallW = Number((rwMeta.widthM * stripPxPerM).toFixed(1));
  const rightWallH = Number((rwMeta.heightM * stripPxPerM).toFixed(1));
  const shaftSnW = Number((snMeta.widthM * stripPxPerM).toFixed(1));
  const shaftSnH = Number((snMeta.heightM * stripPxPerM).toFixed(1));

  const wallW = leftWallW;
  const wallH = leftWallH;
  const stripH = Math.max(leftWallH, crownH, rightWallH, shaftSnH);

  const totalGapsW = 3 * panelGapX;
  const totalBottomW = leftWallW + crownW + rightWallW + shaftSnW + totalGapsW;
  const totalLayoutH = faceH + verticalGap + stripH;

  const faceX = Number(((1000 - faceW) / 2).toFixed(1));
  const baseLeftWallX = (1000 - totalBottomW) / 2;
  const baseCrownX = baseLeftWallX + leftWallW + panelGapX;
  const baseRightWallX = baseCrownX + crownW + panelGapX;
  const baseShaftSnX = baseRightWallX + rightWallW + panelGapX;

  const faceY = Number(Math.max(44, (1000 - totalLayoutH) / 2 - 10).toFixed(1));
  const stripY = Number((faceY + faceH + verticalGap).toFixed(1));

  const leftWallX = Number((baseLeftWallX + lwMeta.tr.tOffsetX).toFixed(1));
  const leftWallY = Number((stripY + lwMeta.tr.tOffsetY).toFixed(1));
  const crownX = Number((baseCrownX + crMeta.tr.tOffsetX).toFixed(1));
  const crownY = Number((stripY + crMeta.tr.tOffsetY).toFixed(1));
  const rightWallX = Number((baseRightWallX + rwMeta.tr.tOffsetX).toFixed(1));
  const rightWallY = Number((stripY + rwMeta.tr.tOffsetY).toFixed(1));
  const shaftSnX = Number((baseShaftSnX + snMeta.tr.tOffsetX).toFixed(1));
  const shaftSnY = Number((stripY + snMeta.tr.tOffsetY).toFixed(1));

  const boxes: Record<
    FieldPanelId,
    { x: number; y: number; w: number; h: number; geom: FieldPanelCanvasGeometry }
  > = {
    face: { x: faceX, y: faceY, w: faceW, h: faceH, geom: faceGeom },
    left_wall: { x: leftWallX, y: leftWallY, w: leftWallW, h: leftWallH, geom: leftWallGeom },
    crown: { x: crownX, y: crownY, w: crownW, h: crownH, geom: crownGeom },
    right_wall: { x: rightWallX, y: rightWallY, w: rightWallW, h: rightWallH, geom: rightWallGeom },
    shaft_sn: { x: shaftSnX, y: shaftSnY, w: shaftSnW, h: shaftSnH, geom: shaftSnGeom },
  };

  return {
    faceGeom,
    crownGeom,
    leftWallGeom,
    rightWallGeom,
    shaftSnGeom,
    tunnelW,
    tunnelH,
    splHeightM,
    splRatio,
    crownLengthM,
    pullM,
    wallW,
    wallH,
    leftWallW,
    leftWallH,
    rightWallW,
    rightWallH,
    crownW,
    crownH,
    stripH,
    faceX,
    faceW,
    faceH,
    leftWallX,
    leftWallY,
    crownX,
    crownY,
    rightWallX,
    rightWallY,
    stripY,
    faceY,
    panelGapX,
    verticalGap,
    boxes,
  };
}
