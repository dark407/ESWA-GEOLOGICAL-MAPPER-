import React, { useState, useEffect } from 'react';
import { Pickaxe, CircleDot, Mountain, Shield, ArrowLeft, Database, CheckCircle2, Sliders } from 'lucide-react';
import { NatmRockMechanicsAndLookAheadHub } from './NatmRockMechanicsAndLookAheadHub';

export type ActiveIndustrySuite = 'NATM' | 'TBM' | 'MINING';

export const IsolatedIndustrySuiteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [suiteMode, setSuiteMode] = useState<ActiveIndustrySuite>(() => {
    return (localStorage.getItem('eswa_active_industry_mode') as ActiveIndustrySuite) || 'NATM';
  });
  const [pendingSwitchMode, setPendingSwitchMode] = useState<ActiveIndustrySuite | null>(null);
  const [activeMiningActivity, setActiveMiningActivity] = useState<number | null>(null);
  const [activeTbmActivity, setActiveTbmActivity] = useState<number | null>(null);
  const [showRockMechanics, setShowRockMechanics] = useState(false);

  // Mining state (Isolated localStorage: eswa_vault_MINING)
  const [miningData, setMiningData] = useState(() => {
    try {
      const saved = localStorage.getItem('eswa_vault_MINING');
      return saved ? JSON.parse(saved) : {
        project: 'Kolar Deep Gold Lode',
        level: 'Level 1400 mRL',
        stope: 'STP-14-HW02',
        orebody: 'Champion Quartz Reef',
        commodity: 'Au (g/t) + Cu (%)',
        grade: '6.4 g/t',
        cutOff: '2.5 g/t',
        status: 'MILL (High Grade)',
      };
    } catch {
      return { project: 'Kolar Gold', level: 'Level 1200 mRL', stope: 'STP-01', orebody: 'Main Reef', commodity: 'Au', grade: '5.2 g/t', cutOff: '2.0 g/t', status: 'MILL' };
    }
  });

  // TBM state (Isolated localStorage: eswa_vault_TBM)
  const [tbmData, setTbmData] = useState(() => {
    try {
      const saved = localStorage.getItem('eswa_vault_TBM');
      return saved ? JSON.parse(saved) : {
        project: 'Metro Line 4 Underground Tunnel',
        tbmType: 'Double Shield TBM',
        diameter: '6.60 m',
        cutters: '44 Nos',
        ringNo: 'Ring #0842',
        thrust: '14,200 kN',
        torque: '1,850 kNm',
        fpi: '32.4 kN/cutter/mm',
        hazard: 'NORMAL BORING (No Squeezing)',
      };
    } catch {
      return { project: 'Metro Line 4', tbmType: 'Double Shield', diameter: '6.6m', cutters: '44', ringNo: 'Ring #0842', thrust: '14,000 kN', torque: '1,800 kNm', fpi: '30', hazard: 'NORMAL' };
    }
  });

  const handleConfirmSwitch = () => {
    if (!pendingSwitchMode) return;
    setSuiteMode(pendingSwitchMode);
    localStorage.setItem('eswa_active_industry_mode', pendingSwitchMode);
    setPendingSwitchMode(null);
    setActiveMiningActivity(null);
    setActiveTbmActivity(null);
  };

  const loadMiningExample = () => {
    const ex = { project: 'Kolar Deep Gold Mine', level: 'Level 1420 mRL', stope: 'STP-1420-HW-04', orebody: 'Champion Quartz Reef', commodity: 'Au (g/t)', grade: '7.85 g/t', cutOff: '2.80 g/t', status: 'MILL (High Grade)' };
    setMiningData(ex);
    localStorage.setItem('eswa_vault_MINING', JSON.stringify(ex));
  };

  const loadTbmExample = () => {
    const ex = { project: 'Mumbai Metro Line 3 Underground', tbmType: 'Earth Pressure Balance (EPB)', diameter: '6.65 m', cutters: '46 Disc Cutters', ringNo: 'Ring #0912', thrust: '16,800 kN', torque: '2,200 kNm', fpi: '36.5 kN/cutter/mm', hazard: 'HARD BASALT (Penetration 4.2 mm/rev)' };
    setTbmData(ex);
    localStorage.setItem('eswa_vault_TBM', JSON.stringify(ex));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Control Bar removed */}

      {/* Confirmation Modal */}
      {pendingSwitchMode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-cyan-300 font-mono">Confirm Environment Switch</h3>
            <p className="text-xs text-slate-300">
              Confirm switch to isolated <strong>{pendingSwitchMode}</strong> environment? Your local data vault will remain strictly isolated.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingSwitchMode(null)}
                className="px-3 py-1.5 rounded text-xs bg-slate-800 text-slate-300 font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                className="px-3 py-1.5 rounded text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono"
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        {suiteMode === 'NATM' && (
          <div className="w-full h-full relative overflow-hidden">{children}</div>
        )}

        {suiteMode === 'MINING' && (
          <div className="w-full h-full bg-slate-950 p-4 overflow-y-auto font-mono text-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-amber-500/30 gap-2">
              <div className="flex items-center gap-2">
                <Pickaxe className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-amber-400">MINING MAIN WINDOW — STOPE &amp; GRADE CONTROL</h2>
              </div>
              {activeMiningActivity !== null ? (
                <button
                  type="button"
                  onClick={() => setActiveMiningActivity(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Back to MINING Main Window</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={loadMiningExample}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600/30 border border-amber-500 text-amber-300 font-bold hover:bg-amber-600/50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Load Mining Example Data (Kolar Gold Reef)</span>
                </button>
              )}
            </div>

            {activeMiningActivity === null ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div><span className="text-slate-500">Project:</span> <p className="font-bold text-amber-300">{miningData.project}</p></div>
                  <div><span className="text-slate-500">Level:</span> <p className="font-bold text-cyan-300">{miningData.level}</p></div>
                  <div><span className="text-slate-500">Stope ID:</span> <p className="font-bold text-emerald-300">{miningData.stope}</p></div>
                  <div><span className="text-slate-500">Assay Verdict:</span> <p className="font-bold text-amber-400">{miningData.status}</p></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { id: 1, title: '1. Heading Face Mapping & Ore/Waste Zones', desc: 'Active stope heading face geological delineation & wall boundaries' },
                    { id: 2, title: '2. Channel Sampling (CH-01...) & Assay Grade', desc: 'Weighted grade, dilution %, and MILL vs STOCKPILE routing' },
                    { id: 3, title: '3. Mining Ground Control (MRMR / Mathews N\')', desc: 'Laubscher MRMR & Mathews Potvin stability graph analysis' },
                    { id: 4, title: '4. Exploration Assay Core Logging & A3 Sheet', desc: 'Core logging interval assay & printable A3 grade sheet' },
                  ].map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setActiveMiningActivity(card.id)}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer space-y-2 group shadow-lg"
                    >
                      <h4 className="font-bold text-amber-400 group-hover:text-amber-300">{card.title}</h4>
                      <p className="text-[11px] text-slate-400">{card.desc}</p>
                      <span className="inline-block text-[10px] text-amber-500 font-bold">Open Workbench →</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/40 space-y-3">
                <h3 className="font-bold text-sm text-amber-400">Activity #{activeMiningActivity} Workbench Active</h3>
                <p className="text-slate-300 text-xs">Stope {miningData.stope} · {miningData.orebody} · Grade: {miningData.grade} (Cut-Off {miningData.cutOff})</p>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 text-xs flex items-center justify-center min-h-[280px]">
                  <span>Interactive Mining Canvas &amp; Grade Schedule Ready. Use "← Back to MINING Main Window" above to switch activities.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {suiteMode === 'TBM' && (
          <div className="w-full h-full bg-slate-950 p-4 overflow-y-auto font-mono text-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-cyan-500/30 gap-2">
              <div className="flex items-center gap-2">
                <CircleDot className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-cyan-400">TBM MAIN WINDOW — SHIELD TUNNEL BORING MACHINE</h2>
              </div>
              {activeTbmActivity !== null ? (
                <button
                  type="button"
                  onClick={() => setActiveTbmActivity(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 text-slate-950 font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Back to TBM Main Window</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={loadTbmExample}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/30 border border-cyan-500 text-cyan-300 font-bold hover:bg-cyan-600/50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Load TBM Example Data (Metro Ø6.6m)</span>
                </button>
              )}
            </div>

            {activeTbmActivity === null ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div><span className="text-slate-500">Project:</span> <p className="font-bold text-cyan-300">{tbmData.project}</p></div>
                  <div><span className="text-slate-500">Type:</span> <p className="font-bold text-amber-300">{tbmData.tbmType}</p></div>
                  <div><span className="text-slate-500">Ring:</span> <p className="font-bold text-emerald-300">{tbmData.ringNo}</p></div>
                  <div><span className="text-slate-500">Hazard Status:</span> <p className="font-bold text-cyan-400">{tbmData.hazard}</p></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { id: 1, title: '1. Cutterhead Spoke-Window (12:00–10:00)', desc: 'Circular cutterhead face geological inspection & disc cutter wear' },
                    { id: 2, title: '2. Ring Boring Telemetry & Boreability', desc: 'Thrust, torque, penetration p mm/rev, FPI, and specific energy' },
                    { id: 3, title: '3. Conveyor Muck & Annulus Grout Overbreak', desc: 'Tail-skin annular grout volume vs theoretical & Qtbm index' },
                    { id: 4, title: '4. Probe Core Logging & A3 TBM Ring Sheet', desc: 'Ahead-of-cutterhead drilling log & A3 TBM segment report' },
                  ].map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setActiveTbmActivity(card.id)}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 transition-all cursor-pointer space-y-2 group shadow-lg"
                    >
                      <h4 className="font-bold text-cyan-400 group-hover:text-cyan-300">{card.title}</h4>
                      <p className="text-[11px] text-slate-400">{card.desc}</p>
                      <span className="inline-block text-[10px] text-cyan-500 font-bold">Open Workbench →</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <h3 className="font-bold text-sm text-cyan-400">Activity #{activeTbmActivity} Workbench Active</h3>
                <p className="text-slate-300 text-xs">{tbmData.ringNo} · {tbmData.tbmType} · {tbmData.diameter} · Thrust: {tbmData.thrust}</p>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 text-xs flex items-center justify-center min-h-[280px]">
                  <span>Interactive TBM Cutterhead &amp; Telemetry Canvas Ready. Use "← Back to TBM Main Window" above to switch activities.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Rock Mechanics Overlay */}
      {showRockMechanics && (
        <NatmRockMechanicsAndLookAheadHub
          isOpen={true}
          onClose={() => setShowRockMechanics(false)}
          isFloatingModal={true}
        />
      )}
    </div>
  );
};
