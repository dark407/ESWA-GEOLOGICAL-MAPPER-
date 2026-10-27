import React from 'react';
import {
  PhotoSurface,
  Point2D,
  SurfaceTransform,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  createDefaultSurfaceTransform,
  solveProjectiveHomography3x3,
} from '../engine/geometryEngine';
import {
  addIntermediateMeshControlPoints,
  createDefaultMeshControlPoints,
  createTunnelBoundaryCustomMask,
  subdivideCustomMaskPolygon,
} from '../engine/photoWarpEngine';
import {
  Check,
  FlipHorizontal,
  FlipVertical,
  Grid,
  Maximize2,
  Plus,
  Redo2,
  RotateCcw,
  Sliders,
  Undo2,
  X,
} from 'lucide-react';

export type PhotoEditorSubTab = 'basic' | 'perspective' | 'mesh_warp' | 'custom_mask';

interface PhotoFittingPanelProps {
  activeSurface: SurfaceType;
  currentPhoto: PhotoSurface;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  subTab: PhotoEditorSubTab;
  onChangeSubTab: (tab: PhotoEditorSubTab) => void;
  showMeshGrid: boolean;
  onToggleMeshGrid: (show: boolean) => void;
  addingControlPointMode: boolean;
  onToggleAddingControlPointMode: (active: boolean) => void;
  drawingCustomMaskMode: boolean;
  onToggleDrawingCustomMaskMode: (active: boolean) => void;
  onUpdateTransform: (updater: (prev: SurfaceTransform) => SurfaceTransform) => void;
  onUpdateOpacity: (opacity: number) => void;
  onUpdateCalibration: (focalMm: number, k1: number) => void;
  onFitToTunnel: () => void;
  onUndoTransform: () => void;
  onRedoTransform: () => void;
  canUndoTransform: boolean;
  canRedoTransform: boolean;
  onApply: () => void;
  onCancel: () => void;
  onOpenCustomProfileEditor?: () => void;
  splTwoClickMode?: boolean;
  splFirstPointUV?: { u: number; v: number } | null;
  onToggleSplTwoClickMode?: (active: boolean) => void;
  onAutoDetectSplSeam?: () => void;
  onDeduplicateSplOverlaps?: () => void;
}

export const PhotoFittingPanel: React.FC<PhotoFittingPanelProps> = ({
  activeSurface,
  currentPhoto,
  geometry,
  settings,
  subTab,
  onChangeSubTab,
  showMeshGrid,
  onToggleMeshGrid,
  addingControlPointMode,
  onToggleAddingControlPointMode,
  drawingCustomMaskMode,
  onToggleDrawingCustomMaskMode,
  onUpdateTransform,
  onUpdateOpacity,
  onUpdateCalibration,
  onFitToTunnel,
  onUndoTransform,
  onRedoTransform,
  canUndoTransform,
  canRedoTransform,
  onApply,
  onCancel,
  onOpenCustomProfileEditor,
  splTwoClickMode = false,
  splFirstPointUV = null,
  onToggleSplTwoClickMode,
  onAutoDetectSplSeam,
  onDeduplicateSplOverlaps,
}) => {
  const t = currentPhoto.transform;
  const edgeOffsets = t.edgeOffsets || [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const meshPts = t.meshControlPoints || createDefaultMeshControlPoints(3, 3);
  const customMaskPts = t.customMaskPoints || [];

  return (
    <div className="w-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
        <span className="font-mono font-bold text-sky-700 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-sky-600" />
          PHOTO FITTING ({activeSurface.toUpperCase()})
        </span>
        <div className="flex items-center gap-1">
          {onOpenCustomProfileEditor && (
            <button
              type="button"
              onClick={onOpenCustomProfileEditor}
              title="Edit Master Tunnel Shape & Wall/Crown Sizes"
              className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white rounded cursor-pointer mr-1"
            >
              Edit Tunnel Shape
            </button>
          )}
          <button
            onClick={onUndoTransform}
            disabled={!canUndoTransform}
            title="Undo Photo Edit"
            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-35 rounded hover:bg-slate-200/70"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedoTransform}
            disabled={!canRedoTransform}
            title="Redo Photo Edit"
            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-35 rounded hover:bg-slate-200/70"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Mode Sub-Tabs: Basic | Perspective | Mesh Warp | Custom Shape */}
      <div className="grid grid-cols-4 gap-0.5 p-1 bg-slate-100 border-b border-slate-200 font-mono text-[10px] shrink-0">
        {(
          [
            { id: 'basic', label: '1. BASIC' },
            { id: 'perspective', label: '2. PERSPECTIVE' },
            { id: 'mesh_warp', label: '3. MESH WARP' },
            { id: 'custom_mask', label: '4. SHAPE P1..P13' },
          ] as { id: PhotoEditorSubTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              onChangeSubTab(tab.id);
              onToggleAddingControlPointMode(false);
              onToggleDrawingCustomMaskMode(false);
              if (tab.id === 'custom_mask' && (!t.customMaskPoints || t.customMaskPoints.length < 3)) {
                const pts = createTunnelBoundaryCustomMask(activeSurface, geometry, settings);
                onUpdateTransform((prev) => ({
                  ...prev,
                  useCustomMask: true,
                  cropToGeometry: true,
                  customMaskPoints: pts,
                }));
              }
            }}
            className={`py-1.5 px-1 rounded font-semibold transition-colors text-center cursor-pointer ${
              subTab === tab.id
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Editor Controls */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3 font-mono text-[11px] bg-white text-slate-900">
        {/* Always-accessible Photo Opacity (0-100%) (Section 5) */}
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-800 font-bold">
              PHOTO OPACITY: {currentPhoto.opacity}%
            </span>
            <div className="flex items-center gap-1">
              {[100, 75, 50, 25, 0].map((val) => (
                <button
                  key={val}
                  onClick={() => onUpdateOpacity(val)}
                  className={`px-1 py-0.2 text-[9px] rounded font-semibold cursor-pointer border ${
                    currentPhoto.opacity === val
                      ? 'bg-cyan-600 text-white border-cyan-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={currentPhoto.opacity}
            onChange={(e) => onUpdateOpacity(Number(e.target.value))}
            className="w-full accent-cyan-600 cursor-pointer"
          />
        </div>

        {/* ================================================================
            WALL–CROWN (SPL) SEAM LOCK, AUTO-CROP & OVERLAP SOLVER
           ================================================================ */}
        <div className="p-2.5 bg-emerald-950/90 border border-emerald-600/70 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-emerald-300 font-bold text-[10.5px]">
              WALL–CROWN (SPL) SEAM CROP &amp; SCALE LOCK
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-800/80 text-emerald-100 text-[9px] font-bold">
              Zero Overlap
            </span>
          </div>
          <p className="text-[9.5px] text-emerald-100/90 leading-snug">
            Eliminate Wall–Crown photo overlap in seconds: click 2 points along the{' '}
            <strong>Wall–Crown meet line (SPL)</strong> on the photo (or 1-Click Auto-Detect) to
            automatically level, scale to true meters, and crop excess overlap.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {onToggleSplTwoClickMode && (
              <button
                type="button"
                onClick={() => onToggleSplTwoClickMode(!splTwoClickMode)}
                className={`py-1.5 px-2 rounded font-bold text-[10px] border transition-colors cursor-pointer ${
                  splTwoClickMode
                    ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                }`}
              >
                {splTwoClickMode
                  ? splFirstPointUV
                    ? 'Click 2nd SPL End Pt →'
                    : 'Click 1st SPL Start Pt →'
                  : '2-Click SPL Seam Lock'}
              </button>
            )}
            {onAutoDetectSplSeam && (
              <button
                type="button"
                onClick={onAutoDetectSplSeam}
                className="py-1.5 px-2 rounded font-bold text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 transition-colors cursor-pointer"
              >
                1-Click Auto SPL Crop
              </button>
            )}
          </div>
          {onDeduplicateSplOverlaps && (
            <button
              type="button"
              onClick={onDeduplicateSplOverlaps}
              className="w-full py-1.5 px-2 rounded font-bold text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
            >
              Deduplicate &amp; Link Wall–Crown (SPL) Seam Traces
            </button>
          )}
        </div>

        {/* ================================================================
            SUB-TAB 1: BASIC (Move, Pan, Zoom, Rotate, Scale X/Y, Flip, Crop)
           ================================================================ */}
        {subTab === 'basic' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-slate-700 font-semibold">Move / Pan X: {t.offsetX.toFixed(2)}m</span>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.05"
                  value={t.offsetX}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      offsetX: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-slate-700 font-semibold">Move / Pan Y: {t.offsetY.toFixed(2)}m</span>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.05"
                  value={t.offsetY}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      offsetY: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-700 font-semibold">
                  Scale X (Stretch/Shrink): {t.scaleX.toFixed(2)}×
                </span>
                <input
                  type="range"
                  min="0.4"
                  max="2.2"
                  step="0.02"
                  value={t.scaleX}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      scaleX: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-slate-700 font-semibold">
                  Scale Y (Stretch/Shrink): {t.scaleY.toFixed(2)}×
                </span>
                <input
                  type="range"
                  min="0.4"
                  max="2.2"
                  step="0.02"
                  value={t.scaleY}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      scaleY: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-700 font-semibold">
                  Uniform Zoom: {(t.zoom ?? 1).toFixed(2)}×
                </span>
                <input
                  type="range"
                  min="0.4"
                  max="2.4"
                  step="0.02"
                  value={t.zoom ?? 1}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      zoom: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-400">Rotate: {t.rotation.toFixed(1)}°</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="0.5"
                  value={t.rotation}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      rotation: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>
            </div>

            {/* Flip Horizontal / Flip Vertical & Quick Rotate */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({ ...prev, flipH: !prev.flipH }))
                }
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded border ${
                  t.flipH
                    ? 'bg-cyan-600 text-white border-cyan-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip Horiz
              </button>
              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({ ...prev, flipV: !prev.flipV }))
                }
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded border ${
                  t.flipV
                    ? 'bg-cyan-600 text-white border-cyan-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                Flip Vert
              </button>
              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({ ...prev, rotation: 0 }))
                }
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold cursor-pointer"
              >
                0°
              </button>
            </div>

            {/* Rectangular Image Crop Margins */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-cyan-800 font-bold">
                <span>IMAGE CROP MARGINS (TOP / BOTTOM / LEFT / RIGHT)</span>
                <button
                  onClick={() =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      cropTop: 0,
                      cropBottom: 0,
                      cropLeft: 0,
                      cropRight: 0,
                    }))
                  }
                  className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                >
                  Reset Crop
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <label>
                  <span className="text-slate-700 font-semibold">
                    Crop Top: {Math.round((t.cropTop || 0) * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={t.cropTop || 0}
                    onChange={(e) =>
                      onUpdateTransform((prev) => ({
                        ...prev,
                        cropTop: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Crop Bottom: {Math.round((t.cropBottom || 0) * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={t.cropBottom || 0}
                    onChange={(e) =>
                      onUpdateTransform((prev) => ({
                        ...prev,
                        cropBottom: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Crop Left: {Math.round((t.cropLeft || 0) * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={t.cropLeft || 0}
                    onChange={(e) =>
                      onUpdateTransform((prev) => ({
                        ...prev,
                        cropLeft: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Crop Right: {Math.round((t.cropRight || 0) * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={t.cropRight || 0}
                    onChange={(e) =>
                      onUpdateTransform((prev) => ({
                        ...prev,
                        cropRight: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-600"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            SUB-TAB 2: PERSPECTIVE (4 Corners, 4 Edges, Skew, Shear, Keystone)
           ================================================================ */}
        {subTab === 'perspective' && (
          <div className="space-y-2.5">
            <div className="p-2 bg-cyan-950/30 border border-cyan-800/50 rounded text-[10px] text-cyan-200">
              Drag the <strong>4 Cyan Corner Handles (TL, TR, BR, BL)</strong> or{' '}
              <strong>4 Amber Edge Handles (TOP, RIGHT, BOTTOM, LEFT)</strong> directly on the
              canvas, or use the perspective/skew controls below.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-slate-400">
                  Horiz. Perspective: {((t.perspH || 0) * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min="-0.35"
                  max="0.35"
                  step="0.01"
                  value={t.perspH || 0}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      perspH: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-400">
                  Vert. Perspective: {((t.perspV || 0) * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min="-0.35"
                  max="0.35"
                  step="0.01"
                  value={t.perspV || 0}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      perspV: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-400">
                  Skew / Shear X: {(t.skewX || 0).toFixed(1)}°
                </span>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  step="0.5"
                  value={t.skewX || 0}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      skewX: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>

              <label className="space-y-0.5">
                <span className="text-slate-400">
                  Skew / Shear Y: {(t.skewY || 0).toFixed(1)}°
                </span>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  step="0.5"
                  value={t.skewY || 0}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      skewY: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </label>
            </div>

            {/* 4 Edge Midpoint Push/Pull Sliders */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold">
                <span>EDGE MOVEMENT / BOWING (TOP, RIGHT, BOTTOM, LEFT)</span>
                <button
                  onClick={() =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      edgeOffsets: [
                        { x: 0, y: 0 },
                        { x: 0, y: 0 },
                        { x: 0, y: 0 },
                        { x: 0, y: 0 },
                      ],
                    }))
                  }
                  className="text-slate-500 hover:text-slate-900 font-bold cursor-pointer"
                >
                  Zero Edges
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <label>
                  <span className="text-slate-700 font-semibold">
                    Top Edge Arch: {Math.round(edgeOffsets[0].y * 100)}%
                  </span>
                  <input
                    type="range"
                    min="-0.3"
                    max="0.3"
                    step="0.01"
                    value={edgeOffsets[0].y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateTransform((prev) => {
                        const nextEdges = [
                          ...(prev.edgeOffsets || [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                          ]),
                        ] as [Point2D, Point2D, Point2D, Point2D];
                        nextEdges[0] = { ...nextEdges[0], y: val };
                        return { ...prev, edgeOffsets: nextEdges };
                      });
                    }}
                    className="w-full accent-amber-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Bottom Edge: {Math.round(edgeOffsets[2].y * 100)}%
                  </span>
                  <input
                    type="range"
                    min="-0.3"
                    max="0.3"
                    step="0.01"
                    value={edgeOffsets[2].y}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateTransform((prev) => {
                        const nextEdges = [
                          ...(prev.edgeOffsets || [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                          ]),
                        ] as [Point2D, Point2D, Point2D, Point2D];
                        nextEdges[2] = { ...nextEdges[2], y: val };
                        return { ...prev, edgeOffsets: nextEdges };
                      });
                    }}
                    className="w-full accent-amber-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Left Wall Edge: {Math.round(edgeOffsets[3].x * 100)}%
                  </span>
                  <input
                    type="range"
                    min="-0.3"
                    max="0.3"
                    step="0.01"
                    value={edgeOffsets[3].x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateTransform((prev) => {
                        const nextEdges = [
                          ...(prev.edgeOffsets || [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                          ]),
                        ] as [Point2D, Point2D, Point2D, Point2D];
                        nextEdges[3] = { ...nextEdges[3], x: val };
                        return { ...prev, edgeOffsets: nextEdges };
                      });
                    }}
                    className="w-full accent-amber-600"
                  />
                </label>
                <label>
                  <span className="text-slate-700 font-semibold">
                    Right Wall Edge: {Math.round(edgeOffsets[1].x * 100)}%
                  </span>
                  <input
                    type="range"
                    min="-0.3"
                    max="0.3"
                    step="0.01"
                    value={edgeOffsets[1].x}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateTransform((prev) => {
                        const nextEdges = [
                          ...(prev.edgeOffsets || [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                          ]),
                        ] as [Point2D, Point2D, Point2D, Point2D];
                        nextEdges[1] = { ...nextEdges[1], x: val };
                        return { ...prev, edgeOffsets: nextEdges };
                      });
                    }}
                    className="w-full accent-amber-600"
                  />
                </label>
              </div>
            </div>

            {/* Camera Calibration & Lens k1 */}
            {currentPhoto.calibration && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[10px] shadow-2xs">
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>CAMERA LENS CALIBRATION:</span>
                  <span className="text-cyan-800 font-bold">
                    {currentPhoto.calibration.focalLengthMm}mm eq · k1=
                    {currentPhoto.calibration.radialDistortionK1.toFixed(3)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="range"
                    min="14"
                    max="70"
                    step="1"
                    value={currentPhoto.calibration.focalLengthMm}
                    onChange={(e) =>
                      onUpdateCalibration(
                        parseFloat(e.target.value),
                        currentPhoto.calibration!.radialDistortionK1
                      )
                    }
                    className="w-full accent-cyan-600"
                  />
                  <input
                    type="range"
                    min="-0.25"
                    max="0.15"
                    step="0.005"
                    value={currentPhoto.calibration.radialDistortionK1}
                    onChange={(e) =>
                      onUpdateCalibration(
                        currentPhoto.calibration!.focalLengthMm,
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full accent-cyan-600"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            SUB-TAB 3: MESH WARP / PIECEWISE TRANSFORMATION (Section 3)
           ================================================================ */}
        {subTab === 'mesh_warp' && (
          <div className="space-y-2.5">
            <div className="p-2 bg-emerald-950/30 border border-emerald-700/50 rounded text-[10px] text-emerald-200 leading-relaxed">
              <strong>Piecewise Mesh Deformation ({meshPts.length} Control Points):</strong> Drag
              any green control point <strong>C1..C{meshPts.length}</strong> on the canvas to
              locally stretch, shrink, or warp the photograph to match curved{' '}
              <strong>CROWN, LEFT WALL, RIGHT WALL, or FACE</strong> geometry.
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onToggleAddingControlPointMode(!addingControlPointMode)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border font-semibold ${
                  addingControlPointMode
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {addingControlPointMode ? 'Click Photo to Place C_n' : '+ Add Control Point'}
              </button>

              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({
                    ...prev,
                    meshControlPoints: addIntermediateMeshControlPoints(
                      prev.meshControlPoints || createDefaultMeshControlPoints(3, 3)
                    ),
                  }))
                }
                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded"
              >
                <Grid className="w-3.5 h-3.5" />
                + Intermediate Points
              </button>

              <button
                onClick={() => {
                  // Apply curved arch / wall foreshortening preset
                  onUpdateTransform((prev) => {
                    const base = prev.meshControlPoints || createDefaultMeshControlPoints(3, 3);
                    const warped = base.map((cp) => {
                      if (activeSurface === 'crown') {
                        // Expand lateral springline edges for cylindrical crown unwrapping
                        const du = (cp.srcU - 0.5) * 0.08;
                        return { ...cp, dstU: Number((cp.srcU + du).toFixed(4)) };
                      }
                      // For face/walls: conform top corners slightly toward arch
                      const archShift =
                        cp.srcV < 0.35 ? (0.5 - cp.srcU) * 0.09 : 0;
                      return {
                        ...cp,
                        dstU: Number((cp.srcU + archShift).toFixed(4)),
                      };
                    });
                    return { ...prev, meshControlPoints: warped };
                  });
                }}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded"
              >
                Warp to Arch Curve
              </button>

              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({
                    ...prev,
                    meshControlPoints: createDefaultMeshControlPoints(3, 3),
                  }))
                }
                className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold cursor-pointer"
              >
                Reset Mesh (3×3)
              </button>
            </div>

            <label className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <span className="text-slate-800 font-semibold">Show Piecewise Warp Grid on Canvas</span>
              <input
                type="checkbox"
                checked={showMeshGrid}
                onChange={(e) => onToggleMeshGrid(e.target.checked)}
                className="rounded border-slate-300 bg-white text-cyan-600"
              />
            </label>
          </div>
        )}

        {/* ================================================================
            SUB-TAB 4: CUSTOM POLYGON SHAPE MASK (P1, P2, P3, P4, P5, P6, P7...)
           ================================================================ */}
        {subTab === 'custom_mask' && (
          <div className="space-y-2.5">
            <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-[10px] text-amber-950 leading-relaxed space-y-1.5">
              <div>
                <strong>Custom Tunnel Shape Boundary (P1..P{customMaskPts.length || 'n'}):</strong>{' '}
                Your active tunnel geometry is loaded below. Drag any vertex{' '}
                <strong>P1, P2, P3...</strong> on the canvas to fit the photo boundary, or open the
                Master Custom Shape Editor to customize Left Wall, Right Wall &amp; Crown lengths.
              </div>
              {onOpenCustomProfileEditor && (
                <button
                  type="button"
                  onClick={onOpenCustomProfileEditor}
                  className="w-full py-1.5 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold cursor-pointer text-center"
                >
                  Open Master Custom Tunnel Shape Editor →
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-center gap-2 text-slate-800 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.cropToGeometry}
                  onChange={(e) =>
                    onUpdateTransform((prev) => ({
                      ...prev,
                      cropToGeometry: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 bg-white text-cyan-600"
                />
                <span>Clip Photo to Boundary Mask</span>
              </label>

              <label className="flex items-center gap-1.5 text-amber-900 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(t.useCustomMask)}
                  onChange={(e) => {
                    const useCustom = e.target.checked;
                    onUpdateTransform((prev) => ({
                      ...prev,
                      useCustomMask: useCustom,
                      customMaskPoints:
                        prev.customMaskPoints && prev.customMaskPoints.length >= 3
                          ? prev.customMaskPoints
                          : createTunnelBoundaryCustomMask(activeSurface, geometry, settings),
                    }));
                  }}
                  className="rounded border-slate-700 bg-slate-800 text-amber-500"
                />
                <span>Use Custom P1..Pn</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  const pts = createTunnelBoundaryCustomMask(activeSurface, geometry, settings);
                  onUpdateTransform((prev) => ({
                    ...prev,
                    useCustomMask: true,
                    cropToGeometry: true,
                    customMaskPoints: pts,
                  }));
                }}
                className="py-1.5 px-2 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/60 rounded font-semibold"
              >
                Fit P1..Pn to Tunnel
              </button>

              <button
                onClick={() => {
                  onToggleDrawingCustomMaskMode(!drawingCustomMaskMode);
                  if (!t.useCustomMask) {
                    onUpdateTransform((prev) => ({
                      ...prev,
                      useCustomMask: true,
                      cropToGeometry: true,
                    }));
                  }
                }}
                className={`py-1.5 px-2 rounded border font-semibold ${
                  drawingCustomMaskMode
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
              >
                {drawingCustomMaskMode ? 'Click Canvas for P_n' : '+ Draw Custom P_n'}
              </button>

              <button
                onClick={() =>
                  onUpdateTransform((prev) => ({
                    ...prev,
                    useCustomMask: true,
                    customMaskPoints: subdivideCustomMaskPolygon(
                      prev.customMaskPoints && prev.customMaskPoints.length >= 3
                        ? prev.customMaskPoints
                        : createTunnelBoundaryCustomMask(activeSurface, geometry, settings)
                    ),
                  }))
                }
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded"
              >
                + Add Intermediate P_i
              </button>

              <button
                onClick={() => {
                  onToggleDrawingCustomMaskMode(true);
                  onUpdateTransform((prev) => ({
                    ...prev,
                    useCustomMask: true,
                    customMaskPoints: [],
                  }));
                }}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded"
              >
                Clear &amp; Redraw P1..Pn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          SECTION 4 REQUIRED FOOTER ACTION BAR:
          FIT TO TUNNEL | RESET | UNDO | REDO | APPLY | CANCEL
         ==================================================================== */}
      <div className="p-2.5 bg-slate-100 border-t border-slate-200 space-y-2 shrink-0 font-mono text-[11px]">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={onFitToTunnel}
            className="col-span-2 flex items-center justify-center gap-1 py-1.5 px-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-bold cursor-pointer shadow-xs"
            title="Auto-fit photograph to authoritative tunnel boundary"
          >
            <Maximize2 className="w-3 h-3" />
            FIT TO TUNNEL
          </button>

          <button
            onClick={() =>
              onUpdateTransform(() => createDefaultSurfaceTransform())
            }
            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            RESET
          </button>

          <button
            onClick={() => {
              const resetCorners: [Point2D, Point2D, Point2D, Point2D] = [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 },
              ];
              onUpdateTransform((prev) => ({
                ...prev,
                perspectiveCorners: resetCorners,
                homographyMatrix: solveProjectiveHomography3x3(resetCorners),
              }));
            }}
            className="py-1.5 px-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-[10px] font-semibold cursor-pointer"
          >
            1:1 Quad
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md font-semibold cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
            CANCEL
          </button>

          <button
            onClick={onApply}
            className="flex items-center justify-center gap-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            APPLY FITTING
          </button>
        </div>
      </div>
    </div>
  );
};
