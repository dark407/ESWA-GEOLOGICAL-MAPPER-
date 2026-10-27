import React from 'react';
import { AlarmClock, Compass, RefreshCw, Shield } from 'lucide-react';
import {
  IndustryMode,
  Joint,
  JointSet,
  MiningStopeSettings,
  ParameterInputStatus,
  PhotoSurface,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
  SurfaceType,
  TbmMachineParameters,
  TunnelGeometry,
  TunnelSettings,
} from '../../types/tunnel';
import {
  DataStorageTabId,
  ProjectMemoryModal,
} from '../OverbreakAndProjectMemoryPanel';
import { NatmRockMechanicsAndLookAheadHub } from '../NatmRockMechanicsAndLookAheadHub';
import { ContinuousTunnelLogSetupModal } from '../ContinuousTunnelLogSetupModal';
import { A3ContinuousTunnelLogModal } from '../A3ContinuousTunnelLogModal';
import { GlobalSettingsModal } from '../GlobalSettingsModal';
import { AdvancedBruntonCompassModal } from '../AdvancedBruntonCompassModal';
import { AdvancedShiftReminderAlarmModal } from '../AdvancedShiftReminderAlarmModal';
import { SupportAndGeotechnicalReferenceModal } from '../SupportAndGeotechnicalReferenceModal';
import {
  ContinuousTunnelStripDataset,
  loadAllContinuousStripDatasets,
  saveAllContinuousStripDatasets,
} from '../../engine/continuous3DStripEngine';
import {
  GeologistUserProfile,
  GoogleUserAccountInfo,
  loadFieldMappingResumeState,
  saveFieldMappingResumeState,
} from '../../engine/userCloudAndPackageEngine';
import {
  deleteSavedDesignGeometry,
  loadSavedDesignGeometries,
  saveDesignGeometryToLibrary,
} from '../../engine/projectMemoryEngine';
import {
  MappingDomainType,
  SurfaceGeometryParameters,
  SurfaceMappingSubType,
} from '../../engine/surfaceMappingEngine';

export interface AppModalsHostProps {
  // Project Memory Modal
  isProjectMemoryModalOpen: boolean;
  setIsProjectMemoryModalOpen: (v: boolean) => void;
  projectMemoryModalInitialTab: DataStorageTabId;
  savedProjects: SavedProjectRecord[];
  setSavedProjects: (p: SavedProjectRecord[]) => void;
  allProjectsList: any[];
  projectDirectory: any;
  activeProjectName: string;
  activeLocationName: string;
  activeRoundId: string;
  photos: Record<SurfaceType, PhotoSurface>;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  clusteredJoints: Joint[];
  jointSets: JointSet[];
  rmrParams: RmrParameters;
  qIndexParams: QIndexParameters;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  miningSettings: MiningStopeSettings;
  tbmParams: TbmMachineParameters;
  industryMode: IndustryMode;
  activeMappingDomain: MappingDomainType;
  photoSurfaceParams: SurfaceGeometryParameters;
  isLight: boolean;
  onLoadProjectToWorkspace: (rec: SavedProjectRecord) => void;
  onRefreshProjectsState: (next: SavedProjectRecord[]) => void;
  onOpenFieldRoundInWorkspace: (
    roundId: string,
    projectId: string,
    locationId: string,
    domain?: MappingDomainType
  ) => void;
  onImportProjectRecordFile: (f: File) => void;
  onExportCurrentProjectFile: () => void;
  savedGeometries: SavedDesignGeometryRecord[];
  setSavedGeometries: (g: SavedDesignGeometryRecord[]) => void;
  openChooseShapeExcavationModal: (name: string, geom: TunnelGeometry) => void;
  onCreateCompanionSectionForVolumeTest: () => void;
  setStatusMessage: (msg: string | null) => void;

  // Rock Mechanics Modal
  isNatmRockMechanicsModalOpen: boolean;
  setIsNatmRockMechanicsModalOpen: (v: boolean) => void;

  // Continuous Logging
  isContinuousLogSetupOpen: boolean;
  setIsContinuousLogSetupOpen: (v: boolean) => void;
  isA3ContinuousLogOpen: boolean;
  setIsA3ContinuousLogOpen: (v: boolean) => void;
  activeContinuousDataset: ContinuousTunnelStripDataset | null;
  setActiveContinuousDataset: (d: ContinuousTunnelStripDataset | null) => void;
  initialCadOpenForContinuous: boolean;
  setInitialCadOpenForContinuous: (v: boolean) => void;

  // Global Settings Modal
  isGlobalSettingsOpen: boolean;
  setIsGlobalSettingsOpen: (v: boolean) => void;
  googleUser: GoogleUserAccountInfo | null;
  setGoogleUser: (u: GoogleUserAccountInfo | null) => void;
  setActiveGeologist: (g: GeologistUserProfile | null) => void;

  // Mode Switch Confirmation Modal
  pendingTargetMode: IndustryMode | null;
  setPendingTargetMode: (m: IndustryMode | null) => void;
  confirmAndSwitchIndustryMode: (m: IndustryMode) => void;

  // Bottom 3 Toggles
  showBottomThreeToggles?: boolean;
  isBruntonCompassOpen: boolean;
  setIsBruntonCompassOpen: (v: boolean) => void;
  isShiftReminderOpen: boolean;
  setIsShiftReminderOpen: (v: boolean) => void;
  isSupportReferenceOpen: boolean;
  setIsSupportReferenceOpen: (v: boolean) => void;
}

export const AppModalsHost: React.FC<AppModalsHostProps> = ({
  isProjectMemoryModalOpen,
  setIsProjectMemoryModalOpen,
  projectMemoryModalInitialTab,
  savedProjects,
  setSavedProjects,
  allProjectsList,
  projectDirectory,
  activeProjectName,
  activeLocationName,
  activeRoundId,
  photos,
  geometry,
  settings,
  clusteredJoints,
  jointSets,
  rmrParams,
  qIndexParams,
  qParamStatus,
  miningSettings,
  tbmParams,
  industryMode,
  activeMappingDomain,
  photoSurfaceParams,
  isLight,
  onLoadProjectToWorkspace,
  onRefreshProjectsState,
  onOpenFieldRoundInWorkspace,
  onImportProjectRecordFile,
  onExportCurrentProjectFile,
  savedGeometries,
  setSavedGeometries,
  openChooseShapeExcavationModal,
  onCreateCompanionSectionForVolumeTest,
  setStatusMessage,
  isNatmRockMechanicsModalOpen,
  setIsNatmRockMechanicsModalOpen,
  isContinuousLogSetupOpen,
  setIsContinuousLogSetupOpen,
  isA3ContinuousLogOpen,
  setIsA3ContinuousLogOpen,
  activeContinuousDataset,
  setActiveContinuousDataset,
  initialCadOpenForContinuous,
  setInitialCadOpenForContinuous,
  isGlobalSettingsOpen,
  setIsGlobalSettingsOpen,
  googleUser,
  setGoogleUser,
  setActiveGeologist,
  pendingTargetMode,
  setPendingTargetMode,
  confirmAndSwitchIndustryMode,
  showBottomThreeToggles = true,
  isBruntonCompassOpen,
  setIsBruntonCompassOpen,
  isShiftReminderOpen,
  setIsShiftReminderOpen,
  isSupportReferenceOpen,
  setIsSupportReferenceOpen,
}) => {
  return (
    <>
      {/* 1. Project Memory & Storage Modal */}
      <ProjectMemoryModal
        isOpen={isProjectMemoryModalOpen}
        onClose={() => setIsProjectMemoryModalOpen(false)}
        initialTab={projectMemoryModalInitialTab}
        savedProjects={savedProjects}
        allProjectsList={allProjectsList}
        projectDirectory={projectDirectory}
        activeProjectName={activeProjectName}
        activeLocationName={activeLocationName}
        activeRoundId={activeRoundId}
        photos={photos}
        geometry={geometry}
        settings={settings}
        joints={clusteredJoints}
        jointSets={jointSets}
        rmrParams={rmrParams}
        qIndexParams={qIndexParams}
        qParamStatus={qParamStatus}
        miningSettings={miningSettings}
        tbmParams={tbmParams}
        industryMode={industryMode}
        domain={activeMappingDomain}
        surfaceParams={photoSurfaceParams}
        isLight={isLight}
        onLoadProject={(rec) => {
          setIsProjectMemoryModalOpen(false);
          onLoadProjectToWorkspace(rec);
        }}
        onRefreshProjectsState={(next) => {
          setSavedProjects(next);
          setSavedGeometries(loadSavedDesignGeometries());
          onRefreshProjectsState(next);
        }}
        onOpenFieldRoundInWorkspace={onOpenFieldRoundInWorkspace}
        onImportProjectRecordFile={onImportProjectRecordFile}
        onExportCurrentProjectFile={onExportCurrentProjectFile}
        savedGeometries={savedGeometries}
        onSaveCurrentGeometryToLibrary={(customName) => {
          const next = saveDesignGeometryToLibrary({
            name: customName,
            tunnelName: settings.tunnelName,
            location: settings.locationName || 'Underground Tunnel Works',
            chainage: settings.faceChainage || settings.chainage,
            domain: activeMappingDomain,
            geometry,
          });
          setSavedGeometries(next);
          setStatusMessage(`Saved tunnel design profile "${customName}" to Geometry Library.`);
        }}
        onLoadDesignGeometry={(rec) => {
          setIsProjectMemoryModalOpen(false);
          openChooseShapeExcavationModal(rec.name, rec.geometry);
        }}
        onDeleteDesignGeometry={(id) => {
          const next = deleteSavedDesignGeometry(id);
          setSavedGeometries(next);
        }}
        onCreateCompanionSectionForVolumeTest={onCreateCompanionSectionForVolumeTest}
      />

      {/* 2. NATM Rock Mechanics & Look-Ahead Hub */}
      <NatmRockMechanicsAndLookAheadHub
        isOpen={isNatmRockMechanicsModalOpen}
        onClose={() => setIsNatmRockMechanicsModalOpen(false)}
        isFloatingModal={true}
        driveAzimuth={Number(settings.driveDirection) || 45}
        faceChainage={settings.faceChainage || settings.chainage || 'CH 102+45.0'}
      />

      {/* 3. Continuous 3D Tunnel Strip Log Modals */}
      <ContinuousTunnelLogSetupModal
        isOpen={isContinuousLogSetupOpen}
        onClose={() => setIsContinuousLogSetupOpen(false)}
        savedProjects={savedProjects}
        allProjectsList={allProjectsList}
        projectDirectory={projectDirectory}
        onOpenA3Window={(dataset, openInCad) => {
          setActiveContinuousDataset(dataset);
          setInitialCadOpenForContinuous(!!openInCad);
          setIsA3ContinuousLogOpen(true);
        }}
        onOpenCadWindow={(dataset) => {
          setActiveContinuousDataset(dataset);
          setInitialCadOpenForContinuous(true);
          setIsA3ContinuousLogOpen(true);
        }}
      />

      {isA3ContinuousLogOpen && activeContinuousDataset && (
        <A3ContinuousTunnelLogModal
          isOpen={isA3ContinuousLogOpen}
          onClose={() => {
            setIsA3ContinuousLogOpen(false);
            setInitialCadOpenForContinuous(false);
          }}
          initialCadOpen={initialCadOpenForContinuous}
          dataset={activeContinuousDataset}
          onUpdateDataset={(updated) => {
            setActiveContinuousDataset(updated);
            const all = loadAllContinuousStripDatasets();
            const idx = all.findIndex((d) => d.id === updated.id);
            if (idx >= 0) all[idx] = updated;
            else all.unshift(updated);
            saveAllContinuousStripDatasets(all);
          }}
          userDeviceId={googleUser?.email || 'ESWA-LOCAL'}
          userEmail={googleUser?.email || ''}
        />
      )}

      {/* 4. Global Settings Modal */}
      <GlobalSettingsModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        currentUser={googleUser}
        onUserChanged={setGoogleUser}
        onActiveProfileChanged={(p) => setActiveGeologist(p)}
      />

      {/* 5. Mode Switch Confirmation Modal */}
      {pendingTargetMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Switch Industry Environment to {pendingTargetMode}?
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  Isolated Environment &amp; Storage Transition
                </p>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              Your current <span className="text-amber-400 font-bold">{industryMode}</span>{' '}
              workspace and project data are saved in isolated{' '}
              <span className="text-amber-400 font-bold">{industryMode}</span> storage (
              <code className="text-slate-400">eswa_isolated_db_{industryMode}</code>). Switching
              to <span className="text-cyan-400 font-bold">{pendingTargetMode}</span> will load the
              dedicated <span className="text-cyan-400 font-bold">{pendingTargetMode}</span> Main
              Window and database.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingTargetMode(null)}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-all"
              >
                Cancel (Stay in {industryMode})
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingTargetMode;
                  setPendingTargetMode(null);
                  confirmAndSwitchIndustryMode(target);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-lg cursor-pointer transition-all ${
                  pendingTargetMode === 'MINING'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                    : pendingTargetMode === 'TBM'
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                }`}
              >
                Confirm &amp; Switch to {pendingTargetMode}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Main Window Modals */}
      {showBottomThreeToggles && (
        <>
          <AdvancedBruntonCompassModal
            isOpen={isBruntonCompassOpen}
            onClose={() => setIsBruntonCompassOpen(false)}
            onApplyOrientation={(dipDir, dipAngle) => {
              setStatusMessage(
                `Field Brunton Reading Applied: Dip Direction ${dipDir}° / Dip ${dipAngle}°. Logged to geotechnical dataset.`
              );
            }}
          />

          <AdvancedShiftReminderAlarmModal
            isOpen={isShiftReminderOpen}
            onClose={() => setIsShiftReminderOpen(false)}
            industryMode={industryMode}
          />

          <SupportAndGeotechnicalReferenceModal
            isOpen={isSupportReferenceOpen}
            onClose={() => setIsSupportReferenceOpen(false)}
            industryMode={industryMode}
            savedProjects={savedProjects}
          />
        </>
      )}
    </>
  );
};
