import React, { useMemo } from 'react';
import {
  X,
  Gauge,
  CircleDot,
  Wrench,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  TbmMachineParameters,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';

interface TbmShieldInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TunnelSettings;
  geometry: TunnelGeometry;
  tbmParams?: TbmMachineParameters;
  onUpdateTbmParams: (next: TbmMachineParameters) => void;
}

const SEGMENT_IDS = ['Key', 'A1', 'A2', 'B1', 'B2', 'C'];

export const TbmShieldInspectorModal: React.FC<TbmShieldInspectorModalProps> = ({
  isOpen,
  onClose,
  settings,
  geometry,
  tbmParams,
  onUpdateTbmParams,
}) => {
  const params: TbmMachineParameters = useMemo(() => {
    return {
      ringNumber: tbmParams?.ringNumber ?? 142,
      segmentId: tbmParams?.segmentId || 'Key',
      strokeLengthMm: tbmParams?.strokeLengthMm ?? 1500,
      thrustForceKN: tbmParams?.thrustForceKN ?? 18500,
      cutterheadTorqueKNm: tbmParams?.cutterheadTorqueKNm ?? 4200,
      penetrationRateMmPerRev: tbmParams?.penetrationRateMmPerRev ?? 8.5,
      advanceRateMmPerMin: tbmParams?.advanceRateMmPerMin ?? 32,
      groutPressureBar: tbmParams?.groutPressureBar ?? 2.8,
      groutVolumeM3: tbmParams?.groutVolumeM3 ?? 4.2,
      epbPressureBar: tbmParams?.epbPressureBar ?? 1.65,
      discCutterWearMm: tbmParams?.discCutterWearMm ?? 6.2,
      cutterheadInspectionNotes:
        tbmParams?.cutterheadInspectionNotes ||
        'Disc cutters #12 & #14 show normal abrasive wear; gauge cutters within 8mm clearance threshold.',
    };
  }, [tbmParams]);

  if (!isOpen) return null;

  const handleUpdate = (patch: Partial<TbmMachineParameters>) => {
    onUpdateTbmParams({
      ...params,
      ...patch,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-900 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/40 shadow-sm">
              <CircleDot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  TBM MODE · MECHANIZED SHIELD
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Ring #{params.ringNumber} · Segment {params.segmentId}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>TBM Shield &amp; Segmental Ring Inspector</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Ring Number</span>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                #{params.ringNumber}
              </div>
              <span className="text-[9px] text-slate-500">Chainage: {settings.faceChainage || settings.chainage}</span>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Thrust Force</span>
              <div className="text-xl font-bold font-mono text-teal-400 mt-1">
                {params.thrustForceKN} kN
              </div>
              <span className="text-[9px] text-slate-500">Main propulsion cylinders</span>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Cutterhead Torque</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {params.cutterheadTorqueKNm} kNm
              </div>
              <span className="text-[9px] text-slate-500">Penetration: {params.penetrationRateMmPerRev} mm/rev</span>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Grout Annulus Pressure</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {params.groutPressureBar} bar
              </div>
              <span className="text-[9px] text-slate-500">Volume: {params.groutVolumeM3} m³</span>
            </div>
          </div>

          {/* Ring Segment Selector */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase text-slate-300">
                Current Segment Ring ID
              </label>
              <div className="flex items-center gap-1">
                {SEGMENT_IDS.map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => handleUpdate({ segmentId: seg })}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      params.segmentId === seg
                        ? 'bg-cyan-500 text-black shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase">Ring Number</label>
                <input
                  type="number"
                  value={params.ringNumber}
                  onChange={(e) => handleUpdate({ ringNumber: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-cyan-300"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase">Stroke Length (mm)</label>
                <input
                  type="number"
                  value={params.strokeLengthMm}
                  onChange={(e) => handleUpdate({ strokeLengthMm: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase">Advance Rate (mm/min)</label>
                <input
                  type="number"
                  value={params.advanceRateMmPerMin}
                  onChange={(e) => handleUpdate({ advanceRateMmPerMin: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cutterhead & Geological Penetration */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Wrench className="w-4 h-4" />
              <span>Cutterhead Disc Wear &amp; Excavation Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Max Disc Wear:</span>
                  <span className="font-bold text-amber-400">{params.discCutterWearMm} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="0.5"
                  value={params.discCutterWearMm}
                  onChange={(e) => handleUpdate({ discCutterWearMm: Number(e.target.value) })}
                  className="w-full mt-1 accent-cyan-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">Limit: 15–20mm before replacement</span>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase">EPB Chamber Pressure (bar)</label>
                <input
                  type="number"
                  step="0.05"
                  value={params.epbPressureBar}
                  onChange={(e) => handleUpdate({ epbPressureBar: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 uppercase">Penetration (mm/rev)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.penetrationRateMmPerRev}
                  onChange={(e) => handleUpdate({ penetrationRateMmPerRev: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase">
                Cutterhead Inspection &amp; Face Geology Notes
              </label>
              <textarea
                rows={2}
                value={params.cutterheadInspectionNotes}
                onChange={(e) => handleUpdate({ cutterheadInspectionNotes: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-xs font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs font-mono">
          <div className="text-slate-400">
            ESWA TBM Mode · Mechanized Shield &amp; Segment Parameters Active
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
