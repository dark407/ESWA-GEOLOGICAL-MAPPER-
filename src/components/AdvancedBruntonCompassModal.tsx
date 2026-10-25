import React, { useState, useMemo } from 'react';
import {
  Compass,
  X,
  RotateCw,
  Copy,
  Check,
  Sliders,
  Maximize2,
  Minimize2,
  Navigation,
  Info,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

interface AdvancedBruntonCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAzimuth?: number;
  initialDip?: number;
  onApplyOrientation?: (dipDir: number, dipAngle: number) => void;
}

export const AdvancedBruntonCompassModal: React.FC<AdvancedBruntonCompassModalProps> = ({
  isOpen,
  onClose,
  initialAzimuth = 135,
  initialDip = 55,
  onApplyOrientation,
}) => {
  const [azimuthDeg, setAzimuthDeg] = useState<number>(initialAzimuth);
  const [dipDeg, setDipDeg] = useState<number>(initialDip);
  const [declinationDeg, setDeclinationDeg] = useState<number>(0); // Magnetic declination: +E, -W
  const [notationMode, setNotationMode] = useState<'dip_dir_dip' | 'strike_dip' | 'quadrant'>('dip_dir_dip');
  const [reverseBruntonDial, setReverseBruntonDial] = useState<boolean>(true); // Traditional Brunton reverses E and W on dial
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Compute True Azimuth with Magnetic Declination
  const trueAzimuthDeg = useMemo(() => {
    return ((azimuthDeg + declinationDeg) % 360 + 360) % 360;
  }, [azimuthDeg, declinationDeg]);

  // Compute Right-Hand-Rule Strike: Strike = DipDir - 90 deg
  const rhrStrikeDeg = useMemo(() => {
    return ((trueAzimuthDeg - 90) % 360 + 360) % 360;
  }, [trueAzimuthDeg]);

  // Quadrant format (e.g. N 45° E, 60° SE)
  const quadrantStr = useMemo(() => {
    const az = trueAzimuthDeg;
    let quad = '';
    if (az >= 0 && az < 90) {
      quad = `N ${az.toFixed(1)}° E`;
    } else if (az >= 90 && az < 180) {
      quad = `S ${(180 - az).toFixed(1)}° E`;
    } else if (az >= 180 && az < 270) {
      quad = `S ${(az - 180).toFixed(1)}° W`;
    } else {
      quad = `N ${(360 - az).toFixed(1)}° W`;
    }

    // Dip direction quadrant
    const dipQuad =
      az >= 315 || az < 45 ? 'N' : az >= 45 && az < 135 ? 'E' : az >= 135 && az < 225 ? 'S' : 'W';
    return `${quad} / ${dipDeg}° ${dipQuad}`;
  }, [trueAzimuthDeg, dipDeg]);

  // Format string for copy/display
  const formattedReading = useMemo(() => {
    if (notationMode === 'dip_dir_dip') {
      return `${String(Math.round(trueAzimuthDeg)).padStart(3, '0')}° / ${Math.round(dipDeg)}°`;
    } else if (notationMode === 'strike_dip') {
      return `Strike ${String(Math.round(rhrStrikeDeg)).padStart(3, '0')}° / Dip ${Math.round(dipDeg)}° (RHR)`;
    } else {
      return quadrantStr;
    }
  }, [notationMode, trueAzimuthDeg, dipDeg, rhrStrikeDeg, quadrantStr]);

  // Percent grade = tan(dip) * 100
  const percentGrade = useMemo(() => {
    if (dipDeg >= 89.9) return '> 1000%';
    return `${Math.round(Math.tan((dipDeg * Math.PI) / 180) * 100)}%`;
  }, [dipDeg]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(formattedReading);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full ${
          isExpanded ? 'max-w-4xl' : 'max-w-2xl'
        } bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden transition-all duration-200 text-slate-100`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-amber-300 tracking-tight flex items-center gap-2">
                <span>Advanced Digital Brunton Pocket Transit</span>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                  GeoMaster 5006
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Precision Geological Compass, Clinometer &amp; True North Calculator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Compress View' : 'Expand View'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/80 hover:text-rose-200 transition-colors cursor-pointer"
              title="Close Brunton Compass"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto no-scrollbar space-y-3.5 flex-1">
          {/* Active Reading Callout Banner */}
          <div className="bg-slate-950 border-2 border-amber-500/50 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 bg-amber-500/20 border border-amber-400/50 rounded-lg text-center font-mono">
                <span className="block text-[9px] uppercase font-bold text-amber-400">Dip Direction</span>
                <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                  {String(Math.round(trueAzimuthDeg)).padStart(3, '0')}°
                </span>
              </div>
              <div className="text-xl font-bold text-slate-600">/</div>
              <div className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-400/50 rounded-lg text-center font-mono">
                <span className="block text-[9px] uppercase font-bold text-cyan-400">Dip Amount</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
                  {Math.round(dipDeg)}°
                </span>
              </div>
              <div className="hidden sm:block pl-2 border-l border-slate-800">
                <div className="text-[10px] text-slate-400 font-mono">RHR Strike: <span className="font-bold text-slate-200">{String(Math.round(rhrStrikeDeg)).padStart(3, '0')}°</span></div>
                <div className="text-[10px] text-slate-400 font-mono">Quadrant: <span className="font-bold text-slate-200">{quadrantStr}</span></div>
                <div className="text-[10px] text-slate-400 font-mono">Gradient: <span className="font-bold text-slate-200">{percentGrade}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Copy measurement to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              {onApplyOrientation && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyOrientation(Math.round(trueAzimuthDeg), Math.round(dipDeg));
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Use in Mapping</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Visual: Two Columns (Compass Dial on Left, Precision Controls & Clinometer on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-center">
            {/* Left: Interactive Brunton Visual Dial */}
            <div className="relative flex flex-col items-center justify-center p-3 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] relative rounded-full bg-stone-900 border-4 border-stone-700 shadow-[inset_0_4px_12px_rgba(0,0,0,0.8),0_8px_20px_rgba(0,0,0,0.6)] flex items-center justify-center select-none overflow-hidden">
                {/* Traditional Brunton Outer Bezel with Aluminum/Brass Ring */}
                <div className="absolute inset-1 rounded-full border-2 border-amber-600/60 pointer-events-none" />

                {/* Sighting Index / Sighting Line at Top (0° Index) */}
                <div className="absolute top-0 w-1 h-3 bg-amber-400 rounded-b z-20" />
                <div className="absolute top-3 text-[9px] font-black text-amber-400 font-mono z-20">SIGHT</div>

                {/* Rotating Azimuth Dial / Card */}
                <div
                  className="absolute inset-4 rounded-full transition-transform duration-75 ease-out flex items-center justify-center"
                  style={{
                    transform: `rotate(${-azimuthDeg}deg)`,
                  }}
                >
                  {/* Dial ticks */}
                  {Array.from({ length: 72 }).map((_, i) => {
                    const deg = i * 5;
                    const isMajor = deg % 30 === 0;
                    const isCardinal = deg % 90 === 0;
                    return (
                      <div
                        key={deg}
                        className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom"
                        style={{
                          height: '50%',
                          transform: `rotate(${deg}deg)`,
                        }}
                      >
                        <div
                          className={`w-0.5 ${
                            isCardinal ? 'h-3 bg-white' : isMajor ? 'h-2 bg-amber-400' : 'h-1.5 bg-slate-500'
                          }`}
                        />
                      </div>
                    );
                  })}

                  {/* Cardinal Labels: Traditional Brunton has East and West reversed so needle directly points to sight direction */}
                  <span className="absolute top-2.5 text-xs font-black text-rose-400 font-mono">N</span>
                  <span className="absolute bottom-2.5 text-xs font-black text-slate-300 font-mono">S</span>
                  <span className="absolute right-2.5 text-xs font-black text-slate-300 font-mono">
                    {reverseBruntonDial ? 'E' : 'W'}
                  </span>
                  <span className="absolute left-2.5 text-xs font-black text-slate-300 font-mono">
                    {reverseBruntonDial ? 'W' : 'E'}
                  </span>

                  {/* Degree Numbers around dial */}
                  {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
                    <div
                      key={`num-${d}`}
                      className="absolute text-[8px] font-mono text-slate-400 font-bold"
                      style={{
                        transform: `rotate(${d}deg) translateY(-100px) rotate(${-d}deg)`,
                      }}
                    >
                      {d}
                    </div>
                  ))}

                  {/* Clinometer Arc (0 to 90 degrees inside dial) */}
                  <div className="absolute inset-10 rounded-full border border-dashed border-cyan-500/30 pointer-events-none" />

                  {/* Center Pivot Jewel */}
                  <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md z-10" />

                  {/* Magnetic Needle: Red North pointer with arrow tip, White South counter-weight */}
                  <div
                    className="absolute w-2.5 h-[84%] pointer-events-none z-10 transition-transform duration-100 ease-out flex flex-col justify-between items-center"
                    style={{
                      transform: `rotate(${azimuthDeg}deg)`,
                    }}
                  >
                    {/* North Needle Tip */}
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[45px] border-b-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.8)]" />
                    {/* South Needle Tip */}
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[45px] border-t-white drop-shadow-[0_0_3px_rgba(255,255,255,0.6)]" />
                  </div>
                </div>

                {/* Bullseye Spirit Bubble Level (Fixed in housing) */}
                <div className="absolute bottom-6 right-6 w-9 h-9 rounded-full bg-emerald-950/80 border-2 border-emerald-400/80 flex items-center justify-center shadow-inner z-20 pointer-events-none">
                  <div className="w-4 h-4 rounded-full border border-dashed border-emerald-300/60 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_#34d399] animate-pulse" />
                  </div>
                </div>

                {/* Clinometer Indicator Bubble */}
                <div
                  className="absolute bottom-6 left-6 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/80 text-[8.5px] font-mono text-cyan-300 font-bold z-20 pointer-events-none"
                  title="Clinometer Dip Indicator"
                >
                  CLINO: {dipDeg}°
                </div>
              </div>

              {/* Dial Notation Toggle under compass */}
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReverseBruntonDial((p) => !p)}
                  className="text-[10px] text-slate-400 hover:text-amber-300 font-mono underline cursor-pointer"
                >
                  Dial Format: {reverseBruntonDial ? 'Authentic Brunton (Reversed E/W)' : 'Standard Geographic'}
                </button>
              </div>
            </div>

            {/* Right: Fine Sliders, Clinometer Angle, Declination & Presets */}
            <div className="space-y-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              {/* Notation Selector */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(
                  [
                    ['dip_dir_dip', 'Dip Dir / Dip'],
                    ['strike_dip', 'Strike / Dip (RHR)'],
                    ['quadrant', 'Quadrant Format'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNotationMode(mode)}
                    className={`flex-1 py-1 rounded text-[10.5px] font-black cursor-pointer transition-all ${
                      notationMode === mode
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Azimuth / Strike Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Azimuth / Direction (°):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={359}
                      value={azimuthDeg}
                      onChange={(e) => setAzimuthDeg((Number(e.target.value) % 360 + 360) % 360)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-amber-300 text-xs"
                    />
                    <span className="font-mono text-xs text-slate-400">°</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={azimuthDeg}
                  onChange={(e) => setAzimuthDeg(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                {/* 8 Cardinal Quick Taps */}
                <div className="grid grid-cols-8 gap-0.5 text-[9px] font-mono font-bold pt-0.5">
                  {[
                    ['N', 0],
                    ['NE', 45],
                    ['E', 90],
                    ['SE', 135],
                    ['S', 180],
                    ['SW', 225],
                    ['W', 270],
                    ['NW', 315],
                  ].map(([lbl, deg]) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setAzimuthDeg(Number(deg))}
                      className={`py-0.5 rounded border text-center cursor-pointer transition-all ${
                        azimuthDeg === deg
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinometer Dip Angle Slider */}
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Clinometer Dip Angle (°):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={dipDeg}
                      onChange={(e) => setDipDeg(Math.max(0, Math.min(90, Number(e.target.value))))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono font-bold text-cyan-300 text-xs"
                    />
                    <span className="font-mono text-xs text-slate-400">°</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={1}
                  value={dipDeg}
                  onChange={(e) => setDipDeg(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                {/* Dip Angle Presets */}
                <div className="grid grid-cols-7 gap-0.5 text-[9px] font-mono font-bold pt-0.5">
                  {[0, 15, 30, 45, 60, 75, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDipDeg(d)}
                      className={`py-0.5 rounded border text-center cursor-pointer transition-all ${
                        dipDeg === d
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {d}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Magnetic Declination Adjustment */}
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-emerald-400" />
                    <span>Magnetic Declination (Site True North)</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {declinationDeg > 0 ? `+${declinationDeg}° E` : declinationDeg < 0 ? `${declinationDeg}° W` : '0°'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={0.5}
                    value={declinationDeg}
                    onChange={(e) => setDeclinationDeg(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setDeclinationDeg(0)}
                    className="px-1.5 py-0.5 rounded text-[9.5px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Common Geological Discontinuity Presets */}
              <div className="pt-1 border-t border-slate-800/80 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Quick Geological Presets:</div>
                <div className="grid grid-cols-3 gap-1 text-[10.5px]">
                  {[
                    { label: 'Sub-Horiz Bedding', dir: 180, dip: 12 },
                    { label: 'Steep Major Fault', dir: 125, dip: 78 },
                    { label: 'Regional Foliation', dir: 310, dip: 62 },
                    { label: 'Cross-Joint J1', dir: 45, dip: 70 },
                    { label: 'Conjugate Joint J2', dir: 225, dip: 65 },
                    { label: 'Flat Stress Relief', dir: 0, dip: 5 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setAzimuthDeg(preset.dir);
                        setDipDeg(preset.dip);
                      }}
                      className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 text-left cursor-pointer transition-all"
                    >
                      <div className="font-bold text-[10px] text-slate-200 truncate">{preset.label}</div>
                      <div className="font-mono text-[9px] text-amber-400">{preset.dir}° / {preset.dip}°</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Right-Hand Rule (RHR) applies: Dip direction is 90° clockwise from strike.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
