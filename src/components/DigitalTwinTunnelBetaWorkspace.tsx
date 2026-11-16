import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Download,
  Eye,
  FolderPlus,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  Ruler,
  Scissors,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { TunnelGeometry } from '../types/tunnel';
import { createTunnelGeometry } from '../engine/geometryEngine';
import { buildAuthoritativeCustomTunnelGeometry } from '../engine/customProfileEngine';
import { FreeformCustomProfileEditor } from './FreeformCustomProfileEditor';
import { EswaTunnelLogo } from './EswaBrandIdentity';
import { FieldMappingModeWorkspace } from './FieldMappingModeWorkspace';
import {
  analyzePhotoForDigitalTwinSlot,
  buildStitched20PhotoTextureCanvas,
  buildTheoreticalDesignReferenceLoop,
  buildUser3DJointFromClickedPoints,
  computeLocal3DFacetOrientationAtPoint,
  createManual3DJointAndDipSurface,
  DIGITAL_TWIN_20_PHOTO_SPECS,
  DigitalTwinBetaStore,
  DigitalTwinCameraStationId,
  DigitalTwinLocationRecord,
  DigitalTwinProjectRecord,
  DigitalTwinRoundRecord,
  export3DJointsAndDipSurfacesToDXF,
  export3DJointsAuditToCSV,
  exportReconstructed3DToOBJ,
  exportSliceCrossSectionToDXF,
  Extracted3DJointAndDipSurface,
  Extracted3DRockFacet,
  generateSynthetic20PhotoSetForLocation,
  isPhotoSlotPopulated,
  Joint3DSetId,
  Joint3DValidationStatus,
  loadDigitalTwinBetaStore,
  recomputeEdited3DJointGeometry,
  reconstructReal3DTunnelFrom20Photos,
  runFourEngineConsensus3DExtraction,
  saveDigitalTwinBetaStore,
  snapJointTo4EngineFisherConsensus,
  sync3DDigitalTwinRoundTo2DUndergroundStore,
  syncAll3DDigitalTwinLocationRoundsTo2DStore,
  Tunnel3DExcavationZone,
} from '../engine/digitalTwin20PhotoEngine';

export interface DigitalTwinTunnelBetaWorkspaceProps {
  onBackToMainMenu: () => void;
  resumeAtLastStep?: boolean;
  onOpenContinuous3DTwinLog?: () => void;
}

export const DigitalTwinTunnelBetaWorkspace: React.FC<
  DigitalTwinTunnelBetaWorkspaceProps
> = ({
  onBackToMainMenu,
  resumeAtLastStep = false,
  onOpenContinuous3DTwinLog,
}) => {
  const [store, setStore] = useState<DigitalTwinBetaStore>(() =>
    loadDigitalTwinBetaStore()
  );

  const [activeStep, setActiveStep] = useState<
    | 'setup'
    | 'capture_20'
    | 'reconstruct_3d'
    | 'joint_dip_inspector_window'
    | 'unfold_3d_to_2d'
  >(() => {
    const initial = loadDigitalTwinBetaStore();
    if (
      resumeAtLastStep &&
      initial.activeProjectId &&
      initial.activeLocationId &&
      initial.activeRoundId
    ) {
      return initial.lastActiveStep || 'capture_20';
    }
    return 'setup';
  });

  const [unfold2DSyncVersion, setUnfold2DSyncVersion] = useState<number>(1);
  const [unfold2DTargetViewMode, setUnfold2DTargetViewMode] = useState<
    '2d_canvas' | '3d_flat_tunnel' | 'strip_log'
  >('2d_canvas');

  const is3DViewportStep =
    activeStep === 'reconstruct_3d' ||
    activeStep === 'joint_dip_inspector_window';

  useEffect(() => {
    saveDigitalTwinBetaStore({
      ...store,
      lastActiveStep: activeStep,
    });
  }, [store, activeStep]);

  const activeProject = useMemo(
    () =>
      store.projects.find((p) => p.id === store.activeProjectId) ||
      store.projects[0] ||
      null,
    [store.projects, store.activeProjectId]
  );

  const activeLocation = useMemo(
    () =>
      activeProject?.locations.find((l) => l.id === store.activeLocationId) ||
      activeProject?.locations[0] ||
      null,
    [activeProject, store.activeLocationId]
  );

  const activeRound = useMemo(
    () =>
      store.rounds.find(
        (r) =>
          r.id === store.activeRoundId &&
          r.projectId === activeProject?.id &&
          r.locationId === activeLocation?.id
      ) ||
      store.rounds.find(
        (r) =>
          r.projectId === activeProject?.id && r.locationId === activeLocation?.id
      ) ||
      null,
    [store.rounds, store.activeRoundId, activeProject?.id, activeLocation?.id]
  );

  // Automatic One-Way Sync (3D Digital Twin Location Rounds ➔ 2D Underground Face Mapping Store)
  useEffect(() => {
    if (!activeProject || !activeLocation) return;
    const locRounds = store.rounds.filter(
      (r) =>
        r.projectId === activeProject.id && r.locationId === activeLocation.id
    );
    if (locRounds.length === 0) return;
    syncAll3DDigitalTwinLocationRoundsTo2DStore({
      dtProject: activeProject,
      dtLocation: activeLocation,
      dtRounds: locRounds,
      preferredActiveRoundId: activeRound?.id || store.activeRoundId,
    });
  }, [
    activeProject,
    activeLocation,
    store.rounds,
    activeRound?.id,
    store.activeRoundId,
  ]);

  // Project creation form state
  const [showNewProjForm, setShowNewProjForm] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjClient, setNewProjClient] = useState('');
  const [newProjContractor, setNewProjContractor] = useState('');
  const [newProjConsultant, setNewProjConsultant] = useState('');

  // Location creation form state
  const [showNewLocForm, setShowNewLocForm] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocShape, setNewLocShape] = useState<
    'horseshoe' | 'd_shaped' | 'circular' | 'rectangular' | 'custom_profile'
  >('horseshoe');
  const [newLocWidth, setNewLocWidth] = useState('8.5');
  const [newLocHeight, setNewLocHeight] = useState('7.5');
  const [newLocWallHeight, setNewLocWallHeight] = useState('4.0');
  const [newLocCrownRadius, setNewLocCrownRadius] = useState('4.25');
  const [newLocAzimuth, setNewLocAzimuth] = useState('45');
  const [newLocCustomGeom, setNewLocCustomGeom] = useState<TunnelGeometry | null>(
    null
  );

  // Custom Shape Builder Modal State
  const [customBuilderMode, setCustomBuilderMode] = useState<
    'closed' | 'new_location' | 'active_location'
  >('closed');

  // Round creation form state
  const [showNewRoundForm, setShowNewRoundForm] = useState(false);
  const [newRoundFrom, setNewRoundFrom] = useState('100.0');
  const [newRoundTo, setNewRoundTo] = useState('103.5');
  const [newRoundAzimuth, setNewRoundAzimuth] = useState('45');
  const [newRoundMode, setNewRoundMode] = useState<
    'field_camera' | 'photogrammetry_upload'
  >('photogrammetry_upload');

  // Step 2: 20-Photo Capture / Upload State
  const [selectedStationTab, setSelectedStationTab] = useState<
    'ALL' | DigitalTwinCameraStationId
  >('ALL');
  const [activeSlotNumber, setActiveSlotNumber] = useState<number>(1);
  const [isBusyLoadingPhotos, setIsBusyLoadingPhotos] = useState(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const singleSlotInputRef = useRef<HTMLInputElement | null>(null);
  const [targetUploadSlot, setTargetUploadSlot] = useState<number>(1);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Step 3: White-Light 3D Reconstruction & Advanced Engineering Inspector State
  const [renderSurfaceMode, setRenderSurfaceMode] = useState<
    | 'textured_rock_mesh'
    | 'rock_with_break_edges'
    | 'dense_point_cloud'
    | 'normal_dip_map'
    | 'overbreak_heatmap'
  >('rock_with_break_edges');
  const [showDesignWireframe, setShowDesignWireframe] = useState<boolean>(true);
  const [showCameraFrustums, setShowCameraFrustums] = useState<boolean>(false);
  const [show3DDipSurfaces, setShow3DDipSurfaces] = useState<boolean>(true);
  const [show3DJointTraces, setShow3DJointTraces] = useState<boolean>(true);
  const [showRejectedDisturbances, setShowRejectedDisturbances] =
    useState<boolean>(false);
  const [showFacetDiscs, setShowFacetDiscs] = useState<boolean>(false);
  const [showKeyBlockWedges, setShowKeyBlockWedges] = useState<boolean>(true);
  const [showChainageSlicer, setShowChainageSlicer] = useState<boolean>(false);
  const [activeSliceIndex, setActiveSliceIndex] = useState<number>(18);

  // 4-Engine Consensus 3D Joint & Dip Surface Inspector State
  const [showJointAnalysisModal, setShowJointAnalysisModal] =
    useState<boolean>(false);
  const [activeJointZoneFilter, setActiveJointZoneFilter] = useState<
    'ALL' | Tunnel3DExcavationZone
  >('ALL');
  const [selected3DJointId, setSelected3DJointId] = useState<string | null>(
    null
  );
  const [isRunning4EnginePipeline, setIsRunning4EnginePipeline] =
    useState<boolean>(false);
  const [fourEngineStageInfo, setFourEngineStageInfo] = useState<{
    stageIndex: number;
    progressPct: number;
    label: string;
  } | null>(null);
  const [newJointPreferredSet, setNewJointPreferredSet] =
    useState<Joint3DSetId>('J1');
  const [pendingNewJointClicks, setPendingNewJointClicks] = useState<
    { x: number; y: number; z: number; nx: number; ny: number; nz: number }[]
  >([]);

  // Interactive 3D Tool Mode ('orbit' | 'ruler' | 'facet_probe' | 'add_3d_joint')
  const [active3DToolMode, setActive3DToolMode] = useState<
    'orbit' | 'ruler' | 'facet_probe' | 'add_3d_joint'
  >('orbit');
  const [rulerPoints, setRulerPoints] = useState<
    { x: number; y: number; z: number; radialDevCm: number }[]
  >([]);
  const [probedFacets, setProbedFacets] = useState<Extracted3DRockFacet[]>([]);
  const [selectedFacetInfo, setSelectedFacetInfo] =
    useState<Extracted3DRockFacet | null>(null);

  const [isBottomDockCollapsed, setIsBottomDockCollapsed] =
    useState<boolean>(false);
  const [inspectedPhotoSlot, setInspectedPhotoSlot] = useState<number | null>(
    null
  );

  // Dedicated Working Window (Step 4: Live 3D Joint, Dip Surface & Twin Inspector Studio) State
  const [dedicatedStudioTab, setDedicatedStudioTab] = useState<
    'edit_add_joints' | 'cross_validation_stereonet' | 'live_twin_inspector'
  >('edit_add_joints');
  const [manualJointZone, setManualJointZone] =
    useState<Tunnel3DExcavationZone>('Left Wall');
  const [manualJointSet, setManualJointSet] = useState<Joint3DSetId>('J1');
  const [manualJointDipDeg, setManualJointDipDeg] = useState<string>('64');
  const [manualJointDipDirDeg, setManualJointDipDirDeg] =
    useState<string>('132');
  const [manualJointPersistenceM, setManualJointPersistenceM] =
    useState<string>('3.4');
  const [manualJointApertureMm, setManualJointApertureMm] =
    useState<string>('2.2');
  const [manualJointJrc, setManualJointJrc] = useState<string>('11.8');

  // Import existing NATM projects from Underground Mapping if user wants
  const handleImportFromNatmUnderground = () => {
    try {
      const raw = localStorage.getItem('eswa_field_mapping_v14_tunnel');
      if (!raw) {
        setStatusToast('No existing NATM Underground Mapping projects found to import.');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
        setStatusToast('No projects found in NATM Underground Mapping storage.');
        return;
      }

      const importedProjects: DigitalTwinProjectRecord[] = parsed.projects.map(
        (p: any) => ({
          id: `dt-imp-${p.id}`,
          projectName: p.projectName || 'Imported NATM Project',
          clientName: p.clientName || '',
          contractorName: p.contractorName || '',
          consultantName: p.consultantName || '',
          createdAtIso: new Date().toISOString(),
          locations: (p.locations || []).map((l: any) => ({
            id: `dt-loc-${l.id}`,
            name: l.name || 'Main Tunnel',
            shape:
              l.shape === 'freeform_custom'
                ? 'custom_profile'
                : l.shape === 'horseshoe' ||
                  l.shape === 'd_shaped' ||
                  l.shape === 'circular' ||
                  l.shape === 'rectangular'
                ? l.shape
                : 'horseshoe',
            widthM: Number(l.widthM) || 8.5,
            heightM: Number(l.heightM) || 7.5,
            wallHeightM: Number(l.wallHeightM) || 4.0,
            crownRadiusM: Number(l.crownRadiusM) || 4.25,
            defaultDriveAzimuthDeg: Number(l.defaultDriveAzimuth) || 45,
            excavationMode: l.excavationMode || 'Drill & Blast (Full Face)',
            customProfile: l.customGeometry?.customProfile,
          })),
        })
      );

      const firstProj = importedProjects[0];
      const firstLoc = firstProj?.locations[0] || null;

      setStore((prev) => ({
        ...prev,
        projects: [...prev.projects, ...importedProjects],
        activeProjectId: firstProj?.id || prev.activeProjectId,
        activeLocationId: firstLoc?.id || prev.activeLocationId,
      }));
      setStatusToast(
        `Imported ${importedProjects.length} project(s) & custom shapes from NATM Underground Mapping.`
      );
    } catch {
      setStatusToast('Unable to import NATM project data.');
    }
  };

  const handleCreateProject = () => {
    if (!newProjName.trim()) {
      setStatusToast('Please enter a Project Name.');
      return;
    }
    const newProj: DigitalTwinProjectRecord = {
      id: `dt-proj-${Date.now()}`,
      projectName: newProjName.trim(),
      clientName: newProjClient.trim(),
      contractorName: newProjContractor.trim(),
      consultantName: newProjConsultant.trim(),
      createdAtIso: new Date().toISOString(),
      locations: [],
    };
    setStore((prev) => ({
      ...prev,
      projects: [...prev.projects, newProj],
      activeProjectId: newProj.id,
      activeLocationId: null,
      activeRoundId: null,
    }));
    setNewProjName('');
    setNewProjClient('');
    setNewProjContractor('');
    setNewProjConsultant('');
    setShowNewProjForm(false);
    setShowNewLocForm(true);
  };

  const handleCreateLocation = () => {
    if (!activeProject) {
      setStatusToast('Select or create a Project first.');
      return;
    }
    if (!newLocName.trim()) {
      setStatusToast('Please enter a Tunnel Location Name.');
      return;
    }
    const w = Math.max(2, Number(newLocWidth) || 8.5);
    const h = Math.max(2, Number(newLocHeight) || 7.5);
    const wh = Math.max(1, Number(newLocWallHeight) || 4.0);
    const cr = Math.max(1, Number(newLocCrownRadius) || w / 2);

    const newLoc: DigitalTwinLocationRecord = {
      id: `dt-loc-${Date.now()}`,
      name: newLocName.trim(),
      shape: newLocCustomGeom?.customProfile ? 'custom_profile' : newLocShape,
      widthM: w,
      heightM: h,
      wallHeightM: wh,
      crownRadiusM: cr,
      defaultDriveAzimuthDeg: Number(newLocAzimuth) || 45,
      excavationMode: 'Drill & Blast (Full Face)',
      customProfile: newLocCustomGeom?.customProfile,
    };

    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id
          ? { ...p, locations: [...p.locations, newLoc] }
          : p
      ),
      activeLocationId: newLoc.id,
      activeRoundId: null,
    }));
    setNewLocName('');
    setNewLocCustomGeom(null);
    setShowNewLocForm(false);
    setShowNewRoundForm(true);
  };

  const handleCreateRound = () => {
    if (!activeProject || !activeLocation) {
      setStatusToast('Please select a Project and Tunnel Location first.');
      return;
    }
    const chFrom = Number(newRoundFrom) || 100.0;
    const chTo = Number(newRoundTo) || chFrom + 3.5;
    const pull = Math.max(0.5, Math.abs(chTo - chFrom));
    const existingForLoc = store.rounds.filter(
      (r) => r.projectId === activeProject.id && r.locationId === activeLocation.id
    );

    const newRound: DigitalTwinRoundRecord = {
      id: `dt-round-${Date.now()}`,
      projectId: activeProject.id,
      locationId: activeLocation.id,
      roundNumber: existingForLoc.length + 1,
      chainageFromM: chFrom,
      chainageToM: chTo,
      pullLengthM: Number(pull.toFixed(2)),
      driveAzimuthDeg:
        Number(newRoundAzimuth) || activeLocation.defaultDriveAzimuthDeg || 45,
      acquisitionMode: newRoundMode,
      photosBySlot: {},
    };

    setStore((prev) => ({
      ...prev,
      rounds: [...prev.rounds, newRound],
      activeRoundId: newRound.id,
    }));
    setShowNewRoundForm(false);
    setNewRoundFrom(String(chTo));
    setNewRoundTo(String(Number((chTo + pull).toFixed(2))));
    setActiveStep('capture_20');
  };

  const stopLiveCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsLiveCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsLiveCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);
    } catch {
      setStatusToast(
        'Direct camera stream unavailable in this browser frame. Use the Slot Upload / Device Camera button instead.'
      );
    }
  };

  // Live Photogrammetric 3D Reconstruction + 4-Engine Structural Analysis Pipeline
  const runFullPhotoTo3DReconstructionAndAnalysis = useCallback(
    async (targetRound: DigitalTwinRoundRecord) => {
      if (!activeLocation) return;
      const populatedCount = Object.values(targetRound.photosBySlot || {}).filter(
        isPhotoSlotPopulated
      ).length;

      const cleanRound: DigitalTwinRoundRecord = {
        ...targetRound,
        extracted3DJoints: undefined,
        lastReconstructedAtIso: new Date().toISOString(),
      };

      setActiveStep('reconstruct_3d');
      setRenderSurfaceMode('rock_with_break_edges');
      setIsRunning4EnginePipeline(true);

      try {
        setFourEngineStageInfo({
          stageIndex: 1,
          progressPct: 18,
          label: `Photogrammetric Bundle Adjustment & Camera Pose Solving across ${populatedCount}/20 Uploaded Photos...`,
        });
        await new Promise((r) => setTimeout(r, 220));

        setFourEngineStageInfo({
          stageIndex: 1,
          progressPct: 36,
          label: `Multi-View Stereo (MVS) 3D Surface Relief Reconstruction & 20-Photo UV Texture Atlas Stitching...`,
        });
        await new Promise((r) => setTimeout(r, 240));

        const freshModel = reconstructReal3DTunnelFrom20Photos(
          activeLocation,
          cleanRound
        );

        const res = await runFourEngineConsensus3DExtraction(
          freshModel,
          activeLocation,
          cleanRound,
          (stageIndex, progressPct, label) => {
            setFourEngineStageInfo({
              stageIndex,
              progressPct: Math.max(40, progressPct),
              label,
            });
          }
        );

        const nowIso = new Date().toISOString();
        setStore((prev) => ({
          ...prev,
          rounds: prev.rounds.map((r) =>
            r.id === cleanRound.id
              ? {
                  ...r,
                  photosBySlot: cleanRound.photosBySlot,
                  extracted3DJoints: res.joints,
                  lastReconstructedAtIso: nowIso,
                  last4EngineSynthesisNote: res.synthesisNote,
                  last4EngineRunAtIso: nowIso,
                }
              : r
          ),
        }));

        const validJoints = res.joints.filter(
          (j) => j.status !== 'Rejected Shadow / Disturbance'
        );
        if (validJoints.length > 0) {
          setSelected3DJointId(validJoints[0].id);
        }
        setShowJointAnalysisModal(true);
        setStatusToast(
          `3D Digital Twin Reconstructed & Analyzed from ${populatedCount}/20 Photos: ${validJoints.length} Validated 3D Joints & Dip Surfaces extracted across Walls, Crown & Face.`
        );
      } finally {
        setTimeout(() => {
          setIsRunning4EnginePipeline(false);
          setFourEngineStageInfo(null);
        }, 550);
      }
    },
    [activeLocation]
  );

  const handleCaptureLiveFrameToActiveSlot = async () => {
    if (!videoRef.current || !activeRound) return;
    const vid = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth || 1280;
    canvas.height = vid.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);

    const analyzed = await analyzePhotoForDigitalTwinSlot(
      dataUrl,
      activeSlotNumber,
      `FieldCam_Slot${activeSlotNumber}.jpg`,
      'field_camera'
    );

    const nextPhotosBySlot = {
      ...(activeRound.photosBySlot || {}),
      [activeSlotNumber]: analyzed,
    };
    const updatedRound: DigitalTwinRoundRecord = {
      ...activeRound,
      photosBySlot: nextPhotosBySlot,
      extracted3DJoints: undefined,
      lastReconstructedAtIso: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) =>
        r.id === activeRound.id ? updatedRound : r
      ),
    }));

    if (activeSlotNumber < 20) {
      setActiveSlotNumber(activeSlotNumber + 1);
      setStatusToast(
        `Captured Slot #${activeSlotNumber}/20 (Fracture Dip Gradient ${analyzed.dominantFractureAngleDeg ?? 45}°). Ready for Slot #${activeSlotNumber + 1}.`
      );
    } else {
      stopLiveCamera();
      await runFullPhotoTo3DReconstructionAndAnalysis(updatedRound);
    }
  };

  const handleBatchUploadFiles = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !activeRound) return;
    setIsBusyLoadingPhotos(true);

    try {
      const existingSlots = { ...(activeRound.photosBySlot || {}) };
      const allExistingAreCalibration =
        Object.values(existingSlots).length > 0 &&
        Object.values(existingSlots).every(
          (s) => !isPhotoSlotPopulated(s) || s.sourceMode === 'calibration_set'
        );

      const updatedSlots =
        files.length >= 10 || allExistingAreCalibration ? {} : existingSlots;

      const sorted = [...files].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      let targetSlot =
        sorted.length >= 10 || allExistingAreCalibration
          ? 1
          : DIGITAL_TWIN_20_PHOTO_SPECS.find(
              (s) => !isPhotoSlotPopulated(updatedSlots[s.slotNumber])
            )?.slotNumber || 1;

      let loadedCount = 0;
      const totalToProcess = Math.min(sorted.length, 20);

      for (const file of sorted) {
        if (targetSlot > 20) break;
        loadedCount++;
        setStatusToast(
          `Analyzing Photo ${loadedCount}/${totalToProcess} (${file.name}) — Extracting 24×24 Stereo Relief & Sobel Fracture Angles...`
        );
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          updatedSlots[targetSlot] = await analyzePhotoForDigitalTwinSlot(
            dataUrl,
            targetSlot,
            file.name,
            'photogrammetry_upload'
          );
          targetSlot++;
        }
      }

      const updatedRound: DigitalTwinRoundRecord = {
        ...activeRound,
        photosBySlot: updatedSlots,
        extracted3DJoints: undefined,
        lastReconstructedAtIso: new Date().toISOString(),
      };

      setStore((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === activeRound.id ? updatedRound : r
        ),
      }));

      // Automatically execute the full 3D Reconstruction, 20-Photo UV Texture Stitching, and 4-Engine 3D Analysis!
      await runFullPhotoTo3DReconstructionAndAnalysis(updatedRound);
    } finally {
      setIsBusyLoadingPhotos(false);
      e.target.value = '';
    }
  };

  const handleSingleSlotUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeRound) return;
    setIsBusyLoadingPhotos(true);
    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        const analyzed = await analyzePhotoForDigitalTwinSlot(
          dataUrl,
          targetUploadSlot,
          file.name,
          activeRound.acquisitionMode
        );
        const nextSlots = {
          ...(activeRound.photosBySlot || {}),
          [targetUploadSlot]: analyzed,
        };
        const updatedRound: DigitalTwinRoundRecord = {
          ...activeRound,
          photosBySlot: nextSlots,
          extracted3DJoints: undefined,
          lastReconstructedAtIso: new Date().toISOString(),
        };
        setStore((prev) => ({
          ...prev,
          rounds: prev.rounds.map((r) =>
            r.id === activeRound.id ? updatedRound : r
          ),
        }));
        const totalPopulated = Object.values(nextSlots).filter(
          isPhotoSlotPopulated
        ).length;
        setStatusToast(
          `Loaded Slot #${targetUploadSlot}/20 (${file.name}) • Dominant Fracture Angle ${analyzed.dominantFractureAngleDeg ?? 45}° • ${totalPopulated}/20 Photos Ready.`
        );
        if (targetUploadSlot < 20) {
          setActiveSlotNumber(targetUploadSlot + 1);
        } else if (totalPopulated >= 20) {
          await runFullPhotoTo3DReconstructionAndAnalysis(updatedRound);
        }
      }
    } finally {
      setIsBusyLoadingPhotos(false);
      e.target.value = '';
    }
  };

  const handleLoad20CalibrationSet = async () => {
    if (!activeLocation || !activeRound) return;
    setIsBusyLoadingPhotos(true);
    try {
      setStatusToast(
        'Generating 20-Photo Stereo Calibration Set (4 Stations × 5 Angles) & Running 3D Reconstruction...'
      );
      const synth = await generateSynthetic20PhotoSetForLocation(
        activeLocation,
        activeRound.chainageFromM,
        activeRound.chainageToM
      );
      const updatedRound: DigitalTwinRoundRecord = {
        ...activeRound,
        photosBySlot: synth,
        extracted3DJoints: undefined,
        lastReconstructedAtIso: new Date().toISOString(),
      };
      setStore((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === activeRound.id ? updatedRound : r
        ),
      }));
      await runFullPhotoTo3DReconstructionAndAnalysis(updatedRound);
    } finally {
      setIsBusyLoadingPhotos(false);
    }
  };

  const capturedCount = useMemo(
    () =>
      Object.values(activeRound?.photosBySlot || {}).filter(
        isPhotoSlotPopulated
      ).length,
    [activeRound?.photosBySlot]
  );

  const reconstructedModel = useMemo(() => {
    if (!activeLocation || !activeRound) return null;
    return reconstructReal3DTunnelFrom20Photos(activeLocation, activeRound);
  }, [activeLocation, activeRound]);

  // ==================== THREE.JS WHITE-LIGHT REAL-EDGE 3D TUNNEL VIEWPORT ====================
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    rockMesh: THREE.Mesh | null;
    breakEdgesMesh: THREE.LineSegments | null;
    pointCloud: THREE.Points | null;
    designWireframe: THREE.LineSegments | null;
    frustumGroup: THREE.Group | null;
    jointDipSurfacesGroup: THREE.Group | null;
    jointTracesGroup: THREE.Group | null;
    facetDiscsGroup: THREE.Group | null;
    wedgesGroup: THREE.Group | null;
    slicePlaneGroup: THREE.Group | null;
    rulerGroup: THREE.Group | null;
  } | null>(null);

  const active3DToolModeRef = useRef(active3DToolMode);
  useEffect(() => {
    active3DToolModeRef.current = active3DToolMode;
  }, [active3DToolMode]);

  const newJointPreferredSetRef = useRef(newJointPreferredSet);
  useEffect(() => {
    newJointPreferredSetRef.current = newJointPreferredSet;
  }, [newJointPreferredSet]);

  const activeLocationRef = useRef(activeLocation);
  useEffect(() => {
    activeLocationRef.current = activeLocation;
  }, [activeLocation]);

  const activeRoundRef = useRef(activeRound);
  useEffect(() => {
    activeRoundRef.current = activeRound;
  }, [activeRound]);

  const reconstructedModelRef = useRef(reconstructedModel);
  useEffect(() => {
    reconstructedModelRef.current = reconstructedModel;
  }, [reconstructedModel]);

  // Persist updated 3D Joints & Dip Surfaces into the active round record
  const updateActiveRound3DJoints = useCallback(
    (
      updater: (
        prevJoints: Extracted3DJointAndDipSurface[]
      ) => Extracted3DJointAndDipSurface[],
      synthesisNote?: string
    ) => {
      const rnd = activeRoundRef.current;
      const mdl = reconstructedModelRef.current;
      if (!rnd || !mdl) return;
      const currentList = rnd.extracted3DJoints || mdl.extracted3DJoints || [];
      const nextList = updater(currentList);

      setStore((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === rnd.id
            ? {
                ...r,
                extracted3DJoints: nextList,
                last4EngineSynthesisNote:
                  synthesisNote ?? r.last4EngineSynthesisNote,
                last4EngineRunAtIso: synthesisNote
                  ? new Date().toISOString()
                  : r.last4EngineRunAtIso,
              }
            : r
        ),
      }));
    },
    []
  );

  const handleRun4EngineConsensus = async () => {
    if (!reconstructedModel || !activeLocation || !activeRound) return;
    setIsRunning4EnginePipeline(true);
    try {
      const res = await runFourEngineConsensus3DExtraction(
        reconstructedModel,
        activeLocation,
        activeRound,
        (stageIndex, progressPct, label) => {
          setFourEngineStageInfo({ stageIndex, progressPct, label });
        }
      );
      updateActiveRound3DJoints(() => res.joints, res.synthesisNote);
      if (res.joints.length > 0 && !selected3DJointId) {
        setSelected3DJointId(res.joints[0].id);
      }
      setShowJointAnalysisModal(true);
      setStatusToast(
        `${res.engineLabel}: Validated ${
          res.joints.filter((j) => j.status !== 'Rejected Shadow / Disturbance')
            .length
        } 3D Joints & Dip Surfaces across Walls, Crown & Face.`
      );
    } finally {
      setTimeout(() => {
        setIsRunning4EnginePipeline(false);
        setFourEngineStageInfo(null);
      }, 650);
    }
  };

  const focusCameraOn3DJoint = useCallback(
    (joint: Extracted3DJointAndDipSurface) => {
      const ctx = sceneObjectsRef.current;
      if (!ctx) return;
      const c = joint.center3D;
      const n = joint.normal3D;
      // Position camera 2.6m away along inward normal so the 3D joint & dip surface is centered
      ctx.camera.position.set(
        c.x - n.nx * 2.4,
        Math.max(1.0, c.y - n.ny * 1.6),
        c.z - n.nz * 2.4 + 1.2
      );
      ctx.controls.target.set(c.x, c.y, c.z);
      ctx.controls.update();
      setSelected3DJointId(joint.id);
      requestRenderRef.current?.();
    },
    []
  );

  // Camera Viewpoint Teleporter (Portal, Face Close-up, Top-Down Plan, Isometric, or Station #1..#20)
  const teleportCameraToPreset = useCallback(
    (preset: 'portal' | 'face_closeup' | 'top_plan' | 'side_profile' | number) => {
      const ctx = sceneObjectsRef.current;
      const loc = activeLocationRef.current;
      const rnd = activeRoundRef.current;
      if (!ctx || !loc) return;

      const W = loc.widthM || 8.5;
      const H = loc.heightM || 7.5;
      const pullLen = rnd?.pullLengthM || 3.5;

      if (typeof preset === 'number') {
        const spec =
          DIGITAL_TWIN_20_PHOTO_SPECS.find((s) => s.slotNumber === preset) ||
          DIGITAL_TWIN_20_PHOTO_SPECS[0];
        const faceZ = -pullLen / 2;
        const camX = spec.normalizedCamX * W;
        const camY = spec.normalizedCamY * H;
        const camZ = faceZ + spec.standoffFromFaceM;

        const yawRad = THREE.MathUtils.degToRad(spec.yawDeg);
        const pitchRad = THREE.MathUtils.degToRad(spec.pitchDeg);
        const lookDist = spec.standoffFromFaceM;

        ctx.camera.position.set(camX, camY, camZ + 0.35);
        ctx.controls.target.set(
          camX + Math.sin(yawRad) * lookDist,
          camY + Math.sin(pitchRad) * lookDist,
          faceZ
        );
        setInspectedPhotoSlot(preset);
      } else if (preset === 'portal') {
        ctx.camera.position.set(0, H * 0.48, W * 0.95);
        ctx.controls.target.set(0, H * 0.42, -0.4);
        setInspectedPhotoSlot(null);
      } else if (preset === 'face_closeup') {
        ctx.camera.position.set(0, H * 0.46, pullLen * 0.32);
        ctx.controls.target.set(0, H * 0.45, -pullLen * 0.55);
        setInspectedPhotoSlot(null);
      } else if (preset === 'top_plan') {
        ctx.camera.position.set(0, H * 2.4, 0.2);
        ctx.controls.target.set(0, H * 0.4, 0);
        setInspectedPhotoSlot(null);
      } else if (preset === 'side_profile') {
        ctx.camera.position.set(W * 1.65, H * 0.52, 0);
        ctx.controls.target.set(0, H * 0.45, 0);
        setInspectedPhotoSlot(null);
      }

      ctx.controls.update();
      requestRenderRef.current?.();
    },
    []
  );

  // Initialize White-Light Three.js WebGL scene when in 3D Tunnel Model or Dedicated 3D Inspector Window
  useEffect(() => {
    if (!is3DViewportStep) return;
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Crisp White-Light Engineering CAD Studio Theme (#f8fafc)
    scene.background = new THREE.Color(0xf8fafc);
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.012);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const locH = activeLocationRef.current?.heightM || 7.5;
    const locW = activeLocationRef.current?.widthM || 8.5;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, locH * 0.48, locW * 0.95);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, locH * 0.42, -0.4);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 48;
    controls.minDistance = 0.6;

    // Bright Daylight Studio Rig for White Light Theme
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    keyLight.position.set(6, locH * 1.5, 10);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.95);
    fillLight.position.set(-7, locH * 0.8, 6);
    scene.add(fillLight);

    const faceHeadLight = new THREE.PointLight(0xffffff, 1.1, 32);
    faceHeadLight.position.set(0, locH * 0.52, 2.0);
    scene.add(faceHeadLight);

    // High-contrast CAD Metric Floor Grid on White Background
    const gridHelper = new THREE.GridHelper(26, 26, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.y = -0.22;
    scene.add(gridHelper);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);
    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    resizeObs?.observe(container);

    // Raycaster for 3D Joint Selection, 3D Ruler & 3D Structural Dip/Strike Facet Probe
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const toolMode = active3DToolModeRef.current;
      const moveDist = Math.hypot(
        ev.clientX - pointerDownPos.x,
        ev.clientY - pointerDownPos.y
      );
      if (moveDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

      const meshTarget = sceneObjectsRef.current?.rockMesh;
      if (!meshTarget) return;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(meshTarget, false);
      if (hits.length === 0) return;

      const hit = hits[0];
      const pt = hit.point;
      const loc = activeLocationRef.current;
      const rnd = activeRoundRef.current;

      if (toolMode === 'orbit') {
        // Click-to-select nearest 3D Joint / Dip Surface on the live 3D tunnel
        const mdl = reconstructedModelRef.current;
        const joints = rnd?.extracted3DJoints || mdl?.extracted3DJoints || [];
        let bestJoint: Extracted3DJointAndDipSurface | null = null;
        let bestDist = 1.65;
        for (const j of joints) {
          const dc = Math.hypot(
            j.center3D.x - pt.x,
            j.center3D.y - pt.y,
            j.center3D.z - pt.z
          );
          if (dc < bestDist) {
            bestDist = dc;
            bestJoint = j;
          }
          for (const tp of j.tracePoints3D) {
            const dt = Math.hypot(tp.x - pt.x, tp.y - pt.y, tp.z - pt.z);
            if (dt < bestDist) {
              bestDist = dt;
              bestJoint = j;
            }
          }
        }
        if (bestJoint) {
          setSelected3DJointId(bestJoint.id);
        }
        return;
      }

      if (toolMode === 'ruler') {
        let radialDevCm = 0;
        if (loc) {
          const loop = buildTheoreticalDesignReferenceLoop(loc);
          let minDist = Infinity;
          const cy = (loc.heightM || 7.5) * 0.45;
          const ptR = Math.hypot(pt.x, pt.y - cy);
          let bestDesignR = ptR;
          for (const dp of loop.points) {
            const d = Math.hypot(dp.x - pt.x, dp.y - pt.y);
            if (d < minDist) {
              minDist = d;
              bestDesignR = Math.hypot(dp.x, dp.y - cy);
            }
          }
          radialDevCm = Math.round((ptR - bestDesignR) * 100);
        }

        setRulerPoints((prev) =>
          prev.length >= 2
            ? [{ x: pt.x, y: pt.y, z: pt.z, radialDevCm }]
            : [...prev, { x: pt.x, y: pt.y, z: pt.z, radialDevCm }]
        );
      } else if (toolMode === 'facet_probe') {
        const faceNorm = hit.face?.normal || new THREE.Vector3(0, 1, 0);
        const driveAz =
          rnd?.driveAzimuthDeg ?? loc?.defaultDriveAzimuthDeg ?? 45;
        const facet = computeLocal3DFacetOrientationAtPoint(
          { x: pt.x, y: pt.y, z: pt.z },
          { x: faceNorm.x, y: faceNorm.y, z: faceNorm.z },
          driveAz
        );
        setProbedFacets((prev) => [...prev.slice(-7), facet]);
        setSelectedFacetInfo(facet);
      } else if (toolMode === 'add_3d_joint') {
        const faceNorm = hit.face?.normal || new THREE.Vector3(0, 1, 0);
        const clickPt = {
          x: pt.x,
          y: pt.y,
          z: pt.z,
          nx: faceNorm.x,
          ny: faceNorm.y,
          nz: faceNorm.z,
        };
        setPendingNewJointClicks((prev) => {
          const next = [...prev, clickPt];
          if (next.length >= 2 && loc) {
            const driveAz =
              rnd?.driveAzimuthDeg ?? loc.defaultDriveAzimuthDeg ?? 45;
            const mdl = reconstructedModelRef.current;
            const currentJoints =
              rnd?.extracted3DJoints || mdl?.extracted3DJoints || [];
            const newJoint = buildUser3DJointFromClickedPoints(
              next,
              loc,
              driveAz,
              currentJoints.length,
              newJointPreferredSetRef.current
            );
            updateActiveRound3DJoints((list) => [newJoint, ...list]);
            setSelected3DJointId(newJoint.id);
            setStatusToast(
              `Added 3D Joint ${newJoint.code} on ${newJoint.zone}: Dip ${newJoint.dipDeg}° / Dip Dir ${String(newJoint.dipDirectionDeg).padStart(3, '0')}° • Persistence ${newJoint.persistenceM}m`
            );
            return [];
          }
          return next;
        });
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    sceneObjectsRef.current = {
      scene,
      camera,
      controls,
      rockMesh: null,
      breakEdgesMesh: null,
      pointCloud: null,
      designWireframe: null,
      frustumGroup: null,
      jointDipSurfacesGroup: null,
      jointTracesGroup: null,
      facetDiscsGroup: null,
      wedgesGroup: null,
      slicePlaneGroup: null,
      rulerGroup: null,
    };

    requestRender();

    return () => {
      resizeObs?.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
      sceneObjectsRef.current = null;
    };
  }, [is3DViewportStep]);

  // Populate / Update 3D Rock Mesh, Break Edges, Point Cloud, Design Wireframe, 20 Camera Frustums, 3D Facet Discs, 3D Key-Block Wedges, Slice Cutter & Ruler
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx || !reconstructedModel || !activeLocation || !activeRound) return;
    const { scene } = ctx;

    const removeAndDispose = (obj: THREE.Object3D | null) => {
      if (!obj) return;
      scene.remove(obj);
      obj.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => {
              m.map?.dispose();
              m.dispose();
            });
          } else {
            child.material.map?.dispose();
            child.material.dispose();
          }
        }
      });
    };

    removeAndDispose(ctx.rockMesh);
    removeAndDispose(ctx.breakEdgesMesh);
    removeAndDispose(ctx.pointCloud);
    removeAndDispose(ctx.designWireframe);
    removeAndDispose(ctx.frustumGroup);
    removeAndDispose(ctx.jointDipSurfacesGroup);
    removeAndDispose(ctx.jointTracesGroup);
    removeAndDispose(ctx.facetDiscsGroup);
    removeAndDispose(ctx.wedgesGroup);
    removeAndDispose(ctx.slicePlaneGroup);
    removeAndDispose(ctx.rulerGroup);

    // 1. Irregular 3D Rock Excavation Mesh + Multi-View 20-Photo UV Texture Atlas
    const meshGeom = new THREE.BufferGeometry();
    meshGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(reconstructedModel.positions, 3)
    );
    meshGeom.setAttribute(
      'uv',
      new THREE.BufferAttribute(reconstructedModel.uvs, 2)
    );
    meshGeom.setIndex(new THREE.BufferAttribute(reconstructedModel.indices, 1));
    const activeColorAttr =
      renderSurfaceMode === 'overbreak_heatmap'
        ? reconstructedModel.deviationColors
        : renderSurfaceMode === 'normal_dip_map'
        ? reconstructedModel.normalColors
        : reconstructedModel.colors;
    meshGeom.setAttribute(
      'color',
      new THREE.BufferAttribute(activeColorAttr, 3)
    );
    meshGeom.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.06,
      flatShading: renderSurfaceMode !== 'textured_rock_mesh',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const rockMesh = new THREE.Mesh(meshGeom, rockMat);
    rockMesh.visible = renderSurfaceMode !== 'dense_point_cloud';
    scene.add(rockMesh);
    ctx.rockMesh = rockMesh;

    // Bind stitched 20-Photo Texture Atlas onto the 3D tunnel walls, crown & face when photos are uploaded
    let cancelledTextureLoad = false;
    if (
      renderSurfaceMode === 'textured_rock_mesh' ||
      renderSurfaceMode === 'rock_with_break_edges'
    ) {
      buildStitched20PhotoTextureCanvas(activeRound).then((atlasCanvas) => {
        if (cancelledTextureLoad || !atlasCanvas || ctx.rockMesh !== rockMesh) {
          return;
        }
        const tex = new THREE.CanvasTexture(atlasCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        rockMat.map = tex;
        rockMat.vertexColors = false;
        rockMat.color.setHex(0xffffff);
        rockMat.needsUpdate = true;
        requestRenderRef.current?.();
      });
    }

    // 1B. Crisp Real-Edge Break-Line Overlay (EdgesGeometry on irregular rock facets)
    const breakEdgesGeom = new THREE.EdgesGeometry(meshGeom, 11);
    const breakEdgesMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.55,
    });
    const breakEdgesMesh = new THREE.LineSegments(
      breakEdgesGeom,
      breakEdgesMat
    );
    breakEdgesMesh.visible = renderSurfaceMode === 'rock_with_break_edges';
    scene.add(breakEdgesMesh);
    ctx.breakEdgesMesh = breakEdgesMesh;

    // 2. Dense 3D Photogrammetric Point Cloud
    const pcGeom = new THREE.BufferGeometry();
    pcGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(reconstructedModel.pointCloudPositions, 3)
    );
    pcGeom.setAttribute(
      'color',
      new THREE.BufferAttribute(reconstructedModel.pointCloudColors, 3)
    );
    const pcMat = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const pointCloud = new THREE.Points(pcGeom, pcMat);
    pointCloud.visible = renderSurfaceMode === 'dense_point_cloud';
    scene.add(pointCloud);
    ctx.pointCloud = pointCloud;

    // 3. Theoretical Design Profile Wireframe Overlay (High-Contrast Cobalt Blue #0284c7 on White Theme)
    const wireGeom = new THREE.BufferGeometry();
    wireGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(reconstructedModel.designWireframePositions, 3)
    );
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.95,
    });
    const designWireframe = new THREE.LineSegments(wireGeom, wireMat);
    designWireframe.visible = showDesignWireframe;
    scene.add(designWireframe);
    ctx.designWireframe = designWireframe;

    // 4. 20 Camera Frustums & Sightlines (4 Camera Stations x 5 Angles)
    const frustumGroup = new THREE.Group();
    frustumGroup.visible = showCameraFrustums;
    const W = activeLocation.widthM || 8.5;
    const H = activeLocation.heightM || 7.5;
    const pullLen = activeRound.pullLengthM || 3.5;
    const faceZ = -pullLen / 2;

    for (const spec of DIGITAL_TWIN_20_PHOTO_SPECS) {
      const hasPhoto = isPhotoSlotPopulated(
        activeRound.photosBySlot?.[spec.slotNumber]
      );
      const isSelectedSlot = inspectedPhotoSlot === spec.slotNumber;
      const camX = spec.normalizedCamX * W;
      const camY = spec.normalizedCamY * H;
      const camZ = faceZ + spec.standoffFromFaceM;

      const frustumColor = isSelectedSlot
        ? 0xd97706
        : hasPhoto
        ? 0x059669
        : 0x64748b;

      const coneGeom = new THREE.ConeGeometry(0.18, 0.34, 4);
      coneGeom.rotateX(Math.PI / 2);
      const edges = new THREE.EdgesGeometry(coneGeom);
      const frustumLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: frustumColor })
      );

      const yawRad = THREE.MathUtils.degToRad(spec.yawDeg);
      const pitchRad = THREE.MathUtils.degToRad(spec.pitchDeg);

      const holder = new THREE.Group();
      holder.position.set(camX, camY, camZ);
      holder.rotation.set(pitchRad, -yawRad, 0, 'YXZ');
      holder.add(frustumLine);

      const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -spec.standoffFromFaceM * 0.92),
      ]);
      const rayLine = new THREE.Line(
        rayGeom,
        new THREE.LineBasicMaterial({
          color: frustumColor,
          transparent: true,
          opacity: isSelectedSlot ? 0.95 : 0.32,
        })
      );
      holder.add(rayLine);
      frustumGroup.add(holder);
    }
    scene.add(frustumGroup);
    ctx.frustumGroup = frustumGroup;

    // 5. 3D Structural Discontinuity Orientation Discs & Normal Vectors (RANSAC + Probed Facets)
    const facetDiscsGroup = new THREE.Group();
    facetDiscsGroup.visible = showFacetDiscs;
    const allFacets = [
      ...reconstructedModel.extracted3DFacets,
      ...probedFacets,
    ];

    for (const fc of allFacets) {
      const discGroup = new THREE.Group();
      discGroup.position.set(fc.center3D.x, fc.center3D.y, fc.center3D.z);

      const targetNormal = new THREE.Vector3(
        fc.normal3D.nx,
        fc.normal3D.ny,
        fc.normal3D.nz
      ).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        targetNormal
      );
      discGroup.quaternion.copy(quat);

      const col = new THREE.Color(fc.colorHex);
      const circleGeom = new THREE.CircleGeometry(fc.radiusM, 28);
      const circleMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      discGroup.add(new THREE.Mesh(circleGeom, circleMat));

      const ringEdges = new THREE.EdgesGeometry(circleGeom);
      discGroup.add(
        new THREE.LineSegments(
          ringEdges,
          new THREE.LineBasicMaterial({ color: col })
        )
      );

      // Normal vector stem
      const arrowGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, fc.radiusM * 0.85),
      ]);
      discGroup.add(
        new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ color: col }))
      );

      facetDiscsGroup.add(discGroup);
    }
    scene.add(facetDiscsGroup);
    ctx.facetDiscsGroup = facetDiscsGroup;

    // 6. 3D Key-Block & Unstable Wedge Polyhedra on Crown & Shoulder
    const wedgesGroup = new THREE.Group();
    wedgesGroup.visible = showKeyBlockWedges;

    for (const wdg of reconstructedModel.detected3DWedges) {
      const [b0, b1, b2] = wdg.baseVertices3D;
      const ap = wdg.apex3D;
      const verts = new Float32Array([
        b0.x,
        b0.y,
        b0.z,
        b1.x,
        b1.y,
        b1.z,
        b2.x,
        b2.y,
        b2.z,
        ap.x,
        ap.y,
        ap.z,
      ]);
      const indices = new Uint16Array([
        0, 1, 2, 0, 1, 3, 1, 2, 3, 2, 0, 3,
      ]);
      const wGeom = new THREE.BufferGeometry();
      wGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wGeom.setIndex(new THREE.BufferAttribute(indices, 1));
      wGeom.computeVertexNormals();

      const isCrit = wdg.factorOfSafety < 1.2;
      const wColor = isCrit ? 0xdc2626 : 0xd97706;
      const wMat = new THREE.MeshStandardMaterial({
        color: wColor,
        transparent: true,
        opacity: 0.48,
        roughness: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      wedgesGroup.add(new THREE.Mesh(wGeom, wMat));

      const wEdges = new THREE.EdgesGeometry(wGeom);
      wedgesGroup.add(
        new THREE.LineSegments(
          wEdges,
          new THREE.LineBasicMaterial({ color: wColor })
        )
      );
    }
    scene.add(wedgesGroup);
    ctx.wedgesGroup = wedgesGroup;

    // 7. Interactive 3D Chainage Slice & Cross-Section Cutter
    const slicePlaneGroup = new THREE.Group();
    slicePlaneGroup.visible = showChainageSlicer;
    const safeSliceIdx = Math.min(
      reconstructedModel.sliceSections.length - 1,
      Math.max(0, activeSliceIndex)
    );
    const activeSlice = reconstructedModel.sliceSections[safeSliceIdx];
    if (activeSlice) {
      const planeGeom = new THREE.PlaneGeometry(W * 1.35, H * 1.35);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.set(0, H * 0.5, activeSlice.zOffsetM);
      slicePlaneGroup.add(planeMesh);

      const realPts3D = activeSlice.realRockPoints2D.map(
        (p) => new THREE.Vector3(p.x, p.y, activeSlice.zOffsetM)
      );
      slicePlaneGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(realPts3D),
          new THREE.LineBasicMaterial({ color: 0xea580c })
        )
      );

      const desPts3D = activeSlice.designPoints2D.map(
        (p) => new THREE.Vector3(p.x, p.y, activeSlice.zOffsetM)
      );
      slicePlaneGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(desPts3D),
          new THREE.LineBasicMaterial({ color: 0x0284c7 })
        )
      );
    }
    scene.add(slicePlaneGroup);
    ctx.slicePlaneGroup = slicePlaneGroup;

    // 8. Interactive 3D Point-to-Point & Overbreak Depth Ruler
    const rulerGroup = new THREE.Group();
    for (const pt of rulerPoints) {
      const sphGeom = new THREE.SphereGeometry(0.11, 16, 16);
      const sphMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
      const marker = new THREE.Mesh(sphGeom, sphMat);
      marker.position.set(pt.x, pt.y, pt.z);
      rulerGroup.add(marker);
    }
    if (rulerPoints.length === 2) {
      const [p0, p1] = rulerPoints;
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p0.x, p0.y, p0.z),
        new THREE.Vector3(p1.x, p1.y, p1.z),
      ]);
      rulerGroup.add(
        new THREE.Line(
          lineGeom,
          new THREE.LineBasicMaterial({ color: 0xd97706 })
        )
      );
    }
    scene.add(rulerGroup);
    ctx.rulerGroup = rulerGroup;

    // 9. 4-Engine Extracted & User-Edited 3D Bounded Dip Surface Polygons (Walls, Crown & Face)
    const jointDipSurfacesGroup = new THREE.Group();
    jointDipSurfacesGroup.visible = show3DDipSurfaces;
    const jointTracesGroup = new THREE.Group();
    jointTracesGroup.visible = show3DJointTraces;

    const visible3DJoints = reconstructedModel.extracted3DJoints.filter((j) => {
      if (
        !showRejectedDisturbances &&
        j.status === 'Rejected Shadow / Disturbance'
      ) {
        return false;
      }
      if (
        activeJointZoneFilter !== 'ALL' &&
        j.zone !== activeJointZoneFilter
      ) {
        return false;
      }
      return true;
    });

    for (const j of visible3DJoints) {
      const isSelected = selected3DJointId === j.id;
      const isRejected = j.status === 'Rejected Shadow / Disturbance';
      const col = new THREE.Color(isSelected ? '#f59e0b' : j.colorHex);

      // A) Bounded 3D Dip Surface Polygon on Left Wall, Crown Arch, Right Wall, or Advancing Face
      const poly = j.dipPolygonVertices3D;
      if (poly && poly.length >= 3) {
        const triPositions: number[] = [];
        const c = j.center3D;
        for (let i = 0; i < poly.length; i++) {
          const p0 = poly[i];
          const p1 = poly[(i + 1) % poly.length];
          triPositions.push(c.x, c.y, c.z, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
        const dipPolyGeom = new THREE.BufferGeometry();
        dipPolyGeom.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(triPositions, 3)
        );
        dipPolyGeom.computeVertexNormals();

        const dipPolyMat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: isRejected ? 0.16 : isSelected ? 0.58 : 0.36,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        jointDipSurfacesGroup.add(new THREE.Mesh(dipPolyGeom, dipPolyMat));

        // Perimeter ring around the 3D Dip Surface polygon
        const loopPts = [...poly, poly[0]].map(
          (p) => new THREE.Vector3(p.x, p.y, p.z)
        );
        const loopGeom = new THREE.BufferGeometry().setFromPoints(loopPts);
        jointDipSurfacesGroup.add(
          new THREE.Line(
            loopGeom,
            new THREE.LineBasicMaterial({
              color: col,
              transparent: true,
              opacity: isRejected ? 0.45 : 0.95,
            })
          )
        );

        // Down-Dip Direction Vector Arrow lying on the 3D Dip Surface plane
        if (!isRejected) {
          const arrowLen = Math.min(0.85, Math.max(0.4, j.persistenceM * 0.22));
          const tip = new THREE.Vector3(
            c.x + j.dipVector3D.dx * arrowLen + j.normal3D.nx * 0.05,
            c.y + j.dipVector3D.dy * arrowLen + j.normal3D.ny * 0.05,
            c.z + j.dipVector3D.dz * arrowLen + j.normal3D.nz * 0.05
          );
          const origin = new THREE.Vector3(
            c.x + j.normal3D.nx * 0.05,
            c.y + j.normal3D.ny * 0.05,
            c.z + j.normal3D.nz * 0.05
          );
          const dipArrowGeom = new THREE.BufferGeometry().setFromPoints([
            origin,
            tip,
          ]);
          jointDipSurfacesGroup.add(
            new THREE.Line(
              dipArrowGeom,
              new THREE.LineBasicMaterial({ color: 0x0f172a })
            )
          );
          const coneGeom = new THREE.ConeGeometry(0.065, 0.16, 8);
          const coneMesh = new THREE.Mesh(
            coneGeom,
            new THREE.MeshBasicMaterial({ color: col })
          );
          coneMesh.position.copy(tip);
          const dirVec = new THREE.Vector3(
            j.dipVector3D.dx,
            j.dipVector3D.dy,
            j.dipVector3D.dz
          ).normalize();
          coneMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dirVec
          );
          jointDipSurfacesGroup.add(coneMesh);
        }
      }

      // B) 3D Joint Persistence Trace Polyline hugging the irregular 3D rock surface
      if (j.tracePoints3D && j.tracePoints3D.length >= 2) {
        const traceVecs = j.tracePoints3D.map(
          (p) =>
            new THREE.Vector3(
              p.x + j.normal3D.nx * 0.035,
              p.y + j.normal3D.ny * 0.035,
              p.z + j.normal3D.nz * 0.035
            )
        );
        const traceGeom = new THREE.BufferGeometry().setFromPoints(traceVecs);
        jointTracesGroup.add(
          new THREE.Line(
            traceGeom,
            new THREE.LineBasicMaterial({
              color: isSelected ? 0xf59e0b : col,
            })
          )
        );

        // Endpoint spheres for persistence trace start & termination
        const startPt = traceVecs[0];
        const endPt = traceVecs[traceVecs.length - 1];
        const endSphGeom = new THREE.SphereGeometry(
          isSelected ? 0.095 : 0.065,
          12,
          12
        );
        const endSphMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0xf59e0b : col,
        });
        const mStart = new THREE.Mesh(endSphGeom, endSphMat);
        mStart.position.copy(startPt);
        const mEnd = new THREE.Mesh(endSphGeom, endSphMat);
        mEnd.position.copy(endPt);
        jointTracesGroup.add(mStart, mEnd);
      }
    }

    // Also render any pending first click when user is in 'add_3d_joint' mode
    for (const pend of pendingNewJointClicks) {
      const pSph = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      );
      pSph.position.set(pend.x, pend.y, pend.z);
      jointTracesGroup.add(pSph);
    }

    scene.add(jointDipSurfacesGroup);
    scene.add(jointTracesGroup);
    ctx.jointDipSurfacesGroup = jointDipSurfacesGroup;
    ctx.jointTracesGroup = jointTracesGroup;

    requestRenderRef.current?.();
    return () => {
      cancelledTextureLoad = true;
    };
  }, [
    reconstructedModel,
    activeLocation,
    activeRound,
    renderSurfaceMode,
    showDesignWireframe,
    showCameraFrustums,
    show3DDipSurfaces,
    show3DJointTraces,
    showRejectedDisturbances,
    activeJointZoneFilter,
    selected3DJointId,
    pendingNewJointClicks,
    showFacetDiscs,
    showKeyBlockWedges,
    showChainageSlicer,
    activeSliceIndex,
    rulerPoints,
    probedFacets,
    inspectedPhotoSlot,
    is3DViewportStep,
  ]);

  const activeSliceData = useMemo(() => {
    if (!reconstructedModel) return null;
    const idx = Math.min(
      reconstructedModel.sliceSections.length - 1,
      Math.max(0, activeSliceIndex)
    );
    return reconstructedModel.sliceSections[idx] || null;
  }, [reconstructedModel, activeSliceIndex]);

  const rulerDistanceM = useMemo(() => {
    if (rulerPoints.length < 2) return null;
    const [a, b] = rulerPoints;
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }, [rulerPoints]);

  const all3DJoints = useMemo(
    () => reconstructedModel?.extracted3DJoints || [],
    [reconstructedModel?.extracted3DJoints]
  );

  const filtered3DJoints = useMemo(
    () =>
      all3DJoints.filter((j) => {
        if (
          !showRejectedDisturbances &&
          j.status === 'Rejected Shadow / Disturbance'
        ) {
          return false;
        }
        if (
          activeJointZoneFilter !== 'ALL' &&
          j.zone !== activeJointZoneFilter
        ) {
          return false;
        }
        return true;
      }),
    [all3DJoints, showRejectedDisturbances, activeJointZoneFilter]
  );

  const selected3DJoint = useMemo(
    () =>
      all3DJoints.find((j) => j.id === selected3DJointId) ||
      filtered3DJoints[0] ||
      null,
    [all3DJoints, filtered3DJoints, selected3DJointId]
  );

  const handleOpen3DTo2DUnfoldedWindow = useCallback(
    (
      targetMode: '2d_canvas' | '3d_flat_tunnel' | 'strip_log' = '2d_canvas'
    ) => {
      if (!activeProject || !activeLocation || !activeRound) {
        setStatusToast(
          'Please complete Project, Location, and Face Round setup first.'
        );
        return;
      }
      stopLiveCamera();
      setShowJointAnalysisModal(false);

      const syncRes = sync3DDigitalTwinRoundTo2DUndergroundStore({
        dtProject: activeProject,
        dtLocation: activeLocation,
        dtRound: activeRound,
        all3DJoints,
        reconstructedModel,
      });

      setUnfold2DTargetViewMode(targetMode);
      setUnfold2DSyncVersion((v) => v + 1);
      setActiveStep('unfold_3d_to_2d');
      setStatusToast(
        `3D → 2D Unfolded Window ready: synced ${syncRes.unfoldedJointCount} 3D Joint Traces & ${syncRes.unfoldedDipSurfaceCount} 3D Dip Surfaces across Left Wall, Crown, Right Wall & Face.`
      );
    },
    [
      activeProject,
      activeLocation,
      activeRound,
      all3DJoints,
      reconstructedModel,
      stopLiveCamera,
    ]
  );

  useEffect(() => {
    if (
      activeStep === 'unfold_3d_to_2d' &&
      activeProject &&
      activeLocation &&
      activeRound
    ) {
      sync3DDigitalTwinRoundTo2DUndergroundStore({
        dtProject: activeProject,
        dtLocation: activeLocation,
        dtRound: activeRound,
        all3DJoints,
        reconstructedModel,
      });
      setUnfold2DSyncVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, activeProject?.id, activeLocation?.id, activeRound?.id]);

  return (
    <div className="h-dvh w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none font-sans">
      {/* ==================== TOP HEADER BAR ==================== */}
      <header
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="h-11 px-3 bg-white border-b border-slate-200 flex items-center shrink-0 relative z-30 shadow-xs overflow-x-auto overflow-y-hidden no-scrollbar mouse-scrollable whitespace-nowrap"
      >
        <div
          className="flex items-center justify-between gap-3 w-full"
          style={{ minWidth: 'max-content' }}
        >
          <div
            className="flex items-center gap-2 shrink-0 whitespace-nowrap"
            style={{ minWidth: 'max-content' }}
          >
            <div className="shrink-0 flex items-center">
              <EswaTunnelLogo size="xs" variant="emblem" />
            </div>
            <button
              type="button"
              onClick={() => {
                stopLiveCamera();
                onBackToMainMenu();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 border border-slate-300 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="whitespace-nowrap">NATM Menu</span>
            </button>

            <div
              className="flex items-center gap-1.5 pl-1 pr-1 shrink-0 whitespace-nowrap"
              style={{ minWidth: 'max-content' }}
            >
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight whitespace-nowrap shrink-0">
                3D Digital Twin Tunnel
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-black text-[10px] uppercase tracking-wider shrink-0 whitespace-nowrap">
                BETA
              </span>
            </div>
          </div>

          {/* Step Navigation Pills */}
          <div
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              minWidth: 'max-content',
            }}
            className="flex items-center gap-1.5 shrink-0 whitespace-nowrap no-scrollbar"
          >
            <button
              type="button"
              onClick={() => {
                stopLiveCamera();
                setActiveStep('setup');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 border ${
                activeStep === 'setup'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">1. Project, Location &amp; Shape</span>
            </button>

            <span className="text-slate-400 text-xs font-black shrink-0">→</span>

            <button
              type="button"
              onClick={() => {
                if (!activeProject || !activeLocation || !activeRound) {
                  setStatusToast(
                    'Please select or create a Project, Tunnel Location, and Face Round first.'
                  );
                  return;
                }
                setActiveStep('capture_20');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 border ${
                activeStep === 'capture_20'
                  ? 'bg-sky-600 text-white border-sky-700 font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">2. 20-Photo Left-to-Right ({capturedCount}/20)</span>
            </button>

            <span className="text-slate-400 text-xs font-black shrink-0">→</span>

            <button
              type="button"
              onClick={() => {
                if (!activeProject || !activeLocation || !activeRound) {
                  setStatusToast(
                    'Please complete Project, Location, and Face Round setup first.'
                  );
                  return;
                }
                stopLiveCamera();
                setActiveStep('reconstruct_3d');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 border ${
                activeStep === 'reconstruct_3d'
                  ? 'bg-emerald-600 text-white border-emerald-700 font-black shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <Box className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">3. Real-Edge 3D Tunnel Model</span>
            </button>

            <span className="text-slate-400 text-xs font-black shrink-0">→</span>

            <button
              type="button"
              onClick={() => {
                if (!activeProject || !activeLocation || !activeRound) {
                  setStatusToast(
                    'Please complete Project, Location, and Face Round setup first.'
                  );
                  return;
                }
                stopLiveCamera();
                setShowJointAnalysisModal(false);
                setActiveStep('joint_dip_inspector_window');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 border ${
                activeStep === 'joint_dip_inspector_window'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-black shadow-xs'
                  : 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">4. Dedicated 3D Joint, Dip &amp; Live Inspector Window</span>
            </button>

            <span className="text-slate-400 text-xs font-black shrink-0">→</span>

            <button
              type="button"
              onClick={() => handleOpen3DTo2DUnfoldedWindow('2d_canvas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap shrink-0 border ${
                activeStep === 'unfold_3d_to_2d'
                  ? 'bg-violet-600 text-white border-violet-700 font-black shadow-xs'
                  : 'bg-violet-50 text-violet-900 border-violet-300 hover:bg-violet-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">
                5. 3D → 2D Unfolded Canvas, Lithology, Strip Log &amp; 3D Flat
                Tunnel
              </span>
            </button>
          </div>

          {/* Context Summary & CAD Export */}
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono shrink-0 whitespace-nowrap"
            style={{ minWidth: 'max-content' }}
          >
            {activeLocation && (
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-bold shrink-0 whitespace-nowrap">
                {activeLocation.name} ({activeLocation.widthM}m ×{' '}
                {activeLocation.heightM}m)
              </span>
            )}
            {activeRound && (
              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-900 border border-sky-300 font-bold shrink-0 whitespace-nowrap">
                CH {activeRound.chainageFromM}m → {activeRound.chainageToM}m
              </span>
            )}
            {onOpenContinuous3DTwinLog && (
              <button
                type="button"
                onClick={onOpenContinuous3DTwinLog}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
                title="Open 3D Digital Twin Continuous Tunnel Log (Multi-Round Stitched 3D Corridor & Cross-Round 3D Continuity)"
              >
                <Compass className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="whitespace-nowrap">Continuous 3D Twin Log</span>
              </button>
            )}
            {is3DViewportStep &&
              reconstructedModel &&
              activeProject &&
              activeLocation &&
              activeRound && (
                <button
                  type="button"
                  onClick={() =>
                    exportReconstructed3DToOBJ(
                      reconstructedModel,
                      activeProject.projectName,
                      activeLocation.name,
                      activeRound.chainageFromM,
                      activeRound.chainageToM
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  title="Export Reconstructed Real-Edge 3D Tunnel Mesh (.OBJ)"
                >
                  <Download className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="whitespace-nowrap">Export 3D .OBJ</span>
                </button>
              )}
          </div>
        </div>
      </header>

      {/* Status Toast Banner */}
      {statusToast && (
        <div className="bg-sky-50 border-b border-sky-300 px-4 py-1.5 flex items-center justify-between text-xs text-sky-950 font-semibold shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>{statusToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-sky-700 hover:text-slate-950 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================== STEP 1: PROJECT -> LOCATION & CUSTOM SHAPE -> ROUND SETUP ==================== */}
      {activeStep === 'setup' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-y-auto md:overflow-hidden bg-slate-100">
          {/* COLUMN 1: PROJECTS */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col overflow-hidden shadow-xs">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span>1. Select or Create Project</span>
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleImportFromNatmUnderground}
                  className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[10px] cursor-pointer"
                  title="Import existing Projects and Custom Shapes from NATM Underground Mapping"
                >
                  Sync NATM Projects
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProjForm((v) => !v)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>
            </div>

            {showNewProjForm && (
              <div className="bg-slate-50 border border-amber-300 rounded-xl p-2.5 mb-2.5 space-y-2">
                <input
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="Project Name (e.g. Himalayan HEP Headwork Tunnel)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    value={newProjClient}
                    onChange={(e) => setNewProjClient(e.target.value)}
                    placeholder="Client"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={newProjContractor}
                    onChange={(e) => setNewProjContractor(e.target.value)}
                    placeholder="Contractor"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={newProjConsultant}
                    onChange={(e) => setNewProjConsultant(e.target.value)}
                    placeholder="Consultant"
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                >
                  Save Project &amp; Continue →
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {store.projects.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600">
                    No 3D Digital Twin projects yet. Click{' '}
                    <strong className="text-amber-700">+ New</strong> to create a
                    project or{' '}
                    <strong className="text-sky-700">Sync NATM Projects</strong>{' '}
                    to import your existing tunnel projects.
                  </p>
                </div>
              ) : (
                store.projects.map((proj) => {
                  const isSel = activeProject?.id === proj.id;
                  return (
                    <div
                      key={proj.id}
                      onClick={() =>
                        setStore((prev) => ({
                          ...prev,
                          activeProjectId: proj.id,
                          activeLocationId: proj.locations[0]?.id || null,
                        }))
                      }
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-50 border-amber-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          {proj.projectName}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-800">
                          {proj.locations.length} Location(s)
                        </span>
                      </div>
                      {(proj.clientName || proj.contractorName) && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {[proj.clientName, proj.contractorName]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: LOCATION & REFERENCE TUNNEL SHAPE BUILDER */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col overflow-hidden shadow-xs">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-600" />
                <span>2. Tunnel Location &amp; Reference Shape</span>
              </h2>
              <div className="flex items-center gap-1.5">
                {activeLocation && (
                  <button
                    type="button"
                    onClick={() => setCustomBuilderMode('active_location')}
                    className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[10px] cursor-pointer"
                    title="Open Manual Design Builder & Simple CAD for Reference Tunnel Shape"
                  >
                    Custom Shape Builder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeProject) {
                      setStatusToast('Create or select a Project in Column 1 first.');
                      return;
                    }
                    setShowNewLocForm((v) => !v);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Location</span>
                </button>
              </div>
            </div>

            {showNewLocForm && (
              <div className="bg-slate-50 border border-amber-300 rounded-xl p-2.5 mb-2.5 space-y-2 overflow-y-auto max-h-[340px]">
                <input
                  type="text"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="Tunnel Location (e.g. HRT Adit-2 Downstream)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Reference Profile Shape
                    </label>
                    <select
                      value={newLocShape}
                      onChange={(e) => setNewLocShape(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    >
                      <option value="horseshoe">Standard Horseshoe</option>
                      <option value="d_shaped">D-Shaped Tunnel</option>
                      <option value="circular">Circular Tunnel / Shaft</option>
                      <option value="rectangular">Rectangular Portal / Drift</option>
                      <option value="custom_profile">
                        Custom Shape (Manual / Simple CAD)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Drive Azimuth (°)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={newLocAzimuth}
                      onChange={(e) => setNewLocAzimuth(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Span W (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocWidth}
                      onChange={(e) => setNewLocWidth(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Height H (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocHeight}
                      onChange={(e) => setNewLocHeight(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Wall H (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocWallHeight}
                      onChange={(e) => setNewLocWallHeight(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Crown R (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocCrownRadius}
                      onChange={(e) => setNewLocCrownRadius(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCustomBuilderMode('new_location')}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-sky-600" />
                  <span>
                    {newLocCustomGeom?.customProfile
                      ? `Edit Custom Shape (${newLocCustomGeom.customProfile.name || 'Custom Profile'})`
                      : 'Open Custom Shape Builder (Manual + Simple CAD)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateLocation}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                >
                  Save Tunnel Location →
                </button>
              </div>
            )}

            <div className="p-2 mb-2 rounded-lg bg-sky-50 border border-sky-200 text-[10.5px] text-sky-900">
              <strong>Reference Shape Note:</strong> In 3D Digital Twin Tunnel
              (BETA), the tunnel profile is displayed strictly as a{' '}
              <strong>theoretical design wireframe</strong>—the 3D rock tunnel
              itself is reconstructed with real irregular 3D rock edges.
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!activeProject || activeProject.locations.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <p className="text-xs text-slate-600">
                    Click <strong className="text-amber-700">+ New Location</strong>{' '}
                    to configure your tunnel dimensions or build a Custom Shape.
                  </p>
                </div>
              ) : (
                activeProject.locations.map((loc) => {
                  const isSel = activeLocation?.id === loc.id;
                  return (
                    <div
                      key={loc.id}
                      onClick={() =>
                        setStore((prev) => ({
                          ...prev,
                          activeLocationId: loc.id,
                        }))
                      }
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-50 border-amber-500 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          {loc.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-mono font-bold text-[10px]">
                          {loc.shape === 'custom_profile'
                            ? 'Custom CAD Shape'
                            : loc.shape.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10.5px] font-mono text-slate-600">
                        <span>
                          Span {loc.widthM}m × Height {loc.heightM}m
                        </span>
                        <span>Azimuth {loc.defaultDriveAzimuthDeg}°</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: EXCAVATION FACE / ROUND & 20-PHOTO ACQUISITION MODE */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col overflow-hidden shadow-xs">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>3. Face Round &amp; 20-Photo Workflow</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!activeLocation) {
                    setStatusToast('Select or create a Tunnel Location first.');
                    return;
                  }
                  setShowNewRoundForm((v) => !v);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Face Round</span>
              </button>
            </div>

            {showNewRoundForm && (
              <div className="bg-slate-50 border border-emerald-300 rounded-xl p-2.5 mb-2.5 space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Chainage From (m)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={newRoundFrom}
                      onChange={(e) => setNewRoundFrom(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Chainage To (m)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={newRoundTo}
                      onChange={(e) => setNewRoundTo(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600">
                      Drive Azimuth (°)
                    </label>
                    <input
                      type="number"
                      value={newRoundAzimuth}
                      onChange={(e) => setNewRoundAzimuth(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">
                    20-Photo Left-to-Right Acquisition Method (No Wall/Crown Split)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewRoundMode('field_camera')}
                      className={`p-2 rounded-lg border text-left text-xs font-bold cursor-pointer ${
                        newRoundMode === 'field_camera'
                          ? 'bg-amber-50 border-amber-500 text-amber-950'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      <div>Field Camera Capture</div>
                      <div className="text-[9.5px] font-normal text-slate-500">
                        4 Positions × 5 Angles Live
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoundMode('photogrammetry_upload')}
                      className={`p-2 rounded-lg border text-left text-xs font-bold cursor-pointer ${
                        newRoundMode === 'photogrammetry_upload'
                          ? 'bg-sky-50 border-sky-500 text-sky-950'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      <div>Photogrammetry Upload</div>
                      <div className="text-[9.5px] font-normal text-slate-500">
                        Upload 20 Photos Left → Right
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateRound}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                >
                  Create Round &amp; Open 20-Photo Matrix →
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!activeLocation ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <p className="text-xs text-slate-600">
                    Select or create a Tunnel Location in Column 2 first.
                  </p>
                </div>
              ) : (
                store.rounds
                  .filter(
                    (r) =>
                      r.projectId === activeProject?.id &&
                      r.locationId === activeLocation.id
                  )
                  .map((rd) => {
                    const isSel = activeRound?.id === rd.id;
                    const count = Object.values(rd.photosBySlot || {}).filter(
                      isPhotoSlotPopulated
                    ).length;
                    return (
                      <div
                        key={rd.id}
                        onClick={() =>
                          setStore((prev) => ({
                            ...prev,
                            activeRoundId: rd.id,
                          }))
                        }
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSel
                            ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-slate-900 font-mono">
                            CH {rd.chainageFromM}m → {rd.chainageToM}m
                          </span>
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-mono text-[10px] font-bold">
                            {count}/20 Photos
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStore((prev) => ({
                                ...prev,
                                activeRoundId: rd.id,
                              }));
                              setActiveStep('capture_20');
                            }}
                            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-black text-[10.5px] cursor-pointer"
                          >
                            20-Photo Matrix ({count}/20)
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStore((prev) => ({
                                ...prev,
                                activeRoundId: rd.id,
                              }));
                              void runFullPhotoTo3DReconstructionAndAnalysis(rd);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] cursor-pointer"
                          >
                            Build &amp; Analyze 3D →
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== STEP 2: 20-PHOTO LEFT-TO-RIGHT ACQUISITION (4 STATIONS x 5 ANGLES) ==================== */}
      {activeStep === 'capture_20' && activeLocation && activeRound && (
        <div className="flex-1 min-h-0 flex flex-col p-3 gap-3 overflow-y-auto bg-slate-100">
          <input
            ref={batchInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleBatchUploadFiles}
          />
          <input
            ref={singleSlotInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleSingleSlotUpload}
          />

          {/* Top Control & Progress Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  20-Photo Multi-Station Acquisition (Left-to-Right &amp; Cross-Angle Overlap)
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-mono text-xs font-black">
                  {capturedCount} / 20 Captured
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                4 Camera Positions (Left → Right) × 5 Overlapping Angles per
                Position = 20 Photos. No separate Wall/Crown bays—full-tunnel
                stereo coverage.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  isLiveCameraOpen ? stopLiveCamera() : startLiveCamera()
                }
                className={`px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1.5 cursor-pointer border ${
                  isLiveCameraOpen
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>
                  {isLiveCameraOpen
                    ? 'Close Field Camera'
                    : 'Field Camera Capture (Slot #1→#20)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => batchInputRef.current?.click()}
                disabled={isBusyLoadingPhotos}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload 20 Photos Left-to-Right</span>
              </button>

              <button
                type="button"
                onClick={handleLoad20CalibrationSet}
                disabled={isBusyLoadingPhotos}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-800 border border-emerald-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                title="Populate all 20 slots with multi-angle stereo rock photographs for instant 3D reconstruction verification"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load 20-Photo Calibration Set</span>
              </button>

              <button
                type="button"
                disabled={isBusyLoadingPhotos || isRunning4EnginePipeline}
                onClick={() => {
                  stopLiveCamera();
                  void runFullPhotoTo3DReconstructionAndAnalysis(activeRound);
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Box className="w-3.5 h-3.5" />
                <span>Build &amp; Analyze Real-Edge 3D Tunnel →</span>
              </button>
            </div>
          </div>

          {/* Live Field Camera Viewfinder */}
          {isLiveCameraOpen && (
            <div className="bg-white border-2 border-amber-500 rounded-xl p-3 grid grid-cols-1 md:grid-cols-12 gap-3 shrink-0 shadow-md">
              <div className="md:col-span-7 relative bg-black rounded-lg overflow-hidden min-h-[240px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full max-h-[320px] object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-white/95 border border-amber-400 text-[11px] font-mono font-bold text-slate-900">
                  TARGET SLOT #{activeSlotNumber}/20 •{' '}
                  {
                    DIGITAL_TWIN_20_PHOTO_SPECS[activeSlotNumber - 1]
                      ?.stationLabel
                  }
                </div>
              </div>
              <div className="md:col-span-5 flex flex-col justify-between space-y-3">
                {(() => {
                  const spec =
                    DIGITAL_TWIN_20_PHOTO_SPECS[activeSlotNumber - 1] ||
                    DIGITAL_TWIN_20_PHOTO_SPECS[0];
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-black text-amber-700">
                        Active Field Capture: Photo #{spec.slotNumber} of 20
                      </h3>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs font-mono">
                        <div className="text-slate-900 font-bold">
                          {spec.stationLabel} — {spec.angleLabel}
                        </div>
                        <div className="text-sky-700 font-bold">
                          Sweep Direction: {spec.sweepDirectionLabel}
                        </div>
                        <div className="text-slate-600">
                          Camera Yaw: {spec.yawDeg > 0 ? `+${spec.yawDeg}°` : `${spec.yawDeg}°`}{' '}
                          • Pitch: {spec.pitchDeg > 0 ? `+${spec.pitchDeg}°` : `${spec.pitchDeg}°`}{' '}
                          • Target Overlap: {spec.targetOverlapPct}%
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureLiveFrameToActiveSlot}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      Snap Photo #{activeSlotNumber} &amp; Advance Next →
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Station Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All 4 Stations (20 Photos)' },
                  {
                    id: 'station_1',
                    label: 'Station 1: Left Flank (#1–#5)',
                  },
                  {
                    id: 'station_2',
                    label: 'Station 2: Left-Center (#6–#10)',
                  },
                  {
                    id: 'station_3',
                    label: 'Station 3: Right-Center (#11–#15)',
                  },
                  {
                    id: 'station_4',
                    label: 'Station 4: Right Flank (#16–#20)',
                  },
                ] as const
              ).map((tab) => {
                const active = selectedStationTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedStationTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-all ${
                      active
                        ? 'bg-sky-600 text-white border-sky-700 font-black'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {capturedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStore((prev) => ({
                    ...prev,
                    rounds: prev.rounds.map((r) =>
                      r.id === activeRound.id
                        ? { ...r, photosBySlot: {}, extracted3DJoints: undefined }
                        : r
                    ),
                  }));
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All 20 Slots</span>
              </button>
            )}
          </div>

          {/* 4 Camera Station Bays with 5 Angle Slots Each */}
          <div className="space-y-3 pb-4">
            {(['station_1', 'station_2', 'station_3', 'station_4'] as const)
              .filter(
                (stId) =>
                  selectedStationTab === 'ALL' || selectedStationTab === stId
              )
              .map((stId, stIdx) => {
                const stationSlots = DIGITAL_TWIN_20_PHOTO_SPECS.filter(
                  (s) => s.stationId === stId
                );
                const stationCapturedCount = stationSlots.filter((s) =>
                  isPhotoSlotPopulated(activeRound.photosBySlot?.[s.slotNumber])
                ).length;

                return (
                  <div
                    key={stId}
                    className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-black">
                          CAMERA POSITION {stIdx + 1} / 4
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {stationSlots[0]?.stationLabel} — 5 Overlapping Angle
                          Shots (#{stationSlots[0]?.slotNumber} to #
                          {stationSlots[4]?.slotNumber})
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-sky-700">
                        {stationCapturedCount} / 5 Angles Loaded
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {stationSlots.map((spec) => {
                        const captured =
                          activeRound.photosBySlot?.[spec.slotNumber];
                        const isCrossAngle =
                          spec.sweepDirectionLabel ===
                          'Right-to-Left Cross-Angle';

                        return (
                          <div
                            key={spec.slotNumber}
                            onClick={() => setActiveSlotNumber(spec.slotNumber)}
                            className={`rounded-xl border p-2 flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                              captured
                                ? 'bg-emerald-50/40 border-emerald-400'
                                : activeSlotNumber === spec.slotNumber
                                ? 'bg-amber-50/50 border-amber-500'
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono font-black text-[10px]">
                                PHOTO #{spec.slotNumber}/20
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold ${
                                  isCrossAngle
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : 'bg-sky-100 text-sky-900 border border-sky-300'
                                }`}
                              >
                                {isCrossAngle ? 'R→L Cross' : 'L→R Sweep'}
                              </span>
                            </div>

                            <div className="text-[11px] font-bold text-slate-800 truncate">
                              {spec.angleLabel}
                            </div>

                            {captured ? (
                              <div className="relative rounded-lg overflow-hidden border border-slate-300 aspect-4/3 bg-slate-900">
                                <img
                                  src={captured.dataUrl}
                                  alt={spec.angleLabel}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-slate-200 px-1.5 py-0.5 flex items-center justify-between text-[9.5px] font-mono font-bold text-emerald-800">
                                  <span>Sharp {captured.sharpnessScore}%</span>
                                  <span>
                                    Overlap {captured.estimatedOverlapPct}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-slate-300 aspect-4/3 bg-white flex flex-col items-center justify-center p-2 text-center">
                                <Camera className="w-5 h-5 text-slate-400 mb-1" />
                                <span className="text-[10px] font-mono text-slate-600">
                                  Yaw {spec.yawDeg > 0 ? `+${spec.yawDeg}°` : `${spec.yawDeg}°`}{' '}
                                  • Pitch {spec.pitchDeg > 0 ? `+${spec.pitchDeg}°` : `${spec.pitchDeg}°`}
                                </span>
                                <span className="text-[9.5px] text-slate-500">
                                  Target Overlap {spec.targetOverlapPct}%
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetUploadSlot(spec.slotNumber);
                                  singleSlotInputRef.current?.click();
                                }}
                                className="flex-1 py-1 rounded bg-white hover:bg-slate-100 text-sky-800 border border-slate-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>
                                  {captured ? 'Replace' : 'Capture / Upload'}
                                </span>
                              </button>
                              {captured && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStore((prev) => {
                                      const nextSlots = {
                                        ...(activeRound.photosBySlot || {}),
                                      };
                                      delete nextSlots[spec.slotNumber];
                                      return {
                                        ...prev,
                                        rounds: prev.rounds.map((r) =>
                                          r.id === activeRound.id
                                            ? { ...r, photosBySlot: nextSlots }
                                            : r
                                        ),
                                      };
                                    });
                                  }}
                                  className="p-1 rounded bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 cursor-pointer"
                                  title="Remove photo from this slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ==================== STEP 3 & STEP 4: WHITE-LIGHT REAL-EDGE 3D DIGITAL TWIN TUNNEL & DEDICATED WORKING WINDOW ==================== */}
      {is3DViewportStep &&
        activeLocation &&
        activeRound &&
        reconstructedModel && (
          <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row overflow-hidden bg-slate-100">
            {/* LEFT / MAIN PANE: LIVE INTERACTIVE 3D DIGITAL TWIN TUNNEL VIEWPORT */}
            <div
              className={`relative flex flex-col min-w-0 overflow-hidden bg-slate-50 ${
                activeStep === 'joint_dip_inspector_window'
                  ? 'w-full lg:w-[48%] xl:w-[50%] h-[45dvh] lg:h-full border-b lg:border-b-0 lg:border-r-2 border-slate-300'
                  : 'flex-1 h-full w-full'
              }`}
            >
              {/* Dedicated Top Toolbar inside Step 4 Left 3D Pane (No Floating Occlusion!) */}
              {activeStep === 'joint_dip_inspector_window' && (
                <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-1.5 shrink-0 z-20">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono font-black text-[10px]">
                        LIVE 3D TWIN INSPECTOR
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">
                        Click 3D Rock to Select, Add or Probe Joints
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActive3DToolMode('orbit');
                          setPendingNewJointClicks([]);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                          active3DToolMode === 'orbit'
                            ? 'bg-slate-900 text-white border-slate-950 font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        3D Orbit &amp; Click-Select
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActive3DToolMode((m) =>
                            m === 'add_3d_joint' ? 'orbit' : 'add_3d_joint'
                          );
                          setPendingNewJointClicks([]);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                          active3DToolMode === 'add_3d_joint'
                            ? 'bg-emerald-600 text-white border-emerald-700 font-black'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-400'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Click 3D to Add Joint/Dip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActive3DToolMode((m) =>
                            m === 'facet_probe' ? 'orbit' : 'facet_probe'
                          )
                        }
                        className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                          active3DToolMode === 'facet_probe'
                            ? 'bg-sky-600 text-white border-sky-700 font-black'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>3D Probe</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActive3DToolMode((m) =>
                            m === 'ruler' ? 'orbit' : 'ruler'
                          );
                          setRulerPoints([]);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer ${
                          active3DToolMode === 'ruler'
                            ? 'bg-amber-500 text-slate-950 border-amber-600 font-black'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        <Ruler className="w-3 h-3" />
                        <span>3D Ruler</span>
                      </button>
                    </div>
                  </div>

                  {/* Second Row of Step 4 Left Toolbar: Render Mode, Layer Toggles & Camera Teleporter */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        value={renderSurfaceMode}
                        onChange={(e) =>
                          setRenderSurfaceMode(e.target.value as any)
                        }
                        className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-900"
                      >
                        <option value="rock_with_break_edges">
                          3D Rock + Break Edges
                        </option>
                        <option value="textured_rock_mesh">
                          Textured 3D Rock Mesh
                        </option>
                        <option value="dense_point_cloud">
                          Dense 3D Point Cloud
                        </option>
                        <option value="normal_dip_map">
                          3D Surface Dip/Normal Map
                        </option>
                        <option value="overbreak_heatmap">
                          Overbreak/Underbreak Heat-Map
                        </option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setShow3DDipSurfaces((v) => !v)}
                        className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                          show3DDipSurfaces
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        Dip Planes
                      </button>
                      <button
                        type="button"
                        onClick={() => setShow3DJointTraces((v) => !v)}
                        className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                          show3DJointTraces
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        Persistence Traces
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDesignWireframe((v) => !v)}
                        className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                          showDesignWireframe
                            ? 'bg-sky-100 text-sky-900 border-sky-400'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        Design Cage
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowKeyBlockWedges((v) => !v)}
                        className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${
                          showKeyBlockWedges
                            ? 'bg-rose-100 text-rose-900 border-rose-400'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        Key-Blocks
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'portal', label: 'Portal' },
                          { id: 'face_closeup', label: 'Face' },
                          { id: 'top_plan', label: 'Plan' },
                          { id: 'side_profile', label: 'Side' },
                        ] as const
                      ).map((vp) => (
                        <button
                          key={vp.id}
                          type="button"
                          onClick={() => teleportCameraToPreset(vp.id)}
                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-sky-100 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                        >
                          {vp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Shared Live White-Light 3D WebGL Canvas Mount */}
              <div className="relative flex-1 min-h-0 w-full h-full">
                <div ref={canvasMountRef} className="w-full h-full" />

                {/* Live 4-Engine Consensus Progress Overlay Banner */}
                {isRunning4EnginePipeline && fourEngineStageInfo && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white border-2 border-indigo-600 rounded-xl p-3 w-[min(560px,92%)] shadow-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-black text-indigo-950">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span>
                          4-Engine Consensus 3D Joint &amp; Dip Surface
                          Extraction
                        </span>
                      </span>
                      <span className="font-mono text-indigo-700">
                        Stage {fourEngineStageInfo.stageIndex}/4 •{' '}
                        {fourEngineStageInfo.progressPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${fourEngineStageInfo.progressPct}%` }}
                      />
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-700">
                      {fourEngineStageInfo.label}
                    </div>
                  </div>
                )}

                {/* Top-Left White-Light Engineering Telemetry & 4-Engine Launcher Bar (Only in Full-Bleed Step 3) */}
                {activeStep === 'reconstruct_3d' && (
                  <div className="absolute top-3 left-3 z-10 bg-white/95 border border-slate-300 rounded-xl p-2.5 space-y-2 max-w-sm shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-900">
                          Real-Edge 3D Excavated Tunnel
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-[10px] font-bold">
                          {capturedCount}/20 Photos
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => teleportCameraToPreset('portal')}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Reset 3D Camera View"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset View</span>
                      </button>
                    </div>

                    {/* Dedicated Working Window Launcher Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowJointAnalysisModal(false);
                        setActiveStep('joint_dip_inspector_window');
                      }}
                      className="w-full py-2 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Compass className="w-4 h-4 shrink-0" />
                      <span>
                        Open Dedicated 3D Joint, Dip &amp; Live Inspector Window →
                      </span>
                    </button>

                    {/* Primary 4-Engine 3D Joint & Dip Surface Action Buttons */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={isRunning4EnginePipeline}
                        onClick={handleRun4EngineConsensus}
                        className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-[10.5px] flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        title="Run MATLAB 3D Covariance SVD + 3D RANSAC + Shadow-Invariant Filter + Gemini AI Consensus across Walls, Crown & Face"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>Run 4-Engine 3D Analysis</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowJointAnalysisModal((v) => !v)}
                        className={`py-1.5 px-2 rounded-lg font-black text-[10.5px] flex items-center justify-center gap-1 cursor-pointer border ${
                          showJointAnalysisModal
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-400'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Quick Matrix (
                          {
                            all3DJoints.filter(
                              (j) =>
                                j.status !== 'Rejected Shadow / Disturbance'
                            ).length
                          }
                          )
                        </span>
                      </button>
                    </div>

              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[9px]">
                    3D Points
                  </span>
                  <span className="text-slate-900 font-extrabold">
                    {reconstructedModel.totalPointCloudCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-indigo-50 border border-indigo-200">
                  <span className="text-indigo-700 block text-[9px]">
                    3D Dip Planes
                  </span>
                  <span className="text-indigo-900 font-extrabold">
                    {
                      all3DJoints.filter(
                        (j) => j.status !== 'Rejected Shadow / Disturbance'
                      ).length
                    }{' '}
                    Valid
                  </span>
                </div>
                <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 block text-[9px]">
                    Shadows Filtered
                  </span>
                  <span className="text-emerald-900 font-extrabold">
                    {
                      all3DJoints.filter(
                        (j) => j.status === 'Rejected Shadow / Disturbance'
                      ).length
                    }{' '}
                    Rejected
                  </span>
                </div>
                <div className="p-1.5 rounded bg-rose-50 border border-rose-200">
                  <span className="text-rose-700 block text-[9px]">
                    Overbreak
                  </span>
                  <span className="text-rose-800 font-extrabold">
                    +{reconstructedModel.maxOverbreakCm}cm
                  </span>
                </div>
              </div>

              {/* 3D Excavation Zone Filter Pills (Walls, Crown & Face) */}
              <div className="pt-1 border-t border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-600">
                    3D Joint &amp; Dip Zone Filter:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRejectedDisturbances((v) => !v)}
                    className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold border cursor-pointer ${
                      showRejectedDisturbances
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                    title="Show or Hide lighting shadows and blast disturbances rejected by Engine 3 & 4"
                  >
                    {showRejectedDisturbances
                      ? 'Showing Rejected Shadows'
                      : 'Shadows Eliminated ✓'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'ALL', label: 'All 3D' },
                      { id: 'Left Wall', label: 'Left Wall' },
                      { id: 'Crown Arch', label: 'Crown' },
                      { id: 'Right Wall', label: 'Right Wall' },
                      { id: 'Advancing Face', label: 'Face' },
                    ] as const
                  ).map((zf) => (
                    <button
                      key={zf.id}
                      type="button"
                      onClick={() => setActiveJointZoneFilter(zf.id)}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-bold border cursor-pointer ${
                        activeJointZoneFilter === zf.id
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {zf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Presets & 20-Station Teleporter */}
              <div className="pt-1 border-t border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600">
                    Camera Viewpoints &amp; 20-Station Teleporter:
                  </span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'portal', label: 'Portal' },
                        { id: 'face_closeup', label: 'Face' },
                        { id: 'top_plan', label: 'Plan' },
                        { id: 'side_profile', label: 'Side' },
                      ] as const
                    ).map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => teleportCameraToPreset(vp.id)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-sky-100 text-slate-800 border border-slate-300 text-[9.5px] font-bold cursor-pointer"
                      >
                        {vp.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {DIGITAL_TWIN_20_PHOTO_SPECS.map((sp) => {
                    const isAct = inspectedPhotoSlot === sp.slotNumber;
                    return (
                      <button
                        key={sp.slotNumber}
                        type="button"
                        onClick={() => teleportCameraToPreset(sp.slotNumber)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] font-bold shrink-0 cursor-pointer border ${
                          isAct
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={`Teleport 3D Camera to Photo #${sp.slotNumber} (${sp.angleLabel})`}
                      >
                        #{sp.slotNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
                )}

            {/* Active 3D Tool Readout Banner (Top-Center when Add 3D Joint, Ruler, or 3D Facet Probe is Active) */}
            {active3DToolMode === 'add_3d_joint' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 border-2 border-emerald-600 rounded-xl px-3.5 py-2 flex flex-wrap items-center gap-2.5 text-xs font-mono shadow-xl">
                <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-900 font-black">
                  Add 3D Joint &amp; Dip Surface (
                  {pendingNewJointClicks.length === 0
                    ? 'Click Start Point P1 on 3D Wall, Crown, or Face'
                    : 'P1 Set! Now Click End Point P2 on 3D Rock to Fit 3D Plane & Persistence'}
                  ):
                </span>
                <select
                  value={newJointPreferredSet}
                  onChange={(e) =>
                    setNewJointPreferredSet(e.target.value as Joint3DSetId)
                  }
                  className="bg-emerald-50 border border-emerald-400 rounded px-2 py-0.5 text-xs font-bold text-emerald-950"
                >
                  <option value="J1">Set J1 (Primary)</option>
                  <option value="J2">Set J2 (Conjugate)</option>
                  <option value="J3">Set J3 (Cross Joint)</option>
                  <option value="S0 (Bedding)">S0 (Bedding / Foliation)</option>
                  <option value="Fault/Shear">Fault / Shear Zone</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setPendingNewJointClicks([]);
                    setActive3DToolMode('orbit');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {active3DToolMode === 'ruler' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 border-2 border-amber-500 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs font-mono shadow-lg">
                <Ruler className="w-4 h-4 text-amber-600 shrink-0" />
                {rulerPoints.length === 0 && (
                  <span className="text-slate-800 font-bold">
                    Click any 2 points on the 3D rock surface to measure 3D rock
                    edge length &amp; radial overbreak depth
                  </span>
                )}
                {rulerPoints.length === 1 && (
                  <span className="text-amber-800 font-bold">
                    P1 Set (Radial Δ:{' '}
                    {rulerPoints[0].radialDevCm >= 0
                      ? `+${rulerPoints[0].radialDevCm}cm Overbreak`
                      : `${rulerPoints[0].radialDevCm}cm Underbreak`}
                    ) — Click Point 2 on 3D Rock
                  </span>
                )}
                {rulerPoints.length === 2 && rulerDistanceM !== null && (
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-800 font-black">
                      3D Edge Length: {rulerDistanceM.toFixed(3)} m
                    </span>
                    <span className="text-sky-800 font-bold">
                      P1 Δ: {rulerPoints[0].radialDevCm}cm | P2 Δ:{' '}
                      {rulerPoints[1].radialDevCm}cm
                    </span>
                    <button
                      type="button"
                      onClick={() => setRulerPoints([])}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {active3DToolMode === 'facet_probe' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 border-2 border-sky-600 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs font-mono shadow-lg">
                <Crosshair className="w-4 h-4 text-sky-600 shrink-0" />
                {!selectedFacetInfo ? (
                  <span className="text-slate-800 font-bold">
                    3D Dip/Strike Facet Probe Active: Click any rock fracture
                    facet on the 3D tunnel to extract Dip, Dip Direction, Strike
                    &amp; JRC
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-black">
                      {selectedFacetInfo.setId} ({selectedFacetInfo.classification})
                    </span>
                    <span className="text-slate-900 font-black">
                      Dip: {selectedFacetInfo.dipDeg}° / Dip Dir:{' '}
                      {String(selectedFacetInfo.dipDirectionDeg).padStart(3, '0')}°
                      (Strike: {String(selectedFacetInfo.strikeDeg).padStart(3, '0')}°)
                    </span>
                    <span className="text-emerald-800 font-bold">
                      JRC: {selectedFacetInfo.jrcRoughness}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProbedFacets([]);
                        setSelectedFacetInfo(null);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold cursor-pointer"
                    >
                      Clear Probes
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3 Floating Overlays (Hidden when inside Step 4 Dedicated Working Window) */}
            {activeStep === 'reconstruct_3d' && (
              <>
            {/* Top-Right Inspector Stack: Live 3D Joint & Dip Surface Quick-Editor, Key-Blocks & Slicer */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 w-84 max-h-[calc(100dvh-155px)] overflow-y-auto no-scrollbar">
              {/* 4-Engine 3D Joint & Dip Surface Quick Inspector + Persistence Editor Card */}
              <div className="bg-white/95 border border-slate-300 rounded-xl p-2.5 space-y-2 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3D Joints &amp; Dip Surfaces (Walls/Crown/Face)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowJointAnalysisModal(true)}
                    className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-[9.5px] font-mono font-bold cursor-pointer"
                  >
                    Full Matrix &amp; Stereonet →
                  </button>
                </div>

                {/* Compact list of extracted/edited 3D joints */}
                <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                  {filtered3DJoints.map((j) => {
                    const isSel = selected3DJoint?.id === j.id;
                    const isRej = j.status === 'Rejected Shadow / Disturbance';
                    const cv = j.crossValidation;
                    return (
                      <div
                        key={j.id}
                        onClick={() => focusCameraOn3DJoint(j)}
                        className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between cursor-pointer transition-all ${
                          isSel
                            ? 'bg-amber-50 border-amber-500 shadow-2xs'
                            : isRej
                            ? 'bg-slate-100 border-slate-300 text-slate-500'
                            : 'bg-slate-50 hover:bg-sky-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: j.colorHex }}
                          />
                          <span className="font-black text-slate-900">
                            {j.code}
                          </span>
                          <span className="px-1 py-0.2 rounded bg-white border border-slate-300 text-[8.5px] font-bold text-slate-700 truncate">
                            {j.zone}
                          </span>
                          {cv && (
                            <span
                              className={`px-1 py-0.2 rounded text-[8.5px] font-black ${
                                isRej
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                              title={`Inter-Engine Mean Δθ=${cv.meanPairwiseDeltaDeg}° • Fisher κ=${cv.fisherKappa}`}
                            >
                              {cv.enginesAgreedCount}/4 Δ{cv.meanPairwiseDeltaDeg}°
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-sky-900">
                            {j.dipDeg}°/{String(j.dipDirectionDeg).padStart(3, '0')}°
                          </span>
                          <span className="ml-1 text-emerald-800 font-bold">
                            L={j.persistenceM}m
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live 3D Joint Persistence & Dip Orientation Editor + 4-Engine Mutual Cross-Validation for Selected Joint */}
                {selected3DJoint && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-300 space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 font-mono">
                        EDIT {selected3DJoint.code} ({selected3DJoint.zone})
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono font-bold text-[9px]">
                          {selected3DJoint.crossValidation.enginesAgreedCount}/4 Lock •{' '}
                          {selected3DJoint.overallConfidencePct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.id === selected3DJoint.id
                                  ? snapJointTo4EngineFisherConsensus(
                                      item,
                                      driveAz
                                    )
                                  : item
                              )
                            );
                            setStatusToast(
                              `Snapped ${selected3DJoint.code} to 4-Engine Fisher Spherical Consensus (${selected3DJoint.crossValidation.fisherConsensusDipDeg}°/${String(selected3DJoint.crossValidation.fisherConsensusDipDirDeg).padStart(3, '0')}°, L=${selected3DJoint.crossValidation.fisherConsensusPersistenceM}m).`
                            );
                          }}
                          className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[8.5px] cursor-pointer"
                          title="Snap Dip, Dip Direction, and Persistence to Weighted 4-Engine Fisher Spherical Consensus"
                        >
                          Snap 4-Eng
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateActiveRound3DJoints((list) =>
                              list.filter((item) => item.id !== selected3DJoint.id)
                            );
                            setSelected3DJointId(null);
                          }}
                          className="p-0.5 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Delete this 3D Joint"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 font-mono">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600">
                          Dip Angle (°)
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={89}
                          value={selected3DJoint.dipDeg}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 45;
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.id === selected3DJoint.id
                                  ? recomputeEdited3DJointGeometry(
                                      item,
                                      { dipDeg: val },
                                      driveAz
                                    )
                                  : item
                              )
                            );
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-600">
                          Dip Dir (°)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={359}
                          value={selected3DJoint.dipDirectionDeg}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.id === selected3DJoint.id
                                  ? recomputeEdited3DJointGeometry(
                                      item,
                                      { dipDirectionDeg: val },
                                      driveAz
                                    )
                                  : item
                              )
                            );
                          }}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-emerald-800">
                          Persistence (m)
                        </label>
                        <input
                          type="number"
                          step={0.1}
                          min={0.3}
                          max={18}
                          value={selected3DJoint.persistenceM}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 1.5;
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.id === selected3DJoint.id
                                  ? recomputeEdited3DJointGeometry(
                                      item,
                                      { persistenceM: val },
                                      driveAz
                                    )
                                  : item
                              )
                            );
                          }}
                          className="w-full bg-white border border-emerald-400 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-950"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={selected3DJoint.setId}
                        onChange={(e) => {
                          const driveAz =
                            activeRound.driveAzimuthDeg ||
                            activeLocation.defaultDriveAzimuthDeg ||
                            45;
                          updateActiveRound3DJoints((list) =>
                            list.map((item) =>
                              item.id === selected3DJoint.id
                                ? recomputeEdited3DJointGeometry(
                                    item,
                                    { setId: e.target.value as Joint3DSetId },
                                    driveAz
                                  )
                                : item
                            )
                          );
                        }}
                        className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-900"
                      >
                        <option value="J1">Set J1 (Primary)</option>
                        <option value="J2">Set J2 (Conjugate)</option>
                        <option value="J3">Set J3 (Cross Joint)</option>
                        <option value="S0 (Bedding)">S0 (Bedding)</option>
                        <option value="Fault/Shear">Fault / Shear</option>
                        <option value="Shadow/Blast Rejected">
                          Shadow / Blast Rejected
                        </option>
                      </select>

                      <select
                        value={selected3DJoint.status}
                        onChange={(e) => {
                          const driveAz =
                            activeRound.driveAzimuthDeg ||
                            activeLocation.defaultDriveAzimuthDeg ||
                            45;
                          updateActiveRound3DJoints((list) =>
                            list.map((item) =>
                              item.id === selected3DJoint.id
                                ? recomputeEdited3DJointGeometry(
                                    item,
                                    {
                                      status: e.target
                                        .value as Joint3DValidationStatus,
                                    },
                                    driveAz
                                  )
                                : item
                            )
                          );
                        }}
                        className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-900"
                      >
                        <option value="Validated Natural Joint">
                          Validated Natural Joint
                        </option>
                        <option value="User Added / Edited">
                          User Added / Edited
                        </option>
                        <option value="Rejected Shadow / Disturbance">
                          Rejected Shadow / Disturbance
                        </option>
                      </select>
                    </div>

                    {/* 4-Engine Mutual Cross-Validation Mini Breakdown */}
                    <div className="pt-1 border-t border-slate-200 space-y-1 font-mono text-[9px]">
                      <div className="flex items-center justify-between text-slate-700 font-bold">
                        <span>
                          Inter-Engine Mean Δθ:{' '}
                          <strong className="text-indigo-800">
                            {selected3DJoint.crossValidation.meanPairwiseDeltaDeg}°
                          </strong>{' '}
                          (±{selected3DJoint.crossValidation.fisherAlpha95Deg}°)
                        </span>
                        <span>
                          κ={selected3DJoint.crossValidation.fisherKappa} • RMS{' '}
                          {selected3DJoint.crossValidation.rmsPointToPlaneErrorMm}mm
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {selected3DJoint.crossValidation.engineEstimates.map(
                          (eng) => (
                            <div
                              key={eng.engineId}
                              className={`px-1.5 py-0.5 rounded border flex items-center justify-between ${
                                eng.passedGate
                                  ? 'bg-white border-emerald-300 text-slate-800'
                                  : 'bg-rose-50 border-rose-300 text-rose-900'
                              }`}
                            >
                              <span className="font-bold truncate">
                                {eng.shortLabel}
                              </span>
                              <span className="font-black">
                                {eng.dipDeg}°/
                                {String(eng.dipDirectionDeg).padStart(3, '0')}°
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3D Key-Block & Structural Facet Summary Card */}
              {showKeyBlockWedges && (
                <div className="bg-white/95 border border-slate-300 rounded-xl p-2.5 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>3D Key-Block Wedge Stability</span>
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-emerald-700">
                      J1 × J2 × J3
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {reconstructedModel.detected3DWedges.map((wdg) => (
                      <div
                        key={wdg.id}
                        className={`p-2 rounded-lg border text-[10px] font-mono ${
                          wdg.factorOfSafety < 1.2
                            ? 'bg-rose-50 border-rose-300 text-rose-950'
                            : 'bg-amber-50 border-amber-300 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black">
                          <span>{wdg.label}</span>
                          <span>FoS: {wdg.factorOfSafety.toFixed(2)}</span>
                        </div>
                        <div className="text-[9.5px] mt-0.5 flex items-center justify-between">
                          <span>
                            Vol: {wdg.volumeM3}m³ ({wdg.weightTonnes}t)
                          </span>
                          <span>
                            Slide: {wdg.slidingAzimuthDeg}°/{wdg.slidingPlungeDeg}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive 2D Cross-Section Slicer Comparison Overlay */}
              {showChainageSlicer && activeSliceData && (
                <div className="bg-white/95 border border-sky-400 rounded-xl p-3 space-y-2 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 font-mono">
                      SLICE CH {activeSliceData.chainageM.toFixed(2)}m
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          exportSliceCrossSectionToDXF(
                            activeSliceData,
                            activeLocation.name
                          )
                        }
                        className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-[9.5px] cursor-pointer"
                        title="Export this Cross-Section Slice (Real Rock Edge + Reference Design Profile) to AutoCAD .DXF"
                      >
                        Export .DXF
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChainageSlicer(false)}
                        className="text-slate-500 hover:text-slate-900 text-xs font-bold cursor-pointer px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* White-Light 2D CAD Cross Section Comparing Real Irregular Rock vs Theoretical Design Reference */}
                  <svg
                    viewBox="-6 -1 12 10"
                    className="w-full h-32 bg-slate-50 rounded-lg border border-slate-300"
                  >
                    <polyline
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="0.09"
                      strokeDasharray="0.22 0.14"
                      points={activeSliceData.designPoints2D
                        .map((p) => `${p.x.toFixed(2)},${(8.5 - p.y).toFixed(2)}`)
                        .join(' ')}
                    />
                    <polyline
                      fill="rgba(234, 88, 12, 0.10)"
                      stroke="#ea580c"
                      strokeWidth="0.11"
                      points={activeSliceData.realRockPoints2D
                        .map((p) => `${p.x.toFixed(2)},${(8.5 - p.y).toFixed(2)}`)
                        .join(' ')}
                    />
                  </svg>

                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={reconstructedModel.sliceSections.length - 1}
                      value={activeSliceIndex}
                      onChange={(e) =>
                        setActiveSliceIndex(Number(e.target.value))
                      }
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-700">
                      <span className="text-rose-700">
                        Overbreak: {activeSliceData.overbreakAreaM2} m²
                      </span>
                      <span className="text-sky-700">
                        Underbreak: {activeSliceData.underbreakAreaM2} m²
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== 4-ENGINE 3D JOINT, PERSISTENCE & STEREONET ANALYSIS MODAL ==================== */}
            {showJointAnalysisModal && (
              <div className="absolute inset-3 z-30 bg-white border-2 border-slate-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs sm:text-sm font-black tracking-tight">
                      4-Engine Consensus 3D Joint &amp; Dip Surface Extraction
                      Matrix (Walls, Crown &amp; Face)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold">
                      MATLAB SVD + 3D RANSAC + Shadow Filter + Gemini AI
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isRunning4EnginePipeline}
                      onClick={handleRun4EngineConsensus}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Re-Run 4-Engine Validation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        export3DJointsAuditToCSV(
                          all3DJoints,
                          activeProject?.projectName || 'NATM Project',
                          activeLocation.name,
                          activeRound.chainageFromM,
                          activeRound.chainageToM
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Audit .CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        export3DJointsAndDipSurfacesToDXF(
                          all3DJoints,
                          activeLocation.name,
                          activeRound.chainageFromM,
                          activeRound.chainageToM
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export 3D .DXF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJointAnalysisModal(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Close ✕
                    </button>
                  </div>
                </div>

                {/* Synthesis Banner */}
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950 shrink-0">
                  <div>
                    <strong>Multi-Method Synthesis:</strong>{' '}
                    {activeRound.last4EngineSynthesisNote ||
                      'True 3D Dip Angles, Dip Directions, Strikes & Persistence extracted directly from 3D Left Wall, Crown Arch, Right Wall & Face normals while rejecting lighting shadows and blast marks.'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowJointAnalysisModal(false);
                        setActive3DToolMode('add_3d_joint');
                        setPendingNewJointClicks([]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Click 3D Tunnel to Add Joint / Dip Surface</span>
                    </button>
                  </div>
                </div>

                {/* Main Content Grid: Left 8 Cols = 4-Engine Validation Table, Right 4 Cols = Stereonet & MATLAB Eigenvalues */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto">
                  {/* Left 8 Columns: Full 4-Engine Mutual Cross-Validation & 3D Joint Inventory Table */}
                  <div className="lg:col-span-8 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900">
                        4-Engine Mutual Cross-Validation Table (Independent E1–E4
                        Orientations, Pairwise Δθ° &amp; Fisher κ)
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.status === 'Rejected Shadow / Disturbance'
                                  ? item
                                  : snapJointTo4EngineFisherConsensus(
                                      item,
                                      driveAz
                                    )
                              )
                            );
                            setStatusToast(
                              'Snapped all validated 3D Joints & Dip Surfaces to Weighted 4-Engine Fisher Spherical Consensus.'
                            );
                          }}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] cursor-pointer"
                        >
                          Snap All to 4-Engine Fisher Consensus
                        </button>
                        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showRejectedDisturbances}
                            onChange={(e) =>
                              setShowRejectedDisturbances(e.target.checked)
                            }
                            className="accent-indigo-600"
                          />
                          <span>
                            Show Rejected Shadows &amp; Disturbances (
                            {
                              all3DJoints.filter(
                                (j) =>
                                  j.status === 'Rejected Shadow / Disturbance'
                              ).length
                            }
                            )
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse text-[10.5px] font-mono">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[9.5px] uppercase">
                            <th className="p-2">Code</th>
                            <th className="p-2">3D Zone</th>
                            <th className="p-2">Set</th>
                            <th className="p-2">Dip (°)</th>
                            <th className="p-2">Dip Dir (°)</th>
                            <th className="p-2">Persist (m)</th>
                            <th className="p-2">E1 MATLAB SVD</th>
                            <th className="p-2">E2 Huber RANSAC</th>
                            <th className="p-2">E3 3D Dihedral</th>
                            <th className="p-2">E4 Gemini+Fisher</th>
                            <th className="p-2">Mean Δθ°</th>
                            <th className="p-2">Fisher κ (±α95)</th>
                            <th className="p-2">4-Eng Lock</th>
                            <th className="p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filtered3DJoints.map((j) => {
                            const isRej =
                              j.status === 'Rejected Shadow / Disturbance';
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            const cv = j.crossValidation;
                            const e1 = cv.engineEstimates[0];
                            const e2 = cv.engineEstimates[1];
                            const e3 = cv.engineEstimates[2];
                            const e4 = cv.engineEstimates[3];
                            return (
                              <tr
                                key={j.id}
                                onClick={() => setSelected3DJointId(j.id)}
                                className={`cursor-pointer ${
                                  isRej
                                    ? 'bg-slate-100/80 text-slate-500'
                                    : selected3DJoint?.id === j.id
                                    ? 'bg-amber-50/80'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="p-1.5 font-black text-slate-900 whitespace-nowrap">
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full mr-1"
                                    style={{ backgroundColor: j.colorHex }}
                                  />
                                  {j.code}
                                </td>
                                <td className="p-1.5 font-bold text-slate-800 whitespace-nowrap">
                                  {j.zone}
                                </td>
                                <td className="p-1.5">
                                  <select
                                    value={j.setId}
                                    onChange={(e) =>
                                      updateActiveRound3DJoints((list) =>
                                        list.map((item) =>
                                          item.id === j.id
                                            ? recomputeEdited3DJointGeometry(
                                                item,
                                                {
                                                  setId: e.target
                                                    .value as Joint3DSetId,
                                                },
                                                driveAz
                                              )
                                            : item
                                        )
                                      )
                                    }
                                    className="bg-white border border-slate-300 rounded px-1 py-0.5 text-[10px] font-bold text-slate-900"
                                  >
                                    <option value="J1">J1</option>
                                    <option value="J2">J2</option>
                                    <option value="J3">J3</option>
                                    <option value="S0 (Bedding)">
                                      S0 (Bedding)
                                    </option>
                                    <option value="Fault/Shear">
                                      Fault/Shear
                                    </option>
                                    <option value="Shadow/Blast Rejected">
                                      Rejected
                                    </option>
                                  </select>
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    min={2}
                                    max={89}
                                    value={j.dipDeg}
                                    onChange={(e) =>
                                      updateActiveRound3DJoints((list) =>
                                        list.map((item) =>
                                          item.id === j.id
                                            ? recomputeEdited3DJointGeometry(
                                                item,
                                                {
                                                  dipDeg:
                                                    Number(e.target.value) || 45,
                                                },
                                                driveAz
                                              )
                                            : item
                                        )
                                      )
                                    }
                                    className="w-11 bg-white border border-slate-300 rounded px-1 py-0.5 text-center font-bold text-slate-900"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={359}
                                    value={j.dipDirectionDeg}
                                    onChange={(e) =>
                                      updateActiveRound3DJoints((list) =>
                                        list.map((item) =>
                                          item.id === j.id
                                            ? recomputeEdited3DJointGeometry(
                                                item,
                                                {
                                                  dipDirectionDeg:
                                                    Number(e.target.value) || 0,
                                                },
                                                driveAz
                                              )
                                            : item
                                        )
                                      )
                                    }
                                    className="w-13 bg-white border border-slate-300 rounded px-1 py-0.5 text-center font-bold text-slate-900"
                                  />
                                </td>
                                <td className="p-1.5">
                                  <input
                                    type="number"
                                    step={0.1}
                                    min={0.3}
                                    max={18}
                                    value={j.persistenceM}
                                    onChange={(e) =>
                                      updateActiveRound3DJoints((list) =>
                                        list.map((item) =>
                                          item.id === j.id
                                            ? recomputeEdited3DJointGeometry(
                                                item,
                                                {
                                                  persistenceM:
                                                    Number(e.target.value) ||
                                                    1.5,
                                                },
                                                driveAz
                                              )
                                            : item
                                        )
                                      )
                                    }
                                    className="w-13 bg-emerald-50 border border-emerald-400 rounded px-1 py-0.5 text-center font-black text-emerald-950"
                                  />
                                </td>
                                <td className="p-1.5 whitespace-nowrap text-indigo-900">
                                  <div className="font-bold">
                                    {e1.dipDeg}°/{String(e1.dipDirectionDeg).padStart(3, '0')}°
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    P_λ={e1.confidencePct}% • Δ{e1.angularDeltaFromConsensusDeg}°
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap text-sky-900">
                                  <div className="font-bold">
                                    {e2.dipDeg}°/{String(e2.dipDirectionDeg).padStart(3, '0')}°
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    Inl={e2.confidencePct}% • Δ{e2.angularDeltaFromConsensusDeg}°
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap text-emerald-900">
                                  <div className="font-bold">
                                    {e3.dipDeg}°/{String(e3.dipDirectionDeg).padStart(3, '0')}°
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    Step={cv.dihedralStepAngleDeg}° • Δ{e3.angularDeltaFromConsensusDeg}°
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap text-purple-900">
                                  <div className="font-bold">
                                    {e4.dipDeg}°/{String(e4.dipDirectionDeg).padStart(3, '0')}°
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    AI={e4.confidencePct}% • Δ{e4.angularDeltaFromConsensusDeg}°
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap font-black text-slate-900">
                                  {cv.meanPairwiseDeltaDeg}°
                                  <div className="text-[9px] font-normal text-slate-500">
                                    max {cv.maxPairwiseDeltaDeg}°
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap font-bold text-slate-800">
                                  κ={cv.fisherKappa}
                                  <div className="text-[9px] text-indigo-700">
                                    ±{cv.fisherAlpha95Deg}° • {cv.rmsPointToPlaneErrorMm}mm
                                  </div>
                                </td>
                                <td className="p-1.5 whitespace-nowrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-black text-[9.5px] ${
                                      isRej
                                        ? 'bg-rose-100 text-rose-800'
                                        : cv.enginesAgreedCount === 4
                                        ? 'bg-emerald-100 text-emerald-950'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {cv.enginesAgreedCount}/4 •{' '}
                                    {j.overallConfidencePct}%
                                  </span>
                                </td>
                                <td className="p-1.5 whitespace-nowrap space-x-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowJointAnalysisModal(false);
                                      focusCameraOn3DJoint(j);
                                    }}
                                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[9.5px] cursor-pointer"
                                  >
                                    3D View
                                  </button>
                                  {!isRej && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateActiveRound3DJoints((list) =>
                                          list.map((item) =>
                                            item.id === j.id
                                              ? snapJointTo4EngineFisherConsensus(
                                                  item,
                                                  driveAz
                                                )
                                              : item
                                          )
                                        );
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9.5px] cursor-pointer"
                                      title="Snap this joint to the exact weighted 4-engine Fisher consensus"
                                    >
                                      Snap
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

                  {/* Right 4 Columns: Lower-Hemisphere Equal-Area Schmidt Stereonet (with E1-E4 Sub-Poles & alpha95 Cone) + 6-Pair Cross-Validation Matrix */}
                  <div className="lg:col-span-4 flex flex-col gap-3">
                    {/* Lower-Hemisphere Equal-Area Schmidt Stereonet (3D Walls, Crown & Face Poles + E1..E4 Sub-Poles) */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-slate-900">
                          3D Stereonet + 4-Engine Fisher Cones
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-600">
                          Drive N {activeRound.driveAzimuthDeg}° E
                        </span>
                      </div>

                      <svg
                        viewBox="-120 -120 240 240"
                        className="w-48 h-48 bg-white rounded-full border border-slate-300 shadow-inner"
                      >
                        <circle
                          cx="0"
                          cy="0"
                          r="100"
                          fill="none"
                          stroke="#334155"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r="66.6"
                          fill="none"
                          stroke="#cbd5e1"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r="33.3"
                          fill="none"
                          stroke="#cbd5e1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1="-100"
                          y1="0"
                          x2="100"
                          y2="0"
                          stroke="#cbd5e1"
                        />
                        <line
                          x1="0"
                          y1="-100"
                          x2="0"
                          y2="100"
                          stroke="#cbd5e1"
                        />
                        <text
                          x="-4"
                          y="-105"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          N
                        </text>
                        <text
                          x="104"
                          y="4"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          E
                        </text>
                        <text
                          x="-4"
                          y="114"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          S
                        </text>
                        <text
                          x="-115"
                          y="4"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          W
                        </text>

                        {all3DJoints
                          .filter(
                            (j) => j.status !== 'Rejected Shadow / Disturbance'
                          )
                          .map((j) => {
                            const isSelected = selected3DJoint?.id === j.id;
                            const poleAzRad =
                              (((j.dipDirectionDeg + 180) % 360) * Math.PI) /
                              180;
                            const dipRad = (j.dipDeg * Math.PI) / 180;
                            const r = 100 * Math.SQRT2 * Math.sin(dipRad / 2);
                            const px = r * Math.sin(poleAzRad);
                            const py = -r * Math.cos(poleAzRad);
                            const coneRadiusPx = Math.max(
                              6,
                              Math.min(
                                22,
                                j.crossValidation.fisherAlpha95Deg * 2.8
                              )
                            );
                            return (
                              <g key={j.id}>
                                {/* Fisher 95% confidence cone around selected joint */}
                                {isSelected && (
                                  <>
                                    <circle
                                      cx={px}
                                      cy={py}
                                      r={coneRadiusPx}
                                      fill="rgba(79, 70, 229, 0.12)"
                                      stroke="#4f46e5"
                                      strokeWidth="1.2"
                                      strokeDasharray="2 2"
                                    />
                                    {/* Plot the 4 individual engine sub-poles for the selected joint */}
                                    {j.crossValidation.engineEstimates.map(
                                      (eng, eIdx) => {
                                        const eAzRad =
                                          (((eng.dipDirectionDeg + 180) % 360) *
                                            Math.PI) /
                                          180;
                                        const eDipRad =
                                          (eng.dipDeg * Math.PI) / 180;
                                        const er =
                                          100 *
                                          Math.SQRT2 *
                                          Math.sin(eDipRad / 2);
                                        const ex = er * Math.sin(eAzRad);
                                        const ey = -er * Math.cos(eAzRad);
                                        return (
                                          <circle
                                            key={`${j.id}-eng-${eIdx}`}
                                            cx={ex}
                                            cy={ey}
                                            r="2.4"
                                            fill="#1e293b"
                                            stroke="#ffffff"
                                            strokeWidth="0.6"
                                          />
                                        );
                                      }
                                    )}
                                  </>
                                )}
                                <circle
                                  cx={px}
                                  cy={py}
                                  r={isSelected ? '5.8' : '4.6'}
                                  fill={j.colorHex}
                                  stroke="#ffffff"
                                  strokeWidth="1.3"
                                />
                                <text
                                  x={px + 6}
                                  y={py + 3}
                                  fontSize="8"
                                  fontWeight="bold"
                                  fill="#0f172a"
                                >
                                  {j.code}
                                </text>
                              </g>
                            );
                          })}
                      </svg>
                      <div className="mt-1 text-[9.5px] font-mono text-slate-600 text-center">
                        Dashed Indigo Circle = 95% Fisher Confidence Cone (α95)
                        • Dark Dots = Individual E1–E4 Engine Poles
                      </div>
                    </div>

                    {/* 6-Pair Inter-Engine Mutual Cross-Validation Matrix & Structural Physics Gate Diagnostics */}
                    {selected3DJoint && (
                      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <span className="font-black text-slate-900">
                            4×4 Engine Cross-Validation ({selected3DJoint.code})
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-950 font-black text-[9.5px]">
                            {selected3DJoint.crossValidation.lockGrade}
                          </span>
                        </div>

                        {/* 6-Pair Angular Discrepancy Grid */}
                        <div className="grid grid-cols-3 gap-1 text-[9.5px]">
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">E1 SVD ↔ E2 RANSAC</div>
                            <div className="font-black text-indigo-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e1_e2_deg
                              }
                              °
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">E1 SVD ↔ E3 Dihed</div>
                            <div className="font-black text-indigo-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e1_e3_deg
                              }
                              °
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">E1 SVD ↔ E4 AI</div>
                            <div className="font-black text-indigo-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e1_e4_deg
                              }
                              °
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">
                              E2 RANSAC ↔ E3 Dihed
                            </div>
                            <div className="font-black text-sky-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e2_e3_deg
                              }
                              °
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">E2 RANSAC ↔ E4 AI</div>
                            <div className="font-black text-sky-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e2_e4_deg
                              }
                              °
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="text-slate-500">E3 Dihed ↔ E4 AI</div>
                            <div className="font-black text-emerald-900">
                              Δθ ={' '}
                              {
                                selected3DJoint.crossValidation.pairwiseDeltasDeg
                                  .e3_e4_deg
                              }
                              °
                            </div>
                          </div>
                        </div>

                        {/* Quantitative Physics & MATLAB SVD Metrics */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="p-1.5 rounded bg-indigo-50/70 border border-indigo-200">
                            <div className="text-slate-600">
                              Fisher κ &amp; 95% Cone
                            </div>
                            <div className="font-black text-indigo-950">
                              κ = {selected3DJoint.crossValidation.fisherKappa} (±
                              {selected3DJoint.crossValidation.fisherAlpha95Deg}°)
                            </div>
                          </div>
                          <div className="p-1.5 rounded bg-emerald-50/70 border border-emerald-200">
                            <div className="text-slate-600">
                              3D Dihedral Step &amp; w_T
                            </div>
                            <div className="font-black text-emerald-950">
                              Δθ_step ={' '}
                              {selected3DJoint.crossValidation.dihedralStepAngleDeg}° • w_T ={' '}
                              {selected3DJoint.crossValidation.terzaghiWeight}x
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-600 flex items-center justify-between">
                          <span>
                            MATLAB SVD λ:{' '}
                            <strong className="text-slate-900">
                              [{selected3DJoint.svdEigenvalues.join(', ')}]
                            </strong>
                          </span>
                          <span>
                            RMS Fit:{' '}
                            <strong className="text-slate-900">
                              {
                                selected3DJoint.crossValidation
                                  .rmsPointToPlaneErrorMm
                              }{' '}
                              mm
                            </strong>
                          </span>
                        </div>

                        <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[9.5px] text-slate-700 leading-relaxed">
                          {selected3DJoint.validationSummary}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible White-Light Bottom Control Dock (Zero Viewport Occlusion) */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(1140px,97vw)] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsBottomDockCollapsed((v) => !v)}
                className="px-3 py-1 rounded-t-lg bg-white border border-b-0 border-slate-300 text-[11px] font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                {isBottomDockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
                    <span>Show 3D Joint, Dip Surface &amp; Inspector Dock</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                    <span>Hide Controls</span>
                  </>
                )}
              </button>

              {!isBottomDockCollapsed && (
                <div className="w-full bg-white/95 border border-slate-300 rounded-xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2">
                  {/* 1. 3D Surface Technology Render Modes */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {(
                      [
                        {
                          id: 'rock_with_break_edges',
                          label: '3D Rock + Break Edges',
                        },
                        { id: 'textured_rock_mesh', label: '3D Rock Mesh' },
                        { id: 'dense_point_cloud', label: 'Dense Point Cloud' },
                        { id: 'normal_dip_map', label: '3D Dip/Normal Map' },
                        {
                          id: 'overbreak_heatmap',
                          label: 'Overbreak Heat-Map',
                        },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRenderSurfaceMode(m.id)}
                        className={`px-2 py-1 rounded-md text-[10.5px] font-bold cursor-pointer transition-all ${
                          renderSurfaceMode === m.id
                            ? 'bg-slate-900 text-white font-black shadow-xs'
                            : 'text-slate-700 hover:text-slate-950'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* 2. 4-Engine 3D Dip Surfaces, Persistence Traces & Inspector Toggles */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShow3DDipSurfaces((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        show3DDipSurfaces
                          ? 'bg-indigo-600 text-white border-indigo-700 font-black'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                      title="Toggle 3D Bounded Dip Surface Polygons & Down-Dip Arrows across Left Wall, Crown, Right Wall & Face"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>3D Dip Surfaces</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShow3DJointTraces((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        show3DJointTraces
                          ? 'bg-emerald-600 text-white border-emerald-700 font-black'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                      title="Toggle 3D Joint Persistence Trace Polylines on Walls, Crown & Face"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>3D Joint Persistence</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActive3DToolMode((m) =>
                          m === 'add_3d_joint' ? 'orbit' : 'add_3d_joint'
                        );
                        setPendingNewJointClicks([]);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        active3DToolMode === 'add_3d_joint'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-600 font-black'
                          : 'bg-emerald-50 border-emerald-400 text-emerald-900'
                      }`}
                      title="Click 2 points directly on the 3D Left Wall, Crown, Right Wall, or Face to add a new 3D Joint & Dip Surface"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add 3D Joint/Dip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDesignWireframe((v) => !v)}
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        showDesignWireframe
                          ? 'bg-sky-50 border-sky-500 text-sky-900'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                      title="Toggle Theoretical Custom Shape / Design Profile Reference Wireframe"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                      <span>Design Cage</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowKeyBlockWedges((v) => !v)}
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        showKeyBlockWedges
                          ? 'bg-rose-50 border-rose-500 text-rose-900'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                      title="Toggle 3D Unstable Key-Block Wedges on Crown & Shoulders"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Key-Blocks</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowChainageSlicer((v) => !v)}
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        showChainageSlicer
                          ? 'bg-amber-50 border-amber-500 text-amber-900'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                      title="Open Interactive 3D Chainage Slice & Cross-Section Cutter"
                    >
                      <Scissors className="w-3.5 h-3.5 text-amber-600" />
                      <span>3D Slicer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActive3DToolMode((m) =>
                          m === 'facet_probe' ? 'orbit' : 'facet_probe'
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        active3DToolMode === 'facet_probe'
                          ? 'bg-sky-600 text-white border-sky-700 font-black'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                      title="Click any 3D rock facet to probe local Dip, Dip Direction, Strike & JRC"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>3D Probe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActive3DToolMode((m) =>
                          m === 'ruler' ? 'orbit' : 'ruler'
                        );
                        setRulerPoints([]);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1 cursor-pointer ${
                        active3DToolMode === 'ruler'
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-black'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                      title="Measure 3D rock edge lengths and radial overbreak/underbreak depth"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      <span>3D Ruler</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
              </>
            )}
              </div>
            </div>

            {/* ==================== RIGHT PANE (STEP 4): DEDICATED 3D JOINT, DIP SURFACE & LIVE TWIN INSPECTOR WORKING WINDOW ==================== */}
            {activeStep === 'joint_dip_inspector_window' && (
              <div className="w-full lg:w-[52%] xl:w-[50%] h-[55dvh] lg:h-full bg-white flex flex-col overflow-hidden">
                {/* Dedicated Working Window Header & 3 Studio Sub-Tabs */}
                <div className="px-3.5 py-2.5 bg-slate-900 text-white border-b border-slate-800 flex flex-col gap-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5">
                          <span>
                            Dedicated 3D Joint, Dip Surface &amp; Live Twin
                            Inspector Studio
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-mono text-[9.5px] font-bold">
                            4-ENGINE SYNCED
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono">
                          {activeLocation.name} • CH{' '}
                          {activeRound.chainageFromM.toFixed(1)}–
                          {activeRound.chainageToM.toFixed(1)}m •{' '}
                          {
                            all3DJoints.filter(
                              (j) =>
                                j.status !== 'Rejected Shadow / Disturbance'
                            ).length
                          }{' '}
                          Validated 3D Joints &amp; Dip Surfaces
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isRunning4EnginePipeline}
                        onClick={handleRun4EngineConsensus}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Run 4-Engine Validation</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          export3DJointsAuditToCSV(
                            all3DJoints,
                            activeProject?.projectName || 'NATM Project',
                            activeLocation.name,
                            activeRound.chainageFromM,
                            activeRound.chainageToM
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>.CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          export3DJointsAndDipSurfacesToDXF(
                            all3DJoints,
                            activeLocation.name,
                            activeRound.chainageFromM,
                            activeRound.chainageToM
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>3D .DXF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpen3DTo2DUnfoldedWindow('2d_canvas')
                        }
                        className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer border border-violet-400 shadow-xs"
                      >
                        <Layers className="w-3 h-3" />
                        <span>
                          Next: 5. 3D → 2D Lithology, Strip Log &amp; 3D Flat
                          Tunnel →
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Studio Sub-Tab Selector + Zone Filter Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDedicatedStudioTab('edit_add_joints')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          dedicatedStudioTab === 'edit_add_joints'
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>1. Edit &amp; Add 3D Joints / Dip Surfaces</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDedicatedStudioTab('cross_validation_stereonet')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          dedicatedStudioTab === 'cross_validation_stereonet'
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>2. 4-Engine Mutual Validation &amp; Stereonet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDedicatedStudioTab('live_twin_inspector')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          dedicatedStudioTab === 'live_twin_inspector'
                            ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>3. Live 3D Twin Slicer, Wedges &amp; Probes</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'ALL', label: 'All Zones' },
                          { id: 'Left Wall', label: 'L-Wall' },
                          { id: 'Crown Arch', label: 'Crown' },
                          { id: 'Right Wall', label: 'R-Wall' },
                          { id: 'Advancing Face', label: 'Face' },
                        ] as const
                      ).map((zf) => (
                        <button
                          key={zf.id}
                          type="button"
                          onClick={() => setActiveJointZoneFilter(zf.id)}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border cursor-pointer ${
                            activeJointZoneFilter === zf.id
                              ? 'bg-indigo-500 text-white border-indigo-400'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {zf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ==================== STUDIO TAB 1: EDIT & ADD 3D JOINTS / DIP SURFACES ==================== */}
                {dedicatedStudioTab === 'edit_add_joints' && (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-slate-50">
                    {/* Dual-Method 3D Joint & Dip Surface Creator Card */}
                    <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <span>
                              Add New 3D Joint &amp; Dip Surface (3D Raycast or
                              Direct Dip/Dip-Dir Entry)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600">
                            Either click 2 points directly on the live 3D tunnel
                            on the left, or enter exact 3D Dip, Dip Direction,
                            Zone &amp; Persistence below.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActive3DToolMode((m) =>
                              m === 'add_3d_joint' ? 'orbit' : 'add_3d_joint'
                            );
                            setPendingNewJointClicks([]);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border flex items-center gap-1.5 cursor-pointer ${
                            active3DToolMode === 'add_3d_joint'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-400'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {active3DToolMode === 'add_3d_joint'
                              ? 'Click 2 Points on Live 3D Tunnel (Active)...'
                              : '+ Click 2 Points on Live 3D Tunnel'}
                          </span>
                        </button>
                      </div>

                      {/* Parametric 3D Joint & Dip Surface Creator Form */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end text-[10.5px]">
                        <label className="block col-span-1 sm:col-span-2">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            3D Tunnel Zone
                          </span>
                          <select
                            value={manualJointZone}
                            onChange={(e) =>
                              setManualJointZone(
                                e.target.value as Tunnel3DExcavationZone
                              )
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                          >
                            <option value="Left Wall">Left Wall (3D)</option>
                            <option value="Crown Arch">Crown Arch (3D)</option>
                            <option value="Right Wall">Right Wall (3D)</option>
                            <option value="Advancing Face">
                              Advancing Face (3D)
                            </option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            Joint Set
                          </span>
                          <select
                            value={manualJointSet}
                            onChange={(e) =>
                              setManualJointSet(
                                e.target.value as Joint3DSetId
                              )
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-1.5 py-1 font-bold text-slate-900"
                          >
                            <option value="J1">J1</option>
                            <option value="J2">J2</option>
                            <option value="J3">J3</option>
                            <option value="S0 (Bedding)">S0</option>
                            <option value="Fault/Shear">Fault</option>
                            <option value="Random">Random</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            Dip (0–90°)
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={89}
                            value={manualJointDipDeg}
                            onChange={(e) =>
                              setManualJointDipDeg(e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                          />
                        </label>

                        <label className="block">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            Dip Dir (0–360°)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={359}
                            value={manualJointDipDirDeg}
                            onChange={(e) =>
                              setManualJointDipDirDeg(e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                          />
                        </label>

                        <label className="block">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            Persist L (m)
                          </span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.3}
                            max={25}
                            value={manualJointPersistenceM}
                            onChange={(e) =>
                              setManualJointPersistenceM(e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                          />
                        </label>

                        <label className="block">
                          <span className="text-slate-600 font-bold block mb-0.5">
                            Aperture (mm)
                          </span>
                          <input
                            type="number"
                            step={0.1}
                            min={0.1}
                            max={50}
                            value={manualJointApertureMm}
                            onChange={(e) =>
                              setManualJointApertureMm(e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const created = createManual3DJointAndDipSurface({
                              zone: manualJointZone,
                              setId: manualJointSet,
                              dipDeg: Number(manualJointDipDeg) || 62,
                              dipDirectionDeg:
                                Number(manualJointDipDirDeg) || 130,
                              persistenceM:
                                Number(manualJointPersistenceM) || 3.2,
                              apertureMm:
                                Number(manualJointApertureMm) || 2.0,
                              jrcRoughness: Number(manualJointJrc) || 11.5,
                              location: activeLocation,
                              pullLengthM: activeRound.pullLengthM || 3.5,
                              driveAzimuthDeg:
                                activeRound.driveAzimuthDeg ||
                                activeLocation.defaultDriveAzimuthDeg ||
                                45,
                              existingCount: all3DJoints.length,
                            });
                            updateActiveRound3DJoints((list) => [
                              created,
                              ...list,
                            ]);
                            setSelected3DJointId(created.id);
                            focusCameraOn3DJoint(created);
                            setStatusToast(
                              `Added 3D Joint & Dip Surface ${created.code} on ${created.zone} (${created.dipDeg}°/${String(created.dipDirectionDeg).padStart(3, '0')}°, L=${created.persistenceM}m).`
                            );
                          }}
                          className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-[10.5px] cursor-pointer shadow-xs"
                        >
                          + Add to 3D Twin
                        </button>
                      </div>
                    </div>

                    {/* Selected 3D Joint & Dip Surface Precision Editor + 4-Engine Mutual Cross-Validation Card */}
                    {selected3DJoint && (
                      <div className="bg-white border-2 border-indigo-500 rounded-xl p-3 shadow-sm space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-900/20"
                              style={{
                                backgroundColor: selected3DJoint.colorHex,
                              }}
                            />
                            <span className="text-xs font-black text-slate-900 font-mono">
                              ACTIVE 3D JOINT &amp; DIP SURFACE:{' '}
                              {selected3DJoint.code} ({selected3DJoint.zone})
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 font-mono text-[10px] font-black">
                              {
                                selected3DJoint.crossValidation
                                  .enginesAgreedCount
                              }
                              /4 Engines • Mean Δθ ={' '}
                              {
                                selected3DJoint.crossValidation
                                  .meanPairwiseDeltaDeg
                              }
                              ° • κ ={' '}
                              {selected3DJoint.crossValidation.fisherKappa}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                focusCameraOn3DJoint(selected3DJoint)
                              }
                              className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-950 border border-sky-300 font-bold text-[10px] cursor-pointer"
                            >
                              Focus 3D Camera
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const driveAz =
                                  activeRound.driveAzimuthDeg ||
                                  activeLocation.defaultDriveAzimuthDeg ||
                                  45;
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? snapJointTo4EngineFisherConsensus(
                                          item,
                                          driveAz
                                        )
                                      : item
                                  )
                                );
                                setStatusToast(
                                  `Snapped ${selected3DJoint.code} to 4-Engine Fisher Consensus (${selected3DJoint.crossValidation.fisherConsensusDipDeg}°/${String(selected3DJoint.crossValidation.fisherConsensusDipDirDeg).padStart(3, '0')}°).`
                                );
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] cursor-pointer"
                            >
                              Snap to 4-Engine Fisher Consensus
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveRound3DJoints((list) =>
                                  list.filter(
                                    (item) => item.id !== selected3DJoint.id
                                  )
                                );
                                setSelected3DJointId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-[10px] cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Interactive Sliders + Numeric Inputs for Live 3D Dip Plane & Persistence Editing */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[10.5px]">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-700">
                              <span>True 3D Dip Angle (°)</span>
                              <span className="font-mono font-black text-indigo-900">
                                {selected3DJoint.dipDeg}° (Fisher:{' '}
                                {
                                  selected3DJoint.crossValidation
                                    .fisherConsensusDipDeg
                                }
                                °)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={1}
                                max={89}
                                value={selected3DJoint.dipDeg}
                                onChange={(e) => {
                                  const nextDip = Math.max(
                                    1,
                                    Math.min(89, Number(e.target.value) || 45)
                                  );
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              dipDeg: nextDip,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="flex-1 accent-indigo-600 cursor-pointer"
                              />
                              <input
                                type="number"
                                min={1}
                                max={89}
                                value={selected3DJoint.dipDeg}
                                onChange={(e) => {
                                  const nextDip = Math.max(
                                    1,
                                    Math.min(89, Number(e.target.value) || 45)
                                  );
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              dipDeg: nextDip,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-700">
                              <span>True 3D Dip Direction (°)</span>
                              <span className="font-mono font-black text-sky-900">
                                {String(
                                  selected3DJoint.dipDirectionDeg
                                ).padStart(3, '0')}
                                ° (Strike:{' '}
                                {String(selected3DJoint.strikeDeg).padStart(
                                  3,
                                  '0'
                                )}
                                °)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={359}
                                value={selected3DJoint.dipDirectionDeg}
                                onChange={(e) => {
                                  const nextDir =
                                    ((Number(e.target.value) || 0) % 360 +
                                      360) %
                                    360;
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              dipDirectionDeg: nextDir,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="flex-1 accent-sky-600 cursor-pointer"
                              />
                              <input
                                type="number"
                                min={0}
                                max={359}
                                value={selected3DJoint.dipDirectionDeg}
                                onChange={(e) => {
                                  const nextDir =
                                    ((Number(e.target.value) || 0) % 360 +
                                      360) %
                                    360;
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              dipDirectionDeg: nextDir,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-700">
                              <span>3D Joint Persistence L (m)</span>
                              <span className="font-mono font-black text-emerald-900">
                                {selected3DJoint.persistenceM} m (Area:{' '}
                                {selected3DJoint.dipSurfaceAreaM2} m²)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0.4}
                                max={12.0}
                                step={0.1}
                                value={selected3DJoint.persistenceM}
                                onChange={(e) => {
                                  const nextL = Math.max(
                                    0.3,
                                    Math.min(25, Number(e.target.value) || 1.5)
                                  );
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              persistenceM: nextL,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="flex-1 accent-emerald-600 cursor-pointer"
                              />
                              <input
                                type="number"
                                step={0.1}
                                min={0.3}
                                max={25}
                                value={selected3DJoint.persistenceM}
                                onChange={(e) => {
                                  const nextL = Math.max(
                                    0.3,
                                    Math.min(25, Number(e.target.value) || 1.5)
                                  );
                                  const driveAz =
                                    activeRound.driveAzimuthDeg ||
                                    activeLocation.defaultDriveAzimuthDeg ||
                                    45;
                                  updateActiveRound3DJoints((list) =>
                                    list.map((item) =>
                                      item.id === selected3DJoint.id
                                        ? recomputeEdited3DJointGeometry(
                                            item,
                                            {
                                              persistenceM: nextL,
                                              status: 'User Added / Edited',
                                            },
                                            driveAz
                                          )
                                        : item
                                    )
                                  );
                                }}
                                className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Secondary Attributes: Joint Set, Zone, Aperture, JRC & Validation Status */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10.5px]">
                          <label className="block">
                            <span className="text-slate-600 font-bold block mb-0.5">
                              Joint Set
                            </span>
                            <select
                              value={selected3DJoint.setId}
                              onChange={(e) => {
                                const nextSet = e.target.value as Joint3DSetId;
                                const driveAz =
                                  activeRound.driveAzimuthDeg ||
                                  activeLocation.defaultDriveAzimuthDeg ||
                                  45;
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? recomputeEdited3DJointGeometry(
                                          item,
                                          {
                                            setId: nextSet,
                                          },
                                          driveAz
                                        )
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                            >
                              <option value="J1">J1 (Primary)</option>
                              <option value="J2">J2 (Conjugate)</option>
                              <option value="J3">J3 (Cross)</option>
                              <option value="S0 (Bedding)">S0 (Bedding)</option>
                              <option value="Fault/Shear">Fault/Shear</option>
                              <option value="Random">Random</option>
                            </select>
                          </label>

                          <label className="block">
                            <span className="text-slate-600 font-bold block mb-0.5">
                              3D Zone
                            </span>
                            <select
                              value={selected3DJoint.zone}
                              onChange={(e) => {
                                const nextZone = e.target
                                  .value as Tunnel3DExcavationZone;
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? { ...item, zone: nextZone }
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                            >
                              <option value="Left Wall">Left Wall</option>
                              <option value="Crown Arch">Crown Arch</option>
                              <option value="Right Wall">Right Wall</option>
                              <option value="Advancing Face">
                                Advancing Face
                              </option>
                            </select>
                          </label>

                          <label className="block">
                            <span className="text-slate-600 font-bold block mb-0.5">
                              Aperture (mm)
                            </span>
                            <input
                              type="number"
                              step={0.1}
                              value={selected3DJoint.apertureMm}
                              onChange={(e) => {
                                const val = Math.max(
                                  0.1,
                                  Number(e.target.value) || 1.0
                                );
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? { ...item, apertureMm: val }
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                            />
                          </label>

                          <label className="block">
                            <span className="text-slate-600 font-bold block mb-0.5">
                              JRC Roughness (0–20)
                            </span>
                            <input
                              type="number"
                              step={0.5}
                              min={0}
                              max={20}
                              value={selected3DJoint.jrcRoughness}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(20, Number(e.target.value) || 10)
                                );
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? { ...item, jrcRoughness: val }
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900"
                            />
                          </label>

                          <label className="block">
                            <span className="text-slate-600 font-bold block mb-0.5">
                              Validation Status
                            </span>
                            <select
                              value={selected3DJoint.status}
                              onChange={(e) => {
                                const nextSt = e.target
                                  .value as Joint3DValidationStatus;
                                updateActiveRound3DJoints((list) =>
                                  list.map((item) =>
                                    item.id === selected3DJoint.id
                                      ? { ...item, status: nextSt }
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                            >
                              <option value="Validated 3D Joint">
                                Validated 3D Joint
                              </option>
                              <option value="User Added / Edited">
                                User Added / Edited
                              </option>
                              <option value="Rejected Shadow / Disturbance">
                                Rejected Shadow
                              </option>
                            </select>
                          </label>
                        </div>

                        {/* 4-Engine Independent Estimates Comparison Bar inside Editor */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[9.5px] font-mono">
                          {selected3DJoint.crossValidation.engineEstimates.map(
                            (est) => (
                              <div
                                key={est.engineId}
                                className="p-1.5 rounded bg-indigo-50/60 border border-indigo-200 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-black text-indigo-950">
                                    {est.engineId}: {est.dipDeg}°/
                                    {String(est.dipDirectionDeg).padStart(
                                      3,
                                      '0'
                                    )}
                                    °
                                  </div>
                                  <div className="text-slate-600">
                                    L={est.persistenceM}m • {est.confidencePct}%
                                  </div>
                                </div>
                                <span
                                  className={`px-1 py-0.5 rounded font-black ${
                                    est.passedGate
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {est.passedGate ? 'LOCK' : 'REJ'}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Complete Interactive 3D Joint & Dip Surface Inventory Table */}
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                      <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900">
                          All 3D Joints &amp; Dip Surfaces in Active Round (
                          {filtered3DJoints.length} Shown)
                        </span>
                        <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showRejectedDisturbances}
                            onChange={(e) =>
                              setShowRejectedDisturbances(e.target.checked)
                            }
                            className="accent-indigo-600"
                          />
                          <span>
                            Include Rejected Shadows (
                            {
                              all3DJoints.filter(
                                (j) =>
                                  j.status === 'Rejected Shadow / Disturbance'
                              ).length
                            }
                            )
                          </span>
                        </label>
                      </div>

                      <div className="overflow-x-auto max-h-88">
                        <table className="w-full text-left border-collapse text-[10.5px] font-mono">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[9.5px] uppercase sticky top-0">
                              <th className="p-2">Code</th>
                              <th className="p-2">3D Zone</th>
                              <th className="p-2">Set</th>
                              <th className="p-2">Dip / Dip Dir</th>
                              <th className="p-2">Strike</th>
                              <th className="p-2">Persist L</th>
                              <th className="p-2">4-Eng Lock</th>
                              <th className="p-2">Mean Δθ°</th>
                              <th className="p-2">Fisher κ</th>
                              <th className="p-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered3DJoints.map((j) => {
                              const isSel = selected3DJoint?.id === j.id;
                              const isRej =
                                j.status === 'Rejected Shadow / Disturbance';
                              const cv = j.crossValidation;
                              return (
                                <tr
                                  key={j.id}
                                  onClick={() => {
                                    setSelected3DJointId(j.id);
                                    focusCameraOn3DJoint(j);
                                  }}
                                  className={`border-b border-slate-200 cursor-pointer transition-colors ${
                                    isSel
                                      ? 'bg-amber-50/90 font-bold'
                                      : isRej
                                      ? 'bg-slate-100/80 text-slate-500'
                                      : 'hover:bg-sky-50/60'
                                  }`}
                                >
                                  <td className="p-2 font-black text-slate-900">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: j.colorHex }}
                                      />
                                      <span>{j.code}</span>
                                    </div>
                                  </td>
                                  <td className="p-2">{j.zone}</td>
                                  <td className="p-2 font-bold">{j.setId}</td>
                                  <td className="p-2 font-black text-indigo-950">
                                    {j.dipDeg}° /{' '}
                                    {String(j.dipDirectionDeg).padStart(3, '0')}
                                    °
                                  </td>
                                  <td className="p-2">
                                    {String(j.strikeDeg).padStart(3, '0')}°
                                  </td>
                                  <td className="p-2 font-black text-emerald-900">
                                    {j.persistenceM} m
                                  </td>
                                  <td className="p-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                                        isRej
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-emerald-100 text-emerald-900'
                                      }`}
                                    >
                                      {cv.enginesAgreedCount}/4 (
                                      {j.overallConfidencePct}%)
                                    </span>
                                  </td>
                                  <td className="p-2 font-bold">
                                    Δ{cv.meanPairwiseDeltaDeg}°
                                  </td>
                                  <td className="p-2">
                                    κ={cv.fisherKappa} (±{cv.fisherAlpha95Deg}°)
                                  </td>
                                  <td
                                    className="p-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => focusCameraOn3DJoint(j)}
                                        className="px-1.5 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-[9.5px] cursor-pointer"
                                      >
                                        Focus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const driveAz =
                                            activeRound.driveAzimuthDeg ||
                                            activeLocation.defaultDriveAzimuthDeg ||
                                            45;
                                          updateActiveRound3DJoints((list) =>
                                            list.map((item) =>
                                              item.id === j.id
                                                ? snapJointTo4EngineFisherConsensus(
                                                    item,
                                                    driveAz
                                                  )
                                                : item
                                            )
                                          );
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9.5px] cursor-pointer"
                                      >
                                        Snap
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== STUDIO TAB 2: 4-ENGINE MUTUAL CROSS-VALIDATION & STEREONET ==================== */}
                {dedicatedStudioTab === 'cross_validation_stereonet' && (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-slate-50">
                    {/* Top Row: Stereonet Pole Plot + Selected Joint 6-Pair Mutual Angular Discrepancy Matrix */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {/* Lower-Hemisphere Equal-Area Schmidt Stereonet with 4-Engine Sub-Poles & Fisher α95 Cone */}
                      <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-900">
                            3D Lower-Hemisphere Stereonet &amp; Fisher α95 Cone
                          </span>
                          <span className="text-[10px] font-mono text-indigo-800 font-bold">
                            Click Any Pole to Focus 3D Joint
                          </span>
                        </div>

                        <svg
                          viewBox="-125 -125 250 250"
                          className="w-56 h-56 bg-slate-50 rounded-full border border-slate-300"
                        >
                          <circle
                            cx={0}
                            cy={0}
                            r={100}
                            fill="#ffffff"
                            stroke="#334155"
                            strokeWidth={1.5}
                          />
                          <circle
                            cx={0}
                            cy={0}
                            r={66.6}
                            fill="none"
                            stroke="#cbd5e1"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={0}
                            cy={0}
                            r={33.3}
                            fill="none"
                            stroke="#cbd5e1"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1={-105}
                            y1={0}
                            x2={105}
                            y2={0}
                            stroke="#cbd5e1"
                          />
                          <line
                            x1={0}
                            y1={-105}
                            x2={0}
                            y2={105}
                            stroke="#cbd5e1"
                          />
                          <text
                            x={0}
                            y={-109}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight="bold"
                            fill="#0f172a"
                          >
                            N (000°)
                          </text>
                          <text
                            x={114}
                            y={3}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight="bold"
                            fill="#475569"
                          >
                            E
                          </text>
                          <text
                            x={0}
                            y={117}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight="bold"
                            fill="#475569"
                          >
                            S
                          </text>
                          <text
                            x={-114}
                            y={3}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight="bold"
                            fill="#475569"
                          >
                            W
                          </text>

                          {/* Plot 95% Fisher Confidence Cone & E1–E4 Sub-Poles for Selected Joint */}
                          {selected3DJoint &&
                            (() => {
                              const poleTrendRad =
                                (((selected3DJoint.dipDirectionDeg + 180) %
                                  360) *
                                  Math.PI) /
                                180;
                              const r =
                                Math.SQRT2 *
                                Math.sin(
                                  (selected3DJoint.dipDeg * Math.PI) / 360
                                ) *
                                100;
                              const cx = r * Math.sin(poleTrendRad);
                              const cy = -r * Math.cos(poleTrendRad);
                              const coneRadius = Math.max(
                                4,
                                (selected3DJoint.crossValidation
                                  .fisherAlpha95Deg /
                                  90) *
                                  100
                              );
                              return (
                                <g>
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={coneRadius}
                                    fill="rgba(79, 70, 229, 0.14)"
                                    stroke="#4f46e5"
                                    strokeWidth={1.1}
                                    strokeDasharray="2 2"
                                  />
                                  {selected3DJoint.crossValidation.engineEstimates.map(
                                    (est) => {
                                      const eTrendRad =
                                        (((est.dipDirectionDeg + 180) % 360) *
                                          Math.PI) /
                                        180;
                                      const er =
                                        Math.SQRT2 *
                                        Math.sin(
                                          (est.dipDeg * Math.PI) / 360
                                        ) *
                                        100;
                                      const ex = er * Math.sin(eTrendRad);
                                      const ey = -er * Math.cos(eTrendRad);
                                      return (
                                        <circle
                                          key={est.engineId}
                                          cx={ex}
                                          cy={ey}
                                          r={2.4}
                                          fill="#4f46e5"
                                          opacity={0.75}
                                        />
                                      );
                                    }
                                  )}
                                </g>
                              );
                            })()}

                          {/* Plot Validated 3D Joint Poles */}
                          {all3DJoints
                            .filter(
                              (j) =>
                                j.status !== 'Rejected Shadow / Disturbance'
                            )
                            .map((j) => {
                              const poleTrendRad =
                                (((j.dipDirectionDeg + 180) % 360) * Math.PI) /
                                180;
                              const r =
                                Math.SQRT2 *
                                Math.sin((j.dipDeg * Math.PI) / 360) *
                                100;
                              const px = r * Math.sin(poleTrendRad);
                              const py = -r * Math.cos(poleTrendRad);
                              const isSel = selected3DJoint?.id === j.id;
                              return (
                                <g
                                  key={j.id}
                                  onClick={() => focusCameraOn3DJoint(j)}
                                  className="cursor-pointer"
                                >
                                  <circle
                                    cx={px}
                                    cy={py}
                                    r={isSel ? 6.5 : 4.5}
                                    fill={j.colorHex}
                                    stroke={isSel ? '#0f172a' : '#ffffff'}
                                    strokeWidth={isSel ? 2 : 1}
                                  />
                                  <text
                                    x={px + 6}
                                    y={py + 3}
                                    fontSize={7.5}
                                    fontWeight="bold"
                                    fill="#0f172a"
                                  >
                                    {j.code}
                                  </text>
                                </g>
                              );
                            })}
                        </svg>
                      </div>

                      {/* Selected Joint 4-Engine Pairwise Angular Discrepancy Matrix & Physics Proof */}
                      {selected3DJoint && (
                        <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs space-y-2 text-[10px] font-mono">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-xs font-black text-slate-900">
                              {selected3DJoint.code} ({selected3DJoint.zone}) —
                              6-Pair Δθ° Matrix
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 font-black">
                              Mean Δθ ={' '}
                              {
                                selected3DJoint.crossValidation
                                  .meanPairwiseDeltaDeg
                              }
                              ° (Max{' '}
                              {
                                selected3DJoint.crossValidation
                                  .maxPairwiseDeltaDeg
                              }
                              °)
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E1 ↔ E2</div>
                              <div className="font-black text-slate-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e1_e2_deg
                                }
                                °
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E1 ↔ E3</div>
                              <div className="font-black text-slate-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e1_e3_deg
                                }
                                °
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E1 ↔ E4</div>
                              <div className="font-black text-indigo-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e1_e4_deg
                                }
                                °
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E2 ↔ E3</div>
                              <div className="font-black text-slate-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e2_e3_deg
                                }
                                °
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E2 ↔ E4</div>
                              <div className="font-black text-indigo-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e2_e4_deg
                                }
                                °
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-slate-50 border border-slate-200">
                              <div className="text-slate-500">E3 ↔ E4</div>
                              <div className="font-black text-emerald-900">
                                Δθ ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .pairwiseDeltasDeg.e3_e4_deg
                                }
                                °
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="p-1.5 rounded bg-indigo-50 border border-indigo-200">
                              <div className="text-slate-600">
                                Fisher κ &amp; 95% Cone
                              </div>
                              <div className="font-black text-indigo-950">
                                κ ={' '}
                                {selected3DJoint.crossValidation.fisherKappa} (±
                                {
                                  selected3DJoint.crossValidation
                                    .fisherAlpha95Deg
                                }
                                °)
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200">
                              <div className="text-slate-600">
                                Dihedral Step &amp; RMS Fit
                              </div>
                              <div className="font-black text-emerald-950">
                                Δθ_step ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .dihedralStepAngleDeg
                                }
                                ° • RMS ={' '}
                                {
                                  selected3DJoint.crossValidation
                                    .rmsPointToPlaneErrorMm
                                }{' '}
                                mm
                              </div>
                            </div>
                          </div>

                          <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[9.5px] text-slate-700 leading-relaxed">
                            {selected3DJoint.validationSummary}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Full 4-Engine Mutual Cross-Validation Table */}
                    <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                      <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900">
                          4-Engine Mutual Cross-Validation Matrix (E1 MATLAB SVD
                          • E2 Huber RANSAC • E3 3D Dihedral • E4 Gemini+Fisher)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const driveAz =
                              activeRound.driveAzimuthDeg ||
                              activeLocation.defaultDriveAzimuthDeg ||
                              45;
                            updateActiveRound3DJoints((list) =>
                              list.map((item) =>
                                item.status === 'Rejected Shadow / Disturbance'
                                  ? item
                                  : snapJointTo4EngineFisherConsensus(
                                      item,
                                      driveAz
                                    )
                              )
                            );
                            setStatusToast(
                              'Snapped all validated 3D Joints to Weighted 4-Engine Fisher Spherical Consensus.'
                            );
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10.5px] cursor-pointer"
                        >
                          Snap All to 4-Engine Fisher Consensus
                        </button>
                      </div>

                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left border-collapse text-[10px] font-mono">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[9px] uppercase sticky top-0">
                              <th className="p-2">Code</th>
                              <th className="p-2">Zone</th>
                              <th className="p-2">Final 3D</th>
                              <th className="p-2">E1 MATLAB SVD</th>
                              <th className="p-2">E2 Huber RANSAC</th>
                              <th className="p-2">E3 3D Dihedral</th>
                              <th className="p-2">E4 Gemini+Fisher</th>
                              <th className="p-2">Mean Δθ°</th>
                              <th className="p-2">Fisher κ</th>
                              <th className="p-2">RMS (mm)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered3DJoints.map((j) => {
                              const isSel = selected3DJoint?.id === j.id;
                              const isRej =
                                j.status === 'Rejected Shadow / Disturbance';
                              const cv = j.crossValidation;
                              const e1 = cv.engineEstimates[0];
                              const e2 = cv.engineEstimates[1];
                              const e3 = cv.engineEstimates[2];
                              const e4 = cv.engineEstimates[3];
                              return (
                                <tr
                                  key={j.id}
                                  onClick={() => focusCameraOn3DJoint(j)}
                                  className={`border-b border-slate-200 cursor-pointer ${
                                    isSel
                                      ? 'bg-amber-50 font-bold'
                                      : isRej
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'hover:bg-sky-50/60'
                                  }`}
                                >
                                  <td className="p-2 font-black text-slate-900">
                                    {j.code}
                                  </td>
                                  <td className="p-2">{j.zone}</td>
                                  <td className="p-2 font-black text-indigo-950">
                                    {j.dipDeg}°/
                                    {String(j.dipDirectionDeg).padStart(3, '0')}
                                    ° ({j.persistenceM}m)
                                  </td>
                                  <td className="p-2">
                                    {e1.dipDeg}°/
                                    {String(e1.dipDirectionDeg).padStart(
                                      3,
                                      '0'
                                    )}
                                    ° ({e1.confidencePct}%)
                                  </td>
                                  <td className="p-2">
                                    {e2.dipDeg}°/
                                    {String(e2.dipDirectionDeg).padStart(
                                      3,
                                      '0'
                                    )}
                                    ° ({e2.confidencePct}%)
                                  </td>
                                  <td className="p-2">
                                    {e3.dipDeg}°/
                                    {String(e3.dipDirectionDeg).padStart(
                                      3,
                                      '0'
                                    )}
                                    ° (Δ{cv.dihedralStepAngleDeg}°)
                                  </td>
                                  <td className="p-2">
                                    {e4.dipDeg}°/
                                    {String(e4.dipDirectionDeg).padStart(
                                      3,
                                      '0'
                                    )}
                                    ° ({e4.confidencePct}%)
                                  </td>
                                  <td className="p-2 font-black text-emerald-900">
                                    {cv.meanPairwiseDeltaDeg}°
                                  </td>
                                  <td className="p-2">
                                    {cv.fisherKappa} (±{cv.fisherAlpha95Deg}°)
                                  </td>
                                  <td className="p-2">
                                    {cv.rmsPointToPlaneErrorMm} mm
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ==================== STUDIO TAB 3: LIVE 3D TWIN SLICER, WEDGES & PROBES ==================== */}
                {dedicatedStudioTab === 'live_twin_inspector' && (
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-slate-50">
                    {/* 1. Interactive 3D Chainage Cross-Section Slicer Card */}
                    {activeSliceData && (
                      <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div>
                            <div className="text-xs font-black text-slate-900 font-mono flex items-center gap-1.5">
                              <Scissors className="w-4 h-4 text-amber-600" />
                              <span>
                                Interactive 3D Chainage Cross-Section Slicer —
                                CH {activeSliceData.chainageM.toFixed(2)} m
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600">
                              Compares real 3D reconstructed rock contour (solid
                              orange) against theoretical design reference cage
                              (dashed blue).
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setShowChainageSlicer((prev) => !prev)
                              }
                              className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                showChainageSlicer
                                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-black'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {showChainageSlicer
                                ? '3D Slice Plane Visible ✓'
                                : 'Show 3D Slice Plane'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                exportSliceCrossSectionToDXF(
                                  activeSliceData,
                                  activeLocation.name
                                )
                              }
                              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-[10px] cursor-pointer"
                            >
                              Export Slice .DXF
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-7">
                            <svg
                              viewBox="-6 -1 12 10"
                              className="w-full h-44 bg-slate-50 rounded-lg border border-slate-300"
                            >
                              <polyline
                                fill="none"
                                stroke="#0284c7"
                                strokeWidth="0.09"
                                strokeDasharray="0.22 0.14"
                                points={activeSliceData.designPoints2D
                                  .map(
                                    (p) =>
                                      `${p.x.toFixed(2)},${(8.5 - p.y).toFixed(2)}`
                                  )
                                  .join(' ')}
                              />
                              <polyline
                                fill="rgba(234, 88, 12, 0.12)"
                                stroke="#ea580c"
                                strokeWidth="0.11"
                                points={activeSliceData.realRockPoints2D
                                  .map(
                                    (p) =>
                                      `${p.x.toFixed(2)},${(8.5 - p.y).toFixed(2)}`
                                  )
                                  .join(' ')}
                              />
                            </svg>
                          </div>

                          <div className="md:col-span-5 space-y-2 text-xs font-mono">
                            <label className="block">
                              <span className="text-[10.5px] font-bold text-slate-700 block mb-1">
                                Slide Along Tunnel Chainage (
                                {activeSliceData.chainageM.toFixed(2)} m):
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={
                                  reconstructedModel.sliceSections.length - 1
                                }
                                value={activeSliceIndex}
                                onChange={(e) => {
                                  setShowChainageSlicer(true);
                                  setActiveSliceIndex(Number(e.target.value));
                                }}
                                className="w-full accent-amber-600 cursor-pointer"
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 rounded bg-rose-50 border border-rose-200">
                                <div className="text-[9.5px] text-rose-700">
                                  Overbreak Area
                                </div>
                                <div className="text-sm font-black text-rose-900">
                                  {activeSliceData.overbreakAreaM2} m²
                                </div>
                              </div>
                              <div className="p-2 rounded bg-sky-50 border border-sky-200">
                                <div className="text-[9.5px] text-sky-700">
                                  Underbreak Area
                                </div>
                                <div className="text-sm font-black text-sky-900">
                                  {activeSliceData.underbreakAreaM2} m²
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. 3D Key-Block Wedge Kinematic Stability Inspector */}
                    <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>
                            3D Intersecting Joint Key-Block Wedge Inspector (J1
                            × J2 × J3)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowKeyBlockWedges((v) => !v)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                            showKeyBlockWedges
                              ? 'bg-rose-600 text-white border-rose-700'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {showKeyBlockWedges
                            ? '3D Wedges Visible ✓'
                            : 'Show 3D Wedges'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px] font-mono">
                        {reconstructedModel.detected3DWedges.map((w) => (
                          <div
                            key={w.id}
                            className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1"
                          >
                            <div className="flex items-center justify-between font-black text-slate-900">
                              <span>{w.label}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                                  w.factorOfSafety < 1.3
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-200 text-amber-950'
                                }`}
                              >
                                FoS = {w.factorOfSafety.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-slate-700">
                              Volume: <strong>{w.volumeM3} m³</strong> • Mass:{' '}
                              <strong>{w.weightTonnes} t</strong>
                            </div>
                            <div className="text-[9.5px] text-emerald-900 font-bold">
                              Slide: {w.slidingAzimuthDeg}° / Plunge{' '}
                              {w.slidingPlungeDeg}°
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Live 3D Rock Facet Probes & 3D Ruler Log */}
                    <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Crosshair className="w-4 h-4 text-sky-600" />
                          <span>
                            Live 3D Rock Facet Probes ({probedFacets.length}) &amp;
                            3D Edge Ruler
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setActive3DToolMode((m) =>
                                m === 'facet_probe' ? 'orbit' : 'facet_probe'
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              active3DToolMode === 'facet_probe'
                                ? 'bg-sky-600 text-white border-sky-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {active3DToolMode === 'facet_probe'
                              ? '3D Probe Active'
                              : 'Activate 3D Probe'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActive3DToolMode((m) =>
                                m === 'ruler' ? 'orbit' : 'ruler'
                              );
                              setRulerPoints([]);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              active3DToolMode === 'ruler'
                                ? 'bg-amber-500 text-slate-950 border-amber-600'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {active3DToolMode === 'ruler'
                              ? '3D Ruler Active'
                              : 'Activate 3D Ruler'}
                          </button>
                        </div>
                      </div>

                      {probedFacets.length === 0 ? (
                        <div className="text-[11px] text-slate-600 py-2">
                          Click <strong>Activate 3D Probe</strong> and click any
                          rock fracture facet on the left 3D tunnel to log local
                          3D Dip, Dip Direction, Strike, and JRC roughness.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] font-mono">
                          {probedFacets.map((pf) => (
                            <div
                              key={pf.id}
                              className="p-2 rounded bg-sky-50 border border-sky-200 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-black text-sky-950">
                                  {pf.setId} ({pf.classification})
                                </div>
                                <div className="text-slate-700">
                                  Dip {pf.dipDeg}° / DipDir{' '}
                                  {String(pf.dipDirectionDeg).padStart(3, '0')}°
                                  (Strike{' '}
                                  {String(pf.strikeDeg).padStart(3, '0')}°)
                                </div>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-white border border-sky-300 font-bold text-emerald-900">
                                JRC {pf.jrcRoughness}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* ==================== STEP 5: 3D → 2D UNFOLDED CANVAS, LITHOLOGY, STRIP LOG & 3D FLAT TUNNEL ==================== */}
      {activeStep === 'unfold_3d_to_2d' &&
        activeProject &&
        activeLocation &&
        activeRound && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white relative z-20">
            <FieldMappingModeWorkspace
              onBackToWelcome={() =>
                setActiveStep('joint_dip_inspector_window')
              }
              resumeAtLastStage
              embeddedInDigitalTwin3DTo2D={{
                syncVersion: unfold2DSyncVersion,
                targetViewMode: unfold2DTargetViewMode,
                onBackTo3DTwin: () =>
                  setActiveStep('joint_dip_inspector_window'),
                onResyncFrom3DTwin: () =>
                  handleOpen3DTo2DUnfoldedWindow(unfold2DTargetViewMode),
              }}
            />
          </div>
        )}

      {/* ==================== CUSTOM TUNNEL SHAPE BUILDER MODAL (MANUAL + SIMPLE CAD) ==================== */}
      {customBuilderMode !== 'closed' && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
          <FreeformCustomProfileEditor
            geometry={
              (customBuilderMode === 'new_location' && newLocCustomGeom) ||
              (customBuilderMode === 'active_location' &&
                activeLocation?.customProfile &&
                buildAuthoritativeCustomTunnelGeometry(
                  activeLocation.customProfile
                )) ||
              createTunnelGeometry(
                customBuilderMode === 'new_location'
                  ? Number(newLocWidth) || 8.5
                  : activeLocation?.widthM || 8.5,
                customBuilderMode === 'new_location'
                  ? Number(newLocHeight) || 7.5
                  : activeLocation?.heightM || 7.5,
                customBuilderMode === 'new_location'
                  ? Number(newLocWallHeight) || 4.0
                  : activeLocation?.wallHeightM || 4.0,
                'horseshoe',
                4.25
              )
            }
            settings={{
              projectName: activeProject?.projectName || '3D Digital Twin Project',
              tunnelName:
                customBuilderMode === 'new_location'
                  ? newLocName || 'New Tunnel'
                  : activeLocation?.name || 'Main Tunnel',
              driveDirectionInput: String(
                activeLocation?.defaultDriveAzimuthDeg || 45
              ),
              driveDirection: activeLocation?.defaultDriveAzimuthDeg || 45,
              chainage: `${activeRound?.chainageFromM || 100} - ${
                activeRound?.chainageToM || 103.5
              }`,
              faceChainage: String(activeRound?.chainageToM || 103.5),
              roundLength: activeRound?.pullLengthM || 3.5,
              date: new Date().toISOString().slice(0, 10),
              mappedBy: 'Engineering Geologist',
              lithology: 'Rock Mass',
            }}
            savedGeometries={[]}
            chainageSchedule={[]}
            initialTab="sketch_solver"
            onApplyGeometry={(nextGeometry: TunnelGeometry) => {
              const spanW = Number((nextGeometry.width || 8.5).toFixed(2));
              const totalH = Number((nextGeometry.height || 7.5).toFixed(2));
              const wallH = Number((nextGeometry.wallHeight || 4.0).toFixed(2));
              const crownR = Number(
                (nextGeometry.crownRadius || spanW / 2).toFixed(2)
              );

              if (customBuilderMode === 'new_location') {
                setNewLocCustomGeom(nextGeometry);
                setNewLocShape('custom_profile');
                setNewLocWidth(String(spanW));
                setNewLocHeight(String(totalH));
                setNewLocWallHeight(String(wallH));
                setNewLocCrownRadius(String(crownR));
              } else if (
                customBuilderMode === 'active_location' &&
                activeProject &&
                activeLocation
              ) {
                setStore((prev) => ({
                  ...prev,
                  projects: prev.projects.map((p) =>
                    p.id === activeProject.id
                      ? {
                          ...p,
                          locations: p.locations.map((l) =>
                            l.id === activeLocation.id
                              ? {
                                  ...l,
                                  shape: 'custom_profile',
                                  widthM: spanW,
                                  heightM: totalH,
                                  wallHeightM: wallH,
                                  crownRadiusM: crownR,
                                  customProfile: nextGeometry.customProfile,
                                }
                              : l
                          ),
                        }
                      : p
                  ),
                }));
              }
              setCustomBuilderMode('closed');
              setStatusToast(
                `Applied Custom Reference Profile (${spanW}m × ${totalH}m) to 3D Digital Twin Tunnel.`
              );
            }}
            onSaveToGeometryLibrary={() => {}}
            onDeleteSavedGeometry={() => {}}
            onUpdateChainageSchedule={() => {}}
            onBack={() => setCustomBuilderMode('closed')}
          />
        </div>
      )}
    </div>
  );
};
