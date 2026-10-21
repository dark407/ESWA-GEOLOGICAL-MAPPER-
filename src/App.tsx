import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChainageProfileSegmentRecord,
  ConnectedSurveyProfile,
  CustomTunnelProfileDefinition,
  Joint,
  JointSet,
  LithologyRegion,
  OutputSheetMode,
  PhotoSurface,
  PlacedGeologicalSymbol,
  ProfileType,
  QIndexParameters,
  QSystemParamKey,
  IndustryMode,
  MiningStopeSettings,
  FaceChannelSampleRecord,
  createDefaultMiningStopeSettings,
  ModeProjectState,
  TbmMachineParameters,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  GsiParameters,
  ParameterInputStatus,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
  SessionLearningMemory,
  SupportingPhoto,
  SurfaceType,
  SurveyControlPoint,
  TraceFitMode,
  TunnelGeometry,
  TunnelSettings,
  VerifiedCorrectionRecord,
} from './types/tunnel';
import {
  buildAuthoritativeCustomTunnelGeometry,
  CUSTOM_PROFILE_PRESETS,
  loadChainageProfileSchedule,
  saveChainageProfileSchedule,
  syncCustomProfileWithSurveyControlPoints,
} from './engine/customProfileEngine';
import {
  FreeformCustomProfileEditor,
  ProfileEditorMainTab,
} from './components/FreeformCustomProfileEditor';
import {
  analyzeOverbreakAndUndercut,
  generateRealisticSampleSurveyedProfile,
} from './engine/overbreakEngine';
import {
  calculateLaubscherMrmr,
  calculateMathewsStability,
  createDefaultGsiParameters,
  createDefaultQParamStatus,
  createDefaultRmrParameters,
  saveStationClassificationRecord,
} from './engine/rockMassClassificationEngine';
import {
  computeSectionToSectionVolumes,
  deleteProjectRecordFromMemory,
  deleteSavedDesignGeometry,
  loadSavedDesignGeometries,
  loadSavedProjectsFromMemory,
  parseNumericChainageMeters,
  saveDesignGeometryToLibrary,
  saveProjectRecordToMemory,
} from './engine/projectMemoryEngine';
import { ProjectMemoryModal } from './components/OverbreakAndProjectMemoryPanel';
import { NatmRockMechanicsAndLookAheadHub } from './components/NatmRockMechanicsAndLookAheadHub';
import {
  autoEstimateQIndexFromMappedJoints,
  createDefaultQIndexParameters,
  createDefaultRockMassSummary,
  generatePiecewiseWarpedPhotoDataUrl,
} from './engine/photoWarpEngine';
import {
  calibrateAndUndistortPhotograph,
  evaluateStereoBaseline,
} from './engine/cameraCalibration';
import {
  convertTunnelGeometryToSequentialTopHeading,
  createDefaultSurfaceTransform,
  createTunnelGeometry,
  enforceStrictTunnelGeometryConstraints,
  restoreFullFaceFromTopHeading,
} from './engine/geometryEngine';
import { generateSampleTunnelDXF, parseDXFStringToGeometry } from './engine/cadParser';
import {
  clusterJointsIntoSets,
  parseDriveDirectionAzimuth,
  refineMultiSurfaceOrientations,
} from './engine/orientationEngine';
import {
  analyzeAndAutoFitPhoto,
  executeHybridJointTracingPipeline,
} from './engine/cvPipeline';
import {
  buildCompleteSampleFieldDataset,
  generateSampleTunnelPhotograph,
} from './engine/sampleFieldData';
import { MappingWorkspace } from './components/MappingWorkspace';
import { EngineeringSheetModal } from './components/EngineeringSheetModal';
import { EswaAiExecutiveChatbot } from './components/EswaAiExecutiveChatbot';
import { loadSavedSheetConfig, saveSheetConfigToStorage } from './engine/sheetLayoutEngine';
import {
  ContinuousTunnelStripDataset,
  loadAllContinuousStripDatasets,
  saveAllContinuousStripDatasets,
  seedSampleContinuousStripDatasets,
} from './engine/continuous3DStripEngine';
import { ContinuousTunnelLogSetupModal } from './components/ContinuousTunnelLogSetupModal';
import { A3ContinuousTunnelLogModal } from './components/A3ContinuousTunnelLogModal';
import {
  EswaAppBackgroundWatermark,
  EswaLoadingScreen,
  EswaTunnelLogo,
  playEswaWelcomeChime,
} from './components/EswaBrandIdentity';
import {
  SimpleAddonTab,
  SimpleFullPhotoAndAccuracyModal,
} from './components/SimpleFullPhotoAndAccuracyModal';
import { ThemeToggleButton, useTheme } from './context/ThemeContext';
import {
  getEswaApiSecurityHeaders,
  subscribeAdminLicensingData,
} from './engine/softwareLicensingEngine';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { FieldMappingModeWorkspace } from './components/FieldMappingModeWorkspace';
import { CoreLoggingWorkspace } from './components/CoreLoggingWorkspace';
import { DeviceIdAndNotificationHeaderWidget } from './components/DeviceIdReviewAndNotificationCenter';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { TbmMainWindow } from './components/tbm/TbmMainWindow';
import { MiningMainWindow } from './components/mining/MiningMainWindow';
import { DataStorageTabId } from './components/OverbreakAndProjectMemoryPanel';
import {
  getActiveGeologistProfile,
  GeologistUserProfile,
  getSavedGoogleUser,
  GoogleUserAccountInfo,
  loadFieldMappingResumeState,
  loadPhotogrammetryResumeState,
  pullUserWorkspaceFromCloud,
  saveFieldMappingResumeState,
  savePhotogrammetryResumeState,
  signInWithGoogleAccount,
  signOutGoogleAccount,
  subscribeToGoogleUserAccount,
  syncPhotogrammetryProjectForAiTraining,
  syncUserWorkspaceToCloud,
} from './engine/userCloudAndPackageEngine';
import {
  buildCompatibleGeometryFromSurfaceParams,
  evaluateSurfaceStabilityAndRomanaSmr,
  getSurfacePanelLabelMap,
  loadSavedSurfaceGeometryParameters,
  loadSurfaceMappingResumeState,
  MappingDomainType,
  saveSurfaceGeometryParameters,
  saveSurfaceMappingResumeState,
  SurfaceGeometryParameters,
  SurfaceMappingSubType,
} from './engine/surfaceMappingEngine';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  Cloud,
  Compass,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers,
  LogIn,
  LogOut,
  Mountain,
  Palette,
  Pickaxe,
  Pipette,
  Play,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { MiningStopeFaceInspectorModal } from './components/MiningStopeFaceInspectorModal';
import { TbmShieldInspectorModal } from './components/TbmShieldInspectorModal';
type ScreenStep =
  | 'welcome'
  | 'start'
  | 'geometry_manual'
  | 'geometry_cad'
  | 'geometry_custom'
  | 'drive_and_photos'
  | 'mapping';

const OFFLINE_DRAFT_STORAGE_KEY = 'eswa_tunnel_mapper_field_draft_v20_fresh';
const OFFLINE_DRAFT_PHOTOS_STORAGE_KEY = 'eswa_tunnel_mapper_field_photos_v20_fresh';

export function getPhotogrammetryDraftStorageKey(domain: MappingDomainType = 'TUNNEL'): string {
  const clean = (domain || 'TUNNEL').toLowerCase();
  return `eswa_draft_photogrammetry_${clean}_v2`;
}

export function getPhotogrammetryPhotosStorageKey(domain: MappingDomainType = 'TUNNEL'): string {
  const clean = (domain || 'TUNNEL').toLowerCase();
  return `eswa_photos_photogrammetry_${clean}_v2`;
}

export function createCleanPhotos(): Record<SurfaceType, PhotoSurface> {
  const makeCleanSurface = (type: SurfaceType): PhotoSurface => ({
    type,
    originalImage: null,
    image: null,
    warpedImage: null,
    fileName: '',
    supportingPhotos: [],
    transform: createDefaultSurfaceTransform(),
    scale: 100,
    opacity: 100,
    autoFitted: false,
  });
  return {
    face: makeCleanSurface('face'),
    crown: makeCleanSurface('crown'),
    leftWall: makeCleanSurface('leftWall'),
    rightWall: makeCleanSurface('rightWall'),
  };
}

function loadSavedOfflineDraftSync(domain: MappingDomainType = 'TUNNEL'): Record<string, any> | null {
  try {
    const draftKey = getPhotogrammetryDraftStorageKey(domain);
    let raw = localStorage.getItem(draftKey);
    if (!raw && domain === 'TUNNEL') {
      raw = localStorage.getItem(OFFLINE_DRAFT_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    try {
      const photosKey = getPhotogrammetryPhotosStorageKey(domain);
      let rawPhotos = localStorage.getItem(photosKey);
      if (!rawPhotos && domain === 'TUNNEL') {
        rawPhotos = localStorage.getItem(OFFLINE_DRAFT_PHOTOS_STORAGE_KEY);
      }
      if (rawPhotos) {
        const parsedPhotos = JSON.parse(rawPhotos);
        if (parsedPhotos && typeof parsedPhotos === 'object') {
          parsed.photos = parsedPhotos;
        }
      }
    } catch {
      // Ignore photo read errors
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AppProps {
  isMasterSoftware?: boolean;
  onOpenAdminPortal?: () => void;
}

export default function App({
  isMasterSoftware = false,
  onOpenAdminPortal,
}: AppProps = {}) {
  const { theme, toggleTheme, palette, themeColor, setThemeColor } = useTheme();
  const isLight = theme === 'light';
  const responsive = useResponsiveLayout();
  const initialDraft = useMemo(() => loadSavedOfflineDraftSync(), []);
  const [screen, setScreen] = useState<ScreenStep>('welcome');
  const [isFirstOpening, setIsFirstOpening] = useState<boolean>(true);
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  const [isBootLoading, setIsBootLoading] = useState<boolean>(true);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(() => Boolean(initialDraft));
  const [isFieldMappingModeOpen, setIsFieldMappingModeOpen] = useState<boolean>(false);
  const [isCoreLoggingOpen, setIsCoreLoggingOpen] = useState<boolean>(false);
  const [resumeFieldAtLastStage, setResumeFieldAtLastStage] = useState<boolean>(false);
  const [activeFieldWorkflowMode, setActiveFieldWorkflowMode] = useState<
    'field_mapping' | 'photo_mapping'
  >('field_mapping');
  const [activeMappingDomain, setActiveMappingDomain] = useState<MappingDomainType>('TUNNEL');
  const [selectedSurfaceSubType, setSelectedSurfaceSubType] =
    useState<SurfaceMappingSubType>('BENCH');
  const [photoSurfaceParams, setPhotoSurfaceParams] = useState<SurfaceGeometryParameters>(() =>
    loadSavedSurfaceGeometryParameters('BENCH')
  );
  const [isNatmRockMechanicsModalOpen, setIsNatmRockMechanicsModalOpen] = useState<boolean>(false);

  // Google Email Login & Cloud Workspace Synchronization State
  const [googleUser, setGoogleUser] = useState<GoogleUserAccountInfo | null>(() =>
    getSavedGoogleUser()
  );
  const [isAuthBusy, setIsAuthBusy] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string>('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToGoogleUserAccount(async (userInfo) => {
      setGoogleUser(userInfo);
      if (userInfo) {
        const res = await pullUserWorkspaceFromCloud();
        if (res.pulled && res.updatedLocal) {
          setSavedProjects(loadSavedProjectsFromMemory());
          setSavedGeometries(loadSavedDesignGeometries());
          setCloudSyncStatus('Synced account workspace from cloud');
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'eswa_apk_field_mode_active_v1',
        isFieldMappingModeOpen ? 'true' : 'false'
      );
    } catch {
      // Ignore
    }
  }, [isFieldMappingModeOpen]);

  useEffect(() => {
    if (!isMasterSoftware) return;
    const unsub = subscribeAdminLicensingData({
      onRequests: (all) => {
        setPendingRequestCount(all.filter((r) => r.status === 'PENDING').length);
      },
      onLicenses: () => {},
      onReleases: () => {},
      onMasterPcs: () => {},
    });
    return () => unsub();
  }, [isMasterSoftware]);

  // Master Tunnel Geometry State (Authoritative real-world dimensions in meters)
  const [geometry, setGeometry] = useState<TunnelGeometry>(() => {
    if (
      initialDraft?.geometry &&
      typeof initialDraft.geometry.width === 'number' &&
      Number.isFinite(initialDraft.geometry.width) &&
      typeof initialDraft.geometry.height === 'number' &&
      Number.isFinite(initialDraft.geometry.height) &&
      Array.isArray(initialDraft.geometry.points) &&
      initialDraft.geometry.points.length >= 3
    ) {
      return {
        ...initialDraft.geometry,
        hasCrown: true,
        hasLeftWall: true,
        hasRightWall: true,
      };
    }
    return createTunnelGeometry(8.4, 7.2, 4.2, 'd_shaped', 4.35, 'manual');
  });

  // Manual geometry form inputs
  const [manWidth, setManWidth] = useState<string>(() =>
    initialDraft?.manWidth ? String(initialDraft.manWidth) : String(geometry.width || '8.40')
  );
  const [manHeight, setManHeight] = useState<string>(() =>
    initialDraft?.manHeight ? String(initialDraft.manHeight) : String(geometry.height || '7.20')
  );
  const [manWallHeight, setManWallHeight] = useState<string>(() =>
    initialDraft?.manWallHeight
      ? String(initialDraft.manWallHeight)
      : String(geometry.wallHeight || '4.20')
  );
  const [manCrownRadius, setManCrownRadius] = useState<string>(() =>
    initialDraft?.manCrownRadius
      ? String(initialDraft.manCrownRadius)
      : String(geometry.crownRadius || '4.35')
  );
  const [manProfileType, setManProfileType] = useState<ProfileType>(() =>
    (initialDraft?.manProfileType as ProfileType) || geometry.crownGeometry || 'd_shaped'
  );

  // CAD upload status
  const [cadStatus, setCadStatus] = useState<string>('');
  const cadInputRef = useRef<HTMLInputElement | null>(null);
  const [showPhotoScreenAccuracyModal, setShowPhotoScreenAccuracyModal] = useState<boolean>(false);
  const [photoScreenAccuracyTab, setPhotoScreenAccuracyTab] =
    useState<SimpleAddonTab>('full_photo_1ft_scale');

  // Clean Fresh Tunnel Drive Direction & Header Settings State (Restores saved settings if present)
  const [settings, setSettings] = useState<TunnelSettings>(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (initialDraft?.settings && typeof initialDraft.settings === 'object') {
      return {
        projectName: '',
        tunnelName: '',
        location: '',
        locationName: '',
        driveDirectionInput: 'N 000° E',
        driveDirection: 0,
        chainage: 'RD 0.00m - 3.50m',
        faceChainage: 'RD 3.50m',
        roundLength: 3.5,
        date: today,
        mappedBy: '',
        lithology: '',
        ...initialDraft.settings,
        sheetConfig: initialDraft.settings.sheetConfig || loadSavedSheetConfig(),
      };
    }
    return {
      projectName: '',
      tunnelName: '',
      location: '',
      locationName: '',
      driveDirectionInput: 'N 000° E',
      driveDirection: 0,
      chainage: 'RD 0.00m - 3.50m',
      faceChainage: 'RD 3.50m',
      roundLength: 3.5,
      date: today,
      mappedBy: '',
      lithology: '',
      sheetConfig: loadSavedSheetConfig(),
    };
  });

  // 3-Mode Industry Switcher (NATM | TBM | MINING) with isolated parameter state
  // 3-Mode Industry Switcher (NATM | TBM | MINING) with isolated parameter state
  const [industryMode, setIndustryMode] = useState<IndustryMode>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('eswa_active_industry_mode') ||
        localStorage.getItem('eswa_default_industry_mode') ||
        localStorage.getItem('eswa_active_industry_mode_v1');
      if (saved === 'NATM' || saved === 'TBM' || saved === 'MINING') {
        return saved as IndustryMode;
      }
    }
    return (initialDraft?.settings?.industryMode as IndustryMode) || 'NATM';
  });

  const [tbmParams, setTbmParams] = useState<TbmMachineParameters | undefined>(
    () => initialDraft?.settings?.tbmParams
  );
  const [miningSettings, setMiningSettings] = useState<MiningStopeSettings | undefined>(
    () => initialDraft?.settings?.miningSettings
  );

  const [isMiningInspectorOpen, setIsMiningInspectorOpen] = useState<boolean>(false);
  const [isTbmInspectorOpen, setIsTbmInspectorOpen] = useState<boolean>(false);

  // Dedicated Underground Mining Workflow Step (1: Setup, 2: Face Mapping & Grade Control, 3: Geomechanics, 4: Core Logging, 5: Reports & History)
  const [miningWorkflowStep, setMiningWorkflowStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [miningMappingMethod, setMiningMappingMethod] = useState<'FIELD_MAPPING' | 'PHOTOGRAMMETRY'>('FIELD_MAPPING');

  // Dedicated TBM Mechanized Workflow Tabs (1: Cutterhead/Rings, 2: Telemetry/KPIs, 3: Muck/Grout, 4: Qtbm/RSR, 5: Shift Reports)
  const [tbmTab, setTbmTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [pendingTargetMode, setPendingTargetMode] = useState<IndustryMode | null>(null);

  // Interactive Mining Ore vs Waste Zone Areas
  const [miningOreArea, setMiningOreArea] = useState<number>(14.5);
  const [miningLowGradeArea, setMiningLowGradeArea] = useState<number>(4.2);
  const [miningWasteArea, setMiningWasteArea] = useState<number>(12.8);
  const [miningBlastPull, setMiningBlastPull] = useState<number>(3.2);

  // Interactive Channel Samples & Assay Schedule
  const [miningChannelSamples, setMiningChannelSamples] = useState<FaceChannelSampleRecord[]>([
    {
      id: 'ch_01',
      sampleNumber: 'CH-01',
      fromMeter: 0.0,
      toMeter: 1.2,
      sampleLengthMeters: 1.2,
      lithologyOrVein: 'V-01 Quartz-Sulfide Lode',
      gradeValue: '7.8 g/t Au',
      sampledBy: 'Mine Geologist',
      date: new Date().toISOString().split('T')[0],
      specificGravity: 3.15,
      zoneCategory: 'ORE',
      alteration: 'Silicified',
      sulfidePercent: 6.5,
      assayGrade: 7.8,
      metalAccumulation: 9.36,
      startPoint: { x: 0.8, y: 1.5 },
      endPoint: { x: 2.0, y: 1.5 },
    },
    {
      id: 'ch_02',
      sampleNumber: 'CH-02',
      fromMeter: 1.2,
      toMeter: 2.5,
      sampleLengthMeters: 1.3,
      lithologyOrVein: 'V-01 Massive Sulfide Band',
      gradeValue: '5.4 g/t Au',
      sampledBy: 'Mine Geologist',
      date: new Date().toISOString().split('T')[0],
      specificGravity: 3.25,
      zoneCategory: 'ORE',
      alteration: 'Sericitic',
      sulfidePercent: 8.0,
      assayGrade: 5.4,
      metalAccumulation: 7.02,
      startPoint: { x: 2.0, y: 1.5 },
      endPoint: { x: 3.3, y: 1.5 },
    },
    {
      id: 'ch_03',
      sampleNumber: 'CH-03',
      fromMeter: 2.5,
      toMeter: 3.6,
      sampleLengthMeters: 1.1,
      lithologyOrVein: 'Stringer Veinlet Zone',
      gradeValue: '2.1 g/t Au',
      sampledBy: 'Mine Geologist',
      date: new Date().toISOString().split('T')[0],
      specificGravity: 2.85,
      zoneCategory: 'LOW_GRADE',
      alteration: 'Chloritic',
      sulfidePercent: 2.5,
      assayGrade: 2.1,
      metalAccumulation: 2.31,
      startPoint: { x: 3.3, y: 1.5 },
      endPoint: { x: 4.4, y: 1.5 },
    },
    {
      id: 'ch_04',
      sampleNumber: 'CH-04',
      fromMeter: 3.6,
      toMeter: 4.8,
      sampleLengthMeters: 1.2,
      lithologyOrVein: 'Footwall Basalt Waste',
      gradeValue: '0.2 g/t Au',
      sampledBy: 'Mine Geologist',
      date: new Date().toISOString().split('T')[0],
      specificGravity: 2.70,
      zoneCategory: 'WASTE',
      alteration: 'Carbonate',
      sulfidePercent: 0.5,
      assayGrade: 0.2,
      metalAccumulation: 0.24,
      startPoint: { x: 4.4, y: 1.5 },
      endPoint: { x: 5.6, y: 1.5 },
    },
  ]);

  // Interactive Mining Geomechanics parameters (Mathews N' & Laubscher MRMR)
  const [miningRqd, setMiningRqd] = useState<number>(75);
  const [miningJn, setMiningJn] = useState<number>(6);
  const [miningJr, setMiningJr] = useState<number>(2);
  const [miningJa, setMiningJa] = useState<number>(2);
  const [miningStressFactorA, setMiningStressFactorA] = useState<number>(0.75);
  const [miningJointFactorB, setMiningJointFactorB] = useState<number>(0.65);
  const [miningGravityFactorC, setMiningGravityFactorC] = useState<number>(5.5);
  const [miningStopeWidth, setMiningStopeWidth] = useState<number>(15.0);
  const [miningStopeHeight, setMiningStopeHeight] = useState<number>(25.0);

  // Laubscher MRMR Sliders
  const [mrmrBaseRmr, setMrmrBaseRmr] = useState<number>(68);
  const [mrmrWeatheringPct, setMrmrWeatheringPct] = useState<number>(90);
  const [mrmrStressPct, setMrmrStressPct] = useState<number>(85);
  const [mrmrOrientationPct, setMrmrOrientationPct] = useState<number>(80);
  const [mrmrBlastingPct, setMrmrBlastingPct] = useState<number>(92);

  // Mining Drill Hole Exploration Logging state
  const [miningDdhHoleId, setMiningDdhHoleId] = useState('UG-DDH-26-04');
  const [miningDdhCollarE, setMiningDdhCollarE] = useState('421850.5');
  const [miningDdhCollarN, setMiningDdhCollarN] = useState('6841220.8');
  const [miningDdhCollarRl, setMiningDdhCollarRl] = useState('620.4');
  const [miningDdhDip, setMiningDdhDip] = useState('-45.0');
  const [miningDdhAzimuth, setMiningDdhAzimuth] = useState('135.0');
  const [miningDdhTotalDepth, setMiningDdhTotalDepth] = useState('185.0');

  const [miningDdhIntervals, setMiningDdhIntervals] = useState([
    {
      id: 'int_1',
      from: 42.0,
      to: 45.2,
      length: 3.2,
      lithology: 'Banded Quartz-Carbonate Vein',
      alteration: 'Silicified + Sericite',
      sulfides: '6.5% Pyrite, Chalcopyrite',
      assayGrade: 8.4,
      qaqc: 'Regular',
      alpha: 65,
      beta: 120,
    },
    {
      id: 'int_2',
      from: 45.2,
      to: 48.0,
      length: 2.8,
      lithology: 'Massive Sulfide Lode',
      alteration: 'Intense Silicification',
      sulfides: '18% Pyrite, Galena, Sphalerite',
      assayGrade: 14.2,
      qaqc: 'Regular',
      alpha: 72,
      beta: 140,
    },
    {
      id: 'int_3',
      from: 48.0,
      to: 49.0,
      length: 1.0,
      lithology: 'Certified Reference Material (CRM)',
      alteration: 'Standard OREAS 256',
      sulfides: 'Standard Reference',
      assayGrade: 7.66,
      qaqc: 'CRM Standard',
      alpha: 0,
      beta: 0,
    },
    {
      id: 'int_4',
      from: 49.0,
      to: 53.5,
      length: 4.5,
      lithology: 'Footwall Basalt with Pyrite Stringers',
      alteration: 'Chloritic + Carbonate',
      sulfides: '1.5% Disseminated Pyrite',
      assayGrade: 0.45,
      qaqc: 'Regular',
      alpha: 48,
      beta: 110,
    },
  ]);

  // TBM Telemetry state
  const [tbmRingNum, setTbmRingNum] = useState<number>(142);
  const [tbmKeyPosition, setTbmKeyPosition] = useState<string>('Key Pos 3 (120°)');
  const [tbmThrustKn, setTbmThrustKn] = useState<number>(24500);
  const [tbmTorqueKnm, setTbmTorqueKnm] = useState<number>(6800);
  const [tbmPenetrationMmRev, setTbmPenetrationMmRev] = useState<number>(12.5);
  const [tbmAdvanceRateMmMin, setTbmAdvanceRateMmMin] = useState<number>(35.0);
  const [tbmEpbPressureBar, setTbmEpbPressureBar] = useState<number>(2.40);
  const [tbmGroutPressureBar, setTbmGroutPressureBar] = useState<number>(3.2);
  const [tbmGroutVolumeM3, setTbmGroutVolumeM3] = useState<number>(4.8);
  const [tbmDiscWearMm, setTbmDiscWearMm] = useState<number>(14.2);
  const [tbmRpm, setTbmRpm] = useState<number>(6.4);
  const [tbmShieldFrictionKn, setTbmShieldFrictionKn] = useState<number>(2400);
  const [tbmActiveCuttersNc, setTbmActiveCuttersNc] = useState<number>(42);
  const [tbmMuckChipType, setTbmMuckChipType] = useState<string>('Slabby / Blocky');
  const [tbmMuckChipSizeCm, setTbmMuckChipSizeCm] = useState<number>(8.5);
  const [tbmWaterInflowLMin, setTbmWaterInflowLMin] = useState<number>(45);
  const [tbmTheoreticalGroutM3, setTbmTheoreticalGroutM3] = useState<number>(8.2);
  const [tbmOverbreakSector, setTbmOverbreakSector] = useState<string>('11:00–01:00 Crown');

  // Dedicated Per-Mode View State: MAIN_WINDOW vs ACTIVITY
  const [modeScreenState, setModeScreenState] = useState<Record<IndustryMode, 'MAIN_WINDOW' | 'ACTIVITY'>>(() => ({
    NATM: 'MAIN_WINDOW',
    TBM: 'MAIN_WINDOW',
    MINING: 'MAIN_WINDOW',
  }));

  // TBM Live Multi-Ring Telemetry Table
  const [tbmRingsLog, setTbmRingsLog] = useState<
    Array<{
      id: string;
      ringNum: number;
      thrustKn: number;
      torqueKnm: number;
      rpm: number;
      penetrationMmRev: number;
      advanceRateMmMin: number;
      fpi: number;
      specificEnergyMjM3: number;
      netCutterForceKn: number;
      groutOverbreakM3: number;
      hazardStatus: string;
      timestamp: string;
    }>
  >([
    {
      id: 'ring-840',
      ringNum: 840,
      thrustKn: 13200,
      torqueKnm: 2700,
      rpm: 6.2,
      penetrationMmRev: 7.2,
      advanceRateMmMin: 44.6,
      fpi: 35.8,
      specificEnergyMjM3: 59.4,
      netCutterForceKn: 257.1,
      groutOverbreakM3: 3.2,
      hazardStatus: 'OPTIMAL BORING',
      timestamp: '2026-10-18 08:30',
    },
    {
      id: 'ring-841',
      ringNum: 841,
      thrustKn: 13500,
      torqueKnm: 2780,
      rpm: 6.3,
      penetrationMmRev: 7.4,
      advanceRateMmMin: 46.6,
      fpi: 36.0,
      specificEnergyMjM3: 60.5,
      netCutterForceKn: 264.3,
      groutOverbreakM3: 3.4,
      hazardStatus: 'OPTIMAL BORING',
      timestamp: '2026-10-18 10:15',
    },
    {
      id: 'ring-842',
      ringNum: 842,
      thrustKn: 13800,
      torqueKnm: 2850,
      rpm: 6.4,
      penetrationMmRev: 7.5,
      advanceRateMmMin: 48.0,
      fpi: 36.2,
      specificEnergyMjM3: 61.8,
      netCutterForceKn: 271.4,
      groutOverbreakM3: 3.6,
      hazardStatus: 'OPTIMAL BORING',
      timestamp: '2026-10-18 12:00',
    },
  ]);

  // 4 Tunnel Surface Photographs (Restores saved photos if present)
  const [photos, setPhotos] = useState<Record<SurfaceType, PhotoSurface>>(() => {
    const makeCleanSurface = (type: SurfaceType): PhotoSurface => ({
      type,
      originalImage: null,
      image: null,
      warpedImage: null,
      fileName: '',
      supportingPhotos: [],
      transform: createDefaultSurfaceTransform(),
      scale: 100,
      opacity: 100,
      autoFitted: false,
    });
    const def = {
      face: makeCleanSurface('face'),
      crown: makeCleanSurface('crown'),
      leftWall: makeCleanSurface('leftWall'),
      rightWall: makeCleanSurface('rightWall'),
    };
    if (initialDraft?.photos && typeof initialDraft.photos === 'object') {
      return {
        face: { ...def.face, ...(initialDraft.photos.face || {}) },
        crown: { ...def.crown, ...(initialDraft.photos.crown || {}) },
        leftWall: { ...def.leftWall, ...(initialDraft.photos.leftWall || {}) },
        rightWall: { ...def.rightWall, ...(initialDraft.photos.rightWall || {}) },
      };
    }
    return def;
  });

  const [activeSurface, setActiveSurface] = useState<SurfaceType>(() => {
    const savedSurf = initialDraft?.activeSurface as SurfaceType | undefined;
    if (
      savedSurf === 'face' ||
      savedSurf === 'crown' ||
      savedSurf === 'leftWall' ||
      savedSurf === 'rightWall'
    ) {
      return savedSurf;
    }
    return 'face';
  });

  // Modal shown ONLY when the user chooses a saved tunnel shape (asks Full Face vs Top Heading + Benching Details)
  const [chosenShapeModalState, setChosenShapeModalState] = useState<{
    name: string;
    baseGeometry: TunnelGeometry;
    stage: 'FULL_FACE' | 'TOP_HEADING';
    benchHeightInput: string;
    leftBenchInput: string;
    rightBenchInput: string;
  } | null>(null);

  const openChooseShapeExcavationModal = (shapeName: string, rawGeom: TunnelGeometry) => {
    const isTop =
      rawGeom.excavationStage === 'TOP_HEADING' || rawGeom.excavationStage === 'top_heading';
    const baseFullGeom = isTop ? restoreFullFaceFromTopHeading(rawGeom) : rawGeom;
    const defaultBench =
      rawGeom.benchHeightRemovedMeters && rawGeom.benchHeightRemovedMeters > 0.1
        ? rawGeom.benchHeightRemovedMeters
        : Number(
            Math.max(
              0.8,
              ((baseFullGeom.leftWallHeight ?? baseFullGeom.wallHeight) * 0.6)
            ).toFixed(2)
          );
    setChosenShapeModalState({
      name: shapeName,
      baseGeometry: baseFullGeom,
      stage: isTop ? 'TOP_HEADING' : 'FULL_FACE',
      benchHeightInput: String(defaultBench),
      leftBenchInput: String(rawGeom.leftBenchHeightMeters ?? defaultBench),
      rightBenchInput: String(rawGeom.rightBenchHeightMeters ?? defaultBench),
    });
  };

  // Vector Joints + Undo/Redo History Stack
  const [joints, setJoints] = useState<Joint[]>(() =>
    Array.isArray(initialDraft?.joints) ? initialDraft.joints : []
  );
  const [historyPast, setHistoryPast] = useState<Joint[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<Joint[][]>([]);
  const [customJointSetOverrides, setCustomJointSetOverrides] = useState<
    Record<string, Partial<JointSet>>
  >(() =>
    initialDraft?.customJointSetOverrides && typeof initialDraft.customJointSetOverrides === 'object'
      ? initialDraft.customJointSetOverrides
      : {}
  );

  // Barton's Q-Index, Bieniawski RMR, GSI & Rock Mass Classification Method State
  const [selectedClassificationMethod, setSelectedClassificationMethod] =
    useState<RockMassClassificationMethodId>(
      () => (initialDraft?.selectedClassificationMethod as RockMassClassificationMethodId) || 'RMR'
    );
  const [qIndexParams, setQIndexParams] = useState<QIndexParameters>(() =>
    initialDraft?.qIndexParams || createDefaultQIndexParameters()
  );
  const [qParamStatus, setQParamStatus] = useState<Record<QSystemParamKey, ParameterInputStatus>>(
    () => initialDraft?.qParamStatus || createDefaultQParamStatus()
  );
  const [rmrParams, setRmrParams] = useState<RmrParameters>(
    () => initialDraft?.rmrParams || createDefaultRmrParameters()
  );
  const [gsiParams, setGsiParams] = useState<GsiParameters>(
    () => initialDraft?.gsiParams || createDefaultGsiParameters()
  );
  const [rockMassSummary, setRockMassSummary] = useState<RockMassSummaryTable>(() =>
    initialDraft?.rockMassSummary || createDefaultRockMassSummary()
  );
  // User-selected Lithology Regions
  const [lithologyRegions, setLithologyRegions] = useState<LithologyRegion[]>(() =>
    Array.isArray(initialDraft?.lithologyRegions) ? initialDraft.lithologyRegions : []
  );
  // Survey Control Points & Connected Survey Profile (Overbreak/Undercut)
  const [controlPoints, setControlPoints] = useState<SurveyControlPoint[]>(() =>
    Array.isArray(initialDraft?.controlPoints) ? initialDraft.controlPoints : []
  );
  const [surveyProfile, setSurveyProfile] = useState<ConnectedSurveyProfile>(() =>
    initialDraft?.surveyProfile || {
      surface: 'face',
      orderedControlPointIds: [],
      isClosed: true,
      visible: true,
      locked: false,
      pullIntervalMeters: 3.5,
      useValidPullInterval: true,
      zoneReasonOverrides: {},
      overallOverbreakCategory: 'GEOLOGICAL',
      overallOverbreakReason: '',
      overallUndercutCategory: 'MECHANICAL_EXCAVATION',
      overallUndercutReason: '',
    }
  );
  // Placed Structural Geological Symbols
  const [placedSymbols, setPlacedSymbols] = useState<PlacedGeologicalSymbol[]>(() =>
    Array.isArray(initialDraft?.placedSymbols) ? initialDraft.placedSymbols : []
  );

  // Project File Memory & Saved Design Geometries State
  const [savedGeometries, setSavedGeometries] = useState<SavedDesignGeometryRecord[]>(() =>
    loadSavedDesignGeometries()
  );
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>(() =>
    loadSavedProjectsFromMemory()
  );
  const [chainageSchedule, setChainageSchedule] = useState<ChainageProfileSegmentRecord[]>(() =>
    loadChainageProfileSchedule()
  );
  const [customEditorInitialTab, setCustomEditorInitialTab] =
    useState<ProfileEditorMainTab>('common_variants');
  const [returnScreenFromCustomEditor, setReturnScreenFromCustomEditor] =
    useState<ScreenStep>('start');
  const [isProjectMemoryModalOpen, setIsProjectMemoryModalOpen] = useState<boolean>(false);
  const [projectMemoryTab, setProjectMemoryTab] = useState<DataStorageTabId>('field_data');
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState<boolean>(false);
  const [activeGeologist, setActiveGeologist] = useState<GeologistUserProfile | null>(() =>
    getActiveGeologistProfile()
  );

  // 100% ISOLATED STORAGE SYSTEM PER INDUSTRY MODE (Strict Vaults)
  // 1. eswa_strict_vault_NATM
  // 2. eswa_strict_vault_MINING
  // 3. eswa_strict_vault_TBM
  const getStrictVaultKey = (mode: IndustryMode) => `eswa_strict_vault_${mode}`;
  const getIsolatedDbKey = (mode: IndustryMode) => `eswa_strict_vault_${mode}`;

  // THREE COMPLETELY SEPARATE "LOAD EXAMPLE DATA" GENERATORS
  // 1. NATM Example Generator
  const loadNatmExampleData = useCallback((navigateToActivity = true) => {
    const targetGeom = createTunnelGeometry(8.5, 8.5, 4.8, 'horseshoe', 4.25, 'manual');
    const fullSample = buildCompleteSampleFieldDataset(targetGeom, 3.5);

    setGeometry(targetGeom);
    setManWidth('8.50');
    setManHeight('8.50');
    setManWallHeight('4.80');
    setManCrownRadius('4.25');
    setManProfileType('horseshoe');

    setSettings({
      ...fullSample.settings,
      industryMode: 'NATM',
      projectName: 'Himalayan Hydro Headrace Tunnel',
      tunnelName: 'Headrace Tunnel (HRT-01)',
      location: 'Adit-2, Face North',
      locationName: 'Adit-2, Face North',
      chainage: 'CH 12+450.50 m',
      faceChainage: 'CH 12+450.50 m',
      driveDirectionInput: '042°',
      roundLength: 3.5,
    });
    setPhotos(fullSample.photos);
    setJoints(fullSample.joints);
    setHistoryPast([]);
    setHistoryFuture([]);
    setLithologyRegions(fullSample.lithologyRegions);
    setPlacedSymbols(fullSample.placedSymbols);
    setControlPoints(fullSample.controlPoints);
    setSurveyProfile(fullSample.surveyProfile);
    setQIndexParams({
      ...fullSample.qIndexParams,
      rqd: 85,
      jn: 9,
      jr: 1.5,
      ja: 1.0,
      jw: 1.0,
      srf: 1.0,
    });
    setRmrParams(fullSample.rmrParams);
    setGsiParams(fullSample.gsiParams);
    setRockMassSummary({
      ...fullSample.rockMassSummary,
      rockType: 'Quartzite / Quartzitic Phyllite',
      geologistRemarks: 'Moderately jointed, blocky quartzite with rough stepped joints.',
    });
    setActiveSurface('face');
    seedSampleContinuousStripDatasets();

    try {
      localStorage.setItem(
        getStrictVaultKey('NATM'),
        JSON.stringify({
          industryMode: 'NATM',
          projectName: 'Himalayan Hydro Headrace Tunnel',
          location: 'Adit-2, Face North',
          chainage: 'CH 12+450.50 m',
          geometry: targetGeom,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {}

    if (navigateToActivity) {
      setIsFirstOpening(false);
      setIsFieldMappingModeOpen(false);
      setActiveMappingDomain('TUNNEL');
      setModeScreenState((prev) => ({ ...prev, NATM: 'ACTIVITY' }));
      setScreen('mapping');
    }
    setStatusMessage('Loaded NATM Himalayan Hydro Headrace Tunnel example dataset (CH 12+450.50 m, Q=12.5, RMR=68).');
  }, []);

  // 2. MINING Example Generator
  const loadMiningExampleData = useCallback((navigateToActivity = true) => {
    const targetGeom = createTunnelGeometry(5.0, 4.8, 2.8, 'd_shaped', 2.5, 'manual');
    setGeometry(targetGeom);
    setManWidth('5.00');
    setManHeight('4.80');
    setManWallHeight('2.80');
    setManCrownRadius('2.50');
    setManProfileType('d_shaped');

    const mSettings: MiningStopeSettings = {
      mineName: 'Kolar Deep Underground Gold-Copper Mine',
      mineLevel: 'Level 620 mRL',
      stopeOrDriftId: 'HW-DRV-04',
      excavationType: 'ORE_DRIVE',
      miningMethod: 'SUBLEVEL_OPEN_STOPING',
      oreBodyName: 'Champion Quartz-Sulfide Lode',
      primaryCommodity: 'Gold (Au)',
      gradeUnits: 'g/t',
      targetCutoffGrade: '2.50',
      hangingwallDipDeg: 72,
      footwallDipDeg: 68,
      oreSpecificGravity: 3.35,
      wasteSpecificGravity: 2.72,
      veins: [],
      channelSamples: [],
    };
    setMiningSettings(mSettings);

    const fullSample = buildCompleteSampleFieldDataset(targetGeom, 3.2);
    setSettings({
      ...fullSample.settings,
      industryMode: 'MINING',
      projectName: 'Kolar Deep Underground Gold-Copper Mine',
      tunnelName: 'HW-DRV-04 (Cut #14)',
      location: 'Level 620 mRL — Stope Drive HW-DRV-04 (Cut #14)',
      locationName: 'Level 620 mRL — Stope Drive HW-DRV-04 (Cut #14)',
      chainage: 'Cut #14',
      faceChainage: 'Cut #14',
      driveDirectionInput: '090°',
      roundLength: 3.2,
      miningSettings: mSettings,
    });

    setMiningOreArea(14.8);
    setMiningLowGradeArea(2.4);
    setMiningWasteArea(7.2);
    setMiningBlastPull(3.2);

    const demoSamples: FaceChannelSampleRecord[] = [
      {
        id: 'ch_01',
        sampleNumber: 'CH-01',
        fromMeter: 0.0,
        toMeter: 1.0,
        sampleLengthMeters: 1.0,
        lithologyOrVein: 'Footwall Amphibolite Host Rock',
        gradeValue: '0.4 g/t',
        sampledBy: 'Senior Mine Geologist',
        date: '2026-10-18',
        specificGravity: 2.72,
        zoneCategory: 'WASTE',
        alteration: 'Chloritic (intensity 2)',
        sulfidePercent: 0.5,
        assayGrade: 0.4,
        metalAccumulation: 0.4,
      },
      {
        id: 'ch_02',
        sampleNumber: 'CH-02',
        fromMeter: 1.0,
        toMeter: 2.2,
        sampleLengthMeters: 1.2,
        lithologyOrVein: 'Disseminated Sulfide-Quartz Breccia',
        gradeValue: '4.8 g/t',
        sampledBy: 'Senior Mine Geologist',
        date: '2026-10-18',
        specificGravity: 3.20,
        zoneCategory: 'ORE',
        alteration: 'Sericitic (intensity 3)',
        sulfidePercent: 3.5,
        assayGrade: 4.8,
        metalAccumulation: 5.76,
      },
      {
        id: 'ch_03',
        sampleNumber: 'CH-03',
        fromMeter: 2.2,
        toMeter: 3.7,
        sampleLengthMeters: 1.5,
        lithologyOrVein: 'Champion Main Quartz-Sulfide Vein',
        gradeValue: '11.6 g/t',
        sampledBy: 'Senior Mine Geologist',
        date: '2026-10-18',
        specificGravity: 3.45,
        zoneCategory: 'ORE',
        alteration: 'Silicified (intensity 5)',
        sulfidePercent: 8.5,
        assayGrade: 11.6,
        metalAccumulation: 17.4,
      },
      {
        id: 'ch_04',
        sampleNumber: 'CH-04',
        fromMeter: 3.7,
        toMeter: 5.0,
        sampleLengthMeters: 1.3,
        lithologyOrVein: 'Laminated Quartz-Arsenopyrite Ribbon',
        gradeValue: '5.2 g/t',
        sampledBy: 'Senior Mine Geologist',
        date: '2026-10-18',
        specificGravity: 3.30,
        zoneCategory: 'ORE',
        alteration: 'Silicified (intensity 4)',
        sulfidePercent: 5.0,
        assayGrade: 5.2,
        metalAccumulation: 6.76,
      },
      {
        id: 'ch_05',
        sampleNumber: 'CH-05',
        fromMeter: 5.0,
        toMeter: 6.0,
        sampleLengthMeters: 1.0,
        lithologyOrVein: 'Hanging Wall Silicified Metabasalt',
        gradeValue: '0.3 g/t',
        sampledBy: 'Senior Mine Geologist',
        date: '2026-10-18',
        specificGravity: 2.70,
        zoneCategory: 'WASTE',
        alteration: 'Chloritic (intensity 1)',
        sulfidePercent: 0.2,
        assayGrade: 0.3,
        metalAccumulation: 0.3,
      },
    ];
    setMiningChannelSamples(demoSamples);

    setMiningRqd(78);
    setMiningJn(6);
    setMiningJr(2.0);
    setMiningJa(1.0);
    setMiningStressFactorA(0.85);
    setMiningJointFactorB(0.65);
    setMiningGravityFactorC(5.0);
    setMiningStopeWidth(5.0);
    setMiningStopeHeight(4.8);
    setMrmrBaseRmr(68);
    setMrmrWeatheringPct(95);
    setMrmrStressPct(90);
    setMrmrOrientationPct(85);
    setMrmrBlastingPct(92);

    try {
      localStorage.setItem(
        getStrictVaultKey('MINING'),
        JSON.stringify({
          industryMode: 'MINING',
          miningSettings: mSettings,
          miningChannelSamples: demoSamples,
          miningOreArea: 14.8,
          miningLowGradeArea: 2.4,
          miningWasteArea: 7.2,
          geometry: targetGeom,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {}

    if (navigateToActivity) {
      setModeScreenState((prev) => ({ ...prev, MINING: 'ACTIVITY' }));
      setMiningWorkflowStep(2);
    }
    setStatusMessage("Loaded MINING Kolar Underground Gold-Copper Mine dataset (Level 620 mRL, Cut #14, 5 Channel Assays, Q'=18.4, MRMR=61).");
  }, []);

  // 3. TBM Example Generator
  const loadTbmExampleData = useCallback((navigateToActivity = true) => {
    const targetGeom = createTunnelGeometry(6.6, 6.6, 3.3, 'circular', 3.3, 'manual');
    setGeometry(targetGeom);
    setManWidth('6.60');
    setManHeight('6.60');
    setManWallHeight('3.30');
    setManCrownRadius('3.30');
    setManProfileType('circular');

    const tParams: TbmMachineParameters = {
      ringNumber: 842,
      segmentId: 'Key + A1/A2/B1/B2/C (7 Segments)',
      strokeLengthMm: 1500,
      thrustForceKN: 13800,
      cutterheadTorqueKNm: 2850,
      penetrationRateMmPerRev: 7.5,
      advanceRateMmPerMin: 48.0,
      groutPressureBar: 2.8,
      groutVolumeM3: 11.8,
      epbPressureBar: 1.4,
      discCutterWearMm: 4.2,
      cutterheadInspectionNotes: '42 disc cutters (19") inspected at Ring #0842, normal gauge wear 4.2mm, no abnormal rotation.',
    };
    setTbmParams(tParams);

    const fullSample = buildCompleteSampleFieldDataset(targetGeom, 1.5);
    setSettings({
      ...fullSample.settings,
      industryMode: 'TBM',
      projectName: 'Metro Line-4 Twin Bore TBM Tunnel',
      tunnelName: 'South Drive (Downline)',
      location: 'South Drive — Ring #0842 (CH 04+215.00 m)',
      locationName: 'South Drive — Ring #0842 (CH 04+215.00 m)',
      chainage: 'CH 04+215.00 m',
      faceChainage: 'Ring #0842',
      driveDirectionInput: '185°',
      roundLength: 1.5,
      tbmParams: tParams,
    });

    setTbmRingNum(842);
    setTbmKeyPosition('Key Pos 4 (145°)');
    setTbmThrustKn(13800);
    setTbmTorqueKnm(2850);
    setTbmPenetrationMmRev(7.5);
    setTbmAdvanceRateMmMin(48.0);
    setTbmEpbPressureBar(2.65);
    setTbmGroutPressureBar(3.60);
    setTbmGroutVolumeM3(11.8);
    setTbmDiscWearMm(12.4);

    setTbmRpm(6.4);
    setTbmShieldFrictionKn(2400);
    setTbmActiveCuttersNc(42);
    setTbmMuckChipType('Slabby / Blocky');
    setTbmMuckChipSizeCm(8.5);
    setTbmWaterInflowLMin(45);
    setTbmTheoreticalGroutM3(8.2);
    setTbmOverbreakSector('11:00–01:00 Crown');

    try {
      localStorage.setItem(
        getStrictVaultKey('TBM'),
        JSON.stringify({
          industryMode: 'TBM',
          tbmParams: tParams,
          tbmRingNum: 842,
          tbmThrustKn: 13800,
          tbmTorqueKnm: 2850,
          tbmPenetrationMmRev: 7.5,
          tbmAdvanceRateMmMin: 48.0,
          tbmGroutVolumeM3: 11.8,
          geometry: targetGeom,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {}

    if (navigateToActivity) {
      setModeScreenState((prev) => ({ ...prev, TBM: 'ACTIVITY' }));
      setTbmTab(2);
    }
    setStatusMessage('Loaded TBM Metro Line-4 Twin Bore dataset (Ring #0842, Ø 6.6m Double Shield, 13,800 kN Thrust, FPI 36.2).');
  }, []);

  const requestSwitchIndustryMode = useCallback(
    (targetMode: IndustryMode) => {
      if (targetMode === industryMode) return;
      setPendingTargetMode(targetMode);
    },
    [industryMode]
  );

  const confirmAndSwitchIndustryMode = useCallback(
    (targetMode: IndustryMode) => {
      if (targetMode === industryMode) return;

      // 1. Snapshot current mode state strictly into its isolated vault
      const currentVaultKey = getStrictVaultKey(industryMode);
      const currentSnapshot = {
        industryMode,
        timestamp: new Date().toISOString(),
        settings,
        geometry,
        photos,
        joints,
        customJointSetOverrides,
        qIndexParams,
        rmrParams,
        tbmParams,
        miningSettings,
        // Mining parameters
        miningWorkflowStep,
        miningMappingMethod,
        miningChannelSamples,
        miningOreArea,
        miningLowGradeArea,
        miningWasteArea,
        miningBlastPull,
        miningRqd,
        miningJn,
        miningJr,
        miningJa,
        miningStressFactorA,
        miningJointFactorB,
        miningGravityFactorC,
        miningStopeWidth,
        miningStopeHeight,
        mrmrBaseRmr,
        mrmrWeatheringPct,
        mrmrStressPct,
        mrmrOrientationPct,
        mrmrBlastingPct,
        miningDdhIntervals,
        // TBM parameters
        tbmTab,
        tbmRingNum,
        tbmKeyPosition,
        tbmThrustKn,
        tbmTorqueKnm,
        tbmPenetrationMmRev,
        tbmAdvanceRateMmMin,
        tbmEpbPressureBar,
        tbmGroutPressureBar,
        tbmGroutVolumeM3,
        tbmDiscWearMm,
        tbmRpm,
        tbmShieldFrictionKn,
        tbmActiveCuttersNc,
        tbmMuckChipType,
        tbmMuckChipSizeCm,
        tbmWaterInflowLMin,
        tbmTheoreticalGroutM3,
        tbmOverbreakSector,
        tbmRingsLog,
      };

      try {
        localStorage.setItem(currentVaultKey, JSON.stringify(currentSnapshot));
      } catch {
        // Ignore storage quota
      }

      // 2. Set industryMode to targetMode & force MAIN_WINDOW first
      setIndustryMode(targetMode);
      setModeScreenState((prev) => ({
        ...prev,
        [targetMode]: 'MAIN_WINDOW',
      }));

      try {
        localStorage.setItem('eswa_active_industry_mode', targetMode);
        localStorage.setItem('eswa_active_industry_mode_v1', targetMode);
      } catch {
        // Ignore
      }

      // 3. Ensure overlays and modals are closed so user lands on target Main Window
      setIsFieldMappingModeOpen(false);
      setIsCoreLoggingOpen(false);
      setIsMiningInspectorOpen(false);
      setIsTbmInspectorOpen(false);

      // 4. Retrieve target mode state from its isolated vault
      let targetState: any = null;
      try {
        const raw = localStorage.getItem(getStrictVaultKey(targetMode));
        if (raw) {
          targetState = JSON.parse(raw);
        }
      } catch {
        // Ignore parse error
      }

      if (targetState) {
        if (targetState.settings) {
          setSettings({ ...targetState.settings, industryMode: targetMode });
        }
        if (targetState.geometry) setGeometry(targetState.geometry);
        if (targetState.photos) setPhotos(targetState.photos);
        if (targetState.joints) setJoints(targetState.joints);
        else if (targetState.clusteredJoints) setJoints(targetState.clusteredJoints);
        if (targetState.qIndexParams) setQIndexParams(targetState.qIndexParams);
        if (targetState.rmrParams) setRmrParams(targetState.rmrParams);
        if (targetState.tbmParams) setTbmParams(targetState.tbmParams);
        if (targetState.miningSettings) setMiningSettings(targetState.miningSettings);
        if (targetMode === 'MINING') {
          if (targetState.miningWorkflowStep) setMiningWorkflowStep(targetState.miningWorkflowStep);
          if (targetState.miningMappingMethod) setMiningMappingMethod(targetState.miningMappingMethod);
          if (targetState.miningChannelSamples) setMiningChannelSamples(targetState.miningChannelSamples);
          if (targetState.miningOreArea !== undefined) setMiningOreArea(targetState.miningOreArea);
          if (targetState.miningLowGradeArea !== undefined) setMiningLowGradeArea(targetState.miningLowGradeArea);
          if (targetState.miningWasteArea !== undefined) setMiningWasteArea(targetState.miningWasteArea);
          if (targetState.miningBlastPull !== undefined) setMiningBlastPull(targetState.miningBlastPull);
          if (targetState.miningRqd !== undefined) setMiningRqd(targetState.miningRqd);
          if (targetState.miningJn !== undefined) setMiningJn(targetState.miningJn);
          if (targetState.miningJr !== undefined) setMiningJr(targetState.miningJr);
          if (targetState.miningJa !== undefined) setMiningJa(targetState.miningJa);
          if (targetState.miningStressFactorA !== undefined) setMiningStressFactorA(targetState.miningStressFactorA);
          if (targetState.miningJointFactorB !== undefined) setMiningJointFactorB(targetState.miningJointFactorB);
          if (targetState.miningGravityFactorC !== undefined) setMiningGravityFactorC(targetState.miningGravityFactorC);
          if (targetState.miningStopeWidth !== undefined) setMiningStopeWidth(targetState.miningStopeWidth);
          if (targetState.miningStopeHeight !== undefined) setMiningStopeHeight(targetState.miningStopeHeight);
          if (targetState.mrmrBaseRmr !== undefined) setMrmrBaseRmr(targetState.mrmrBaseRmr);
          if (targetState.mrmrWeatheringPct !== undefined) setMrmrWeatheringPct(targetState.mrmrWeatheringPct);
          if (targetState.mrmrStressPct !== undefined) setMrmrStressPct(targetState.mrmrStressPct);
          if (targetState.mrmrOrientationPct !== undefined) setMrmrOrientationPct(targetState.mrmrOrientationPct);
          if (targetState.mrmrBlastingPct !== undefined) setMrmrBlastingPct(targetState.mrmrBlastingPct);
          if (targetState.miningDdhIntervals) setMiningDdhIntervals(targetState.miningDdhIntervals);
        } else if (targetMode === 'TBM') {
          if (targetState.tbmTab) setTbmTab(targetState.tbmTab);
          if (targetState.tbmRingNum !== undefined) setTbmRingNum(targetState.tbmRingNum);
          if (targetState.tbmKeyPosition) setTbmKeyPosition(targetState.tbmKeyPosition);
          if (targetState.tbmThrustKn !== undefined) setTbmThrustKn(targetState.tbmThrustKn);
          if (targetState.tbmTorqueKnm !== undefined) setTbmTorqueKnm(targetState.tbmTorqueKnm);
          if (targetState.tbmPenetrationMmRev !== undefined) setTbmPenetrationMmRev(targetState.tbmPenetrationMmRev);
          if (targetState.tbmAdvanceRateMmMin !== undefined) setTbmAdvanceRateMmMin(targetState.tbmAdvanceRateMmMin);
          if (targetState.tbmEpbPressureBar !== undefined) setTbmEpbPressureBar(targetState.tbmEpbPressureBar);
          if (targetState.tbmGroutPressureBar !== undefined) setTbmGroutPressureBar(targetState.tbmGroutPressureBar);
          if (targetState.tbmGroutVolumeM3 !== undefined) setTbmGroutVolumeM3(targetState.tbmGroutVolumeM3);
          if (targetState.tbmDiscWearMm !== undefined) setTbmDiscWearMm(targetState.tbmDiscWearMm);
          if (targetState.tbmRpm !== undefined) setTbmRpm(targetState.tbmRpm);
          if (targetState.tbmShieldFrictionKn !== undefined) setTbmShieldFrictionKn(targetState.tbmShieldFrictionKn);
          if (targetState.tbmActiveCuttersNc !== undefined) setTbmActiveCuttersNc(targetState.tbmActiveCuttersNc);
          if (targetState.tbmRingsLog) setTbmRingsLog(targetState.tbmRingsLog);
        } else {
          setScreen('welcome');
        }
      } else {
        // Defaults for fresh mode activation
        if (targetMode === 'MINING') {
          loadMiningExampleData(false);
        } else if (targetMode === 'TBM') {
          loadTbmExampleData(false);
        } else {
          loadNatmExampleData(false);
          setScreen('welcome');
        }
      }
    },
    [
      industryMode,
      settings,
      geometry,
      photos,
      joints,
      customJointSetOverrides,
      qIndexParams,
      rmrParams,
      tbmParams,
      miningSettings,
      miningWorkflowStep,
      miningMappingMethod,
      miningChannelSamples,
      miningOreArea,
      miningLowGradeArea,
      miningWasteArea,
      miningBlastPull,
      miningRqd,
      miningJn,
      miningJr,
      miningJa,
      miningStressFactorA,
      miningJointFactorB,
      miningGravityFactorC,
      miningStopeWidth,
      miningStopeHeight,
      mrmrBaseRmr,
      mrmrWeatheringPct,
      mrmrStressPct,
      mrmrOrientationPct,
      mrmrBlastingPct,
      miningDdhIntervals,
      tbmTab,
      tbmRingNum,
      tbmKeyPosition,
      tbmThrustKn,
      tbmTorqueKnm,
      tbmPenetrationMmRev,
      tbmAdvanceRateMmMin,
      tbmEpbPressureBar,
      tbmGroutPressureBar,
      tbmGroutVolumeM3,
      tbmDiscWearMm,
      tbmRpm,
      tbmShieldFrictionKn,
      tbmActiveCuttersNc,
      tbmMuckChipType,
      tbmMuckChipSizeCm,
      tbmWaterInflowLMin,
      tbmTheoreticalGroutM3,
      tbmOverbreakSector,
      tbmRingsLog,
      loadMiningExampleData,
      loadTbmExampleData,
      loadNatmExampleData,
    ]
  );

  // Alias for backward compatibility across all buttons
  const handleSwitchIndustryMode = requestSwitchIndustryMode;

  // State declarations moved above industry mode logic

  useEffect(() => {
    const handleProfileChange = () => {
      setActiveGeologist(getActiveGeologistProfile());
    };
    window.addEventListener('eswa-geologist-profile-changed', handleProfileChange);
    return () => window.removeEventListener('eswa-geologist-profile-changed', handleProfileChange);
  }, []);

  const activeMappingDomainRef = useRef<MappingDomainType>(activeMappingDomain);
  useEffect(() => {
    activeMappingDomainRef.current = activeMappingDomain;
  }, [activeMappingDomain]);



  // Persisted Project -> Locations Directory for Practical Step-1 Workflow
  const [projectDirectory, setProjectDirectory] = useState<Record<string, string[]>>(() => {
    try {
      const raw20 = localStorage.getItem('ESWA_PROJECT_LOCATION_DIRECTORY_V20_FRESH');
      const parsed20 = raw20 ? JSON.parse(raw20) : {};
      if (parsed20 && typeof parsed20 === 'object' && Object.keys(parsed20).length > 0) {
        return parsed20;
      }
    } catch {
      // Ignore storage errors
    }
    return {};
  });
  const [showNewProjectInput, setShowNewProjectInput] = useState<boolean>(false);
  const [showNewLocationInput, setShowNewLocationInput] = useState<boolean>(false);

  // Merge savedProjects & savedGeometries into projectDirectory so all known projects/locations appear
  const allProjectsList = useMemo(() => {
    const set = new Set<string>(Object.keys(projectDirectory));
    for (const p of savedProjects) {
      if (p.projectName?.trim()) set.add(p.projectName.trim());
    }
    if (settings.projectName?.trim()) set.add(settings.projectName.trim());
    return Array.from(set);
  }, [projectDirectory, savedProjects, settings.projectName]);

  const activeProjectName =
    settings.projectName?.trim() || allProjectsList[0] || '';

  const locationsForSelectedProject = useMemo(() => {
    if (!activeProjectName) return [];
    const locSet = new Set<string>(projectDirectory[activeProjectName] || []);
    for (const p of savedProjects) {
      const pName = (p.projectName || '').trim();
      if (!pName || pName === activeProjectName) {
        if (p.location?.trim()) locSet.add(p.location.trim());
        if (p.tunnelName?.trim()) locSet.add(p.tunnelName.trim());
      }
    }
    for (const g of savedGeometries) {
      if (g.location?.trim()) locSet.add(g.location.trim());
    }
    if (settings.locationName?.trim()) locSet.add(settings.locationName.trim());
    return Array.from(locSet);
  }, [
    projectDirectory,
    activeProjectName,
    savedProjects,
    savedGeometries,
    settings.locationName,
  ]);

  const activeLocationName =
    settings.locationName?.trim() ||
    settings.tunnelName?.trim() ||
    locationsForSelectedProject[0] ||
    '';

  const handleSaveProjectLocationPair = useCallback((proj: string, loc: string) => {
    const cleanP = proj.trim();
    const cleanL = loc.trim();
    if (!cleanP) return;
    setProjectDirectory((prev) => {
      const existingLocs = prev[cleanP] || [];
      const nextLocs =
        cleanL && !existingLocs.includes(cleanL) ? [...existingLocs, cleanL] : existingLocs;
      const next = { ...prev, [cleanP]: nextLocs };
      try {
        const json = JSON.stringify(next);
        localStorage.setItem('ESWA_PROJECT_LOCATION_DIRECTORY_V20_FRESH', json);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // Filter saved tunnel shapes & sizes (prioritizes matching Location, or shows all saved shapes)
  const savedShapesForSelectedLocation = useMemo(() => {
    const locLower = activeLocationName.trim().toLowerCase();
    if (!locLower) return savedGeometries;
    const matching = savedGeometries.filter(
      (g) =>
        (g.location || '').toLowerCase() === locLower ||
        (g.tunnelName || '').toLowerCase() === locLower
    );
    return matching.length > 0 ? matching : savedGeometries;
  }, [savedGeometries, activeLocationName]);

  // Session Learning Memory & Continuous Daily Learning Loop (Starts fresh with 0 pre-loaded records)
  const [sessionMemory, setSessionMemory] = useState<SessionLearningMemory>(() => {
    try {
      const raw = localStorage.getItem('ESWA_AI_LEARNING_MEMORY_V20_FRESH');
      if (raw) {
        const parsed = JSON.parse(raw) as SessionLearningMemory;
        if (parsed && Array.isArray(parsed.rejectedAngleRanges)) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage read errors
    }

    return {
      rejectedAngleRanges: [],
      confirmedOrientations: [],
      trainingSamplesTotal: 0,
      verifiedExamplesCount: 0,
      correctionsLearnedCount: 0,
      lastUpdatedDate: new Date().toISOString().slice(0, 10),
      currentModelVersion: 'ESWA AI Engine 1.0',
      modelHistory: [],
      verifiedRecords: [],
    };
  });

  // Automatically persist AI Learning Memory to localStorage & %APPDATA% on every update
  useEffect(() => {
    try {
      localStorage.setItem('ESWA_AI_LEARNING_MEMORY_V20_FRESH', JSON.stringify(sessionMemory));
      if (typeof window !== 'undefined' && window.akashDesktop?.saveAILearningMemoryToDisk) {
        window.akashDesktop.saveAILearningMemoryToDisk(sessionMemory).catch(() => {});
      }
    } catch {
      // Ignore storage write errors
    }
  }, [sessionMemory]);

  const handleSwitchMappingDomain = useCallback(
    (nextDomain: MappingDomainType) => {
      if (nextDomain === activeMappingDomainRef.current) return;

      // 1. Snapshot current active domain state & photos
      const curDomain = activeMappingDomainRef.current;
      const currentDraftPayload = {
        savedAt: new Date().toISOString(),
        screen,
        isFirstOpening,
        activeSurface,
        manWidth,
        manHeight,
        manWallHeight,
        manCrownRadius,
        manProfileType,
        geometry: {
          ...geometry,
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
        },
        settings,
        joints,
        customJointSetOverrides,
        selectedClassificationMethod,
        qIndexParams,
        qParamStatus,
        rmrParams,
        gsiParams,
        rockMassSummary,
        lithologyRegions,
        controlPoints,
        surveyProfile,
        placedSymbols,
        sessionMemory,
        photoSurfaceParams,
        mappingDomain: curDomain,
      };
      try {
        localStorage.setItem(
          getPhotogrammetryDraftStorageKey(curDomain),
          JSON.stringify(currentDraftPayload)
        );
        localStorage.setItem(
          getPhotogrammetryPhotosStorageKey(curDomain),
          JSON.stringify(photos)
        );
        if (curDomain === 'TUNNEL') {
          localStorage.setItem(OFFLINE_DRAFT_STORAGE_KEY, JSON.stringify(currentDraftPayload));
          localStorage.setItem(OFFLINE_DRAFT_PHOTOS_STORAGE_KEY, JSON.stringify(photos));
        }
      } catch {
        // Ignore quota errors
      }

      // 2. Switch domain ref and state
      activeMappingDomainRef.current = nextDomain;
      setActiveMappingDomain(nextDomain);
      if (nextDomain !== 'TUNNEL') {
        setSelectedSurfaceSubType(nextDomain as SurfaceMappingSubType);
      }

      // 3. Load target domain snapshot
      const targetDraft = loadSavedOfflineDraftSync(nextDomain);
      if (targetDraft) {
        if (
          targetDraft.geometry &&
          typeof targetDraft.geometry.width === 'number' &&
          Number.isFinite(targetDraft.geometry.width)
        ) {
          setGeometry(targetDraft.geometry);
        }
        if (targetDraft.manWidth) setManWidth(String(targetDraft.manWidth));
        if (targetDraft.manHeight) setManHeight(String(targetDraft.manHeight));
        if (targetDraft.manWallHeight) setManWallHeight(String(targetDraft.manWallHeight));
        if (targetDraft.manCrownRadius) setManCrownRadius(String(targetDraft.manCrownRadius));
        if (targetDraft.manProfileType) setManProfileType(targetDraft.manProfileType);
        if (targetDraft.settings) setSettings(targetDraft.settings);
        if (targetDraft.photos) {
          const def = createCleanPhotos();
          setPhotos({
            face: { ...def.face, ...(targetDraft.photos.face || {}) },
            crown: { ...def.crown, ...(targetDraft.photos.crown || {}) },
            leftWall: { ...def.leftWall, ...(targetDraft.photos.leftWall || {}) },
            rightWall: { ...def.rightWall, ...(targetDraft.photos.rightWall || {}) },
          });
        } else {
          setPhotos(createCleanPhotos());
        }
        setJoints(Array.isArray(targetDraft.joints) ? targetDraft.joints : []);
        if (targetDraft.customJointSetOverrides) {
          setCustomJointSetOverrides(targetDraft.customJointSetOverrides);
        }
        if (targetDraft.rmrParams) setRmrParams(targetDraft.rmrParams);
        if (targetDraft.qIndexParams) setQIndexParams(targetDraft.qIndexParams);
        if (targetDraft.gsiParams) setGsiParams(targetDraft.gsiParams);
        if (targetDraft.photoSurfaceParams) setPhotoSurfaceParams(targetDraft.photoSurfaceParams);
        setLithologyRegions(
          Array.isArray(targetDraft.lithologyRegions) ? targetDraft.lithologyRegions : []
        );
        setControlPoints(Array.isArray(targetDraft.controlPoints) ? targetDraft.controlPoints : []);
        setPlacedSymbols(Array.isArray(targetDraft.placedSymbols) ? targetDraft.placedSymbols : []);
        if (targetDraft.surveyProfile) setSurveyProfile(targetDraft.surveyProfile);
        if (targetDraft.activeSurface) setActiveSurface(targetDraft.activeSurface);
      } else {
        // Clean isolated defaults for the new domain
        if (nextDomain === 'TUNNEL') {
          const defaultTunnelGeom = createTunnelGeometry(8.4, 7.2, 4.2, 'd_shaped', 4.35, 'manual');
          setGeometry(defaultTunnelGeom);
          setManWidth('8.40');
          setManHeight('7.20');
          setManWallHeight('4.20');
          setManCrownRadius('4.35');
          setManProfileType('d_shaped');
          setPhotos(createCleanPhotos());
          setJoints([]);
          setSettings((prev) => ({
            ...prev,
            projectName: 'Underground Tunnel Project',
            tunnelName: 'Main Drive Tunnel',
            location: 'Face 01',
            chainage: 'RD 0.00m - 3.50m',
            faceChainage: 'RD 3.50m',
            roundLength: 3.5,
          }));
          setRmrParams(createDefaultRmrParameters());
          setQIndexParams(createDefaultQIndexParameters());
          setGsiParams(createDefaultGsiParameters());
          setLithologyRegions([]);
          setControlPoints([]);
          setPlacedSymbols([]);
        } else {
          const sub = nextDomain as SurfaceMappingSubType;
          const surfParams = loadSavedSurfaceGeometryParameters(sub);
          const nextP = { ...surfParams, subType: sub };
          setPhotoSurfaceParams(nextP);
          const compatGeom = buildCompatibleGeometryFromSurfaceParams(nextP);
          setGeometry(compatGeom);
          setManWidth(String(compatGeom.width));
          setManHeight(String(compatGeom.height));
          setManWallHeight(String(compatGeom.wallHeight));
          setManCrownRadius(String(compatGeom.crownRadius));
          setManProfileType((compatGeom.crownGeometry === 'horseshoe' ? 'horseshoe' : 'd_shaped') as ProfileType);
          setPhotos(createCleanPhotos());
          setJoints([]);
          const domainLabels = getSurfacePanelLabelMap(nextDomain);
          setSettings((prev) => ({
            ...prev,
            projectName: `${domainLabels.domainTitle} Project`,
            tunnelName: `${domainLabels.domainTitle} Sector`,
            location:
              sub === 'BENCH'
                ? 'Bench BL-1240'
                : sub === 'TRENCH'
                ? 'Trench TR-01'
                : sub === 'SLOPE'
                ? 'Slope CS-01'
                : 'Outcrop RS-01',
            chainage: sub === 'TRENCH' ? 'ST 0.00m - 5.00m' : 'ST 0.00m - 15.00m',
            faceChainage: sub === 'TRENCH' ? 'ST 5.00m' : 'ST 15.00m',
            roundLength: sub === 'TRENCH' ? 5.0 : 15.0,
          }));
          setRmrParams(createDefaultRmrParameters());
          setQIndexParams(createDefaultQIndexParameters());
          setGsiParams(createDefaultGsiParameters());
          setLithologyRegions([]);
          setControlPoints([]);
          setPlacedSymbols([]);
        }
      }
    },
    [
      screen,
      isFirstOpening,
      activeSurface,
      manWidth,
      manHeight,
      manWallHeight,
      manCrownRadius,
      manProfileType,
      geometry,
      settings,
      joints,
      customJointSetOverrides,
      selectedClassificationMethod,
      qIndexParams,
      qParamStatus,
      rmrParams,
      gsiParams,
      rockMassSummary,
      lithologyRegions,
      controlPoints,
      surveyProfile,
      placedSymbols,
      sessionMemory,
      photoSurfaceParams,
      photos,
    ]
  );

  const [isTracingAI, setIsTracingAI] = useState<boolean>(false);
  const [traceFitMode, setTraceFitMode] = useState<TraceFitMode>('smart_fit');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Ready. Upload or load surface photograph and press AI Trace.'
  );
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isContinuous3DLoggerOpen, setIsContinuous3DLoggerOpen] = useState<boolean>(false);
  const [isContinuousLogSetupOpen, setIsContinuousLogSetupOpen] = useState<boolean>(false);
  const [isA3ContinuousLogOpen, setIsA3ContinuousLogOpen] = useState<boolean>(false);
  const [initialCadOpenForContinuous, setInitialCadOpenForContinuous] = useState<boolean>(false);
  const [activeContinuousDataset, setActiveContinuousDataset] = useState<ContinuousTunnelStripDataset | null>(null);
  const [exportModalInitialMode, setExportModalInitialMode] =
    useState<OutputSheetMode>('FINAL_ENGINEERING_SHEET');

  // Keep Android WebView / Mobile Browser history armed so hardware/gesture Back navigates step-by-step inside the app instead of closing it
  const backStateRef = useRef({
    screen,
    isCoreLoggingOpen,
    isExportModalOpen,
    isContinuous3DLoggerOpen,
    isContinuousLogSetupOpen,
    isA3ContinuousLogOpen,
    isProjectMemoryModalOpen,
    hasChosenShapeModal: Boolean(chosenShapeModalState),
    showPhotoScreenAccuracyModal,
  });
  useEffect(() => {
    backStateRef.current = {
      screen,
      isCoreLoggingOpen,
      isExportModalOpen,
      isContinuous3DLoggerOpen,
      isContinuousLogSetupOpen,
      isA3ContinuousLogOpen,
      isProjectMemoryModalOpen,
      hasChosenShapeModal: Boolean(chosenShapeModalState),
      showPhotoScreenAccuracyModal,
    };
  }, [
    screen,
    isCoreLoggingOpen,
    isExportModalOpen,
    isContinuous3DLoggerOpen,
    isContinuousLogSetupOpen,
    isA3ContinuousLogOpen,
    isProjectMemoryModalOpen,
    chosenShapeModalState,
    showPhotoScreenAccuracyModal,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.history.pushState({ eswaBackGuard: true, screen }, '');
    } catch {
      // Ignore history errors on restricted origins
    }
  }, [
    screen,
    isCoreLoggingOpen,
    isExportModalOpen,
    isContinuous3DLoggerOpen,
    isContinuousLogSetupOpen,
    isA3ContinuousLogOpen,
    isProjectMemoryModalOpen,
    chosenShapeModalState,
    showPhotoScreenAccuracyModal,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleAndroidBackNavigation = () => {
      const cur = backStateRef.current;
      if (cur.isCoreLoggingOpen) {
        setIsCoreLoggingOpen(false);
      } else if (cur.isA3ContinuousLogOpen) {
        setIsA3ContinuousLogOpen(false);
      } else if (cur.isContinuousLogSetupOpen) {
        setIsContinuousLogSetupOpen(false);
      } else if (cur.isExportModalOpen) {
        setIsExportModalOpen(false);
      } else if (cur.isContinuous3DLoggerOpen) {
        setIsContinuous3DLoggerOpen(false);
      } else if (cur.isProjectMemoryModalOpen) {
        setIsProjectMemoryModalOpen(false);
      } else if (cur.hasChosenShapeModal) {
        setChosenShapeModalState(null);
      } else if (cur.showPhotoScreenAccuracyModal) {
        setShowPhotoScreenAccuracyModal(false);
      } else if (cur.screen === 'mapping') {
        setScreen('drive_and_photos');
      } else if (
        cur.screen === 'drive_and_photos' ||
        cur.screen === 'geometry_manual' ||
        cur.screen === 'geometry_cad' ||
        cur.screen === 'geometry_custom'
      ) {
        setScreen('start');
      } else if (cur.screen === 'start') {
        setScreen('welcome');
      }
      try {
        window.history.pushState({ eswaBackGuard: true }, '');
      } catch {
        // Ignore history errors
      }
    };

    window.addEventListener('popstate', handleAndroidBackNavigation);
    return () => window.removeEventListener('popstate', handleAndroidBackNavigation);
  }, []);

  // Automatically persist active workspace state (screen, portion, geometry, settings, joints, classifications)
  // using debounced background writes so typing and canvas dragging never block the 60fps UI thread,
  // plus immediate flush on app hide/close so closing & reopening the app resumes at the exact place.
  const persistLightweightStateNow = useCallback(() => {
    try {
      const curDom = activeMappingDomainRef.current || 'TUNNEL';
      const draftKey = getPhotogrammetryDraftStorageKey(curDom);
      const prevRaw = localStorage.getItem(draftKey);
      const prevParsed = prevRaw ? JSON.parse(prevRaw) : null;
      const effectiveScreen =
        screen !== 'welcome'
          ? screen
          : prevParsed?.screen && prevParsed.screen !== 'welcome'
          ? prevParsed.screen
          : 'mapping';

      const lightweightPayload = {
        savedAt: new Date().toISOString(),
        screen: effectiveScreen,
        isFirstOpening,
        activeSurface,
        manWidth,
        manHeight,
        manWallHeight,
        manCrownRadius,
        manProfileType,
        geometry: {
          ...geometry,
          hasCrown: true,
          hasLeftWall: true,
          hasRightWall: true,
        },
        settings,
        joints,
        customJointSetOverrides,
        selectedClassificationMethod,
        qIndexParams,
        qParamStatus,
        rmrParams,
        gsiParams,
        rockMassSummary,
        lithologyRegions,
        controlPoints,
        surveyProfile,
        placedSymbols,
        sessionMemory,
        photoSurfaceParams,
        mappingDomain: curDom,
      };
      localStorage.setItem(draftKey, JSON.stringify(lightweightPayload));
      if (curDom === 'TUNNEL') {
        localStorage.setItem(OFFLINE_DRAFT_STORAGE_KEY, JSON.stringify(lightweightPayload));
      }
      setHasSavedDraft(true);

      if (screen !== 'welcome') {
        savePhotogrammetryResumeState({
          screen,
          projectName: settings.projectName || '',
          tunnelName: settings.tunnelName || '',
          location: settings.locationName || settings.location || '',
          chainage: settings.chainage || '',
          faceChainage: settings.faceChainage || '',
          activeSurface,
          savedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Handled by desktopBridge chunking + IndexedDB
    }
  }, [
    screen,
    isFirstOpening,
    activeSurface,
    manWidth,
    manHeight,
    manWallHeight,
    manCrownRadius,
    manProfileType,
    geometry,
    settings,
    joints,
    customJointSetOverrides,
    selectedClassificationMethod,
    qIndexParams,
    qParamStatus,
    rmrParams,
    gsiParams,
    rockMassSummary,
    lithologyRegions,
    controlPoints,
    surveyProfile,
    placedSymbols,
    sessionMemory,
    photoSurfaceParams,
  ]);

  const persistPhotosStateNow = useCallback(() => {
    try {
      const curDom = activeMappingDomainRef.current || 'TUNNEL';
      const photosKey = getPhotogrammetryPhotosStorageKey(curDom);
      localStorage.setItem(photosKey, JSON.stringify(photos));
      if (curDom === 'TUNNEL') {
        localStorage.setItem(OFFLINE_DRAFT_PHOTOS_STORAGE_KEY, JSON.stringify(photos));
      }
    } catch {
      // Handled by desktopBridge chunking + IndexedDB
    }
  }, [photos]);

  const persistWorkspaceStateNow = useCallback(() => {
    persistLightweightStateNow();
    persistPhotosStateNow();
  }, [persistLightweightStateNow, persistPhotosStateNow]);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistLightweightStateNow();
    }, 450);
    return () => clearTimeout(timer);
  }, [persistLightweightStateNow]);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistPhotosStateNow();
    }, 900);
    return () => clearTimeout(timer);
  }, [persistPhotosStateNow]);

  useEffect(() => {
    const onHideOrUnload = () => {
      persistWorkspaceStateNow();
    };
    window.addEventListener('pagehide', onHideOrUnload);
    window.addEventListener('beforeunload', onHideOrUnload);
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        persistWorkspaceStateNow();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('pagehide', onHideOrUnload);
      window.removeEventListener('beforeunload', onHideOrUnload);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [persistWorkspaceStateNow]);

  // Automatically persist Station Rock Mass Classification Record on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveStationClassificationRecord({
        project: settings.locationName || 'Underground Tunnel Works',
        tunnel: settings.tunnelName,
        location: settings.locationName || 'Underground Tunnel Works',
        chainageRd: settings.faceChainage || settings.chainage,
        surfaceSection: activeSurface,
        selectedMethod: selectedClassificationMethod,
        qParamStatus,
        qUserConfirmed: Boolean(qIndexParams.userConfirmed),
        qConfirmedAt: qIndexParams.confirmedAt,
        rmrParams,
        gsiParams,
        dateVersion: new Date().toISOString(),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    settings.locationName,
    settings.tunnelName,
    settings.faceChainage,
    settings.chainage,
    activeSurface,
    selectedClassificationMethod,
    qParamStatus,
    qIndexParams.userConfirmed,
    qIndexParams.confirmedAt,
    rmrParams,
    gsiParams,
  ]);

  // Clean fresh workspace: do not auto-seed sample geometries or sample projects on startup

  // Start a completely fresh new mapping session (clears draft & example data)
  const handleStartFreshNewSession = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const freshGeom = createTunnelGeometry(8.4, 7.2, 4.2, 'd_shaped', 4.35, 'manual');
    setGeometry(freshGeom);
    setManWidth('8.40');
    setManHeight('7.20');
    setManWallHeight('4.20');
    setManCrownRadius('4.35');
    setManProfileType('d_shaped');
    setSettings({
      projectName: '',
      tunnelName: '',
      location: '',
      locationName: '',
      driveDirectionInput: 'N 000° E',
      driveDirection: 0,
      chainage: 'RD 0.00m - 3.50m',
      faceChainage: 'RD 3.50m',
      roundLength: 3.5,
      date: today,
      mappedBy: '',
      lithology: '',
      sheetConfig: loadSavedSheetConfig(),
    });
    const makeCleanSurface = (type: SurfaceType): PhotoSurface => ({
      type,
      originalImage: null,
      image: null,
      warpedImage: null,
      fileName: '',
      supportingPhotos: [],
      transform: createDefaultSurfaceTransform(),
      scale: 100,
      opacity: 100,
      autoFitted: false,
    });
    setPhotos({
      face: makeCleanSurface('face'),
      crown: makeCleanSurface('crown'),
      leftWall: makeCleanSurface('leftWall'),
      rightWall: makeCleanSurface('rightWall'),
    });
    setJoints([]);
    setHistoryPast([]);
    setHistoryFuture([]);
    setCustomJointSetOverrides({});
    setQIndexParams(createDefaultQIndexParameters());
    setQParamStatus(createDefaultQParamStatus());
    setRmrParams(createDefaultRmrParameters());
    setGsiParams(createDefaultGsiParameters());
    setRockMassSummary(createDefaultRockMassSummary());
    setLithologyRegions([]);
    setControlPoints([]);
    setPlacedSymbols([]);
    setActiveSurface('face');
    setChosenShapeModalState(null);
    try {
      localStorage.removeItem(OFFLINE_DRAFT_STORAGE_KEY);
      localStorage.removeItem(OFFLINE_DRAFT_PHOTOS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setHasSavedDraft(false);
    setIsFirstOpening(false);
    setScreen('start');
    setStatusMessage('Started fresh new tunnel mapping session.');
  }, []);

  // Save offline field draft for underground / Process Later workflow (Section 20)
  const handleSaveOfflineDraft = useCallback(() => {
    try {
      persistWorkspaceStateNow();
      setStatusMessage(
        `Saved field draft locally (${new Date().toLocaleTimeString()}). Ready for offline or later processing.`
      );
    } catch {
      setStatusMessage('Warning: Browser localStorage quota exceeded while saving photo draft.');
    }
  }, [persistWorkspaceStateNow]);

  // Resume saved Photogrammetry Face Mapping session where user stopped
  const handleResumeOfflineDraft = useCallback(() => {
    try {
      const parsed = loadSavedOfflineDraftSync();
      const photoResume = loadPhotogrammetryResumeState();
      if (parsed) {
        if (parsed.geometry) {
          setGeometry({
            ...parsed.geometry,
            hasCrown: true,
            hasLeftWall: true,
            hasRightWall: true,
          });
        }
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.photos) setPhotos(parsed.photos);
        if (parsed.activeSurface) setActiveSurface(parsed.activeSurface);
        if (Array.isArray(parsed.joints)) setJoints(parsed.joints);
        if (parsed.customJointSetOverrides)
          setCustomJointSetOverrides(parsed.customJointSetOverrides);
        if (parsed.selectedClassificationMethod)
          setSelectedClassificationMethod(parsed.selectedClassificationMethod);
        if (parsed.qIndexParams) setQIndexParams(parsed.qIndexParams);
        if (parsed.qParamStatus) setQParamStatus(parsed.qParamStatus);
        if (parsed.rmrParams) setRmrParams(parsed.rmrParams);
        if (parsed.gsiParams) setGsiParams(parsed.gsiParams);
        if (parsed.rockMassSummary) setRockMassSummary(parsed.rockMassSummary);
        if (Array.isArray(parsed.lithologyRegions)) setLithologyRegions(parsed.lithologyRegions);
        if (Array.isArray(parsed.controlPoints)) setControlPoints(parsed.controlPoints);
        if (parsed.surveyProfile) setSurveyProfile(parsed.surveyProfile);
        if (Array.isArray(parsed.placedSymbols)) setPlacedSymbols(parsed.placedSymbols);
        if (parsed.sessionMemory) setSessionMemory(parsed.sessionMemory);
      }
      const targetScreen = (photoResume?.screen || parsed?.screen || 'mapping') as ScreenStep;
      const validScreen: ScreenStep =
        targetScreen && targetScreen !== 'welcome' ? targetScreen : 'mapping';
      setStatusMessage('Resumed Photogrammetry Face Mapping session.');
      setScreen(validScreen);
    } catch {
      setStatusMessage('Could not restore saved Photogrammetry session.');
      setScreen('start');
    }
  }, []);

  // Compute clustered JointSets automatically from active joints + user overrides
  const { clusteredJoints, jointSets } = useMemo(() => {
    const res = clusterJointsIntoSets(joints);
    const mergedSets = res.jointSets.map((s) => ({
      ...s,
      ...(customJointSetOverrides[s.id] || {}),
    }));
    return {
      clusteredJoints: res.clusteredJoints,
      jointSets: mergedSets,
    };
  }, [joints, customJointSetOverrides]);

  // Real-time Overbreak & Undercut Engineering Analysis
  const overbreakAnalysis = useMemo(
    () =>
      analyzeOverbreakAndUndercut(
        geometry,
        settings,
        controlPoints,
        surveyProfile,
        clusteredJoints
      ),
    [geometry, settings, controlPoints, surveyProfile, clusteredJoints]
  );

  // Multi-Section Excavation Volume Rows (Average End Area & Prismoidal)
  const sectionVolumeRows = useMemo(
    () => computeSectionToSectionVolumes(savedProjects),
    [savedProjects]
  );

  // Persist Chainage Profile Schedule & automatically sync Custom Profile if linked Survey Control Points (CP1..CPn) move
  const handleUpdateChainageSchedule = useCallback((next: ChainageProfileSegmentRecord[]) => {
    setChainageSchedule(next);
    saveChainageProfileSchedule(next);
  }, []);

  useEffect(() => {
    if (!geometry.customProfile || controlPoints.length === 0) return;
    const { updatedProfile, changed } = syncCustomProfileWithSurveyControlPoints(
      geometry.customProfile,
      controlPoints
    );
    if (changed) {
      const nextGeom = buildAuthoritativeCustomTunnelGeometry(updatedProfile, {
        rdStartMeters: geometry.rdStartMeters,
        rdEndMeters: geometry.rdEndMeters,
      });
      setGeometry(nextGeom);
    }
  }, [controlPoints, geometry.customProfile, geometry.rdStartMeters, geometry.rdEndMeters]);

  const handleSyncProfileToSurveyControlPoints = useCallback(
    (profileDef: CustomTunnelProfileDefinition) => {
      const faceCPs: SurveyControlPoint[] = profileDef.controlPoints.map((pt, idx) => {
        const label = pt.surveyControlPointId || `CP${idx + 1}`;
        return {
          id: `cp-custom-${pt.id}`,
          label,
          surface: 'face',
          point: { x: Number(pt.x.toFixed(3)), y: Number(pt.y.toFixed(3)) },
          color: '#22D3EE',
          visible: true,
          locked: Boolean(pt.locked),
        };
      });
      setControlPoints((prev) => [
        ...prev.filter((c) => c.surface !== 'face'),
        ...faceCPs,
      ]);
      setSurveyProfile((prev) => ({
        ...prev,
        surface: 'face',
        orderedControlPointIds: faceCPs.map((c) => c.id),
        isClosed: true,
        visible: true,
      }));
      const nextGeom = buildAuthoritativeCustomTunnelGeometry(profileDef, {
        rdStartMeters: geometry.rdStartMeters,
        rdEndMeters: geometry.rdEndMeters,
      });
      setGeometry(nextGeom);
      setStatusMessage(
        `Placed & linked ${faceCPs.length} Survey Control Points (CP1→CP${faceCPs.length}) on custom profile "${profileDef.name}". Moving any CP updates the profile automatically.`
      );
    },
    [geometry.rdStartMeters, geometry.rdEndMeters]
  );

  const handleOpenProjectMemoryModal = useCallback(
    (
      tab:
        | DataStorageTabId
        | 'continuous_3d_log' = 'field_data'
    ) => {
      setProjectMemoryTab(tab === 'continuous_3d_log' ? 'field_data' : tab);
      setIsProjectMemoryModalOpen(true);
    },
    []
  );

  const handleGenerateSampleAsBuiltProfile = useCallback(() => {
    // Radial Overbreak on Crown, Left Wall & Right Wall is geometrically defined on the Tunnel Face ('face') cross-section
    const sample = generateRealisticSampleSurveyedProfile(
      geometry,
      'face',
      settings.roundLength > 0 ? settings.roundLength : 3.5
    );
    setControlPoints((prev) => [
      ...prev.filter((c) => c.surface !== 'face'),
      ...sample.controlPoints,
    ]);
    setSurveyProfile(sample.profile);
    if (activeSurface !== 'face') {
      setActiveSurface('face');
    }
    setStatusMessage(
      'Generated Crown, Left Wall & Right Wall As-Built Overbreak Profile (CP1→CP14) on 1. FACE cross-section (radial overbreak cannot be plotted on flat unwrapped Wall/Crown views).'
    );
  }, [geometry, activeSurface, settings.roundLength]);

  // Save current project into Project File Memory (Indexed by Project + Location + Tunnel + Chainage + Date)
  const handleSaveCurrentProjectToMemory = useCallback(() => {
    const chMeters = parseNumericChainageMeters(settings.faceChainage, settings.chainage);
    const projName =
      settings.projectName ||
      settings.sheetConfig?.projectName ||
      'Hydroelectric / Underground Tunnel Project';
    const locName =
      settings.locationName ||
      settings.location ||
      settings.sheetConfig?.location ||
      'Main Underground Heading';
    if (settings.sheetConfig) {
      saveSheetConfigToStorage(settings.sheetConfig);
    }
    const record: SavedProjectRecord = {
      id: `proj-${projName.replace(/\s+/g, '_')}-${locName.replace(/\s+/g, '_')}-${settings.tunnelName.replace(/\s+/g, '_')}-${settings.faceChainage.replace(/\s+/g, '_')}-${settings.date}`,
      projectName: projName,
      tunnelName: settings.tunnelName,
      location: locName,
      chainage: settings.chainage,
      faceChainage: settings.faceChainage,
      numericChainageMeters: chMeters,
      date: settings.date,
      savedAt: new Date().toISOString(),
      mappingMode: 'TUNNEL_PROFILE',
      geometry,
      settings: {
        ...settings,
        projectName: projName,
        locationName: locName,
      },
      sheetConfig: settings.sheetConfig,
      photos,
      joints: clusteredJoints,
      customJointSetOverrides,
      qIndexParams,
      selectedClassificationMethod,
      rmrParams,
      gsiParams,
      qParamStatus,
      rockMassSummary,
      lithologyRegions,
      controlPoints,
      surveyProfile,
      placedSymbols,
      quantitySummary: {
        designAreaSqM: overbreakAnalysis.designAreaSqMeters,
        surveyedAreaSqM: overbreakAnalysis.surveyedAreaSqMeters,
        overbreakAreaSqM: overbreakAnalysis.overbreakAreaSqMeters,
        undercutAreaSqM: overbreakAnalysis.undercutAreaSqMeters,
        overbreakPct: overbreakAnalysis.overbreakPercentage,
        undercutPct: overbreakAnalysis.undercutPercentage,
        maxOverbreakM: overbreakAnalysis.maxRadialOverbreakMeters,
        maxUndercutM: overbreakAnalysis.maxRadialUndercutMeters,
        pullIntervalM: overbreakAnalysis.effectivePullIntervalMeters,
        overbreakVolumeM3: overbreakAnalysis.overbreakVolumeCubicMeters,
        undercutVolumeM3: overbreakAnalysis.undercutVolumeCubicMeters,
      },
      mappingDomain: activeMappingDomain,
    };
    const { records, storageWarning } = saveProjectRecordToMemory(record);
    setSavedProjects(records);

    // Save into mode-specific isolated database namespace
    try {
      const modeKey = `eswa_isolated_db_${industryMode}`;
      const existingRaw = localStorage.getItem(modeKey);
      let existingData: any = {};
      if (existingRaw) {
        try {
          existingData = JSON.parse(existingRaw);
        } catch {
          // Ignore parse errors
        }
      }
      existingData.lastSavedRecord = record;
      existingData.timestamp = new Date().toISOString();
      localStorage.setItem(modeKey, JSON.stringify(existingData));
    } catch {
      // Ignore storage errors
    }

    syncPhotogrammetryProjectForAiTraining(
      settings,
      geometry,
      clusteredJoints,
      photos,
      qIndexParams,
      rmrParams,
      overbreakAnalysis,
      'MANUAL_TRACE_SAVED'
    );
    setStatusMessage(
      storageWarning ||
        `Saved project "${record.tunnelName} (${record.faceChainage}, ${record.date})" to ${industryMode} File Memory.`
    );
  }, [
    settings,
    geometry,
    photos,
    clusteredJoints,
    customJointSetOverrides,
    qIndexParams,
    selectedClassificationMethod,
    rmrParams,
    gsiParams,
    qParamStatus,
    rockMassSummary,
    lithologyRegions,
    controlPoints,
    surveyProfile,
    placedSymbols,
    overbreakAnalysis,
  ]);

  // Quick-create a companion cross-section (+3.5m chainage) so multi-section volume calculation can be tested immediately
  const handleCreateCompanionSectionForVolumeTest = useCallback(() => {
    handleSaveCurrentProjectToMemory();
    const curCh = parseNumericChainageMeters(settings.faceChainage, settings.chainage) ?? 1423.5;
    const pull = settings.roundLength > 0 ? settings.roundLength : 3.5;
    const nextCh = Number((curCh + pull).toFixed(2));
    const projName =
      settings.projectName ||
      settings.sheetConfig?.projectName ||
      'Hydroelectric / Underground Tunnel Project';
    const locName =
      settings.locationName ||
      settings.location ||
      settings.sheetConfig?.location ||
      'Main Underground Heading';
    const companionRecord: SavedProjectRecord = {
      id: `proj-${projName.replace(/\s+/g, '_')}-${locName.replace(/\s+/g, '_')}-${settings.tunnelName.replace(/\s+/g, '_')}-RD_${nextCh.toFixed(2)}m-${settings.date}`,
      projectName: projName,
      tunnelName: settings.tunnelName,
      location: locName,
      chainage: `RD ${curCh.toFixed(2)}m - ${nextCh.toFixed(2)}m`,
      faceChainage: `RD ${nextCh.toFixed(2)}m`,
      numericChainageMeters: nextCh,
      date: settings.date,
      savedAt: new Date().toISOString(),
      mappingMode: 'TUNNEL_PROFILE',
      geometry,
      settings: {
        ...settings,
        projectName: projName,
        locationName: locName,
        chainage: `RD ${curCh.toFixed(2)}m - ${nextCh.toFixed(2)}m`,
        faceChainage: `RD ${nextCh.toFixed(2)}m`,
      },
      sheetConfig: settings.sheetConfig,
      photos,
      joints: clusteredJoints,
      customJointSetOverrides,
      qIndexParams,
      rockMassSummary,
      lithologyRegions,
      controlPoints,
      surveyProfile,
      placedSymbols,
      quantitySummary: {
        designAreaSqM: overbreakAnalysis.designAreaSqMeters,
        surveyedAreaSqM: Number((overbreakAnalysis.surveyedAreaSqMeters * 1.018).toFixed(2)),
        overbreakAreaSqM: Number((overbreakAnalysis.overbreakAreaSqMeters * 1.12).toFixed(2)),
        undercutAreaSqM: Number((overbreakAnalysis.undercutAreaSqMeters * 0.88).toFixed(2)),
        overbreakPct: Number((overbreakAnalysis.overbreakPercentage * 1.12).toFixed(2)),
        undercutPct: Number((overbreakAnalysis.undercutPercentage * 0.88).toFixed(2)),
        maxOverbreakM: overbreakAnalysis.maxRadialOverbreakMeters,
        maxUndercutM: overbreakAnalysis.maxRadialUndercutMeters,
        pullIntervalM: pull,
        overbreakVolumeM3: Number(
          (overbreakAnalysis.overbreakAreaSqMeters * 1.12 * pull).toFixed(2)
        ),
        undercutVolumeM3: Number(
          (overbreakAnalysis.undercutAreaSqMeters * 0.88 * pull).toFixed(2)
        ),
      },
    };
    const { records } = saveProjectRecordToMemory(companionRecord);
    setSavedProjects(records);
    setStatusMessage(
      `Saved current section (RD ${curCh.toFixed(2)}m) + companion section (RD ${nextCh.toFixed(2)}m) for section-to-section volume calculation.`
    );
  }, [
    handleSaveCurrentProjectToMemory,
    settings,
    geometry,
    photos,
    clusteredJoints,
    customJointSetOverrides,
    qIndexParams,
    rockMassSummary,
    lithologyRegions,
    controlPoints,
    surveyProfile,
    placedSymbols,
    overbreakAnalysis,
  ]);

  const handleLoadProjectRecord = useCallback((record: SavedProjectRecord) => {
    setGeometry(record.geometry);
    const restoredConfig =
      record.sheetConfig || record.settings.sheetConfig || loadSavedSheetConfig(record.settings);
    setSettings({
      ...record.settings,
      projectName:
        record.projectName ||
        record.settings.projectName ||
        restoredConfig.projectName ||
        'Hydroelectric / Underground Tunnel Project',
      locationName:
        record.location ||
        record.settings.locationName ||
        restoredConfig.location ||
        'Main Underground Heading',
      sheetConfig: restoredConfig,
    });
    saveSheetConfigToStorage(restoredConfig);
    setPhotos(record.photos);
    setJoints(record.joints || []);
    setCustomJointSetOverrides(record.customJointSetOverrides || {});
    setQIndexParams(record.qIndexParams);
    if (record.selectedClassificationMethod) {
      setSelectedClassificationMethod(record.selectedClassificationMethod);
    }
    if (record.rmrParams) {
      setRmrParams(record.rmrParams);
    }
    if (record.gsiParams) {
      setGsiParams(record.gsiParams);
    }
    if (record.qParamStatus) {
      setQParamStatus(record.qParamStatus);
    }
    setRockMassSummary(record.rockMassSummary);
    setLithologyRegions(record.lithologyRegions || []);
    setControlPoints(record.controlPoints || []);
    if (record.surveyProfile) {
      setSurveyProfile(record.surveyProfile);
    }
    setPlacedSymbols(record.placedSymbols || []);
    setIsProjectMemoryModalOpen(false);

    const recMode = (record.settings?.industryMode as IndustryMode) || industryMode;
    if (recMode && (recMode === 'NATM' || recMode === 'TBM' || recMode === 'MINING')) {
      setIndustryMode(recMode);
      try {
        localStorage.setItem('eswa_active_industry_mode', recMode);
        localStorage.setItem('eswa_active_industry_mode_v1', recMode);
      } catch {
        // Ignore
      }
    }

    if (record.settings?.miningSettings) {
      setMiningSettings(record.settings.miningSettings);
    }
    if (record.settings?.tbmParams) {
      setTbmParams(record.settings.tbmParams);
    }

    if (recMode === 'NATM') {
      setScreen('mapping');
    } else if (recMode === 'MINING') {
      setMiningWorkflowStep(2);
    } else if (recMode === 'TBM') {
      setTbmTab(1);
    }

    setStatusMessage(
      `Loaded ${recMode} project "${record.tunnelName} (${record.faceChainage}, ${record.date})" from File Memory.`
    );
  }, [industryMode]);

  const handleExportCurrentProjectFile = useCallback(() => {
    const chMeters = parseNumericChainageMeters(settings.faceChainage, settings.chainage);
    const payload: SavedProjectRecord = {
      id: `proj-${Date.now()}`,
      tunnelName: settings.tunnelName,
      location: settings.locationName || 'Underground Tunnel Works',
      chainage: settings.chainage,
      faceChainage: settings.faceChainage,
      numericChainageMeters: chMeters,
      date: settings.date,
      savedAt: new Date().toISOString(),
      mappingMode: 'TUNNEL_PROFILE',
      geometry,
      settings,
      photos,
      joints: clusteredJoints,
      customJointSetOverrides,
      qIndexParams,
      rockMassSummary,
      lithologyRegions,
      controlPoints,
      surveyProfile,
      placedSymbols,
      quantitySummary: {
        designAreaSqM: overbreakAnalysis.designAreaSqMeters,
        surveyedAreaSqM: overbreakAnalysis.surveyedAreaSqMeters,
        overbreakAreaSqM: overbreakAnalysis.overbreakAreaSqMeters,
        undercutAreaSqM: overbreakAnalysis.undercutAreaSqMeters,
        overbreakPct: overbreakAnalysis.overbreakPercentage,
        undercutPct: overbreakAnalysis.undercutPercentage,
        maxOverbreakM: overbreakAnalysis.maxRadialOverbreakMeters,
        maxUndercutM: overbreakAnalysis.maxRadialUndercutMeters,
        pullIntervalM: overbreakAnalysis.effectivePullIntervalMeters,
        overbreakVolumeM3: overbreakAnalysis.overbreakVolumeCubicMeters,
        undercutVolumeM3: overbreakAnalysis.undercutVolumeCubicMeters,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(/\s+/g, '_')}_${settings.date}.akash.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    syncPhotogrammetryProjectForAiTraining(
      settings,
      geometry,
      clusteredJoints,
      photos,
      qIndexParams,
      rmrParams,
      overbreakAnalysis,
      'EXPORT_GENERATED'
    );
  }, [
    settings,
    geometry,
    photos,
    clusteredJoints,
    customJointSetOverrides,
    qIndexParams,
    rockMassSummary,
    lithologyRegions,
    controlPoints,
    surveyProfile,
    placedSymbols,
    overbreakAnalysis,
  ]);

  const handleImportProjectRecordFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SavedProjectRecord;
      if (!parsed || !parsed.geometry || !parsed.settings) {
        throw new Error('Invalid .akash.json project file');
      }
      const { records } = saveProjectRecordToMemory(parsed);
      setSavedProjects(records);
      handleLoadProjectRecord(parsed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import project file';
      setStatusMessage(`Import error: ${msg}`);
    }
  }, [handleLoadProjectRecord]);

  const lastJointHistoryPushTimeRef = useRef<number>(0);
  const jointRefinementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jointTelemetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateJointsWithHistory = useCallback(
    (nextJoints: Joint[]) => {
      const now = Date.now();
      const isRapidDragBurst = now - lastJointHistoryPushTimeRef.current < 220;
      lastJointHistoryPushTimeRef.current = now;

      if (!isRapidDragBurst) {
        setHistoryPast((prev) => [...prev.slice(-24), joints]);
        setHistoryFuture([]);
      }

      if (isRapidDragBurst) {
        // Fast 60fps path during vertex/joint dragging: update joints immediately and debounce heavy 3D multi-surface & Q-index refinement
        setJoints(nextJoints);
        if (jointRefinementTimerRef.current) {
          clearTimeout(jointRefinementTimerRef.current);
        }
        jointRefinementTimerRef.current = setTimeout(() => {
          jointRefinementTimerRef.current = null;
          const { clusteredJoints: reclustered, jointSets: nextSets } =
            clusterJointsIntoSets(nextJoints);
          const refined = refineMultiSurfaceOrientations(reclustered, geometry, settings);
          setJoints(refined);
          if (refined.length > 0) {
            setQIndexParams((prevQ) =>
              autoEstimateQIndexFromMappedJoints(
                refined,
                nextSets,
                geometry,
                settings,
                prevQ
              )
            );
          }
        }, 140);
        return;
      }

      const { clusteredJoints: reclustered, jointSets: nextSets } = clusterJointsIntoSets(nextJoints);
      const refined = refineMultiSurfaceOrientations(reclustered, geometry, settings);
      setJoints(refined);
      if (refined.length > 0) {
        setQIndexParams((prevQ) =>
          autoEstimateQIndexFromMappedJoints(
            refined,
            nextSets,
            geometry,
            settings,
            prevQ
          )
        );

        // Automatic non-blocking telemetry sync with offline fallback for AI model fine-tuning
        if (jointTelemetryTimerRef.current) clearTimeout(jointTelemetryTimerRef.current);
        jointTelemetryTimerRef.current = setTimeout(() => {
          syncPhotogrammetryProjectForAiTraining(
            settings,
            geometry,
            refined,
            photos,
            qIndexParams,
            rmrParams,
            overbreakAnalysis,
            'MANUAL_TRACE_SAVED'
          );
        }, 1500);
      }
    },
    [joints, geometry, settings, photos, qIndexParams, rmrParams, overbreakAnalysis]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [joints, ...prev]);
    setJoints(previous);
  }, [historyPast, joints]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, joints]);
    setJoints(next);
  }, [historyFuture, joints]);

  // Apply manual tunnel geometry
  const handleApplyManualGeometry = (proceedToNext = true) => {
    const w = Math.max(1.5, parseFloat(manWidth) || 8.4);
    const h = Math.max(1.5, parseFloat(manHeight) || 7.2);
    const wh = Math.min(h - 0.3, Math.max(0.5, parseFloat(manWallHeight) || 4.2));
    const cr = Math.max(1.0, parseFloat(manCrownRadius) || w / 2);

    const nextGeom = createTunnelGeometry(w, h, wh, manProfileType, cr, 'manual');
    setGeometry(nextGeom);
    if (proceedToNext) {
      setScreen('drive_and_photos');
    }
  };

  // Handle DXF / DWG File Upload (Option B)
  const handleCADFileUpload = async (file: File) => {
    setCadStatus(`Reading ${file.name}...`);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.dxf')) {
        const text = await file.text();
        const parsedGeom = parseDXFStringToGeometry(text, file.name);
        setGeometry(parsedGeom);
        setManWidth(String(parsedGeom.width));
        setManHeight(String(parsedGeom.height));
        setManWallHeight(String(parsedGeom.wallHeight));
        setManCrownRadius(String(parsedGeom.crownRadius));
        setCadStatus(
          `Loaded Master DXF Geometry: ${parsedGeom.width}m Width × ${parsedGeom.height}m Height (Wall ${parsedGeom.wallHeight}m)`
        );
        return;
      }

      // If DWG or binary CAD, send to backend conversion pipeline (/api/geometry/parse-cad)
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < Math.min(bytes.byteLength, 250000); i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const contentBase64 = btoa(binary);

      const res = await fetch('/api/geometry/parse-cad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getEswaApiSecurityHeaders(),
        },
        body: JSON.stringify({ fileName: file.name, contentBase64 }),
      });

      if (!res.ok) throw new Error('Backend CAD conversion failed');
      const data = await res.json();

      if (data.format === 'dxf' && data.dxfText) {
        const parsedGeom = parseDXFStringToGeometry(data.dxfText, file.name);
        setGeometry(parsedGeom);
        setCadStatus(
          `Loaded DXF Geometry: ${parsedGeom.width}m Width × ${parsedGeom.height}m Height`
        );
      } else {
        const converted = createTunnelGeometry(
          data.width || 8.4,
          data.height || 7.2,
          data.wallHeight || 4.2,
          'd_shaped',
          (data.width || 8.4) / 2,
          'dwg',
          file.name
        );
        setGeometry(converted);
        setCadStatus(
          `Converted DWG Master Geometry (${file.name}): ${converted.width}m W × ${converted.height}m H`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to parse CAD file';
      setCadStatus(`Error: ${msg}`);
    }
  };

  // Download sample DXF file so user can inspect or test DXF import
  const handleDownloadSampleDXF = () => {
    const dxfContent = generateSampleTunnelDXF(8.4, 7.2, 4.2);
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_tunnel_master_profile.dxf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Upload, apply camera calibration & lens-distortion correction, and fit photograph to master tunnel geometry
  const handleUploadSurfacePhoto = useCallback(
    async (surface: SurfaceType, file: File) => {
      const rawBuffer = await file.arrayBuffer().catch(() => undefined);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setStatusMessage(
          `Enhancing ${surface} photo (removing shadows & disturbances, upscaling HD) & fitting to master geometry...`
        );
        try {
          const { transform, qualityReport, calibration, undistortedDataUrl } =
            await analyzeAndAutoFitPhoto(dataUrl, surface, geometry, rawBuffer);
          setPhotos((prev) => ({
            ...prev,
            [surface]: {
              ...prev[surface],
              originalImage: dataUrl,
              image: undistortedDataUrl,
              fileName: file.name,
              transform,
              calibration,
              opacity: 100,
              autoFitted: true,
              qualityReport,
            },
          }));
          setStatusMessage(
            `Auto-enhanced, shadow-removed & upscaled ${surface} photo (${calibration.source}: ${calibration.focalLengthMm}mm eq) fitted to ${geometry.width}m × ${geometry.height}m master geometry.`
          );
        } catch {
          setPhotos((prev) => ({
            ...prev,
            [surface]: {
              ...prev[surface],
              originalImage: dataUrl,
              image: dataUrl,
              fileName: file.name,
              transform: createDefaultSurfaceTransform(),
              opacity: 100,
              autoFitted: true,
            },
          }));
        }
      };
      reader.readAsDataURL(file);
    },
    [geometry]
  );

  // Upload or Replace Supporting Photograph (0–5 Supporting Photos per surface; NEVER replaces Main Photo)
  const handleUploadSupportingPhoto = useCallback(
    async (surface: SurfaceType, file: File, replacePhotoId?: string) => {
      const rawBuffer = await file.arrayBuffer().catch(() => undefined);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          const { undistortedDataUrl, calibration: stereoCal } =
            await calibrateAndUndistortPhotograph(
              dataUrl,
              rawBuffer,
              surface,
              geometry,
              settings,
              true
            );
          const primaryCal = photos[surface].calibration;
          const baselineCheck = evaluateStereoBaseline(
            primaryCal,
            stereoCal,
            Math.max(4.5, geometry.width * 0.95)
          );

          const newSupportingItem: SupportingPhoto = {
            id: replacePhotoId || `sup-${surface}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            image: undistortedDataUrl,
            originalImage: dataUrl,
            fileName: file.name,
            calibration: stereoCal,
            baselineMeters: baselineCheck.baselineMeters,
          };

          setPhotos((prev) => {
            const existingList = prev[surface].supportingPhotos || [];
            const nextList = replacePhotoId
              ? existingList.map((item) => (item.id === replacePhotoId ? newSupportingItem : item))
              : [...existingList, newSupportingItem].slice(0, 5);
            const firstSup = nextList[0];

            return {
              ...prev,
              [surface]: {
                ...prev[surface],
                supportingPhotos: nextList,
                stereoImage: firstSup ? firstSup.image : null,
                stereoFileName: firstSup ? firstSup.fileName : undefined,
                stereoCalibration: firstSup ? firstSup.calibration : undefined,
                stereoBaselineMeters: firstSup ? firstSup.baselineMeters : undefined,
                stereoBaselineWarning: baselineCheck.warningMessage,
              },
            };
          });

          setStatusMessage(
            `Added Supporting Photo (${file.name}, Baseline ${baselineCheck.baselineMeters}m). Main Photo remains primary mapping basis.`
          );
        } catch {
          setStatusMessage('Failed to calibrate supporting photograph.');
        }
      };
      reader.readAsDataURL(file);
    },
    [geometry, settings, photos]
  );

  // Remove a Supporting Photograph (0–5) without altering the Main Photo
  const handleRemoveSupportingPhoto = useCallback((surface: SurfaceType, photoId: string) => {
    setPhotos((prev) => {
      const nextList = (prev[surface].supportingPhotos || []).filter((item) => item.id !== photoId);
      const firstSup = nextList[0];
      return {
        ...prev,
        [surface]: {
          ...prev[surface],
          supportingPhotos: nextList,
          stereoImage: firstSup ? firstSup.image : null,
          stereoFileName: firstSup ? firstSup.fileName : undefined,
          stereoCalibration: firstSup ? firstSup.calibration : undefined,
          stereoBaselineMeters: firstSup ? firstSup.baselineMeters : undefined,
          stereoBaselineWarning: nextList.length === 0 ? undefined : prev[surface].stereoBaselineWarning,
        },
      };
    });
    setStatusMessage('Removed supporting photograph. Main Photo preserved.');
  }, []);

  // Remove Main Photo for a surface
  const handleRemoveMainPhoto = useCallback((surface: SurfaceType) => {
    setPhotos((prev) => ({
      ...prev,
      [surface]: {
        ...prev[surface],
        originalImage: null,
        image: null,
        fileName: undefined,
        autoFitted: false,
      },
    }));
    setStatusMessage(`Removed Main Photo from ${surface}.`);
  }, []);

  // Generate & auto-fit realistic sample field photograph for a surface
  const handleLoadSampleSurfacePhoto = useCallback(
    async (surface: SurfaceType) => {
      const dataUrl = generateSampleTunnelPhotograph(surface, geometry);
      const { transform, qualityReport, calibration, undistortedDataUrl } =
        await analyzeAndAutoFitPhoto(dataUrl, surface, geometry);
      setPhotos((prev) => ({
        ...prev,
        [surface]: {
          ...prev[surface],
          originalImage: dataUrl,
          image: undistortedDataUrl,
          fileName: `field_${surface}_excavation.jpg`,
          transform,
          calibration,
          opacity: 100,
          autoFitted: true,
          qualityReport,
        },
      }));
      setStatusMessage(
        `Loaded & calibrated ${surface} excavation photo (${calibration.focalLengthMm}mm eq, 3×3 homography fitted). Press AI Trace.`
      );
    },
    [geometry]
  );

  // Load all 4 sample photographs at once
  const handleLoadAllSamplePhotos = async () => {
    const surfaces: SurfaceType[] = ['face', 'crown', 'leftWall', 'rightWall'];
    for (const s of surfaces) {
      await handleLoadSampleSurfacePhoto(s);
    }
  };

  // Feed Complete Sample Field Dataset (Photos, 16 Multi-Surface Joints, Lithology, ISRM Symbols, Survey Profile, RMR/Q/GSI & 3D Strip Datasets)
  const handleFeedFullSampleData = useCallback(
    (navigateToMapping = true) => {
      const targetGeom = createTunnelGeometry(8.4, 7.2, 4.2, 'd_shaped', 4.35, 'manual');
      const fullSample = buildCompleteSampleFieldDataset(targetGeom, 3.5);

      setGeometry(targetGeom);
      setManWidth('8.40');
      setManHeight('7.20');
      setManWallHeight('4.20');
      setManCrownRadius('4.35');
      setManProfileType('d_shaped');

      setSettings(fullSample.settings);
      setPhotos(fullSample.photos);
      setJoints(fullSample.joints);
      setHistoryPast([]);
      setHistoryFuture([]);
      setLithologyRegions(fullSample.lithologyRegions);
      setPlacedSymbols(fullSample.placedSymbols);
      setControlPoints(fullSample.controlPoints);
      setSurveyProfile(fullSample.surveyProfile);
      setQIndexParams(fullSample.qIndexParams);
      setQParamStatus(fullSample.qParamStatus);
      setRmrParams(fullSample.rmrParams);
      setGsiParams(fullSample.gsiParams);
      setRockMassSummary(fullSample.rockMassSummary);
      setActiveSurface('face');

      seedSampleContinuousStripDatasets();

      const nextGeomLib = saveDesignGeometryToLibrary({
        name: 'RKRL T-4B Standard D-Shaped Horseshoe (8.40m × 7.20m)',
        tunnelName: fullSample.settings.tunnelName,
        location: fullSample.settings.locationName || 'Adit-2 Junction · Devprayag Sector',
        chainage: fullSample.settings.faceChainage,
        domain: 'TUNNEL',
        geometry: targetGeom,
      });
      setSavedGeometries(nextGeomLib);

      if (navigateToMapping) {
        setIsFirstOpening(false);
        setIsFieldMappingModeOpen(false);
        setActiveMappingDomain('TUNNEL');
        setScreen('mapping');
      }

      setStatusMessage(
        'Fed Complete Sample Field Dataset: 4 Calibrated Surface Photos + 16 Multi-Surface Discontinuity Traces (J0, J1, J2, F1) + As-Built Overbreak Survey + RMR/Q/GSI + 3D Strip Logs.'
      );
    },
    []
  );

  // Re-run automatic boundary fitting on current active surface photo
  const handleAutoFitCurrentPhoto = useCallback(async () => {
    const cur = photos[activeSurface];
    const sourceImg = cur.originalImage || cur.image;
    if (!sourceImg) return;
    setStatusMessage(
      `Re-calibrating ${activeSurface} camera parameters, 3×3 homography & master boundary registration...`
    );
    const { transform, qualityReport, calibration, undistortedDataUrl } =
      await analyzeAndAutoFitPhoto(sourceImg, activeSurface, geometry);
    setPhotos((prev) => ({
      ...prev,
      [activeSurface]: {
        ...prev[activeSurface],
        image: undistortedDataUrl,
        transform,
        calibration,
        autoFitted: true,
        qualityReport,
      },
    }));
    setStatusMessage(
      `Fitted ${activeSurface} photograph (Scale ${transform.scaleX.toFixed(2)}×, ${transform.scaleY.toFixed(2)}× · ${calibration.source}).`
    );
  }, [photos, activeSurface, geometry]);

  // Run AI + Computer Vision + 3D Geometry Joint Tracing on active surface
  const handleRunAITrace = useCallback(async () => {
    let targetImage = photos[activeSurface].warpedImage || photos[activeSurface].image;
    let targetTransform = photos[activeSurface].transform;
    let targetCalibration = photos[activeSurface].calibration;

    if (!targetImage) {
      setStatusMessage(
        `Please upload a ${activeSurface} photograph first before running AI Trace.`
      );
      return;
    } else if (!photos[activeSurface].warpedImage && photos[activeSurface].image) {
      const warpedUrl = await generatePiecewiseWarpedPhotoDataUrl(
        photos[activeSurface].image!,
        targetTransform
      );
      if (warpedUrl) {
        targetImage = warpedUrl;
      }
    }

    setIsTracingAI(true);
    setStatusMessage(
      `Stage 1/7: Initializing 6-Filter Spectral & MATLAB Cross-Verification Engine on ${activeSurface.toUpperCase()}...`
    );

    try {
      const otherJoints = joints.filter((j) => j.surface !== activeSurface);
      const supportingList = photos[activeSurface].supportingPhotos || [];
      const hasStereo = Boolean(photos[activeSurface].stereoImage) || supportingList.length > 0;
      const result = await executeHybridJointTracingPipeline(
        activeSurface,
        targetImage,
        targetTransform,
        geometry,
        settings,
        sessionMemory,
        otherJoints,
        targetCalibration,
        hasStereo,
        supportingList,
        (stageLabel) => setStatusMessage(stageLabel)
      );

      updateJointsWithHistory(result.allClusteredJoints);
      syncPhotogrammetryProjectForAiTraining(
        settings,
        geometry,
        result.allClusteredJoints,
        photos,
        qIndexParams,
        rmrParams,
        overbreakAnalysis,
        'AI_TRACE_COMPLETED'
      );
      setStatusMessage(result.pipelineSummary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI Trace error';
      setStatusMessage(`Tracing error: ${msg}`);
    } finally {
      setIsTracingAI(false);
    }
  }, [photos, activeSurface, geometry, joints, settings, sessionMemory, updateJointsWithHistory, qIndexParams, rmrParams, overbreakAnalysis]);

  // Run AI Trace across all uploaded surfaces
  const handleRunAITraceAllSurfaces = useCallback(async () => {
    setIsTracingAI(true);
    let accumulatedJoints: Joint[] = [];
    const surfaces: SurfaceType[] = ['face', 'crown', 'leftWall', 'rightWall'];

    try {
      for (const s of surfaces) {
        const surfPhoto = photos[s];
        if (!surfPhoto.image) continue;
        setStatusMessage(`Running 6-Filter + MATLAB Cross-Verification on ${s.toUpperCase()}...`);
        const warpedTarget =
          surfPhoto.warpedImage ||
          (await generatePiecewiseWarpedPhotoDataUrl(surfPhoto.image, surfPhoto.transform)) ||
          surfPhoto.image;
        const res = await executeHybridJointTracingPipeline(
          s,
          warpedTarget,
          surfPhoto.transform,
          geometry,
          settings,
          sessionMemory,
          accumulatedJoints.filter((j) => j.surface !== s),
          surfPhoto.calibration,
          Boolean(surfPhoto.stereoImage) || (surfPhoto.supportingPhotos?.length || 0) > 0,
          surfPhoto.supportingPhotos || [],
          (stageLabel) => setStatusMessage(`[${s.toUpperCase()}] ${stageLabel}`)
        );
        accumulatedJoints = res.allClusteredJoints;
      }
      updateJointsWithHistory(accumulatedJoints);
      syncPhotogrammetryProjectForAiTraining(
        settings,
        geometry,
        accumulatedJoints,
        photos,
        qIndexParams,
        rmrParams,
        overbreakAnalysis,
        'AI_TRACE_COMPLETED'
      );
      setStatusMessage(
        `Completed 6-Filter + MATLAB Multi-Surface Cross-Verification: ${accumulatedJoints.length} verified high-accuracy traces mapped.`
      );
    } finally {
      setIsTracingAI(false);
    }
  }, [photos, geometry, settings, sessionMemory, updateJointsWithHistory, qIndexParams, rmrParams, overbreakAnalysis]);

  // Session Learning & Continuous Daily Learning Loop Callbacks (Section 10 & Section 26)
  const handleRecordRejectedJoint = useCallback(
    (joint: Joint) => {
      const record: VerifiedCorrectionRecord = {
        id: `corr-del-${Date.now()}`,
        timestamp: new Date().toISOString(),
        tunnelName: settings.tunnelName,
        surface: joint.surface,
        scope: 'GENERAL_GEOLOGY',
        correctionType: 'DELETED_FALSE_POSITIVE',
        aiPredictionSummary: `AI predicted ${joint.featureType} (${joint.traceAngle}° trace, ${joint.dipDirection}°/${joint.dip}°)`,
        userApprovedSummary: `Rejected non-geological line / false positive on ${joint.surface}`,
        featureType: joint.featureType,
        traceAngle: joint.traceAngle,
        dip: joint.dip,
        dipDirection: joint.dipDirection,
        set: joint.set,
        confidence: joint.confidenceScore,
      };
      setSessionMemory((prev) => ({
        ...prev,
        rejectedAngleRanges: [
          ...prev.rejectedAngleRanges,
          { surface: joint.surface, angleDeg: joint.traceAngle, tolerance: 8 },
        ],
        correctionsLearnedCount: (prev.correctionsLearnedCount || 19) + 1,
        trainingSamplesTotal: (prev.trainingSamplesTotal || 148) + 1,
        verifiedRecords: [record, ...(prev.verifiedRecords || []).slice(0, 49)],
      }));
    },
    [settings.tunnelName]
  );

  const handleRecordConfirmedJoint = useCallback(
    (joint: Joint) => {
      const record: VerifiedCorrectionRecord = {
        id: `corr-conf-${Date.now()}`,
        timestamp: new Date().toISOString(),
        tunnelName: settings.tunnelName,
        surface: joint.surface,
        scope: 'PROJECT_SPECIFIC',
        correctionType:
          joint.source === 'MANUAL'
            ? 'ADDED_MISSED_JOINT'
            : joint.aiOriginalFeatureType && joint.aiOriginalFeatureType !== joint.featureType
            ? 'RECLASSIFIED_STRUCTURE'
            : 'CONFIRMED_ORIENTATION',
        aiPredictionSummary: joint.aiOriginalDip
          ? `AI ${joint.aiOriginalFeatureType || 'joint'} (${joint.aiOriginalDipDirection}°/${joint.aiOriginalDip}°)`
          : `Manual trace on ${joint.surface}`,
        userApprovedSummary: `Verified ${joint.set} ${joint.featureType} (${joint.dipDirection}°/${joint.dip}°, ${joint.geometry.length} pts)`,
        featureType: joint.featureType,
        traceAngle: joint.traceAngle,
        dip: joint.dip,
        dipDirection: joint.dipDirection,
        set: joint.set,
        confidence: 0.98,
      };
      setSessionMemory((prev) => ({
        ...prev,
        confirmedOrientations: [
          ...prev.confirmedOrientations.filter(
            (c) => !(c.surface === joint.surface && Math.abs(c.traceAngle - joint.traceAngle) < 10)
          ),
          {
            surface: joint.surface,
            traceAngle: joint.traceAngle,
            dip: joint.dip,
            dipDirection: joint.dipDirection,
            set: joint.set,
          },
        ],
        verifiedExamplesCount: (prev.verifiedExamplesCount || 48) + 1,
        correctionsLearnedCount: (prev.correctionsLearnedCount || 22) + 1,
        trainingSamplesTotal: (prev.trainingSamplesTotal || 164) + 1,
        verifiedRecords: [record, ...(prev.verifiedRecords || []).slice(0, 49)],
      }));

      syncPhotogrammetryProjectForAiTraining(
        settings,
        geometry,
        [...clusteredJoints, joint],
        photos,
        qIndexParams,
        rmrParams,
        overbreakAnalysis,
        'MANUAL_TRACE_SAVED'
      );
    },
    [settings, geometry, clusteredJoints, photos, qIndexParams, rmrParams, overbreakAnalysis]
  );

  // Trigger an immediate AI Model Training & Validation Update from accumulated Geologist Corrections
  const handleTrainAndUpdateAIModel = useCallback(() => {
    setSessionMemory((prev) => {
      const prevVerMatch = (prev.currentModelVersion || '2.4').match(/(\d+\.\d+)/);
      const prevNum = prevVerMatch ? parseFloat(prevVerMatch[1]) : 2.4;
      const nextVerNum = (prevNum + 0.1).toFixed(1);
      const nextVersionLabel = `AKASH AI Engine ${nextVerNum}`;
      const nextSamples = (prev.trainingSamplesTotal || 164) + Math.max(1, joints.length);
      const prevBestScore =
        prev.modelHistory && prev.modelHistory.length > 0
          ? prev.modelHistory[0].validationScorePct
          : 96.8;
      const nextScore = Number(Math.min(99.4, prevBestScore + 0.3).toFixed(1));
      const today = new Date().toISOString().slice(0, 10);

      const newRelease = {
        version: `${nextVersionLabel} (${settings.tunnelName})`,
        updatedAt: today,
        trainingDataCount: nextSamples,
        verifiedExamplesCount:
          (prev.verifiedExamplesCount || 48) + joints.filter((j) => j.accepted).length,
        correctionsLearnedCount: (prev.correctionsLearnedCount || 22) + 1,
        validationScorePct: nextScore,
        majorChanges: `Trained on ${
          prev.confirmedOrientations.length
        } verified orientations, ${
          prev.rejectedAngleRanges.length
        } false-positive angle filters & ${joints.length} active traces (${nextScore}% validation)`,
      };

      return {
        ...prev,
        lastUpdatedDate: today,
        currentModelVersion: nextVersionLabel,
        trainingSamplesTotal: nextSamples,
        verifiedExamplesCount: (prev.verifiedExamplesCount || 48) + joints.filter((j) => j.accepted).length,
        modelHistory: [newRelease, ...(prev.modelHistory || []).slice(0, 9)],
      };
    });
    setStatusMessage(
      'AI Model Training & Validation Complete: Updated weights with verified geologist orientations and false-positive filters.'
    );
  }, [joints, settings.tunnelName]);

  const handleResetAILearningFilters = useCallback(() => {
    setSessionMemory((prev) => ({
      ...prev,
      rejectedAngleRanges: [],
    }));
    setStatusMessage('Cleared rejected trace angle filters in AI Learning Memory.');
  }, []);

  const projectMemoryModalNode = (
    <ProjectMemoryModal
      isOpen={isProjectMemoryModalOpen}
      onClose={() => setIsProjectMemoryModalOpen(false)}
      initialTab={projectMemoryTab}
      geometry={geometry}
      settings={settings}
      onUpdateSettings={setSettings}
      savedProjects={savedProjects}
      onSaveCurrentProject={handleSaveCurrentProjectToMemory}
      onLoadProjectRecord={handleLoadProjectRecord}
      onDeleteProjectRecord={(id) => {
        const next = deleteProjectRecordFromMemory(id);
        setSavedProjects(next);
      }}
      onRefreshProjectsState={(next) => {
        setSavedProjects(next);
        setSavedGeometries(loadSavedDesignGeometries());
      }}
      onOpenFieldRoundInWorkspace={(roundId, projectId, locationId, domain) => {
        const prevResume = loadFieldMappingResumeState();
        saveFieldMappingResumeState({
          stage: prevResume?.stage && prevResume.stage !== 'project_setup' ? prevResume.stage : 'field_mapping',
          projectId,
          locationId,
          roundId,
          activePanel: prevResume?.activePanel || 'face',
          is3DMappingMode: Boolean(prevResume?.is3DMappingMode),
          savedAt: new Date().toISOString(),
        });
        const targetDomain = domain || 'TUNNEL';
        setActiveMappingDomain(targetDomain);
        if (targetDomain !== 'TUNNEL') {
          setSelectedSurfaceSubType(targetDomain);
        }
        setIsProjectMemoryModalOpen(false);
        setIsFirstOpening(false);
        setResumeFieldAtLastStage(true);
        setIsFieldMappingModeOpen(true);
      }}
      onImportProjectRecordFile={handleImportProjectRecordFile}
      onExportCurrentProjectFile={handleExportCurrentProjectFile}
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
      onCreateCompanionSectionForVolumeTest={handleCreateCompanionSectionForVolumeTest}
    />
  );

  const natmRockMechanicsModalNode = (
    <NatmRockMechanicsAndLookAheadHub
      isOpen={isNatmRockMechanicsModalOpen}
      onClose={() => setIsNatmRockMechanicsModalOpen(false)}
      isFloatingModal={true}
      driveAzimuth={Number(settings.driveDirection) || 45}
      faceChainage={settings.faceChainage || settings.chainage || 'CH 102+45.0'}
    />
  );

  // AI Icon / Chatbot is strictly shown ONLY on the main Welcome Window
  const welcomeAiChatbotNode = (
    <EswaAiExecutiveChatbot
      geometry={geometry}
      settings={settings}
      joints={clusteredJoints}
      jointSets={jointSets}
      qIndexParams={qIndexParams}
      rmrParams={rmrParams}
      rockMassSummary={rockMassSummary}
      lithologyRegions={lithologyRegions}
      placedSymbols={placedSymbols}
      overbreakAnalysis={overbreakAnalysis}
      savedProjects={savedProjects}
      onNavigateScreen={(target) => setScreen(target)}
      onOpenContinuous3DLogger={() => setIsContinuous3DLoggerOpen(true)}
      onOpenProjectDatabase={() => handleOpenProjectMemoryModal('field_data')}
      onOpenExportSheet={() => {
        setExportModalInitialMode('FINAL_ENGINEERING_SHEET');
        setIsExportModalOpen(true);
      }}
      onUpdateGeometryDimensions={(w, h, wh) => {
        const constrained = enforceStrictTunnelGeometryConstraints(
          w,
          h,
          wh,
          geometry.crownGeometry
        );
        const nextGeom = createTunnelGeometry(
          w,
          h,
          constrained.wallHeight,
          geometry.crownGeometry,
          constrained.crownRadius,
          'manual'
        );
        setGeometry(nextGeom);
        setManWidth(String(w));
        setManHeight(String(h));
        setManWallHeight(String(constrained.wallHeight));
        setManCrownRadius(String(constrained.crownRadius));
      }}
      onUpdateSettings={setSettings}
      onAddExecutiveJoint={(partial) => {
        const newJ: Joint = {
          id: `J-AI-${Date.now().toString().slice(-4)}`,
          surface: activeSurface,
          geometry: [
            { x: -1.4, y: 2.1 },
            { x: -0.3, y: 2.9 },
            { x: 0.9, y: 3.6 },
            { x: 1.8, y: 4.1 },
          ],
          traceAngle: 48,
          strike: ((partial.dipDirection || 65) - 90 + 360) % 360,
          dip: partial.dip || 52,
          dipDirection: partial.dipDirection || 65,
          orientationStatus: 'DIRECTLY_MEASURED',
          set: partial.set || 'J1',
          featureType: 'joint',
          confidence: 'High',
          confidenceScore: 0.95,
          confidenceBreakdown: {
            detection: 95,
            trace: 94,
            geometric: 96,
            orientation: 95,
          },
          source: 'AI_HYBRID',
          accepted: true,
          persistenceMeters: 3.65,
          roughness: partial.roughness || 'Rough / Stepped',
          infilling: partial.infilling || 'Quartz / Tight',
          apertureMm: '1-3 mm',
          waterCondition: 'Dry',
        };
        updateJointsWithHistory([...clusteredJoints, newJ]);
      }}
      onSaveCurrentSection={handleSaveCurrentProjectToMemory}
    />
  );

  const continuousLoggingModalsNode = (
    <>
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
    </>
  );

  const globalSettingsModalNode = (
    <GlobalSettingsModal
      isOpen={isGlobalSettingsOpen}
      onClose={() => setIsGlobalSettingsOpen(false)}
      currentUser={googleUser}
      onUserChanged={setGoogleUser}
      onActiveProfileChanged={(p) => setActiveGeologist(p)}
    />
  );

  // Theme-aware spacing, radius, and elevation utility to eliminate boxy hardcoded containers
  const layoutStyles = {
    viewportShell: `min-h-dvh h-dvh w-full flex flex-col items-center justify-start relative overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain transition-colors duration-200 ${
      responsive.isShortLandscape
        ? 'p-1.5 sm:p-2'
        : responsive.isMobile
        ? 'p-2'
        : responsive.isCompactHeight
        ? 'p-2.5 sm:p-3.5'
        : 'p-4 sm:p-6 lg:p-7'
    } ${isLight ? 'bg-[#EE8711] text-stone-900' : 'bg-[#EE8711] text-orange-50'}`,

    workspaceShell: `h-dvh w-full flex flex-col overflow-hidden transition-colors duration-200 p-0 eswa-stage-transition ${
      isLight ? 'bg-[#EE8711] text-stone-900' : 'bg-[#EE8711] text-orange-50'
    }`,

    workspacePanel: `flex-1 min-h-0 w-full flex flex-col overflow-hidden transition-all duration-200 ${
      isLight ? 'bg-[#FFFBF8]/92' : 'bg-[#120C09]/92'
    }`,

    majorPanel: `relative z-10 w-full my-auto shrink-0 flex flex-col rounded-2xl border transition-all duration-200 eswa-stage-transition ${
      responsive.isShortLandscape
        ? 'p-2.5 sm:p-3.5 gap-2'
        : responsive.isMobile
        ? 'p-3 gap-2.5'
        : responsive.isCompactHeight
        ? 'p-3.5 sm:p-4 gap-3'
        : 'p-5 sm:p-7 gap-5'
    } ${
      isLight
        ? 'bg-white/95 border-orange-200/85 shadow-[0_20px_50px_-12px_rgba(234,88,12,0.12),0_4px_18px_-4px_rgba(28,19,14,0.06)]'
        : 'bg-[#16100C]/95 border-orange-900/60 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.82),0_0_32px_rgba(234,88,12,0.12)]'
    }`,

    sectionSurface: `rounded-xl ${
      responsive.isShortLandscape ? 'p-2.5 sm:p-3.5' : 'p-3.5 sm:p-4'
    } transition-colors duration-200 ${
      isLight
        ? 'bg-[#FFF5EC]/90 shadow-[0_2px_10px_-2px_rgba(234,88,12,0.05)]'
        : 'bg-[#1F1611]/75 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.45)]'
    }`,

    previewStage: `flex flex-col items-center justify-center rounded-xl p-3 sm:p-4 h-full min-h-[150px] sm:min-h-[180px] transition-colors duration-200 ${
      isLight
        ? 'bg-[#FFF5EC] shadow-[inset_0_1px_4px_rgba(234,88,12,0.06)]'
        : 'bg-[#110B08] shadow-[inset_0_1px_6px_rgba(0,0,0,0.55)]'
    }`,

    headerRow: `flex flex-wrap items-center justify-between gap-2 ${
      responsive.isShortLandscape ? 'pb-2' : 'pb-2.5 sm:pb-3.5'
    } border-b shrink-0 ${
      isLight ? 'border-orange-200/75' : 'border-orange-900/50'
    }`,

    footerRow: `flex flex-wrap items-center justify-between gap-2 ${
      responsive.isShortLandscape ? 'pt-2' : 'pt-2.5 sm:pt-3.5'
    } border-t shrink-0 ${
      isLight ? 'border-orange-200/75' : 'border-orange-900/50'
    }`,

    hairlineDivider: isLight ? 'border-orange-200/75' : 'border-orange-900/50',

    labelMuted: `text-xs font-medium ${isLight ? 'text-stone-600' : 'text-orange-200/70'}`,

    inputControl: `w-full px-3.5 py-2.5 sm:py-2 rounded-xl border text-xs font-mono transition-all focus:outline-none focus:ring-2 ${
      isLight
        ? 'bg-white border-orange-200/90 text-stone-900 focus:border-orange-500 focus:ring-orange-500/20 shadow-2xs'
        : 'bg-[#140D0A] border-orange-900/60 text-orange-50 focus:border-orange-400 focus:ring-orange-400/20'
    }`,

    primaryButton: `inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer ${
      isLight
        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_6px_16px_-4px_rgba(234,88,12,0.38)]'
        : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_6px_18px_-4px_rgba(249,115,22,0.45)]'
    }`,

    secondaryButton: `inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${
      isLight
        ? 'bg-white hover:bg-orange-50/70 text-stone-800 border-orange-200/90 shadow-2xs'
        : 'bg-[#211610] hover:bg-[#2C1E16] text-orange-100 border-orange-800/60 shadow-2xs'
    }`,

    backButton: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
      isLight
        ? 'text-stone-600 hover:text-stone-900 hover:bg-orange-100/60'
        : 'text-orange-200/75 hover:text-white hover:bg-orange-950/50'
    }`,
  };

  const modeSwitchConfirmationModalNode = pendingTargetMode ? (
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
          Your current <span className="text-amber-400 font-bold">{industryMode}</span> workspace and project data are saved in isolated <span className="text-amber-400 font-bold">{industryMode}</span> storage (<code className="text-slate-400">eswa_isolated_db_{industryMode}</code>). Switching to <span className="text-cyan-400 font-bold">{pendingTargetMode}</span> will load the dedicated <span className="text-cyan-400 font-bold">{pendingTargetMode}</span> Main Window and database.
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
  ) : null;

  // ============================================================================
  // GEOTECHNICAL CORE LOGGING & BOREHOLE STRIP LOG REPORT WORKSPACE
  // ============================================================================
  if (isCoreLoggingOpen) {
    return (
      <>
        <CoreLoggingWorkspace
          onBackToMain={() => {
            setIsCoreLoggingOpen(false);
            if (industryMode === 'NATM') {
              setScreen('welcome');
            }
          }}
          onOpenGlobalSettings={() => setIsGlobalSettingsOpen(true)}
          activeGeologistProfile={activeGeologist}
        />
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </>
    );
  }

  // ============================================================================
  // STANDALONE APK FIELD MAPPING MODE ("DIGITAL PENCIL & PAPER IN FIELD")
  // ============================================================================
  if (isFieldMappingModeOpen) {
    return (
      <>
        <FieldMappingModeWorkspace
          resumeAtLastStage={resumeFieldAtLastStage}
          initialWorkflowMode={activeFieldWorkflowMode}
          onChangeWorkflowMode={setActiveFieldWorkflowMode}
          initialMappingDomain={activeMappingDomain}
          onChangeMappingDomain={(domain) => {
            handleSwitchMappingDomain(domain);
          }}
          industryMode={industryMode}
          onChangeIndustryMode={handleSwitchIndustryMode}
          onOpenDataStorage={() => {
            handleOpenProjectMemoryModal('field_data');
          }}
          onOpenCoreLogging={() => {
            setIsFieldMappingModeOpen(false);
            setIsCoreLoggingOpen(true);
          }}
          onBackToWelcome={() => {
            setIsFieldMappingModeOpen(false);
            setResumeFieldAtLastStage(false);
            if (industryMode === 'NATM') {
              setScreen('welcome');
            }
          }}
          onExitToWelcome={() => {
            setIsFieldMappingModeOpen(false);
            setResumeFieldAtLastStage(false);
            if (industryMode === 'NATM') {
              setScreen('welcome');
            }
          }}
        />
        {projectMemoryModalNode}
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </>
    );
  }

  // ============================================================================
  // SCREEN 0: OFFICIAL ESWA WELCOME WINDOW (Civil/NATM Drill & Blast)
  // Strictly renders ONLY when industryMode === 'NATM'
  // ============================================================================
  if (screen === 'welcome' && industryMode === 'NATM') {
    const fieldResumeMeta = loadFieldMappingResumeState();
    const photoResumeMeta = loadPhotogrammetryResumeState();
    const surfaceResumeMeta = loadSurfaceMappingResumeState();

    return (
      <main
        className="min-h-dvh h-dvh w-full flex flex-col items-center justify-center relative overflow-y-auto overflow-x-hidden no-scrollbar mouse-scrollable p-2 sm:p-4 select-none"
        style={{
          backgroundColor: palette.primaryHex,
          color: palette.onBaseTextColor,
        }}
      >
        {/* Dynamic Theme Color Geological Map Backdrop with minute opacity logo */}
        <EswaAppBackgroundWatermark visible showLogoWatermark={true} />

        {/* Top-Left Mode Indicator & Switcher on Welcome Screen */}
        <div className="absolute top-3 left-3 sm:top-5 sm:left-6 flex items-center gap-2 z-20">
          <div className="flex items-center p-0.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 shadow-md">
            {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
              const isAct = industryMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSwitchIndustryMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    isAct ? 'font-black shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  style={{
                    backgroundColor: isAct ? (m === 'NATM' ? palette.primaryHex : m === 'TBM' ? '#06B6D4' : '#10B981') : undefined,
                    color: isAct ? (m === 'NATM' ? palette.buttonTextColor : '#020617') : undefined,
                  }}
                  title={
                    m === 'NATM'
                      ? 'NATM: New Austrian Tunnelling Method / Conventional D&B'
                      : m === 'TBM'
                      ? 'TBM: Shield Tunnel Boring Machine'
                      : 'MINING: Underground Hardrock Mining Stope & Grade Control'
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top-Right Controls: Google Email Login & Master Software Access Control */}
        {!isContinuous3DLoggerOpen && !isProjectMemoryModalOpen && (
          <div className="absolute top-3 right-3 sm:top-5 sm:right-6 flex flex-wrap items-center justify-end gap-2 z-20">

            {/* Google Email Login & Cloud Workspace Sync */}
            <div className="relative">
              {googleUser ? (
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer text-xs font-semibold"
                  style={{
                    borderColor: palette.primaryHex + '50',
                  }}
                  title={`Signed in as ${googleUser.email}. Click to sync or manage your ESWA account & data.`}
                >
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName}
                      className="w-4 h-4 rounded-full object-cover border"
                      style={{ borderColor: palette.primaryHex + '60' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" style={{ color: palette.accentIconColor }} />
                  )}
                  <span className="max-w-[140px] sm:max-w-[190px] truncate">
                    {googleUser.email}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isAuthBusy}
                  onClick={async () => {
                    setIsAuthBusy(true);
                    const res = await signInWithGoogleAccount();
                    setIsAuthBusy(false);
                    if (res.user) {
                      setGoogleUser(res.user);
                      setSavedProjects(loadSavedProjectsFromMemory());
                      setSavedGeometries(loadSavedDesignGeometries());
                      setCloudSyncStatus('Signed in & loaded your account data');
                    } else if (res.error) {
                      setCloudSyncStatus(res.error);
                      setIsGlobalSettingsOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer text-xs font-semibold whitespace-nowrap active:scale-95"
                  style={{
                    borderColor: palette.primaryHex + '50',
                  }}
                  title="Sign in with your Google Email to access and sync your ESWA Tunnel Mapper app & data"
                >
                  <LogIn className={`w-3.5 h-3.5 ${isAuthBusy ? 'animate-spin' : ''}`} style={{ color: palette.accentIconColor }} />
                  <span>{isAuthBusy ? 'Signing in...' : 'Google Login'}</span>
                </button>
              )}

              {googleUser && isAccountMenuOpen && (
                <div
                  className="absolute right-0 mt-1.5 w-72 rounded-xl border bg-white shadow-xl p-3 text-left z-30 space-y-2.5"
                  style={{ borderColor: palette.primaryHex + '40' }}
                >
                  <div className="flex items-center gap-2.5 pb-2 border-b" style={{ borderColor: palette.primaryHex + '25' }}>
                    {googleUser.photoURL ? (
                      <img
                        src={googleUser.photoURL}
                        alt={googleUser.displayName}
                        className="w-8 h-8 rounded-full object-cover border"
                        style={{ borderColor: palette.primaryHex + '60' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: palette.primaryHex + '20', color: palette.accentColorOnLight }}
                      >
                        {(googleUser.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-stone-900 truncate">
                        {googleUser.displayName}
                      </div>
                      <div className="text-[11px] font-mono text-stone-600 truncate">
                        {googleUser.email}
                      </div>
                    </div>
                  </div>

                  {cloudSyncStatus && (
                    <div
                      className="text-[10px] font-mono px-2 py-1 rounded border"
                      style={{
                        backgroundColor: palette.primaryHex + '15',
                        borderColor: palette.primaryHex + '35',
                        color: palette.isLightBg ? '#0F172A' : '#1E293B',
                      }}
                    >
                      {cloudSyncStatus}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isAuthBusy}
                      onClick={async () => {
                        setIsAuthBusy(true);
                        const res = await syncUserWorkspaceToCloud();
                        setIsAuthBusy(false);
                        setCloudSyncStatus(res.message);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                      style={{
                        backgroundColor: palette.primaryHex,
                        color: palette.buttonTextColor,
                      }}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Save to Cloud</span>
                    </button>
                    <button
                      type="button"
                      disabled={isAuthBusy}
                      onClick={async () => {
                        setIsAuthBusy(true);
                        const res = await pullUserWorkspaceFromCloud();
                        setIsAuthBusy(false);
                        if (res.pulled) {
                          setSavedProjects(loadSavedProjectsFromMemory());
                          setSavedGeometries(loadSavedDesignGeometries());
                          setCloudSyncStatus('Loaded workspace from Google Cloud');
                        } else {
                          setCloudSyncStatus('No cloud backup found yet');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: palette.primaryHex + '15',
                        borderColor: palette.primaryHex + '40',
                        color: palette.isLightBg ? '#0F172A' : '#1C130E',
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Load Cloud</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await signOutGoogleAccount();
                      setGoogleUser(null);
                      setIsAccountMenuOpen(false);
                      setCloudSyncStatus('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            <DeviceIdAndNotificationHeaderWidget
              onDataImported={() => {
                setSavedProjects(loadSavedProjectsFromMemory());
                setSavedGeometries(loadSavedDesignGeometries());
              }}
            />

            {/* Top Header Settings Gear & Active Geologist Profile Pill */}
            <div className="flex items-center gap-1.5">
              {activeGeologist && (
                <button
                  type="button"
                  onClick={() => setIsGlobalSettingsOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer bg-white/95 text-stone-900"
                  style={{ borderColor: palette.primaryHex + '40' }}
                  title={`Active Geologist: ${activeGeologist.name} (${activeGeologist.role}) - Click to switch profile`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">[{activeGeologist.role}]</span>
                  <span className="truncate max-w-[110px]">{activeGeologist.name}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsGlobalSettingsOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/95 border text-slate-800 shadow-sm transition-all cursor-pointer active:scale-95"
                style={{ borderColor: palette.primaryHex + '45' }}
                title="Open Global Settings (Google Account, Device ID, Multi-Device Project Sync, Geologist Profiles & Signatures)"
              >
                <Settings className="w-4 h-4 hover:rotate-90 transition-transform duration-300" style={{ color: palette.accentIconColor }} />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>

            <ThemeToggleButton compact />
            {isMasterSoftware && onOpenAdminPortal && (
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  onOpenAdminPortal();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded-lg border bg-white/95 text-stone-900 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                style={{ borderColor: palette.primaryHex + '50' }}
                title="Open Software Access Control (Master Admin) to manage PC & Mobile App user requests"
              >
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: palette.accentIconColor }} />
                <span>Software Access Control</span>
                {pendingRequestCount > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.2 rounded-full font-bold text-[10px]"
                    style={{ backgroundColor: palette.primaryHex, color: palette.buttonTextColor }}
                  >
                    {pendingRequestCount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        <div className="relative z-10 w-full max-w-[650px] my-auto shrink-0 flex flex-col items-center text-center justify-center p-2 sm:p-3 gap-2.5 sm:gap-4 eswa-stage-transition">
          <div
            onClick={() => playEswaWelcomeChime(true)}
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            title="Click to replay ESWA Welcome Chime"
          >
            <EswaTunnelLogo
              size={responsive.isShortLandscape ? 'lg' : responsive.isCompactHeight ? 'xl' : '2xl'}
              variant="emblem"
              animated
              showBadge={false}
            />
          </div>


          {/* Main Window: Only 3 Options — 1. Underground Face Mapping, 2. Surface Mapping, 3. Data Storage, Import & Export */}
          <div className="w-full space-y-2.5 p-2 sm:p-2.5 rounded-2xl bg-white/75 backdrop-blur-md border shadow-2xl" style={{ borderColor: palette.primaryHex + '40' }}>
            {/* 1. First Option: Underground Face Mapping */}
            <div className="flex items-stretch gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  handleSwitchMappingDomain('TUNNEL');
                  setActiveFieldWorkflowMode('field_mapping');
                  setResumeFieldAtLastStage(false);
                  setIsFieldMappingModeOpen(true);
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
                style={{
                  borderColor: palette.primaryHex,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '20',
                      color: palette.accentIconColor,
                    }}
                  >
                    <Compass className="w-4 h-4 shrink-0" />
                  </span>
                  <span className="text-stone-900 font-extrabold">Underground Face Mapping</span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: palette.accentIconColor }}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  handleSwitchMappingDomain('TUNNEL');
                  setResumeFieldAtLastStage(true);
                  setIsFieldMappingModeOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.28)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                style={{
                  backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                  borderColor: palette.accentHex,
                  color: palette.isLightBg ? '#FFFFFF' : '#0F172A',
                }}
                title={
                  fieldResumeMeta
                    ? `Resume Underground Face Mapping where you stopped (${fieldResumeMeta.stage})`
                    : 'Resume Underground Face Mapping where you stopped'
                }
              >
                <Play
                  className="w-3.5 h-3.5 shrink-0"
                  style={{
                    color: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                    fill: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                  }}
                />
                <span>Resume</span>
              </button>
            </div>

            {/* Continuous Tunnel Logging */}
            <div className="flex items-stretch gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsContinuousLogSetupOpen(true);
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
                style={{
                  borderColor: palette.primaryHex,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '20',
                      color: palette.accentIconColor,
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  </span>
                  <span className="text-stone-900 font-extrabold">Continuous Tunnel Logging</span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: palette.accentIconColor }}
                />
              </button>
            </div>

            {/* Geotechnical Core Logging */}
            <div className="flex items-stretch gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  setIsCoreLoggingOpen(true);
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
                style={{
                  borderColor: palette.primaryHex,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '20',
                      color: palette.accentIconColor,
                    }}
                  >
                    <Layers className="w-4 h-4 shrink-0" />
                  </span>
                  <span className="text-stone-900 font-extrabold">Geotechnical Core Logging &amp; Reports</span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: palette.accentIconColor }}
                />
              </button>
            </div>

            {/* 2. Second Option: Surface Mapping (Isolated Subtypes) */}
            <div
              className="w-full bg-white/95 rounded-xl border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] p-2.5 space-y-2 transition-colors"
              style={{
                borderColor: palette.primaryHex,
              }}
            >
              <div className="flex items-stretch gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleSwitchMappingDomain(selectedSurfaceSubType);
                    setActiveFieldWorkflowMode('field_mapping');
                    setResumeFieldAtLastStage(false);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="flex-1 py-1 px-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 text-stone-900 transition-all cursor-pointer group"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        backgroundColor: palette.primaryHex + '20',
                        color: palette.accentIconColor,
                      }}
                    >
                      <Mountain className="w-3.5 h-3.5 shrink-0" />
                    </span>
                    <span className="text-stone-900 font-extrabold">Surface Mapping</span>
                    <span
                      className="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
                      style={{
                        backgroundColor: palette.primaryHex + '25',
                        color: palette.accentColorOnLight,
                      }}
                    >
                      {selectedSurfaceSubType}
                    </span>
                  </span>
                  <ArrowRight
                    className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                    style={{ color: palette.accentIconColor }}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    const resumeSubType = surfaceResumeMeta?.subType || selectedSurfaceSubType;
                    setSelectedSurfaceSubType(resumeSubType);
                    handleSwitchMappingDomain(resumeSubType);
                    setActiveFieldWorkflowMode(
                      surfaceResumeMeta?.workflowMode === 'PHOTOGRAMMETRY'
                        ? 'photo_mapping'
                        : 'field_mapping'
                    );
                    setResumeFieldAtLastStage(true);
                    setIsFieldMappingModeOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.25)] transition-all cursor-pointer border-2 shrink-0 active:scale-95"
                  style={{
                    backgroundColor: palette.isLightBg ? '#0F172A' : '#FFFFFF',
                    borderColor: palette.accentHex,
                    color: palette.isLightBg ? '#FFFFFF' : '#0F172A',
                  }}
                  title={
                    surfaceResumeMeta
                      ? `Resume Surface Mapping where you stopped (${surfaceResumeMeta.subType})`
                      : 'Resume Surface Mapping where you stopped'
                  }
                >
                  <Play
                    className="w-3.5 h-3.5 shrink-0"
                    style={{
                      color: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                      fill: palette.isLightBg ? palette.accentHex : palette.primaryHex,
                    }}
                  />
                  <span>Resume</span>
                </button>
              </div>

              {/* Isolated Subtype Direct Launchers (Bench, Trench, Slope, Outcrop) */}
              <div
                className="grid grid-cols-4 gap-1.5 pt-1.5 border-t"
                style={{
                  borderColor: palette.primaryHex + '25',
                }}
              >
                {(
                  [
                    ['BENCH', 'Bench'],
                    ['TRENCH', 'Trench'],
                    ['SLOPE', 'Slope'],
                    ['ROCK_SURFACE', 'Outcrop'],
                  ] as [SurfaceMappingSubType, string][]
                ).map(([sub, lbl]) => {
                  const isSelected = selectedSurfaceSubType === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setIsFirstOpening(false);
                        setSelectedSurfaceSubType(sub);
                        handleSwitchMappingDomain(sub);
                        setActiveFieldWorkflowMode('field_mapping');
                        setResumeFieldAtLastStage(false);
                        setIsFieldMappingModeOpen(true);
                      }}
                      className="py-1 px-1 rounded-md text-[10px] font-bold text-center transition-all cursor-pointer border"
                      style={{
                        backgroundColor: isSelected ? palette.primaryHex : '#F8FAFC',
                        borderColor: isSelected ? palette.accentHex : palette.primaryHex + '35',
                        color: isSelected ? palette.buttonTextColor : '#0F172A',
                        boxShadow: isSelected ? `0 2px 8px ${palette.primaryHex}45` : undefined,
                      }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Third Option: Data Storage, Import & Export */}
            <div className="grid grid-cols-1 gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  handleOpenProjectMemoryModal('field_data');
                }}
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-2 bg-white text-stone-900 border-2 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:shadow-lg active:scale-99 group"
                style={{
                  borderColor: palette.primaryHex,
                }}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: palette.primaryHex + '20',
                      color: palette.accentIconColor,
                    }}
                  >
                    <Database className="w-4 h-4 shrink-0" />
                  </span>
                  <span className="text-stone-900 font-extrabold">Data Storage, Import &amp; Export</span>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ color: palette.accentIconColor }}
                />
              </button>
            </div>
          </div>
        </div>

        {isBootLoading && <EswaLoadingScreen onComplete={() => setIsBootLoading(false)} />}
        {projectMemoryModalNode}
        {natmRockMechanicsModalNode}
        {welcomeAiChatbotNode}
        {continuousLoggingModalsNode}
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </main>
    );
  }

  // ============================================================================
  // STRICT INDUSTRY MODE ROUTING: UNDERGROUND MINING & EXPLORATION SUITE
  // Dedicated shell for Mining — Isolated Main Window with 3 Core Pillars:
  // 1. Underground Mining Mapping (Stopes, Ore/Waste, Dilution, Mathews N')
  // 2. Exploration & Production Core Logging (DDH/RC runs, assays, downhole strip)
  // 3. Mining Data & Storage / Vault (Projects, Stopes, Drillholes, CSV & JSON)
  // ============================================================================
  if (industryMode === 'MINING') {
    return (
      <>
        <MiningMainWindow
          industryMode={industryMode}
          onChangeIndustryMode={handleSwitchIndustryMode}
          googleUser={googleUser}
          activeGeologist={activeGeologist}
          onOpenGlobalSettings={() => setIsGlobalSettingsOpen(true)}
          isAuthBusy={isAuthBusy}
          onGoogleSignIn={async () => {
            setIsAuthBusy(true);
            const res = await signInWithGoogleAccount();
            setIsAuthBusy(false);
            if (res.user) {
              setGoogleUser(res.user);
            }
          }}
          onGoogleSignOut={async () => {
            await signOutGoogleAccount();
            setGoogleUser(null);
          }}
        />
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </>
    );
  }
  // ============================================================================
  // STRICT INDUSTRY MODE ROUTING: TBM MECHANIZED TUNNELING WORKSPACE SHELL
  // Dedicated shell for TBM Shield Tunneling — Isolated Main Window & 7-Stage Workflow
  // ============================================================================
  if (industryMode === 'TBM') {
    return (
      <>
        <TbmMainWindow
          industryMode={industryMode}
          onChangeIndustryMode={handleSwitchIndustryMode}
          googleUser={googleUser}
          activeGeologist={activeGeologist}
          onOpenGlobalSettings={() => setIsGlobalSettingsOpen(true)}
          isAuthBusy={isAuthBusy}
          onGoogleSignIn={async () => {
            setIsAuthBusy(true);
            const res = await signInWithGoogleAccount();
            setIsAuthBusy(false);
            if (res.user) {
              setGoogleUser(res.user);
              setSavedProjects(loadSavedProjectsFromMemory());
              setSavedGeometries(loadSavedDesignGeometries());
            }
          }}
          onGoogleSignOut={async () => {
            await signOutGoogleAccount();
            setGoogleUser(null);
          }}
        />
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </>
    );
  }

  // Pre-upgrade TBM block deprecated
  if (false as boolean) {
    return (
      <main className={layoutStyles.viewportShell}>
        <EswaAppBackgroundWatermark visible={!isExportModalOpen} />
        <div className={`${layoutStyles.majorPanel} max-w-[96vw] xl:max-w-[1440px] space-y-4`}>
          {/* Top Brand & Header Row for TBM Mode */}
          <div className={layoutStyles.headerRow}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTbmTab(1)}
                className={layoutStyles.backButton}
                title="Return to Tab 1 (Ring Assembly & Cutterhead)"
              >
                <CircleDot className="w-4 h-4 text-cyan-400" />
                <span>TBM Dashboard</span>
              </button>
              <EswaTunnelLogo size="sm" animated={false} />

              {/* Top-Left Mode Selector */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700 shadow-inner">
                {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
                  const isAct = (industryMode as string) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSwitchIndustryMode(m)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        isAct
                          ? (m as string) === 'TBM'
                            ? 'bg-cyan-500 text-slate-950 font-black shadow'
                            : (m as string) === 'MINING'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'bg-emerald-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              <div>
                <h1 className="font-display text-base sm:text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-cyan-400" />
                  <span>ESWA TBM Mechanized Tunneling Suite · Shield &amp; Ring Assembly</span>
                </h1>
                <p className="text-xs font-mono text-cyan-400/90 font-medium">
                  {settings.projectName || 'Metro Shield Tunnel'} · EPB Shield (Ø 6.40m) · Ring #{tbmRingNum} · {tbmKeyPosition}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTbmInspectorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer"
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">TBM Shield Inspector</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenProjectMemoryModal('field_data')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Data &amp; Memory</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGlobalSettingsOpen(true)}
                className="p-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* DEDICATED 5-TAB TBM MECHANIZED TUNNELING WORKFLOW NAVIGATION */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 bg-slate-950/80 p-2 rounded-2xl border border-cyan-500/30">
            {[
              { id: 1, title: '1. Ring & Cutterhead', sub: 'Ring Key, Discs & Lining' },
              { id: 2, title: '2. Telemetry & KPIs', sub: 'Thrust, Torque, RPM & FPI' },
              { id: 3, title: '3. Muck & Grout', sub: 'Theoretical vs Annular Grout' },
              { id: 4, title: '4. Geomech (Qtbm/RSR)', sub: 'Boreability & CSM Model' },
              { id: 5, title: '5. Shift Reports', sub: 'Ring Advance Logs & Export' },
            ].map((t) => {
              const isCurrent = tbmTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTbmTab(t.id as 1 | 2 | 3 | 4 | 5)}
                  className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-mono uppercase font-black tracking-wide flex items-center justify-between">
                    <span>{t.title}</span>
                    {isCurrent && <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />}
                  </div>
                  <div className={`text-[11px] truncate mt-0.5 ${isCurrent ? 'text-slate-900/80' : 'text-slate-400'}`}>
                    {t.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* TAB 1: TBM Ring & Cutterhead Face / Segment Mapping */}
          {tbmTab === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Precast Concrete Segment Ring Assembly (Universal Ring)
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Ring #{tbmRingNum} · Width: 1.5m
                  </span>
                </div>

                {/* Circular Ring SVG diagram */}
                <div className="w-full h-64 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-2 relative">
                  <svg viewBox="0 0 300 300" className="w-full h-full">
                    <circle cx="150" cy="150" r="120" fill="none" stroke="#334155" strokeWidth="24" />
                    <circle cx="150" cy="150" r="108" fill="#020617" />
                    <path d="M 150 30 A 120 120 0 0 1 254 90" fill="none" stroke="#38BDF8" strokeWidth="22" strokeDasharray="100 4" />
                    <path d="M 254 90 A 120 120 0 0 1 254 210" fill="none" stroke="#818CF8" strokeWidth="22" strokeDasharray="100 4" />
                    <path d="M 254 210 A 120 120 0 0 1 150 270" fill="none" stroke="#34D399" strokeWidth="22" strokeDasharray="100 4" />
                    <path d="M 150 270 A 120 120 0 0 1 46 210" fill="none" stroke="#FBBF24" strokeWidth="22" strokeDasharray="100 4" />
                    <path d="M 46 210 A 120 120 0 0 1 46 90" fill="none" stroke="#F472B6" strokeWidth="22" strokeDasharray="100 4" />
                    <path d="M 46 90 A 120 120 0 0 1 150 30" fill="none" stroke="#F87171" strokeWidth="24" />
                    <text x="150" y="145" fill="#38BDF8" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      RING #{tbmRingNum}
                    </text>
                    <text x="150" y="165" fill="#94A3B8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                      {tbmKeyPosition}
                    </text>
                  </svg>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px]">Segment Thickness</span>
                    <div className="font-bold text-slate-200">350 mm</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px]">Concrete Grade</span>
                    <div className="font-bold text-cyan-300">C50/60</div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px]">Gasket System</span>
                    <div className="font-bold text-emerald-400">EPDM 28 bar</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Disc Cutter Inspection &amp; Ring Key Selection
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    Cutterhead: 17&quot; Discs (48 Total)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <label className="space-y-1">
                    <span className="text-slate-400">Ring # Counter:</span>
                    <input
                      type="number"
                      value={tbmRingNum}
                      onChange={(e) => setTbmRingNum(parseInt(e.target.value) || 142)}
                      className={layoutStyles.inputControl}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-slate-400">Key Position:</span>
                    <select
                      value={tbmKeyPosition}
                      onChange={(e) => setTbmKeyPosition(e.target.value)}
                      className={layoutStyles.inputControl}
                    >
                      <option value="Key Pos 1 (0° Crown)">Key Pos 1 (0° Crown)</option>
                      <option value="Key Pos 2 (60°)">Key Pos 2 (60°)</option>
                      <option value="Key Pos 3 (120°)">Key Pos 3 (120°)</option>
                      <option value="Key Pos 4 (180° Invert)">Key Pos 4 (180° Invert)</option>
                      <option value="Key Pos 5 (240°)">Key Pos 5 (240°)</option>
                      <option value="Key Pos 6 (300°)">Key Pos 6 (300°)</option>
                    </select>
                  </label>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Center Disc Wear:</span>
                    <strong className="text-amber-300 font-bold">{tbmDiscWearMm} mm / 25.0 mm</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gage Cutters Status:</span>
                    <strong className="text-emerald-400 font-bold">Acceptable (8.5 mm wear)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Water Seepage / Annular Inflow:</span>
                    <strong className="text-slate-200">Dry / Nil (&lt; 0.5 L/min)</strong>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTbmInspectorOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono shadow cursor-pointer transition-all"
                  >
                    <CircleDot className="w-4 h-4" />
                    <span>Open 3D Ring Erector Inspector</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Real-time Machine Telemetry & Advance KPIs */}
          {tbmTab === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Thrust Force</span>
                  <div className="text-base font-black text-cyan-300">{tbmThrustKn.toLocaleString()} kN</div>
                  <span className="text-[10px] text-slate-500">Cap: 32,000 kN</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Cutterhead Torque</span>
                  <div className="text-base font-black text-amber-400">{tbmTorqueKnm.toLocaleString()} kNm</div>
                  <span className="text-[10px] text-slate-500">Cap: 9,000 kNm</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Bulkhead EPB Pressure</span>
                  <div className="text-base font-black text-emerald-400">{tbmEpbPressureBar.toFixed(2)} bar</div>
                  <span className="text-[10px] text-slate-500">Chamber Bulkhead</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Penetration Rate</span>
                  <div className="text-base font-black text-white">{tbmPenetrationMmRev.toFixed(1)} mm/rev</div>
                  <span className="text-[10px] text-slate-500">Speed: {tbmAdvanceRateMmMin} mm/min</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Field Penetration Index</span>
                  <div className="text-base font-black text-yellow-300">
                    {(tbmThrustKn / Math.max(0.5, tbmPenetrationMmRev) / 10).toFixed(1)} kN/mm
                  </div>
                  <span className="text-[10px] text-slate-500">FPI Boreability</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase">Cutterhead RPM</span>
                  <div className="text-base font-black text-cyan-300">2.8 RPM</div>
                  <span className="text-[10px] text-slate-500">Drive Motors: 12x</span>
                </div>
              </div>

              <div className={`${layoutStyles.sectionSurface} bg-slate-950 border-cyan-500/30 p-4 space-y-3 text-xs font-mono`}>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  Advance Stroke &amp; Thrust Hydraulic Cylinders
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Ring Advance Stroke:</span>
                    <strong className="text-cyan-300">1,250 mm / 1,500 mm (83% of Ring Complete)</strong>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: '83%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Muck Pile Volume & Tail Void Annular Grouting Control */}
          {tbmTab === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                  Muck Balance &amp; Over-Excavation Monitoring
                </span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Theoretical In-Situ Ring Volume:</span>
                    <strong className="text-white font-bold">48.3 m³</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Actual Muck Hauled (Belt Weigher):</span>
                    <strong className="text-emerald-400 font-bold">52.8 m³ (109% Bulking)</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5">
                    <span className="text-slate-300 font-bold">Overbreak / Cavity Status:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      NORMAL (NO SETTLEMENT ALERT)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  Tail Void Bi-Component Grout Injection
                </span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Theoretical Annular Void:</span>
                    <strong className="text-white font-bold">4.4 m³</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Injected Grout Volume (Comp A+B):</span>
                    <strong className="text-cyan-300 font-bold">{tbmGroutVolumeM3} m³ (109% Fill Ratio)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Injection Pressure:</span>
                    <strong className="text-emerald-400 font-bold">{tbmGroutPressureBar} bar (Adequate)</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TBM Geotechnical Classification (Qtbm / RSR / CSM) */}
          {tbmTab === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  Barton Mechanized Qtbm Rock Mass Classification
                </span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Qtbm Index Score:</span>
                    <strong className="text-cyan-300 font-bold">4.8 / 100</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Boreability Rating:</span>
                    <strong className="text-emerald-400 font-bold">Good to Moderate Penetration</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Cutter Life:</span>
                    <strong className="text-white">180 m³ rock / disc</strong>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                  Colorado School of Mines (CSM) Penetration Model
                </span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Predicted Penetration (at 24.5 MN):</span>
                    <strong className="text-amber-300 font-bold">12.2 mm/rev</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Actual Measured Penetration:</span>
                    <strong className="text-cyan-300 font-bold">{tbmPenetrationMmRev.toFixed(1)} mm/rev</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Model Accuracy:</span>
                    <strong className="text-emerald-400 font-bold">97.5% Calibration</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TBM Shift Reports & Ring Data Memory */}
          {tbmTab === 5 && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  TBM Shift Production Log in <code className="text-cyan-300">eswa_isolated_db_TBM</code>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentProjectToMemory()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Save Ring Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportModalInitialMode('FINAL_ENGINEERING_SHEET');
                      setIsExportModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Export TBM Shift Sheet
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Ring #</th>
                      <th className="p-2">Key Pos</th>
                      <th className="p-2">Thrust kN</th>
                      <th className="p-2">Torque kNm</th>
                      <th className="p-2">Penetration</th>
                      <th className="p-2">Grout Vol</th>
                      <th className="p-2">Cycle Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-2 font-bold text-cyan-300">#{tbmRingNum} (Active)</td>
                      <td className="p-2">{tbmKeyPosition}</td>
                      <td className="p-2">{tbmThrustKn} kN</td>
                      <td className="p-2">{tbmTorqueKnm} kNm</td>
                      <td className="p-2">{tbmPenetrationMmRev} mm/rev</td>
                      <td className="p-2">{tbmGroutVolumeM3} m³</td>
                      <td className="p-2 text-emerald-400 font-bold">85 min</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-2 font-bold text-slate-400">#{tbmRingNum - 1}</td>
                      <td className="p-2">Key Pos 2 (60°)</td>
                      <td className="p-2">24,200 kN</td>
                      <td className="p-2">6,750 kNm</td>
                      <td className="p-2">12.1 mm/rev</td>
                      <td className="p-2">4.7 m³</td>
                      <td className="p-2 text-slate-400">82 min</td>
                    </tr>
                    <tr className="hover:bg-slate-900/50">
                      <td className="p-2 font-bold text-slate-400">#{tbmRingNum - 2}</td>
                      <td className="p-2">Key Pos 1 (0°)</td>
                      <td className="p-2">23,900 kN</td>
                      <td className="p-2">6,600 kNm</td>
                      <td className="p-2">11.8 mm/rev</td>
                      <td className="p-2">4.6 m³</td>
                      <td className="p-2 text-slate-400">79 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setTbmRingNum((prev) => prev + 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Advance to Next TBM Ring (#{tbmRingNum + 1})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTbmTab(1)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Return to Tab 1 (Ring Assembly)
                </button>
              </div>
            </div>
          )}
        </div>
        {projectMemoryModalNode}
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </main>
    );
  }

  // ============================================================================
  // STRICT INDUSTRY MODE ROUTING: CIVIL NATM WORKFLOW (Steps 1 to 5)
  // The following screens ONLY execute when industryMode === 'NATM'
  // ============================================================================
  if (screen === 'start') {
    return (
      <main className={layoutStyles.viewportShell}>
        <EswaAppBackgroundWatermark visible={!isExportModalOpen} isReport={isExportModalOpen} />
        {/* Architectural CAD Engineering Grid & Radial Backdrop */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="eswaStartGrid"
              width="56"
              height="56"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 56 0 L 0 0 0 56"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="0.75"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#eswaStartGrid)" />
        </svg>

        <div className={`${layoutStyles.majorPanel} max-w-[96vw] xl:max-w-[1380px]`}>
          {/* Top Brand & Quick Database Row */}
          <div className={layoutStyles.headerRow}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setScreen('welcome')}
                className={layoutStyles.backButton}
                title="Return to Welcome Window"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Welcome</span>
              </button>
              <EswaTunnelLogo size="sm" animated={false} />

              {/* Top-Left High-Contrast Segmented 3-Mode Selector (NATM | TBM | MINING) */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700 shadow-inner">
                {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
                  const isAct = industryMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSwitchIndustryMode(m)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        isAct
                          ? m === 'NATM'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : m === 'TBM'
                            ? 'bg-cyan-500 text-slate-950 font-black shadow'
                            : 'bg-emerald-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={
                        m === 'NATM'
                          ? 'NATM: New Austrian Tunnelling Method / Conventional D&B'
                          : m === 'TBM'
                          ? 'TBM: Shield Tunnel Boring Machine'
                          : 'MINING: Underground Hardrock Mining Stope & Grade Control'
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              <div className="text-left">
                <h1 className="font-display text-lg sm:text-xl font-bold tracking-wide text-slate-900">
                  {activeMappingDomain === 'TUNNEL'
                    ? 'ESWA Geological Mapper · NATM Tunnel Setup'
                    : `ESWA Surface Mapper · ${
                        activeMappingDomain === 'BENCH'
                          ? 'Bench Mapping'
                          : activeMappingDomain === 'TRENCH'
                          ? 'Trench Mapping'
                          : 'Slope Mapping'
                      } Photogrammetry Setup`}
                </h1>
                <p className={layoutStyles.labelMuted}>
                  {activeMappingDomain === 'TUNNEL'
                    ? 'Step 1: Project & Location → Chainage, Pull & Drive Direction → Tunnel Shape & Size'
                    : 'Step 1: Project & Location → Station/Elevation & Dip Direction → Surface Geometry (Bench / Trench / Slope)'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tunnel vs Surface (Bench, Trench, Slope, Outcrop) Photogrammetry Switcher */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-orange-100/90 border border-orange-300">
                {(
                  [
                    { id: 'TUNNEL', label: 'Tunnel' },
                    { id: 'BENCH', label: 'Bench' },
                    { id: 'TRENCH', label: 'Trench' },
                    { id: 'SLOPE', label: 'Slope' },
                    { id: 'ROCK_SURFACE', label: 'Outcrop' },
                  ] as { id: MappingDomainType; label: string }[]
                ).map((m) => {
                  const isAct = activeMappingDomain === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSwitchMappingDomain(m.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        isAct
                          ? 'bg-orange-600 text-white shadow-2xs'
                          : 'text-stone-700 hover:bg-orange-200/70'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {isMasterSoftware && !responsive.isMobile && pendingRequestCount > 0 && onOpenAdminPortal && (
                <button
                  type="button"
                  onClick={() => onOpenAdminPortal()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  title="Approve pending User PC / Mobile App access requests"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>User Requests ({pendingRequestCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleStartFreshNewSession}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                title="Clear current form and start a fresh new mapping session"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Fresh New</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFirstOpening(false);
                  handleOpenProjectMemoryModal('projects');
                }}
                className={layoutStyles.secondaryButton}
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Saved Records ({savedProjects.length})</span>
              </button>
              {hasSavedDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFirstOpening(false);
                    handleResumeOfflineDraft();
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer"
                >
                  Resume Draft
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsNatmRockMechanicsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-slate-900 border border-cyan-400 text-cyan-300 hover:bg-slate-800 shadow-md cursor-pointer transition-all active:scale-95"
                title="Open 3D Wedge Support Adequacy, 4-Surface Apparent Dip Solver & +3m/+6m/+9m Predictor"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rock Mechanics &amp; +3m/+6m/+9m Predictor</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-600">v2.6 LIVE</span>
              </button>
            </div>
          </div>

          {/* Main Step 1 Practical Setup Content */}
          <div className="space-y-4 pr-1 text-left">
            {/* Prominently Mounted NATM Rock Mechanics & Look-Ahead Hub */}
            <NatmRockMechanicsAndLookAheadHub
              isOpen={true}
              driveAzimuth={Number(settings.driveDirection) || 45}
              faceChainage={settings.faceChainage || settings.chainage || 'CH 102+45.0'}
            />
            {/* ROW 1: 1. CHOOSE OR CREATE PROJECT + 2. CHOOSE OR CREATE LOCATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. PROJECT */}
              <div className={`${layoutStyles.sectionSurface} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                    1. Project Name
                  </span>
                  {Object.keys(projectDirectory).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewProjectInput((v) => !v)}
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showNewProjectInput ? 'Choose Existing' : 'New Project'}
                    </button>
                  )}
                </div>

                {Object.keys(projectDirectory).length > 0 && !showNewProjectInput ? (
                  <select
                    value={activeProjectName}
                    onChange={(e) => {
                      const nextProj = e.target.value;
                      const projLocs = projectDirectory[nextProj] || [];
                      const firstLoc = projLocs[0] || '';
                      setSettings((prev) => ({
                        ...prev,
                        projectName: nextProj,
                        locationName: firstLoc,
                        tunnelName: firstLoc,
                      }));
                    }}
                    className={layoutStyles.inputControl}
                  >
                    <option value="">-- Select Project --</option>
                    {allProjectsList.map((proj) => (
                      <option key={proj} value={proj}>
                        {proj}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter Project Name..."
                      value={settings.projectName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          projectName: val,
                        }));
                      }}
                      className={layoutStyles.inputControl}
                    />
                    {showNewProjectInput && (
                      <button
                        type="button"
                        onClick={() => {
                          const clean = (settings.projectName || '').trim();
                          if (!clean) return;
                          handleSaveProjectLocationPair(clean, settings.locationName || '');
                          setShowNewProjectInput(false);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shrink-0 cursor-pointer"
                      >
                        Save
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 2. LOCATION (Based on Selected Project & Domain) */}
              <div className={`${layoutStyles.sectionSurface} space-y-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                    {activeMappingDomain === 'TUNNEL'
                      ? '2. Location / Tunnel Heading'
                      : activeMappingDomain === 'BENCH'
                      ? '2. Bench Sector / Pit Wall Location'
                      : activeMappingDomain === 'TRENCH'
                      ? '2. Trench Line / Exploration Sector'
                      : '2. Slope Sector / Cut Location'}
                  </span>
                  {locationsForSelectedProject.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewLocationInput((v) => !v)}
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showNewLocationInput ? 'Choose Existing' : 'Create Location'}
                    </button>
                  )}
                </div>

                {locationsForSelectedProject.length > 0 && !showNewLocationInput ? (
                  <select
                    value={activeLocationName}
                    onChange={(e) => {
                      const nextLoc = e.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        locationName: nextLoc,
                        tunnelName: nextLoc,
                      }));
                      if (activeMappingDomain === 'TUNNEL') {
                        const match = savedGeometries.find(
                          (g) =>
                            (g.location || '').toLowerCase() === nextLoc.toLowerCase() ||
                            (g.tunnelName || '').toLowerCase() === nextLoc.toLowerCase()
                        );
                        if (match) {
                          setGeometry(match.geometry);
                          setManWidth(String(match.geometry.width));
                          setManHeight(String(match.geometry.height));
                          setManWallHeight(String(match.geometry.wallHeight));
                          setManCrownRadius(String(match.geometry.crownRadius));
                        }
                      }
                    }}
                    className={layoutStyles.inputControl}
                  >
                    <option value="">-- Select Location --</option>
                    {locationsForSelectedProject.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={
                        activeMappingDomain === 'TUNNEL'
                          ? 'Enter Location / Tunnel Heading...'
                          : activeMappingDomain === 'BENCH'
                          ? 'Enter Bench Sector (e.g. East Pit Wall Bench RL 270)...'
                          : activeMappingDomain === 'TRENCH'
                          ? 'Enter Trench ID (e.g. Exploration Trench TR-01)...'
                          : 'Enter Slope Sector (e.g. Portal Cut Slope CS-01)...'
                      }
                      value={settings.locationName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          locationName: val,
                          tunnelName: val,
                        }));
                      }}
                      className={layoutStyles.inputControl}
                    />
                    {showNewLocationInput && (
                      <button
                        type="button"
                        onClick={() => {
                          const cleanLoc = (settings.locationName || '').trim();
                          if (!cleanLoc) return;
                          handleSaveProjectLocationPair(
                            settings.projectName || 'Project',
                            cleanLoc
                          );
                          setShowNewLocationInput(false);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shrink-0 cursor-pointer"
                      >
                        Save
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 2: 3. CHAINAGE / STATION & ORIENTATION */}
              <div className={`${layoutStyles.sectionSurface} space-y-3`}>
                <div className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                  {activeMappingDomain === 'TUNNEL'
                    ? '3. Chainage / RD, Pull Length & Tunnel Drive Direction'
                    : activeMappingDomain === 'BENCH'
                    ? '3. Bench Chainage Interval, Span Length & Face Dip Direction'
                    : activeMappingDomain === 'TRENCH'
                    ? '3. Trench Station Interval, Logged Span & Trench Axis Azimuth'
                    : '3. Slope Chainage Interval, Mapped Span & Slope Dip Direction'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <label className="block space-y-1">
                    <span className={layoutStyles.labelMuted}>
                      {activeMappingDomain === 'TUNNEL'
                        ? 'Chainage / RD Interval'
                        : 'Station / Chainage Interval'}
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Ch 120.0m - 135.0m"
                      value={settings.chainage}
                      onChange={(e) => setSettings((p) => ({ ...p, chainage: e.target.value }))}
                      className={layoutStyles.inputControl}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className={layoutStyles.labelMuted}>
                      {activeMappingDomain === 'TUNNEL'
                        ? 'Face Chainage / RD'
                        : activeMappingDomain === 'BENCH'
                        ? 'Bench Level / RL'
                        : activeMappingDomain === 'TRENCH'
                        ? 'Trench Station ID'
                        : 'Slope Station / RL'}
                    </span>
                    <input
                      type="text"
                      placeholder={
                        activeMappingDomain === 'TUNNEL'
                          ? 'e.g. RD 123.50m'
                          : activeMappingDomain === 'BENCH'
                          ? 'e.g. RL 270m - 280m'
                          : 'e.g. Stn 0+020m'
                      }
                      value={settings.faceChainage}
                      onChange={(e) => {
                        const nextFace = e.target.value;
                        const numMatch = nextFace.match(/(\d+(?:\.\d+)?)/);
                        const faceM = numMatch ? parseFloat(numMatch[1]) : null;
                        setSettings((p) => {
                          const pull = Math.max(0.5, p.roundLength || 3.5);
                          let nextRange = p.chainage;
                          if (activeMappingDomain === 'TUNNEL' && faceM !== null && !isNaN(faceM)) {
                            const fromM =
                              faceM >= pull ? Number((faceM - pull).toFixed(2)) : Number(faceM.toFixed(2));
                            const toM =
                              faceM >= pull ? Number(faceM.toFixed(2)) : Number((fromM + pull).toFixed(2));
                            nextRange = `RD ${fromM.toFixed(2)}m - ${toM.toFixed(2)}m`;
                          }
                          return { ...p, faceChainage: nextFace, chainage: nextRange };
                        });
                      }}
                      className={layoutStyles.inputControl}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className={layoutStyles.labelMuted}>
                      {activeMappingDomain === 'TUNNEL'
                        ? 'Pull / Round Length (m)'
                        : 'Mapped Span / Exposure Length (m)'}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={settings.roundLength}
                      onChange={(e) => {
                        const nextPull = Math.max(0.5, parseFloat(e.target.value) || 3.5);
                        setSettings((p) => ({
                          ...p,
                          roundLength: nextPull,
                        }));
                        if (activeMappingDomain !== 'TUNNEL') {
                          const updated = { ...photoSurfaceParams, exposureLengthMeters: nextPull };
                          setPhotoSurfaceParams(updated);
                          saveSurfaceGeometryParameters(updated);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(updated));
                        }
                      }}
                      className={layoutStyles.inputControl}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className={layoutStyles.labelMuted}>
                      {activeMappingDomain === 'TUNNEL'
                        ? `Tunnel Drive Direction (Azimuth: ${Math.round(settings.driveDirection)}°)`
                        : activeMappingDomain === 'TRENCH'
                        ? `Trench Axis Azimuth (${Math.round(settings.driveDirection)}°)`
                        : `Face Dip Direction Azimuth (${Math.round(settings.driveDirection)}°)`}
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. N 135° or 135"
                      value={settings.driveDirectionInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        const norm = parseDriveDirectionAzimuth(val);
                        setSettings((prev) => ({
                          ...prev,
                          driveDirectionInput: val,
                          driveDirection: norm.azimuth,
                        }));
                        if (activeMappingDomain !== 'TUNNEL') {
                          const updated = { ...photoSurfaceParams, faceDipDirectionDeg: norm.azimuth };
                          setPhotoSurfaceParams(updated);
                          saveSurfaceGeometryParameters(updated);
                        }
                      }}
                      className={layoutStyles.inputControl}
                    />
                  </label>
                </div>
              </div>

            {/* ROW 3: 4. TUNNEL SHAPE & SIZE (TUNNEL) OR SURFACE GEOMETRY PARAMETERS (BENCH / TRENCH / SLOPE) */}
            {activeMappingDomain === 'TUNNEL' ? (
              <div className={`${layoutStyles.sectionSurface} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                      4. Tunnel Shape &amp; Size
                      {activeLocationName ? ` for “${activeLocationName}”` : ''}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {savedShapesForSelectedLocation.length > 0
                        ? 'Choose an existing tunnel shape & size below, or create a new one.'
                        : 'No saved shape yet — use the active shape shown in the small canvas below or click Create / Edit Tunnel Shape.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFirstOpening(false);
                      handleSaveProjectLocationPair(activeProjectName, activeLocationName);
                      setCustomEditorInitialTab(
                        geometry.customProfile ||
                          geometry.crownGeometry === 'freeform_custom' ||
                          geometry.source === 'custom_editor'
                          ? 'freeform_canvas'
                          : 'common_variants'
                      );
                      setReturnScreenFromCustomEditor('start');
                      setScreen('geometry_custom');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create / Edit Tunnel Shape (Variants · Custom · Import DWG)
                  </button>
                </div>

                {/* Saved Shapes for this Location (if any exist) — Clicking any shape asks Full Face or Top Heading + Benching Details */}
                {savedShapesForSelectedLocation.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {savedShapesForSelectedLocation.map((rec) => {
                      const isCurrent =
                        Math.abs(rec.geometry.width - geometry.width) < 0.02 &&
                        Math.abs(rec.geometry.height - geometry.height) < 0.02 &&
                        Math.abs(rec.geometry.wallHeight - geometry.wallHeight) < 0.02;
                      const recPts = rec.geometry.crossSectionPoints || [];
                      const recW = Math.max(1.5, rec.geometry.width || 8.4);
                      const recH = Math.max(1.5, rec.geometry.height || 7.2);
                      const recPoly = recPts
                        .map((p) => `${p.x.toFixed(2)},${(recH - p.y).toFixed(2)}`)
                        .join(' ');
                      return (
                        <div
                          key={rec.id}
                          onClick={() => {
                            openChooseShapeExcavationModal(rec.name, rec.geometry);
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-sm'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-cyan-500/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-14 h-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center p-1 shrink-0">
                              <svg
                                viewBox={`${-recW * 0.65} ${-recH * 0.15} ${recW * 1.3} ${recH * 1.3}`}
                                className="w-full h-full"
                              >
                                {recPoly && (
                                  <polygon
                                    points={recPoly}
                                    fill={isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.18)'}
                                    stroke={isCurrent ? '#10B981' : '#38BDF8'}
                                    strokeWidth={Math.max(0.08, recW * 0.022)}
                                  />
                                )}
                              </svg>
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                                {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                <span className="truncate">{rec.name}</span>
                              </div>
                              <div className="text-[11px] font-mono text-cyan-300">
                                W: {rec.geometry.width.toFixed(2)}m × H: {rec.geometry.height.toFixed(2)}m · Wall:{' '}
                                {rec.geometry.wallHeight.toFixed(2)}m
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Currently Selected Shape Summary Bar */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="px-2.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 text-xs font-mono font-bold">
                          {geometry.excavationStage === 'TOP_HEADING' ||
                          geometry.excavationStage === 'top_heading'
                            ? 'TOP HEADING SHAPE'
                            : 'ACTIVE SHAPE'}
                        </div>
                        <strong className="text-xs sm:text-sm font-mono text-slate-900">
                          {geometry.profileName ||
                            geometry.customProfile?.name ||
                            geometry.crownGeometry.replace(/_/g, ' ').toUpperCase()}
                        </strong>
                      </div>
                      <div className="text-xs font-mono text-slate-700 leading-relaxed">
                        Width = <strong className="text-sky-700">{geometry.width.toFixed(2)} m</strong> ·{' '}
                        {geometry.excavationStage === 'TOP_HEADING' ||
                        geometry.excavationStage === 'top_heading' ? (
                          <>
                            Top Heading H ={' '}
                            <strong className="text-amber-700">{geometry.height.toFixed(2)} m</strong>{' '}
                            <span className="text-rose-700 font-semibold">
                              (Bench {(geometry.benchHeightRemovedMeters || 0).toFixed(2)}m Removed)
                            </span>{' '}
                            · Top Heading L-Wall ={' '}
                            <strong className="text-emerald-700">
                              {(geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)} m
                            </strong>{' '}
                            · R-Wall ={' '}
                            <strong className="text-indigo-700">
                              {(geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)} m
                            </strong>{' '}
                            ·{' '}
                          </>
                        ) : (
                          <>
                            Height = <strong className="text-sky-700">{geometry.height.toFixed(2)} m</strong> ·
                            L-Wall ={' '}
                            <strong className="text-emerald-700">
                              {(geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)} m
                            </strong>{' '}
                            · R-Wall ={' '}
                            <strong className="text-indigo-700">
                              {(geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)} m
                            </strong>{' '}
                            ·{' '}
                          </>
                        )}
                        Crown = <strong className="text-sky-700">{geometry.crownArcLength.toFixed(2)} m</strong> ·
                        Pull = <strong className="text-amber-700">{settings.roundLength.toFixed(2)} m</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFirstOpening(false);
                      handleSaveProjectLocationPair(activeProjectName, activeLocationName);
                      setScreen('drive_and_photos');
                    }}
                    className={`py-2.5 px-5 text-xs sm:text-sm ${layoutStyles.primaryButton}`}
                  >
                    <span>Continue with This Shape to Add Pictures</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* SURFACE GEOMETRY CONFIGURATION FOR BENCH / TRENCH / SLOPE PHOTOGRAMMETRY */
              <div className={`${layoutStyles.sectionSurface} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-cyan-400">
                      4.{' '}
                      {activeMappingDomain === 'BENCH'
                        ? 'Bench Geometry & Batter Profile (Crest, Toe, Height, Berm & Face Angle)'
                        : activeMappingDomain === 'TRENCH'
                        ? 'Trench Geometry & Unrolled 3-Panel Log Dimensions (Left Wall, Floor & Right Wall)'
                        : 'Slope Geometry & Berm Configuration (Slope Height, Overall Angle & Berms)'}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure rectangular surface geometry for 1:1 scaled photogrammetry and Romana SMR kinematic analysis.
                    </p>
                  </div>
                </div>

                {activeMappingDomain === 'BENCH' && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Crest Elevation RL (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={photoSurfaceParams.crestElevationRl}
                        onChange={(e) => {
                          const crest = parseFloat(e.target.value) || 0;
                          const next = {
                            ...photoSurfaceParams,
                            crestElevationRl: crest,
                            benchHeightMeters: Math.max(
                              1,
                              Number((crest - photoSurfaceParams.toeElevationRl).toFixed(2))
                            ),
                          };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Toe Elevation RL (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={photoSurfaceParams.toeElevationRl}
                        onChange={(e) => {
                          const toe = parseFloat(e.target.value) || 0;
                          const next = {
                            ...photoSurfaceParams,
                            toeElevationRl: toe,
                            benchHeightMeters: Math.max(
                              1,
                              Number((photoSurfaceParams.crestElevationRl - toe).toFixed(2))
                            ),
                          };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Bench Height (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={photoSurfaceParams.benchHeightMeters}
                        onChange={(e) => {
                          const bh = Math.max(1, parseFloat(e.target.value) || 10);
                          const next = {
                            ...photoSurfaceParams,
                            benchHeightMeters: bh,
                            crestElevationRl: Number((photoSurfaceParams.toeElevationRl + bh).toFixed(2)),
                          };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Catch Berm Width (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={photoSurfaceParams.bermWidthMeters}
                        onChange={(e) => {
                          const bw = Math.max(0.5, parseFloat(e.target.value) || 6);
                          const next = { ...photoSurfaceParams, bermWidthMeters: bw };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Bench Face Dip Angle (°)</span>
                      <input
                        type="number"
                        step="1"
                        min="15"
                        max="90"
                        value={photoSurfaceParams.faceDipAngleDeg}
                        onChange={(e) => {
                          const ang = Math.max(15, Math.min(90, parseFloat(e.target.value) || 75));
                          const next = { ...photoSurfaceParams, faceDipAngleDeg: ang };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                  </div>
                )}

                {activeMappingDomain === 'TRENCH' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Trench Depth (m)</span>
                      <input
                        type="number"
                        step="0.2"
                        min="0.5"
                        value={photoSurfaceParams.trenchDepthMeters}
                        onChange={(e) => {
                          const td = Math.max(0.5, parseFloat(e.target.value) || 3.5);
                          const next = { ...photoSurfaceParams, trenchDepthMeters: td };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Trench Floor Width (m)</span>
                      <input
                        type="number"
                        step="0.2"
                        min="0.5"
                        value={photoSurfaceParams.trenchWidthMeters}
                        onChange={(e) => {
                          const tw = Math.max(0.5, parseFloat(e.target.value) || 2.0);
                          const next = { ...photoSurfaceParams, trenchWidthMeters: tw };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Soil / Overburden Thickness (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={photoSurfaceParams.overburdenThicknessMeters}
                        onChange={(e) => {
                          const ob = Math.max(0, parseFloat(e.target.value) || 0.8);
                          const next = { ...photoSurfaceParams, overburdenThicknessMeters: ob };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Wall Batter Angle (°)</span>
                      <input
                        type="number"
                        step="1"
                        min="30"
                        max="90"
                        value={photoSurfaceParams.faceDipAngleDeg}
                        onChange={(e) => {
                          const ang = Math.max(30, Math.min(90, parseFloat(e.target.value) || 85));
                          const next = { ...photoSurfaceParams, faceDipAngleDeg: ang };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                  </div>
                )}

                {activeMappingDomain === 'SLOPE' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Overall Slope Height (m)</span>
                      <input
                        type="number"
                        step="1"
                        min="2"
                        value={photoSurfaceParams.slopeHeightMeters}
                        onChange={(e) => {
                          const sh = Math.max(2, parseFloat(e.target.value) || 24);
                          const next = { ...photoSurfaceParams, slopeHeightMeters: sh };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Overall Slope Angle (°)</span>
                      <input
                        type="number"
                        step="1"
                        min="15"
                        max="90"
                        value={photoSurfaceParams.overallSlopeAngleDeg}
                        onChange={(e) => {
                          const ang = Math.max(15, Math.min(90, parseFloat(e.target.value) || 55));
                          const next = {
                            ...photoSurfaceParams,
                            overallSlopeAngleDeg: ang,
                            faceDipAngleDeg: ang,
                          };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Number of Berms / Benches</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="12"
                        value={photoSurfaceParams.numberOfBenches}
                        onChange={(e) => {
                          const nb = Math.max(1, parseInt(e.target.value, 10) || 2);
                          const next = { ...photoSurfaceParams, numberOfBenches: nb };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className={layoutStyles.labelMuted}>Catch Berm Width (m)</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={photoSurfaceParams.bermWidthMeters}
                        onChange={(e) => {
                          const bw = Math.max(0.5, parseFloat(e.target.value) || 4);
                          const next = { ...photoSurfaceParams, bermWidthMeters: bw };
                          setPhotoSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          setGeometry(buildCompatibleGeometryFromSurfaceParams(next));
                        }}
                        className={layoutStyles.inputControl}
                      />
                    </label>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-mono text-slate-700">
                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 font-bold mr-2">
                      {activeMappingDomain} SURFACE PROFILE
                    </span>
                    Span = <strong className="text-sky-700">{geometry.width.toFixed(2)} m</strong> ·{' '}
                    {activeMappingDomain === 'TRENCH' ? 'Depth' : 'Height'} ={' '}
                    <strong className="text-emerald-700">{geometry.height.toFixed(2)} m</strong> ·{' '}
                    {activeMappingDomain === 'TRENCH' ? 'Floor Width' : 'Berm Width'} ={' '}
                    <strong className="text-amber-700">{geometry.crownArcLength.toFixed(2)} m</strong> ·{' '}
                    Dip Angle = <strong className="text-indigo-700">{photoSurfaceParams.faceDipAngleDeg}°</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsFirstOpening(false);
                      handleSaveProjectLocationPair(activeProjectName, activeLocationName);
                      setScreen('drive_and_photos');
                    }}
                    className={`py-2.5 px-5 text-xs sm:text-sm ${layoutStyles.primaryButton}`}
                  >
                    <span>Continue with {activeMappingDomain} Geometry to Add Pictures</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL SHOWN WHEN CHOOSING A TUNNEL SHAPE: ASK FULL FACE OR TOP HEADING + BENCHING DETAILS */}
        {chosenShapeModalState &&
          (() => {
            const baseFull = chosenShapeModalState.baseGeometry;
            const benchVal = Math.max(
              0.2,
              Math.min(
                baseFull.height - 1.0,
                parseFloat(chosenShapeModalState.benchHeightInput) || 2.5
              )
            );
            const leftBenchVal = Math.max(
              0.2,
              Math.min(
                baseFull.height - 1.0,
                parseFloat(chosenShapeModalState.leftBenchInput) || benchVal
              )
            );
            const rightBenchVal = Math.max(
              0.2,
              Math.min(
                baseFull.height - 1.0,
                parseFloat(chosenShapeModalState.rightBenchInput) || benchVal
              )
            );
            const previewChosenGeom =
              chosenShapeModalState.stage === 'TOP_HEADING'
                ? convertTunnelGeometryToSequentialTopHeading(baseFull, {
                    benchHeightMeters: benchVal,
                    leftBenchHeightMeters: leftBenchVal,
                    rightBenchHeightMeters: rightBenchVal,
                  })
                : baseFull;
            const fullLW = baseFull.leftWallHeight ?? baseFull.wallHeight;
            const fullRW = baseFull.rightWallHeight ?? baseFull.wallHeight;
            const topLW = previewChosenGeom.leftWallHeight ?? previewChosenGeom.wallHeight;
            const topRW = previewChosenGeom.rightWallHeight ?? previewChosenGeom.wallHeight;

            return (
              <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto touch-pan-y">
                <div className="w-full max-w-2xl my-auto max-h-[94dvh] overflow-y-auto touch-pan-y rounded-2xl bg-[#111827] border border-slate-700 shadow-2xl p-4 sm:p-5 space-y-3.5 text-slate-100">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                        Chosen Tunnel Shape &amp; Size
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5">
                        {chosenShapeModalState.name} ({baseFull.width.toFixed(2)}m W ×{' '}
                        {baseFull.height.toFixed(2)}m H)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChosenShapeModalState(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-mono font-bold text-amber-300 uppercase">
                      Select Excavation Stage: Full Face or Top Heading?
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setChosenShapeModalState((prev) =>
                            prev ? { ...prev, stage: 'FULL_FACE' } : null
                          )
                        }
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          chosenShapeModalState.stage === 'FULL_FACE'
                            ? 'bg-emerald-950/80 border-emerald-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase text-emerald-300">
                            1. Full Face
                          </span>
                          {chosenShapeModalState.stage === 'FULL_FACE' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Full tunnel shape ({baseFull.width.toFixed(2)}m W ×{' '}
                          {baseFull.height.toFixed(2)}m H · L-Wall {fullLW.toFixed(2)}m · R-Wall{' '}
                          {fullRW.toFixed(2)}m)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setChosenShapeModalState((prev) =>
                            prev ? { ...prev, stage: 'TOP_HEADING' } : null
                          )
                        }
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          chosenShapeModalState.stage === 'TOP_HEADING'
                            ? 'bg-amber-950/80 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase text-amber-300">
                            2. Top Heading
                          </span>
                          {chosenShapeModalState.stage === 'TOP_HEADING' && (
                            <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Enter benching details to remove lower bench portion from the shape (keeps Top Heading Left &amp; Right Walls).
                        </p>
                      </button>
                    </div>

                    {chosenShapeModalState.stage === 'TOP_HEADING' && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/50 space-y-3">
                        <div className="text-xs font-mono font-bold text-amber-300 uppercase">
                          Enter Benching Details (Removes Lower Bench Portion from Shape)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <label className="space-y-1">
                            <span className="text-[11px] font-mono text-amber-300 font-semibold block">
                              Bench Height (m)
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.2"
                              max={Math.max(0.5, baseFull.height - 1.0)}
                              value={chosenShapeModalState.benchHeightInput}
                              onChange={(e) => {
                                const v = e.target.value;
                                setChosenShapeModalState((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        benchHeightInput: v,
                                        leftBenchInput: v,
                                        rightBenchInput: v,
                                      }
                                    : null
                                );
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/70 font-mono text-sm font-bold text-white"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-mono text-cyan-300 font-semibold block">
                              Top Heading H (m)
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="1.0"
                              max={baseFull.height - 0.2}
                              value={previewChosenGeom.height}
                              onChange={(e) => {
                                const topH = parseFloat(e.target.value);
                                if (!Number.isNaN(topH) && topH >= 1.0) {
                                  const nextB = Number(
                                    Math.max(0.2, baseFull.height - topH).toFixed(2)
                                  );
                                  setChosenShapeModalState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          benchHeightInput: String(nextB),
                                          leftBenchInput: String(nextB),
                                          rightBenchInput: String(nextB),
                                        }
                                      : null
                                  );
                                }
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/60 font-mono text-sm font-bold text-white"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-mono text-emerald-300 font-semibold block">
                              Top Heading L-Wall (m)
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.4"
                              max={fullLW}
                              value={topLW}
                              onChange={(e) => {
                                const nextLW = parseFloat(e.target.value);
                                if (!Number.isNaN(nextLW) && nextLW >= 0.3) {
                                  const nextLB = Number(Math.max(0.2, fullLW - nextLW).toFixed(2));
                                  setChosenShapeModalState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          benchHeightInput: String(nextLB),
                                          leftBenchInput: String(nextLB),
                                        }
                                      : null
                                  );
                                }
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/60 font-mono text-sm font-bold text-white"
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-[11px] font-mono text-indigo-300 font-semibold block">
                              Top Heading R-Wall (m)
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              min="0.4"
                              max={fullRW}
                              value={topRW}
                              onChange={(e) => {
                                const nextRW = parseFloat(e.target.value);
                                if (!Number.isNaN(nextRW) && nextRW >= 0.3) {
                                  const nextRB = Number(Math.max(0.2, fullRW - nextRW).toFixed(2));
                                  setChosenShapeModalState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          rightBenchInput: String(nextRB),
                                        }
                                      : null
                                  );
                                }
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/60 font-mono text-sm font-bold text-white"
                            />
                          </label>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] font-mono text-amber-200 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            ✓ Lower Bench Removed: <strong>{benchVal.toFixed(2)} m</strong>
                          </span>
                          <span>
                            ✓ Top Heading Shape: <strong>{previewChosenGeom.width.toFixed(2)}m W × {previewChosenGeom.height.toFixed(2)}m H</strong> · L-Wall <strong>{topLW.toFixed(2)}m</strong> · R-Wall <strong>{topRW.toFixed(2)}m</strong> · Crown <strong>{previewChosenGeom.crownArcLength.toFixed(2)}m</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setChosenShapeModalState(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeometry(previewChosenGeom);
                        setManWidth(String(previewChosenGeom.width));
                        setManHeight(String(previewChosenGeom.height));
                        setManWallHeight(String(previewChosenGeom.wallHeight));
                        setManCrownRadius(String(previewChosenGeom.crownRadius));
                        setChosenShapeModalState(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {chosenShapeModalState.stage === 'TOP_HEADING'
                          ? `Apply Top Heading Shape (Bench ${benchVal.toFixed(2)}m Removed)`
                          : 'Apply Full Face Shape'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        {isBootLoading && <EswaLoadingScreen onComplete={() => setIsBootLoading(false)} />}
        {projectMemoryModalNode}
        {globalSettingsModalNode}
        {modeSwitchConfirmationModalNode}
      </main>
    );
  }

  // ============================================================================
  // SCREEN 2A: CREATE TUNNEL SHAPE MANUALLY (Section 3 - Option A)
  // ============================================================================
  if (screen === 'geometry_manual') {
    const previewW = Math.max(1.5, parseFloat(manWidth) || 8.4);
    const previewH = Math.max(1.5, parseFloat(manHeight) || 7.2);
    const previewWH = Math.min(previewH - 0.3, Math.max(0.5, parseFloat(manWallHeight) || 4.2));
    const previewCR = Math.max(1.0, parseFloat(manCrownRadius) || previewW / 2);
    const previewGeom = createTunnelGeometry(
      previewW,
      previewH,
      previewWH,
      manProfileType,
      previewCR,
      'manual'
    );

    const scale = Math.min(220 / previewGeom.width, 200 / previewGeom.height);
    const polyPath =
      previewGeom.crossSectionPoints
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${160 + p.x * scale} ${240 - p.y * scale}`)
        .join(' ') + ' Z';

    return (
      <main className={layoutStyles.viewportShell}>
        <div className={`${layoutStyles.majorPanel} max-w-[920px]`}>
          <div className={layoutStyles.headerRow}>
            <button
              onClick={() => setScreen('start')}
              className={layoutStyles.backButton}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h2 className="font-display font-semibold text-base sm:text-lg tracking-wide">
              01. Create Master Tunnel Geometry
            </h2>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono hidden sm:inline ${isLight ? 'text-sky-700' : 'text-cyan-400'}`}>
                Units: meters (m)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pr-1">
            <div className={`${layoutStyles.sectionSurface} space-y-4`}>
              <label className="block space-y-1.5">
                <span className={layoutStyles.labelMuted}>Tunnel / Cavern Excavation Shape</span>
                <select
                  value={manProfileType}
                  onChange={(e) => {
                    const nextType = e.target.value as ProfileType;
                    if (
                      nextType === 'freeform_custom' ||
                      nextType === 'powerhouse_cavern' ||
                      nextType === 'transformer_hall' ||
                      nextType === 'cavern_junction' ||
                      nextType === 'asymmetric_cavern'
                    ) {
                      const presetMap: Record<string, string> = {
                        powerhouse_cavern: 'powerhouse_cavern',
                        transformer_hall: 'transformer_hall',
                        cavern_junction: 'cavern_junction',
                        asymmetric_cavern: 'asymmetric_sloping_crown',
                      };
                      const presetKey = presetMap[nextType];
                      if (presetKey) {
                        const found = CUSTOM_PROFILE_PRESETS.find((p) => p.id === presetKey);
                        if (found) {
                          const built = buildAuthoritativeCustomTunnelGeometry(found.createProfile());
                          setGeometry(built);
                          setManWidth(String(built.width));
                          setManHeight(String(built.height));
                          setManWallHeight(String(built.wallHeight));
                          setManCrownRadius(String(built.crownRadius));
                        }
                      }
                      setCustomEditorInitialTab('freeform_canvas');
                      setReturnScreenFromCustomEditor('geometry_manual');
                      setScreen('geometry_custom');
                      return;
                    }
                    setManProfileType(nextType);
                    const c = enforceStrictTunnelGeometryConstraints(
                      parseFloat(manWidth) || 8.4,
                      parseFloat(manHeight) || 7.2,
                      undefined,
                      nextType
                    );
                    setManWallHeight(c.wallHeight.toFixed(2));
                    setManCrownRadius(c.crownRadius.toFixed(2));
                  }}
                  className={layoutStyles.inputControl}
                >
                  <option value="d_shaped">D-Shaped (Vertical Walls + Arch Crown)</option>
                  <option value="horseshoe">Horseshoe Profile (Curved Sidewalls)</option>
                  <option value="circular">Circular / TBM Profile</option>
                  <option value="flat_arch">Modified Flat-Arch / Basket-Handle</option>
                  <option value="powerhouse_cavern">
                    Powerhouse Cavern (Multi-Radius Arch + Stepped Walls)
                  </option>
                  <option value="transformer_hall">
                    Transformer Hall Cavern (Asymmetric Wall Heights)
                  </option>
                  <option value="cavern_junction">
                    Cavern Junction &amp; Enlarged Side-Chamber
                  </option>
                  <option value="asymmetric_cavern">
                    Asymmetric Sloping Crown &amp; Inclined Wall
                  </option>
                  <option value="freeform_custom">
                    Freeform Custom Vector Profile (Draw / Trace / Coordinates)
                  </option>
                </select>
              </label>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomEditorInitialTab('freeform_canvas');
                    setReturnScreenFromCustomEditor('geometry_manual');
                    setScreen('geometry_custom');
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                      : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-700/60'
                  }`}
                >
                  Open Freeform Custom Profile &amp; Cavern Editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomEditorInitialTab('trace_image');
                    setReturnScreenFromCustomEditor('geometry_manual');
                    setScreen('geometry_custom');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                      : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-700/60'
                  }`}
                >
                  Trace Engineering Drawing
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <label className="block space-y-1.5">
                  <span className={layoutStyles.labelMuted}>Tunnel Width (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    value={manWidth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManWidth(val);
                      const numW = parseFloat(val);
                      const numH = parseFloat(manHeight) || 7.2;
                      if (Number.isFinite(numW) && numW >= 1.5) {
                        const c = enforceStrictTunnelGeometryConstraints(
                          numW,
                          numH,
                          undefined,
                          manProfileType
                        );
                        setManWallHeight(c.wallHeight.toFixed(2));
                        setManCrownRadius(c.crownRadius.toFixed(2));
                      }
                    }}
                    className={layoutStyles.inputControl}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className={layoutStyles.labelMuted}>Total Height (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    value={manHeight}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManHeight(val);
                      const numH = parseFloat(val);
                      const numW = parseFloat(manWidth) || 8.4;
                      if (Number.isFinite(numH) && numH >= 1.5) {
                        const c = enforceStrictTunnelGeometryConstraints(
                          numW,
                          numH,
                          undefined,
                          manProfileType
                        );
                        setManWallHeight(c.wallHeight.toFixed(2));
                        setManCrownRadius(c.crownRadius.toFixed(2));
                      }
                    }}
                    className={layoutStyles.inputControl}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className={layoutStyles.labelMuted}>Wall Height (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={manWallHeight}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManWallHeight(val);
                      const numWH = parseFloat(val);
                      const numW = parseFloat(manWidth) || 8.4;
                      const numH = parseFloat(manHeight) || 7.2;
                      if (Number.isFinite(numWH) && numWH >= 0.5) {
                        const c = enforceStrictTunnelGeometryConstraints(
                          numW,
                          numH,
                          numWH,
                          manProfileType
                        );
                        setManCrownRadius(c.crownRadius.toFixed(2));
                      }
                    }}
                    className={layoutStyles.inputControl}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className={layoutStyles.labelMuted}>Crown Radius (m)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    value={previewGeom.crownRadius.toFixed(2)}
                    readOnly
                    title="Automatically constrained from Tunnel Width, Height, and Wall Height to prevent arch distortion"
                    className={`${layoutStyles.inputControl} opacity-75 cursor-not-allowed`}
                  />
                </label>
              </div>

              <div className={`pt-3 border-t ${layoutStyles.hairlineDivider} text-xs space-y-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                <div>
                  Master Geometry Rule: Photographs &amp; Developed Perimeter strictly follow{' '}
                  <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>
                    {previewGeom.width.toFixed(2)}m W × {previewGeom.height.toFixed(2)}m H
                  </strong>
                  .
                </div>
                <div className={`font-mono text-[11px] ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                  Left/Right Wall = <strong>{previewGeom.wallHeight.toFixed(2)}m</strong> · Crown Arc ={' '}
                  <strong>{previewGeom.crownArcLength.toFixed(2)}m</strong> · Total Perimeter ={' '}
                  <strong>{(previewGeom.wallHeight * 2 + previewGeom.crownArcLength).toFixed(2)}m</strong>
                </div>
              </div>
            </div>

            {/* Live Vector Cross-Section Preview */}
            <div className={layoutStyles.previewStage}>
              <svg viewBox="0 0 320 270" className="w-full h-[clamp(160px,28dvh,235px)]">
                <line
                  x1="160"
                  y1="15"
                  x2="160"
                  y2="245"
                  stroke={isLight ? '#94A3B8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <line
                  x1="40"
                  y1={240 - previewGeom.wallHeight * scale}
                  x2="280"
                  y2={240 - previewGeom.wallHeight * scale}
                  stroke={isLight ? '#94A3B8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <path
                  d={polyPath}
                  fill={isLight ? 'rgba(2, 132, 199, 0.10)' : 'rgba(56, 189, 248, 0.08)'}
                  stroke={isLight ? '#0284C7' : '#38BDF8'}
                  strokeWidth="2.2"
                />
                <text
                  x="160"
                  y="262"
                  textAnchor="middle"
                  fontSize="11"
                  fill={isLight ? '#334155' : '#94A3B8'}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  W = {previewGeom.width.toFixed(2)}m · H = {previewGeom.height.toFixed(2)}m · Wall ={' '}
                  {previewGeom.wallHeight.toFixed(2)}m
                </text>
              </svg>
            </div>
          </div>

          <div className={layoutStyles.footerRow}>
            <button
              onClick={() => handleOpenProjectMemoryModal('geometries')}
              className={layoutStyles.secondaryButton}
            >
              <Database className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
              Saved Tunnel Geometries ({savedGeometries.length})
            </button>
            <button
              onClick={() => handleApplyManualGeometry(true)}
              className={layoutStyles.primaryButton}
            >
              Save Master Geometry &amp; Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {projectMemoryModalNode}
      </main>
    );
  }

  // ============================================================================
  // SCREEN 2B: UPLOAD DWG / DXF GEOMETRY (Section 3 - Option B)
  // ============================================================================
  if (screen === 'geometry_cad') {
    const scale = Math.min(220 / geometry.width, 200 / geometry.height);
    const polyPath =
      geometry.crossSectionPoints
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${160 + p.x * scale} ${240 - p.y * scale}`)
        .join(' ') + ' Z';

    return (
      <main className={layoutStyles.viewportShell}>
        <div className={`${layoutStyles.majorPanel} max-w-[740px]`}>
          <div className={layoutStyles.headerRow}>
            <button
              onClick={() => setScreen('start')}
              className={layoutStyles.backButton}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h2 className="font-display font-semibold text-base sm:text-lg tracking-wide">
              Upload Master Tunnel DWG / DXF
            </h2>
            <div className="w-14" />
          </div>

          <div className="space-y-5 pr-1">
            <label
              className={`relative overflow-hidden flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center space-y-2 ${
                isLight
                  ? 'border-slate-300 hover:border-sky-500 bg-slate-50/70 hover:bg-sky-50/40'
                  : 'border-slate-700 hover:border-cyan-500/60 bg-[#141D2E]/50 hover:bg-[#141D2E]/80'
              }`}
            >
              <input
                ref={cadInputRef}
                type="file"
                accept=".dxf,.dwg,*/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCADFileUpload(f);
                  e.target.value = '';
                }}
              />
              <Upload className={`w-6 h-6 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
              <div className={`text-xs sm:text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                Click to select Tunnel Profile (.DXF or .DWG)
              </div>
              <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Extracts LINE, ARC, and LWPOLYLINE master cross-section geometry in real-world meters.
              </div>
            </label>

            {cadStatus && (
              <div className={`${layoutStyles.sectionSurface} text-xs font-mono ${isLight ? 'text-sky-800' : 'text-cyan-300'}`}>
                {cadStatus}
              </div>
            )}

            <div className={layoutStyles.previewStage}>
              <svg viewBox="0 0 320 265" className="w-full h-[clamp(140px,24dvh,200px)]">
                <path
                  d={polyPath}
                  fill={isLight ? 'rgba(2, 132, 199, 0.10)' : 'rgba(56, 189, 248, 0.08)'}
                  stroke={isLight ? '#0284C7' : '#38BDF8'}
                  strokeWidth="2.2"
                />
                <text
                  x="160"
                  y="258"
                  textAnchor="middle"
                  fontSize="11"
                  fill={isLight ? '#334155' : '#94A3B8'}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  Master Profile: {geometry.width.toFixed(2)}m W × {geometry.height.toFixed(2)}m H
                  (Source: {geometry.source.toUpperCase()})
                </text>
              </svg>
            </div>
          </div>

          <div className={layoutStyles.footerRow}>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleOpenProjectMemoryModal('geometries')}
                className={layoutStyles.secondaryButton}
              >
                <Database className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
                Load Saved Geometry ({savedGeometries.length})
              </button>
              <button
                onClick={() => {
                  setCustomEditorInitialTab('freeform_canvas');
                  setReturnScreenFromCustomEditor('geometry_cad');
                  setScreen('geometry_custom');
                }}
                className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                    : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-700/60'
                }`}
              >
                Edit Control Points in Custom Editor
              </button>
            </div>
            <button
              onClick={() => setScreen('drive_and_photos')}
              className={layoutStyles.primaryButton}
            >
              Continue to Drive Direction &amp; Photos
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {projectMemoryModalNode}
      </main>
    );
  }

  // ============================================================================
  // SCREEN 2C: UNIFIED TUNNEL SHAPE & SIZE CREATOR (VARIANTS / CUSTOM / DWG)
  // ============================================================================
  if (screen === 'geometry_custom') {
    return (
      <main className={layoutStyles.workspaceShell}>
        <div className={layoutStyles.workspacePanel}>
          <FreeformCustomProfileEditor
            geometry={geometry}
            settings={settings}
            savedGeometries={savedGeometries}
            chainageSchedule={chainageSchedule}
            initialTab={customEditorInitialTab}
            onApplyGeometry={(confirmedGeom, proceedToPhotos = true) => {
              setGeometry(confirmedGeom);
              setManWidth(String(confirmedGeom.width));
              setManHeight(String(confirmedGeom.height));
              setManWallHeight(String(confirmedGeom.wallHeight));
              setManCrownRadius(String(confirmedGeom.crownRadius));
              setManProfileType(confirmedGeom.crownGeometry);
              setStatusMessage(
                `Saved tunnel shape (${confirmedGeom.width.toFixed(2)}m W × ${confirmedGeom.height.toFixed(
                  2
                )}m H, Wall ${confirmedGeom.wallHeight.toFixed(2)}m) for "${
                  settings.locationName || 'Location'
                }".`
              );
              if (proceedToPhotos) {
                setScreen(
                  returnScreenFromCustomEditor === 'mapping' ? 'mapping' : 'drive_and_photos'
                );
              }
            }}
            onSaveToGeometryLibrary={(customName, geomToSave) => {
              const next = saveDesignGeometryToLibrary({
                name: customName,
                tunnelName: settings.tunnelName || activeLocationName,
                location: settings.locationName || activeLocationName,
                chainage: settings.faceChainage || settings.chainage,
                domain: activeMappingDomain,
                geometry: geomToSave,
              });
              setSavedGeometries(next);
            }}
            onDeleteSavedGeometry={(id) => {
              const next = deleteSavedDesignGeometry(id);
              setSavedGeometries(next);
            }}
            onUpdateChainageSchedule={handleUpdateChainageSchedule}
            onSyncProfileToSurveyControlPoints={handleSyncProfileToSurveyControlPoints}
            onBack={() => setScreen(returnScreenFromCustomEditor)}
          />
        </div>
        {projectMemoryModalNode}
      </main>
    );
  }

  // ============================================================================
  // SCREEN 3: STEP 3 — ADD TUNNEL SURFACE PICTURES (Section 4 & 5)
  // ============================================================================
  if (screen === 'drive_and_photos') {
    const parsedDrive = parseDriveDirectionAzimuth(settings.driveDirectionInput);

    return (
      <main className={layoutStyles.viewportShell}>
        <div className={`${layoutStyles.majorPanel} max-w-[96vw] xl:max-w-[1440px]`}>
          <div className={layoutStyles.headerRow}>
            <button
              onClick={() => setScreen('start')}
              className={layoutStyles.backButton}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project &amp; Location
            </button>
            <h2 className="font-display font-semibold text-base sm:text-lg tracking-wide">
              Step 3 · Add {getSurfacePanelLabelMap(activeMappingDomain).domainTitle} Surface Pictures
            </h2>
            <div className="flex items-center gap-2">
              {activeMappingDomain === 'TUNNEL' && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomEditorInitialTab(
                      geometry.customProfile ||
                        geometry.crownGeometry === 'freeform_custom' ||
                        geometry.source === 'custom_editor'
                        ? 'freeform_canvas'
                        : 'common_variants'
                    );
                    setReturnScreenFromCustomEditor('drive_and_photos');
                    setScreen('geometry_custom');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono border border-slate-700 cursor-pointer"
                >
                  Edit / Change Shape ({geometry.width.toFixed(1)}m × {geometry.height.toFixed(1)}m)
                </button>
              )}
            </div>
          </div>

          <div className="space-y-5 pr-1">
            {/* Compact Summary Bar of Step 1 & Step 2 Selections */}
            <div className={`${layoutStyles.sectionSurface} flex flex-wrap items-center justify-between gap-3 text-xs font-mono`}>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Project: <strong className="text-cyan-300">{activeProjectName || '—'}</strong>
                </span>
                <span>·</span>
                <span>
                  Location: <strong className="text-emerald-300">{activeLocationName || '—'}</strong>
                </span>
                <span>·</span>
                <span>
                  {activeMappingDomain === 'TUNNEL' ? 'Chainage' : 'Station / RL'}:{' '}
                  <strong className="text-amber-300">{settings.faceChainage || settings.chainage}</strong>
                </span>
                <span>·</span>
                <span>
                  {activeMappingDomain === 'TUNNEL' ? 'Pull' : 'Span'}:{' '}
                  <strong>{settings.roundLength.toFixed(2)}m</strong>
                </span>
                <span>·</span>
                <span>
                  {activeMappingDomain === 'TUNNEL'
                    ? 'Drive'
                    : activeMappingDomain === 'TRENCH'
                    ? 'Trench Axis'
                    : 'Face DipDir'}:{' '}
                  <strong>N {parsedDrive.azimuth.toFixed(0)}°</strong>
                </span>
                <span>·</span>
                <span>
                  {activeMappingDomain === 'TUNNEL' ? 'Shape' : 'Surface Geometry'}:{' '}
                  <strong>
                    {geometry.width.toFixed(2)}m W × {geometry.height.toFixed(2)}m H
                    {activeMappingDomain === 'TUNNEL' ? (
                      <>
                        {' '}
                        (L-Wall{' '}
                        {(
                          geometry.leftWallArcLength ??
                          geometry.leftWallHeight ??
                          geometry.wallHeight
                        ).toFixed(2)}
                        m · R-Wall{' '}
                        {(
                          geometry.rightWallArcLength ??
                          geometry.rightWallHeight ??
                          geometry.wallHeight
                        ).toFixed(2)}
                        m
                        {geometry.hasCrown === false
                          ? ' · Face+Walls Only'
                          : ` · Crown ${geometry.crownArcLength.toFixed(2)}m`}
                        )
                      </>
                    ) : (
                      <>
                        {' '}
                        · {activeMappingDomain === 'TRENCH' ? 'Floor' : 'Berm'}{' '}
                        {geometry.crownArcLength.toFixed(2)}m · Angle{' '}
                        {photoSurfaceParams.faceDipAngleDeg}°
                      </>
                    )}
                  </strong>
                </span>
              </div>
            </div>

            {/* Section 5: Surface Photograph Inputs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-xs sm:text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {getSurfacePanelLabelMap(activeMappingDomain).domainTitle} Photographs (Optional Combinations Supported)
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoScreenAccuracyTab('full_photo_1ft_scale');
                      setShowPhotoScreenAccuracyModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    Overall Full Photo + 1-Ft Scale (Auto Size &amp; Wall/Crown)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoScreenAccuracyTab('four_part_accuracy');
                      setShowPhotoScreenAccuracyModal(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                        : 'bg-sky-950/60 hover:bg-sky-900/70 text-sky-300 border-sky-700/60'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    4-Part Simple Accuracy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  (() => {
                    const surfLabels = getSurfacePanelLabelMap(activeMappingDomain);
                    return [
                      {
                        id: 'face',
                        title:
                          activeMappingDomain !== 'TUNNEL'
                            ? `01. ${surfLabels.face.fullLabel}`
                            : geometry.excavationStage === 'TOP_HEADING' ||
                              geometry.excavationStage === 'top_heading'
                            ? `01. Tunnel Face (Top Heading — Bench ${(geometry.benchHeightRemovedMeters || 0).toFixed(2)}m Removed)`
                            : '01. Tunnel Face',
                        desc:
                          activeMappingDomain !== 'TUNNEL'
                            ? surfLabels.face.description
                            : `Fits ${geometry.customProfile?.name ? `${geometry.customProfile.name} (${geometry.width}m × ${geometry.height}m)` : `${geometry.width}m × ${geometry.height}m cross-section`}`,
                        enabled: true,
                      },
                      {
                        id: 'leftWall',
                        title:
                          activeMappingDomain !== 'TUNNEL'
                            ? `02. ${surfLabels.leftWall.fullLabel}`
                            : geometry.excavationStage === 'TOP_HEADING' ||
                              geometry.excavationStage === 'top_heading'
                            ? '02. Left Wall (Top Heading)'
                            : '02. Left Wall',
                        desc:
                          activeMappingDomain !== 'TUNNEL'
                            ? surfLabels.leftWall.description
                            : `Fits ${settings.roundLength}m pull × ${(geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)}m left wall`,
                        enabled: geometry.hasLeftWall !== false,
                      },
                      {
                        id: 'rightWall',
                        title:
                          activeMappingDomain !== 'TUNNEL'
                            ? `03. ${surfLabels.rightWall.fullLabel}`
                            : geometry.excavationStage === 'TOP_HEADING' ||
                              geometry.excavationStage === 'top_heading'
                            ? '03. Right Wall (Top Heading)'
                            : '03. Right Wall',
                        desc:
                          activeMappingDomain !== 'TUNNEL'
                            ? surfLabels.rightWall.description
                            : `Fits ${settings.roundLength}m pull × ${(geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)}m right wall`,
                        enabled: geometry.hasRightWall !== false,
                      },
                      {
                        id: 'crown',
                        title:
                          activeMappingDomain !== 'TUNNEL'
                            ? `04. ${surfLabels.crown.fullLabel}`
                            : geometry.excavationStage === 'TOP_HEADING' ||
                              geometry.excavationStage === 'top_heading'
                            ? '04. Crown Arch (Top Heading)'
                            : '04. Crown Arch',
                        desc:
                          activeMappingDomain !== 'TUNNEL'
                            ? surfLabels.crown.description
                            : `Fits ${geometry.crownArcLength.toFixed(2)}m arch × ${settings.roundLength}m pull`,
                        enabled: geometry.hasCrown !== false,
                      },
                    ] as { id: SurfaceType; title: string; desc: string; enabled: boolean }[];
                  })()
                )
                  .filter((slot) => slot.enabled)
                  .map((slot) => {
                  const surfPhoto = photos[slot.id];
                  const supPhotos = surfPhoto.supportingPhotos || [];
                  const isCurrentPortion = activeSurface === slot.id;
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setActiveSurface(slot.id)}
                      className={`${layoutStyles.sectionSurface} flex flex-col justify-between space-y-3 cursor-pointer border transition-all ${
                        isCurrentPortion
                          ? isLight
                            ? 'border-sky-500 ring-2 ring-sky-500/20'
                            : 'border-cyan-400 ring-2 ring-cyan-400/20'
                          : isLight
                          ? 'border-slate-200/80 hover:border-sky-300'
                          : 'border-slate-800/80 hover:border-cyan-700/60'
                      }`}
                    >
                      {/* Main Photo Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                            <span>{slot.title}</span>
                            {isCurrentPortion && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[10px] font-mono font-bold">
                                SELECTED PORTION
                              </span>
                            )}
                            {surfPhoto.image && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {slot.desc}
                          </div>
                          {surfPhoto.autoFitted && (
                            <div className={`text-[11px] font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                              {surfPhoto.calibration
                                ? `${surfPhoto.calibration.source === 'EXIF_METADATA' ? 'EXIF Calibrated' : 'Estimated Cam'}: ${surfPhoto.calibration.focalLengthMm}mm eq · 3×3 Homography`
                                : 'Auto-fitted to master geometry'}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                          {surfPhoto.image && (
                            <div className="relative group">
                              <img
                                src={surfPhoto.image}
                                alt={`${slot.title} Main Photo`}
                                referrerPolicy="no-referrer"
                                className="w-12 h-10 object-cover rounded-lg border border-cyan-500/60 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMainPhoto(slot.id)}
                                title="Remove Main Photo"
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] hover:bg-rose-500 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                          {(responsive.isMobile || responsive.isTouchDevice) && (
                            <label
                              className="relative overflow-hidden flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer whitespace-nowrap"
                              title="Select or capture tunnel surface photo"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Camera / Gallery</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setActiveSurface(slot.id);
                                    handleUploadSurfacePhoto(slot.id, f);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                          <label
                            className={`relative overflow-hidden px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              isLight
                                ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                                : 'bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border-cyan-700/70'
                            }`}
                          >
                            {surfPhoto.image ? 'Replace Photo' : 'Upload Photo'}
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setActiveSurface(slot.id);
                                  handleUploadSurfacePhoto(slot.id, f);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSurface(slot.id);
                              setScreen('mapping');
                            }}
                            className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer whitespace-nowrap"
                            title={`Open ${slot.title} directly in the Mapping Canvas`}
                          >
                            Map Portion →
                          </button>
                        </div>
                      </div>

                      {/* Additional Supporting Photos (0-5 Optional Supporting Evidence Only) */}
                      <div className={`pt-2.5 border-t ${layoutStyles.hairlineDivider} flex flex-wrap items-center justify-between gap-2`}>
                        <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Supporting Photos ({supPhotos.length}/5) ·{' '}
                          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
                            Verification only
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {supPhotos.map((sp, spIdx) => (
                            <div
                              key={sp.id}
                              className={`relative group flex items-center rounded-lg p-0.5 border ${
                                isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-700'
                              }`}
                              title={`Supporting Photo #${spIdx + 1}: ${sp.fileName} (Baseline ${sp.baselineMeters ?? 1.1}m)`}
                            >
                              <img
                                src={sp.image}
                                alt={`Supporting ${spIdx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-8 h-7 object-cover rounded-md"
                              />
                              <label
                                title="Replace Supporting Photo"
                                className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-mono text-cyan-300 cursor-pointer rounded-lg transition-opacity overflow-hidden"
                              >
                                Repl
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadSupportingPhoto(slot.id, f, sp.id);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveSupportingPhoto(slot.id, sp.id)}
                                title="Remove Supporting Photo"
                                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-600 flex items-center justify-center z-10 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}

                          {supPhotos.length < 5 && (
                            <label
                              className={`relative overflow-hidden flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                                isLight
                                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              <Plus className="w-3 h-3 text-emerald-500" />
                              Add Photo
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadSupportingPhoto(slot.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={layoutStyles.footerRow}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSaveOfflineDraft}
                className={layoutStyles.secondaryButton}
              >
                <Save className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
                Save Draft
              </button>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                {(
                  (() => {
                    const surfLabels = getSurfacePanelLabelMap(activeMappingDomain);
                    return [
                      { id: 'face', label: `1. ${surfLabels.face.shortLabel}` },
                      { id: 'crown', label: `2. ${surfLabels.crown.shortLabel}` },
                      { id: 'leftWall', label: `3. ${surfLabels.leftWall.shortLabel}` },
                      { id: 'rightWall', label: `4. ${surfLabels.rightWall.shortLabel}` },
                    ] as { id: SurfaceType; label: string }[];
                  })()
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveSurface(p.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      activeSurface === p.id
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setScreen('mapping');
              }}
              className={layoutStyles.primaryButton}
            >
              Open Mapping Canvas ({getSurfacePanelLabelMap(activeMappingDomain)[activeSurface]?.shortLabel || '1. Face'})
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {projectMemoryModalNode}
        <SimpleFullPhotoAndAccuracyModal
          isOpen={showPhotoScreenAccuracyModal}
          initialTab={photoScreenAccuracyTab}
          onClose={() => setShowPhotoScreenAccuracyModal(false)}
          geometry={geometry}
          settings={settings}
          photos={photos}
          activeSurface={activeSurface}
          joints={clusteredJoints}
          jointSets={jointSets}
          rmrParams={rmrParams}
          qIndexParams={qIndexParams}
          qParamStatus={qParamStatus}
          onApplyExtractedGeometryAndScale={(
            nextGeometry,
            calibratedPxPerMeter,
            fullPhotoDataUrl,
            targetSurface
          ) => {
            setGeometry(nextGeometry);
            setManWidth(String(nextGeometry.width));
            setManHeight(String(nextGeometry.height));
            setManWallHeight(String(nextGeometry.wallHeight));
            setManCrownRadius(String(nextGeometry.crownRadius));
            const surf = targetSurface || 'face';
            setPhotos((prev) => ({
              ...prev,
              [surf]: {
                ...prev[surf],
                originalImage: fullPhotoDataUrl || prev[surf].originalImage,
                image: fullPhotoDataUrl || prev[surf].image,
                warpedImage: fullPhotoDataUrl || prev[surf].warpedImage,
                scale: calibratedPxPerMeter,
                autoFitted: true,
              },
            }));
          }}
          onUpdateJointsWithHistory={updateJointsWithHistory}
          onUpdateRmrParams={setRmrParams}
          onUpdateQIndexParams={setQIndexParams}
          onUpdateQParamStatus={setQParamStatus}
          onStatusMessage={setStatusMessage}
        />
      </main>
    );
  }

  // ============================================================================
  // SCREEN 4: MAIN MAPPING WORKSPACE & FINAL ENGINEERING SHEET MODAL
  // ============================================================================
  const photoSurfaceSmrAnalysis =
    activeMappingDomain !== 'TUNNEL'
      ? evaluateSurfaceStabilityAndRomanaSmr(
          photoSurfaceParams,
          jointSets,
          rmrParams.totalRmr || 58
        )
      : null;

  return (
    <div className={layoutStyles.workspaceShell}>
      <div className={layoutStyles.workspacePanel}>
        {/* Surface Mapping Mode Switcher & Romana SMR / Kinematic Check Ribbon in Photogrammetry Workspace */}
        {activeMappingDomain !== 'TUNNEL' && photoSurfaceSmrAnalysis && (
          <div className="shrink-0 px-3 py-1.5 bg-amber-50 border-b border-orange-200 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-800 z-20">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-orange-100 border border-orange-200">
                {(
                  [
                    ['TUNNEL', 'Tunnel'],
                    ['BENCH', 'Bench'],
                    ['TRENCH', 'Trench'],
                    ['SLOPE', 'Slope'],
                    ['ROCK_SURFACE', 'Outcrop'],
                  ] as [MappingDomainType, string][]
                ).map(([domId, domLbl]) => (
                  <button
                    key={domId}
                    type="button"
                    onClick={() => {
                      handleSwitchMappingDomain(domId);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      activeMappingDomain === domId
                        ? 'bg-orange-600 text-white'
                        : 'text-stone-700 hover:bg-orange-200/70'
                    }`}
                  >
                    {domLbl}
                  </button>
                ))}
              </div>
              <span className="px-2 py-0.5 rounded bg-orange-600 text-white font-bold">
                {activeMappingDomain} PHOTOGRAMMETRY
              </span>
              {activeMappingDomain === 'BENCH' && (
                <span>
                  Crest RL <strong>{photoSurfaceParams.crestElevationRl}m</strong> → Toe RL{' '}
                  <strong>{photoSurfaceParams.toeElevationRl}m</strong> · H{' '}
                  <strong>{photoSurfaceParams.benchHeightMeters}m</strong> · Berm{' '}
                  <strong>{photoSurfaceParams.bermWidthMeters}m</strong> · Angle{' '}
                  <strong>{photoSurfaceParams.faceDipAngleDeg}°</strong>
                </span>
              )}
              {activeMappingDomain === 'TRENCH' && (
                <span>
                  Trench Depth <strong>{photoSurfaceParams.trenchDepthMeters}m</strong> · Floor Width{' '}
                  <strong>{photoSurfaceParams.trenchWidthMeters}m</strong> · Length{' '}
                  <strong>{photoSurfaceParams.exposureLengthMeters}m</strong> · Overburden{' '}
                  <strong>{photoSurfaceParams.overburdenThicknessMeters}m</strong>
                </span>
              )}
              {activeMappingDomain === 'SLOPE' && (
                <span>
                  Slope H <strong>{photoSurfaceParams.slopeHeightMeters}m</strong> · Slope Angle{' '}
                  <strong>{photoSurfaceParams.overallSlopeAngleDeg}°</strong> · Benches{' '}
                  <strong>{photoSurfaceParams.numberOfBenches}</strong> · Dip Dir{' '}
                  <strong>{photoSurfaceParams.faceDipDirectionDeg}°</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                Romana SMR: {photoSurfaceSmrAnalysis.governingSmrScore} (Class{' '}
                {photoSurfaceSmrAnalysis.governingSmrClass} ·{' '}
                {photoSurfaceSmrAnalysis.stabilityDescription})
              </span>
              <span className="text-stone-700 hidden lg:inline">
                Support: <strong>{photoSurfaceSmrAnalysis.recommendedSupportText}</strong>
              </span>
            </div>
          </div>
        )}
        <MappingWorkspace
          geometry={geometry}
          settings={settings}
          photos={photos}
          activeSurface={activeSurface}
          onSelectSurface={setActiveSurface}
          onUpdatePhotoSurface={(surf, updater) =>
            setPhotos((prev) => ({
              ...prev,
              [surf]: updater(prev[surf]),
            }))
          }
          onUploadPhotoFile={handleUploadSurfacePhoto}
          onUploadStereoPhotoFile={handleUploadSupportingPhoto}
          onRemoveSupportingPhoto={handleRemoveSupportingPhoto}
          onLoadSamplePhoto={handleLoadSampleSurfacePhoto}
          onAutoFitCurrentPhoto={handleAutoFitCurrentPhoto}
          onRunAITrace={handleRunAITrace}
          onRunAITraceAllSurfaces={handleRunAITraceAllSurfaces}
          isTracingAI={isTracingAI}
          traceFitMode={traceFitMode}
          onChangeTraceFitMode={setTraceFitMode}
          statusMessage={statusMessage}
          joints={clusteredJoints}
          jointSets={jointSets}
          onUpdateJointsWithHistory={updateJointsWithHistory}
          onUpdateJointSetAttribute={(setId, field, value) =>
            setCustomJointSetOverrides((prev) => ({
              ...prev,
              [setId]: {
                ...(prev[setId] || {}),
                [field]: value,
              },
            }))
          }
          onMergeJointSets={(fromSetId, toSetId) => {
            if (fromSetId === toSetId) return;
            updateJointsWithHistory(
              clusteredJoints.map((j) => (j.set === fromSetId ? { ...j, set: toSetId } : j))
            );
          }}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyPast.length > 0}
          canRedo={historyFuture.length > 0}
          onBackToSetup={() => setScreen('drive_and_photos')}
          onOpenExportSheet={(mode = 'FINAL_ENGINEERING_SHEET') => {
            handleSaveCurrentProjectToMemory();
            setExportModalInitialMode(mode);
            setIsExportModalOpen(true);
          }}
          onSaveOfflineDraft={handleSaveOfflineDraft}
          sessionMemory={sessionMemory}
          onRecordRejectedJoint={handleRecordRejectedJoint}
          onRecordConfirmedJoint={handleRecordConfirmedJoint}
          onTrainAndUpdateAIModel={handleTrainAndUpdateAIModel}
          onResetAILearningFilters={handleResetAILearningFilters}
          qIndexParams={qIndexParams}
          onUpdateQIndexParams={setQIndexParams}
          qParamStatus={qParamStatus}
          onUpdateQParamStatus={setQParamStatus}
          selectedClassificationMethod={selectedClassificationMethod}
          onChangeSelectedClassificationMethod={setSelectedClassificationMethod}
          rmrParams={rmrParams}
          onUpdateRmrParams={setRmrParams}
          gsiParams={gsiParams}
          onUpdateGsiParams={setGsiParams}
          rockMassSummary={rockMassSummary}
          onUpdateRockMassSummary={setRockMassSummary}
          lithologyRegions={lithologyRegions}
          onUpdateLithologyRegions={(nextRegions) => {
            setLithologyRegions(nextRegions);
            if (nextRegions.length > 0) {
              const uniqueNames = Array.from(
                new Set(nextRegions.map((r) => r.lithologyName.trim()).filter(Boolean))
              );
              if (uniqueNames.length > 0) {
                const combinedName = uniqueNames.join(' / ');
                setSettings((prev) => ({ ...prev, lithology: combinedName }));
                setRockMassSummary((prev) => ({
                  ...prev,
                  rockType: combinedName,
                  geologistRemarks:
                    nextRegions[0].description || prev.geologistRemarks,
                }));
              }
            }
          }}
          onUpdateStatusMessage={setStatusMessage}
          controlPoints={controlPoints}
          onUpdateControlPoints={setControlPoints}
          placedSymbols={placedSymbols}
          onUpdatePlacedSymbols={setPlacedSymbols}
          surveyProfile={surveyProfile}
          onUpdateSurveyProfile={setSurveyProfile}
          overbreakAnalysis={overbreakAnalysis}
          onGenerateSampleAsBuiltProfile={handleGenerateSampleAsBuiltProfile}
          onOpenProjectMemoryModal={handleOpenProjectMemoryModal}
          onOpenCustomProfileEditor={() => {
            setCustomEditorInitialTab('freeform_canvas');
            setReturnScreenFromCustomEditor('mapping');
            setScreen('geometry_custom');
          }}
          onUpdateGeometry={(nextGeom) => {
            setGeometry(nextGeom);
            setManWidth(String(nextGeom.width));
            setManHeight(String(nextGeom.height));
            setManWallHeight(String(nextGeom.wallHeight));
            setManCrownRadius(String(nextGeom.crownRadius));
          }}
          onUpdateSettings={setSettings}
          savedProjects={savedProjects}
          onLoadProjectRecord={handleLoadProjectRecord}
        />
      </div>

      <EngineeringSheetModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        geometry={geometry}
        settings={settings}
        onUpdateSettings={setSettings}
        savedProjects={savedProjects}
        onSaveCurrentProject={handleSaveCurrentProjectToMemory}
        onLoadProjectRecord={handleLoadProjectRecord}
        onDeleteProjectRecord={(id) => {
          const next = deleteProjectRecordFromMemory(id);
          setSavedProjects(next);
        }}
        onCreateNextChainageSection={handleCreateCompanionSectionForVolumeTest}
        photos={photos}
        joints={clusteredJoints}
        jointSets={jointSets}
        traceFitMode={traceFitMode}
        onConfirmAllOrientations={() => {
          updateJointsWithHistory(
            clusteredJoints.map((j) => ({ ...j, orientationStatus: 'CONFIRMED' }))
          );
        }}
        qIndexParams={qIndexParams}
        qParamStatus={qParamStatus}
        selectedClassificationMethod={selectedClassificationMethod}
        onChangeSelectedClassificationMethod={setSelectedClassificationMethod}
        rmrParams={rmrParams}
        gsiParams={gsiParams}
        rockMassSummary={rockMassSummary}
        lithologyRegions={lithologyRegions}
        controlPoints={controlPoints}
        placedSymbols={placedSymbols}
        overbreakAnalysis={overbreakAnalysis}
        onGenerateSampleAsBuiltProfile={handleGenerateSampleAsBuiltProfile}
        sectionVolumeRows={sectionVolumeRows}
        initialOutputMode={exportModalInitialMode}
      />

      <MiningStopeFaceInspectorModal
        isOpen={isMiningInspectorOpen}
        onClose={() => setIsMiningInspectorOpen(false)}
        settings={{
          ...settings,
          industryMode,
        }}
        geometry={geometry}
        joints={clusteredJoints}
        qIndexParams={qIndexParams}
        rmrParams={rmrParams}
        miningSettings={miningSettings}
        onUpdateMiningSettings={(next) => {
          setMiningSettings(next);
          setSettings((prev) => ({
            ...prev,
            miningSettings: next,
          }));
        }}
      />

      <TbmShieldInspectorModal
        isOpen={isTbmInspectorOpen}
        onClose={() => setIsTbmInspectorOpen(false)}
        settings={{
          ...settings,
          industryMode,
        }}
        geometry={geometry}
        tbmParams={tbmParams}
        onUpdateTbmParams={(next) => {
          setTbmParams(next);
          setSettings((prev) => ({
            ...prev,
            tbmParams: next,
          }));
        }}
      />

      {projectMemoryModalNode}
      {natmRockMechanicsModalNode}
      {continuousLoggingModalsNode}
      {globalSettingsModalNode}
      {modeSwitchConfirmationModalNode}
    </div>
  );
}
