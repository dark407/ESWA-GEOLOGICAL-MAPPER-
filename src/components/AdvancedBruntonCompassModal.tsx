import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Compass,
  X,
  Copy,
  Check,
  ArrowUpRight,
  Pause,
  Play,
  Smartphone,
  RotateCcw,
} from 'lucide-react';

export interface AdvancedBruntonCompassModalProps {
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
  initialDip = 45,
  onApplyOrientation,
}) => {
  // Current orientation readings
  const [azimuthDeg, setAzimuthDeg] = useState<number>(initialAzimuth);
  const [dipDeg, setDipDeg] = useState<number>(initialDip);
  const [pitchDeg, setPitchDeg] = useState<number>(0);
  const [rollDeg, setRollDeg] = useState<number>(0);

  // States
  const [isHoldActive, setIsHoldActive] = useState<boolean>(false);
  const [sensorStatus, setSensorStatus] = useState<
    'active' | 'listening' | 'permission_needed' | 'manual'
  >('listening');
  const [copied, setCopied] = useState<boolean>(false);
  const [calibrationOffset, setCalibrationOffset] = useState<number>(0);

  // Smoothing buffers for compass needle
  const sinBufferRef = useRef<number[]>([]);
  const cosBufferRef = useRef<number[]>([]);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasAbsoluteSensorRef = useRef<boolean>(false);

  // Computed true azimuth including optional user manual offset
  const trueAzimuthDeg = useMemo(() => {
    return ((azimuthDeg + calibrationOffset) % 360 + 360) % 360;
  }, [azimuthDeg, calibrationOffset]);

  // Strike according to Right-Hand Rule (RHR = Dip Direction - 90°)
  const rhrStrikeDeg = useMemo(() => {
    return ((trueAzimuthDeg - 90) % 360 + 360) % 360;
  }, [trueAzimuthDeg]);

  // Quadrant representation (e.g. S 45° E, 48° SE)
  const quadrantStr = useMemo(() => {
    const az = trueAzimuthDeg;
    let quad = '';
    if (az >= 0 && az < 90) {
      quad = `N ${az.toFixed(0)}° E`;
    } else if (az >= 90 && az < 180) {
      quad = `S ${(180 - az).toFixed(0)}° E`;
    } else if (az >= 180 && az < 270) {
      quad = `S ${(az - 180).toFixed(0)}° W`;
    } else {
      quad = `N ${(360 - az).toFixed(0)}° W`;
    }
    const dipQuad =
      az >= 315 || az < 45 ? 'N' : az >= 45 && az < 135 ? 'E' : az >= 135 && az < 225 ? 'S' : 'W';
    return `${quad} / ${Math.round(dipDeg)}° ${dipQuad}`;
  }, [trueAzimuthDeg, dipDeg]);

  // Request explicit permission for iOS 13+ devices
  const handleRequestPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setSensorStatus('active');
        } else {
          setSensorStatus('manual');
        }
      } catch (err) {
        console.warn('Sensor permission error:', err);
        setSensorStatus('manual');
      }
    } else {
      setSensorStatus('active');
    }
  }, []);

  // ACCURATE HARDWARE ORIENTATION SENSOR
  useEffect(() => {
    if (!isOpen) return;

    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      if (sensorStatus !== 'active') {
        setSensorStatus('permission_needed');
      }
    }

    if (isHoldActive) return;

    hasAbsoluteSensorRef.current = false;
    let receivedAnyEvent = false;

    // Helper: update smoothed azimuth
    const updateSmoothedAzimuth = (rawHeading: number) => {
      if (isDraggingRef.current) return;
      const rad = (rawHeading * Math.PI) / 180;
      sinBufferRef.current.push(Math.sin(rad));
      cosBufferRef.current.push(Math.cos(rad));
      if (sinBufferRef.current.length > 5) {
        sinBufferRef.current.shift();
        cosBufferRef.current.shift();
      }
      const avgSin = sinBufferRef.current.reduce((a, b) => a + b, 0) / sinBufferRef.current.length;
      const avgCos = cosBufferRef.current.reduce((a, b) => a + b, 0) / cosBufferRef.current.length;
      const smoothed = ((Math.atan2(avgSin, avgCos) * 180) / Math.PI + 360) % 360;
      setAzimuthDeg(Math.round(smoothed));
    };

    // 1. Try modern W3C AbsoluteOrientationSensor (Chrome / Android hardware sensor fusion)
    let absoluteSensor: any = null;
    if (typeof window !== 'undefined' && 'AbsoluteOrientationSensor' in window) {
      try {
        absoluteSensor = new (window as any).AbsoluteOrientationSensor({ frequency: 30 });
        absoluteSensor.addEventListener('reading', () => {
          receivedAnyEvent = true;
          hasAbsoluteSensorRef.current = true;
          setSensorStatus('active');

          const q = absoluteSensor.quaternion;
          if (q && q.length === 4) {
            const [x, y, z, w] = q;
            // Yaw (heading in Earth horizontal plane)
            const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
            // Screen orientation offset
            const screenAngle =
              window.screen?.orientation?.angle != null
                ? window.screen.orientation.angle
                : Number((window as any)?.orientation) || 0;

            const deg = ((yaw * 180) / Math.PI - screenAngle + 360) % 360;
            updateSmoothedAzimuth(deg);

            // Pitch & Roll for inclinometer and levels
            const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * x - y * z))));
            const roll = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
            const pDeg = (pitch * 180) / Math.PI;
            const rDeg = (roll * 180) / Math.PI;
            setPitchDeg(pDeg);
            setRollDeg(rDeg);

            // Dip angle from horizontal
            const cosTilt = Math.min(1, Math.max(-1, Math.cos(pitch) * Math.cos(roll)));
            const rawDip = Math.round(Math.acos(Math.abs(cosTilt)) * (180 / Math.PI));
            setDipDeg(Math.min(90, Math.max(0, rawDip)));
          }
        });
        absoluteSensor.addEventListener('error', (err: any) => {
          console.warn('AbsoluteOrientationSensor error:', err);
        });
        absoluteSensor.start();
      } catch (err) {
        console.warn('AbsoluteOrientationSensor init error:', err);
      }
    }

    // 2. Handler for DeviceOrientation & DeviceOrientationAbsolute
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // If AbsoluteOrientationSensor is already delivering readings, don't double-process
      if (hasAbsoluteSensorRef.current && absoluteSensor) return;

      const isAbsoluteEvent = (e as any).type === 'deviceorientationabsolute' || e.absolute === true;

      // CRITICAL FIX: If an absolute event was already detected, NEVER let relative (e.absolute === false)
      // overwrite it, which was causing the compass to reset to 0° (North) wherever the user pointed!
      if (!isAbsoluteEvent && hasAbsoluteSensorRef.current) {
        return;
      }

      receivedAnyEvent = true;
      setSensorStatus('active');

      let rawHeading: number | null = null;

      // A) iOS Safari WebKit Heading (100% absolute magnetic direction)
      if (typeof (e as any).webkitCompassHeading === 'number') {
        hasAbsoluteSensorRef.current = true;
        rawHeading = (e as any).webkitCompassHeading;
      } else if (e.alpha != null) {
        // B) Android: alpha is rotation around Z axis
        if (isAbsoluteEvent) {
          hasAbsoluteSensorRef.current = true;
        }

        const screenAngle =
          window.screen?.orientation?.angle != null
            ? window.screen.orientation.angle
            : Number((window as any)?.orientation) || 0;

        // In standard W3C DeviceOrientation:
        // alpha = 0 is North. As device rotates clockwise (East), alpha decreases from 360.
        // Therefore, heading clockwise from North is (360 - alpha + screenAngle) % 360
        rawHeading = (360 - e.alpha + screenAngle + 360) % 360;
      }

      // Pitch and Roll
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      setPitchDeg(beta);
      setRollDeg(gamma);

      // Clinometer dip calculation
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;
      const cosTilt = Math.min(1, Math.max(-1, Math.cos(betaRad) * Math.cos(gammaRad)));
      const rawDip = Math.round(Math.acos(Math.abs(cosTilt)) * (180 / Math.PI));
      setDipDeg(Math.min(90, Math.max(0, rawDip)));

      if (rawHeading != null) {
        updateSmoothedAzimuth(rawHeading);
      }
    };

    // Register absolute orientation event first
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation as any, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    const fallbackTimer = setTimeout(() => {
      if (!receivedAnyEvent && sensorStatus === 'listening') {
        setSensorStatus('manual');
      }
    }, 2000);

    return () => {
      clearTimeout(fallbackTimer);
      if (absoluteSensor) {
        try {
          absoluteSensor.stop();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isOpen, isHoldActive, sensorStatus]);

  // Touch & Drag to manually rotate compass dial if needed
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angleRad = Math.atan2(dx, -dy);
    const deg = ((angleRad * 180) / Math.PI + 360) % 360;
    setAzimuthDeg(Math.round(deg));
  };

  // Bull's Eye Circular Level (tracks pitch & roll)
  const bullsEyeX = useMemo(() => {
    return Math.max(-13, Math.min(13, rollDeg * 0.42));
  }, [rollDeg]);

  const bullsEyeY = useMemo(() => {
    return Math.max(-13, Math.min(13, -pitchDeg * 0.42));
  }, [pitchDeg]);

  const isBullsEyeLevel = Math.sqrt(bullsEyeX * bullsEyeX + bullsEyeY * bullsEyeY) < 3.2;

  // Tubular Spirit Level (horizontal cylindrical vial)
  const spiritVialX = useMemo(() => {
    return Math.max(-28, Math.min(28, rollDeg * 0.65));
  }, [rollDeg]);

  const isSpiritLevelCentered = Math.abs(spiritVialX) < 3.5;

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `${String(Math.round(trueAzimuthDeg)).padStart(3, '0')}° / ${Math.round(dipDeg)}°`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      {/* Real Looking Brunton Pocket Transit Body */}
      <div className="w-full max-w-[560px] bg-[#1a231b] border-4 border-[#2d3a2e] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_2px_8px_rgba(255,255,255,0.08)] flex flex-col max-h-[96vh] overflow-hidden text-stone-100">
        {/* Top Casting Header & Lid Hinge */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141c15] border-b border-[#2d3a2e] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_#f59e0b]" />
            <div>
              <h3 className="font-serif font-black text-sm sm:text-base text-amber-200 tracking-wider uppercase">
                Brunton Pocket Transit
              </h3>
              <p className="text-[10px] font-mono text-stone-400">
                Standard Geological Pocket Transit · Made for Field Mapping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sensorStatus === 'active' ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : sensorStatus === 'permission_needed' ? (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer shadow animate-bounce flex items-center gap-1"
              >
                <Smartphone className="w-3 h-3" />
                <span>Tap for Live</span>
              </button>
            ) : (
              <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                Touch / Drag Dial
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Close Brunton Compass"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Readout Display Strip */}
        <div className="px-4 py-2 bg-[#0e140f] border-b border-[#253026] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 font-mono">
            <div>
              <span className="text-[9px] uppercase font-bold text-amber-400/90 block">Direction</span>
              <span className="text-2xl font-black text-amber-300 tracking-tight">
                {String(Math.round(trueAzimuthDeg)).padStart(3, '0')}°
              </span>
            </div>

            <div className="text-xl font-bold text-stone-600">/</div>

            <div>
              <span className="text-[9px] uppercase font-bold text-cyan-400/90 block">Inclinometer</span>
              <span className="text-2xl font-black text-cyan-300 tracking-tight">
                {Math.round(dipDeg)}°
              </span>
            </div>

            <div className="hidden sm:block pl-2 border-l border-stone-800 text-[11px]">
              <span className="text-stone-400 block">{quadrantStr}</span>
              <span className="text-emerald-400 font-bold">Strike {String(Math.round(rhrStrikeDeg)).padStart(3, '0')}°</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsHoldActive((p) => !p)}
              className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow ${
                isHoldActive
                  ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
              }`}
              title="Freeze or resume live needle reading"
            >
              {isHoldActive ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-stone-950" />
                  <span>RESUME</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>HOLD</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 cursor-pointer"
              title="Copy reading"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Real Brunton Dial & Mechanical Chassis */}
        <div className="p-3 sm:p-4 overflow-y-auto no-scrollbar flex flex-col items-center justify-center space-y-3 flex-1">
          {/* Authentic Round Cast Compass Bowl */}
          <div className="relative p-2 rounded-full bg-[#1e281f] border-4 border-[#334234] shadow-[inset_0_4px_16px_rgba(0,0,0,0.9),0_12px_36px_rgba(0,0,0,0.85)] flex items-center justify-center">
            {/* Sight Pin / Index at 12 o'clock */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none">
              <div className="w-2 h-4 bg-amber-400 rounded-b shadow-[0_0_8px_#f59e0b]" />
              <span className="text-[8px] font-black text-amber-300 font-mono tracking-widest mt-0.5">SIGHT</span>
            </div>

            {/* Dial Face */}
            <div
              ref={dialRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] relative rounded-full bg-[#0d120e] border-4 border-[#415343] flex items-center justify-center select-none overflow-hidden cursor-crosshair touch-none shadow-inner"
            >
              {/* Outer Brass Ring */}
              <div className="absolute inset-1 rounded-full border-2 border-amber-600/60 pointer-events-none" />

              {/* Azimuth Graduations Ring (0° to 360°) */}
              <div className="absolute inset-3 rounded-full pointer-events-none">
                {Array.from({ length: 72 }).map((_, i) => {
                  const deg = i * 5;
                  const isCardinal = deg % 90 === 0;
                  const isMajor = deg % 30 === 0;
                  return (
                    <div
                      key={deg}
                      className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none"
                      style={{
                        height: '50%',
                        transform: `rotate(${deg}deg)`,
                      }}
                    >
                      <div
                        className={`w-0.5 ${
                          isCardinal ? 'h-4 bg-amber-300' : isMajor ? 'h-2.5 bg-stone-300' : 'h-1.5 bg-stone-600'
                        }`}
                      />
                    </div>
                  );
                })}

                {/* Classic Brunton Reverse Dial (E is Left, W is Right for direct strike reading) */}
                <span className="absolute top-2.5 text-xs font-black text-rose-400 font-mono">N</span>
                <span className="absolute bottom-2.5 text-xs font-black text-stone-300 font-mono">S</span>
                <span className="absolute left-3 text-xs font-black text-stone-300 font-mono">E</span>
                <span className="absolute right-3 text-xs font-black text-stone-300 font-mono">W</span>

                {/* Numbers around ring */}
                {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
                  <div
                    key={`num-${d}`}
                    className="absolute text-[8px] font-mono text-stone-400 font-bold pointer-events-none"
                    style={{
                      transform: `rotate(${d}deg) translateY(-112px) rotate(${-d}deg)`,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Central Inclinometer Arc (0° to 90° markings for dip angle) */}
              <div className="absolute inset-14 rounded-full border border-dashed border-cyan-500/30 pointer-events-none flex items-center justify-center">
                <span className="text-[8px] font-mono font-bold text-cyan-400/80 -translate-y-9">
                  INCLINOMETER ARC 0-90°
                </span>
              </div>

              {/* WORKING INCLINOMETER NEEDLE / WEIGHT (swings by gravity tilt) */}
              <div
                className="absolute w-1 h-[55%] pointer-events-none z-10 transition-transform duration-100 ease-out flex flex-col justify-end items-center"
                style={{
                  transform: `rotate(${dipDeg}deg)`,
                }}
              >
                <div className="w-1.5 h-16 bg-cyan-400/80 rounded-t shadow-[0_0_6px_#22d3ee]" />
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 border border-white" />
              </div>

              {/* Sapphire / Brass Pivot Jewel in Center */}
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border-2 border-white shadow-md z-20 pointer-events-none" />

              {/* BALANCED MAGNETIC COMPASS NEEDLE */}
              {/* Rotates by -azimuthDeg so that the red North arrow always points to Earth's Magnetic North! */}
              <div
                className="absolute w-3.5 h-[84%] pointer-events-none z-20 transition-transform duration-75 ease-out flex flex-col justify-between items-center"
                style={{
                  transform: `rotate(${-azimuthDeg}deg)`,
                }}
              >
                {/* North Tip: Classic Red Point with White Phosphor Dot */}
                <div className="flex flex-col items-center">
                  <div className="w-0 h-0 border-l-[6.5px] border-l-transparent border-r-[6.5px] border-r-transparent border-b-[56px] border-b-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.95)]" />
                  <span className="text-[8px] font-black text-rose-100 font-mono -mt-7">N</span>
                </div>
                {/* South Tip: Silver with Counterweight Bar */}
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-stone-900 font-mono -mb-7">S</span>
                  <div className="w-0 h-0 border-l-[6.5px] border-l-transparent border-r-[6.5px] border-r-transparent border-t-[56px] border-t-stone-200 drop-shadow-[0_0_5px_rgba(255,255,255,0.7)]" />
                </div>
              </div>
            </div>
          </div>

          {/* DUAL WORKING LEVELS (Bull's Eye Level & Tubular Spirit Level) */}
          <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
            {/* 1. BULL'S EYE CIRCULAR LEVEL */}
            <div className="p-2.5 rounded-2xl bg-[#131b14] border border-[#273528] flex items-center justify-between gap-2 shadow-inner">
              <div>
                <span className="text-[10px] font-bold font-mono text-amber-200 block">
                  Bull&apos;s Eye Level
                </span>
                <span
                  className={`text-[9.5px] font-mono font-bold ${
                    isBullsEyeLevel ? 'text-emerald-400' : 'text-stone-400'
                  }`}
                >
                  {isBullsEyeLevel ? '● LEVEL (FLAT)' : 'Tilted'}
                </span>
              </div>

              {/* Circular Vial */}
              <div
                className="w-12 h-12 rounded-full bg-emerald-950/90 border-2 border-emerald-400/90 flex items-center justify-center relative overflow-hidden shadow-inner shrink-0"
                title="Bull's Eye Level: Keep bubble centered for true horizontal bearing"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-emerald-500/40" />
                  <div className="h-full w-[1px] bg-emerald-500/40 absolute" />
                </div>
                <div className="w-5 h-5 rounded-full border border-emerald-300/80" />
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform duration-75 ${
                    isBullsEyeLevel
                      ? 'bg-emerald-300 shadow-[0_0_8px_#34d399] animate-pulse'
                      : 'bg-emerald-400/90 shadow-[0_0_5px_#10b981]'
                  }`}
                  style={{
                    transform: `translate(${bullsEyeX}px, ${bullsEyeY}px)`,
                  }}
                />
              </div>
            </div>

            {/* 2. TUBULAR SPIRIT LEVEL */}
            <div className="p-2.5 rounded-2xl bg-[#131b14] border border-[#273528] flex flex-col justify-between gap-1 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-cyan-200">
                  Tubular Spirit Level
                </span>
                <span
                  className={`text-[9.5px] font-mono font-bold ${
                    isSpiritLevelCentered ? 'text-cyan-300' : 'text-stone-400'
                  }`}
                >
                  {isSpiritLevelCentered ? 'CENTERED' : 'Tilt'}
                </span>
              </div>

              {/* Horizontal Cylindrical Glass Tube */}
              <div
                className="relative w-full h-6 bg-cyan-950/90 border-2 border-cyan-400/90 rounded-full flex items-center justify-center shadow-inner overflow-hidden"
                title="Tubular Spirit Level: For leveling clinometer along vertical plane"
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 border-x border-cyan-300/80 bg-cyan-400/10" />
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-cyan-300/50" />
                <div
                  className={`h-4 w-7 rounded-full transition-transform duration-75 ${
                    isSpiritLevelCentered
                      ? 'bg-cyan-300 shadow-[0_0_8px_#67e8f9] animate-pulse'
                      : 'bg-cyan-400/90 shadow-[0_0_4px_#22d3ee]'
                  }`}
                  style={{
                    transform: `translateX(${spiritVialX}px)`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-4 py-3 bg-[#111712] border-t border-[#253026] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-400">
            <span>Calibrate:</span>
            <button
              type="button"
              onClick={() => setCalibrationOffset((p) => (p - 5 + 360) % 360)}
              className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 rounded text-stone-300 font-bold cursor-pointer"
              title="Rotate North -5°"
            >
              -5°
            </button>
            <button
              type="button"
              onClick={() => setCalibrationOffset(0)}
              className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 rounded text-stone-300 font-bold cursor-pointer"
              title="Reset calibration offset"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setCalibrationOffset((p) => (p + 5) % 360)}
              className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 rounded text-stone-300 font-bold cursor-pointer"
              title="Rotate North +5°"
            >
              +5°
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
            >
              Close
            </button>

            {onApplyOrientation && (
              <button
                type="button"
                onClick={() => {
                  onApplyOrientation(Math.round(trueAzimuthDeg), Math.round(dipDeg));
                  onClose();
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-mono font-black bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-md cursor-pointer active:scale-95 transition-all flex items-center gap-1"
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                <span>Apply ({Math.round(trueAzimuthDeg)}° / {Math.round(dipDeg)}°)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
