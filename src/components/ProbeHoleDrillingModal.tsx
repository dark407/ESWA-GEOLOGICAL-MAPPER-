import React, { useState, useMemo, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Crosshair,
  Download,
  Droplets,
  FileText,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Sliders,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_JUMBO_CALIBRATION,
  JumboRigCalibration,
  Point3DTunnel,
  ProbeHoleRecord,
  ProbeRunInterval,
  buildSampleProbeHoles,
  computeHole3DPointAtDepth,
  computeMwdProfileForHole,
  evaluateProbeFanLookAhead,
  loadSavedProbeHoles,
  saveProbeHolesToStorage,
} from '../engine/probeHoleAndGroutingEngine';

export interface ProbeHoleDrillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectName?: string;
  defaultTunnelName?: string;
  defaultFaceChainage?: string;
  defaultLoggedBy?: string;
  tunnelWidthMeters?: number;
  tunnelHeightMeters?: number;
  onOpenGroutingWindow?: () => void;
}

type FanViewProjection = 'ISOMETRIC_3D' | 'LONGITUDINAL_ZY' | 'PLAN_ZX';
type FanColorCodingMode = 'HAZARD_AND_RQD' | 'DSE_ENERGY' | 'WATER_LUGEON' | 'BARTON_Q';

export const ProbeHoleDrillingModal: React.FC<ProbeHoleDrillingModalProps> = ({
  isOpen,
  onClose,
  defaultProjectName = 'Himalayan Hydro Headrace Tunnel',
  defaultTunnelName = 'Headrace Tunnel (HRT-01)',
  defaultFaceChainage = 'CH 12+450.50 m',
  defaultLoggedBy = 'Senior Tunnel Geologist',
  tunnelWidthMeters = 8.5,
  tunnelHeightMeters = 8.5,
  onOpenGroutingWindow,
}) => {
  const [holes, setHoles] = useState<ProbeHoleRecord[]>(() =>
    loadSavedProbeHoles()
  );
  const [selectedHoleId, setSelectedHoleId] = useState<string>(() => {
    const initial = loadSavedProbeHoles();
    return initial[0]?.id || 'ph-sample-1';
  });
  const [activeTab, setActiveTab] = useState<
    'SIMPLE_LOGGING' | 'ADVANCED_MWD_AND_3D'
  >('SIMPLE_LOGGING');
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);

  // Rig Calibration State for Accurate Teale (1965) / Schunnesson (1998) MWD
  const [rigCalibration, setRigCalibration] = useState<JumboRigCalibration>(
    () => ({ ...DEFAULT_JUMBO_CALIBRATION })
  );
  const [showRigCalibrationPanel, setShowRigCalibrationPanel] =
    useState<boolean>(false);

  // Interactive Crosshair Scrubber Depth (m) along active probe hole
  const [scrubDepthMeters, setScrubDepthMeters] = useState<number>(14.5);

  // 3D Probe Fan Viewport Camera & Color Mode State
  const [fanProjection, setFanProjection] =
    useState<FanViewProjection>('ISOMETRIC_3D');
  const [fanColorMode, setFanColorMode] =
    useState<FanColorCodingMode>('HAZARD_AND_RQD');
  const [camYawDeg, setCamYawDeg] = useState<number>(-32);
  const [camPitchDeg, setCamPitchDeg] = useState<number>(22);
  const [isOrbiting3D, setIsOrbiting3D] = useState<boolean>(false);
  const orbitStartRef = useRef<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);

  const faceSvgRef = useRef<SVGSVGElement | null>(null);
  const mwdLogSvgRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingCollar, setIsDraggingCollar] = useState<boolean>(false);

  const activeHole = useMemo(
    () => holes.find((h) => h.id === selectedHoleId) || holes[0] || null,
    [holes, selectedHoleId]
  );

  const mwdProfile = useMemo(
    () =>
      activeHole
        ? computeMwdProfileForHole(
            activeHole,
            rigCalibration,
            tunnelWidthMeters,
            tunnelHeightMeters
          )
        : [],
    [activeHole, rigCalibration, tunnelWidthMeters, tunnelHeightMeters]
  );

  const fanSummary = useMemo(
    () =>
      evaluateProbeFanLookAhead(
        holes,
        rigCalibration,
        tunnelWidthMeters,
        tunnelHeightMeters
      ),
    [holes, rigCalibration, tunnelWidthMeters, tunnelHeightMeters]
  );

  // Currently scrubbed interval along active hole
  const scrubbedMwdInterval = useMemo(() => {
    if (mwdProfile.length === 0) return null;
    const found = mwdProfile.find(
      (m) => scrubDepthMeters >= m.fromMeters && scrubDepthMeters <= m.toMeters
    );
    return found || mwdProfile[mwdProfile.length - 1];
  }, [mwdProfile, scrubDepthMeters]);

  const scrubbedPoint3D = useMemo(() => {
    if (!activeHole) return { x: 0, y: 0, z: 0 };
    return computeHole3DPointAtDepth(activeHole, scrubDepthMeters);
  }, [activeHole, scrubDepthMeters]);

  if (!isOpen) return null;

  const updateHolesAndPersist = (nextHoles: ProbeHoleRecord[]) => {
    setHoles(nextHoles);
    saveProbeHolesToStorage(nextHoles);
  };

  const handleUpdateActiveHole = (patch: Partial<ProbeHoleRecord>) => {
    if (!activeHole) return;
    const next = holes.map((h) =>
      h.id === activeHole.id
        ? { ...h, ...patch, updatedAt: new Date().toISOString() }
        : h
    );
    updateHolesAndPersist(next);
  };

  const handleAddProbeHole = () => {
    const nextIdx = holes.length + 1;
    const today = new Date().toISOString().slice(0, 10);
    const newHole: ProbeHoleRecord = {
      id: `ph-${Date.now()}`,
      holeId: `PH-0${nextIdx} (Face Probe)`,
      projectName: activeHole?.projectName || defaultProjectName,
      tunnelName: activeHole?.tunnelName || defaultTunnelName,
      faceChainage: activeHole?.faceChainage || defaultFaceChainage,
      date: today,
      loggedBy: activeHole?.loggedBy || defaultLoggedBy,
      positionLabel: 'Face Center',
      collarX: 0,
      collarY: Number((tunnelHeightMeters * 0.55).toFixed(2)),
      holeDiameterMm: 76,
      totalLengthMeters: 24,
      overlapLengthMeters: 5,
      azimuthDeg: 42,
      lookOutAngleDeg: 5,
      dipAngleDeg: 5,
      updatedAt: new Date().toISOString(),
      intervals: [
        {
          id: `int-${Date.now()}-1`,
          fromMeters: 0,
          toMeters: 6,
          ropMetersPerMin: 0.9,
          feedPressureBar: 65,
          rotationPressureBar: 52,
          flushWaterColor: 'Clear',
          waterInflowLMin: 4,
          waterPressureBar: 0.5,
          estimatedRqdPct: 80,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Competent rock mass ahead of face.',
        },
        {
          id: `int-${Date.now()}-2`,
          fromMeters: 6,
          toMeters: 15,
          ropMetersPerMin: 1.1,
          feedPressureBar: 60,
          rotationPressureBar: 48,
          flushWaterColor: 'Slightly Milky',
          waterInflowLMin: 9,
          waterPressureBar: 1.1,
          estimatedRqdPct: 72,
          rockMassClass: 'Class III (Fair)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Moderately jointed rock, minor seepage.',
        },
        {
          id: `int-${Date.now()}-3`,
          fromMeters: 15,
          toMeters: 24,
          ropMetersPerMin: 0.95,
          feedPressureBar: 64,
          rotationPressureBar: 50,
          flushWaterColor: 'Clear',
          waterInflowLMin: 5,
          waterPressureBar: 0.8,
          estimatedRqdPct: 78,
          rockMassClass: 'Class II (Good)',
          cavityOrFaultDetected: false,
          geologicalRemarks: 'Fresh blocky rock to end of hole.',
        },
      ],
    };
    const next = [...holes, newHole];
    updateHolesAndPersist(next);
    setSelectedHoleId(newHole.id);
  };

  const handleDeleteActiveHole = () => {
    if (!activeHole || holes.length <= 1) return;
    const next = holes.filter((h) => h.id !== activeHole.id);
    updateHolesAndPersist(next);
    setSelectedHoleId(next[0].id);
  };

  const handleAddInterval = () => {
    if (!activeHole) return;
    const last = activeHole.intervals[activeHole.intervals.length - 1];
    const fromM = last ? last.toMeters : 0;
    const toM = Number((fromM + 6).toFixed(1));
    const newIntv: ProbeRunInterval = {
      id: `int-${Date.now()}`,
      fromMeters: fromM,
      toMeters: toM,
      ropMetersPerMin: 1.0,
      feedPressureBar: 62,
      rotationPressureBar: 50,
      flushWaterColor: 'Clear',
      waterInflowLMin: 5,
      waterPressureBar: 0.8,
      estimatedRqdPct: 75,
      rockMassClass: 'Class II (Good)',
      cavityOrFaultDetected: false,
      geologicalRemarks: 'Logged probe interval.',
    };
    const nextIntervals = [...activeHole.intervals, newIntv];
    handleUpdateActiveHole({
      intervals: nextIntervals,
      totalLengthMeters: Math.max(activeHole.totalLengthMeters, toM),
    });
  };

  const handleUpdateInterval = (
    intvId: string,
    patch: Partial<ProbeRunInterval>
  ) => {
    if (!activeHole) return;
    const nextIntervals = activeHole.intervals.map((item) =>
      item.id === intvId ? { ...item, ...patch } : item
    );
    const maxTo = nextIntervals.reduce(
      (acc, i) => Math.max(acc, i.toMeters),
      activeHole.totalLengthMeters
    );
    handleUpdateActiveHole({
      intervals: nextIntervals,
      totalLengthMeters: maxTo,
    });
  };

  const handleRemoveInterval = (intvId: string) => {
    if (!activeHole || activeHole.intervals.length <= 1) return;
    const nextIntervals = activeHole.intervals.filter((i) => i.id !== intvId);
    handleUpdateActiveHole({ intervals: nextIntervals });
  };

  const handleLoadSampleFan = () => {
    const sample = buildSampleProbeHoles(
      defaultProjectName,
      defaultTunnelName,
      defaultFaceChainage
    );
    updateHolesAndPersist(sample);
    setSelectedHoleId(sample[0].id);
  };

  // Interactive Tunnel Face Collar placement handler
  const updateCollarFromPointer = (clientX: number, clientY: number) => {
    if (!faceSvgRef.current || !activeHole) return;
    const rect = faceSvgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const halfW = tunnelWidthMeters / 2;
    const rawX = (normX - 0.5) * (tunnelWidthMeters * 1.15);
    const rawY = (1 - normY) * (tunnelHeightMeters * 1.15);

    const clampedX = Number(
      Math.max(-halfW * 0.92, Math.min(halfW * 0.92, rawX)).toFixed(2)
    );
    const clampedY = Number(
      Math.max(0.4, Math.min(tunnelHeightMeters * 0.95, rawY)).toFixed(2)
    );

    let posLabel: ProbeHoleRecord['positionLabel'] = 'Face Center';
    if (clampedY > tunnelHeightMeters * 0.75) posLabel = 'Crown Arch';
    else if (clampedX < -halfW * 0.35)
      posLabel =
        clampedY < tunnelHeightMeters * 0.3
          ? 'Left Invert'
          : 'Left Wall / Springline';
    else if (clampedX > halfW * 0.35)
      posLabel =
        clampedY < tunnelHeightMeters * 0.3
          ? 'Right Invert'
          : 'Right Wall / Springline';

    handleUpdateActiveHole({
      collarX: clampedX,
      collarY: clampedY,
      positionLabel: posLabel,
    });
  };

  // Interactive Depth Scrubber on Multi-Channel MWD Well Log SVG
  const updateScrubDepthFromPointer = (clientX: number) => {
    if (!mwdLogSvgRef.current || !activeHole) return;
    const rect = mwdLogSvgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * 760;
    const plotLeft = 56;
    const plotWidth = 684;
    const norm = Math.max(0, Math.min(1, (svgX - plotLeft) / plotWidth));
    const maxD = Math.max(10, activeHole.totalLengthMeters);
    setScrubDepthMeters(Number((norm * maxD).toFixed(1)));
  };

  const handleExportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            rigCalibration,
            holes,
            fanSummary,
            activeHoleMwdProfile: mwdProfile,
          },
          null,
          2
        ),
      ],
      {
        type: 'application/json',
      }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NATM_Probe_Holes_${(activeHole?.faceChainage || 'CH').replace(
      /\s+/g,
      '_'
    )}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 3D Projection Helper for the Interactive 3D Look-Ahead Probe Fan Viewport
  const projectTunnel3DPoint = (pt: Point3DTunnel): { sx: number; sy: number } => {
    // Tunnel coordinate space:
    // X in [-W/2, +W/2], Y in [0, H], Z in [-6, +28]
    const centerZ = 11.0;
    const centerY = tunnelHeightMeters * 0.5;
    const dx = pt.x;
    const dy = pt.y - centerY;
    const dz = pt.z - centerZ;

    if (fanProjection === 'LONGITUDINAL_ZY') {
      // Side elevation: Z -> horizontal, Y -> vertical
      return {
        sx: 115 + (pt.z / 28) * 485,
        sy: 162 - (pt.y / Math.max(1, tunnelHeightMeters)) * 118,
      };
    }
    if (fanProjection === 'PLAN_ZX') {
      // Top-down plan view: Z -> horizontal, X -> vertical
      return {
        sx: 115 + (pt.z / 28) * 485,
        sy: 105 + (pt.x / Math.max(1, tunnelWidthMeters)) * 115,
      };
    }

    // ISOMETRIC_3D with interactive Yaw & Pitch rotation
    const yawRad = (camYawDeg * Math.PI) / 180;
    const pitchRad = (camPitchDeg * Math.PI) / 180;

    // Rotate around vertical Y-axis by yaw (Z is forward along tunnel axis, X is lateral)
    const rx = dx * Math.cos(yawRad) + dz * Math.sin(yawRad);
    const rz = -dx * Math.sin(yawRad) + dz * Math.cos(yawRad);

    // Rotate around X-axis by pitch
    const ry = dy * Math.cos(pitchRad) - rz * Math.sin(pitchRad);
    const depth = dy * Math.sin(pitchRad) + rz * Math.cos(pitchRad);

    const scale = 15.5 * (1 + depth * 0.006);
    return {
      sx: 335 + rx * scale,
      sy: 112 - ry * scale,
    };
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[1440px] max-h-[96dvh] bg-[#0B0E17] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* TOP HEADER BAR */}
        <div className="px-4 py-3 bg-[#07090E] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  NATM Probe Hole Drilling &amp; MWD Look-Ahead Geotechnical Workstation
                </h2>
                <span className="text-xs font-mono tabular-nums text-amber-300">
                  · {activeHole?.faceChainage || defaultFaceChainage}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Teale (1965) &amp; Schunnesson (1998) MWD Specific Energy · Moye/Goodman Hydrogeology · 3D Structural Plane Intersection
              </p>
            </div>
          </div>

          {/* MODE SWITCHER: SIMPLE vs ADVANCED + ACTIONS */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('SIMPLE_LOGGING');
                  setShowReportPreview(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'SIMPLE_LOGGING' && !showReportPreview
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                1. Simple &amp; Effective Logging
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ADVANCED_MWD_AND_3D');
                  setShowReportPreview(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'ADVANCED_MWD_AND_3D' && !showReportPreview
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                2. Advanced MWD, Hydrogeology &amp; 3D Fan Analysis
              </button>
            </div>

            {onOpenGroutingWindow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGroutingWindow();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Switch directly to Separate Grouting Window"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Open Grouting Window</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowReportPreview((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showReportPreview
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showReportPreview ? 'Back to Workspace' : 'Engineering Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleFan}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Reset / Load 3-Hole Himalayan Headrace Sample Probe Fan"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sample Fan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-600/80 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              title="Close Probe Hole Drilling Window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOP TELEMETRY RIBBON & SAFETY DECISION GATE */}
        <div
          className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            fanSummary.overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-100'
              : fanSummary.overallStatus === 'CAUTION_FRACTURED'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2.5 max-w-4xl">
            {fanSummary.overallStatus === 'SAFE_COMPETENT' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  fanSummary.overallStatus === 'HAZARD_HIGH_INFLOW_OR_CAVITY'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              />
            )}
            <span className="text-xs font-medium leading-snug">
              {fanSummary.engineeringRecommendation}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums shrink-0">
            <span>
              Safe Advance:{' '}
              <strong className="text-white">+{fanSummary.safeAdvanceLengthMeters} m</strong>
            </span>
            <span>·</span>
            <span>
              Fan Q:{' '}
              <strong className="text-cyan-300">{fanSummary.totalWaterInflowLMin} L/min</strong>
            </span>
            <span>·</span>
            <span>
              Goodman Tunnel Q:{' '}
              <strong className="text-sky-300">
                {fanSummary.predictedUnlinedTunnelInflowLMin} L/min/10m
              </strong>
            </span>
            <span>·</span>
            <span>
              RMR₈₉ / Qₘᵢₙ:{' '}
              <strong className="text-amber-300">
                {fanSummary.averageRmr89} / {fanSummary.minimumBartonQ}
              </strong>
            </span>
            <span>·</span>
            <span>
              DSE / UCS:{' '}
              <strong className="text-emerald-300">
                {fanSummary.averageSpecificEnergyMjM3} MJ/m³ ({fanSummary.averageUcsMpa} MPa)
              </strong>
            </span>
          </div>
        </div>

        {/* MAIN SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* PROBE HOLE SELECTOR BAR */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {holes.map((h) => {
                const isSelected = activeHole?.id === h.id;
                const peakInflow = h.intervals.reduce(
                  (acc, i) => Math.max(acc, i.waterInflowLMin),
                  0
                );
                const hasCavity = h.intervals.some((i) => i.cavityOrFaultDetected);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHoleId(h.id)}
                    className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 text-white shadow-sm'
                        : 'bg-[#111827] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold flex items-center gap-1.5">
                        <span>{h.holeId}</span>
                        {hasCavity && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {h.positionLabel} · L={h.totalLengthMeters}m · Dip={h.dipAngleDeg}° · Q={peakInflow} L/min
                      </div>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddProbeHole}
                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Probe Hole</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'ADVANCED_MWD_AND_3D' && !showReportPreview && (
                <button
                  type="button"
                  onClick={() => setShowRigCalibrationPanel((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    showRigCalibrationPanel
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Jumbo Rig MWD Calibration</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Telemetry JSON</span>
              </button>

              {holes.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteActiveHole}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-mono text-rose-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Hole</span>
                </button>
              )}
            </div>
          </div>

          {/* COLLAPSIBLE JUMBO DRILL RIG MWD CALIBRATION DRAWER */}
          {showRigCalibrationPanel && activeTab === 'ADVANCED_MWD_AND_3D' && !showReportPreview && (
            <div className="bg-[#111827] border border-cyan-500/40 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-cyan-300">
                  Hydraulic Drilling Jumbo MWD Calibration Constants (Teale 1965 &amp; Schunnesson 1998 Equations)
                </span>
                <button
                  type="button"
                  onClick={() => setRigCalibration({ ...DEFAULT_JUMBO_CALIBRATION })}
                  className="text-xs font-mono text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Reset Default Atlas Copco / Epiroc Boomer Constants
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
                <label className="space-y-1">
                  <span className="text-slate-400 block">Rotation Speed N (RPM)</span>
                  <input
                    type="number"
                    step="5"
                    value={rigCalibration.rotationalRpm}
                    onChange={(e) =>
                      setRigCalibration((prev) => ({
                        ...prev,
                        rotationalRpm: Math.max(40, parseFloat(e.target.value) || 160),
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Percussion Pressure (bar)</span>
                  <input
                    type="number"
                    step="5"
                    value={rigCalibration.percussionPressureBar}
                    onChange={(e) =>
                      setRigCalibration((prev) => ({
                        ...prev,
                        percussionPressureBar: Math.max(50, parseFloat(e.target.value) || 145),
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Thrust Factor (kN/bar)</span>
                  <input
                    type="number"
                    step="0.05"
                    value={rigCalibration.hydraulicThrustFactorKnPerBar}
                    onChange={(e) =>
                      setRigCalibration((prev) => ({
                        ...prev,
                        hydraulicThrustFactorKnPerBar: Math.max(
                          0.1,
                          parseFloat(e.target.value) || 0.85
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Torque Factor (Nm/bar)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={rigCalibration.hydraulicTorqueFactorNmPerBar}
                    onChange={(e) =>
                      setRigCalibration((prev) => ({
                        ...prev,
                        hydraulicTorqueFactorNmPerBar: Math.max(
                          1,
                          parseFloat(e.target.value) || 14.5
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400 block">Drifter Transfer Efficiency η</span>
                  <input
                    type="number"
                    step="0.02"
                    min="0.3"
                    max="0.95"
                    value={rigCalibration.drifterEfficiency}
                    onChange={(e) =>
                      setRigCalibration((prev) => ({
                        ...prev,
                        drifterEfficiency: Math.min(
                          0.95,
                          Math.max(0.3, parseFloat(e.target.value) || 0.72)
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {/* PRINTABLE ENGINEERING REPORT PREVIEW */}
          {showReportPreview && activeHole ? (
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-5 max-w-6xl mx-auto">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-bold">
                    NATM Forward Probe Drilling, MWD Specific Energy &amp; 3D Look-Ahead Geotechnical Report
                  </div>
                  <h3 className="text-xl font-black text-slate-950 mt-0.5">
                    {activeHole.projectName} — {activeHole.tunnelName}
                  </h3>
                  <div className="text-xs font-mono text-slate-700 mt-1">
                    Face Chainage: <strong>{activeHole.faceChainage}</strong> · Date:{' '}
                    <strong>{activeHole.date}</strong> · Logged By:{' '}
                    <strong>{activeHole.loggedBy}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer print:hidden"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF Report</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono tabular-nums bg-slate-100 p-3.5 rounded-xl border border-slate-300">
                <div>
                  <span className="text-slate-500 block">Overall Look-Ahead Status</span>
                  <strong className="text-slate-950 text-sm">
                    {fanSummary.overallStatus.replace(/_/g, ' ')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Safe Advance Limit</span>
                  <strong className="text-emerald-700 text-sm">
                    +{fanSummary.safeAdvanceLengthMeters} m (Max Round {fanSummary.recommendedMaxRoundLengthM} m)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Fan / Goodman Tunnel Inflow</span>
                  <strong className="text-sky-700 text-sm">
                    {fanSummary.totalWaterInflowLMin} L/m · {fanSummary.predictedUnlinedTunnelInflowLMin} L/m/10m
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Mean DSE &amp; UCS_MWD</span>
                  <strong className="text-slate-900 text-sm">
                    {fanSummary.averageSpecificEnergyMjM3} MJ/m³ · {fanSummary.averageUcsMpa} MPa
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Synthesized RMR₈₉ / Q_min / GSI</span>
                  <strong className="text-slate-900 text-sm">
                    {fanSummary.averageRmr89} / {fanSummary.minimumBartonQ} / {fanSummary.averageGsi}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">3D Fault Plane Crown/Center</span>
                  <strong className="text-rose-700 text-sm">
                    {fanSummary.faultPlane3D.detected
                      ? `+${fanSummary.faultPlane3D.crownIntersectionAheadM}m / +${fanSummary.faultPlane3D.centerIntersectionAheadM}m (Dip ${fanSummary.faultPlane3D.apparentDipDeg}°)`
                      : 'None Detected'}
                  </strong>
                </div>
              </div>

              {holes.map((hole) => {
                const holeMwd = computeMwdProfileForHole(
                  hole,
                  rigCalibration,
                  tunnelWidthMeters,
                  tunnelHeightMeters
                );
                return (
                  <div
                    key={hole.id}
                    className="space-y-2 border border-slate-300 rounded-xl p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <strong className="text-sm font-mono text-slate-900">
                        {hole.holeId} — {hole.positionLabel} (Collar X={hole.collarX}m, Y={hole.collarY}m)
                      </strong>
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        Ø {hole.holeDiameterMm}mm · Length {hole.totalLengthMeters}m · Overlap{' '}
                        {hole.overlapLengthMeters}m · Look-Out {hole.lookOutAngleDeg}° · Dip{' '}
                        {hole.dipAngleDeg}°
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-700">
                          <th className="py-1.5 px-1.5">Depth (m)</th>
                          <th className="py-1.5 px-1.5">3D Ahead (+Z m)</th>
                          <th className="py-1.5 px-1.5">ROP (m/min)</th>
                          <th className="py-1.5 px-1.5">Feed/Rot (bar)</th>
                          <th className="py-1.5 px-1.5">DSE (MJ/m³)</th>
                          <th className="py-1.5 px-1.5">UCS (MPa)</th>
                          <th className="py-1.5 px-1.5">F_I / RQD</th>
                          <th className="py-1.5 px-1.5">RMR₈₉ / Q</th>
                          <th className="py-1.5 px-1.5">Q_w / Lu_eq</th>
                          <th className="py-1.5 px-1.5">K (m/s)</th>
                          <th className="py-1.5 px-1.5">Geological &amp; Support Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hole.intervals.map((intv, idx) => {
                          const m = holeMwd[idx];
                          return (
                            <tr
                              key={intv.id}
                              className={`border-b border-slate-200 ${
                                m?.isHazardZone ? 'bg-rose-50 font-semibold' : ''
                              }`}
                            >
                              <td className="py-1.5 px-1.5">
                                {intv.fromMeters.toFixed(1)}–{intv.toMeters.toFixed(1)}
                              </td>
                              <td className="py-1.5 px-1.5">
                                +{m?.startXYZ.z.toFixed(1)}–{m?.endXYZ.z.toFixed(1)}
                              </td>
                              <td className="py-1.5 px-1.5">
                                {intv.ropMetersPerMin.toFixed(2)}
                              </td>
                              <td className="py-1.5 px-1.5">
                                {intv.feedPressureBar}/{intv.rotationPressureBar}
                              </td>
                              <td className="py-1.5 px-1.5">{m?.specificEnergyMjPerM3}</td>
                              <td className="py-1.5 px-1.5">{m?.estimatedUcsMpa}</td>
                              <td className="py-1.5 px-1.5">
                                {m?.fractureIndex} / {intv.estimatedRqdPct}%
                              </td>
                              <td className="py-1.5 px-1.5">
                                {m?.estimatedRmr89} / {m?.estimatedBartonQ}
                              </td>
                              <td className="py-1.5 px-1.5">
                                {intv.waterInflowLMin} L/m ({m?.equivalentLugeon} Lu)
                              </td>
                              <td className="py-1.5 px-1.5">
                                {m?.hydraulicConductivityMPerSec}
                              </td>
                              <td className="py-1.5 px-1.5">{intv.geologicalRemarks}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-slate-800 space-y-1">
                <div>
                  <strong>Recommended NATM Support Class:</strong>{' '}
                  {fanSummary.recommendedSupportClass}
                </div>
                <div>
                  <strong>Engineering Decision &amp; Sign-Off Recommendation:</strong>{' '}
                  {fanSummary.engineeringRecommendation}
                </div>
              </div>
            </div>
          ) : activeTab === 'SIMPLE_LOGGING' && activeHole ? (
            /* ============================================================================
               MODE 1: SIMPLE & EFFECTIVE FIELD LOGGING
               ============================================================================ */
            <div className="space-y-4">
              {/* HOLE COLLAR & DRILLING SETUP PARAMETERS */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                    Probe Hole Collar &amp; Setup Parameters
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    Mandatory Overlap: {activeHole.overlapLengthMeters} m · Effective Horizontal Reach:{' '}
                    {(
                      activeHole.totalLengthMeters *
                      Math.cos(((activeHole.dipAngleDeg || 0) * Math.PI) / 180)
                    ).toFixed(1)}{' '}
                    m
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-slate-400 font-medium block">Probe Hole ID</span>
                    <input
                      type="text"
                      value={activeHole.holeId}
                      onChange={(e) => handleUpdateActiveHole({ holeId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Face Position</span>
                    <select
                      value={activeHole.positionLabel}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          positionLabel:
                            e.target.value as ProbeHoleRecord['positionLabel'],
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
                    >
                      <option value="Crown Arch">Crown Arch</option>
                      <option value="Face Center">Face Center</option>
                      <option value="Left Wall / Springline">Left Wall / Springline</option>
                      <option value="Right Wall / Springline">
                        Right Wall / Springline
                      </option>
                      <option value="Left Invert">Left Invert</option>
                      <option value="Right Invert">Right Invert</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Face Chainage</span>
                    <input
                      type="text"
                      value={activeHole.faceChainage}
                      onChange={(e) =>
                        handleUpdateActiveHole({ faceChainage: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Hole Length (m)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={activeHole.totalLengthMeters}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          totalLengthMeters: Math.max(
                            1,
                            parseFloat(e.target.value) || 20
                          ),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono tabular-nums text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Bit Ø (mm)</span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.holeDiameterMm}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          holeDiameterMm: Math.max(
                            38,
                            parseFloat(e.target.value) || 76
                          ),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono tabular-nums text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">Look-Out (°)</span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.lookOutAngleDeg}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          lookOutAngleDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono tabular-nums text-white"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 font-medium block">
                      Inclination Dip (°)
                    </span>
                    <input
                      type="number"
                      step="1"
                      value={activeHole.dipAngleDeg}
                      onChange={(e) =>
                        handleUpdateActiveHole({
                          dipAngleDeg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono tabular-nums text-white"
                    />
                  </label>
                </div>
              </div>

              {/* RUN-BY-RUN DEPTH INTERVAL FIELD LOGGING TABLE */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                      Simple &amp; Effective Depth Interval Log (ROP, Pressures, Water Inflow, RQD &amp; Rock Class)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Record drilling penetration rate, feed/rotation pressure, water ingress, static pressure, and rock mass quality along the probe hole.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddInterval}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Depth Run</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/70">
                        <th className="py-2 px-2">From (m)</th>
                        <th className="py-2 px-2">To (m)</th>
                        <th className="py-2 px-2">ROP (m/min)</th>
                        <th className="py-2 px-2">Feed (bar)</th>
                        <th className="py-2 px-2">Rot (bar)</th>
                        <th className="py-2 px-2">Flush Return</th>
                        <th className="py-2 px-2">Water (L/min)</th>
                        <th className="py-2 px-2">P_w (bar)</th>
                        <th className="py-2 px-2">Est. RQD (%)</th>
                        <th className="py-2 px-2">Rock Class</th>
                        <th className="py-2 px-2">Cavity/Fault</th>
                        <th className="py-2 px-2 min-w-[180px]">Geological Notes</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHole.intervals.map((intv, idx) => {
                        const mwd = mwdProfile[idx];
                        return (
                          <tr
                            key={intv.id}
                            className={`border-b border-slate-800/80 ${
                              mwd?.isHazardZone
                                ? 'bg-rose-950/30'
                                : 'hover:bg-slate-900/40'
                            }`}
                          >
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={intv.fromMeters}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    fromMeters: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-15 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.5"
                                value={intv.toMeters}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    toMeters: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-15 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.05"
                                value={intv.ropMetersPerMin}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    ropMetersPerMin:
                                      parseFloat(e.target.value) || 0.1,
                                  })
                                }
                                className={`w-16 px-1.5 py-1 rounded bg-slate-950 border font-bold ${
                                  intv.ropMetersPerMin >= 1.95
                                    ? 'border-rose-500 text-rose-300'
                                    : 'border-slate-700 text-amber-300'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={intv.feedPressureBar}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    feedPressureBar:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-15 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={intv.rotationPressureBar}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    rotationPressureBar:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-15 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={intv.flushWaterColor}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    flushWaterColor:
                                      e.target.value as ProbeRunInterval['flushWaterColor'],
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              >
                                <option value="Clear">Clear</option>
                                <option value="Slightly Milky">Slightly Milky</option>
                                <option value="Muddy Brown">Muddy Brown</option>
                                <option value="Red/Ochre">Red/Ochre</option>
                                <option value="Black/Graphitic">Black/Graphitic</option>
                                <option value="Total Water Loss">Total Water Loss</option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                value={intv.waterInflowLMin}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    waterInflowLMin:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className={`w-15 px-1.5 py-1 rounded bg-slate-950 border font-bold ${
                                  intv.waterInflowLMin >= 25
                                    ? 'border-cyan-400 text-cyan-300'
                                    : 'border-slate-700 text-white'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.2"
                                value={intv.waterPressureBar}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    waterPressureBar:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-14 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-sky-300"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={intv.estimatedRqdPct}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    estimatedRqdPct: Math.min(
                                      100,
                                      Math.max(0, parseFloat(e.target.value) || 0)
                                    ),
                                  })
                                }
                                className="w-15 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-emerald-300 font-bold"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <select
                                value={intv.rockMassClass}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    rockMassClass:
                                      e.target.value as ProbeRunInterval['rockMassClass'],
                                  })
                                }
                                className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                              >
                                <option value="Class I (Very Good)">
                                  Class I (Very Good)
                                </option>
                                <option value="Class II (Good)">Class II (Good)</option>
                                <option value="Class III (Fair)">Class III (Fair)</option>
                                <option value="Class IV (Poor)">Class IV (Poor)</option>
                                <option value="Class V (Shear/Fault)">
                                  Class V (Shear/Fault)
                                </option>
                              </select>
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={intv.cavityOrFaultDetected}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    cavityOrFaultDetected: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 accent-rose-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              <input
                                type="text"
                                value={intv.geologicalRemarks}
                                onChange={(e) =>
                                  handleUpdateInterval(intv.id, {
                                    geologicalRemarks: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200"
                              />
                            </td>
                            <td className="py-2 px-1.5">
                              {activeHole.intervals.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInterval(intv.id)}
                                  className="p-1 rounded hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 cursor-pointer"
                                  title="Remove Interval"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VISUAL STRIP PROFILE OF ACTIVE PROBE HOLE */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-300 uppercase">
                    Visual Look-Ahead Strip Profile — {activeHole.holeId} (0 m to{' '}
                    {activeHole.totalLengthMeters} m)
                  </span>
                  <span className="text-slate-400">
                    Green = Competent · Amber = Fractured · Red = Shear / High Water Hazard
                  </span>
                </div>
                <div className="w-full h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex">
                  {activeHole.intervals.map((intv, idx) => {
                    const m = mwdProfile[idx];
                    const span = Math.max(0.5, intv.toMeters - intv.fromMeters);
                    const widthPct =
                      (span / Math.max(1, activeHole.totalLengthMeters)) * 100;
                    const bgClass = m?.isHazardZone
                      ? 'bg-rose-600/80 border-r border-rose-400'
                      : intv.estimatedRqdPct < 60
                      ? 'bg-amber-600/75 border-r border-amber-400'
                      : 'bg-emerald-600/75 border-r border-emerald-400';
                    return (
                      <div
                        key={intv.id}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full flex flex-col items-center justify-center px-1 text-[10px] font-mono tabular-nums text-white truncate ${bgClass}`}
                        title={`${intv.fromMeters}–${intv.toMeters}m: RQD ${intv.estimatedRqdPct}%, Q=${intv.waterInflowLMin} L/min, ROP=${intv.ropMetersPerMin} m/min`}
                      >
                        <span className="font-bold">
                          {intv.fromMeters}–{intv.toMeters}m
                        </span>
                        <span>
                          RQD {intv.estimatedRqdPct}% · {intv.waterInflowLMin}L/m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================================
               MODE 2: PROFESSIONAL ADVANCED MWD, HYDROGEOLOGY & 3D PROBE FAN WORKSTATION
               ============================================================================ */
            activeHole && (
              <div className="space-y-4">
                {/* 1. QUANTITATIVE ENGINEERING TELEMETRY MATRIX (6-METRIC SCIENTIFIC READOUT) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Teale Specific Energy
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-bold tabular-nums text-cyan-300">
                        {fanSummary.averageSpecificEnergyMjM3}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        MJ/m³
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      Correlated UCS: {fanSummary.averageUcsMpa} MPa
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Synthesized RMR₈₉ / GSI
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-bold tabular-nums text-amber-300">
                        {fanSummary.averageRmr89}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        / 100 (GSI {fanSummary.averageGsi})
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      Min Barton Q: {fanSummary.minimumBartonQ}
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Goodman Tunnel Inflow
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-bold tabular-nums text-sky-300">
                        {fanSummary.predictedUnlinedTunnelInflowLMin}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        L/min/10m
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      Peak Lu_eq: {fanSummary.maxEquivalentLugeon} Lu · H_w: {fanSummary.maxPiezometricHeadMeters}m
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      3D Fault Intersection
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span
                        className={`text-2xl font-mono font-bold tabular-nums ${
                          fanSummary.faultPlane3D.detected
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {fanSummary.faultPlane3D.detected
                          ? `+${fanSummary.faultPlane3D.centerIntersectionAheadM}`
                          : 'CLEAR'}
                      </span>
                      {fanSummary.faultPlane3D.detected && (
                        <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                          m (Center)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      {fanSummary.faultPlane3D.detected
                        ? `Crown +${fanSummary.faultPlane3D.crownIntersectionAheadM}m · Dip ${fanSummary.faultPlane3D.apparentDipDeg}°`
                        : 'No shear plane in probe fan'}
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Safe Advance Gate
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span className="text-2xl font-mono font-bold tabular-nums text-emerald-400">
                        +{fanSummary.safeAdvanceLengthMeters}
                      </span>
                      <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">
                        m
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      Max Round: {fanSummary.recommendedMaxRoundLengthM}m · Overlap: {fanSummary.mandatoryOverlapMeters}m
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Pre-Grouting Trigger
                    </div>
                    <div className="mt-1 flex items-baseline">
                      <span
                        className={`text-lg font-mono font-bold tabular-nums ${
                          fanSummary.preGroutingTriggerActive
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {fanSummary.preGroutingTriggerActive
                          ? '▲ MANDATORY'
                          : '● NOT REQUIRED'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                      Perimeter Coverage: {fanSummary.fanPerimeterCoveragePct}%
                    </div>
                  </div>
                </div>

                {/* 2. SYNCHRONIZED 4-TRACK MWD GEOPHYSICAL BOREHOLE LOG WITH INTERACTIVE CROSSHAIR SCRUBBER */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <div>
                        <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-300 block">
                          Multi-Channel MWD Geophysical Borehole Telemetry Log — {activeHole.holeId}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Click or drag crosshair across depth (0.0 m – {activeHole.totalLengthMeters.toFixed(1)} m) to inspect Teale DSE components, UCS, Schunnesson Fracturing Index F_I, Barton Q &amp; Moye Permeability K
                        </span>
                      </div>
                    </div>

                    {/* Interactive Depth Scrubber Slider */}
                    <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono tabular-nums">
                      <span className="text-slate-400">Probe Depth Scrubber:</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(10, activeHole.totalLengthMeters)}
                        step={0.2}
                        value={scrubDepthMeters}
                        onChange={(e) => setScrubDepthMeters(parseFloat(e.target.value) || 0)}
                        className="w-32 accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-cyan-300 font-bold w-14 text-right">
                        {scrubDepthMeters.toFixed(1)} m
                      </span>
                    </div>
                  </div>

                  {/* LIVE CROSSHAIR TELEMETRY READOUT STRIP */}
                  {scrubbedMwdInterval && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono tabular-nums">
                      <div>
                        <span className="text-slate-500 block">3D Position (X, Y, +Z)</span>
                        <strong className="text-white">
                          ({scrubbedPoint3D.x}m, {scrubbedPoint3D.y}m, +{scrubbedPoint3D.z}m)
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ROP / Norm. NPR</span>
                        <strong className="text-amber-300">
                          {scrubbedMwdInterval.ropMetersPerMin.toFixed(2)} m/min ({scrubbedMwdInterval.normalizedPenetrationRate})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Feed / Rot (T/F Ratio)</span>
                        <strong className="text-slate-200">
                          {scrubbedMwdInterval.feedPressureBar}/{scrubbedMwdInterval.rotationPressureBar} bar ({scrubbedMwdInterval.torqueToFeedRatio})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Teale DSE (e_t+e_r+e_p)</span>
                        <strong className="text-cyan-300">
                          {scrubbedMwdInterval.specificEnergyMjPerM3} MJ/m³
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Correlated UCS / DHI</span>
                        <strong className="text-emerald-300">
                          {scrubbedMwdInterval.estimatedUcsMpa} MPa (DHI {scrubbedMwdInterval.drillingHardnessIndex})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Fracture F_I / RQD</span>
                        <strong
                          className={
                            scrubbedMwdInterval.fractureIndex >= 55
                              ? 'text-rose-400'
                              : 'text-slate-200'
                          }
                        >
                          F_I={scrubbedMwdInterval.fractureIndex} · RQD {scrubbedMwdInterval.estimatedRqdPct}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">RMR₈₉ / Barton Q / GSI</span>
                        <strong className="text-amber-300">
                          {scrubbedMwdInterval.estimatedRmr89} / {scrubbedMwdInterval.estimatedBartonQ} / {scrubbedMwdInterval.estimatedGsi}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Lugeon / Moye K (m/s)</span>
                        <strong className="text-sky-300">
                          {scrubbedMwdInterval.equivalentLugeon} Lu · {scrubbedMwdInterval.hydraulicConductivityMPerSec}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* 4-TRACK SYNCHRONIZED WELL LOG SVG */}
                  <div className="w-full bg-[#07090E] rounded-xl border border-slate-800 p-2 select-none">
                    <svg
                      ref={mwdLogSvgRef}
                      viewBox="0 0 760 285"
                      className="w-full h-auto cursor-crosshair touch-none"
                      onPointerDown={(e) => updateScrubDepthFromPointer(e.clientX)}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) updateScrubDepthFromPointer(e.clientX);
                      }}
                    >
                      {/* 4 Track Background Bands */}
                      {[
                        {
                          idx: 0,
                          yTop: 14,
                          yBot: 68,
                          title: 'TRACK 1: ROP (m/min) & TORQUE/FEED',
                          color: '#F59E0B',
                        },
                        {
                          idx: 1,
                          yTop: 78,
                          yBot: 132,
                          title: 'TRACK 2: TEALE DSE (MJ/m³) & UCS (MPa)',
                          color: '#22D3EE',
                        },
                        {
                          idx: 2,
                          yTop: 142,
                          yBot: 196,
                          title: 'TRACK 3: FRACTURE INDEX F_I, RQD & RMR₈₉',
                          color: '#10B981',
                        },
                        {
                          idx: 3,
                          yTop: 206,
                          yBot: 260,
                          title: 'TRACK 4: INFLOW Q (L/m) & LUGEON (Lu)',
                          color: '#38BDF8',
                        },
                      ].map((trk) => (
                        <g key={trk.idx}>
                          <rect
                            x="56"
                            y={trk.yTop}
                            width="684"
                            height={trk.yBot - trk.yTop}
                            fill="#0B0E17"
                            stroke="#1E293B"
                            strokeWidth="1"
                          />
                          <line
                            x1="56"
                            y1={(trk.yTop + trk.yBot) * 0.5}
                            x2="740"
                            y2={(trk.yTop + trk.yBot) * 0.5}
                            stroke="#1E293B"
                            strokeDasharray="3 3"
                          />
                          <text
                            x="62"
                            y={trk.yTop + 11}
                            fill={trk.color}
                            fontSize="8.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {trk.title}
                          </text>
                        </g>
                      ))}

                      {/* Plot Intervals & Step/Continuous Telemetry Curves */}
                      {(() => {
                        const maxD = Math.max(10, activeHole.totalLengthMeters);
                        const xOf = (d: number) => 56 + (d / maxD) * 684;

                        const ropPts: string[] = [];
                        const tfPts: string[] = [];
                        const dsePts: string[] = [];
                        const ucsPts: string[] = [];
                        const fiPts: string[] = [];
                        const rmrPts: string[] = [];
                        const qWaterPts: string[] = [];
                        const luPts: string[] = [];

                        return (
                          <>
                            {mwdProfile.map((m) => {
                              const x1 = xOf(m.fromMeters);
                              const x2 = xOf(m.toMeters);
                              const xm = (x1 + x2) * 0.5;

                              // Track 1 (y: 14..68)
                              const yRop =
                                66 - Math.min(1, m.ropMetersPerMin / 3.2) * 48;
                              const yTf =
                                66 - Math.min(1, m.torqueToFeedRatio / 1.2) * 48;
                              ropPts.push(`${x1.toFixed(1)},${yRop.toFixed(1)}`, `${x2.toFixed(1)},${yRop.toFixed(1)}`);
                              tfPts.push(`${xm.toFixed(1)},${yTf.toFixed(1)}`);

                              // Track 2 (y: 78..132)
                              const yDse =
                                130 - Math.min(1, m.specificEnergyMjPerM3 / 450) * 48;
                              const yUcs =
                                130 - Math.min(1, m.estimatedUcsMpa / 200) * 48;
                              dsePts.push(`${x1.toFixed(1)},${yDse.toFixed(1)}`, `${x2.toFixed(1)},${yDse.toFixed(1)}`);
                              ucsPts.push(`${xm.toFixed(1)},${yUcs.toFixed(1)}`);

                              // Track 3 (y: 142..196)
                              const yFi = 194 - (m.fractureIndex / 100) * 48;
                              const yRmr = 194 - (m.estimatedRmr89 / 100) * 48;
                              fiPts.push(`${x1.toFixed(1)},${yFi.toFixed(1)}`, `${x2.toFixed(1)},${yFi.toFixed(1)}`);
                              rmrPts.push(`${xm.toFixed(1)},${yRmr.toFixed(1)}`);

                              // Track 4 (y: 206..260)
                              const yQw =
                                258 - Math.min(1, m.waterInflowLMin / 60) * 48;
                              const yLu =
                                258 - Math.min(1, m.equivalentLugeon / 45) * 48;
                              qWaterPts.push(`${x1.toFixed(1)},${yQw.toFixed(1)}`, `${x2.toFixed(1)},${yQw.toFixed(1)}`);
                              luPts.push(`${xm.toFixed(1)},${yLu.toFixed(1)}`);

                              return (
                                <g key={m.intervalId}>
                                  {/* Hazard shading across all 4 tracks */}
                                  {m.isHazardZone && (
                                    <rect
                                      x={x1}
                                      y={14}
                                      width={Math.max(4, x2 - x1)}
                                      height={246}
                                      fill={
                                        m.hazardSeverity === 'CRITICAL_FAULT_OR_INFLOW'
                                          ? '#F43F5E'
                                          : '#F59E0B'
                                      }
                                      opacity="0.16"
                                    />
                                  )}
                                  {/* Interval Depth Boundary Guideline */}
                                  <line
                                    x1={x2}
                                    y1={14}
                                    x2={x2}
                                    y2={260}
                                    stroke="#1E293B"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={xm}
                                    y={276}
                                    fill="#94A3B8"
                                    fontSize="9"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {m.fromMeters}–{m.toMeters}m (Q={m.estimatedBartonQ})
                                  </text>
                                </g>
                              );
                            })}

                            {/* Polylines for Track 1 */}
                            <polyline
                              fill="none"
                              stroke="#F59E0B"
                              strokeWidth="2.2"
                              points={ropPts.join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#E2E8F0"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                              points={tfPts.join(' ')}
                            />

                            {/* Polylines for Track 2 */}
                            <polyline
                              fill="none"
                              stroke="#22D3EE"
                              strokeWidth="2.2"
                              points={dsePts.join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#A7F3D0"
                              strokeWidth="1.6"
                              strokeDasharray="4 2"
                              points={ucsPts.join(' ')}
                            />

                            {/* Polylines for Track 3 */}
                            <polyline
                              fill="none"
                              stroke="#FB7185"
                              strokeWidth="2"
                              points={fiPts.join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="2"
                              points={rmrPts.join(' ')}
                            />

                            {/* Polylines for Track 4 */}
                            <polyline
                              fill="none"
                              stroke="#38BDF8"
                              strokeWidth="2.2"
                              points={qWaterPts.join(' ')}
                            />
                            <polyline
                              fill="none"
                              stroke="#C084FC"
                              strokeWidth="1.6"
                              strokeDasharray="3 2"
                              points={luPts.join(' ')}
                            />

                            {/* Interactive Depth Scrubber Hairline Crosshair */}
                            {(() => {
                              const sx = xOf(scrubDepthMeters);
                              return (
                                <g>
                                  <line
                                    x1={sx}
                                    y1={8}
                                    x2={sx}
                                    y2={264}
                                    stroke="#22D3EE"
                                    strokeWidth="1.8"
                                  />
                                  <rect
                                    x={Math.min(690, Math.max(56, sx - 28))}
                                    y={2}
                                    width="56"
                                    height="13"
                                    rx="3"
                                    fill="#06B6D4"
                                  />
                                  <text
                                    x={Math.min(718, Math.max(84, sx))}
                                    y={11}
                                    fill="#020617"
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {scrubDepthMeters.toFixed(1)} m
                                  </text>
                                </g>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                {/* 3. MIDDLE SPLIT: INTERACTIVE 3D LOOK-AHEAD PROBE FAN & FAULT INTERSECTION + FACE COLLAR POLAR TARGET */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* LEFT (7 COLS): 3D INTERACTIVE ORBITABLE PROBE FAN & FAULT PLANE INTERSECTION */}
                  <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400 block">
                            3D Spatial Look-Ahead Probe Fan &amp; Structural Fault Plane Viewport
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Drag on 3D canvas to orbit · Displays 3D probe trajectories, interpolated fault plane &amp; safe advance gate
                          </span>
                        </div>
                      </div>

                      {/* Projection Switcher */}
                      <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono">
                        {(
                          [
                            { id: 'ISOMETRIC_3D', label: '3D Orbit' },
                            { id: 'LONGITUDINAL_ZY', label: 'Side Profile (Z-Y)' },
                            { id: 'PLAN_ZX', label: 'Plan View (Z-X)' },
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setFanProjection(mode.id)}
                            className={`px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                              fanProjection === mode.id
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color-By & Camera Yaw/Pitch Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Color Intervals By:</span>
                        {(
                          [
                            { id: 'HAZARD_AND_RQD', label: 'Hazard & RQD' },
                            { id: 'DSE_ENERGY', label: 'Specific Energy DSE' },
                            { id: 'WATER_LUGEON', label: 'Water & Lugeon' },
                            { id: 'BARTON_Q', label: 'Barton Q' },
                          ] as const
                        ).map((cm) => (
                          <button
                            key={cm.id}
                            type="button"
                            onClick={() => setFanColorMode(cm.id)}
                            className={`px-2 py-0.5 rounded border cursor-pointer whitespace-nowrap ${
                              fanColorMode === cm.id
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {cm.label}
                          </button>
                        ))}
                      </div>

                      {fanProjection === 'ISOMETRIC_3D' && (
                        <div className="flex items-center gap-2 text-slate-400 tabular-nums">
                          <span>Yaw: {camYawDeg}°</span>
                          <input
                            type="range"
                            min={-75}
                            max={75}
                            value={camYawDeg}
                            onChange={(e) => setCamYawDeg(parseInt(e.target.value, 10))}
                            className="w-16 accent-emerald-400 cursor-pointer"
                          />
                          <span>Pitch: {camPitchDeg}°</span>
                          <input
                            type="range"
                            min={-15}
                            max={60}
                            value={camPitchDeg}
                            onChange={(e) => setCamPitchDeg(parseInt(e.target.value, 10))}
                            className="w-16 accent-emerald-400 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* 3D VIEWPORT SVG */}
                    <div className="w-full h-72 bg-[#07090E] rounded-xl border border-slate-800 p-2 select-none">
                      <svg
                        viewBox="0 0 650 230"
                        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
                        onPointerDown={(e) => {
                          if (fanProjection !== 'ISOMETRIC_3D') return;
                          setIsOrbiting3D(true);
                          orbitStartRef.current = {
                            x: e.clientX,
                            y: e.clientY,
                            yaw: camYawDeg,
                            pitch: camPitchDeg,
                          };
                        }}
                        onPointerMove={(e) => {
                          if (!isOrbiting3D || !orbitStartRef.current) return;
                          const dx = e.clientX - orbitStartRef.current.x;
                          const dy = e.clientY - orbitStartRef.current.y;
                          setCamYawDeg(
                            Math.max(
                              -80,
                              Math.min(80, Math.round(orbitStartRef.current.yaw + dx * 0.4))
                            )
                          );
                          setCamPitchDeg(
                            Math.max(
                              -20,
                              Math.min(65, Math.round(orbitStartRef.current.pitch + dy * 0.35))
                            )
                          );
                        }}
                        onPointerUp={() => setIsOrbiting3D(false)}
                        onPointerLeave={() => setIsOrbiting3D(false)}
                      >
                        {/* 1. Render Tunnel Wireframe Station Rings (-5m, 0m Face, +5m, +10m, +15m, +20m, +25m) */}
                        {[-5, 0, 5, 10, 15, 20, 25].map((zSta) => {
                          const halfW = tunnelWidthMeters * 0.5;
                          const h = tunnelHeightMeters;
                          const archPts: Point3DTunnel[] = [
                            { x: -halfW, y: 0, z: zSta },
                            { x: -halfW, y: h * 0.55, z: zSta },
                            { x: -halfW * 0.7, y: h * 0.86, z: zSta },
                            { x: 0, y: h, z: zSta },
                            { x: halfW * 0.7, y: h * 0.86, z: zSta },
                            { x: halfW, y: h * 0.55, z: zSta },
                            { x: halfW, y: 0, z: zSta },
                            { x: -halfW, y: 0, z: zSta },
                          ];
                          const polyStr = archPts
                            .map((p) => {
                              const pr = projectTunnel3DPoint(p);
                              return `${pr.sx.toFixed(1)},${pr.sy.toFixed(1)}`;
                            })
                            .join(' ');
                          const crownProj = projectTunnel3DPoint({
                            x: 0,
                            y: h + 0.6,
                            z: zSta,
                          });
                          const isFace = zSta === 0;
                          return (
                            <g key={zSta}>
                              <polyline
                                points={polyStr}
                                fill={isFace ? 'rgba(245, 158, 11, 0.10)' : 'none'}
                                stroke={
                                  isFace
                                    ? '#F59E0B'
                                    : zSta < 0
                                    ? '#475569'
                                    : '#1E293B'
                                }
                                strokeWidth={isFace ? 2.4 : 1.1}
                                strokeDasharray={zSta > 0 ? '4 3' : undefined}
                              />
                              <text
                                x={crownProj.sx}
                                y={crownProj.sy}
                                fill={isFace ? '#FBBF24' : '#64748B'}
                                fontSize={isFace ? '9.5' : '8'}
                                fontFamily="monospace"
                                fontWeight={isFace ? 'bold' : 'normal'}
                                textAnchor="middle"
                              >
                                {isFace
                                  ? 'FACE (0m)'
                                  : zSta > 0
                                  ? `+${zSta}m`
                                  : `${zSta}m`}
                              </text>
                            </g>
                          );
                        })}

                        {/* Longitudinal Spine Lines (Crown, Left Springline, Right Springline, Invert) */}
                        {[
                          { x: 0, y: tunnelHeightMeters },
                          { x: -tunnelWidthMeters * 0.5, y: 0 },
                          { x: tunnelWidthMeters * 0.5, y: 0 },
                        ].map((sp, idx) => {
                          const p0 = projectTunnel3DPoint({ x: sp.x, y: sp.y, z: -5 });
                          const pFace = projectTunnel3DPoint({ x: sp.x, y: sp.y, z: 0 });
                          const pEnd = projectTunnel3DPoint({ x: sp.x, y: sp.y, z: 25 });
                          return (
                            <g key={idx}>
                              <line
                                x1={p0.sx}
                                y1={p0.sy}
                                x2={pFace.sx}
                                y2={pFace.sy}
                                stroke="#475569"
                                strokeWidth="1.2"
                              />
                              <line
                                x1={pFace.sx}
                                y1={pFace.sy}
                                x2={pEnd.sx}
                                y2={pEnd.sy}
                                stroke="#1E293B"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                              />
                            </g>
                          );
                        })}

                        {/* 2. Safe Advance Gate Plane */}
                        {(() => {
                          const zSafe = fanSummary.safeAdvanceLengthMeters;
                          const halfW = tunnelWidthMeters * 0.52;
                          const h = tunnelHeightMeters;
                          const corners: Point3DTunnel[] = [
                            { x: -halfW, y: 0, z: zSafe },
                            { x: -halfW, y: h, z: zSafe },
                            { x: halfW, y: h, z: zSafe },
                            { x: halfW, y: 0, z: zSafe },
                          ];
                          const pts = corners
                            .map((c) => {
                              const p = projectTunnel3DPoint(c);
                              return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
                            })
                            .join(' ');
                          const botLabel = projectTunnel3DPoint({
                            x: 0,
                            y: -0.9,
                            z: zSafe,
                          });
                          return (
                            <g>
                              <polygon
                                points={pts}
                                fill="rgba(16, 185, 129, 0.10)"
                                stroke="#10B981"
                                strokeWidth="1.6"
                                strokeDasharray="5 3"
                              />
                              <text
                                x={botLabel.sx}
                                y={botLabel.sy}
                                fill="#34D399"
                                fontSize="9"
                                fontFamily="monospace"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                Safe Advance (+{zSafe}m)
                              </text>
                            </g>
                          );
                        })()}

                        {/* 3. Interpolated 3D Structural Fault / Shear Plane */}
                        {fanSummary.faultPlane3D.detected &&
                          (() => {
                            const fp = fanSummary.faultPlane3D;
                            const halfW = tunnelWidthMeters * 0.65;
                            const h = tunnelHeightMeters * 1.05;
                            const corners: Point3DTunnel[] = [
                              {
                                x: -halfW,
                                y: h,
                                z: fp.crownIntersectionAheadM - 0.6,
                              },
                              {
                                x: halfW,
                                y: h,
                                z: fp.crownIntersectionAheadM + 0.6,
                              },
                              {
                                x: halfW,
                                y: 0,
                                z: fp.invertIntersectionAheadM + 0.6,
                              },
                              {
                                x: -halfW,
                                y: 0,
                                z: fp.invertIntersectionAheadM - 0.6,
                              },
                            ];
                            const pts = corners
                              .map((c) => {
                                const p = projectTunnel3DPoint(c);
                                return `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
                              })
                              .join(' ');
                            const topTag = projectTunnel3DPoint({
                              x: 0,
                              y: h + 0.8,
                              z: fp.crownIntersectionAheadM,
                            });
                            return (
                              <g>
                                <polygon
                                  points={pts}
                                  fill="rgba(244, 63, 94, 0.24)"
                                  stroke="#F43F5E"
                                  strokeWidth="2"
                                />
                                <text
                                  x={topTag.sx}
                                  y={topTag.sy}
                                  fill="#FDA4AF"
                                  fontSize="9"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  3D Fault Plane (Dip {fp.apparentDipDeg}° · Center +{fp.centerIntersectionAheadM}m)
                                </text>
                              </g>
                            );
                          })()}

                        {/* 4. Render All Probe Holes & Interval Segments in 3D */}
                        {holes.map((h) => {
                          const hMwd = computeMwdProfileForHole(
                            h,
                            rigCalibration,
                            tunnelWidthMeters,
                            tunnelHeightMeters
                          );
                          const isAct = h.id === activeHole.id;

                          return (
                            <g
                              key={h.id}
                              onClick={() => setSelectedHoleId(h.id)}
                              className="cursor-pointer"
                            >
                              {hMwd.map((m) => {
                                const p1 = projectTunnel3DPoint(m.startXYZ);
                                const p2 = projectTunnel3DPoint(m.endXYZ);

                                let segColor = '#22D3EE';
                                if (fanColorMode === 'HAZARD_AND_RQD') {
                                  segColor =
                                    m.hazardSeverity === 'CRITICAL_FAULT_OR_INFLOW'
                                      ? '#F43F5E'
                                      : m.hazardSeverity === 'MODERATE_FRACTURED'
                                      ? '#F59E0B'
                                      : '#10B981';
                                } else if (fanColorMode === 'DSE_ENERGY') {
                                  segColor =
                                    m.specificEnergyMjPerM3 >= 220
                                      ? '#22D3EE'
                                      : m.specificEnergyMjPerM3 >= 140
                                      ? '#38BDF8'
                                      : '#F43F5E';
                                } else if (fanColorMode === 'WATER_LUGEON') {
                                  segColor =
                                    m.equivalentLugeon >= 15
                                      ? '#38BDF8'
                                      : m.equivalentLugeon >= 5
                                      ? '#818CF8'
                                      : '#475569';
                                } else {
                                  segColor =
                                    m.estimatedBartonQ >= 4
                                      ? '#10B981'
                                      : m.estimatedBartonQ >= 1
                                      ? '#F59E0B'
                                      : '#F43F5E';
                                }

                                return (
                                  <g key={m.intervalId}>
                                    <line
                                      x1={p1.sx}
                                      y1={p1.sy}
                                      x2={p2.sx}
                                      y2={p2.sy}
                                      stroke={segColor}
                                      strokeWidth={isAct ? 5.5 : 3.2}
                                      strokeLinecap="round"
                                      opacity={isAct ? 1 : 0.78}
                                    />
                                  </g>
                                );
                              })}

                              {/* Active Hole Scrubbed 3D Point Marker */}
                              {isAct &&
                                (() => {
                                  const sp = projectTunnel3DPoint(scrubbedPoint3D);
                                  return (
                                    <circle
                                      cx={sp.sx}
                                      cy={sp.sy}
                                      r="5.5"
                                      fill="#FFFFFF"
                                      stroke="#06B6D4"
                                      strokeWidth="2.5"
                                    />
                                  );
                                })()}
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* 3D Fault Plane Attitude Summary Bar */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                      <span className="text-slate-300">
                        <strong className="text-rose-400">3D Structural Diagnosis:</strong>{' '}
                        {fanSummary.faultPlane3D.dipDirectionLabel}
                      </span>
                      {fanSummary.faultPlane3D.detected && (
                        <span className="text-slate-400">
                          Crown: <strong className="text-white">+{fanSummary.faultPlane3D.crownIntersectionAheadM}m</strong> · Center:{' '}
                          <strong className="text-white">+{fanSummary.faultPlane3D.centerIntersectionAheadM}m</strong> · Invert:{' '}
                          <strong className="text-white">+{fanSummary.faultPlane3D.invertIntersectionAheadM}m</strong> · True Thickness:{' '}
                          <strong className="text-amber-300">{fanSummary.faultPlane3D.estimatedTrueThicknessM}m</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RIGHT (5 COLS): INTERACTIVE TUNNEL FACE COLLAR & TOE TRAJECTORY MAP + 6-AXIS ROCK MASS SPIDER */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    {/* Interactive Tunnel Face Collar & Projected Toe Target Map */}
                    <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-2.5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400 block">
                            Tunnel Face Collar &amp; Toe Projection Map
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Drag collar on face · Dashed vector shows projected 3D hole toe at end-of-hole
                          </span>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-cyan-300">
                          X={activeHole.collarX}m, Y={activeHole.collarY}m
                        </span>
                      </div>

                      <div className="flex-1 min-h-[210px] bg-[#07090E] rounded-xl border border-slate-800 flex items-center justify-center p-2 select-none">
                        <svg
                          ref={faceSvgRef}
                          viewBox="0 0 360 250"
                          className="w-full h-full max-h-[225px] cursor-crosshair touch-none"
                          onPointerDown={(e) => {
                            setIsDraggingCollar(true);
                            updateCollarFromPointer(e.clientX, e.clientY);
                          }}
                          onPointerMove={(e) => {
                            if (isDraggingCollar) {
                              updateCollarFromPointer(e.clientX, e.clientY);
                            }
                          }}
                          onPointerUp={() => setIsDraggingCollar(false)}
                          onPointerLeave={() => setIsDraggingCollar(false)}
                        >
                          {/* Coordinate Grid */}
                          <line
                            x1="180"
                            y1="15"
                            x2="180"
                            y2="225"
                            stroke="#1E293B"
                            strokeDasharray="4 4"
                          />
                          <line
                            x1="35"
                            y1="215"
                            x2="325"
                            y2="215"
                            stroke="#475569"
                            strokeWidth="2"
                          />
                          <line
                            x1="35"
                            y1="120"
                            x2="325"
                            y2="120"
                            stroke="#1E293B"
                            strokeDasharray="4 4"
                          />

                          {/* Horseshoe Tunnel Face Profile */}
                          <path
                            d="M 65 215 L 65 120 A 115 100 0 0 1 295 120 L 295 215 Z"
                            fill="#0F172A"
                            stroke="#F59E0B"
                            strokeWidth="2.2"
                          />

                          {/* Look-Ahead Perimeter Envelope */}
                          <path
                            d="M 50 222 L 50 115 A 130 112 0 0 1 310 115 L 310 222 Z"
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="1.2"
                            strokeDasharray="5 4"
                            opacity="0.65"
                          />

                          {/* Render All Probe Hole Collars & True 3D Toe Vectors */}
                          {holes.map((h) => {
                            const cx =
                              180 + (h.collarX / (tunnelWidthMeters / 2)) * 110;
                            const cy =
                              215 - (h.collarY / tunnelHeightMeters) * 185;
                            const toe3D = computeHole3DPointAtDepth(
                              h,
                              h.totalLengthMeters
                            );
                            const tx =
                              180 + (toe3D.x / (tunnelWidthMeters / 2)) * 110;
                            const ty =
                              215 - (toe3D.y / tunnelHeightMeters) * 185;
                            const isAct = h.id === activeHole.id;

                            return (
                              <g
                                key={h.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHoleId(h.id);
                                }}
                                className="cursor-pointer"
                              >
                                <line
                                  x1={cx}
                                  y1={cy}
                                  x2={tx}
                                  y2={ty}
                                  stroke={isAct ? '#22D3EE' : '#94A3B8'}
                                  strokeWidth={isAct ? 2.4 : 1.5}
                                  strokeDasharray="3 2"
                                />
                                <circle
                                  cx={tx}
                                  cy={ty}
                                  r={3.5}
                                  fill={isAct ? '#22D3EE' : '#94A3B8'}
                                />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={isAct ? 9 : 6.5}
                                  fill={isAct ? '#F59E0B' : '#1E293B'}
                                  stroke={isAct ? '#FFFFFF' : '#F59E0B'}
                                  strokeWidth={isAct ? 2.2 : 1.5}
                                />
                                <text
                                  x={cx}
                                  y={cy - 12}
                                  fill={isAct ? '#FDE68A' : '#CBD5E1'}
                                  fontSize="9.5"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {h.holeId.split(' ')[0]}
                                </text>
                              </g>
                            );
                          })}

                          <text
                            x="180"
                            y="240"
                            fill="#94A3B8"
                            fontSize="9.5"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            Span {tunnelWidthMeters.toFixed(1)}m × Height{' '}
                            {tunnelHeightMeters.toFixed(1)}m · Coverage{' '}
                            {fanSummary.fanPerimeterCoveragePct}%
                          </text>
                        </svg>
                      </div>
                    </div>

                    {/* 6-Axis Geotechnical Parameter Spider / Radar Calibration */}
                    {scrubbedMwdInterval && (
                      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="text-xs font-mono font-bold text-cyan-300 uppercase">
                            6-Axis Rock Mass Integrity Radar ({scrubbedMwdInterval.fromMeters}–{scrubbedMwdInterval.toMeters}m)
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-300 space-y-0.5">
                            <div>
                              Support:{' '}
                              <strong className="text-amber-300">
                                {scrubbedMwdInterval.recommendedNatmSupportClass.split('(')[0]}
                              </strong>
                            </div>
                            <div>
                              Stand-Up Time:{' '}
                              <strong className="text-emerald-300">
                                {scrubbedMwdInterval.predictedStandUpTimeHours} hrs
                              </strong>
                            </div>
                            <div>
                              Diagnosis:{' '}
                              <strong
                                className={
                                  scrubbedMwdInterval.isHazardZone
                                    ? 'text-rose-400'
                                    : 'text-emerald-400'
                                }
                              >
                                {scrubbedMwdInterval.hazardReason}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <svg viewBox="0 0 150 130" className="w-36 h-28 shrink-0">
                          {(() => {
                            const cx = 75;
                            const cy = 66;
                            const rMax = 44;
                            const axes = [
                              {
                                label: 'RQD',
                                val: scrubbedMwdInterval.estimatedRqdPct / 100,
                              },
                              {
                                label: 'RMR',
                                val: scrubbedMwdInterval.estimatedRmr89 / 100,
                              },
                              {
                                label: 'UCS',
                                val: Math.min(
                                  1,
                                  scrubbedMwdInterval.estimatedUcsMpa / 160
                                ),
                              },
                              {
                                label: 'DSE',
                                val: Math.min(
                                  1,
                                  scrubbedMwdInterval.specificEnergyMjPerM3 / 320
                                ),
                              },
                              {
                                label: 'TIGHT',
                                val: Math.max(
                                  0.08,
                                  1 -
                                    Math.min(
                                      1,
                                      scrubbedMwdInterval.equivalentLugeon / 30
                                    )
                                ),
                              },
                              {
                                label: 'INTACT',
                                val: Math.max(
                                  0.08,
                                  1 - scrubbedMwdInterval.fractureIndex / 100
                                ),
                              },
                            ];

                            const ringPoints = (scale: number) =>
                              axes
                                .map((_, i) => {
                                  const ang =
                                    -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
                                  return `${(
                                    cx +
                                    Math.cos(ang) * rMax * scale
                                  ).toFixed(1)},${(
                                    cy +
                                    Math.sin(ang) * rMax * scale
                                  ).toFixed(1)}`;
                                })
                                .join(' ');

                            const dataPoly = axes
                              .map((a, i) => {
                                const ang =
                                  -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
                                const r = Math.max(0.1, a.val) * rMax;
                                return `${(cx + Math.cos(ang) * r).toFixed(1)},${(
                                  cy +
                                  Math.sin(ang) * r
                                ).toFixed(1)}`;
                              })
                              .join(' ');

                            return (
                              <>
                                <polygon
                                  points={ringPoints(1)}
                                  fill="none"
                                  stroke="#334155"
                                  strokeWidth="1"
                                />
                                <polygon
                                  points={ringPoints(0.5)}
                                  fill="none"
                                  stroke="#1E293B"
                                  strokeWidth="1"
                                />
                                {axes.map((a, i) => {
                                  const ang =
                                    -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
                                  const x2 = cx + Math.cos(ang) * rMax;
                                  const y2 = cy + Math.sin(ang) * rMax;
                                  const lx = cx + Math.cos(ang) * (rMax + 13);
                                  const ly = cy + Math.sin(ang) * (rMax + 11);
                                  return (
                                    <g key={a.label}>
                                      <line
                                        x1={cx}
                                        y1={cy}
                                        x2={x2}
                                        y2={y2}
                                        stroke="#1E293B"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={lx}
                                        y={ly + 3}
                                        fill="#94A3B8"
                                        fontSize="7.5"
                                        fontFamily="monospace"
                                        textAnchor="middle"
                                      >
                                        {a.label}
                                      </text>
                                    </g>
                                  );
                                })}
                                <polygon
                                  points={dataPoly}
                                  fill="rgba(6, 182, 212, 0.25)"
                                  stroke="#06B6D4"
                                  strokeWidth="1.8"
                                />
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. COMPREHENSIVE QUANTITATIVE MWD, ROCK MECHANICS & HYDROGEOLOGY INTERVAL TABLE */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-200 block">
                        Quantitative Interval-by-Interval MWD, Rock Mass &amp; Hydrogeological Matrix — {activeHole.holeId}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Click any interval row to snap the 3D viewport &amp; geophysical log crosshair to that depth
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-amber-300">
                      Recommended Fan Support: {fanSummary.recommendedSupportClass}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                          <th className="py-2 px-2">Depth (m)</th>
                          <th className="py-2 px-2">3D Mid (X,Y,+Z)</th>
                          <th className="py-2 px-2">ROP / NPR</th>
                          <th className="py-2 px-2">e_t + e_r + e_p = DSE</th>
                          <th className="py-2 px-2">UCS_MWD</th>
                          <th className="py-2 px-2">F_I / RQD</th>
                          <th className="py-2 px-2">RMR₈₉ / Q / GSI</th>
                          <th className="py-2 px-2">Q_w / Lu_eq</th>
                          <th className="py-2 px-2">Moye K (m/s)</th>
                          <th className="py-2 px-2">Goodman Q_tun</th>
                          <th className="py-2 px-2">Diagnostic Status &amp; Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mwdProfile.map((m) => {
                          const isScrubbed =
                            scrubbedMwdInterval?.intervalId === m.intervalId;
                          return (
                            <tr
                              key={m.intervalId}
                              onClick={() =>
                                setScrubDepthMeters(
                                  Number(
                                    ((m.fromMeters + m.toMeters) * 0.5).toFixed(1)
                                  )
                                )
                              }
                              className={`border-b border-slate-800/80 cursor-pointer transition-colors ${
                                isScrubbed
                                  ? 'bg-cyan-950/40'
                                  : m.isHazardZone
                                  ? 'bg-rose-950/25 hover:bg-rose-950/40'
                                  : 'hover:bg-slate-900/50'
                              }`}
                            >
                              <td className="py-2 px-2 font-bold text-white">
                                {m.fromMeters.toFixed(1)}–{m.toMeters.toFixed(1)}m
                              </td>
                              <td className="py-2 px-2 text-slate-300">
                                ({m.midXYZ.x}, {m.midXYZ.y}, +{m.midXYZ.z}m)
                              </td>
                              <td className="py-2 px-2 text-amber-300">
                                {m.ropMetersPerMin.toFixed(2)} ({m.normalizedPenetrationRate})
                              </td>
                              <td className="py-2 px-2 text-cyan-300">
                                {m.thrustSpecificEnergyMjM3}+{m.rotationalSpecificEnergyMjM3}+{m.percussiveSpecificEnergyMjM3} ={' '}
                                <strong>{m.specificEnergyMjPerM3} MJ/m³</strong>
                              </td>
                              <td className="py-2 px-2 text-emerald-300 font-bold">
                                {m.estimatedUcsMpa} MPa
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={
                                    m.fractureIndex >= 55
                                      ? 'text-rose-400 font-bold'
                                      : 'text-slate-200'
                                  }
                                >
                                  {m.fractureIndex}
                                </span>{' '}
                                / {m.estimatedRqdPct}%
                              </td>
                              <td className="py-2 px-2 text-amber-200 font-bold">
                                {m.estimatedRmr89} / {m.estimatedBartonQ} / {m.estimatedGsi}
                              </td>
                              <td className="py-2 px-2 text-sky-300">
                                {m.waterInflowLMin} L/m ({m.equivalentLugeon} Lu)
                              </td>
                              <td className="py-2 px-2 text-slate-300">
                                {m.hydraulicConductivityMPerSec}
                              </td>
                              <td className="py-2 px-2 text-sky-200 font-bold">
                                {m.predictedTunnelInflowLMinPer10m} L/m
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={
                                    m.hazardSeverity === 'CRITICAL_FAULT_OR_INFLOW'
                                      ? 'text-rose-400 font-bold'
                                      : m.hazardSeverity === 'MODERATE_FRACTURED'
                                      ? 'text-amber-300 font-semibold'
                                      : 'text-emerald-400'
                                  }
                                >
                                  {m.hazardSeverity === 'CRITICAL_FAULT_OR_INFLOW'
                                    ? '✖ '
                                    : m.hazardSeverity === 'MODERATE_FRACTURED'
                                    ? '▲ '
                                    : '● '}
                                  {m.hazardReason}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
