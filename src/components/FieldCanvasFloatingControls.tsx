import React, { memo } from 'react';
import { Check, Move } from 'lucide-react';
import { MappingDomainType, SurfaceSegmentItem } from '../engine/surfaceMappingEngine';

export interface FieldPending2DTrace {
  tool: string;
  subTool?: string;
  panel: string;
  points: { x: number; y: number }[];
  dipDirection?: number;
  dipAmount?: number;
}

export interface FieldCanvasFloatingControlsProps {
  isPencilTool: boolean;
  pending2DTrace: FieldPending2DTrace | null;
  setPending2DTrace: React.Dispatch<React.SetStateAction<any>>;
  isCanvasPanMode: boolean;
  setIsCanvasPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  mappingDomain: MappingDomainType;
  isSurfaceSegmentedMode: boolean;
  surfaceActiveSegmentIdx: number;
  surfaceSegments: SurfaceSegmentItem[];
  onJumpToSurfaceSegment: (idx: number) => void;
  onCommitPending2DTrace: (pendingItem: any) => void;
}

export const FieldCanvasFloatingControls: React.FC<FieldCanvasFloatingControlsProps> = memo(
  ({
    isPencilTool,
    pending2DTrace,
    setPending2DTrace,
    isCanvasPanMode,
    setIsCanvasPanMode,
    mappingDomain,
    isSurfaceSegmentedMode,
    surfaceActiveSegmentIdx,
    surfaceSegments,
    onJumpToSurfaceSegment,
    onCommitPending2DTrace,
  }) => {
    if (!isPencilTool || !pending2DTrace) return null;

    return (
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border-2 border-emerald-400 rounded-xl px-3 py-1.5 shadow-2xl flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-bold text-slate-200">
          <span className="text-emerald-400 font-black uppercase mr-1.5">
            {pending2DTrace.subTool === 'spline'
              ? 'Spline Trace'
              : pending2DTrace.subTool === 'polyline'
              ? 'Polyline Trace'
              : pending2DTrace.tool === '4_dip_surface'
              ? 'Dip Surface'
              : 'Pencil Trace'}
          </span>
          {pending2DTrace.points.length >= 2 ? (
            <span className="font-mono text-amber-300">
              {String(pending2DTrace.dipDirection || 0).padStart(3, '0')}° /{' '}
              {pending2DTrace.dipAmount || 0}°
            </span>
          ) : (
            <span className="text-[10px] text-cyan-300">
              Start anchored on outline — click/drag next point
            </span>
          )}
        </div>

        {/* Pause / Move Canvas Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCanvasPanMode((prev) => !prev)}
          className={`px-2.5 py-1 rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer transition-all ${
            isCanvasPanMode
              ? 'bg-sky-500 text-slate-950 shadow ring-1 ring-sky-300'
              : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40'
          }`}
          title="Pause trace drawing to pan or move canvas without dropping points"
        >
          <Move className="w-3.5 h-3.5" />
          <span>{isCanvasPanMode ? 'Resume Draw' : 'Move Canvas'}</span>
        </button>

        {/* Move to Next Segment in Segmented Mode */}
        {mappingDomain !== 'TUNNEL' &&
          isSurfaceSegmentedMode &&
          surfaceActiveSegmentIdx < surfaceSegments.length - 1 && (
            <button
              type="button"
              onClick={() => {
                onJumpToSurfaceSegment(surfaceActiveSegmentIdx + 1);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer animate-pulse"
              title="Slide canvas forward to next segment while keeping trace active"
            >
              <span>Next ({surfaceSegments[surfaceActiveSegmentIdx + 1]?.label || 'Next'}) ▶</span>
            </button>
          )}

        {pending2DTrace.points.length >= 2 && (
          <button
            type="button"
            onClick={() => onCommitPending2DTrace(pending2DTrace)}
            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Confirm
          </button>
        )}

        {(pending2DTrace.subTool === 'spline' || pending2DTrace.subTool === 'polyline') &&
          pending2DTrace.points.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setPending2DTrace((prev: any) =>
                  prev && prev.points.length > 1
                    ? { ...prev, points: prev.points.slice(0, -1) }
                    : null
                )
              }
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs cursor-pointer"
            >
              Undo Pt
            </button>
          )}

        <button
          type="button"
          onClick={() => setPending2DTrace(null)}
          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer"
        >
          Cancel
        </button>
      </div>
    );
  }
);

FieldCanvasFloatingControls.displayName = 'FieldCanvasFloatingControls';
