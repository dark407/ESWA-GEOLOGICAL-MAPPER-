import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BoundaryZoneRole,
  ChainageProfileSegmentRecord,
  CustomSegmentType,
  CustomTunnelProfileDefinition,
  Point2D,
  ProfileControlPoint,
  ProfileSegment,
  ProfileType,
  SavedDesignGeometryRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  buildAuthoritativeCustomTunnelGeometry,
  computeBulgeFromArcLength,
  computeBulgeFromMidpointHandle,
  CUSTOM_PROFILE_PRESETS,
  deriveEditableCustomProfileFromGeometry,
  evaluateCustomProfileGeometry,
  sliceCustomProfileToTopHeading,
} from '../engine/customProfileEngine';
import {
  convertTunnelGeometryToSequentialTopHeading,
  createTunnelGeometry,
} from '../engine/geometryEngine';
import {
  generateSampleTunnelDXF,
  parseDXFStringToGeometry,
} from '../engine/cadParser';
import { getEswaApiSecurityHeaders } from '../engine/softwareLicensingEngine';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Download,
  Move,
  Ruler,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { QuickSketchShapeSolver } from './QuickSketchShapeSolver';

export type ProfileEditorMainTab =
  | 'sketch_solver'
  | 'common_variants'
  | 'freeform_canvas'
  | 'trace_image'
  | 'segment_builder'
  | 'chainage_schedule'
  | 'dxf_import';

type CustomShapeSubMode = 'LINE' | 'ARC' | 'XY_POINT' | 'SELECT_EDIT';

interface FreeformCustomProfileEditorProps {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  savedGeometries: SavedDesignGeometryRecord[];
  chainageSchedule: ChainageProfileSegmentRecord[];
  initialTab?: ProfileEditorMainTab;
  onApplyGeometry: (nextGeometry: TunnelGeometry, proceedToPhotos?: boolean) => void;
  onSaveToGeometryLibrary: (name: string, nextGeometry: TunnelGeometry) => void;
  onDeleteSavedGeometry: (id: string) => void;
  onUpdateChainageSchedule: (next: ChainageProfileSegmentRecord[]) => void;
  onSyncProfileToSurveyControlPoints?: (profile: CustomTunnelProfileDefinition) => void;
  onBack: () => void;
}

const COMMON_TUNNEL_VARIANTS: {
  id: ProfileType;
  label: string;
  subtitle: string;
  defaultW: number;
  defaultH: number;
  defaultWallH: number;
  defaultCrownR: number;
}[] = [
  {
    id: 'd_shaped',
    label: 'D-Shaped Tunnel',
    subtitle: 'Vertical side walls + arched roof + flat invert',
    defaultW: 8.4,
    defaultH: 7.2,
    defaultWallH: 4.2,
    defaultCrownR: 4.35,
  },
  {
    id: 'horseshoe',
    label: 'Standard Horseshoe',
    subtitle: 'Curved side walls + semicircular arch crown',
    defaultW: 8.5,
    defaultH: 7.5,
    defaultWallH: 3.8,
    defaultCrownR: 4.25,
  },
  {
    id: 'modified_horseshoe',
    label: 'Modified Horseshoe (NATM)',
    subtitle: 'Curved walls + multi-radius arch for underground headings',
    defaultW: 9.2,
    defaultH: 7.8,
    defaultWallH: 4.0,
    defaultCrownR: 4.6,
  },
  {
    id: 'circular',
    label: 'Circular / TBM Profile',
    subtitle: 'Full circular excavation section',
    defaultW: 7.6,
    defaultH: 7.6,
    defaultWallH: 3.8,
    defaultCrownR: 3.8,
  },
  {
    id: 'flat_roof',
    label: 'Rectangular / Box Portal',
    subtitle: 'Vertical walls + flat roof / portal cut',
    defaultW: 8.0,
    defaultH: 6.0,
    defaultWallH: 5.6,
    defaultCrownR: 12.0,
  },
];

export const FreeformCustomProfileEditor: React.FC<FreeformCustomProfileEditorProps> = ({
  geometry,
  settings,
  savedGeometries,
  initialTab = 'common_variants',
  onApplyGeometry,
  onSaveToGeometryLibrary,
  onDeleteSavedGeometry,
  onBack,
}) => {
  // Normalize initial tab so custom shapes open directly onto the Quick Sketch Solver
  const [mainTab, setMainTab] = useState<'sketch_solver' | 'common_variants' | 'freeform_canvas' | 'dxf_import'>(
    () => {
      if (initialTab === 'dxf_import') return 'dxf_import';
      if (initialTab === 'common_variants') return 'common_variants';
      if (initialTab === 'freeform_canvas') return 'freeform_canvas';
      return 'sketch_solver';
    }
  );

  // ============================================================================
  // MODE 1: COMMON TUNNEL VARIANTS STATE (SUPPORTS INDEPENDENT LEFT / RIGHT WALLS)
  // ============================================================================
  const isInitialTopHeading =
    geometry.excavationStage === 'TOP_HEADING' || geometry.excavationStage === 'top_heading';
  const initFullH =
    geometry.fullSectionHeightMeters ||
    geometry.fullSectionTotalHeightMeters ||
    (isInitialTopHeading && geometry.benchHeightRemovedMeters
      ? Number((geometry.height + geometry.benchHeightRemovedMeters).toFixed(2))
      : geometry.height || 7.2);
  const initFullLeftWallH =
    geometry.fullSectionWallHeightMeters ||
    (isInitialTopHeading && geometry.benchHeightRemovedMeters
      ? Number(
          (
            (geometry.leftWallHeight ?? geometry.wallHeight ?? 1.7) +
            (geometry.leftBenchHeightMeters ?? geometry.benchHeightRemovedMeters)
          ).toFixed(2)
        )
      : geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2);
  const initFullRightWallH =
    geometry.fullSectionRightWallHeightMeters ||
    (isInitialTopHeading && geometry.benchHeightRemovedMeters
      ? Number(
          (
            (geometry.rightWallHeight ?? geometry.wallHeight ?? 1.7) +
            (geometry.rightBenchHeightMeters ?? geometry.benchHeightRemovedMeters)
          ).toFixed(2)
        )
      : geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2);

  const [variantType, setVariantType] = useState<ProfileType>(
    geometry.crownGeometry === 'top_heading' ? 'd_shaped' : geometry.crownGeometry || 'd_shaped'
  );
  const [varWidth, setVarWidth] = useState<string>(String(geometry.width || 8.4));
  const [varHeight, setVarHeight] = useState<string>(String(initFullH));
  const [varWallHeight, setVarWallHeight] = useState<string>(String(initFullLeftWallH));
  const [varRightWallHeight, setVarRightWallHeight] = useState<string>(String(initFullRightWallH));
  const [varCrownRadius, setVarCrownRadius] = useState<string>(
    String(geometry.crownRadius || 4.35)
  );
  const [variantShapeName, setVariantShapeName] = useState<string>(
    geometry.profileName ||
      `${settings.locationName || 'Heading'} - ${(geometry.crownGeometry || 'd_shaped')
        .replace(/_/g, ' ')
        .toUpperCase()}`
  );

  // Step 3 (After choosing Tunnel Shape & Size): Full Face vs Top Heading & Benching Details
  const [excavationStageMode, setExcavationStageMode] = useState<'FULL_FACE' | 'TOP_HEADING'>(
    isInitialTopHeading ? 'TOP_HEADING' : 'FULL_FACE'
  );
  const [benchHeightInput, setBenchHeightInput] = useState<string>(() =>
    String(
      geometry.benchHeightRemovedMeters && geometry.benchHeightRemovedMeters > 0.1
        ? geometry.benchHeightRemovedMeters
        : Number(Math.max(1.0, initFullLeftWallH * 0.6).toFixed(2))
    )
  );
  const [leftBenchHeightInput, setLeftBenchHeightInput] = useState<string>(() =>
    String(
      geometry.leftBenchHeightMeters ??
        (geometry.benchHeightRemovedMeters && geometry.benchHeightRemovedMeters > 0.1
          ? geometry.benchHeightRemovedMeters
          : Number(Math.max(1.0, initFullLeftWallH * 0.6).toFixed(2)))
    )
  );
  const [rightBenchHeightInput, setRightBenchHeightInput] = useState<string>(() =>
    String(
      geometry.rightBenchHeightMeters ??
        (geometry.benchHeightRemovedMeters && geometry.benchHeightRemovedMeters > 0.1
          ? geometry.benchHeightRemovedMeters
          : Number(Math.max(1.0, initFullRightWallH * 0.6).toFixed(2)))
    )
  );

  const fullVariantBaseGeometry = useMemo(() => {
    const w = Math.max(1.5, parseFloat(varWidth) || 8.4);
    const h = Math.max(1.5, parseFloat(varHeight) || 7.2);
    const leftWh = Math.min(h - 0.1, Math.max(0.5, parseFloat(varWallHeight) || 4.2));
    const rightWh = Math.min(h - 0.1, Math.max(0.5, parseFloat(varRightWallHeight) || leftWh));
    const cr = Math.max(1.0, parseFloat(varCrownRadius) || w / 2);
    const base = createTunnelGeometry(w, h, Math.max(leftWh, rightWh), variantType, cr, 'manual');
    return {
      ...base,
      leftWallHeight: leftWh,
      rightWallHeight: rightWh,
      leftWallArcLength: leftWh,
      rightWallArcLength: rightWh,
      hasCrown: true,
      hasLeftWall: true,
      hasRightWall: true,
      excavationStage: 'FULL_FACE' as const,
      fullSectionHeightMeters: h,
      fullSectionWallHeightMeters: leftWh,
      fullSectionRightWallHeightMeters: rightWh,
      fullSectionCrossSectionPoints: base.crossSectionPoints,
      profileName: variantShapeName,
    };
  }, [varWidth, varHeight, varWallHeight, varRightWallHeight, varCrownRadius, variantType, variantShapeName]);

  const previewVariantGeometry = useMemo(() => {
    if (excavationStageMode === 'TOP_HEADING') {
      const bH = Math.max(0.2, parseFloat(benchHeightInput) || 2.5);
      const lBH = Math.max(0.2, parseFloat(leftBenchHeightInput) || bH);
      const rBH = Math.max(0.2, parseFloat(rightBenchHeightInput) || bH);
      return convertTunnelGeometryToSequentialTopHeading(fullVariantBaseGeometry, {
        benchHeightMeters: bH,
        leftBenchHeightMeters: lBH,
        rightBenchHeightMeters: rBH,
      });
    }
    return fullVariantBaseGeometry;
  }, [
    fullVariantBaseGeometry,
    excavationStageMode,
    benchHeightInput,
    leftBenchHeightInput,
    rightBenchHeightInput,
  ]);

  // ============================================================================
  // MODE 2: CUSTOM SHAPE (LOADS CURRENT TUNNEL SHAPE WHEN EDITING, OR CLEAR TO DRAW FRESH)
  // ============================================================================
  const [profile, setProfile] = useState<CustomTunnelProfileDefinition>(() =>
    deriveEditableCustomProfileFromGeometry(
      geometry,
      `${settings.locationName || 'Custom'} Tunnel Shape`
    )
  );

  const [subMode, setSubMode] = useState<CustomShapeSubMode>(() =>
    geometry.customProfile && geometry.customProfile.controlPoints.length >= 3
      ? 'SELECT_EDIT'
      : 'LINE'
  );
  const [showPropertySidebar, setShowPropertySidebar] = useState<boolean>(true);
  // Controls whether the canvas is actively waiting for the next point on a rubber-band line
  const [isDrawingChainActive, setIsDrawingChainActive] = useState<boolean>(() => {
    const initProf = deriveEditableCustomProfileFromGeometry(geometry);
    return !initProf.isClosed;
  });
  const [cursorPreviewPt, setCursorPreviewPt] = useState<Point2D | null>(null);
  const [cursorHoverPt, setCursorHoverPt] = useState<Point2D | null>(null);
  // Default to 0.01m (exact cursor tip) so clicked points and lines match the cursor 1:1
  const [snapStepMeters, setSnapStepMeters] = useState<number>(0.01);
  const [visualSnapEnabled, setVisualSnapEnabled] = useState<boolean>(true);
  const [activeVisualSnap, setActiveVisualSnap] = useState<{
    snappedPt: Point2D;
    kind: 'ENDPOINT' | 'ORIGIN' | 'AXIS_OR_ORTHO';
    label: string;
    verticalGuideX?: number;
    verticalRefPt?: Point2D;
    horizontalGuideY?: number;
    horizontalRefPt?: Point2D;
    isCloseLoopTarget?: boolean;
  } | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingArcSegId, setDraggingArcSegId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    'Loaded active tunnel shape. Drag points/arcs, customize Left/Right Wall & Crown portions on the right, or click Clear Empty to draw from scratch.'
  );

  // Line Mode numeric inputs (Start X1,Y1 -> Length & Angle OR End X2,Y2)
  const [lineStartX, setLineStartX] = useState<string>('-4.20');
  const [lineStartY, setLineStartY] = useState<string>('0.00');
  const [lineInputMethod, setLineInputMethod] = useState<'LENGTH_ANGLE' | 'END_XY'>('LENGTH_ANGLE');
  const [lineLengthM, setLineLengthM] = useState<string>('4.20');
  const [lineAngleDeg, setLineAngleDeg] = useState<string>('90');
  const [lineEndX, setLineEndX] = useState<string>('-4.20');
  const [lineEndY, setLineEndY] = useState<string>('4.20');

  // Arc Mode numeric inputs (Start Point -> Arc Length -> End Point)
  const [arcStartX, setArcStartX] = useState<string>('-4.20');
  const [arcStartY, setArcStartY] = useState<string>('4.20');
  const [arcEndX, setArcEndX] = useState<string>('4.20');
  const [arcEndY, setArcEndY] = useState<string>('4.20');
  const [arcLengthM, setArcLengthM] = useState<string>('10.80');
  const [arcDirectionOutward, setArcDirectionOutward] = useState<boolean>(true);
  // Track 2-click canvas Arc creation: 1st click = Start Point, 2nd click = End Point
  const [pendingCanvasArcStartPt, setPendingCanvasArcStartPt] = useState<Point2D | null>(null);

  // XY Point Mode numeric inputs
  const [xyInputX, setXyInputX] = useState<string>('0.00');
  const [xyInputY, setXyInputY] = useState<string>('0.00');

  // Quick 1-Click Parametric Custom Shape Builder inputs
  const [quickSpanW, setQuickSpanW] = useState<string>('8.00');
  const [quickLeftWallH, setQuickLeftWallH] = useState<string>('3.00');
  const [quickRightWallH, setQuickRightWallH] = useState<string>('3.00');
  const [quickCrownRiseH, setQuickCrownRiseH] = useState<string>('4.00');
  const [quickCrownStyle, setQuickCrownStyle] = useState<'arch' | 'flat' | 'sloped'>('arch');
  const [showQuickParametricBuilder, setShowQuickParametricBuilder] = useState<boolean>(false);

  const handleGenerateQuickParametricCustomShape = () => {
    const w = Math.max(1.0, parseFloat(quickSpanW) || 8.0);
    const halfW = Number((w / 2).toFixed(2));
    const lwH = Math.max(0.0, parseFloat(quickLeftWallH) ?? 3.0);
    const rwH = Math.max(0.0, parseFloat(quickRightWallH) ?? 3.0);
    const riseH = Math.max(0.0, parseFloat(quickCrownRiseH) ?? 4.0);

    const pts: ProfileControlPoint[] = [
      { id: 'P1', label: 'P1', x: -halfW, y: 0, role: 'invert_corner' },
      { id: 'P2', label: 'P2', x: -halfW, y: Number(lwH.toFixed(2)), role: 'arch_shoulder' },
      { id: 'P3', label: 'P3', x: halfW, y: Number(rwH.toFixed(2)), role: 'arch_shoulder' },
      { id: 'P4', label: 'P4', x: halfW, y: 0, role: 'invert_corner' },
    ];

    const chord = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
    const arcBulge =
      quickCrownStyle === 'arch' && chord > 0.1 && riseH > 0.05
        ? Math.max(0.08, Math.min(1.25, (2 * riseH) / chord))
        : 0.35;

    const segs: ProfileSegment[] = [
      {
        id: 'S1',
        fromPointId: 'P1',
        toPointId: 'P2',
        type: 'line',
        zoneRole: 'leftWall',
        includeInTopStrip: true,
      },
      {
        id: 'S2',
        fromPointId: 'P2',
        toPointId: 'P3',
        type: quickCrownStyle === 'arch' && riseH > 0.05 ? 'arc' : 'line',
        arcBulge: quickCrownStyle === 'arch' && riseH > 0.05 ? arcBulge : undefined,
        arcConvexOutward: true,
        zoneRole: quickCrownStyle === 'flat' && riseH === 0 ? 'crown' : 'crown',
        includeInTopStrip: true,
      },
      {
        id: 'S3',
        fromPointId: 'P3',
        toPointId: 'P4',
        type: 'line',
        zoneRole: 'rightWall',
        includeInTopStrip: true,
      },
      {
        id: 'S4',
        fromPointId: 'P4',
        toPointId: 'P1',
        type: 'line',
        zoneRole: 'invert',
        includeInTopStrip: false,
      },
    ];

    setProfile((prev) => ({
      ...prev,
      name: `${w.toFixed(2)}m W × ${(Math.max(lwH, rwH) + (quickCrownStyle === 'arch' ? riseH : 0)).toFixed(2)}m H Custom Profile`,
      category: 'freeform_polygon',
      controlPoints: pts,
      segments: segs,
      isClosed: true,
      surfaceConfig: {
        hasLeftWall: lwH > 0.05,
        hasRightWall: rwH > 0.05,
        hasCrown: true,
        excavationStage: 'FULL_FACE',
      },
      updatedAt: new Date().toISOString(),
    }));
    setIsDrawingChainActive(false);
    setCursorPreviewPt(null);
    setSelectedSegmentId('S2');
    setStatusNote(
      `Generated ${w.toFixed(2)}m W custom profile (L-Wall ${lwH.toFixed(2)}m, R-Wall ${rwH.toFixed(2)}m, Crown Rise ${riseH.toFixed(2)}m).`
    );
  };

  // Update a selected straight line or arc segment to an exact target length (m)
  const handleSetSelectedSegmentExactLength = (segId: string, targetLengthM: number) => {
    if (Number.isNaN(targetLengthM) || targetLengthM < 0.1) return;
    const metric = evaluatedCustom.segmentMetrics.find((m) => m.segmentId === segId);
    if (!metric) return;

    if (metric.type === 'arc') {
      const nextBulge = computeBulgeFromArcLength(
        metric.chordLength,
        Math.max(metric.chordLength * 1.005, targetLengthM),
        (metric.bulge ?? 0.35) >= 0 ? 1 : -1
      );
      setProfile((prev) => ({
        ...prev,
        segments: prev.segments.map((s) =>
          s.id === segId ? { ...s, type: 'arc', arcBulge: nextBulge } : s
        ),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    // Straight line segment: move `toPoint` along the segment direction vector so length === targetLengthM
    const dx = metric.toPoint.x - metric.fromPoint.x;
    const dy = metric.toPoint.y - metric.fromPoint.y;
    const curLen = Math.hypot(dx, dy);
    const ux = curLen > 1e-4 ? dx / curLen : 0;
    const uy = curLen > 1e-4 ? dy / curLen : 1;
    const nextToX = Number((metric.fromPoint.x + ux * targetLengthM).toFixed(2));
    const nextToY = Number((metric.fromPoint.y + uy * targetLengthM).toFixed(2));

    setProfile((prev) => ({
      ...prev,
      controlPoints: prev.controlPoints.map((cp) =>
        cp.id === metric.toPoint.id ? { ...cp, x: nextToX, y: nextToY } : cp
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // ============================================================================
  // MODE 3: DWG / DXF IMPORT STATE
  // ============================================================================
  const dxfFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dxfImportedGeometry, setDxfImportedGeometry] = useState<TunnelGeometry | null>(null);
  const [dxfStatusMessage, setDxfStatusMessage] = useState<string>('');

  // Keep Line and Arc start coordinates synced with the last point in `profile.controlPoints`
  useEffect(() => {
    const pts = profile.controlPoints;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      setLineStartX(last.x.toFixed(2));
      setLineStartY(last.y.toFixed(2));
      setArcStartX(last.x.toFixed(2));
      setArcStartY(last.y.toFixed(2));
    }
  }, [profile.controlPoints]);

  // Whenever the user switches sub-modes or main tabs, stop any dangling rubber-band line!
  const handleSelectSubMode = (nextMode: CustomShapeSubMode) => {
    setSubMode(nextMode);
    setCursorPreviewPt(null);
    setPendingCanvasArcStartPt(null);
    if (nextMode === 'LINE') {
      setIsDrawingChainActive(!profile.isClosed);
      setSelectedSegmentId(null);
    } else if (nextMode === 'ARC') {
      setIsDrawingChainActive(false);
      setSelectedPointId(null);
    } else if (nextMode === 'XY_POINT') {
      setIsDrawingChainActive(false);
      setSelectedSegmentId(null);
    } else {
      setIsDrawingChainActive(false);
    }
  };

  // Stop line dragging on Escape or Enter
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        setIsDrawingChainActive(false);
        setCursorPreviewPt(null);
        setPendingCanvasArcStartPt(null);
        setStatusNote('Stopped active line preview. Click Close Shape when ready.');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const evaluatedCustom = useMemo(() => evaluateCustomProfileGeometry(profile), [profile]);

  const builtCustomGeometry = useMemo(
    () =>
      buildAuthoritativeCustomTunnelGeometry(profile, {
        source: profile.category === 'dxf_import' ? 'dxf' : 'custom_profile',
      }),
    [profile]
  );

  // ============================================================================
  // SVG CANVAS COORDINATE SYSTEM (STRICT 1:1 METER SCALE & EXACT CURSOR CTM)
  // ============================================================================
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgViewportSize, setSvgViewportSize] = useState<{ width: number; height: number }>({
    width: 820,
    height: 540,
  });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setSvgViewportSize((prev) => {
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          return prev.width === w && prev.height === h ? prev : { width: w, height: h };
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [mainTab]);

  const viewW = svgViewportSize.width;
  const viewH = svgViewportSize.height;

  const canvasMetrics = useMemo(() => {
    // Fixed, rock-solid engineering world bounds so clicking or dragging a point NEVER shifts the grid underneath the cursor!
    const minX = -6.5;
    const maxX = 6.5;
    const minY = -1.0;
    const maxY = 9.0;

    const spanW = maxX - minX; // 13.0m
    const spanH = maxY - minY; // 10.0m
    const padPx = 36;
    const pxPerMeter = Math.min(
      Math.max(12, (viewW - padPx * 2) / spanW),
      Math.max(12, (viewH - padPx * 2) / spanH)
    );

    const centerWorldX = (minX + maxX) / 2; // 0.0m
    const centerWorldY = (minY + maxY) / 2; // 4.0m

    const worldToScreen = (pt: Point2D): { cx: number; cy: number } => ({
      cx: Number((viewW / 2 + (pt.x - centerWorldX) * pxPerMeter).toFixed(2)),
      cy: Number((viewH / 2 - (pt.y - centerWorldY) * pxPerMeter).toFixed(2)),
    });

    const screenToWorld = (clientX: number, clientY: number): Point2D => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      let sx = 0;
      let sy = 0;

      // Use authoritative browser SVG CTM inverse so viewBox, preserveAspectRatio, and CSS scaling match 1:1
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const transformed = pt.matrixTransform(ctm.inverse());
        sx = transformed.x;
        sy = transformed.y;
      } else {
        const rect = svg.getBoundingClientRect();
        const scaleFactor = Math.min(
          Math.max(1, rect.width) / viewW,
          Math.max(1, rect.height) / viewH
        );
        const offsetX = (rect.width - viewW * scaleFactor) / 2;
        const offsetY = (rect.height - viewH * scaleFactor) / 2;
        sx = (clientX - rect.left - offsetX) / scaleFactor;
        sy = (clientY - rect.top - offsetY) / scaleFactor;
      }

      const rawX = centerWorldX + (sx - viewW / 2) / pxPerMeter;
      const rawY = centerWorldY - (sy - viewH / 2) / pxPerMeter;
      const step = snapStepMeters > 0 ? snapStepMeters : 0.01;
      return {
        x: Number((Math.round(rawX / step) * step).toFixed(2)),
        y: Number((Math.round(rawY / step) * step).toFixed(2)),
      };
    };

    return {
      minX,
      maxX,
      minY,
      maxY,
      pxPerMeter,
      worldToScreen,
      screenToWorld,
    };
  }, [viewW, viewH, snapStepMeters]);

  // ============================================================================
  // VISUAL SNAPPING ENGINE (ENDPOINTS, X=0 / Y=0 AXES, ORTHO & SYMMETRY GUIDES)
  // ============================================================================
  const evaluateVisualSnap = (
    rawPt: Point2D,
    ignorePointId?: string | null
  ): {
    pt: Point2D;
    snapInfo: {
      snappedPt: Point2D;
      kind: 'ENDPOINT' | 'ORIGIN' | 'AXIS_OR_ORTHO';
      label: string;
      verticalGuideX?: number;
      verticalRefPt?: Point2D;
      horizontalGuideY?: number;
      horizontalRefPt?: Point2D;
      isCloseLoopTarget?: boolean;
    } | null;
  } => {
    if (!visualSnapEnabled) {
      return { pt: rawPt, snapInfo: null };
    }

    const pts = profile.controlPoints.filter((p) => p.id !== ignorePointId);
    const endpointTolM = 0.28;
    const axisTolM = 0.18;
    const orthoTolM = 0.16;

    // 1. Check Endpoint Snap (Highest Priority — especially P1 Close Loop or any vertex)
    let bestEp: { cp: ProfileControlPoint; dist: number; isFirst: boolean } | null = null;
    for (let i = 0; i < pts.length; i++) {
      const cp = pts[i];
      const d = Math.hypot(rawPt.x - cp.x, rawPt.y - cp.y);
      if (d <= endpointTolM && (!bestEp || d < bestEp.dist)) {
        bestEp = {
          cp,
          dist: d,
          isFirst:
            profile.controlPoints.length >= 3 &&
            !profile.isClosed &&
            cp.id === profile.controlPoints[0].id,
        };
      }
    }

    if (bestEp) {
      const snapped = { x: bestEp.cp.x, y: bestEp.cp.y };
      return {
        pt: snapped,
        snapInfo: {
          snappedPt: snapped,
          kind: 'ENDPOINT',
          label: bestEp.isFirst
            ? `ENDPOINT ${bestEp.cp.label} (CLOSE SHAPE)`
            : `ENDPOINT ${bestEp.cp.label} (${snapped.x.toFixed(2)}m, ${snapped.y.toFixed(2)}m)`,
          verticalGuideX: snapped.x,
          horizontalGuideY: snapped.y,
          isCloseLoopTarget: bestEp.isFirst,
        },
      };
    }

    // 2. Check Origin (0.00m, 0.00m) Intersection Snap
    if (Math.hypot(rawPt.x, rawPt.y) <= 0.22) {
      const snapped = { x: 0, y: 0 };
      return {
        pt: snapped,
        snapInfo: {
          snappedPt: snapped,
          kind: 'ORIGIN',
          label: 'ORIGIN (X=0.00m, Y=0.00m)',
          verticalGuideX: 0,
          horizontalGuideY: 0,
        },
      };
    }

    // 3. Check Independent X (Centerline / Vertical Ortho / Symmetry) & Y (Invert / Horizontal Ortho) Snaps
    let snappedX = rawPt.x;
    let snappedY = rawPt.y;
    let verticalGuideX: number | undefined;
    let verticalRefPt: Point2D | undefined;
    let horizontalGuideY: number | undefined;
    let horizontalRefPt: Point2D | undefined;
    const labels: string[] = [];

    // 3A. X-Coordinate Snap: Centerline X=0m, Vertical Alignment with existing point, or Mirror Symmetry (-cp.x)
    if (Math.abs(rawPt.x) <= axisTolM) {
      snappedX = 0;
      verticalGuideX = 0;
      labels.push('CENTERLINE X=0m');
    } else {
      let bestVert: { x: number; dist: number; tag: string; refPt: Point2D } | null = null;
      for (const cp of pts) {
        const dSame = Math.abs(rawPt.x - cp.x);
        if (dSame <= orthoTolM && (!bestVert || dSame < bestVert.dist)) {
          bestVert = {
            x: cp.x,
            dist: dSame,
            tag: `VERT ALIGN ${cp.label} (X=${cp.x.toFixed(2)}m)`,
            refPt: { x: cp.x, y: cp.y },
          };
        }
        // Mirror symmetry across X=0 centerline
        if (Math.abs(cp.x) >= 0.25) {
          const symX = Number((-cp.x).toFixed(2));
          const dSym = Math.abs(rawPt.x - symX);
          if (dSym <= orthoTolM && (!bestVert || dSym < bestVert.dist)) {
            bestVert = {
              x: symX,
              dist: dSym,
              tag: `SYMMETRY ↔ ${cp.label} (X=${symX.toFixed(2)}m)`,
              refPt: { x: cp.x, y: cp.y },
            };
          }
        }
      }
      if (bestVert) {
        snappedX = bestVert.x;
        verticalGuideX = bestVert.x;
        verticalRefPt = bestVert.refPt;
        labels.push(bestVert.tag);
      }
    }

    // 3B. Y-Coordinate Snap: Invert Floor Y=0m or Horizontal Alignment with existing point
    if (Math.abs(rawPt.y) <= axisTolM) {
      snappedY = 0;
      horizontalGuideY = 0;
      labels.push('INVERT AXIS Y=0m');
    } else {
      let bestHoriz: { y: number; dist: number; tag: string; refPt: Point2D } | null = null;
      for (const cp of pts) {
        const dSameY = Math.abs(rawPt.y - cp.y);
        if (dSameY <= orthoTolM && (!bestHoriz || dSameY < bestHoriz.dist)) {
          bestHoriz = {
            y: cp.y,
            dist: dSameY,
            tag: `HORIZ ALIGN ${cp.label} (Y=${cp.y.toFixed(2)}m)`,
            refPt: { x: cp.x, y: cp.y },
          };
        }
      }
      if (bestHoriz) {
        snappedY = bestHoriz.y;
        horizontalGuideY = bestHoriz.y;
        horizontalRefPt = bestHoriz.refPt;
        labels.push(bestHoriz.tag);
      }
    }

    if (labels.length > 0) {
      const finalPt = {
        x: Number(snappedX.toFixed(2)),
        y: Number(snappedY.toFixed(2)),
      };
      return {
        pt: finalPt,
        snapInfo: {
          snappedPt: finalPt,
          kind: 'AXIS_OR_ORTHO',
          label: labels.join(' + '),
          verticalGuideX,
          verticalRefPt,
          horizontalGuideY,
          horizontalRefPt,
        },
      };
    }

    return { pt: rawPt, snapInfo: null };
  };

  // ============================================================================
  // HELPER: APPEND POINT OR SEGMENT TO CUSTOM PROFILE
  // ============================================================================
  const appendLineSegmentPoints = (
    startPt: Point2D,
    endPt: Point2D,
    closeAfter = false
  ) => {
    setProfile((prev) => {
      const pts = [...prev.controlPoints];
      const segs = [...prev.segments];

      // Check if startPt is already the last point
      let fromPoint: ProfileControlPoint;
      if (
        pts.length > 0 &&
        Math.hypot(pts[pts.length - 1].x - startPt.x, pts[pts.length - 1].y - startPt.y) < 0.05
      ) {
        fromPoint = pts[pts.length - 1];
      } else {
        const startId = `P${pts.length + 1}`;
        fromPoint = {
          id: startId,
          label: startId,
          x: Number(startPt.x.toFixed(2)),
          y: Number(startPt.y.toFixed(2)),
          role: 'corner',
        };
        pts.push(fromPoint);
      }

      // Check if endPt closes back onto P1
      if (
        pts.length >= 3 &&
        Math.hypot(pts[0].x - endPt.x, pts[0].y - endPt.y) < 0.28
      ) {
        const closeSeg: ProfileSegment = {
          id: `S-${Date.now()}-close`,
          fromPointId: fromPoint.id,
          toPointId: pts[0].id,
          type: 'line',
        };
        setIsDrawingChainActive(false);
        setCursorPreviewPt(null);
        setStatusNote(`Closed tunnel shape (${pts.length} points). Ready to save & add pictures.`);
        return {
          ...prev,
          controlPoints: pts,
          segments: [...segs, closeSeg],
          isClosed: true,
          updatedAt: new Date().toISOString(),
        };
      }

      const endId = `P${pts.length + 1}`;
      const toPoint: ProfileControlPoint = {
        id: endId,
        label: endId,
        x: Number(endPt.x.toFixed(2)),
        y: Number(endPt.y.toFixed(2)),
        role: 'corner',
      };
      pts.push(toPoint);

      const newSeg: ProfileSegment = {
        id: `S-${Date.now()}-${pts.length}`,
        fromPointId: fromPoint.id,
        toPointId: toPoint.id,
        type: 'line',
      };
      segs.push(newSeg);

      const len = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
      setStatusNote(
        `Connected Line ${fromPoint.label} → ${toPoint.label} (Length = ${len.toFixed(2)} m).`
      );

      return {
        ...prev,
        controlPoints: pts,
        segments: segs,
        isClosed: closeAfter ? true : prev.isClosed,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const appendArcSegmentByLength = (
    startPt: Point2D,
    endPt: Point2D,
    targetArcLenMeters: number,
    outward = true
  ) => {
    const chord = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    if (chord < 0.1) {
      setStatusNote('Arc start and end points must be at least 0.10m apart.');
      return;
    }
    const effectiveArcLen = Math.max(chord * 1.02, targetArcLenMeters);
    const computedBulge = computeBulgeFromArcLength(
      chord,
      effectiveArcLen,
      outward ? 1 : -1
    );

    setProfile((prev) => {
      const pts = [...prev.controlPoints];
      const segs = [...prev.segments];

      let fromPoint: ProfileControlPoint;
      if (
        pts.length > 0 &&
        Math.hypot(pts[pts.length - 1].x - startPt.x, pts[pts.length - 1].y - startPt.y) < 0.05
      ) {
        fromPoint = pts[pts.length - 1];
      } else {
        const startId = `P${pts.length + 1}`;
        fromPoint = {
          id: startId,
          label: startId,
          x: Number(startPt.x.toFixed(2)),
          y: Number(startPt.y.toFixed(2)),
          role: 'arch_shoulder',
        };
        pts.push(fromPoint);
      }

      // Check if endPt is P1 (closing with an arc)
      let toPoint: ProfileControlPoint;
      let shouldClose = prev.isClosed;
      if (
        pts.length >= 2 &&
        Math.hypot(pts[0].x - endPt.x, pts[0].y - endPt.y) < 0.25
      ) {
        toPoint = pts[0];
        shouldClose = true;
      } else {
        const endId = `P${pts.length + 1}`;
        toPoint = {
          id: endId,
          label: endId,
          x: Number(endPt.x.toFixed(2)),
          y: Number(endPt.y.toFixed(2)),
          role: 'arch_shoulder',
        };
        pts.push(toPoint);
      }

      const arcSeg: ProfileSegment = {
        id: `S-arc-${Date.now()}`,
        fromPointId: fromPoint.id,
        toPointId: toPoint.id,
        type: 'arc',
        arcBulge: computedBulge,
        arcConvexOutward: outward,
      };

      setIsDrawingChainActive(false);
      setCursorPreviewPt(null);
      setPendingCanvasArcStartPt(null);
      setSelectedSegmentId(arcSeg.id);
      setStatusNote(
        `Created Arc ${fromPoint.label} → ${toPoint.label} (Chord = ${chord.toFixed(
          2
        )} m, Arc Length = ${effectiveArcLen.toFixed(2)} m).`
      );

      return {
        ...prev,
        controlPoints: pts,
        segments: [...segs, arcSeg],
        isClosed: shouldClose,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleCloseShapeNow = () => {
    if (profile.controlPoints.length < 3) {
      setStatusNote('Need at least 3 points to close a tunnel shape.');
      return;
    }
    setProfile((prev) => {
      const pts = prev.controlPoints;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const hasClosingSeg = prev.segments.some(
        (s) => s.fromPointId === last.id && s.toPointId === first.id
      );
      const nextSegs = hasClosingSeg
        ? prev.segments
        : [
            ...prev.segments,
            {
              id: `S-close-${Date.now()}`,
              fromPointId: last.id,
              toPointId: first.id,
              type: 'line' as CustomSegmentType,
            },
          ];
      return {
        ...prev,
        segments: nextSegs,
        isClosed: true,
        updatedAt: new Date().toISOString(),
      };
    });
    // CRITICAL: Immediately stop any rubber-band line from dragging!
    setIsDrawingChainActive(false);
    setCursorPreviewPt(null);
    setPendingCanvasArcStartPt(null);
    setStatusNote('Tunnel shape closed! Rubber-band line stopped. Ready to save & add pictures.');
  };

  // ============================================================================
  // CANVAS POINTER HANDLERS (WITH ZERO ANNOYING DRAG AFTER CLOSE)
  // ============================================================================
  const handleCanvasPointerDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 2) {
      // Right-click stops line chain immediately
      e.preventDefault();
      setIsDrawingChainActive(false);
      setCursorPreviewPt(null);
      setPendingCanvasArcStartPt(null);
      return;
    }

    const rawPt = canvasMetrics.screenToWorld(e.clientX, e.clientY);
    const { pt, snapInfo } = evaluateVisualSnap(rawPt, null);
    setActiveVisualSnap(snapInfo);
    const pts = profile.controlPoints;

    // 1. Check if user clicked an Arc Midpoint Handle to adjust arc curve interactively
    for (const segMetric of evaluatedCustom.segmentMetrics) {
      if (segMetric.type === 'arc') {
        const dMid = Math.hypot(
          segMetric.midHandlePoint.x - pt.x,
          segMetric.midHandlePoint.y - pt.y
        );
        if (dMid <= 0.35) {
          setSelectedSegmentId(segMetric.segmentId);
          setDraggingArcSegId(segMetric.segmentId);
          return;
        }
      }
    }

    // 2. Check if user clicked First Point P1 while drawing a chain -> CLOSE SHAPE & STOP LINE!
    if (
      subMode === 'LINE' &&
      isDrawingChainActive &&
      !profile.isClosed &&
      pts.length >= 3
    ) {
      const distToFirst = Math.hypot(pts[0].x - pt.x, pts[0].y - pt.y);
      if (distToFirst <= 0.38) {
        handleCloseShapeNow();
        return;
      }
    }

    // 3. Check if user clicked an existing vertex to select or drag it
    const hitPoint = pts.find((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= 0.32);
    if (hitPoint && (subMode === 'SELECT_EDIT' || profile.isClosed || !isDrawingChainActive)) {
      setSelectedPointId(hitPoint.id);
      setDraggingPointId(hitPoint.id);
      return;
    }

    // 4. Mode-specific canvas click behavior
    if (subMode === 'LINE') {
      if (profile.isClosed) {
        // Shape is already closed -> do NOT add random points or drag lines unless reopened
        return;
      }
      if (!isDrawingChainActive) {
        setIsDrawingChainActive(true);
      }
      if (pts.length === 0) {
        const firstCp: ProfileControlPoint = {
          id: 'P1',
          label: 'P1',
          x: pt.x,
          y: pt.y,
          role: 'invert_corner',
        };
        setProfile((prev) => ({
          ...prev,
          controlPoints: [firstCp],
          segments: [],
          isClosed: false,
        }));
        setSelectedPointId('P1');
        setStatusNote(
          `Placed Start Point P1 (${pt.x.toFixed(2)}m, ${pt.y.toFixed(
            2
          )}m). Click next point or enter Length (m) on the right.`
        );
      } else {
        const lastPt = pts[pts.length - 1];
        appendLineSegmentPoints(lastPt, pt, false);
      }
      return;
    }

    if (subMode === 'ARC') {
      if (!pendingCanvasArcStartPt) {
        // If there is already a last point in the chain, use it or start from clicked point
        const startPt =
          pts.length > 0 ? { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y } : pt;
        if (pts.length === 0) {
          setPendingCanvasArcStartPt(pt);
          setArcStartX(pt.x.toFixed(2));
          setArcStartY(pt.y.toFixed(2));
          setStatusNote(
            `Arc Start Point set at (${pt.x.toFixed(2)}m, ${pt.y.toFixed(
              2
            )}m). Now click the Arc End Point on the canvas.`
          );
        } else {
          // Connect from last point to clicked End Point with an Arc!
          const chord = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
          const defaultArcLen = Number((chord * 1.22).toFixed(2));
          setArcEndX(pt.x.toFixed(2));
          setArcEndY(pt.y.toFixed(2));
          setArcLengthM(String(defaultArcLen));
          appendArcSegmentByLength(startPt, pt, defaultArcLen, arcDirectionOutward);
        }
      } else {
        // 2nd click in Arc mode -> End point!
        const startPt = pendingCanvasArcStartPt;
        const chord = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
        const defaultArcLen = Number((chord * 1.22).toFixed(2));
        setArcEndX(pt.x.toFixed(2));
        setArcEndY(pt.y.toFixed(2));
        setArcLengthM(String(defaultArcLen));
        appendArcSegmentByLength(startPt, pt, defaultArcLen, arcDirectionOutward);
      }
      return;
    }

    if (subMode === 'XY_POINT') {
      setXyInputX(pt.x.toFixed(2));
      setXyInputY(pt.y.toFixed(2));
      if (!profile.isClosed) {
        const nextId = `P${pts.length + 1}`;
        const nextPt: ProfileControlPoint = {
          id: nextId,
          label: nextId,
          x: pt.x,
          y: pt.y,
          role: 'corner',
        };
        setProfile((prev) => {
          const prevPts = prev.controlPoints;
          const prevSegs = prev.segments;
          const newSegs =
            prevPts.length > 0
              ? [
                  ...prevSegs,
                  {
                    id: `S-${Date.now()}`,
                    fromPointId: prevPts[prevPts.length - 1].id,
                    toPointId: nextId,
                    type: 'line' as CustomSegmentType,
                  },
                ]
              : prevSegs;
          return {
            ...prev,
            controlPoints: [...prevPts, nextPt],
            segments: newSegs,
          };
        });
      }
    }
  };

  const handleCanvasPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rawPt = canvasMetrics.screenToWorld(e.clientX, e.clientY);
    const { pt, snapInfo } = evaluateVisualSnap(rawPt, draggingPointId);
    setActiveVisualSnap(snapInfo);
    setCursorHoverPt(pt);

    if (draggingPointId) {
      setProfile((prev) => ({
        ...prev,
        controlPoints: prev.controlPoints.map((cp) =>
          cp.id === draggingPointId ? { ...cp, x: pt.x, y: pt.y } : cp
        ),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (draggingArcSegId) {
      const segMetric = evaluatedCustom.segmentMetrics.find(
        (m) => m.segmentId === draggingArcSegId
      );
      if (segMetric) {
        const nextBulge = computeBulgeFromMidpointHandle(
          segMetric.fromPoint,
          segMetric.toPoint,
          pt
        );
        setProfile((prev) => ({
          ...prev,
          segments: prev.segments.map((s) =>
            s.id === draggingArcSegId
              ? { ...s, type: 'arc', arcBulge: nextBulge, arcRadiusMeters: undefined }
              : s
          ),
          updatedAt: new Date().toISOString(),
        }));
      }
      return;
    }

    // ONLY update rubber-band preview when actively drawing an unclosed chain!
    if (
      !profile.isClosed &&
      ((subMode === 'LINE' && isDrawingChainActive && profile.controlPoints.length > 0) ||
        (subMode === 'ARC' && (pendingCanvasArcStartPt !== null || profile.controlPoints.length > 0)))
    ) {
      setCursorPreviewPt(pt);
    } else if (cursorPreviewPt !== null) {
      setCursorPreviewPt(null);
    }
  };

  const handleCanvasPointerUp = () => {
    setDraggingPointId(null);
    setDraggingArcSegId(null);
  };

  const handleCanvasPointerLeave = () => {
    setCursorHoverPt(null);
    setActiveVisualSnap(null);
    setDraggingPointId(null);
    setDraggingArcSegId(null);
  };

  // ============================================================================
  // DWG / DXF UPLOAD HANDLER
  // ============================================================================
  const handleUploadCadFile = async (file: File) => {
    setDxfStatusMessage(`Reading ${file.name}...`);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.dxf')) {
        const text = await file.text();
        const parsed = parseDXFStringToGeometry(text, file.name);
        setDxfImportedGeometry(parsed);
        if (parsed.customProfile) {
          setProfile(parsed.customProfile);
        }
        setDxfStatusMessage(
          `Loaded ${file.name}: Width ${parsed.width.toFixed(2)}m × Height ${parsed.height.toFixed(
            2
          )}m (Wall ${parsed.wallHeight.toFixed(2)}m)`
        );
        return;
      }

      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < Math.min(bytes.byteLength, 250000); i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const contentBase64 = btoa(binary);
      const res = await fetch('/api/geometry/parse-cad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getEswaApiSecurityHeaders(),
        },
        body: JSON.stringify({ fileName: file.name, contentBase64 }),
      });
      if (!res.ok) throw new Error('CAD conversion failed');
      const data = await res.json();
      if (data.format === 'dxf' && data.dxfText) {
        const parsed = parseDXFStringToGeometry(data.dxfText, file.name);
        setDxfImportedGeometry(parsed);
        if (parsed.customProfile) setProfile(parsed.customProfile);
        setDxfStatusMessage(
          `Loaded ${file.name}: ${parsed.width.toFixed(2)}m W × ${parsed.height.toFixed(2)}m H`
        );
      } else {
        const converted = createTunnelGeometry(
          data.width || 8.4,
          data.height || 7.2,
          data.wallHeight || 4.2,
          'd_shaped',
          (data.width || 8.4) / 2,
          'dwg',
          file.name
        );
        setDxfImportedGeometry(converted);
        setDxfStatusMessage(
          `Loaded DWG (${file.name}): ${converted.width.toFixed(2)}m W × ${converted.height.toFixed(
            2
          )}m H`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to parse CAD file';
      setDxfStatusMessage(`Error: ${msg}`);
    }
  };

  // ============================================================================
  // SAVE & PROCEED TO ADD PICTURES
  // ============================================================================
  const handleConfirmAndGoToPhotos = () => {
    if (mainTab === 'common_variants') {
      const saveName =
        variantShapeName.trim() ||
        `${settings.locationName || 'Tunnel'} (${previewVariantGeometry.width}m×${
          previewVariantGeometry.height
        }m)`;
      onSaveToGeometryLibrary(saveName, previewVariantGeometry);
      onApplyGeometry(previewVariantGeometry, true);
      return;
    }

    if (mainTab === 'dxf_import') {
      const baseCadGeom = dxfImportedGeometry || previewVariantGeometry;
      const targetGeom =
        excavationStageMode === 'TOP_HEADING'
          ? convertTunnelGeometryToSequentialTopHeading(baseCadGeom, {
              benchHeightMeters: Math.max(0.2, parseFloat(benchHeightInput) || 2.5),
              leftBenchHeightMeters: Math.max(
                0.2,
                parseFloat(leftBenchHeightInput) || parseFloat(benchHeightInput) || 2.5
              ),
              rightBenchHeightMeters: Math.max(
                0.2,
                parseFloat(rightBenchHeightInput) || parseFloat(benchHeightInput) || 2.5
              ),
            })
          : baseCadGeom;
      const saveName =
        targetGeom.profileName ||
        targetGeom.cadFileName ||
        `${settings.locationName || 'Tunnel'} CAD (${targetGeom.width}m×${targetGeom.height}m)`;
      onSaveToGeometryLibrary(saveName, targetGeom);
      onApplyGeometry(targetGeom, true);
      return;
    }

    // Custom Shape mode (supports both closed and open/unclosed custom tunnel shapes!)
    if (profile.controlPoints.length < 2) {
      setStatusNote('Please create at least 2 points to form a valid tunnel shape before continuing.');
      return;
    }
    const savedProfile: CustomTunnelProfileDefinition = {
      ...profile,
      isClosed: Boolean(profile.isClosed),
      updatedAt: new Date().toISOString(),
    };
    const finalCustomGeom = buildAuthoritativeCustomTunnelGeometry(savedProfile, {
      source: 'custom_profile',
    });
    const saveName =
      savedProfile.name.trim() ||
      `${settings.locationName || 'Custom'} (${finalCustomGeom.width}m×${finalCustomGeom.height}m)`;
    onSaveToGeometryLibrary(saveName, finalCustomGeom);
    onApplyGeometry(finalCustomGeom, true);
  };

  const selectedSegment = useMemo(
    () => profile.segments.find((s) => s.id === selectedSegmentId) || null,
    [profile.segments, selectedSegmentId]
  );
  const selectedSegmentMetrics = useMemo(
    () => evaluatedCustom.segmentMetrics.find((m) => m.segmentId === selectedSegmentId) || null,
    [evaluatedCustom.segmentMetrics, selectedSegmentId]
  );

  return (
    <div
      data-has-canvas={mainTab === 'freeform_canvas' ? 'true' : 'false'}
      className="h-dvh w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none"
    >
      {/* ====================================================================
          TOP HEADER BAR: PROJECT / LOCATION BADGE + 3 SIMPLE SHAPE TABS
         ==================================================================== */}
      <header
        className={`canvas-chrome shrink-0 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs ${
          mainTab === 'freeform_canvas' ? 'px-2.5 py-1' : 'px-4 py-2.5'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono border border-slate-300 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Project &amp; Location
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-sky-700 font-bold">
                STEP 2 · CREATE TUNNEL SHAPE &amp; SIZE
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-800">
                {settings.projectName || 'Project'} · {settings.locationName || settings.tunnelName || 'Location'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Clear Shape Creation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            type="button"
            onClick={() => setMainTab('sketch_solver')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              mainTab === 'sketch_solver'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🎨 1. Quick Sketch &amp; Dimensions</span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('common_variants')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              mainTab === 'common_variants'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Common Variants
          </button>
          <button
            type="button"
            onClick={() => setMainTab('freeform_canvas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              mainTab === 'freeform_canvas'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. CAD Line / Arc / XY
          </button>
          <button
            type="button"
            onClick={() => setMainTab('dxf_import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
              mainTab === 'dxf_import'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Import DWG / DXF
          </button>
        </div>
      </header>

      {/* ====================================================================
          TAB 1: QUICK SKETCH & DIMENSION SOLVER
         ==================================================================== */}
      {mainTab === 'sketch_solver' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <QuickSketchShapeSolver
            initialGeometry={geometry}
            initialWidth={geometry.width || 8.5}
            initialHeight={geometry.height || 7.5}
            tunnelName={settings.locationName || settings.tunnelName || 'Tunnel'}
            onApplyProfile={(profileDef, resolvedGeom) => {
              setProfile(profileDef);
              onApplyGeometry(resolvedGeom);
            }}
            onCancel={onBack}
          />
        </div>
      )}

      {/* ====================================================================
          TAB 2: COMMON TUNNEL VARIANTS (SIMPLE, FAST & ACCURATE)
         ==================================================================== */}
      {mainTab === 'common_variants' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto">
          {/* Left 7 Cols: Variant Cards + Dimension Inputs */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                1. Choose Common Tunnel Variant
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COMMON_TUNNEL_VARIANTS.map((v) => {
                  const active = variantType === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariantType(v.id);
                        setVarWidth(String(v.defaultW));
                        setVarHeight(String(v.defaultH));
                        setVarWallHeight(String(v.defaultWallH));
                        setVarRightWallHeight(String(v.defaultWallH));
                        setVarCrownRadius(String(v.defaultCrownR));
                        setVariantShapeName(
                          `${settings.locationName || 'Heading'} - ${v.label} (${v.defaultW}m×${
                            v.defaultH
                          }m)`
                        );
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{v.label}</span>
                        <span className="text-[11px] font-mono text-cyan-300">
                          {v.defaultW}m × {v.defaultH}m
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{v.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                2. Enter Exact Tunnel Size (1m Engineering Scale)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-300 font-medium">Span Width W (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    value={varWidth}
                    onChange={(e) => {
                      setVarWidth(e.target.value);
                      const w = parseFloat(e.target.value);
                      if (!Number.isNaN(w) && w > 1) {
                        setVarCrownRadius((w / 2).toFixed(2));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300 font-medium">Total Height H (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    value={varHeight}
                    onChange={(e) => setVarHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-emerald-300 font-medium">
                    Left Wall H (m)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={varWallHeight}
                    onChange={(e) => setVarWallHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-emerald-700/60 font-mono text-sm text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-indigo-300 font-medium">
                    Right Wall H (m)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={varRightWallHeight}
                    onChange={(e) => setVarRightWallHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-indigo-700/60 font-mono text-sm text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300 font-medium">Crown Radius R (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    value={varCrownRadius}
                    onChange={(e) => setVarCrownRadius(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-white"
                  />
                </label>
              </div>

              <label className="block space-y-1 pt-1">
                <span className="text-xs text-slate-400">
                  Shape Name (Saved automatically for {settings.locationName || 'this location'})
                </span>
                <input
                  type="text"
                  value={variantShapeName}
                  onChange={(e) => setVariantShapeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs text-cyan-200"
                />
              </label>
            </div>

            {/* STEP 3 (AFTER CHOOSING TUNNEL SHAPE & SIZE): ASK FULL FACE OR TOP HEADING + BENCHING DETAILS */}
            <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                    3. Excavation Method: Full Face or Top Heading?
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    After choosing your tunnel shape &amp; size above, select <strong>Full Face</strong> or <strong>Top Heading</strong>. If Top Heading is selected, enter the Benching Details below to remove the bench portion from the shape (keeping Top Heading Left Wall, Right Wall, Crown &amp; Face).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExcavationStageMode('FULL_FACE')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    excavationStageMode === 'FULL_FACE'
                      ? 'bg-emerald-950/70 border-emerald-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs uppercase text-emerald-300">
                      1. Full Face Excavation
                    </span>
                    {excavationStageMode === 'FULL_FACE' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Full tunnel section ({fullVariantBaseGeometry.width.toFixed(2)}m W ×{' '}
                    {fullVariantBaseGeometry.height.toFixed(2)}m H · L-Wall{' '}
                    {(fullVariantBaseGeometry.leftWallHeight ?? fullVariantBaseGeometry.wallHeight).toFixed(2)}m · R-Wall{' '}
                    {(fullVariantBaseGeometry.rightWallHeight ?? fullVariantBaseGeometry.wallHeight).toFixed(2)}m)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExcavationStageMode('TOP_HEADING');
                    const curB = parseFloat(benchHeightInput);
                    if (Number.isNaN(curB) || curB <= 0.1) {
                      const defB = Number(
                        Math.max(
                          1.0,
                          ((fullVariantBaseGeometry.leftWallHeight ?? fullVariantBaseGeometry.wallHeight) *
                            0.6)
                        ).toFixed(2)
                      );
                      setBenchHeightInput(String(defB));
                      setLeftBenchHeightInput(String(defB));
                      setRightBenchHeightInput(String(defB));
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    excavationStageMode === 'TOP_HEADING'
                      ? 'bg-amber-950/70 border-amber-400 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs uppercase text-amber-300">
                      2. Top Heading (Heading &amp; Benching)
                    </span>
                    {excavationStageMode === 'TOP_HEADING' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Feed benching details to remove lower bench portion from the tunnel shape (retains Top Heading Left Wall, Right Wall, Crown &amp; Face).
                  </p>
                </button>
              </div>

              {excavationStageMode === 'TOP_HEADING' && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                      Benching Details (Removes Lower Bench Portion from Tunnel Shape)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300">
                      Full H = {fullVariantBaseGeometry.height.toFixed(2)}m → Top Heading H ={' '}
                      {previewVariantGeometry.height.toFixed(2)}m
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className="text-[11px] text-amber-300 font-mono font-semibold block">
                        Bench Height to Remove (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.2"
                        max={Math.max(0.5, fullVariantBaseGeometry.height - 1.0)}
                        value={benchHeightInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBenchHeightInput(val);
                          setLeftBenchHeightInput(val);
                          setRightBenchHeightInput(val);
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-amber-500/70 font-mono text-sm text-white font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] text-cyan-300 font-mono font-semibold block">
                        Top Heading Height (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max={fullVariantBaseGeometry.height - 0.2}
                        value={previewVariantGeometry.height}
                        onChange={(e) => {
                          const topH = parseFloat(e.target.value);
                          if (!Number.isNaN(topH) && topH >= 1.0) {
                            const nextBench = Number(
                              Math.max(0.2, fullVariantBaseGeometry.height - topH).toFixed(2)
                            );
                            setBenchHeightInput(String(nextBench));
                            setLeftBenchHeightInput(String(nextBench));
                            setRightBenchHeightInput(String(nextBench));
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-cyan-500/60 font-mono text-sm text-white font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] text-emerald-300 font-mono font-semibold block">
                        Top Heading L-Wall (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.4"
                        max={fullVariantBaseGeometry.height}
                        value={(
                          previewVariantGeometry.leftWallHeight ?? previewVariantGeometry.wallHeight
                        ).toFixed(2)}
                        onChange={(e) => {
                          const topLW = parseFloat(e.target.value);
                          if (!Number.isNaN(topLW) && topLW >= 0.3) {
                            const fullLW =
                              fullVariantBaseGeometry.leftWallHeight ??
                              fullVariantBaseGeometry.wallHeight;
                            const nextLB = Number(Math.max(0.2, fullLW - topLW).toFixed(2));
                            setLeftBenchHeightInput(String(nextLB));
                            setBenchHeightInput(String(nextLB));
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/60 font-mono text-sm text-white font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] text-indigo-300 font-mono font-semibold block">
                        Top Heading R-Wall (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.4"
                        max={fullVariantBaseGeometry.height}
                        value={(
                          previewVariantGeometry.rightWallHeight ?? previewVariantGeometry.wallHeight
                        ).toFixed(2)}
                        onChange={(e) => {
                          const topRW = parseFloat(e.target.value);
                          if (!Number.isNaN(topRW) && topRW >= 0.3) {
                            const fullRW =
                              fullVariantBaseGeometry.rightWallHeight ??
                              fullVariantBaseGeometry.wallHeight;
                            const nextRB = Number(Math.max(0.2, fullRW - topRW).toFixed(2));
                            setRightBenchHeightInput(String(nextRB));
                          }
                        }}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-indigo-500/60 font-mono text-sm text-white font-bold"
                      />
                    </label>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] font-mono text-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      ✓ Bench Removed: <strong>{(previewVariantGeometry.benchHeightRemovedMeters || 0).toFixed(2)} m</strong> · Top Heading Shape: <strong>{previewVariantGeometry.width.toFixed(2)}m W × {previewVariantGeometry.height.toFixed(2)}m H</strong>
                    </span>
                    <span>
                      Top Heading Walls: <strong>L = {(previewVariantGeometry.leftWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m</strong> · <strong>R = {(previewVariantGeometry.rightWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m</strong> · <strong>Crown = {previewVariantGeometry.crownArcLength.toFixed(2)}m</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 5 Cols: Scaled 1m Preview */}
          <div className="lg:col-span-5 flex flex-col p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-cyan-300">
                SCALED 1:1 CROSS-SECTION PREVIEW
              </span>
              <span className="text-xs font-mono text-emerald-400">
                Area: {(previewVariantGeometry.designAreaSqMeters || 0).toFixed(2)} m²
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center py-4 bg-slate-50 rounded-lg border border-slate-200 my-2">
              <svg viewBox="-7 -1.5 14 11" className="w-full max-h-[340px]">
                {/* 1m Grid */}
                {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((gx) => (
                  <line
                    key={`gx-${gx}`}
                    x1={gx}
                    y1={0}
                    x2={gx}
                    y2={9}
                    stroke={gx === 0 ? 'rgba(2,132,199,0.5)' : 'rgba(100,116,139,0.2)'}
                    strokeWidth="0.04"
                  />
                ))}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((gy) => (
                  <line
                    key={`gy-${gy}`}
                    x1={-6}
                    y1={8 - gy}
                    x2={6}
                    y2={8 - gy}
                    stroke={gy === 0 ? 'rgba(2,132,199,0.5)' : 'rgba(100,116,139,0.2)'}
                    strokeWidth="0.04"
                  />
                ))}
                {excavationStageMode === 'TOP_HEADING' &&
                  previewVariantGeometry.benchHeightRemovedMeters &&
                  previewVariantGeometry.benchHeightRemovedMeters > 0.1 && (
                    <g>
                      {/* Ghost outline of Full Tunnel Shape showing the removed lower bench portion */}
                      <polygon
                        points={fullVariantBaseGeometry.crossSectionPoints
                          .map((p) => `${p.x.toFixed(2)},${(8 - p.y).toFixed(2)}`)
                          .join(' ')}
                        fill="rgba(245, 158, 11, 0.08)"
                        stroke="#D97706"
                        strokeWidth="0.07"
                        strokeDasharray="0.22,0.16"
                      />
                      <text
                        x="0"
                        y={(8 - (previewVariantGeometry.benchHeightRemovedMeters || 2.5) / 2).toFixed(2)}
                        textAnchor="middle"
                        fontSize="0.36"
                        fill="#B45309"
                        fontWeight="700"
                        fontFamily="IBM Plex Mono, monospace"
                      >
                        REMOVED BENCH PORTION ({(previewVariantGeometry.benchHeightRemovedMeters || 0).toFixed(2)}m)
                      </text>
                    </g>
                  )}
                <polygon
                  points={previewVariantGeometry.crossSectionPoints
                    .map((p) => {
                      const benchOffset =
                        excavationStageMode === 'TOP_HEADING'
                          ? previewVariantGeometry.benchHeightRemovedMeters || 0
                          : 0;
                      return `${p.x.toFixed(2)},${(8 - (p.y + benchOffset)).toFixed(2)}`;
                    })
                    .join(' ')}
                  fill="rgba(2, 132, 199, 0.18)"
                  stroke="#0284C7"
                  strokeWidth="0.12"
                />
                <text
                  x="0"
                  y="9.1"
                  textAnchor="middle"
                  fontSize="0.40"
                  fill="#0F172A"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {excavationStageMode === 'TOP_HEADING'
                    ? `TOP HEADING: W=${previewVariantGeometry.width.toFixed(2)}m × H=${previewVariantGeometry.height.toFixed(2)}m · L-Wall=${(previewVariantGeometry.leftWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m · R-Wall=${(previewVariantGeometry.rightWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m (Bench ${(previewVariantGeometry.benchHeightRemovedMeters || 0).toFixed(2)}m Removed)`
                    : `Width = ${previewVariantGeometry.width.toFixed(2)}m · Height = ${previewVariantGeometry.height.toFixed(2)}m · L-Wall = ${(previewVariantGeometry.leftWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m · R-Wall = ${(previewVariantGeometry.rightWallHeight ?? previewVariantGeometry.wallHeight).toFixed(2)}m`}
                </text>
              </svg>
            </div>
            <button
              type="button"
              onClick={handleConfirmAndGoToPhotos}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Use This Tunnel Shape &amp; Go to Add Pictures →
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: CUSTOM SHAPE (EMPTY CANVAS + LINE MODE / ARC MODE / XY POINT)
         ==================================================================== */}
      {mainTab === 'freeform_canvas' && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT / CENTER: INTERACTIVE 1M ENGINEERING CANVAS */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col p-1.5 gap-1 overflow-hidden">
            {/* Simple Mode Bar Above Canvas */}
            <div className="canvas-chrome flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectSubMode('LINE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    subMode === 'LINE'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  1. Line Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSubMode('ARC')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    subMode === 'ARC'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  2. Arc Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSubMode('XY_POINT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    subMode === 'XY_POINT'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  3. XY Point Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSubMode('SELECT_EDIT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    subMode === 'SELECT_EDIT'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  Move / Edit Point
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisualSnapEnabled((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors ${
                    visualSnapEnabled
                      ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border-emerald-500/60'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle visual snapping to endpoints, centerline (X=0), invert axis (Y=0), orthogonal alignment, and symmetry"
                >
                  {visualSnapEnabled ? '🧲 Visual Snap: ON' : 'Visual Snap: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSnapStepMeters((prev) => (prev === 0.01 ? 0.1 : prev === 0.1 ? 0.5 : 0.01))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-mono cursor-pointer"
                  title="Toggle cursor snap precision"
                >
                  {snapStepMeters === 0.01
                    ? 'Grid: 0.01m'
                    : `Grid: ${snapStepMeters}m`}
                </button>
                {!profile.isClosed && profile.controlPoints.length >= 3 && (
                  <button
                    type="button"
                    onClick={handleCloseShapeNow}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold cursor-pointer"
                  >
                    ✓ Close Shape
                  </button>
                )}
                {isDrawingChainActive && !profile.isClosed && profile.controlPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawingChainActive(false);
                      setCursorPreviewPt(null);
                      setPendingCanvasArcStartPt(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-600/50 text-xs font-mono cursor-pointer"
                  >
                    Stop Line (Esc)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setProfile((prev) => {
                      const nextPts = prev.controlPoints.slice(0, -1);
                      const nextPtIds = new Set(nextPts.map((p) => p.id));
                      return {
                        ...prev,
                        controlPoints: nextPts,
                        segments: prev.segments.filter(
                          (s) => nextPtIds.has(s.fromPointId) && nextPtIds.has(s.toPointId)
                        ),
                        isClosed: false,
                      };
                    });
                    setCursorPreviewPt(null);
                  }}
                  disabled={profile.controlPoints.length === 0}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-mono cursor-pointer"
                >
                  Undo Point
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickParametricBuilder((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-colors ${
                    showQuickParametricBuilder
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/50'
                  }`}
                  title="Open 1-Click Parametric W / L-Wall / R-Wall / Crown Rise Generator"
                >
                  ⚡ Quick W×H Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfile({
                      id: `custom-prof-${Date.now()}`,
                      name: profile.name,
                      category: 'freeform_polygon',
                      controlPoints: [],
                      segments: [],
                      isClosed: false,
                      version: 'v1.0',
                      updatedAt: new Date().toISOString(),
                    });
                    setSelectedPointId(null);
                    setSelectedSegmentId(null);
                    setCursorPreviewPt(null);
                    setPendingCanvasArcStartPt(null);
                    setIsDrawingChainActive(true);
                    setStatusNote('Cleared canvas. Click or enter coordinates to start drawing.');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700/50 text-xs font-mono cursor-pointer"
                >
                  Clear Empty
                </button>
              </div>
            </div>

            {/* 1-Click Engineering Sheet Reference Presets Bar */}
            <div className="canvas-chrome flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/95 border border-slate-800 overflow-x-auto">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 shrink-0">
                1-Click Templates:
              </span>
              {CUSTOM_PROFILE_PRESETS.slice(0, 7).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const built = preset.createProfile();
                    setProfile({
                      ...built,
                      id: `custom-prof-${Date.now()}`,
                      updatedAt: new Date().toISOString(),
                    });
                    setIsDrawingChainActive(false);
                    setCursorPreviewPt(null);
                    setPendingCanvasArcStartPt(null);
                    setSelectedSegmentId(built.segments[0]?.id || null);
                    setStatusNote(`Loaded template: ${preset.label} (${preset.subtitle})`);
                  }}
                  title={preset.subtitle}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/60 text-[10px] font-mono text-slate-200 hover:text-amber-300 shrink-0 cursor-pointer transition-colors"
                >
                  {preset.label.replace(/^Sheet \d+:\s*/, '')}
                </button>
              ))}
            </div>

            {/* Collapsible 1-Click Parametric Custom Tunnel Builder (Span W, L-Wall, R-Wall, Crown Rise) */}
            {showQuickParametricBuilder && (
              <div className="canvas-chrome px-2.5 py-2 rounded-lg bg-slate-950 border border-cyan-500/50 flex flex-wrap items-end justify-between gap-2 text-xs font-mono">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-cyan-300 font-bold block">Span W (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={quickSpanW}
                      onChange={(e) => setQuickSpanW(e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-emerald-300 font-bold block">L-Wall H (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={quickLeftWallH}
                      onChange={(e) => setQuickLeftWallH(e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-emerald-600/50 text-white text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-indigo-300 font-bold block">R-Wall H (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={quickRightWallH}
                      onChange={(e) => setQuickRightWallH(e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-indigo-500/50 text-white text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-amber-300 font-bold block">Crown Rise (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={quickCrownRiseH}
                      onChange={(e) => setQuickCrownRiseH(e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-amber-500/50 text-white text-xs"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block">Crown Roof</span>
                    <select
                      value={quickCrownStyle}
                      onChange={(e) =>
                        setQuickCrownStyle(e.target.value as 'arch' | 'flat' | 'sloped')
                      }
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                    >
                      <option value="arch">Curved Arch</option>
                      <option value="flat">Flat / Straight</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateQuickParametricCustomShape}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                >
                  ⚡ Generate Exact Shape Now
                </button>
              </div>
            )}

            {/* Live Unfolded Top Strip CAD Preview & Direct Portion Accuracy Bar */}
            {(() => {
              const lwLen = Number(evaluatedCustom.leftWallArcLength.toFixed(2));
              const crLen = Number(evaluatedCustom.crownArcLength.toFixed(2));
              const rwLen = Number(evaluatedCustom.rightWallArcLength.toFixed(2));
              const totalStripW = Math.max(0.1, Number((lwLen + crLen + rwLen).toFixed(2)));
              const lwPct = Math.max(0, (lwLen / totalStripW) * 100);
              const crPct = Math.max(0, (crLen / totalStripW) * 100);
              const rwPct = Math.max(0, (rwLen / totalStripW) * 100);

              return (
                <div className="canvas-chrome px-2.5 py-1.5 rounded-lg bg-slate-900/95 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                      Live Unfolded Strip (1:1):
                    </span>
                    <span className="text-slate-300">
                      Span <strong className="text-white">{evaluatedCustom.width.toFixed(2)}m</strong> × Height{' '}
                      <strong className="text-white">{evaluatedCustom.height.toFixed(2)}m</strong>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-amber-300 font-bold">
                      Total Strip = {totalStripW.toFixed(2)}m
                    </span>
                  </div>

                  {/* Proportional Unfolded Top Strip Visual Bar [ Left Wall | Crown | Right Wall ] */}
                  <div className="flex-1 min-w-[240px] max-w-[520px] h-6 rounded border border-slate-600 bg-slate-950 overflow-hidden flex items-stretch text-[10px] font-bold">
                    {evaluatedCustom.hasLeftWall && lwLen > 0 ? (
                      <div
                        style={{ width: `${Math.max(14, lwPct)}%` }}
                        className="bg-emerald-950/90 text-emerald-300 border-r-2 border-dashed border-amber-400 flex items-center justify-center px-1 truncate"
                        title={`Left Wall Unfolded Width = ${lwLen}m (SPL Seam on Right)`}
                      >
                        LW {lwLen}m
                      </div>
                    ) : (
                      <div className="px-1.5 bg-rose-950/60 text-rose-300 border-r border-slate-800 flex items-center">
                        LW OPEN
                      </div>
                    )}
                    {evaluatedCustom.hasCrown && crLen > 0 ? (
                      <div
                        style={{ width: `${Math.max(20, crPct)}%` }}
                        className="bg-amber-950/80 text-amber-200 border-r-2 border-dashed border-amber-400 flex items-center justify-center px-1 truncate"
                        title={`Crown Unfolded Arc Width = ${crLen}m`}
                      >
                        CROWN {crLen}m
                      </div>
                    ) : (
                      <div className="px-1.5 bg-rose-950/60 text-rose-300 border-r border-slate-800 flex items-center">
                        CR OPEN
                      </div>
                    )}
                    {evaluatedCustom.hasRightWall && rwLen > 0 ? (
                      <div
                        style={{ width: `${Math.max(14, rwPct)}%` }}
                        className="bg-indigo-950/90 text-indigo-300 flex items-center justify-center px-1 truncate"
                        title={`Right Wall Unfolded Width = ${rwLen}m (SPL Seam on Left)`}
                      >
                        RW {rwLen}m
                      </div>
                    ) : (
                      <div className="px-1.5 bg-rose-950/60 text-rose-300 flex items-center">
                        RW OPEN
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SVG 1m-Scaled Canvas (Light Mode Engineering Sheet Grid) */}
            <div className="relative flex-1 min-h-0 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shadow-inner">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${viewW} ${viewH}`}
                preserveAspectRatio="xMidYMid meet"
                onMouseDown={handleCanvasPointerDown}
                onMouseMove={handleCanvasPointerMove}
                onMouseUp={handleCanvasPointerUp}
                onMouseLeave={handleCanvasPointerLeave}
                onContextMenu={(e) => e.preventDefault()}
                onDoubleClick={() => {
                  if (!profile.isClosed && profile.controlPoints.length >= 3) {
                    handleCloseShapeNow();
                  } else {
                    setIsDrawingChainActive(false);
                    setCursorPreviewPt(null);
                  }
                }}
                className="w-full h-full block cursor-crosshair bg-[#F8FAFC]"
              >
                {/* 1m Real-World Engineering Grid & Ruler Ticks */}
                {(() => {
                  const gridLines: React.ReactNode[] = [];
                  for (let gx = -12; gx <= 12; gx++) {
                    const pTop = canvasMetrics.worldToScreen({ x: gx, y: 15 });
                    const pBot = canvasMetrics.worldToScreen({ x: gx, y: -5 });
                    const isZero = gx === 0;
                    gridLines.push(
                      <g key={`gx-${gx}`}>
                        <line
                          x1={pTop.cx}
                          y1={0}
                          x2={pBot.cx}
                          y2={viewH}
                          stroke={
                            isZero ? 'rgba(2, 132, 199, 0.55)' : 'rgba(100, 116, 139, 0.22)'
                          }
                          strokeWidth={isZero ? '1.4' : '0.85'}
                          strokeDasharray={isZero ? '5,4' : undefined}
                        />
                        <text
                          x={pTop.cx}
                          y={viewH - 8}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="600"
                          fontFamily="IBM Plex Mono, monospace"
                          fill={isZero ? '#0369A1' : '#475569'}
                        >
                          {gx}m
                        </text>
                      </g>
                    );
                  }
                  for (let gy = -2; gy <= 14; gy++) {
                    const pLeft = canvasMetrics.worldToScreen({ x: -15, y: gy });
                    const pRight = canvasMetrics.worldToScreen({ x: 15, y: gy });
                    const isZero = gy === 0;
                    gridLines.push(
                      <g key={`gy-${gy}`}>
                        <line
                          x1={0}
                          y1={pLeft.cy}
                          x2={viewW}
                          y2={pRight.cy}
                          stroke={
                            isZero ? 'rgba(2, 132, 199, 0.55)' : 'rgba(100, 116, 139, 0.22)'
                          }
                          strokeWidth={isZero ? '1.4' : '0.85'}
                          strokeDasharray={isZero ? '5,4' : undefined}
                        />
                        <text
                          x={22}
                          y={pLeft.cy - 3}
                          fontSize="9.5"
                          fontWeight="600"
                          fontFamily="IBM Plex Mono, monospace"
                          fill={isZero ? '#0369A1' : '#475569'}
                        >
                          {gy}m
                        </text>
                      </g>
                    );
                  }
                  return gridLines;
                })()}

                {/* Closed Polygon Fill */}
                {profile.isClosed && evaluatedCustom.crossSectionPoints.length >= 3 && (
                  <polygon
                    points={evaluatedCustom.crossSectionPoints
                      .map((pt) => {
                        const s = canvasMetrics.worldToScreen(pt);
                        return `${s.cx},${s.cy}`;
                      })
                      .join(' ')}
                    fill="rgba(2, 132, 199, 0.12)"
                    stroke="none"
                  />
                )}

                {/* Drawn Segments (Lines & Arcs) with Portion Role & Length Labels */}
                {evaluatedCustom.segmentMetrics.map((seg) => {
                  const ptsScreen = seg.sampledPoints.map((p) => canvasMetrics.worldToScreen(p));
                  const dPath = ptsScreen
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`)
                    .join(' ');
                  const midS = canvasMetrics.worldToScreen(seg.midHandlePoint);
                  const isSelSeg = seg.segmentId === selectedSegmentId;
                  const roleShort =
                    seg.zoneRole === 'leftWall'
                      ? 'L-Wall'
                      : seg.zoneRole === 'rightWall'
                      ? 'R-Wall'
                      : seg.zoneRole === 'crown'
                      ? 'Crown'
                      : 'Invert';
                  const roleStroke =
                    isSelSeg
                      ? '#D97706'
                      : seg.zoneRole === 'leftWall'
                      ? '#059669'
                      : seg.zoneRole === 'rightWall'
                      ? '#4F46E5'
                      : seg.zoneRole === 'crown'
                      ? '#0284C7'
                      : '#64748B';
                  const badgeText = `${roleShort} ${seg.arcLength.toFixed(2)}m`;
                  const badgeW = Math.max(82, badgeText.length * 6.2 + 12);

                  return (
                    <g key={seg.segmentId}>
                      <path
                        d={dPath}
                        fill="none"
                        stroke={roleStroke}
                        strokeWidth={isSelSeg ? '3.8' : '2.8'}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSegmentId(seg.segmentId);
                        }}
                      />
                      {/* Segment Portion Role & Length Label */}
                      <g
                        transform={`translate(${midS.cx}, ${
                          seg.type === 'arc' ? midS.cy - 18 : midS.cy
                        })`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSegmentId(seg.segmentId);
                        }}
                      >
                        <rect
                          x={-badgeW / 2}
                          y="-10"
                          width={badgeW}
                          height="17"
                          rx="3.5"
                          fill="#FFFFFF"
                          stroke={roleStroke}
                          strokeWidth={isSelSeg ? '1.8' : '1.2'}
                        />
                        <text
                          x="0"
                          y="1.5"
                          textAnchor="middle"
                          fontSize="9.2"
                          fontWeight="700"
                          fontFamily="IBM Plex Mono, monospace"
                          fill={roleStroke}
                        >
                          {badgeText}
                        </text>
                      </g>

                      {/* Interactive Arc Peak Handle aligned 1:1 with midHandlePoint */}
                      {seg.type === 'arc' && (
                        <circle
                          cx={midS.cx}
                          cy={midS.cy}
                          r="6"
                          fill="#F59E0B"
                          stroke="#FFFFFF"
                          strokeWidth="1.8"
                          className="cursor-grab active:cursor-grabbing"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Active Rubber-Band Preview Line ONLY while actively drawing an unclosed shape! */}
                {!profile.isClosed &&
                  cursorPreviewPt &&
                  ((subMode === 'LINE' &&
                    isDrawingChainActive &&
                    profile.controlPoints.length > 0) ||
                    (subMode === 'ARC' &&
                      (pendingCanvasArcStartPt !== null ||
                        profile.controlPoints.length > 0))) &&
                  (() => {
                    const anchorWorld =
                      subMode === 'ARC' && pendingCanvasArcStartPt
                        ? pendingCanvasArcStartPt
                        : profile.controlPoints[profile.controlPoints.length - 1];
                    if (!anchorWorld) return null;
                    const s1 = canvasMetrics.worldToScreen(anchorWorld);
                    const s2 = canvasMetrics.worldToScreen(cursorPreviewPt);
                    const lenM = Math.hypot(
                      cursorPreviewPt.x - anchorWorld.x,
                      cursorPreviewPt.y - anchorWorld.y
                    );
                    const angDeg =
                      (Math.atan2(
                        cursorPreviewPt.y - anchorWorld.y,
                        cursorPreviewPt.x - anchorWorld.x
                      ) *
                        180) /
                      Math.PI;

                    return (
                      <g className="pointer-events-none">
                        <line
                          x1={s1.cx}
                          y1={s1.cy}
                          x2={s2.cx}
                          y2={s2.cy}
                          stroke="#D97706"
                          strokeWidth="2"
                          strokeDasharray="6,4"
                        />
                        <rect
                          x={(s1.cx + s2.cx) / 2 - 58}
                          y={(s1.cy + s2.cy) / 2 - 22}
                          width="116"
                          height="18"
                          rx="4"
                          fill="#FFFFFF"
                          stroke="#D97706"
                          strokeWidth="1.2"
                        />
                        <text
                          x={(s1.cx + s2.cx) / 2}
                          y={(s1.cy + s2.cy) / 2 - 9.5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="IBM Plex Mono, monospace"
                          fill="#B45309"
                        >
                          L={lenM.toFixed(2)}m ∠{Math.round(angDeg)}°
                        </text>
                      </g>
                    );
                  })()}

                {/* Pending Arc Start Point Marker */}
                {subMode === 'ARC' && pendingCanvasArcStartPt && (
                  <g className="pointer-events-none">
                    {(() => {
                      const s = canvasMetrics.worldToScreen(pendingCanvasArcStartPt);
                      return (
                        <>
                          <circle
                            cx={s.cx}
                            cy={s.cy}
                            r="7"
                            fill="#F59E0B"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                          <text
                            x={s.cx}
                            y={s.cy - 10}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                            fill="#B45309"
                          >
                            ARC START
                          </text>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* Control Point Vertices (P1..Pn) */}
                {profile.controlPoints.map((cp, idx) => {
                  const s = canvasMetrics.worldToScreen(cp);
                  const isFirst = idx === 0;
                  const canCloseOnFirst =
                    isFirst && !profile.isClosed && profile.controlPoints.length >= 3;
                  const isSel = cp.id === selectedPointId;

                  return (
                    <g key={cp.id}>
                      <circle
                        cx={s.cx}
                        cy={s.cy}
                        r={canCloseOnFirst ? '8' : isSel ? '7' : '5.5'}
                        fill={
                          canCloseOnFirst
                            ? '#059669'
                            : isSel
                            ? '#D97706'
                            : '#0284C7'
                        }
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        className="cursor-pointer"
                      />
                      <text
                        x={s.cx}
                        y={s.cy - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="IBM Plex Mono, monospace"
                        fill={canCloseOnFirst ? '#047857' : '#0F172A'}
                        className="pointer-events-none"
                      >
                        {canCloseOnFirst
                          ? 'P1 (CLICK TO CLOSE)'
                          : `${cp.label} (${cp.x.toFixed(2)},${cp.y.toFixed(2)})`}
                      </text>
                    </g>
                  );
                })}

                {/* Visual Snapping Alignment Guides & OSNAP Target Indicator */}
                {activeVisualSnap &&
                  (() => {
                    const snapS = canvasMetrics.worldToScreen(activeVisualSnap.snappedPt);
                    const isEp =
                      activeVisualSnap.kind === 'ENDPOINT' ||
                      activeVisualSnap.kind === 'ORIGIN';
                    const snapColor = activeVisualSnap.isCloseLoopTarget
                      ? '#059669'
                      : isEp
                      ? '#10B981'
                      : '#0284C7';

                    return (
                      <g className="pointer-events-none">
                        {/* Vertical Snap Guide Line (Centerline X=0, Ortho Vertical, or Symmetry) */}
                        {activeVisualSnap.verticalGuideX !== undefined && (
                          <>
                            <line
                              x1={snapS.cx}
                              y1={0}
                              x2={snapS.cx}
                              y2={viewH}
                              stroke={snapColor}
                              strokeWidth="1.4"
                              strokeDasharray="4,4"
                              opacity="0.85"
                            />
                            {activeVisualSnap.verticalRefPt && (
                              <circle
                                cx={
                                  canvasMetrics.worldToScreen(activeVisualSnap.verticalRefPt).cx
                                }
                                cy={
                                  canvasMetrics.worldToScreen(activeVisualSnap.verticalRefPt).cy
                                }
                                r="7.5"
                                fill="none"
                                stroke={snapColor}
                                strokeWidth="1.5"
                                strokeDasharray="2,2"
                              />
                            )}
                          </>
                        )}

                        {/* Horizontal Snap Guide Line (Invert Y=0 or Ortho Horizontal) */}
                        {activeVisualSnap.horizontalGuideY !== undefined && (
                          <>
                            <line
                              x1={0}
                              y1={snapS.cy}
                              x2={viewW}
                              y2={snapS.cy}
                              stroke={snapColor}
                              strokeWidth="1.4"
                              strokeDasharray="4,4"
                              opacity="0.85"
                            />
                            {activeVisualSnap.horizontalRefPt && (
                              <circle
                                cx={
                                  canvasMetrics.worldToScreen(activeVisualSnap.horizontalRefPt).cx
                                }
                                cy={
                                  canvasMetrics.worldToScreen(activeVisualSnap.horizontalRefPt).cy
                                }
                                r="7.5"
                                fill="none"
                                stroke={snapColor}
                                strokeWidth="1.5"
                                strokeDasharray="2,2"
                              />
                            )}
                          </>
                        )}

                        {/* OSNAP Target Reticle: CAD Endpoint Square or Axis/Ortho Diamond */}
                        {isEp ? (
                          <>
                            <circle
                              cx={snapS.cx}
                              cy={snapS.cy}
                              r="11"
                              fill="rgba(16, 185, 129, 0.14)"
                              stroke={snapColor}
                              strokeWidth="1.4"
                            />
                            <rect
                              x={snapS.cx - 6}
                              y={snapS.cy - 6}
                              width="12"
                              height="12"
                              fill="none"
                              stroke={snapColor}
                              strokeWidth="2.2"
                            />
                          </>
                        ) : (
                          <polygon
                            points={`${snapS.cx},${snapS.cy - 7.5} ${snapS.cx + 7.5},${snapS.cy} ${snapS.cx},${snapS.cy + 7.5} ${snapS.cx - 7.5},${snapS.cy}`}
                            fill="rgba(2, 132, 199, 0.14)"
                            stroke={snapColor}
                            strokeWidth="2"
                          />
                        )}

                        {/* Floating Visual Snap Pill Badge near Cursor */}
                        <g
                          transform={`translate(${Math.min(
                            viewW - 210,
                            Math.max(12, snapS.cx + 12)
                          )}, ${Math.max(24, snapS.cy - 28)})`}
                        >
                          <rect
                            x="0"
                            y="-13"
                            width={Math.max(135, activeVisualSnap.label.length * 6.2 + 18)}
                            height="19"
                            rx="4"
                            fill="#0F172A"
                            stroke={snapColor}
                            strokeWidth="1.3"
                            opacity="0.95"
                          />
                          <text
                            x="8"
                            y="-0.5"
                            fontSize="9.5"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                            fill="#6EE7B7"
                          >
                            🧲 {activeVisualSnap.label}
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                {/* Exact Cursor Tip Target Marker (1:1 locked to mouse crosshair) */}
                {cursorHoverPt &&
                  (() => {
                    const curS = canvasMetrics.worldToScreen(cursorHoverPt);
                    return (
                      <g className="pointer-events-none">
                        <circle
                          cx={curS.cx}
                          cy={curS.cy}
                          r="4"
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="1.5"
                        />
                        <circle cx={curS.cx} cy={curS.cy} r="1.5" fill="#0284C7" />
                        <text
                          x={curS.cx + 8}
                          y={curS.cy + 14}
                          fontSize="9.5"
                          fontWeight="700"
                          fontFamily="IBM Plex Mono, monospace"
                          fill="#0369A1"
                        >
                          ({cursorHoverPt.x.toFixed(2)}m, {cursorHoverPt.y.toFixed(2)}m)
                        </text>
                      </g>
                    );
                  })()}
              </svg>

              {/* Empty State Helper Overlay when 0 points exist */}
              {profile.controlPoints.length === 0 && !pendingCanvasArcStartPt && (
                <div className="absolute top-3 left-3 px-3.5 py-2 rounded-xl bg-white/95 border border-sky-300 text-xs font-mono text-sky-900 shadow-xs pointer-events-none">
                  Empty 1m-Scale Canvas: Click first point on the grid OR enter coordinates in the right panel.
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="canvas-chrome px-2 py-1 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span className="truncate">{statusNote}</span>
              <span className="text-cyan-300 shrink-0 ml-2">
                Points: {profile.controlPoints.length} · Status:{' '}
                {profile.isClosed ? 'CLOSED SHAPE' : 'OPEN'}
              </span>
            </div>
          </div>

          {/* ==================================================================
              RESPONSIVE COLLAPSIBLE RIGHT PROPERTY PALETTE SIDEBAR:
              STRICTLY SHOWS ONLY CURRENT MODE'S TOOLS!
             ================================================================== */}
          {!showPropertySidebar ? (
            <aside className="canvas-chrome w-7 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col items-center py-2 gap-2 select-none">
              <button
                type="button"
                onClick={() => setShowPropertySidebar(true)}
                className="w-5 h-5 rounded bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                title="Expand Property Palette Sidebar"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setShowPropertySidebar(true)}
                className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700 flex items-center justify-center cursor-pointer"
                title={`Active Tool: ${subMode}`}
              >
                <Sliders className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowPropertySidebar(true)}
                className="mt-1 [writing-mode:vertical-rl] rotate-180 text-[8.5px] font-mono font-bold tracking-wider text-slate-400 hover:text-cyan-300 uppercase cursor-pointer"
              >
                PROPERTIES · {subMode}
              </button>
            </aside>
          ) : (
          <aside className="canvas-chrome w-full lg:w-[255px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {/* Collapsible Sidebar Header */}
            <div className="px-2.5 py-1.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-1.5 shrink-0">
              <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-cyan-300 truncate">
                <Sliders className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>
                  {subMode === 'LINE'
                    ? 'LINE TOOL PROPERTIES'
                    : subMode === 'ARC'
                    ? 'ARC TOOL PROPERTIES'
                    : 'XY POINT PROPERTIES'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPropertySidebar(false)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[9.5px] font-bold cursor-pointer flex items-center gap-1 shrink-0"
                title="Collapse Property Sidebar to maximize canvas workspace"
              >
                <span>Collapse</span>
                <span>»</span>
              </button>
            </div>

            <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
            {/* Shape Name */}
            <div className="space-y-1 pb-3 border-b border-slate-800">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                Custom Tunnel Shape Name
              </span>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </div>

            {/* --------------------------------------------------------------
                CONTEXT 1: LINE MODE PROPERTY PALETTE ONLY
               -------------------------------------------------------------- */}
            {subMode === 'LINE' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    LINE MODE · CONNECT TWO POINTS
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">1m Scale</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Click points directly on the canvas, or enter the Start Point and Line Length (m) below to connect two points accurately.
                </p>

                {/* Start Point (X1, Y1) */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-slate-300 font-semibold">
                    1. Start Point (X₁, Y₁)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Start X₁ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={lineStartX}
                        onChange={(e) => setLineStartX(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Start Y₁ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={lineStartY}
                        onChange={(e) => setLineStartY(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                  </div>
                </div>

                {/* Method Toggle: By Length & Direction vs End Point (X2, Y2) */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLineInputMethod('LENGTH_ANGLE')}
                      className={`flex-1 py-1 text-[11px] font-mono rounded-md cursor-pointer ${
                        lineInputMethod === 'LENGTH_ANGLE'
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      By Length (m)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineInputMethod('END_XY')}
                      className={`flex-1 py-1 text-[11px] font-mono rounded-md cursor-pointer ${
                        lineInputMethod === 'END_XY'
                          ? 'bg-cyan-600 text-white font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      By End Point (X₂,Y₂)
                    </button>
                  </div>

                  {lineInputMethod === 'LENGTH_ANGLE' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-cyan-300 font-semibold">
                            Line Length (m)
                          </span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={lineLengthM}
                            onChange={(e) => setLineLengthM(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-cyan-600/60 font-mono text-xs text-white"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-slate-400">Angle (°)</span>
                          <input
                            type="number"
                            step="5"
                            value={lineAngleDeg}
                            onChange={(e) => setLineAngleDeg(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                          />
                        </label>
                      </div>
                      {/* Quick Direction Buttons */}
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[
                          { label: '↑ Up 90°', deg: '90' },
                          { label: '→ Right 0°', deg: '0' },
                          { label: '↓ Down -90°', deg: '-90' },
                          { label: '← Left 180°', deg: '180' },
                        ].map((dir) => (
                          <button
                            key={dir.deg}
                            type="button"
                            onClick={() => setLineAngleDeg(dir.deg)}
                            className={`py-1 rounded text-[10px] font-mono border cursor-pointer ${
                              lineAngleDeg === dir.deg
                                ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {dir.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const x1 = parseFloat(lineStartX) || 0;
                          const y1 = parseFloat(lineStartY) || 0;
                          const len = Math.max(0.1, parseFloat(lineLengthM) || 1);
                          const rad = ((parseFloat(lineAngleDeg) || 0) * Math.PI) / 180;
                          const x2 = Number((x1 + len * Math.cos(rad)).toFixed(2));
                          const y2 = Number((y1 + len * Math.sin(rad)).toFixed(2));
                          appendLineSegmentPoints({ x: x1, y: y1 }, { x: x2, y: y2 });
                        }}
                        className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold cursor-pointer"
                      >
                        + Connect Line ({lineLengthM} m)
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-slate-400">End X₂ (m)</span>
                          <input
                            type="number"
                            step="0.1"
                            value={lineEndX}
                            onChange={(e) => setLineEndX(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-slate-400">End Y₂ (m)</span>
                          <input
                            type="number"
                            step="0.1"
                            value={lineEndY}
                            onChange={(e) => setLineEndY(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const x1 = parseFloat(lineStartX) || 0;
                          const y1 = parseFloat(lineStartY) || 0;
                          const x2 = parseFloat(lineEndX) || 0;
                          const y2 = parseFloat(lineEndY) || 0;
                          appendLineSegmentPoints({ x: x1, y: y1 }, { x: x2, y: y2 });
                        }}
                        className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold cursor-pointer"
                      >
                        + Connect Line (X₁,Y₁ → X₂,Y₂)
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* --------------------------------------------------------------
                CONTEXT 2: ARC MODE PROPERTY PALETTE ONLY
                (Start Point -> Arc Length -> End Point)
               -------------------------------------------------------------- */}
            {subMode === 'ARC' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    ARC MODE · START, ARC LENGTH &amp; END
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter the Arc Start Point, End Point, and Arc Length (m) below (or click Start and End points on the canvas).
                </p>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                  <div className="text-[11px] font-mono text-slate-300 font-semibold">
                    1. Arc Start Point (X₁, Y₁)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Start X₁ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={arcStartX}
                        onChange={(e) => setArcStartX(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Start Y₁ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={arcStartY}
                        onChange={(e) => setArcStartY(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                  </div>

                  <div className="text-[11px] font-mono text-slate-300 font-semibold pt-1">
                    2. Arc End Point (X₂, Y₂)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">End X₂ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={arcEndX}
                        onChange={(e) => {
                          setArcEndX(e.target.value);
                          const c = Math.hypot(
                            (parseFloat(e.target.value) || 0) - (parseFloat(arcStartX) || 0),
                            (parseFloat(arcEndY) || 0) - (parseFloat(arcStartY) || 0)
                          );
                          if (c > 0.2 && (parseFloat(arcLengthM) || 0) <= c) {
                            setArcLengthM((c * 1.22).toFixed(2));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">End Y₂ (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={arcEndY}
                        onChange={(e) => setArcEndY(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                  </div>

                  <div className="text-[11px] font-mono text-amber-300 font-semibold pt-1">
                    3. Arc Length (m) &amp; Curve Direction
                  </div>
                  {(() => {
                    const chord = Math.hypot(
                      (parseFloat(arcEndX) || 0) - (parseFloat(arcStartX) || 0),
                      (parseFloat(arcEndY) || 0) - (parseFloat(arcStartY) || 0)
                    );
                    return (
                      <div className="text-[10px] font-mono text-slate-400">
                        Straight Chord Distance = {chord.toFixed(2)} m (Arc Length must be &gt;{' '}
                        {chord.toFixed(2)} m)
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-amber-300 font-semibold">
                        Arc Length (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={arcLengthM}
                        onChange={(e) => setArcLengthM(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-amber-500/60 font-mono text-xs text-white"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Curve Direction</span>
                      <select
                        value={arcDirectionOutward ? 'OUTWARD' : 'INWARD'}
                        onChange={(e) => setArcDirectionOutward(e.target.value === 'OUTWARD')}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      >
                        <option value="OUTWARD">Arch Up / Outward</option>
                        <option value="INWARD">Invert / Inward</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const x1 = parseFloat(arcStartX) || 0;
                      const y1 = parseFloat(arcStartY) || 0;
                      const x2 = parseFloat(arcEndX) || 0;
                      const y2 = parseFloat(arcEndY) || 0;
                      const len = parseFloat(arcLengthM) || 1;
                      appendArcSegmentByLength(
                        { x: x1, y: y1 },
                        { x: x2, y: y2 },
                        len,
                        arcDirectionOutward
                      );
                    }}
                    className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold cursor-pointer"
                  >
                    + Create Arc (Start → Arc Length → End)
                  </button>
                </div>

                {/* If an existing Arc Segment is clicked, allow live editing its Arc Length */}
                {selectedSegment && selectedSegmentMetrics && (
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/50 space-y-2">
                    <div className="text-xs font-mono font-bold text-amber-300">
                      EDIT SELECTED SEGMENT ({selectedSegmentMetrics.fromPoint.label} →{' '}
                      {selectedSegmentMetrics.toPoint.label})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-400">Type</span>
                        <select
                          value={selectedSegment.type}
                          onChange={(e) => {
                            const nextT = e.target.value as CustomSegmentType;
                            setProfile((prev) => ({
                              ...prev,
                              segments: prev.segments.map((s) =>
                                s.id === selectedSegment.id
                                  ? {
                                      ...s,
                                      type: nextT,
                                      arcBulge: nextT === 'arc' ? s.arcBulge || 0.35 : undefined,
                                    }
                                  : s
                              ),
                            }));
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                        >
                          <option value="line">Straight Line</option>
                          <option value="arc">Curved Arc</option>
                        </select>
                      </label>
                      {selectedSegment.type === 'arc' && (
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-amber-300">Arc Length (m)</span>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedSegmentMetrics.arcLength}
                            onChange={(e) => {
                              const targetL = parseFloat(e.target.value);
                              if (Number.isNaN(targetL)) return;
                              const nextB = computeBulgeFromArcLength(
                                selectedSegmentMetrics.chordLength,
                                targetL,
                                (selectedSegment.arcBulge ?? 0.35) >= 0 ? 1 : -1
                              );
                              setProfile((prev) => ({
                                ...prev,
                                segments: prev.segments.map((s) =>
                                  s.id === selectedSegment.id ? { ...s, arcBulge: nextB } : s
                                ),
                              }));
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-amber-500/60 font-mono text-xs text-white"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --------------------------------------------------------------
                CONTEXT 3: XY POINT MODE PROPERTY PALETTE ONLY
               -------------------------------------------------------------- */}
            {(subMode === 'XY_POINT' || subMode === 'SELECT_EDIT') && (
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-emerald-300">
                  XY POINT COORDINATES (METERS)
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">X (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={xyInputX}
                        onChange={(e) => setXyInputX(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-400">Y (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={xyInputY}
                        onChange={(e) => setXyInputY(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const x = parseFloat(xyInputX) || 0;
                      const y = parseFloat(xyInputY) || 0;
                      setProfile((prev) => {
                        const pts = prev.controlPoints;
                        const nextId = `P${pts.length + 1}`;
                        const nextPt: ProfileControlPoint = {
                          id: nextId,
                          label: nextId,
                          x: Number(x.toFixed(2)),
                          y: Number(y.toFixed(2)),
                          role: 'corner',
                        };
                        const nextSegs =
                          pts.length > 0
                            ? [
                                ...prev.segments,
                                {
                                  id: `S-${Date.now()}`,
                                  fromPointId: pts[pts.length - 1].id,
                                  toPointId: nextId,
                                  type: 'line' as CustomSegmentType,
                                },
                              ]
                            : prev.segments;
                        return {
                          ...prev,
                          controlPoints: [...pts, nextPt],
                          segments: nextSegs,
                        };
                      });
                    }}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold cursor-pointer"
                  >
                    + Add XY Point
                  </button>
                </div>

                {/* Editable List of Points */}
                {profile.controlPoints.length > 0 && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {profile.controlPoints.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                      >
                        <span className="font-bold text-cyan-300 w-8">{cp.label}</span>
                        <input
                          type="number"
                          step="0.1"
                          value={cp.x}
                          onChange={(e) => {
                            const nx = parseFloat(e.target.value);
                            if (Number.isNaN(nx)) return;
                            setProfile((prev) => ({
                              ...prev,
                              controlPoints: prev.controlPoints.map((p) =>
                                p.id === cp.id ? { ...p, x: nx } : p
                              ),
                            }));
                          }}
                          className="w-20 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={cp.y}
                          onChange={(e) => {
                            const ny = parseFloat(e.target.value);
                            if (Number.isNaN(ny)) return;
                            setProfile((prev) => ({
                              ...prev,
                              controlPoints: prev.controlPoints.map((p) =>
                                p.id === cp.id ? { ...p, y: ny } : p
                              ),
                            }));
                          }}
                          className="w-20 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProfile((prev) => ({
                              ...prev,
                              controlPoints: prev.controlPoints.filter((p) => p.id !== cp.id),
                              segments: prev.segments.filter(
                                (s) => s.fromPointId !== cp.id && s.toPointId !== cp.id
                              ),
                            }));
                          }}
                          className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                CUSTOM CROWN & WALL PORTION SIZES & ACTIVE SURFACES
                (Supports Asymmetric Left/Right Walls & Transformer Hall Face+Wall Only)
               ============================================================== */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cyan-300 font-bold">
                  CROWN &amp; WALL PORTIONS (CUSTOM SIZES)
                </span>
                <span className="text-[9px] text-emerald-300">Independent Lengths</span>
              </div>

              {/* Quick Excavation Stage & Portion Mode Toggle: Full Face vs Top Heading (with Benching Details) vs Transformer Hall */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        category: 'freeform_polygon',
                        surfaceConfig: {
                          ...(prev.surfaceConfig || {
                            hasLeftWall: true,
                            hasRightWall: true,
                            hasCrown: true,
                          }),
                          hasCrown: true,
                          hasLeftWall: true,
                          hasRightWall: true,
                          excavationStage: 'FULL_FACE',
                          portionLabel: undefined,
                        },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      profile.surfaceConfig?.excavationStage !== 'TOP_HEADING' &&
                      profile.surfaceConfig?.excavationStage !== 'top_heading' &&
                      profile.surfaceConfig?.hasCrown !== false
                        ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    1. Full Face (Full Section)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const bH = Math.max(0.2, parseFloat(benchHeightInput) || 2.5);
                      setProfile((prev) =>
                        sliceCustomProfileToTopHeading(prev, {
                          benchHeightRemovedMeters: bH,
                        })
                      );
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      profile.surfaceConfig?.excavationStage === 'TOP_HEADING' ||
                      profile.surfaceConfig?.excavationStage === 'top_heading'
                        ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-sm'
                        : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-500/60 text-amber-200'
                    }`}
                  >
                    2. Top Heading (Remove Bench)
                  </button>
                </div>

                {(profile.surfaceConfig?.excavationStage === 'TOP_HEADING' ||
                  profile.surfaceConfig?.excavationStage === 'top_heading') && (
                  <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-500/50 space-y-1.5">
                    <div className="text-[10px] font-bold text-amber-300 uppercase">
                      Benching Details (Removes Lower Bench · Keeps Walls)
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-100">Bench Height (m):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.2"
                          max="20"
                          value={benchHeightInput}
                          onChange={(e) => setBenchHeightInput(e.target.value)}
                          className="w-16 px-2 py-0.5 rounded bg-slate-950 border border-amber-500/60 text-right text-xs text-white font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const bH = Math.max(0.2, parseFloat(benchHeightInput) || 2.5);
                            setProfile((prev) =>
                              sliceCustomProfileToTopHeading(prev, {
                                benchHeightRemovedMeters: bH,
                              })
                            );
                          }}
                          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                        >
                          Cut Bench
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      category: 'transformer_hall',
                      surfaceConfig: {
                        ...(prev.surfaceConfig || {
                          hasLeftWall: true,
                          hasRightWall: true,
                          hasCrown: false,
                        }),
                        hasCrown: false,
                        hasLeftWall: true,
                        hasRightWall: true,
                        excavationStage: 'FULL_FACE',
                      },
                    }))
                  }
                  className={`w-full py-1.5 px-2 rounded-lg border text-[10px] font-bold cursor-pointer ${
                    profile.surfaceConfig?.hasCrown === false
                      ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Transformer Hall (Face + Wall Only)
                </button>
              </div>

              {/* Individual Portion Toggles + Custom Independent Lengths */}
              <div className="space-y-2 pt-1">
                {/* Left Wall Portion */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900/90 border border-slate-800">
                  <label className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.surfaceConfig?.hasLeftWall !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                            hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                            ...prev.surfaceConfig,
                            hasLeftWall: checked,
                          },
                        }));
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                    />
                    <span>Left Wall (m)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={profile.surfaceConfig?.hasLeftWall === false}
                      value={
                        profile.surfaceConfig?.overrideLeftWallLength ??
                        (builtCustomGeometry.leftWallArcLength ?? builtCustomGeometry.wallHeight)
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                            hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                            hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                            ...prev.surfaceConfig,
                            overrideLeftWallLength:
                              !Number.isNaN(val) && val > 0 ? val : null,
                          },
                        }));
                      }}
                      className="w-20 px-2 py-1 rounded bg-slate-950 border border-emerald-600/50 text-white text-xs text-right disabled:opacity-40"
                    />
                    {profile.surfaceConfig?.overrideLeftWallLength && (
                      <button
                        type="button"
                        onClick={() =>
                          setProfile((prev) => ({
                            ...prev,
                            surfaceConfig: {
                              hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                              hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                              hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                              ...prev.surfaceConfig,
                              overrideLeftWallLength: null,
                            },
                          }))
                        }
                        title="Reset to drawn Left Wall length"
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 hover:text-white"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Wall Portion (Completely Independent from Left Wall!) */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900/90 border border-slate-800">
                  <label className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.surfaceConfig?.hasRightWall !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                            hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                            ...prev.surfaceConfig,
                            hasRightWall: checked,
                          },
                        }));
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                    />
                    <span>Right Wall (m)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={profile.surfaceConfig?.hasRightWall === false}
                      value={
                        profile.surfaceConfig?.overrideRightWallLength ??
                        (builtCustomGeometry.rightWallArcLength ?? builtCustomGeometry.wallHeight)
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                            hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                            hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                            ...prev.surfaceConfig,
                            overrideRightWallLength:
                              !Number.isNaN(val) && val > 0 ? val : null,
                          },
                        }));
                      }}
                      className="w-20 px-2 py-1 rounded bg-slate-950 border border-indigo-500/50 text-white text-xs text-right disabled:opacity-40"
                    />
                    {profile.surfaceConfig?.overrideRightWallLength && (
                      <button
                        type="button"
                        onClick={() =>
                          setProfile((prev) => ({
                            ...prev,
                            surfaceConfig: {
                              hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                              hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                              hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                              ...prev.surfaceConfig,
                              overrideRightWallLength: null,
                            },
                          }))
                        }
                        title="Reset to drawn Right Wall length"
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 hover:text-white"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* Crown Portion (Can be unchecked for Transformer Hall / Wall-Only sections) */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900/90 border border-slate-800">
                  <label className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.surfaceConfig?.hasCrown !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                            hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                            ...prev.surfaceConfig,
                            hasCrown: checked,
                          },
                        }));
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                    />
                    <span>Crown Arch (m)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={profile.surfaceConfig?.hasCrown === false}
                      value={
                        profile.surfaceConfig?.hasCrown === false
                          ? 0
                          : profile.surfaceConfig?.overrideCrownLength ??
                            builtCustomGeometry.crownArcLength
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setProfile((prev) => ({
                          ...prev,
                          surfaceConfig: {
                            hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                            hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                            hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                            ...prev.surfaceConfig,
                            overrideCrownLength:
                              !Number.isNaN(val) && val >= 0 ? val : null,
                          },
                        }));
                      }}
                      className="w-20 px-2 py-1 rounded bg-slate-950 border border-cyan-500/50 text-white text-xs text-right disabled:opacity-40"
                    />
                    {profile.surfaceConfig?.overrideCrownLength !== null &&
                      profile.surfaceConfig?.overrideCrownLength !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              surfaceConfig: {
                                hasCrown: prev.surfaceConfig?.hasCrown ?? true,
                                hasLeftWall: prev.surfaceConfig?.hasLeftWall ?? true,
                                hasRightWall: prev.surfaceConfig?.hasRightWall ?? true,
                                ...prev.surfaceConfig,
                                overrideCrownLength: null,
                              },
                            }))
                          }
                          title="Reset to drawn Crown length"
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 hover:text-white"
                        >
                          Auto
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {/* Selected Segment Direct Quick Editor (Click any segment on canvas or list) */}
              {selectedSegmentMetrics && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-300 uppercase">
                      Selected Segment: {selectedSegmentMetrics.fromPoint.label} →{' '}
                      {selectedSegmentMetrics.toPoint.label}
                    </span>
                    <label className="flex items-center gap-1 text-[10px] text-emerald-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSegment?.includeInTopStrip !== false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setProfile((prev) => ({
                            ...prev,
                            segments: prev.segments.map((s) =>
                              s.id === selectedSegmentMetrics.segmentId
                                ? { ...s, includeInTopStrip: checked }
                                : s
                            ),
                            updatedAt: new Date().toISOString(),
                          }));
                        }}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                      />
                      <span>In Strip</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-400 block">Exact Length (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={Number(selectedSegmentMetrics.arcLength.toFixed(2))}
                        onChange={(e) => {
                          const nextL = parseFloat(e.target.value);
                          if (!Number.isNaN(nextL) && nextL >= 0.1) {
                            handleSetSelectedSegmentExactLength(
                              selectedSegmentMetrics.segmentId,
                              nextL
                            );
                          }
                        }}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-amber-500/60 text-white text-xs font-bold"
                      />
                    </label>

                    <label className="space-y-0.5">
                      <span className="text-[9.5px] text-slate-400 block">Line / Arc Type</span>
                      <select
                        value={selectedSegmentMetrics.type}
                        onChange={(e) => {
                          const nextType = e.target.value as CustomSegmentType;
                          setProfile((prev) => ({
                            ...prev,
                            segments: prev.segments.map((s) =>
                              s.id === selectedSegmentMetrics.segmentId
                                ? {
                                    ...s,
                                    type: nextType,
                                    arcBulge:
                                      nextType === 'arc' ? s.arcBulge || 0.5 : undefined,
                                  }
                                : s
                            ),
                            updatedAt: new Date().toISOString(),
                          }));
                        }}
                        className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                      >
                        <option value="line">Straight Line</option>
                        <option value="arc">Curved Arc</option>
                      </select>
                    </label>
                  </div>

                  {selectedSegmentMetrics.type === 'arc' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="space-y-0.5">
                        <span className="text-[9.5px] text-amber-300 block">
                          Arc Rise / Sagitta (m)
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={Number(
                            (
                              (Math.abs(selectedSegmentMetrics.bulge || 0.35) *
                                selectedSegmentMetrics.chordLength) /
                              2
                            ).toFixed(2)
                          )}
                          onChange={(e) => {
                            const rise = parseFloat(e.target.value);
                            if (Number.isNaN(rise)) return;
                            const chord = Math.max(0.1, selectedSegmentMetrics.chordLength);
                            const sign = (selectedSegmentMetrics.bulge ?? 0.35) >= 0 ? 1 : -1;
                            const nextB =
                              sign * Math.max(0.02, Math.min(1.5, (2 * Math.abs(rise)) / chord));
                            setProfile((prev) => ({
                              ...prev,
                              segments: prev.segments.map((s) =>
                                s.id === selectedSegmentMetrics.segmentId
                                  ? { ...s, type: 'arc', arcBulge: nextB }
                                  : s
                              ),
                              updatedAt: new Date().toISOString(),
                            }));
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-amber-500/50 text-white text-xs"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9.5px] text-slate-400 block">Portion Role</span>
                        <select
                          value={selectedSegmentMetrics.zoneRole}
                          onChange={(e) => {
                            const nextRole = e.target.value as BoundaryZoneRole;
                            setProfile((prev) => ({
                              ...prev,
                              segments: prev.segments.map((s) =>
                                s.id === selectedSegmentMetrics.segmentId
                                  ? { ...s, zoneRole: nextRole }
                                  : s
                              ),
                              updatedAt: new Date().toISOString(),
                            }));
                          }}
                          className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-cyan-200 text-xs"
                        >
                          <option value="leftWall">Left Wall</option>
                          <option value="crown">Crown Arch</option>
                          <option value="rightWall">Right Wall</option>
                          <option value="invert">Invert / Base</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Drawn Segment Portion Role Assignment List */}
              {evaluatedCustom.segmentMetrics.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-slate-400 font-semibold">
                    ASSIGN DRAWN SEGMENTS TO PORTIONS (CLICK SEGMENT TO EDIT LENGTH)
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                    {evaluatedCustom.segmentMetrics.map((m) => {
                      const rawSeg = profile.segments.find((s) => s.id === m.segmentId);
                      const isIncluded = rawSeg?.includeInTopStrip !== false;
                      return (
                        <div
                          key={m.segmentId}
                          onClick={() => setSelectedSegmentId(m.segmentId)}
                          className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer ${
                            selectedSegmentId === m.segmentId
                              ? 'bg-slate-900 border-amber-500/70 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              title="Include this segment in unfolded Top Strip"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setProfile((prev) => ({
                                  ...prev,
                                  segments: prev.segments.map((s) =>
                                    s.id === m.segmentId
                                      ? { ...s, includeInTopStrip: checked }
                                      : s
                                  ),
                                  updatedAt: new Date().toISOString(),
                                }));
                              }}
                              className="rounded border-slate-700 bg-slate-950 text-emerald-500 cursor-pointer"
                            />
                            <span className="truncate">
                              <strong>
                                {m.fromPoint.label}→{m.toPoint.label}
                              </strong>{' '}
                              ({m.arcLength.toFixed(2)}m)
                            </span>
                          </div>
                          <select
                            value={m.zoneRole}
                            onChange={(e) => {
                              const nextRole = e.target.value as BoundaryZoneRole;
                              setProfile((prev) => {
                                const exists = prev.segments.some((s) => s.id === m.segmentId);
                                const nextSegs = exists
                                  ? prev.segments.map((s) =>
                                      s.id === m.segmentId ? { ...s, zoneRole: nextRole } : s
                                    )
                                  : [
                                      ...prev.segments,
                                      {
                                        id: m.segmentId,
                                        fromPointId: m.fromPoint.id,
                                        toPointId: m.toPoint.id,
                                        type: m.type,
                                        zoneRole: nextRole,
                                      },
                                    ];
                                return { ...prev, segments: nextSegs };
                              });
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-cyan-200"
                          >
                            <option value="leftWall">Left Wall</option>
                            <option value="crown">Crown Arch</option>
                            <option value="rightWall">Right Wall</option>
                            <option value="invert">Invert / Base</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Computed Shape Summary */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="text-[11px] text-cyan-400 font-bold">
                COMPUTED TUNNEL DIMENSIONS
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Span Width (W):</span>
                <strong className="text-white">{builtCustomGeometry.width.toFixed(2)} m</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Height (H):</span>
                <strong className="text-white">{builtCustomGeometry.height.toFixed(2)} m</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Left Wall Length:</span>
                <strong className="text-emerald-300">
                  {builtCustomGeometry.hasLeftWall === false
                    ? 'None (0.00 m)'
                    : `${(builtCustomGeometry.leftWallArcLength ?? builtCustomGeometry.wallHeight).toFixed(2)} m`}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Right Wall Length:</span>
                <strong className="text-indigo-300">
                  {builtCustomGeometry.hasRightWall === false
                    ? 'None (0.00 m)'
                    : `${(builtCustomGeometry.rightWallArcLength ?? builtCustomGeometry.wallHeight).toFixed(2)} m`}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Crown Arch Length:</span>
                <strong className="text-amber-300">
                  {builtCustomGeometry.hasCrown === false
                    ? 'None (Face + Wall Only)'
                    : `${builtCustomGeometry.crownArcLength.toFixed(2)} m`}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cross-Section Area:</span>
                <strong className="text-cyan-300">
                  {(builtCustomGeometry.designAreaSqMeters || 0).toFixed(2)} m²
                </strong>
              </div>
            </div>

            {!profile.isClosed && profile.controlPoints.length >= 2 && (
              <div className="space-y-1.5">
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/50 text-[11px] font-mono text-amber-200">
                  Open Tunnel Shape: Unclosed portions have no wall on that portion.
                </div>
                {profile.controlPoints.length >= 3 && (
                  <button
                    type="button"
                    onClick={handleCloseShapeNow}
                    className="w-full py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-mono text-xs font-bold cursor-pointer"
                  >
                    ✓ Close Tunnel Shape Loop (Optional)
                  </button>
                )}
              </div>
            )}
            {profile.isClosed && profile.controlPoints.length >= 3 && (
              <button
                type="button"
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    isClosed: false,
                    segments: prev.segments.filter(
                      (s) =>
                        !(
                          s.fromPointId ===
                            prev.controlPoints[prev.controlPoints.length - 1]?.id &&
                          s.toPointId === prev.controlPoints[0]?.id
                        )
                    ),
                    updatedAt: new Date().toISOString(),
                  }))
                }
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold cursor-pointer"
              >
                ↺ Re-Open Tunnel Shape (Leave Closing Portion Open)
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmAndGoToPhotos}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Custom Shape &amp; Go to Add Pictures →
            </button>
            </div>
          </aside>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 3: IMPORT DWG / DXF
         ==================================================================== */}
      {mainTab === 'dxf_import' && (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Import Tunnel Cross-Section (DWG / DXF)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload your AutoCAD `.dxf` or `.dwg` cross-section file to extract exact 1m-scaled dimensions for {settings.locationName || 'this location'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sampleDxf = generateSampleTunnelDXF(8.4, 7.2, 4.2);
                  const blob = new Blob([sampleDxf], { type: 'application/dxf' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sample_tunnel_profile.dxf';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono border border-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Sample DXF
              </button>
            </div>

            <input
              ref={dxfFileInputRef}
              type="file"
              accept=".dxf,.dwg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadCadFile(file);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => dxfFileInputRef.current?.click()}
              className="w-full py-10 rounded-xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-950/60 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-8 h-8 text-cyan-400" />
              <span className="text-sm font-semibold text-white">
                Click to Select .DWG or .DXF File
              </span>
              <span className="text-xs font-mono text-slate-400">
                Supports LINE, LWPOLYLINE, POLYLINE &amp; ARC entities
              </span>
            </button>

            {dxfStatusMessage && (
              <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs font-mono text-cyan-300">
                {dxfStatusMessage}
              </div>
            )}

            {dxfImportedGeometry && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-3.5">
                <div className="text-xs font-mono font-bold text-emerald-300">
                  EXTRACTED CAD DIMENSIONS
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Width (W)</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {dxfImportedGeometry.width.toFixed(2)} m
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Height (H)</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {dxfImportedGeometry.height.toFixed(2)} m
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400">Wall Height</div>
                    <div className="text-sm font-bold text-emerald-300 mt-0.5">
                      {dxfImportedGeometry.wallHeight.toFixed(2)} m
                    </div>
                  </div>
                </div>

                {/* Ask Full Face or Top Heading + Benching Details for Imported CAD Shape */}
                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  <div className="text-xs font-mono font-bold text-amber-300 uppercase">
                    Excavation Stage: Full Face or Top Heading?
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExcavationStageMode('FULL_FACE')}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold cursor-pointer ${
                        excavationStageMode === 'FULL_FACE'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                    >
                      1. Full Face Section
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcavationStageMode('TOP_HEADING')}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold cursor-pointer ${
                        excavationStageMode === 'TOP_HEADING'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      2. Top Heading (Benching Details)
                    </button>
                  </div>

                  {excavationStageMode === 'TOP_HEADING' && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-amber-500/40 grid grid-cols-3 gap-2.5 text-xs font-mono">
                      <label className="space-y-1">
                        <span className="text-[10px] text-amber-300 font-bold block">
                          Bench Height Removed (m)
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.2"
                          value={benchHeightInput}
                          onChange={(e) => {
                            setBenchHeightInput(e.target.value);
                            setLeftBenchHeightInput(e.target.value);
                            setRightBenchHeightInput(e.target.value);
                          }}
                          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-amber-500/60 text-white font-bold"
                        />
                      </label>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-cyan-300">Top Heading H</div>
                        <div className="font-bold text-white mt-0.5">
                          {Math.max(
                            1.0,
                            dxfImportedGeometry.height - (parseFloat(benchHeightInput) || 2.5)
                          ).toFixed(2)}{' '}
                          m
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-emerald-300">Top Heading Wall</div>
                        <div className="font-bold text-emerald-300 mt-0.5">
                          {Math.max(
                            0.4,
                            dxfImportedGeometry.wallHeight - (parseFloat(benchHeightInput) || 2.5)
                          ).toFixed(2)}{' '}
                          m
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmAndGoToPhotos}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save CAD Shape &amp; Go to Add Pictures →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
