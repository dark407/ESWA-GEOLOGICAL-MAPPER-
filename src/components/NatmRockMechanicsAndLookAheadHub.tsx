import React, { useState, useMemo } from 'react';
import { Shield, Compass, TrendingUp, AlertTriangle, CheckCircle, Sliders, X, Eye } from 'lucide-react';

export interface NatmRockMechanicsAndLookAheadHubProps {
  isOpen?: boolean;
  onClose?: () => void;
  driveAzimuth?: number;
  faceChainage?: string;
  isFloatingModal?: boolean;
}

export const NatmRockMechanicsAndLookAheadHub: React.FC<NatmRockMechanicsAndLookAheadHubProps> = React.memo(({
  isOpen = true,
  onClose,
  driveAzimuth = 45,
  faceChainage = 'CH 102+45.0',
  isFloatingModal = false,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'WEDGE' | 'SOLVER' | 'LOOKAHEAD'>('WEDGE');

  // Tab 1: Wedge State
  const [selectedZone, setSelectedZone] = useState<'CROWN' | 'LEFT_SHOULDER' | 'RIGHT_SHOULDER'>('CROWN');
  const [boltLength, setBoltLength] = useState<number>(3.0);
  const [boltSpacing, setBoltSpacing] = useState<number>(1.5);
  const [extraSpotBolts, setExtraSpotBolts] = useState<number>(0);
  const [shotcreteMm, setShotcreteMm] = useState<number>(100);

  // Tab 2: 4-Surface Solver State
  const [surfType, setSurfType] = useState<'FACE' | 'LEFT_WALL' | 'RIGHT_WALL' | 'CROWN' | 'CORNER_2SURF'>('FACE');
  const [driveAz, setDriveAz] = useState<number>(driveAzimuth);
  const [trueDip, setTrueDip] = useState<number>(65);
  const [trueDipDir, setTrueDipDir] = useState<number>(140);

  // Tab 3: Look-Ahead State
  const [lookAheadDist, setLookAheadDist] = useState<'+3m' | '+6m' | '+9m'>('+3m');

  // Wedge Calculations
  const wedgeGeo = useMemo(() => {
    switch (selectedZone) {
      case 'LEFT_SHOULDER':
        return { sector: '09:30–11:00', hApex: 1.65, vol: 3.8, weightT: 10.1, drivingKN: 92, sets: 'J1 ^ J3' };
      case 'RIGHT_SHOULDER':
        return { sector: '01:00–02:30', hApex: 1.50, vol: 3.2, weightT: 8.5, drivingKN: 78, sets: 'J2 ^ J3' };
      case 'CROWN':
      default:
        return { sector: '11:00–01:30', hApex: 1.85, vol: 4.6, weightT: 12.2, drivingKN: 120, sets: 'J1 ^ J2' };
    }
  }, [selectedZone]);

  const anchoragePass = boltLength >= wedgeGeo.hApex + 0.8;
  const patternCount = Math.max(2, Math.round(4.0 / (boltSpacing * boltSpacing)));
  const totalBolts = patternCount + extraSpotBolts;
  const boltCapKN = totalBolts * 180;
  const sfrShearCapKN = (shotcreteMm / 100) * 120;
  const totalResistKN = 35 + boltCapKN * (anchoragePass ? 0.85 : 0.25) + sfrShearCapKN;
  const unsupportedFoS = Number((35 / wedgeGeo.drivingKN).toFixed(2));
  const supportedFoS = Number((totalResistKN / wedgeGeo.drivingKN).toFixed(2));
  const fosBadge = supportedFoS >= 1.5 ? 'SAFE' : supportedFoS >= 1.15 ? 'MARGINAL' : 'CRITICAL_UNSAFE';

  // 4-Surface Solvers (Rad trig)
  const solverOutput = useMemo(() => {
    const dRad = ((trueDipDir - driveAz) * Math.PI) / 180;
    const dipRad = (trueDip * Math.PI) / 180;
    const faceApp = Math.atan(Math.tan(dipRad) * Math.abs(Math.sin(dRad))) * (180 / Math.PI);
    const wallApp = Math.atan(Math.tan(dipRad) * Math.abs(Math.cos(dRad))) * (180 / Math.PI);
    const crownTrace = (trueDipDir + 90) % 180;
    const strike = (trueDipDir + 270) % 360;
    return {
      faceAppDeg: Math.round(faceApp),
      leftWallPitchDeg: Math.round(wallApp),
      rightWallPitchDeg: Math.round(wallApp),
      crownTraceDeg: Math.round(crownTrace),
      strikeDeg: Math.round(strike),
    };
  }, [driveAz, trueDip, trueDipDir]);

  if (!isOpen) return null;

  const content = (
    <div className="w-full bg-slate-900 border border-cyan-500/50 rounded-xl shadow-2xl p-3 sm:p-4 text-slate-100 font-sans text-xs select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between pb-2.5 mb-3 border-b border-cyan-800/60 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="font-mono font-bold text-sm text-cyan-300 tracking-wide uppercase">
            ESWA Rock Mechanics &amp; +3m/+6m/+9m Predictor
          </span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] border border-cyan-800">
            {faceChainage}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800 font-bold">
            v2.6 LIVE
          </span>
        </div>

        {/* Navigation Tabs & Close */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'WEDGE', label: '3D Wedge Adequacy', icon: Shield },
            { id: 'SOLVER', label: '4-Surface Solver', icon: Compass },
            { id: 'LOOKAHEAD', label: '+3m/+6m/+9m & OB', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  isAct
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-2 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: 3D WEDGE ADEQUACY */}
      {activeTab === 'WEDGE' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Left Column: Wedge Geometry & Anchorage Warning */}
          <div className="md:col-span-5 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono uppercase font-bold text-[10px]">Wedge Location:</span>
              <div className="flex gap-1">
                {(['CROWN', 'LEFT_SHOULDER', 'RIGHT_SHOULDER'] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setSelectedZone(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                      selectedZone === z ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {z.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Clock Sector:</span>
                <p className="font-bold text-amber-300">{wedgeGeo.sector}</p>
                <span className="text-slate-400 text-[10px]">Sets: {wedgeGeo.sets}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Apex Depth (h_apex):</span>
                <p className="font-bold text-cyan-300">{wedgeGeo.hApex.toFixed(2)} m</p>
                <span className="text-slate-400 text-[10px]">Vol: {wedgeGeo.vol} m³ ({wedgeGeo.weightT} t)</span>
              </div>
            </div>

            {/* Live Anchorage Warning */}
            <div
              className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                anchoragePass
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-500/80 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {anchoragePass ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />}
                <span>{anchoragePass ? 'ANCHORAGE PASS: Bolt Penetrates Stable Rock' : 'ANCHORAGE FAIL: Shorter than Wedge Apex!'}</span>
              </div>
              <p className="text-[10px] mt-1 text-slate-300">
                {anchoragePass
                  ? `Bolt (${boltLength.toFixed(1)}m) > Min Req ${(wedgeGeo.hApex + 0.8).toFixed(1)}m. Embedment = ${(boltLength - wedgeGeo.hApex).toFixed(2)}m.`
                  : `Bolt length (${boltLength.toFixed(1)}m) is shorter than Apex depth (${wedgeGeo.hApex.toFixed(2)}m)! Increase to >= ${(wedgeGeo.hApex + 1.0).toFixed(1)}m.`}
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Support Sliders & FoS Gauges */}
          <div className="md:col-span-7 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-mono">Bolt Length: {boltLength.toFixed(1)}m</label>
                <input
                  type="range"
                  min="1.5"
                  max="6.0"
                  step="0.1"
                  value={boltLength}
                  onChange={(e) => setBoltLength(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">Spacing: {boltSpacing.toFixed(1)}m</label>
                <input
                  type="range"
                  min="1.0"
                  max="2.5"
                  step="0.1"
                  value={boltSpacing}
                  onChange={(e) => setBoltSpacing(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">Extra Spot: +{extraSpotBolts}</label>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  value={extraSpotBolts}
                  onChange={(e) => setExtraSpotBolts(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono">Shotcrete: {shotcreteMm}mm</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="25"
                  value={shotcreteMm}
                  onChange={(e) => setShotcreteMm(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {/* FoS Comparison Display */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400">Unsupported FoS:</span>
                <p className="text-base font-bold text-rose-400">{unsupportedFoS.toFixed(2)}</p>
                <span className="text-[9px] text-slate-500">Self-weight collapse</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400">Installed FoS:</span>
                <p className={`text-base font-bold ${supportedFoS >= 1.5 ? 'text-emerald-400' : supportedFoS >= 1.15 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {supportedFoS.toFixed(2)}
                </p>
                <span className="text-[9px] text-slate-400">Target &gt;= 1.50</span>
              </div>
              <div
                className={`p-2 rounded flex flex-col items-center justify-center font-bold ${
                  fosBadge === 'SAFE'
                    ? 'bg-emerald-600 text-white'
                    : fosBadge === 'MARGINAL'
                    ? 'bg-amber-600 text-white'
                    : 'bg-rose-700 text-white'
                }`}
              >
                <span className="text-[10px]">VERDICT</span>
                <span className="text-xs">{fosBadge === 'SAFE' ? 'SUPPORT ADEQUATE' : fosBadge === 'MARGINAL' ? 'ADD SPOT BOLTS' : 'CRITICAL UNSAFE'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 4-SURFACE APPARENT-TO-TRUE DIP SOLVER */}
      {activeTab === 'SOLVER' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Surface Measured:</span>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'FACE', lbl: 'Face' },
                { id: 'LEFT_WALL', lbl: 'L-Wall' },
                { id: 'RIGHT_WALL', lbl: 'R-Wall' },
                { id: 'CROWN', lbl: 'Crown' },
                { id: 'CORNER_2SURF', lbl: '2-Surf Corner' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSurfType(s.id as any)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                    surfType === s.id ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {s.lbl}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Drive Azimuth:</span>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={driveAz}
                  onChange={(e) => setDriveAz(parseInt(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-cyan-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">True Dip (°):</span>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={trueDip}
                  onChange={(e) => setTrueDip(parseInt(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-amber-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Dip Direction (°):</span>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={trueDipDir}
                  onChange={(e) => setTrueDipDir(parseInt(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-amber-300"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-7 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2">
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">3D Cross-Surface Apparent Traces:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400">Face Apparent α:</span>
                <p className="text-sm font-bold text-cyan-400">{solverOutput.faceAppDeg}°</p>
                <span className="text-[8px] text-slate-500">Cross-cut section</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400">Wall Apparent β:</span>
                <p className="text-sm font-bold text-amber-400">{solverOutput.leftWallPitchDeg}°</p>
                <span className="text-[8px] text-slate-500">Sidewall pitch</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400">Crown Trace θ:</span>
                <p className="text-sm font-bold text-emerald-400">{solverOutput.crownTraceDeg}°</p>
                <span className="text-[8px] text-slate-500">Roof strike angle</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400">Right-Hand Strike:</span>
                <p className="text-sm font-bold text-white">{solverOutput.strikeDeg}°</p>
                <span className="text-[8px] text-slate-500">RHR strike</span>
              </div>
            </div>
            <p className="text-[10px] font-mono text-slate-400 pt-1">
              Exact 3D Vector: n = ({Math.sin((trueDip * Math.PI) / 180) * Math.sin((trueDipDir * Math.PI) / 180)}i,{' '}
              {Math.sin((trueDip * Math.PI) / 180) * Math.cos((trueDipDir * Math.PI) / 180)}j,{' '}
              {Math.cos((trueDip * Math.PI) / 180)}k).
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-ROUND TREND & LOOK-AHEAD PREDICTION */}
      {activeTab === 'LOOKAHEAD' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Round Deltas & Overbreak Root Cause */}
          <div className="md:col-span-6 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2 font-mono">
            <span className="text-[10px] text-cyan-400 font-bold uppercase">Previous vs Current Round Deltas:</span>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400">ΔQ-Index:</span>
                <p className="font-bold text-rose-400">-4.2 (Degrading)</p>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400">ΔRMR89:</span>
                <p className="font-bold text-amber-400">-8 (54 → 46)</p>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-slate-400">ΔRQD %:</span>
                <p className="font-bold text-rose-400">-15% (65% → 50%)</p>
              </div>
            </div>

            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] space-y-1">
              <span className="text-slate-400 font-bold">Contractual Overbreak Proof (FIDIC Cl. 4.12):</span>
              <div className="flex justify-between text-emerald-400">
                <span>✔ Geological Wedge Fallout (Excusable):</span>
                <span className="font-bold">76.4% (+3.19 m³)</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>✖ Drill &amp; Blast Deviation (Non-Excusable):</span>
                <span className="font-bold">23.6% (+0.99 m³)</span>
              </div>
            </div>
          </div>

          {/* Look-Ahead Distance & Forepoling Canopy */}
          <div className="md:col-span-6 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold uppercase">Ahead-of-Face 3D Projection:</span>
              <div className="flex gap-1">
                {(['+3m', '+6m', '+9m'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setLookAheadDist(d)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      lookAheadDist === d ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-1">
              {lookAheadDist === '+3m' && (
                <>
                  <p className="text-amber-300 font-bold">Next Round (+3.0m): Predicted Q = 5.2 (Class III)</p>
                  <p className="text-[10px] text-slate-300">Face joint J2 migrates into Crown Arch at 11:00. Wedge volume = 4.2m³.</p>
                  <p className="text-[10px] text-emerald-400 font-bold">Forepoling: NOT REQUIRED (Standard 3.0m round advance pull).</p>
                </>
              )}
              {lookAheadDist === '+6m' && (
                <>
                  <p className="text-rose-400 font-bold">Round (+6.0m): Predicted Q = 2.8 (Class IV Poor Rock)</p>
                  <p className="text-[10px] text-slate-300">Shear band contacts Crown Arch 10:30–01:30. Daylight fallout imminent.</p>
                  <p className="text-[10px] text-rose-300 font-bold">
                    Forepoling: MANDATORY (Ø76mm L=12m Spiles @ 300mm c/c · Look-Out 7°).
                  </p>
                </>
              )}
              {lookAheadDist === '+9m' && (
                <>
                  <p className="text-emerald-400 font-bold">Round (+9.0m): Predicted Q = 8.5 (Class II Good Rock)</p>
                  <p className="text-[10px] text-slate-300">Competent granite re-enters profile. RQD rebounds to &gt; 75%.</p>
                  <p className="text-[10px] text-emerald-400 font-bold">Support: Revert to standard systematic pattern bolts.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isFloatingModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
        <div className="max-w-4xl w-full max-h-[92vh] overflow-y-auto no-scrollbar">{content}</div>
      </div>
    );
  }

  return content;
});
NatmRockMechanicsAndLookAheadHub.displayName = 'NatmRockMechanicsAndLookAheadHub';
