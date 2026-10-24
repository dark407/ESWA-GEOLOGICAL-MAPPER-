import React, { useEffect, useState } from 'react';
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
import {
  addVertexToLithologyRegion,
  createLithologyRegionFromPolygon,
  createPresetAreaPolygon,
  doesJointIntersectLithologyRegion,
  generateAIGeologicalDescriptionForRegion,
  getLithologyPreset,
  LITHOLOGY_PRESETS,
  mergeTwoLithologyRegions,
  removeVertexFromLithologyRegion,
  resizeLithologyRegion,
  splitLithologyRegion,
  translateLithologyRegion,
} from '../engine/lithologyEngine';
import {
  CheckCircle2,
  Combine,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  PanelLeft,
  PanelRight,
  PenTool,
  Plus,
  Redo2,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';

interface LithologyPanelProps {
  activeSurface: SurfaceType;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photoSurface: PhotoSurface;
  joints: Joint[];
  lithologyRegions: LithologyRegion[];
  selectedRegionId: string | null;
  onSelectRegionId: (id: string | null) => void;
  onUpdateLithologyRegions: (next: LithologyRegion[]) => void;
  isDrawingLithologyPolygon: boolean;
  draftLithologyPoints: Point2D[];
  onStartDrawingLithologyPolygon: () => void;
  onUndoLastDraftPoint?: () => void;
  onFinishDrawingLithologyPolygon: () => void;
  onCancelDrawingLithologyPolygon: () => void;
  onReopenRegionAsDraft?: (region: LithologyRegion) => void;
  defaultPatternForNew?: LithologyPatternType;
  onChangeDefaultPatternForNew?: (pattern: LithologyPatternType) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onStatusMessage?: (msg: string) => void;
}

export const LithologyPanel: React.FC<LithologyPanelProps> = ({
  activeSurface,
  geometry,
  settings,
  photoSurface,
  joints,
  lithologyRegions,
  selectedRegionId,
  onSelectRegionId,
  onUpdateLithologyRegions,
  isDrawingLithologyPolygon,
  draftLithologyPoints,
  onStartDrawingLithologyPolygon,
  onUndoLastDraftPoint,
  onFinishDrawingLithologyPolygon,
  onCancelDrawingLithologyPolygon,
  onReopenRegionAsDraft,
  defaultPatternForNew: controlledDefaultPattern,
  onChangeDefaultPatternForNew,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  embedded = false,
  onClose,
  onStatusMessage,
}) => {
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [internalDefaultPattern, setInternalDefaultPattern] =
    useState<LithologyPatternType>('quartzite');
  const defaultPatternForNew = controlledDefaultPattern ?? internalDefaultPattern;
  const setDefaultPatternForNew = (nextPat: LithologyPatternType) => {
    setInternalDefaultPattern(nextPat);
    onChangeDefaultPatternForNew?.(nextPat);
  };
  const [activeVertexIdx, setActiveVertexIdx] = useState<number>(0);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [panelWidthPx, setPanelWidthPx] = useState<number>(340);
  const [resizingState, setResizingState] = useState<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!resizingState) return;
    const onMove = (ev: MouseEvent | PointerEvent) => {
      const dx = ev.clientX - resizingState.startX;
      const delta = dockSide === 'right' ? -dx : dx;
      setPanelWidthPx(
        Math.max(260, Math.min(720, Math.round(resizingState.startWidth + delta)))
      );
    };
    const onUp = () => setResizingState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizingState, dockSide]);

  // Filter regions for current surface
  const surfaceRegions = lithologyRegions.filter((r) => r.surface === activeSurface);
  const selectedRegion =
    surfaceRegions.find((r) => r.id === selectedRegionId) || surfaceRegions[0] || null;

  const updateSelectedRegion = (updater: (reg: LithologyRegion) => LithologyRegion) => {
    if (!selectedRegion) return;
    const next = lithologyRegions.map((r) =>
      r.id === selectedRegion.id ? updater(r) : r
    );
    onUpdateLithologyRegions(next);
  };

  // Create a region from a preset zone (user-initiated only)
  const handleSelectZoneArea = (
    zone: 'full' | 'upper_half' | 'lower_half' | 'left_half' | 'right_half'
  ) => {
    const poly = createPresetAreaPolygon(activeSurface, geometry, settings, zone);
    const newRegion = createLithologyRegionFromPolygon(
      activeSurface,
      poly,
      defaultPatternForNew,
      undefined,
      joints,
      photoSurface
    );
    onUpdateLithologyRegions([...lithologyRegions, newRegion]);
    onSelectRegionId(newRegion.id);
    onStatusMessage?.(
      `Created ${newRegion.lithologyName} region (${poly.length} vertices). AI suggested description ready for your review.`
    );
  };

  // AI Suggest Description (Section 14)
  const handleAISuggestDescription = () => {
    if (!selectedRegion) return;
    const suggestion = generateAIGeologicalDescriptionForRegion(
      selectedRegion,
      joints,
      photoSurface
    );
    updateSelectedRegion((reg) => ({
      ...reg,
      description: suggestion.description,
      structuralFeatures: suggestion.structuralFeatures,
      aiSuggestedDescription: suggestion.description,
      aiSuggestedStructuralFeatures: suggestion.structuralFeatures,
      supportingPhotosAnalyzed: photoSurface.supportingPhotos?.length || 0,
      userApproved: false,
    }));
    onStatusMessage?.(
      `AI generated geological description for ${selectedRegion.lithologyName} from mapped features & photos. Edit or approve below.`
    );
  };

  // Split selected region into 2 regions (Section 13)
  const handleSplitSelectedRegion = (direction: 'horizontal' | 'vertical' | 'diagonal') => {
    if (!selectedRegion) return;
    const res = splitLithologyRegion(selectedRegion, direction, joints, photoSurface);
    if (!res) {
      onStatusMessage?.('Could not split region along that axis.');
      return;
    }
    const [regA, regB] = res;
    const next = lithologyRegions.flatMap((r) =>
      r.id === selectedRegion.id ? [regA, regB] : [r]
    );
    onUpdateLithologyRegions(next);
    onSelectRegionId(regA.id);
    onStatusMessage?.(
      `Split lithology region (${direction}) into two editable regions. Select the second part to assign a different lithology.`
    );
  };

  // Merge selected region with another region on the same surface (Section 13)
  const handleMergeRegions = () => {
    if (!selectedRegion || !mergeTargetId || mergeTargetId === selectedRegion.id) return;
    const other = surfaceRegions.find((r) => r.id === mergeTargetId);
    if (!other) return;
    const merged = mergeTwoLithologyRegions(selectedRegion, other, joints, photoSurface);
    const next = lithologyRegions
      .filter((r) => r.id !== selectedRegion.id && r.id !== other.id)
      .concat(merged);
    onUpdateLithologyRegions(next);
    onSelectRegionId(merged.id);
    setMergeTargetId('');
    onStatusMessage?.(
      `Merged "${selectedRegion.lithologyName}" and "${other.lithologyName}" into a single lithology region.`
    );
  };

  // Delete selected region (Section 13)
  const handleDeleteSelectedRegion = () => {
    if (!selectedRegion) return;
    const next = lithologyRegions.filter((r) => r.id !== selectedRegion.id);
    onUpdateLithologyRegions(next);
    const remainingOnSurface = next.filter((r) => r.surface === activeSurface);
    onSelectRegionId(remainingOnSurface[0]?.id || null);
    onStatusMessage?.(`Deleted lithology region "${selectedRegion.lithologyName}".`);
  };

  // Count how many mapped joints intersect the selected region
  const intersectingJointCount = selectedRegion
    ? joints.filter((j) => doesJointIntersectLithologyRegion(j, selectedRegion)).length
    : 0;

  return (
    <aside
      style={embedded ? undefined : { width: `${panelWidthPx}px` }}
      className={
        embedded
          ? 'relative w-full flex-1 bg-[#0D121B] flex flex-col min-h-0 select-none overflow-hidden'
          : `relative max-w-[52vw] bg-[#0D121B] ${
              dockSide === 'left' ? 'order-first border-r' : 'order-last border-l'
            } border-slate-800 flex flex-col shrink-0 z-20 select-none overflow-hidden transition-[width] duration-75`
      }
    >
      {/* Interactive Drag-to-Resize Handle (Drag Edge to Expand or Shrink) */}
      {!embedded && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setResizingState({ startX: e.clientX, startWidth: panelWidthPx });
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            setResizingState({ startX: e.clientX, startWidth: panelWidthPx });
          }}
          title="Drag edge left or right to expand or shrink panel"
          className={`flex items-center justify-center absolute top-0 bottom-0 w-3 cursor-col-resize z-30 group hover:bg-sky-500/10 transition-colors ${
            dockSide === 'left' ? '-right-1.5' : '-left-1.5'
          }`}
        >
          <div className="h-20 w-1.5 rounded-full bg-slate-300 group-hover:bg-sky-500 transition-colors" />
        </div>
      )}

      {/* Header */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="truncate">
            <div className="text-xs font-mono font-bold text-slate-900 tracking-wide truncate">
              LITHOLOGY &amp; AI DESCRIPTION
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate">
              Select Area → Assign Lithology
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!embedded && (
            <button
              type="button"
              onClick={() => setDockSide((s) => (s === 'right' ? 'left' : 'right'))}
              className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] flex items-center gap-0.5 cursor-pointer"
              title="Move Panel to Left or Right Side"
            >
              {dockSide === 'right' ? <PanelLeft className="w-3 h-3" /> : <PanelRight className="w-3 h-3" />}
            </button>
          )}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-35 rounded hover:bg-slate-200"
              title="Undo Lithology / Canvas Action"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-35 rounded hover:bg-slate-200"
              title="Redo Lithology / Canvas Action"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200"
            title="Exit Lithology Tool"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 font-mono text-xs">
        {/* ====================================================================
            STEP 1: USER SELECTS / DRAWS ROCK AREA ON TUNNEL (Section 11)
           ==================================================================== */}
        <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300">
              1. SELECT / DRAW ROCK AREA
            </span>
            <span className="text-[10px] text-slate-400 uppercase">
              {activeSurface}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 block">
              Rock Lithology Type (Applies to Selected &amp; New Area):
            </label>
            <select
              value={selectedRegion ? selectedRegion.patternType : defaultPatternForNew}
              onChange={(e) => {
                const nextPattern = e.target.value as LithologyPatternType;
                setDefaultPatternForNew(nextPattern);
                if (selectedRegion) {
                  const preset = getLithologyPreset(nextPattern);
                  const updatedReg: LithologyRegion = {
                    ...selectedRegion,
                    patternType: nextPattern,
                    lithologyName: preset.defaultName,
                    colorHex: preset.colorHex,
                    userApproved: false,
                  };
                  const gen = generateAIGeologicalDescriptionForRegion(
                    updatedReg,
                    joints,
                    photoSurface
                  );
                  updatedReg.description = gen.description;
                  updatedReg.structuralFeatures = gen.structuralFeatures;
                  updateSelectedRegion(() => updatedReg);
                  onStatusMessage?.(`Updated lithology region to ${preset.defaultName}.`);
                }
              }}
              className="w-full bg-slate-950 border border-amber-500/60 rounded px-2 py-1.5 text-xs text-slate-100 font-semibold cursor-pointer"
            >
              {LITHOLOGY_PRESETS.map((p) => (
                <option key={p.patternType} value={p.patternType}>
                  {p.defaultName}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Polygon Drawing on Canvas */}
          {!isDrawingLithologyPolygon ? (
            <button
              onClick={onStartDrawingLithologyPolygon}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded transition-colors"
            >
              <PenTool className="w-3.5 h-3.5" />
              Draw Custom Rock Area on Canvas
            </button>
          ) : (
            <div className="p-2 bg-amber-950/50 border border-amber-500/60 rounded space-y-2">
              <div className="text-[10px] text-amber-200 leading-relaxed">
                Click points on the tunnel canvas to outline the rock area ({draftLithologyPoints.length}{' '}
                pts placed). Drag any placed point to adjust, or click L1 to close.
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onFinishDrawingLithologyPolygon}
                  disabled={draftLithologyPoints.length < 3}
                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded text-[11px]"
                >
                  Close &amp; Save ({draftLithologyPoints.length})
                </button>
                {onUndoLastDraftPoint && (
                  <button
                    onClick={onUndoLastDraftPoint}
                    disabled={draftLithologyPoints.length === 0}
                    className="py-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-200 rounded text-[11px]"
                    title="Undo Last Point"
                  >
                    Undo Pt
                  </button>
                )}
                <button
                  onClick={onCancelDrawingLithologyPolygon}
                  className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Quick Single-Click Area Selection */}
          <div className="pt-1">
            <div className="text-[10px] text-slate-400 mb-1">
              Or Quick-Select Tunnel Area (Reshapable):
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => handleSelectZoneArea('full')}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
              >
                + Full Area
              </button>
              <button
                onClick={() => handleSelectZoneArea('upper_half')}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
              >
                + Upper Half
              </button>
              <button
                onClick={() => handleSelectZoneArea('lower_half')}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
              >
                + Lower Half
              </button>
              <button
                onClick={() => handleSelectZoneArea('left_half')}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
              >
                + Left Zone
              </button>
              <button
                onClick={() => handleSelectZoneArea('right_half')}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
              >
                + Right Zone
              </button>
            </div>
          </div>

          {/* List of User-Defined Lithology Regions on Current Surface */}
          {surfaceRegions.length > 0 && (
            <div className="pt-1.5 border-t border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400">
                Selected Regions on {activeSurface.toUpperCase()} ({surfaceRegions.length}):
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {surfaceRegions.map((reg, idx) => {
                  const isSel = selectedRegion?.id === reg.id;
                  return (
                    <div
                      key={reg.id}
                      onClick={() => onSelectRegionId(reg.id)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer border text-[11px] ${
                        isSel
                          ? 'bg-amber-500/20 border-amber-500/60 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: reg.colorHex }}
                        />
                        <span className="font-semibold truncate">
                          R{idx + 1}: {reg.lithologyName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {reg.userApproved && (
                          <span
                            className="text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded"
                            title="User Approved Description"
                          >
                            OK
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400">
                          {reg.polygon.length}v
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedRegion ? (
          <>
            {/* ====================================================================
                STEP 2: CHOOSE LITHOLOGY & SUBTLE VISUALIZATION (Sections 11, 12, 13)
               ==================================================================== */}
            <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300">
                  2. SELECT &amp; EDIT LITHOLOGY
                </span>
                <span className="text-[10px] text-emerald-400">
                  Layer 2 (Below Traces)
                </span>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-400">
                  Geological Pattern / Standard Type:
                </span>
                <select
                  value={selectedRegion.patternType}
                  onChange={(e) => {
                    const nextPattern = e.target.value as LithologyPatternType;
                    const preset = getLithologyPreset(nextPattern);
                    const updatedReg: LithologyRegion = {
                      ...selectedRegion,
                      patternType: nextPattern,
                      lithologyName: preset.defaultName,
                      colorHex: preset.colorHex,
                      userApproved: false,
                    };
                    const gen = generateAIGeologicalDescriptionForRegion(
                      updatedReg,
                      joints,
                      photoSurface
                    );
                    updatedReg.description = gen.description;
                    updatedReg.structuralFeatures = gen.structuralFeatures;
                    updateSelectedRegion(() => updatedReg);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                >
                  {LITHOLOGY_PRESETS.map((p) => (
                    <option key={p.patternType} value={p.patternType}>
                      {p.defaultName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-400">
                  Editable Lithology Name (LITHOLOGY:):
                </span>
                <input
                  type="text"
                  value={selectedRegion.lithologyName}
                  onChange={(e) =>
                    updateSelectedRegion((reg) => ({
                      ...reg,
                      lithologyName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Quartzite"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-semibold"
                />
              </label>

              {/* Subtle Visual Opacity Slider (Section 12: Never overpower photograph or hide joints) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    Subtle Geology Overlay Opacity:
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {Math.round(selectedRegion.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={Math.round(selectedRegion.opacity * 100)}
                  onChange={(e) =>
                    updateSelectedRegion((reg) => ({
                      ...reg,
                      opacity: Number(e.target.value) / 100,
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
                <div className="text-[9px] text-slate-500 leading-tight">
                  Drawn strictly below joints, faults, veins, symbols &amp; labels (max 40% to keep photo &amp; structures clear).
                </div>
              </div>

              {/* Symbol Orientation Angle (Bedding / Foliation Dip & Alternative Rock Angle) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 font-semibold">
                    Symbol Angle (Bedding / Foliation / Dip):
                  </span>
                  <span className="font-mono text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700">
                    {(selectedRegion.patternAngleDeg ?? selectedRegion.angleDeg ?? selectedRegion.patternAngle ?? 0) > 0
                      ? `+${selectedRegion.patternAngleDeg ?? selectedRegion.angleDeg ?? selectedRegion.patternAngle ?? 0}°`
                      : `${selectedRegion.patternAngleDeg ?? selectedRegion.angleDeg ?? selectedRegion.patternAngle ?? 0}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={5}
                  value={selectedRegion.patternAngleDeg ?? selectedRegion.angleDeg ?? selectedRegion.patternAngle ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateSelectedRegion((reg) => ({
                      ...reg,
                      angleDeg: val,
                      patternAngle: val,
                      patternAngleDeg: val,
                    }));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[-45, -30, 0, 30, 45, 60, 90, -60].map((ang) => {
                    const cur = selectedRegion.patternAngleDeg ?? selectedRegion.angleDeg ?? selectedRegion.patternAngle ?? 0;
                    return (
                      <button
                        key={ang}
                        type="button"
                        onClick={() =>
                          updateSelectedRegion((reg) => ({
                            ...reg,
                            angleDeg: ang,
                            patternAngle: ang,
                            patternAngleDeg: ang,
                          }))
                        }
                        className={`py-0.5 px-1 rounded text-[9px] font-bold border cursor-pointer ${
                          cur === ang
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        {ang === 0 ? '0° Flat' : ang > 0 ? `+${ang}°` : `${ang}°`}
                      </button>
                    );
                  })}
                </div>
                {/* Sync with Bedding / Foliation (J0) button */}
                {(() => {
                  const beddingJoint = joints.find(
                    (j) =>
                      j.surface === activeSurface &&
                      (j.set === 'J0' ||
                        j.featureType === 'bedding' ||
                        j.featureType === 'foliation' ||
                        j.featureType === 'schistosity')
                  );
                  if (!beddingJoint) return null;
                  const rawAngle = Math.round(beddingJoint.traceAngle || beddingJoint.apparentDip || 0);
                  const normalizedAngle = rawAngle > 90 ? rawAngle - 180 : rawAngle;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        updateSelectedRegion((reg) => ({
                          ...reg,
                          angleDeg: normalizedAngle,
                          patternAngle: normalizedAngle,
                          patternAngleDeg: normalizedAngle,
                        }));
                        onStatusMessage?.(
                          `Aligned ${selectedRegion.lithologyName} symbol angle to Bedding/Foliation (${normalizedAngle}°).`
                        );
                      }}
                      className="w-full mt-1 py-1 px-2 bg-amber-950/70 hover:bg-amber-900 border border-amber-600/50 rounded text-[9.5px] font-bold text-amber-300 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Sync with Bedding / Foliation J0 ({normalizedAngle}°)
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* ====================================================================
                STEP 3: REGION EDITING — RESIZE, RESHAPE, SPLIT, MERGE, DELETE (Section 13)
               ==================================================================== */}
            <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300">
                  3. EDIT / RESHAPE / SPLIT / MERGE
                </span>
                <span className="text-[10px] text-slate-400">
                  {selectedRegion.polygon.length} Vertices (L1..L{selectedRegion.polygon.length})
                </span>
              </div>

              <div className="text-[10px] text-slate-400 leading-tight">
                Drag yellow <span className="text-amber-300 font-semibold">L1..L{selectedRegion.polygon.length}</span> handles directly on the canvas to reshape this lithology boundary.
              </div>

              {/* Add / Remove / Reopen Vertex */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    updateSelectedRegion((reg) => addVertexToLithologyRegion(reg))
                  }
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px]"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  Add Vertex
                </button>
                <button
                  onClick={() => {
                    const safeIdx = Math.min(activeVertexIdx, selectedRegion.polygon.length - 1);
                    updateSelectedRegion((reg) =>
                      removeVertexFromLithologyRegion(reg, safeIdx)
                    );
                    setActiveVertexIdx(0);
                  }}
                  disabled={selectedRegion.polygon.length <= 3}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded text-[10px]"
                >
                  <Minimize2 className="w-3 h-3 text-rose-400" />
                  Delete L{Math.min(activeVertexIdx + 1, selectedRegion.polygon.length)}
                </button>
              </div>

              {/* Vertex Selector & Reopen Polygon */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <select
                  value={Math.min(activeVertexIdx, selectedRegion.polygon.length - 1)}
                  onChange={(e) => setActiveVertexIdx(Number(e.target.value))}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-amber-200"
                >
                  {selectedRegion.polygon.map((pt, idx) => (
                    <option key={idx} value={idx}>
                      L{idx + 1}: ({pt.x.toFixed(2)}m, {pt.y.toFixed(2)}m)
                    </option>
                  ))}
                </select>
                {onReopenRegionAsDraft && (
                  <button
                    onClick={() => onReopenRegionAsDraft(selectedRegion)}
                    className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded text-[10px] whitespace-nowrap"
                    title="Reopen polygon to continue clicking & adding boundary points"
                  >
                    Reopen / Edit Pts
                  </button>
                )}
              </div>

              {/* Resize Region Controls */}
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">
                  Resize Selected Region:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => resizeLithologyRegion(reg, 0.9, 0.9))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                    title="Shrink Region 10%"
                  >
                    Shrink -10%
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => resizeLithologyRegion(reg, 1.1, 1.1))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                    title="Expand Region 10%"
                  >
                    Expand +10%
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => resizeLithologyRegion(reg, 1.12, 1.0))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    Widen X
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => resizeLithologyRegion(reg, 1.0, 1.12))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    Taller Y
                  </button>
                </div>
              </div>

              {/* Move / Shift Selected Region */}
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Move className="w-3 h-3 text-cyan-400" /> Shift / Move Region:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => translateLithologyRegion(reg, -0.35, 0))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    ← Left
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => translateLithologyRegion(reg, 0.35, 0))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    Right →
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => translateLithologyRegion(reg, 0, 0.35))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() =>
                      updateSelectedRegion((reg) => translateLithologyRegion(reg, 0, -0.35))
                    }
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                  >
                    ↓ Down
                  </button>
                </div>
              </div>

              {/* Split Region Controls */}
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-amber-400" /> Split Selected Region Into Two:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => handleSplitSelectedRegion('horizontal')}
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 rounded text-[10px]"
                  >
                    Split Horiz
                  </button>
                  <button
                    onClick={() => handleSplitSelectedRegion('vertical')}
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 rounded text-[10px]"
                  >
                    Split Vert
                  </button>
                  <button
                    onClick={() => handleSplitSelectedRegion('diagonal')}
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 rounded text-[10px]"
                  >
                    Split Diag
                  </button>
                </div>
              </div>

              {/* Merge Regions Control */}
              {surfaceRegions.length > 1 && (
                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Combine className="w-3 h-3 text-cyan-400" /> Merge With Another Region:
                  </span>
                  <div className="flex items-center gap-1">
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200"
                    >
                      <option value="">Select region to merge...</option>
                      {surfaceRegions
                        .filter((r) => r.id !== selectedRegion.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.lithologyName} ({r.polygon.length}v)
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleMergeRegions}
                      disabled={!mergeTargetId}
                      className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white rounded text-[10px] font-semibold"
                    >
                      Merge
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Region */}
              <div className="pt-1 border-t border-slate-800/80">
                <button
                  onClick={handleDeleteSelectedRegion}
                  className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 rounded text-[10px]"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Selected Lithology Region
                </button>
              </div>
            </div>

            {/* ====================================================================
                STEP 4: AI GEOLOGICAL DESCRIPTION & USER APPROVAL (Section 14)
               ==================================================================== */}
            <div className="bg-slate-900/80 border border-slate-800 rounded p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300">
                  4. AI GEOLOGICAL DESCRIPTION
                </span>
                <button
                  onClick={handleAISuggestDescription}
                  className="flex items-center gap-1 px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded text-[10px]"
                  title="Generate concise description from selected lithology, visible rock & mapped joints"
                >
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  AI Suggest
                </button>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/70 px-2 py-1 rounded border border-slate-800">
                <span>Traces inside region: {intersectingJointCount}</span>
                <span>
                  Supporting photos: {photoSurface.supportingPhotos?.length || 0}
                </span>
              </div>

              {/* Structured Output Preview & Editor (LITHOLOGY / DESCRIPTION / STRUCTURAL FEATURES) */}
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-300 block">
                    LITHOLOGY:
                  </span>
                  <div className="text-xs font-semibold text-amber-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                    {selectedRegion.lithologyName}
                  </div>
                </div>

                <label className="block space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 block">
                    DESCRIPTION (User-Editable):
                  </span>
                  <textarea
                    rows={3}
                    value={selectedRegion.description}
                    onChange={(e) =>
                      updateSelectedRegion((reg) => ({
                        ...reg,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Medium to coarse grained quartzite with visible foliation, discontinuities and minor clay-filled seams."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-[11px] text-slate-100 leading-relaxed"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 block">
                    STRUCTURAL FEATURES (User-Editable):
                  </span>
                  <textarea
                    rows={2}
                    value={selectedRegion.structuralFeatures}
                    onChange={(e) =>
                      updateSelectedRegion((reg) => ({
                        ...reg,
                        structuralFeatures: e.target.value,
                      }))
                    }
                    placeholder="Predominant joint sets J1/J2 with associated minor veins."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-[11px] text-slate-100 leading-relaxed"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] font-bold text-slate-300 block">
                    NOTES / FIELD OBSERVATIONS (User-Editable):
                  </span>
                  <textarea
                    rows={2}
                    value={selectedRegion.notes || ''}
                    onChange={(e) =>
                      updateSelectedRegion((reg) => ({
                        ...reg,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Add engineering geology notes, weathering grade, or support remarks for this unit..."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-[11px] text-slate-100 leading-relaxed"
                  />
                </label>
              </div>

              <button
                onClick={() => {
                  updateSelectedRegion((reg) => ({
                    ...reg,
                    userApproved: true,
                  }));
                  onStatusMessage?.(
                    `Approved final geological description for ${selectedRegion.lithologyName}. Synced to Final Engineering Sheet.`
                  );
                }}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded font-semibold text-xs transition-colors ${
                  selectedRegion.userApproved
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {selectedRegion.userApproved
                  ? 'User-Edited Description Approved'
                  : 'Approve Final Description'}
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 text-center bg-slate-900/50 border border-slate-800/80 rounded text-slate-400 space-y-1.5">
            <div className="text-xs font-semibold text-slate-300">
              No Lithology Area Selected Yet
            </div>
            <div className="text-[11px] leading-relaxed">
              Per Section 11, the tunnel is not automatically divided into excessive regions. Click{' '}
              <span className="text-amber-300 font-semibold">Draw Custom Rock Area</span> or{' '}
              <span className="text-cyan-300 font-semibold">+ Full Area</span> above to select a rock area.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
