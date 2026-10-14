import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  FileSpreadsheet,
  Layers,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useTheme, ThemeToggleButton } from '../context/ThemeContext';
import {
  Joint,
  JointSet,
  PhotoSurface,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  computePhotogrammetricStructuralSummary,
  exportPhotogrammetricPointCloudToPLY,
  exportPhotogrammetricStructuralCSV,
  generatePhotogrammetricPointCloud,
} from '../engine/photogrammetryAndStructuralEngine';
import {
  buildProjectedPerimeterJoints,
  computeUnfoldedPerimeterProjections,
  evaluateStationGroundwaterFromZones,
  GroundwaterSeepageZone,
  SEEPAGE_CONDITION_CATALOG,
  SeepageConditionType,
} from '../engine/kinematicsSupportAndDxfEngine';

export type PhotogrammetryLabTab = 'kinematic' | 'perimeter' | 'seepage' | 'jrc' | 'pointcloud';

interface PhotogrammetryStructuralModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PhotogrammetryLabTab;
  joints: Joint[];
  jointSets: JointSet[];
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  activeSurface: SurfaceType;
  hasActiveRidgeField: boolean;
  onRefineAllActiveSurfaceTraces: () => void;
  onSelectJoint?: (jointId: string, surface: SurfaceType) => void;
  onProceedToClassification?: () => void;
  onUpdateJoints?: (nextJoints: Joint[]) => void;
  onApplyGroundwaterToClassification?: (jw: number, jwDesc: string, rmrRating: number, inflowLMin: number, rmrDesc: string) => void;
}

const SET_COLORS: Record<string, string> = {
  J1: '#EF4444',
  J2: '#22C55E',
  J3: '#3B82F6',
  J4: '#F59E0B',
  J5: '#A855F7',
  J0: '#06B6D4',
  F1: '#E11D48',
};

export const PhotogrammetryStructuralModal: React.FC<PhotogrammetryStructuralModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'kinematic',
  joints,
  jointSets,
  geometry,
  settings,
  photos,
  activeSurface,
  hasActiveRidgeField,
  onRefineAllActiveSurfaceTraces,
  onSelectJoint,
  onProceedToClassification,
  onUpdateJoints,
  onApplyGroundwaterToClassification,
}) => {
  const [activeTab, setActiveTab] = useState<PhotogrammetryLabTab>(initialTab);
  const [frictionAngleDeg, setFrictionAngleDeg] = useState<number>(32);
  const [projectionMode, setProjectionMode] = useState<'equal_angle' | 'equal_area'>('equal_area');
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Groundwater / Seepage Zone Sketching State
  const [seepageZones, setSeepageZones] = useState<GroundwaterSeepageZone[]>([
    {
      id: 'GW-1',
      surface: 'crown',
      condition: 'DRIPPING',
      inflowLPerMin: 14,
      locationX: 0.6,
      locationY: 1.8,
      radiusMeters: 0.9,
      notes: 'Crown shoulder dripping along J1/J2 intersection',
    },
  ]);
  const [newSeepageSurface, setNewSeepageSurface] = useState<SurfaceType>('face');
  const [newSeepageCondition, setNewSeepageCondition] = useState<SeepageConditionType>('DRIPPING');
  const [newSeepageInflow, setNewSeepageInflow] = useState<string>('15');
  const [newSeepageNotes, setNewSeepageNotes] = useState<string>('Continuous dripping along joint trace');
  const [gwAppliedBanner, setGwAppliedBanner] = useState<string | null>(null);

  const perimeterProjections = useMemo(
    () => computeUnfoldedPerimeterProjections(joints, geometry, settings),
    [joints, geometry, settings]
  );

  const gwSummary = useMemo(
    () => evaluateStationGroundwaterFromZones(seepageZones),
    [seepageZones]
  );

  const summary = useMemo(
    () => computePhotogrammetricStructuralSummary(joints, jointSets, geometry, settings, photos),
    [joints, jointSets, geometry, settings, photos]
  );

  const pointCloud = useMemo(
    () => generatePhotogrammetricPointCloud(joints, geometry, settings),
    [joints, geometry, settings]
  );

  if (!isOpen) return null;

  const handleDownloadPLY = () => {
    const plyContent = exportPhotogrammetricPointCloudToPLY(joints, geometry, settings);
    const blob = new Blob([plyContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeChainage = (settings.faceChainage || 'CH0').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `Tunnel_3D_Photogrammetry_${safeChainage}.ply`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csvContent = exportPhotogrammetricStructuralCSV(joints, jointSets, geometry, settings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeChainage = (settings.faceChainage || 'CH0').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `Structural_Joints_And_Wedges_${safeChainage}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const criticalWedgeCount = summary.kinematicWedges.filter(
    (w) => w.riskLevel === 'CRITICAL'
  ).length;
  const moderateWedgeCount = summary.kinematicWedges.filter(
    (w) => w.riskLevel === 'MODERATE'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/90 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-bold tracking-wide uppercase text-white">
                  3D Photogrammetry & Quantitative Structural Geology Engine
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                  Steger Sub-Pixel + Phase Congruency + 3D SVD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Non-destructive photogrammetric trace refinement, Barton-Bandis JRC (Z₂) roughness, Mauldon P₂₁/P₃₂ fracture intensity & Goodman-Shi 3D kinematic wedge stability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveRidgeField && (
              <button
                onClick={onRefineAllActiveSurfaceTraces}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors cursor-pointer"
                title="Lock all traces on active surface onto sub-pixel Steger ridge & recompute 3D SVD orientation + Barton JRC without losing any existing traces"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sub-Pixel Lock & 3D Refine ({activeSurface})</span>
              </button>
            )}
            <button
              onClick={handleDownloadPLY}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
              title="Export 3D Colored Point Cloud with Surface Normals (.PLY) for CloudCompare / Agisoft Metashape / MeshLab"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export 3D .PLY Cloud</span>
            </button>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
              title="Export Structural Joints, Terzaghi Weights, Barton JRC & Kinematic Wedges (.CSV) for Rocscience DIPS / UnWedge"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export DIPS / UnWedge .CSV</span>
            </button>
            {onProceedToClassification && (
              <button
                onClick={() => {
                  onClose();
                  onProceedToClassification();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors cursor-pointer"
                title="Proceed to Step 3: Rock Mass Classification (RMR / Q-System / GSI)"
              >
                <span>Next: 3. Rock Mass Classification →</span>
              </button>
            )}
            <ThemeToggleButton compact />
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Density Photogrammetric & Rock Mass KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 bg-slate-950/60 border-b border-slate-800">
          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Steger Sub-Pixel Lock
            </div>
            <div className="text-base font-mono font-bold text-cyan-400 mt-0.5">
              ±{summary.meanSubPixelResidualPx.toFixed(2)} px
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Phase Congruency: {(summary.meanPhaseCongruency * 100).toFixed(0)}%
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              3D Bundle Residual
            </div>
            <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
              {(summary.meanTriangulationResidualM * 1000).toFixed(1)} mm
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Reproj Error: {summary.meanReprojectionErrorPx.toFixed(2)} px
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Fracture Intensity P₂₁ / P₃₂
            </div>
            <div className="text-base font-mono font-bold text-amber-300 mt-0.5">
              {summary.arealFractureIntensityP21.toFixed(2)} m⁻¹ · {summary.volumetricFractureIntensityP32.toFixed(2)} m²/m³
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Areal P₂₁ & Volumetric P₃₂
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Mauldon Unbiased Trace
            </div>
            <div className="text-base font-mono font-bold text-sky-300 mt-0.5">
              {summary.mauldonTrueMeanLengthMeters.toFixed(2)} m
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Censorship-Corrected Mean L
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Palmström Vb & RQD*
            </div>
            <div className="text-base font-mono font-bold text-indigo-300 mt-0.5">
              {summary.estimatedBlockVolumeM3.toFixed(2)} m³ · {summary.terzaghiCorrectedRqdPct}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Terzaghi Bias-Corrected
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Barton Field JRCₙ & Wedges
            </div>
            <div className="text-base font-mono font-bold text-rose-300 mt-0.5">
              JRCₙ {summary.meanBartonJrc.toFixed(1)} · {criticalWedgeCount + moderateWedgeCount} Risk
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {summary.pointCloudCount.toLocaleString()} 3D Cloud Vertices
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('kinematic')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'kinematic'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>1. Stereonet (Schmidt Net) &amp; Wedge Check ({summary.kinematicWedges.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('perimeter')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'perimeter'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Unfolded Perimeter Projection Strip ({perimeterProjections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('seepage')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'seepage'
                ? 'border-sky-400 text-sky-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>3. Groundwater / Seepage Sketching ({seepageZones.length} Zones → Jw={gwSummary.recommendedJw})</span>
          </button>

          <button
            onClick={() => setActiveTab('jrc')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'jrc'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>4. Barton JRC (Z₂) Roughness ({summary.jrcProfiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pointcloud')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pointcloud'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>5. 3D Point Cloud ({summary.pointCloudCount})</span>
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'kinematic' && (
            <div className="space-y-4">
              {/* Interactive Lower-Hemisphere Stereonet + Markland Kinematic Feasibility Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Interactive Lower-Hemisphere Stereonet */}
                <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded p-3.5 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Lower-Hemisphere Stereonet
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setProjectionMode('equal_angle')}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          projectionMode === 'equal_angle'
                            ? 'bg-cyan-600 text-white border-cyan-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        Wulff (Equal-Angle)
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectionMode('equal_area')}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          projectionMode === 'equal_area'
                            ? 'bg-cyan-600 text-white border-cyan-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        Schmidt (Equal-Area)
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const R = 108;
                    const projectPlungeTrend = (plungeDeg: number, trendDeg: number) => {
                      const pRad = (Math.max(0, Math.min(90, plungeDeg)) * Math.PI) / 180;
                      const rFrac =
                        projectionMode === 'equal_angle'
                          ? Math.tan((Math.PI / 2 - pRad) / 2)
                          : Math.SQRT2 * Math.sin((Math.PI / 2 - pRad) / 2);
                      const r = rFrac * R;
                      const azRad = ((trendDeg - 90) * Math.PI) / 180;
                      return {
                        x: Math.cos(azRad) * r,
                        y: Math.sin(azRad) * r,
                      };
                    };

                    const fricR = projectPlungeTrend(frictionAngleDeg, 0).x;
                    const driveRad = ((settings.driveDirection - 90) * Math.PI) / 180;
                    const driveX = Math.cos(driveRad) * R;
                    const driveY = Math.sin(driveRad) * R;

                    return (
                      <svg viewBox="-140 -140 280 280" className="w-[250px] h-[250px]">
                        {/* Outer Primitive Circle */}
                        <circle
                          cx="0"
                          cy="0"
                          r={R}
                          fill={isLight ? '#FFFFFF' : '#0B1120'}
                          stroke={isLight ? '#334155' : '#475569'}
                          strokeWidth="1.6"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r={R * 0.67}
                          fill="none"
                          stroke={isLight ? '#CBD5E1' : '#1E293B'}
                          strokeWidth="1"
                          strokeDasharray="3,3"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r={R * 0.33}
                          fill="none"
                          stroke={isLight ? '#CBD5E1' : '#1E293B'}
                          strokeWidth="1"
                          strokeDasharray="3,3"
                        />
                        <line
                          x1={-R - 6}
                          y1="0"
                          x2={R + 6}
                          y2="0"
                          stroke={isLight ? '#94A3B8' : '#334155'}
                          strokeWidth="1"
                        />
                        <line
                          x1="0"
                          y1={-R - 6}
                          x2="0"
                          y2={R + 6}
                          stroke={isLight ? '#94A3B8' : '#334155'}
                          strokeWidth="1"
                        />

                        {/* Friction Cone Circle (phi) */}
                        <circle
                          cx="0"
                          cy="0"
                          r={Math.abs(fricR)}
                          fill={isLight ? 'rgba(217, 119, 6, 0.10)' : 'rgba(245, 158, 11, 0.07)'}
                          stroke={isLight ? '#D97706' : '#F59E0B'}
                          strokeWidth="1.2"
                          strokeDasharray="4,3"
                        />

                        {/* Cardinal Labels */}
                        <text
                          x="0"
                          y={-R - 9}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill={isLight ? '#0F172A' : '#E2E8F0'}
                        >
                          N
                        </text>
                        <text
                          x={R + 12}
                          y="3"
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="600"
                          fill={isLight ? '#475569' : '#94A3B8'}
                        >
                          E
                        </text>
                        <text
                          x="0"
                          y={R + 15}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="600"
                          fill={isLight ? '#475569' : '#94A3B8'}
                        >
                          S
                        </text>
                        <text
                          x={-R - 12}
                          y="3"
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="600"
                          fill={isLight ? '#475569' : '#94A3B8'}
                        >
                          W
                        </text>

                        {/* Tunnel Drive Axis Vector */}
                        <line
                          x1={-driveX}
                          y1={-driveY}
                          x2={driveX}
                          y2={driveY}
                          stroke={isLight ? '#0284C7' : '#38BDF8'}
                          strokeWidth="2"
                          strokeDasharray="5,3"
                        />
                        <circle cx={driveX} cy={driveY} r="4" fill={isLight ? '#0284C7' : '#38BDF8'} />

                        {/* Great Circles for Joint Sets */}
                        {jointSets.map((js) => {
                          if (js.avgDip === null || js.avgDipDirection === null) return null;
                          const color = SET_COLORS[js.id] || '#38BDF8';
                          const strikeDeg = (js.avgDipDirection - 90 + 360) % 360;
                          const dipRad = (Math.max(1, Math.min(89, js.avgDip)) * Math.PI) / 180;
                          const pts: string[] = [];
                          for (let a = 0; a <= 180; a += 6) {
                            const rakeRad = (a * Math.PI) / 180;
                            const trend = (strikeDeg + ( Math.atan2(Math.sin(rakeRad) * Math.cos(dipRad), Math.cos(rakeRad)) * 180) / Math.PI + 360) % 360;
                            const sinPlunge = Math.sin(rakeRad) * Math.sin(dipRad);
                            const plunge = (Math.asin(Math.max(-1, Math.min(1, sinPlunge))) * 180) / Math.PI;
                            const p = projectPlungeTrend(plunge, trend);
                            pts.push(`${a === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
                          }
                          return (
                            <path
                              key={`gc-${js.id}`}
                              d={pts.join(' ')}
                              fill="none"
                              stroke={color}
                              strokeWidth="1.8"
                              strokeOpacity="0.85"
                            />
                          );
                        })}

                        {/* Poles for Individual Mapped Joints */}
                        {joints.map((j) => {
                          const polePlunge = Math.max(0, 90 - j.dip);
                          const poleTrend = (j.dipDirection + 180) % 360;
                          const p = projectPlungeTrend(polePlunge, poleTrend);
                          const color = SET_COLORS[j.set] || '#F43F5E';
                          return (
                            <circle
                              key={`pole-${j.id}`}
                              cx={p.x}
                              cy={p.y}
                              r="3.8"
                              fill={color}
                              stroke={isLight ? '#FFFFFF' : '#0F172A'}
                              strokeWidth="1"
                            >
                              <title>
                                {j.set}: Dip {Math.round(j.dip)}° / Dip Dir {Math.round(j.dipDirection)}°
                              </title>
                            </circle>
                          );
                        })}

                        {/* Wedge Line-of-Intersection Points */}
                        {summary.kinematicWedges.map((w) => {
                          const p = projectPlungeTrend(w.intersectionPlungeDeg, w.intersectionTrendDeg);
                          return (
                            <rect
                              key={`wi-${w.id}`}
                              x={p.x - 3.5}
                              y={p.y - 3.5}
                              width="7"
                              height="7"
                              fill={w.riskLevel === 'CRITICAL' ? '#F43F5E' : '#F59E0B'}
                              stroke="#FFFFFF"
                              strokeWidth="1"
                              transform={`rotate(45, ${p.x}, ${p.y})`}
                            >
                              <title>
                                {w.pairLabel} Intersection: {w.intersectionPlungeDeg.toFixed(1)}° / {Math.round(w.intersectionTrendDeg)}° (FoS={w.factorOfSafetyDry.toFixed(2)})
                              </title>
                            </rect>
                          );
                        })}
                      </svg>
                    );
                  })()}

                  <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                    <span className="text-amber-300">Friction Cone φ = {frictionAngleDeg}°</span>
                    <input
                      type="range"
                      min="18"
                      max="45"
                      step="1"
                      value={frictionAngleDeg}
                      onChange={(e) => setFrictionAngleDeg(Number(e.target.value))}
                      className="w-28 accent-amber-500"
                    />
                    <span className="text-cyan-300">Drive N {Math.round(settings.driveDirection)}° E</span>
                  </div>
                </div>

                {/* Right: Markland Kinematic Failure Modes Summary (Planar, Wedge, Toppling, Keyblock) */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Markland &amp; Goodman-Shi Kinematic Feasibility Summary
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Evaluates Planar Sliding, Wedge Sliding, Direct/Flexural Toppling, and Crown Keyblock Fallout against Tunnel Drive{' '}
                      <strong className="text-cyan-300">N {Math.round(settings.driveDirection)}° E</strong> and Friction Angle{' '}
                      <strong className="text-amber-300">φ = {frictionAngleDeg}°</strong>.
                    </p>
                  </div>

                  {(() => {
                    const planarRisks = jointSets.filter((js) => {
                      if (js.avgDip === null || js.avgDipDirection === null) return false;
                      const diffFace = Math.abs(((js.avgDipDirection - settings.driveDirection + 540) % 360) - 180);
                      const diffLeft = Math.abs(((js.avgDipDirection - ((settings.driveDirection + 90) % 360) + 540) % 360) - 180);
                      const diffRight = Math.abs(((js.avgDipDirection - ((settings.driveDirection + 270) % 360) + 540) % 360) - 180);
                      return js.avgDip > frictionAngleDeg && (diffFace <= 25 || diffLeft <= 25 || diffRight <= 25);
                    });

                    const topplingRisks = jointSets.filter((js) => {
                      if (js.avgDip === null || js.avgDipDirection === null) return false;
                      const oppFace = Math.abs(((js.avgDipDirection - ((settings.driveDirection + 180) % 360) + 540) % 360) - 180);
                      return js.avgDip >= 60 && oppFace <= 30;
                    });

                    const wedgeSlidingRisks = summary.kinematicWedges.filter(
                      (w) => w.failureMode === 'SIDEWALL_SLIDING_WEDGE' && w.riskLevel !== 'STABLE'
                    );
                    const crownFalloutRisks = summary.kinematicWedges.filter(
                      (w) => w.failureMode === 'CROWN_GRAVITY_WEDGE' && w.riskLevel !== 'STABLE'
                    );

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-300">1. Planar Sliding</span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                planarRisks.length > 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {planarRisks.length > 0 ? `${planarRisks.length} Set(s) Feasible` : 'Stable'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Daylighting planes with Dip &gt; φ ({frictionAngleDeg}°) within ±25° of Face/Wall normal.
                          </div>
                          <div className="text-[11px] font-mono text-slate-200">
                            {planarRisks.length > 0
                              ? planarRisks.map((s) => `${s.id} (${s.avgDip}°/${s.avgDipDirection}°)`).join(', ')
                              : 'No critical planar daylighting sets'}
                          </div>
                        </div>

                        <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300">2. 3D Wedge Sliding</span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                wedgeSlidingRisks.length > 0
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {wedgeSlidingRisks.length > 0
                                ? `${wedgeSlidingRisks.length} Wedge(s) Risk`
                                : 'Stable'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Intersecting planes (I = Jₐ × J_b) plunging &gt; φ into tunnel excavation.
                          </div>
                          <div className="text-[11px] font-mono text-slate-200">
                            {wedgeSlidingRisks.length > 0
                              ? wedgeSlidingRisks.map((w) => `${w.pairLabel} (FoS ${w.factorOfSafetyDry.toFixed(2)})`).join(', ')
                              : 'All wedge intersections FoS ≥ 1.8'}
                          </div>
                        </div>

                        <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-300">3. Flexural / Direct Toppling</span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                topplingRisks.length > 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {topplingRisks.length > 0 ? `${topplingRisks.length} Set(s) Steep` : 'Stable'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Steeply dipping planes (Dip ≥ 60°) dipping into face/wall subject to overturning.
                          </div>
                          <div className="text-[11px] font-mono text-slate-200">
                            {topplingRisks.length > 0
                              ? topplingRisks.map((s) => `${s.id} (${s.avgDip}°/${s.avgDipDirection}°)`).join(', ')
                              : 'No steep anti-dip toppling sets'}
                          </div>
                        </div>

                        <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-300">4. Crown Keyblock Fallout</span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                crownFalloutRisks.length > 0
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {crownFalloutRisks.length > 0
                                ? `${crownFalloutRisks.length} Crown Block(s)`
                                : 'Stable'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Steep intersections in Crown/Arch susceptible to gravity release.
                          </div>
                          <div className="text-[11px] font-mono text-slate-200">
                            {crownFalloutRisks.length > 0
                              ? crownFalloutRisks.map((w) => `${w.pairLabel} (${w.estimatedMassTonnes.toFixed(1)}t)`).join(', ')
                              : 'No unstable crown gravity keyblocks'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      {jointSets.map((js) => (
                        <span key={js.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: SET_COLORS[js.id] || '#38BDF8' }}
                          />
                          <strong className="text-white">{js.id}</strong>: {js.avgDip}°/{String(js.avgDipDirection).padStart(3, '0')}°
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded p-3">
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">Goodman & Shi (1985) 3D Vector Wedge & Planar Analysis:</span>{' '}
                  Evaluates all intersecting joint sets (<span className="font-mono text-cyan-300">I = n₁ × n₂</span>) against Tunnel Drive Azimuth{' '}
                  <span className="font-mono text-amber-300">N {Math.round(settings.driveDirection)}° E</span> and span{' '}
                  <span className="font-mono text-amber-300">{geometry.width.toFixed(2)}m × {geometry.height.toFixed(2)}m</span> using Barton-Bandis mobilized shear strength.
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Critical (FoS &lt; 1.3): {criticalWedgeCount}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Moderate (1.3–1.8): {moderateWedgeCount}
                  </span>
                </div>
              </div>

              {summary.kinematicWedges.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded text-slate-400 text-sm">
                  Map or auto-detect at least 1–2 joint sets on the tunnel surfaces to compute 3D kinematic wedges and block stability.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Intersecting Sets</th>
                        <th className="py-2.5 px-3">Failure Mode</th>
                        <th className="py-2.5 px-3">Excavation Surface</th>
                        <th className="py-2.5 px-3 font-mono">Line of Intersection (Plunge / Trend)</th>
                        <th className="py-2.5 px-3 font-mono">Apex Height</th>
                        <th className="py-2.5 px-3 font-mono">Block Vol / Mass</th>
                        <th className="py-2.5 px-3 font-mono">FoS (Dry / Wet)</th>
                        <th className="py-2.5 px-3">Stability Risk</th>
                        <th className="py-2.5 px-3">Recommended Support</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {summary.kinematicWedges.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                            {w.pairLabel}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            {w.failureMode.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{w.affectedSurface}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">
                            {w.intersectionPlungeDeg.toFixed(1)}° / {String(Math.round(w.intersectionTrendDeg)).padStart(3, '0')}°
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">
                            {w.wedgeApexHeightMeters.toFixed(2)} m
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">
                            {w.estimatedVolumeM3.toFixed(2)} m³ ({w.estimatedMassTonnes.toFixed(1)} t)
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={
                                w.factorOfSafetyDry < 1.3
                                  ? 'text-rose-400 font-bold'
                                  : w.factorOfSafetyDry < 1.8
                                  ? 'text-amber-300 font-semibold'
                                  : 'text-emerald-400'
                              }
                            >
                              {w.factorOfSafetyDry.toFixed(2)}
                            </span>
                            <span className="text-slate-500"> / </span>
                            <span
                              className={
                                w.factorOfSafetyWater < 1.2
                                  ? 'text-rose-400 font-bold'
                                  : 'text-slate-300'
                              }
                            >
                              {w.factorOfSafetyWater.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {w.riskLevel === 'CRITICAL' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <AlertTriangle className="w-3 h-3" /> CRITICAL
                              </span>
                            ) : w.riskLevel === 'MODERATE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="w-3 h-3" /> MODERATE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3" /> STABLE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-200">
                            L = {w.recommendedBoltLengthM.toFixed(1)}m @ {w.recommendedBoltSpacingM.toFixed(1)}m c/c
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'perimeter' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 rounded p-3.5">
                <div className="text-xs text-slate-300 max-w-3xl">
                  <span className="font-bold text-emerald-300">
                    Unwrapped Wall &amp; Crown 3D Perimeter Strip (Left Wall ↔ Crown ↔ Right Wall):
                  </span>{' '}
                  Strictly displays traces mapped on the{' '}
                  <span className="font-mono text-cyan-300">Left Wall</span>,{' '}
                  <span className="font-mono text-cyan-300">Crown Arch</span>, and{' '}
                  <span className="font-mono text-cyan-300">Right Wall</span> along Tunnel Drive{' '}
                  <span className="font-mono text-amber-300">
                    N {Math.round(settings.driveDirection)}° E
                  </span>{' '}
                  (Round Pull{' '}
                  <span className="font-mono text-amber-300">{settings.roundLength.toFixed(1)} m</span>
                  ). Tunnel Face traces are excluded from the 3D wall/crown strip.
                </div>
              </div>

              {/* Interactive Unfolded Perimeter SVG Strip */}
              <div className="bg-slate-950 border border-slate-800 rounded p-4">
                {(() => {
                  const wallH = Math.max(2.0, geometry.wallHeight || 4.2);
                  const crownW = Math.max(3.0, geometry.crownArcLength || geometry.width * 1.25);
                  const pullL = Math.max(1.5, settings.roundLength || 3.5);
                  const totalUnfoldedW = wallH * 2 + crownW;
                  const scale = Math.min(680 / totalUnfoldedW, 180 / pullL);

                  const lwW = wallH * scale;
                  const crW = crownW * scale;
                  const rwW = wallH * scale;
                  const stripH = pullL * scale;

                  const startX = (780 - (lwW + crW + rwW)) / 2;
                  const topY = 36;

                  const mapSurfPt = (pt: { x: number; y: number }, surf: 'leftWall' | 'crown' | 'rightWall') => {
                    const u2d =
                      surf === 'crown'
                        ? Math.max(0, Math.min(1, (pt.x + crownW * 0.5) / Math.max(0.5, crownW)))
                        : Math.max(0, Math.min(1, pt.x / Math.max(0.5, pullL)));
                    const v2d =
                      surf === 'crown'
                        ? Math.max(0, Math.min(1, 1 - pt.y / Math.max(0.5, pullL)))
                        : Math.max(0, Math.min(1, 1 - pt.y / Math.max(0.5, wallH)));
                    // Rotate 2D unwrapped trace 90° clockwise
                    const u3d = 1 - v2d;
                    const v3d = u2d;
                    const py = topY + (1 - u3d) * stripH;
                    if (surf === 'leftWall') {
                      const px = startX + v3d * lwW;
                      return { x: px, y: py };
                    }
                    if (surf === 'crown') {
                      const px = startX + lwW + v3d * crW;
                      return { x: px, y: py };
                    }
                    const px = startX + lwW + crW + v3d * rwW;
                    return { x: px, y: py };
                  };

                  return (
                    <svg
                      viewBox="0 0 780 260"
                      className={`w-full h-[250px] rounded border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#070B12] border-slate-800'
                      }`}
                    >
                      {/* Left Wall Panel */}
                      <rect
                        x={startX}
                        y={topY}
                        width={lwW}
                        height={stripH}
                        fill={isLight ? '#FFFFFF' : '#0F172A'}
                        stroke={isLight ? '#0284C7' : '#38BDF8'}
                        strokeWidth="1.5"
                      />
                      <text
                        x={startX + lwW / 2}
                        y={topY - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill={isLight ? '#0369A1' : '#38BDF8'}
                      >
                        LEFT WALL ({wallH.toFixed(1)}m)
                      </text>

                      {/* Crown Arch Panel */}
                      <rect
                        x={startX + lwW}
                        y={topY}
                        width={crW}
                        height={stripH}
                        fill={isLight ? '#F0F9FF' : '#111C33'}
                        stroke={isLight ? '#0891B2' : '#22D3EE'}
                        strokeWidth="1.8"
                      />
                      <text
                        x={startX + lwW + crW / 2}
                        y={topY - 10}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="700"
                        fill={isLight ? '#0E7490' : '#22D3EE'}
                      >
                        UNFOLDED CROWN ARCH ({crownW.toFixed(2)}m × Pull {pullL.toFixed(1)}m)
                      </text>

                      {/* Right Wall Panel */}
                      <rect
                        x={startX + lwW + crW}
                        y={topY}
                        width={rwW}
                        height={stripH}
                        fill={isLight ? '#FFFFFF' : '#0F172A'}
                        stroke={isLight ? '#0284C7' : '#38BDF8'}
                        strokeWidth="1.5"
                      />
                      <text
                        x={startX + lwW + crW + rwW / 2}
                        y={topY - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill={isLight ? '#0369A1' : '#38BDF8'}
                      >
                        RIGHT WALL ({wallH.toFixed(1)}m)
                      </text>

                      {/* Fold Lines */}
                      <line
                        x1={startX + lwW}
                        y1={topY}
                        x2={startX + lwW}
                        y2={topY + stripH}
                        stroke={isLight ? '#D97706' : '#F59E0B'}
                        strokeWidth="1.4"
                        strokeDasharray="4,3"
                      />
                      <line
                        x1={startX + lwW + crW}
                        y1={topY}
                        x2={startX + lwW + crW}
                        y2={topY + stripH}
                        stroke={isLight ? '#D97706' : '#F59E0B'}
                        strokeWidth="1.4"
                        strokeDasharray="4,3"
                      />

                      {/* Existing Mapped Traces on Left Wall, Crown, Right Wall Only (Face Excluded) */}
                      {joints
                        .filter(
                          (j) =>
                            (j.surface === 'leftWall' ||
                              j.surface === 'crown' ||
                              j.surface === 'rightWall') &&
                            j.geometry.length >= 2
                        )
                        .map((j) => {
                          const surf = j.surface as 'leftWall' | 'crown' | 'rightWall';
                          const d = j.geometry
                            .map((pt, idx) => {
                              const p = mapSurfPt(pt, surf);
                              return `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                            })
                            .join(' ');
                          const col = SET_COLORS[j.set] || '#22C55E';
                          const midPt = j.geometry[Math.floor(j.geometry.length / 2)] || j.geometry[0];
                          const mid = mapSurfPt(midPt, surf);
                          return (
                            <g key={`mapped-${j.id}`}>
                              <path
                                d={d}
                                fill="none"
                                stroke={col}
                                strokeWidth="2.4"
                              />
                              <text
                                x={mid.x + 4}
                                y={mid.y - 4}
                                fontSize="9"
                                fontWeight="700"
                                fill={col}
                              >
                                {j.set} ({Math.round(j.dip)}°/{Math.round(j.dipDirection)}°)
                              </text>
                            </g>
                          );
                        })}

                      <text
                        x="390"
                        y={topY + stripH + 22}
                        textAnchor="middle"
                        fontSize="10"
                        fill={isLight ? '#475569' : '#94A3B8'}
                      >
                        Unwrapped 3D Perimeter Rollout: Strictly Left Wall, Crown Arch &amp; Right Wall Mapped Traces Only (Face Traces Excluded)
                      </text>
                    </svg>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'seepage' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 rounded p-3.5">
                <div className="text-xs text-slate-300">
                  <span className="font-bold text-sky-300">
                    Groundwater &amp; Seepage Zone Sketching (L/min per 10m → Q-System Jw &amp; RMR Groundwater):
                  </span>{' '}
                  Total Station Inflow:{' '}
                  <strong className="text-white font-mono">
                    {gwSummary.totalInflowLPerMin10m} L/min
                  </strong>{' '}
                  ({gwSummary.governingCondition}) → Suggested{' '}
                  <strong className="text-cyan-300 font-mono">Jw = {gwSummary.recommendedJw}</strong> &amp;{' '}
                  <strong className="text-indigo-300 font-mono">
                    RMR GW Rating = {gwSummary.recommendedRmrRating}
                  </strong>
                </div>

                {onApplyGroundwaterToClassification && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyGroundwaterToClassification(
                        gwSummary.recommendedJw,
                        gwSummary.jwDescription,
                        gwSummary.recommendedRmrRating,
                        gwSummary.totalInflowLPerMin10m,
                        gwSummary.rmrDescription
                      );
                      setGwAppliedBanner(
                        `Confirmed & applied Jw = ${gwSummary.recommendedJw} and RMR Groundwater Rating = ${gwSummary.recommendedRmrRating} (${gwSummary.totalInflowLPerMin10m} L/min).`
                      );
                    }}
                    className="px-3.5 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow cursor-pointer"
                  >
                    Apply &amp; Confirm Groundwater to Q-System (Jw) &amp; RMR
                  </button>
                )}
              </div>

              {gwAppliedBanner && (
                <div className="px-3.5 py-2 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono">
                  ✓ {gwAppliedBanner}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Add Seepage Zone Form */}
                <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded p-4 space-y-3 text-xs">
                  <div className="font-bold text-sky-300 uppercase tracking-wider">
                    + Sketch / Log Groundwater Seepage Zone
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Tunnel Surface</span>
                      <select
                        value={newSeepageSurface}
                        onChange={(e) => setNewSeepageSurface(e.target.value as SurfaceType)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      >
                        <option value="face">Tunnel Face</option>
                        <option value="crown">Crown Arch</option>
                        <option value="leftWall">Left Wall</option>
                        <option value="rightWall">Right Wall</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Water Condition</span>
                      <select
                        value={newSeepageCondition}
                        onChange={(e) => {
                          const c = e.target.value as SeepageConditionType;
                          setNewSeepageCondition(c);
                          setNewSeepageInflow(String(SEEPAGE_CONDITION_CATALOG[c].defaultInflowLMin));
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      >
                        <option value="DRY">Dry (0 L/min)</option>
                        <option value="DAMP">Damp (&lt; 5 L/min)</option>
                        <option value="DRIPPING">Dripping (10–25 L/min)</option>
                        <option value="FLOWING">Flowing (25–125 L/min)</option>
                        <option value="HIGH_PRESSURE">High Pressure (&gt; 125 L/min)</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Estimated Inflow (L/min)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={newSeepageInflow}
                        onChange={(e) => setNewSeepageInflow(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-mono font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Geological Note</span>
                      <input
                        type="text"
                        value={newSeepageNotes}
                        onChange={(e) => setNewSeepageNotes(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextZone: GroundwaterSeepageZone = {
                        id: `GW-${Date.now().toString().slice(-4)}`,
                        surface: newSeepageSurface,
                        condition: newSeepageCondition,
                        inflowLPerMin: Math.max(0, parseFloat(newSeepageInflow) || 0),
                        locationX: 0,
                        locationY: geometry.height * 0.55,
                        radiusMeters: 0.85,
                        notes: newSeepageNotes,
                      };
                      setSeepageZones((prev) => [...prev, nextZone]);
                    }}
                    className="w-full py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                  >
                    + Add Groundwater Seepage Zone
                  </button>
                </div>

                {/* Logged Seepage Zones Table */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Mapped Seepage Zones ({seepageZones.length})
                    </span>
                    <span className="text-[11px] font-mono text-sky-300">
                      {gwSummary.jwDescription}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                          <th className="py-2 px-2.5">ID</th>
                          <th className="py-2 px-2.5">Surface</th>
                          <th className="py-2 px-2.5">Condition</th>
                          <th className="py-2 px-2.5 font-mono">Inflow (L/min)</th>
                          <th className="py-2 px-2.5">Notes</th>
                          <th className="py-2 px-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {seepageZones.map((z) => (
                          <tr key={z.id}>
                            <td className="py-2 px-2.5 font-mono font-bold text-sky-300">{z.id}</td>
                            <td className="py-2 px-2.5 uppercase text-[11px]">{z.surface}</td>
                            <td className="py-2 px-2.5">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold"
                                style={{
                                  backgroundColor: `${SEEPAGE_CONDITION_CATALOG[z.condition].colorHex}25`,
                                  color: SEEPAGE_CONDITION_CATALOG[z.condition].colorHex,
                                }}
                              >
                                {z.condition}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-mono font-bold text-white">
                              {z.inflowLPerMin} L/min
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">{z.notes}</td>
                            <td className="py-2 px-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setSeepageZones((prev) => prev.filter((item) => item.id !== z.id))
                                }
                                className="text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'jrc' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded p-3 text-xs text-slate-300">
                <span className="font-semibold text-white">Tse & Cruden (1979) Z₂ + Barton-Bandis (1982) Scale-Corrected Roughness:</span>{' '}
                Computes the root-mean-square first derivative <span className="font-mono text-cyan-300">Z₂ = √[ (1/L) ∫ (dy/dx)² dx ]</span> along every multi-vertex photogrammetric trace, converts to Lab <span className="font-mono text-cyan-300">JRC₀ = 32.2 + 32.47 log₁₀(Z₂)</span>, and applies field scale correction <span className="font-mono text-amber-300">JRCₙ = JRC₀ (Lₙ/L₀)^(-0.02 JRC₀)</span> and Terzaghi angular blind-zone weight <span className="font-mono text-emerald-300">W_T = 1 / sin(α)</span>.
              </div>

              {joints.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded text-slate-400 text-sm">
                  No geological discontinuities mapped yet. Run AI + CV Hybrid Trace or draw joints on the photograph.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Joint ID</th>
                        <th className="py-2.5 px-3">Surface / Set</th>
                        <th className="py-2.5 px-3 font-mono">Dip / Dip Dir</th>
                        <th className="py-2.5 px-3 font-mono">Length Lₙ</th>
                        <th className="py-2.5 px-3 font-mono">Z₂ (RMS Slope)</th>
                        <th className="py-2.5 px-3 font-mono">Rp Index</th>
                        <th className="py-2.5 px-3 font-mono">JRC₀ → Field JRCₙ</th>
                        <th className="py-2.5 px-3 font-mono">Peak φ_p (JCS)</th>
                        <th className="py-2.5 px-3 font-mono">Terzaghi W_T</th>
                        <th className="py-2.5 px-3">ISRM Roughness Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {summary.jrcProfiles.map((prof, idx) => {
                        const j = joints.find((jt) => jt.id === prof.jointId) || joints[idx];
                        if (!j) return null;
                        const wT = j.terzaghiWeight ?? 1.25;
                        return (
                          <tr
                            key={prof.jointId}
                            onClick={() => onSelectJoint && onSelectJoint(j.id, j.surface)}
                            className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3 font-mono font-bold text-cyan-300">
                              {j.jointNumber || `J-${idx + 1}`}
                            </td>
                            <td className="py-2 px-3">
                              <span className="uppercase text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 mr-1.5">
                                {j.surface}
                              </span>
                              <span className="font-mono font-bold text-amber-300">{prof.set}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-200">
                              {String(Math.round(j.dip)).padStart(2, '0')}° / {String(Math.round(j.dipDirection)).padStart(3, '0')}°
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-200">
                              {j.persistenceMeters.toFixed(2)} m
                            </td>
                            <td className="py-2 px-3 font-mono text-cyan-300">
                              {prof.z2RmsDerivative.toFixed(4)}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-300">
                              {prof.rpRoughnessIndex.toFixed(4)}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              <span className="text-slate-400">{prof.jrc0LabScale.toFixed(1)}</span>
                              <span className="text-slate-500"> → </span>
                              <span className="font-bold text-emerald-300">{prof.jrcNFieldScale.toFixed(1)}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-amber-300">
                              {prof.peakFrictionAngleDeg.toFixed(1)}° ({prof.jcsMPa} MPa)
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-300">
                              {wT.toFixed(2)}×
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-300">
                              {prof.isrmRoughnessClass}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pointcloud' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Isometric 3D Point Cloud Canvas Preview */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    3D Isometric Tunnel Point Cloud & Fracture Normal Vectors ({pointCloud.length.toLocaleString()} pts)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Drive: N {Math.round(settings.driveDirection)}° E · Span {geometry.width.toFixed(2)}m × {geometry.height.toFixed(2)}m
                  </span>
                </div>

                <div
                  className={`flex-1 min-h-[300px] flex items-center justify-center rounded border overflow-hidden ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-900/60 border-slate-800/80'
                  }`}
                >
                  <svg viewBox="-220 -170 440 340" className="w-full h-[310px]">
                    {/* Coordinate axes */}
                    <g stroke={isLight ? '#94A3B8' : '#334155'} strokeWidth="1" strokeDasharray="3 3">
                      <line x1="-180" y1="110" x2="180" y2="110" />
                      <line x1="0" y1="-140" x2="0" y2="140" />
                    </g>
                    {/* Render sampled 3D point cloud in oblique isometric projection */}
                    {pointCloud.slice(0, 1200).map((pt, i) => {
                      const scale = 24 / Math.max(1, geometry.width / 6);
                      const isoX = (pt.x - pt.z * 0.48) * scale;
                      const isoY = (-pt.y + (geometry.height * 0.45) - pt.z * 0.28) * scale;
                      const isJointPt = Boolean(pt.jointId);
                      return (
                        <g key={i}>
                          <circle
                            cx={isoX}
                            cy={isoY}
                            r={isJointPt ? 2.3 : 1.1}
                            fill={`rgb(${pt.r}, ${pt.g}, ${pt.b})`}
                            fillOpacity={isJointPt ? 0.95 : 0.38}
                          />
                          {isJointPt && i % 3 === 0 && (
                            <line
                              x1={isoX}
                              y1={isoY}
                              x2={isoX + pt.nx * 9}
                              y2={isoY - pt.ny * 9}
                              stroke={`rgb(${pt.r}, ${pt.g}, ${pt.b})`}
                              strokeWidth="0.9"
                              strokeOpacity="0.8"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Photogrammetry Export & Pipeline Specifications */}
              <div className="bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Photogrammetric Structure-from-Motion (SfM) Compatibility
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Every traced discontinuity is reconstructed in 3D tunnel coordinates{' '}
                    <span className="font-mono text-cyan-300">(East, North, Up)</span> with local relief depth{' '}
                    <span className="font-mono text-cyan-300">ΔZ</span> and outward rock normal vectors{' '}
                    <span className="font-mono text-cyan-300">(nx, ny, nz)</span>.
                  </p>
                  <div className="space-y-2 text-[11px] text-slate-300 bg-slate-900/90 p-3 rounded border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sub-Pixel Ridge Tracker:</span>
                      <span className="font-mono text-emerald-300">Steger 2nd-Order Taylor</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Illumination Invariance:</span>
                      <span className="font-mono text-cyan-300">Log-Gabor Phase Congruency</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">3D Plane Orientation Solver:</span>
                      <span className="font-mono text-amber-300">Huber IRLS + SVD Eigenvector</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sampling Bias Correction:</span>
                      <span className="font-mono text-indigo-300">Terzaghi + Mauldon MLE</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={handleDownloadPLY}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Stanford .PLY 3D Point Cloud</span>
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold bg-emerald-600/90 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download Rocscience DIPS / UnWedge .CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
