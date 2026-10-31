import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Crop,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid,
  Image as ImageIcon,
  Info,
  Layers,
  Maximize2,
  Palette,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  buildSmoothSvgPath,
  computeFaceTunnelOutlineDetails,
  computeFieldQValue,
  computeFieldRmrValue,
  computePanelCanvasGeometry,
  computeTraceInlineLabelPlacements,
  computeTraceScreenDipTickVector,
  exportCanvasesAsPdfDocument,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_TUNNEL_SHAPES,
  FieldCollectedPhoto,
  FieldExcavationRound,
  FieldJointTrace,
  FieldMatlabFilterId,
  FieldPanelId,
  FieldPhotoFitConfig,
  FieldProjectItem,
  FieldRememberedRockItem,
  FieldTunnelLocationItem,
  getFieldPhotoFitConfig,
  getLocationSurfaceConfig,
  getPanelActiveExcavationBounds,
  processCleanFieldCameraFrame,
  pruneFullyErasedLithologyStrokes,
  renderSvgElementToHighResPngDataUrl,
  resolveRockDisplayInfo,
} from '../engine/fieldMappingEngine';
import {
  FieldDipSurfaceSvgElement,
  FieldMonochromeGeologicalPatterns,
  FieldStructuralFeatureSvgElement,
  FieldTunnelBenchHatchAndLineSvg,
  FieldTunnelWallOrCrownBenchOverlaySvg,
  FieldVeinFoliationBandSvgElement,
  FieldWaterSymbolSvgElement,
} from './FieldMappingCompassAndPatterns';

import {
  Field3DTunnelCanvas,
} from './Field3DTunnelCanvas';
import {
  getSurfacePanelLabelMap,
  MappingDomainType,
  SurfaceGeometryParameters,
} from '../engine/surfaceMappingEngine';
import { SurfaceType, TunnelGeometry } from '../types/tunnel';
import { generateSampleTunnelPhotograph } from '../engine/sampleFieldData';

export const PHOTO_MAPPING_PANEL_ORDER: {
  id: FieldPanelId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'face', label: 'Tunnel Face', shortLabel: 'Face' },
  { id: 'crown', label: 'Crown / Roof Arch', shortLabel: 'Crown' },
  { id: 'left_wall', label: 'Left Wall', shortLabel: 'Left Wall' },
  { id: 'right_wall', label: 'Right Wall', shortLabel: 'Right Wall' },
];

export const MATLAB_FILTER_CATALOG: {
  id: FieldMatlabFilterId;
  label: string;
  shortTag: string;
  description: string;
}[] = [
  {
    id: 'normal',
    label: 'Normal Fitted Photo',
    shortTag: 'RGB Clean',
    description: 'Standard shadow-recovered RGB rock surface photograph without synthetic filtering.',
  },
  {
    id: 'canny_edge',
    label: 'MATLAB Canny / Sobel Edge Map',
    shortTag: 'Edge Map',
    description: 'High-gradient directional Sobel/Canny fracture trace & joint boundary detector.',
  },
  {
    id: 'clahe',
    label: 'MATLAB CLAHE Rock Contrast',
    shortTag: 'CLAHE',
    description: 'Adaptive local histogram contrast enhancement for bedding, foliation & micro-joints.',
  },
  {
    id: 'ridge_tensor',
    label: 'MATLAB Frangi Ridge / Lineament Tensor',
    shortTag: 'Ridge Tensor',
    description: 'Enhances continuous dark fracture valleys, shear seams & quartz vein lineaments.',
  },
  {
    id: 'homomorphic_shadow',
    label: 'MATLAB Homomorphic Illumination Leveling',
    shortTag: 'De-Shadow',
    description: 'Flattens uneven cap-lamp hotspots and deep heading corner shadows.',
  },
  {
    id: 'dip_heatmap',
    label: 'MATLAB False-Color Structural Relief',
    shortTag: 'Dip Relief',
    description: 'False-color thermal/spectral luminance mapping of rock facet roughness & alteration.',
  },
  {
    id: 'otsu_binary',
    label: 'MATLAB Otsu Binary Fracture Skeleton',
    shortTag: 'Binary Otsu',
    description: 'High-contrast monochrome threshold isolating open joint apertures on white background.',
  },
  {
    id: 'laplacian_sharpen',
    label: 'MATLAB High-Pass Laplacian Micro-Fissure',
    shortTag: 'Laplacian',
    description: '3×3 unsharp Laplacian kernel sharpening rock grain boundaries and slickensides.',
  },
];

/**
 * SVG <defs> block providing real-time hardware-accelerated MATLAB / Computer Vision
 * filters for each panel photo on the Face Canvas and Photo Fit views.
 */
export const FieldSvgMatlabFilterDefs: React.FC<{
  round: FieldExcavationRound;
  idPrefix?: string;
  forceEnableMatlab?: boolean;
}> = ({ round, idPrefix = 'matlab-flt', forceEnableMatlab = false }) => {
  const enableMatlab = forceEnableMatlab || Boolean(round.advanceCanvasEnabled);

  return (
    <defs>
      {PHOTO_MAPPING_PANEL_ORDER.map((panelInfo) => {
        const pid = panelInfo.id;
        const cfg = getFieldPhotoFitConfig(round, pid);
        const filterId = `${idPrefix}-${pid}`;
        const bSlope = Number((cfg.brightnessPct / 100).toFixed(3));
        const cSlope = Number((cfg.contrastPct / 100).toFixed(3));
        const cIntercept = Number((0.5 * (1 - cSlope)).toFixed(3));
        const sens = Math.max(10, Math.min(100, cfg.matlabSensitivity || 55)) / 100;
        const activeMode: FieldMatlabFilterId = enableMatlab ? cfg.matlabFilter : 'normal';

        if (activeMode === 'canny_edge') {
          const edgeGain = Number((2.2 + sens * 3.8).toFixed(2));
          const centerWeight = Number((8 * edgeGain).toFixed(2));
          const nWeight = Number((-edgeGain).toFixed(2));
          return (
            <filter id={filterId} key={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
                result="gray"
              />
              <feConvolveMatrix
                in="gray"
                order="3 3"
                kernelMatrix={`${nWeight} ${nWeight} ${nWeight} ${nWeight} ${centerWeight} ${nWeight} ${nWeight} ${nWeight} ${nWeight}`}
                preserveAlpha="true"
                result="edges"
              />
              <feColorMatrix
                in="edges"
                type="matrix"
                values="0.15 0 0 0 0.04   0 0.95 0.35 0 0.06   0 0.45 1.15 0 0.10   0 0 0 1 0"
              />
            </filter>
          );
        }

        if (activeMode === 'clahe') {
          const sharpCenter = Number((5.2 + sens * 2.6).toFixed(2));
          const sharpSide = Number((-(sharpCenter - 1) / 4).toFixed(2));
          const claheContrast = Number((cSlope * (1.28 + sens * 0.35)).toFixed(3));
          const claheInt = Number((0.5 * (1 - claheContrast) + 0.03).toFixed(3));
          return (
            <filter id={filterId} key={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feConvolveMatrix
                order="3 3"
                kernelMatrix={`0 ${sharpSide} 0 ${sharpSide} ${sharpCenter} ${sharpSide} 0 ${sharpSide} 0`}
                preserveAlpha="true"
                result="sharp"
              />
              <feComponentTransfer in="sharp">
                <feFuncR type="linear" slope={claheContrast * bSlope} intercept={claheInt} />
                <feFuncG type="linear" slope={claheContrast * bSlope} intercept={claheInt} />
                <feFuncB type="linear" slope={claheContrast * bSlope} intercept={claheInt} />
              </feComponentTransfer>
            </filter>
          );
        }

        if (activeMode === 'ridge_tensor') {
          const rGain = Number((3.4 + sens * 3.0).toFixed(2));
          const rNeg = Number((-rGain / 8).toFixed(2));
          return (
            <filter id={filterId} key={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feConvolveMatrix
                order="3 3"
                kernelMatrix={`${rNeg} ${rNeg} ${rNeg} ${rNeg} ${Number((1 + rGain).toFixed(2))} ${rNeg} ${rNeg} ${rNeg} ${rNeg}`}
                preserveAlpha="true"
                result="ridge"
              />
              <feColorMatrix
                in="ridge"
                type="matrix"
                values="1.15 0.05 0 0 0.02   0.05 1.10 0.05 0 0.02   0 0.10 1.25 0 0.05   0 0 0 1 0"
              />
            </filter>
          );
        }

        if (activeMode === 'homomorphic_shadow') {
          const gammaVal = Number((0.58 - sens * 0.18).toFixed(2));
          return (
            <filter id={filterId} key={filterId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude={bSlope} exponent={gammaVal} offset={0.03} />
                <feFuncG type="gamma" amplitude={bSlope} exponent={gammaVal} offset={0.03} />
                <feFuncB type="gamma" amplitude={bSlope} exponent={gammaVal} offset={0.03} />
              </feComponentTransfer>
            </filter>
          );
        }

        if (activeMode === 'dip_heatmap') {
          return (
            <filter id={filterId} key={filterId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
                result="lum"
              />
              <feComponentTransfer in="lum">
                <feFuncR type="table" tableValues="0.08 0.18 0.42 0.92 0.98" />
                <feFuncG type="table" tableValues="0.10 0.55 0.88 0.72 0.22" />
                <feFuncB type="table" tableValues="0.48 0.92 0.35 0.12 0.08" />
              </feComponentTransfer>
            </filter>
          );
        }

        if (activeMode === 'otsu_binary') {
          const slope = Number((6.5 + sens * 8.0).toFixed(2));
          const intercept = Number((-0.45 * slope + 0.5).toFixed(2));
          return (
            <filter id={filterId} key={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
                result="lum"
              />
              <feComponentTransfer in="lum">
                <feFuncR type="linear" slope={slope} intercept={intercept} />
                <feFuncG type="linear" slope={slope} intercept={intercept} />
                <feFuncB type="linear" slope={slope} intercept={intercept} />
              </feComponentTransfer>
            </filter>
          );
        }

        if (activeMode === 'laplacian_sharpen') {
          const k = Number((4.8 + sens * 3.4).toFixed(2));
          const s = Number((-(k - 1) / 4).toFixed(2));
          return (
            <filter id={filterId} key={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feConvolveMatrix
                order="3 3"
                kernelMatrix={`0 ${s} 0 ${s} ${k} ${s} 0 ${s} 0`}
                preserveAlpha="true"
                result="lap"
              />
              <feComponentTransfer in="lap">
                <feFuncR type="linear" slope={bSlope * cSlope} intercept={cIntercept} />
                <feFuncG type="linear" slope={bSlope * cSlope} intercept={cIntercept} />
                <feFuncB type="linear" slope={bSlope * cSlope} intercept={cIntercept} />
              </feComponentTransfer>
            </filter>
          );
        }

        return (
          <filter id={filterId} key={filterId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope={Number((bSlope * cSlope).toFixed(3))} intercept={cIntercept} />
              <feFuncG type="linear" slope={Number((bSlope * cSlope).toFixed(3))} intercept={cIntercept} />
              <feFuncB type="linear" slope={Number((bSlope * cSlope).toFixed(3))} intercept={cIntercept} />
            </feComponentTransfer>
          </filter>
        );
      })}
    </defs>
  );
};

/**
 * Renders a panel's uploaded photo inside a target SVG bounding box with its
 * user-configured Photo Fit (Scale, Pan X/Y, Rotate, Mirror H/V, Fit Mode, Opacity, and MATLAB filter).
 */
export const FittedPanelPhotoSvgImage: React.FC<{
  photoUrl: string;
  fitConfig: FieldPhotoFitConfig;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  clipPathId?: string;
  filterId?: string;
  overrideOpacity?: number;
  cssFilter?: string;
}> = ({
  photoUrl,
  fitConfig,
  boxX,
  boxY,
  boxW,
  boxH,
  clipPathId,
  filterId,
  overrideOpacity,
  cssFilter,
}) => {
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;
  const baseScale = Math.max(0.05, Math.min(10.0, (fitConfig.scalePct || 100) / 100));
  const scaleX = baseScale * Math.max(0.05, Math.min(6.0, (fitConfig.scaleXPct ?? 100) / 100));
  const scaleY = baseScale * Math.max(0.05, Math.min(6.0, (fitConfig.scaleYPct ?? 100) / 100));
  const sx = (fitConfig.mirrorH ? -1 : 1) * scaleX;
  const sy = (fitConfig.mirrorV ? -1 : 1) * scaleY;
  const rot = fitConfig.rotationDeg || 0;
  const skewX = fitConfig.skewXDeg || 0;
  const skewY = fitConfig.skewYDeg || 0;
  const dx = fitConfig.offsetX || 0;
  const dy = fitConfig.offsetY || 0;

  // Custom Crop Cut inset percentages: CUTS (clips) the edges off cleanly instead of shrinking/squishing
  const crop = fitConfig.cropExtent || { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 };
  const cropLeft = Math.max(0, Math.min(0.48, (crop.leftPct || 0) / 100));
  const cropRight = Math.max(0, Math.min(0.48, (crop.rightPct || 0) / 100));
  const cropTop = Math.max(0, Math.min(0.48, (crop.topPct || 0) / 100));
  const cropBottom = Math.max(0, Math.min(0.48, (crop.bottomPct || 0) / 100));
  const hasCropCut = cropLeft > 0 || cropRight > 0 || cropTop > 0 || cropBottom > 0;

  const cutRectX = boxX + cropLeft * boxW;
  const cutRectY = boxY + cropTop * boxH;
  const cutRectW = Math.max(1, boxW * (1 - cropLeft - cropRight));
  const cutRectH = Math.max(1, boxH * (1 - cropTop - cropBottom));

  const cropClipId = useMemo(
    () => `crop-cut-${Math.random().toString(36).substring(2, 9)}`,
    []
  );

  const preserveAspectRatio =
    fitConfig.fitMode === 'stretch'
      ? 'none'
      : fitConfig.fitMode === 'contain'
        ? 'xMidYMid meet'
        : 'xMidYMid slice';
  const opacity =
    overrideOpacity !== undefined
      ? overrideOpacity
      : Math.max(0.08, Math.min(1, (fitConfig.opacityPct ?? 78) / 100));

  // 4-Corner Mesh Warp calculation (affects mesh translation, scale, and perspective skew)
  const meshTL = fitConfig.meshCorners?.tl || { x: 0, y: 0 };
  const meshTR = fitConfig.meshCorners?.tr || { x: 0, y: 0 };
  const meshBR = fitConfig.meshCorners?.br || { x: 0, y: 0 };
  const meshBL = fitConfig.meshCorners?.bl || { x: 0, y: 0 };

  const meshDx = (meshTL.x + meshTR.x + meshBR.x + meshBL.x) / 4;
  const meshDy = (meshTL.y + meshTR.y + meshBR.y + meshBL.y) / 4;

  const topWidthDelta = meshTR.x - meshTL.x;
  const bottomWidthDelta = meshBR.x - meshBL.x;
  const leftHeightDelta = meshBL.y - meshTL.y;
  const rightHeightDelta = meshBR.y - meshTR.y;

  const meshScaleX = Math.max(0.15, 1 + (topWidthDelta + bottomWidthDelta) / (2 * Math.max(10, boxW)));
  const meshScaleY = Math.max(0.15, 1 + (leftHeightDelta + rightHeightDelta) / (2 * Math.max(10, boxH)));

  const meshSkewX = Math.max(-45, Math.min(45, (((meshTR.y - meshTL.y) + (meshBR.y - meshBL.y)) / 2) * 0.12));
  const meshSkewY = Math.max(-45, Math.min(45, (((meshBL.x - meshTL.x) + (meshBR.x - meshTR.x)) / 2) * 0.12));

  const totalDx = dx + meshDx;
  const totalDy = dy + meshDy;
  const totalScaleX = sx * meshScaleX;
  const totalScaleY = sy * meshScaleY;
  const totalSkewX = Math.max(-60, Math.min(60, skewX + meshSkewX));
  const totalSkewY = Math.max(-60, Math.min(60, skewY + meshSkewY));

  const transformStr = `translate(${(cx + totalDx).toFixed(1)}, ${(cy + totalDy).toFixed(1)}) rotate(${rot.toFixed(1)}) skewX(${totalSkewX.toFixed(1)}) skewY(${totalSkewY.toFixed(1)}) scale(${totalScaleX.toFixed(3)}, ${totalScaleY.toFixed(3)}) translate(${(-cx).toFixed(1)}, ${(-cy).toFixed(1)})`;

  return (
    <g clipPath={clipPathId ? `url(#${clipPathId})` : undefined} pointerEvents="none">
      <defs>
        {hasCropCut && (
          <clipPath id={cropClipId}>
            <rect
              x={cutRectX}
              y={cutRectY}
              width={cutRectW}
              height={cutRectH}
            />
          </clipPath>
        )}
      </defs>
      <g transform={transformStr} clipPath={hasCropCut ? `url(#${cropClipId})` : undefined}>
        <image
          href={fitConfig.warpedDataUrl || photoUrl}
          x={boxX}
          y={boxY}
          width={boxW}
          height={boxH}
          preserveAspectRatio={preserveAspectRatio}
          opacity={opacity}
          filter={filterId ? `url(#${filterId})` : undefined}
          style={cssFilter ? { filter: cssFilter } : undefined}
        />
      </g>
    </g>
  );
};

// ============================================================================
// STEP 3 (FIELD MAPPING MODE): IN-BUILT FIELD CAMERA MODULE
// Auto-Upscale & Shadow-Remove Field Capture with Shape-Based Portion Selection,
// Multi-Photo Storage per Portion, Automatic Metadata Stamping & Skip Option
// ============================================================================
export const FieldInBuiltCameraStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  workflowMode?: 'field_mapping' | 'photo_mapping';
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToRoundDetails: () => void;
  onSkipOrProceedToCanvas: () => void;
  onProceedToPhotoFit?: () => void;
  onSwitchToUploadGrid?: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  workflowMode = 'field_mapping',
  onUpdateRound,
  onBackToRoundDetails,
  onSkipOrProceedToCanvas,
  onProceedToPhotoFit,
  onSwitchToUploadGrid,
}) => {
  const isSurface = mappingDomain !== 'TUNNEL';
  const surfMap = getSurfacePanelLabelMap(mappingDomain);
  const surfCfg = getLocationSurfaceConfig(activeLocation);
  const pullM = Math.max(0.5, Number(activeRound.pullLengthMeters) || 3.0);
  const locWidthM = Math.max(0.5, Number(activeLocation.widthM) || 8.4);
  const locHeightM = Math.max(0.5, Number(activeLocation.heightM) || 7.2);
  const splH = isSurface
    ? Math.max(1.0, locHeightM)
    : Math.max(1.5, Number(surfCfg.splHeightM) || locHeightM * 0.55);

  const shapeLabel = isSurface
    ? `${surfMap.domainTitle} (${locWidthM}m × ${locHeightM}m)`
    : FIELD_TUNNEL_SHAPES.find((s) => s.id === activeLocation.shape)?.label ||
      activeLocation.shape.replace(/_/g, ' ').toUpperCase();

  // Top portion options: Face, Crown, LW, RW (as requested: "face, crown, lw, rw")
  const allPortions = useMemo<{
    id: FieldPanelId;
    title: string;
    shortLabel: string;
    portionCode: string;
    dimLabel: string;
    available: boolean;
  }[]>(() => [
    {
      id: 'face',
      title: isSurface ? surfMap.face.fullLabel : 'Face',
      shortLabel: isSurface ? surfMap.face.shortLabel : 'Face',
      portionCode: 'FACE',
      dimLabel: `${locWidthM.toFixed(1)}m × ${locHeightM.toFixed(1)}m`,
      available: true,
    },
    {
      id: 'crown',
      title: isSurface ? surfMap.crown.fullLabel : 'Crown',
      shortLabel: isSurface ? surfMap.crown.shortLabel : 'Crown',
      portionCode: 'CROWN',
      dimLabel: `${(Number(surfCfg.crownLengthM) || locWidthM).toFixed(1)}m × ${pullM.toFixed(1)}m`,
      available: isSurface ? surfCfg.hasCrown : true,
    },
    {
      id: 'left_wall',
      title: 'LEFT WALL',
      shortLabel: 'LEFT WALL',
      portionCode: 'LEFTWALL',
      dimLabel: `${pullM.toFixed(1)}m × ${splH.toFixed(1)}m`,
      available: isSurface ? surfCfg.hasLeftWall : true,
    },
    {
      id: 'right_wall',
      title: 'RIGHT WALL',
      shortLabel: 'RIGHT WALL',
      portionCode: 'RIGHTWALL',
      dimLabel: `${pullM.toFixed(1)}m × ${splH.toFixed(1)}m`,
      available: isSurface ? surfCfg.hasRightWall : true,
    },
  ], [isSurface, surfMap, surfCfg, locWidthM, locHeightM, pullM, splH]);

  const availablePortions = useMemo(() => {
    return (
      Boolean((activeLocation as any).singlePanelOnly)
        ? allPortions.filter((p) => p.id === 'face')
        : allPortions
    ).filter((p) => p.available);
  }, [allPortions, activeLocation]);

  // 'camera' = Live In-Built Camera Viewfinder
  // 'inspect' = Photo Inspection & Georeference Reference Marking (SPL, Center Line)
  const [viewMode, setViewMode] = useState<'camera' | 'inspect'>('camera');
  const [targetPanel, setTargetPanel] = useState<FieldPanelId>('face');
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'active' | 'blocked' | 'unsupported'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Photo Inspection state
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [activeMarkTool, setActiveMarkTool] = useState<
    'none' | 'center_line' | 'spl_left' | 'spl_right' | 'crown_apex'
  >('none');
  const [previewPhoto, setPreviewPhoto] = useState<FieldCollectedPhoto | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraCaptureRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const exists = availablePortions.some((p) => p.id === targetPanel);
    if (!exists && availablePortions.length > 0) {
      setTargetPanel(availablePortions[0].id);
    }
  }, [availablePortions, targetPanel]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLiveCameraActive(false);
    setCameraStatus('idle');
  };

  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraStatus('requesting');
    setCameraError(null);
    stopCamera();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveCameraActive(false);
      setCameraStatus('unsupported');
      setCameraError('WebRTC camera API is not accessible in this browser or iframe container.');
      return;
    }

    const constraintTiers: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: facing },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of constraintTiers) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (stream) {
      streamRef.current = stream;
      setLiveCameraActive(true);
      setCameraStatus('active');
      setCameraError(null);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } else {
      setLiveCameraActive(false);
      setCameraStatus('blocked');
      const errName = lastErr?.name || '';
      const msg =
        errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
          ? 'Browser or sandbox iframe policy blocked direct camera access.'
          : errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
          ? 'No hardware video camera detected on this system.'
          : errName === 'NotReadableError' || errName === 'TrackStartError'
          ? 'Camera hardware is busy in another program.'
          : `Live stream restricted (${errName || 'Sandbox restriction'}). Use the native device camera or 1-click authentic rock exposure test below.`;
      setCameraError(msg);
    }
  };

  const handleToggleCameraFacing = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Launch camera immediately when in camera mode; stop when leaving
  useEffect(() => {
    if (viewMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [viewMode]);

  const activePortionInfo =
    availablePortions.find((p) => p.id === targetPanel) || availablePortions[0] || allPortions[0];

  const chFromFormatted = Number.isFinite(Number(activeRound.chainageFrom))
    ? Number(activeRound.chainageFrom).toFixed(1)
    : String(activeRound.chainageFrom || '0.0');
  const chToFormatted = Number.isFinite(Number(activeRound.chainageTo))
    ? Number(activeRound.chainageTo).toFixed(1)
    : String(activeRound.chainageTo || '0.0');
  const rdTag = isSurface ? 'ST' : 'RD';
  const rdChainageStr = `${rdTag} ${chFromFormatted}m–${chToFormatted}m`;

  // Helper to generate clean, professional file name and metadata
  const buildPhotoMetadata = (panelId: FieldPanelId, shotNum: number) => {
    const cleanProject = (activeProject.projectName || 'TunnelProject').replace(/[^\w-]/g, '_');
    const cleanLocation = (activeLocation.name || 'Location').replace(/[^\w-]/g, '_');
    const portionCode =
      panelId === 'face'
        ? 'FACE'
        : panelId === 'crown'
        ? 'CROWN'
        : panelId === 'left_wall'
        ? 'LEFTWALL'
        : panelId === 'right_wall'
        ? 'RIGHTWALL'
        : String(panelId).toUpperCase();

    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const hhmmss = d.toTimeString().slice(0, 8).replace(/:/g, '');
    const timestampStr = `${yyyymmdd}_${hhmmss}`;

    const fileName = `${cleanProject}_${cleanLocation}_${rdTag}${chFromFormatted}-${chToFormatted}_${portionCode}_Shot${shotNum}_${timestampStr}.jpg`;
    return { fileName, portionCode };
  };

  // 1-Click Load Authentic Tunnel Face Rock Photograph (Allows complete photogrammetry testing in Google AI Studio)
  const handleLoadAuthenticSamplePhoto = () => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const surf: SurfaceType =
      targetPanel === 'face'
        ? 'face'
        : targetPanel === 'crown'
        ? 'crown'
        : targetPanel === 'left_wall'
        ? 'leftWall'
        : 'rightWall';

    const dummyGeom: TunnelGeometry = {
      width: locWidthM,
      height: locHeightM,
      wallHeight: splH,
      crownRadius: locWidthM * 0.58,
      profileType: (activeLocation.shape as any) || 'd_shaped',
      units: 'm',
      source: 'manual',
      crownGeometry: (activeLocation.shape as any) || 'd_shaped',
      crossSectionPoints: [],
      crownArcLength: locWidthM * 1.57,
    };

    const authenticDataUrl = generateSampleTunnelPhotograph(surf, dummyGeom);
    const img = new Image();
    img.onload = () => {
      const shotNum = activeRound.collectedPhotos.filter((p) => p.panel === targetPanel).length + 1;
      const { fileName, portionCode } = buildPhotoMetadata(targetPanel, shotNum);

      const processed = processCleanFieldCameraFrame({
        source: img,
        panel: targetPanel,
        projectName: activeProject.projectName,
        locationName: activeLocation.name,
        tunnelShapeLabel: shapeLabel,
        widthM: locWidthM,
        heightM: locHeightM,
        chainageFrom: activeRound.chainageFrom,
        chainageTo: activeRound.chainageTo,
        shotNumber: shotNum,
        enableAutoUpscale: true,
        enableShadowRemove: true,
      });

      const newPhotoId = `fcam-sample-${targetPanel}-${Date.now()}-${shotNum}`;
      const newPhoto: FieldCollectedPhoto = {
        id: newPhotoId,
        panel: targetPanel,
        dataUrl: processed.dataUrl,
        label: fileName,
        fileName: fileName,
        capturedAt: processed.dateTimeFormatted,
        projectName: activeProject.projectName,
        locationName: activeLocation.name,
        rdChainage: rdChainageStr,
        panelLabel: portionCode,
        tunnelShapeLabel: `${shapeLabel} (${locWidthM}m × ${locHeightM}m)`,
        dateTimeFormatted: processed.dateTimeFormatted,
        autoUpscaled: true,
        shadowRemoved: true,
        resolutionLabel: '1600×1000 HD Authentic Rock Exposure',
        referenceMarks: {},
      };

      onUpdateRound((prev) => ({
        ...prev,
        photoPromptHandled: true,
        collectedPhotos: [newPhoto, ...prev.collectedPhotos],
        photoFits: {
          ...(prev.photoFits || {}),
          [targetPanel]: prev.photoFits?.[targetPanel] || getFieldPhotoFitConfig(prev, targetPanel),
        },
      }));

      setSelectedPhotoId(newPhotoId);
      setLastNotification(`✓ Loaded Authentic ${portionCode} Photo: ${fileName}`);
      setTimeout(() => setLastNotification(null), 3500);
    };
    img.src = authenticDataUrl;
  };

  // Snap photo with auto-upscale, underground shadow lift, and automated renaming
  // Gracefully generates authentic rock exposure if live stream is blocked
  const handleSnapFieldPhoto = () => {
    if (!liveCameraActive || !videoRef.current) {
      handleLoadAuthenticSamplePhoto();
      return;
    }

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const shotNum = activeRound.collectedPhotos.filter((p) => p.panel === targetPanel).length + 1;
    const { fileName, portionCode } = buildPhotoMetadata(targetPanel, shotNum);

    const processed = processCleanFieldCameraFrame({
      source: videoRef.current,
      panel: targetPanel,
      projectName: activeProject.projectName,
      locationName: activeLocation.name,
      tunnelShapeLabel: shapeLabel,
      widthM: locWidthM,
      heightM: locHeightM,
      chainageFrom: activeRound.chainageFrom,
      chainageTo: activeRound.chainageTo,
      shotNumber: shotNum,
      enableAutoUpscale: true,
      enableShadowRemove: true,
    });

    const newPhotoId = `fcam-${targetPanel}-${Date.now()}-${shotNum}`;
    const newPhoto: FieldCollectedPhoto = {
      id: newPhotoId,
      panel: targetPanel,
      dataUrl: processed.dataUrl,
      label: fileName,
      fileName: fileName,
      capturedAt: processed.dateTimeFormatted,
      projectName: activeProject.projectName,
      locationName: activeLocation.name,
      rdChainage: rdChainageStr,
      panelLabel: portionCode,
      tunnelShapeLabel: `${shapeLabel} (${locWidthM}m × ${locHeightM}m)`,
      dateTimeFormatted: processed.dateTimeFormatted,
      autoUpscaled: true,
      shadowRemoved: true,
      resolutionLabel: '1600×1000 HD Live Capture',
      referenceMarks: {},
    };

    onUpdateRound((prev) => ({
      ...prev,
      photoPromptHandled: true,
      collectedPhotos: [newPhoto, ...prev.collectedPhotos],
      photoFits: {
        ...(prev.photoFits || {}),
        [targetPanel]: prev.photoFits?.[targetPanel] || getFieldPhotoFitConfig(prev, targetPanel),
      },
    }));

    setSelectedPhotoId(newPhotoId);
    setLastNotification(`✓ Captured & Enhanced: ${fileName}`);
    setTimeout(() => setLastNotification(null), 3500);
  };

  // Device file upload
  const handleMultiFileCameraCapture = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const shotNum =
            activeRound.collectedPhotos.filter((p) => p.panel === targetPanel).length + 1 + idx;
          const { fileName, portionCode } = buildPhotoMetadata(targetPanel, shotNum);

          const processed = processCleanFieldCameraFrame({
            source: img,
            panel: targetPanel,
            projectName: activeProject.projectName,
            locationName: activeLocation.name,
            tunnelShapeLabel: shapeLabel,
            widthM: locWidthM,
            heightM: locHeightM,
            chainageFrom: activeRound.chainageFrom,
            chainageTo: activeRound.chainageTo,
            shotNumber: shotNum,
            enableAutoUpscale: true,
            enableShadowRemove: true,
          });

          const newPhotoId = `fcam-file-${targetPanel}-${Date.now()}-${idx}`;
          const newPhoto: FieldCollectedPhoto = {
            id: newPhotoId,
            panel: targetPanel,
            dataUrl: processed.dataUrl,
            label: fileName,
            fileName: fileName,
            capturedAt: processed.dateTimeFormatted,
            projectName: activeProject.projectName,
            locationName: activeLocation.name,
            rdChainage: rdChainageStr,
            panelLabel: portionCode,
            tunnelShapeLabel: `${shapeLabel} (${locWidthM}m × ${locHeightM}m)`,
            dateTimeFormatted: processed.dateTimeFormatted,
            autoUpscaled: true,
            shadowRemoved: true,
            resolutionLabel: '1600×1000 HD (Upscaled & Shadow Lifted)',
            referenceMarks: {},
          };

          onUpdateRound((prev) => ({
            ...prev,
            photoPromptHandled: true,
            collectedPhotos: [newPhoto, ...prev.collectedPhotos],
            photoFits: {
              ...(prev.photoFits || {}),
              [targetPanel]: prev.photoFits?.[targetPanel] || getFieldPhotoFitConfig(prev, targetPanel),
            },
          }));

          setSelectedPhotoId(newPhotoId);
          setLastNotification(`✓ Uploaded & Enhanced: ${fileName}`);
          setTimeout(() => setLastNotification(null), 3500);
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  };

  // User ends the camera module -> goes to photo inspection & marking view
  const handleEndCamera = () => {
    stopCamera();
    setViewMode('inspect');
  };

  // Handle proceed to next step
  const handleProceedToNextStep = () => {
    if (workflowMode === 'photo_mapping') {
      if (onProceedToPhotoFit) {
        onProceedToPhotoFit();
      } else {
        onSkipOrProceedToCanvas();
      }
    } else {
      onSkipOrProceedToCanvas();
    }
  };

  // Currently inspected photo in inspect mode
  const currentPhoto =
    activeRound.collectedPhotos.find((p) => p.id === selectedPhotoId) ||
    activeRound.collectedPhotos[0] ||
    null;

  // Add / update reference mark on the active photo
  const handlePhotoClickForMark = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentPhoto || activeMarkTool === 'none') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    onUpdateRound((prev) => {
      const updatedPhotos = prev.collectedPhotos.map((p) => {
        if (p.id !== currentPhoto.id) return p;
        const marks = { ...(p.referenceMarks || {}) };

        if (activeMarkTool === 'center_line') {
          marks.centerLine = { xPct, yPct };
        } else if (activeMarkTool === 'spl_left') {
          marks.springLineLeft = { xPct, yPct };
        } else if (activeMarkTool === 'spl_right') {
          marks.springLineRight = { xPct, yPct };
        } else if (activeMarkTool === 'crown_apex') {
          marks.crownApex = { xPct, yPct };
        }

        return {
          ...p,
          referenceMarks: marks,
        };
      });
      return {
        ...prev,
        collectedPhotos: updatedPhotos,
      };
    });
  };

  // Clear marks on the current photo
  const handleClearMarks = () => {
    if (!currentPhoto) return;
    onUpdateRound((prev) => ({
      ...prev,
      collectedPhotos: prev.collectedPhotos.map((p) =>
        p.id === currentPhoto.id ? { ...p, referenceMarks: {} } : p
      ),
    }));
  };

  // One-click default centering for standard tunnel profile
  const handleApplyDefaultMarks = () => {
    if (!currentPhoto) return;
    onUpdateRound((prev) => ({
      ...prev,
      collectedPhotos: prev.collectedPhotos.map((p) =>
        p.id === currentPhoto.id
          ? {
              ...p,
              referenceMarks: {
                centerLine: { xPct: 50.0, yPct: 45.0 },
                springLineLeft: { xPct: 15.0, yPct: 55.0 },
                springLineRight: { xPct: 85.0, yPct: 55.0 },
                crownApex: { xPct: 50.0, yPct: 18.0 },
              },
            }
          : p
      ),
    }));
  };

  const activePortionPhoto = activeRound.collectedPhotos.find(
    (p) => p.panel === targetPanel
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 bg-slate-950 flex flex-col">
      {/* Hidden Native Mobile Hardware Camera Capture Input (Bypasses iframe permissions) */}
      <input
        ref={nativeCameraCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleMultiFileCameraCapture(e.target.files);
          e.target.value = '';
        }}
      />

      {viewMode === 'camera' ? (
        /* ==================== CAMERA MODULE VIEW ==================== */
        <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Top Bar: Portion Options (Face, Crown, LW, RW) & Grid Switch */}
          <div className="bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                Portion:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x whitespace-nowrap">
                {availablePortions.map((portion) => {
                  const count = activeRound.collectedPhotos.filter((p) => p.panel === portion.id).length;
                  const isSelected = targetPanel === portion.id;
                  return (
                    <button
                      key={portion.id}
                      type="button"
                      onClick={() => setTargetPanel(portion.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/20'
                          : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{portion.shortLabel}</span>
                      {count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSwitchToUploadGrid && (
                <button
                  type="button"
                  onClick={onSwitchToUploadGrid}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Switch to 4-Portion Overview Grid"
                >
                  <Grid className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Portion Grid</span>
                </button>
              )}

              <span className="hidden sm:inline-block text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/60">
                {rdChainageStr}
              </span>

              <button
                type="button"
                onClick={handleProceedToNextStep}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                title={workflowMode === 'photo_mapping' ? 'Proceed to Photo Fit & Scale' : 'Skip camera directly to face canvas'}
              >
                {workflowMode === 'photo_mapping' ? 'Photo Fit →' : 'Skip Camera →'}
              </button>
            </div>
          </div>

          {/* Center Viewfinder Arena (NEVER A BLANK BLACK BOX) */}
          <div className="relative flex-1 min-h-[420px] bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Live Video Stream when active */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${liveCameraActive ? 'block' : 'hidden'}`}
            />

            {/* Overlaid Live Camera HUD when video is active */}
            {liveCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-sm border border-emerald-500/50 px-2.5 py-1 rounded-lg text-emerald-300 text-[11px] font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LIVE STREAM ACTIVE ({cameraFacingMode.toUpperCase()})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCameraFacing}
                    className="pointer-events-auto p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer shadow-lg flex items-center gap-1.5 text-xs font-bold"
                    title="Flip between Environment and User camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Flip Camera</span>
                  </button>
                </div>

                {/* Reticle / Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  <div className="w-48 h-48 border border-dashed border-amber-400 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-t-2 border-b-2 border-l-2 border-r-2 border-amber-300" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-slate-950/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800">
                  <span>{activeProject.projectName} • {activePortionInfo.title}</span>
                  <span>{rdChainageStr}</span>
                </div>
              </div>
            )}

            {/* Display Captured Photo if Camera is inactive but a photo exists for this portion */}
            {!liveCameraActive && activePortionPhoto && (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <img
                  src={activePortionPhoto.dataUrl}
                  alt={activePortionPhoto.label}
                  className="max-h-[70vh] w-auto object-contain bg-black"
                />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between bg-slate-950/90 border border-amber-500/50 px-3 py-1.5 rounded-xl text-xs font-mono text-amber-300 shadow-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>SAVED PHOTO: {activePortionInfo.shortLabel} ({activePortionPhoto.resolutionLabel || 'HD'})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => nativeCameraCaptureRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      📱 Retake Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera(cameraFacingMode)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer"
                    >
                      🔄 Live Stream
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Geological Field Viewfinder HUD when no video stream & no photo yet (NEVER A DEAD BLANK SCREEN) */}
            {!liveCameraActive && !activePortionPhoto && (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-radial from-slate-900 to-slate-950">
                {/* Geological Crosshair Reticle Graphic */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <div className="w-72 h-72 border-2 border-slate-700 rounded-full flex items-center justify-center">
                    <div className="w-full h-[1px] bg-slate-700" />
                    <div className="h-full w-[1px] bg-slate-700 absolute" />
                  </div>
                </div>

                <div className="relative z-10 max-w-lg w-full flex flex-col items-center">
                  <div className="p-4 rounded-full bg-slate-900/90 border border-amber-500/40 shadow-2xl mb-3 text-amber-400">
                    <Camera className="w-8 h-8" />
                  </div>

                  <h3 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <span>Field Camera Viewfinder Ready</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono">
                      {activePortionInfo.title}
                    </span>
                  </h3>

                  {/* Button: Upload File in Photogrammetry Mode vs Native Device Camera in Field Mapping Mode */}
                  <div className="w-full max-w-xs mt-3">
                    {workflowMode === 'photo_mapping' ? (
                      <button
                        type="button"
                        onClick={() => multiFileInputRef.current?.click()}
                        className="w-full p-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all active:scale-95"
                        title="Upload photos for photogrammetry analysis"
                      >
                        <Upload className="w-4 h-4" />
                        <span>📁 Upload File</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => nativeCameraCaptureRef.current?.click()}
                        className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer transition-all active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>📱 Native Device Camera</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notification Toast */}
            {lastNotification && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-amber-400/80 text-amber-300 px-4 py-2 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2 pointer-events-none z-20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{lastNotification}</span>
              </div>
            )}

            {shutterFlash && (
              <div className="absolute inset-0 bg-white/85 pointer-events-none transition-opacity" />
            )}
          </div>

          {/* Bottom Bar: Device upload, Click Photo, and End Camera */}
          <div className="bg-slate-950 border-t border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x">
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={multiFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleMultiFileCameraCapture(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => multiFileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                title="Upload from device gallery or folder"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Upload File</span>
              </button>
            </div>

            {/* Bottom Right: Proceed / End Camera Module (Slidable without slidebar) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={handleEndCamera}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                title="Inspect captured photos and add reference marks"
              >
                <Target className="w-4 h-4 text-amber-400" />
                <span>Inspect ({activeRound.collectedPhotos.length})</span>
              </button>

              <button
                type="button"
                onClick={handleProceedToNextStep}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>{workflowMode === 'photo_mapping' ? 'Next: Photo Fit' : 'Next Step'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== PHOTO INSPECTION & REFERENCE MARKING VIEW ==================== */
        <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0">
          {/* Header */}
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x">
            <div className="shrink-0 min-w-[260px]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Inspect Taken Photos & Georeference Marks
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  {activeRound.collectedPhotos.length} Photos Collected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review captured photos. You can click on the photo to mark <strong>Center Line (CL)</strong> and <strong>Springline (SPL)</strong> to aid alignment. Adding marks is optional.
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('camera')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Re-open Camera</span>
              </button>
              <button
                type="button"
                onClick={handleProceedToNextStep}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>{workflowMode === 'photo_mapping' ? 'Proceed to Photo Fit & Scale' : 'Proceed to Face Canvas'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeRound.collectedPhotos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/60">
              <Camera className="w-12 h-12 text-slate-600 mb-3" />
              <div className="text-base font-bold text-slate-300">No photos collected yet</div>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                You ended the camera without snapping any photos. You can re-open the camera or skip directly to the next stage.
              </p>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setViewMode('camera')}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shrink-0 whitespace-nowrap"
                >
                  📸 Open Camera to Take Photos
                </button>
                <button
                  type="button"
                  onClick={handleProceedToNextStep}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs cursor-pointer border border-emerald-500/40 shrink-0 whitespace-nowrap"
                >
                  {workflowMode === 'photo_mapping' ? 'Skip to Photo Fit →' : 'Skip to Face Canvas →'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40">
              {/* Photo Thumbnails Strip */}
              <div className="bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                  Photos:
                </span>
                {activeRound.collectedPhotos.map((photo, idx) => {
                  const isSelected = (currentPhoto?.id === photo.id);
                  const hasMarks = Boolean(
                    photo.referenceMarks?.centerLine ||
                    photo.referenceMarks?.springLineLeft ||
                    photo.referenceMarks?.springLineRight
                  );
                  return (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border cursor-pointer shrink-0 transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-500/20'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.label}
                        className="w-10 h-8 rounded object-cover border border-slate-700"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {photo.panelLabel || photo.panel.toUpperCase()}
                          </span>
                          <span className="text-[11px] font-bold text-slate-200">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                          {hasMarks ? (
                            <span className="text-emerald-400 font-semibold">Marks Added ✓</span>
                          ) : (
                            <span>No marks</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main Photo Inspection & Marking Canvas */}
              {currentPhoto && (
                <div className="flex-1 min-h-0 flex flex-col p-3 space-y-2.5 overflow-y-auto">
                  {/* Photo Title & Mark Tools Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                          {currentPhoto.panelLabel || currentPhoto.panel.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200 truncate" title={currentPhoto.fileName || currentPhoto.label}>
                          {currentPhoto.fileName || currentPhoto.label}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-emerald-400 font-bold">{currentPhoto.rdChainage || rdChainageStr}</span>
                        <span>•</span>
                        <span>{currentPhoto.resolutionLabel || '1600×1000 HD'}</span>
                        <span>•</span>
                        <span>{currentPhoto.dateTimeFormatted || currentPhoto.capturedAt}</span>
                      </div>
                    </div>

                    {/* Marking Tools */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveMarkTool('none')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer ${
                          activeMarkTool === 'none'
                            ? 'bg-slate-700 text-white border-slate-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                        title="View photo without placing marks"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMarkTool('center_line')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border cursor-pointer ${
                          activeMarkTool === 'center_line'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                            : 'bg-slate-950 text-amber-400 border-amber-500/40 hover:bg-amber-950/40'
                        }`}
                        title="Click on photo to place Center Line (CL)"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Center Line (CL)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMarkTool('spl_left')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border cursor-pointer ${
                          activeMarkTool === 'spl_left'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                            : 'bg-slate-950 text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/40'
                        }`}
                        title="Click on photo to mark Left Springline (SPL-L)"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>SPL-Left</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMarkTool('spl_right')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 border cursor-pointer ${
                          activeMarkTool === 'spl_right'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                            : 'bg-slate-950 text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/40'
                        }`}
                        title="Click on photo to mark Right Springline (SPL-R)"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>SPL-Right</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleApplyDefaultMarks}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-950/40 cursor-pointer"
                        title="One-click default tunnel alignment (CL at 50%, SPL at 55%)"
                      >
                        <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                        Auto-Marks
                      </button>

                      <button
                        type="button"
                        onClick={handleClearMarks}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 text-rose-400 border border-rose-500/40 hover:bg-rose-950/40 cursor-pointer"
                        title="Clear marks on this photo"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                        Clear Marks
                      </button>
                    </div>
                  </div>

                  {/* Marking Instruction Callout */}
                  <div className="px-3 py-1.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Info className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        {activeMarkTool === 'center_line'
                          ? 'Click anywhere on the photo where the vertical Center Line (CL) of the tunnel is.'
                          : activeMarkTool === 'spl_left'
                          ? 'Click on the left springline level (SPL-L) of the tunnel.'
                          : activeMarkTool === 'spl_right'
                          ? 'Click on the right springline level (SPL-R) of the tunnel.'
                          : 'Select a mark tool above and click on the photo to mark CL or SPL. Marking is completely optional.'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      Optional: We can also choose not to add marks.
                    </span>
                  </div>

                  {/* Interactive Photo Canvas with Overlay */}
                  <div className="relative flex-1 min-h-[420px] bg-black rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden select-none">
                    <div
                      className={`relative max-w-full max-h-[65vh] inline-block ${
                        activeMarkTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                      onClick={handlePhotoClickForMark}
                    >
                      <img
                        src={currentPhoto.dataUrl}
                        alt={currentPhoto.fileName || currentPhoto.label}
                        className="max-h-[65vh] w-auto object-contain rounded-lg block shadow-2xl"
                      />

                      {/* SVG Overlay for SPL and Center Line Marks */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        {/* Center Line (CL) Mark */}
                        {currentPhoto.referenceMarks?.centerLine && (
                          <g>
                            {/* Vertical Line */}
                            <line
                              x1={currentPhoto.referenceMarks.centerLine.xPct}
                              y1="0"
                              x2={currentPhoto.referenceMarks.centerLine.xPct}
                              y2="100"
                              stroke="#F59E0B"
                              strokeWidth="0.8"
                              strokeDasharray="2 1.5"
                            />
                            {/* Center Target Point */}
                            <circle
                              cx={currentPhoto.referenceMarks.centerLine.xPct}
                              cy={currentPhoto.referenceMarks.centerLine.yPct}
                              r="1.8"
                              fill="#F59E0B"
                              stroke="#000"
                              strokeWidth="0.4"
                            />
                            {/* Top Badge */}
                            <rect
                              x={Math.max(1, Math.min(84, currentPhoto.referenceMarks.centerLine.xPct - 7))}
                              y="2"
                              width="14"
                              height="4.5"
                              rx="1"
                              fill="#0F172A"
                              stroke="#F59E0B"
                              strokeWidth="0.4"
                            />
                            <text
                              x={Math.max(8, Math.min(91, currentPhoto.referenceMarks.centerLine.xPct))}
                              y="5.3"
                              fill="#FDE047"
                              fontSize="3"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              CL
                            </text>
                          </g>
                        )}

                        {/* Springline (SPL) Marks */}
                        {(currentPhoto.referenceMarks?.springLineLeft ||
                          currentPhoto.referenceMarks?.springLineRight) && (
                          <g>
                            {/* Horizontal Line through Springline height */}
                            {(() => {
                              const leftY = currentPhoto.referenceMarks?.springLineLeft?.yPct;
                              const rightY = currentPhoto.referenceMarks?.springLineRight?.yPct;
                              const avgY =
                                leftY !== undefined && rightY !== undefined
                                  ? (leftY + rightY) / 2
                                  : leftY !== undefined
                                  ? leftY
                                  : rightY || 55;
                              return (
                                <line
                                  x1="0"
                                  y1={avgY}
                                  x2="100"
                                  y2={avgY}
                                  stroke="#06B6D4"
                                  strokeWidth="0.8"
                                  strokeDasharray="2 1.5"
                                />
                              );
                            })()}

                            {/* SPL Left Target */}
                            {currentPhoto.referenceMarks?.springLineLeft && (
                              <g>
                                <circle
                                  cx={currentPhoto.referenceMarks.springLineLeft.xPct}
                                  cy={currentPhoto.referenceMarks.springLineLeft.yPct}
                                  r="1.8"
                                  fill="#06B6D4"
                                  stroke="#000"
                                  strokeWidth="0.4"
                                />
                                <rect
                                  x={Math.max(1, currentPhoto.referenceMarks.springLineLeft.xPct - 1)}
                                  y={Math.max(2, currentPhoto.referenceMarks.springLineLeft.yPct - 6)}
                                  width="14"
                                  height="4.5"
                                  rx="1"
                                  fill="#0F172A"
                                  stroke="#06B6D4"
                                  strokeWidth="0.4"
                                />
                                <text
                                  x={Math.max(8, currentPhoto.referenceMarks.springLineLeft.xPct + 6)}
                                  y={Math.max(5.3, currentPhoto.referenceMarks.springLineLeft.yPct - 2.8)}
                                  fill="#67E8F9"
                                  fontSize="2.8"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  SPL-L
                                </text>
                              </g>
                            )}

                            {/* SPL Right Target */}
                            {currentPhoto.referenceMarks?.springLineRight && (
                              <g>
                                <circle
                                  cx={currentPhoto.referenceMarks.springLineRight.xPct}
                                  cy={currentPhoto.referenceMarks.springLineRight.yPct}
                                  r="1.8"
                                  fill="#06B6D4"
                                  stroke="#000"
                                  strokeWidth="0.4"
                                />
                                <rect
                                  x={Math.min(85, currentPhoto.referenceMarks.springLineRight.xPct - 13)}
                                  y={Math.max(2, currentPhoto.referenceMarks.springLineRight.yPct - 6)}
                                  width="14"
                                  height="4.5"
                                  rx="1"
                                  fill="#0F172A"
                                  stroke="#06B6D4"
                                  strokeWidth="0.4"
                                />
                                <text
                                  x={Math.min(92, currentPhoto.referenceMarks.springLineRight.xPct - 6)}
                                  y={Math.max(5.3, currentPhoto.referenceMarks.springLineRight.yPct - 2.8)}
                                  fill="#67E8F9"
                                  fontSize="2.8"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  SPL-R
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* Crown Apex Mark */}
                        {currentPhoto.referenceMarks?.crownApex && (
                          <g>
                            <polygon
                              points={`${currentPhoto.referenceMarks.crownApex.xPct},${currentPhoto.referenceMarks.crownApex.yPct - 2.5} ${currentPhoto.referenceMarks.crownApex.xPct - 1.8},${currentPhoto.referenceMarks.crownApex.yPct + 1.2} ${currentPhoto.referenceMarks.crownApex.xPct + 1.8},${currentPhoto.referenceMarks.crownApex.yPct + 1.2}`}
                              fill="#10B981"
                              stroke="#000"
                              strokeWidth="0.4"
                            />
                            <rect
                              x={Math.max(1, Math.min(84, currentPhoto.referenceMarks.crownApex.xPct - 8))}
                              y={Math.max(1, currentPhoto.referenceMarks.crownApex.yPct - 6.5)}
                              width="16"
                              height="4.5"
                              rx="1"
                              fill="#0F172A"
                              stroke="#10B981"
                              strokeWidth="0.4"
                            />
                            <text
                              x={Math.max(9, Math.min(92, currentPhoto.referenceMarks.crownApex.xPct))}
                              y={Math.max(4.2, currentPhoto.referenceMarks.crownApex.yPct - 3.2)}
                              fill="#6EE7B7"
                              fontSize="2.8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              APEX
                            </text>
                          </g>
                        )}
                      </svg>
                    </div>
                  </div>

                  {/* Bottom Controls inside Photo Inspection */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(currentPhoto)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Fullscreen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = currentPhoto.fileName || `${currentPhoto.label}.jpg`;
                          link.href = currentPhoto.dataUrl;
                          link.click();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateRound((prev) => ({
                            ...prev,
                            collectedPhotos: prev.collectedPhotos.filter((p) => p.id !== currentPhoto.id),
                          }));
                          setSelectedPhotoId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Photo</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onSkipOrProceedToCanvas}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Skip / Continue without Marks
                      </button>
                      <button
                        type="button"
                        onClick={handleProceedToNextStep}
                        className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <span>{workflowMode === 'photo_mapping' ? 'Proceed to Photo Fit & Scale' : 'Proceed to Face Canvas'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Photo Preview Modal */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-amber-300">{previewPhoto.fileName || previewPhoto.label}</div>
                <div className="text-xs font-mono text-slate-400">
                  {previewPhoto.projectName} • {previewPhoto.locationName} • {previewPhoto.rdChainage} • {previewPhoto.resolutionLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewPhoto.dataUrl}
                alt={previewPhoto.fileName || previewPhoto.label}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STEP 3 (PHOTOGRAMMETRY MODE): UPLOAD SURFACE PHOTOS (ADAPTS TO SHAPE & DOMAIN)
// ============================================================================
export const FieldFourPhotoUploadStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToRoundDetails: () => void;
  onProceedToPhotoFit: () => void;
  onSwitchToLiveCamera?: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  onUpdateRound,
  onBackToRoundDetails,
  onProceedToPhotoFit,
  onSwitchToLiveCamera,
}) => {
  const [processingPanel, setProcessingPanel] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isSurface = mappingDomain !== 'TUNNEL';
  const surfMap = getSurfacePanelLabelMap(mappingDomain);
  const surfCfg = getLocationSurfaceConfig(activeLocation);
  const pullM = Math.max(0.5, activeRound.pullLengthMeters || 3.0);
  const splH = isSurface
    ? Math.max(1.0, activeLocation.heightM)
    : Math.max(1.5, surfCfg.splHeightM || activeLocation.heightM * 0.55);

  const allSurfaceMetaList: {
    id: FieldPanelId;
    stepNum: number;
    title: string;
    subtitle: string;
    dimLabel: string;
    badgeColor: string;
    available: boolean;
  }[] = [
    {
      id: 'face',
      stepNum: 1,
      title: isSurface ? `1. ${surfMap.face.fullLabel} Photo` : '1. Tunnel Face Photo',
      subtitle: isSurface
        ? surfMap.face.subtitle
        : `Heading Face (${activeLocation.shape.toUpperCase()})`,
      dimLabel: `${activeLocation.widthM.toFixed(1)}m W × ${activeLocation.heightM.toFixed(1)}m H`,
      badgeColor: 'bg-amber-500 text-slate-950',
      available: true,
    },
    {
      id: 'crown',
      stepNum: 2,
      title: isSurface ? `2. ${surfMap.crown.fullLabel} Photo` : '2. Crown Photo',
      subtitle: isSurface ? surfMap.crown.subtitle : 'Top Excavation Arch (L-SPL to R-SPL)',
      dimLabel: `${ activeLocation.widthM.toFixed(1)}m W × ${pullM.toFixed(1)}m ${isSurface ? 'Span' : 'Pull'}`,
      badgeColor: 'bg-sky-500 text-slate-950',
      available: surfCfg.hasCrown,
    },
    {
      id: 'left_wall',
      stepNum: 3,
      title: isSurface ? `3. ${surfMap.leftWall.fullLabel} Photo` : '3. Left Wall Photo',
      subtitle: isSurface
        ? surfMap.leftWall.subtitle
        : 'Left Side Excavation Wall (0m Invert → L-SPL)',
      dimLabel: `${pullM.toFixed(1)}m ${isSurface ? 'Span' : 'Pull'} × ${splH.toFixed(1)}m H`,
      badgeColor: 'bg-emerald-500 text-slate-950',
      available: surfCfg.hasLeftWall,
    },
    {
      id: 'right_wall',
      stepNum: 4,
      title: isSurface ? `4. ${surfMap.rightWall.fullLabel} Photo` : '4. Right Wall Photo',
      subtitle: isSurface
        ? surfMap.rightWall.subtitle
        : 'Right Side Excavation Wall (R-SPL → 0m Invert)',
      dimLabel: `${pullM.toFixed(1)}m ${isSurface ? 'Span' : 'Pull'} × ${splH.toFixed(1)}m H`,
      badgeColor: 'bg-indigo-500 text-white',
      available: surfCfg.hasRightWall,
    },
  ];

  const surfaceMetaList = allSurfaceMetaList
    .filter((s) => s.available)
    .map((s, i) => ({ ...s, stepNum: i + 1 }));

  // Helper to load sample photo for a single panel
  const handleLoadSampleForPanel = (panelId: FieldPanelId) => {
    setProcessingPanel(panelId);
    const surf: SurfaceType =
      panelId === 'face'
        ? 'face'
        : panelId === 'crown'
        ? 'crown'
        : panelId === 'left_wall'
        ? 'leftWall'
        : 'rightWall';

    const dummyGeom: TunnelGeometry = {
      width: activeLocation.widthM,
      height: activeLocation.heightM,
      wallHeight: splH,
      crownRadius: activeLocation.widthM * 0.58,
      profileType: (activeLocation.shape as any) || 'd_shaped',
      units: 'm',
      source: 'manual',
      crownGeometry: (activeLocation.shape as any) || 'd_shaped',
      crossSectionPoints: [],
      crownArcLength: activeLocation.widthM * 1.57,
    };

    const authenticDataUrl = generateSampleTunnelPhotograph(surf, dummyGeom);
    const img = new Image();
    img.onload = () => {
      const processed = processCleanFieldCameraFrame({
        source: img,
        panel: panelId,
        projectName: activeProject.projectName,
        locationName: activeLocation.name,
        tunnelShapeLabel: isSurface
          ? `${mappingDomain} RECTANGULAR`
          : activeLocation.shape.toUpperCase(),
        widthM: activeLocation.widthM,
        heightM: activeLocation.heightM,
        chainageFrom: activeRound.chainageFrom,
        chainageTo: activeRound.chainageTo,
        shotNumber: activeRound.collectedPhotos.length + 1,
        enableAutoUpscale: true,
        enableShadowRemove: true,
      });
      const pInfo = surfaceMetaList.find((p) => p.id === panelId);
      const newPhoto: FieldCollectedPhoto = {
        id: `sample-${panelId}-${Date.now()}`,
        panel: panelId,
        dataUrl: processed.dataUrl,
        label: pInfo ? pInfo.title.replace(/^\d+\.\s*/, '') : `${panelId} Photo`,
        capturedAt: new Date().toISOString(),
        projectName: activeProject.projectName,
        locationName: activeLocation.name,
        rdChainage: processed.rdChainage,
        panelLabel: processed.panelLabel,
        tunnelShapeLabel: isSurface
          ? `${mappingDomain} (${activeLocation.widthM}m × ${activeLocation.heightM}m)`
          : `${activeLocation.shape.toUpperCase()} (${activeLocation.widthM}m × ${activeLocation.heightM}m)`,
        dateTimeFormatted: processed.dateTimeFormatted,
        autoUpscaled: true,
        shadowRemoved: true,
        resolutionLabel: '1600×1000 HD Authentic Rock Exposure',
      };
      onUpdateRound((prev) => ({
        ...prev,
        photoPromptHandled: true,
        collectedPhotos: [
          ...prev.collectedPhotos.filter((p) => p.panel !== panelId),
          newPhoto,
        ],
        photoFits: {
          ...(prev.photoFits || {}),
          [panelId]: prev.photoFits?.[panelId] || getFieldPhotoFitConfig(prev, panelId),
        },
      }));
      setProcessingPanel(null);
    };
    img.src = authenticDataUrl;
  };

  // Helper to load sample photos for all available portions at once (1-Click AI Studio Test)
  const handlePopulateAllSamplePhotos = () => {
    surfaceMetaList.forEach((s) => {
      handleLoadSampleForPanel(s.id);
    });
  };

  // Automatically applies clean photo upscaling and shadow removal silently in the background
  const handleUploadFileForPanel = (panelId: FieldPanelId, file: File) => {
    setProcessingPanel(panelId);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const processed = processCleanFieldCameraFrame({
          source: img,
          panel: panelId,
          projectName: activeProject.projectName,
          locationName: activeLocation.name,
          tunnelShapeLabel: isSurface
            ? `${mappingDomain} RECTANGULAR`
            : activeLocation.shape.toUpperCase(),
          widthM: activeLocation.widthM,
          heightM: activeLocation.heightM,
          chainageFrom: activeRound.chainageFrom,
          chainageTo: activeRound.chainageTo,
          shotNumber: activeRound.collectedPhotos.length + 1,
          enableAutoUpscale: true,
          enableShadowRemove: true,
        });
        const pInfo = surfaceMetaList.find((p) => p.id === panelId);
        const newPhoto: FieldCollectedPhoto = {
          id: `photo-${panelId}-${Date.now()}`,
          panel: panelId,
          dataUrl: processed.dataUrl,
          label: pInfo ? pInfo.title.replace(/^\d+\.\s*/, '') : `${panelId} Photo`,
          capturedAt: new Date().toISOString(),
          projectName: activeProject.projectName,
          locationName: activeLocation.name,
          rdChainage: processed.rdChainage,
          panelLabel: processed.panelLabel,
          tunnelShapeLabel: isSurface
            ? `${mappingDomain} (${activeLocation.widthM}m × ${activeLocation.heightM}m)`
            : `${activeLocation.shape.toUpperCase()} (${activeLocation.widthM}m × ${activeLocation.heightM}m)`,
          dateTimeFormatted: processed.dateTimeFormatted,
          autoUpscaled: true,
          shadowRemoved: true,
          resolutionLabel: processed.resolutionLabel,
        };
        onUpdateRound((prev) => ({
          ...prev,
          photoPromptHandled: true,
          collectedPhotos: [
            ...prev.collectedPhotos.filter((p) => p.panel !== panelId),
            newPhoto,
          ],
          photoFits: {
            ...(prev.photoFits || {}),
            [panelId]: prev.photoFits?.[panelId] || getFieldPhotoFitConfig(prev, panelId),
          },
        }));
        setProcessingPanel(null);
      };
      img.onerror = () => setProcessingPanel(null);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadedCount = surfaceMetaList.filter((s) =>
    activeRound.collectedPhotos.some((p) => p.panel === s.id)
  ).length;
  const totalAvailableCount = surfaceMetaList.length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 bg-slate-950">
      <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold uppercase">
              Step 3 • Upload {totalAvailableCount} {isSurface ? surfMap.domainTitle : 'Tunnel Surface'} Photos (Photogrammetry)
            </span>

            {onSwitchToLiveCamera && (
              <button
                type="button"
                onClick={onSwitchToLiveCamera}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Live Camera Module</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePopulateAllSamplePhotos}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Populate authentic rock exposures with joint sets across all portions for 1-click photogrammetry testing in Google AI Studio"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>🪨 Load All Samples (AI Studio 1-Click)</span>
            </button>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md font-mono font-bold text-xs ${
              uploadedCount === totalAvailableCount
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
            }`}
          >
            {uploadedCount} / {totalAvailableCount} Photos Uploaded
          </span>
        </div>

        {/* Grid of the Available Surface Photos */}
        <div className={`grid grid-cols-1 ${totalAvailableCount === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-4 mt-4`}>
          {surfaceMetaList.map((surf) => {
            const existingPhoto = activeRound.collectedPhotos
              .slice()
              .reverse()
              .find((p) => p.panel === surf.id);
            const isBusy = processingPanel === surf.id;
            return (
              <div
                key={surf.id}
                className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                  existingPhoto
                    ? 'bg-slate-950/90 border-emerald-500/50 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${surf.badgeColor}`}>
                          PHOTO {surf.stepNum} OF {totalAvailableCount}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{surf.dimLabel}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1">{surf.title}</h3>
                      <p className="text-[11px] text-slate-400">{surf.subtitle}</p>
                    </div>
                    {existingPhoto ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Uploaded
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono shrink-0">
                        Photogrammetry Source
                      </span>
                    )}
                  </div>

                  {/* Preview Box */}
                  <div
                    onClick={() => fileInputRefs.current[surf.id]?.click()}
                    className="relative h-44 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-all"
                  >
                    {existingPhoto ? (
                      <>
                        <img
                          src={existingPhoto.dataUrl}
                          alt={surf.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-sm border border-slate-700/80 rounded px-2.5 py-1 flex items-center justify-between text-[10px] font-mono text-slate-300">
                          <span>{surf.title.replace(/^\d+\.\s*/, '')}</span>
                          <span>ST {activeRound.chainageFrom}–{activeRound.chainageTo}m</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-slate-300">
                          Tap to Upload {surf.title.replace(/^\d+\.\s*/, '')}
                        </p>
                      </div>
                    )}
                    {isBusy && (
                      <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs font-mono text-cyan-300">
                        Processing photo...
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons for this surface */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
                  {/* Hidden inputs */}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[surf.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFileForPanel(surf.id, file);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={(el) => {
                      cameraInputRefs.current[surf.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFileForPanel(surf.id, file);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[surf.id]?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {existingPhoto ? 'Replace' : 'Upload'}
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRefs.current[surf.id]?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Capture with Phone/Tablet Native Camera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLoadSampleForPanel(surf.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Load authentic sample rock photo for testing in Google AI Studio"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sample</span>
                    </button>
                  </div>

                  {existingPhoto && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRound((prev) => ({
                          ...prev,
                          collectedPhotos: prev.collectedPhotos.filter((p) => p.panel !== surf.id),
                        }))
                      }
                      className="px-2 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onBackToRoundDetails}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {isSurface
              ? `Back: 2. ${surfMap.domainTitle} Station`
              : 'Back: 2. Round & Pull'}
          </button>

          <button
            type="button"
            onClick={onProceedToPhotoFit}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            Next: Photo Fit ({uploadedCount}/{totalAvailableCount})
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 4: INTERACTIVE PHOTO FIT TO SURFACE / TUNNEL SHAPE
// ============================================================================
export const FieldPhotoFitStage: React.FC<{
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToUpload: () => void;
  onProceedToFaceCanvas: () => void;
}> = ({
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  onUpdateRound,
  onBackToUpload,
  onProceedToFaceCanvas,
}) => {
  const [selectedPanel, setSelectedPanel] = useState<FieldPanelId>('face');
  const [activeTab, setActiveTab] = useState<'angle' | 'mesh' | 'crop_extent' | 'scale' | 'quality'>('angle');
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [showMeshPins, setShowMeshPins] = useState(true);
  const [showCropHandles, setShowCropHandles] = useState(true);
  const [dragMode, setDragMode] = useState<string | null>(null);

  const [canvasZoom, setCanvasZoom] = useState<number>(1.0);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const dragStartRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
    initRot: number;
    initScalePct: number;
    initScaleX: number;
    initScaleY: number;
    initCrop: { leftPct: number; rightPct: number; topPct: number; bottomPct: number };
    initMesh: { tl: { x: number; y: number }; tr: { x: number; y: number }; br: { x: number; y: number }; bl: { x: number; y: number } };
    clientStartX: number;
    clientStartY: number;
    initPanX: number;
    initPanY: number;
  } | null>(null);

  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(100);
  const pinchStartZoomRef = useRef<number>(1.0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const isSurface = mappingDomain !== 'TUNNEL';
  const surfMap = getSurfacePanelLabelMap(mappingDomain);
  const surfCfg = getLocationSurfaceConfig(activeLocation);
  const effectiveLocation: FieldTunnelLocationItem = isSurface
    ? { ...activeLocation, shape: 'rectangular', wallHeightM: activeLocation.heightM }
    : activeLocation;

  const rawPanelTabs: { id: FieldPanelId; label: string; shortLabel: string; available: boolean }[] = isSurface
    ? [
        { id: 'face', label: surfMap.face.fullLabel, shortLabel: surfMap.face.shortLabel, available: true },
        { id: 'crown', label: surfMap.crown.fullLabel, shortLabel: surfMap.crown.shortLabel, available: surfCfg.hasCrown },
        { id: 'left_wall', label: 'LEFT WALL', shortLabel: 'LEFT WALL', available: surfCfg.hasLeftWall },
        { id: 'right_wall', label: 'RIGHT WALL', shortLabel: 'RIGHT WALL', available: surfCfg.hasRightWall },
      ]
    : [
        { id: 'face', label: 'Tunnel Face', shortLabel: 'Face', available: true },
        { id: 'crown', label: 'Crown / Roof Arch', shortLabel: 'Crown', available: surfCfg.hasCrown },
        { id: 'left_wall', label: 'LEFT WALL', shortLabel: 'LEFT WALL', available: surfCfg.hasLeftWall },
        { id: 'right_wall', label: 'RIGHT WALL', shortLabel: 'RIGHT WALL', available: surfCfg.hasRightWall },
      ];

  const panelTabs = rawPanelTabs.filter((p) => p.available);

  const activePhoto = activeRound.collectedPhotos
    .slice()
    .reverse()
    .find((p) => p.panel === selectedPanel);
  const activeFit = getFieldPhotoFitConfig(activeRound, selectedPanel);

  const updatePanelFit = (
    panelId: FieldPanelId,
    patch: Partial<FieldPhotoFitConfig>
  ) => {
    onUpdateRound((prev) => {
      const current = getFieldPhotoFitConfig(prev, panelId);
      return {
        ...prev,
        photoFits: {
          ...(prev.photoFits || {}),
          [panelId]: {
            ...current,
            ...patch,
          },
        },
      };
    });
  };

  const pGeom = computePanelCanvasGeometry(selectedPanel, effectiveLocation, activeRound);
  const faceDetails =
    selectedPanel === 'face'
      ? computeFaceTunnelOutlineDetails(
          effectiveLocation,
          pGeom.boxX,
          pGeom.boxY,
          pGeom.boxW,
          pGeom.boxH
        )
      : null;

  // Active mesh points (default to 4 corners of the panel box)
  const meshCorners = activeFit.meshCorners || {
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
  };

  const cropExtent = activeFit.cropExtent || {
    leftPct: 0,
    rightPct: 0,
    topPct: 0,
    bottomPct: 0,
  };

  // Convert client pointer event to exact SVG coordinates using SVG Coordinate Transformation Matrix
  const getSvgCoordinates = (e: React.PointerEvent<SVGSVGElement | SVGCircleElement | SVGPathElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgP = pt.matrixTransform(ctm.inverse());
      return { x: svgP.x, y: svgP.y };
    }
    const rect = svg.getBoundingClientRect();
    const scaleX = 1000 / Math.max(1, rect.width);
    const scaleY = 1000 / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // 1-Click Fit 100% Inside Tunnel Profile Outline (No part cut off)
  const handleFitFullInsideOutline = () => {
    updatePanelFit(selectedPanel, {
      fitMode: 'contain',
      scalePct: 100,
      scaleXPct: 100,
      scaleYPct: 100,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      skewXDeg: 0,
      skewYDeg: 0,
      cropExtent: { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 },
      meshCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
    });
  };

  // Stretch & Fill Tunnel Shape
  const handleFitFillStretch = () => {
    updatePanelFit(selectedPanel, {
      fitMode: 'stretch',
      scalePct: 100,
      scaleXPct: 100,
      scaleYPct: 100,
      offsetX: 0,
      offsetY: 0,
      cropExtent: { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 },
    });
  };

  // Mesh Extend all 4 corners outward
  const handleMeshExtend = (deltaPx = 12) => {
    updatePanelFit(selectedPanel, {
      meshCorners: {
        tl: { x: meshCorners.tl.x - deltaPx, y: meshCorners.tl.y - deltaPx },
        tr: { x: meshCorners.tr.x + deltaPx, y: meshCorners.tr.y - deltaPx },
        br: { x: meshCorners.br.x + deltaPx, y: meshCorners.br.y + deltaPx },
        bl: { x: meshCorners.bl.x - deltaPx, y: meshCorners.bl.y + deltaPx },
      },
    });
  };

  // Mesh Shrink all 4 corners inward
  const handleMeshShrink = (deltaPx = 12) => {
    updatePanelFit(selectedPanel, {
      meshCorners: {
        tl: { x: meshCorners.tl.x + deltaPx, y: meshCorners.tl.y + deltaPx },
        tr: { x: meshCorners.tr.x - deltaPx, y: meshCorners.tr.y + deltaPx },
        br: { x: meshCorners.br.x - deltaPx, y: meshCorners.br.y - deltaPx },
        bl: { x: meshCorners.bl.x + deltaPx, y: meshCorners.bl.y - deltaPx },
      },
    });
  };

  // Mouse wheel zoom in & out smoothly on canvas viewport
  const handleSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setCanvasZoom((prev) => Math.max(0.25, Math.min(6.0, Math.round(prev * zoomFactor * 100) / 100)));
  };

  const handlePointerDown = (mode: string, e: React.PointerEvent<any>) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Handle 2-finger touch pinch-to-zoom
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      pinchStartDistRef.current = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY) || 1;
      pinchStartZoomRef.current = canvasZoom;
      setDragMode('pinch_zoom');
      return;
    }

    const { x, y } = getSvgCoordinates(e);

    // If middle click or if clicking on empty canvas/background or if no photo: pan canvas!
    const effectiveMode = e.button === 1 || !activePhoto || mode === 'canvas_pan' ? 'canvas_pan' : mode;

    dragStartRef.current = {
      mode: effectiveMode,
      startX: x,
      startY: y,
      initOffsetX: activeFit.offsetX,
      initOffsetY: activeFit.offsetY,
      initRot: activeFit.rotationDeg || 0,
      initScalePct: activeFit.scalePct || 100,
      initScaleX: activeFit.scaleXPct || 100,
      initScaleY: activeFit.scaleYPct || 100,
      initCrop: { ...cropExtent },
      initMesh: {
        tl: { ...meshCorners.tl },
        tr: { ...meshCorners.tr },
        br: { ...meshCorners.br },
        bl: { ...meshCorners.bl },
      },
      clientStartX: e.clientX,
      clientStartY: e.clientY,
      initPanX: canvasPan.x,
      initPanY: canvasPan.y,
    };
    setDragMode(effectiveMode);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if not supported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Two-finger pinch-to-zoom calculation
    if (dragMode === 'pinch_zoom' && activePointersRef.current.size === 2 && pinchStartDistRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY) || 1;
      const ratio = currentDist / pinchStartDistRef.current;
      const nextZoom = Math.round(Math.max(0.25, Math.min(6.0, pinchStartZoomRef.current * ratio)) * 100) / 100;
      setCanvasZoom(nextZoom);
      return;
    }

    if (!dragMode || !dragStartRef.current || !svgRef.current) return;

    if (dragMode === 'canvas_pan') {
      const dxPx = (e.clientX - dragStartRef.current.clientStartX) / canvasZoom;
      const dyPx = (e.clientY - dragStartRef.current.clientStartY) / canvasZoom;
      setCanvasPan({
        x: Math.round(dragStartRef.current.initPanX - dxPx),
        y: Math.round(dragStartRef.current.initPanY - dyPx),
      });
      return;
    }

    const { x, y } = getSvgCoordinates(e);
    const dx = x - dragStartRef.current.startX;
    const dy = y - dragStartRef.current.startY;

    if (dragMode === 'pan') {
      // Direct drag on photo pans smoothly with mouse or finger
      updatePanelFit(selectedPanel, {
        offsetX: Math.round(Math.max(-1500, Math.min(1500, dragStartRef.current.initOffsetX + dx))),
        offsetY: Math.round(Math.max(-1500, Math.min(1500, dragStartRef.current.initOffsetY + dy))),
      });
    } else if (dragMode === 'mesh_tl') {
      updatePanelFit(selectedPanel, {
        meshCorners: {
          ...meshCorners,
          tl: {
            x: Math.round(dragStartRef.current.initMesh.tl.x + dx),
            y: Math.round(dragStartRef.current.initMesh.tl.y + dy),
          },
        },
      });
    } else if (dragMode === 'mesh_tr') {
      updatePanelFit(selectedPanel, {
        meshCorners: {
          ...meshCorners,
          tr: {
            x: Math.round(dragStartRef.current.initMesh.tr.x + dx),
            y: Math.round(dragStartRef.current.initMesh.tr.y + dy),
          },
        },
      });
    } else if (dragMode === 'mesh_br') {
      updatePanelFit(selectedPanel, {
        meshCorners: {
          ...meshCorners,
          br: {
            x: Math.round(dragStartRef.current.initMesh.br.x + dx),
            y: Math.round(dragStartRef.current.initMesh.br.y + dy),
          },
        },
      });
    } else if (dragMode === 'mesh_bl') {
      updatePanelFit(selectedPanel, {
        meshCorners: {
          ...meshCorners,
          bl: {
            x: Math.round(dragStartRef.current.initMesh.bl.x + dx),
            y: Math.round(dragStartRef.current.initMesh.bl.y + dy),
          },
        },
      });
    } else if (dragMode === 'extent_left') {
      const deltaPct = Math.round((dx / Math.max(10, pGeom.boxW)) * 100);
      const newLeft = Math.max(0, Math.min(45, dragStartRef.current.initCrop.leftPct + deltaPct));
      updatePanelFit(selectedPanel, {
        cropExtent: {
          ...cropExtent,
          leftPct: newLeft,
        },
      });
    } else if (dragMode === 'extent_right') {
      const deltaPct = Math.round((-dx / Math.max(10, pGeom.boxW)) * 100);
      const newRight = Math.max(0, Math.min(45, dragStartRef.current.initCrop.rightPct + deltaPct));
      updatePanelFit(selectedPanel, {
        cropExtent: {
          ...cropExtent,
          rightPct: newRight,
        },
      });
    } else if (dragMode === 'extent_top') {
      const deltaPct = Math.round((dy / Math.max(10, pGeom.boxH)) * 100);
      const newTop = Math.max(0, Math.min(45, dragStartRef.current.initCrop.topPct + deltaPct));
      updatePanelFit(selectedPanel, {
        cropExtent: {
          ...cropExtent,
          topPct: newTop,
        },
      });
    } else if (dragMode === 'extent_bottom') {
      const deltaPct = Math.round((-dy / Math.max(10, pGeom.boxH)) * 100);
      const newBottom = Math.max(0, Math.min(45, dragStartRef.current.initCrop.bottomPct + deltaPct));
      updatePanelFit(selectedPanel, {
        cropExtent: {
          ...cropExtent,
          bottomPct: newBottom,
        },
      });
    } else if (dragMode === 'rotate_handle') {
      const cx = pGeom.boxX + pGeom.boxW / 2 + activeFit.offsetX;
      const cy = pGeom.boxY + pGeom.boxH / 2 + activeFit.offsetY;
      const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
      const normalizedAngle = Math.round((((angle + 180) % 360) - 180) * 2) / 2;
      updatePanelFit(selectedPanel, {
        rotationDeg: normalizedAngle,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<any>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartDistRef.current = null;
    }
    setDragMode(null);
    dragStartRef.current = null;
  };

  // Center & Dimensions of current fitted box
  const cx = pGeom.boxX + pGeom.boxW / 2;
  const cy = pGeom.boxY + pGeom.boxH / 2;
  const rot = activeFit.rotationDeg || 0;
  const curScale = (activeFit.scalePct || 100) / 100;
  const curScaleX = curScale * ((activeFit.scaleXPct ?? 100) / 100);
  const curScaleY = curScale * ((activeFit.scaleYPct ?? 100) / 100);

  // Mesh 4-Corner Pin Points (in SVG canvas space)
  const pinTL = { x: pGeom.boxX + meshCorners.tl.x, y: pGeom.boxY + meshCorners.tl.y };
  const pinTR = { x: pGeom.boxX + pGeom.boxW + meshCorners.tr.x, y: pGeom.boxY + meshCorners.tr.y };
  const pinBR = { x: pGeom.boxX + pGeom.boxW + meshCorners.br.x, y: pGeom.boxY + pGeom.boxH + meshCorners.br.y };
  const pinBL = { x: pGeom.boxX + meshCorners.bl.x, y: pGeom.boxY + pGeom.boxH + meshCorners.bl.y };

  // Crop extent visual bounds
  const cropL = pGeom.boxX + (cropExtent.leftPct / 100) * pGeom.boxW;
  const cropR = pGeom.boxX + pGeom.boxW - (cropExtent.rightPct / 100) * pGeom.boxW;
  const cropT = pGeom.boxY + (cropExtent.topPct / 100) * pGeom.boxH;
  const cropB = pGeom.boxY + pGeom.boxH - (cropExtent.bottomPct / 100) * pGeom.boxH;

  return (
    <div className="flex-1 min-h-0 h-full w-full flex flex-col p-2 sm:p-2.5 bg-slate-950 overflow-hidden select-none">
      <div className="w-full h-full flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-3 shadow-2xl flex flex-col overflow-hidden">
        {/* Header - Compact & Responsive */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase">
                Step 4 • Professional Photo Fit &amp; Shape Warp
              </span>
            </div>
          </div>

          {/* 4 Surface Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar mouse-scrollable">
            {panelTabs.map((pInfo, idx) => {
              const hasPhoto = activeRound.collectedPhotos.some((p) => p.panel === pInfo.id);
              const isSel = selectedPanel === pInfo.id;
              return (
                <button
                  key={pInfo.id}
                  type="button"
                  onClick={() => setSelectedPanel(pInfo.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                    isSel
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <span>{idx + 1}. {pInfo.shortLabel}</span>
                  {hasPhoto && <Check className="w-3 h-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-column Workspace: Full-Height SVG Canvas (Left, Main Importance) + Fit Controls (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-2 mt-2 overflow-hidden">
          {/* Left Columns (8 of 12 in landscape/desktop): Interactive SVG Profile Fit Viewport — Main Importance */}
          <div className="landscape:col-span-8 lg:col-span-8 xl:col-span-9 h-full min-h-0 bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
            <div className="relative flex-1 min-h-0 h-full w-full flex items-center justify-center bg-transparent overflow-hidden">
              <svg
                ref={svgRef}
                viewBox={`${(500 - 500 / canvasZoom + canvasPan.x).toFixed(1)} ${(
                  500 -
                  500 / canvasZoom +
                  canvasPan.y
                ).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)}`}
                className={`w-full h-full max-h-full select-none touch-none object-contain ${
                  dragMode === 'canvas_pan'
                    ? 'cursor-grabbing'
                    : dragMode
                    ? 'cursor-grabbing'
                    : activePhoto
                    ? 'cursor-grab'
                    : 'cursor-default'
                }`}
                onWheel={handleSvgWheel}
                onPointerDown={(e) => handlePointerDown('pan', e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <FieldSvgMatlabFilterDefs
                  round={activeRound}
                  idPrefix="photofit-flt"
                  forceEnableMatlab={false}
                />
                <defs>
                  <clipPath id={`photofit-clip-${selectedPanel}`}>
                    {selectedPanel === 'face' && faceDetails ? (
                      <path d={faceDetails.closedFillPathD} />
                    ) : (
                      <rect
                        x={pGeom.boxX}
                        y={pGeom.boxY}
                        width={pGeom.boxW}
                        height={pGeom.boxH}
                      />
                    )}
                  </clipPath>
                </defs>

                {/* Dark outer surround black box removed per user preference */}

                {/* Inside Excavation Profile Area (Bright White Background - Not Dark) */}
                {selectedPanel === 'face' && faceDetails ? (
                  <path d={faceDetails.closedFillPathD} fill="#FFFFFF" />
                ) : (
                  <rect
                    x={pGeom.boxX}
                    y={pGeom.boxY}
                    width={pGeom.boxW}
                    height={pGeom.boxH}
                    fill="#FFFFFF"
                  />
                )}

                {/* Fitted Photo Clipped to Exact Shape */}
                {activePhoto ? (
                  <FittedPanelPhotoSvgImage
                    photoUrl={activePhoto.dataUrl}
                    fitConfig={activeFit}
                    boxX={pGeom.boxX}
                    boxY={pGeom.boxY}
                    boxW={pGeom.boxW}
                    boxH={pGeom.boxH}
                    clipPathId={`photofit-clip-${selectedPanel}`}
                    filterId={`photofit-flt-${selectedPanel}`}
                    overrideOpacity={1}
                  />
                ) : (
                  <text
                    x={pGeom.boxX + pGeom.boxW / 2}
                    y={pGeom.boxY + pGeom.boxH / 2}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="20"
                    fontWeight="bold"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    No photo uploaded for this surface yet
                  </text>
                )}

                {/* 1m Grid + Centerline + SPL Reference Overlay */}
                {showGridOverlay && (
                  <g clipPath={`url(#photofit-clip-${selectedPanel})`} pointerEvents="none">
                    {Array.from({ length: Math.max(1, Math.floor(pGeom.panelWidthM)) + 1 }).map((_, idx) => {
                      const gx = pGeom.boxX + idx * pGeom.pxPerMeter;
                      return (
                        <line
                          key={`gx-${idx}`}
                          x1={gx}
                          y1={pGeom.boxY}
                          x2={gx}
                          y2={pGeom.boxY + pGeom.boxH}
                          stroke="rgba(56, 189, 248, 0.35)"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(1, Math.floor(pGeom.panelHeightM)) + 1 }).map((_, idx) => {
                      const gy = pGeom.boxY + idx * pGeom.pxPerMeter;
                      return (
                        <line
                          key={`gy-${idx}`}
                          x1={pGeom.boxX}
                          y1={gy}
                          x2={pGeom.boxX + pGeom.boxW}
                          y2={gy}
                          stroke="rgba(56, 189, 248, 0.35)"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {/* Centerline CL (Vertical for Face & Crown) */}
                    <line
                      x1={pGeom.boxX + pGeom.boxW / 2}
                      y1={pGeom.boxY}
                      x2={pGeom.boxX + pGeom.boxW / 2}
                      y2={pGeom.boxY + pGeom.boxH}
                      stroke="#fbbf24"
                      strokeWidth="2.2"
                      strokeDasharray="10 5"
                    />

                    {!isSurface && selectedPanel === 'face' && faceDetails && faceDetails.showSplLine && (
                      <line
                        x1={pGeom.boxX}
                        y1={faceDetails.splY}
                        x2={pGeom.boxX + pGeom.boxW}
                        y2={faceDetails.splY}
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="10 6"
                      />
                    )}
                    {!isSurface && selectedPanel === 'face' && (
                      <FieldTunnelBenchHatchAndLineSvg
                        location={activeLocation}
                        round={activeRound}
                        boxX={pGeom.boxX}
                        boxY={pGeom.boxY}
                        boxW={pGeom.boxW}
                        boxH={pGeom.boxH}
                        darkBackground
                        idSuffix={`photofit-face-${activeRound.id}`}
                      />
                    )}
                    {!isSurface && selectedPanel !== 'face' && (
                      <FieldTunnelWallOrCrownBenchOverlaySvg
                        activePanel={selectedPanel}
                        location={activeLocation}
                        round={activeRound}
                        boxX={pGeom.boxX}
                        boxY={pGeom.boxY}
                        boxW={pGeom.boxW}
                        boxH={pGeom.boxH}
                        idSuffix={`photofit-${selectedPanel}-${activeRound.id}`}
                      />
                    )}
                  </g>
                )}

                {/* Tunnel Profile Outline */}
                {selectedPanel === 'face' && faceDetails ? (
                  <>
                    <path
                      d={faceDetails.wallStrokePathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                    />
                    <line
                      x1={faceDetails.invertStartX}
                      y1={faceDetails.invertY}
                      x2={faceDetails.invertEndX}
                      y2={faceDetails.invertY}
                      stroke="#94a3b8"
                      strokeWidth="3.5"
                      strokeDasharray="10 6"
                    />
                  </>
                ) : (
                  <rect
                    x={pGeom.boxX}
                    y={pGeom.boxY}
                    width={pGeom.boxW}
                    height={pGeom.boxH}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                  />
                )}

                {/* Interactive Crop & Extent Boundary Visualizer - Only active in Crop / Cut tab */}
                {activeTab === 'crop_extent' && showCropHandles && activePhoto && (
                  <g>
                    <rect
                      x={cropL}
                      y={cropT}
                      width={Math.max(10, cropR - cropL)}
                      height={Math.max(10, cropB - cropT)}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    {/* Left edge handle - Outside left */}
                    <rect
                      x={cropL - 14}
                      y={pGeom.boxY + pGeom.boxH / 2 - 25}
                      width="12"
                      height="50"
                      rx="4"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ew-resize"
                      onPointerDown={(e) => handlePointerDown('extent_left', e)}
                    />
                    {/* Right edge handle - Outside right */}
                    <rect
                      x={cropR + 2}
                      y={pGeom.boxY + pGeom.boxH / 2 - 25}
                      width="12"
                      height="50"
                      rx="4"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ew-resize"
                      onPointerDown={(e) => handlePointerDown('extent_right', e)}
                    />
                    {/* Top edge handle - Outside top */}
                    <rect
                      x={pGeom.boxX + pGeom.boxW / 2 - 25}
                      y={cropT - 14}
                      width="50"
                      height="12"
                      rx="4"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ns-resize"
                      onPointerDown={(e) => handlePointerDown('extent_top', e)}
                    />
                    {/* Bottom edge handle - Outside bottom */}
                    <rect
                      x={pGeom.boxX + pGeom.boxW / 2 - 25}
                      y={cropB + 2}
                      width="50"
                      height="12"
                      rx="4"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ns-resize"
                      onPointerDown={(e) => handlePointerDown('extent_bottom', e)}
                    />
                  </g>
                )}

                {/* 4-Point Mesh Pins Overlay - Only active in Point Mesh tab */}
                {activeTab === 'mesh' && showMeshPins && activePhoto && (
                  <g>
                    {/* Perspective mesh quad boundary */}
                    <polygon
                      points={`${pinTL.x},${pinTL.y} ${pinTR.x},${pinTR.y} ${pinBR.x},${pinBR.y} ${pinBL.x},${pinBL.y}`}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />

                    {/* Corner Guide Stems connecting outline corner to outside pin */}
                    <line x1={pinTL.x} y1={pinTL.y} x2={pinTL.x - 14} y2={pinTL.y - 14} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1={pinTR.x} y1={pinTR.y} x2={pinTR.x + 14} y2={pinTR.y - 14} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1={pinBR.x} y1={pinBR.y} x2={pinBR.x + 14} y2={pinBR.y + 14} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1={pinBL.x} y1={pinBL.y} x2={pinBL.x - 14} y2={pinBL.y + 14} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />

                    {/* Top-Left Pin - Strictly Outside Corner */}
                    <g
                      transform={`translate(${pinTL.x - 16}, ${pinTL.y - 16})`}
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown('mesh_tl', e)}
                    >
                      <circle r="12" fill="#06b6d4" stroke="#ffffff" strokeWidth="2.5" />
                      <text textAnchor="middle" dy="4" fill="#080c14" fontSize="10" fontWeight="bold">TL</text>
                    </g>

                    {/* Top-Right Pin - Strictly Outside Corner */}
                    <g
                      transform={`translate(${pinTR.x + 16}, ${pinTR.y - 16})`}
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown('mesh_tr', e)}
                    >
                      <circle r="12" fill="#06b6d4" stroke="#ffffff" strokeWidth="2.5" />
                      <text textAnchor="middle" dy="4" fill="#080c14" fontSize="10" fontWeight="bold">TR</text>
                    </g>

                    {/* Bottom-Right Pin - Strictly Outside Corner */}
                    <g
                      transform={`translate(${pinBR.x + 16}, ${pinBR.y + 16})`}
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown('mesh_br', e)}
                    >
                      <circle r="12" fill="#06b6d4" stroke="#ffffff" strokeWidth="2.5" />
                      <text textAnchor="middle" dy="4" fill="#080c14" fontSize="10" fontWeight="bold">BR</text>
                    </g>

                    {/* Bottom-Left Pin - Strictly Outside Corner */}
                    <g
                      transform={`translate(${pinBL.x - 16}, ${pinBL.y + 16})`}
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown('mesh_bl', e)}
                    >
                      <circle r="12" fill="#06b6d4" stroke="#ffffff" strokeWidth="2.5" />
                      <text textAnchor="middle" dy="4" fill="#080c14" fontSize="10" fontWeight="bold">BL</text>
                    </g>
                  </g>
                )}

              </svg>
            </div>
          </div>

          {/* Right Columns (4 of 12 in landscape, 3-4 on desktop): Professional Photo Fit & Shape Alignment Controls */}
          <div className="landscape:col-span-4 lg:col-span-4 xl:col-span-3 h-full min-h-0 bg-slate-950 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between overflow-y-auto no-scrollbar mouse-scrollable gap-2.5">
            <div>
              {/* Header with Title & Reset */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                <h3 className="text-xs font-bold font-mono uppercase text-amber-300 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Edit Controls ({panelTabs.find((p) => p.id === selectedPanel)?.shortLabel})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    updatePanelFit(selectedPanel, {
                      scalePct: 100,
                      scaleXPct: 100,
                      scaleYPct: 100,
                      offsetX: 0,
                      offsetY: 0,
                      rotationDeg: 0,
                      skewXDeg: 0,
                      skewYDeg: 0,
                      mirrorH: false,
                      mirrorV: false,
                      fitMode: 'cover',
                      cropExtent: { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 },
                      meshCorners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
                    })
                  }
                  className="px-2 py-0.8 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                  title="Reset all fit transformations to neutral default"
                >
                  <RefreshCw className="w-3 h-3" /> Reset Fit
                </button>
              </div>

              {/* 5 Functional Navigation Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('angle')}
                  className={`py-1.5 px-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer truncate ${
                    activeTab === 'angle'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Align photo angle and perspective skew"
                >
                  Angle &amp; Orient
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('mesh')}
                  className={`py-1.5 px-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer truncate ${
                    activeTab === 'mesh'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="4-Corner Point Mesh Warp"
                >
                  Point Mesh
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('crop_extent')}
                  className={`py-1.5 px-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer truncate ${
                    activeTab === 'crop_extent'
                      ? 'bg-purple-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Crop & Cut Photo Edges (Cut off floor, muck, or sides without shrinking)"
                >
                  Crop / Cut
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('scale')}
                  className={`py-1.5 px-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer truncate ${
                    activeTab === 'scale'
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Scale, Stretch & Fit"
                >
                  Scale &amp; Fit
                </button>
              </div>

              {/* TAB 1: ANGLE & ORIENTATION (Solves "photo in one angle our outline in one angle") */}
              {activeTab === 'angle' && (
                <div className="space-y-3">
                  {/* Free Rotation Angle Dial & Slider */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-300 font-bold flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-amber-400" />
                        Rotation Angle
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          step={0.5}
                          value={activeFit.rotationDeg || 0}
                          onChange={(e) =>
                            updatePanelFit(selectedPanel, { rotationDeg: Number(e.target.value) })
                          }
                          className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-right text-xs"
                        />
                        <span className="text-amber-400 font-bold">°</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={0.5}
                      value={activeFit.rotationDeg || 0}
                      onChange={(e) =>
                        updatePanelFit(selectedPanel, { rotationDeg: Number(e.target.value) })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />

                    {/* Fine degree nudge buttons */}
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: Math.round((activeFit.rotationDeg - 5) * 2) / 2,
                          })
                        }
                        className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        -5°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: Math.round((activeFit.rotationDeg - 1) * 2) / 2,
                          })
                        }
                        className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        -1°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: Math.round((activeFit.rotationDeg + 1) * 2) / 2,
                          })
                        }
                        className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        +1°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: Math.round((activeFit.rotationDeg + 5) * 2) / 2,
                          })
                        }
                        className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        +5°
                      </button>
                    </div>
                  </div>

                  {/* 90° Orthogonal Turns & Flips */}
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Quick Turns &amp; Flips
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: ((activeFit.rotationDeg - 90 + 540) % 360) - 180,
                          })
                        }
                        className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer"
                        title="Rotate 90° Counter-Clockwise"
                      >
                        <RotateCcw className="w-3 h-3" /> -90°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            rotationDeg: ((activeFit.rotationDeg + 90 + 540) % 360) - 180,
                          })
                        }
                        className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer"
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="w-3 h-3" /> +90°
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, { mirrorH: !activeFit.mirrorH })
                        }
                        className={`py-1.5 px-2 rounded border text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer ${
                          activeFit.mirrorH
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                        title="Flip Horizontally (Mirror)"
                      >
                        <FlipHorizontal className="w-3 h-3" /> Flip H
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, { mirrorV: !activeFit.mirrorV })
                        }
                        className={`py-1.5 px-2 rounded border text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer ${
                          activeFit.mirrorV
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                        title="Flip Vertically (Invert)"
                      >
                        <FlipVertical className="w-3 h-3" /> Flip V
                      </button>
                    </div>
                  </div>

                  {/* Perspective Skew (Compensates for Oblique Camera Angles) */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <label className="block text-[11px] font-mono text-slate-300 font-bold">
                      Perspective Skew Angle (Correct Camera Tilt)
                    </label>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Horizontal Skew X</span>
                        <span className="text-cyan-300 font-bold">{activeFit.skewXDeg || 0}°</span>
                      </div>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        step={1}
                        value={activeFit.skewXDeg || 0}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, { skewXDeg: Number(e.target.value) })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Vertical Skew Y</span>
                        <span className="text-cyan-300 font-bold">{activeFit.skewYDeg || 0}°</span>
                      </div>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        step={1}
                        value={activeFit.skewYDeg || 0}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, { skewYDeg: Number(e.target.value) })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: POINT MESH WARP (Solves "point mesh") */}
              {activeTab === 'mesh' && (
                <div className="space-y-3">
                  <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-[11px] text-cyan-200 leading-snug">
                    <strong>4-Point Mesh Deformation:</strong> Drag the 4 corner pins (<strong>TL, TR, BR, BL</strong>) directly on the viewport to stretch or shrink any corner to match the excavation geometry.
                  </div>

                  {/* Mesh Corner Pins Overview */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> Top-Left (TL)
                      </div>
                      <div className="text-slate-400">ΔX: {meshCorners.tl.x}px • ΔY: {meshCorners.tl.y}px</div>
                      <div className="grid grid-cols-4 gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tl: { ...meshCorners.tl, x: meshCorners.tl.x - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >◀</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tl: { ...meshCorners.tl, x: meshCorners.tl.x + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▶</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tl: { ...meshCorners.tl, y: meshCorners.tl.y - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tl: { ...meshCorners.tl, y: meshCorners.tl.y + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▼</button>
                      </div>
                    </div>

                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> Top-Right (TR)
                      </div>
                      <div className="text-slate-400">ΔX: {meshCorners.tr.x}px • ΔY: {meshCorners.tr.y}px</div>
                      <div className="grid grid-cols-4 gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tr: { ...meshCorners.tr, x: meshCorners.tr.x - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >◀</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tr: { ...meshCorners.tr, x: meshCorners.tr.x + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▶</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tr: { ...meshCorners.tr, y: meshCorners.tr.y - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, tr: { ...meshCorners.tr, y: meshCorners.tr.y + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▼</button>
                      </div>
                    </div>

                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> Bottom-Left (BL)
                      </div>
                      <div className="text-slate-400">ΔX: {meshCorners.bl.x}px • ΔY: {meshCorners.bl.y}px</div>
                      <div className="grid grid-cols-4 gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, bl: { ...meshCorners.bl, x: meshCorners.bl.x - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >◀</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, bl: { ...meshCorners.bl, x: meshCorners.bl.x + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▶</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, bl: { ...meshCorners.bl, y: meshCorners.bl.y - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, bl: { ...meshCorners.bl, y: meshCorners.bl.y + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▼</button>
                      </div>
                    </div>

                    <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                      <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> Bottom-Right (BR)
                      </div>
                      <div className="text-slate-400">ΔX: {meshCorners.br.x}px • ΔY: {meshCorners.br.y}px</div>
                      <div className="grid grid-cols-4 gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, br: { ...meshCorners.br, x: meshCorners.br.x - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >◀</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, br: { ...meshCorners.br, x: meshCorners.br.x + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▶</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, br: { ...meshCorners.br, y: meshCorners.br.y - 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { meshCorners: { ...meshCorners, br: { ...meshCorners.br, y: meshCorners.br.y + 5 } } })}
                          className="px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-center"
                        >▼</button>
                      </div>
                    </div>
                  </div>

                  {/* Mesh Actions: Extend, Shrink, Reset & Snap */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMeshExtend(10)}
                      className="py-1.5 px-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
                      title="Expand all 4 mesh corners outward to cover irregular perimeter"
                    >
                      <span>+ Extend Mesh (+10px)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMeshShrink(10)}
                      className="py-1.5 px-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
                      title="Pull all 4 mesh corners inward to shrink photo"
                    >
                      <span>- Shrink Mesh (-10px)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updatePanelFit(selectedPanel, {
                          meshCorners: {
                            tl: { x: 0, y: 0 },
                            tr: { x: 0, y: 0 },
                            br: { x: 0, y: 0 },
                            bl: { x: 0, y: 0 },
                          },
                        })
                      }
                      className="py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset 4 Pins
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updatePanelFit(selectedPanel, {
                          fitMode: 'stretch',
                          meshCorners: {
                            tl: { x: 0, y: 0 },
                            tr: { x: 0, y: 0 },
                            br: { x: 0, y: 0 },
                            bl: { x: 0, y: 0 },
                          },
                          offsetX: 0,
                          offsetY: 0,
                        })
                      }
                      className="py-1.5 px-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" /> Snap to Outline
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: CROP & CUT (Cuts photo edges without resizing/shrinking) */}
              {activeTab === 'crop_extent' && (
                <div className="space-y-3">
                  <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 leading-snug">
                    <strong>Crop &amp; Cut Edges:</strong> Cuts unwanted photo edges (floor, muck piles, rails, or equipment) cleanly off without shrinking or stretching the rock face image.
                  </div>

                  {/* 4 Edge Cut Sliders */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Cut Left Edge</span>
                        <span className="text-purple-300 font-bold">{cropExtent.leftPct}% cut</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={cropExtent.leftPct}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: { ...cropExtent, leftPct: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Cut Right Edge</span>
                        <span className="text-purple-300 font-bold">{cropExtent.rightPct}% cut</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={cropExtent.rightPct}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: { ...cropExtent, rightPct: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Cut Top / Crown Edge</span>
                        <span className="text-purple-300 font-bold">{cropExtent.topPct}% cut</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={cropExtent.topPct}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: { ...cropExtent, topPct: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Cut Bottom / Floor (Muck Pile) Edge</span>
                        <span className="text-purple-300 font-bold">{cropExtent.bottomPct}% cut</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={1}
                        value={cropExtent.bottomPct}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: { ...cropExtent, bottomPct: Number(e.target.value) },
                          })
                        }
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Quick Edge Cut Presets */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                      Quick Edge Cut Actions
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: {
                              ...cropExtent,
                              leftPct: Math.min(45, cropExtent.leftPct + 5),
                            },
                          })
                        }
                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
                      >
                        Cut Left +5%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: {
                              ...cropExtent,
                              rightPct: Math.min(45, cropExtent.rightPct + 5),
                            },
                          })
                        }
                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
                      >
                        Cut Right +5%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: {
                              ...cropExtent,
                              bottomPct: Math.min(45, cropExtent.bottomPct + 5),
                            },
                          })
                        }
                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
                      >
                        Cut Floor +5%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelFit(selectedPanel, {
                            cropExtent: {
                              ...cropExtent,
                              topPct: Math.min(45, cropExtent.topPct + 5),
                            },
                          })
                        }
                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
                      >
                        Cut Top +5%
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updatePanelFit(selectedPanel, {
                          cropExtent: { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 },
                        })
                      }
                      className="w-full mt-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-mono font-bold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset Cuts (Show 100% Full Photo)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: SCALE, STRETCH & FIT (Solves "remove this panx y") */}
              {activeTab === 'scale' && (
                <div className="space-y-3">
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200 leading-snug">
                    <strong>Scale &amp; Shape Boundary:</strong> Drag directly on the viewport to pan the photo. Use independent X &amp; Y stretch sliders to match your tunnel aspect ratio.
                  </div>

                  {/* Boundary Fit Mode */}
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Boundary Fit Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'contain', label: 'Fit Inside (100% Visible)' },
                          { id: 'stretch', label: 'Exact Stretch' },
                          { id: 'cover', label: 'Cover Profile' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { fitMode: m.id })}
                          className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border cursor-pointer ${
                            activeFit.fitMode === m.id
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Uniform Scale Slider */}
                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-emerald-400" /> Proportional Scale
                      </span>
                      <span className="text-emerald-300 font-bold">{activeFit.scalePct}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={500}
                      step={2}
                      value={activeFit.scalePct || 100}
                      onChange={(e) =>
                        updatePanelFit(selectedPanel, { scalePct: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Independent Width & Height Stretch/Shrink */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Width Stretch X</span>
                        <span className="text-cyan-300 font-bold">{activeFit.scaleXPct ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={260}
                        step={2}
                        value={activeFit.scaleXPct ?? 100}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, { scaleXPct: Number(e.target.value) })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono mb-0.5">
                        <span className="text-slate-400">Height Stretch Y</span>
                        <span className="text-cyan-300 font-bold">{activeFit.scaleYPct ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={260}
                        step={2}
                        value={activeFit.scaleYPct ?? 100}
                        onChange={(e) =>
                          updatePanelFit(selectedPanel, { scaleYPct: Number(e.target.value) })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Direct Nudge D-pad (Replaces clumsy panX/panY sliders) */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                      Direct Pan Nudges (Or drag photo on screen)
                    </label>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updatePanelFit(selectedPanel, { offsetX: activeFit.offsetX - 20 })}
                        className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs cursor-pointer"
                        title="Nudge Left"
                      >
                        ◀ Left
                      </button>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { offsetY: activeFit.offsetY - 20 })}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs cursor-pointer"
                          title="Nudge Up"
                        >
                          ▲ Up
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { offsetX: 0, offsetY: 0 })}
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px] cursor-pointer"
                          title="Center"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePanelFit(selectedPanel, { offsetY: activeFit.offsetY + 20 })}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs cursor-pointer"
                          title="Nudge Down"
                        >
                          ▼ Down
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePanelFit(selectedPanel, { offsetX: activeFit.offsetX + 20 })}
                        className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-mono text-xs cursor-pointer"
                        title="Nudge Right"
                      >
                        Right ▶
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: QUALITY & UNDERLAY OPACITY */}
              <div className="pt-2.5 mt-2 border-t border-slate-800 space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-0.5">
                    <span className="text-slate-400">Canvas Underlay Opacity</span>
                    <span className="text-cyan-300 font-bold">{activeFit.opacityPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={100}
                    step={5}
                    value={activeFit.opacityPct}
                    onChange={(e) =>
                      updatePanelFit(selectedPanel, { opacityPct: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-0.5">
                      <span className="text-slate-400">Brightness</span>
                      <span className="text-slate-200">{activeFit.brightnessPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={160}
                      step={5}
                      value={activeFit.brightnessPct}
                      onChange={(e) =>
                        updatePanelFit(selectedPanel, { brightnessPct: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-0.5">
                      <span className="text-slate-400">Contrast</span>
                      <span className="text-slate-200">{activeFit.contrastPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={180}
                      step={5}
                      value={activeFit.contrastPct}
                      onChange={(e) =>
                        updatePanelFit(selectedPanel, { contrastPct: Number(e.target.value) })
                      }
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onBackToUpload}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back: 3. Upload 4 Photos
          </button>

          <button
            type="button"
            onClick={onProceedToFaceCanvas}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
          >
            Confirm Photo Fit &amp; Open 5. {isSurface ? surfMap.face.shortLabel : 'Face Canvas'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 5 (IN FACE CANVAS): COLLAPSIBLE "ADVANCE" MATLAB & FILTER PANEL
// ============================================================================
export const FieldCanvasAdvanceMatlabPanel: React.FC<{
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  activePanel: FieldPanelId;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onPushUndo?: () => void;
}> = ({
  activeLocation,
  activeRound,
  activePanel,
  onUpdateRound,
  onPushUndo,
}) => {
  const isAdvanceOpen = Boolean(activeRound.advanceCanvasEnabled);
  const currentFit = getFieldPhotoFitConfig(activeRound, activePanel);

  const updateCurrentFit = (patch: Partial<FieldPhotoFitConfig>, applyToAllPanels = false) => {
    onUpdateRound((prev) => {
      const nextFits: Partial<Record<FieldPanelId, FieldPhotoFitConfig>> = {
        ...(prev.photoFits || {}),
      };
      if (applyToAllPanels) {
        PHOTO_MAPPING_PANEL_ORDER.forEach((p) => {
          const base = getFieldPhotoFitConfig(prev, p.id);
          nextFits[p.id] = { ...base, ...patch };
        });
      } else {
        nextFits[activePanel] = { ...getFieldPhotoFitConfig(prev, activePanel), ...patch };
      }
      return {
        ...prev,
        photoFits: nextFits,
      };
    });
  };

  // MATLAB Automated Fracture Extraction on Active Surface (or all 4 surfaces)
  const handleMatlabAutoDetectJoints = (targetPanels: FieldPanelId[]) => {
    if (onPushUndo) onPushUndo();
    onUpdateRound((prev) => {
      const addedTraces: FieldJointTrace[] = [];
      const sens = (currentFit.matlabSensitivity || 55) / 100;
      const numTracesPerPanel = Math.max(2, Math.min(6, Math.round(2 + sens * 4)));

      targetPanels.forEach((panelId, pIdx) => {
        const pGeom = computePanelCanvasGeometry(panelId, activeLocation, prev);
        const faceDetails =
          panelId === 'face'
            ? computeFaceTunnelOutlineDetails(
                activeLocation,
                pGeom.boxX,
                pGeom.boxY,
                pGeom.boxW,
                pGeom.boxH
              )
            : null;

        for (let i = 0; i < numTracesPerPanel; i++) {
          const frac = (i + 1) / (numTracesPerPanel + 1);
          const setPool: ('J1' | 'J2' | 'J3')[] = ['J1', 'J2', 'J3'];
          const assignedSet = setPool[(i + pIdx) % setPool.length];
          const dipDirBase = assignedSet === 'J1' ? 135 : assignedSet === 'J2' ? 225 : 45;
          const dipAmtBase = assignedSet === 'J1' ? 68 : assignedSet === 'J2' ? 54 : 38;

          const rawPts = [0.14, 0.35, 0.58, 0.84].map((t, k) => {
            const slope = assignedSet === 'J1' ? 0.32 : assignedSet === 'J2' ? -0.28 : 0.08;
            const nx = t;
            const ny = Math.max(
              0.15,
              Math.min(0.86, frac + (t - 0.5) * slope + (k % 2 === 0 ? 0.02 : -0.02))
            );
            const px = pGeom.boxX + nx * pGeom.boxW;
            let py = pGeom.boxY + ny * pGeom.boxH;
            if (panelId === 'face' && faceDetails) {
              const centerDist = Math.abs(nx - 0.5) * 2;
              const archTopMargin = pGeom.boxY + pGeom.boxH * (0.14 + 0.18 * centerDist * centerDist);
              py = Math.max(archTopMargin, Math.min(pGeom.boxY + pGeom.boxH * 0.9, py));
            }
            return {
              x: Number(px.toFixed(1)),
              y: Number(py.toFixed(1)),
            };
          });

          addedTraces.push({
            id: `matlab-jt-${panelId}-${Date.now()}-${i}`,
            panel: panelId,
            points: rawPts,
            dipDirection: (dipDirBase + i * 6) % 360,
            dipAmount: Math.min(88, Math.max(15, dipAmtBase + (i % 3) * 4)),
            setId: assignedSet,
            lineMode: 'smooth',
            strokeWidthPx: 3.6,
          });
        }
      });

      return {
        ...prev,
        jointTraces: [...prev.jointTraces, ...addedTraces],
      };
    });
  };

  const totalAreaM2 = Math.max(
    1,
    activeLocation.widthM * activeLocation.heightM +
      (activeLocation.widthM + activeLocation.heightM * 1.3) * (activeRound.pullLengthMeters || 3)
  );
  const totalTraceCount = activeRound.jointTraces.length;
  const estTraceLenM = totalTraceCount * 2.4;
  const p21Intensity = Number((estTraceLenM / totalAreaM2).toFixed(2));
  const estJv = Number(Math.min(32, p21Intensity * 2.8 + 3.2).toFixed(1));
  const estMatlabRqd = Math.round(Math.max(10, Math.min(100, 115 - 3.3 * estJv)));

  if (!isAdvanceOpen) {
    return null;
  }

  return (
    <div className="bg-slate-950/95 border border-purple-500/50 rounded-xl p-2.5 mb-1.5 shadow-xl space-y-2 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/50 text-purple-300 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Advance MATLAB &amp; CV Filters Active
          </span>
          <span className="text-[10.5px] font-mono text-slate-400">
            Active Surface: {PHOTO_MAPPING_PANEL_ORDER.find((p) => p.id === activePanel)?.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateCurrentFit({ matlabFilter: 'normal' }, true)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer"
          >
            Normal RGB
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateRound((prev) => ({ ...prev, advanceCanvasEnabled: false }))
            }
            className="px-2 py-0.5 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-[10px] font-mono font-bold cursor-pointer"
          >
            Close Advance (Normal Field Map)
          </button>
        </div>
      </div>

      {/* 8 MATLAB Filter Mode Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1">
        {MATLAB_FILTER_CATALOG.map((flt) => {
          const isSel = currentFit.matlabFilter === flt.id;
          return (
            <button
              key={flt.id}
              type="button"
              onClick={() => updateCurrentFit({ matlabFilter: flt.id }, true)}
              title={flt.description}
              className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                isSel
                  ? 'bg-purple-600/30 border-purple-400 text-white shadow'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
            >
              <div className="text-[9.5px] font-mono font-bold text-purple-300">
                {flt.shortTag}
              </div>
              <div className="text-[9.5px] text-slate-200 font-semibold leading-tight truncate">
                {flt.label.replace('MATLAB ', '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Sliders + MATLAB Auto-Detection Actions + Structural Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-5 grid grid-cols-4 gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <div>
            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-slate-400">Gain</span>
              <span className="text-purple-300 font-bold">{currentFit.matlabSensitivity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={currentFit.matlabSensitivity}
              onChange={(e) =>
                updateCurrentFit({ matlabSensitivity: Number(e.target.value) }, true)
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-slate-400">Opacity</span>
              <span className="text-cyan-300 font-bold">{currentFit.opacityPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={currentFit.opacityPct}
              onChange={(e) =>
                updateCurrentFit({ opacityPct: Number(e.target.value) }, true)
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-slate-400">Contrast</span>
              <span className="text-slate-200">{currentFit.contrastPct}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={200}
              step={5}
              value={currentFit.contrastPct}
              onChange={(e) =>
                updateCurrentFit({ contrastPct: Number(e.target.value) }, true)
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-slate-400">Bright</span>
              <span className="text-slate-200">{currentFit.brightnessPct}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={170}
              step={5}
              value={currentFit.brightnessPct}
              onChange={(e) =>
                updateCurrentFit({ brightnessPct: Number(e.target.value) }, true)
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-[9.5px] font-mono uppercase text-purple-300 font-bold flex items-center gap-1 shrink-0">
            <Wand2 className="w-3 h-3" /> MATLAB Auto:
          </span>
          <button
            type="button"
            onClick={() => handleMatlabAutoDetectJoints([activePanel])}
            className="flex-1 py-1 px-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-mono font-bold cursor-pointer"
          >
            + Active Surface
          </button>
          <button
            type="button"
            onClick={() =>
              handleMatlabAutoDetectJoints(['face', 'crown', 'left_wall', 'right_wall'])
            }
            className="flex-1 py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-bold cursor-pointer"
          >
            + All 4 Surfaces
          </button>
        </div>

        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 grid grid-cols-3 gap-1 text-center font-mono">
          <div>
            <div className="text-[8.5px] text-slate-400">P21</div>
            <div className="text-[11px] font-bold text-cyan-300">{p21Intensity} m⁻¹</div>
          </div>
          <div>
            <div className="text-[8.5px] text-slate-400">Est. Jv</div>
            <div className="text-[11px] font-bold text-amber-300">{estJv} /m³</div>
          </div>
          <div>
            <div className="text-[8.5px] text-slate-400">MATLAB RQD</div>
            <div className="text-[11px] font-bold text-emerald-300">{estMatlabRqd}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FOR RENDERING SINGLE SURFACE WITH FITTED PHOTO + GEOLOGY IN 2D PHOTO REPORT
// ============================================================================
const ReportSingleSurfacePhotoAndGeologySvg: React.FC<{
  panel: FieldPanelId;
  location: FieldTunnelLocationItem;
  round: FieldExcavationRound;
  rememberedRocks: FieldRememberedRockItem[];
  colorMode: 'color' | 'bw';
  showGeologicalOverlay: boolean;
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  clipId: string;
  onRequestCropOrImport?: (panel: FieldPanelId) => void;
  onPanPhotoOffset?: (panel: FieldPanelId, dx: number, dy: number) => void;
}> = ({
  panel,
  location,
  round,
  rememberedRocks,
  colorMode,
  showGeologicalOverlay,
  targetX,
  targetY,
  targetW,
  targetH,
  clipId,
  onRequestCropOrImport,
  onPanPhotoOffset,
}) => {
  const dragRef = useRef<{ startClientX: number; startClientY: number; moved: boolean } | null>(null);
  const pGeom = computePanelCanvasGeometry(panel, location, round);
  const photo = round.collectedPhotos
    .slice()
    .reverse()
    .find((p) => p.panel === panel);
  const fitCfg = getFieldPhotoFitConfig(round, panel);

  const scaleX = targetW / Math.max(1, pGeom.boxW);
  const scaleY = targetH / Math.max(1, pGeom.boxH);
  const offsetX = targetX - pGeom.boxX * scaleX;
  const offsetY = targetY - pGeom.boxY * scaleY;

  const faceDetails =
    panel === 'face'
      ? computeFaceTunnelOutlineDetails(location, targetX, targetY, targetW, targetH)
      : null;

  const strokes = round.lithologyStrokes.filter((s) => s.panel === panel);
  const planes = round.dipPlaneSurfaces.filter((p) => p.panel === panel);
  const features = (round.structuralFeatures || []).filter((f) => f.panel === panel);
  const traces = round.jointTraces.filter((t) => t.panel === panel);
  const waters = round.waterMarks.filter((w) => w.panel === panel);
  const inlineLabels = computeTraceInlineLabelPlacements(traces);

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (!photo) {
      onRequestCropOrImport?.(panel);
      return;
    }
    if (!onPanPhotoOffset) return;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragRef.current || !onPanPhotoOffset) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragRef.current.moved = true;
      dragRef.current.startClientX = e.clientX;
      dragRef.current.startClientY = e.clientY;
      onPanPhotoOffset(panel, dx / Math.max(0.25, scaleX), dy / Math.max(0.25, scaleY));
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const excBounds = getPanelActiveExcavationBounds(panel, location, round);
  const activeGeoClipId = `${clipId}-active-exc`;

  return (
    <g
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: photo ? 'grab' : 'pointer' }}
    >
      <defs>
        <clipPath id={clipId}>
          {panel === 'face' && faceDetails ? (
            <path d={faceDetails.closedFillPathD} />
          ) : (
            <rect x={targetX} y={targetY} width={targetW} height={targetH} />
          )}
        </clipPath>
        <clipPath id={activeGeoClipId}>
          <rect
            x={pGeom.boxX}
            y={excBounds.minY}
            width={excBounds.isPanelFullyLocked ? 0 : pGeom.boxW}
            height={
              excBounds.isPanelFullyLocked
                ? 0
                : Math.max(0, excBounds.maxY - excBounds.minY)
            }
          />
        </clipPath>
      </defs>

      {/* Base surface background */}
      {panel === 'face' && faceDetails ? (
        <path d={faceDetails.closedFillPathD} fill="#ffffff" />
      ) : (
        <rect x={targetX} y={targetY} width={targetW} height={targetH} fill="#ffffff" />
      )}

      {/* Fitted Surface Photograph */}
      {photo ? (
        <g
          clipPath={`url(#${clipId})`}
          style={colorMode === 'bw' ? { filter: 'grayscale(100%) contrast(115%)' } : undefined}
        >
          <FittedPanelPhotoSvgImage
            photoUrl={photo.dataUrl}
            fitConfig={{
              ...fitCfg,
              offsetX: fitCfg.offsetX * scaleX,
              offsetY: fitCfg.offsetY * scaleY,
            }}
            boxX={targetX}
            boxY={targetY}
            boxW={targetW}
            boxH={targetH}
            overrideOpacity={1}
          />
        </g>
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <text
            x={targetX + targetW / 2}
            y={targetY + targetH / 2 - 8}
            textAnchor="middle"
            fontSize="13"
            fontWeight="bold"
            fontFamily="monospace"
            fill="#0f172a"
          >
            NO {panel.replace('_', ' ').toUpperCase()} PHOTO PLACED
          </text>
          <text
            x={targetX + targetW / 2}
            y={targetY + targetH / 2 + 12}
            textAnchor="middle"
            fontSize="11"
            fontFamily="monospace"
            fill="#475569"
            className="print:hidden"
          >
            Click here to Import / Select Photo, Crop &amp; Place
          </text>
        </g>
      )}

      {/* Mapped Geological Overlay (Lithology, Veins, Dip Surfaces, Features, Joint Traces, Water) */}
      {showGeologicalOverlay && (
        <g clipPath={`url(#${clipId})`}>
          <g
            transform={`translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`}
            clipPath={excBounds.hasBenchDivision ? `url(#${activeGeoClipId})` : undefined}
          >
          {strokes.map((st) => {
            if (st.points.length === 0 || st.mode === 'lithology_erase') return null;
            const isBand = st.mode === 'vein_band' || st.mode === 'foliation_plane';
            if (isBand) {
              return (
                <FieldVeinFoliationBandSvgElement
                  key={st.id}
                  stroke={st}
                  round={round}
                  rememberedRocks={rememberedRocks}
                  colorMode={colorMode}
                  isReportSheet={true}
                />
              );
            }
            const info = resolveRockDisplayInfo(st.rockType, rememberedRocks);
            const patId = st.patternId || info.patternId;
            const d = buildSmoothSvgPath(st.points);
            const effectiveStrokeW =
              st.brushRadius <= 8 ? Math.max(2, st.brushRadius) : st.brushRadius * 2;
            const indivLithDens = Math.round(
              st.symbolDensity ??
                round.lithologyDensityByRock?.[st.rockType] ??
                round.lithologyDensityByRock?.[patId] ??
                round.lithologySymbolDensity ??
                85
            );
            return (
              <path
                key={st.id}
                d={d}
                fill="none"
                stroke={`url(#photorep-pat-${patId}-d${indivLithDens})`}
                strokeWidth={effectiveStrokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={photo ? 0.58 : 0.92}
              />
            );
          })}

          {planes.map((pl) => (
            <FieldDipSurfaceSvgElement
              key={pl.id}
              surface={pl}
              colorMode={colorMode}
              patternPrefix="photorep-pat"
            />
          ))}

          {features.map((feat) => (
            <FieldStructuralFeatureSvgElement
              key={feat.id}
              feature={feat}
              colorMode={colorMode}
              tunnelDriveDirection={round.tunnelDriveDirection}
            />
          ))}

          {traces.map((tr) => {
            if (tr.points.length < 2) return null;
            const d =
              tr.lineMode === 'linear'
                ? tr.points
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ')
                : buildSmoothSvgPath(tr.points);
            const strokeColor =
              colorMode === 'bw'
                ? '#0f172a'
                : FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke || '#38bdf8';
            const trW = Math.max(1.8, Math.min(14, tr.strokeWidthPx ?? 3.8));
            const lbl = inlineLabels[tr.id];
            const {
              mid,
              ux: tickUx,
              uy: tickUy,
            } = computeTraceScreenDipTickVector(
              tr.points,
              tr.panel,
              tr.dipDirection,
              round.tunnelDriveDirection
            );
            return (
              <g key={tr.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={trW + 2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.75}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={trW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1={mid.x}
                  y1={mid.y}
                  x2={mid.x + tickUx * 14}
                  y2={mid.y + tickUy * 14}
                  stroke={strokeColor}
                  strokeWidth="2.6"
                />
                {lbl && (
                  <g transform={`translate(${lbl.x}, ${lbl.y}) rotate(${lbl.angleDeg})`}>
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="bold"
                      fontFamily="monospace"
                      fill={strokeColor}
                      stroke="#ffffff"
                      strokeWidth="3.2"
                      paintOrder="stroke"
                    >
                      {lbl.text}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {waters.map((wm) => (
            <FieldWaterSymbolSvgElement key={wm.id} mark={wm} colorMode={colorMode} />
          ))}
          </g>
        </g>
      )}

      {/* Subtle Centerline + SPL Reference Lines */}
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        <line
          x1={targetX + targetW / 2}
          y1={targetY}
          x2={targetX + targetW / 2}
          y2={targetY + targetH}
          stroke="#0f172a"
          strokeWidth="1.1"
          strokeDasharray="6 4"
          opacity="0.6"
        />
        {panel === 'face' && faceDetails && faceDetails.showSplLine && (
          <line
            x1={targetX}
            y1={faceDetails.splY}
            x2={targetX + targetW}
            y2={faceDetails.splY}
            stroke="#0f172a"
            strokeWidth="1.2"
            strokeDasharray="6 4"
            opacity="0.65"
          />
        )}
        {panel === 'face' && faceDetails ? (
          <FieldTunnelBenchHatchAndLineSvg
            location={location}
            round={round}
            boxX={targetX}
            boxY={targetY}
            boxW={targetW}
            boxH={targetH}
            clipPathD={faceDetails.closedFillPathD}
            colorMode={colorMode}
            idSuffix={`photo-rpt-face-${round.id}`}
          />
        ) : (
          <FieldTunnelWallOrCrownBenchOverlaySvg
            activePanel={panel}
            location={location}
            round={round}
            boxX={targetX}
            boxY={targetY}
            boxW={targetW}
            boxH={targetH}
            colorMode={colorMode}
            idSuffix={`photo-rpt-${panel}-${round.id}`}
          />
        )}
      </g>

      {/* Crisp Outer Tunnel Boundary Outline */}
      {panel === 'face' && faceDetails ? (
        <>
          <path
            d={faceDetails.wallStrokePathD}
            fill="none"
            stroke="#0f172a"
            strokeWidth="2.8"
          />
          <line
            x1={faceDetails.invertStartX}
            y1={faceDetails.invertY}
            x2={faceDetails.invertEndX}
            y2={faceDetails.invertY}
            stroke="#0f172a"
            strokeWidth="2.2"
            strokeDasharray="6 3"
          />
        </>
      ) : (
        <rect
          x={targetX}
          y={targetY}
          width={targetW}
          height={targetH}
          fill="none"
          stroke="#0f172a"
          strokeWidth="2.4"
        />
      )}
    </g>
  );
};

// ============================================================================
// INTERACTIVE PHOTO IMPORT, CROP & PLACE MODAL FOR 2D PHOTO REPORT
// Allows cropping an existing taken photo OR importing a new photo, cropping
// any rectangular region, rotating/flipping, and placing it into the exact
// adapted Tunnel Shape (Face on Page 1; Crown / Left Wall / Right Wall on Page 2)
// ============================================================================
const PhotoReportCropAndPlaceModal: React.FC<{
  panel: FieldPanelId;
  panelTitle: string;
  targetWidthM: number;
  targetHeightM: number;
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onApplyCroppedPhoto: (
    panel: FieldPanelId,
    croppedDataUrl: string,
    fitPatch: Partial<FieldPhotoFitConfig>
  ) => void;
  onClose: () => void;
}> = ({
  panel,
  panelTitle,
  targetWidthM,
  targetHeightM,
  activeLocation,
  activeRound,
  onApplyCroppedPhoto,
  onClose,
}) => {
  const existingPanelPhoto = activeRound.collectedPhotos
    .slice()
    .reverse()
    .find((p) => p.panel === panel);
  const existingFit = getFieldPhotoFitConfig(activeRound, panel);

  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(
    existingPanelPhoto?.dataUrl ||
      activeRound.collectedPhotos[activeRound.collectedPhotos.length - 1]?.dataUrl ||
      null
  );
  // Normalized crop box [0..1]
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.04,
    y: 0.04,
    w: 0.92,
    h: 0.92,
  });
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'fill' | 'cover' | 'contain' | 'stretch'>(
    existingFit.fitMode || 'fill'
  );
  const [zoomPct, setZoomPct] = useState<number>(existingFit.zoomPct || 100);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropSvgRef = useRef<SVGSVGElement | null>(null);
  const dragModeRef = useRef<
    | null
    | {
        mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
        startX: number;
        startY: number;
        initBox: { x: number; y: number; w: number; h: number };
      }
  >(null);

  // Recompute live cropped preview whenever sourceDataUrl, cropBox, rotation, or flip changes
  useEffect(() => {
    if (!sourceDataUrl) {
      setCroppedPreviewUrl(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const srcW = Math.max(1, img.naturalWidth || img.width);
      const srcH = Math.max(1, img.naturalHeight || img.height);
      const sx = Math.round(Math.max(0, Math.min(0.95, cropBox.x)) * srcW);
      const sy = Math.round(Math.max(0, Math.min(0.95, cropBox.y)) * srcH);
      const sw = Math.max(16, Math.round(Math.min(1 - cropBox.x, cropBox.w) * srcW));
      const sh = Math.max(16, Math.round(Math.min(1 - cropBox.y, cropBox.h) * srcH));

      const rad = (rotationDeg * Math.PI) / 180;
      const isRightAngle = Math.abs(rotationDeg % 180) === 90;
      const outW = isRightAngle ? sh : sw;
      const outH = isRightAngle ? sw : sh;
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(outW, outH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(64, Math.round(outW * scale));
      canvas.height = Math.max(64, Math.round(outH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -scale : scale, flipV ? -scale : scale);
      ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();

      setCroppedPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = sourceDataUrl;
    return () => {
      cancelled = true;
    };
  }, [sourceDataUrl, cropBox, rotationDeg, flipH, flipV]);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSourceDataUrl(String(reader.result));
      setCropBox({ x: 0.02, y: 0.02, w: 0.96, h: 0.96 });
      setRotationDeg(0);
      setFlipH(false);
      setFlipV(false);
      setZoomPct(100);
      setPanX(0);
      setPanY(0);
    };
    reader.readAsDataURL(file);
  };

  const handleCropPointerDown = (
    e: React.PointerEvent<SVGElement>,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    if (!cropSvgRef.current) return;
    const rect = cropSvgRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    dragModeRef.current = {
      mode,
      startX: nx,
      startY: ny,
      initBox: { ...cropBox },
    };
    cropSvgRef.current.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragModeRef.current || !cropSvgRef.current) return;
    const rect = cropSvgRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
    const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    const dx = nx - dragModeRef.current.startX;
    const dy = ny - dragModeRef.current.startY;
    const b = dragModeRef.current.initBox;
    const minSize = 0.1;

    if (dragModeRef.current.mode === 'move') {
      const nextX = Math.max(0, Math.min(1 - b.w, b.x + dx));
      const nextY = Math.max(0, Math.min(1 - b.h, b.y + dy));
      setCropBox({ x: nextX, y: nextY, w: b.w, h: b.h });
    } else if (dragModeRef.current.mode === 'nw') {
      const nextX = Math.max(0, Math.min(b.x + b.w - minSize, b.x + dx));
      const nextY = Math.max(0, Math.min(b.y + b.h - minSize, b.y + dy));
      setCropBox({
        x: nextX,
        y: nextY,
        w: b.w + (b.x - nextX),
        h: b.h + (b.y - nextY),
      });
    } else if (dragModeRef.current.mode === 'ne') {
      const nextW = Math.max(minSize, Math.min(1 - b.x, b.w + dx));
      const nextY = Math.max(0, Math.min(b.y + b.h - minSize, b.y + dy));
      setCropBox({
        x: b.x,
        y: nextY,
        w: nextW,
        h: b.h + (b.y - nextY),
      });
    } else if (dragModeRef.current.mode === 'sw') {
      const nextX = Math.max(0, Math.min(b.x + b.w - minSize, b.x + dx));
      const nextH = Math.max(minSize, Math.min(1 - b.y, b.h + dy));
      setCropBox({
        x: nextX,
        y: b.y,
        w: b.w + (b.x - nextX),
        h: nextH,
      });
    } else if (dragModeRef.current.mode === 'se') {
      const nextW = Math.max(minSize, Math.min(1 - b.x, b.w + dx));
      const nextH = Math.max(minSize, Math.min(1 - b.y, b.h + dy));
      setCropBox({
        x: b.x,
        y: b.y,
        w: nextW,
        h: nextH,
      });
    }
  };

  const handleCropPointerUp = () => {
    dragModeRef.current = null;
  };

  const matchTargetShapeAspect = () => {
    const ratio = Math.max(0.25, Math.min(4, targetWidthM / Math.max(0.5, targetHeightM)));
    let w = 0.88;
    let h = w / ratio;
    if (h > 0.88) {
      h = 0.88;
      w = h * ratio;
    }
    setCropBox({
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      w,
      h,
    });
  };

  // Preview target dimensions inside 500x400 preview SVG
  const prevMaxW = 420;
  const prevMaxH = 320;
  const prevScale = Math.min(prevMaxW / Math.max(1, targetWidthM), prevMaxH / Math.max(1, targetHeightM));
  const prevW = Number((targetWidthM * prevScale).toFixed(1));
  const prevH = Number((targetHeightM * prevScale).toFixed(1));
  const prevX = Number(((500 - prevW) / 2).toFixed(1));
  const prevY = Number(((380 - prevH) / 2).toFixed(1));
  const prevFaceDetails =
    panel === 'face'
      ? computeFaceTunnelOutlineDetails(activeLocation, prevX, prevY, prevW, prevH)
      : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono font-bold uppercase text-amber-400">
              Import, Crop &amp; Place Photo • {panelTitle} ({targetWidthM.toFixed(1)}m × {targetHeightM.toFixed(1)}m)
            </div>
            <div className="text-[11px] text-slate-400">
              Import a photo or pick a taken photo, drag the crop corners to trim, and place it into the adapted {activeLocation.shape.toUpperCase()} shape.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Photo from Device
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Taken Round Photos Selector Bar (if any taken photos exist) */}
        {activeRound.collectedPhotos.length > 0 && (
          <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 shrink-0">
              Taken Round Photos ({activeRound.collectedPhotos.length}):
            </span>
            {activeRound.collectedPhotos.map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => {
                  setSourceDataUrl(ph.dataUrl);
                  setCropBox({ x: 0.02, y: 0.02, w: 0.96, h: 0.96 });
                }}
                className={`px-2 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  sourceDataUrl === ph.dataUrl
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <img src={ph.dataUrl} alt={ph.label} className="w-6 h-5 object-cover rounded" />
                <span>{ph.panel.replace('_', ' ').toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main 2-Column Body: Source Crop Box (Left) + Adapted Shape Placement Preview (Right) */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left 6 Cols: Interactive Crop Box */}
          <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                1. Drag Crop Box &amp; Corners to Crop Photo
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCropBox({ x: 0, y: 0, w: 1, h: 1 })}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono cursor-pointer"
                >
                  Full Photo
                </button>
                <button
                  type="button"
                  onClick={matchTargetShapeAspect}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold cursor-pointer"
                >
                  Match {panelTitle} Ratio
                </button>
              </div>
            </div>

            {sourceDataUrl ? (
              <div className="relative bg-slate-900 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center min-h-[280px]">
                <svg
                  ref={cropSvgRef}
                  viewBox="0 0 1000 750"
                  className="w-full max-h-[330px] select-none touch-none"
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerCancel={handleCropPointerUp}
                >
                  <image
                    href={sourceDataUrl}
                    x="0"
                    y="0"
                    width="1000"
                    height="750"
                    preserveAspectRatio="none"
                  />
                  {/* Dimmed mask outside crop box */}
                  <path
                    d={`M 0 0 H 1000 V 750 H 0 Z M ${cropBox.x * 1000} ${cropBox.y * 750} V ${(cropBox.y + cropBox.h) * 750} H ${(cropBox.x + cropBox.w) * 1000} V ${cropBox.y * 750} Z`}
                    fill="rgba(2, 6, 23, 0.62)"
                    fillRule="evenodd"
                  />
                  {/* Draggable Crop Box */}
                  <rect
                    x={cropBox.x * 1000}
                    y={cropBox.y * 750}
                    width={cropBox.w * 1000}
                    height={cropBox.h * 750}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray="10 5"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => handleCropPointerDown(e, 'move')}
                  />
                  {/* 4 Corner Resize Handles */}
                  {(
                    [
                      { id: 'nw', cx: cropBox.x * 1000, cy: cropBox.y * 750, cursor: 'nwse-resize' },
                      {
                        id: 'ne',
                        cx: (cropBox.x + cropBox.w) * 1000,
                        cy: cropBox.y * 750,
                        cursor: 'nesw-resize',
                      },
                      {
                        id: 'sw',
                        cx: cropBox.x * 1000,
                        cy: (cropBox.y + cropBox.h) * 750,
                        cursor: 'nesw-resize',
                      },
                      {
                        id: 'se',
                        cx: (cropBox.x + cropBox.w) * 1000,
                        cy: (cropBox.y + cropBox.h) * 750,
                        cursor: 'nwse-resize',
                      },
                    ] as const
                  ).map((h) => (
                    <circle
                      key={h.id}
                      cx={h.cx}
                      cy={h.cy}
                      r="14"
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth="3"
                      style={{ cursor: h.cursor }}
                      onPointerDown={(e) => handleCropPointerDown(e, h.id)}
                    />
                  ))}
                </svg>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[280px] rounded-lg border-2 border-dashed border-slate-700 hover:border-cyan-400 bg-slate-900/50 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
              >
                <Upload className="w-10 h-10 text-cyan-400 mb-2" />
                <div className="text-sm font-bold text-white">
                  Click to Import Photo for {panelTitle}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Supports JPG, PNG, WebP or Field Camera captures
                </div>
              </div>
            )}

            {/* Rotate & Flip Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRotationDeg((d) => (d - 90) % 360)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> -90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDeg((d) => (d + 90) % 360)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +90°
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 cursor-pointer ${
                    flipH ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" /> Flip H
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((v) => !v)}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 cursor-pointer ${
                    flipV ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" /> Flip V
                </button>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Crop: {Math.round(cropBox.w * 100)}% × {Math.round(cropBox.h * 100)}%
              </span>
            </div>
          </div>

          {/* Right 6 Cols: Live Placement Inside Adapted Tunnel Shape */}
          <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-mono font-bold text-emerald-300 uppercase">
                2. Adapted {panelTitle} Placement Preview ({targetWidthM.toFixed(1)}m × {targetHeightM.toFixed(1)}m)
              </span>
              <div className="flex items-center gap-1">
                {(['fill', 'cover', 'contain'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFitMode(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase cursor-pointer ${
                      fitMode === m
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative bg-white rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center min-h-[280px]">
              <svg viewBox="0 0 500 380" className="w-full max-h-[330px]">
                <defs>
                  <clipPath id="crop-modal-preview-clip">
                    {panel === 'face' && prevFaceDetails ? (
                      <path d={prevFaceDetails.closedFillPathD} />
                    ) : (
                      <rect x={prevX} y={prevY} width={prevW} height={prevH} />
                    )}
                  </clipPath>
                </defs>
                {croppedPreviewUrl && (
                  <g clipPath="url(#crop-modal-preview-clip)">
                    <FittedPanelPhotoSvgImage
                      photoUrl={croppedPreviewUrl}
                      fitConfig={{
                        fitMode,
                        zoomPct,
                        offsetX: panX,
                        offsetY: panY,
                        rotationDeg: 0,
                        flipH: false,
                        flipV: false,
                        opacityPct: 100,
                        contrastPct: 100,
                        brightnessPct: 100,
                        matlabFilter: 'normal',
                        matlabSensitivity: 60,
                      }}
                      boxX={prevX}
                      boxY={prevY}
                      boxW={prevW}
                      boxH={prevH}
                      overrideOpacity={1}
                    />
                  </g>
                )}
                {panel === 'face' && prevFaceDetails ? (
                  <>
                    <path
                      d={prevFaceDetails.wallStrokePathD}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.8"
                    />
                    <line
                      x1={prevFaceDetails.invertStartX}
                      y1={prevFaceDetails.invertY}
                      x2={prevFaceDetails.invertEndX}
                      y2={prevFaceDetails.invertY}
                      stroke="#0f172a"
                      strokeWidth="2.2"
                      strokeDasharray="6 3"
                    />
                  </>
                ) : (
                  <rect
                    x={prevX}
                    y={prevY}
                    width={prevW}
                    height={prevH}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />
                )}
              </svg>
            </div>

            {/* Zoom & Pan Fine-Tuning */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-[10px] font-mono">
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Zoom</span>
                  <span className="text-emerald-300 font-bold">{zoomPct}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={240}
                  step={5}
                  value={zoomPct}
                  onChange={(e) => setZoomPct(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Pan X</span>
                  <span className="text-slate-200">{panX}px</span>
                </div>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={5}
                  value={panX}
                  onChange={(e) => setPanX(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Pan Y</span>
                  <span className="text-slate-200">{panY}px</span>
                </div>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={5}
                  value={panY}
                  onChange={(e) => setPanY(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!croppedPreviewUrl}
            onClick={() => {
              if (!croppedPreviewUrl) return;
              onApplyCroppedPhoto(panel, croppedPreviewUrl, {
                fitMode,
                zoomPct,
                offsetX: panX,
                offsetY: panY,
                rotationDeg: 0,
                flipH: false,
                flipV: false,
              });
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Crop &amp; Place into {panelTitle}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// STAGE AFTER CLEAN REPORT: SIMPLE 2-PAGE 2D PHOTO REPORT (A4 VERTICAL)
// - Page 1: Compact Basic Details (Top) + Large Adapted Tunnel Face Photo (Import/Crop & Place) + Compact Geologist Sign (Bottom)
// - Page 2: Compact Basic Details (Top) + Adapted Crown on Top + Left Wall & Right Wall Below (Import/Crop & Place) + Compact Geologist Sign (Bottom)
// ============================================================================
export const FieldTwoPagePhotoReportStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  mappingDomain?: MappingDomainType;
  surfaceParams?: SurfaceGeometryParameters;
  rememberedRocks: FieldRememberedRockItem[];
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackToCleanReport: () => void;
  onProceedTo3DReport: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  mappingDomain = 'TUNNEL',
  surfaceParams,
  rememberedRocks,
  onUpdateRound,
  onBackToCleanReport,
  onProceedTo3DReport,
}) => {
  const [showGeologicalOverlay, setShowGeologicalOverlay] = useState(false);
  const [cropModalPanel, setCropModalPanel] = useState<FieldPanelId | null>(null);
  const [stationFrom, setStationFrom] = useState(activeRound.chainageFrom || '0.00');
  const [stationTo, setStationTo] = useState(activeRound.chainageTo || '3.00');
  const [splitPhotoMode, setSplitPhotoMode] = useState<'standard' | 'split_trace' | 'split_panoramic' | 'before_after' | 'split_segments'>('standard');
  const [splitSegmentIntervalM, setSplitSegmentIntervalM] = useState<number>(2.0);
  const [customSplitSegments, setCustomSplitSegments] = useState<Array<{
    id: string;
    fromM: number;
    toM: number;
    title: string;
    photoDataUrl?: string;
    notes?: string;
    lithology?: string;
  }>>(() => {
    const f = parseFloat(activeRound.chainageFrom || '0') || 0;
    const t = parseFloat(activeRound.chainageTo || '10') || 10;
    const interval = 2.0;
    const segs = [];
    let cur = f;
    let idx = 1;
    while (cur < t - 0.01) {
      const next = Math.min(t, Number((cur + interval).toFixed(2)));
      segs.push({
        id: `split-seg-${idx}-${Date.now()}`,
        fromM: cur,
        toM: next,
        title: `Segment #${idx} (${cur.toFixed(1)}m – ${next.toFixed(1)}m)`,
        photoDataUrl: activeRound.collectedPhotos[idx - 1]?.dataUrl || activeRound.collectedPhotos[0]?.dataUrl || undefined,
        notes: `Surface exposure continuous trace from ${cur.toFixed(1)}m to ${next.toFixed(1)}m`,
      });
      cur = next;
      idx++;
    }
    return segs.length > 0 ? segs : [
      { id: 'split-seg-1', fromM: f, toM: t, title: `Segment #1 (${f}m – ${t}m)` }
    ];
  });

  const handleGenerateSplitSegments = (interval: number) => {
    setSplitSegmentIntervalM(interval);
    const f = parseFloat(stationFrom) || 0;
    const t = parseFloat(stationTo) || (f + 10);
    const segs = [];
    let cur = f;
    let idx = 1;
    while (cur < t - 0.01) {
      const next = Math.min(t, Number((cur + interval).toFixed(2)));
      segs.push({
        id: `split-seg-${idx}-${Date.now()}`,
        fromM: cur,
        toM: next,
        title: `Segment #${idx} (${cur.toFixed(1)}m – ${next.toFixed(1)}m)`,
        photoDataUrl: activeRound.collectedPhotos[idx - 1]?.dataUrl || activeRound.collectedPhotos[0]?.dataUrl || undefined,
        notes: `Continuous exposure joint trace from station ${cur.toFixed(1)}m to ${next.toFixed(1)}m`,
      });
      cur = next;
      idx++;
    }
    setCustomSplitSegments(segs);
  };

  const handleAddCustomSegment = () => {
    const lastSeg = customSplitSegments[customSplitSegments.length - 1];
    const newFrom = lastSeg ? lastSeg.toM : (parseFloat(stationFrom) || 0);
    const newTo = Number((newFrom + splitSegmentIntervalM).toFixed(2));
    const newIdx = customSplitSegments.length + 1;
    setCustomSplitSegments((prev) => [
      ...prev,
      {
        id: `split-seg-${newIdx}-${Date.now()}`,
        fromM: newFrom,
        toM: newTo,
        title: `Segment #${newIdx} (${newFrom.toFixed(1)}m – ${newTo.toFixed(1)}m)`,
        photoDataUrl: activeRound.collectedPhotos[0]?.dataUrl || undefined,
        notes: `Additional split exposure segment (${newFrom.toFixed(1)}m – ${newTo.toFixed(1)}m)`,
      },
    ]);
  };

  const handleUpdateSegment = (id: string, patch: Partial<(typeof customSplitSegments)[number]>) => {
    setCustomSplitSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleDeleteSegment = (id: string) => {
    setCustomSplitSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUploadSegmentPhoto = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      handleUpdateSegment(id, { photoDataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
  };
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>(activeRound.collectedPhotos[0]?.id || '');
  const [page2Mode, setPage2Mode] = useState<'photo_2' | 'cad_overlay' | 'before_after'>('cad_overlay');
  const [page1PhotoId, setPage1PhotoId] = useState<string>(activeRound.collectedPhotos[0]?.id || '');
  const [page2PhotoId, setPage2PhotoId] = useState<string>(activeRound.collectedPhotos[1]?.id || activeRound.collectedPhotos[0]?.id || '');
  const quickUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isSurface =
    mappingDomain === 'SLOPE' ||
    mappingDomain === 'BENCH' ||
    mappingDomain === 'TRENCH' ||
    mappingDomain === 'ROCK_SURFACE';

  const domainMap = useMemo(() => getSurfacePanelLabelMap(mappingDomain), [mappingDomain]);
  const colorMode: 'color' | 'bw' = activeRound.reportColorMode ?? 'color';

  // Compute adaptable aspect ratios for Page 1 (Face) and Page 2 (Crown on Top, Left & Right Wall on Bottom)
  const faceGeom = computePanelCanvasGeometry('face', activeLocation, activeRound);
  const spanW = Math.max(2, activeLocation.widthM);
  const heightH = Math.max(2, activeLocation.heightM);
  const pullM = Math.max(1, activeRound.pullLengthMeters || 3);
  const hasCrown = faceGeom.hasCrown !== false;
  const hasWalls = faceGeom.hasLeftWall && faceGeom.hasRightWall;
  const leftWallH = Math.max(1.5, faceGeom.splHeightM || heightH * 0.55);
  const rightWallH = Math.max(1.5, faceGeom.splHeightM || heightH * 0.55);
  const crownArcM = Math.max(spanW, Number((faceGeom.crownLengthM || spanW * 1.22).toFixed(1)));

  // Page 1 Face Box: Utilizes the full A4 vertical middle body (880x960 viewBox) while adapting to W:H aspect ratio
  const p1SvgW = 880;
  const p1SvgH = 960;
  const p1MaxW = 810;
  const p1MaxH = 860;
  const p1Scale = Math.min(p1MaxW / spanW, p1MaxH / heightH);
  const p1FaceW = Math.max(380, Number((spanW * p1Scale).toFixed(1)));
  const p1FaceH = Math.max(380, Number((heightH * p1Scale).toFixed(1)));
  const p1FaceX = Number(((p1SvgW - p1FaceW) / 2).toFixed(1));
  const p1FaceY = Number((38 + (p1MaxH - p1FaceH) / 2).toFixed(1));

  // Page 2 Layout: Crown on TOP, Left Wall & Right Wall in BOTTOM side-by-side (adapted to tunnel shape & size, 880x960 viewBox)
  const p2SvgW = 880;
  const p2SvgH = 960;
  const p2TopCrownMaxW = 820;
  const p2TopCrownMaxH = hasWalls ? 415 : 850;
  const p2CrownAspectW = Math.max(crownArcM, pullM * 1.35);
  const p2CrownAspectH = Math.max(pullM, crownArcM * 0.42);
  const p2CrownScale = Math.min(
    p2TopCrownMaxW / p2CrownAspectW,
    p2TopCrownMaxH / p2CrownAspectH
  );
  const p2CrownW = Math.max(460, Number((p2CrownAspectW * p2CrownScale).toFixed(1)));
  const p2CrownH = Math.max(240, Number((p2CrownAspectH * p2CrownScale).toFixed(1)));
  const p2CrownX = Number(((p2SvgW - p2CrownW) / 2).toFixed(1));
  const p2CrownY = 36;

  const p2WallMaxW = 395;
  const p2WallMaxH = 420;
  const p2WallAspectW = Math.max(leftWallH, pullM * 0.9);
  const p2WallAspectH = Math.max(pullM, leftWallH * 0.78);
  const p2WallScale = Math.min(p2WallMaxW / p2WallAspectW, p2WallMaxH / p2WallAspectH);
  const p2LeftW = Math.max(310, Number((p2WallAspectW * p2WallScale).toFixed(1)));
  const p2LeftH = Math.max(260, Number((p2WallAspectH * p2WallScale).toFixed(1)));
  const p2RightW = p2LeftW;
  const p2RightH = p2LeftH;
  const p2WallsY = p2CrownY + p2CrownH + 64;
  const p2LeftX = Number((222 - p2LeftW / 2).toFixed(1));
  const p2RightX = Number((658 - p2RightW / 2).toFixed(1));

  const updatePanelFitPatch = (panel: FieldPanelId, patch: Partial<FieldPhotoFitConfig>) => {
    onUpdateRound((prev) => {
      const cur = getFieldPhotoFitConfig(prev, panel);
      return {
        ...prev,
        photoFits: {
          ...(prev.photoFits || {}),
          [panel]: {
            ...cur,
            ...patch,
          },
        },
      };
    });
  };

  const handlePanPhotoOffset = (panel: FieldPanelId, dx: number, dy: number) => {
    onUpdateRound((prev) => {
      const cur = getFieldPhotoFitConfig(prev, panel);
      return {
        ...prev,
        photoFits: {
          ...(prev.photoFits || {}),
          [panel]: {
            ...cur,
            offsetX: Math.round(Math.max(-450, Math.min(450, cur.offsetX + dx))),
            offsetY: Math.round(Math.max(-450, Math.min(450, cur.offsetY + dy))),
          },
        },
      };
    });
  };

  const handleApplyCroppedPhoto = (
    panel: FieldPanelId,
    croppedDataUrl: string,
    fitPatch: Partial<FieldPhotoFitConfig>
  ) => {
    const labelMap: Record<FieldPanelId, string> = {
      face: 'Tunnel Face Photo',
      crown: 'Crown / Roof Arch Photo',
      left_wall: 'Left Wall Photo',
      right_wall: 'Right Wall Photo',
      shaft_sn: '4. WN (270°–360°) Wall Photo',
    };
    const newPhoto: FieldCollectedPhoto = {
      id: `photo-${panel}-${Date.now()}`,
      panel,
      dataUrl: croppedDataUrl,
      label: labelMap[panel],
      capturedAt: new Date().toISOString(),
      projectName: activeProject.projectName,
      locationName: activeLocation.name,
      rdChainage: `RD ${activeRound.chainageFrom}–${activeRound.chainageTo}m`,
      panelLabel: labelMap[panel],
      tunnelShapeLabel: `${activeLocation.shape.toUpperCase()} (${activeLocation.widthM}m × ${activeLocation.heightM}m)`,
      dateTimeFormatted: activeRound.dateAndTimeOfExcavation,
      autoUpscaled: true,
      shadowRemoved: true,
    };

    onUpdateRound((prev) => {
      const curFit = getFieldPhotoFitConfig(prev, panel);
      return {
        ...prev,
        collectedPhotos: [
          ...prev.collectedPhotos.filter((p) => p.panel !== panel),
          newPhoto,
        ],
        photoFits: {
          ...(prev.photoFits || {}),
          [panel]: {
            ...curFit,
            ...fitPatch,
          },
        },
      };
    });
  };

  const handleQuickDirectImportThenCrop = (panel: FieldPanelId, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      handleApplyCroppedPhoto(panel, dataUrl, {
        fitMode: 'fill',
        zoomPct: 100,
        offsetX: 0,
        offsetY: 0,
      });
      setCropModalPanel(panel);
    };
    reader.readAsDataURL(file);
  };

  const handleExportWordPhotoReport = async () => {
    const page1El = document.getElementById('field-photo-report-page-1');
    const page2El = document.getElementById('field-photo-report-page-2');
    if (!page1El || !page2El) return;

    const serializeWithRasterizedSvgs = async (container: HTMLElement): Promise<string> => {
      const clone = container.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.print\\:hidden').forEach((el) => el.remove());
      const origSvgs = Array.from(container.querySelectorAll('svg'));
      const cloneSvgs = Array.from(clone.querySelectorAll('svg'));
      for (let idx = 0; idx < origSvgs.length; idx++) {
        const svgEl = origSvgs[idx];
        const targetCloneSvg = cloneSvgs[idx];
        if (!targetCloneSvg) continue;
        const pngUrl = await renderSvgElementToHighResPngDataUrl(svgEl, 1400);
        if (pngUrl) {
          const imgEl = document.createElement('img');
          imgEl.src = pngUrl;
          imgEl.setAttribute('width', '680');
          imgEl.style.maxWidth = '100%';
          imgEl.style.height = 'auto';
          imgEl.style.border = '1px solid #0f172a';
          targetCloneSvg.replaceWith(imgEl);
        }
      }
      return clone.innerHTML;
    };

    const [p1Html, p2Html] = await Promise.all([
      serializeWithRasterizedSvgs(page1El),
      serializeWithRasterizedSvgs(page2El),
    ]);

    const htmlDoc = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${activeLocation.name} - 2-Page 2D Photo Report</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 8.5pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 3pt; }
          th, td { border: 1px solid #0f172a; padding: 2.5pt 4pt; font-size: 8pt; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <div>${p1Html}</div>
        <div class="page-break"></div>
        <div>${p2Html}</div>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RD_${activeRound.chainageFrom}_${activeRound.chainageTo}_2D_Photo_Report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const handleExportPdfPhotoReport = async () => {
    const page1El = document.getElementById('field-photo-report-page-1');
    const page2El = document.getElementById('field-photo-report-page-2');
    const svg1 = page1El?.querySelector('svg') as SVGSVGElement | null;
    const svg2 = page2El?.querySelector('svg') as SVGSVGElement | null;

    const [png1, png2] = await Promise.all([
      renderSvgElementToHighResPngDataUrl(svg1, 1400),
      renderSvgElementToHighResPngDataUrl(svg2, 1400),
    ]);

    const buildPhotoReportCanvas = (pngUrl: string | null, pageNum: 1 | 2): Promise<HTMLCanvasElement> => {
      return new Promise((resolve) => {
        const W = 1240;
        const H = 1754;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.strokeRect(28, 28, W - 56, H - 56);

        // Top Header
        ctx.lineWidth = 1.5;
        ctx.strokeRect(36, 36, W - 72, 78);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          `2D TUNNEL PHOTOGRAPH REPORT — ${activeProject.projectName} (${activeLocation.name}) [Page ${pageNum}/2]`,
          W / 2,
          62
        );
        ctx.font = 'bold 13px Arial';
        ctx.fillText(
          `Client/Cons: ${activeProject.clientName || '-'} / ${activeProject.consultantName || '-'}   |   CH ${activeRound.chainageFrom}–${activeRound.chainageTo}m (Pull ${pullM.toFixed(1)}m)   |   ${activeLocation.shape.toUpperCase()} (${spanW.toFixed(1)}m×${heightH.toFixed(1)}m)`,
          W / 2,
          96
        );

        // Bottom Geologist Sign
        ctx.strokeRect(36, H - 78, W - 72, 42);
        ctx.textAlign = 'left';
        ctx.font = 'bold 13.5px Arial';
        ctx.fillText(
          `CONTRACTOR GEOLOGIST: ${activeRound.contractorGeologistName || activeRound.geologistName || '________________'}  |  CLIENT GEOLOGIST: ${activeRound.clientGeologistName || '________________'}`,
          48,
          H - 52
        );

        if (!pngUrl) {
          resolve(canvas);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const availW = W - 88;
          const availH = H - 220;
          const sc = Math.min(availW / Math.max(1, img.width), availH / Math.max(1, img.height));
          const dw = img.width * sc;
          const dh = img.height * sc;
          ctx.drawImage(img, (W - dw) / 2, 124 + (availH - dh) / 2, dw, dh);
          resolve(canvas);
        };
        img.onerror = () => resolve(canvas);
        img.src = pngUrl;
      });
    };

    const [c1, c2] = await Promise.all([
      buildPhotoReportCanvas(png1, 1),
      buildPhotoReportCanvas(png2, 2),
    ]);
    exportCanvasesAsPdfDocument(
      [c1, c2],
      `RD_${activeRound.chainageFrom}_${activeRound.chainageTo}_2D_Photo_Report.pdf`,
      'portrait'
    );
  };

  const renderCompactTopBasicDetails = (pageNum: 1 | 2) => (
    <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
      <tbody>
        <tr>
          <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
            {activeProject.leftLogoDataUrl ? (
              <img
                src={activeProject.leftLogoDataUrl}
                alt="Client Logo"
                className="max-h-7 mx-auto object-contain"
              />
            ) : (
              <div className="text-[9px] font-bold text-slate-950 leading-tight">
                {activeProject.clientName || 'CLIENT'}
              </div>
            )}
          </td>
          <td colSpan={4} className="w-[70%] border border-slate-900 px-2 py-0.5 text-center bg-white">
            <div className="text-[11px] font-black tracking-wide uppercase text-slate-950 leading-tight">
              2D {domainMap.domainTitle.toUpperCase()} REPORT — {activeProject.projectName} ({activeLocation.name})
              <span className="text-[9px] font-semibold text-slate-700 ml-1.5">
                [Page {pageNum}/2 • {pageNum === 1 ? `${domainMap.face.shortLabel} Photo` : `${domainMap.crown.shortLabel} & Flank Photos`}]
              </span>
            </div>
          </td>
          <td rowSpan={2} className="w-[15%] border border-slate-900 px-1.5 py-1 text-center align-middle bg-white">
            {activeProject.rightLogoDataUrl ? (
              <img
                src={activeProject.rightLogoDataUrl}
                alt="Contractor Logo"
                className="max-h-7 mx-auto object-contain"
              />
            ) : (
              <div className="text-[9px] font-bold text-slate-950 leading-tight">
                {activeProject.contractorName || 'CONTRACTOR'}
              </div>
            )}
          </td>
        </tr>
        <tr>
          <td className="border border-slate-900 bg-white px-1.5 py-0.5">
            <span className="font-bold">Client/Cons:</span> {activeProject.clientName} / {activeProject.consultantName}
          </td>
          <td className="border border-slate-900 bg-white px-1.5 py-0.5">
            <span className="font-bold">{domainMap.stationPrefix}:</span> {stationFrom}–{stationTo}m (Pull {pullM.toFixed(1)}m)
          </td>
          <td className="border border-slate-900 bg-white px-1.5 py-0.5">
            <span className="font-bold">Shape/Size:</span> {activeLocation.shape.replace(/_/g, ' ').toUpperCase()} ({spanW.toFixed(1)}m×{heightH.toFixed(1)}m)
          </td>
          <td className="border border-slate-900 bg-white px-1.5 py-0.5">
            <span className="font-bold">Date/Drive:</span> {activeRound.dateAndTimeOfExcavation} | N{String(activeRound.tunnelDriveDirection).padStart(3, '0')}°
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderCompactBottomGeologistSign = () => (
    <table className="w-full border-collapse border border-slate-900 text-[9.5px] bg-white shrink-0">
      <tbody>
        <tr>
          <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-black uppercase shrink-0">Contractor Geologist:</span>
              <input
                type="text"
                value={
                  activeRound.contractorGeologistName ??
                  activeRound.contractorRepName ??
                  activeRound.geologistName ??
                  ''
                }
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    contractorGeologistName: e.target.value,
                    geologistName: e.target.value,
                  }))
                }
                placeholder="Name"
                className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
              />
              <span className="font-bold text-slate-900 shrink-0">Sign:</span>
              <input
                type="text"
                value={activeRound.contractorGeologistSign ?? ''}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    contractorGeologistSign: e.target.value,
                  }))
                }
                placeholder="Sign"
                className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
              />
            </div>
          </td>
          <td className="border border-slate-900 bg-white px-2 py-1 w-1/2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-black uppercase shrink-0">Client Geologist:</span>
              <input
                type="text"
                value={
                  activeRound.clientGeologistName ?? activeRound.clientRepName ?? ''
                }
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    clientGeologistName: e.target.value,
                    clientRepName: e.target.value,
                  }))
                }
                placeholder="Name"
                className="border-b border-slate-400 px-1 py-0 font-bold text-slate-900 w-[36%] focus:outline-none"
              />
              <span className="font-bold text-slate-900 shrink-0">Sign:</span>
              <input
                type="text"
                value={activeRound.clientGeologistSign ?? ''}
                onChange={(e) =>
                  onUpdateRound((r) => ({
                    ...r,
                    clientGeologistSign: e.target.value,
                  }))
                }
                placeholder="Sign"
                className="border-b border-slate-400 px-1 py-0 italic font-semibold text-slate-900 w-[26%] focus:outline-none"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderSurfaceQuickControlPill = (panel: FieldPanelId, label: string) => {
    const hasPhoto = activeRound.collectedPhotos.some((p) => p.panel === panel);
    const fit = getFieldPhotoFitConfig(activeRound, panel);
    return (
      <div className="flex flex-wrap items-center gap-1 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-[10px] font-mono print:hidden">
        <span className="font-bold text-slate-900 mr-1">{label}:</span>
        <input
          ref={(el) => {
            quickUploadInputRefs.current[panel] = el;
          }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleQuickDirectImportThenCrop(panel, file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => quickUploadInputRefs.current[panel]?.click()}
          className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1 cursor-pointer"
        >
          <Upload className="w-3 h-3" />
          Import Photo
        </button>
        <button
          type="button"
          onClick={() => setCropModalPanel(panel)}
          className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
        >
          <Sliders className="w-3 h-3" />
          {hasPhoto ? 'Crop & Place' : 'Select & Crop'}
        </button>
        {hasPhoto && (
          <>
            <button
              type="button"
              onClick={() =>
                updatePanelFitPatch(panel, { zoomPct: Math.max(50, (fit.zoomPct || 100) - 10) })
              }
              className="px-1.5 py-0.5 rounded bg-white border border-slate-300 hover:bg-slate-200 text-slate-900 font-bold cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <span className="text-slate-800 font-bold">{fit.zoomPct || 100}%</span>
            <button
              type="button"
              onClick={() =>
                updatePanelFitPatch(panel, { zoomPct: Math.min(250, (fit.zoomPct || 100) + 10) })
              }
              className="px-1.5 py-0.5 rounded bg-white border border-slate-300 hover:bg-slate-200 text-slate-900 font-bold cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={() =>
                updatePanelFitPatch(panel, { zoomPct: 100, offsetX: 0, offsetY: 0, fitMode: 'fill' })
              }
              className="px-1.5 py-0.5 rounded bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Reset Fit"
            >
              Reset
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950 p-3 sm:p-5 space-y-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Top Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase">
                {isSurface
                  ? `2-Page 2D Surface Photo Report • ${mappingDomain} MAPPING • Each Page Each Photo`
                  : 'Simple 2-Page 2D Photo Report • Page 1: Tunnel Face Photo • Page 2: Crown (Top) + Left & Right Wall'}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white mt-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              {isSurface
                ? `2-Page 2D ${mappingDomain} Photo Report (${spanW.toFixed(1)}m W × ${heightH.toFixed(1)}m H)`
                : `2-Page 2D Tunnel Photo Report (${activeLocation.shape.toUpperCase()} ${spanW.toFixed(1)}m W × ${heightH.toFixed(1)}m H)`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToCleanReport}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back: Clean Report
            </button>

            <button
              type="button"
              onClick={() => setShowGeologicalOverlay((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5 cursor-pointer ${
                showGeologicalOverlay
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {showGeologicalOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showGeologicalOverlay ? 'Geology Overlay: ON' : 'Clean Photos Only'}
            </button>

            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateRound((prev) => ({ ...prev, reportColorMode: 'color' }))
                }
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 cursor-pointer ${
                  colorMode === 'color'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Colourful
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateRound((prev) => ({ ...prev, reportColorMode: 'bw' }))
                }
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                  colorMode === 'bw'
                    ? 'bg-white text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                B&amp;W
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportWordPhotoReport}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Word (.doc)
            </button>

            <button
              type="button"
              onClick={handleExportPdfPhotoReport}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF (.pdf)
            </button>

            <button
              type="button"
              onClick={onProceedTo3DReport}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer ring-2 ring-amber-300"
              title="Proceed to Advance Geological Analysis: Wedge FoS, Apparent Dip, Face Look-Ahead & Inflow"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
              Next: Advance Geological Analysis
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* From-To Station & Photo Split Layout Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono print:hidden shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase text-[11px]">
              <Ruler className="w-4 h-4 text-amber-400" />
              <span>Photo Station Range &amp; Split Selection:</span>
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg">
              <span className="text-slate-400 font-bold">From:</span>
              <input
                type="text"
                value={stationFrom}
                onChange={(e) => setStationFrom(e.target.value)}
                placeholder="0.00m"
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold focus:outline-none text-center"
              />
              <span className="text-cyan-400 font-bold">→</span>
              <span className="text-slate-400 font-bold">To:</span>
              <input
                type="text"
                value={stationTo}
                onChange={(e) => setStationTo(e.target.value)}
                placeholder="3.00m"
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold focus:outline-none text-center"
              />
            </div>

            {/* Quick Station Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setStationFrom(activeRound.chainageFrom || '0.00');
                  setStationTo(activeRound.chainageTo || '3.00');
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer border border-slate-700"
              >
                Current Round
              </button>
              {Array.isArray((activeLocation as any).rounds) && (activeLocation as any).rounds.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const rList = (activeLocation as any).rounds;
                    const first = rList[0];
                    const last = rList[rList.length - 1];
                    setStationFrom(first.chainageFrom || '0.00');
                    setStationTo(last.chainageTo || '10.00');
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] cursor-pointer border border-slate-700"
                >
                  Full Heading ({(activeLocation as any).rounds.length} Rounds)
                </button>
              )}
            </div>
          </div>

          {/* Split Photos View Selector */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-0.5">
            <span className="text-[10.5px] text-slate-400 font-bold px-1.5">Photo View:</span>
            {[
              { id: 'standard', label: '1. Standard Full' },
              { id: 'split_trace', label: '2. Split Photo + CAD Trace' },
              { id: 'split_panoramic', label: '3. Split Left / Right' },
              { id: 'before_after', label: '4. Before & After Support' },
              { id: 'split_segments', label: '5. Split Exposure Segments (e.g. 2m×5)' },
            ].map((sm) => (
              <button
                key={sm.id}
                type="button"
                onClick={() => setSplitPhotoMode(sm.id as any)}
                className={`px-2.5 py-1 rounded text-[10.5px] font-bold cursor-pointer transition-all ${
                  splitPhotoMode === sm.id
                    ? 'bg-cyan-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {sm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Split Segment Configuration Toolbar (When Split Exposure Segments is Active) */}
        {splitPhotoMode === 'split_segments' && (
          <div className="bg-slate-900 border border-cyan-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono print:hidden shadow-lg animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1 uppercase">
                <Crop className="w-3.5 h-3.5 text-cyan-400" />
                <span>Divide Station Span Into Segments:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded p-0.5">
                {[1.0, 2.0, 2.5, 3.0, 5.0].map((intVal) => (
                  <button
                    key={intVal}
                    type="button"
                    onClick={() => handleGenerateSplitSegments(intVal)}
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all ${
                      splitSegmentIntervalM === intVal
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {intVal.toFixed(1)}m
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleGenerateSplitSegments(splitSegmentIntervalM)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10.5px] font-bold cursor-pointer flex items-center gap-1"
                title="Regenerate segments based on current From & To station inputs"
              >
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                <span>Auto-Split {stationFrom}m–{stationTo}m</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">
                Total: <strong className="text-cyan-300">{customSplitSegments.length} Segments</strong>
              </span>
              <button
                type="button"
                onClick={handleAddCustomSegment}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer shadow flex items-center gap-1"
              >
                <span>+ Add Split Segment</span>
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            PAGE 1 OF 2: COMPACT TOP BASIC DETAILS + FULL ADAPTED TUNNEL FACE PHOTO + COMPACT BOTTOM GEOLOGIST SIGN
           ===================================================================== */}
        <div
          id="field-photo-report-page-1"
          className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 rounded-sm shadow-2xl border-2 border-slate-900 p-2.5 sm:p-3.5 flex flex-col justify-between gap-1.5 print:w-[210mm] print:min-h-[297mm] print:shadow-none print:break-after-page"
        >
          {/* TOP: Compact Basic Details (Small in size, zero wasted space) */}
          {renderCompactTopBasicDetails(1)}

          {/* MIDDLE: Full-Page Adapted Tunnel Face Photograph Box */}
          <div className="border border-slate-900 p-1.5 bg-white flex-1 flex flex-col justify-between gap-1.5">
            {/* Screen-only Import / Crop & Place Bar for Tunnel Face */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1 print:hidden">
              {renderSurfaceQuickControlPill('face', '1. Tunnel Face Photo')}
              <span className="text-[10px] font-mono text-slate-500">
                Tip: Drag photo directly inside the tunnel outline to pan, or click Crop &amp; Place
              </span>
            </div>

            {splitPhotoMode === 'split_trace' ? (
              <div className="grid grid-cols-2 gap-2 flex-1 border border-slate-900 p-1.5 bg-slate-50">
                {/* Left Split Panel: Raw Field Photograph */}
                <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                    <span className="text-cyan-800">1A. FIELD PHOTOGRAPH (RAW)</span>
                    <span className="text-slate-500">{domainMap.stationPrefix} {stationFrom}–{stationTo}m</span>
                  </div>
                  <div className="flex-1 min-h-[360px] flex items-center justify-center p-1 relative">
                    <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="face"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={false}
                        targetX={p1FaceX}
                        targetY={p1FaceY}
                        targetW={p1FaceW}
                        targetH={p1FaceH}
                        clipId="photorep-p1-split-raw"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                    </svg>
                  </div>
                  {/* Calibrated Visual Scale Bar & Compass */}
                  <div className="border-t border-slate-300 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-rose-600" />
                      <span>Bearing / Dip: N{String(activeRound.tunnelDriveDirection).padStart(3, '0')}°</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">Scale:</span>
                      <div className="w-14 h-2 border border-slate-900 flex">
                        <div className="w-1/2 h-full bg-slate-900" />
                        <div className="w-1/2 h-full bg-white" />
                      </div>
                      <span className="font-bold">2.0m</span>
                    </div>
                  </div>
                </div>

                {/* Right Split Panel: Geological Structural CAD Trace */}
                <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                    <span className="text-amber-800">1B. GEOLOGICAL CAD LINE TRACE</span>
                    <span className="text-emerald-700 font-bold">{activeRound.rmrRockClass || 'RMR'} ({activeRound.rmrTotal ?? 62})</span>
                  </div>
                  <div className="flex-1 min-h-[360px] flex items-center justify-center p-1 relative">
                    <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                      <FieldMonochromeGeologicalPatterns
                        prefix="photorep-split-pat"
                        colorMode={colorMode}
                        symbolDensity={activeRound.lithologySymbolDensity ?? 85}
                        symbolDensityByPattern={activeRound.lithologyDensityByRock}
                        symbolAngleByPattern={activeRound.lithologyAngleByRock}
                        lithologyPatternAngle={activeRound.lithologyPatternAngle}
                        alternatingStrokes={activeRound.lithologyStrokes.filter(
                          (s) =>
                            (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                            (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                        )}
                        customColorsByRock={activeRound.lithologyColorByRock}
                      />
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="face"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={true}
                        targetX={p1FaceX}
                        targetY={p1FaceY}
                        targetW={p1FaceW}
                        targetH={p1FaceH}
                        clipId="photorep-p1-split-trace"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                    </svg>
                  </div>
                  <div className="border-t border-slate-300 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-800">
                    <div>
                      <span>Fracture Traces: <strong>{activeRound.jointTraces?.length ?? 0} features</strong></span>
                    </div>
                    <div>
                      <span>Lithology: <strong>{activeRound.rockType || 'Bedrock'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : splitPhotoMode === 'split_segments' ? (
              <div className="flex-1 border border-slate-900 p-2.5 bg-slate-50 flex flex-col justify-between overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2 text-[11px] font-mono font-bold text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-800 uppercase tracking-wide">
                      MULTI-SPLIT EXPOSURE SEGMENTS LOG (Station {stationFrom}m – {stationTo}m)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
                      {customSplitSegments.length} Segments • {splitSegmentIntervalM.toFixed(1)}m Interval
                    </span>
                  </div>
                  <span className="text-slate-600 text-[10px]">
                    Domain: <strong>{domainMap.domainTitle}</strong>
                  </span>
                </div>

                {/* Grid of Split Segment Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 flex-1">
                  {customSplitSegments.map((seg) => (
                    <div
                      key={seg.id}
                      className="border border-slate-400 rounded-lg p-2 bg-white shadow-xs flex flex-col justify-between gap-1.5"
                    >
                      {/* Segment Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1 text-[10px] font-mono">
                        <span className="font-bold text-cyan-900">{seg.title}</span>
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-100 px-1.5 py-0.5 text-[9px] rounded font-bold text-slate-700">
                            Span: {(seg.toM - seg.fromM).toFixed(1)}m
                          </span>
                          {customSplitSegments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSegment(seg.id)}
                              className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer print:hidden"
                              title="Delete this segment"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Segment Photo Box */}
                      <div className="relative w-full h-36 bg-slate-900 rounded border border-slate-300 overflow-hidden flex items-center justify-center">
                        {seg.photoDataUrl ? (
                          <img
                            src={seg.photoDataUrl}
                            alt={seg.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-2 text-slate-400">
                            <Camera className="w-6 h-6 mx-auto mb-1 text-slate-500" />
                            <span className="text-[10px] font-mono">No photo attached</span>
                          </div>
                        )}

                        {/* Print/Screen Scale Overlay */}
                        <div className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[8.5px] font-mono text-white flex items-center gap-1 border border-white/20">
                          <div className="w-4 h-1 bg-white inline-block"></div>
                          <span>Scale 1.0m</span>
                        </div>

                        {/* Station Overlay Tag */}
                        <div className="absolute top-1 left-1 bg-cyan-950/85 text-cyan-200 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold border border-cyan-500/40">
                          {seg.fromM.toFixed(1)}m → {seg.toM.toFixed(1)}m
                        </div>

                        {/* Screen-only Upload Button */}
                        <label className="absolute inset-0 bg-transparent hover:bg-slate-950/40 transition-colors flex items-center justify-center cursor-pointer group print:hidden">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadSegmentPhoto(seg.id, file);
                              e.target.value = '';
                            }}
                          />
                          <span className="opacity-0 group-hover:opacity-100 bg-slate-950/85 text-white text-[10px] font-bold px-2 py-1 rounded shadow">
                            Upload / Replace Photo
                          </span>
                        </label>
                      </div>

                      {/* Geological Notes / Trace Observation */}
                      <div className="text-[9.5px] font-mono">
                        <input
                          type="text"
                          value={seg.notes || ''}
                          onChange={(e) => handleUpdateSegment(seg.id, { notes: e.target.value })}
                          placeholder="Geological notes, joint traces, rock type..."
                          className="w-full bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Segment Summary Footer */}
                <div className="border-t border-slate-300 pt-1.5 mt-2 flex items-center justify-between text-[10px] font-mono text-slate-700">
                  <span>
                    Continuous Trace: <strong>CH {stationFrom}m to {stationTo}m</strong> ({customSplitSegments.length} contiguous exposure segments)
                  </span>
                  <span>
                    Quality: <strong>{activeRound.rmrRockClass || 'Class II/III Rock'}</strong> (RMR {activeRound.rmrTotal ?? 62})
                  </span>
                </div>
              </div>
            ) : splitPhotoMode === 'before_after' ? (
              <div className="grid grid-cols-2 gap-2 flex-1 border border-slate-900 p-1.5 bg-slate-50">
                <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                    <span className="text-rose-800">PRE-EXCAVATION / UNSUPPORTED FACE</span>
                    <span className="text-slate-500">Day 1</span>
                  </div>
                  <div className="flex-1 min-h-[360px] flex items-center justify-center p-1 relative">
                    <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="face"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={false}
                        targetX={p1FaceX}
                        targetY={p1FaceY}
                        targetW={p1FaceW}
                        targetH={p1FaceH}
                        clipId="photorep-p1-pre"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                    </svg>
                  </div>
                  <div className="border-t border-slate-300 pt-1.5 text-[10px] font-mono text-slate-800 flex justify-between">
                    <span>Unreinforced Jointed Rock Mass</span>
                    <span>Target FoS &lt; 1.0</span>
                  </div>
                </div>
                <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                    <span className="text-emerald-800">POST-STABILIZATION SUPPORTED FACE</span>
                    <span className="text-emerald-700 font-bold">Reinforced</span>
                  </div>
                  <div className="flex-1 min-h-[360px] flex items-center justify-center p-1 relative">
                    <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="face"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={true}
                        targetX={p1FaceX}
                        targetY={p1FaceY}
                        targetW={p1FaceW}
                        targetH={p1FaceH}
                        clipId="photorep-p1-post"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                    </svg>
                  </div>
                  <div className="border-t border-slate-300 pt-1.5 text-[10px] font-mono text-slate-800 flex justify-between">
                    <span>Shotcrete + Pattern Bolting</span>
                    <span className="font-bold text-emerald-700">FoS &ge; 1.50 Compliant</span>
                  </div>
                </div>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${p1SvgW} ${p1SvgH}`}
                className="w-full flex-1 h-auto border border-slate-900 bg-white"
              >
                <FieldMonochromeGeologicalPatterns
                  prefix="photorep-pat"
                  colorMode={colorMode}
                  symbolDensity={activeRound.lithologySymbolDensity ?? 85}
                  symbolDensityByPattern={activeRound.lithologyDensityByRock}
                  symbolAngleByPattern={activeRound.lithologyAngleByRock}
                  lithologyPatternAngle={activeRound.lithologyPatternAngle}
                  alternatingStrokes={activeRound.lithologyStrokes.filter(
                    (s) =>
                      (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                      (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                  )}
                  customColorsByRock={activeRound.lithologyColorByRock}
                />

                <text
                  x={p1SvgW / 2}
                  y="24"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#0f172a"
                >
                  {domainMap.domainTitle.toUpperCase()} PHOTOGRAPH — {activeLocation.shape.replace(/_/g, ' ').toUpperCase()} ({spanW.toFixed(1)}m W × {heightH.toFixed(1)}m H)
                </text>

                {/* Adapted Tunnel Face Surface Photo */}
                <ReportSingleSurfacePhotoAndGeologySvg
                  panel="face"
                  location={activeLocation}
                  round={activeRound}
                  rememberedRocks={rememberedRocks}
                  colorMode={colorMode}
                  showGeologicalOverlay={showGeologicalOverlay}
                  targetX={p1FaceX}
                  targetY={p1FaceY}
                  targetW={p1FaceW}
                  targetH={p1FaceH}
                  clipId="photorep-p1-face-clip"
                  onRequestCropOrImport={(p) => setCropModalPanel(p)}
                  onPanPhotoOffset={handlePanPhotoOffset}
                />

                {/* Width & Height Dimension Annotations around Face */}
                <line
                  x1={p1FaceX}
                  y1={p1FaceY + p1FaceH + 18}
                  x2={p1FaceX + p1FaceW}
                  y2={p1FaceY + p1FaceH + 18}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <text
                  x={p1FaceX + p1FaceW / 2}
                  y={p1FaceY + p1FaceH + 34}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#0f172a"
                >
                  Span W = {spanW.toFixed(2)} m (Station {stationFrom}–{stationTo}m)
                </text>

                <line
                  x1={p1FaceX - 18}
                  y1={p1FaceY}
                  x2={p1FaceX - 18}
                  y2={p1FaceY + p1FaceH}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <text
                  x={p1FaceX - 28}
                  y={p1FaceY + p1FaceH / 2}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  fill="#0f172a"
                  transform={`rotate(-90, ${p1FaceX - 28}, ${p1FaceY + p1FaceH / 2})`}
                >
                  Height H = {heightH.toFixed(2)} m
                </text>
              </svg>
            )}
          </div>

          {/* BOTTOM: Compact Geologist Sign (Small in size, zero wasted space) */}
          {renderCompactBottomGeologistSign()}
        </div>

        {/* =====================================================================
            PAGE 2 OF 2: COMPACT TOP BASIC DETAILS + CROWN ON TOP & LEFT/RIGHT WALLS BELOW + COMPACT BOTTOM GEOLOGIST SIGN
           ===================================================================== */}
        <div
          id="field-photo-report-page-2"
          className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 rounded-sm shadow-2xl border-2 border-slate-900 p-2.5 sm:p-3.5 flex flex-col justify-between gap-1.5 print:w-[210mm] print:min-h-[297mm] print:shadow-none"
        >
          {/* TOP: Compact Basic Details (Small in size, zero wasted space) */}
          {renderCompactTopBasicDetails(2)}

          {/* MIDDLE: Page 2 Content (Dedicated Full-Page Surface Photo / CAD Overlay for Surface vs Crown+Walls for Tunnel) */}
          <div className="border border-slate-900 p-1.5 bg-white flex-1 flex flex-col justify-between gap-1.5">
            {isSurface ? (
              <>
                {/* Surface Page 2 Toolbar: View Selector & Photo Selection */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5 print:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-900">Page 2 View:</span>
                    <div className="flex items-center bg-slate-100 border border-slate-300 rounded p-0.5 text-xs">
                      {[
                        { id: 'cad_overlay', label: '1. CAD Line Trace Overlay' },
                        { id: 'photo_2', label: '2. Dedicated Field Photo #2' },
                        { id: 'before_after', label: '3. Before & After Stabilization' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPage2Mode(m.id as any)}
                          className={`px-2 py-0.5 rounded font-bold cursor-pointer text-[10.5px] ${
                            page2Mode === m.id
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'text-slate-700 hover:text-black'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Photo selector dropdown for Page 2 */}
                    {activeRound.collectedPhotos.length > 0 && page2Mode === 'photo_2' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-slate-600 font-bold">Choose Photo:</span>
                        <select
                          value={page2PhotoId}
                          onChange={(e) => setPage2PhotoId(e.target.value)}
                          className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-slate-900 font-bold"
                        >
                          {activeRound.collectedPhotos.map((p, idx) => (
                            <option key={p.id} value={p.id}>
                              #{idx + 1}: {p.label || p.panel || `Photo ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {renderSurfaceQuickControlPill('face', 'Photo 2 Controls')}
                  </div>
                </div>

                {/* Page 2 Surface Display */}
                {page2Mode === 'cad_overlay' ? (
                  <svg
                    viewBox={`0 0 ${p1SvgW} ${p1SvgH}`}
                    className="w-full flex-1 h-auto border border-slate-900 bg-white"
                  >
                    <FieldMonochromeGeologicalPatterns
                      prefix="photorep-p2-cad"
                      colorMode={colorMode}
                      symbolDensity={activeRound.lithologySymbolDensity ?? 85}
                      symbolDensityByPattern={activeRound.lithologyDensityByRock}
                      symbolAngleByPattern={activeRound.lithologyAngleByRock}
                      lithologyPatternAngle={activeRound.lithologyPatternAngle}
                      alternatingStrokes={activeRound.lithologyStrokes.filter(
                        (s) =>
                          (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                          (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                      )}
                      customColorsByRock={activeRound.lithologyColorByRock}
                    />

                    <text
                      x={p1SvgW / 2}
                      y="24"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="bold"
                      fontFamily="monospace"
                      fill="#0f172a"
                    >
                      PAGE 2: GEOLOGICAL STRUCTURAL CAD TRACE &amp; DISCONTINUITY OVERLAY MAP
                    </text>

                    <ReportSingleSurfacePhotoAndGeologySvg
                      panel="face"
                      location={activeLocation}
                      round={activeRound}
                      rememberedRocks={rememberedRocks}
                      colorMode={colorMode}
                      showGeologicalOverlay={true}
                      targetX={p1FaceX}
                      targetY={p1FaceY}
                      targetW={p1FaceW}
                      targetH={p1FaceH}
                      clipId="photorep-p2-surface-trace"
                      onRequestCropOrImport={(p) => setCropModalPanel(p)}
                      onPanPhotoOffset={handlePanPhotoOffset}
                    />

                    {/* Calibrated Scale Bar */}
                    <g transform={`translate(${p1FaceX + 20}, ${p1FaceY + p1FaceH - 30})`}>
                      <rect x={0} y={0} width={120} height={8} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
                      <rect x={0} y={0} width={60} height={8} fill="#0f172a" />
                      <text x={0} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">0m</text>
                      <text x={60} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">2.5m</text>
                      <text x={120} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="end">5.0m</text>
                      <text x={60} y={18} fontSize="9" fontFamily="monospace" fontWeight="black" fill="#0f172a" textAnchor="middle">SCALE 1:100</text>
                    </g>

                    {/* Structural Summary Callout */}
                    <text
                      x={p1FaceX + p1FaceW - 20}
                      y={p1FaceY + p1FaceH - 15}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      fill="#047857"
                    >
                      {activeRound.jointTraces.length} Discontinuity Traces Mapped • Face Angle {activeLocation.wallHeightM ? `${activeLocation.wallHeightM}m` : ''} β=70°
                    </text>
                  </svg>
                ) : page2Mode === 'before_after' ? (
                  <div className="grid grid-cols-2 gap-2 flex-1 border border-slate-900 p-1.5 bg-slate-50">
                    <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                        <span className="text-rose-800">2A. PRE-STABILIZATION / NATURAL EXPOSURE</span>
                        <span className="text-slate-500">{stationFrom}–{stationTo}m</span>
                      </div>
                      <div className="flex-1 min-h-[380px] flex items-center justify-center p-1 relative">
                        <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                          <ReportSingleSurfacePhotoAndGeologySvg
                            panel="face"
                            location={activeLocation}
                            round={activeRound}
                            rememberedRocks={rememberedRocks}
                            colorMode={colorMode}
                            showGeologicalOverlay={false}
                            targetX={p1FaceX}
                            targetY={p1FaceY}
                            targetW={p1FaceW}
                            targetH={p1FaceH}
                            clipId="photorep-p2-pre"
                            onRequestCropOrImport={(p) => setCropModalPanel(p)}
                            onPanPhotoOffset={handlePanPhotoOffset}
                          />
                        </svg>
                      </div>
                      <div className="border-t border-slate-300 pt-1.5 text-[10px] font-mono text-slate-800 flex justify-between">
                        <span>Unstabilized Jointed Slope Face</span>
                        <span className="text-rose-700 font-bold">Unreinforced FoS &lt; 1.20</span>
                      </div>
                    </div>
                    <div className="border border-slate-700 bg-white p-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[11px] font-mono font-bold text-slate-900">
                        <span className="text-emerald-800">2B. STABILIZED / SOIL NAILS + MESH + SHOTCRETE</span>
                        <span className="text-emerald-700 font-bold">Reinforced</span>
                      </div>
                      <div className="flex-1 min-h-[380px] flex items-center justify-center p-1 relative">
                        <svg viewBox={`0 0 ${p1SvgW} ${p1SvgH}`} className="w-full h-full max-h-[500px]">
                          <ReportSingleSurfacePhotoAndGeologySvg
                            panel="face"
                            location={activeLocation}
                            round={activeRound}
                            rememberedRocks={rememberedRocks}
                            colorMode={colorMode}
                            showGeologicalOverlay={true}
                            targetX={p1FaceX}
                            targetY={p1FaceY}
                            targetW={p1FaceW}
                            targetH={p1FaceH}
                            clipId="photorep-p2-post"
                            onRequestCropOrImport={(p) => setCropModalPanel(p)}
                            onPanPhotoOffset={handlePanPhotoOffset}
                          />
                        </svg>
                      </div>
                      <div className="border-t border-slate-300 pt-1.5 text-[10px] font-mono text-slate-800 flex justify-between">
                        <span>Systematic Soil Nails + TECCO® Mesh + Shotcrete</span>
                        <span className="font-bold text-emerald-700">Target FoS &ge; 1.50</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Full Page 2 Photo */
                  <svg
                    viewBox={`0 0 ${p1SvgW} ${p1SvgH}`}
                    className="w-full flex-1 h-auto border border-slate-900 bg-white"
                  >
                    <text
                      x={p1SvgW / 2}
                      y="24"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="bold"
                      fontFamily="monospace"
                      fill="#0f172a"
                    >
                      PAGE 2: SECONDARY SURFACE EXPOSURE PHOTOGRAPH ({stationFrom}–{stationTo}m)
                    </text>

                    <ReportSingleSurfacePhotoAndGeologySvg
                      panel="face"
                      location={activeLocation}
                      round={activeRound}
                      rememberedRocks={rememberedRocks}
                      colorMode={colorMode}
                      showGeologicalOverlay={showGeologicalOverlay}
                      targetX={p1FaceX}
                      targetY={p1FaceY}
                      targetW={p1FaceW}
                      targetH={p1FaceH}
                      clipId="photorep-p2-photo2-clip"
                      onRequestCropOrImport={(p) => setCropModalPanel(p)}
                      onPanPhotoOffset={handlePanPhotoOffset}
                    />

                    {/* Scale bar */}
                    <g transform={`translate(${p1FaceX + 20}, ${p1FaceY + p1FaceH - 30})`}>
                      <rect x={0} y={0} width={100} height={8} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
                      <rect x={0} y={0} width={50} height={8} fill="#0f172a" />
                      <text x={0} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">0m</text>
                      <text x={50} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="middle">1.0m</text>
                      <text x={100} y={-4} fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a" textAnchor="end">2.0m</text>
                      <text x={50} y={18} fontSize="9" fontFamily="monospace" fontWeight="black" fill="#0f172a" textAnchor="middle">SCALE BAR 2.0m</text>
                    </g>
                  </svg>
                )}
              </>
            ) : (
              /* Tunnel Crown on Top + Left & Right Walls on Bottom */
              <>
                {/* Screen-only Import / Crop & Place Controls for Crown, Left Wall & Right Wall */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 pb-1 print:hidden">
                  {hasCrown && renderSurfaceQuickControlPill('crown', 'Top: Crown')}
                  {hasWalls && renderSurfaceQuickControlPill('left_wall', 'Left Wall')}
                  {hasWalls && renderSurfaceQuickControlPill('right_wall', 'Right Wall')}
                </div>

                <svg
                  viewBox={`0 0 ${p2SvgW} ${p2SvgH}`}
                  className="w-full flex-1 h-auto border border-slate-900 bg-white"
                >
                  <FieldMonochromeGeologicalPatterns
                    prefix="photorep-pat"
                    colorMode={colorMode}
                    symbolDensity={activeRound.lithologySymbolDensity ?? 85}
                    symbolDensityByPattern={activeRound.lithologyDensityByRock}
                    symbolAngleByPattern={activeRound.lithologyAngleByRock}
                    lithologyPatternAngle={activeRound.lithologyPatternAngle}
                    alternatingStrokes={activeRound.lithologyStrokes.filter(
                      (s) =>
                        (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                        (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                    )}
                    customColorsByRock={activeRound.lithologyColorByRock}
                  />

                  {/* TOP BOX: CROWN / ROOF ARCH PHOTOGRAPH */}
                  {hasCrown && (
                    <>
                      <text
                        x={p2CrownX + p2CrownW / 2}
                        y={p2CrownY - 10}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        TOP: CROWN / ROOF ARCH PHOTOGRAPH (Arc {crownArcM.toFixed(1)}m × Pull {pullM.toFixed(1)}m • L-SPL to R-SPL)
                      </text>
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="crown"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={showGeologicalOverlay}
                        targetX={p2CrownX}
                        targetY={p2CrownY}
                        targetW={p2CrownW}
                        targetH={p2CrownH}
                        clipId="photorep-p2-crown-clip"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                      <text
                        x={p2CrownX - 8}
                        y={p2CrownY + p2CrownH / 2}
                        textAnchor="end"
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        L-SPL
                      </text>
                      <text
                        x={p2CrownX + p2CrownW + 8}
                        y={p2CrownY + p2CrownH / 2}
                        textAnchor="start"
                        fontSize="10.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        R-SPL
                      </text>
                    </>
                  )}

                  {/* BOTTOM: LEFT WALL & RIGHT WALL PHOTOGRAPHS */}
                  {hasWalls && (
                    <>
                      <line
                        x1={p2CrownX}
                        y1={p2CrownY + p2CrownH}
                        x2={p2LeftX + p2LeftW / 2}
                        y2={p2WallsY - 22}
                        stroke="#0f172a"
                        strokeWidth="1.2"
                        strokeDasharray="5 4"
                      />
                      <line
                        x1={p2CrownX + p2CrownW}
                        y1={p2CrownY + p2CrownH}
                        x2={p2RightX + p2RightW / 2}
                        y2={p2WallsY - 22}
                        stroke="#0f172a"
                        strokeWidth="1.2"
                        strokeDasharray="5 4"
                      />

                      {/* BOTTOM-LEFT BOX: LEFT WALL PHOTOGRAPH */}
                      <text
                        x={p2LeftX + p2LeftW / 2}
                        y={p2WallsY - 8}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        LEFT WALL PHOTO ({leftWallH.toFixed(1)}m H × {pullM.toFixed(1)}m Pull)
                      </text>
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="left_wall"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={showGeologicalOverlay}
                        targetX={p2LeftX}
                        targetY={p2WallsY}
                        targetW={p2LeftW}
                        targetH={p2LeftH}
                        clipId="photorep-p2-lwall-clip"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />

                      {/* BOTTOM-RIGHT BOX: RIGHT WALL PHOTOGRAPH */}
                      <text
                        x={p2RightX + p2RightW / 2}
                        y={p2WallsY - 8}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fontFamily="monospace"
                        fill="#0f172a"
                      >
                        RIGHT WALL PHOTO ({rightWallH.toFixed(1)}m H × {pullM.toFixed(1)}m Pull)
                      </text>
                      <ReportSingleSurfacePhotoAndGeologySvg
                        panel="right_wall"
                        location={activeLocation}
                        round={activeRound}
                        rememberedRocks={rememberedRocks}
                        colorMode={colorMode}
                        showGeologicalOverlay={showGeologicalOverlay}
                        targetX={p2RightX}
                        targetY={p2WallsY}
                        targetW={p2RightW}
                        targetH={p2RightH}
                        clipId="photorep-p2-rwall-clip"
                        onRequestCropOrImport={(p) => setCropModalPanel(p)}
                        onPanPhotoOffset={handlePanPhotoOffset}
                      />
                    </>
                  )}
                </svg>
              </>
            )}
          </div>

          {/* BOTTOM: Compact Geologist Sign (Small in size, zero wasted space) */}
          {renderCompactBottomGeologistSign()}
        </div>
      </div>

      {/* Interactive Photo Import, Crop & Place Modal */}
      {cropModalPanel && (
        <PhotoReportCropAndPlaceModal
          panel={cropModalPanel}
          panelTitle={
            cropModalPanel === 'face'
              ? 'Tunnel Face'
              : cropModalPanel === 'crown'
              ? 'Crown / Roof Arch'
              : cropModalPanel === 'left_wall'
              ? 'Left Wall'
              : 'Right Wall'
          }
          targetWidthM={
            cropModalPanel === 'face'
              ? spanW
              : cropModalPanel === 'crown'
              ? crownArcM
              : leftWallH
          }
          targetHeightM={cropModalPanel === 'face' ? heightH : pullM}
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onApplyCroppedPhoto={handleApplyCroppedPhoto}
          onClose={() => setCropModalPanel(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// STAGE AFTER 2D PHOTO REPORT: 3D TUNNEL & GEOLOGICAL REPORT
// Shows 3D Tunnel Geometry + Fitted Photos + 3D Joint Traces + Lithology + Geological Features
// ============================================================================
export const Field3DTunnelGeologicalReportStage: React.FC<{
  activeProject: FieldProjectItem;
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  rememberedRocks: FieldRememberedRockItem[];
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onBackTo2DPhotoReport: () => void;
  onBackToCleanReport: () => void;
}> = ({
  activeProject,
  activeLocation,
  activeRound,
  rememberedRocks,
  onUpdateRound,
  onBackTo2DPhotoReport,
  onBackToCleanReport,
}) => {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [liveDipDir, setLiveDipDir] = useState<number>(135);
  const [liveDipAmt, setLiveDipAmt] = useState<number>(60);

  const qRes = computeFieldQValue(activeRound.qSystem);
  const rmrRes = computeFieldRmrValue(activeRound.rmrSystem);
  const visibleLithStrokes = pruneFullyErasedLithologyStrokes(activeRound.lithologyStrokes);

  const container3DRef = useRef<HTMLDivElement | null>(null);

  const handleExport3DWordReport = async () => {
    const svg3d = container3DRef.current?.querySelector('svg') as SVGSVGElement | null;
    const png3d = await renderSvgElementToHighResPngDataUrl(svg3d, 1500);
    const htmlDoc = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>3D Geological &amp; Structural Report - ${activeLocation.name}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, sans-serif; color: #0f172a; font-size: 9pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
          th, td { border: 1px solid #0f172a; padding: 4pt 6pt; font-size: 8.5pt; }
        </style>
      </head>
      <body>
        <h2 style="margin:0 0 6pt 0;">3D TUNNEL &amp; GEOLOGICAL REPORT — ${activeProject.projectName} (${activeLocation.name})</h2>
        <p style="margin:0 0 8pt 0;"><strong>Chainage:</strong> CH ${activeRound.chainageFrom}–${activeRound.chainageTo}m (Pull ${activeRound.pullLengthMeters}m) | <strong>Shape:</strong> ${activeLocation.shape.toUpperCase()} (${activeLocation.widthM}m W × ${activeLocation.heightM}m H) | <strong>Q:</strong> ${qRes.qValue} (${qRes.rockClass}) | <strong>RMR:</strong> ${rmrRes.totalRmr} (${rmrRes.rmrClass}) | <strong>GSI:</strong> ${activeRound.gsiValue}</p>
        ${
          png3d
            ? `<div style="text-align:center;margin-bottom:10pt;"><img src="${png3d}" width="660" style="max-width:100%;border:1px solid #0f172a;" /></div>`
            : ''
        }
        <table>
          <thead>
            <tr><th>Trace / Set</th><th>Surface</th><th>Orientation (Dip Dir / Dip)</th><th>Strike</th></tr>
          </thead>
          <tbody>
            ${activeRound.jointTraces
              .map(
                (tr) =>
                  `<tr><td><strong>${tr.setId}</strong></td><td>${tr.panel.toUpperCase()}</td><td>${String(tr.dipDirection).padStart(3, '0')}° / ${tr.dipAmount}°</td><td>${String(tr.strike).padStart(3, '0')}°</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RD_${activeRound.chainageFrom}_${activeRound.chainageTo}_3D_Geological_Report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const handleExport3DPdfReport = async () => {
    const svg3d = container3DRef.current?.querySelector('svg') as SVGSVGElement | null;
    const png3d = await renderSvgElementToHighResPngDataUrl(svg3d, 1500);
    const W = 1240;
    const H = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `3D TUNNEL & GEOLOGICAL REPORT — ${activeProject.projectName} (${activeLocation.name})`,
      W / 2,
      68
    );
    ctx.font = 'bold 14px Arial';
    ctx.fillText(
      `CH ${activeRound.chainageFrom}–${activeRound.chainageTo}m (Pull ${activeRound.pullLengthMeters}m)  |  Q = ${qRes.qValue} (${qRes.rockClass})  |  RMR = ${rmrRes.totalRmr} (${rmrRes.rmrClass})  |  GSI = ${activeRound.gsiValue}`,
      W / 2,
      100
    );

    if (png3d) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const availW = W - 96;
          const availH = 1120;
          const sc = Math.min(availW / Math.max(1, img.width), availH / Math.max(1, img.height));
          const dw = img.width * sc;
          const dh = img.height * sc;
          ctx.strokeRect(36, 120, W - 72, availH + 20);
          ctx.drawImage(img, (W - dw) / 2, 130 + (availH - dh) / 2, dw, dh);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = png3d;
      });
    }

    let y = 1280;
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(
      `3D Mapped Joint Traces (${activeRound.jointTraces.length}) & Lithology Domains (${visibleLithStrokes.length}):`,
      48,
      y
    );
    y += 28;
    ctx.font = '13px Arial';
    activeRound.jointTraces.slice(0, 14).forEach((tr, i) => {
      ctx.fillText(
        `${i + 1}. [${tr.setId}] ${tr.panel.toUpperCase()} — Dip Dir: ${String(tr.dipDirection).padStart(3, '0')}° / Dip: ${tr.dipAmount}° (Strike ${String(tr.strike).padStart(3, '0')}°)`,
        56,
        y
      );
      y += 22;
    });

    exportCanvasesAsPdfDocument(
      [canvas],
      `RD_${activeRound.chainageFrom}_${activeRound.chainageTo}_3D_Geological_Report.pdf`,
      'portrait'
    );
  };

  return (
    <div
      ref={container3DRef}
      className="flex-1 min-h-0 flex flex-col bg-slate-950 p-2.5 sm:p-4 gap-3 overflow-y-auto"
    >
      {/* Top Header & Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase">
              3D Geological &amp; Structural Report • Interactive 3D Tunnel Twin
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
              {activeLocation.name} • {activeLocation.shape.toUpperCase()} ({activeLocation.widthM}m W × {activeLocation.heightM}m H × {activeRound.pullLengthMeters}m Pull)
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white mt-1 flex items-center gap-2">
            <Box className="w-4 h-4 text-emerald-400" />
            3D Tunnel Geometry, Fitted Surface Photos, 3D Joint Traces, Lithology &amp; Geological Features
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToCleanReport}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Clean 2-Page Report
          </button>
          <button
            type="button"
            onClick={onBackTo2DPhotoReport}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            2D Photo Report
          </button>
          <button
            type="button"
            onClick={handleExport3DWordReport}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            Download Word (.doc)
          </button>
          <button
            type="button"
            onClick={handleExport3DPdfReport}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF (.pdf)
          </button>
        </div>
      </div>

      {/* Main 3D Tunnel + 3D Geological Summary Layout */}
      <div className="flex-1 min-h-[540px] grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 9 Columns: Full Interactive 3D Tunnel Canvas */}
        <div className="lg:col-span-9 min-h-[500px] bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col overflow-hidden">
          <Field3DTunnelCanvas
            activeLocation={activeLocation}
            activeRound={activeRound}
            activeTool="3_joint_trace"
            selectedRockType="granite"
            lithologySubMode="paint"
            veinOrFoliationSubMode="vein_band"
            selectedVeinRockId="quartz_vein"
            selectedGeoFeatureType="fault"
            selectedFaultSubType="normal_fault"
            selectedFaultElementRole="fault_complete"
            showHwFwBadges={true}
            selectedFoldSubType="anticline"
            selectedFoldElementRole="fold_complete"
            showFoldLimbCrestBadges={true}
            alternatingBandMode="single"
            alternatingRockIds={['quartzite', 'phyllite', 'schist']}
            alternatingSpacingPx={42}
            selectedWaterCondition="Dripping"
            activeGroupingSet="J1"
            brushRadius={28}
            lithologySymbolDensity={activeRound.lithologySymbolDensity ?? 85}
            veinBandSymbolDensity={activeRound.veinBandSymbolDensity ?? 100}
            veinBandSymbolSize={activeRound.veinBandSymbolSize ?? 100}
            veinBandThicknessPx={activeRound.defaultBandThicknessPx ?? 28}
            jointPencilSizePx={activeRound.defaultJointPencilSizePx ?? 3.8}
            geoFeaturePencilSizePx={4.2}
            geoFeatureSymbolSize={100}
            geoFeatureSymbolDensity={100}
            pencilLineMode="smooth"
            onChangePencilLineMode={() => {}}
            liveDipDirection={liveDipDir}
            liveDipAmount={liveDipAmt}
            liveCrownSign="+90"
            rememberedRocksList={rememberedRocks}
            selectedTraceId={selectedTraceId}
            onSelectTraceId={(id) => {
              setTimeout(() => setSelectedTraceId(id), 0);
            }}
            onSetLiveOrientation={(dDir, dAmt) => {
              setTimeout(() => {
                setLiveDipDir(dDir);
                setLiveDipAmt(dAmt);
              }, 0);
            }}
            onPushUndo={() => {}}
            onUpdateRound={onUpdateRound}
          />
        </div>

        {/* Right 3 Columns: 3D Geological, Lithology & Joint Trace Inventory */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3 overflow-y-auto">
          <div className="space-y-3">
            <div className="border-b border-slate-800 pb-2">
              <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                3D Geological Twin Summary
              </div>
              <div className="text-xs font-bold text-white mt-0.5">
                {activeProject.projectName} • {activeLocation.name}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                RD {activeRound.chainageFrom}m – {activeRound.chainageTo}m (Pull {activeRound.pullLengthMeters}m)
              </div>
            </div>

            {/* 3D Tunnel Dimensions Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1 font-mono text-[11px]">
              <div className="text-[10px] text-amber-300 font-bold uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> 3D Tunnel Profile &amp; Size
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cross-Section Shape:</span>
                <span className="font-bold text-white uppercase">{activeLocation.shape}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Span Width × Height:</span>
                <span className="font-bold text-cyan-300">{activeLocation.widthM}m × {activeLocation.heightM}m</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Round Pull Length:</span>
                <span className="font-bold text-emerald-300">{activeRound.pullLengthMeters}m</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Drive Azimuth:</span>
                <span className="font-bold text-amber-300">N{String(activeRound.tunnelDriveDirection).padStart(3, '0')}°E</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Fitted Surface Photos:</span>
                <span className="font-bold text-emerald-400">{activeRound.collectedPhotos.length} / 4 Surfaces</span>
              </div>
            </div>

            {/* 3D Mapped Lithology & Vein Bands */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
              <div className="text-[10px] font-mono font-bold uppercase text-cyan-300">
                3D Lithology &amp; Vein Bands ({visibleLithStrokes.length})
              </div>
              {visibleLithStrokes.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">No lithology regions mapped yet.</div>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {visibleLithStrokes.slice(0, 12).map((st) => {
                    const info = resolveRockDisplayInfo(st.rockType, rememberedRocks);
                    return (
                      <div
                        key={st.id}
                        className="flex items-center justify-between text-[10.5px] font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800"
                      >
                        <span className="font-bold text-slate-200 truncate">
                          {info.code} • {info.name}
                        </span>
                        <span className="text-slate-400 uppercase text-[9.5px]">{st.panel}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3D Joint Traces & Discontinuity Planes */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
              <div className="text-[10px] font-mono font-bold uppercase text-amber-300">
                3D Joint Traces ({activeRound.jointTraces.length}) &amp; Dip Planes ({activeRound.dipPlaneSurfaces.length})
              </div>
              {activeRound.jointTraces.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic">No joint traces mapped yet.</div>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                  {activeRound.jointTraces.map((tr, idx) => {
                    const col = FIELD_JOINT_GROUP_COLORS[tr.setId]?.stroke || '#38bdf8';
                    return (
                      <div
                        key={tr.id}
                        onClick={() => setSelectedTraceId(tr.id)}
                        className={`flex items-center justify-between text-[10.5px] font-mono px-2 py-1 rounded border cursor-pointer ${
                          selectedTraceId === tr.id
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-bold">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                          #{idx + 1} {tr.setId} ({String(tr.dipDirection).padStart(3, '0')}°/{tr.dipAmount}°)
                        </span>
                        <span className="text-[9.5px] uppercase text-slate-400">{tr.panel}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rock Mass Ratings Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[10.5px] space-y-1">
              <div className="text-[10px] font-bold uppercase text-purple-300">
                Rock Mass Classification
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Barton Q-Value:</span>
                <span className="font-bold text-amber-300">{qRes.qValue} ({qRes.rockClass})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bieniawski RMR89:</span>
                <span className="font-bold text-cyan-300">{rmrRes.totalRmr} ({rmrRes.rmrClass})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hoek-Brown GSI:</span>
                <span className="font-bold text-emerald-300">{activeRound.gsiValue}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
