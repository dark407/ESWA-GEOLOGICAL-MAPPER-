import React, { useState } from 'react';
import {
  Compass,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { MiningGeologicalFeature } from '../../types/mining';

export interface MiningStructureWindowProps {
  driftId: string;
  chainage: string;
  mineLevel: string;
  headingAzimuth: number;
  setHeadingAzimuth: (v: number) => void;
  features: MiningGeologicalFeature[];
  setFeatures: React.Dispatch<React.SetStateAction<MiningGeologicalFeature[]>>;
  pushUndo: (features?: MiningGeologicalFeature[]) => void;
  selectedFeatureId: string | null;
  setSelectedFeatureId: (id: string | null) => void;
  onReturnToCanvas: () => void;
}

export const MiningStructureWindow: React.FC<MiningStructureWindowProps> = ({
  driftId,
  chainage,
  mineLevel,
  headingAzimuth,
  setHeadingAzimuth,
  features,
  setFeatures,
  pushUndo,
  selectedFeatureId,
  setSelectedFeatureId,
  onReturnToCanvas,
}) => {
  const structuralFeatures = features.filter(
    (f) => f.featureType === 'FAULT' || f.featureType === 'JOINT' || f.featureType === 'LITH_CONTACT'
  );

  // Quick Add Structure State
  const [newType, setNewType] = useState<'JOINT' | 'FAULT' | 'LITH_CONTACT'>('JOINT');
  const [newName, setNewName] = useState<string>('Joint Set J1');
  const [newDip, setNewDip] = useState<number>(75);
  const [newDipDir, setNewDipDir] = useState<number>((headingAzimuth + 90) % 360);
  const [newRoughness, setNewRoughness] = useState<string>('Rough, undulating');
  const [newAperture, setNewAperture] = useState<string>('Tight (<1mm)');

  const handleAddStructure = () => {
    const newFeat: MiningGeologicalFeature = {
      id: `FT-${Date.now().toString(36).toUpperCase()}`,
      surfaceType: 'DEVELOPMENT_FACE',
      featureType: newType,
      geometryType: 'POLYLINE',
      points: [
        { x: 1.0, y: 1.0 },
        { x: 3.5, y: 3.2 },
      ],
      name: newName || (newType === 'FAULT' ? 'Shear / Fault' : 'Joint Set'),
      colorHex: newType === 'FAULT' ? '#DC2626' : newType === 'JOINT' ? '#A855F7' : '#38BDF8',
      strokeWidth: 3.0,
      fillOpacity: 0,
      dipDeg: newDip,
      dipDirectionDeg: newDipDir,
      visible: true,
      isSpline: false,
      drawTool: 'POLYLINE',
    };

    const next = [...features, newFeat];
    pushUndo(next);
    setSelectedFeatureId(newFeat.id);
  };

  const handleDeleteStructure = (id: string) => {
    const next = features.filter((f) => f.id !== id);
    pushUndo(next);
    if (selectedFeatureId === id) {
      setSelectedFeatureId(null);
    }
  };

  // Kinematic screening: check if any discontinuity strikes within 20 deg of heading
  const kinematicHazards = structuralFeatures.filter((f) => {
    if (!f.dipDirectionDeg) return false;
    const strike = (f.dipDirectionDeg - 90 + 360) % 360;
    const diff = Math.min(
      Math.abs(strike - headingAzimuth),
      Math.abs(strike - ((headingAzimuth + 180) % 360))
    );
    return diff <= 25 && (f.dipDeg || 0) >= 55;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto font-mono p-4 sm:p-6 space-y-6">
      {/* Subheader / Window Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReturnToCanvas}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Face Canvas</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-purple-400">
                Structural Geology &amp; Schmidt Stereonet Window
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                Working Window
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Heading: <strong className="text-slate-200">{driftId}</strong> · Chainage:{' '}
              <strong className="text-amber-400">{chainage}</strong> · Heading Azimuth:{' '}
              <strong className="text-cyan-300">{headingAzimuth}°</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400">Heading Azimuth (°):</span>
            <input
              type="number"
              min="0"
              max="359"
              value={headingAzimuth}
              onChange={(e) => setHeadingAzimuth(parseInt(e.target.value) || 0)}
              className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-center"
            />
          </label>
        </div>
      </div>

      {/* KINEMATIC RISK BANNER */}
      {kinematicHazards.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <strong className="text-rose-300 block font-bold">
              Kinematic Overbreak Warning: {kinematicHazards.length} Discontinuity Strikes Sub-Parallel to Heading Drive!
            </strong>
            <p className="text-rose-200/80">
              Structures striking within 25° of drive azimuth ({headingAzimuth}°) with steep dips (&gt;55°) create high risk of sidewall slab spalling and roof wedge collapse. Verify bolting pattern and face mesh containment.
            </p>
          </div>
        </div>
      )}

      {/* TWO-COLUMN STEREONET & REGISTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Schmidt Stereonet Plot (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider">
              Schmidt Lower-Hemisphere Stereonet
            </span>
            <span className="text-[10px] text-amber-400">Equal-Area Projection</span>
          </div>

          {/* Large Stereonet SVG */}
          <div className="w-64 h-64 sm:w-72 sm:h-72 relative flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Outer boundary circle (primitive) */}
              <circle cx="100" cy="100" r="90" fill="#020617" stroke="#475569" strokeWidth="2" />

              {/* Dip rings at 30 deg and 60 deg */}
              {/* Schmidt projection: r = R * sqrt(2) * sin((90 - dip) / 2) */}
              <circle
                cx="100"
                cy="100"
                r={90 * Math.SQRT2 * Math.sin(((90 - 30) * Math.PI) / 360)}
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx="100"
                cy="100"
                r={90 * Math.SQRT2 * Math.sin(((90 - 60) * Math.PI) / 360)}
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Crosshair axes */}
              <line x1="100" y1="10" x2="100" y2="190" stroke="#334155" strokeWidth="1" />
              <line x1="10" y1="100" x2="190" y2="100" stroke="#334155" strokeWidth="1" />

              {/* Cardinal directions */}
              <text x="100" y="8" fill="#F8FAFC" fontSize="10" fontWeight="bold" textAnchor="middle">
                N
              </text>
              <text x="195" y="103" fill="#94A3B8" fontSize="10" textAnchor="start">
                E
              </text>
              <text x="100" y="198" fill="#94A3B8" fontSize="10" textAnchor="middle">
                S
              </text>
              <text x="5" y="103" fill="#94A3B8" fontSize="10" textAnchor="end">
                W
              </text>

              {/* Drift Heading Azimuth Vector */}
              {(() => {
                const rad = (headingAzimuth * Math.PI) / 180;
                const hx = 100 + 88 * Math.sin(rad);
                const hy = 100 - 88 * Math.cos(rad);
                return (
                  <g>
                    <line x1="100" y1="100" x2={hx} y2={hy} stroke="#38BDF8" strokeWidth="2" strokeDasharray="4 2" />
                    <circle cx={hx} cy={hy} r="3" fill="#38BDF8" />
                  </g>
                );
              })()}

              {/* Plotted Poles for Discontinuities */}
              {structuralFeatures
                .filter((f) => f.dipDeg && f.dipDirectionDeg)
                .map((f) => {
                  const dip = f.dipDeg || 75;
                  const dipDir = f.dipDirectionDeg || 0;
                  const r = Math.SQRT2 * Math.sin(((90 - dip) * Math.PI) / 360) * 90;
                  const poleDirRad = (((dipDir + 180) % 360) * Math.PI) / 180;
                  const px = 100 + r * Math.sin(poleDirRad);
                  const py = 100 - r * Math.cos(poleDirRad);
                  const isSel = selectedFeatureId === f.id;

                  return (
                    <g
                      key={`stereonet-pole-${f.id}`}
                      onClick={() => setSelectedFeatureId(f.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={px}
                        cy={py}
                        r={isSel ? 6 : 4}
                        fill={f.colorHex}
                        stroke="#FFFFFF"
                        strokeWidth={isSel ? 2 : 1}
                      />
                      {isSel && (
                        <text
                          x={px + 8}
                          y={py + 3}
                          fill="#FFFFFF"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          {f.name} ({dip}°/{dipDir}°)
                        </text>
                      )}
                    </g>
                  );
                })}
            </svg>
          </div>

          <div className="w-full text-[11px] text-slate-400 space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-cyan-400" />
              <span>Cyan Dashed: Drift Drive Direction ({headingAzimuth}°)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Red Dots: Faults &amp; Shears</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Purple Dots: Structural Joint Sets</span>
            </div>
          </div>
        </div>

        {/* Right Column: Discontinuity Register & Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Add Structure Form */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Plus className="w-4 h-4" />
              <span>Record Structural Discontinuity</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-400 text-[11px]">Type:</span>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
                >
                  <option value="JOINT">Joint Set</option>
                  <option value="FAULT">Fault / Shear</option>
                  <option value="LITH_CONTACT">Lithology Contact</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-slate-400 text-[11px]">Name:</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-slate-400 text-[11px]">Dip (°):</span>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={newDip}
                  onChange={(e) => setNewDip(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold"
                />
              </label>

              <label className="space-y-1">
                <span className="text-slate-400 text-[11px]">Dip Direction (°):</span>
                <input
                  type="number"
                  min="0"
                  max="359"
                  value={newDipDir}
                  onChange={(e) => setNewDipDir(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-bold"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddStructure}
                  className="w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Feature</span>
                </button>
              </div>
            </div>
          </div>

          {/* Structural Features Table */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span>Structural Discontinuities Register ({structuralFeatures.length})</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Feature Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Dip / Dip Dir</th>
                    <th className="p-2.5">Drive Relationship</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {structuralFeatures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        No structural joints or faults mapped yet. Use "Add Feature" above or select Joint/Fault tools in Face Canvas.
                      </td>
                    </tr>
                  ) : (
                    structuralFeatures.map((f) => {
                      const isSel = selectedFeatureId === f.id;
                      const strike = (((f.dipDirectionDeg || 0) - 90 + 360) % 360);
                      const diff = Math.min(
                        Math.abs(strike - headingAzimuth),
                        Math.abs(strike - ((headingAzimuth + 180) % 360))
                      );
                      const isHazard = diff <= 25 && (f.dipDeg || 0) >= 55;

                      return (
                        <tr
                          key={f.id}
                          onClick={() => setSelectedFeatureId(f.id)}
                          className={`cursor-pointer transition-colors ${
                            isSel ? 'bg-purple-950/20' : 'hover:bg-slate-850/50'
                          }`}
                        >
                          <td className="p-2.5 font-bold text-slate-100 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: f.colorHex }}
                            />
                            <span>{f.name}</span>
                          </td>
                          <td className="p-2.5 text-slate-400">{f.featureType}</td>
                          <td className="p-2.5 font-bold text-amber-400">
                            {f.dipDeg}° / {f.dipDirectionDeg}°
                          </td>
                          <td className="p-2.5">
                            {isHazard ? (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1 w-max">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Sub-parallel Hazard</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                                Favorable Strike
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStructure(f.id);
                              }}
                              className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer"
                              title="Delete Discontinuity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
