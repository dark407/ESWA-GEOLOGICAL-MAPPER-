import {
  EngineeringSheetConfig,
  Joint,
  JointSet,
  LithologyRegion,
  OutputSheetMode,
  PhotoSurface,
  Point2D,
  SheetEngineeringBlockId,
  SurfaceTransform,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';

export type SheetLayoutArrangement = 'AUTO_INTELLIGENT' | 'MAXIMIZE_FACE';

const SHEET_CONFIG_STORAGE_KEY = 'eswa_tunnel_engineering_sheet_config_v20_fresh';

export function createDefaultEngineeringSheetConfig(
  settings?: Partial<TunnelSettings>
): EngineeringSheetConfig {
  const isMining = settings?.industryMode === 'MINING';
  const isTbm = settings?.industryMode === 'TBM';

  const geologySheetTitle = isMining
    ? 'ENGINEERING GEOLOGICAL MINING FACE & STOPE MAPPING SHEET'
    : isTbm
    ? 'ENGINEERING GEOLOGICAL TBM SHIELD TUNNEL MAPPING SHEET'
    : 'ENGINEERING GEOLOGICAL NATM TUNNEL MAPPING SHEET';

  const contractorSignTitle = isMining
    ? 'MINE GEOLOGIST / GEOTECHNICAL ENGINEER'
    : 'CONTRACTOR GEOLOGIST / SURVEYOR';

  return {
    projectName: settings?.projectName || '',
    location: settings?.locationName || settings?.location || '',
    clientName: '',
    contractorName: '',
    consultantName: '',
    contractNumber: '',
    drawingNumber: '',
    revisionNumber: 'Rev 0',
    geologySheetTitle,
    quantitySheetTitle: 'ENGINEERING OVERBREAK, UNDERCUT & EXCAVATION QUANTITY SHEET',
    clientLogoDataUrl: null,
    contractorLogoDataUrl: null,
    consultantLogoDataUrl: null,
    logoPosition: 'HEADER_CORNERS',
    logoSize: 'STANDARD',
    headerPosition: 'TOP',
    engineeringColumnPosition: 'RIGHT',
    columnWidthMode: 'BALANCED',
    blockOrder: [
      'ORIENTATION_POLAR',
      'LEGEND_SUMMARY',
      'DATA_TABLE',
      'Q_INDEX_AND_NOTES',
    ],
    showPerimeterPlan: true,
    showOrientationPolarBlock: true,
    showLegendBlock: true,
    showDataTableBlock: true,
    showSummaryNotesBlock: true,
    showSignatureStrip: true,
    showBackgroundGrid: true,
    layoutMode: 'ADAPTIVE_LAYOUT',
    adaptiveScaleMode: 'AUTO_CONTENT',
    fontScaleMultiplier: 1.0,
    manualTableRowHeight: 34,
    manualTableBlockRatio: 0.38,
    contractorSignTitle,
    contractorSignName: '',
    clientSignTitle: 'CLIENT / AUTHORITY ENGINEER',
    clientSignName: '',
    consultantSignTitle: 'CONSULTANT QA GEOLOGIST',
    consultantSignName: '',
    leftSignatoryTitle: 'CONTRACTOR GEOLOGIST SIGN',
    rightSignatoryTitle: 'CLIENT GEOLOGIST SIGN',
    customFooterRemarks: '',
  };
}

export function loadSavedEngineeringSheetConfig(
  settings?: Partial<TunnelSettings>
): EngineeringSheetConfig {
  const defaults = createDefaultEngineeringSheetConfig(settings);
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<EngineeringSheetConfig>) : {};
    const merged: EngineeringSheetConfig = {
      ...defaults,
      ...stored,
      ...(settings?.sheetConfig || {}),
    };
    merged.layoutMode =
      merged.layoutMode === 'FIXED_LAYOUT' ? 'FIXED_LAYOUT' : 'ADAPTIVE_LAYOUT';
    merged.blockOrder =
      Array.isArray(merged.blockOrder) && merged.blockOrder.length === 4
        ? merged.blockOrder
        : defaults.blockOrder;
    return merged;
  } catch {
    return settings?.sheetConfig ? { ...defaults, ...settings.sheetConfig } : defaults;
  }
}

export function saveEngineeringSheetConfigToStorage(config: EngineeringSheetConfig): void {
  try {
    localStorage.setItem(SHEET_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore quota errors
  }
}

export const loadSavedSheetConfig = loadSavedEngineeringSheetConfig;
export const saveSheetConfigToStorage = saveEngineeringSheetConfigToStorage;

export interface SheetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetTableColumnMetric {
  key: string;
  label: string;
  x: number;
  width: number;
  maxChars: number;
  subMaxChars: number;
}

export interface SheetContentMetrics {
  fontScale: number;
  headerTitleFontSize: number;
  headerMetaFontSize: number;
  blockTitleFontSize: number;
  tableHeaderFontSize: number;
  tableCellFontSize: number;
  tableSubCellFontSize: number;
  tableRowHeight: number;
  maxVisibleJointSets: number;
  maxVisibleOverbreakZones: number;
  notesFontSize: number;
  notesLineSpacing: number;
  notesMaxCharsPerLine: number;
  legendFontSize: number;
  legendRowSpacing: number;
  maxLegendLithologyRows: number;
  compactMode: boolean;
  sparseContentBoost: number;
  discontinuityColumns: SheetTableColumnMetric[];
  overbreakColumns: SheetTableColumnMetric[];
}

export interface SheetLayoutComputation {
  sheetW: number;
  sheetH: number;
  margin: number;
  showHeaderBlock: boolean;
  showTitleAndTables: boolean;
  showPerimeterPlan: boolean;
  headerBox: SheetRect;
  drawingArenaBox: SheetRect;
  rightColumnBox: SheetRect;
  contentMetrics: SheetContentMetrics;
  effectiveSheetConfig: EngineeringSheetConfig;

  // Priority 1: Main Tunnel-Face Geological Mapping Viewport
  facePxPerMeter: number;
  faceCenterX: number;
  faceTopY: number;
  faceBottomY: number;
  faceWidthPx: number;
  faceHeightPx: number;
  faceSurfaceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };

  // Priority 2: Developed Perimeter Mapping Viewport (Left Wall | Crown | Right Wall)
  perimeterPxPerMeter: number;
  planCenterX: number;
  planTopY: number;
  crownW_px: number;
  roundH_px: number;
  wallW_px: number;
  leftWallW_px: number;
  rightWallW_px: number;
  crownLeftX: number;
  leftWallLeftX: number;
  rightWallLeftX: number;
  roundLen: number;
  crownSpan: number;
  leftWallSpan: number;
  rightWallSpan: number;

  // Right/Left Engineering Column Non-Overlapping Blocks
  orientationBlock: SheetRect;
  legendBlock: SheetRect;
  jointTableBlock: SheetRect;
  qIndexAndNotesBlock: SheetRect;

  // Coordinate & Photo Registration Helpers (Identical world/canvas coordinate mapping)
  surfacePointToSheetXY: (pt: Point2D, surface: SurfaceType) => { x: number; y: number };
  getSurfaceSheetRect: (surface: SurfaceType) => {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    pxPerMeter: number;
  };
  getSheetPhotoSvgTransform: (surface: SurfaceType, transform: SurfaceTransform) => string;
}

/**
 * Word-wraps a string into at most `maxLines` lines of `maxCharsPerLine` characters
 * so engineering sheet notes and descriptions never clip or overflow their box.
 */
export function wrapSheetTextLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return ['—'];
  const safeMaxChars = Math.max(24, maxCharsPerLine);
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= safeMaxChars) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          const last = lines[maxLines - 1];
          lines[maxLines - 1] =
            last.length > safeMaxChars - 1 ? `${last.slice(0, safeMaxChars - 1)}…` : `${last}…`;
          return lines;
        }
      }
      current = word.length > safeMaxChars ? word.slice(0, safeMaxChars) : word;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : ['—'];
}

/**
 * Content-Aware & Space-Aware Final Engineering Sheet Auto-Layout Engine.
 *
 * Automatically calculates required page layout from actual content, resizes/positions
 * photos, geological drawings, tables, legends, dimensions, and text:
 * - When content is less/sparse, automatically increases font size, row height, and table visual density
 *   to utilize empty white parts cleanly.
 * - When content is large/dense, automatically reduces font size and row height so all rows fit cleanly.
 * - Strictly isolates and protects the Main Tunnel-Face Drawing & Canvas Arena so tables/headers
 *   NEVER collapse or overlap with the face drawing.
 */
export function computeFinalSheetAutoLayout(params: {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  joints: Joint[];
  jointSets: JointSet[];
  lithologyRegions: LithologyRegion[];
  outputMode: OutputSheetMode;
  arrangement?: SheetLayoutArrangement;
  overbreakZoneCount?: number;
  notesTextLength?: number;
  placedSymbolCount?: number;
  controlPointCount?: number;
  sectionVolumeRowCount?: number;
  sheetConfig?: EngineeringSheetConfig;
}): SheetLayoutComputation {
  const {
    geometry,
    settings,
    joints,
    jointSets,
    lithologyRegions,
    outputMode,
    arrangement = 'AUTO_INTELLIGENT',
    overbreakZoneCount = 0,
    notesTextLength = 0,
    placedSymbolCount = 0,
    controlPointCount = 0,
    sectionVolumeRowCount = 0,
    sheetConfig: propSheetConfig,
  } = params;

  const effectiveSheetConfig =
    propSheetConfig || loadSavedEngineeringSheetConfig(settings);

  // Landscape A3 Engineering Sheet (1600 x 1130 high-resolution technical drawing space)
  const sheetW = 1600;
  const sheetH = 1130;
  const margin = 16;

  const isCrownAndWallOnly = outputMode === 'CROWN_AND_WALL_VECTOR_ONLY';
  const showHeaderBlock = true;

  const showTitleAndTables =
    outputMode === 'FINAL_ENGINEERING_SHEET' ||
    outputMode === 'CLEAN_MAPPING_DRAWING' ||
    outputMode === 'ENGINEERING_QUANTITY_SHEET';

  // Content density analysis to automatically scale fonts, row heights, and block heights
  const uniqueLithologyCount = Math.max(
    1,
    new Set(lithologyRegions.map((r) => r.patternType)).size || 5
  );
  const activeSetCount = Math.max(1, jointSets.length);
  const activeZoneCount = Math.max(1, overbreakZoneCount);
  const activeRowCount =
    outputMode === 'ENGINEERING_QUANTITY_SHEET' ? activeZoneCount : activeSetCount;

  const totalContentLoad =
    activeRowCount * 1.45 +
    Math.min(12, joints.length) * 0.2 +
    Math.min(6, uniqueLithologyCount) * 0.3 +
    (notesTextLength > 240 ? 2.2 : notesTextLength > 120 ? 1.2 : 0) +
    (sectionVolumeRowCount > 2 ? 1.2 : 0);

  const isSparseContent =
    activeRowCount <= 3 && notesTextLength <= 140 && sectionVolumeRowCount <= 2;
  const compactMode = totalContentLoad > 8.5 || activeRowCount > 6 || notesTextLength > 220;
  const ultraDenseMode = totalContentLoad > 12.5 || activeRowCount > 9 || notesTextLength > 340;

  const isFixedLayout = effectiveSheetConfig.layoutMode === 'FIXED_LAYOUT';

  // Base adaptive font scale (1pt sleeker baseline so tables/text are crisp and drawing arena gets maximum space)
  let baseFontScale = isFixedLayout
    ? 0.94
    : ultraDenseMode
    ? 0.78
    : activeRowCount > 7
    ? 0.83
    : compactMode
    ? 0.89
    : isSparseContent
    ? 1.04
    : 0.96;

  if (!isFixedLayout) {
    if (effectiveSheetConfig.adaptiveScaleMode === 'SPACIOUS_LARGE') {
      baseFontScale = Math.min(1.18, baseFontScale * 1.1);
    } else if (effectiveSheetConfig.adaptiveScaleMode === 'COMPACT_DENSE') {
      baseFontScale = Math.max(0.76, baseFontScale * 0.9);
    }
  }

  const userMult = Math.max(0.75, Math.min(1.35, effectiveSheetConfig.fontScaleMultiplier || 1.0));
  const fontScale = Number(Math.max(0.75, Math.min(1.26, baseFontScale * userMult)).toFixed(3));
  const sparseContentBoost = isFixedLayout ? 0.96 : isSparseContent ? 1.08 : compactMode ? 0.92 : 0.98;

  // Header Block (Priority 6: Project Information - Supports TOP or BOTTOM placement)
  const hasLogosInHeader =
    effectiveSheetConfig.logoPosition !== 'HIDDEN' &&
    effectiveSheetConfig.logoPosition !== 'BOTTOM_SIGN_BLOCK' &&
    Boolean(
      effectiveSheetConfig.clientLogoDataUrl ||
        effectiveSheetConfig.contractorLogoDataUrl ||
        effectiveSheetConfig.consultantLogoDataUrl
    );

  // All sheets always include the Engineering Header & Title Block (Project Name, Location, Chainage, etc.)
  const headerH = hasLogosInHeader
    ? 78
    : ultraDenseMode
    ? 70
    : compactMode
    ? 74
    : 76;

  const isHeaderBottom = effectiveSheetConfig.headerPosition === 'BOTTOM';
  const headerBox: SheetRect = {
    x: margin + 4,
    y: isHeaderBottom ? sheetH - margin - 4 - headerH : margin + 4,
    width: sheetW - (margin + 4) * 2,
    height: headerH,
  };

  // When side engineering tables are hidden, reserve 34px at the opposite edge for the Bottom Sign-Off & Metadata Strip
  const fullWidthFooterH = showTitleAndTables ? 0 : 34;

  const contentTopY = isHeaderBottom
    ? margin + 6
    : headerBox.y + headerBox.height + 5;
  const contentBottomY = isHeaderBottom
    ? headerBox.y - 5 - fullWidthFooterH
    : sheetH - margin - 5 - fullWidthFooterH;
  const availHeight = Math.max(580, contentBottomY - contentTopY);

  // Engineering Column Width & Position (Supports RIGHT or LEFT, and BALANCED / WIDE_TABLES / MAX_DRAWING)
  // Core Rule: Keep main geological drawing arena strictly protected and maximize canvas utilization.
  const baseRightColW =
    effectiveSheetConfig.columnWidthMode === 'WIDE_TABLES'
      ? 580
      : effectiveSheetConfig.columnWidthMode === 'MAX_DRAWING'
      ? 480
      : compactMode
      ? 524
      : 536;

  const rightColW = showTitleAndTables ? baseRightColW : 0;
  const isColumnOnLeft = effectiveSheetConfig.engineeringColumnPosition === 'LEFT';

  const rightColX = isColumnOnLeft
    ? margin + 4
    : sheetW - margin - 4 - rightColW;

  const rightColumnBox: SheetRect = {
    x: rightColX,
    y: contentTopY,
    width: rightColW,
    height: availHeight,
  };

  // Main Drawing Arena (Priorities 1 & 2 - Strictly separated from Engineering Column)
  const arenaLeftX = showTitleAndTables
    ? isColumnOnLeft
      ? rightColX + rightColW + 6
      : margin + 4
    : margin + 4;
  const arenaRightX = showTitleAndTables
    ? isColumnOnLeft
      ? sheetW - margin - 4
      : rightColX - 6
    : sheetW - margin - 4;

  const drawingArenaBox: SheetRect = {
    x: arenaLeftX,
    y: contentTopY,
    width: Math.max(520, arenaRightX - arenaLeftX),
    height: availHeight,
  };

  const showPerimeterPlan =
    isCrownAndWallOnly ||
    (effectiveSheetConfig.showPerimeterPlan !== false &&
      arrangement !== 'MAXIMIZE_FACE' &&
      outputMode !== 'EXPORT_PHOTO_ONLY');

  const roundLen = Math.max(1.5, settings.roundLength || 3.5);
  const hasLeftWall = geometry.hasLeftWall !== false;
  const hasRightWall = geometry.hasRightWall !== false;
  const hasCrown =
    geometry.hasCrown !== false &&
    (geometry.crownArcLength === undefined || geometry.crownArcLength > 0.05);

  const crownSpan = hasCrown ? Math.max(0.5, geometry.crownArcLength || geometry.width) : 0;
  const leftWallSpan = hasLeftWall
    ? Math.max(
        0.5,
        geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2
      )
    : 0;
  const rightWallSpan = hasRightWall
    ? Math.max(
        0.5,
        geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2
      )
    : 0;
  const totalDevelopedWidthMeters = Math.max(1.0, leftWallSpan + crownSpan + rightWallSpan);

  // Minimize empty white space around the Tunnel Face while reserving safe room for dimension lines & callout labels
  const calloutCount = joints.length + placedSymbolCount + controlPointCount;
  const hasDenseCallouts = calloutCount > 10;
  const arenaPadW = hasDenseCallouts ? 68 : calloutCount > 4 ? 56 : 46;
  const arenaPadH = showPerimeterPlan
    ? hasDenseCallouts
      ? 78
      : 66
    : hasDenseCallouts
    ? 58
    : 48;

  // UNIFIED TRUE ENGINEERING SCALE: Maximizes utilization of drawingArenaBox
  const totalHorizontalMeters = isCrownAndWallOnly
    ? totalDevelopedWidthMeters
    : showPerimeterPlan
    ? Math.max(geometry.width, totalDevelopedWidthMeters)
    : geometry.width;
  const totalVerticalMeters = isCrownAndWallOnly
    ? roundLen
    : showPerimeterPlan
    ? roundLen + geometry.height
    : geometry.height;

  const availDrawingW = Math.max(380, drawingArenaBox.width - arenaPadW);
  const availDrawingH = Math.max(380, drawingArenaBox.height - arenaPadH);

  const unifiedPxPerMeter = Number(
    Math.min(
      availDrawingW / Math.max(1, totalHorizontalMeters),
      (isCrownAndWallOnly ? availDrawingH * 0.9 : availDrawingH) /
        Math.max(1, totalVerticalMeters)
    ).toFixed(3)
  );

  const facePxPerMeter = unifiedPxPerMeter;
  const perimeterPxPerMeter = unifiedPxPerMeter;

  const planCenterX = Number((drawingArenaBox.x + drawingArenaBox.width / 2).toFixed(1));
  const faceWidthPx = Number((geometry.width * facePxPerMeter).toFixed(2));
  const faceHeightPx = Number((geometry.height * facePxPerMeter).toFixed(2));

  const crownW_px = Number((crownSpan * perimeterPxPerMeter).toFixed(2));
  const leftWallW_px = Number((leftWallSpan * perimeterPxPerMeter).toFixed(2));
  const rightWallW_px = Number((rightWallSpan * perimeterPxPerMeter).toFixed(2));
  const wallW_px = Math.max(leftWallW_px, rightWallW_px);
  const roundH_px = Number((roundLen * perimeterPxPerMeter).toFixed(2));

  // Vertically center the unified [Developed Perimeter + Projection Gap + Tunnel Face] assembly
  const interViewGapPx = isCrownAndWallOnly ? 0 : showPerimeterPlan ? 46 : 0;
  const totalAssemblyHeightPx = isCrownAndWallOnly
    ? roundH_px
    : (showPerimeterPlan ? roundH_px + interViewGapPx : 0) + faceHeightPx;
  const assemblyTopY =
    drawingArenaBox.y +
    Math.max(28, (drawingArenaBox.height - totalAssemblyHeightPx) / 2);

  const planTopY = Number(assemblyTopY.toFixed(1));
  const totalDevelopedW_px = leftWallW_px + crownW_px + rightWallW_px;
  const stripStartLeftX = Number((planCenterX - totalDevelopedW_px / 2).toFixed(2));
  const leftWallLeftX = stripStartLeftX;
  const crownLeftX = Number((leftWallLeftX + leftWallW_px).toFixed(2));
  const rightWallLeftX = Number((crownLeftX + crownW_px).toFixed(2));

  const faceCenterX = planCenterX;
  const faceTopY = Number(
    (showPerimeterPlan ? planTopY + roundH_px + interViewGapPx : assemblyTopY).toFixed(2)
  );
  const faceBottomY = Number((faceTopY + faceHeightPx).toFixed(2));

  const faceSurfaceRect = {
    x: Number((faceCenterX - faceWidthPx / 2).toFixed(2)),
    y: faceTopY,
    width: faceWidthPx,
    height: faceHeightPx,
    centerX: faceCenterX,
    centerY: Number((faceTopY + faceHeightPx / 2).toFixed(2)),
  };

  // ============================================================================
  // DYNAMIC CONTENT-ADAPTIVE ENGINEERING COLUMN ALLOCATION & BLOCK ORDERING:
  // Zero wasted white space: visible blocks automatically share 100% of availHeight!
  // ============================================================================
  const maxLegendLithologyRows = Math.min(6, Math.max(5, uniqueLithologyCount));
  const maxVisibleJointSets = Math.min(14, Math.max(1, jointSets.length));
  const maxVisibleOverbreakZones = Math.min(14, Math.max(1, overbreakZoneCount));
  const targetRows =
    outputMode === 'ENGINEERING_QUANTITY_SHEET'
      ? Math.max(2, maxVisibleOverbreakZones)
      : Math.max(2, maxVisibleJointSets);

  const blockVisibility: Record<SheetEngineeringBlockId, boolean> = {
    ORIENTATION_POLAR: effectiveSheetConfig.showOrientationPolarBlock !== false,
    LEGEND_SUMMARY: effectiveSheetConfig.showLegendBlock !== false,
    DATA_TABLE: effectiveSheetConfig.showDataTableBlock !== false,
    Q_INDEX_AND_NOTES: effectiveSheetConfig.showSummaryNotesBlock !== false,
  };

  const orderedBlocks: SheetEngineeringBlockId[] =
    Array.isArray(effectiveSheetConfig.blockOrder) && effectiveSheetConfig.blockOrder.length === 4
      ? effectiveSheetConfig.blockOrder
      : ['ORIENTATION_POLAR', 'LEGEND_SUMMARY', 'DATA_TABLE', 'Q_INDEX_AND_NOTES'];

  const activeBlockIds = orderedBlocks.filter((id) => blockVisibility[id]);
  const gap = ultraDenseMode ? 5 : compactMode ? 6 : 7;
  const totalGapsH = Math.max(0, activeBlockIds.length - 1) * gap;
  const totalUsableRightH = Math.max(400, availHeight - totalGapsH);

  // Ideal content-driven weights for each block (or manual proportions in FIXED_LAYOUT)
  const manualTableShare = Math.max(
    0.25,
    Math.min(0.55, effectiveSheetConfig.manualTableBlockRatio ?? 0.38)
  );
  const idealRowH = isFixedLayout
    ? Math.max(20, Math.min(64, effectiveSheetConfig.manualTableRowHeight ?? 34))
    : targetRows <= 2
    ? 52
    : targetRows <= 4
    ? 44
    : targetRows <= 6
    ? 36
    : targetRows <= 8
    ? 29
    : 23;

  const idealHeights: Record<SheetEngineeringBlockId, number> = isFixedLayout
    ? {
        ORIENTATION_POLAR: blockVisibility.ORIENTATION_POLAR ? Math.round(totalUsableRightH * 0.19) : 0,
        LEGEND_SUMMARY: blockVisibility.LEGEND_SUMMARY ? Math.round(totalUsableRightH * 0.18) : 0,
        DATA_TABLE: blockVisibility.DATA_TABLE
          ? Math.round(totalUsableRightH * manualTableShare)
          : 0,
        Q_INDEX_AND_NOTES: blockVisibility.Q_INDEX_AND_NOTES
          ? Math.round(totalUsableRightH * Math.max(0.18, 0.63 - manualTableShare))
          : 0,
      }
    : {
        ORIENTATION_POLAR: blockVisibility.ORIENTATION_POLAR
          ? isSparseContent
            ? 200
            : ultraDenseMode
            ? 148
            : compactMode
            ? 162
            : 180
          : 0,
        LEGEND_SUMMARY: blockVisibility.LEGEND_SUMMARY
          ? isSparseContent
            ? 196
            : ultraDenseMode
            ? 144
            : compactMode
            ? 160
            : 176
          : 0,
        DATA_TABLE: blockVisibility.DATA_TABLE
          ? Math.max(
              isSparseContent ? 260 : 210,
              Math.min(480, 46 + targetRows * idealRowH + (isSparseContent ? 64 : 12))
            )
          : 0,
        Q_INDEX_AND_NOTES: blockVisibility.Q_INDEX_AND_NOTES
          ? notesTextLength > 240 || sectionVolumeRowCount >= 2
            ? 280
            : isSparseContent
            ? 268
            : 245
          : 0,
      };

  const idealSum = activeBlockIds.reduce((acc, id) => acc + idealHeights[id], 0) || 1;
  const allocatedHeights: Record<SheetEngineeringBlockId, number> = {
    ORIENTATION_POLAR: 0,
    LEGEND_SUMMARY: 0,
    DATA_TABLE: 0,
    Q_INDEX_AND_NOTES: 0,
  };

  let runningAllocated = 0;
  activeBlockIds.forEach((id, idx) => {
    if (idx === activeBlockIds.length - 1) {
      allocatedHeights[id] = Math.max(120, totalUsableRightH - runningAllocated);
    } else {
      const share = Math.round((idealHeights[id] / idealSum) * totalUsableRightH);
      allocatedHeights[id] = Math.max(120, share);
      runningAllocated += allocatedHeights[id];
    }
  });

  // Assign Y positions according to user's custom `blockOrder`
  const blockRects: Record<SheetEngineeringBlockId, SheetRect> = {
    ORIENTATION_POLAR: { x: rightColX, y: contentTopY, width: rightColW, height: 0 },
    LEGEND_SUMMARY: { x: rightColX, y: contentTopY, width: rightColW, height: 0 },
    DATA_TABLE: { x: rightColX, y: contentTopY, width: rightColW, height: 0 },
    Q_INDEX_AND_NOTES: { x: rightColX, y: contentTopY, width: rightColW, height: 0 },
  };

  let cursorY = contentTopY;
  for (const id of orderedBlocks) {
    if (!blockVisibility[id]) {
      blockRects[id] = { x: rightColX, y: cursorY, width: rightColW, height: 0 };
      continue;
    }
    const h = allocatedHeights[id];
    blockRects[id] = {
      x: rightColX,
      y: cursorY,
      width: rightColW,
      height: h,
    };
    cursorY += h + gap;
  }

  const orientationBlock = blockRects.ORIENTATION_POLAR;
  const legendBlock = blockRects.LEGEND_SUMMARY;
  const jointTableBlock = blockRects.DATA_TABLE;
  const qIndexAndNotesBlock = blockRects.Q_INDEX_AND_NOTES;

  const legendH = Math.max(140, legendBlock.height || 170);
  const actualTableH = Math.max(180, jointTableBlock.height || 240);
  const remainingForQ = Math.max(180, qIndexAndNotesBlock.height || 240);

  // Dynamically scale Legend row spacing & font size based on expanded legendH
  const legendRowSpacing = Number(
    Math.max(20, Math.min(34, (legendH - 36) / Math.max(5, maxLegendLithologyRows))).toFixed(1)
  );
  const legendExpansionBoost = Math.max(0.95, Math.min(1.28, legendH / 150));

  // Dynamically scale Table row height & font size based on actualTableH and row count (or manual row height in FIXED_LAYOUT)
  const computedRowH = isFixedLayout
    ? Math.max(
        18,
        Math.min(
          64,
          effectiveSheetConfig.manualTableRowHeight ?? 34,
          Math.floor((actualTableH - 44) / Math.max(1, targetRows))
        )
      )
    : Math.max(
        18,
        Math.min(62, Math.floor((actualTableH - 44) / Math.max(1, targetRows)))
      );
  const tableExpansionBoost = isFixedLayout
    ? 1.0
    : computedRowH >= 46
    ? 1.26
    : computedRowH >= 38
    ? 1.18
    : computedRowH >= 30
    ? 1.1
    : computedRowH < 22
    ? 0.85
    : 1.0;
  const effectiveTableFontScale = Number(
    Math.max(0.82, Math.min(1.3, fontScale * tableExpansionBoost)).toFixed(3)
  );

  // Compute responsive column metrics for Discontinuity-Set Table
  const colScale = Math.max(0.9, rightColW / 506);
  const discBoundaries = [
    0,
    Math.round(46 * colScale),
    Math.round(142 * colScale),
    Math.round(216 * colScale),
    Math.round(280 * colScale),
    Math.round(350 * colScale),
    rightColW,
  ];
  const charPx = 4.65 * effectiveTableFontScale;
  const subCharPx = 4.15 * effectiveTableFontScale;

  const discontinuityColumns: SheetTableColumnMetric[] = [
    {
      key: 'set',
      label: 'SET',
      x: discBoundaries[0],
      width: discBoundaries[1] - discBoundaries[0],
      maxChars: 5,
      subMaxChars: 5,
    },
    {
      key: 'orientation',
      label: 'DIP DIR / DIP',
      x: discBoundaries[1],
      width: discBoundaries[2] - discBoundaries[1],
      maxChars: Math.floor((discBoundaries[2] - discBoundaries[1] - 8) / charPx),
      subMaxChars: Math.floor((discBoundaries[2] - discBoundaries[1] - 8) / subCharPx),
    },
    {
      key: 'spacing',
      label: 'SPACING',
      x: discBoundaries[2],
      width: discBoundaries[3] - discBoundaries[2],
      maxChars: Math.floor((discBoundaries[3] - discBoundaries[2] - 8) / charPx),
      subMaxChars: Math.floor((discBoundaries[3] - discBoundaries[2] - 8) / subCharPx),
    },
    {
      key: 'persistence',
      label: 'PERSIST.',
      x: discBoundaries[3],
      width: discBoundaries[4] - discBoundaries[3],
      maxChars: Math.floor((discBoundaries[4] - discBoundaries[3] - 8) / charPx),
      subMaxChars: Math.floor((discBoundaries[4] - discBoundaries[3] - 8) / subCharPx),
    },
    {
      key: 'aperture',
      label: 'APERTURE',
      x: discBoundaries[4],
      width: discBoundaries[5] - discBoundaries[4],
      maxChars: Math.floor((discBoundaries[5] - discBoundaries[4] - 8) / charPx),
      subMaxChars: Math.floor((discBoundaries[5] - discBoundaries[4] - 8) / subCharPx),
    },
    {
      key: 'roughness',
      label: 'ROUGHNESS / INFILL',
      x: discBoundaries[5],
      width: discBoundaries[6] - discBoundaries[5],
      maxChars: Math.floor((discBoundaries[6] - discBoundaries[5] - 10) / charPx),
      subMaxChars: Math.floor((discBoundaries[6] - discBoundaries[5] - 10) / subCharPx),
    },
  ];

  const obBoundaries = [
    0,
    Math.round(54 * colScale),
    Math.round(148 * colScale),
    Math.round(226 * colScale),
    Math.round(288 * colScale),
    rightColW,
  ];

  const overbreakColumns: SheetTableColumnMetric[] = [
    {
      key: 'zone',
      label: 'ZONE',
      x: obBoundaries[0],
      width: obBoundaries[1] - obBoundaries[0],
      maxChars: 6,
      subMaxChars: 6,
    },
    {
      key: 'sector',
      label: 'SECTOR',
      x: obBoundaries[1],
      width: obBoundaries[2] - obBoundaries[1],
      maxChars: Math.floor((obBoundaries[2] - obBoundaries[1] - 8) / charPx),
      subMaxChars: Math.floor((obBoundaries[2] - obBoundaries[1] - 8) / subCharPx),
    },
    {
      key: 'area',
      label: 'AREA / %',
      x: obBoundaries[2],
      width: obBoundaries[3] - obBoundaries[2],
      maxChars: Math.floor((obBoundaries[3] - obBoundaries[2] - 8) / charPx),
      subMaxChars: Math.floor((obBoundaries[3] - obBoundaries[2] - 8) / subCharPx),
    },
    {
      key: 'maxRad',
      label: 'MAX RAD.',
      x: obBoundaries[3],
      width: obBoundaries[4] - obBoundaries[3],
      maxChars: Math.floor((obBoundaries[4] - obBoundaries[3] - 8) / charPx),
      subMaxChars: Math.floor((obBoundaries[4] - obBoundaries[3] - 8) / subCharPx),
    },
    {
      key: 'reason',
      label: 'REASON CATEGORY & LINKED SETS',
      x: obBoundaries[4],
      width: obBoundaries[5] - obBoundaries[4],
      maxChars: Math.floor((obBoundaries[5] - obBoundaries[4] - 10) / charPx),
      subMaxChars: Math.floor((obBoundaries[5] - obBoundaries[4] - 10) / subCharPx),
    },
  ];

  const qExpansionBoost = Math.max(0.96, Math.min(1.26, remainingForQ / 220));
  const notesFontSize = Number((8.7 * fontScale * qExpansionBoost).toFixed(2));
  const notesLineSpacing = Number((Math.max(12.2, 15.6 * fontScale * qExpansionBoost)).toFixed(1));
  const notesMaxCharsPerLine = Math.floor((rightColW - 24) / (notesFontSize * 0.57));

  const contentMetrics: SheetContentMetrics = {
    fontScale,
    headerTitleFontSize: Number((14.4 * Math.max(0.9, fontScale)).toFixed(2)),
    headerMetaFontSize: Number((10.2 * Math.max(0.9, fontScale)).toFixed(2)),
    blockTitleFontSize: Number((10.8 * Math.max(0.92, fontScale * Math.min(1.15, legendExpansionBoost))).toFixed(2)),
    tableHeaderFontSize: Number((8.7 * effectiveTableFontScale).toFixed(2)),
    tableCellFontSize: Number((9.2 * effectiveTableFontScale).toFixed(2)),
    tableSubCellFontSize: Number((8.0 * effectiveTableFontScale).toFixed(2)),
    tableRowHeight: computedRowH,
    maxVisibleJointSets,
    maxVisibleOverbreakZones,
    notesFontSize,
    notesLineSpacing,
    notesMaxCharsPerLine,
    legendFontSize: Number((9.1 * Math.max(0.9, fontScale * legendExpansionBoost)).toFixed(2)),
    legendRowSpacing,
    maxLegendLithologyRows,
    compactMode,
    sparseContentBoost,
    discontinuityColumns,
    overbreakColumns,
  };

  const getSurfaceSheetRect = (surface: SurfaceType) => {
    if (surface === 'face') {
      return {
        ...faceSurfaceRect,
        pxPerMeter: facePxPerMeter,
      };
    }
    if (surface === 'crown') {
      return {
        x: crownLeftX,
        y: planTopY,
        width: crownW_px,
        height: roundH_px,
        centerX: crownLeftX + crownW_px / 2,
        centerY: planTopY + roundH_px / 2,
        pxPerMeter: perimeterPxPerMeter,
      };
    }
    if (surface === 'leftWall') {
      return {
        x: leftWallLeftX,
        y: planTopY,
        width: leftWallW_px,
        height: roundH_px,
        centerX: leftWallLeftX + leftWallW_px / 2,
        centerY: planTopY + roundH_px / 2,
        pxPerMeter: perimeterPxPerMeter,
      };
    }
    return {
      x: rightWallLeftX,
      y: planTopY,
      width: rightWallW_px,
      height: roundH_px,
      centerX: rightWallLeftX + rightWallW_px / 2,
      centerY: planTopY + roundH_px / 2,
      pxPerMeter: perimeterPxPerMeter,
    };
  };

  const getSheetPhotoSvgTransform = (
    surface: SurfaceType,
    transform: SurfaceTransform
  ): string => {
    const rect = getSurfaceSheetRect(surface);
    const dxPx = (transform.offsetX || 0) * rect.pxPerMeter;
    const dyPx = -(transform.offsetY || 0) * rect.pxPerMeter;
    const zoom = transform.zoom ?? 1;
    const sx = (transform.scaleX || 1) * zoom;
    const sy = (transform.scaleY || 1) * zoom;
    const rot = transform.rotation || 0;

    return `translate(${rect.centerX + dxPx}, ${rect.centerY + dyPx}) rotate(${rot}) scale(${sx}, ${sy}) translate(${-rect.centerX}, ${-rect.centerY})`;
  };

  const faceMinX =
    typeof geometry.minX === 'number' && Number.isFinite(geometry.minX)
      ? geometry.minX
      : -geometry.width / 2;
  const faceMaxX =
    typeof geometry.maxX === 'number' && Number.isFinite(geometry.maxX)
      ? geometry.maxX
      : geometry.width / 2;
  const faceMidX = (faceMinX + faceMaxX) / 2;
  const faceMinY =
    typeof geometry.minY === 'number' && Number.isFinite(geometry.minY)
      ? geometry.minY
      : 0;

  const surfacePointToSheetXY = (
    pt: Point2D,
    surface: SurfaceType
  ): { x: number; y: number } => {
    if (surface === 'face') {
      return {
        x: Number((faceCenterX + (pt.x - faceMidX) * facePxPerMeter).toFixed(2)),
        y: Number((faceBottomY - (pt.y - faceMinY) * facePxPerMeter).toFixed(2)),
      };
    }
    if (surface === 'crown') {
      const crownMidX = crownLeftX + crownW_px / 2;
      return {
        x: Number((crownMidX + pt.x * perimeterPxPerMeter).toFixed(2)),
        y: Number((planTopY + roundH_px - pt.y * perimeterPxPerMeter).toFixed(2)),
      };
    }
    if (surface === 'leftWall') {
      const normAlongRound = Math.max(0, Math.min(1, pt.x / roundLen));
      const normHeight = Math.max(0, Math.min(1, pt.y / Math.max(0.5, leftWallSpan)));
      return {
        x: Number((leftWallLeftX + normHeight * leftWallW_px).toFixed(2)),
        y: Number((planTopY + roundH_px - normAlongRound * roundH_px).toFixed(2)),
      };
    }
    const normAlongRound = Math.max(0, Math.min(1, pt.x / roundLen));
    const normHeight = Math.max(0, Math.min(1, pt.y / Math.max(0.5, rightWallSpan)));
    return {
      x: Number((rightWallLeftX + (1 - normHeight) * rightWallW_px).toFixed(2)),
      y: Number((planTopY + roundH_px - normAlongRound * roundH_px).toFixed(2)),
    };
  };

  return {
    sheetW,
    sheetH,
    margin,
    showHeaderBlock,
    showTitleAndTables,
    showPerimeterPlan,
    headerBox,
    drawingArenaBox,
    rightColumnBox,
    contentMetrics,
    effectiveSheetConfig,
    facePxPerMeter,
    faceCenterX,
    faceTopY,
    faceBottomY,
    faceWidthPx,
    faceHeightPx,
    faceSurfaceRect,
    perimeterPxPerMeter,
    planCenterX,
    planTopY,
    crownW_px,
    roundH_px,
    wallW_px,
    leftWallW_px,
    rightWallW_px,
    crownLeftX,
    leftWallLeftX,
    rightWallLeftX,
    roundLen,
    crownSpan,
    leftWallSpan,
    rightWallSpan,
    orientationBlock,
    legendBlock,
    jointTableBlock,
    qIndexAndNotesBlock,
    surfacePointToSheetXY,
    getSurfaceSheetRect,
    getSheetPhotoSvgTransform,
  };
}
