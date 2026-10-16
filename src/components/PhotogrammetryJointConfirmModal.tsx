import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Compass,
  Layers,
  RotateCcw,
  Ruler,
  X,
} from 'lucide-react';
import { Joint, SurfaceType } from '../types/tunnel';
import { formatAccurateAngle, formatJointTraceLineLabel } from '../engine/orientationEngine';

export interface PendingJointConfirmation {
  joint: Joint;
  isDuplicate: boolean;
  duplicateInfo?: {
    existingJointId: string;
    existingName: string;
    distanceCm: number;
    angleDiffDeg: number;
  } | null;
}

interface PhotogrammetryJointConfirmModalProps {
  pending: PendingJointConfirmation | null;
  onConfirm: () => void;
  onRetrace: () => void;
  onCancel: () => void;
  onUpdateFeatureType?: (type: any) => void;
  onUpdateSet?: (set: string) => void;
}

export const PhotogrammetryJointConfirmModal: React.FC<PhotogrammetryJointConfirmModalProps> = ({
  pending,
  onConfirm,
  onRetrace,
  onCancel,
  onUpdateFeatureType,
  onUpdateSet,
}) => {
  useEffect(() => {
    if (!pending) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRetrace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pending, onConfirm, onRetrace, onCancel]);

  if (!pending) return null;

  const { joint, isDuplicate, duplicateInfo } = pending;
  const len = joint.persistenceMeters || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 pointer-events-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-100 font-mono animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Confirm Traced Feature</h3>
              <p className="text-[10px] text-slate-400">
                Underground Face Mapping Photogrammetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Duplicate Warning Banner */}
        {isDuplicate && duplicateInfo && (
          <div className="mt-3 p-3 rounded-xl bg-orange-950/90 border border-orange-500/80 text-orange-200 text-xs flex items-start gap-2.5 shadow-md">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-orange-300 uppercase tracking-wide text-[11px]">
                Duplicate / Overlap Warning
              </div>
              <div className="text-[11px] leading-snug mt-0.5">
                This trace is within <strong>{duplicateInfo.distanceCm} cm</strong> of existing{' '}
                <strong>{duplicateInfo.existingName}</strong> (relative angle ~
                {duplicateInfo.angleDiffDeg}°).
              </div>
              <div className="text-[10px] text-orange-300/80 mt-1">
                If this is the same discontinuity, click <strong>Retrace</strong> or proceed with{' '}
                <strong>OK</strong> if logging a parallel sub-fracture.
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block">Feature / Set</span>
            <span className="font-bold text-white text-sm">
              {joint.featureType.toUpperCase()} ({joint.set || 'J1'})
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] uppercase text-slate-400 block">Trace Length</span>
            <span className="font-bold text-emerald-400 text-sm">
              {len.toFixed(2)} m
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2">
            <span className="text-[10px] uppercase text-slate-400 block">
              Orientation (Strike / Dip / DipDir)
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-bold text-sky-300 text-sm">
                Dip {formatAccurateAngle(joint.dip)}° → {formatAccurateAngle(joint.dipDirection)}°
              </span>
              <span className="text-[11px] text-slate-400">
                Strike {formatAccurateAngle(joint.strike)}°
              </span>
            </div>
          </div>
        </div>

        {/* Rock Surface Note */}
        <div className="mt-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-[10.5px] text-slate-300">
          ✨ <strong>Clean Rock Principle:</strong> Clicking <strong>OK</strong> locks this feature onto the Clean CAD Outline Canvas, and resets the Photo Canvas so your rock view remains completely unobstructed for the next joint.
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel (Esc)
            </button>
            <button
              type="button"
              onClick={onRetrace}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retrace (R)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-emerald-900/30 transition-transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>OK (Confirm)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
