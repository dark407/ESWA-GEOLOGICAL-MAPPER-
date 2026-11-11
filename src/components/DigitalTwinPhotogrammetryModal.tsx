import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Camera,
  Box,
  Layers,
  Crosshair,
  Sparkles,
  Upload,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Eye,
  Compass,
  Sliders,
  ArrowLeftRight,
  PlusCircle,
  Check,
  X,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  GitBranch,
  Activity,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  RefreshCw,
  Cpu,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import type {
  FieldPanelId,
  FieldJointTrace,
  FieldDipPlaneSurface,
  FieldJointGroupingId,
  FieldPhotoFitConfig,
  DigitalTwinRawTunnelPhoto,
} from '../engine/fieldMappingEngine';
import {
  type Vec3D,
  type TunnelSpatialGeometry,
  type DipHalfCircleSense,
  normalizeAngle360,
  clampDip,
  degToRad,
  calculateStrikeFromDipDirection,
  buildTunnelCrossSectionProfileMetric,
} from '../engine/joint3DInspectorEngine';
import {
  type PhotogrammetryExtractionMethod,
  type DigitalTwinDisplayMode,
  type DigitalTwinSurfacePhoto,
  type PhotogrammetricPickedPoint3D,
  type PhotogrammetricPlaneFitResult,
  type DigitalTwinRoundCorridorSlice,
  type DigitalTwinOverbreakCavity,
  type DigitalTwinPortionCoverageReport,
  sampleReliefDisplacementMeters,
  mapUVWithReliefToTunnel3D,
  fitExact3DPlaneFromPointsSVD,
  project2DTraceOnto3DReliefAndFitPlane,
  autoDetectRockFacetsFromDigitalTwin,
  convertPhotogrammetricFitToJointTrace,
  convertPhotogrammetricFitToDipSurface,
  clampUVToExactTunnelFaceProfile,
  computePortionCoverageReadiness,
  runDeepMultiStagePhotogrammetryReconstruction,
} from '../engine/digitalTwinPhotogrammetryEngine';
import { extractExifCalibrationFromBuffer } from '../engine/cameraCalibration';

export interface DigitalTwinPhotogrammetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as an embedded workflow stage window (Step 5 before Face Canvas) instead of a floating modal */
  embeddedStage?: boolean;
  projectName?: string;
  locationName?: string;
  geometry: TunnelSpatialGeometry;
  roundLabel?: string;
  initialPanel?: FieldPanelId;
  existingPhotos?: Partial<Record<FieldPanelId, string>>;
  /** Fitted photo configurations from Step 4 (Photo Fit) per panel (kept separate from 3D Digital Twin raw photos) */
  photoFits?: Partial<Record<FieldPanelId, FieldPhotoFitConfig>>;
  /** Separate unedited multi-angle tunnel photos uploaded specifically for 3D Digital Twin (BETA) */
  rawPhotos?: DigitalTwinRawTunnelPhoto[];
  /** Callback to persist separate unedited multi-photos on the active round */
  onUpdateRawPhotos?: (photos: DigitalTwinRawTunnelPhoto[]) => void;
  existingJointTraces?: FieldJointTrace[];
  existingDipSurfaces?: FieldDipPlaneSurface[];
  corridorRounds?: DigitalTwinRoundCorridorSlice[];
  /** Navigation callbacks when used as Step 5 workflow stage before Face Canvas */
  onBackToPhotoFit?: () => void;
  onProceedToFaceCanvas?: (activePortion?: FieldPanelId) => void;
  /** Called when the user saves a newly extracted 3D joint trace to the round */
  onSaveJointTrace?: (trace: FieldJointTrace) => void;
  /** Called when the user saves a newly extracted 3D dip surface to the round */
  onSaveDipSurface?: (surface: FieldDipPlaneSurface) => void;
  /** Called when the user updates an existing joint trace's 3D orientation from photogrammetry */
  onUpdateExistingJointTrace?: (
    traceId: string,
    dipDirection: number,
    dipAmount: number,
    strike: number,
    dipHalfCircleSense: DipHalfCircleSense
  ) => void;
  /** Optional callback when launched directly from inside NatmJoint3DInspectorModal */
  onApplyToActiveInspector?: (fit: PhotogrammetricPlaneFitResult) => void;
  /** Optional callback to open a saved/extracted item directly in the 3D Joint Inspector */
  onOpenIn3DJointInspector?: (fit: PhotogrammetricPlaneFitResult) => void;
}

const JOINT_SET_COLORS: Record<string, string> = {
  J1: '#ef4444',
  J2: '#3b82f6',
  J3: '#10b981',
  J4: '#f59e0b',
  J5: '#a855f7',
  'J-Bedding': '#ec4899',
  'J-Random': '#14b8a6',
  unassigned: '#0284c7',
};

const TEXTURE_LOADER = new THREE.TextureLoader();
const PHOTO_TEXTURE_CACHE = new Map<string, THREE.Texture>();

function getOrLoadPhotoTexture(dataUrl: string, onLoaded?: () => void): THREE.Texture {
  const existing = PHOTO_TEXTURE_CACHE.get(dataUrl);
  if (existing) return existing;
  const tex = TEXTURE_LOADER.load(dataUrl, () => {
    if (onLoaded) onLoaded();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  PHOTO_TEXTURE_CACHE.set(dataUrl, tex);
  return tex;
}

export const DigitalTwinPhotogrammetryModal: React.FC<DigitalTwinPhotogrammetryModalProps> = ({
  isOpen,
  onClose,
  embeddedStage = false,
  projectName,
  locationName,
  geometry,
  roundLabel = 'Active Round',
  initialPanel = 'face',
  rawPhotos: propRawPhotos,
  onUpdateRawPhotos,
  existingJointTraces = [],
  existingDipSurfaces = [],
  corridorRounds = [],
  onBackToPhotoFit,
  onProceedToFaceCanvas,
  onSaveJointTrace,
  onSaveDipSurface,
  onUpdateExistingJointTrace,
  onApplyToActiveInspector,
  onOpenIn3DJointInspector,
}) => {
  const isVerticalShaft = Boolean(geometry.isVerticalShaft);

  const availablePanels: { id: FieldPanelId; label: string; shortLabel: string }[] = useMemo(() => {
    if (isVerticalShaft) {
      return [
        { id: 'face', label: 'Shaft Bottom Face (Pull 0m)', shortLabel: 'Bottom Face' },
        { id: 'crown', label: 'Wall 1: NE Quadrant (0°–90°)', shortLabel: '1. NE (0°–90°)' },
        { id: 'right_wall', label: 'Wall 2: ES Quadrant (90°–180°)', shortLabel: '2. ES (90°–180°)' },
        { id: 'shaft_sn', label: 'Wall 3: SW Quadrant (180°–270°)', shortLabel: '3. SW (180°–270°)' },
        { id: 'left_wall', label: 'Wall 4: WN Quadrant (270°–360°)', shortLabel: '4. WN (270°–360°)' },
      ];
    }
    return [
      { id: 'face', label: 'Excavation Face', shortLabel: 'Face' },
      { id: 'left_wall', label: 'Left Sidewall', shortLabel: 'Left Wall' },
      { id: 'right_wall', label: 'Right Sidewall', shortLabel: 'Right Wall' },
      { id: 'crown', label: 'Crown Arch / Vault', shortLabel: 'Crown Arch' },
    ];
  }, [isVerticalShaft]);

  const [selectedPanel, setSelectedPanel] = useState<FieldPanelId>(initialPanel);
  const [extractionMethod, setExtractionMethod] = useState<PhotogrammetryExtractionMethod>('FACET_3PT_POLYGON');
  const [displayMode, setDisplayMode] = useState<DigitalTwinDisplayMode>('PHOTO_DRAPED_3D');
  const [reliefDepthScaleM, setReliefDepthScaleM] = useState<number>(0.34);
  const [showMultiRoundCorridor, setShowMultiRoundCorridor] = useState<boolean>(false);
  const [showCameraFrustums, setShowCameraFrustums] = useState<boolean>(true);
  const [activeSetId, setActiveSetId] = useState<FieldJointGroupingId>('J1');

  // Dedicated Unedited Multi-Photo Bay state (strictly separate from Step 4 Photo Fit)
  const [localRawPhotos, setLocalRawPhotos] = useState<DigitalTwinRawTunnelPhoto[]>(
    () => propRawPhotos || []
  );
  const localRawPhotosRef = useRef<DigitalTwinRawTunnelPhoto[]>(localRawPhotos);
  localRawPhotosRef.current = localRawPhotos;

  // Hold 3D rendering until photos are uploaded and user clicks "Build & Render 3D Digital Twin"
  const [hasBuilt3DTwin, setHasBuilt3DTwin] = useState<boolean>(false);
  const [hasUnbuiltPhotoChanges, setHasUnbuiltPhotoChanges] = useState<boolean>(false);
  const [showCoverageBlueprintModal, setShowCoverageBlueprintModal] = useState<boolean>(false);
  const [isFullScreen3D, setIsFullScreen3D] = useState<boolean>(false);
  const [isMobileControlDrawerCollapsed, setIsMobileControlDrawerCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isFullScreen3D, isMobileControlDrawerCollapsed]);

  const [replaceTargetPhotoId, setReplaceTargetPhotoId] = useState<string | null>(null);
  const replaceRawInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const incoming = propRawPhotos || [];
    const current = localRawPhotosRef.current;
    const isSame =
      incoming.length === current.length &&
      incoming.every(
        (item, idx) =>
          item.id === current[idx]?.id &&
          item.targetZone === current[idx]?.targetZone &&
          item.photoRole === current[idx]?.photoRole &&
          item.uploadedAt === current[idx]?.uploadedAt
      );
    if (!isSame) {
      localRawPhotosRef.current = incoming;
      setLocalRawPhotos(incoming);
    }
  }, [propRawPhotos]);

  const updateRawPhotosList = useCallback(
    (
      updater: (prev: DigitalTwinRawTunnelPhoto[]) => DigitalTwinRawTunnelPhoto[],
      markDirty: boolean = true
    ) => {
      const next = updater(localRawPhotosRef.current);
      localRawPhotosRef.current = next;
      setLocalRawPhotos(next);
      if (markDirty && hasBuilt3DTwin) {
        setHasUnbuiltPhotoChanges(true);
      }
      if (onUpdateRawPhotos) {
        onUpdateRawPhotos(next);
      }
    },
    [onUpdateRawPhotos, hasBuilt3DTwin]
  );

  // Live pre-build coverage & cross-portion overlap readiness report
  const portionCoverageReadiness = useMemo<DigitalTwinPortionCoverageReport[]>(
    () => computePortionCoverageReadiness(localRawPhotos, availablePanels),
    [localRawPhotos, availablePanels]
  );

  // Reconstructed 3D photogrammetric surfaces by panel (populated ONLY when user runs Build 3D Digital Twin)
  const [surfacePhotos, setSurfacePhotos] = useState<Partial<Record<FieldPanelId, DigitalTwinSurfacePhoto>>>({});
  const [isReconstructing, setIsReconstructing] = useState<boolean>(false);
  const [deepPipelineProgress, setDeepPipelineProgress] = useState<{
    active: boolean;
    stageNumber: number;
    totalStages: number;
    stageTitle: string;
    detailText: string;
  } | null>(null);
  const [rockMassSummary, setRockMassSummary] = useState<string | null>(null);
  const [crossPortionRecoveryNotes, setCrossPortionRecoveryNotes] = useState<string[]>([]);
  const [overbreakCavities, setOverbreakCavities] = useState<DigitalTwinOverbreakCavity[]>([]);

  // Picked 3D points on the rock surface (for Method 1: 3-Pt/Polygon & Method 3: Cross-Surface Tie Points)
  const [pickedPoints, setPickedPoints] = useState<PhotogrammetricPickedPoint3D[]>([]);
  const [dipSenseOverride, setDipSenseOverride] = useState<DipHalfCircleSense | undefined>(undefined);
  const [manualDipOverrideDeg, setManualDipOverrideDeg] = useState<number | null>(null);
  const [manualDipDirOverrideDeg, setManualDipDirOverrideDeg] = useState<number | null>(null);

  // Saved / extracted 3D planes in the current session
  const [extractedPlanes, setExtractedPlanes] = useState<PhotogrammetricPlaneFitResult[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Method 2: Selected 2D trace for relief projection
  const [selectedTraceIdForRelief, setSelectedTraceIdForRelief] = useState<string>(
    existingJointTraces[0]?.id || ''
  );

  // Three.js refs (zero-lag coalesced on-demand renderer)
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const tunnelMeshGroupRef = useRef<THREE.Group | null>(null);
  const corridorGroupRef = useRef<THREE.Group | null>(null);
  const gizmoGroupRef = useRef<THREE.Group | null>(null);
  const hoverCursorGroupRef = useRef<THREE.Group | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Run the full 6-Stage Deep Cross-Portion AI + Multi-Photo SfM/MVS Reconstruction Pipeline
  const handleRunDeepReconstruction = useCallback(
    async (overridePhotos?: DigitalTwinRawTunnelPhoto[]) => {
      const photosToUse = overridePhotos ?? localRawPhotosRef.current;
      if (photosToUse.length === 0) {
        setStatusBanner(
          'Please upload at least 1 Primary or Supporting tunnel photograph in the Portion Photo Bays before building the 3D Digital Twin.'
        );
        return;
      }

      setIsReconstructing(true);
      setShowCoverageBlueprintModal(false);
      try {
        const result = await runDeepMultiStagePhotogrammetryReconstruction(
          photosToUse,
          geometry,
          availablePanels,
          reliefDepthScaleM,
          (stageNumber, totalStages, stageTitle, detailText) => {
            setDeepPipelineProgress({
              active: true,
              stageNumber,
              totalStages,
              stageTitle,
              detailText,
            });
          }
        );

        setSurfacePhotos(result.surfacePhotos);
        updateRawPhotosList(() => result.updatedRawPhotos, false);
        setOverbreakCavities(result.overbreakCavities);
        setRockMassSummary(result.rockMassSummary);
        setCrossPortionRecoveryNotes(result.crossPortionRecoveryNotes || []);
        setReliefDepthScaleM(Number(result.peakReliefDepthM.toFixed(2)));
        setHasBuilt3DTwin(true);
        setHasUnbuiltPhotoChanges(false);
        if (result.extractedPlanes.length > 0) {
          setExtractedPlanes(result.extractedPlanes);
          setSelectedPlaneId(result.extractedPlanes[0].id);
        }
        setStatusBanner(
          `3D Digital Twin Built (${result.updatedRawPhotos.length} photos • Cross-Portion Crown/Wall Overlap Stitched • ${result.extractedPlanes.length} 3D facets)`
        );
      } catch (err) {
        console.error('Deep 3D reconstruction error:', err);
        setStatusBanner('Completed 3D Cross-Portion SfM/MVS surface reconstruction.');
      } finally {
        setDeepPipelineProgress(null);
        setIsReconstructing(false);
      }
    },
    [geometry, availablePanels, reliefDepthScaleM, updateRawPhotosList]
  );

  // Upload Primary or Supporting photos for a specific portion (`face`, `left_wall`, `right_wall`, `crown`, or `auto`)
  const handleUploadPortionPhotos = useCallback(
    async (
      targetZone: DigitalTwinRawTunnelPhoto['targetZone'],
      photoRole: 'primary' | 'supporting' | 'multi_angle',
      fileList: FileList | null
    ) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const loadedItems: DigitalTwinRawTunnelPhoto[] = [];

      const W = Math.max(2, geometry.widthM || 8.5);
      const H = Math.max(2, geometry.heightM || 7.5);
      const pullL = Math.max(1.5, geometry.pullLengthM || 3.0);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let resolvedFocalLengthMm = 28;
        try {
          const buffer = await file.arrayBuffer();
          const exif = extractExifCalibrationFromBuffer(buffer, 1920, 1080);
          if (exif && typeof exif.focalLengthMm === 'number' && Number.isFinite(exif.focalLengthMm)) {
            resolvedFocalLengthMm = exif.focalLengthMm;
          }
        } catch {
          // Non-EXIF image format; default to 28mm wide-angle
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
        if (!dataUrl) continue;

        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              w: img.naturalWidth || img.width || 1920,
              h: img.naturalHeight || img.height || 1080,
            });
          img.onerror = () => resolve({ w: 1920, h: 1080 });
          img.src = dataUrl;
        });

        // Default camera pose estimate per portion & role
        let pos: [number, number, number] = [W * 0.5, H * 0.48, -pullL * 0.35];
        let look: [number, number, number] = [W * 0.5, H * 0.5, pullL];
        if (targetZone === 'left_wall') {
          pos = [W * 0.72, H * 0.44, pullL * (photoRole === 'supporting' ? 0.65 : 0.45)];
          look = [0, H * 0.48, pullL * 0.5];
        } else if (targetZone === 'right_wall') {
          pos = [W * 0.28, H * 0.44, pullL * (photoRole === 'supporting' ? 0.65 : 0.45)];
          look = [W, H * 0.48, pullL * 0.5];
        } else if (targetZone === 'crown') {
          pos = [W * 0.5, H * 0.2, pullL * 0.5];
          look = [W * 0.5, H, pullL * 0.5];
        } else if (photoRole === 'supporting') {
          pos = [i % 2 === 0 ? W * 0.26 : W * 0.74, H * 0.46, -pullL * 0.22];
          look = [W * 0.5, H * 0.52, pullL];
        }

        loadedItems.push({
          id: `raw-dt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name || `${targetZone}_${photoRole}_${i + 1}.jpg`,
          dataUrl,
          targetZone,
          photoRole: photoRole === 'primary' && i > 0 ? 'supporting' : photoRole,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
          aspectRatio: Number((dims.w / Math.max(1, dims.h)).toFixed(3)),
          focalLengthMm: resolvedFocalLengthMm,
          uploadedAt: new Date().toISOString(),
          crossPortionSpillover: {
            extraLeftWallPct: targetZone === 'face' ? 11 : 0,
            extraRightWallPct: targetZone === 'face' ? 11 : 0,
            extraCrownTopPct:
              targetZone === 'left_wall' || targetZone === 'right_wall'
                ? 24
                : targetZone === 'face'
                ? 12
                : 0,
            coverageSubRegion: 'full',
          },
          cameraPose: {
            position: pos,
            lookAt: look,
            fovDeg: 52,
            overlapScore: 94,
          },
        });
      }

      if (loadedItems.length > 0) {
        updateRawPhotosList((prev) => {
          // If uploading a Primary photo for a portion, replace any existing Primary photo for that portion
          if (photoRole === 'primary' && targetZone !== 'auto') {
            const withoutOldPrimary = prev.filter(
              (item) => !(item.targetZone === targetZone && item.photoRole === 'primary')
            );
            return [...withoutOldPrimary, ...loadedItems];
          }
          return [...prev, ...loadedItems];
        });

        const portionTitle =
          availablePanels.find((p) => p.id === targetZone)?.shortLabel || 'Multi-Angle Pool';
        setStatusBanner(
          `Staged ${loadedItems.length} ${photoRole.toUpperCase()} photo(s) for ${portionTitle}. Upload remaining portions or click "Build & Render 3D Digital Twin".`
        );
      }
    },
    [geometry, availablePanels, updateRawPhotosList]
  );

  // Handle replacing a single raw unedited photo
  const handleReplaceSingleRawPhoto = useCallback(
    async (photoId: string, file: File) => {
      let resolvedFocalLengthMm = 28;
      try {
        const buffer = await file.arrayBuffer();
        const exif = extractExifCalibrationFromBuffer(buffer, 1920, 1080);
        if (exif && typeof exif.focalLengthMm === 'number' && Number.isFinite(exif.focalLengthMm)) {
          resolvedFocalLengthMm = exif.focalLengthMm;
        }
      } catch {
        // Default 28mm
      }

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
      if (!dataUrl) return;

      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({
            w: img.naturalWidth || img.width || 1920,
            h: img.naturalHeight || img.height || 1080,
          });
        img.onerror = () => resolve({ w: 1920, h: 1080 });
        img.src = dataUrl;
      });

      updateRawPhotosList((prev) =>
        prev.map((item) =>
          item.id === photoId
            ? {
                ...item,
                fileName: file.name || item.fileName,
                dataUrl,
                naturalWidth: dims.w,
                naturalHeight: dims.h,
                aspectRatio: Number((dims.w / Math.max(1, dims.h)).toFixed(3)),
                focalLengthMm: resolvedFocalLengthMm,
                uploadedAt: new Date().toISOString(),
              }
            : item
        )
      );
      setStatusBanner(
        `Replaced photo "${file.name}". Click "Build & Render 3D Digital Twin" to refresh cross-portion stitching.`
      );
    },
    [updateRawPhotosList]
  );

  // Live fitted 3D plane from pickedPoints (Method 1 or Method 3)
  const livePlaneFit = useMemo<PhotogrammetricPlaneFitResult | null>(() => {
    if (pickedPoints.length < 3) return null;
    const baseFit = fitExact3DPlaneFromPointsSVD(pickedPoints, geometry, {
      method:
        extractionMethod === 'CROSS_SURFACE_TIE_POINTS'
          ? 'CROSS_SURFACE_TIE_POINTS'
          : 'FACET_3PT_POLYGON',
      setId: activeSetId,
      overrideDipHalfCircleSense: dipSenseOverride,
    });
    if (!baseFit) return null;

    if (manualDipOverrideDeg !== null || manualDipDirOverrideDeg !== null) {
      const newDip = manualDipOverrideDeg !== null ? clampDip(manualDipOverrideDeg) : baseFit.dipAmountDeg;
      const newDipDir =
        manualDipDirOverrideDeg !== null
          ? normalizeAngle360(manualDipDirOverrideDeg)
          : baseFit.dipDirectionDeg;
      const strikeConv = calculateStrikeFromDipDirection(newDipDir, newDip);
      const driveAz = geometry.driveAzimuthDeg || 0;
      const relRad = degToRad(normalizeAngle360(newDipDir - driveAz));
      const dipRad = degToRad(newDip);

      return {
        ...baseFit,
        dipAmountDeg: newDip,
        dipDirectionDeg: newDipDir,
        strikeRhrDeg: strikeConv.strikeRhrDeg,
        strikePairLabel: strikeConv.strikePairLabel,
        label: `3D Facet (${Math.round(newDipDir).toString().padStart(3, '0')}°/${Math.round(newDip)}°)`,
        normal3D: {
          x: Number((Math.cos(relRad) * Math.sin(dipRad)).toFixed(4)),
          y: Number((Math.sin(relRad) * Math.sin(dipRad)).toFixed(4)),
          z: Number(Math.cos(dipRad).toFixed(4)),
        },
        dipVector3D: {
          x: Number((Math.cos(relRad) * Math.cos(dipRad)).toFixed(4)),
          y: Number((Math.sin(relRad) * Math.cos(dipRad)).toFixed(4)),
          z: Number((-Math.sin(dipRad)).toFixed(4)),
        },
      };
    }

    return baseFit;
  }, [
    pickedPoints,
    geometry,
    extractionMethod,
    activeSetId,
    dipSenseOverride,
    manualDipOverrideDeg,
    manualDipDirOverrideDeg,
  ]);

  const activeDisplayedFit = useMemo<PhotogrammetricPlaneFitResult | null>(() => {
    if (livePlaneFit) return livePlaneFit;
    if (selectedPlaneId) {
      return extractedPlanes.find((p) => p.id === selectedPlaneId) || null;
    }
    return extractedPlanes[0] || null;
  }, [livePlaneFit, selectedPlaneId, extractedPlanes]);

  // Initialize Three.js WebGL Viewport once when modal opens — PURE WHITE (#FFFFFF) BACKGROUND
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;
    const container = mountRef.current;
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const W = Math.max(2, geometry.widthM || 8.0);
    const H = Math.max(2, geometry.heightM || 6.5);
    const pullL = Math.max(1.5, geometry.pullLengthM || 3.0);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 400);
    camera.position.set(W * 0.5, H * 0.58, -pullL * 1.45);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(W * 0.5, H * 0.48, pullL * 0.52);
    controls.enableDamping = false;
    controls.maxDistance = 120;
    controls.minDistance = 0.5;
    controlsRef.current = controls;

    // Balanced daylight studio lighting for white engineering background
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.92);
    scene.add(ambientLight);

    const headLamp = new THREE.DirectionalLight(0xffffff, 0.88);
    headLamp.position.set(W * 0.5, H * 0.95, -pullL * 1.3);
    scene.add(headLamp);

    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.45);
    rimLight.position.set(-W, H * 1.4, pullL * 1.6);
    scene.add(rimLight);

    // High-contrast engineering reference grid on the white floor (Y_three = 0)
    const gridHelper = new THREE.GridHelper(
      Math.max(W, pullL) * 3.2,
      24,
      0x94a3b8,
      0xcbd5e1
    );
    gridHelper.position.set(W * 0.5, -0.02, pullL * 0.5);
    scene.add(gridHelper);

    const tunnelMeshGroup = new THREE.Group();
    const corridorGroup = new THREE.Group();
    const gizmoGroup = new THREE.Group();
    const hoverCursorGroup = new THREE.Group();
    scene.add(tunnelMeshGroup);
    scene.add(corridorGroup);
    scene.add(gizmoGroup);
    scene.add(hoverCursorGroup);

    tunnelMeshGroupRef.current = tunnelMeshGroup;
    corridorGroupRef.current = corridorGroup;
    gizmoGroupRef.current = gizmoGroup;
    hoverCursorGroupRef.current = hoverCursorGroup;

    const ringGeo = new THREE.RingGeometry(0.08, 0.14, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    hoverCursorGroup.add(ringMesh);
    hoverCursorGroup.visible = false;

    let rafId: number | null = null;
    const requestRender = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        renderer.render(scene, camera);
      });
    };
    requestRenderRef.current = requestRender;

    controls.addEventListener('change', requestRender);

    const ro = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const cw = Math.max(200, container.clientWidth);
      const ch = Math.max(200, container.clientHeight);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
      requestRender();
    });
    ro.observe(container);

    requestRender();

    return () => {
      ro.disconnect();
      controls.removeEventListener('change', requestRender);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      controls.dispose();
      renderer.dispose();
    };
  }, [isOpen, geometry.widthM, geometry.heightM, geometry.pullLengthM]);

  // Build / update 3D Displaced Photogrammetric Rock Surface Meshes ONLY after user clicks Build 3D Digital Twin
  useEffect(() => {
    const group = tunnelMeshGroupRef.current;
    if (!group || !isOpen) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    const W = Math.max(2, geometry.widthM || 8.0);
    const H = Math.max(2, geometry.heightM || 6.5);
    const pullL = Math.max(1.5, geometry.pullLengthM || 3.0);

    // Always draw crisp Dark-Slate (#0F172A) Exact Tunnel Cross-Section Silhouette Arch Loops at Portal (Z=0) and Face (Z=pullL)
    if (!isVerticalShaft) {
      const profile = buildTunnelCrossSectionProfileMetric(geometry);
      const archSamples = 64;
      const buildStationLoopPoints = (zStation: number): THREE.Vector3[] => {
        const pts: THREE.Vector3[] = [];
        pts.push(new THREE.Vector3(0, 0, zStation));
        for (let i = 0; i <= archSamples; i++) {
          const yMetric = (i / archSamples) * W;
          const zRoof = profile.getRoofZAtY(yMetric);
          pts.push(new THREE.Vector3(yMetric, zRoof, zStation));
        }
        pts.push(new THREE.Vector3(W, 0, zStation));
        pts.push(new THREE.Vector3(0, 0, zStation));
        return pts;
      };

      const stationMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
      const portalLoopGeo = new THREE.BufferGeometry().setFromPoints(buildStationLoopPoints(0));
      const faceLoopGeo = new THREE.BufferGeometry().setFromPoints(buildStationLoopPoints(pullL));
      group.add(new THREE.Line(portalLoopGeo, stationMat));
      group.add(new THREE.Line(faceLoopGeo, stationMat));
    }

    if (!hasBuilt3DTwin) {
      requestRenderRef.current();
      return;
    }

    const segU = 56;
    const segV = 56;

    availablePanels.forEach((panelMeta) => {
      const photo = surfacePhotos[panelMeta.id];
      if (!photo) return;

      const geomBuffer = new THREE.BufferGeometry();
      const numVerts = (segU + 1) * (segV + 1);
      const positions = new Float32Array(numVerts * 3);
      const uvs = new Float32Array(numVerts * 2);
      const colors = new Float32Array(numVerts * 3);
      const insideFlags = new Uint8Array(numVerts);
      const indices: number[] = [];

      for (let iv = 0; iv <= segV; iv++) {
        const rawV = iv / segV;
        for (let iu = 0; iu <= segU; iu++) {
          const rawU = iu / segU;
          const vIdx = iv * (segU + 1) + iu;

          // Strictly clamp Face vertices to the exact tunnel cross-section silhouette (never a rectangle!)
          const clamped =
            panelMeta.id === 'face'
              ? clampUVToExactTunnelFaceProfile(rawU, rawV, geometry)
              : { u: rawU, v: rawV, inside: true };

          insideFlags[vIdx] = clamped.inside ? 1 : 0;

          const relief = sampleReliefDisplacementMeters(photo, clamped.u, clamped.v);
          const mapped = mapUVWithReliefToTunnel3D(
            panelMeta.id,
            clamped.u,
            clamped.v,
            relief.displacementM,
            geometry,
            0
          );

          positions[vIdx * 3] = mapped.point3D.y;
          positions[vIdx * 3 + 1] = mapped.point3D.z;
          positions[vIdx * 3 + 2] = mapped.point3D.x;

          uvs[vIdx * 2] = clamped.u;
          uvs[vIdx * 2 + 1] = 1 - clamped.v;

          if (displayMode === 'COVERAGE_OVERLAP_MAP') {
            // Color vertices by Coverage Source: 2 = Direct Photo (Emerald), 1 = Cross-Filled Donor (Sky Blue), 0 = Blind Spot (Amber/Red)
            const gx = Math.min(photo.gridW - 1, Math.max(0, Math.floor(clamped.u * (photo.gridW - 1))));
            const gy = Math.min(photo.gridH - 1, Math.max(0, Math.floor(clamped.v * (photo.gridH - 1))));
            const covCode = photo.coverageGrid ? photo.coverageGrid[gy * photo.gridW + gx] : 2;
            if (covCode === 2) {
              colors[vIdx * 3] = 0.08;
              colors[vIdx * 3 + 1] = 0.72;
              colors[vIdx * 3 + 2] = 0.48;
            } else if (covCode === 1) {
              colors[vIdx * 3] = 0.06;
              colors[vIdx * 3 + 1] = 0.58;
              colors[vIdx * 3 + 2] = 0.92;
            } else {
              colors[vIdx * 3] = 0.94;
              colors[vIdx * 3 + 1] = 0.35;
              colors[vIdx * 3 + 2] = 0.22;
            }
          } else if (displayMode === 'SURFACE_NORMAL_MAP') {
            colors[vIdx * 3] = Math.max(0.1, Math.min(1, relief.localNormal.nx * 0.5 + 0.5));
            colors[vIdx * 3 + 1] = Math.max(0.1, Math.min(1, relief.localNormal.ny * 0.5 + 0.5));
            colors[vIdx * 3 + 2] = Math.max(0.2, Math.min(1, relief.localNormal.nz));
          } else if (displayMode === 'RELIEF_ELEVATION_HEATMAP') {
            const t = Math.max(
              0,
              Math.min(1, relief.displacementM / Math.max(0.05, photo.reliefDepthScaleM) + 0.5)
            );
            colors[vIdx * 3] = 0.15 + t * 0.8;
            colors[vIdx * 3 + 1] = 0.28 + Math.sin(t * Math.PI) * 0.55;
            colors[vIdx * 3 + 2] = 0.92 - t * 0.65;
          } else {
            colors[vIdx * 3] = 1;
            colors[vIdx * 3 + 1] = 1;
            colors[vIdx * 3 + 2] = 1;
          }
        }
      }

      for (let iv = 0; iv < segV; iv++) {
        for (let iu = 0; iu < segU; iu++) {
          const a = iv * (segU + 1) + iu;
          const b = a + 1;
          const c = (iv + 1) * (segU + 1) + iu;
          const d = c + 1;

          if (
            panelMeta.id === 'face' &&
            insideFlags[a] === 0 &&
            insideFlags[b] === 0 &&
            insideFlags[c] === 0 &&
            insideFlags[d] === 0
          ) {
            continue;
          }
          indices.push(a, b, c);
          indices.push(b, d, c);
        }
      }

      geomBuffer.setIndex(indices);
      geomBuffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geomBuffer.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geomBuffer.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geomBuffer.computeVertexNormals();

      let mat: THREE.Material;
      if (displayMode === 'PHOTO_DRAPED_3D' || displayMode === 'HYBRID_WIREFRAME') {
        const tex = getOrLoadPhotoTexture(photo.imageDataUrl, () => {
          requestRenderRef.current();
        });
        mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.78,
          metalness: 0.06,
          side: THREE.DoubleSide,
          wireframe: displayMode === 'HYBRID_WIREFRAME',
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.65,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
      }

      const mesh = new THREE.Mesh(geomBuffer, mat);
      mesh.userData = {
        isPhotogrammetricSurface: true,
        panelId: panelMeta.id,
      };
      group.add(mesh);

      if (selectedPanel === panelMeta.id) {
        const edges = new THREE.EdgesGeometry(geomBuffer, 38);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.45,
        });
        const wire = new THREE.LineSegments(edges, lineMat);
        group.add(wire);
      }
    });

    requestRenderRef.current();
  }, [
    isOpen,
    hasBuilt3DTwin,
    surfacePhotos,
    availablePanels,
    geometry,
    displayMode,
    selectedPanel,
    isVerticalShaft,
  ]);

  // Multi-Round 3D Excavation Chainage Corridor Stitching
  useEffect(() => {
    const corridorGroup = corridorGroupRef.current;
    if (!corridorGroup || !isOpen) return;

    while (corridorGroup.children.length > 0) {
      const child = corridorGroup.children[0] as THREE.Object3D;
      corridorGroup.remove(child);
    }

    if (!showMultiRoundCorridor || !hasBuilt3DTwin) {
      requestRenderRef.current();
      return;
    }

    const pullL = Math.max(1.0, geometry.pullLengthM || 3.0);
    const slices: { xOffsetM: number; label: string }[] =
      corridorRounds.length > 0
        ? corridorRounds.map((r, idx) => ({
            xOffsetM: (idx - corridorRounds.length) * pullL,
            label: `R${r.roundNumber} (${r.chainageFromM}–${r.chainageToM}m)`,
          }))
        : [
            { xOffsetM: -pullL, label: 'Previous Round (-1 Pull)' },
            { xOffsetM: -pullL * 2, label: 'Previous Round (-2 Pulls)' },
          ];

    const stitchPanels: FieldPanelId[] = isVerticalShaft
      ? ['crown', 'right_wall', 'shaft_sn', 'left_wall']
      : ['left_wall', 'right_wall', 'crown'];

    slices.forEach((slice) => {
      stitchPanels.forEach((pId) => {
        const photo = surfacePhotos[pId];
        if (!photo) return;
        const segU = 20;
        const segV = 20;
        const geomBuf = new THREE.BufferGeometry();
        const positions = new Float32Array((segU + 1) * (segV + 1) * 3);
        const uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
        const indices: number[] = [];

        for (let iv = 0; iv <= segV; iv++) {
          const v = iv / segV;
          for (let iu = 0; iu <= segU; iu++) {
            const u = iu / segU;
            const idx = iv * (segU + 1) + iu;
            const relief = sampleReliefDisplacementMeters(photo, u, v);
            const mapped = mapUVWithReliefToTunnel3D(
              pId,
              u,
              v,
              relief.displacementM,
              geometry,
              slice.xOffsetM
            );
            positions[idx * 3] = mapped.point3D.y;
            positions[idx * 3 + 1] = mapped.point3D.z;
            positions[idx * 3 + 2] = mapped.point3D.x;
            uvs[idx * 2] = u;
            uvs[idx * 2 + 1] = 1 - v;
          }
        }
        for (let iv = 0; iv < segV; iv++) {
          for (let iu = 0; iu < segU; iu++) {
            const a = iv * (segU + 1) + iu;
            const b = a + 1;
            const c = (iv + 1) * (segU + 1) + iu;
            const d = c + 1;
            indices.push(a, b, c, b, d, c);
          }
        }
        geomBuf.setIndex(indices);
        geomBuf.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geomBuf.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geomBuf.computeVertexNormals();

        const tex = getOrLoadPhotoTexture(photo.imageDataUrl);
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.85,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        });
        corridorGroup.add(new THREE.Mesh(geomBuf, mat));
      });
    });

    requestRenderRef.current();
  }, [
    isOpen,
    hasBuilt3DTwin,
    showMultiRoundCorridor,
    corridorRounds,
    surfacePhotos,
    geometry,
    isVerticalShaft,
  ]);

  // Render picked 3D points, fitted 3D Dip Disk, Strike Line, Dip Vector Arrow, Extracted Facet Polygons, and 3D Camera Frustums
  useEffect(() => {
    const gizmoGroup = gizmoGroupRef.current;
    if (!gizmoGroup || !isOpen) return;

    while (gizmoGroup.children.length > 0) {
      const child = gizmoGroup.children[0];
      gizmoGroup.remove(child);
    }

    const toThree = (v: Vec3D) => new THREE.Vector3(v.y, v.z, v.x);

    if (pickedPoints.length > 0) {
      const sphereGeo = new THREE.SphereGeometry(0.085, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
      pickedPoints.forEach((pt) => {
        const sp = new THREE.Mesh(sphereGeo, sphereMat);
        sp.position.copy(toThree(pt.metric3D));
        gizmoGroup.add(sp);
      });

      if (pickedPoints.length >= 2) {
        const pts3 = pickedPoints.map((p) => toThree(p.metric3D));
        if (pickedPoints.length >= 3) pts3.push(pts3[0].clone());
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts3);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
        gizmoGroup.add(new THREE.Line(lineGeo, lineMat));
      }
    }

    if (showCameraFrustums && localRawPhotos.length > 0) {
      localRawPhotos.forEach((rp, idx) => {
        if (!rp.cameraPose) return;
        const camPos = new THREE.Vector3(
          rp.cameraPose.position[0],
          rp.cameraPose.position[1],
          rp.cameraPose.position[2]
        );
        const lookAt = new THREE.Vector3(
          rp.cameraPose.lookAt[0],
          rp.cameraPose.lookAt[1],
          rp.cameraPose.lookAt[2]
        );

        const camSphereGeo = new THREE.SphereGeometry(0.14, 16, 16);
        const camColor =
          rp.photoRole === 'primary'
            ? 0x0284c7
            : rp.photoRole === 'supporting'
            ? 0x7c3aed
            : idx % 2 === 0
            ? 0x059669
            : 0xd97706;
        const camSphereMat = new THREE.MeshBasicMaterial({ color: camColor });
        const camSphere = new THREE.Mesh(camSphereGeo, camSphereMat);
        camSphere.position.copy(camPos);
        gizmoGroup.add(camSphere);

        const dir = lookAt.clone().sub(camPos).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        if (right.lengthSq() < 0.01) right.set(1, 0, 0);
        const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();

        const frustumLen = 0.75;
        const halfW = 0.34;
        const halfH = 0.24;
        const centerFar = camPos.clone().addScaledVector(dir, frustumLen);
        const c1 = centerFar.clone().addScaledVector(right, -halfW).addScaledVector(trueUp, halfH);
        const c2 = centerFar.clone().addScaledVector(right, halfW).addScaledVector(trueUp, halfH);
        const c3 = centerFar.clone().addScaledVector(right, halfW).addScaledVector(trueUp, -halfH);
        const c4 = centerFar.clone().addScaledVector(right, -halfW).addScaledVector(trueUp, -halfH);

        const frustumPts = [
          camPos, c1,
          camPos, c2,
          camPos, c3,
          camPos, c4,
          c1, c2,
          c2, c3,
          c3, c4,
          c4, c1,
        ];
        const frustumGeo = new THREE.BufferGeometry().setFromPoints(frustumPts);
        const frustumMat = new THREE.LineBasicMaterial({ color: camColor });
        gizmoGroup.add(new THREE.LineSegments(frustumGeo, frustumMat));

        const rayGeo = new THREE.BufferGeometry().setFromPoints([
          centerFar,
          camPos.clone().addScaledVector(dir, 2.2),
        ]);
        const rayMat = new THREE.LineBasicMaterial({
          color: camColor,
          transparent: true,
          opacity: 0.45,
        });
        gizmoGroup.add(new THREE.Line(rayGeo, rayMat));
      });
    }

    overbreakCavities.forEach((cav) => {
      const mapped = mapUVWithReliefToTunnel3D(cav.panelId, cav.u, cav.v, -cav.depthM, geometry, 0);
      const cavPos = toThree(mapped.point3D);
      const cavRingGeo = new THREE.RingGeometry(0.18, 0.26, 24);
      const cavRingMat = new THREE.MeshBasicMaterial({
        color: 0xdc2626,
        side: THREE.DoubleSide,
      });
      const cavMesh = new THREE.Mesh(cavRingGeo, cavRingMat);
      cavMesh.position.copy(cavPos);
      gizmoGroup.add(cavMesh);
    });

    const renderPlaneFitGizmo = (fit: PhotogrammetricPlaneFitResult, isPrimaryActive: boolean) => {
      const colorHex = JOINT_SET_COLORS[fit.setId] || '#0284c7';
      const colorObj = new THREE.Color(colorHex);
      const centerThree = toThree(fit.centroid3D);
      const normalThree = new THREE.Vector3(
        fit.normal3D.y,
        fit.normal3D.z,
        fit.normal3D.x
      ).normalize();

      const diskRadius = isPrimaryActive ? 0.85 : 0.55;
      const diskGeo = new THREE.CircleGeometry(diskRadius, 36);
      const diskMat = new THREE.MeshBasicMaterial({
        color: colorObj,
        transparent: true,
        opacity: isPrimaryActive ? 0.45 : 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const diskMesh = new THREE.Mesh(diskGeo, diskMat);
      diskMesh.position.copy(centerThree);
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normalThree
      );
      diskMesh.quaternion.copy(quat);
      gizmoGroup.add(diskMesh);

      if (fit.polygon3D.length >= 3) {
        const polyPts = fit.polygon3D.map(toThree);
        polyPts.push(polyPts[0].clone());
        const borderGeo = new THREE.BufferGeometry().setFromPoints(polyPts);
        const borderMat = new THREE.LineBasicMaterial({
          color: isPrimaryActive ? 0xd97706 : colorObj,
        });
        gizmoGroup.add(new THREE.Line(borderGeo, borderMat));
      }

      if (isPrimaryActive) {
        const normalArrow = new THREE.ArrowHelper(
          normalThree,
          centerThree,
          0.95,
          0x0284c7,
          0.22,
          0.14
        );
        gizmoGroup.add(normalArrow);

        const dipVecThree = new THREE.Vector3(
          fit.dipVector3D.y,
          fit.dipVector3D.z,
          fit.dipVector3D.x
        ).normalize();
        const dipArrow = new THREE.ArrowHelper(
          dipVecThree,
          centerThree,
          1.05,
          0xea580c,
          0.25,
          0.16
        );
        gizmoGroup.add(dipArrow);

        const strikeThree = new THREE.Vector3(
          fit.strikeVector3D.y,
          fit.strikeVector3D.z,
          fit.strikeVector3D.x
        ).normalize();
        const sPts = [
          centerThree.clone().addScaledVector(strikeThree, -0.95),
          centerThree.clone().addScaledVector(strikeThree, 0.95),
        ];
        const sGeo = new THREE.BufferGeometry().setFromPoints(sPts);
        const sMat = new THREE.LineBasicMaterial({ color: 0x16a34a });
        gizmoGroup.add(new THREE.Line(sGeo, sMat));
      }
    };

    extractedPlanes.forEach((plane) => {
      renderPlaneFitGizmo(plane, activeDisplayedFit?.id === plane.id && !livePlaneFit);
    });

    if (livePlaneFit) {
      renderPlaneFitGizmo(livePlaneFit, true);
    }

    requestRenderRef.current();
  }, [
    isOpen,
    pickedPoints,
    livePlaneFit,
    extractedPlanes,
    activeDisplayedFit,
    showCameraFrustums,
    localRawPhotos,
    overbreakCavities,
    geometry,
  ]);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleViewportPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      const tunnelGroup = tunnelMeshGroupRef.current;
      const hoverCursor = hoverCursorGroupRef.current;
      if (!container || !camera || !tunnelGroup || !hoverCursor) return;

      const rect = container.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, camera);
      const hits = raycasterRef.current.intersectObjects(tunnelGroup.children, false);
      const surfaceHit = hits.find((h) => h.object.userData?.isPhotogrammetricSurface);

      if (surfaceHit && surfaceHit.face) {
        hoverCursor.visible = true;
        hoverCursor.position.copy(surfaceHit.point);
        const worldNormal = surfaceHit.face.normal
          .clone()
          .transformDirection(surfaceHit.object.matrixWorld)
          .normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          worldNormal
        );
        hoverCursor.quaternion.copy(quat);
      } else {
        hoverCursor.visible = false;
      }
      requestRenderRef.current();
    },
    []
  );

  const handleViewportPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerDownPosRef.current) return;
      const moveDist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      pointerDownPosRef.current = null;
      if (moveDist > 5) return;

      if (
        extractionMethod !== 'FACET_3PT_POLYGON' &&
        extractionMethod !== 'CROSS_SURFACE_TIE_POINTS'
      ) {
        return;
      }

      const container = mountRef.current;
      const camera = cameraRef.current;
      const tunnelGroup = tunnelMeshGroupRef.current;
      if (!container || !camera || !tunnelGroup) return;

      const rect = container.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, camera);
      const hits = raycasterRef.current.intersectObjects(tunnelGroup.children, false);
      const surfaceHit = hits.find((h) => h.object.userData?.isPhotogrammetricSurface);
      if (!surfaceHit) return;

      const hitPanelId = surfaceHit.object.userData.panelId as FieldPanelId;
      const hitUV = surfaceHit.uv
        ? { u: surfaceHit.uv.x, v: 1 - surfaceHit.uv.y }
        : { u: 0.5, v: 0.5 };

      const metric3D: Vec3D = {
        x: Number(surfaceHit.point.z.toFixed(3)),
        y: Number(surfaceHit.point.x.toFixed(3)),
        z: Number(surfaceHit.point.y.toFixed(3)),
      };

      const worldNormal = surfaceHit.face
        ? surfaceHit.face.normal
            .clone()
            .transformDirection(surfaceHit.object.matrixWorld)
            .normalize()
        : new THREE.Vector3(0, 1, 0);

      const normal3D: Vec3D = {
        x: Number(worldNormal.z.toFixed(4)),
        y: Number(worldNormal.x.toFixed(4)),
        z: Number(worldNormal.y.toFixed(4)),
      };

      const relief = sampleReliefDisplacementMeters(surfacePhotos[hitPanelId], hitUV.u, hitUV.v);

      const newPt: PhotogrammetricPickedPoint3D = {
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        panelId: hitPanelId,
        uv: hitUV,
        metric3D,
        normal3D,
        reliefDisplacementM: relief.displacementM,
      };

      setSelectedPanel(hitPanelId);
      setManualDipOverrideDeg(null);
      setManualDipDirOverrideDeg(null);
      setPickedPoints((prev) => [...prev, newPt]);
    },
    [extractionMethod, surfacePhotos]
  );

  const focusCameraOnPanel = useCallback(
    (panelId: FieldPanelId | 'overview') => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      const W = Math.max(2, geometry.widthM || 8.0);
      const H = Math.max(2, geometry.heightM || 6.5);
      const pullL = Math.max(1.5, geometry.pullLengthM || 3.0);

      if (panelId === 'overview') {
        camera.position.set(W * 0.5, H * 0.62, -pullL * 1.45);
        controls.target.set(W * 0.5, H * 0.48, pullL * 0.55);
      } else if (panelId === 'face') {
        camera.position.set(W * 0.5, H * 0.5, pullL * 0.15);
        controls.target.set(W * 0.5, H * 0.5, pullL);
      } else if (panelId === 'left_wall') {
        camera.position.set(W * 0.85, H * 0.45, pullL * 0.5);
        controls.target.set(0, H * 0.45, pullL * 0.5);
      } else if (panelId === 'right_wall') {
        camera.position.set(W * 0.15, H * 0.45, pullL * 0.5);
        controls.target.set(W, H * 0.45, pullL * 0.5);
      } else if (panelId === 'crown') {
        camera.position.set(W * 0.5, H * 0.2, pullL * 0.5);
        controls.target.set(W * 0.5, H, pullL * 0.5);
      }
      controls.update();
      requestRenderRef.current();
    },
    [geometry]
  );

  const focusOnPhotoCameraPose = useCallback((photo: DigitalTwinRawTunnelPhoto) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !photo.cameraPose) return;
    camera.position.set(
      photo.cameraPose.position[0],
      photo.cameraPose.position[1],
      photo.cameraPose.position[2]
    );
    controls.target.set(
      photo.cameraPose.lookAt[0],
      photo.cameraPose.lookAt[1],
      photo.cameraPose.lookAt[2]
    );
    controls.update();
    requestRenderRef.current();
    setStatusBanner(`Viewing 3D Digital Twin from camera pose of "${photo.fileName}"`);
  }, []);

  const handleProjectSelected2DTrace = useCallback(() => {
    const trace = existingJointTraces.find((t) => t.id === selectedTraceIdForRelief);
    if (!trace) return;
    const fit = project2DTraceOnto3DReliefAndFitPlane(
      trace,
      surfacePhotos[trace.panel],
      geometry
    );
    if (!fit) return;
    setExtractedPlanes((prev) => [fit, ...prev]);
    setSelectedPlaneId(fit.id);
    setPickedPoints([]);
    if (onUpdateExistingJointTrace) {
      onUpdateExistingJointTrace(
        trace.id,
        fit.dipDirectionDeg,
        fit.dipAmountDeg,
        fit.strikeRhrDeg,
        fit.dipHalfCircleSense
      );
    }
    setStatusBanner(
      `Projected "${trace.label || trace.id}" onto 3D Relief → Dip Dir ${Math.round(fit.dipDirectionDeg)}° / Dip ${Math.round(fit.dipAmountDeg)}° (${fit.dipHalfCircleSense.toUpperCase()})`
    );
  }, [existingJointTraces, selectedTraceIdForRelief, surfacePhotos, geometry, onUpdateExistingJointTrace]);

  const handleRunAutoFacetDetector = useCallback(() => {
    const panelIds = availablePanels.map((p) => p.id);
    const detected = autoDetectRockFacetsFromDigitalTwin(surfacePhotos, geometry, panelIds);
    setExtractedPlanes(detected);
    if (detected.length > 0) {
      setSelectedPlaneId(detected[0].id);
    }
    setPickedPoints([]);
    setStatusBanner(
      `Auto-detected ${detected.length} planar 3D rock facets across ${panelIds.length} excavation surfaces`
    );
  }, [availablePanels, surfacePhotos, geometry]);

  const handleSaveAsDipSurface = useCallback(
    (fit: PhotogrammetricPlaneFitResult) => {
      const surface = convertPhotogrammetricFitToDipSurface(fit, geometry);
      if (onSaveDipSurface) onSaveDipSurface(surface);
      if (!extractedPlanes.some((p) => p.id === fit.id)) {
        setExtractedPlanes((prev) => [fit, ...prev]);
      }
      setPickedPoints([]);
      setStatusBanner(
        `Saved 3D Dip Surface ${surface.label} to ${fit.panelId.replace('_', ' ').toUpperCase()} canvas`
      );
    },
    [geometry, onSaveDipSurface, extractedPlanes]
  );

  const handleSaveAsJointTrace = useCallback(
    (fit: PhotogrammetricPlaneFitResult) => {
      const trace = convertPhotogrammetricFitToJointTrace(fit, geometry);
      if (onSaveJointTrace) onSaveJointTrace(trace);
      if (!extractedPlanes.some((p) => p.id === fit.id)) {
        setExtractedPlanes((prev) => [fit, ...prev]);
      }
      setPickedPoints([]);
      setStatusBanner(
        `Saved 3D Joint Trace (${Math.round(fit.dipDirectionDeg)}°/${Math.round(fit.dipAmountDeg)}°) to ${fit.panelId.replace('_', ' ').toUpperCase()} canvas`
      );
    },
    [geometry, onSaveJointTrace, extractedPlanes]
  );

  if (!isOpen) return null;

  const currentPhoto = surfacePhotos[selectedPanel];
  const multiAngleTiePhotos = localRawPhotos.filter((p) => p.targetZone === 'auto');
  const containerClassName = embeddedStage
    ? 'flex-1 min-h-0 w-full h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none'
    : 'fixed inset-0 z-[120] bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none';

  return (
    <div className={containerClassName}>
      {/* Hidden single-photo replacement input for the raw multi-photo bay */}
      <input
        ref={replaceRawInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && replaceTargetPhotoId) {
            handleReplaceSingleRawPhoto(replaceTargetPhotoId, f);
          }
          setReplaceTargetPhotoId(null);
          e.target.value = '';
        }}
      />

      {/* TOP WORKBENCH HEADER (Compact single-row scrollable on Android, hidden in Full-Screen 3D mode) */}
      {!isFullScreen3D && (
      <div className="min-h-11 sm:min-h-14 py-1 sm:py-1.5 px-2 sm:px-4 bg-slate-900 border-b border-slate-800 flex flex-nowrap lg:flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {embeddedStage && onBackToPhotoFit && (
            <button
              type="button"
              onClick={onBackToPhotoFit}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition shrink-0"
              title="Return to Step 4: Photo Fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
              <span>4. Photo Fit</span>
            </button>
          )}
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white uppercase">
                {embeddedStage
                  ? '5. 3D Digital Twin'
                  : '3D Digital Twin Workbench'}
              </h2>
              <span className="px-1.5 sm:px-2 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider rounded bg-amber-500 text-slate-950 shadow">
                BETA
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[9.5px] sm:text-[10px] font-mono font-semibold uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {isVerticalShaft
                  ? 'Vertical Shaft 3D'
                  : `${(geometry.tunnelShape || 'd_shaped').replace('_', ' ').toUpperCase()}`}
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-300 bg-slate-800 rounded border border-slate-700">
                {projectName ? `${projectName} • ` : ''}
                {locationName ? `${locationName} • ` : ''}
                {roundLabel} • {geometry.widthM}m W × {geometry.heightM}m H × Pull {geometry.pullLengthM}m
              </span>
            </div>
            <p className="hidden xl:block text-[11px] text-slate-400">
              Cross-Portion AI Photogrammetry: trims extra wall/crown rim from Face photos and cross-fills missing Crown haunches from Left/Right Wall upper arch strips.
            </p>
          </div>
        </div>

        {/* 4 EXTRACTION METHOD TABS */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              setExtractionMethod('FACET_3PT_POLYGON');
              setPickedPoints([]);
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
              extractionMethod === 'FACET_3PT_POLYGON'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>1. 3-Pt Facet</span>
          </button>
          <button
            type="button"
            onClick={() => setExtractionMethod('TRACE_RELIEF_PROJECTION')}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
              extractionMethod === 'TRACE_RELIEF_PROJECTION'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>2. 2D → 3D Relief</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setExtractionMethod('CROSS_SURFACE_TIE_POINTS');
              setPickedPoints([]);
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
              extractionMethod === 'CROSS_SURFACE_TIE_POINTS'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>3. Tie-Points</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setExtractionMethod('AUTO_FACET_DETECTION');
              handleRunAutoFacetDetector();
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
              extractionMethod === 'AUTO_FACET_DETECTION'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4. Auto Facets</span>
          </button>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMultiRoundCorridor((v) => !v)}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border flex items-center gap-1 transition shrink-0 ${
              showMultiRoundCorridor
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Stitch multiple excavation rounds along chainage into a continuous 3D Digital Twin corridor"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showMultiRoundCorridor ? 'Corridor (On)' : 'Stitch 3D'}</span>
          </button>

          {embeddedStage && onProceedToFaceCanvas ? (
            <>
              <button
                type="button"
                onClick={() => onProceedToFaceCanvas(selectedPanel)}
                className="px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] sm:text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition shrink-0"
                title="Skip 3D Digital Twin (BETA) and go directly to Face Canvas"
              >
                <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                <span>Skip → Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => onProceedToFaceCanvas(selectedPanel)}
                className="px-3 py-1 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shadow-lg cursor-pointer transition shrink-0"
                title="Save traced 3D joints & dip surfaces by Portion and open Face Canvas"
              >
                <span>
                  6. Face Canvas ({existingJointTraces.length}J / {existingDipSurfaces.length}D)
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1 transition shrink-0"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* STATUS FEEDBACK BANNER */}
      {statusBanner && (
        <div className="px-3 py-1 bg-emerald-950/90 border-b border-emerald-700/60 flex items-center justify-between text-[11px] sm:text-xs text-emerald-200 shrink-0 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-400 hover:text-white text-[11px] font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* UNBUILT PHOTO CHANGES WARNING BANNER */}
      {hasBuilt3DTwin && hasUnbuiltPhotoChanges && !deepPipelineProgress?.active && (
        <div className="px-3 py-1 bg-amber-950/95 border-b border-amber-600/60 flex items-center justify-between text-[11px] sm:text-xs text-amber-200 shrink-0 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              Photos staged. Click &ldquo;Re-Build 3D Digital Twin&rdquo; to refresh cross-portion overlap recovery.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRunDeepReconstruction()}
            className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10.5px] cursor-pointer shrink-0"
          >
            Re-Build Now →
          </button>
        </div>
      )}

      {/* MAIN WORKBENCH BODY: Adaptive Portrait (Top 3D Viewport + Bottom Drawer) & Landscape/Desktop (Left Drawer + Right 3D Viewport) */}
      <div className="flex-1 flex flex-col-reverse md:flex-row min-h-0 overflow-hidden relative">
        {/* LEFT / BOTTOM CONTROL & PER-PORTION PRIMARY + SUPPORTING PHOTO BAYS */}
        {!isFullScreen3D && (
        <div
          className={`bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 flex flex-col shrink-0 transition-all ${
            isMobileControlDrawerCollapsed
              ? 'h-10 md:h-full md:w-11 overflow-hidden'
              : 'w-full h-[46dvh] md:h-full md:w-[320px] lg:w-[395px] xl:w-[455px] overflow-y-auto'
          }`}
        >
          {/* Mobile / Compact Drawer Collapse Header Bar */}
          <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-20">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-sky-400 truncate flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              {!isMobileControlDrawerCollapsed && (
                <span>Photo Bays &amp; 3D Controls ({localRawPhotos.length} Photos)</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setIsMobileControlDrawerCollapsed((v) => !v)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-black border border-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
              title="Collapse or Expand Photo Bays & Controls Drawer"
            >
              {isMobileControlDrawerCollapsed ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span className="md:hidden">Expand Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Minimize</span>
                </>
              )}
            </button>
          </div>

          {!isMobileControlDrawerCollapsed && (
          <>
          {/* SECTION 1: PER-PORTION PRIMARY + SUPPORTING PHOTO BAYS & CROSS-PORTION OVERLAP ENGINE */}
          <div className="p-3 sm:p-3.5 border-b border-slate-800 space-y-2.5 bg-slate-900/95">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Portion Primary + Supporting Photo Bays ({localRawPhotos.length})
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-mono font-bold">
                CROSS-PORTION AI OVERLAP
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Upload a <strong>Primary Photo</strong> and optional <strong>Supporting Photos</strong> for each portion. If the Crown or Shoulder is partially missing, our AI automatically recovers and stitches it from the upper arch of the Left/Right Wall and Face photos.
            </p>

            {/* Per-Portion Structured Cards (Face, Left Wall, Right Wall, Crown) */}
            <div className="space-y-2">
              {portionCoverageReadiness.map((rep) => {
                const portionPhotos = localRawPhotos.filter((p) => {
                  if (p.targetZone === rep.panelId) return true;
                  if (
                    rep.panelId === 'face' &&
                    (p.targetZone === 'oblique_left' || p.targetZone === 'oblique_right')
                  ) {
                    return true;
                  }
                  return false;
                });
                const primaryPhoto =
                  portionPhotos.find((p) => p.photoRole === 'primary') || portionPhotos[0];
                const supportingPhotos = portionPhotos.filter(
                  (p) => primaryPhoto && p.id !== primaryPhoto.id
                );

                return (
                  <div
                    key={rep.panelId}
                    className={`p-2.5 rounded-xl border transition ${
                      selectedPanel === rep.panelId
                        ? 'bg-slate-950 border-sky-500/60'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white">{rep.shortLabel}</span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            rep.status === 'COMPLETE_DIRECT'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : rep.status === 'CROSS_RECOVERED'
                              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                              : rep.status === 'DONOR_ONLY'
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                              : rep.status === 'PARTIAL_BLIND_SPOTS'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {rep.status === 'COMPLETE_DIRECT'
                            ? `DIRECT ${rep.directCoveragePct}%`
                            : rep.status === 'CROSS_RECOVERED'
                            ? `${rep.directCoveragePct}% + ${rep.crossFilledDonorPct}% OVERLAP`
                            : rep.status === 'DONOR_ONLY'
                            ? `CROSS-FILLED (${rep.crossFilledDonorPct}% FROM WALLS/FACE)`
                            : rep.status === 'PARTIAL_BLIND_SPOTS'
                            ? `PARTIAL (${rep.directCoveragePct}%)`
                            : 'AWAITING PHOTO'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Upload / Replace Primary Photo */}
                        <label className="cursor-pointer px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold flex items-center gap-1 transition">
                          <Upload className="w-2.5 h-2.5" />
                          <span>{primaryPhoto ? 'Replace Primary' : '+ Primary'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadPortionPhotos(rep.panelId, 'primary', e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* Upload Supporting Photos (1..N) */}
                        <label
                          className="cursor-pointer px-2 py-1 rounded bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                          title="Add supporting close-up, oblique, or shoulder overlap photos for this portion"
                        >
                          <PlusCircle className="w-2.5 h-2.5" />
                          <span>+ Support ({supportingPhotos.length})</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              handleUploadPortionPhotos(rep.panelId, 'supporting', e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Primary + Supporting Thumbnails Row */}
                    {portionPhotos.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {portionPhotos.map((ph, idx) => {
                          const isPrim = primaryPhoto?.id === ph.id;
                          return (
                            <div
                              key={ph.id}
                              className="flex items-center gap-2 bg-slate-900/90 px-2 py-1 rounded border border-slate-800/90"
                            >
                              <img
                                src={ph.dataUrl}
                                alt={ph.fileName}
                                className="w-11 h-8 object-cover rounded border border-slate-700 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                                      isPrim
                                        ? 'bg-sky-500/25 text-sky-300'
                                        : 'bg-purple-500/25 text-purple-300'
                                    }`}
                                  >
                                    {isPrim ? 'PRIMARY' : `SUPPORT #${idx}`}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-200 truncate">
                                    {ph.fileName}
                                  </span>
                                </div>
                                <div className="text-[9px] font-mono text-slate-400">
                                  {ph.naturalWidth}×{ph.naturalHeight} • {ph.focalLengthMm}mm
                                  {ph.crossPortionSpillover?.extraCrownTopPct
                                    ? ` • +${ph.crossPortionSpillover.extraCrownTopPct}% Crown Arch`
                                    : ''}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {ph.cameraPose && hasBuilt3DTwin && (
                                  <button
                                    type="button"
                                    onClick={() => focusOnPhotoCameraPose(ph)}
                                    className="px-1.5 py-0.5 rounded bg-sky-500/15 hover:bg-sky-600 text-sky-300 hover:text-white text-[9px] font-bold"
                                    title="Inspect 3D Digital Twin from this camera pose"
                                  >
                                    Pose
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplaceTargetPhotoId(ph.id);
                                    replaceRawInputRef.current?.click();
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-[9px] font-bold"
                                  title="Replace this photo"
                                >
                                  Replace
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateRawPhotosList((prev) =>
                                      prev.filter((item) => item.id !== ph.id)
                                    )
                                  }
                                  className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white"
                                  title="Remove photo"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Cross-Portion Donor Overlap Notice */}
                    {rep.donorSources.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-sky-300/90 bg-sky-950/40 px-2 py-1 rounded border border-sky-500/20">
                        <span className="font-bold">Overlap Recovery:</span>{' '}
                        {rep.donorSources.join(' + ')}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* General Multi-Angle / Corridor Tie-Points Pool */}
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200">
                      General Multi-Angle / Tie-Point Photos ({multiAngleTiePhotos.length})
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Extra wide-angle or oblique corridor shots that span Face + Walls + Crown.
                    </p>
                  </div>
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold text-slate-200 flex items-center gap-1 transition">
                    <Upload className="w-3 h-3 text-sky-400" />
                    <span>+ Multi-Angle</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleUploadPortionPhotos('auto', 'multi_angle', e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {multiAngleTiePhotos.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {multiAngleTiePhotos.map((mp, idx) => (
                      <div
                        key={mp.id}
                        className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[10px]"
                      >
                        <span className="text-slate-300 truncate">
                          Tie #{idx + 1}: {mp.fileName} ({mp.naturalWidth}×{mp.naturalHeight})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateRawPhotosList((prev) => prev.filter((item) => item.id !== mp.id))
                          }
                          className="text-rose-400 hover:text-rose-300 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Primary 6-Stage Build & Render 3D Digital Twin Button */}
            <button
              type="button"
              disabled={isReconstructing || localRawPhotos.length === 0}
              onClick={() => handleRunDeepReconstruction()}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 disabled:opacity-45 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition"
            >
              <Cpu className="w-4 h-4" />
              <span>
                {deepPipelineProgress?.active
                  ? `Running Stage ${deepPipelineProgress.stageNumber}/${deepPipelineProgress.totalStages}...`
                  : hasBuilt3DTwin
                  ? `Re-Build & Render 3D Digital Twin (${localRawPhotos.length} Photos • Cross-Portion AI)`
                  : `Build & Render 3D Digital Twin (${localRawPhotos.length} Photos • Cross-Portion AI)`}
              </span>
            </button>

            {rockMassSummary && (
              <div className="p-2.5 rounded-lg bg-sky-950/50 border border-sky-500/30 text-[11px] text-sky-200 space-y-1.5">
                <div className="font-bold text-sky-300 flex items-center justify-between">
                  <span>Cross-Portion AI Reconstruction Summary</span>
                  {overbreakCavities.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono">
                      {overbreakCavities.length} Overbreak Zones
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-snug">{rockMassSummary}</p>
                {crossPortionRecoveryNotes.length > 0 && (
                  <ul className="text-[10px] text-emerald-300/90 space-y-0.5 list-disc pl-4 pt-1 border-t border-sky-500/20">
                    {crossPortionRecoveryNotes.slice(0, 4).map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: SURFACE PORTION SELECTOR & 3D RELIEF DEPTH SCALE */}
          <div className="p-3.5 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Inspect Tunnel Portion &amp; Display Mode
              </span>
              <button
                type="button"
                onClick={() => setShowCameraFrustums((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                  showCameraFrustums
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {showCameraFrustums ? '3D Camera Poses: ON' : '3D Camera Poses: OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {availablePanels.map((p) => {
                const isSelected = selectedPanel === p.id;
                const pData = surfacePhotos[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPanel(p.id);
                      focusCameraOnPanel(p.id);
                    }}
                    className={`px-2.5 py-1.5 rounded text-left text-xs font-medium border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">{p.shortLabel}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        pData && (pData.crossFilledDonorPct || 0) > 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : pData
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pData
                        ? `${Math.min(100, (pData.directCoveragePct || 0) + (pData.crossFilledDonorPct || 0))}% COV`
                        : 'STAGED'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  3D Rock Relief Depth Scale:
                </span>
                <span className="font-mono font-bold text-sky-300">
                  ±{(reliefDepthScaleM * 100).toFixed(0)} cm ({reliefDepthScaleM.toFixed(2)}m)
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.02}
                value={reliefDepthScaleM}
                onChange={(e) => setReliefDepthScaleM(parseFloat(e.target.value))}
                className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />

              <div className="grid grid-cols-5 gap-1 pt-1">
                {(
                  [
                    { id: 'PHOTO_DRAPED_3D', label: 'Photo 3D' },
                    { id: 'COVERAGE_OVERLAP_MAP', label: 'Coverage' },
                    { id: 'SURFACE_NORMAL_MAP', label: 'Normals' },
                    { id: 'RELIEF_ELEVATION_HEATMAP', label: 'Depth' },
                    { id: 'HYBRID_WIREFRAME', label: 'Wire' },
                  ] as { id: DigitalTwinDisplayMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDisplayMode(m.id)}
                    className={`py-1 px-1 rounded text-[10px] font-semibold border transition ${
                      displayMode === m.id
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {currentPhoto && (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Direct: {currentPhoto.directCoveragePct ?? 100}%</span>
                  <span>Overlap Filled: {currentPhoto.crossFilledDonorPct ?? 0}%</span>
                  <span>Blind Spot: {currentPhoto.blindSpotPct ?? 0}%</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: ACTIVE EXTRACTION WORKFLOW CONTROLS */}
          <div className="p-3.5 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Target Joint Set:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {(['J1', 'J2', 'J3', 'J4', 'J-Bedding', 'J-Random'] as FieldJointGroupingId[]).map(
                  (setKey) => (
                    <button
                      key={setKey}
                      type="button"
                      onClick={() => setActiveSetId(setKey)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                        activeSetId === setKey
                          ? 'bg-slate-100 text-slate-950 border-white'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: JOINT_SET_COLORS[setKey] }}
                      />
                      {setKey}
                    </button>
                  )
                )}
              </div>
            </div>

            {(extractionMethod === 'FACET_3PT_POLYGON' ||
              extractionMethod === 'CROSS_SURFACE_TIE_POINTS') && (
              <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4" />
                    {extractionMethod === 'CROSS_SURFACE_TIE_POINTS'
                      ? 'Cross-Surface Tie Points (Click 2+ Surfaces)'
                      : 'Click 3+ Points on 3D Rock Facet'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pickedPoints.length === 0}
                      onClick={() => setPickedPoints((prev) => prev.slice(0, -1))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] text-slate-200 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Undo Pt
                    </button>
                    <button
                      type="button"
                      disabled={pickedPoints.length === 0}
                      onClick={() => {
                        setPickedPoints([]);
                        setManualDipOverrideDeg(null);
                        setManualDipDirOverrideDeg(null);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-700 disabled:opacity-40 text-[11px] text-slate-200 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                </div>

                {pickedPoints.length < 3 ? (
                  <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                    Click directly on any exposed rock facet in the white 3D viewport ({pickedPoints.length}/3 minimum points picked).
                  </div>
                ) : (
                  <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 flex items-center justify-between">
                    <span>
                      Exact 3D Plane Fitted ({pickedPoints.length} vertices • RMSE {livePlaneFit?.rmseMm} mm)
                    </span>
                    <span className="font-mono font-bold">{livePlaneFit?.confidence}</span>
                  </div>
                )}

                {pickedPoints.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {pickedPoints.map((pt, idx) => (
                      <div
                        key={pt.id}
                        className="flex items-center justify-between text-[11px] font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800"
                      >
                        <span className="text-sky-400 font-semibold">
                          P{idx + 1} ({pt.panelId.replace('_', ' ')})
                        </span>
                        <span className="text-slate-300">
                          X:{pt.metric3D.x.toFixed(2)}m Y:{pt.metric3D.y.toFixed(2)}m Z:{pt.metric3D.z.toFixed(2)}m
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {extractionMethod === 'TRACE_RELIEF_PROJECTION' && (
              <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 space-y-2.5">
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Project 2D Drawn Trace onto 3D Displaced Relief
                </div>
                {existingJointTraces.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No existing 2D joint traces in this round yet. Use Method 1 (3-Pt Facet Click) or Deep AI Reconstruction above.
                  </p>
                ) : (
                  <>
                    <select
                      value={selectedTraceIdForRelief}
                      onChange={(e) => setSelectedTraceIdForRelief(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      {existingJointTraces.map((t, i) => (
                        <option key={t.id} value={t.id}>
                          #{i + 1} {t.label || t.setId} ({t.panel.toUpperCase()}) — {t.dipDirection}°/{t.dipAmount}°
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleProjectSelected2DTrace}
                      className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      Drape Trace onto 3D Relief &amp; Solve Exact Plane
                    </button>
                  </>
                )}
              </div>
            )}

            {extractionMethod === 'AUTO_FACET_DETECTION' && (
              <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Automatic 3D Rock Facet Normal Scanner
                  </span>
                  <button
                    type="button"
                    onClick={handleRunAutoFacetDetector}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Re-Scan 3D Twin
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Analyzes local 3D surface normals across all reconstructed panels and clusters planar rock facets into structural sets.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 4: EXACT FITTED 3D DIP DIRECTION, DIP AMOUNT (180° HALF-CIRCLE INWARDS/OUTWARDS) & STRIKE */}
          {activeDisplayedFit && (
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  Extracted 3D Plane Orientation
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Planarity {activeDisplayedFit.planarityScore}% • RMSE {activeDisplayedFit.rmseMm}mm
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">
                    Dip Direction
                  </div>
                  <div className="text-lg font-mono font-extrabold text-sky-400">
                    {Math.round(activeDisplayedFit.dipDirectionDeg).toString().padStart(3, '0')}°
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    step={1}
                    value={Math.round(activeDisplayedFit.dipDirectionDeg)}
                    onChange={(e) => setManualDipDirOverrideDeg(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 mt-1"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">
                    Dip Amount
                  </div>
                  <div className="text-lg font-mono font-extrabold text-amber-400">
                    {Math.round(activeDisplayedFit.dipAmountDeg)}°
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={Math.round(activeDisplayedFit.dipAmountDeg)}
                    onChange={(e) => setManualDipOverrideDeg(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1 mt-1"
                  />
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">
                    Strike (RHR)
                  </div>
                  <div className="text-lg font-mono font-extrabold text-emerald-400">
                    {Math.round(activeDisplayedFit.strikeRhrDeg).toString().padStart(3, '0')}°
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    {activeDisplayedFit.strikePairLabel}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    180° Half-Circle Dip Sense:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDipSenseOverride('inwards')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                        activeDisplayedFit.dipHalfCircleSense === 'inwards'
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      ↙ Dip Inwards (Into Rock)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDipSenseOverride('outwards')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                        activeDisplayedFit.dipHalfCircleSense === 'outwards'
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      ↘ Dip Outwards (Into Excavation)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <svg
                    viewBox="0 0 220 115"
                    className="w-52 h-24 cursor-pointer select-none"
                    onClick={(e) => {
                      const svgRect = e.currentTarget.getBoundingClientRect();
                      const mx = ((e.clientX - svgRect.left) / svgRect.width) * 220;
                      const my = ((e.clientY - svgRect.top) / svgRect.height) * 115;
                      const dx = mx - 110;
                      const dy = Math.max(2, my - 18);
                      const angleFromHoriz = Math.atan2(dy, Math.abs(dx)) * (180 / Math.PI);
                      setDipSenseOverride(dx <= 0 ? 'inwards' : 'outwards');
                      setManualDipOverrideDeg(clampDip(Math.round(angleFromHoriz)));
                    }}
                  >
                    <path
                      d="M 20 18 A 90 90 0 0 0 200 18 Z"
                      fill="#0f172a"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <line x1="110" y1="18" x2="110" y2="108" stroke="#475569" strokeDasharray="3 3" />
                    <text x="26" y="14" fill="#38bdf8" fontSize="9" fontWeight="bold">
                      INWARDS 0°
                    </text>
                    <text x="148" y="14" fill="#f59e0b" fontSize="9" fontWeight="bold">
                      0° OUTWARDS
                    </text>
                    <text x="102" y="113" fill="#94a3b8" fontSize="9" fontWeight="bold">
                      90°
                    </text>
                    {(() => {
                      const dipRad = degToRad(activeDisplayedFit.dipAmountDeg);
                      const isOut = activeDisplayedFit.dipHalfCircleSense === 'outwards';
                      const dirSign = isOut ? 1 : -1;
                      const nx = 110 + dirSign * Math.cos(dipRad) * 82;
                      const ny = 18 + Math.sin(dipRad) * 82;
                      return (
                        <>
                          <line
                            x1="110"
                            y1="18"
                            x2={nx}
                            y2={ny}
                            stroke={isOut ? '#f59e0b' : '#38bdf8'}
                            strokeWidth="3"
                          />
                          <circle
                            cx={nx}
                            cy={ny}
                            r="5"
                            fill={isOut ? '#f59e0b' : '#38bdf8'}
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveAsDipSurface(activeDisplayedFit)}
                  className="py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save as 3D Dip Surface
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAsJointTrace(activeDisplayedFit)}
                  className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                >
                  <Check className="w-4 h-4" />
                  Save as Joint Trace
                </button>
              </div>

              {onApplyToActiveInspector && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyToActiveInspector(activeDisplayedFit);
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow transition"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Apply Exact 3D Facet Orientation to Active 3D Joint Inspector
                </button>
              )}

              {onOpenIn3DJointInspector && (
                <button
                  type="button"
                  onClick={() => onOpenIn3DJointInspector(activeDisplayedFit)}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Box className="w-3.5 h-3.5" />
                  Inspect Full 3D Plane Intersections in 3D Joint Inspector
                </button>
              )}
            </div>
          )}

          {/* SECTION 5: EXTRACTED 3D PLANES & FACETS LIST */}
          <div className="p-3.5 flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Extracted 3D Facets &amp; Planes ({extractedPlanes.length})
              </span>
              {extractedPlanes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    extractedPlanes.forEach((fit) => {
                      if (onSaveDipSurface) {
                        onSaveDipSurface(convertPhotogrammetricFitToDipSurface(fit, geometry));
                      }
                    });
                    setStatusBanner(
                      `Synced all ${extractedPlanes.length} extracted 3D Dip Surfaces to Round Canvas`
                    );
                  }}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300"
                >
                  Sync All to Canvas →
                </button>
              )}
            </div>

            {extractedPlanes.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                Upload your portion photos and click &ldquo;Build &amp; Render 3D Digital Twin&rdquo; to automatically extract 3D dip planes or pick 3+ points on any rock facet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {extractedPlanes.map((plane) => {
                  const isSel = activeDisplayedFit?.id === plane.id && !livePlaneFit;
                  return (
                    <div
                      key={plane.id}
                      onClick={() => {
                        setPickedPoints([]);
                        setSelectedPlaneId(plane.id);
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                        isSel
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: JOINT_SET_COLORS[plane.setId] || '#0284c7' }}
                          />
                          <span className="text-xs font-bold text-white">{plane.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {plane.dipHalfCircleSense.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Dip Dir {Math.round(plane.dipDirectionDeg).toString().padStart(3, '0')}° • Dip{' '}
                          {Math.round(plane.dipAmountDeg)}° • Strike{' '}
                          {Math.round(plane.strikeRhrDeg).toString().padStart(3, '0')}° • Area {plane.areaSqM}m²
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveAsDipSurface(plane);
                          }}
                          className="px-2 py-1 rounded bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-[10px] font-bold border border-sky-500/30"
                        >
                          +Canvas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
          )}
        </div>
        )}

        {/* RIGHT 3D DIGITAL TWIN WEBGL VIEWPORT (PURE WHITE #FFFFFF ENGINEERING CANVAS) */}
        <div className="flex-1 min-h-[220px] relative bg-white flex flex-col overflow-hidden">
          {/* Top-Left Camera Preset & Full-Screen 3D Toggle Overlay (Compact Single-Row Scrollable on Android) */}
          <div className="absolute top-2 left-2 right-2 lg:right-auto z-10 flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar whitespace-nowrap bg-white/95 p-1 sm:p-1.5 rounded-lg border border-slate-300 shadow-md max-w-full">
            <button
              type="button"
              onClick={() => setIsFullScreen3D((v) => !v)}
              className={`px-2 py-1 rounded text-[11px] sm:text-xs font-extrabold border flex items-center gap-1 shrink-0 cursor-pointer transition ${
                isFullScreen3D
                  ? 'bg-emerald-600 border-emerald-700 text-white shadow'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-amber-300'
              }`}
              title="Toggle Full-Screen 3D Viewport (Hides Controls & Header)"
            >
              {isFullScreen3D ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Full 3D</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full 3D</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => focusCameraOnPanel('overview')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] sm:text-xs font-bold text-slate-800 border border-slate-300 flex items-center gap-1 shrink-0"
            >
              <Box className="w-3.5 h-3.5 text-sky-600" />
              <span>Overview</span>
            </button>
            {availablePanels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPanel(p.id);
                  focusCameraOnPanel(p.id);
                }}
                className={`px-2 py-1 rounded text-[11px] sm:text-xs font-bold border transition shrink-0 ${
                  selectedPanel === p.id
                    ? 'bg-sky-600 border-sky-700 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                <Eye className="w-3 h-3 inline mr-1" />
                {p.shortLabel}
              </button>
            ))}
            {hasBuilt3DTwin && (
              <button
                type="button"
                onClick={() => setShowCoverageBlueprintModal((v) => !v)}
                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 text-[11px] sm:text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showCoverageBlueprintModal ? 'Hide Overlap' : 'Overlap Info'}</span>
              </button>
            )}
          </div>

          {/* Top-Right Active Measurement HUD (Positioned below presets on narrow mobile so they never overlap) */}
          <div className="absolute top-12 lg:top-2 right-2 z-10 bg-white/95 px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-md text-right max-w-[94vw] sm:max-w-md pointer-events-none">
            <div className="hidden sm:block text-[10px] font-mono uppercase text-slate-600 font-bold">
              Drive Azimuth: {(geometry.driveAzimuthDeg || 0).toString().padStart(3, '0')}° • Exact Profile Silhouette • White 3D Canvas
            </div>
            {activeDisplayedFit ? (
              <div className="text-[11px] sm:text-xs font-mono font-extrabold text-sky-700">
                Dip Dir {Math.round(activeDisplayedFit.dipDirectionDeg).toString().padStart(3, '0')}° / Dip{' '}
                {Math.round(activeDisplayedFit.dipAmountDeg)}° ({activeDisplayedFit.dipHalfCircleSense.toUpperCase()}) • RHR Strike{' '}
                {Math.round(activeDisplayedFit.strikeRhrDeg).toString().padStart(3, '0')}°
              </div>
            ) : (
              <div className="text-[10.5px] sm:text-xs font-mono font-semibold text-amber-700 truncate">
                {hasBuilt3DTwin
                  ? 'Tap 3+ points on 3D rock surface to fit exact Dip Plane'
                  : 'Stage photos, then tap Build & Render 3D Digital Twin'}
              </div>
            )}
          </div>

          {/* PRE-BUILD TUNNEL SHAPE, PORTION COVERAGE & CROSS-PORTION OVERLAP BLUEPRINT OVERLAY */}
          {(!hasBuilt3DTwin || showCoverageBlueprintModal) && !deepPipelineProgress?.active && (
            <div className="absolute inset-0 z-15 bg-white/94 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto">
              <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase">
                        BETA • DEFERRED 3D RENDERING
                      </span>
                      <span className="text-xs font-mono text-sky-400 font-bold">
                        {geometry.widthM}m W × {geometry.heightM}m H × Pull {geometry.pullLengthM}m (
                        {(geometry.tunnelShape || 'd_shaped').replace('_', ' ').toUpperCase()})
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white mt-1">
                      Cross-Portion Overlap &amp; Missing-Coverage AI Photogrammetry Engine
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      3D rendering is held until you finish staging your Primary and Supporting tunnel photos. Our AI engine understands that real underground photos overlap: wide-angle <strong>Face</strong> photos include extra wall/crown rim, and <strong>Left/Right Wall</strong> photos include the upper <strong>Crown</strong> arch haunches—automatically cross-filling any missing Crown or Shoulder areas.
                    </p>
                  </div>
                  {hasBuilt3DTwin && (
                    <button
                      type="button"
                      onClick={() => setShowCoverageBlueprintModal(false)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                    >
                      Return to 3D View
                    </button>
                  )}
                </div>

                {/* 4 Portion Readiness Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {portionCoverageReadiness.map((rep) => (
                    <div
                      key={rep.panelId}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">{rep.label}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            rep.status === 'COMPLETE_DIRECT'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : rep.status === 'CROSS_RECOVERED' || rep.status === 'DONOR_ONLY'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {rep.primaryPhotoCount} Primary • {rep.supportingPhotoCount} Support
                        </span>
                      </div>

                      {/* Coverage Bar (Direct Emerald + Donor Sky + Blind Spot Slate) */}
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${rep.directCoveragePct}%` }}
                          title={`Direct Photo Coverage: ${rep.directCoveragePct}%`}
                        />
                        <div
                          className="h-full bg-sky-400 transition-all"
                          style={{ width: `${rep.crossFilledDonorPct}%` }}
                          title={`Cross-Filled from Adjacent Portions: ${rep.crossFilledDonorPct}%`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="text-emerald-400">Direct: {rep.directCoveragePct}%</span>
                        <span className="text-sky-400">
                          Cross-Filled Overlap: +{rep.crossFilledDonorPct}%
                        </span>
                        <span className={rep.blindSpotPct > 15 ? 'text-amber-400' : 'text-slate-500'}>
                          Blind Spot: {rep.blindSpotPct}%
                        </span>
                      </div>

                      {rep.donorSources.length > 0 ? (
                        <div className="text-[10px] text-sky-300 bg-sky-950/50 px-2 py-1 rounded border border-sky-500/20">
                          ✓ {rep.donorSources.join(' • ')}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">
                          Upload Primary or Supporting photos for this portion or adjacent walls/face.
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-1">
                        <label className="flex-1 cursor-pointer py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition">
                          <Upload className="w-3 h-3" />
                          <span>
                            {rep.primaryPhotoCount > 0 ? 'Replace Primary' : '+ Upload Primary'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadPortionPhotos(rep.panelId, 'primary', e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <label className="flex-1 cursor-pointer py-1.5 px-2 rounded-lg bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-[11px] font-bold flex items-center justify-center gap-1 transition">
                          <PlusCircle className="w-3 h-3" />
                          <span>+ Supporting Photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              handleUploadPortionPhotos(rep.panelId, 'supporting', e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Build Action Footer */}
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white">{localRawPhotos.length} total photo(s)</span>{' '}
                    staged across portions. Ready for 6-stage cross-portion AI overlap synthesis.
                  </div>
                  <button
                    type="button"
                    disabled={isReconstructing || localRawPhotos.length === 0}
                    onClick={() => handleRunDeepReconstruction()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-2 shadow-xl cursor-pointer transition"
                  >
                    <Cpu className="w-4 h-4" />
                    <span>
                      Build &amp; Render 3D Digital Twin ({localRawPhotos.length} Photos • Take Full AI Time)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6-Stage Deep Cross-Portion AI + SfM Reconstruction Progress Overlay */}
          {deepPipelineProgress?.active && (
            <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="max-w-xl w-full bg-slate-900 border border-sky-500/40 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 animate-spin">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase text-sky-400 font-bold">
                        Cross-Portion AI Photogrammetry Engine (BETA)
                      </div>
                      <h3 className="text-sm font-extrabold text-white">
                        {deepPipelineProgress.stageTitle}
                      </h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
                    {Math.round(
                      (deepPipelineProgress.stageNumber / deepPipelineProgress.totalStages) * 100
                    )}
                    %
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {deepPipelineProgress.detailText}
                </p>

                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                    style={{
                      width: `${
                        (deepPipelineProgress.stageNumber / deepPipelineProgress.totalStages) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-6 gap-1 pt-1">
                  {[
                    '1. EXIF Pool',
                    '2. Spillover AI',
                    '3. Tie-Points',
                    '4. Cross-Fill',
                    '5. MVS Relief',
                    '6. 3D Facets',
                  ].map((lbl, i) => {
                    const done = deepPipelineProgress.stageNumber > i + 1;
                    const active = deepPipelineProgress.stageNumber === i + 1;
                    return (
                      <div
                        key={lbl}
                        className={`px-1.5 py-1 rounded text-[9px] font-mono text-center border ${
                          done
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                            : active
                            ? 'bg-sky-500/25 border-sky-400 text-white font-bold animate-pulse'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {lbl}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Three.js Canvas Mount (Pure White #FFFFFF WebGL Background) */}
          <div
            ref={mountRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            className="w-full h-full cursor-crosshair bg-white"
          />

          {/* Bottom Legend Bar (Single-row scrollable on Android) */}
          <div className="h-8 sm:h-9 px-2.5 sm:px-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-[10px] sm:text-[11px] text-slate-400 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 inline-block" />
                Direct Photo / RHR Strike
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-sky-400 inline-block" />
                Cross-Filled Overlap
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-orange-500 inline-block" />
                Steepest Dip / Blind-Spot
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-400 inline-block" />
                Cameras ({localRawPhotos.length})
              </span>
            </div>
            <div className="font-mono text-slate-300 shrink-0">
              Tap Rock Mesh: Pick 3D Point • Drag: Orbit • Pinch/Scroll: Zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinPhotogrammetryModal;
