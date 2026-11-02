import React, { memo } from 'react';
import { Check, Move } from 'lucide-react';
import { MappingDomainType, SurfaceSegmentItem } from '../engine/surfaceMappingEngine';
import { FieldPanelId, isStrikeOnlyHorizontalPanel } from '../engine/fieldMappingEngine';
import { getCrownStrikePair } from '../engine/joint3DInspectorEngine';

export interface FieldPending2DTrace {
  tool: string;
  subTool?: string;
  panel: string;
  points: { x: number; y: number }[];
  dipDirection?: number;
  dipAmount?: number;
  strike?: number;
  crownDipSign?: '+90' | '-90';
  editedByCompass?: boolean;
}

export interface CrossPortionBoundaryOption {
  sourcePanel: FieldPanelId;
  sourcePanelLabel?: string;
  targetPanel: FieldPanelId;
  targetPanelLabel: string;
  targetPoint: { x: number; y: number };
  metricLabel?: string;
  boundaryMetricLabel?: string;
  edgeDescription?: string;
  tool?: string;
}

export interface FieldCanvasFloatingControlsProps {
  isPencilTool: boolean;
  pending2DTrace: FieldPending2DTrace | null;
  setPending2DTrace: React.Dispatch<React.SetStateAction<any>>;
  isCanvasPanMode: boolean;
  setIsCanvasPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  mappingDomain: MappingDomainType;
  isVerticalShaftMode?: boolean;
  isSurfaceSegmentedMode: boolean;
  surfaceActiveSegmentIdx: number;
  surfaceSegments: SurfaceSegmentItem[];
  onJumpToSurfaceSegment: (idx: number) => void;
  onCommitPending2DTrace: (pendingItem: any) => void;
  boundaryExtensionOption?: CrossPortionBoundaryOption | null;
  onExtendToRelatedPortion?: (option: CrossPortionBoundaryOption) => void;
  onDismissBoundaryOption?: () => void;
}

export const FieldCanvasFloatingControls: React.FC<FieldCanvasFloatingControlsProps> = memo(
  ({
    isPencilTool,
    pending2DTrace,
    setPending2DTrace,
    isCanvasPanMode,
    setIsCanvasPanMode,
    mappingDomain,
    isVerticalShaftMode = false,
    isSurfaceSegmentedMode,
    surfaceActiveSegmentIdx,
    surfaceSegments,
    onJumpToSurfaceSegment,
    onCommitPending2DTrace,
    boundaryExtensionOption = null,
    onExtendToRelatedPortion,
    onDismissBoundaryOption,
  }) => {
    if ((!isPencilTool || !pending2DTrace) && !boundaryExtensionOption) return null;

    if (!pending2DTrace && boundaryExtensionOption && onExtendToRelatedPortion) {
      const mLabel = boundaryExtensionOption.metricLabel || boundaryExtensionOption.boundaryMetricLabel || '';
      const edgeDesc =
        boundaryExtensionOption.edgeDescription ||
        `${boundaryExtensionOption.sourcePanelLabel || boundaryExtensionOption.sourcePanel} → ${boundaryExtensionOption.targetPanelLabel}`;
      return (
        <div
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border-2 border-cyan-400 rounded-xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center gap-2.5 animate-fadeIn"
          data-window="face-canvas-floating-controls"
          data-element-id="face-canvas-boundary-extension-bar"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <div className="text-xs font-bold text-slate-100">
            <span className="text-cyan-300 font-black uppercase mr-1.5">Boundary Reached:</span>
            <span className="text-slate-300">{edgeDesc}</span>
          </div>
          <button
            type="button"
            onClick={() => onExtendToRelatedPortion(boundaryExtensionOption)}
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
            title={`Switch to ${boundaryExtensionOption.targetPanelLabel} with a glowing start-point snap marker at ${mLabel}`}
          >
            <span>Extend to {boundaryExtensionOption.targetPanelLabel}</span>
            <span className="font-mono text-[10.5px] bg-slate-950/20 px-1.5 py-0.2 rounded">
              {mLabel} →
            </span>
          </button>
          {onDismissBoundaryOption && (
            <button
              type="button"
              onClick={onDismissBoundaryOption}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      );
    }

    if (!pending2DTrace) return null;

    const isStrikeOnly =
      pending2DTrace.tool === '3_joints' &&
      isStrikeOnlyHorizontalPanel(
        pending2DTrace.panel as FieldPanelId,
        isVerticalShaftMode
      );
    const strikeVal =
      pending2DTrace.strike !== undefined
        ? ((pending2DTrace.strike % 360) + 360) % 360
        : (((pending2DTrace.dipDirection || 0) - 90 + 360) % 360);
    const strikePair = getCrownStrikePair(strikeVal);

    return (
      <div
        className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border-2 border-emerald-400 rounded-xl px-3 py-1.5 shadow-2xl flex flex-wrap items-center gap-2"
        data-window="face-canvas-floating-controls"
        data-element-id="face-canvas-floating-toolbar"
        data-tool="trace-controls"
        data-role="toolbar"
      >
        <div className="text-[11px] font-bold text-slate-200" data-element-id="face-canvas-trace-status-text">
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
            isStrikeOnly ? (
              <span className="font-mono text-amber-300">
                STR {strikePair.label} <span className="text-[10px] text-cyan-300">(Strike Only · 3D for Dip)</span>
              </span>
            ) : (
              <span className="font-mono text-amber-300">
                {String(pending2DTrace.dipDirection || 0).padStart(3, '0')}° /{' '}
                {pending2DTrace.dipAmount || 0}°
              </span>
            )
          ) : (
            <span className="text-[10px] text-cyan-300">
              Start anchored on outline — click/drag next point
            </span>
          )}
        </div>

        {/* Seamless Cross-Portion Continuation Button when endpoint stops on/near a shared outline boundary */}
        {boundaryExtensionOption && onExtendToRelatedPortion && pending2DTrace.points.length >= 2 && (
          <button
            type="button"
            onClick={() => onExtendToRelatedPortion(boundaryExtensionOption)}
            data-window="face-canvas-floating-controls"
            data-element-id="face-canvas-btn-extend-portion"
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-lg cursor-pointer animate-pulse"
            title={`Confirm trace on this panel and seamlessly continue on ${boundaryExtensionOption.targetPanelLabel} at ${boundaryExtensionOption.metricLabel}`}
          >
            <span>Extend to {boundaryExtensionOption.targetPanelLabel}</span>
            <span className="font-mono text-[10px] bg-slate-950/20 px-1 rounded">
              {boundaryExtensionOption.metricLabel} →
            </span>
          </button>
        )}

        {/* Pause / Move Canvas Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCanvasPanMode((prev) => !prev)}
          data-window="face-canvas-floating-controls"
          data-element-id="face-canvas-btn-move-canvas"
          data-tool="pan"
          data-role="button"
          data-action="toggle-canvas-pan"
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
              data-window="face-canvas-floating-controls"
              data-element-id="face-canvas-btn-next-segment"
              data-tool="segment-nav"
              data-role="button"
              data-action="jump-next-segment"
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer animate-pulse"
              title="Slide canvas forward to next segment while keeping trace active"
            >
              <span>Next ({surfaceSegments[surfaceActiveSegmentIdx + 1]?.label || 'Next'}) ▶</span>
            </button>
          )}

        {pending2DTrace.tool === '1_lithology' && pending2DTrace.points.length >= 2 && (
          <>
            <button
              type="button"
              onClick={() => {
                const closedPts = [...pending2DTrace.points, pending2DTrace.points[0]];
                onCommitPending2DTrace({
                  ...pending2DTrace,
                  points: closedPts,
                  isClosed: true,
                });
              }}
              data-window="face-canvas-floating-controls"
              data-element-id="face-canvas-btn-close-loop-fill"
              data-tool="lithology"
              data-role="button"
              data-action="close-loop-fill"
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
              title="Close loop from end to start and fill with lithology"
            >
              ⮌ Close Loop &amp; Fill
            </button>
            <button
              type="button"
              onClick={() => {
                onCommitPending2DTrace({
                  ...pending2DTrace,
                  isClosed: true,
                });
              }}
              data-window="face-canvas-floating-controls"
              data-element-id="face-canvas-btn-close-outline-fill"
              data-tool="lithology"
              data-role="button"
              data-action="close-outline-fill"
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
              title="Close boundary with tunnel outline and fill with lithology"
            >
              ⛶ Close with Outline &amp; Fill
            </button>
            <span className="text-[10.5px] font-bold text-amber-300 animate-pulse hidden sm:inline">
              👈 Tap inside line to fill
            </span>
          </>
        )}

        {pending2DTrace.tool !== '1_lithology' && pending2DTrace.points.length >= 2 && (
          <button
            type="button"
            onClick={() => onCommitPending2DTrace(pending2DTrace)}
            data-window="face-canvas-floating-controls"
            data-element-id="face-canvas-btn-confirm-trace"
            data-tool="commit"
            data-role="button"
            data-action="commit-pending-trace"
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
              data-window="face-canvas-floating-controls"
              data-element-id="face-canvas-btn-undo-point"
              data-tool="history"
              data-role="button"
              data-action="undo-last-point"
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs cursor-pointer"
            >
              Undo Pt
            </button>
          )}

        <button
          type="button"
          onClick={() => setPending2DTrace(null)}
          data-window="face-canvas-floating-controls"
          data-element-id="face-canvas-btn-cancel-trace"
          data-tool="cancel"
          data-role="button"
          data-action="cancel-pending-trace"
          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer"
        >
          Cancel
        </button>
      </div>
    );
  }
);

FieldCanvasFloatingControls.displayName = 'FieldCanvasFloatingControls';
