// ============================================================================
// ESWA UNDERGROUND MINING FACE SETUP & STATION MANAGER
// ============================================================================
// Complete 3-Stage Hierarchy:
// 1. PROJECT: Select existing, Add new, or Edit project metadata
// 2. LOCATION / HEADING: Select existing or Add new, define underground shape & size
//    (D-Arch, Horseshoe, Rectangular Flat, Shanty, Gothic, Parametric, DXF)
// 3. FACE & ADVANCE: Select existing mapped face or Create new face with
//    Chainage From - To, Blast Pull length, Azimuth, Inclination & Mapping Mode
// -> Then ENTER Face Mapping with clean/empty canvas ready for step-by-step data entry!
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Pickaxe,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  Camera,
  PenTool,
  Maximize2,
  Box,
  FileCode,
  Sparkles,
  Compass,
  AlertTriangle,
  Info,
  Building,
  MapPin,
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  Check,
  Calendar,
} from 'lucide-react';
import {
  MiningProjectItem,
  MiningLocationItem,
  MiningStopeItem,
  MiningStopeShape,
  MiningCommodity,
} from '../../types/mining';
import { MiningExcavationType, MiningMethodType } from '../../types/tunnel';
import {
  loadMiningProjects,
  saveMiningProjects,
  createMiningProject,
  updateMiningProject,
  deleteMiningProject,
  loadMiningLocations,
  saveMiningLocations,
  createMiningLocation,
  updateMiningLocation,
  deleteMiningLocation,
  loadMiningStopes,
  saveMiningStopes,
  createMiningStope,
  updateMiningStope,
  setActiveMiningProjectId,
  setActiveMiningLocationId,
  setActiveMiningStopeId,
  getActiveMiningProjectId,
  getActiveMiningLocationId,
  getActiveMiningStopeId,
} from '../../engine/miningStorageEngine';
import {
  generateMiningStopePolygon,
  parseDxfStopeBoundary,
} from '../../engine/miningFaceEngine';

export interface MiningFaceSetupWizardProps {
  onCancel: () => void;
  onEnterFaceMapping: (stope: MiningStopeItem) => void;
  initialStope?: MiningStopeItem | null;
}

type SetupStage = 'PROJECT' | 'LOCATION' | 'FACE';

const COMMODITIES: MiningCommodity[] = [
  'Gold (Au)',
  'Copper (Cu)',
  'Silver (Ag)',
  'Zinc (Zn)',
  'Lead (Pb)',
  'Nickel (Ni)',
  'Iron Ore (Fe)',
  'Platinum Group (PGM)',
  'Lithium (Li)',
  'Polymetallic Complex',
];

const EXCAVATION_TYPES: { id: MiningExcavationType; label: string }[] = [
  { id: 'ORE_DRIVE', label: 'Ore Drive / Strike Drift' },
  { id: 'DRIFT', label: 'Footwall / Access Drift' },
  { id: 'CROSS_CUT', label: 'Stope Crosscut' },
  { id: 'DECLINE', label: 'Main Decline / Ramp' },
  { id: 'STOPE', label: 'Production Stope Heading' },
  { id: 'DRAWPOINT', label: 'Production Drawpoint' },
  { id: 'SILL_PILLAR', label: 'Sublevel Sill Pillar' },
  { id: 'CROWN_PILLAR', label: 'Crown Pillar' },
  { id: 'RAISE', label: 'Alimak / Slot Raise' },
  { id: 'SHAFT', label: 'Shaft Station / Pocket' },
];

const MINING_METHODS: { id: MiningMethodType; label: string }[] = [
  { id: 'SUBLEVEL_OPEN_STOPING', label: 'Sublevel Open Stoping (SLOS / Longhole)' },
  { id: 'CUT_AND_FILL', label: 'Cut-and-Fill Stoping (Overhand / Underhand)' },
  { id: 'ROOM_AND_PILLAR', label: 'Room and Pillar / Post-Pillar' },
  { id: 'BENCH_STOPING', label: 'Bench Stoping / Avoca Longitudinal' },
  { id: 'BLOCK_CAVING', label: 'Block / Panel Caving' },
  { id: 'SHRINKAGE', label: 'Shrinkage Stoping' },
  { id: 'VCR', label: 'Vertical Crater Retreat (VCR)' },
];

const SHAPE_PRESETS: { id: MiningStopeShape; label: string; desc: string }[] = [
  { id: 'd_arch', label: 'D-Arch (Arched Roof)', desc: 'Standard production drift' },
  { id: 'horseshoe', label: 'Horseshoe Arch', desc: 'Deep high-stress drive' },
  { id: 'rectangular_flat', label: 'Rectangular Flat-Roof', desc: 'Room & pillar / flat back' },
  { id: 'shanty', label: 'Shanty (Asymmetric)', desc: 'Offset crown for dipping shears' },
  { id: 'gothic_arch', label: 'Gothic Ogive Arch', desc: 'Pointed arch for vertical stress' },
  { id: 'custom_parametric', label: 'Custom Parametric', desc: 'Custom W, H & wall height' },
  { id: 'dxf_import', label: 'Import Mine DXF', desc: 'Load boundary polyline from CAD' },
];

export const MiningFaceSetupWizard: React.FC<MiningFaceSetupWizardProps> = ({
  onCancel,
  onEnterFaceMapping,
  initialStope,
}) => {
  const [currentStage, setCurrentStage] = useState<SetupStage>('PROJECT');

  // -------------------------------------------------------------------------
  // STAGE 1: PROJECT STATE
  // -------------------------------------------------------------------------
  const [projects, setProjects] = useState<MiningProjectItem[]>(() => loadMiningProjects());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialStope?.projectId || getActiveMiningProjectId() || projects[0]?.id || ''
  );
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(projects.length === 0);

  // Project Form
  const activeProj = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );
  const [projName, setProjName] = useState(activeProj?.projectName || 'Kolar Deep Gold Mine');
  const [projMineName, setProjMineName] = useState(activeProj?.mineName || 'South Lode Complex');
  const [projCompany, setProjCompany] = useState(activeProj?.miningCompany || 'Bharat Gold Mines Ltd');
  const [projLocation, setProjLocation] = useState(activeProj?.mineSiteLocation || 'Kolar Gold Belt, Shaft #4');
  const [projCommodity, setProjCommodity] = useState<MiningCommodity>(activeProj?.primaryCommodity || 'Gold (Au)');
  const [projGradeUnit, setProjGradeUnit] = useState<'g/t' | '%' | 'ppm' | 'oz/t'>(activeProj?.gradeUnits || 'g/t');
  const [projDatumMrl, setProjDatumMrl] = useState<number>(activeProj?.mineDatumLevelMrl ?? 1000);
  const [projGeologist, setProjGeologist] = useState(activeProj?.responsibleGeologist || 'Senior Mine Geologist');

  // -------------------------------------------------------------------------
  // STAGE 2: LOCATION / HEADING STATE (Cross-Section Shape & Size)
  // -------------------------------------------------------------------------
  const [locations, setLocations] = useState<MiningLocationItem[]>(() => loadMiningLocations());
  const locationsForProj = useMemo(
    () => locations.filter((l) => l.projectId === selectedProjectId),
    [locations, selectedProjectId]
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    initialStope?.locationId || getActiveMiningLocationId() || locationsForProj[0]?.id || ''
  );
  const [isAddingLocation, setIsAddingLocation] = useState(locationsForProj.length === 0);

  // Location Form
  const activeLoc = useMemo(
    () => locationsForProj.find((l) => l.id === selectedLocationId) || locationsForProj[0],
    [locationsForProj, selectedLocationId]
  );

  const [locName, setLocName] = useState(activeLoc?.locationName || 'HW-DRV-05');
  const [locLevel, setLocLevel] = useState(activeLoc?.mineLevel || 'Level 620 mRL');
  const [locLevelMrl, setLocLevelMrl] = useState<number>(activeLoc?.levelElevationMrl ?? 620);
  const [locExcavationType, setLocExcavationType] = useState<MiningExcavationType>(
    activeLoc?.excavationType || 'ORE_DRIVE'
  );
  const [locMiningMethod, setLocMiningMethod] = useState<MiningMethodType>(
    activeLoc?.miningMethod || 'SUBLEVEL_OPEN_STOPING'
  );
  const [locOreBody, setLocOreBody] = useState(activeLoc?.oreBodyName || 'Champion Quartz Lode');
  const [locCutoffGrade, setLocCutoffGrade] = useState<number>(activeLoc?.targetCutoffGrade ?? 2.50);

  // Underground Shape and Dimensions
  const [locShape, setLocShape] = useState<MiningStopeShape>(activeLoc?.stopeShape || 'd_arch');
  const [locWidthM, setLocWidthM] = useState<number>(activeLoc?.stopeWidthM ?? 4.8);
  const [locHeightM, setLocHeightM] = useState<number>(activeLoc?.stopeHeightM ?? 4.2);
  const [locWallHeightM, setLocWallHeightM] = useState<number>(activeLoc?.wallHeightM ?? 2.8);
  const [locAzimuthDeg, setLocAzimuthDeg] = useState<number>(activeLoc?.headingDriveAzimuthDeg ?? 45);
  const [dxfImportedPoints, setDxfImportedPoints] = useState<any[]>(activeLoc?.customProfilePoints || []);
  const [dxfFileName, setDxfFileName] = useState('');

  // Live Location Profile Metrics
  const profileMetrics = useMemo(() => {
    return generateMiningStopePolygon(
      locShape,
      locWidthM,
      locHeightM,
      locWallHeightM,
      locWidthM / 2,
      locShape === 'dxf_import' ? dxfImportedPoints : undefined
    );
  }, [locShape, locWidthM, locHeightM, locWallHeightM, dxfImportedPoints]);

  // -------------------------------------------------------------------------
  // STAGE 3: FACE & ADVANCE STATE (Pull & Chainage)
  // -------------------------------------------------------------------------
  const [stopes, setStopes] = useState<MiningStopeItem[]>(() => loadMiningStopes());
  const facesForLocation = useMemo(
    () =>
      stopes.filter(
        (s) =>
          s.projectId === selectedProjectId &&
          (s.locationId === selectedLocationId || s.stopeOrDriftId === (activeLoc?.locationName || locName))
      ),
    [stopes, selectedProjectId, selectedLocationId, activeLoc, locName]
  );

  const [selectedFaceId, setSelectedFaceId] = useState<string>(
    initialStope?.id || facesForLocation[0]?.id || ''
  );
  const [isAddingFace, setIsAddingFace] = useState(facesForLocation.length === 0);

  // Face Advance Form
  const [faceName, setFaceName] = useState(`Cut #${facesForLocation.length + 15}`);
  const [chainageFromM, setChainageFromM] = useState<number>(122.2);
  const [chainageToM, setChainageToM] = useState<number>(125.4);
  const [blastPullMeters, setBlastPullMeters] = useState<number>(3.2);
  const [faceInclinationDeg, setFaceInclinationDeg] = useState<number>(90);
  const [mappingMode, setMappingMode] = useState<'FIELD_SKETCH' | 'PHOTOGRAMMETRY'>('FIELD_SKETCH');
  const [facePhotoUrl, setFacePhotoUrl] = useState<string>('');

  // Handle Chainage Changes: auto-calculate pull
  const handleChainageFromChange = (val: number) => {
    setChainageFromM(val);
    setBlastPullMeters(Number(Math.max(0.5, chainageToM - val).toFixed(2)));
  };

  const handleChainageToChange = (val: number) => {
    setChainageToM(val);
    setBlastPullMeters(Number(Math.max(0.5, val - chainageFromM).toFixed(2)));
  };

  const handlePullChange = (val: number) => {
    setBlastPullMeters(val);
    setChainageToM(Number((chainageFromM + val).toFixed(2)));
  };

  // DXF File Handler
  const handleDxfUpload = (file: File) => {
    setDxfFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      const pts = parseDxfStopeBoundary(content);
      if (pts.length >= 3) {
        setDxfImportedPoints(pts);
        setLocShape('dxf_import');
      } else {
        alert('Could not detect a closed polygon in DXF. Please verify LWPOLYLINE entities.');
      }
    };
    reader.readAsText(file);
  };

  // -------------------------------------------------------------------------
  // SAVE / CREATE ACTIONS
  // -------------------------------------------------------------------------
  const handleSaveProject = () => {
    if (isAddingProject) {
      const created = createMiningProject({
        projectName: projName,
        mineName: projMineName,
        miningCompany: projCompany,
        mineSiteLocation: projLocation,
        primaryCommodity: projCommodity,
        gradeUnits: projGradeUnit,
        mineDatumLevelMrl: projDatumMrl,
        responsibleGeologist: projGeologist,
        activeMiningMethod: locMiningMethod,
      });
      setProjects(loadMiningProjects());
      setSelectedProjectId(created.id);
      setIsAddingProject(false);
      setIsEditingProject(false);
    } else if (isEditingProject && activeProj) {
      updateMiningProject(activeProj.id, {
        projectName: projName,
        mineName: projMineName,
        miningCompany: projCompany,
        mineSiteLocation: projLocation,
        primaryCommodity: projCommodity,
        gradeUnits: projGradeUnit,
        mineDatumLevelMrl: projDatumMrl,
        responsibleGeologist: projGeologist,
      });
      setProjects(loadMiningProjects());
      setIsEditingProject(false);
    }
  };

  const handleSaveLocation = () => {
    if (isAddingLocation) {
      const created = createMiningLocation({
        projectId: selectedProjectId,
        locationName: locName,
        mineLevel: locLevel,
        levelElevationMrl: locLevelMrl,
        excavationType: locExcavationType,
        miningMethod: locMiningMethod,
        oreBodyName: locOreBody,
        targetCutoffGrade: locCutoffGrade,
        stopeShape: locShape,
        stopeWidthM: locWidthM,
        stopeHeightM: locHeightM,
        wallHeightM: locWallHeightM,
        headingDriveAzimuthDeg: locAzimuthDeg,
        customProfilePoints: locShape === 'dxf_import' ? dxfImportedPoints : profileMetrics.points,
      });
      setLocations(loadMiningLocations());
      setSelectedLocationId(created.id);
      setIsAddingLocation(false);
    } else if (activeLoc) {
      updateMiningLocation(activeLoc.id, {
        locationName: locName,
        mineLevel: locLevel,
        levelElevationMrl: locLevelMrl,
        excavationType: locExcavationType,
        miningMethod: locMiningMethod,
        oreBodyName: locOreBody,
        targetCutoffGrade: locCutoffGrade,
        stopeShape: locShape,
        stopeWidthM: locWidthM,
        stopeHeightM: locHeightM,
        wallHeightM: locWallHeightM,
        headingDriveAzimuthDeg: locAzimuthDeg,
        customProfilePoints: locShape === 'dxf_import' ? dxfImportedPoints : profileMetrics.points,
      });
      setLocations(loadMiningLocations());
    }
  };

  // FINISH: Launch Face Mapping
  const handleLaunchFaceMapping = () => {
    setActiveMiningProjectId(selectedProjectId);
    if (selectedLocationId) setActiveMiningLocationId(selectedLocationId);

    // If resuming an existing face
    if (!isAddingFace && selectedFaceId) {
      const found = stopes.find((s) => s.id === selectedFaceId);
      if (found) {
        setActiveMiningStopeId(found.id);
        onEnterFaceMapping(found);
        return;
      }
    }

    // Creating a brand-new face: starts with EMPTY CANVAS!
    const displayChainage = `CH ${chainageFromM.toFixed(1)}m - ${chainageToM.toFixed(1)}m (${blastPullMeters}m pull)`;
    const newStope = createMiningStope({
      projectId: selectedProjectId,
      locationId: selectedLocationId || activeLoc?.id,
      stopeOrDriftId: locName,
      mineLevel: locLevel,
      levelElevationMrl: locLevelMrl,
      excavationType: locExcavationType,
      miningMethod: locMiningMethod,
      oreBodyName: locOreBody,
      targetCutoffGrade: locCutoffGrade,
      faceName,
      chainageFromM,
      chainageToM,
      blastPullMeters,
      currentHeadingRdChainage: displayChainage,
      headingDriveAzimuthDeg: locAzimuthDeg,
      faceInclinationDeg,
      stopeShape: locShape,
      stopeWidthM: locWidthM,
      stopeHeightM: locHeightM,
      wallHeightM: locWallHeightM,
      customProfilePoints: locShape === 'dxf_import' ? dxfImportedPoints : profileMetrics.points,
      mappingMode,
      facePhotoUrl: facePhotoUrl || undefined,
      hangingwallDipDeg: 72,
      footwallDipDeg: 68,
      oreSpecificGravity: 3.35,
      wasteSpecificGravity: 2.72,
      responsibleGeologist: projGeologist,
      // CRITICAL REQUIREMENT: starts with EMPTY CANVAS!
      features: [],
      channelSamples: [],
      veins: [],
    });

    setActiveMiningStopeId(newStope.id);
    onEnterFaceMapping(newStope);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-mono">
      <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Pickaxe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
                <span>Underground Face Setup &amp; Station Manager</span>
              </h2>
              <p className="text-xs text-slate-400 font-normal">
                {currentStage === 'PROJECT' && 'Step 1: Choose or Create Mine Project'}
                {currentStage === 'LOCATION' && 'Step 2: Location Heading & Underground Shape/Size'}
                {currentStage === 'FACE' && 'Step 3: Face Advance & Pull Chainage (From - To)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* 3-Stage Tab Switcher */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 text-center text-xs font-bold">
          {[
            { id: 'PROJECT' as const, label: '1. Project', sub: activeProj?.projectName || 'Project' },
            { id: 'LOCATION' as const, label: '2. Location & Shape', sub: `${locName} (${locShape})` },
            { id: 'FACE' as const, label: '3. Face & Advance', sub: `${faceName} (Pull)` },
          ].map((s) => {
            const isAct = currentStage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStage(s.id)}
                className={`py-2.5 px-2 border-b-2 transition-all cursor-pointer truncate ${
                  isAct
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <div className="truncate">{s.label}</div>
                <div className="text-[10px] text-slate-500 font-normal truncate">{s.sub}</div>
              </button>
            );
          })}
        </div>

        {/* STAGE BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* =================================================================
              STAGE 1: PROJECT SELECTION, CREATION, OR EDIT
              ================================================================= */}
          {currentStage === 'PROJECT' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 text-sm">
                  Select, Edit, or Initialize Mine Project
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProject(!isAddingProject);
                    setIsEditingProject(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingProject ? 'Select Existing Project' : 'Add New Project'}</span>
                </button>
              </div>

              {!isAddingProject && !isEditingProject ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {projects.map((p) => {
                      const isSel = p.id === selectedProjectId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setProjName(p.projectName);
                            setProjMineName(p.mineName);
                            setProjCompany(p.miningCompany);
                            setProjLocation(p.mineSiteLocation);
                            setProjCommodity(p.primaryCommodity);
                            setProjGradeUnit(p.gradeUnits);
                            setProjDatumMrl(p.mineDatumLevelMrl);
                            setProjGeologist(p.responsibleGeologist);
                          }}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative space-y-2 ${
                            isSel
                              ? 'bg-amber-500/15 border-amber-400 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-slate-100 text-sm">{p.projectName}</div>
                              <div className="text-[11px] text-slate-400">{p.mineName} · {p.miningCompany}</div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {p.primaryCommodity}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                            <span>Datum: {p.mineDatumLevelMrl} mRL</span>
                            <span>Units: {p.gradeUnits}</span>
                          </div>

                          {isSel && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Selected Active Project
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsEditingProject(true);
                                }}
                                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Edit Project
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Project Edit / Add Form */
                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-amber-400">
                      {isAddingProject ? '+ Create New Mining Project' : 'Edit Project Details'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingProject(false);
                        setIsEditingProject(false);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-slate-300 font-bold">Project Name:</span>
                      <input
                        type="text"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Mine Site / Deposit:</span>
                      <input
                        type="text"
                        value={projMineName}
                        onChange={(e) => setProjMineName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Mining Company:</span>
                      <input
                        type="text"
                        value={projCompany}
                        onChange={(e) => setProjCompany(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Primary Commodity:</span>
                      <select
                        value={projCommodity}
                        onChange={(e) => setProjCommodity(e.target.value as MiningCommodity)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold"
                      >
                        {COMMODITIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Grade Units:</span>
                      <select
                        value={projGradeUnit}
                        onChange={(e) => setProjGradeUnit(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
                      >
                        <option value="g/t">g/t (Grams/Tonne)</option>
                        <option value="%">% (Percent)</option>
                        <option value="ppm">ppm (Parts Per Million)</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Mine Datum RL (m):</span>
                      <input
                        type="number"
                        value={projDatumMrl}
                        onChange={(e) => setProjDatumMrl(parseFloat(e.target.value) || 1000)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Lead Geologist:</span>
                      <input
                        type="text"
                        value={projGeologist}
                        onChange={(e) => setProjGeologist(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleSaveProject}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save Project</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              STAGE 2: LOCATION & HEADING (Cross-Section Shape & Size)
              ================================================================= */}
          {currentStage === 'LOCATION' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 text-sm">
                    Heading Location &amp; Cross-Section Shape/Size
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    For project: <strong className="text-amber-400">{activeProj?.projectName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingLocation(!isAddingLocation)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingLocation ? 'Choose Existing Location' : 'New Location'}</span>
                </button>
              </div>

              {/* Location Selector (if existing exist) */}
              {!isAddingLocation && locationsForProj.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-slate-400 font-bold block">Select Heading Location:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {locationsForProj.map((l) => {
                      const isSel = l.id === selectedLocationId;
                      return (
                        <div
                          key={l.id}
                          onClick={() => {
                            setSelectedLocationId(l.id);
                            setLocName(l.locationName);
                            setLocLevel(l.mineLevel);
                            setLocLevelMrl(l.levelElevationMrl);
                            setLocExcavationType(l.excavationType);
                            setLocMiningMethod(l.miningMethod);
                            setLocOreBody(l.oreBodyName);
                            setLocCutoffGrade(l.targetCutoffGrade);
                            setLocShape(l.stopeShape);
                            setLocWidthM(l.stopeWidthM);
                            setLocHeightM(l.stopeHeightM);
                            setLocWallHeightM(l.wallHeightM);
                            setLocAzimuthDeg(l.headingDriveAzimuthDeg);
                          }}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer space-y-1 ${
                            isSel
                              ? 'bg-cyan-500/15 border-cyan-400 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-slate-100 text-xs flex items-center justify-between">
                            <span>{l.locationName}</span>
                            <span className="text-[10px] text-cyan-400 font-mono">{l.stopeShape}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{l.mineLevel} · {l.stopeWidthM}m W × {l.stopeHeightM}m H</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location Configuration & Shape Definition */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                {/* Left: Inputs & Shape Presets */}
                <div className="lg:col-span-7 space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Heading / Stope ID:</span>
                      <input
                        type="text"
                        value={locName}
                        onChange={(e) => setLocName(e.target.value)}
                        placeholder="e.g. HW-DRV-05"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Mine Level RL:</span>
                      <input
                        type="text"
                        value={locLevel}
                        onChange={(e) => setLocLevel(e.target.value)}
                        placeholder="e.g. Level 620 mRL"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                      />
                    </label>
                  </div>

                  {/* Excavation Shape Selector */}
                  <div className="space-y-1.5">
                    <span className="text-slate-300 font-bold block">Underground Excavation Shape:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {SHAPE_PRESETS.map((p) => {
                        const isSel = locShape === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setLocShape(p.id)}
                            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                              isSel
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-md'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="font-bold text-xs truncate">{p.label}</div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Parametric Size Dimensions */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Span / Width (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1.5"
                        max="25.0"
                        value={locWidthM}
                        onChange={(e) => setLocWidthM(parseFloat(e.target.value) || 4.8)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Total Height (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1.5"
                        max="25.0"
                        value={locHeightM}
                        onChange={(e) => setLocHeightM(parseFloat(e.target.value) || 4.2)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Wall Height (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max={locHeightM - 0.2}
                        value={locWallHeightM}
                        onChange={(e) => setLocWallHeightM(parseFloat(e.target.value) || 2.8)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                  </div>

                  {/* DXF Import UI */}
                  {locShape === 'dxf_import' && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                      <span className="font-bold text-cyan-400 block text-xs">Import Stope Profile DXF</span>
                      <label className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-dashed border-cyan-500/60 hover:bg-slate-850 text-cyan-300 font-bold flex items-center justify-center gap-2 cursor-pointer text-xs">
                        <Upload className="w-4 h-4" />
                        <span>{dxfFileName || 'Choose .DXF AutoCAD File'}</span>
                        <input
                          type="file"
                          accept=".dxf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleDxfUpload(f);
                          }}
                        />
                      </label>
                      {dxfImportedPoints.length > 0 && (
                        <p className="text-[11px] text-emerald-400 font-bold">
                          ✓ Successfully parsed {dxfImportedPoints.length} vertices from DXF.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: SVG Live Shape Preview */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold mb-2">Live Cross-Section Face Profile</span>
                  <div className="w-full h-52 flex items-center justify-center relative">
                    <svg
                      viewBox={`-0.5 -0.5 ${locWidthM + 1} ${locHeightM + 1}`}
                      className="w-full h-full max-h-48"
                    >
                      {/* Grid */}
                      <g opacity="0.15">
                        {Array.from({ length: Math.ceil(locWidthM) + 1 }).map((_, i) => (
                          <line key={`gx-${i}`} x1={i} y1="0" x2={i} y2={locHeightM} stroke="#CBD5E1" strokeWidth="0.04" />
                        ))}
                        {Array.from({ length: Math.ceil(locHeightM) + 1 }).map((_, i) => (
                          <line key={`gy-${i}`} x1="0" y1={i} x2={locWidthM} y2={i} stroke="#CBD5E1" strokeWidth="0.04" />
                        ))}
                      </g>

                      {/* Stope Polygon */}
                      <polygon
                        points={profileMetrics.points
                          .map((p) => `${p.x},${locHeightM - p.y}`)
                          .join(' ')}
                        fill="#F59E0B"
                        fillOpacity="0.25"
                        stroke="#F59E0B"
                        strokeWidth="0.08"
                      />

                      {profileMetrics.points.map((p, idx) => (
                        <circle key={idx} cx={p.x} cy={locHeightM - p.y} r="0.08" fill="#38BDF8" />
                      ))}
                    </svg>
                  </div>

                  <div className="w-full grid grid-cols-3 gap-1 pt-2 border-t border-slate-800 text-center text-[10px]">
                    <div>
                      <span className="text-slate-500">Span (W):</span>
                      <strong className="text-slate-200 block">{locWidthM} m</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Height (H):</span>
                      <strong className="text-slate-200 block">{locHeightM} m</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Face Area:</span>
                      <strong className="text-amber-400 block">{profileMetrics.areaM2} m²</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              STAGE 3: FACE & ADVANCE (Chainage From - To, Pull, Clean Slate)
              ================================================================= */}
          {currentStage === 'FACE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 text-sm">
                    Select Existing Face or Create New Blast Round
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Location: <strong className="text-cyan-400">{locName}</strong> · Level: <strong className="text-slate-200">{locLevel}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingFace(!isAddingFace)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingFace ? 'Resume Existing Face' : '+ Create New Face Round'}</span>
                </button>
              </div>

              {!isAddingFace && facesForLocation.length > 0 ? (
                /* Resume Existing Faces */
                <div className="space-y-2.5">
                  <span className="text-xs text-slate-400 font-bold block">Previously Mapped Faces:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {facesForLocation.map((f) => {
                      const isSel = f.id === selectedFaceId;
                      return (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFaceId(f.id)}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer space-y-1.5 ${
                            isSel
                              ? 'bg-emerald-500/15 border-emerald-400 shadow-md'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-slate-100 text-xs">{f.faceName || f.currentHeadingRdChainage}</strong>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400">
                              {f.channelSamples?.length || 0} Assays · {f.features?.length || 0} Features
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Pull: {f.blastPullMeters}m · Azimuth: {f.headingDriveAzimuthDeg || 45}° · {f.mineLevel}
                          </div>
                          {isSel && (
                            <div className="text-[10px] text-emerald-400 font-bold pt-1">
                              ✓ Ready to Resume Mapped Face
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Create New Face: Clean Empty Canvas */
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Configure New Blast Round Face (Starts Clean / Empty Canvas)</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Zero pre-seeded clutter</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-slate-300 font-bold">Face Identification / Cut #:</span>
                      <input
                        type="text"
                        value={faceName}
                        onChange={(e) => setFaceName(e.target.value)}
                        placeholder="e.g. Cut #16 or Round 18"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold"
                      />
                    </label>

                    {/* Chainage From - To and Pull */}
                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Chainage From (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={chainageFromM}
                        onChange={(e) => handleChainageFromChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Chainage To (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={chainageToM}
                        onChange={(e) => handleChainageToChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Blast Round Pull Length (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="8.0"
                        value={blastPullMeters}
                        onChange={(e) => handlePullChange(parseFloat(e.target.value) || 3.2)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-bold"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-slate-300 font-bold">Face Inclination (° from Horizontal):</span>
                      <input
                        type="number"
                        min="45"
                        max="90"
                        value={faceInclinationDeg}
                        onChange={(e) => setFaceInclinationDeg(parseFloat(e.target.value) || 90)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </label>
                  </div>

                  {/* Mapping Mode Selection */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-slate-300 font-bold block">Mapping Mode:</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setMappingMode('FIELD_SKETCH')}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          mappingMode === 'FIELD_SKETCH'
                            ? 'bg-amber-500/20 border-amber-400'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-100">
                          <PenTool className="w-4 h-4 text-amber-400" />
                          <span>Field Digital Sketch</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Calibrated metric canvas with scale grid, digital drafting pens, veins, and channel cuts.
                        </p>
                      </div>

                      <div
                        onClick={() => setMappingMode('PHOTOGRAMMETRY')}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          mappingMode === 'PHOTOGRAMMETRY'
                            ? 'bg-cyan-500/20 border-cyan-400'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-100">
                          <Camera className="w-4 h-4 text-cyan-400" />
                          <span>Photogrammetry Orthophoto</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Upload face photography, calibrate 1:1 scale, and trace features directly on imagery.
                        </p>
                      </div>
                    </div>
                  </div>

                  {mappingMode === 'PHOTOGRAMMETRY' && (
                    <div className="pt-2">
                      <label className="w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-cyan-500/40 hover:bg-slate-850 text-cyan-300 font-bold flex items-center justify-center gap-2 cursor-pointer text-xs transition-colors">
                        <Upload className="w-4 h-4" />
                        <span>Choose Face Photograph</span>
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
                                  setFacePhotoUrl(String(event.target.result));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {facePhotoUrl && (
                        <p className="text-[11px] text-emerald-400 font-bold mt-1 text-center">
                          ✓ Face photograph loaded successfully
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {currentStage !== 'PROJECT' ? (
            <button
              type="button"
              onClick={() => {
                if (currentStage === 'FACE') setCurrentStage('LOCATION');
                else if (currentStage === 'LOCATION') setCurrentStage('PROJECT');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStage === 'PROJECT' && (
            <button
              type="button"
              onClick={() => {
                handleSaveProject();
                setCurrentStage('LOCATION');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md cursor-pointer transition-all"
            >
              <span>Proceed to Location (Shape &amp; Size)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStage === 'LOCATION' && (
            <button
              type="button"
              onClick={() => {
                handleSaveLocation();
                setCurrentStage('FACE');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md cursor-pointer transition-all"
            >
              <span>Proceed to Face Selection &amp; Advance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStage === 'FACE' && (
            <button
              type="button"
              onClick={handleLaunchFaceMapping}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Enter Underground Face Mapping Workspace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
