// ============================================================================
// ESWA ROCK MECHANICS — DATA REQUIREMENT LOCK & PHYSICAL BOUNDS ENFORCER VIEW
// ============================================================================
// Enforces scientific integrity: locks geotechnical calculations whenever
// required inputs are missing or violate physical rock mechanics laws.
// Standards: ISRM, Bieniawski RMR89, Barton Q, Goodman-Shi (1985).
// ============================================================================

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Lock,
  PenTool,
  ShieldAlert,
  Sliders,
  XCircle,
} from 'lucide-react';
import { ModuleDataReadiness } from '../engine/rockMechanicsValidator';

export interface DataRequirementLockViewProps {
  readiness: ModuleDataReadiness;
  moduleTitle: string;
  onReturnToCanvas?: () => void;
  onOpenClassificationDrawer?: () => void;
}

export const DataRequirementLockView: React.FC<DataRequirementLockViewProps> = ({
  readiness,
  moduleTitle,
  onReturnToCanvas,
  onOpenClassificationDrawer,
}) => {
  const isViolation = readiness.status === 'INVALID' || readiness.validationErrors.length > 0;

  return (
    <div className="w-full min-h-[480px] flex items-center justify-center p-4 sm:p-8 font-mono">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Top Badges & Protocol Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1.5 ${
                isViolation
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>{isViolation ? 'PHYSICAL BOUND VIOLATION' : 'CALCULATION LOCKED'}</span>
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
              ISRM / RMR89 / BARTON Q PROTOCOL
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Module: <strong className="text-white">{moduleTitle}</strong>
          </span>
        </div>

        {/* Hero Title & Scientific Explanation */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-lg border shrink-0 ${
              isViolation
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {isViolation ? <AlertOctagon className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {isViolation
                ? 'Physical & Theoretical Bounds Rejected'
                : 'Field Ground-Truth Data Required'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isViolation
                ? 'One or more geotechnical parameters violate physical rock mechanics limits or geometrical orthogonality laws. Calculations cannot proceed on thermodynamically impossible values.'
                : 'This rock mechanics calculation is strictly locked until authentic geotechnical parameters are supplied from the active excavation face. Autonomous calculation with synthetic or unverified values is prohibited.'}
            </p>
          </div>
        </div>

        {/* Missing Required Inputs Checklist */}
        {readiness.missingInputs && readiness.missingInputs.length > 0 && (
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Required Field Input Checklist</span>
              </span>
              <span className="text-[10px] text-amber-400 font-bold">
                {readiness.missingInputs.length} Missing Input{readiness.missingInputs.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-2">
              {readiness.missingInputs.map((inputMsg, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800"
                >
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="leading-snug">{inputMsg}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Errors List (Physical Bounds) */}
        {readiness.validationErrors && readiness.validationErrors.length > 0 && (
          <div className="bg-rose-950/20 rounded-lg border border-rose-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Physical Bounds Violations</span>
              </span>
              <span className="text-[10px] text-rose-400 font-bold">
                {readiness.validationErrors.length} Error{readiness.validationErrors.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-2">
              {readiness.validationErrors.map((errMsg, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-rose-200 bg-rose-950/40 p-2.5 rounded border border-rose-800/40"
                >
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errMsg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Warnings */}
        {readiness.validationWarnings && readiness.validationWarnings.length > 0 && (
          <div className="bg-amber-950/20 rounded-lg border border-amber-900/40 p-3 space-y-2">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Theoretical Warnings</span>
            </span>
            <ul className="space-y-1">
              {readiness.validationWarnings.map((warnMsg, idx) => (
                <li key={idx} className="text-[11px] text-amber-200/90 leading-tight">
                  • {warnMsg}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Guidance & Direct Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 leading-snug">
            {readiness.actionGuidance}
          </p>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {onReturnToCanvas && (
              <button
                type="button"
                onClick={onReturnToCanvas}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Map on Face Canvas</span>
              </button>
            )}
            {onOpenClassificationDrawer && (
              <button
                type="button"
                onClick={onOpenClassificationDrawer}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Set RMR / Q</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
