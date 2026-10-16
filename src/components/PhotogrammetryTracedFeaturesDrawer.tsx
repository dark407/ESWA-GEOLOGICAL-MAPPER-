import React from 'react';
import {
  Compass,
  Download,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Trash2,
  X,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Joint, JointSet, SurfaceType } from '../types/tunnel';
import {
  JOINT_SET_PALETTE,
  formatAccurateAngle,
  formatJointTraceLineLabel,
  getJointReferenceColor,
} from '../engine/orientationEngine';

interface PhotogrammetryTracedFeaturesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSurface: SurfaceType;
  joints: Joint[];
  jointSets: JointSet[];
  selectedJointId: string | null;
  onSelectJoint: (id: string | null) => void;
  onDeleteJoint: (id: string) => void;
  isPeekingTracesOnPhoto: boolean;
  onTogglePeekTracesOnPhoto: () => void;
  onOpenProperties: () => void;
  onOpen3DTunnel: () => void;
}

export const PhotogrammetryTracedFeaturesDrawer: React.FC<PhotogrammetryTracedFeaturesDrawerProps> = ({
  isOpen,
  onClose,
  activeSurface,
  joints,
  jointSets,
  selectedJointId,
  onSelectJoint,
  onDeleteJoint,
  isPeekingTracesOnPhoto,
  onTogglePeekTracesOnPhoto,
  onOpenProperties,
  onOpen3DTunnel,
}) => {
  if (!isOpen) return null;

  const surfaceJoints = joints.filter((j) => j.surface === activeSurface);
  const otherSurfacesCount = joints.length - surfaceJoints.length;

  // Group by sets
  const setCounts: Record<string, number> = {};
  for (const j of surfaceJoints) {
    const s = j.set || 'Unassigned';
    setCounts[s] = (setCounts[s] || 0) + 1;
  }

  const surfaceName =
    activeSurface === 'face'
      ? '1. Tunnel Face'
      : activeSurface === 'crown'
      ? '2. Crown (Roof)'
      : activeSurface === 'leftWall'
      ? '3. Left Wall'
      : '4. Right Wall';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-700/80 shadow-2xl flex flex-col max-h-[46vh] transition-all duration-200 font-mono text-slate-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-100">
              Traced Geological Features: {surfaceName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-bold text-sky-300">
              {surfaceJoints.length} on {surfaceName}
            </span>
            {otherSurfacesCount > 0 && (
              <span className="text-[10px] text-slate-400">
                ({joints.length} total round features)
              </span>
            )}
          </div>

          {/* Set pills */}
          <div className="hidden sm:flex items-center gap-1 ml-2">
            {Object.entries(setCounts).map(([setName, count]) => (
              <span
                key={setName}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
              >
                {setName}: <strong className="text-white">{count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Peek On Photo Toggle */}
          <button
            type="button"
            onClick={onTogglePeekTracesOnPhoto}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
              isPeekingTracesOnPhoto
                ? 'bg-amber-600/90 text-white border-amber-500 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Temporarily overlay all confirmed traces onto the Rock Photo (or hold Shift key while hovering)"
          >
            {isPeekingTracesOnPhoto ? (
              <Eye className="w-3.5 h-3.5 text-white" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>
              {isPeekingTracesOnPhoto ? 'Peeking Traces on Photo: ON' : 'Peek Traces on Photo'}
            </span>
          </button>

          {/* 3D Tunnel Button */}
          <button
            type="button"
            onClick={onOpen3DTunnel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-700 hover:bg-sky-600 text-white border border-sky-600 shadow-sm cursor-pointer"
            title="View 3D Extruded Photo Tunnel with spatial discontinuity planes"
          >
            <Compass className="w-3.5 h-3.5 text-amber-300" />
            <span>3D Photo Tunnel</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table / List Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {surfaceJoints.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Layers className="w-8 h-8 text-slate-600" />
            <p>No geological features traced on {surfaceName} yet.</p>
            <p className="text-[11px] text-slate-500">
              Trace rock discontinuities on the right photo canvas. Completed features will lock onto
              the clean outline canvas.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-400">
                <th className="py-1.5 px-2 font-bold"># / Set</th>
                <th className="py-1.5 px-2 font-bold">Type</th>
                <th className="py-1.5 px-2 font-bold">Strike / Dip</th>
                <th className="py-1.5 px-2 font-bold">Dip Direction</th>
                <th className="py-1.5 px-2 font-bold">Trace Length</th>
                <th className="py-1.5 px-2 font-bold">Roughness</th>
                <th className="py-1.5 px-2 font-bold">Aperture</th>
                <th className="py-1.5 px-2 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {surfaceJoints.map((joint, idx) => {
                const isSelected = joint.id === selectedJointId;
                const color = getJointReferenceColor(joint, jointSets);
                const label = formatJointTraceLineLabel(joint, joints);
                const len = joint.persistenceMeters || 0;

                return (
                  <tr
                    key={joint.id}
                    onClick={() => onSelectJoint(joint.id)}
                    className={`transition-colors cursor-pointer text-[11px] ${
                      isSelected
                        ? 'bg-sky-950/70 text-sky-100 font-semibold border-l-2 border-sky-400'
                        : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-bold text-white">{label}</span>
                      </div>
                    </td>

                    <td className="py-1.5 px-2 capitalize text-slate-300">
                      {joint.featureType.replace(/_/g, ' ')}
                    </td>

                    <td className="py-1.5 px-2">
                      {joint.strike != null && joint.dip != null ? (
                        <span>
                          {formatAccurateAngle(joint.strike)}° / {formatAccurateAngle(joint.dip)}°
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-1.5 px-2">
                      {joint.dipDirection != null ? (
                        <span className="text-sky-300">
                          {formatAccurateAngle(joint.dipDirection)}°
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-1.5 px-2 font-mono text-emerald-300">
                      {len > 0 ? `${len.toFixed(2)} m` : '—'}
                    </td>

                    <td className="py-1.5 px-2 text-[10px] text-slate-400 truncate max-w-[140px]">
                      {joint.roughness || 'Undulating / Rough'}
                    </td>

                    <td className="py-1.5 px-2 text-[10px] text-slate-400">
                      {joint.apertureMm || '0.5–2 mm'}
                    </td>

                    <td className="py-1.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectJoint(joint.id);
                            onOpenProperties();
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Edit Joint Properties"
                        >
                          <Sliders className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete traced feature ${label}?`)) {
                              onDeleteJoint(joint.id);
                            }
                          }}
                          className="p-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100"
                          title="Delete Feature"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-1.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          💡 <strong>Zero Occlusion Rule:</strong> Confirmed features are kept clean on the Photo
          Canvas so fresh rock is unobstructed. Use <strong>Peek Traces</strong> to inspect.
        </span>
        <span>
          Click any row to select and inspect on canvas · Press <strong>P</strong> for properties
        </span>
      </div>
    </div>
  );
};
