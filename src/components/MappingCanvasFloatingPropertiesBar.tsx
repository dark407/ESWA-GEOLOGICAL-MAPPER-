import React, { memo } from 'react';
import {
  ActiveTool,
  GeologicalFeatureType,
  Joint,
  JointDrawMode,
  Point2D,
} from '../types/tunnel';

export interface MappingCanvasFloatingPropertiesBarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  selectedJoint: Joint | null;
  jointDrawMode: JointDrawMode;
  setJointDrawMode: (mode: JointDrawMode) => void;
  draftJointPoints: Point2D[];
  setDraftJointPoints: React.Dispatch<React.SetStateAction<Point2D[]>>;
  draftSetId: string;
  setDraftSetId: (setId: string) => void;
  draftFeatureType: GeologicalFeatureType;
  setDraftFeatureType: (type: GeologicalFeatureType) => void;
  onFinishDraftJoint: (points?: Point2D[]) => void;
  showCadPropertiesAlways: boolean;
  setShowCadPropertiesAlways: React.Dispatch<React.SetStateAction<boolean>>;
  joints: Joint[];
  onUpdateJointsWithHistory: (next: Joint[]) => void;
}

export const MappingCanvasFloatingPropertiesBar: React.FC<MappingCanvasFloatingPropertiesBarProps> = memo(
  ({
    activeTool,
    setActiveTool,
    selectedJoint,
    jointDrawMode,
    setJointDrawMode,
    draftJointPoints,
    setDraftJointPoints,
    draftSetId,
    setDraftSetId,
    draftFeatureType,
    setDraftFeatureType,
    onFinishDraftJoint,
    showCadPropertiesAlways,
    setShowCadPropertiesAlways,
    joints,
    onUpdateJointsWithHistory,
  }) => {
    const isDrawingJoint =
      activeTool === 'add_joint' ||
      activeTool === 'redraw_joint' ||
      activeTool === 'append_joint';

    if (!isDrawingJoint) return null;

    const DRAW_MODES: { id: JointDrawMode; label: string }[] = [
      { id: 'two_point_line', label: '2-Pt Line' },
      { id: 'polyline', label: 'Polyline' },
      { id: 'smooth_curve', label: 'Spline Curve' },
      { id: 'freehand', label: 'Freehand' },
      { id: 'magnetic_livewire', label: 'Snap Crack' },
      { id: 'seed_autotrace', label: '1-Click Seed' },
    ];

    return (
      <div className="absolute top-2.5 left-2.5 right-12 max-w-fit flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white/95 border border-amber-400 rounded-lg shadow-lg text-xs z-20 font-mono">
        <span className="font-bold text-amber-900 text-[11px] mr-0.5">
          {activeTool === 'redraw_joint'
            ? `RE-DRAW ${selectedJoint?.set || ''}:`
            : activeTool === 'append_joint'
            ? `APPEND ${selectedJoint?.set || ''}:`
            : 'DRAW MODE:'}
        </span>

        {DRAW_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (draftJointPoints.length >= 2) {
                onFinishDraftJoint(draftJointPoints);
              }
              setJointDrawMode(m.id);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
              jointDrawMode === m.id
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {m.label}
          </button>
        ))}

        <div className="h-3.5 w-px bg-slate-300 mx-0.5" />

        <select
          value={draftSetId}
          onChange={(e) => {
            const nextSet = e.target.value;
            setDraftSetId(nextSet);
            if (selectedJoint) {
              onUpdateJointsWithHistory(
                joints.map((j) => (j.id === selectedJoint.id ? { ...j, set: nextSet } : j))
              );
            }
          }}
          className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-bold text-slate-900 cursor-pointer"
          title="Active Joint Set ID"
        >
          {['J1', 'J2', 'J3', 'J4', 'J5', 'F1', 'J0'].map((s) => (
            <option key={s} value={s}>
              Set {s}
            </option>
          ))}
        </select>

        <select
          value={draftFeatureType}
          onChange={(e) => {
            const nextType = e.target.value as GeologicalFeatureType;
            setDraftFeatureType(nextType);
            if (selectedJoint) {
              onUpdateJointsWithHistory(
                joints.map((j) => (j.id === selectedJoint.id ? { ...j, featureType: nextType } : j))
              );
            }
          }}
          className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-900 cursor-pointer"
          title="Geological Feature Type"
        >
          <option value="joint">Joint</option>
          <option value="open_joint">Open Joint</option>
          <option value="fracture">Fracture</option>
          <option value="fault">Fault</option>
          <option value="shear">Shear Zone</option>
          <option value="bedding">Bedding</option>
          <option value="foliation">Foliation</option>
          <option value="vein">Vein</option>
          <option value="water_seepage">Water Seepage</option>
        </select>

        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
          {draftJointPoints.length} pts
        </span>

        {draftJointPoints.length > 0 && (
          <button
            type="button"
            onClick={() => setDraftJointPoints((prev) => prev.slice(0, -1))}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[10px] font-bold cursor-pointer"
          >
            Undo Pt
          </button>
        )}

        {draftJointPoints.length >= 2 && (
          <button
            type="button"
            onClick={() => onFinishDraftJoint()}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-md cursor-pointer shadow-xs"
          >
            ✓ Complete ({draftJointPoints.length} pts)
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowCadPropertiesAlways((p) => !p)}
          className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] rounded cursor-pointer"
        >
          {showCadPropertiesAlways ? 'Properties ✓' : 'Open Properties'}
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftJointPoints([]);
            setActiveTool('select');
          }}
          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 text-[10px] font-bold cursor-pointer"
        >
          Done
        </button>
      </div>
    );
  }
);

MappingCanvasFloatingPropertiesBar.displayName = 'MappingCanvasFloatingPropertiesBar';
