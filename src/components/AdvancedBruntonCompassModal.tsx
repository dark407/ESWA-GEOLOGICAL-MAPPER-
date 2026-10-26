import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Compass,
  X,
  RotateCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Navigation,
  Info,
  ArrowUpRight,
  Pause,
  Play,
  Smartphone,
  ShieldCheck,
  Radio,
  Sliders,
  Layers,
  Sparkles,
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
  // Compass reading state
  const [azimuthDeg, setAzimuthDeg] = useState<number>(initialAzimuth);
  const [dipDeg, setDipDeg] = useState<number>(initialDip);
  const [declinationDeg, setDeclinationDeg] = useState<number>(0); // Magnetic declination: +E, -W
  const [notationMode, setNotationMode] = useState<'dip_dir_dip' | 'strike_dip' | 'quadrant'>('dip_dir_dip');
  const [dialStyle, setDialStyle] = useState<'authentic_brunton' | 'rotating_card'>('authentic_brunton');
  const [reverseBruntonDial, setReverseBruntonDial] = useState<boolean>(true); // Traditional Brunton reverses E and W on dial
  const [measurementMode, setMeasurementMode] = useState<'sighting' | 'contact_plane'>('sighting');

  // Real-time sensor state
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [isHoldActive, setIsHoldActive] = useState<boolean>(false);
  const [sensorStatus, setSensorStatus] = useState<'listening' | 'active' | 'unsupported' | 'permission_needed' | 'denied'>('listening');
  const [sensorAccuracy, setSensorAccuracy] = useState<number | null>(null);
  const [pitchDeg, setPitchDeg] = useState<number>(0);
  const [rollDeg, setRollDeg] = useState<number>(0);
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(false);

  // UI state
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDraggingDial, setIsDraggingDial] = useState<boolean>(false);

  const dialRef = useRef<HTMLDivElement | null>(null);
  const simulationTimerRef = useRef<any>(null);

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

  // Geological Dip Classification
  const dipClassification = useMemo(() => {
    if (dipDeg <= 5) return 'Sub-Horizontal (0-5°)';
    if (dipDeg <= 20) return 'Gently Dipping (5-20°)';
    if (dipDeg <= 45) return 'Moderately Dipping (20-45°)';
    if (dipDeg <= 80) return 'Steeply Dipping (45-80°)';
    return 'Sub-Vertical to Vertical (80-90°)';
  }, [dipDeg]);

  // Request iOS permission if needed
  const handleRequestSensorPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setSensorStatus('active');
          setIsLiveActive(true);
        } else {
          setSensorStatus('denied');
        }
      } catch (err) {
        console.warn('Sensor permission error:', err);
        setSensorStatus('denied');
      }
    } else {
      setIsLiveActive(true);
      setSensorStatus('active');
    }
  }, []);

  // REAL-TIME HARDWARE SENSOR LISTENER
  useEffect(() => {
    if (!isOpen) return;

    // Check if on iOS requiring explicit permission request
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      // Don't auto-request without user interaction on iOS, show permission prompt button
      if (sensorStatus !== 'active') {
        setSensorStatus('permission_needed');
      }
    }

    if (!isLiveActive || isHoldActive) return;

    let receivedEvents = 0;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      receivedEvents++;
      setSensorStatus('active');

      // 1. Heading Extraction
      let heading: number | null = null;

      // iOS WebKit Compass Heading (direct magnetic azimuth 0-360°)
      if (typeof (e as any).webkitCompassHeading === 'number') {
        heading = (e as any).webkitCompassHeading;
        if (typeof (e as any).webkitCompassAccuracy === 'number') {
          setSensorAccuracy((e as any).webkitCompassAccuracy);
        }
      } else if (e.alpha != null) {
        // Android / Chrome: alpha is rotation around Z axis
        // In standard coordinate frame, heading clockwise from North is:
        heading = (360 - e.alpha) % 360;
      }

      // 2. Pitch (beta: -180 to 180) & Roll (gamma: -90 to 90)
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      setPitchDeg(beta);
      setRollDeg(gamma);

      // 3. Clinometer: Dip Angle Calculation from Horizontal Ground Plane
      // Tilt of normal vector from vertical Z:
      const betaRad = (beta * Math.PI) / 180;
      const gammaRad = (gamma * Math.PI) / 180;
      const cosTilt = Math.min(1, Math.max(-1, Math.cos(betaRad) * Math.cos(gammaRad)));
      const rawDip = Math.round(Math.acos(Math.abs(cosTilt)) * (180 / Math.PI));
      const clampedDip = Math.min(90, Math.max(0, rawDip));
      setDipDeg(clampedDip);

      // 4. Update Azimuth
      if (heading != null) {
        let finalAzimuth = heading;
        if (measurementMode === 'contact_plane') {
          // In Contact Plane mode: Dip Direction is maximum downward gradient on the device plane
          const downDipRelative = (Math.atan2(-Math.sin(gammaRad), Math.sin(betaRad)) * 180) / Math.PI;
          finalAzimuth = ((heading + downDipRelative) % 360 + 360) % 360;
        }
        setAzimuthDeg(Math.round(finalAzimuth));
      }
    };

    // Listen to deviceorientationabsolute first (modern Android geomagnetic orientation)
    window.addEventListener('deviceorientationabsolute' as any, handleOrientation as any, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    // Timeout: if no orientation events received within 1.2s, device lacks magnetometer hardware
    const checkTimer = setTimeout(() => {
      if (receivedEvents === 0 && sensorStatus === 'listening') {
        setSensorStatus('unsupported');
      }
    }, 1200);

    return () => {
      clearTimeout(checkTimer);
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isOpen, isLiveActive, isHoldActive, measurementMode, sensorStatus]);

  // LIVE GYRO SIMULATOR FOR DESKTOP / WORKSTATION TESTING
  useEffect(() => {
    if (!isSimulatingLive || isHoldActive) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      return;
    }

    let currentSimAz = azimuthDeg;
    let currentSimDip = dipDeg;
    let step = 0;

    simulationTimerRef.current = setInterval(() => {
      step += 0.05;
      // Smooth dynamic drift mimicking real-time field handling
      const azDelta = Math.sin(step) * 1.5 + Math.cos(step * 0.5) * 0.8;
      const dipDelta = Math.sin(step * 0.8) * 0.5;

      currentSimAz = ((currentSimAz + azDelta) % 360 + 360) % 360;
      currentSimDip = Math.min(90, Math.max(0, currentSimDip + dipDelta));

      setAzimuthDeg(Math.round(currentSimAz * 10) / 10);
      setDipDeg(Math.round(currentSimDip * 10) / 10);
      setPitchDeg(Math.sin(step) * 15);
      setRollDeg(Math.cos(step) * 12);
    }, 50);

    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, [isSimulatingLive, isHoldActive, azimuthDeg, dipDeg]);

  // DIRECT DIAL TOUCH / MOUSE INTERACTION (DRAG TO ROTATE)
  const handleDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isHoldActive) return;
    setIsDraggingDial(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handleDialPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingDial || isHoldActive) return;
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handleDialPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingDial(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const updateAngleFromPointer = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Angle clockwise from 12 o'clock (SIGHT line):
    let angleRad = Math.atan2(dx, -dy);
    let deg = (angleRad * 180) / Math.PI;
    deg = (deg % 360 + 360) % 360;
    setAzimuthDeg(Math.round(deg));
  };

  // Spirit Level Bubble displacement (clamped to spirit circle)
  const bubbleX = useMemo(() => {
    return Math.max(-12, Math.min(12, rollDeg * 0.4));
  }, [rollDeg]);

  const bubbleY = useMemo(() => {
    return Math.max(-12, Math.min(12, -pitchDeg * 0.4));
  }, [pitchDeg]);

  const isLevel = Math.sqrt(bubbleX * bubbleX + bubbleY * bubbleY) < 3.5;

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
        } bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden transition-all duration-200 text-slate-100`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-amber-300 tracking-tight">
                  Advanced Brunton Pocket Transit
                </h3>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                  REAL-TIME SENSOR
                </span>
              </div>
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

        {/* Real-Time Sensor Live Status Ribbon */}
        <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            {sensorStatus === 'active' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono text-[10.5px] font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>REAL-TIME SENSOR ACTIVE</span>
                {sensorAccuracy !== null && (
                  <span className="text-emerald-400/80 text-[9.5px]">±{Math.round(sensorAccuracy)}°</span>
                )}
              </span>
            ) : sensorStatus === 'permission_needed' ? (
              <button
                type="button"
                onClick={handleRequestSensorPermission}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10.5px] cursor-pointer shadow animate-bounce"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Tap to Enable Real-Time Magnetic Sensor</span>
              </button>
            ) : sensorStatus === 'denied' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/60 text-rose-300 font-mono text-[10.5px]">
                <span>Sensor Permission Denied (Manual / Sim Mode)</span>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimulatingLive((p) => !p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                    isSimulatingLive
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
                  }`}
                >
                  {isSimulatingLive ? '● Live Gyro Simulating' : 'Start Gyro Simulation'}
                </button>
              </div>
            )}

            {/* Measurement Method Toggle: Sighting vs Contact Plane */}
            <div className="hidden sm:flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setMeasurementMode('sighting')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  measurementMode === 'sighting'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Sight with phone top towards tunnel face or strike line"
              >
                Sighting Mode
              </button>
              <button
                type="button"
                onClick={() => setMeasurementMode('contact_plane')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  measurementMode === 'contact_plane'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Hold phone back flat against rock joint plane to measure Dip & Dip Direction"
              >
                Rock Contact Plane Mode
              </button>
            </div>
          </div>

          {/* FREEZE / HOLD READING BUTTON */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsHoldActive((p) => !p)}
              className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow ${
                isHoldActive
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Freeze / hold reading to comfortably inspect away from rock face"
            >
              {isHoldActive ? (
                <>
                  <Play className="w-3 h-3 fill-slate-950" />
                  <span>RESUME LIVE</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" />
                  <span>HOLD / FREEZE</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto no-scrollbar space-y-3.5 flex-1">
          {/* Active Reading Callout Banner */}
          <div
            className={`bg-slate-950 border-2 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-inner transition-colors ${
              isHoldActive ? 'border-amber-400 bg-amber-950/20' : 'border-amber-500/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 bg-amber-500/20 border border-amber-400/50 rounded-lg text-center font-mono">
                <span className="block text-[9px] uppercase font-bold text-amber-400">
                  {measurementMode === 'contact_plane' ? 'Dip Direction' : 'Azimuth / Strike'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                  {String(Math.round(trueAzimuthDeg)).padStart(3, '0')}°
                </span>
              </div>
              <div className="text-xl font-bold text-slate-600">/</div>
              <div className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-400/50 rounded-lg text-center font-mono">
                <span className="block text-[9px] uppercase font-bold text-cyan-400">Dip Angle</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
                  {Math.round(dipDeg)}°
                </span>
              </div>
              <div className="hidden sm:block pl-2 border-l border-slate-800">
                <div className="text-[10px] text-slate-400 font-mono">
                  RHR Strike: <span className="font-bold text-slate-200">{String(Math.round(rhrStrikeDeg)).padStart(3, '0')}°</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Quadrant: <span className="font-bold text-slate-200">{quadrantStr}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Classification: <span className="font-bold text-cyan-300">{dipClassification}</span>
                </div>
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
            {/* Left: Authentic Brunton Dial with Interactive Pointer & Real-Time Needle */}
            <div className="relative flex flex-col items-center justify-center p-3 bg-slate-950 border border-slate-800 rounded-2xl select-none">
              <div
                ref={dialRef}
                onPointerDown={handleDialPointerDown}
                onPointerMove={handleDialPointerMove}
                onPointerUp={handleDialPointerUp}
                className="w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] relative rounded-full bg-stone-900 border-4 border-stone-700 shadow-[inset_0_4px_16px_rgba(0,0,0,0.9),0_8px_24px_rgba(0,0,0,0.7)] flex items-center justify-center select-none overflow-hidden cursor-crosshair touch-none"
                title="Authentic Brunton Pocket Transit: Drag to manually set azimuth or move device for real-time tracking"
              >
                {/* Brass Bezel Ring */}
                <div className="absolute inset-1 rounded-full border-2 border-amber-600/70 pointer-events-none" />

                {/* SIGHT Index Line at Top 0° (12 o'clock) */}
                <div className="absolute top-0 w-1.5 h-4 bg-amber-400 rounded-b shadow-[0_0_8px_#f59e0b] z-20 pointer-events-none" />
                <div className="absolute top-4 text-[9px] font-black text-amber-400 font-mono z-20 pointer-events-none tracking-wider">
                  SIGHT
                </div>

                {/* Compass Dial Face */}
                {/* In Authentic Brunton mode: The dial is fixed to housing; the needle rotates freely to Magnetic North.
                    In Traditional Brunton, E is printed at 9 o'clock (left) and W at 3 o'clock (right).
                    When sighting 90° East, the needle points to 9 o'clock, directly reading "E 90°"! */}
                <div
                  className="absolute inset-4 rounded-full flex items-center justify-center pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    transform: dialStyle === 'rotating_card' ? `rotate(${-azimuthDeg}deg)` : 'none',
                  }}
                >
                  {/* Dial Ticks (every 5° and 10°) */}
                  {Array.from({ length: 72 }).map((_, i) => {
                    const deg = i * 5;
                    const isMajor = deg % 30 === 0;
                    const isCardinal = deg % 90 === 0;
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
                            isCardinal ? 'h-3 bg-white' : isMajor ? 'h-2 bg-amber-400' : 'h-1.5 bg-slate-600'
                          }`}
                        />
                      </div>
                    );
                  })}

                  {/* Cardinal Labels */}
                  <span className="absolute top-2.5 text-xs font-black text-rose-400 font-mono">N</span>
                  <span className="absolute bottom-2.5 text-xs font-black text-slate-300 font-mono">S</span>
                  <span className="absolute right-2.5 text-xs font-black text-slate-300 font-mono">
                    {reverseBruntonDial ? 'W' : 'E'}
                  </span>
                  <span className="absolute left-2.5 text-xs font-black text-slate-300 font-mono">
                    {reverseBruntonDial ? 'E' : 'W'}
                  </span>

                  {/* Degree Numbers around dial */}
                  {[30, 60, 120, 150, 210, 240, 300, 330].map((d) => (
                    <div
                      key={`num-${d}`}
                      className="absolute text-[8px] font-mono text-slate-400 font-bold pointer-events-none"
                      style={{
                        transform: `rotate(${d}deg) translateY(-100px) rotate(${-d}deg)`,
                      }}
                    >
                      {d}
                    </div>
                  ))}

                  {/* Internal Clinometer Arc */}
                  <div className="absolute inset-10 rounded-full border border-dashed border-cyan-500/20 pointer-events-none" />
                </div>

                {/* Sapphire Pivot Jewel */}
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 border-2 border-white shadow-lg z-20 pointer-events-none" />

                {/* MAGNETIC NEEDLE:
                    In Authentic Brunton mode: needle rotates by -azimuthDeg to point to Magnetic North!
                    In Rotating Card mode: needle is aligned with sight index at 0° or points north */}
                <div
                  className="absolute w-3 h-[82%] pointer-events-none z-10 transition-transform duration-100 ease-out flex flex-col justify-between items-center"
                  style={{
                    transform:
                      dialStyle === 'authentic_brunton'
                        ? `rotate(${-azimuthDeg}deg)`
                        : 'rotate(0deg)',
                  }}
                >
                  {/* North Needle Tip: Red with fluorescent pointer */}
                  <div className="flex flex-col items-center">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[50px] border-b-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.9)]" />
                    <span className="text-[7.5px] font-black text-rose-200 font-mono -mt-6">N</span>
                  </div>
                  {/* South Needle Tip: White / Silver counterweight */}
                  <div className="flex flex-col items-center">
                    <span className="text-[7.5px] font-black text-slate-800 font-mono -mb-6">S</span>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[50px] border-t-slate-200 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
                  </div>
                </div>

                {/* Bullseye Spirit Level (Bottom-Right) - Live Bubble tracks pitch & roll */}
                <div
                  className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-emerald-950/90 border-2 border-emerald-400/80 flex items-center justify-center shadow-inner z-20 pointer-events-none"
                  title="Bullseye Level: Keep bubble centered for precise horizontal azimuth"
                >
                  <div className="relative w-8 h-8 rounded-full border border-dashed border-emerald-300/40 flex items-center justify-center">
                    {/* Target Crosshair */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-[1px] bg-emerald-500/30" />
                      <div className="h-full w-[1px] bg-emerald-500/30 absolute" />
                    </div>
                    {/* Center Ring */}
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-300/70" />
                    {/* Spirit Bubble */}
                    <div
                      className={`w-3 h-3 rounded-full transition-transform duration-75 ${
                        isLevel
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                          : 'bg-emerald-500/80 shadow-[0_0_4px_#10b981]'
                      }`}
                      style={{
                        transform: `translate(${bubbleX}px, ${bubbleY}px)`,
                      }}
                    />
                  </div>
                </div>

                {/* Clinometer Indicator (Bottom-Left) */}
                <div
                  className="absolute bottom-5 left-5 px-2 py-1 rounded bg-cyan-950/90 border border-cyan-400/80 text-[9px] font-mono text-cyan-300 font-bold z-20 pointer-events-none shadow"
                  title="Clinometer Dip Indicator"
                >
                  CLINO: {Math.round(dipDeg)}°
                </div>
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

            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-end text-xs shrink-0">
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
