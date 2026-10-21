import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pickaxe,
  ArrowLeft,
  Database,
  Layers,
  Shield,
  Activity,
  Download,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Sparkles,
  Compass,
  Maximize2,
  Eye,
  EyeOff,
  Edit3,
  DollarSign,
  Truck,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  Upload,
  Image as ImageIcon,
  Save,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Grid,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo } from '../EswaBrandIdentity';
import { IndustryMode, MineralizedVeinRecord, FaceChannelSampleRecord } from '../../types/tunnel';
import {
  MiningSurfaceType,
  MiningGeologicalFeature,
  MiningGeologicalFeatureType,
  MiningGeologicalPoint,
  MiningPhotoCalibration,
  MiningStopeItem,
  MiningProjectItem,
} from '../../types/mining';
import { MiningDataStorageModal } from './MiningDataStorageModal';
import {
  loadMiningStopes,
  saveMiningStopes,
  getActiveMiningStopeId,
  setActiveMiningStopeId,
  updateMiningStope,
  loadMiningProjects,
  getActiveMiningProjectId,
} from '../../engine/miningStorageEngine';

export interface MiningMappingWorkspaceProps {
  onBackToMainWindow: () => void;
  onChangeIndustryMode: (mode: IndustryMode) => void;
}

export type RightPanelTab = 'LAYERS' | 'CHANNELS' | 'MATHEWS' | 'STEREONET' | 'REPORTS';

export const MiningMappingWorkspace: React.FC<MiningMappingWorkspaceProps> = ({
  onBackToMainWindow,
  onChangeIndustryMode,
}) => {
  // Persistence & Selection
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const stopes = useMemo(() => loadMiningStopes(), [isStorageModalOpen]);
  const activeStopeId = getActiveMiningStopeId() || stopes[0]?.id;
  const currentStope = useMemo(() => stopes.find((s) => s.id === activeStopeId) || stopes[0], [stopes, activeStopeId]);

  const projects = useMemo(() => loadMiningProjects(), [isStorageModalOpen]);
  const activeProjectId = getActiveMiningProjectId() || projects[0]?.id;
  const currentProject = useMemo(() => projects.find((p) => p.id === activeProjectId) || projects[0], [projects, activeProjectId]);

  // Surface Selection (Part C4)
  const [activeSurface, setActiveSurface] = useState<MiningSurfaceType>('DEVELOPMENT_FACE');

  // Stope Configuration Parameters
  const [mineLevel, setMineLevel] = useState<string>(currentStope?.mineLevel || 'Level 620 mRL');
  const [driftId, setDriftId] = useState<string>(currentStope?.stopeOrDriftId || 'HW-DRV-04');
  const [oreBodyName, setOreBodyName] = useState<string>(currentStope?.oreBodyName || 'Champion Lode');
  const [excavationType, setExcavationType] = useState<string>(currentStope?.excavationType || 'ORE_DRIVE');
  const [miningMethod, setMiningMethod] = useState<string>(currentStope?.miningMethod || 'SUBLEVEL_OPEN_STOPING');
  const [commodity, setCommodity] = useState<string>('Gold (Au)');
  const [cutoffGrade, setCutoffGrade] = useState<number>(currentStope?.targetCutoffGrade || 2.50);
  const [blastPull, setBlastPull] = useState<number>(currentStope?.blastPullMeters || 3.2);
  const [stopeWidth, setStopeWidth] = useState<number>(currentStope?.stopeWidthM || 4.8);
  const [stopeHeight, setStopeHeight] = useState<number>(currentStope?.stopeHeightM || 4.2);
  const [oreSg, setOreSg] = useState<number>(currentStope?.oreSpecificGravity || 3.35);
  const [wasteSg, setWasteSg] = useState<number>(currentStope?.wasteSpecificGravity || 2.72);
  const [hangingwallDip, setHangingwallDip] = useState<number>(currentStope?.hangingwallDipDeg || 74);
  const [footwallDip, setFootwallDip] = useState<number>(currentStope?.footwallDipDeg || 68);

  // Economic Parameters
  const [metalPriceAuOz, setMetalPriceAuOz] = useState<number>(2650);
  const [miningCostPerTonne, setMiningCostPerTonne] = useState<number>(68);
  const [millingCostPerTonne, setMillingCostPerTonne] = useState<number>(34);

  // UI Panels state
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('LAYERS');

  // Active Drawing Tool (Part C5)
  const [activeTool, setActiveTool] = useState<MiningGeologicalFeatureType | 'SELECT' | 'PAN' | 'ERASE'>('SELECT');
  const [activeGeometryMode, setActiveGeometryMode] = useState<'POLYLINE' | 'POLYGON' | 'POINT'>('POLYLINE');

  // Active Drawn Geological Features (Canvas Layers)
  const [features, setFeatures] = useState<MiningGeologicalFeature[]>(currentStope?.features || [
    {
      id: 'FT-01',
      surfaceType: 'DEVELOPMENT_FACE',
      featureType: 'ORE_BOUNDARY',
      geometryType: 'POLYGON',
      points: [
        { x: 1.8, y: 0.0 },
        { x: 2.0, y: 4.2 },
        { x: 3.2, y: 4.2 },
        { x: 3.0, y: 0.0 },
      ],
      name: 'Champion Quartz-Sulfide Main Ore Lode',
      colorHex: '#F59E0B',
      strokeWidth: 3,
      fillOpacity: 0.35,
      dipDeg: 74,
      dipDirectionDeg: 285,
      strikeDeg: 15,
      trueThicknessM: 1.45,
      lithologyCode: 'QZ-SULF',
      mineralogyNotes: 'Smoky ribbon quartz with coarse visible gold specs, pyrite (4%) & arsenopyrite',
      visible: true,
    },
    {
      id: 'FT-02',
      surfaceType: 'DEVELOPMENT_FACE',
      featureType: 'ALTERATION_HALO',
      geometryType: 'POLYGON',
      points: [
        { x: 1.2, y: 0.0 },
        { x: 1.4, y: 4.2 },
        { x: 1.8, y: 4.2 },
        { x: 1.8, y: 0.0 },
      ],
      name: 'Hangingwall Biotite-Sericite Alteration Halo',
      colorHex: '#38BDF8',
      strokeWidth: 1.5,
      fillOpacity: 0.2,
      dipDeg: 72,
      dipDirectionDeg: 280,
      trueThicknessM: 0.60,
      lithologyCode: 'ALT-HW',
      mineralogyNotes: 'Intense chlorite-biotite-carbonate alteration in country rock',
      visible: true,
    },
    {
      id: 'FT-03',
      surfaceType: 'DEVELOPMENT_FACE',
      featureType: 'FAULT',
      geometryType: 'POLYLINE',
      points: [
        { x: 0.8, y: 0.0 },
        { x: 1.1, y: 2.5 },
        { x: 1.3, y: 4.2 },
      ],
      name: 'F-1 Hangingwall Shear Boundary',
      colorHex: '#EF4444',
      strokeWidth: 2.5,
      dipDeg: 76,
      dipDirectionDeg: 285,
      strikeDeg: 15,
      infill: '15mm graphitic clay gouge with slickensides',
      waterInflow: 'DAMP',
      visible: true,
    },
    {
      id: 'FT-04',
      surfaceType: 'DEVELOPMENT_FACE',
      featureType: 'JOINT',
      geometryType: 'POLYLINE',
      points: [
        { x: 3.5, y: 3.8 },
        { x: 4.6, y: 1.2 },
      ],
      name: 'J2 Cross Joint Fracture',
      colorHex: '#A855F7',
      strokeWidth: 1.8,
      dipDeg: 58,
      dipDirectionDeg: 110,
      strikeDeg: 200,
      roughness: 'Smooth Planar',
      infill: 'Calcite / chlorite coating',
      waterInflow: 'DRY',
      visible: true,
    },
  ]);

  // Channel Samples (Part C8)
  const [channelSamples, setChannelSamples] = useState<FaceChannelSampleRecord[]>(currentStope?.channelSamples || [
    {
      id: 'CH-01',
      sampleNumber: 'CH-01-HW',
      fromMeter: 0.0,
      toMeter: 1.2,
      sampleLengthMeters: 1.2,
      assayGrade: 0.85,
      gradeValue: '0.85',
      specificGravity: 2.72,
      zoneCategory: 'WASTE',
      lithologyOrVein: 'Hangingwall Amphibolite Country Rock (Waste Dilution)',
      sampledBy: 'Dr. V. Raghavan',
      date: '2025-02-18',
      startPoint: { x: 0.2, y: 1.5 },
      endPoint: { x: 1.4, y: 1.5 },
    },
    {
      id: 'CH-02',
      sampleNumber: 'CH-02-ORE-HIGH',
      fromMeter: 1.2,
      toMeter: 2.9,
      sampleLengthMeters: 1.7,
      assayGrade: 9.62,
      gradeValue: '9.62',
      specificGravity: 3.35,
      zoneCategory: 'ORE',
      lithologyOrVein: 'Champion Quartz Lode with Coarse Visible Gold & Pyrite',
      sampledBy: 'Dr. V. Raghavan',
      date: '2025-02-18',
      startPoint: { x: 1.4, y: 1.5 },
      endPoint: { x: 3.1, y: 1.5 },
    },
    {
      id: 'CH-03',
      sampleNumber: 'CH-03-FW',
      fromMeter: 2.9,
      toMeter: 4.8,
      sampleLengthMeters: 1.9,
      assayGrade: 2.95,
      gradeValue: '2.95',
      specificGravity: 3.10,
      zoneCategory: 'LOW_GRADE',
      lithologyOrVein: 'Silicified Footwall Basalt with Disseminated Sulfides',
      sampledBy: 'Dr. V. Raghavan',
      date: '2025-02-18',
      startPoint: { x: 3.1, y: 1.5 },
      endPoint: { x: 4.8, y: 1.5 },
    },
  ]);

  // Photo Calibration (Part C3)
  const [photoCalibration, setPhotoCalibration] = useState<MiningPhotoCalibration>({
    imageUrl: currentStope?.facePhotoUrl || '',
    scalePixelsPerMeter: 80,
    originX: 0,
    originY: 0,
    opacity: 0.65,
    rotationDeg: 0,
    widthM: 4.8,
    heightM: 4.2,
    isCalibrated: false,
  });

  // Canvas Viewport & Navigation Transform
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>('FT-01');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDraftPoints, setCurrentDraftPoints] = useState<MiningGeologicalPoint[]>([]);

  // Overlays
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSupportOverlay, setShowSupportOverlay] = useState<boolean>(true);
  const [showPhoto, setShowPhoto] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVED'>('IDLE');

  // Mathews Stability & MRMR parameters (Part E)
  const [miningRqd, setMiningRqd] = useState<number>(85);
  const [miningJn, setMiningJn] = useState<number>(6);
  const [miningJr, setMiningJr] = useState<number>(1.5);
  const [miningJa, setMiningJa] = useState<number>(1.0);
  const [stressFactorA, setStressFactorA] = useState<number>(0.85);
  const [jointFactorB, setJointFactorB] = useState<number>(0.50);
  const [gravityFactorC, setGravityFactorC] = useState<number>(4.0);
  const [mrmrBaseRmr, setMrmrBaseRmr] = useState<number>(68);
  const [mrmrWeatheringPct, setMrmrWeatheringPct] = useState<number>(95);
  const [mrmrStressPct, setMrmrStressPct] = useState<number>(85);
  const [mrmrOrientationPct, setMrmrOrientationPct] = useState<number>(80);
  const [mrmrBlastingPct, setMrmrBlastingPct] = useState<number>(90);

  // Dilution and Grade Calculations (Part D)
  const dilutionCalcs = useMemo(() => {
    let totalMass = 0;
    let totalGradeWeighted = 0;
    let oreLen = 0;
    let wasteLen = 0;

    for (const s of channelSamples) {
      const l = Math.max(0.01, s.sampleLengthMeters || 1.0);
      const sg = s.specificGravity || (s.zoneCategory === 'WASTE' ? wasteSg : oreSg);
      const g = typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(s.gradeValue) || 0;
      totalMass += l * sg;
      totalGradeWeighted += l * sg * g;
      if (s.zoneCategory === 'WASTE') wasteLen += l;
      else oreLen += l;
    }

    const weightedFaceGrade = totalMass > 0 ? totalGradeWeighted / totalMass : 0;
    const totalFaceWidth = oreLen + wasteLen || stopeWidth;
    const oreFraction = oreLen / Math.max(0.1, totalFaceWidth);
    const wasteFraction = wasteLen / Math.max(0.1, totalFaceWidth);

    const faceArea = stopeWidth * stopeHeight;
    const oreArea = faceArea * oreFraction;
    const wasteArea = faceArea * wasteFraction;

    const oreMassTonnes = oreArea * blastPull * oreSg;
    const wasteMassTonnes = wasteArea * blastPull * wasteSg;
    const totalMinedMassTonnes = oreMassTonnes + wasteMassTonnes;

    // Mass-based unplanned dilution (Part D1)
    const dilutionPercentByMass = totalMinedMassTonnes > 0 ? (wasteMassTonnes / totalMinedMassTonnes) * 100 : 0;

    // Combined grade (Part D2)
    const combinedMuckGrade = totalMinedMassTonnes > 0 ? (weightedFaceGrade * oreMassTonnes) / totalMinedMassTonnes : 0;

    // Contained metal & economics
    const containedGramsAu = totalMinedMassTonnes * combinedMuckGrade;
    const containedOuncesAu = containedGramsAu / 31.1035;
    const grossRevenue = containedOuncesAu * metalPriceAuOz;
    const totalMiningCost = totalMinedMassTonnes * miningCostPerTonne;
    const totalMillingCost = oreMassTonnes * millingCostPerTonne;
    const totalProductionCost = totalMiningCost + totalMillingCost;
    const netProfit = grossRevenue - totalProductionCost;

    let verdict: { label: string; badgeColor: string; destination: string; desc: string } = {
      label: 'ROUTE TO MILL (HIGH-GRADE ORE)',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-600',
      destination: 'ROM Bin #1 / Primary Gyratory Crusher',
      desc: 'Diluted muck grade exceeds cut-off grade. Dispatch directly to mill processing.',
    };

    if (combinedMuckGrade < cutoffGrade * 0.5) {
      verdict = {
        label: 'ROUTE TO WASTE DUMP',
        badgeColor: 'bg-rose-950 text-rose-300 border-rose-600',
        destination: 'North Surface Waste Dump / Level 620 Stope Backfill',
        desc: 'Sub-economic waste / country rock overbreak. Route to waste dump or CRF backfill.',
      };
    } else if (combinedMuckGrade < cutoffGrade) {
      verdict = {
        label: 'ROUTE TO LOW-GRADE STOCKPILE',
        badgeColor: 'bg-amber-950 text-amber-300 border-amber-600',
        destination: 'ROM Low-Grade Stockpile #2',
        desc: 'Marginal ore. Dump on Stockpile #2 for batch blending or heap leaching.',
      };
    }

    const truckLoads40t = Math.ceil(totalMinedMassTonnes / 40);

    return {
      weightedFaceGrade,
      oreArea,
      wasteArea,
      oreMassTonnes,
      wasteMassTonnes,
      totalMinedMassTonnes,
      dilutionPercentByMass,
      combinedMuckGrade,
      containedOuncesAu,
      grossRevenue,
      totalProductionCost,
      netProfit,
      verdict,
      truckLoads40t,
    };
  }, [channelSamples, oreSg, wasteSg, blastPull, stopeWidth, stopeHeight, cutoffGrade, metalPriceAuOz, miningCostPerTonne, millingCostPerTonne]);

  // Mathews Stability Number N' Calculation (Part E)
  const mathewsCalcs = useMemo(() => {
    // Q' = (RQD / Jn) * (Jr / Ja)
    const qPrime = (miningRqd / Math.max(0.75, miningJn)) * (miningJr / Math.max(0.75, miningJa));
    const nPrime = qPrime * stressFactorA * jointFactorB * gravityFactorC;

    // Hydraulic Radius = Area / Perimeter
    const area = stopeWidth * stopeHeight;
    const perimeter = 2 * (stopeWidth + stopeHeight);
    const hydraulicRadius = perimeter > 0 ? area / perimeter : 0;

    let zone = 'STABLE (UNSUPPORTED)';
    let badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-600';
    let supportPlan = 'Stable stope span. Spot friction bolts (Split-Sets 2.1m) on structural intersections only.';

    if (nPrime < 1.0) {
      zone = 'CAVING / UNSTABLE';
      badgeColor = 'bg-rose-950 text-rose-300 border-rose-600';
      supportPlan = 'Massive unentry failure risk. Non-entry bulk mining or cemented rock backfill (CRF) required.';
    } else if (nPrime < 3.5 || hydraulicRadius > 8.0) {
      zone = 'TRANSITION (SLOUGHING DILUTION RISK)';
      badgeColor = 'bg-amber-950 text-amber-300 border-amber-600';
      supportPlan = 'High hangingwall dilution expected. Pre-stressed twin-strand cable bolts (8-10m, 2.0x2.0m grid) + fiber shotcrete.';
    } else if (nPrime < 10.0 || hydraulicRadius > 5.5) {
      zone = 'STABLE (SUPPORTED)';
      badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-600';
      supportPlan = 'Pattern rock bolting (2.0m x 2.0m grid) + heavy weldmesh in roof and hangingwall.';
    }

    return {
      qPrime: Number(qPrime.toFixed(2)),
      nPrime: Number(nPrime.toFixed(2)),
      hydraulicRadius: Number(hydraulicRadius.toFixed(2)),
      zone,
      badgeColor,
      supportPlan,
    };
  }, [miningRqd, miningJn, miningJr, miningJa, stressFactorA, jointFactorB, gravityFactorC, stopeWidth, stopeHeight]);

  // Laubscher MRMR Calculation (Part E)
  const mrmrCalcs = useMemo(() => {
    const adj = (mrmrWeatheringPct / 100) * (mrmrStressPct / 100) * (mrmrOrientationPct / 100) * (mrmrBlastingPct / 100);
    const totalScore = Math.round(mrmrBaseRmr * adj);
    let rockClass = 'Class III (Fair)';
    let color = 'text-amber-400';
    let support = 'Pattern Resin Rebar / Swellex (2.4m, 1.2m spacing) + 5.6mm Welded Mesh + 50mm Shotcrete.';

    if (totalScore >= 81) {
      rockClass = 'Class I (Very Good)';
      color = 'text-emerald-400';
      support = 'Generally unsupported; spot friction bolts on loose blocks only.';
    } else if (totalScore >= 61) {
      rockClass = 'Class II (Good)';
      color = 'text-cyan-400';
      support = 'Pattern Split-Sets (2.1m, 1.5m spacing) + welded wire mesh in roof.';
    } else if (totalScore >= 41) {
      rockClass = 'Class III (Fair)';
      color = 'text-amber-400';
      support = 'Resin rebar bolts (2.4m, 1.2m spacing) + 5.6mm mesh + 50mm shotcrete.';
    } else if (totalScore >= 21) {
      rockClass = 'Class IV (Poor)';
      color = 'text-orange-400';
      support = 'Heavy yielding bolts + 75-100mm steel-fiber reinforced shotcrete (SFRS) + spiling.';
    } else {
      rockClass = 'Class V (Very Poor)';
      color = 'text-rose-400';
      support = 'Steel sets / lattice girders + heavy forepoling spiles + full invert closure.';
    }

    return { totalScore, rockClass, color, support, adj: Number(adj.toFixed(2)) };
  }, [mrmrBaseRmr, mrmrWeatheringPct, mrmrStressPct, mrmrOrientationPct, mrmrBlastingPct]);

  // Save changes to storage engine (Part B & K)
  const handleSaveStopeData = () => {
    if (!currentStope) return;
    const updated = updateMiningStope(currentStope.id, {
      mineLevel,
      stopeOrDriftId: driftId,
      oreBodyName,
      excavationType: excavationType as any,
      miningMethod: miningMethod as any,
      targetCutoffGrade: cutoffGrade,
      blastPullMeters: blastPull,
      stopeWidthM: stopeWidth,
      stopeHeightM: stopeHeight,
      oreSpecificGravity: oreSg,
      wasteSpecificGravity: wasteSg,
      hangingwallDipDeg: hangingwallDip,
      footwallDipDeg: footwallDip,
      channelSamples,
      features,
      dilutedGradeCalculated: dilutionCalcs.combinedMuckGrade,
      dilutionPercentCalculated: dilutionCalcs.dilutionPercentByMass,
      muckDestinationVerdict: dilutionCalcs.verdict.label.includes('MILL') ? 'MILL' : dilutionCalcs.verdict.label.includes('STOCKPILE') ? 'LOW_GRADE_STOCKPILE' : 'WASTE_DUMP',
      updatedAt: new Date().toISOString(),
    });
    setSaveStatus('SAVED');
    setTimeout(() => setSaveStatus('IDLE'), 2500);
  };

  // Canvas Coordinate Mapping Helpers
  // Canvas width = 640px, height = 480px representing stopeWidth (e.g. 4.8m) x stopeHeight (e.g. 4.2m)
  const canvasWidth = 640;
  const canvasHeight = 480;
  const scaleX = (canvasWidth - 100) / Math.max(1, stopeWidth);
  const scaleY = (canvasHeight - 100) / Math.max(1, stopeHeight);

  const meterToCanvas = (mX: number, mY: number) => {
    const px = 50 + mX * scaleX;
    const py = canvasHeight - 50 - mY * scaleY;
    return { px, py };
  };

  const canvasToMeter = (px: number, py: number) => {
    const mx = Math.max(0, Math.min(stopeWidth, (px - 50) / scaleX));
    const my = Math.max(0, Math.min(stopeHeight, (canvasHeight - 50 - py) / scaleY));
    return { mx: Number(mx.toFixed(2)), my: Number(my.toFixed(2)) };
  };

  // Canvas Mouse Interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom - panOffset.x;
    const clickY = (e.clientY - rect.top) / zoom - panOffset.y;
    const { mx, my } = canvasToMeter(clickX, clickY);

    if (activeTool === 'PAN') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (activeTool !== 'SELECT' && activeTool !== 'ERASE') {
      setIsDrawing(true);
      const newPoint: MiningGeologicalPoint = { x: mx, y: my };
      const updatedDraft = [...currentDraftPoints, newPoint];
      setCurrentDraftPoints(updatedDraft);

      // If finished polygon or polyline click
      if (updatedDraft.length >= 2 && activeGeometryMode === 'POLYLINE') {
        const newFeat: MiningGeologicalFeature = {
          id: `FT-${Date.now().toString(36).toUpperCase()}`,
          surfaceType: activeSurface,
          featureType: activeTool as MiningGeologicalFeatureType,
          geometryType: 'POLYLINE',
          points: updatedDraft,
          name: `${activeTool} Feature`,
          colorHex: activeTool === 'ORE_BOUNDARY' ? '#F59E0B' : activeTool === 'FAULT' ? '#EF4444' : activeTool === 'JOINT' ? '#A855F7' : '#38BDF8',
          strokeWidth: 2.5,
          visible: true,
        };
        setFeatures([...features, newFeat]);
        setCurrentDraftPoints([]);
        setIsDrawing(false);
        setSelectedFeatureId(newFeat.id);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom - panOffset.x;
    const clickY = (e.clientY - rect.top) / zoom - panOffset.y;
    const { mx, my } = canvasToMeter(clickX, clickY);
    setCursorPos({ x: mx, y: my });

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPanOffset({ x: 40, y: 30 });
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      <EswaAppBackgroundWatermark visible showLogoWatermark={true} />

      {/* =====================================================================
          TOP COMPACT HEADER BAR (Part C2 & C3)
          ===================================================================== */}
      <header className="flex-none bg-slate-900 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 shadow-md z-30 border-b border-amber-500/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToMainWindow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-all text-amber-300"
            title="Return to Mining Main Window"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Main Window</span>
          </button>

          {/* Location & Surface Context Indicators */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Pickaxe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm font-mono text-slate-100 truncate">
                  {currentProject.projectName}
                </span>
                <span className="text-amber-400 font-bold text-xs truncate">
                  · {driftId} ({mineLevel})
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-2">
                <span>Cut-off: <strong className="text-emerald-400">{cutoffGrade.toFixed(2)} g/t</strong></span>
                <span>· Diluted Muck: <strong className="text-amber-300">{dilutionCalcs.combinedMuckGrade.toFixed(2)} g/t</strong></span>
                <span>· {dilutionCalcs.verdict.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Surface Switcher (Part C4) */}
        <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs font-bold shadow-inner">
          {[
            { id: 'DEVELOPMENT_FACE' as MiningSurfaceType, label: 'Face' },
            { id: 'LEFT_WALL' as MiningSurfaceType, label: 'Left Wall' },
            { id: 'RIGHT_WALL' as MiningSurfaceType, label: 'Right Wall' },
            { id: 'BACKS_CROWN' as MiningSurfaceType, label: 'Crown / Backs' },
            { id: 'STOPE_SURFACE' as MiningSurfaceType, label: 'Stope' },
            { id: 'PLAN_VIEW' as MiningSurfaceType, label: 'Plan' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSurface(s.id)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeSurface === s.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Action Buttons & Save */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold">
            {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChangeIndustryMode(m)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  m === 'MINING'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveStopeData}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all shadow ${
              saveStatus === 'SAVED'
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {saveStatus === 'SAVED' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus === 'SAVED' ? 'Saved' : 'Save Mapping'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
            title="Open isolated Mining vault and backups"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Vault</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN WORKSPACE LAYOUT: CANVAS-FIRST (80-90% SPACE) + COLLAPSIBLE PANELS
          ===================================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* -------------------------------------------------------------------
            LEFT COLLAPSIBLE TOOLBAR (Part C3 & C5)
            ------------------------------------------------------------------- */}
        <aside
          className={`flex-none bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 z-20 ${
            isLeftPanelOpen ? 'w-60' : 'w-12'
          }`}
        >
          {/* Panel Toggle Header */}
          <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-amber-400">
            {isLeftPanelOpen ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Pickaxe className="w-4 h-4" />
                  <span>Geological Tools</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsLeftPanelOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Collapse left panel"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsLeftPanelOpen(true)}
                className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Expand left panel"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>

          {/* Left Panel Body */}
          {isLeftPanelOpen ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
              {/* Tool Selection Buttons */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mapping Mode
                </span>
                {[
                  { id: 'SELECT' as const, label: 'Select & Inspect', icon: Eye },
                  { id: 'PAN' as const, label: 'Pan Canvas', icon: Move },
                  { id: 'ORE_BOUNDARY' as const, label: 'Ore Lode / Vein', icon: Sparkles },
                  { id: 'LITH_CONTACT' as const, label: 'Lithology Contact', icon: Layers },
                  { id: 'FAULT' as const, label: 'Fault / Shear Zone', icon: AlertTriangle },
                  { id: 'JOINT' as const, label: 'Joint Discontinuity', icon: Compass },
                  { id: 'ALTERATION_HALO' as const, label: 'Alteration Halo', icon: Activity },
                ].map((t) => {
                  const isAct = activeTool === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTool(t.id)}
                      className={`w-full py-2 px-2.5 rounded-lg flex items-center gap-2 text-left font-bold transition-all cursor-pointer ${
                        isAct
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Geometry Drawing Mode */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Geometry Shape
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveGeometryMode('POLYLINE')}
                    className={`py-1.5 px-2 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                      activeGeometryMode === 'POLYLINE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Polyline
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGeometryMode('POLYGON')}
                    className={`py-1.5 px-2 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                      activeGeometryMode === 'POLYGON'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Polygon
                  </button>
                </div>
              </div>

              {/* Background Photo Calibration (Part C3) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>Face Photograph</span>
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                </span>

                <div className="space-y-1.5">
                  <label className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-cyan-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Face Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setPhotoCalibration((prev) => ({
                                ...prev,
                                imageUrl: String(event.target?.result),
                                isCalibrated: true,
                              }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>

                  {photoCalibration.imageUrl && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Photo Opacity:</span>
                        <span className="text-slate-200 font-bold">{Math.round(photoCalibration.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={photoCalibration.opacity * 100}
                        onChange={(e) => setPhotoCalibration((p) => ({ ...p, opacity: Number(e.target.value) / 100 }))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-3 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('SELECT');
                }}
                className={`p-2 rounded-lg cursor-pointer ${activeTool === 'SELECT' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                title="Select & Inspect"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('ORE_BOUNDARY');
                }}
                className={`p-2 rounded-lg cursor-pointer ${activeTool === 'ORE_BOUNDARY' ? 'bg-amber-500 text-slate-950' : 'text-amber-400 hover:text-white'}`}
                title="Ore Vein Lode"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('FAULT');
                }}
                className={`p-2 rounded-lg cursor-pointer ${activeTool === 'FAULT' ? 'bg-rose-500 text-slate-950' : 'text-rose-400 hover:text-white'}`}
                title="Fault / Shear"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* -------------------------------------------------------------------
            CENTER PRIMARY CANVAS (OCCUPIES 80-90% WORKSPACE)
            ------------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {/* Canvas Top Status Bar & Navigation Controls */}
          <div className="flex-none px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3 text-slate-300">
              <span className="flex items-center gap-1.5 font-bold text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Surface: {activeSurface.replace('_', ' ')}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Metric Span: <strong className="text-slate-200">{stopeWidth}m W × {stopeHeight}m H</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">
                Pointer: X {cursorPos.x.toFixed(2)}m, Y {cursorPos.y.toFixed(2)}m
              </span>
            </div>

            {/* Canvas Zoom & View Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1 rounded border text-[10px] font-bold cursor-pointer ${
                  showGrid ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Toggle Metric Grid"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowSupportOverlay(!showSupportOverlay)}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                  showSupportOverlay ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Toggle Ground Support"
              >
                Bolts
              </button>
            </div>
          </div>

          {/* Interactive SVG Canvas Area */}
          <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-2">
            <svg
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="w-full h-full max-w-[1200px] max-h-[720px] rounded-xl bg-slate-900/90 shadow-2xl border border-slate-800 cursor-crosshair select-none"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              <defs>
                <pattern id="wastePatternMining" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 0,16 l 16,-16 M 0,0 l 16,16" stroke="#1E293B" strokeWidth="0.8" />
                </pattern>
                <pattern id="orePatternMining" width="12" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="6" cy="6" r="1.5" fill="#F59E0B" opacity="0.6" />
                </pattern>
                <clipPath id="mineHeadingClip">
                  <path d="M 50,430 L 50,180 Q 50,50 320,50 Q 590,50 590,180 L 590,430 Z" />
                </clipPath>
              </defs>

              {/* Outer Darkness Country Rock */}
              <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#050811" />

              {/* Metric Grid (Part C3) */}
              {showGrid && (
                <g opacity="0.2">
                  {[100, 200, 300, 400, 500, 600].map((x) => (
                    <line key={`gx-${x}`} x1={x} y1="30" x2={x} y2="450" stroke="#94A3B8" strokeDasharray="3 3" />
                  ))}
                  {[80, 150, 220, 290, 360, 430].map((y) => (
                    <line key={`gy-${y}`} x1="30" y1={y} x2="610" y2={y} stroke="#94A3B8" strokeDasharray="3 3" />
                  ))}
                </g>
              )}

              {/* Face Inside Mapped Area */}
              <g clipPath="url(#mineHeadingClip)">
                {/* Background Country Rock */}
                <rect x="50" y="50" width="540" height="380" fill="#0F172A" />
                <rect x="50" y="50" width="540" height="380" fill="url(#wastePatternMining)" />

                {/* Optional Calibrated Photo Layer */}
                {photoCalibration.imageUrl && showPhoto && (
                  <image
                    href={photoCalibration.imageUrl}
                    x="50"
                    y="50"
                    width="540"
                    height="380"
                    preserveAspectRatio="none"
                    opacity={photoCalibration.opacity}
                  />
                )}

                {/* Render Drawn Vector Features (Part C5) */}
                {features
                  .filter((f) => f.visible)
                  .map((f) => {
                    const isSelected = selectedFeatureId === f.id;
                    if (f.geometryType === 'POLYGON' && f.points.length >= 3) {
                      const ptsString = f.points
                        .map((pt) => {
                          const { px, py } = meterToCanvas(pt.x, pt.y);
                          return `${px},${py}`;
                        })
                        .join(' ');

                      return (
                        <g key={f.id} onClick={() => setSelectedFeatureId(f.id)}>
                          <polygon
                            points={ptsString}
                            fill={f.colorHex}
                            fillOpacity={f.fillOpacity || 0.4}
                            stroke={isSelected ? '#FFFFFF' : f.colorHex}
                            strokeWidth={isSelected ? 3.5 : f.strokeWidth || 2}
                            className="cursor-pointer transition-colors"
                          />
                          {f.featureType === 'ORE_BOUNDARY' && (
                            <polygon points={ptsString} fill="url(#orePatternMining)" />
                          )}
                        </g>
                      );
                    }

                    if (f.geometryType === 'POLYLINE' && f.points.length >= 2) {
                      const ptsString = f.points
                        .map((pt) => {
                          const { px, py } = meterToCanvas(pt.x, pt.y);
                          return `${px},${py}`;
                        })
                        .join(' ');

                      return (
                        <g key={f.id} onClick={() => setSelectedFeatureId(f.id)}>
                          <polyline
                            points={ptsString}
                            fill="none"
                            stroke={isSelected ? '#FFFFFF' : f.colorHex}
                            strokeWidth={isSelected ? 4 : f.strokeWidth || 2}
                            strokeDasharray={f.featureType === 'FAULT' ? '6 3' : undefined}
                            className="cursor-pointer"
                          />
                        </g>
                      );
                    }
                    return null;
                  })}

                {/* Channel Samples Line on Face (Part C8) */}
                <g>
                  {/* Baseline Channel Cut Line at 1.5m elevation */}
                  {(() => {
                    const startP = meterToCanvas(0.2, 1.5);
                    const endP = meterToCanvas(stopeWidth - 0.2, 1.5);
                    return (
                      <line
                        x1={startP.px}
                        y1={startP.py}
                        x2={endP.px}
                        y2={endP.py}
                        stroke="#CBD5E1"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />
                    );
                  })()}

                  {/* Channel Cuts Intervals */}
                  {channelSamples.map((s) => {
                    const p1 = meterToCanvas(s.fromMeter, 1.5);
                    const p2 = meterToCanvas(s.toMeter, 1.5);
                    const midX = (p1.px + p2.px) / 2;
                    const isOre = s.zoneCategory === 'ORE';
                    const isLow = s.zoneCategory === 'LOW_GRADE';

                    return (
                      <g key={s.id}>
                        {/* Sample interval bracket */}
                        <line
                          x1={p1.px}
                          y1={p1.py}
                          x2={p2.px}
                          y2={p2.py}
                          stroke={isOre ? '#10B981' : isLow ? '#F59E0B' : '#F43F5E'}
                          strokeWidth="4"
                        />
                        <circle cx={p1.px} cy={p1.py} r="4" fill="#FFFFFF" />
                        <circle cx={p2.px} cy={p2.py} r="4" fill="#FFFFFF" />

                        {/* Tag Box Callout */}
                        <rect
                          x={midX - 35}
                          y={p1.py - 24}
                          width="70"
                          height="18"
                          rx="4"
                          fill="#020617"
                          stroke={isOre ? '#10B981' : isLow ? '#F59E0B' : '#F43F5E'}
                          strokeWidth="1.2"
                        />
                        <text
                          x={midX}
                          y={p1.py - 12}
                          fill="#FFFFFF"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {s.sampleNumber}: {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue}g/t
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Ground Support Pattern Overlays (Part C5) */}
                {showSupportOverlay && (
                  <g>
                    {/* Welded Wire Mesh along arch */}
                    <path
                      d="M 60,420 L 60,190 Q 60,65 320,65 Q 580,65 580,190 L 580,420"
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                      opacity="0.8"
                    />
                    {/* Pattern Rockbolts (Split-Sets 2.1m) */}
                    {[
                      { x: 100, y: 160 },
                      { x: 170, y: 110 },
                      { x: 260, y: 80 },
                      { x: 360, y: 80 },
                      { x: 450, y: 110 },
                      { x: 520, y: 160 },
                      { x: 60, y: 260 },
                      { x: 60, y: 360 },
                      { x: 580, y: 260 },
                      { x: 580, y: 360 },
                    ].map((b, i) => (
                      <g key={`bolt-${i}`}>
                        <circle cx={b.x} cy={b.y} r="5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
                        <line x1={b.x} y1={b.y} x2={b.x} y2={b.y - 12} stroke="#38BDF8" strokeWidth="2" />
                      </g>
                    ))}
                  </g>
                )}
              </g>

              {/* Stope Face Perimeter Arch Outline */}
              <path
                d="M 50,430 L 50,180 Q 50,50 320,50 Q 590,50 590,180 L 590,430 Z"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3.5"
              />

              {/* Dimension Annotations (Rulers on Canvas) */}
              <line x1="50" y1="445" x2="590" y2="445" stroke="#94A3B8" strokeWidth="1" />
              <line x1="50" y1="440" x2="50" y2="450" stroke="#94A3B8" strokeWidth="1" />
              <line x1="590" y1="440" x2="590" y2="450" stroke="#94A3B8" strokeWidth="1" />
              <text x="320" y="460" fill="#E2E8F0" fontSize="10" fontWeight="bold" textAnchor="middle">
                Span: {stopeWidth} m (Floor Width)
              </text>

              <line x1="35" y1="50" x2="35" y2="430" stroke="#94A3B8" strokeWidth="1" />
              <line x1="30" y1="50" x2="40" y2="50" stroke="#94A3B8" strokeWidth="1" />
              <line x1="30" y1="430" x2="40" y2="430" stroke="#94A3B8" strokeWidth="1" />
              <text x="25" y="240" fill="#E2E8F0" fontSize="10" fontWeight="bold" textAnchor="end">
                Height: {stopeHeight} m
              </text>
            </svg>
          </div>
        </div>

        {/* -------------------------------------------------------------------
            RIGHT COLLAPSIBLE WORKBENCH & ANALYSIS PANEL
            ------------------------------------------------------------------- */}
        <aside
          className={`flex-none bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-200 z-20 ${
            isRightPanelOpen ? 'w-80' : 'w-12'
          }`}
        >
          {/* Panel Toggle Header */}
          <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-amber-400">
            {isRightPanelOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsRightPanelOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Collapse right panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'LAYERS' as RightPanelTab, label: 'Layers' },
                    { id: 'CHANNELS' as RightPanelTab, label: 'Grades' },
                    { id: 'MATHEWS' as RightPanelTab, label: 'Mathews' },
                    { id: 'STEREONET' as RightPanelTab, label: 'Stereonet' },
                    { id: 'REPORTS' as RightPanelTab, label: 'Report' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRightPanelTab(t.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        rightPanelTab === t.id
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsRightPanelOpen(true)}
                className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Expand right panel"
              >
                <PanelRightOpen className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>

          {/* Right Panel Body */}
          {isRightPanelOpen ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
              {/* TAB 1: LAYERS & FEATURES LIST (Part C5) */}
              {rightPanelTab === 'LAYERS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-slate-200">Mapped Geological Features ({features.length})</span>
                    <span className="text-[10px] text-amber-400">{activeSurface}</span>
                  </div>

                  <div className="space-y-2">
                    {features.map((f) => {
                      const isSelected = selectedFeatureId === f.id;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFeatureId(f.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-950 border-amber-500 shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-slate-100 flex items-center gap-1.5 truncate">
                              <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: f.colorHex }} />
                              <span className="truncate">{f.name}</span>
                            </strong>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFeatures(
                                    features.map((item) =>
                                      item.id === f.id ? { ...item, visible: !item.visible } : item
                                    )
                                  );
                                }}
                                className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                              >
                                {f.visible ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFeatures(features.filter((item) => item.id !== f.id));
                                }}
                                className="p-0.5 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Type: {f.featureType}</span>
                              {f.dipDeg && <span>Dip: {f.dipDeg}° → {f.dipDirectionDeg}°</span>}
                            </div>
                            {f.trueThicknessM && (
                              <div>True Thickness: <strong className="text-amber-300">{f.trueThicknessM} m</strong></div>
                            )}
                            {f.mineralogyNotes && (
                              <p className="text-slate-500 truncate">{f.mineralogyNotes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: GRADE CONTROL & DILUTION (Part D) */}
              {rightPanelTab === 'CHANNELS' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Grade Reconciliation</span>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Undiluted Face Grade:</span>
                      <strong className="text-cyan-300">{dilutionCalcs.weightedFaceGrade.toFixed(2)} g/t</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Dilution % by Mass:</span>
                      <strong className="text-amber-300">{dilutionCalcs.dilutionPercentByMass.toFixed(1)}%</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Diluted Muck Pile Grade:</span>
                      <strong className="text-emerald-400 font-bold">{dilutionCalcs.combinedMuckGrade.toFixed(2)} g/t</strong>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-800 pt-1">
                      <span className="text-slate-400">Total Round Muck:</span>
                      <strong className="text-slate-100">{dilutionCalcs.totalMinedMassTonnes.toFixed(1)} t ({dilutionCalcs.truckLoads40t} trucks)</strong>
                    </div>
                  </div>

                  {/* Verdict Badge */}
                  <div className={`p-3 rounded-xl border text-[11px] ${dilutionCalcs.verdict.badgeColor}`}>
                    <strong className="block font-bold">{dilutionCalcs.verdict.label}</strong>
                    <p className="text-[10px] opacity-90 mt-0.5">{dilutionCalcs.verdict.desc}</p>
                    <span className="text-[10px] block font-bold text-amber-300 mt-1">
                      Target: {dilutionCalcs.verdict.destination}
                    </span>
                  </div>

                  {/* Channel Samples List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-200">Channel Samples ({channelSamples.length})</strong>
                      <button
                        type="button"
                        onClick={() => {
                          const newNum = channelSamples.length + 1;
                          const newS: FaceChannelSampleRecord = {
                            id: `CH-0${newNum}`,
                            sampleNumber: `CH-0${newNum}`,
                            fromMeter: Number((channelSamples[channelSamples.length - 1]?.toMeter || 0).toFixed(1)),
                            toMeter: Number(((channelSamples[channelSamples.length - 1]?.toMeter || 0) + 1.2).toFixed(1)),
                            sampleLengthMeters: 1.2,
                            assayGrade: 4.5,
                            gradeValue: '4.50',
                            specificGravity: 3.10,
                            zoneCategory: 'ORE',
                            lithologyOrVein: 'Quartz-Sulfide Ore',
                            sampledBy: 'Mine Geologist',
                            date: new Date().toISOString().slice(0, 10),
                          };
                          setChannelSamples([...channelSamples, newS]);
                        }}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>

                    {channelSamples.map((s) => (
                      <div key={s.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <strong className="text-cyan-400">{s.sampleNumber}</strong>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            s.zoneCategory === 'ORE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {s.zoneCategory} ({s.assayGrade} g/t)
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{s.lithologyOrVein}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: MATHEWS STABILITY GRAPH & MRMR (Part E) */}
              {rightPanelTab === 'MATHEWS' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                      <span className="font-bold text-amber-300">Mathews Stability N'</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${mathewsCalcs.badgeColor}`}>
                        {mathewsCalcs.zone}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>Modified Q': <strong className="text-cyan-400">{mathewsCalcs.qPrime}</strong></div>
                      <div>Stability N': <strong className="text-amber-400">{mathewsCalcs.nPrime}</strong></div>
                      <div>Hydraulic Radius: <strong className="text-emerald-400">{mathewsCalcs.hydraulicRadius}m</strong></div>
                      <div>Stress A: <strong className="text-slate-200">{stressFactorA}</strong></div>
                    </div>
                  </div>

                  {/* SVG Mathews Curve */}
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <svg viewBox="0 0 240 140" className="w-full h-auto">
                      <polygon points="20,10 20,130 230,130 230,110" fill="#E11D48" fillOpacity="0.25" />
                      <polygon points="20,10 20,90 230,110 230,80" fill="#F59E0B" fillOpacity="0.25" />
                      <polygon points="20,10 20,50 230,80 230,40" fill="#06B6D4" fillOpacity="0.3" />
                      <polygon points="20,10 230,10 230,40 20,50" fill="#10B981" fillOpacity="0.3" />
                      <line x1="20" y1="130" x2="230" y2="130" stroke="#64748B" />
                      <line x1="20" y1="10" x2="20" y2="130" stroke="#64748B" />
                      {/* Current Stope point */}
                      <circle cx="110" cy="65" r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
                      <text x="118" y="68" fill="#FDE047" fontSize="8" fontWeight="bold">Current Stope</text>
                    </svg>
                    <p className="text-[10px] text-slate-400 mt-1">{mathewsCalcs.supportPlan}</p>
                  </div>
                </div>
              )}

              {/* TAB 4: STEREONET PROJECTION (Part C7) */}
              {rightPanelTab === 'STEREONET' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="font-bold text-slate-200 block">Lower Hemisphere Equal-Area Stereonet</span>
                    <p className="text-[10px] text-slate-400">
                      Poles of mapped discontinuities (foliation, faults, joints) with planar/wedge sliding kinematic checks.
                    </p>

                    <div className="w-44 h-44 mx-auto rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center relative overflow-hidden shadow-inner my-2">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <circle cx="50" cy="50" r="48" fill="none" stroke="#475569" strokeWidth="1" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.8" />
                        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="0.8" />
                        {/* Great circle for face orientation (Dip 74° -> 285°) */}
                        <path d="M 50,2 Q 85,50 50,98" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                        {/* Poles */}
                        <circle cx="32" cy="28" r="3.5" fill="#EF4444" />
                        <circle cx="68" cy="72" r="3.5" fill="#A855F7" />
                        <circle cx="45" cy="55" r="3.5" fill="#38BDF8" />
                      </svg>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> J1 Main Foliation (74° → 285°)</div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> J2 Cross Joints (58° → 110°)</div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> J3 Flat Crown Joint (18° → 015°)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: REPORTS & CERTIFICATES (Part J) */}
              {rightPanelTab === 'REPORTS' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="font-bold text-amber-300 block">Production Grade Certificate</span>
                    <p className="text-[10px] text-slate-400">
                      Official ore grade control &amp; muck haulage dispatch certificate for {driftId} ({mineLevel}).
                    </p>
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Certificate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const csvContent =
                            'data:text/csv;charset=utf-8,' +
                            [
                              ['Mine Project', currentProject.projectName],
                              ['Heading', driftId],
                              ['Level', mineLevel],
                              ['Diluted Muck Grade (g/t)', dilutionCalcs.combinedMuckGrade.toFixed(2)],
                              ['Total Mined Mass (t)', dilutionCalcs.totalMinedMassTonnes.toFixed(1)],
                              ['Dilution %', dilutionCalcs.dilutionPercentByMass.toFixed(1)],
                              ['Muck Destination', dilutionCalcs.verdict.destination],
                            ]
                              .map((e) => e.join(','))
                              .join('\n');
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement('a');
                          link.setAttribute('href', encodedUri);
                          link.setAttribute('download', `${driftId}_Grade_Dispatch_${new Date().toISOString().slice(0, 10)}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 shadow"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Export CSV Dispatch</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-3 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRightPanelOpen(true);
                  setRightPanelTab('LAYERS');
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                title="Layers"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRightPanelOpen(true);
                  setRightPanelTab('CHANNELS');
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                title="Grade Control"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRightPanelOpen(true);
                  setRightPanelTab('MATHEWS');
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                title="Mathews Stability"
              >
                <Shield className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Storage Vault Modal */}
      <MiningDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />
    </div>
  );
};
