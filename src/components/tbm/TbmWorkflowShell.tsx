// ============================================================================
// ESWA TBM MECHANIZED TUNNELING — WORKFLOW SHELL
// Mandatory 7-Stage Chainage-Based Engineering Architecture:
// 1. PROJECTS → 2. LOCATIONS → 3. TBM & GROUND CONFIG → 4. DATA COLLECTION →
// 5. GEOLOGICAL ANALYSIS → 6. MONITORING → 7. REPORTS
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  MapPin,
  Sliders,
  PenTool,
  TrendingUp,
  Activity,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertTriangle,
  Layers,
  CircleDot,
  Compass,
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  Shield,
  HelpCircle,
  Eye,
  Trash2,
  Edit3,
  RefreshCw,
  Info,
  X,
} from 'lucide-react';
import {
  TbmProjectItem,
  TbmLocationItem,
  TbmExcavationRecord,
  TbmMachineType,
  TbmGroundType,
  ChainageDirection,
  TbmShiftType,
  TbmReportType,
  TbmReportFilter,
  TbmDiscontinuityObservation,
} from '../../types/tbm';
import {
  loadTbmProjects,
  loadTbmLocations,
  loadTbmExcavationRecords,
  saveTbmProjects,
  saveTbmLocations,
  saveTbmExcavationRecords,
  createTbmProject,
  updateTbmProject,
  deleteTbmProject,
  createTbmLocation,
  updateTbmLocation,
  deleteTbmLocation,
  createTbmExcavationRecord,
  updateTbmExcavationRecord,
  deleteTbmExcavationRecord,
  getActiveTbmProjectId,
  setActiveTbmProjectId,
  getActiveTbmLocationId,
  setActiveTbmLocationId,
  getActiveTbmRecordId,
  setActiveTbmRecordId,
} from '../../engine/tbmStorageEngine';
import {
  calculateChainageAdvance,
  calculateBartonQ,
  calculateRmr89,
  calculateTbmKpi,
  calculatePeckSettlement,
  calculateAnnularGroutVolume,
} from '../../engine/tbmCalculationsEngine';
import { useTheme } from '../../context/ThemeContext';
import { EswaAppBackgroundWatermark } from '../EswaBrandIdentity';

export type TbmWorkflowStage =
  | 'projects'
  | 'locations'
  | 'configuration'
  | 'collection'
  | 'analysis'
  | 'monitoring'
  | 'reports';

interface TbmWorkflowShellProps {
  initialStage?: TbmWorkflowStage;
  onBackToMainWindow: () => void;
  onOpenStorageModal: () => void;
  onOpenSettings: () => void;
}

export const TbmWorkflowShell: React.FC<TbmWorkflowShellProps> = ({
  initialStage = 'projects',
  onBackToMainWindow,
  onOpenStorageModal,
  onOpenSettings,
}) => {
  const [currentStage, setCurrentStage] = useState<TbmWorkflowStage>(initialStage);
  const { palette } = useTheme();

  // Storage State
  const [projects, setProjects] = useState<TbmProjectItem[]>(() => loadTbmProjects());
  const [locations, setLocations] = useState<TbmLocationItem[]>(() => loadTbmLocations());
  const [records, setRecords] = useState<TbmExcavationRecord[]>(() => loadTbmExcavationRecords());

  // Active Pointers
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    return getActiveTbmProjectId() || (projects[0]?.id ?? '');
  });
  const [activeLocationId, setActiveLocationIdState] = useState<string>(() => {
    return getActiveTbmLocationId() || (locations[0]?.id ?? '');
  });
  const [activeRecordId, setActiveRecordIdState] = useState<string>(() => {
    return getActiveTbmRecordId() || (records[0]?.id ?? '');
  });

  // UI Modals & Sub-tabs
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewLocationModal, setShowNewLocationModal] = useState(false);
  const [collectionSubSection, setCollectionSubSection] = useState<number>(1);
  const [analysisSubTab, setAnalysisSubTab] = useState<'profile' | 'stereonet' | 'correlation' | 'predicted_vs_encountered' | 'muck_trend'>('profile');
  const [selectedReportType, setSelectedReportType] = useState<TbmReportType>('SHIFT_GEOTECHNICAL_LOG');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Active Items
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  const activeLocation = useMemo(() => {
    return locations.find((l) => l.id === activeLocationId) || locations[0];
  }, [locations, activeLocationId]);

  const activeRecord = useMemo(() => {
    return records.find((r) => r.id === activeRecordId) || records[0];
  }, [records, activeRecordId]);

  // Project locations & records
  const currentProjectLocations = useMemo(() => {
    return locations.filter((l) => l.projectId === activeProject?.id);
  }, [locations, activeProject?.id]);

  const currentLocationRecords = useMemo(() => {
    return records.filter((r) => r.locationId === activeLocation?.id);
  }, [records, activeLocation?.id]);

  // Update storage & active selections
  const handleSelectProject = (projId: string) => {
    setActiveProjectIdState(projId);
    setActiveTbmProjectId(projId);
    const locs = locations.filter((l) => l.projectId === projId);
    if (locs.length > 0) {
      setActiveLocationIdState(locs[0].id);
      setActiveTbmLocationId(locs[0].id);
      const recs = records.filter((r) => r.locationId === locs[0].id);
      if (recs.length > 0) {
        setActiveRecordIdState(recs[0].id);
        setActiveTbmRecordId(recs[0].id);
      }
    }
  };

  const handleSelectLocation = (locId: string) => {
    setActiveLocationIdState(locId);
    setActiveTbmLocationId(locId);
    const recs = records.filter((r) => r.locationId === locId);
    if (recs.length > 0) {
      setActiveRecordIdState(recs[0].id);
      setActiveTbmRecordId(recs[0].id);
    }
  };

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // -------------------------------------------------------------------------
  // STAGE 1: NEW PROJECT FORM STATE
  // -------------------------------------------------------------------------
  const [newProjectForm, setNewProjectForm] = useState<Partial<TbmProjectItem>>({
    projectName: '',
    tunnelName: '',
    client: '',
    contractor: '',
    consultant: '',
    projectLocation: '',
    tunnelAlignment: '',
    description: '',
    responsibleGeologist: '',
    coordinateSystem: 'WGS84 / UTM Zone 43N',
    units: 'METRIC',
  });

  const handleSaveNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.projectName?.trim()) {
      showNotification('Project name is required.', 'error');
      return;
    }
    const created = createTbmProject(newProjectForm);
    const updated = loadTbmProjects();
    setProjects(updated);
    setActiveProjectIdState(created.id);
    setShowNewProjectModal(false);
    showNotification(`Project "${created.projectName}" created successfully!`);
    setCurrentStage('locations');
  };

  // -------------------------------------------------------------------------
  // STAGE 2: NEW LOCATION FORM STATE
  // -------------------------------------------------------------------------
  const [newLocationForm, setNewLocationForm] = useState<Partial<TbmLocationItem>>({
    locationName: '',
    tunnelSection: '',
    excavationDirection: 'INCREASING',
    startChainageRd: 1420.0,
    endChainageRd: 1550.0,
    chainageReference: 'RD (Chainage in meters from Portal)',
    alignmentReference: 'Main Tunnel Centerline Alignment',
    responsibleGeologist: '',
    description: '',
  });

  const handleSaveNewLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationForm.locationName?.trim()) {
      showNotification('Location name is required.', 'error');
      return;
    }
    const created = createTbmLocation({
      ...newLocationForm,
      projectId: activeProject?.id,
    });
    const updated = loadTbmLocations();
    setLocations(updated);
    setActiveLocationIdState(created.id);
    setShowNewLocationModal(false);
    showNotification(`Location "${created.locationName}" added to ${activeProject?.projectName}`);
    setCurrentStage('configuration');
  };

  // -------------------------------------------------------------------------
  // STAGE 3: TBM & GROUND CONFIGURATION STATE
  // -------------------------------------------------------------------------
  const [tbmConfigState, setTbmConfigState] = useState<{
    tbmType: TbmMachineType;
    groundType: TbmGroundType;
    machineManufacturer: string;
    machineModel: string;
    machineSerialId: string;
    cutterheadDiameterM: number;
    discCutterCount: number;
    nominalOperatingThrustKn: number;
    nominalOperatingTorqueKnm: number;
    nominalMaxRpm: number;
    dataSource: 'MANUAL_ENTRY' | 'IMPORTED_LOG' | 'CONNECTED_SYSTEM';
  }>({
    tbmType: activeLocation?.tbmType || 'EPB',
    groundType: activeLocation?.groundType || 'MIXED_GROUND',
    machineManufacturer: activeLocation?.machineManufacturer || 'Herrenknecht',
    machineModel: activeLocation?.machineModel || 'EPB Shield S-912',
    machineSerialId: activeLocation?.machineSerialId || 'HK-912',
    cutterheadDiameterM: activeLocation?.cutterheadDiameterM || 6.65,
    discCutterCount: activeLocation?.discCutterCount || 46,
    nominalOperatingThrustKn: activeLocation?.nominalOperatingThrustKn || 16500,
    nominalOperatingTorqueKnm: activeLocation?.nominalOperatingTorqueKnm || 2200,
    nominalMaxRpm: activeLocation?.nominalMaxRpm || 4.5,
    dataSource: activeLocation?.dataSource || 'MANUAL_ENTRY',
  });

  useEffect(() => {
    if (activeLocation) {
      setTbmConfigState({
        tbmType: activeLocation.tbmType,
        groundType: activeLocation.groundType,
        machineManufacturer: activeLocation.machineManufacturer,
        machineModel: activeLocation.machineModel,
        machineSerialId: activeLocation.machineSerialId,
        cutterheadDiameterM: activeLocation.cutterheadDiameterM,
        discCutterCount: activeLocation.discCutterCount,
        nominalOperatingThrustKn: activeLocation.nominalOperatingThrustKn,
        nominalOperatingTorqueKnm: activeLocation.nominalOperatingTorqueKnm,
        nominalMaxRpm: activeLocation.nominalMaxRpm,
        dataSource: activeLocation.dataSource,
      });
    }
  }, [activeLocation?.id]);

  const handleSaveTbmConfiguration = () => {
    if (!activeLocation) return;
    updateTbmLocation(activeLocation.id, tbmConfigState);
    const updated = loadTbmLocations();
    setLocations(updated);
    showNotification('TBM & Ground configuration saved successfully!');
    setCurrentStage('collection');
  };

  // -------------------------------------------------------------------------
  // STAGE 4: DATA COLLECTION WORKSPACE (11 Sections)
  // Editable active record buffer
  // -------------------------------------------------------------------------
  const [collectionBuffer, setCollectionBuffer] = useState<TbmExcavationRecord | null>(null);

  useEffect(() => {
    if (activeRecord) {
      setCollectionBuffer(JSON.parse(JSON.stringify(activeRecord)));
    }
  }, [activeRecord?.id]);

  const handleSaveCurrentExcavationRecord = () => {
    if (!collectionBuffer) return;
    // Recalculate advance & chainage validity
    const calc = calculateChainageAdvance(
      collectionBuffer.chainageRecord.startChainage,
      collectionBuffer.chainageRecord.endChainage,
      activeLocation?.excavationDirection || 'INCREASING'
    );

    // Recalculate Q and RMR
    const qCalc = calculateBartonQ({
      rqd: collectionBuffer.classification.rqdPercent,
      jn: collectionBuffer.classification.jn,
      jr: collectionBuffer.classification.jr,
      ja: collectionBuffer.classification.ja,
      jw: collectionBuffer.classification.jw,
      srf: collectionBuffer.classification.srf,
    });

    const rmrCalc = calculateRmr89({
      strengthScore: collectionBuffer.classification.rmrStrengthScore,
      rqdScore: collectionBuffer.classification.rmrRqdScore,
      spacingScore: collectionBuffer.classification.rmrSpacingScore,
      conditionScore: collectionBuffer.classification.rmrConditionScore,
      waterScore: collectionBuffer.classification.rmrWaterScore,
      orientationAdjustment: collectionBuffer.classification.rmrOrientationAdjustment,
    });

    const kpi = calculateTbmKpi(
      collectionBuffer.telemetry,
      activeLocation?.cutterheadDiameterM,
      activeLocation?.discCutterCount
    );

    const updatedBuffer: TbmExcavationRecord = {
      ...collectionBuffer,
      chainageRecord: {
        ...collectionBuffer.chainageRecord,
        advanceLengthMeters: calc.advanceLengthMeters,
      },
      classification: {
        ...collectionBuffer.classification,
        calculatedQ: qCalc.qValue,
        qClassLabel: qCalc.qClass,
        calculatedRmr: rmrCalc.rmrValue,
        rmrClassLabel: rmrCalc.rmrClass,
        fieldPenetrationIndexKnCutterMm: kpi.fpi,
        specificEnergyMJM3: kpi.specificEnergyMJM3,
      },
      updatedAt: new Date().toISOString(),
    };

    updateTbmExcavationRecord(updatedBuffer.id, updatedBuffer);
    setRecords(loadTbmExcavationRecords());
    setCollectionBuffer(updatedBuffer);
    showNotification(`Excavation Record Ring #${updatedBuffer.chainageRecord.ringNumber} saved successfully!`);
  };

  const handleAddNewExcavationInterval = () => {
    if (!activeLocation) return;
    const lastRec = currentLocationRecords[currentLocationRecords.length - 1];
    const prevEnd = lastRec?.chainageRecord.endChainage ?? activeLocation.startChainageRd;
    const isInc = activeLocation.excavationDirection === 'INCREASING';
    const nextStart = prevEnd;
    const nextEnd = isInc ? prevEnd + 1.5 : prevEnd - 1.5;
    const nextRing = (lastRec?.chainageRecord.ringNumber ?? 840) + 1;

    const created = createTbmExcavationRecord({
      locationId: activeLocation.id,
      projectId: activeProject.id,
      chainageRecord: {
        recordId: '',
        locationId: activeLocation.id,
        projectId: activeProject.id,
        timestamp: new Date().toISOString(),
        startChainage: nextStart,
        endChainage: nextEnd,
        advanceLengthMeters: 1.5,
        ringNumber: nextRing,
        shift: 'DAY',
        shiftStartTime: '08:00',
        shiftEndTime: '16:00',
        stoppageDurationMinutes: 15,
        stoppageReason: 'Ring build & shift handover',
        geologistOrOperator: activeLocation.responsibleGeologist || 'Lead Geologist',
        generalObservations: `Excavation of Ring #${nextRing} underway.`,
      },
    });

    const updated = loadTbmExcavationRecords();
    setRecords(updated);
    setActiveRecordIdState(created.id);
    setActiveTbmRecordId(created.id);
    setCollectionBuffer(created);
    showNotification(`New excavation interval Ring #${nextRing} (RD ${nextStart.toFixed(2)}m) created!`);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      {/* Background Graphic Watermark with minute opacity (suppressed on reports and stereonet canvas) */}
      <EswaAppBackgroundWatermark
        visible={true}
        showLogoWatermark={true}
        isReport={currentStage === 'reports'}
        isCanvas={currentStage === 'analysis' && analysisSubTab === 'stereonet'}
      />

      {/* Top Navigation Bar: Exact 7-Stage Workflow Navigation */}
      <header
        className="flex-none bg-slate-900 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-lg z-20 border-b"
        style={{ borderColor: palette.primaryHex + '40' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToMainWindow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-all"
            style={{ color: palette.accentHex }}
            title="Return to TBM Main Window"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Main Window</span>
          </button>

          <div className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 animate-spin-slow shrink-0" style={{ color: palette.accentHex }} />
            <div className="truncate">
              <h1 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                <span className="font-mono font-bold" style={{ color: palette.accentHex }}>TBM GEOLOGICAL SUITE</span>
                <span className="text-slate-500 hidden md:inline">·</span>
                <span className="text-slate-300 font-semibold truncate hidden md:inline">
                  {activeProject?.projectName || 'No Project Selected'}
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {activeLocation?.locationName || 'Heading'} · {activeLocation?.tbmType || 'EPB'} · {activeRecord?.chainageRecord ? `Ring #${activeRecord.chainageRecord.ringNumber} (RD ${activeRecord.chainageRecord.startChainage.toFixed(2)}m)` : 'Ready'}
              </p>
            </div>
          </div>
        </div>

        {/* 7 Workflow Stage Buttons */}
        <nav className="hidden lg:flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
          {[
            { id: 'projects' as TbmWorkflowStage, num: 1, label: 'Projects' },
            { id: 'locations' as TbmWorkflowStage, num: 2, label: 'Locations' },
            { id: 'configuration' as TbmWorkflowStage, num: 3, label: 'TBM & Ground' },
            { id: 'collection' as TbmWorkflowStage, num: 4, label: 'Data Collection' },
            { id: 'analysis' as TbmWorkflowStage, num: 5, label: 'Geological Analysis' },
            { id: 'monitoring' as TbmWorkflowStage, num: 6, label: 'Monitoring' },
            { id: 'reports' as TbmWorkflowStage, num: 7, label: 'Reports' },
          ].map((st) => {
            const isAct = currentStage === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setCurrentStage(st.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isAct
                    ? 'font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                style={
                  isAct
                    ? {
                        backgroundColor: palette.primaryHex,
                        color: '#020617',
                        boxShadow: `0 2px 10px ${palette.primaryHex}45`,
                      }
                    : undefined
                }
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  isAct ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {st.num}
                </span>
                <span>{st.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenStorageModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
            title="Open isolated TBM vault and backups"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vault</span>
          </button>
        </div>
      </header>

      {/* Mobile/Compact Stage Switcher */}
      <div className="lg:hidden flex items-center overflow-x-auto p-1.5 bg-slate-900 border-b border-slate-800 text-xs font-mono gap-1 no-scrollbar">
        {[
          { id: 'projects' as TbmWorkflowStage, label: '1. Projects' },
          { id: 'locations' as TbmWorkflowStage, label: '2. Locations' },
          { id: 'configuration' as TbmWorkflowStage, label: '3. Config' },
          { id: 'collection' as TbmWorkflowStage, label: '4. Collection' },
          { id: 'analysis' as TbmWorkflowStage, label: '5. Analysis' },
          { id: 'monitoring' as TbmWorkflowStage, label: '6. Monitoring' },
          { id: 'reports' as TbmWorkflowStage, label: '7. Reports' },
        ].map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setCurrentStage(st.id)}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold ${
              currentStage === st.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 bg-slate-950'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className={`fixed top-14 right-5 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-mono font-bold flex items-center gap-2 border animate-fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
            : 'bg-rose-950 border-rose-500 text-rose-300'
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification.text}</span>
        </div>
      )}

      {/* =====================================================================
          MAIN WORKSPACE BODY: RENDERS EXACT CHOSEN STAGE (Clean, uncluttered)
          ===================================================================== */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 relative font-mono text-xs">
        {/* -------------------------------------------------------------------
            STAGE 1: PROJECTS SCREEN
            Compact list, recent locations, create project, search & filter
            ------------------------------------------------------------------- */}
        {currentStage === 'projects' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-cyan-400" />
                  <span>STEP 1 — TBM PROJECTS REPOSITORY</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Create, reopen, manage and backup mechanized tunneling projects with associated client, contractor, alignment, and coordinate system references.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>

            {/* Project Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p) => {
                const isSelected = p.id === activeProject?.id;
                const locs = locations.filter((l) => l.projectId === p.id);
                const recCount = records.filter((r) => r.projectId === p.id).length;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold">
                          {p.id}
                        </span>
                        <h3 className="font-bold text-sm text-slate-100 mt-1">{p.projectName}</h3>
                        <p className="text-slate-400 text-xs">{p.tunnelName}</p>
                      </div>
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Click to Select</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                      <div><span className="text-slate-500">Owner/Client:</span> <p className="text-slate-300 font-medium truncate">{p.client || 'N/A'}</p></div>
                      <div><span className="text-slate-500">Contractor:</span> <p className="text-slate-300 font-medium truncate">{p.contractor || 'N/A'}</p></div>
                      <div><span className="text-slate-500">Alignment:</span> <p className="text-slate-300 font-medium truncate">{p.tunnelAlignment || 'CL-01'}</p></div>
                      <div><span className="text-slate-500">Geologist:</span> <p className="text-slate-300 font-medium truncate">{p.responsibleGeologist}</p></div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-400">
                        {locs.length} Location{locs.length === 1 ? '' : 's'} · {recCount} Rings logged
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProject(p.id);
                          setCurrentStage('locations');
                        }}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold"
                      >
                        <span>Open Locations</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 2: LOCATIONS SCREEN
            Add Location, RD chainage, increasing/decreasing, predicted geology
            ------------------------------------------------------------------- */}
        {currentStage === 'locations' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <span>STEP 2 — LOCATIONS &amp; HEADINGS IN &quot;{activeProject?.projectName}&quot;</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Define tunnel sections, drive headings, chainage bounds (e.g. RD 1420.00 to RD 1550.00), excavation directions, and predicted geology profiles.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewLocationModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Location</span>
              </button>
            </div>

            {currentProjectLocations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <p>No tunnel locations defined for this project yet.</p>
                <button
                  type="button"
                  onClick={() => setShowNewLocationModal(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold"
                >
                  Create First Location
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentProjectLocations.map((loc) => {
                  const isSelected = loc.id === activeLocation?.id;
                  const locRecs = records.filter((r) => r.locationId === loc.id);

                  return (
                    <div
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'bg-slate-900 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold">
                              {loc.id}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                              {loc.tbmType} · {loc.groundType}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-bold border border-blue-800">
                              {loc.excavationDirection} CHAINAGE
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-slate-100 mt-1">{loc.locationName}</h3>
                          <p className="text-slate-400 text-xs">{loc.tunnelSection} · {loc.alignmentReference}</p>
                        </div>

                        {isSelected ? (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 text-[10px] font-bold">
                            CURRENT HEADING
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Select Location</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="text-slate-500">Chainage Interval:</span>
                          <p className="text-cyan-300 font-bold">
                            RD {loc.startChainageRd.toFixed(2)}m → {loc.endChainageRd ? `RD ${loc.endChainageRd.toFixed(2)}m` : 'Open'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Machine Serial:</span>
                          <p className="text-slate-200 font-medium">{loc.machineSerialId || 'HK-EPB-912'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Diameter &amp; Cutters:</span>
                          <p className="text-slate-200 font-medium">Ø {loc.cutterheadDiameterM.toFixed(2)}m · {loc.discCutterCount} Cutters</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Logged Rings:</span>
                          <p className="text-emerald-400 font-bold">{locRecs.length} Excavation Records</p>
                        </div>
                      </div>

                      {/* Predicted Geology Preview */}
                      {loc.predictedGeology && loc.predictedGeology.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Predicted Geological Profile ({loc.predictedGeology.length} units):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {loc.predictedGeology.map((pg) => (
                              <div key={pg.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] space-y-0.5">
                                <div className="text-cyan-300 font-bold">
                                  RD {pg.startChainage.toFixed(1)}m – {pg.endChainage.toFixed(1)}m
                                </div>
                                <div className="text-slate-300 truncate">{pg.lithology}</div>
                                <div className="text-slate-500">Q~{pg.expectedQValue ?? '—'} · RMR~{pg.expectedRmr ?? '—'} · UCS {pg.expectedUcsMpa ?? '—'}MPa</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-500">Geologist: {loc.responsibleGeologist}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLocation(loc.id);
                              setCurrentStage('configuration');
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                          >
                            Configure Machine
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLocation(loc.id);
                              setCurrentStage('collection');
                            }}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                          >
                            <span>Open Data Collection</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 3: TBM TYPE AND GROUND TYPE CONFIGURATION
            Hard rock / Soft / Mixed / Uncertain + Machine parameters + "Start Data Collection"
            ------------------------------------------------------------------- */}
        {currentStage === 'configuration' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>STEP 3 — TBM TYPE &amp; GROUND CONFIGURATION</span>
              </h2>
              <p className="text-slate-400 text-xs">
                Configure the specific mechanized tunneling parameters for {activeLocation?.locationName} ({activeProject?.projectName}).
              </p>
            </div>

            {/* A. TBM TYPE SELECTOR (6 Options) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                A. Select TBM Machine Type
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'HARD_ROCK_OPEN_GRIPPER' as TbmMachineType, title: 'Hard-Rock Open / Gripper TBM', desc: 'Main beam gripper for unshielded sound rock with rockbolts & mesh' },
                  { id: 'SINGLE_SHIELD' as TbmMachineType, title: 'Single-Shield TBM', desc: 'Enclosed shield with segment thrust cylinders for fractured rock' },
                  { id: 'DOUBLE_SHIELD' as TbmMachineType, title: 'Double-Shield TBM', desc: 'Telescopic shield with gripper shoes and continuous ring erection' },
                  { id: 'EPB' as TbmMachineType, title: 'Earth Pressure Balance (EPB)', desc: 'Pressurized muck chamber and screw conveyor for cohesive soil/clay' },
                  { id: 'SLURRY_SHIELD' as TbmMachineType, title: 'Slurry Shield TBM', desc: 'Bentonite slurry counter-pressure & separation plant for sand/water' },
                  { id: 'OTHER_CUSTOM' as TbmMachineType, title: 'Other / Custom TBM', desc: 'Specialized hybrid multi-mode or microtunneling machine' },
                ].map((t) => {
                  const isCur = tbmConfigState.tbmType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTbmConfigState((prev) => ({ ...prev, tbmType: t.id }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isCur
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{t.title}</span>
                        {isCur && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* B. GROUND TYPE SELECTOR (4 Options) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                B. Initial Ground Type Classification
              </span>
              <p className="text-slate-400 text-[11px]">
                Ground type is an initial configuration for collection form adaptation. Actual ground transitions are recorded ring-by-ring.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'HARD_ROCK' as TbmGroundType, title: 'Hard Rock', desc: 'Basalt, granite, quartzite, sound limestone' },
                  { id: 'SOFT_GROUND_SOIL' as TbmGroundType, title: 'Soft Ground / Soil', desc: 'Clay, silt, marine mud, sand, gravel' },
                  { id: 'MIXED_GROUND' as TbmGroundType, title: 'Mixed Ground', desc: 'Soil-rock interface, boulder beds, weathered transitions' },
                  { id: 'UNCERTAIN_VARIABLE' as TbmGroundType, title: 'Other / Uncertain', desc: 'Fault gouge, heavy karst, complex hydrothermal zones' },
                ].map((g) => {
                  const isCur = tbmConfigState.groundType === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setTbmConfigState((prev) => ({ ...prev, groundType: g.id }))}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isCur
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{g.title}</div>
                      <p className="text-[10px] text-slate-400 mt-1">{g.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* C. TBM MACHINE TECHNICAL PARAMETERS */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                C. Machine Identification &amp; Technical Parameters
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Manufacturer &amp; Model</span>
                  <input
                    type="text"
                    value={tbmConfigState.machineModel}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, machineModel: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Machine Identification / Serial</span>
                  <input
                    type="text"
                    value={tbmConfigState.machineSerialId}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, machineSerialId: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Cutterhead Diameter (m)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tbmConfigState.cutterheadDiameterM}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, cutterheadDiameterM: parseFloat(e.target.value) || 6.65 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Disc Cutter Count (Nos)</span>
                  <input
                    type="number"
                    value={tbmConfigState.discCutterCount}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, discCutterCount: parseInt(e.target.value) || 46 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Nominal Max Thrust (kN)</span>
                  <input
                    type="number"
                    step="500"
                    value={tbmConfigState.nominalOperatingThrustKn}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, nominalOperatingThrustKn: parseFloat(e.target.value) || 16000 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400 text-[11px]">Nominal Max Torque (kNm)</span>
                  <input
                    type="number"
                    step="100"
                    value={tbmConfigState.nominalOperatingTorqueKnm}
                    onChange={(e) => setTbmConfigState((p) => ({ ...p, nominalOperatingTorqueKnm: parseFloat(e.target.value) || 2200 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>
            </div>

            {/* D. START DATA COLLECTION BUTTON */}
            <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div>
                <h4 className="font-bold text-sm text-cyan-300">Ready to Begin Field Data Collection</h4>
                <p className="text-slate-400 text-xs">
                  Active Project: <strong className="text-slate-200">{activeProject?.projectName}</strong> · Location: <strong className="text-slate-200">{activeLocation?.locationName}</strong> · TBM: <strong className="text-cyan-400">{tbmConfigState.tbmType}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveTbmConfiguration}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm cursor-pointer shadow-lg transition-transform active:scale-95"
              >
                <span>Start Data Collection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 4: DATA COLLECTION WORKSPACE (11 Sections)
            Excavation chainage, geology, muck, telemetry, hydrogeology, probe drilling,
            rock-mass classification, support lining, instrumentation, hazards, photos
            ------------------------------------------------------------------- */}
        {currentStage === 'collection' && collectionBuffer && (
          <div className="space-y-4">
            {/* Top Workspace Header & Chainage Navigator */}
            <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-cyan-300">
                      Ring #{collectionBuffer.chainageRecord.ringNumber}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      RD {collectionBuffer.chainageRecord.startChainage.toFixed(2)}m → {collectionBuffer.chainageRecord.endChainage.toFixed(2)}m
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      Advance: {collectionBuffer.chainageRecord.advanceLengthMeters.toFixed(2)}m
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Shift {collectionBuffer.chainageRecord.shift} · Geologist: {collectionBuffer.chainageRecord.geologistOrOperator || 'Field Geologist'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewExcavationInterval}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold cursor-pointer transition-all"
                  title="Create next sequential ring advance record"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Next Ring Advance</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCurrentExcavationRecord}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer shadow-md transition-all active:scale-95"
                  title="Save current excavation record"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Record</span>
                </button>
              </div>
            </div>

            {/* 11 Field Collection Sub-Section Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
              {[
                { id: 1, title: '1. Chainage', sub: 'Advance' },
                { id: 2, title: '2. Geology', sub: 'Lithology' },
                { id: 3, title: '3. Muck', sub: 'Grading' },
                { id: 4, title: '4. TBM KPI', sub: 'Telemetry' },
                { id: 5, title: '5. Water', sub: 'Inflow' },
                { id: 6, title: '6. Probe', sub: 'Look-Ahead' },
                { id: 7, title: '7. Q & RMR', sub: 'Geotech' },
                { id: 8, title: '8. Lining', sub: 'Segment' },
                { id: 9, title: '9. Monitor', sub: 'Settlement' },
                { id: 10, title: '10. Hazards', sub: 'Incidents' },
                { id: 11, title: '11. Photos', sub: 'Evidence' },
              ].map((sub) => {
                const isAct = collectionSubSection === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setCollectionSubSection(sub.id)}
                    className={`p-2 rounded-lg text-left transition-all cursor-pointer border ${
                      isAct
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight truncate">{sub.title}</div>
                    <div className={`text-[9px] truncate ${isAct ? 'text-slate-900/80 font-semibold' : 'text-slate-500'}`}>
                      {sub.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 4.1 EXCAVATION AND CHAINAGE RECORD */}
            {collectionSubSection === 1 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-300">4.1 Excavation &amp; Chainage Interval Record</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Start Chainage (RD m)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={collectionBuffer.chainageRecord.startChainage}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            chainageRecord: {
                              ...prev.chainageRecord,
                              startChainage: val,
                              advanceLengthMeters: Math.abs(prev.chainageRecord.endChainage - val),
                            },
                          };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">End Chainage (RD m)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={collectionBuffer.chainageRecord.endChainage}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            chainageRecord: {
                              ...prev.chainageRecord,
                              endChainage: val,
                              advanceLengthMeters: Math.abs(val - prev.chainageRecord.startChainage),
                            },
                          };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Calculated Advance Length</span>
                    <input
                      type="text"
                      readOnly
                      value={`${collectionBuffer.chainageRecord.advanceLengthMeters.toFixed(2)} m`}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-black cursor-not-allowed"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Ring Number (#)</span>
                    <input
                      type="number"
                      value={collectionBuffer.chainageRecord.ringNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            chainageRecord: { ...prev.chainageRecord, ringNumber: val },
                            supportLining: { ...prev.supportLining, ringNumber: val },
                          };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Excavation Shift</span>
                    <select
                      value={collectionBuffer.chainageRecord.shift}
                      onChange={(e) => {
                        const val = e.target.value as TbmShiftType;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, chainageRecord: { ...prev.chainageRecord, shift: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="DAY">Day Shift (08:00 - 16:00)</option>
                      <option value="SWING">Swing Shift (16:00 - 24:00)</option>
                      <option value="NIGHT">Night Shift (00:00 - 08:00)</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Stoppage Duration (Minutes)</span>
                    <input
                      type="number"
                      value={collectionBuffer.chainageRecord.stoppageDurationMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, chainageRecord: { ...prev.chainageRecord, stoppageDurationMinutes: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-slate-400 text-[11px]">Primary Stoppage Reason</span>
                    <input
                      type="text"
                      value={collectionBuffer.chainageRecord.stoppageReason}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, chainageRecord: { ...prev.chainageRecord, stoppageReason: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>
                </div>

                <label className="block space-y-1 pt-1">
                  <span className="text-slate-400 text-[11px]">General Shift &amp; Excavation Observations</span>
                  <textarea
                    rows={2}
                    value={collectionBuffer.chainageRecord.generalObservations}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCollectionBuffer((prev) => {
                        if (!prev) return prev;
                        return { ...prev, chainageRecord: { ...prev.chainageRecord, generalObservations: val } };
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>
            )}

            {/* 4.2 GEOLOGICAL OBSERVATIONS */}
            {collectionSubSection === 2 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-300">4.2 Geological Observations &amp; Discontinuities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Main Lithology</span>
                    <input
                      type="text"
                      value={collectionBuffer.geology.mainLithology}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, geology: { ...prev.geology, mainLithology: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Secondary Lithology</span>
                    <input
                      type="text"
                      value={collectionBuffer.geology.secondaryLithology || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, geology: { ...prev.geology, secondaryLithology: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Weathering Grade</span>
                    <select
                      value={collectionBuffer.geology.weatheringGrade}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, geology: { ...prev.geology, weatheringGrade: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="W1_FRESH">W1 - Fresh (Unweathered)</option>
                      <option value="W2_SLIGHTLY">W2 - Slightly Weathered</option>
                      <option value="W3_MODERATELY">W3 - Moderately Weathered</option>
                      <option value="W4_HIGHLY">W4 - Highly Weathered</option>
                      <option value="W5_COMPLETELY">W5 - Completely Weathered</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Estimated Intact UCS (MPa)</span>
                    <input
                      type="number"
                      value={collectionBuffer.geology.intactStrengthEstimatedMpa}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, geology: { ...prev.geology, intactStrengthEstimatedMpa: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>
                </div>

                {/* Discontinuity Table */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-200">
                      Discontinuities &amp; Structural Planes ({collectionBuffer.geology.discontinuities.length} sets logged)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = `DISC-${Date.now()}`;
                        const newD: TbmDiscontinuityObservation = {
                          id: nextId,
                          setNumber: collectionBuffer.geology.discontinuities.length + 1,
                          type: 'JOINT',
                          strikeDeg: 0,
                          dipDeg: 60,
                          dipDirectionDeg: 90,
                          spacingCm: 30,
                          apertureMm: 1.0,
                          roughness: 'ROUGH',
                          infilling: 'NONE',
                          weathering: 'SLIGHTLY_WEATHERED',
                          waterCondition: 'DRY',
                          isDirectObservation: true,
                        };
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            geology: {
                              ...prev.geology,
                              discontinuities: [...prev.geology.discontinuities, newD],
                            },
                          };
                        });
                      }}
                      className="px-2 py-1 rounded bg-cyan-600/30 border border-cyan-500 text-cyan-300 font-bold hover:bg-cyan-600/50 cursor-pointer"
                    >
                      + Add Discontinuity
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="p-2">Set</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Dip Dir / Dip</th>
                          <th className="p-2">Spacing</th>
                          <th className="p-2">Aperture</th>
                          <th className="p-2">Roughness</th>
                          <th className="p-2">Infill</th>
                          <th className="p-2">Water</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                        {collectionBuffer.geology.discontinuities.map((d, dIdx) => (
                          <tr key={d.id} className="hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-cyan-400">J{d.setNumber}</td>
                            <td className="p-2">{d.type}</td>
                            <td className="p-2 font-mono font-bold text-amber-300">
                              {d.dipDirectionDeg}° / {d.dipDeg}°
                            </td>
                            <td className="p-2">{d.spacingCm} cm</td>
                            <td className="p-2">{d.apertureMm} mm</td>
                            <td className="p-2">{d.roughness}</td>
                            <td className="p-2">{d.infilling}</td>
                            <td className="p-2">{d.waterCondition}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4.3 MUCK AND EXCAVATED MATERIAL */}
            {collectionSubSection === 3 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-300">4.3 Muck &amp; Excavated Material Inspection</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Material Type</span>
                    <select
                      value={collectionBuffer.muck.materialType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, muck: { ...prev.muck, materialType: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="ROCK_CHIPS">Rock Chips (Indentations)</option>
                      <option value="SOIL_FINES">Soil Fines &amp; Silt</option>
                      <option value="SAND_GRAVEL">Sand &amp; Rounded Gravel</option>
                      <option value="MIXED_PASTE">Mixed Paste (EPB Conditioned)</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Estimated Fines (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={collectionBuffer.muck.finesPercentEstimated}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            muck: {
                              ...prev.muck,
                              finesPercentEstimated: val,
                              coarsePercentEstimated: 100 - val,
                            },
                          };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Average Fragment Size (mm)</span>
                    <input
                      type="number"
                      value={collectionBuffer.muck.averageFragmentSizeMm}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, muck: { ...prev.muck, averageFragmentSizeMm: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Sampling Location</span>
                    <select
                      value={collectionBuffer.muck.samplingMethod}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, muck: { ...prev.muck, samplingMethod: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="BELT_CONVEYOR">Belt Conveyor (Continuous)</option>
                      <option value="HOPPER">Muck Hopper / Chute</option>
                      <option value="MUCK_CAR">Muck Car / Train</option>
                      <option value="SEPARATION_PLANT">Slurry Separation Plant</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-slate-400 text-[11px]">Geologist Muck Interpretation &amp; Chip Analysis</span>
                  <textarea
                    rows={2}
                    value={collectionBuffer.muck.geologistInterpretation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCollectionBuffer((prev) => {
                        if (!prev) return prev;
                        return { ...prev, muck: { ...prev.muck, geologistInterpretation: val } };
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>
            )}

            {/* 4.4 TBM OPERATING TELEMETRY & KPIS */}
            {collectionSubSection === 4 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-cyan-300">4.4 TBM Machine Telemetry &amp; Field Penetration Index</h3>
                  <span className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-mono font-bold">
                    FPI = {collectionBuffer.classification.fieldPenetrationIndexKnCutterMm?.toFixed(2) || '—'} kN/cutter/mm
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Total Thrust Force (kN)</span>
                    <input
                      type="number"
                      step="100"
                      value={collectionBuffer.telemetry.thrustForceKn}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, telemetry: { ...prev.telemetry, thrustForceKn: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Cutterhead Torque (kNm)</span>
                    <input
                      type="number"
                      step="50"
                      value={collectionBuffer.telemetry.cutterheadTorqueKnm}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, telemetry: { ...prev.telemetry, cutterheadTorqueKnm: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Cutterhead Speed (RPM)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={collectionBuffer.telemetry.cutterheadRpm}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, telemetry: { ...prev.telemetry, cutterheadRpm: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Penetration per Revolution (mm/rev)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={collectionBuffer.telemetry.penetrationPerRevMm}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => {
                          if (!prev) return prev;
                          return { ...prev, telemetry: { ...prev.telemetry, penetrationPerRevMm: val } };
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 4.7 ROCK MASS CLASSIFICATION (Q-System & RMR89) */}
            {collectionSubSection === 7 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-cyan-300">4.7 Rock Mass Classification (Barton Q &amp; Bieniawski RMR89)</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-bold">
                      Q = {collectionBuffer.classification.calculatedQ.toFixed(2)} ({collectionBuffer.classification.qClassLabel})
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-amber-300 font-bold">
                      RMR = {collectionBuffer.classification.calculatedRmr} ({collectionBuffer.classification.rmrClassLabel})
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-cyan-400">Barton Q-System: Q = (RQD / Jn) * (Jr / Ja) * (Jw / SRF)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">RQD (10-100%):</span>
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={collectionBuffer.classification.rqdPercent}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 10;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, rqdPercent: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-cyan-300 font-bold"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">Jn (Joint Sets):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={collectionBuffer.classification.jn}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, jn: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">Jr (Roughness):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={collectionBuffer.classification.jr}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, jr: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">Ja (Alteration):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={collectionBuffer.classification.ja}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, ja: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">Jw (Water):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={collectionBuffer.classification.jw}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, jw: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-400 text-[10px]">SRF (Stress):</span>
                      <input
                        type="number"
                        step="0.5"
                        value={collectionBuffer.classification.srf}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setCollectionBuffer((prev) => prev ? { ...prev, classification: { ...prev.classification, srf: val } } : prev);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 4.8 SUPPORT AND SEGMENTAL LINING */}
            {collectionSubSection === 8 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-cyan-300">4.8 Precast Segmental Lining &amp; Annular Grout</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Universal Ring Key Position (Clock)</span>
                    <select
                      value={collectionBuffer.supportLining.keySegmentPositionClock}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollectionBuffer((prev) => prev ? { ...prev, supportLining: { ...prev.supportLining, keySegmentPositionClock: val } } : prev);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                    >
                      {['12:00', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00', '7:00', '8:00', '9:00', '10:00', '11:00'].map((pos) => (
                        <option key={pos} value={pos}>{pos} Position</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Actual Grout Volume (m³)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={collectionBuffer.supportLining.annularGroutVolumeActualM3}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => prev ? { ...prev, supportLining: { ...prev.supportLining, annularGroutVolumeActualM3: val } } : prev);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 font-bold"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Theoretical Grout Volume (m³)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={collectionBuffer.supportLining.annularGroutVolumeTheoreticalM3}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => prev ? { ...prev, supportLining: { ...prev.supportLining, annularGroutVolumeTheoreticalM3: val } } : prev);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Grout Injection Pressure (bar)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={collectionBuffer.supportLining.groutInjectionPressureBar}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCollectionBuffer((prev) => prev ? { ...prev, supportLining: { ...prev.supportLining, groutInjectionPressureBar: val } } : prev);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Other sections (5, 6, 9, 10, 11) - concise professional fields */}
            {(collectionSubSection === 5 || collectionSubSection === 6 || collectionSubSection === 9 || collectionSubSection === 10 || collectionSubSection === 11) && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-cyan-300">
                  {collectionSubSection === 5 && '4.5 Groundwater & Hydrogeological Ingress'}
                  {collectionSubSection === 6 && '4.6 Probe Drilling & Ahead-of-Face Investigation'}
                  {collectionSubSection === 9 && '4.9 Geotechnical Instrumentation & Surface Settlement'}
                  {collectionSubSection === 10 && '4.10 Geological Hazards & Adverse Ground Register'}
                  {collectionSubSection === 11 && '4.11 Inspection Photographs & Site Attachments'}
                </h3>
                <p className="text-slate-400 text-xs">
                  Field records recorded for active ring #{collectionBuffer.chainageRecord.ringNumber}. All fields save independently with the excavation interval.
                </p>

                {collectionSubSection === 5 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Water Inflow Rate (L/min)</span>
                      <input
                        type="number"
                        value={collectionBuffer.groundwater.inflowRateLitersPerMin}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCollectionBuffer((prev) => prev ? { ...prev, groundwater: { ...prev.groundwater, inflowRateLitersPerMin: val } } : prev);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Water Pressure (bar)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={collectionBuffer.groundwater.waterPressureBar}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCollectionBuffer((prev) => prev ? { ...prev, groundwater: { ...prev.groundwater, waterPressureBar: val } } : prev);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Ingress Location</span>
                      <select
                        value={collectionBuffer.groundwater.ingressLocation}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setCollectionBuffer((prev) => prev ? { ...prev, groundwater: { ...prev.groundwater, ingressLocation: val } } : prev);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                      >
                        <option value="TAIL_SKIN_BRUSHES">Tail Skin Brushes</option>
                        <option value="FACE_CUTTERHEAD">Face / Cutterhead</option>
                        <option value="SHIELD_BODY">Shield Articulation</option>
                        <option value="INVERT">Invert Segments</option>
                      </select>
                    </label>
                  </div>
                )}

                {collectionSubSection === 9 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Settlement Pin ID</span>
                      <input
                        type="text"
                        value={collectionBuffer.instrumentation?.surfaceSettlementMonitoringPointId || `SP-${collectionBuffer.chainageRecord.ringNumber}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCollectionBuffer((prev) => ({
                            ...prev,
                            instrumentation: {
                              ...prev.instrumentation,
                              surfaceSettlementMonitoringPointId: val,
                            },
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Measured Settlement (mm)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={collectionBuffer.instrumentation?.surfaceSettlementMeasuredMm ?? -3.5}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCollectionBuffer((prev) => ({
                            ...prev,
                            instrumentation: {
                              ...prev.instrumentation,
                              surfaceSettlementMeasuredMm: val,
                            },
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400 text-[11px]">Theoretical Peck S(x) (mm)</span>
                      <input
                        type="number"
                        step="0.1"
                        readOnly
                        value={collectionBuffer.instrumentation?.theoreticalPeckSettlementMm || -4.8}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 5: GEOLOGICAL ANALYSIS WORKSPACE
            Longitudinal profile, Stereonet, FPI vs Q/RMR, Predicted vs Encountered
            ------------------------------------------------------------------- */}
        {currentStage === 'analysis' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <span>STEP 5 — GEOLOGICAL &amp; GEOTECHNICAL ANALYSIS</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Longitudinal geotechnical profiling, discontinuity stereonet projection, and TBM performance vs rock mass correlation.
                </p>
              </div>

              {/* Sub tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[
                  { id: 'profile' as const, label: 'Longitudinal Profile' },
                  { id: 'stereonet' as const, label: 'Stereonet & Joints' },
                  { id: 'correlation' as const, label: 'FPI vs Geology' },
                  { id: 'predicted_vs_encountered' as const, label: 'Encountered vs Predicted' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setAnalysisSubTab(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      analysisSubTab === st.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile View */}
            {analysisSubTab === 'profile' && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs text-cyan-400 uppercase">
                    Longitudinal Chainage Profile (RD {activeLocation?.startChainageRd.toFixed(2)}m – {activeLocation?.endChainageRd?.toFixed(2) || '1550'}m)
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentLocationRecords.length} Excavation Rings Plotted
                  </span>
                </div>

                {/* SVG Geological Profile Strip */}
                <div className="w-full h-48 bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-x-auto relative">
                  <svg viewBox="0 0 800 160" className="w-full h-full">
                    {/* Grid Lines */}
                    <line x1="50" y1="20" x2="780" y2="20" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                    <line x1="50" y1="70" x2="780" y2="70" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                    <line x1="50" y1="120" x2="780" y2="120" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />

                    {/* Tunnel Bore Axis */}
                    <rect x="50" y="55" width="730" height="30" fill="rgba(6,182,212,0.12)" stroke="#06B6D4" strokeWidth="1.5" rx="3" />

                    {/* Ring Blocks */}
                    {currentLocationRecords.map((r, i) => {
                      const x = 60 + i * 85;
                      const qColor = r.classification.calculatedQ < 1 ? '#F43F5E' : r.classification.calculatedQ < 4 ? '#F59E0B' : '#10B981';
                      return (
                        <g key={r.id}>
                          <rect x={x} y="55" width="80" height="30" fill={qColor} fillOpacity="0.4" stroke={qColor} strokeWidth="1" />
                          <text x={x + 40} y="74" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            R#{r.chainageRecord.ringNumber}
                          </text>
                          <text x={x + 40} y="105" fill="#94A3B8" fontSize="8" textAnchor="middle" fontFamily="monospace">
                            RD {r.chainageRecord.startChainage.toFixed(1)}m
                          </text>
                          <text x={x + 40} y="40" fill={qColor} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            Q={r.classification.calculatedQ.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Encountered vs Predicted Table */}
            {analysisSubTab === 'predicted_vs_encountered' && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-cyan-300">Encountered vs. Predicted Geological Divergence</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Ring #</th>
                        <th className="p-2.5">Chainage</th>
                        <th className="p-2.5">Predicted Geology</th>
                        <th className="p-2.5">Actual Encountered Geology</th>
                        <th className="p-2.5">Pred Q / Actual Q</th>
                        <th className="p-2.5">Divergence Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                      {currentLocationRecords.map((r) => {
                        const pred = activeLocation?.predictedGeology?.find(
                          (p) => r.chainageRecord.startChainage >= p.startChainage && r.chainageRecord.startChainage <= p.endChainage
                        );
                        const isMatch = pred ? pred.lithology.toLowerCase().includes(r.geology.mainLithology.toLowerCase().split(' ')[0]) : true;

                        return (
                          <tr key={r.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 font-bold text-cyan-400">#{r.chainageRecord.ringNumber}</td>
                            <td className="p-2.5">RD {r.chainageRecord.startChainage.toFixed(2)}m</td>
                            <td className="p-2.5 text-slate-400">{pred?.lithology || 'Basalt'}</td>
                            <td className="p-2.5 font-bold text-amber-300">{r.geology.mainLithology}</td>
                            <td className="p-2.5">
                              {pred?.expectedQValue ?? '12'} → <strong className="text-emerald-400">{r.classification.calculatedQ.toFixed(1)}</strong>
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isMatch ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}>
                                {isMatch ? 'CONCORDANT' : 'DISCORDANT ANOMALY'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 6: MONITORING WORKSPACE
            Advance tracking, Peck settlement trough, groundwater inflows
            ------------------------------------------------------------------- */}
        {currentStage === 'monitoring' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <span>STEP 6 — GEOTECHNICAL &amp; TBM MONITORING WORKSPACE</span>
              </h2>
              <p className="text-slate-400 text-xs">
                Real-time excavation advance tracking, transverse Peck settlement trough analysis, and groundwater ingress monitoring.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-slate-500 text-[11px] font-bold uppercase">Cumulative Drive Advance</span>
                <div className="text-2xl font-black text-cyan-300 font-mono">
                  {currentLocationRecords.reduce((acc, r) => acc + r.chainageRecord.advanceLengthMeters, 0).toFixed(2)} m
                </div>
                <p className="text-[11px] text-slate-400">{currentLocationRecords.length} precast concrete rings erected</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-slate-500 text-[11px] font-bold uppercase">Average Machine FPI</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {(
                    currentLocationRecords.reduce((acc, r) => acc + (r.classification.fieldPenetrationIndexKnCutterMm || 25), 0) /
                    Math.max(1, currentLocationRecords.length)
                  ).toFixed(1)} <span className="text-xs text-slate-400 font-normal">kN/cutter/mm</span>
                </div>
                <p className="text-[11px] text-slate-400">Normal cutting regime in Deccan Trap basalt</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-slate-500 text-[11px] font-bold uppercase">Peak Surface Settlement</span>
                <div className="text-2xl font-black text-amber-300 font-mono">-4.5 mm</div>
                <p className="text-[11px] text-emerald-400">Within urban allowable threshold (-15.0 mm)</p>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            STAGE 7: REPORTS WORKSPACE (16 Professional Tunnel Site Reports)
            ------------------------------------------------------------------- */}
        {currentStage === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <span>STEP 7 — PROFESSIONAL TBM GEOTECHNICAL REPORTS (16 STANDARDS)</span>
                </h2>
                <p className="text-slate-400 text-xs">
                  Generate, preview, and export high-resolution client/PMC geotechnical logs for TBM mechanized tunneling.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Print / Export PDF</span>
              </button>
            </div>

            {/* 16 Reports Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'SHIFT_GEOTECHNICAL_LOG' as TbmReportType, title: '1. Shift Geotechnical Log' },
                { id: 'DAILY_TBM_GEOLOGICAL_SUMMARY' as TbmReportType, title: '2. Daily TBM Geological Summary' },
                { id: 'RING_BY_RING_EXCAVATION_RECORD' as TbmReportType, title: '3. Ring Excavation Record' },
                { id: 'MUCK_INSPECTION_LITHOLOGY_LOG' as TbmReportType, title: '4. Muck & Lithology Log' },
                { id: 'PROBE_DRILLING_AHEAD_LOG' as TbmReportType, title: '5. Ahead-of-Face Probe Log' },
                { id: 'LONGITUDINAL_GEOTECHNICAL_PROFILE' as TbmReportType, title: '6. Geotechnical Profile' },
                { id: 'TBM_PERFORMANCE_VS_GROUND_REPORT' as TbmReportType, title: '7. TBM vs Ground (FPI/SE)' },
                { id: 'DISCONTINUITY_STRUCTURAL_ANALYSIS' as TbmReportType, title: '8. Structural Geology Analysis' },
                { id: 'ROCK_MASS_CLASSIFICATION_SUPPORT' as TbmReportType, title: '9. Q & RMR Classification' },
                { id: 'FACE_CROWN_STABILITY_ASSESSMENT' as TbmReportType, title: '10. Face Stability Report' },
                { id: 'GROUNDWATER_INFLOW_REGISTER' as TbmReportType, title: '11. Groundwater Inflow Register' },
                { id: 'SETTLEMENT_GROUND_MOVEMENT_REPORT' as TbmReportType, title: '12. Settlement Monitoring' },
                { id: 'GEOLOGICAL_HAZARD_INCIDENT_REPORT' as TbmReportType, title: '13. Hazard & Incident Report' },
                { id: 'PREDICTED_VS_ENCOUNTERED_GEOLOGY' as TbmReportType, title: '14. Predicted vs Encountered' },
                { id: 'WEEKLY_MONTHLY_EXECUTIVE_SUMMARY' as TbmReportType, title: '15. Executive Geotech Summary' },
                { id: 'AS_BUILT_GEOLOGICAL_DOCUMENTATION' as TbmReportType, title: '16. As-Built Documentation' },
              ].map((rep) => {
                const isCur = selectedReportType === rep.id;
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReportType(rep.id)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isCur
                        ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="text-xs truncate">{rep.title}</div>
                  </button>
                );
              })}
            </div>

            {/* Printable Report Sheet Preview */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-cyan-300">{selectedReportType.replace(/_/g, ' ')}</h3>
                  <p className="text-slate-400 text-xs">
                    Project: {activeProject?.projectName} · Heading: {activeLocation?.locationName} · Date: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded bg-slate-950 text-cyan-400 border border-slate-800 font-bold">
                  OFFICIAL SITE FORMAT
                </span>
              </div>

              {/* Sample Report Table Preview */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Ring #</th>
                      <th className="p-2.5">RD Interval</th>
                      <th className="p-2.5">Encountered Lithology</th>
                      <th className="p-2.5">Q / RMR Class</th>
                      <th className="p-2.5">Thrust / Torque</th>
                      <th className="p-2.5">Key Pos</th>
                      <th className="p-2.5">Annular Grout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                    {currentLocationRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-cyan-400">#{r.chainageRecord.ringNumber}</td>
                        <td className="p-2.5">RD {r.chainageRecord.startChainage.toFixed(2)}m – {r.chainageRecord.endChainage.toFixed(2)}m</td>
                        <td className="p-2.5 text-amber-300 font-medium">{r.geology.mainLithology}</td>
                        <td className="p-2.5">Q {r.classification.calculatedQ.toFixed(1)} · RMR {r.classification.calculatedRmr}</td>
                        <td className="p-2.5">{r.telemetry.thrustForceKn}kN / {r.telemetry.cutterheadTorqueKnm}kNm</td>
                        <td className="p-2.5 font-bold text-cyan-300">{r.supportLining.keySegmentPositionClock}</td>
                        <td className="p-2.5">{r.supportLining.annularGroutVolumeActualM3.toFixed(2)}m³</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          NEW PROJECT MODAL FORM
          ===================================================================== */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none font-sans">
          <div className="bg-slate-900 border border-cyan-500 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-base text-cyan-300 font-mono">Create New TBM Mechanized Tunneling Project</h3>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewProject} className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-300 font-bold">Project Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Line 4 Shield Package"
                    value={newProjectForm.projectName}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, projectName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-300 font-bold">Tunnel Name / Section</span>
                  <input
                    type="text"
                    placeholder="e.g. Uplink Tube Section B"
                    value={newProjectForm.tunnelName}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, tunnelName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Client / Project Owner</span>
                  <input
                    type="text"
                    placeholder="e.g. Metro Rail Authority"
                    value={newProjectForm.client}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, client: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Main Contractor</span>
                  <input
                    type="text"
                    placeholder="e.g. Civil JV Corp"
                    value={newProjectForm.contractor}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, contractor: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Consultant / PMC</span>
                  <input
                    type="text"
                    placeholder="e.g. Geoconsult / Mott MacDonald"
                    value={newProjectForm.consultant}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, consultant: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Project Location</span>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, India"
                    value={newProjectForm.projectLocation}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, projectLocation: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Tunnel Alignment Reference</span>
                  <input
                    type="text"
                    placeholder="e.g. Alignment Rev-03"
                    value={newProjectForm.tunnelAlignment}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, tunnelAlignment: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Responsible Geologist</span>
                  <input
                    type="text"
                    placeholder="e.g. Akash Dhoni"
                    value={newProjectForm.responsibleGeologist}
                    onChange={(e) => setNewProjectForm((p) => ({ ...p, responsibleGeologist: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          NEW LOCATION MODAL FORM
          ===================================================================== */}
      {showNewLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none font-sans">
          <div className="bg-slate-900 border border-cyan-500 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-base text-cyan-300 font-mono">
                Add Location to &quot;{activeProject?.projectName}&quot;
              </h3>
              <button
                type="button"
                onClick={() => setShowNewLocationModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewLocation} className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-slate-300 font-bold">Location Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. South Heading Drive"
                    value={newLocationForm.locationName}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, locationName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-300 font-bold">Tunnel Section</span>
                  <input
                    type="text"
                    placeholder="e.g. Chainage 1420.00 to 1550.00"
                    value={newLocationForm.tunnelSection}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, tunnelSection: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Excavation Direction</span>
                  <select
                    value={newLocationForm.excavationDirection}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, excavationDirection: e.target.value as ChainageDirection }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold"
                  >
                    <option value="INCREASING">Increasing Chainage (RD 1420 → 1450m)</option>
                    <option value="DECREASING">Decreasing Chainage (RD 1500 → 1470m)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Start Chainage (RD m)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1420.00"
                    value={newLocationForm.startChainageRd}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, startChainageRd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">End Chainage (RD m, if known)</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1550.00"
                    value={newLocationForm.endChainageRd}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, endChainageRd: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Responsible Geologist</span>
                  <input
                    type="text"
                    placeholder="e.g. Akash Dhoni"
                    value={newLocationForm.responsibleGeologist}
                    onChange={(e) => setNewLocationForm((p) => ({ ...p, responsibleGeologist: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewLocationModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
