import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  Compass,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  Droplet,
  Edit2,
  Eye,
  GitMerge,
  Grid,
  Hand,
  Hash,
  Layers,
  Maximize2,
  Minus,
  Moon,
  Move,
  PenTool,
  Plus,
  Ruler,
  Save,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  ContinuousStripLithologyZone,
  ContinuousStripTrace,
  ContinuousStripWaterSymbol,
  ContinuousTunnelStripDataset,
  Point2D,
  resolveStripTraceColor,
  runAiTrendAlignmentOnDataset,
  StripGroundwaterId,
  StripRockTypeId,
  StripStructureTypeId,
} from '../engine/continuous3DStripEngine';
import { ContinuousTunnel3DCanvas } from './ContinuousTunnel3DCanvas';

export interface EswaCadContinuousStripModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ContinuousTunnelStripDataset;
  onSaveDataset: (updatedDataset: ContinuousTunnelStripDataset) => void;
}

export type CadToolType =
  | 'select'
  | 'pan'
  | 'draw_joint'
  | 'move_joint'
  | 'edit_joint'
  | 'edit_text'
  | 'merge_joint'
  | 'delete_joint'
  | 'add_lithology'
  | 'place_feature'
  | 'place_water'
  | 'place_support'
  | 'measure';

function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

/** Interactive 360° Geological Compass Rose Wheel */
export function CompassRoseWheel({
  dipDirectionDeg,
  onChangeDipDir,
}: {
  dipDirectionDeg: number;
  onChangeDipDir: (deg: number) => void;
}) {
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const calculateAngle = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let deg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (deg < 0) deg += 360;
    onChangeDipDir(deg % 360);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    setIsInteracting(true);
    calculateAngle(e.clientX, e.clientY);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isInteracting) {
      calculateAngle(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsInteracting(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const needleAngleRad = ((dipDirectionDeg - 90) * Math.PI) / 180;
  const needleLength = 34;
  const nx = 50 + Math.cos(needleAngleRad) * needleLength;
  const ny = 50 + Math.sin(needleAngleRad) * needleLength;

  return (
    <div className="flex flex-col items-center select-none py-1">
      <svg
        ref={wheelRef}
        viewBox="0 0 100 100"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-24 h-24 sm:w-28 sm:h-28 cursor-pointer touch-none filter drop-shadow"
      >
        <circle cx="50" cy="50" r="46" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
        <circle cx="50" cy="50" r="39" fill="#09090b" stroke="#27272a" strokeWidth="1" />

        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const isCardinal = deg % 90 === 0;
          const r1 = isCardinal ? 36 : 40;
          const r2 = 45;
          return (
            <line
              key={deg}
              x1={50 + Math.cos(rad) * r1}
              y1={50 + Math.sin(rad) * r1}
              x2={50 + Math.cos(rad) * r2}
              y2={50 + Math.sin(rad) * r2}
              stroke={isCardinal ? '#f97316' : '#71717a'}
              strokeWidth={isCardinal ? 1.6 : 0.8}
            />
          );
        })}

        <text x="50" y="16" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">N</text>
        <text x="86" y="53" fill="#e4e4e7" fontSize="7.5" fontWeight="bold" textAnchor="middle">E</text>
        <text x="50" y="89" fill="#e4e4e7" fontSize="7.5" fontWeight="bold" textAnchor="middle">S</text>
        <text x="14" y="53" fill="#e4e4e7" fontSize="7.5" fontWeight="bold" textAnchor="middle">W</text>

        <circle cx="50" cy="50" r="4" fill="#f97316" />

        <line
          x1="50"
          y1="50"
          x2={nx}
          y2={ny}
          stroke="#f97316"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={nx} cy={ny} r="3" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
      </svg>
      <div className="text-[11px] font-mono text-orange-400 font-bold mt-1">
        {dipDirectionDeg.toString().padStart(3, '0')}° Azimuth
      </div>
    </div>
  );
}

/** Interactive Geological Clinometer (Dip / Plunge Angle 0–90°) */
export function InteractiveClinometerDial({
  dipDeg,
  onChangeDip,
}: {
  dipDeg: number;
  onChangeDip: (deg: number) => void;
}) {
  const dialRef = useRef<SVGSVGElement | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const calculateDip = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.22;
    const cy = rect.top + rect.height * 0.22;
    const dx = Math.max(1, clientX - cx);
    const dy = Math.max(0, clientY - cy);
    let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    deg = Math.max(0, Math.min(90, deg));
    onChangeDip(deg);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    setIsInteracting(true);
    calculateDip(e.clientX, e.clientY);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isInteracting) {
      calculateDip(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsInteracting(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const rad = (dipDeg * Math.PI) / 180;
  const radius = 62;
  const pivotX = 22;
  const pivotY = 22;
  const px = pivotX + Math.cos(rad) * radius;
  const py = pivotY + Math.sin(rad) * radius;

  return (
    <div className="flex flex-col items-center select-none py-1">
      <svg
        ref={dialRef}
        viewBox="0 0 100 100"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-24 h-24 sm:w-28 sm:h-28 cursor-pointer touch-none filter drop-shadow"
      >
        <path
          d={`M ${pivotX} ${pivotY} L ${pivotX + radius + 4} ${pivotY} A ${radius + 4} ${radius + 4} 0 0 1 ${pivotX} ${pivotY + radius + 4} Z`}
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth="1.5"
        />
        {[0, 15, 30, 45, 60, 75, 90].map((angle) => {
          const aRad = (angle * Math.PI) / 180;
          const isMajor = angle % 30 === 0;
          const r1 = isMajor ? radius - 8 : radius - 4;
          const r2 = radius + 2;
          const x1 = pivotX + Math.cos(aRad) * r1;
          const y1 = pivotY + Math.sin(aRad) * r1;
          const x2 = pivotX + Math.cos(aRad) * r2;
          const y2 = pivotY + Math.sin(aRad) * r2;
          return (
            <g key={angle}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMajor ? '#f59e0b' : '#71717a'}
                strokeWidth={isMajor ? 1.5 : 0.8}
              />
              {isMajor && (
                <text
                  x={pivotX + Math.cos(aRad) * (radius - 14)}
                  y={pivotY + Math.sin(aRad) * (radius - 14) + 3}
                  fill="#d4d4d8"
                  fontSize="6.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {angle}°
                </text>
              )}
            </g>
          );
        })}
        {/* Baseline references */}
        <line x1={pivotX} y1={pivotY} x2={pivotX + radius + 2} y2={pivotY} stroke="#71717a" strokeWidth="1" strokeDasharray="2 2" />
        <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY + radius + 2} stroke="#71717a" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={pivotX} cy={pivotY} r="3.5" fill="#f59e0b" />
        {/* Clinometer Pointer Arm */}
        <line x1={pivotX} y1={pivotY} x2={px} y2={py} stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={px} cy={py} r="3" fill="#fbbf24" stroke="#ffffff" strokeWidth="1" />
      </svg>
      <div className="text-[11px] font-mono text-amber-400 font-bold mt-1">
        {dipDeg.toString().padStart(2, '0')}° Dip Angle
      </div>
    </div>
  );
}

export const ROCK_TYPES: Array<{ id: StripRockTypeId; label: string; color: string; pattern: string }> = [
  { id: 'Qtz', label: 'Quartzite (Qtz)', color: '#d97706', pattern: 'dots' },
  { id: 'Ph', label: 'Phyllite (Ph)', color: '#0284c7', pattern: 'lines' },
  { id: 'QP', label: 'Interbedded Quartzite & Phyllite (QP)', color: '#854d0e', pattern: 'hatch' },
  { id: 'Gr', label: 'Granite (Gr)', color: '#dc2626', pattern: 'cross' },
  { id: 'Gn', label: 'Gneiss (Gn)', color: '#7c3aed', pattern: 'wavy' },
  { id: 'Sch', label: 'Schist (Sch)', color: '#4f46e5', pattern: 'foliation' },
  { id: 'Ss', label: 'Sandstone (Ss)', color: '#ca8a04', pattern: 'stipple' },
  { id: 'Sl', label: 'Siltstone / Shale (Sl)', color: '#65a30d', pattern: 'dashes' },
  { id: 'Ls', label: 'Limestone (Ls)', color: '#059669', pattern: 'brick' },
  { id: 'Bas', label: 'Basalt / Traps (Bas)', color: '#475569', pattern: 'solid' },
  { id: 'FaultGouge', label: 'Fault Breccia / Gouge', color: '#b91c1c', pattern: 'zigzag' },
];

export const JOINT_SETS: Array<{
  id: string;
  name: string;
  structureType: StripStructureTypeId;
  defaultDipDir: number;
  defaultDip: number;
  color: string;
}> = [
  { id: 'J1', name: 'Joint Set 1 (J1)', structureType: 'Bedding/Foliation', defaultDipDir: 140, defaultDip: 65, color: '#3b82f6' },
  { id: 'J2', name: 'Joint Set 2 (J2)', structureType: 'Joint', defaultDipDir: 220, defaultDip: 70, color: '#f97316' },
  { id: 'J3', name: 'Joint Set 3 (J3)', structureType: 'Joint', defaultDipDir: 350, defaultDip: 50, color: '#a855f7' },
  { id: 'J4', name: 'Joint Set 4 (J4)', structureType: 'Joint', defaultDipDir: 80, defaultDip: 85, color: '#06b6d4' },
  { id: 'Random', name: 'Random Joint (R)', structureType: 'Joint', defaultDipDir: 180, defaultDip: 45, color: '#10b981' },
  { id: 'Shear', name: 'Shear Zone / Seam', structureType: 'Shear Zone', defaultDipDir: 145, defaultDip: 75, color: '#ef4444' },
  { id: 'Fault', name: 'Major Fault Line', structureType: 'Major Fault', defaultDipDir: 160, defaultDip: 80, color: '#dc2626' },
];

export const EswaCadContinuousStripModal: React.FC<EswaCadContinuousStripModalProps> = ({
  isOpen,
  onClose,
  dataset,
  onSaveDataset,
}) => {
  // Working copy of dataset for CAD editing
  const [currentDataset, setCurrentDataset] = useState<ContinuousTunnelStripDataset>(() => ({
    ...dataset,
    traces: [...(dataset.traces || [])],
    lithologyZones: [...(dataset.lithologyZones || [])],
    waterSymbols: [...(dataset.waterSymbols || [])],
    pulls: [...(dataset.pulls || [])],
  }));

  // Re-sync if dataset prop changes
  useEffect(() => {
    setCurrentDataset({
      ...dataset,
      traces: [...(dataset.traces || [])],
      lithologyZones: [...(dataset.lithologyZones || [])],
      waterSymbols: [...(dataset.waterSymbols || [])],
      pulls: [...(dataset.pulls || [])],
    });
  }, [dataset]);

  // Undo / Redo history
  const [history, setHistory] = useState<ContinuousTunnelStripDataset[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const pushHistory = useCallback((nextDataset: ContinuousTunnelStripDataset) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, nextDataset];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // CAD Environment settings
  const [activeTool, setActiveTool] = useState<CadToolType>('select');
  // Pure white background requested by user
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [cadViewMode, setCadViewMode] = useState<'2D_UNWRAPPED' | '3D_CONTINUOUS'>('2D_UNWRAPPED');
  // Dedicated Canvas Text Editing state
  const [editingTextTraceId, setEditingTextTraceId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');
  const [editingTextOrientation, setEditingTextOrientation] = useState<string>('');

  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridStepM, setGridStepM] = useState<number>(0.5);
  const [showSupportLayer, setShowSupportLayer] = useState<boolean>(true);
  const [showJointLayer, setShowJointLayer] = useState<boolean>(true);
  const [showLithologyLayer, setShowLithologyLayer] = useState<boolean>(true);
  const [showWaterLayer, setShowWaterLayer] = useState<boolean>(true);
  const [showPullsLayer, setShowPullsLayer] = useState<boolean>(true);

  // Canvas Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Coordinate HUD Readout
  const [mouseCoord, setMouseCoord] = useState<{ chainage: number; yPerimeter: number; zone: string }>({
    chainage: 0,
    yPerimeter: 0,
    zone: 'Crown',
  });

  // Selected Object for Property Inspector
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<'trace' | 'lithology' | 'water' | 'pull' | null>(null);

  // Interactive Vertex & Joint Dragging
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [isDraggingTrace, setIsDraggingTrace] = useState<boolean>(false);
  const [dragStartWorld, setDragStartWorld] = useState<{ x: number; y: number } | null>(null);
  const [dragOriginalPoints, setDragOriginalPoints] = useState<Point2D[]>([]);
  const [hoveredTraceId, setHoveredTraceId] = useState<string | null>(null);
  const [hoveredVertexIdx, setHoveredVertexIdx] = useState<number | null>(null);

  // Merge Joint State
  const [mergeSourceTraceId, setMergeSourceTraceId] = useState<string | null>(null);
  const [mergeTargetTraceId, setMergeTargetTraceId] = useState<string | null>(null);

  // Measure Tape State
  const [measureStartPoint, setMeasureStartPoint] = useState<Point2D | null>(null);

  // Sidebar Tab
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);
    const [sidebarTab, setSidebarTab] = useState<'properties' | 'lithology' | 'previous_joints' | 'features' | 'layers'>('properties');
  const [searchJointQuery, setSearchJointQuery] = useState<string>('');
  const [nudgeStepM, setNudgeStepM] = useState<number>(0.2);

  // 1-Click Fill Span States
  const [fillSpanFromCh, setFillSpanFromCh] = useState<number>(dataset.viewFromRd ?? 0);
  const [fillSpanToCh, setFillSpanToCh] = useState<number>(dataset.viewToRd ?? 30);
  const [fillSpanRockType, setFillSpanRockType] = useState<StripRockTypeId>('Qtz');
  const [fillSpanZoneType, setFillSpanZoneType] = useState<'all' | 'crown' | 'leftWall' | 'rightWall'>('all');

  // Active Drawing Buffer for multi-point lines / zones
  const [activeDraftPoints, setActiveDraftPoints] = useState<Point2D[]>([]);

  // Selected Creation Preset
  const [selectedJointSetId, setSelectedJointSetId] = useState<string>('J1');
  const [selectedRockTypeId, setSelectedRockTypeId] = useState<StripRockTypeId>('Qtz');
  const [selectedWaterCondition, setSelectedWaterCondition] = useState<StripGroundwaterId>('Dripping');

  // AutoCAD 2026 Workflow Ribbon State
  const [cadRibbonTab, setCadRibbonTab] = useState<
    'HOME' | 'DISCONTINUITIES' | 'STRATA' | 'SUPPORT_WATER' | 'EXPORT_3D'
  >('HOME');
  const [cadRibbonCollapsed, setCadRibbonCollapsed] = useState<boolean>(false);

  // AutoCAD 2026 Interactive Command Line & Real-Time Status Bar
  const [cadCommandInput, setCadCommandInput] = useState<string>('');
  const [, setCadCommandHistory] = useState<string[]>([
    'ESWACAD 2026 Continuous 3D Strip Workspace Loaded.',
    'Ready. Commands: L, PL, M, PE, MERGE, E, LITH, WATER, SUPPORT, DIST, AI, ZOOM, OSNAP, DYN, F3, F7, F8, F9, F12.',
  ]);
  const [cadStatusMessage, setCadStatusMessage] = useState<string>('Ready.');

  // AutoCAD Mode Toggles
  const [orthoMode, setOrthoMode] = useState<boolean>(false); // F8
  const [polarTracking, setPolarTracking] = useState<boolean>(true); // F10
  const [cadOsnapEnabled, setCadOsnapEnabled] = useState<boolean>(true); // F3
  const [cadDynInputEnabled, setCadDynInputEnabled] = useState<boolean>(true); // F12
  const [lineWeightDisplay, setLineWeightDisplay] = useState<boolean>(true);

  // Live Cursor Coordinates & Object Snap (OSNAP - F3) Detection
  const [cursorCoords, setCursorCoords] = useState<{ ch: number; yPerim: number; screenX: number; screenY: number } | null>(null);
  const [hoverOsnap, setHoverOsnap] = useState<{ x: number; y: number; type: 'ENDPOINT' | 'MIDPOINT'; label: string } | null>(null);

  // Tunnel Geometry Bounds
  const fromRd = currentDataset.viewFromRd ?? 0;
  const toRd = currentDataset.viewToRd ?? 30;
  const totalLengthM = Math.max(1, toRd - fromRd);

  // Total unwrapped perimeter (m) = Left Wall + Crown Arch + Right Wall
  const leftWallHeight = currentDataset.leftWallHeightM || currentDataset.leftWallArcLengthM || 3.75;
  const crownWidth = currentDataset.crownWidthM || currentDataset.crownArcLengthM || 7.5;
  const rightWallHeight = currentDataset.rightWallHeightM || currentDataset.rightWallArcLengthM || 3.75;
  const totalPerimeterM = leftWallHeight + crownWidth + rightWallHeight;

  // Scale Factors for Screen
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Conversion: Chainage X (meters) -> Canvas Screen X (pixels)
  const worldToScreenX = useCallback((ch: number) => {
    const pxPerMeter = 45 * zoom;
    return panOffset.x + (ch - fromRd) * pxPerMeter;
  }, [panOffset.x, fromRd, zoom]);

  // Conversion: Unwrapped Perimeter Y (meters) -> Canvas Screen Y (pixels)
  const worldToScreenY = useCallback((yM: number) => {
    const pxPerMeter = 28 * zoom;
    return panOffset.y + yM * pxPerMeter;
  }, [panOffset.y, zoom]);

  // Inverse: Canvas Screen X -> Chainage X (meters)
  const screenToWorldX = useCallback((screenX: number) => {
    const pxPerMeter = 45 * zoom;
    const rawCh = fromRd + (screenX - panOffset.x) / pxPerMeter;
    if (!snapToGrid) return Math.round(rawCh * 100) / 100;
    return Math.round(rawCh / gridStepM) * gridStepM;
  }, [panOffset.x, fromRd, zoom, snapToGrid, gridStepM]);

  // Inverse: Canvas Screen Y -> Unwrapped Perimeter Y (meters)
  const screenToWorldY = useCallback((screenY: number) => {
    const pxPerMeter = 28 * zoom;
    const rawY = (screenY - panOffset.y) / pxPerMeter;
    if (!snapToGrid) return Math.max(0, Math.min(totalPerimeterM, Math.round(rawY * 100) / 100));
    return Math.max(0, Math.min(totalPerimeterM, Math.round(rawY / gridStepM) * gridStepM));
  }, [panOffset.y, zoom, snapToGrid, gridStepM, totalPerimeterM]);

  // Determine which tunnel surface segment a Y perimeter coordinate belongs to
  const getZoneLabelForY = useCallback((yM: number): string => {
    if (yM < leftWallHeight) return 'Left Wall';
    if (yM < leftWallHeight + crownWidth) return 'Crown Arch';
    return 'Right Wall';
  }, [leftWallHeight, crownWidth]);

  // Reset View to Fit Entire Strip
  const handleFitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const availableW = canvas.width - 120;
    const availableH = canvas.height - 120;

    const scaleX = availableW / (totalLengthM * 45);
    const scaleY = availableH / (totalPerimeterM * 28);
    const newZoom = Math.max(0.4, Math.min(2.5, Math.min(scaleX, scaleY)));

    setZoom(newZoom);
    setPanOffset({
      x: 60,
      y: 60,
    });
  }, [totalLengthM, totalPerimeterM]);

  // Focal Point Zoom Helper (keeps focalX, focalY stationary in world space)
  const handleZoomAtPoint = useCallback((factor: number, focalX: number, focalY: number) => {
    setZoom((prevZoom) => {
      const newZoom = Math.max(0.15, Math.min(10.0, prevZoom * factor));
      if (Math.abs(newZoom - prevZoom) < 0.0001) return prevZoom;
      const ratio = newZoom / prevZoom;
      setPanOffset((prevPan) => ({
        x: focalX - (focalX - prevPan.x) * ratio,
        y: focalY - (focalY - prevPan.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  // Spacebar pan listener
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        setIsSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Native Wheel and Touch Listeners on Canvas for Zoom and Pinch Move
  useEffect(() => {
    if (!isOpen || cadViewMode !== '2D_UNWRAPPED') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      handleZoomAtPoint(factor, mouseX, mouseY);
    };

    let touchInitialDist = 0;
    let touchPrevMid = { x: 0, y: 0 };
    let singleTouchPrev = { x: 0, y: 0 };
    let isSingleTouchPanning = false;

    const onTouchStart = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchInitialDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        touchPrevMid = { x: midX, y: midY };
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        singleTouchPrev = { x: t.clientX - rect.left, y: t.clientY - rect.top };
        isSingleTouchPanning = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches.length === 2 && touchInitialDist > 5) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        const factor = dist / touchInitialDist;
        touchInitialDist = dist;
        handleZoomAtPoint(factor, midX, midY);

        const deltaX = midX - touchPrevMid.x;
        const deltaY = midY - touchPrevMid.y;
        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          setPanOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        }
        touchPrevMid = { x: midX, y: midY };
      } else if (e.touches.length === 1 && isSingleTouchPanning) {
        if (activeTool === 'pan' || activeTool === 'select' || isSpaceHeld) {
          e.preventDefault();
          const t = e.touches[0];
          const currX = t.clientX - rect.left;
          const currY = t.clientY - rect.top;
          const dx = currX - singleTouchPrev.x;
          const dy = currY - singleTouchPrev.y;
          setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
          singleTouchPrev = { x: currX, y: currY };
        }
      }
    };

    const onTouchEnd = () => {
      touchInitialDist = 0;
      isSingleTouchPanning = false;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen, cadViewMode, handleZoomAtPoint, activeTool, isSpaceHeld]);

  // Initial Auto-Fit on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        handleFitToScreen();
      }, 50);
    }
  }, [isOpen, handleFitToScreen]);

  // Update selected trace dip and dip direction in real-time
  const updateSelectedTraceDip = useCallback((newDipDir: number, newDipAngle: number) => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    let safeDir = Math.round(newDipDir) % 360;
    if (safeDir < 0) safeDir += 360;
    const safeAngle = Math.max(0, Math.min(90, Math.round(newDipAngle)));

    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) => {
        if (t.id !== selectedObjectId) return t;
        return {
          ...t,
          dipDirectionDeg: safeDir,
          dipDeg: safeAngle,
          orientationLabel: `${safeDir.toString().padStart(3, '0')}/${safeAngle.toString().padStart(2, '0')}`,
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  }, [selectedObjectId, selectedObjectType]);

  // Merge Two Joint Traces into a single continuous trace
  const handleExecuteMergeTraces = useCallback((id1: string, id2: string) => {
    const t1 = currentDataset.traces?.find((t) => t.id === id1);
    const t2 = currentDataset.traces?.find((t) => t.id === id2);
    if (!t1 || !t2 || !t1.points?.length || !t2.points?.length) return;

    const p1_start = t1.points[0];
    const p1_end = t1.points[t1.points.length - 1];
    const p2_start = t2.points[0];
    const p2_end = t2.points[t2.points.length - 1];

    const d_end1_start2 = Math.hypot(p1_end.x - p2_start.x, p1_end.y - p2_start.y);
    const d_end1_end2 = Math.hypot(p1_end.x - p2_end.x, p1_end.y - p2_end.y);
    const d_start1_start2 = Math.hypot(p1_start.x - p2_start.x, p1_start.y - p2_start.y);
    const d_start1_end2 = Math.hypot(p1_start.x - p2_end.x, p1_start.y - p2_end.y);

    let mergedPoints: Point2D[] = [];
    const minD = Math.min(d_end1_start2, d_end1_end2, d_start1_start2, d_start1_end2);

    if (minD === d_end1_start2) {
      mergedPoints = [...t1.points, ...t2.points];
    } else if (minD === d_end1_end2) {
      mergedPoints = [...t1.points, ...[...t2.points].reverse()];
    } else if (minD === d_start1_start2) {
      mergedPoints = [...[...t1.points].reverse(), ...t2.points];
    } else {
      mergedPoints = [...t2.points, ...t1.points];
    }

    const len1 = Math.max(1, t1.points.length);
    const len2 = Math.max(1, t2.points.length);
    const totalLen = len1 + len2;
    const avgDipDir = Math.round((t1.dipDirectionDeg * len1 + t2.dipDirectionDeg * len2) / totalLen) % 360;
    const avgDip = Math.max(0, Math.min(90, Math.round((t1.dipDeg * len1 + t2.dipDeg * len2) / totalLen)));

    const mergedTrace: ContinuousStripTrace = {
      ...t1,
      id: `${t1.id}_merged`,
      points: mergedPoints,
      rawPoints: mergedPoints,
      dipDirectionDeg: avgDipDir,
      dipDeg: avgDip,
      orientationLabel: `${String(avgDipDir).padStart(3, '0')}/${String(avgDip).padStart(2, '0')}`,
    };

    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: [...(prev.traces || []).filter((t) => t.id !== id1 && t.id !== id2), mergedTrace],
      updatedAt: new Date().toISOString(),
    }));

    setSelectedObjectId(mergedTrace.id);
    setSelectedObjectType('trace');
    setMergeSourceTraceId(null);
    setMergeTargetTraceId(null);
  }, [currentDataset, pushHistory]);

  // 1-Click Fill Between Chainages for Lithology Strata
  const handleFillBetweenChainages = () => {
    let yTop = 0;
    let yBottom = totalPerimeterM;

    if (fillSpanZoneType === 'leftWall') {
      yTop = 0;
      yBottom = leftWallHeight;
    } else if (fillSpanZoneType === 'crown') {
      yTop = leftWallHeight;
      yBottom = leftWallHeight + crownWidth;
    } else if (fillSpanZoneType === 'rightWall') {
      yTop = leftWallHeight + crownWidth;
      yBottom = totalPerimeterM;
    }

    const rockDef = ROCK_TYPES.find((r) => r.id === fillSpanRockType) || ROCK_TYPES[0];
    const newZone: ContinuousStripLithologyZone = {
      id: `litho-fill-${Date.now()}`,
      rockType: fillSpanRockType,
      label: `${rockDef.label} (CH ${fillSpanFromCh}m–${fillSpanToCh}m)`,
      codeSymbol: rockDef.id,
      polygon: [
        { x: fillSpanFromCh, y: yTop },
        { x: fillSpanToCh, y: yTop },
        { x: fillSpanToCh, y: yBottom },
        { x: fillSpanFromCh, y: yBottom },
      ],
    };

    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      lithologyZones: [...(prev.lithologyZones || []), newZone],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedObjectId(newZone.id);
    setSelectedObjectType('lithology');
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background matching Underground Face Mapping & CAD White Canvas
    ctx.fillStyle = isDarkMode ? '#0a0d14' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 1. Draw CAD Engineering Grid
    const gridMajorSpacingX = 5; // Every 5 meters
    const gridMinorSpacingX = 1; // Every 1 meter
    const startX = worldToScreenX(fromRd);
    const endX = worldToScreenX(toRd);
    const topY = worldToScreenY(0);
    const botY = worldToScreenY(totalPerimeterM);

    // Pure white background for tunnel strip bounds
    ctx.fillStyle = isDarkMode ? '#111726' : '#ffffff';
    ctx.fillRect(startX, topY, endX - startX, botY - topY);

    // Strip perimeter bounding box (subtle outer boundary, never disturbs inside drawings)
    ctx.strokeStyle = isDarkMode ? '#334155' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, topY, endX - startX, botY - topY);

    // Horizontal Springlines (Left Wall Springline, Right Wall Springline)
    // Rendered as light, unobtrusive reference lines so they never disturb inside canvas content
    const spg1Y = worldToScreenY(leftWallHeight);
    const spg2Y = worldToScreenY(leftWallHeight + crownWidth);

    ctx.strokeStyle = isDarkMode ? 'rgba(14, 165, 233, 0.4)' : 'rgba(2, 132, 199, 0.28)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(startX, spg1Y);
    ctx.lineTo(endX, spg1Y);
    ctx.moveTo(startX, spg2Y);
    ctx.lineTo(endX, spg2Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Wall Label Annotations placed cleanly with safe clamping so text is never cut off
    const leftTextX = Math.max(76, startX - 10);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3.5;
    ctx.fillStyle = isDarkMode ? '#38bdf8' : '#334155';
    
    ctx.strokeText('LEFT WALL', leftTextX, topY + (spg1Y - topY) / 2);
    ctx.fillText('LEFT WALL', leftTextX, topY + (spg1Y - topY) / 2);

    ctx.strokeText('CROWN ARCH', leftTextX, spg1Y + (spg2Y - spg1Y) / 2);
    ctx.fillText('CROWN ARCH', leftTextX, spg1Y + (spg2Y - spg1Y) / 2);

    ctx.strokeText('RIGHT WALL', leftTextX, spg2Y + (botY - spg2Y) / 2);
    ctx.fillText('RIGHT WALL', leftTextX, spg2Y + (botY - spg2Y) / 2);

    // Vertical Chainage Grid Lines
    for (let ch = Math.ceil(fromRd); ch <= toRd; ch += gridMinorSpacingX) {
      const scrX = worldToScreenX(ch);
      const isMajor = ch % gridMajorSpacingX === 0;

      ctx.strokeStyle = isMajor
        ? (isDarkMode ? '#334155' : '#e2e8f0')
        : (isDarkMode ? '#1e293b' : '#f1f5f9');
      ctx.lineWidth = isMajor ? 1 : 0.5;

      ctx.beginPath();
      ctx.moveTo(scrX, topY);
      ctx.lineTo(scrX, botY);
      ctx.stroke();

      // Chainage Tick Marks & Numbers on top & bottom with safe boundary clamping
      if (isMajor) {
        const topChY = Math.max(16, topY - 10);
        const botChY = Math.min(canvas.height - 10, botY + 18);
        ctx.fillStyle = isDarkMode ? '#f97316' : '#ea580c';
        ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.font = 'bold 9.5px monospace';
        ctx.strokeText(`CH ${ch.toFixed(1)}m`, scrX, topChY);
        ctx.fillText(`CH ${ch.toFixed(1)}m`, scrX, topChY);
        ctx.strokeText(`CH ${ch.toFixed(1)}m`, scrX, botChY);
        ctx.fillText(`CH ${ch.toFixed(1)}m`, scrX, botChY);
      }
    }

    // 2. Render Lithology Zones Layer
    if (showLithologyLayer) {
      for (const zone of currentDataset.lithologyZones || []) {
        if (!zone.polygon || zone.polygon.length < 3) continue;

        const isSelected = selectedObjectType === 'lithology' && selectedObjectId === zone.id;
        const rockDef = ROCK_TYPES.find((r) => r.id === zone.rockType) || ROCK_TYPES[0];

        ctx.beginPath();
        zone.polygon.forEach((pt, i) => {
          const scrX = worldToScreenX(pt.x);
          const scrY = worldToScreenY(pt.y);
          if (i === 0) ctx.moveTo(scrX, scrY);
          else ctx.lineTo(scrX, scrY);
        });
        ctx.closePath();

        ctx.fillStyle = isSelected
          ? 'rgba(249, 115, 22, 0.45)'
          : `${rockDef.color}38`;
        ctx.fill();

        // Procedural geological rock hatch patterns
        ctx.save();
        ctx.clip();
        const xs = zone.polygon.map((p) => worldToScreenX(p.x));
        const ys = zone.polygon.map((p) => worldToScreenY(p.y));
        const pMinX = Math.min(...xs);
        const pMaxX = Math.max(...xs);
        const pMinY = Math.min(...ys);
        const pMaxY = Math.max(...ys);

        ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)';
        ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)';
        ctx.lineWidth = 0.8;

        if (rockDef.pattern === 'dots' || rockDef.id === 'Qtz' || rockDef.id === 'Ss') {
          for (let px = pMinX; px <= pMaxX; px += 14) {
            for (let py = pMinY; py <= pMaxY; py += 14) {
              ctx.beginPath();
              ctx.arc(px + ((Math.floor(py) % 28) ? 7 : 0), py, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (rockDef.pattern === 'cross' || rockDef.id === 'Gr') {
          for (let px = pMinX; px <= pMaxX; px += 20) {
            for (let py = pMinY; py <= pMaxY; py += 20) {
              ctx.beginPath();
              ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py);
              ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3);
              ctx.stroke();
            }
          }
        } else if (rockDef.pattern === 'brick' || rockDef.id === 'Ls') {
          const bH = 10;
          const bW = 22;
          for (let py = pMinY; py <= pMaxY; py += bH) {
            ctx.beginPath();
            ctx.moveTo(pMinX, py); ctx.lineTo(pMaxX, py);
            ctx.stroke();
            const rowIdx = Math.floor((py - pMinY) / bH);
            const shift = (rowIdx % 2) * (bW / 2);
            for (let px = pMinX + shift; px <= pMaxX; px += bW) {
              ctx.beginPath();
              ctx.moveTo(px, py); ctx.lineTo(px, py + bH);
              ctx.stroke();
            }
          }
        } else if (rockDef.pattern === 'lines' || rockDef.id === 'Ph' || rockDef.id === 'Sch') {
          for (let px = pMinX - (pMaxY - pMinY); px <= pMaxX; px += 14) {
            ctx.beginPath();
            ctx.moveTo(px, pMinY);
            ctx.lineTo(px + (pMaxY - pMinY) * 0.7, pMaxY);
            ctx.stroke();
          }
        } else if (rockDef.pattern === 'wavy' || rockDef.id === 'Gn') {
          for (let py = pMinY; py <= pMaxY; py += 14) {
            ctx.beginPath();
            for (let px = pMinX; px <= pMaxX; px += 10) {
              const wy = py + Math.sin(px * 0.1) * 3;
              if (px === pMinX) ctx.moveTo(px, wy);
              else ctx.lineTo(px, wy);
            }
            ctx.stroke();
          }
        } else if (rockDef.pattern === 'hatch' || rockDef.id === 'QP') {
          for (let px = pMinX - (pMaxY - pMinY); px <= pMaxX; px += 18) {
            ctx.beginPath();
            ctx.moveTo(px, pMinY); ctx.lineTo(px + (pMaxY - pMinY), pMaxY);
            ctx.moveTo(px + (pMaxY - pMinY), pMinY); ctx.lineTo(px, pMaxY);
            ctx.stroke();
          }
        }
        ctx.restore();

        ctx.strokeStyle = isSelected ? '#f97316' : rockDef.color;
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.stroke();

        // Draw rock type label in centroid - Clean text only (NO boxy design)
        if (zone.polygon.length > 0) {
          const avgX = zone.polygon.reduce((sum, p) => sum + p.x, 0) / zone.polygon.length;
          const avgY = zone.polygon.reduce((sum, p) => sum + p.y, 0) / zone.polygon.length;
          const lx = worldToScreenX(avgX);
          const ly = worldToScreenY(avgY);
          const lbl = zone.label || rockDef.label;

          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Clean white halo for readability without any box card
          ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 3;
          ctx.strokeText(lbl, lx, ly);
          ctx.fillStyle = isDarkMode ? '#f8fafc' : '#1e293b';
          ctx.fillText(lbl, lx, ly);
        }
      }
    }

    // 3. Render Excavation Pull Rounds Layer - Clean text only (NO boxy design)
    if (showPullsLayer) {
      for (const pull of currentDataset.pulls || []) {
        const pullStartX = worldToScreenX(pull.fromRd);
        const pullEndX = worldToScreenX(pull.toRd);
        const isSelected = selectedObjectType === 'pull' && selectedObjectId === pull.id;

        ctx.strokeStyle = isSelected ? '#fbbf24' : '#eab308';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(pullEndX, topY);
        ctx.lineTo(pullEndX, botY);
        ctx.stroke();
        ctx.setLineDash([]);

        const midX = (pullStartX + pullEndX) / 2;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.strokeText(`PULL #${pull.id.replace('round-', '')}`, midX, topY + 12);
        ctx.fillStyle = isDarkMode ? '#fef08a' : '#b45309';
        ctx.fillText(`PULL #${pull.id.replace('round-', '')}`, midX, topY + 12);
      }
    }

    // 4. Render Discontinuity Joint Traces Layer
    if (showJointLayer) {
      for (const trace of currentDataset.traces || []) {
        const points = trace.points || [];
        if (points.length < 2) continue;

        const isSelected = selectedObjectType === 'trace' && selectedObjectId === trace.id;
        const isHovered = hoveredTraceId === trace.id && !isSelected;
        const isMergeMaster = mergeSourceTraceId === trace.id;
        const isMergeTarget = mergeTargetTraceId === trace.id;
        const color = resolveStripTraceColor(trace);

        // Hover or Selection halo glow
        if (isSelected || isHovered || isMergeMaster || isMergeTarget) {
          ctx.beginPath();
          points.forEach((pt, i) => {
            const scrX = worldToScreenX(pt.x);
            const scrY = worldToScreenY(pt.y);
            if (i === 0) ctx.moveTo(scrX, scrY);
            else ctx.lineTo(scrX, scrY);
          });
          ctx.strokeStyle = isMergeMaster
            ? 'rgba(245, 158, 11, 0.65)'
            : isMergeTarget
            ? 'rgba(6, 182, 212, 0.65)'
            : isSelected
            ? 'rgba(251, 191, 36, 0.45)'
            : 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = isSelected || isMergeMaster || isMergeTarget ? 11 : 7;
          ctx.stroke();
        }

        ctx.beginPath();
        points.forEach((pt, i) => {
          const scrX = worldToScreenX(pt.x);
          const scrY = worldToScreenY(pt.y);
          if (i === 0) ctx.moveTo(scrX, scrY);
          else ctx.lineTo(scrX, scrY);
        });

        ctx.strokeStyle = isMergeMaster
          ? '#f59e0b'
          : isMergeTarget
          ? '#06b6d4'
          : isSelected
          ? '#fbbf24'
          : isHovered
          ? '#38bdf8'
          : color;
        ctx.lineWidth = isSelected || isMergeMaster ? 3.5 : (trace.fillingThickness === 'Thin' ? 1.8 : 2.8);

        if (trace.structureType === 'Shear Zone') {
          ctx.setLineDash([8, 3]);
        } else if (trace.structureType === 'Bedding/Foliation') {
          ctx.setLineDash([3, 3]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Highlight endpoints & Interactive Vertex Drag Handles
        if (isSelected || activeTool === 'edit_joint') {
          points.forEach((pt, i) => {
            const vx = worldToScreenX(pt.x);
            const vy = worldToScreenY(pt.y);
            const isVertexActive = draggingVertexIdx === i || hoveredVertexIdx === i;

            ctx.fillStyle = isVertexActive ? '#fbbf24' : '#06b6d4';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(vx, vy, isVertexActive ? 9 : 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#09090b';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, vx, vy);
          });

          // Draw Move icon / center badge at midpoint
          const midPt = points[Math.floor(points.length / 2)];
          const cx = worldToScreenX(midPt.x);
          const cy = worldToScreenY(midPt.y);

          ctx.fillStyle = '#1c1917';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✥', cx, cy);
        } else {
          points.forEach((pt) => {
            ctx.fillStyle = isHovered ? '#38bdf8' : color;
            ctx.beginPath();
            ctx.arc(worldToScreenX(pt.x), worldToScreenY(pt.y), 3, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Structural Geology Dip Tick & Dip Angle Label
        if (points.length >= 2) {
          const midIdx = Math.floor(points.length / 2);
          const p1 = points[Math.max(0, midIdx - 1)];
          const p2 = points[Math.min(points.length - 1, midIdx + 1)];
          const midPt = points[midIdx];

          const p1x = worldToScreenX(p1.x);
          const p1y = worldToScreenY(p1.y);
          const p2x = worldToScreenX(p2.x);
          const p2y = worldToScreenY(p2.y);
          const mx = worldToScreenX(midPt.x);
          const my = worldToScreenY(midPt.y);

          const segAngle = Math.atan2(p2y - p1y, p2x - p1x);
          const tickSide = trace.dipTickSide === 'left' ? -1 : 1;
          const tickLen = 15;
          const tickAngle = segAngle + (Math.PI / 2) * tickSide;

          const tx = mx + Math.cos(tickAngle) * tickLen;
          const ty = my + Math.sin(tickAngle) * tickLen;

          // Draw perpendicular tick
          ctx.strokeStyle = isSelected ? '#fbbf24' : color;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // Dip angle text - Clean pure text (NO boxy design)
          const lblX = tx + Math.cos(tickAngle) * 12;
          const lblY = ty + Math.sin(tickAngle) * 12;

          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 2.5;
          ctx.strokeText(`${trace.dipDeg}°`, lblX, lblY);
          ctx.fillStyle = isSelected ? '#ea580c' : (isDarkMode ? '#ffffff' : '#0f172a');
          ctx.fillText(`${trace.dipDeg}°`, lblX, lblY);

          // Joint Set / Custom Text Label - Clean pure text (NO boxy design, respects hideLabel/deleted text)
          if (!trace.hideLabel) {
            const displayLabel = trace.customLabel !== undefined ? trace.customLabel : trace.setId;
            if (displayLabel && displayLabel.trim() !== '') {
              const setBadgeX = mx - Math.cos(tickAngle) * 15;
              const setBadgeY = my - Math.sin(tickAngle) * 15;

              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeStyle = isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)';
              ctx.lineWidth = 3;
              ctx.strokeText(displayLabel, setBadgeX, setBadgeY);
              ctx.fillStyle = isSelected ? '#ea580c' : color;
              ctx.fillText(displayLabel, setBadgeX, setBadgeY);
            }
          }

          // HW / FW markers for faults/shears
          if (trace.showHwFw) {
            const hwX = mx + Math.cos(tickAngle) * 24;
            const hwY = my + Math.sin(tickAngle) * 24;
            const fwX = mx - Math.cos(tickAngle) * 24;
            const fwY = my - Math.sin(tickAngle) * 24;
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(trace.flipHwFw ? 'FW' : 'HW', hwX, hwY);
            ctx.fillStyle = '#3b82f6';
            ctx.fillText(trace.flipHwFw ? 'HW' : 'FW', fwX, fwY);
          }
        }
      }
    }

    // 5. Render Groundwater Inflow Symbols
    if (showWaterLayer) {
      for (const sym of currentDataset.waterSymbols || []) {
        const scrX = worldToScreenX(sym.position.x);
        const scrY = worldToScreenY(sym.position.y);
        const isSelected = selectedObjectType === 'water' && selectedObjectId === sym.id;

        ctx.fillStyle = isSelected ? '#38bdf8' : '#0284c7';
        ctx.beginPath();
        ctx.arc(scrX, scrY, isSelected ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('W', scrX, scrY + 3);

        if (sym.label) {
          ctx.fillStyle = isDarkMode ? '#38bdf8' : '#0284c7';
          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(sym.label, scrX + 10, scrY + 3.5);
        }
      }
    }

    // 6. Preview line between Merge Master & Target
    if (mergeSourceTraceId && mergeTargetTraceId) {
      const t1 = currentDataset.traces?.find((t) => t.id === mergeSourceTraceId);
      const t2 = currentDataset.traces?.find((t) => t.id === mergeTargetTraceId);
      if (t1 && t2 && t1.points?.length && t2.points?.length) {
        const p1_last = t1.points[t1.points.length - 1];
        const p2_first = t2.points[0];

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(worldToScreenX(p1_last.x), worldToScreenY(p1_last.y));
        ctx.lineTo(worldToScreenX(p2_first.x), worldToScreenY(p2_first.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 7. Render Measurement Ruler Line
    if (activeTool === 'measure' && measureStartPoint) {
      const mx = mouseCoord.chainage;
      const my = mouseCoord.yPerimeter;
      const x1 = worldToScreenX(measureStartPoint.x);
      const y1 = worldToScreenY(measureStartPoint.y);
      const x2 = worldToScreenX(mx);
      const y2 = worldToScreenY(my);

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      const distM = Math.hypot(mx - measureStartPoint.x, my - measureStartPoint.y);
      const dxM = Math.abs(mx - measureStartPoint.x);
      const dyM = Math.abs(my - measureStartPoint.y);
      const appDeg = Math.round((Math.atan2(dyM, dxM || 0.0001) * 180) / Math.PI);

      const midScrX = (x1 + x2) / 2;
      const midScrY = (y1 + y2) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(midScrX - 52, midScrY - 20, 104, 28);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.strokeRect(midScrX - 52, midScrY - 20, 104, 28);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${distM.toFixed(2)}m (∠${appDeg}°)`, midScrX, midScrY - 7);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`ΔX: ${dxM.toFixed(2)}m • ΔY: ${dyM.toFixed(2)}m`, midScrX, midScrY + 5);
    }

    // 8. Render Active Drafting Line / Points
    if (activeDraftPoints.length > 0) {
      ctx.beginPath();
      activeDraftPoints.forEach((pt, i) => {
        const scrX = worldToScreenX(pt.x);
        const scrY = worldToScreenY(pt.y);
        if (i === 0) ctx.moveTo(scrX, scrY);
        else ctx.lineTo(scrX, scrY);
      });
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      activeDraftPoints.forEach((pt) => {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(worldToScreenX(pt.x), worldToScreenY(pt.y), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 9. Crosshair Cursor at Mouse
    if (mouseCoord.chainage >= fromRd && mouseCoord.chainage <= toRd) {
      const curX = worldToScreenX(mouseCoord.chainage);
      const curY = worldToScreenY(mouseCoord.yPerimeter);

      ctx.strokeStyle = isDarkMode ? 'rgba(249, 115, 22, 0.4)' : 'rgba(234, 88, 12, 0.4)';
      ctx.lineWidth = 0.7;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(startX, curY);
      ctx.lineTo(endX, curY);
      ctx.moveTo(curX, topY);
      ctx.lineTo(curX, botY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [
    isDarkMode,
    fromRd,
    toRd,
    totalPerimeterM,
    leftWallHeight,
    crownWidth,
    worldToScreenX,
    worldToScreenY,
    currentDataset,
    showLithologyLayer,
    showJointLayer,
    showPullsLayer,
    showWaterLayer,
    selectedObjectId,
    selectedObjectType,
    activeDraftPoints,
    mouseCoord,
    hoveredTraceId,
    hoveredVertexIdx,
    draggingVertexIdx,
    mergeSourceTraceId,
    mergeTargetTraceId,
    activeTool,
    measureStartPoint,
  ]);

  // Handle Mouse Move on Canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setPanOffset({
        x: panOffset.x + (mouseX - panStart.x),
        y: panOffset.y + (mouseY - panStart.y),
      });
      setPanStart({ x: mouseX, y: mouseY });
      return;
    }

    const ch = screenToWorldX(mouseX);
    const yPerim = screenToWorldY(mouseY);
    setMouseCoord({
      chainage: ch,
      yPerimeter: yPerim,
      zone: getZoneLabelForY(yPerim),
    });
    setCursorCoords({ ch, yPerim, screenX: mouseX, screenY: mouseY });

    // 1. If dragging a specific vertex of the selected trace
    if (draggingVertexIdx !== null && selectedObjectId && selectedObjectType === 'trace') {
      setCurrentDataset((prev) => ({
        ...prev,
        traces: (prev.traces || []).map((t) => {
          if (t.id !== selectedObjectId) return t;
          const updatedPoints = [...(t.points || [])];
          if (updatedPoints[draggingVertexIdx]) {
            updatedPoints[draggingVertexIdx] = { x: ch, y: yPerim };
          }
          return {
            ...t,
            points: updatedPoints,
            rawPoints: updatedPoints,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    // 2. If dragging the entire trace (Move Joint tool)
    if (isDraggingTrace && dragStartWorld && selectedObjectId && selectedObjectType === 'trace') {
      const deltaX = ch - dragStartWorld.x;
      const deltaY = yPerim - dragStartWorld.y;
      setCurrentDataset((prev) => ({
        ...prev,
        traces: (prev.traces || []).map((t) => {
          if (t.id !== selectedObjectId) return t;
          const translated = dragOriginalPoints.map((p) => ({
            x: Math.round((p.x + deltaX) * 100) / 100,
            y: Math.max(0, Math.min(totalPerimeterM, Math.round((p.y + deltaY) * 100) / 100)),
          }));
          return {
            ...t,
            points: translated,
            rawPoints: translated,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    // 3. Hover detection for vertices and traces
    if (!isPanning) {
      let vHover: number | null = null;
      if (selectedObjectId && selectedObjectType === 'trace') {
        const selTrace = (currentDataset.traces || []).find((t) => t.id === selectedObjectId);
        if (selTrace) {
          (selTrace.points || []).forEach((pt, idx) => {
            const vx = worldToScreenX(pt.x);
            const vy = worldToScreenY(pt.y);
            if (Math.hypot(mouseX - vx, mouseY - vy) < 10) {
              vHover = idx;
            }
          });
        }
      }
      setHoveredVertexIdx(vHover);

      let tHover: string | null = null;
      if (vHover === null) {
        for (const trace of currentDataset.traces || []) {
          const pts = trace.points || [];
          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
            const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
            if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 8) {
              tHover = trace.id;
              break;
            }
          }
          if (tHover) break;
        }
      }
      setHoveredTraceId(tHover);

      // AutoCAD 2026 Object Snap (OSNAP - F3) Detection (Endpoint □ & Midpoint △)
      if (cadOsnapEnabled) {
        let snap: { x: number; y: number; type: 'ENDPOINT' | 'MIDPOINT'; label: string } | null = null;
        for (const trace of currentDataset.traces || []) {
          const pts = trace.points || [];
          for (let i = 0; i < pts.length; i++) {
            const sx = worldToScreenX(pts[i].x);
            const sy = worldToScreenY(pts[i].y);
            if (Math.hypot(mouseX - sx, mouseY - sy) < 14) {
              snap = {
                x: sx,
                y: sy,
                type: 'ENDPOINT',
                label: `Endpoint (${pts[i].x.toFixed(2)}m, ${pts[i].y.toFixed(2)}m)`,
              };
              break;
            }
            if (i < pts.length - 1) {
              const mx = (pts[i].x + pts[i + 1].x) / 2;
              const my = (pts[i].y + pts[i + 1].y) / 2;
              const smx = worldToScreenX(mx);
              const smy = worldToScreenY(my);
              if (Math.hypot(mouseX - smx, mouseY - smy) < 14) {
                snap = {
                  x: smx,
                  y: smy,
                  type: 'MIDPOINT',
                  label: `Midpoint (${mx.toFixed(2)}m, ${my.toFixed(2)}m)`,
                };
                break;
              }
            }
          }
          if (snap) break;
        }
        setHoverOsnap(snap);
      } else {
        setHoverOsnap(null);
      }
    }
  };

  // Handle Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Pan with Middle Click or when Pan tool active or Space key held
    if (e.button === 1 || e.button === 2 || e.shiftKey || (activeTool === 'select' && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: mouseX, y: mouseY });
      return;
    }

    if (e.button !== 0) return; // Only primary click for editing

    const ch = screenToWorldX(mouseX);
    const yPerim = screenToWorldY(mouseY);

    // MERGE JOINT TOOL
    if (activeTool === 'merge_joint') {
      for (const trace of currentDataset.traces || []) {
        const pts = trace.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
          const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
          if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 12) {
            if (!mergeSourceTraceId) {
              setMergeSourceTraceId(trace.id);
            } else if (mergeSourceTraceId === trace.id) {
              setMergeSourceTraceId(null);
              setMergeTargetTraceId(null);
            } else {
              setMergeTargetTraceId(trace.id);
            }
            return;
          }
        }
      }
      return;
    }

    // EDIT TEXT TOOL: Click on any trace or joint text to immediately open text editor modal
    if (activeTool === 'edit_text') {
      for (const trace of currentDataset.traces || []) {
        const pts = trace.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
          const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
          if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 18) {
            setSelectedObjectId(trace.id);
            setSelectedObjectType('trace');
            setEditingTextTraceId(trace.id);
            setEditingTextValue(trace.customLabel !== undefined ? trace.customLabel : trace.setId);
            setEditingTextOrientation(trace.orientationLabel || `${trace.dipDirectionDeg}°/${trace.dipDeg}°`);
            return;
          }
        }
      }
      return;
    }

    // MEASURE TAPE TOOL
    if (activeTool === 'measure') {
      if (!measureStartPoint) {
        setMeasureStartPoint({ x: ch, y: yPerim });
      } else {
        setMeasureStartPoint(null);
      }
      return;
    }

    // 0. Check if user clicked on an active vertex handle -> start vertex drag
    if (activeTool === 'edit_joint' || (selectedObjectId && selectedObjectType === 'trace')) {
      const candidateTraces =
        activeTool === 'edit_joint'
          ? currentDataset.traces || []
          : (currentDataset.traces || []).filter((t) => t.id === selectedObjectId);

      for (const selTrace of candidateTraces) {
        if (!selTrace.points) continue;
        for (let i = 0; i < selTrace.points.length; i++) {
          const vx = worldToScreenX(selTrace.points[i].x);
          const vy = worldToScreenY(selTrace.points[i].y);
          if (Math.hypot(mouseX - vx, mouseY - vy) < 14) {
            pushHistory(currentDataset);
            setSelectedObjectId(selTrace.id);
            setSelectedObjectType('trace');
            setDraggingVertexIdx(i);
            setDragStartWorld({ x: ch, y: yPerim });
            return;
          }
        }

        // If in EDIT_JOINT mode and clicked on a segment, insert a new vertex or select trace!
        if (activeTool === 'edit_joint') {
          for (let i = 0; i < selTrace.points.length - 1; i++) {
            const p1 = { x: worldToScreenX(selTrace.points[i].x), y: worldToScreenY(selTrace.points[i + 1].y) };
            const p2 = { x: worldToScreenX(selTrace.points[i + 1].x), y: worldToScreenY(selTrace.points[i + 1].y) };
            if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 10) {
              pushHistory(currentDataset);
              const newPts = [...selTrace.points];
              newPts.splice(i + 1, 0, { x: ch, y: yPerim });
              setSelectedObjectId(selTrace.id);
              setSelectedObjectType('trace');
              setCurrentDataset((prev) => ({
                ...prev,
                traces: (prev.traces || []).map((t) =>
                  t.id === selTrace.id ? { ...t, points: newPts, rawPoints: newPts } : t
                ),
                updatedAt: new Date().toISOString(),
              }));
              setDraggingVertexIdx(i + 1);
              return;
            }
          }
        }
      }
    }

    // 1. If tool is MOVE_JOINT OR clicking on trace line of selected trace -> start whole trace drag
    if (activeTool === 'move_joint' || (activeTool === 'select' && selectedObjectId && selectedObjectType === 'trace')) {
      for (const trace of currentDataset.traces || []) {
        const pts = trace.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
          const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
          if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 10) {
            pushHistory(currentDataset);
            setSelectedObjectId(trace.id);
            setSelectedObjectType('trace');
            setIsDraggingTrace(true);
            setDragStartWorld({ x: ch, y: yPerim });
            setDragOriginalPoints([...pts]);
            return;
          }
        }
      }
    }

    // 2. If tool is DELETE_JOINT -> delete clicked joint trace instantly
    if (activeTool === 'delete_joint') {
      for (const trace of currentDataset.traces || []) {
        const pts = trace.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
          const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
          if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 12) {
            pushHistory(currentDataset);
            setCurrentDataset((prev) => ({
              ...prev,
              traces: (prev.traces || []).filter((t) => t.id !== trace.id),
              updatedAt: new Date().toISOString(),
            }));
            if (selectedObjectId === trace.id) {
              setSelectedObjectId(null);
              setSelectedObjectType(null);
            }
            return;
          }
        }
      }
    }

    if (activeTool === 'select' || activeTool === 'move_joint' || activeTool === 'edit_joint') {
      let hit = false;

      // Check joint traces
      for (const trace of currentDataset.traces || []) {
        const pts = trace.points || [];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
          const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
          if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 12) {
            setSelectedObjectId(trace.id);
            setSelectedObjectType('trace');
            hit = true;
            break;
          }
        }
        if (hit) break;
      }

      // Check water symbols
      if (!hit) {
        for (const sym of currentDataset.waterSymbols || []) {
          const symX = worldToScreenX(sym.position.x);
          const symY = worldToScreenY(sym.position.y);
          if (Math.hypot(mouseX - symX, mouseY - symY) < 14) {
            setSelectedObjectId(sym.id);
            setSelectedObjectType('water');
            hit = true;
            break;
          }
        }
      }

      // Check lithology zones
      if (!hit) {
        for (const zone of currentDataset.lithologyZones || []) {
          const xs = zone.polygon.map((p) => p.x);
          const ys = zone.polygon.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          if (ch >= minX && ch <= maxX && yPerim >= minY && yPerim <= maxY) {
            setSelectedObjectId(zone.id);
            setSelectedObjectType('lithology');
            hit = true;
            break;
          }
        }
      }

      if (!hit) {
        setSelectedObjectId(null);
        setSelectedObjectType(null);
      }
    } else if (activeTool === 'draw_joint') {
      setActiveDraftPoints((prev) => [...prev, { x: ch, y: yPerim }]);
    } else if (activeTool === 'place_water') {
      const newSym: ContinuousStripWaterSymbol = {
        id: `water-${Date.now()}`,
        condition: selectedWaterCondition,
        position: { x: ch, y: yPerim },
        label: `${selectedWaterCondition} @ Ch.${ch.toFixed(1)}m`,
      };

      const updated = {
        ...currentDataset,
        waterSymbols: [...(currentDataset.waterSymbols || []), newSym],
        updatedAt: new Date().toISOString(),
      };
      pushHistory(currentDataset);
      setCurrentDataset(updated);
      setSelectedObjectId(newSym.id);
      setSelectedObjectType('water');
    } else if (activeTool === 'add_lithology') {
      setActiveDraftPoints((prev) => [...prev, { x: ch, y: yPerim }]);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingVertexIdx(null);
    setIsDraggingTrace(false);
    setDragStartWorld(null);
    setDragOriginalPoints([]);
  };

  // Commit Drawing Line (Double click or Enter key or button)
  const handleCommitDraft = () => {
    if (activeDraftPoints.length < 2) {
      setActiveDraftPoints([]);
      return;
    }

    pushHistory(currentDataset);

    if (activeTool === 'draw_joint') {
      const jointDef = JOINT_SETS.find((j) => j.id === selectedJointSetId) || JOINT_SETS[0];
      const newTrace: ContinuousStripTrace = {
        id: `trace-${Date.now()}`,
        setId: jointDef.id,
        structureType: jointDef.structureType,
        orientationLabel: `${jointDef.defaultDipDir.toString().padStart(3, '0')}/${jointDef.defaultDip}`,
        dipDirectionDeg: jointDef.defaultDipDir,
        dipDeg: jointDef.defaultDip,
        fillingThickness: 'Thin',
        points: [...activeDraftPoints],
        rawPoints: [...activeDraftPoints],
        colorHex: jointDef.color,
      };

      setCurrentDataset((prev) => ({
        ...prev,
        traces: [...(prev.traces || []), newTrace],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedObjectId(newTrace.id);
      setSelectedObjectType('trace');
    } else if (activeTool === 'add_lithology') {
      const rockDef = ROCK_TYPES.find((r) => r.id === selectedRockTypeId) || ROCK_TYPES[0];
      const newZone: ContinuousStripLithologyZone = {
        id: `litho-${Date.now()}`,
        rockType: selectedRockTypeId,
        label: rockDef.label,
        codeSymbol: rockDef.id,
        polygon: [...activeDraftPoints],
      };

      setCurrentDataset((prev) => ({
        ...prev,
        lithologyZones: [...(prev.lithologyZones || []), newZone],
        updatedAt: new Date().toISOString(),
      }));
      setSelectedObjectId(newZone.id);
      setSelectedObjectType('lithology');
    }

    setActiveDraftPoints([]);
  };

  // Global Keyboard shortcuts: Enter to commit drafting, Escape to cancel drafting, Delete/Backspace to delete selected object
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (isInput) return;

      if (e.key === 'Enter') {
        if (activeDraftPoints.length >= 2) {
          e.preventDefault();
          handleCommitDraft();
        }
      } else if (e.key === 'Escape') {
        if (activeDraftPoints.length > 0) {
          e.preventDefault();
          setActiveDraftPoints([]);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          e.preventDefault();
          pushHistory(currentDataset);
          setCurrentDataset((prev) => {
            if (selectedObjectType === 'trace') {
              return {
                ...prev,
                traces: (prev.traces || []).filter((t) => t.id !== selectedObjectId),
                updatedAt: new Date().toISOString(),
              };
            }
            if (selectedObjectType === 'water') {
              return {
                ...prev,
                waterSymbols: (prev.waterSymbols || []).filter((w) => w.id !== selectedObjectId),
                updatedAt: new Date().toISOString(),
              };
            }
            if (selectedObjectType === 'lithology') {
              return {
                ...prev,
                lithologyZones: (prev.lithologyZones || []).filter((l) => l.id !== selectedObjectId),
                updatedAt: new Date().toISOString(),
              };
            }
            return prev;
          });
          setSelectedObjectId(null);
          setSelectedObjectType(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, activeDraftPoints, selectedObjectId, selectedObjectType, currentDataset]);

  // Nudge selected joint trace across chainage (dx) or perimeter (dy)
  const handleNudgeTrace = (dx: number, dy: number) => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) => {
        if (t.id !== selectedObjectId) return t;
        const pts = (t.points || []).map((pt) => ({
          x: Math.round((pt.x + dx) * 100) / 100,
          y: Math.max(0, Math.min(totalPerimeterM, Math.round((pt.y + dy) * 100) / 100)),
        }));
        return {
          ...t,
          points: pts,
          rawPoints: pts,
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Add vertex to the selected trace
  const handleAddVertexToTrace = () => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    const trace = currentDataset.traces?.find((t) => t.id === selectedObjectId);
    if (!trace || !trace.points || trace.points.length === 0) return;
    const last = trace.points[trace.points.length - 1];
    const newPt = {
      x: Math.round((last.x + 0.5) * 100) / 100,
      y: Math.max(0, Math.min(totalPerimeterM, Math.round((last.y + 0.25) * 100) / 100)),
    };
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) =>
        t.id === selectedObjectId
          ? { ...t, points: [...t.points, newPt], rawPoints: [...t.points, newPt] }
          : t
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Delete last vertex from selected trace
  const handleDeleteLastVertex = () => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    const trace = currentDataset.traces?.find((t) => t.id === selectedObjectId);
    if (!trace || !trace.points || trace.points.length <= 2) return;
    const remaining = trace.points.slice(0, -1);
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) =>
        t.id === selectedObjectId ? { ...t, points: remaining, rawPoints: remaining } : t
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Smooth trace line points with 3-point moving average
  const handleSmoothTraceCurve = () => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    const trace = currentDataset.traces?.find((t) => t.id === selectedObjectId);
    if (!trace || !trace.points || trace.points.length < 3) return;
    const pts = trace.points;
    const smoothed: Point2D[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      smoothed.push({
        x: Math.round(((pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4) * 100) / 100,
        y: Math.round(((pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4) * 100) / 100,
      });
    }
    smoothed.push(pts[pts.length - 1]);

    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) =>
        t.id === selectedObjectId ? { ...t, points: smoothed, rawPoints: smoothed } : t
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Reverse joint direction / dip azimuth (+180°)
  const handleReverseTrace = () => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).map((t) => {
        if (t.id !== selectedObjectId) return t;
        const revPts = [...t.points].reverse();
        const revRaw = [...(t.rawPoints || t.points)].reverse();
        const newDipDir = (t.dipDirectionDeg + 180) % 360;
        return {
          ...t,
          points: revPts,
          rawPoints: revRaw,
          dipDirectionDeg: newDipDir,
          orientationLabel: `${newDipDir.toString().padStart(3, '0')}/${t.dipDeg.toString().padStart(2, '0')}`,
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Duplicate selected trace
  const handleDuplicateTrace = () => {
    if (!selectedObjectId || selectedObjectType !== 'trace') return;
    const trace = currentDataset.traces?.find((t) => t.id === selectedObjectId);
    if (!trace) return;
    const cloned: ContinuousStripTrace = {
      ...trace,
      id: `trace-${Date.now()}`,
      points: trace.points.map((p) => ({
        x: Math.round((p.x + 0.5) * 100) / 100,
        y: Math.max(0, Math.min(totalPerimeterM, Math.round((p.y + 0.5) * 100) / 100)),
      })),
      rawPoints: trace.points.map((p) => ({
        x: Math.round((p.x + 0.5) * 100) / 100,
        y: Math.max(0, Math.min(totalPerimeterM, Math.round((p.y + 0.5) * 100) / 100)),
      })),
    };
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: [...(prev.traces || []), cloned],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedObjectId(cloned.id);
    setSelectedObjectType('trace');
  };

  // Center canvas on trace
  const handleCenterOnTrace = (trace: ContinuousStripTrace) => {
    if (!trace.points || trace.points.length === 0) return;
    const xs = trace.points.map((p) => p.x);
    const ys = trace.points.map((p) => p.y);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    setPanOffset({
      x: w / 2 - (midX - fromRd) * 45 * zoom,
      y: h / 2 - midY * 28 * zoom,
    });
    setSelectedObjectId(trace.id);
    setSelectedObjectType('trace');
  };

  // Delete selected item
  const handleDeleteSelected = () => {
    if (!selectedObjectId || !selectedObjectType) return;
    pushHistory(currentDataset);

    if (selectedObjectType === 'trace') {
      setCurrentDataset((prev) => ({
        ...prev,
        traces: (prev.traces || []).filter((t) => t.id !== selectedObjectId),
        updatedAt: new Date().toISOString(),
      }));
    } else if (selectedObjectType === 'lithology') {
      setCurrentDataset((prev) => ({
        ...prev,
        lithologyZones: (prev.lithologyZones || []).filter((z) => z.id !== selectedObjectId),
        updatedAt: new Date().toISOString(),
      }));
    } else if (selectedObjectType === 'water') {
      setCurrentDataset((prev) => ({
        ...prev,
        waterSymbols: (prev.waterSymbols || []).filter((w) => w.id !== selectedObjectId),
        updatedAt: new Date().toISOString(),
      }));
    }

    setSelectedObjectId(null);
    setSelectedObjectType(null);
  };

  // Delete a specific trace by ID
  const handleDeleteTraceById = (traceId: string) => {
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: (prev.traces || []).filter((t) => t.id !== traceId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedObjectId === traceId) {
      setSelectedObjectId(null);
      setSelectedObjectType(null);
    }
  };

  // Delete all traces in this section
  const handleDeleteAllTraces = () => {
    if (!window.confirm('Delete all joint traces in this continuous section?')) return;
    pushHistory(currentDataset);
    setCurrentDataset((prev) => ({
      ...prev,
      traces: [],
      updatedAt: new Date().toISOString(),
    }));
    if (selectedObjectType === 'trace') {
      setSelectedObjectId(null);
      setSelectedObjectType(null);
    }
  };

  // AI Joint Trend Alignment
  const handleRunAiTrendAlignment = () => {
    pushHistory(currentDataset);
    const result = runAiTrendAlignmentOnDataset(currentDataset);
    setCurrentDataset(result.updatedDataset);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex >= 0 && history[historyIndex]) {
      const prev = history[historyIndex];
      setHistoryIndex((idx) => idx - 1);
      setCurrentDataset(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex + 1 < history.length) {
      const next = history[historyIndex + 1];
      setHistoryIndex((idx) => idx + 1);
      setCurrentDataset(next);
    }
  };

  // Save changes & update A3 Report Window
  const handleSaveAndCommit = () => {
    onSaveDataset(currentDataset);
    onClose();
  };

  // Execute AutoCAD 2026 Command from Command Line Prompt Bar
  const handleExecuteCadCommand = useCallback(
    (rawCmd: string) => {
      const cmd = rawCmd.trim().toUpperCase();
      if (!cmd) return;
      setCadCommandHistory((prev) => [...prev.slice(-19), `COMMAND: ${cmd}`]);

      if (cmd === 'L' || cmd === 'LINE' || cmd === 'PL' || cmd === 'PLINE' || cmd === 'J' || cmd === 'JOINT') {
        setActiveTool('draw_joint');
        setCadStatusMessage('DRAW JOINT: Click points on tunnel perimeter to trace discontinuity');
      } else if (cmd === 'M' || cmd === 'MOVE') {
        setActiveTool('move_joint');
        setCadStatusMessage('MOVE JOINT: Drag joint trace or points across chainage');
      } else if (cmd === 'PE' || cmd === 'EDIT' || cmd === 'VERTEX') {
        setActiveTool('edit_joint');
        setCadStatusMessage('EDIT VERTICES: Drag points or click line segment to insert point');
      } else if (cmd === 'MERGE') {
        setActiveTool('merge_joint');
        setCadStatusMessage('MERGE JOINTS: Select first trace, then second trace to merge');
      } else if (cmd === 'E' || cmd === 'DEL' || cmd === 'DELETE' || cmd === 'ERASE') {
        if (selectedObjectId) {
          handleDeleteSelected();
          setCadStatusMessage(`ERASE: Deleted selected ${selectedObjectType}`);
        } else {
          setActiveTool('delete_joint');
          setCadStatusMessage('DELETE JOINT: Click trace to delete');
        }
      } else if (cmd === 'LITH' || cmd === 'HATCH' || cmd === 'STRATA') {
        setActiveTool('add_lithology');
        setSidebarTab('lithology');
        setCadStatusMessage('LITHOLOGY HATCH: Draw vertices or use 1-Click Fill Span');
      } else if (cmd === 'WATER' || cmd === 'SYM' || cmd === 'SEEP') {
        setActiveTool('place_water');
        setSidebarTab('properties');
        setCadStatusMessage('WATER INFLOW: Click position to drop seepage indicator');
      } else if (cmd === 'SUPPORT' || cmd === 'BOLT' || cmd === 'GIRDER') {
        setActiveTool('place_support');
        setSidebarTab('properties');
        setCadStatusMessage('ROCK SUPPORT: Click position to add rock bolt or girder');
      } else if (cmd === 'DIST' || cmd === 'DI' || cmd === 'MEASURE') {
        setActiveTool('measure');
        setMeasureStartPoint(null);
        setCadStatusMessage('MEASURE: Click start point, then endpoint to measure span');
      } else if (cmd === 'V' || cmd === 'SELECT' || cmd === 'ESC') {
        setActiveTool('select');
        setActiveDraftPoints([]);
        setMeasureStartPoint(null);
        setCadStatusMessage('SELECT & PROPERTIES');
      } else if (cmd === 'AI' || cmd === 'TREND' || cmd === 'ALIGN') {
        handleRunAiTrendAlignment();
        setCadStatusMessage('AI TREND ALIGNMENT: Discontinuity traces smoothly aligned across pulls');
      } else if (cmd === 'ZOOM' || cmd === 'ZE' || cmd === 'FIT' || cmd === '1:1') {
        handleFitToScreen();
        setCadStatusMessage('ZOOM EXTENTS: Continuous unwrapped strip fitted to screen');
      } else if (cmd === 'U' || cmd === 'UNDO') {
        handleUndo();
        setCadStatusMessage('UNDO: Last CAD action reverted');
      } else if (cmd === 'REDO') {
        handleRedo();
        setCadStatusMessage('REDO: Action re-applied');
      } else if (cmd === 'SAVE' || cmd === 'W' || cmd === 'COMMIT') {
        handleSaveAndCommit();
      } else if (cmd === 'GRID' || cmd === 'F7') {
        setSnapToGrid((prev) => !prev);
        setCadStatusMessage('GRID: Grid display toggled');
      } else if (cmd === 'SNAP' || cmd === 'F9') {
        setSnapToGrid((prev) => !prev);
        setCadStatusMessage('SNAP: Cursor grid snapping toggled');
      } else if (cmd === 'ORTHO' || cmd === 'F8') {
        setOrthoMode((prev) => !prev);
        setCadStatusMessage('ORTHO: 90° Orthogonal constraint toggled');
      } else if (cmd === 'POLAR' || cmd === 'F10') {
        setPolarTracking((prev) => !prev);
        setCadStatusMessage('POLAR: Polar tracking guides toggled');
      } else if (cmd === 'OSNAP' || cmd === 'F3') {
        setCadOsnapEnabled((prev) => !prev);
        setCadStatusMessage('OSNAP: Object snap (Endpoint/Midpoint) toggled');
      } else if (cmd === 'DYN' || cmd === 'F12') {
        setCadDynInputEnabled((prev) => !prev);
        setCadStatusMessage('DYN: Dynamic input cursor coordinate readout toggled');
      } else if (cmd === 'PROPS' || cmd === 'PR') {
        setSidebarTab((prev) => (prev === 'properties' ? 'layers' : 'properties'));
        setCadStatusMessage('PROPERTIES: Inspector sidebar toggled');
      } else {
        setCadStatusMessage(
          `Unknown command "${cmd}". Try: L, PL, M, PE, MERGE, E, LITH, WATER, SUPPORT, DIST, AI, ZOOM, OSNAP, DYN, F3, F7, F8, F9, F12.`
        );
      }
      setCadCommandInput('');
    },
    [
      handleDeleteSelected,
      handleFitToScreen,
      handleRedo,
      handleRunAiTrendAlignment,
      handleSaveAndCommit,
      handleUndo,
      selectedObjectId,
      selectedObjectType,
    ]
  );

  // Global Keyboard Shortcuts (AutoCAD function keys, Delete, Undo, Redo, Esc, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      // AutoCAD Standard Function Keys (F3, F7, F8, F9, F10, F12)
      if (e.key === 'F3') {
        e.preventDefault();
        setCadOsnapEnabled((prev) => !prev);
      } else if (e.key === 'F7') {
        e.preventDefault();
        setSnapToGrid((prev) => !prev);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setOrthoMode((prev) => !prev);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setSnapToGrid((prev) => !prev);
      } else if (e.key === 'F10') {
        e.preventDefault();
        setPolarTracking((prev) => !prev);
      } else if (e.key === 'F12') {
        e.preventDefault();
        setCadDynInputEnabled((prev) => !prev);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          handleDeleteSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      } else if (e.key === 'Escape') {
        setActiveDraftPoints([]);
        setMergeSourceTraceId(null);
        setMergeTargetTraceId(null);
        setMeasureStartPoint(null);
        setSelectedObjectId(null);
        setSelectedObjectType(null);
      } else if (e.key === 'Enter') {
        if (mergeSourceTraceId && mergeTargetTraceId) {
          handleExecuteMergeTraces(mergeSourceTraceId, mergeTargetTraceId);
        } else if (activeDraftPoints.length >= 2) {
          handleCommitDraft();
        }
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'm') {
        setActiveTool('move_joint');
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool('edit_joint');
      } else if (e.key.toLowerCase() === 'g') {
        setActiveTool('merge_joint');
      } else if (e.key.toLowerCase() === 'j') {
        setActiveTool('draw_joint');
      } else if (e.key.toLowerCase() === 'l') {
        setActiveTool('add_lithology');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedObjectId,
    selectedObjectType,
    activeDraftPoints,
    history,
    historyIndex,
    mergeSourceTraceId,
    mergeTargetTraceId,
    handleExecuteMergeTraces,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
  ]);

  // Currently Selected Object Data for Inspector
  const selectedTrace = useMemo(() => {
    if (selectedObjectType !== 'trace') return null;
    return currentDataset.traces?.find((t) => t.id === selectedObjectId) || null;
  }, [currentDataset.traces, selectedObjectId, selectedObjectType]);

  const selectedLithology = useMemo(() => {
    if (selectedObjectType !== 'lithology') return null;
    return currentDataset.lithologyZones?.find((z) => z.id === selectedObjectId) || null;
  }, [currentDataset.lithologyZones, selectedObjectId, selectedObjectType]);

  const selectedWater = useMemo(() => {
    if (selectedObjectType !== 'water') return null;
    return currentDataset.waterSymbols?.find((w) => w.id === selectedObjectId) || null;
  }, [currentDataset.waterSymbols, selectedObjectId, selectedObjectType]);

  // Filtered traces for Previous Joint Traces tab
  const filteredTraces = useMemo(() => {
    const list = currentDataset.traces || [];
    if (!searchJointQuery.trim()) return list;
    const q = searchJointQuery.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.setId.toLowerCase().includes(q) ||
        (t.orientationLabel || '').toLowerCase().includes(q)
    );
  }, [currentDataset.traces, searchJointQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. TOP AUTOCAD 2026 HEADER BAR - Harmonized, Perfectly Arranged & Aligned */}
      <div className="h-13 bg-slate-950 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-md gap-3 z-30">
        {/* Left Side: Brand, Identity, Project Metadata */}
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          {/* Exit / Return button */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer font-mono shrink-0"
            title="Exit Continuous CAD Workspace and Return"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Exit CAD</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0" />

          {/* AutoCAD 2026 Brand Badge & Title */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-600 to-amber-600 border border-red-500/50 flex items-center justify-center text-white font-black text-xs shadow-sm font-mono tracking-tight shrink-0">
              CAD
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white font-mono tracking-tight whitespace-nowrap">
                ESWACAD 2026
              </span>
              <span className="hidden sm:inline-block text-[10px] text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/30 font-mono whitespace-nowrap">
                CONTINUOUS 3D STRIP
              </span>
            </div>
          </div>

          {/* Project & Scope Metadata (Aligned with subtle badges) */}
          <div className="hidden xl:flex items-center gap-2 pl-2.5 border-l border-slate-800 text-xs text-slate-400 font-mono truncate">
            <span className="truncate">
              Proj: <strong className="text-slate-200">{currentDataset.projectName || 'Tunnel Drive'}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="truncate">
              Loc: <strong className="text-slate-200">{currentDataset.tunnelLocationName || 'Power Tunnel'}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300 font-bold text-[11px] whitespace-nowrap">
              RD {fromRd.toFixed(1)}m – {toRd.toFixed(1)}m ({totalLengthM.toFixed(1)}m)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[10px] whitespace-nowrap">
              Horseshoe Arch
            </span>
          </div>
        </div>

        {/* Right Side: CAD Actions (All harmonized to exactly h-8 height with clear tool clusters) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cluster 1: History (Undo & Redo) */}
          <div className="flex items-center bg-slate-900 border border-slate-750 rounded-lg p-0.5 h-8">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex < 0}
              className={`h-7 px-2 rounded-md text-xs flex items-center gap-1 transition ${
                historyIndex >= 0
                  ? 'hover:bg-slate-800 text-slate-200 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden md:inline font-mono">Undo</span>
            </button>
            <div className="h-3.5 w-px bg-slate-800 mx-0.5" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex + 1 >= history.length}
              className={`h-7 px-2 rounded-md text-xs flex items-center gap-1 transition ${
                historyIndex + 1 < history.length
                  ? 'hover:bg-slate-800 text-slate-200 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <CornerUpRight className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden md:inline font-mono">Redo</span>
            </button>
          </div>

          {/* Cluster 2: Display Utilities (Fit Screen & Theme) */}
          <div className="flex items-center bg-slate-900 border border-slate-750 rounded-lg p-0.5 h-8">
            <button
              type="button"
              onClick={handleFitToScreen}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Fit to Screen (Zoom Extents)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-800 mx-0.5" />
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isDarkMode ? 'Switch to Light CAD' : 'Switch to Dark CAD'}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

          {/* Cluster 3: View Mode Switcher (2D Unwrapped vs 3D Canvas) */}
          <div className="flex items-center bg-slate-900 border border-slate-750 rounded-lg p-0.5 h-8">
            <button
              type="button"
              onClick={() => {
                setCadViewMode('2D_UNWRAPPED');
                if (cadRibbonTab === 'EXPORT_3D') setCadRibbonTab('DISCONTINUITIES');
              }}
              className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cadViewMode === '2D_UNWRAPPED'
                  ? 'bg-sky-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="2D Unwrapped Strip Canvas"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>2D Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCadViewMode('3D_CONTINUOUS');
                setCadRibbonTab('EXPORT_3D');
              }}
              className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cadViewMode === '3D_CONTINUOUS'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800/60'
              }`}
              title="3D Canvas Option — Inspect each joint in 3D continuous tunnel"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Canvas</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 shrink-0" />

          {/* Cluster 4: Primary Save & Commit Action */}
          <button
            type="button"
            onClick={handleSaveAndCommit}
            className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer font-mono shrink-0"
            title="Save CAD edits and update the A3 Continuous Tunnel Log Report window"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save to A3</span>
          </button>

          {/* Cluster 5: Modal Dismiss */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Close CAD Workspace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. PROMINENT 5-STEP WORKFLOW RIBBON BAR (Matching Underground NATM Workspace) */}
      <div className="w-full bg-slate-900 border-b border-slate-800 px-2 py-1 shrink-0">
        <div className="grid grid-cols-5 gap-1.5 w-full">
          {[
            { id: 'HOME', step: '1', label: 'Geometry', fullLabel: '1. Strip Geometry' },
            { id: 'DISCONTINUITIES', step: '2', label: 'Joints', fullLabel: '2. Discontinuity Tracing' },
            { id: 'STRATA', step: '3', label: 'Strata', fullLabel: '3. Strata & Lithology' },
            { id: 'SUPPORT_WATER', step: '4', label: 'Support/Water', fullLabel: '4. Support & Water' },
            { id: 'EXPORT_3D', step: '5', label: '3D Canvas', fullLabel: '5. 3D Canvas & Inspect' },
          ].map((tab) => {
            const isActive = cadRibbonTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCadRibbonTab(tab.id as any);
                  if (tab.id === 'DISCONTINUITIES') {
                    setCadViewMode('2D_UNWRAPPED');
                    setActiveTool('draw_joint');
                    setSidebarTab('properties');
                  } else if (tab.id === 'STRATA') {
                    setCadViewMode('2D_UNWRAPPED');
                    setActiveTool('add_lithology');
                    setSidebarTab('lithology');
                  } else if (tab.id === 'SUPPORT_WATER') {
                    setCadViewMode('2D_UNWRAPPED');
                    setActiveTool('place_water');
                    setSidebarTab('properties');
                  } else if (tab.id === 'EXPORT_3D') {
                    setCadViewMode('3D_CONTINUOUS');
                    handleRunAiTrendAlignment();
                  } else if (tab.id === 'HOME') {
                    setCadViewMode('2D_UNWRAPPED');
                    handleFitToScreen();
                  }
                }}
                className={`h-8 flex items-center justify-center gap-1.5 px-2 rounded-lg font-mono font-bold text-xs transition-all cursor-pointer min-w-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-sm ring-1 ring-sky-300/40'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/70'
                }`}
              >
                <span
                  className={`w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] font-extrabold shrink-0 ${
                    isActive ? 'bg-white text-sky-700' : 'bg-slate-700 text-amber-300'
                  }`}
                >
                  {tab.step}
                </span>
                <span className="truncate sm:hidden">{tab.label}</span>
                <span className="truncate hidden sm:inline">{tab.fullLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Ribbon Secondary Tool Tray */}
        {!cadRibbonCollapsed && (
          <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between gap-2 overflow-x-auto text-[11px] font-mono text-slate-300">
            {cadRibbonTab === 'HOME' && (
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Span: RD {fromRd.toFixed(1)}m – {toRd.toFixed(1)}m</span>
                <span>•</span>
                <span className="text-sky-300">Total Unwrapped Perimeter: {totalPerimeterM.toFixed(2)}m</span>
                <span>•</span>
                <span className="text-amber-300">Left Wall: 0–{leftWallHeight.toFixed(1)}m | Crown: {leftWallHeight.toFixed(1)}–{(leftWallHeight + crownWidth).toFixed(1)}m | Right Wall: {(leftWallHeight + crownWidth).toFixed(1)}–{totalPerimeterM.toFixed(1)}m</span>
              </div>
            )}
            {cadRibbonTab === 'DISCONTINUITIES' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Active Joint Set:</span>
                {JOINT_SETS.map((js) => (
                  <button
                    key={js.id}
                    type="button"
                    onClick={() => setSelectedJointSetId(js.id)}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 border transition cursor-pointer ${
                      selectedJointSetId === js.id
                        ? 'bg-slate-800 text-white border-sky-400 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: js.color }} />
                    <span>{js.id}</span>
                  </button>
                ))}
              </div>
            )}
            {cadRibbonTab === 'STRATA' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Quick Rock Type:</span>
                {ROCK_TYPES.slice(0, 6).map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRockTypeId(rt.id);
                      setActiveTool('add_lithology');
                    }}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 border transition cursor-pointer ${
                      selectedRockTypeId === rt.id
                        ? 'bg-slate-800 text-white border-amber-400 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rt.color }} />
                    <span>{rt.id}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleFillBetweenChainages}
                  className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-600/60 text-amber-300 font-bold text-xs cursor-pointer ml-2"
                >
                  ⚡ 1-Click Fill Span
                </button>
              </div>
            )}
            {cadRibbonTab === 'SUPPORT_WATER' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Water Condition:</span>
                {(['Dripping', 'Flowing', 'Wet', 'Damp'] as StripGroundwaterId[]).map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => {
                      setSelectedWaterCondition(cond);
                      setActiveTool('place_water');
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition cursor-pointer ${
                      selectedWaterCondition === cond
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            )}
            {cadRibbonTab === 'EXPORT_3D' && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Box className="w-3.5 h-3.5" />
                  <span>3D Continuous Tunnel Canvas:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCadViewMode('3D_CONTINUOUS')}
                  className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                    cadViewMode === '3D_CONTINUOUS'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>3D Tunnel View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCadViewMode('2D_UNWRAPPED')}
                  className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                    cadViewMode === '2D_UNWRAPPED'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>2D Unwrapped View</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndCommit}
                  className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-600 text-emerald-200 text-xs font-bold cursor-pointer"
                >
                  💾 Save to A3 Sheet Log
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCadRibbonCollapsed(true)}
              className="text-slate-500 hover:text-slate-300 p-0.5 ml-auto"
              title="Collapse Ribbon Shelf"
            >
              ▲
            </button>
          </div>
        )}
      </div>

      {/* 3. MAIN CAD WORKSPACE (Left Tools + Central Canvas + Right Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left CAD Tool Palette (AutoCAD 2026 Dark Slate Icon Strip) */}
        <div className="w-14 sm:w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-2 gap-1.5 shrink-0 z-20 shadow-xl">
          {/* Select Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'select'
                ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/40 ring-1 ring-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Select & Inspect (Shortcut: V)"
          >
            <Crosshair className="w-4 h-4" />
            <span className="text-[9px] font-mono">Select</span>
          </button>

          {/* Draw Joint Discontinuity */}
          <button
            type="button"
            onClick={() => setActiveTool('draw_joint')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'draw_joint'
                ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/40 ring-1 ring-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Add Joint Polyline (Shortcut: PL / J)"
          >
            <PenTool className="w-4 h-4" />
            <span className="text-[9px] font-mono">Joint</span>
          </button>

          {/* Move Joint Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('move_joint')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'move_joint'
                ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/40 ring-1 ring-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Move Joint (Shortcut: M) — Drag joint trace or points across chainage and perimeter"
          >
            <Move className="w-4 h-4" />
            <span className="text-[9px] font-mono">Move</span>
          </button>

          {/* Edit / Reshape Joint Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('edit_joint')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'edit_joint'
                ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/40 ring-1 ring-sky-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Edit Vertices (Shortcut: PE / E) — Drag points or click line segment to insert vertex"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-[9px] font-mono">Edit</span>
          </button>

          {/* Edit / Change Canvas Text Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('edit_text')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'edit_text'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/40 ring-1 ring-blue-300'
                : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
            }`}
            title="Edit Canvas Text (Shortcut: TEXT / T) — Click any joint text to edit label, orientation text, or delete text"
          >
            <Type className="w-4 h-4" />
            <span className="text-[9px] font-mono">Text</span>
          </button>

          {/* Merge Joints Tool */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('merge_joint');
              setMergeSourceTraceId(null);
              setMergeTargetTraceId(null);
            }}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'merge_joint'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/40'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
            }`}
            title="Merge Joints (Shortcut: MERGE / G) — Fuse two traces into continuous seam"
          >
            <GitMerge className="w-4 h-4" />
            <span className="text-[9px] font-mono">Merge</span>
          </button>

          {/* Delete Joint Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('delete_joint')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'delete_joint'
                ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/40'
                : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
            }`}
            title="Delete Discontinuity (Shortcut: ERASE / E)"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[9px] font-mono">Erase</span>
          </button>

          <div className="w-8 h-px bg-slate-800 my-0.5" />

          {/* Add Lithology Zone */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('add_lithology');
              setSidebarTab('lithology');
            }}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'add_lithology'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Lithology Hatcher (Shortcut: HATCH / L)"
          >
            <Layers className="w-4 h-4" />
            <span className="text-[9px] font-mono">Litho</span>
          </button>

          {/* Groundwater Seepage */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('place_water');
              setSidebarTab('properties');
            }}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'place_water'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/40'
                : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title="Groundwater Inflow (Shortcut: WATER / W)"
          >
            <Droplet className="w-4 h-4" />
            <span className="text-[9px] font-mono">Water</span>
          </button>

          {/* Measurement Tape */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('measure');
              setMeasureStartPoint(null);
            }}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTool === 'measure'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Measurement Tape (Shortcut: DIST / DI)"
          >
            <Ruler className="w-4 h-4" />
            <span className="text-[9px] font-mono">Measure</span>
          </button>

          <div className="w-8 h-px bg-slate-800 my-1" />

          {/* Zoom % Reset */}
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="w-9 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center font-mono text-[10px] font-bold transition cursor-pointer"
            title="Reset Zoom to 100% (Shortcut: 1:1)"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Snap Grid Toggle */}
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
              snapToGrid ? 'text-sky-400 bg-sky-950/60 border border-sky-600/50' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={snapToGrid ? `Snap Grid (${gridStepM}m): ON (F9)` : 'Snap Grid: OFF (F9)'}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>

                {/* Left Shrinkable Property Inspector */}
        {isInspectorCollapsed ? (
          <div className="w-8 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-2 shrink-0 z-20">
            <button
              type="button"
              onClick={() => setIsInspectorCollapsed(false)}
              className="p-1 text-sky-400 hover:text-sky-200 hover:bg-slate-800 rounded transition cursor-pointer font-bold text-xs"
              title="Expand Left Property Inspector"
            >
              ▶
            </button>
            <span className="text-[9px] font-mono font-bold text-slate-400 [writing-mode:vertical-rl] tracking-widest mt-3 select-none">
              INSPECTOR
            </span>
          </div>
        ) : (
          <div className="w-72 sm:w-84 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden shadow-2xl">
          {/* Sidebar Tabs */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950 shrink-0 overflow-x-auto font-mono">
            <button
              type="button"
              onClick={() => setSidebarTab('properties')}
              className={`flex-1 py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
                sidebarTab === 'properties'
                  ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('lithology')}
              className={`flex-1 py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
                sidebarTab === 'lithology'
                  ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lithology</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('previous_joints')}
              className={`flex-1 py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
                sidebarTab === 'previous_joints'
                  ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Traces</span>
              <span className="ml-0.5 px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-sky-950 text-sky-400 border border-sky-500/30">
                {(currentDataset.traces || []).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('features')}
              className={`flex-1 py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
                sidebarTab === 'features'
                  ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Features</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('layers')}
              className={`flex-1 py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
                sidebarTab === 'layers'
                  ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Layers</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {/* TAB 1: PROPERTIES INSPECTOR */}
            {sidebarTab === 'properties' && (
              <>
                {/* If Joint Trace Selected */}
                {selectedTrace && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: resolveStripTraceColor(selectedTrace) }}
                          />
                          <strong className="text-white font-mono text-xs">{selectedTrace.id}</strong>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-orange-950/70 text-orange-400 border border-orange-500/30 font-mono font-bold text-[10px]">
                          {selectedTrace.orientationLabel || `${selectedTrace.dipDirectionDeg}°/${selectedTrace.dipDeg}°`}
                        </span>
                      </div>

                      {/* Quick Trace Action Buttons */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-stone-800">
                        <button
                          type="button"
                          onClick={() => handleCenterOnTrace(selectedTrace)}
                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-300 text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Zoom to Center on Trace"
                        >
                          <Eye className="w-3 h-3 text-cyan-400" />
                          <span>Zoom</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTool('move_joint')}
                          className={`p-1 rounded text-[10px] flex items-center justify-center gap-1 transition cursor-pointer ${
                            activeTool === 'move_joint'
                              ? 'bg-orange-500 text-white font-bold'
                              : 'bg-stone-900 hover:bg-stone-800 text-stone-300'
                          }`}
                          title="Activate Move Joint Tool"
                        >
                          <Move className="w-3 h-3 text-orange-400" />
                          <span>Move</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTool('edit_joint')}
                          className={`p-1 rounded text-[10px] flex items-center justify-center gap-1 transition cursor-pointer ${
                            activeTool === 'edit_joint'
                              ? 'bg-cyan-500 text-stone-950 font-bold'
                              : 'bg-stone-900 hover:bg-stone-800 text-stone-300'
                          }`}
                          title="Edit Joint Vertices"
                        >
                          <Edit2 className="w-3 h-3 text-cyan-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTextTraceId(selectedTrace.id);
                            setEditingTextValue(selectedTrace.customLabel !== undefined ? selectedTrace.customLabel : selectedTrace.setId);
                            setEditingTextOrientation(selectedTrace.orientationLabel || `${selectedTrace.dipDirectionDeg}°/${selectedTrace.dipDeg}°`);
                          }}
                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-300 text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Edit Joint Canvas Text & Orientation"
                        >
                          <Type className="w-3 h-3 text-blue-400" />
                          <span>Text</span>
                        </button>
                      </div>
                    </div>

                    {/* Canvas Text / Label Editor (User requirement: delete and edit any texts inside the canvas) */}
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-200 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-blue-400" />
                          <span>Canvas Text &amp; Label</span>
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {selectedTrace.hideLabel ? 'Deleted/Hidden' : 'Visible'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10.5px] text-stone-400 font-semibold block">Label Text on Canvas:</label>
                        <input
                          type="text"
                          value={selectedTrace.customLabel !== undefined ? selectedTrace.customLabel : selectedTrace.setId}
                          onChange={(e) => {
                            const val = e.target.value;
                            pushHistory(currentDataset);
                            setCurrentDataset((prev) => ({
                              ...prev,
                              traces: prev.traces.map((t) =>
                                t.id === selectedTrace.id ? { ...t, customLabel: val, hideLabel: val.trim() === '' } : t
                              ),
                            }));
                          }}
                          placeholder="e.g. J1, JS1 Main Joint, Splay A..."
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs font-semibold text-white focus:outline-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10.5px] text-stone-400 font-semibold block">Orientation Text:</label>
                        <input
                          type="text"
                          value={selectedTrace.orientationLabel || `${selectedTrace.dipDirectionDeg}°/${selectedTrace.dipDeg}°`}
                          onChange={(e) => {
                            const val = e.target.value;
                            pushHistory(currentDataset);
                            setCurrentDataset((prev) => ({
                              ...prev,
                              traces: prev.traces.map((t) =>
                                t.id === selectedTrace.id ? { ...t, orientationLabel: val } : t
                              ),
                            }));
                          }}
                          placeholder="e.g. 140°/65°"
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg p-1.5 text-xs font-mono font-semibold text-white focus:outline-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            pushHistory(currentDataset);
                            setCurrentDataset((prev) => ({
                              ...prev,
                              traces: prev.traces.map((t) =>
                                t.id === selectedTrace.id ? { ...t, customLabel: '', hideLabel: true } : t
                              ),
                            }));
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-300 text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Delete / Hide the text label from canvas"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Delete Text</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            pushHistory(currentDataset);
                            setCurrentDataset((prev) => ({
                              ...prev,
                              traces: prev.traces.map((t) =>
                                t.id === selectedTrace.id ? { ...t, customLabel: selectedTrace.setId, hideLabel: false } : t
                              ),
                            }));
                          }}
                          className="py-1 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] font-semibold transition cursor-pointer"
                          title="Restore label to default joint set ID"
                        >
                          Restore Default
                        </button>
                      </div>
                    </div>

                    {/* Joint Set / Category */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-stone-400 font-semibold">Joint Set / Category:</label>
                      <select
                        value={selectedTrace.setId}
                        onChange={(e) => {
                          const found = JOINT_SETS.find((j) => j.id === e.target.value);
                          pushHistory(currentDataset);
                          setCurrentDataset((prev) => ({
                            ...prev,
                            traces: prev.traces.map((t) =>
                              t.id === selectedTrace.id
                                ? {
                                    ...t,
                                    setId: e.target.value,
                                    colorHex: found?.color || t.colorHex,
                                    structureType: found?.structureType || t.structureType,
                                  }
                                : t
                            ),
                          }));
                        }}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-white"
                      >
                        {JOINT_SETS.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name} ({j.defaultDipDir}°/{j.defaultDip}°)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dip Direction & Dip Angle Stepper / Inputs */}
                    <div className="space-y-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-200">Orientation (Strike &amp; Dip):</span>
                        <button
                          type="button"
                          onClick={handleReverseTrace}
                          className="text-[10px] text-orange-400 hover:underline flex items-center gap-1"
                        >
                          <ArrowDownUp className="w-3 h-3" />
                          <span>Invert (+180°)</span>
                        </button>
                      </div>

                      {/* Dip Direction Steppers */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">Dip Direction (°Azimuth):</span>
                          <span className="font-mono text-orange-400 font-bold">{selectedTrace.dipDirectionDeg}°</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg - 10, selectedTrace.dipDeg)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            -10°
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg - 1, selectedTrace.dipDeg)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            -1°
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="360"
                            value={selectedTrace.dipDirectionDeg}
                            onChange={(e) => updateSelectedTraceDip(parseInt(e.target.value) || 0, selectedTrace.dipDeg)}
                            className="flex-1 min-w-0 bg-stone-900 border border-stone-700 rounded p-1 text-center font-mono text-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg + 1, selectedTrace.dipDeg)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            +1°
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg + 10, selectedTrace.dipDeg)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            +10°
                          </button>
                        </div>
                      </div>

                      {/* Dip Angle Steppers */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">Dip Angle (0–90°):</span>
                          <span className="font-mono text-amber-400 font-bold">{selectedTrace.dipDeg}°</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg, selectedTrace.dipDeg - 5)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            -5°
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg, selectedTrace.dipDeg - 1)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            -1°
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="90"
                            value={selectedTrace.dipDeg}
                            onChange={(e) => updateSelectedTraceDip(selectedTrace.dipDirectionDeg, parseInt(e.target.value) || 0)}
                            className="flex-1 min-w-0 bg-stone-900 border border-stone-700 rounded p-1 text-center font-mono text-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg, selectedTrace.dipDeg + 1)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            +1°
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedTraceDip(selectedTrace.dipDirectionDeg, selectedTrace.dipDeg + 5)}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 font-mono transition"
                          >
                            +5°
                          </button>
                        </div>
                      </div>

                      {/* Quick Cardinal Direction Pills */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {[
                          { l: 'N', d: 0 },
                          { l: 'NE', d: 45 },
                          { l: 'E', d: 90 },
                          { l: 'SE', d: 135 },
                          { l: 'S', d: 180 },
                          { l: 'SW', d: 225 },
                          { l: 'W', d: 270 },
                          { l: 'NW', d: 315 },
                        ].map((c) => (
                          <button
                            key={c.l}
                            type="button"
                            onClick={() => updateSelectedTraceDip(c.d, selectedTrace.dipDeg)}
                            className="flex-1 min-w-[28px] py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white text-[10px] font-mono text-center cursor-pointer"
                          >
                            {c.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Move / Nudge Joint Directional Pad */}
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
                          <Move className="w-3.5 h-3.5 text-orange-400" />
                          <span>Move Joint (Nudge)</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px]">
                          {[0.1, 0.2, 0.5, 1.0].map((step) => (
                            <button
                              key={step}
                              type="button"
                              onClick={() => setNudgeStepM(step)}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                nudgeStepM === step
                                  ? 'bg-orange-500 text-white font-bold'
                                  : 'bg-stone-800 text-stone-400 hover:text-white'
                              }`}
                            >
                              {step}m
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 w-36 mx-auto pt-1">
                        <div />
                        <button
                          type="button"
                          onClick={() => handleNudgeTrace(0, -nudgeStepM)}
                          className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition cursor-pointer"
                          title={`Move Up (-${nudgeStepM}m Perimeter)`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => handleNudgeTrace(-nudgeStepM, 0)}
                          className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition cursor-pointer"
                          title={`Move Left (-${nudgeStepM}m Chainage)`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center justify-center text-[10px] font-mono text-stone-400">
                          {nudgeStepM}m
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNudgeTrace(nudgeStepM, 0)}
                          className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition cursor-pointer"
                          title={`Move Right (+${nudgeStepM}m Chainage)`}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => handleNudgeTrace(0, nudgeStepM)}
                          className="p-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition cursor-pointer"
                          title={`Move Down (+${nudgeStepM}m Perimeter)`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div />
                      </div>
                    </div>

                    {/* Vertex Editing Controls */}
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-300">
                          Vertices ({selectedTrace.points?.length || 0} pts)
                        </span>
                        <button
                          type="button"
                          onClick={handleSmoothTraceCurve}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                          title="Apply smooth spline smoothing to joint curve"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Smooth Curve</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddVertexToTrace}
                          className="flex-1 py-1.5 px-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Append new vertex point"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Add Point</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteLastVertex}
                          disabled={(selectedTrace.points || []).length <= 2}
                          className={`flex-1 py-1.5 px-2 rounded text-[10.5px] flex items-center justify-center gap-1 transition ${
                            (selectedTrace.points || []).length > 2
                              ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer'
                              : 'bg-stone-900/50 text-stone-600 cursor-not-allowed'
                          }`}
                          title="Remove last vertex point"
                        >
                          <Minus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Delete Point</span>
                        </button>
                      </div>
                    </div>

                    {/* Merge with Another Joint Dropdown */}
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                      <span className="text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
                        <GitMerge className="w-3.5 h-3.5 text-amber-400" />
                        <span>Merge With Another Trace:</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="flex-1 bg-stone-900 border border-stone-700 rounded-lg p-1.5 text-xs text-white"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleExecuteMergeTraces(selectedTrace.id, e.target.value);
                            }
                          }}
                        >
                          <option value="" disabled>Select target trace to merge...</option>
                          {(currentDataset.traces || [])
                            .filter((t) => t.id !== selectedTrace.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.id} ({t.setId} - {t.orientationLabel})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Geological Infilling & Roughness */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] text-stone-400 font-semibold block mb-1">Aperture / Infill:</label>
                        <select
                          value={selectedTrace.fillingThickness || 'Thin'}
                          onChange={(e) => {
                            setCurrentDataset((prev) => ({
                              ...prev,
                              traces: prev.traces.map((t) =>
                                t.id === selectedTrace.id ? { ...t, fillingThickness: e.target.value as any } : t
                              ),
                            }));
                          }}
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-1.5 text-xs text-white"
                        >
                          <option value="None">None / Tight</option>
                          <option value="Thin">Thin (&lt; 1mm)</option>
                          <option value="Medium">Medium (1–5mm)</option>
                          <option value="Thick">Thick (&gt; 5mm)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10.5px] text-stone-400 font-semibold block mb-1">Roughness (JRC):</label>
                        <select
                          className="w-full bg-stone-950 border border-stone-700 rounded-lg p-1.5 text-xs text-white"
                          defaultValue="Undulating"
                        >
                          <option value="Rough">Rough Stepped</option>
                          <option value="Undulating">Rough Undulating</option>
                          <option value="Smooth">Smooth Planar</option>
                          <option value="Slickensided">Slickensided</option>
                        </select>
                      </div>
                    </div>

                    {/* Delete Joint Button */}
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="w-full py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Delete Joint Trace</span>
                    </button>
                  </div>
                )}

                {/* If Lithology Zone Selected */}
                {selectedLithology && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                        Selected Lithology Zone:
                      </span>
                      <strong className="text-white font-mono text-sm">{selectedLithology.label}</strong>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-stone-400 font-semibold">Rock Type Classification:</label>
                      <select
                        value={selectedLithology.rockType}
                        onChange={(e) => {
                          const found = ROCK_TYPES.find((r) => r.id === e.target.value);
                          setCurrentDataset((prev) => ({
                            ...prev,
                            lithologyZones: prev.lithologyZones.map((z) =>
                              z.id === selectedLithology.id
                                ? {
                                    ...z,
                                    rockType: e.target.value as StripRockTypeId,
                                    label: found?.label || z.label,
                                  }
                                : z
                            ),
                          }));
                        }}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-white"
                      >
                        {ROCK_TYPES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-stone-400 font-semibold">Custom Formation Label:</label>
                      <input
                        type="text"
                        value={selectedLithology.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentDataset((prev) => ({
                            ...prev,
                            lithologyZones: prev.lithologyZones.map((z) =>
                              z.id === selectedLithology.id ? { ...z, label: val } : z
                            ),
                          }));
                        }}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="w-full py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md mt-4"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Delete Lithology Zone</span>
                    </button>
                  </div>
                )}

                {/* If Water Symbol Selected */}
                {selectedWater && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                        Groundwater Seepage Marker:
                      </span>
                      <strong className="text-white font-mono text-sm">{selectedWater.condition}</strong>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-stone-400 font-semibold">Inflow Condition:</label>
                      <select
                        value={selectedWater.condition}
                        onChange={(e) => {
                          setCurrentDataset((prev) => ({
                            ...prev,
                            waterSymbols: prev.waterSymbols.map((w) =>
                              w.id === selectedWater.id
                                ? { ...w, condition: e.target.value as StripGroundwaterId }
                                : w
                            ),
                          }));
                        }}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="Dry">Dry</option>
                        <option value="Damp">Damp / Moist</option>
                        <option value="Wet">Wet</option>
                        <option value="Dripping">Dripping</option>
                        <option value="Flowing">Flowing / Seeping</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-stone-400 font-semibold">Note / Inflow Rate:</label>
                      <input
                        type="text"
                        value={selectedWater.label || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCurrentDataset((prev) => ({
                            ...prev,
                            waterSymbols: prev.waterSymbols.map((w) =>
                              w.id === selectedWater.id ? { ...w, label: val } : w
                            ),
                          }));
                        }}
                        className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="w-full py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md mt-4"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>Delete Seepage Symbol</span>
                    </button>
                  </div>
                )}

                {/* If Nothing Selected: Helpful Guide & Quick Navigation */}
                {/* If Nothing Selected: Clean Action Tools */}
                {!selectedObjectId && (
                  <div className="space-y-3 text-stone-400">
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTool('draw_joint')}
                        className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                      >
                        <PenTool className="w-4 h-4 text-white" />
                        <span>Add New Joint Trace</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTool('move_joint')}
                        className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 border border-stone-700 transition cursor-pointer"
                      >
                        <Move className="w-4 h-4 text-amber-400" />
                        <span>Switch to Move Joint Tool</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool('merge_joint');
                          setMergeSourceTraceId(null);
                          setMergeTargetTraceId(null);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 border border-stone-700 transition cursor-pointer"
                      >
                        <GitMerge className="w-4 h-4 text-amber-400" />
                        <span>Switch to Merge Tool</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: LITHOLOGY PALETTE & 1-CLICK FILL */}
            {sidebarTab === 'lithology' && (
              <div className="space-y-4">
                {/* 1-Click Fill Between Chainages Card */}
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-orange-400" />
                    <span className="font-bold text-white text-xs">Fill Strata Between Chainages:</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] text-stone-400 font-semibold block">Select Rock Type:</label>
                    <select
                      value={fillSpanRockType}
                      onChange={(e) => setFillSpanRockType(e.target.value as StripRockTypeId)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white"
                    >
                      {ROCK_TYPES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-400 font-semibold block mb-1">From Chainage (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fillSpanFromCh}
                        onChange={(e) => setFillSpanFromCh(parseFloat(e.target.value) || 0)}
                        className="w-full bg-stone-900 border border-stone-700 rounded p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-semibold block mb-1">To Chainage (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fillSpanToCh}
                        onChange={(e) => setFillSpanToCh(parseFloat(e.target.value) || 0)}
                        className="w-full bg-stone-900 border border-stone-700 rounded p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-semibold block">Tunnel Surface Span:</label>
                    <select
                      value={fillSpanZoneType}
                      onChange={(e) => setFillSpanZoneType(e.target.value as any)}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-1.5 text-xs text-white"
                    >
                      <option value="all">Full Tunnel Perimeter (Left Wall + Crown + Right Wall)</option>
                      <option value="crown">Crown Arch Only</option>
                      <option value="leftWall">Left Wall Only</option>
                      <option value="rightWall">Right Wall Only</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleFillBetweenChainages}
                    className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Lithology Zone</span>
                  </button>
                </div>

                {/* Rock Catalog List */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-stone-300 block">Rock Mass Classification Catalog:</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {ROCK_TYPES.map((rock) => (
                      <div
                        key={rock.id}
                        onClick={() => setSelectedRockTypeId(rock.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          selectedRockTypeId === rock.id
                            ? 'bg-stone-950 border-orange-500'
                            : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-md shrink-0 border border-white/20"
                            style={{ backgroundColor: rock.color }}
                          />
                          <span className="text-xs text-white font-medium">{rock.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-stone-400 uppercase">{rock.pattern}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TRACES & MERGE (Discontinuities Manager) */}
            {sidebarTab === 'previous_joints' && (
              <div className="space-y-3">
                {/* Search & Stats Header */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by ID, Set, or Azimuth..."
                      value={searchJointQuery}
                      onChange={(e) => setSearchJointQuery(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-stone-400 px-0.5">
                    <span>
                      {filteredTraces.length} of {(currentDataset.traces || []).length} traces
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('draw_joint')}
                      className="text-orange-400 hover:underline font-bold cursor-pointer"
                    >
                      + Add Joint Trace
                    </button>
                  </div>
                </div>

                {/* Traces List */}
                <div className="space-y-2">
                  {filteredTraces.map((trace) => {
                    const isSel = selectedObjectId === trace.id && selectedObjectType === 'trace';
                    const color = resolveStripTraceColor(trace);
                    const pts = trace.points || [];
                    const xs = pts.map((p) => p.x);
                    const minX = xs.length ? Math.min(...xs) : 0;
                    const maxX = xs.length ? Math.max(...xs) : 0;
                    let traceLen = 0;
                    for (let i = 0; i < pts.length - 1; i++) {
                      traceLen += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
                    }

                    return (
                      <div
                        key={trace.id}
                        onClick={() => {
                          setSelectedObjectId(trace.id);
                          setSelectedObjectType('trace');
                        }}
                        className={`p-2.5 rounded-xl border transition cursor-pointer ${
                          isSel
                            ? 'bg-stone-950 border-orange-500 shadow-md ring-1 ring-orange-500/40'
                            : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <strong className="font-mono text-white text-xs truncate">{trace.id}</strong>
                            <span className="px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 text-[9.5px]">
                              {trace.setId}
                            </span>
                          </div>
                          <span className="font-mono text-orange-400 font-bold text-[10px] shrink-0">
                            {trace.orientationLabel || `${trace.dipDirectionDeg}°/${trace.dipDeg}°`}
                          </span>
                        </div>

                        <div className="text-[10px] text-stone-400 flex items-center justify-between font-mono mb-2">
                          <span>CH {minX.toFixed(1)}–{maxX.toFixed(1)}m</span>
                          <span>{traceLen.toFixed(1)}m • {pts.length} pts</span>
                        </div>

                        {/* Action Buttons for this trace */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-800/80">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCenterOnTrace(trace);
                            }}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] flex items-center gap-1 cursor-pointer transition"
                            title="Focus & Zoom to trace"
                          >
                            <Eye className="w-3 h-3 text-cyan-400" />
                            <span>Zoom</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedObjectId(trace.id);
                              setSelectedObjectType('trace');
                              setActiveTool('move_joint');
                            }}
                            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] flex items-center gap-1 cursor-pointer transition"
                            title="Activate Move Tool for this trace"
                          >
                            <Move className="w-3 h-3 text-orange-400" />
                            <span>Move</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedObjectId(trace.id);
                              setSelectedObjectType('trace');
                              handleReverseTrace();
                            }}
                            className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer transition"
                            title="Reverse Direction & Flip Dip (+180°)"
                          >
                            <ArrowDownUp className="w-3 h-3 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTraceById(trace.id);
                            }}
                            className="p-1 rounded bg-stone-800 hover:bg-red-950 text-red-400 hover:text-red-300 cursor-pointer transition"
                            title="Delete this joint trace"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredTraces.length === 0 && (
                    <div className="p-6 text-center text-stone-500 text-xs">
                      No joint traces found matching &quot;{searchJointQuery}&quot;
                    </div>
                  )}
                </div>

                {(currentDataset.traces || []).length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllTraces}
                    className="w-full py-2 rounded-xl border border-red-900/50 text-red-400 hover:bg-red-950/40 text-xs font-bold transition cursor-pointer mt-2"
                  >
                    Delete All Joint Traces
                  </button>
                )}
              </div>
            )}

            {/* TAB 4: STRUCTURAL FEATURES & GROUNDWATER */}
            {sidebarTab === 'features' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <span className="text-[11px] font-bold text-stone-200 block">
                    Structural Discontinuity Features:
                  </span>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { name: 'Major Fault Line', type: 'Major Fault', color: '#dc2626' },
                      { name: 'Shear Zone / Seam', type: 'Shear Zone', color: '#ef4444' },
                      { name: 'Bedding / Foliation', type: 'Bedding/Foliation', color: '#3b82f6' },
                      { name: 'Quartz / Calcite Vein', type: 'Joint', color: '#fbbf24' },
                    ].map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => {
                          setSelectedJointSetId(f.name.includes('Fault') ? 'Fault' : f.name.includes('Shear') ? 'Shear' : 'J1');
                          setActiveTool('draw_joint');
                        }}
                        className="w-full p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 flex items-center justify-between text-left cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }} />
                          <span className="text-white font-medium">{f.name}</span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">+ Trace</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <span className="text-[11px] font-bold text-stone-200 block">
                    Groundwater Inflow Seepage:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {(['Dry', 'Damp', 'Wet', 'Dripping', 'Flowing'] as StripGroundwaterId[]).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => {
                          setSelectedWaterCondition(cond);
                          setActiveTool('place_water');
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition flex items-center gap-1.5 ${
                          selectedWaterCondition === cond && activeTool === 'place_water'
                            ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                            : 'bg-stone-900 border-stone-800 hover:bg-stone-800 text-stone-300'
                        }`}
                      >
                        <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{cond}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: LAYERS & DISPLAY SETTINGS */}
            {sidebarTab === 'layers' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                  <span className="text-[11px] font-bold text-stone-300 block">
                    Layer Visibility:
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showJointLayer}
                      onChange={(e) => setShowJointLayer(e.target.checked)}
                      className="rounded bg-stone-950 border-stone-700 text-orange-500"
                    />
                    <span className="text-xs text-stone-200">Joints &amp; Fractures ({(currentDataset.traces || []).length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLithologyLayer}
                      onChange={(e) => setShowLithologyLayer(e.target.checked)}
                      className="rounded bg-stone-950 border-stone-700 text-orange-500"
                    />
                    <span className="text-xs text-stone-200">Lithology Zones ({(currentDataset.lithologyZones || []).length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWaterLayer}
                      onChange={(e) => setShowWaterLayer(e.target.checked)}
                      className="rounded bg-stone-950 border-stone-700 text-orange-500"
                    />
                    <span className="text-xs text-stone-200">Groundwater Seepage ({(currentDataset.waterSymbols || []).length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPullsLayer}
                      onChange={(e) => setShowPullsLayer(e.target.checked)}
                      className="rounded bg-stone-950 border-stone-700 text-orange-500"
                    />
                    <span className="text-xs text-stone-200">Excavation Pulls / Rounds ({(currentDataset.pulls || []).length})</span>
                  </label>
                </div>

                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-300">CAD Grid Snapping:</span>
                    <button
                      type="button"
                      onClick={() => setSnapToGrid(!snapToGrid)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        snapToGrid ? 'bg-orange-500 text-white' : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {snapToGrid ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {[0.1, 0.25, 0.5, 1.0].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => {
                          setGridStepM(step);
                          setSnapToGrid(true);
                        }}
                        className={`flex-1 py-1 rounded text-center font-mono cursor-pointer transition ${
                          snapToGrid && gridStepM === step
                            ? 'bg-orange-950 border border-orange-500 text-orange-400 font-bold'
                            : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
                        }`}
                      >
                        {step}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                  <span className="text-[11px] font-bold text-stone-300 block">CAD Canvas Viewport:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleFitToScreen}
                      className="py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Fit All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="py-1.5 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{isDarkMode ? '🌙 Dark CAD' : '☀️ Light CAD'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Central CAD Canvas Container */}
        <div className="flex-1 relative overflow-hidden bg-black flex flex-col">
          {/* Top Quick Joint Presets Strip */}
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0 z-20">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline font-mono">Joint Sets:</span>
              {JOINT_SETS.map((js) => {
                const isSelected = selectedJointSetId === js.id;
                return (
                  <button
                    key={js.id}
                    type="button"
                    onClick={() => {
                      setSelectedJointSetId(js.id);
                      if (selectedObjectId && selectedObjectType === 'trace') {
                        pushHistory(currentDataset);
                        setCurrentDataset((prev) => ({
                          ...prev,
                          traces: prev.traces.map((t) =>
                            t.id === selectedObjectId
                              ? {
                                  ...t,
                                  setId: js.id,
                                  colorHex: js.color,
                                  structureType: js.structureType,
                                  orientationLabel: `${js.defaultDipDir.toString().padStart(3, '0')}/${js.defaultDip.toString().padStart(2, '0')}`,
                                  dipDirectionDeg: js.defaultDipDir,
                                  dipDeg: js.defaultDip,
                                }
                              : t
                          ),
                        }));
                      }
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs flex items-center gap-1.5 border transition cursor-pointer font-mono ${
                      isSelected
                        ? 'bg-slate-800 text-white border-sky-400 shadow-sm font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                    title={`${js.name}: ${js.defaultDipDir}°/${js.defaultDip}°`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: js.color }} />
                    <span>{js.id}</span>
                  </button>
                );
              })}
            </div>

            {/* Current Active Mode Status Indicator */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 shrink-0">
              {activeTool === 'move_joint' && (
                <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-300 font-bold flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  <span>MOVE JOINT: Drag trace on canvas</span>
                </span>
              )}
              {activeTool === 'edit_joint' && (
                <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-300 font-bold flex items-center gap-1">
                  <Edit2 className="w-3 h-3" />
                  <span>EDIT VERTICES: Drag points or click line to add point</span>
                </span>
              )}
              {activeTool === 'merge_joint' && (
                <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-1">
                  <GitMerge className="w-3 h-3" />
                  <span>
                    {mergeSourceTraceId
                      ? (mergeTargetTraceId ? 'MERGE: Ready to connect traces' : 'MERGE: Select second trace')
                      : 'MERGE: Select first trace'}
                  </span>
                </span>
              )}
              {activeTool === 'measure' && (
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  <span>{measureStartPoint ? 'MEASURE: Click target point' : 'MEASURE: Click start point'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Floating Merge Action Banner */}
          {activeTool === 'merge_joint' && mergeSourceTraceId && mergeTargetTraceId && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-slate-900 border-2 border-amber-500 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 font-mono">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-amber-400" />
                <div className="text-xs">
                  <div className="font-bold text-white">Merge Discontinuity Joint Traces?</div>
                  <div className="text-[11px] text-slate-400">
                    <strong className="text-amber-400">{mergeSourceTraceId}</strong> + <strong className="text-cyan-400">{mergeTargetTraceId}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleExecuteMergeTraces(mergeSourceTraceId, mergeTargetTraceId)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Merge</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMergeSourceTraceId(null);
                  setMergeTargetTraceId(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active Drawing Banner */}
          {activeDraftPoints.length > 0 && (
            <div className="absolute top-12 left-4 z-30 bg-slate-900/95 border border-sky-500/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs shadow-xl backdrop-blur-md font-mono">
              <span className="text-slate-300 font-medium">
                Drafting {activeTool === 'draw_joint' ? 'Joint' : 'Lithology'} ({activeDraftPoints.length} pts)
              </span>
              <button
                type="button"
                onClick={handleCommitDraft}
                className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition cursor-pointer shadow-sm"
              >
                ✓ Commit (Enter)
              </button>
              <button
                type="button"
                onClick={() => setActiveDraftPoints([])}
                className="px-2 py-1 rounded text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}



          {/* Vector Overlay for AutoCAD Object Snap (OSNAP - F3) & Dynamic Input (DYN - F12) */}
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {hoverOsnap && (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5"
                style={{ left: hoverOsnap.x, top: hoverOsnap.y }}
              >
                {hoverOsnap.type === 'ENDPOINT' ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 bg-emerald-400/20" />
                ) : (
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-cyan-400" />
                )}
                <div className="bg-slate-900/90 text-[10px] font-mono font-bold text-white px-1.5 py-0.5 rounded border border-slate-700 shadow-md">
                  {hoverOsnap.label}
                </div>
              </div>
            )}

            {cadDynInputEnabled && cursorCoords && (
              <div
                className="absolute transform translate-x-3 translate-y-3 bg-slate-900/95 border border-sky-500/70 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow-lg flex items-center gap-2"
                style={{ left: cursorCoords.screenX, top: cursorCoords.screenY }}
              >
                <span className="text-sky-300 font-bold">CH {cursorCoords.ch.toFixed(2)}m</span>
                <span className="text-slate-400">|</span>
                <span className="text-amber-300 font-bold">Y {cursorCoords.yPerim >= 0 ? '+' : ''}{cursorCoords.yPerim.toFixed(2)}m</span>
              </div>
            )}
          </div>

          {/* Main Workspace Viewport: 2D Unwrapped Strip vs 3D Continuous Tunnel Canvas */}
          {cadViewMode === '3D_CONTINUOUS' ? (
            <div className="w-full h-full relative">
              <ContinuousTunnel3DCanvas
                dataset={currentDataset}
                selectedTraceId={selectedObjectId}
                onSelectTrace={(id) => {
                  setSelectedObjectId(id);
                  setSelectedObjectType(id ? 'trace' : null);
                }}
                onUpdateTrace={(updatedTrace) => {
                  pushHistory(currentDataset);
                  setCurrentDataset((prev) => ({
                    ...prev,
                    traces: (prev.traces || []).map((t) => (t.id === updatedTrace.id ? updatedTrace : t)),
                    updatedAt: new Date().toISOString(),
                  }));
                }}
                onDeleteTrace={(traceId) => {
                  pushHistory(currentDataset);
                  setCurrentDataset((prev) => ({
                    ...prev,
                    traces: (prev.traces || []).filter((t) => t.id !== traceId),
                    updatedAt: new Date().toISOString(),
                  }));
                  setSelectedObjectId(null);
                  setSelectedObjectType(null);
                }}
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={(e) => {
                if (activeDraftPoints.length >= 2) {
                  handleCommitDraft();
                  return;
                }
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                for (const trace of currentDataset.traces || []) {
                  const pts = trace.points || [];
                  for (let i = 0; i < pts.length - 1; i++) {
                    const p1 = { x: worldToScreenX(pts[i].x), y: worldToScreenY(pts[i].y) };
                    const p2 = { x: worldToScreenX(pts[i + 1].x), y: worldToScreenY(pts[i + 1].y) };
                    if (distToSegment({ x: mouseX, y: mouseY }, p1, p2) < 18) {
                      setSelectedObjectId(trace.id);
                      setSelectedObjectType('trace');
                      setEditingTextTraceId(trace.id);
                      setEditingTextValue(trace.customLabel !== undefined ? trace.customLabel : trace.setId);
                      setEditingTextOrientation(trace.orientationLabel || `${trace.dipDirectionDeg}°/${trace.dipDeg}°`);
                      return;
                    }
                  }
                }
              }}
              className={`w-full h-full ${
                activeTool === 'move_joint'
                  ? 'cursor-move'
                  : activeTool === 'edit_joint'
                  ? 'cursor-crosshair'
                  : activeTool === 'edit_text'
                  ? 'cursor-text'
                  : activeTool === 'merge_joint'
                  ? 'cursor-pointer'
                  : activeTool === 'draw_joint'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
            />
          )}

          {/* Floating Canvas Text Editor Modal Overlay (User requirement: delete and edit any texts inside the canvas) */}
          {editingTextTraceId && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                      <Type className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Edit Canvas Text / Label</h3>
                      <p className="text-[11px] text-slate-500 font-mono">Trace ID: {editingTextTraceId}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingTextTraceId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Text to display on canvas:
                    </label>
                    <input
                      type="text"
                      value={editingTextValue}
                      onChange={(e) => setEditingTextValue(e.target.value)}
                      placeholder="e.g. J1, Fault Splay A, JS2..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-blue-600 focus:bg-white"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500">
                      Clean text only (no boxy borders or cards are drawn around text).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Orientation Label:
                    </label>
                    <input
                      type="text"
                      value={editingTextOrientation}
                      onChange={(e) => setEditingTextOrientation(e.target.value)}
                      placeholder="e.g. 140°/65°"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-blue-600 focus:bg-white"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                    <span>Delete text from canvas:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const trace = (currentDataset.traces || []).find((t) => t.id === editingTextTraceId);
                        if (trace) {
                          pushHistory(currentDataset);
                          setCurrentDataset((prev) => ({
                            ...prev,
                            traces: prev.traces.map((t) =>
                              t.id === editingTextTraceId ? { ...t, customLabel: '', hideLabel: true } : t
                            ),
                          }));
                        }
                        setEditingTextTraceId(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Text</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTextTraceId(null)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trace = (currentDataset.traces || []).find((t) => t.id === editingTextTraceId);
                      if (trace) {
                        pushHistory(currentDataset);
                        setCurrentDataset((prev) => ({
                          ...prev,
                          traces: prev.traces.map((t) =>
                            t.id === editingTextTraceId
                              ? {
                                  ...t,
                                  customLabel: editingTextValue,
                                  hideLabel: editingTextValue.trim() === '',
                                  orientationLabel: editingTextOrientation,
                                }
                              : t
                          ),
                        }));
                      }
                      setEditingTextTraceId(null);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Save Text
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AutoCAD 2026 Interactive Command Line Prompt Bar */}
          <div className="bg-slate-950 border-t border-slate-800 px-3 py-1.5 flex items-center gap-2 font-mono text-xs z-20 shrink-0">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold shrink-0">
              <Terminal className="w-3.5 h-3.5" />
              <span className="tracking-wider">COMMAND:</span>
            </div>
            <input
              type="text"
              value={cadCommandInput}
              onChange={(e) => setCadCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleExecuteCadCommand(cadCommandInput);
                } else if (e.key === 'Escape') {
                  setCadCommandInput('');
                  setActiveTool('select');
                }
              }}
              placeholder="Type command (e.g. LINE, MOVE, EDIT, MERGE, ERASE, LITH, WATER, MEASURE, AI, ZOOM, OSNAP, DYN)..."
              className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-600 text-xs font-mono"
            />
            <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400 shrink-0 border-l border-slate-800 pl-2">
              <span className="truncate max-w-xs text-amber-300/90">{cadStatusMessage}</span>
            </div>
          </div>

          {/* AutoCAD 2026 Status Bar (Bottom Status & Toggles) */}
          <div className="h-7 bg-slate-900 border-t border-slate-800 px-2 sm:px-3 flex items-center justify-between text-[10.5px] font-mono text-slate-400 shrink-0 z-20 select-none">
            {/* Left: Dynamic Coordinates & Surface Zone */}
            <div className="flex items-center gap-2 sm:gap-3 text-slate-300 font-mono">
              <span className="text-sky-400 font-bold">
                CH: {cursorCoords ? `${cursorCoords.ch.toFixed(2)}m` : `${fromRd.toFixed(2)}m`}
              </span>
              <span>
                Y: {cursorCoords ? `${cursorCoords.yPerim >= 0 ? '+' : ''}${cursorCoords.yPerim.toFixed(2)}m` : '+0.00m'}
              </span>
              <span className="hidden sm:inline px-1.5 py-0.2 rounded bg-slate-800 text-amber-400 text-[10px] font-sans font-semibold">
                {cursorCoords ? getZoneLabelForY(cursorCoords.yPerim) : 'Crown Arch'}
              </span>
              <span className="hidden lg:inline text-slate-500">|</span>
              <span className="hidden lg:inline text-slate-400">Scale: {Math.round(zoom * 100)}%</span>
            </div>

            {/* Right: AutoCAD Standard Status Toggles (MODEL, GRID, SNAP, ORTHO, POLAR, OSNAP, DYN, LWT) */}
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold border border-sky-700/50">
                MODEL
              </span>
              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  snapToGrid
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="GRID DISPLAY (F7)"
              >
                GRID
              </button>
              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  snapToGrid
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="SNAP MODE (F9)"
              >
                SNAP
              </button>
              <button
                type="button"
                onClick={() => setOrthoMode(!orthoMode)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  orthoMode
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="ORTHO MODE (F8)"
              >
                ORTHO
              </button>
              <button
                type="button"
                onClick={() => setPolarTracking(!polarTracking)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  polarTracking
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="POLAR TRACKING (F10)"
              >
                POLAR
              </button>
              <button
                type="button"
                onClick={() => setCadOsnapEnabled(!cadOsnapEnabled)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  cadOsnapEnabled
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="OBJECT SNAP (F3)"
              >
                OSNAP
              </button>
              <button
                type="button"
                onClick={() => setCadDynInputEnabled(!cadDynInputEnabled)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  cadDynInputEnabled
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="DYNAMIC INPUT (F12)"
              >
                DYN
              </button>
              <button
                type="button"
                onClick={() => setLineWeightDisplay(!lineWeightDisplay)}
                className={`hidden sm:inline px-1.5 py-0.5 rounded transition cursor-pointer ${
                  lineWeightDisplay
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="LINEWEIGHT DISPLAY"
              >
                LWT
              </button>
            </div>
          </div>
        </div>

        
      </div>
    </div>
  );
};
