import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Joint,
  JointSet,
  ParameterInputStatus,
  PhotoSurface,
  Point2D,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { createTunnelGeometry } from '../engine/geometryEngine';
import { calibrateAndUndistortPhotograph } from '../engine/cameraCalibration';
import {
  computeVirtualScanlineMetrics,
  refineMultiSurfaceOrientations,
} from '../engine/orientationEngine';
import {
  computePhotogrammetricStructuralSummary,
} from '../engine/photogrammetryAndStructuralEngine';
import {
  CheckCircle2,
  Compass,
  Link2,
  Maximize2,
  RefreshCw,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

export type SimpleAddonTab = 'full_photo_1ft_scale' | 'four_part_accuracy';

interface SimpleFullPhotoAndAccuracyModalProps {
  isOpen: boolean;
  initialTab?: SimpleAddonTab;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  activeSurface: SurfaceType;
  joints: Joint[];
  jointSets: JointSet[];
  rmrParams: RmrParameters;
  qIndexParams: QIndexParameters;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  onApplyExtractedGeometryAndScale: (
    nextGeometry: TunnelGeometry,
    calibratedPxPerMeter: number,
    fullPhotoDataUrl?: string,
    targetSurface?: SurfaceType
  ) => void;
  onUpdateJointsWithHistory: (nextJoints: Joint[]) => void;
  onUpdateRmrParams: (next: RmrParameters) => void;
  onUpdateQIndexParams: (next: QIndexParameters) => void;
  onUpdateQParamStatus: (next: Record<QSystemParamKey, ParameterInputStatus>) => void;
  onStatusMessage?: (msg: string) => void;
}

const SCALE_PRESETS: { id: string; label: string; meters: number; badge: string }[] = [
  { id: '1ft', label: '1 Foot Field Scale', meters: 0.3048, badge: '1 ft = 0.3048 m (30.48 cm)' },
  { id: '2ft', label: '2 Feet Scale', meters: 0.6096, badge: '2 ft = 0.6096 m (60.96 cm)' },
  { id: '0.5m', label: '0.5 Meter Scale', meters: 0.5, badge: '0.50 m (50 cm)' },
  { id: '1m', label: '1.0 Meter Scale', meters: 1.0, badge: '1.00 m (100 cm)' },
];

type DragHandleId =
  | 'scaleStart'
  | 'scaleEnd'
  | 'leftWallStart'
  | 'leftWallEnd'
  | 'crownApex'
  | 'rightWallStart'
  | 'rightWallEnd';

export const SimpleFullPhotoAndAccuracyModal: React.FC<SimpleFullPhotoAndAccuracyModalProps> = ({
  isOpen,
  initialTab = 'full_photo_1ft_scale',
  onClose,
  geometry,
  settings,
  photos,
  activeSurface,
  joints,
  jointSets,
  rmrParams,
  qIndexParams,
  qParamStatus,
  onApplyExtractedGeometryAndScale,
  onUpdateJointsWithHistory,
  onUpdateRmrParams,
  onUpdateQIndexParams,
  onUpdateQParamStatus,
  onStatusMessage,
}) => {
  const [activeTab, setActiveTab] = useState<SimpleAddonTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // ============================================================================
  // TAB 1 STATE: OVERALL FULL PHOTO + 1-FOOT SCALE + WALL/CROWN START & END
  // ============================================================================
  const existingPhotoUrl =
    photos[activeSurface]?.image ||
    photos.face?.image ||
    photos.crown?.image ||
    photos.leftWall?.image ||
    photos.rightWall?.image ||
    null;

  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(existingPhotoUrl);
  const [photoPixelSize, setPhotoPixelSize] = useState<{ w: number; h: number }>({
    w: 1600,
    h: 1100,
  });
  const [targetSurfaceToAssign, setTargetSurfaceToAssign] = useState<SurfaceType>(
    activeSurface || 'face'
  );

  // Scale Bar Length (Default = 1 Foot = 0.3048 m as requested by user)
  const [scaleLengthMeters, setScaleLengthMeters] = useState<number>(0.3048);
  const [customScaleInput, setCustomScaleInput] = useState<string>('0.3048');

  // Normalized 0..1 coordinates on the photo so it works cleanly on any image resolution
  // S1 -> S2: 1-Foot Measuring Scale on Field Photo
  const [scaleStart, setScaleStart] = useState<Point2D>({ x: 0.44, y: 0.72 });
  const [scaleEnd, setScaleEnd] = useState<Point2D>({ x: 0.51, y: 0.72 });

  // 5 Simple Boundary Points: Where Left Wall Starts/Ends, Crown Apex, Right Wall Starts/Ends
  const [leftWallStart, setLeftWallStart] = useState<Point2D>({ x: 0.14, y: 0.88 });
  const [leftWallEnd, setLeftWallEnd] = useState<Point2D>({ x: 0.14, y: 0.44 });
  const [crownApex, setCrownApex] = useState<Point2D>({ x: 0.5, y: 0.14 });
  const [rightWallStart, setRightWallStart] = useState<Point2D>({ x: 0.86, y: 0.44 });
  const [rightWallEnd, setRightWallEnd] = useState<Point2D>({ x: 0.86, y: 0.88 });

  const [draggingHandle, setDraggingHandle] = useState<DragHandleId | null>(null);
  const [autoDetectNote, setAutoDetectNote] = useState<string>(
    'Place S1–S2 on your 1-Foot (0.3048 m) field scale and adjust the 5 wall/crown boundary points, or click Auto-Detect.'
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!fullPhotoUrl && existingPhotoUrl) {
      setFullPhotoUrl(existingPhotoUrl);
    }
  }, [existingPhotoUrl, fullPhotoUrl]);

  // Read true image pixel dimensions when photo changes
  useEffect(() => {
    if (!fullPhotoUrl) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setPhotoPixelSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = fullPhotoUrl;
  }, [fullPhotoUrl]);

  const handleUploadFullPhoto = async (file: File) => {
    const rawBuffer = await file.arrayBuffer().catch(() => undefined);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const rawUrl = reader.result;
        try {
          const { undistortedDataUrl } = await calibrateAndUndistortPhotograph(
            rawUrl,
            rawBuffer,
            targetSurfaceToAssign,
            geometry,
            settings
          );
          setFullPhotoUrl(undistortedDataUrl);
          setAutoDetectNote(
            `Uploaded & auto-enhanced "${file.name}" (shadows & disturbances removed, upscaled HD). Click "Auto-Detect 1-Ft Scale & Wall/Crown" or drag the points.`
          );
        } catch {
          setFullPhotoUrl(rawUrl);
          setAutoDetectNote(
            `Loaded full photo "${file.name}". Click "Auto-Detect 1-Ft Scale & Wall/Crown" or drag the points.`
          );
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-detect high-contrast 1-foot scale bar and excavation boundary from photo pixels
  const handleAutoDetectScaleAndBoundaryFromPhoto = () => {
    if (!fullPhotoUrl) {
      setAutoDetectNote('Please upload a photo first.');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cw = 320;
      const ch = 220;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, cw, ch);
      const imgData = ctx.getImageData(0, 0, cw, ch).data;

      const lumAt = (x: number, y: number) => {
        const ix = Math.max(0, Math.min(cw - 1, Math.round(x)));
        const iy = Math.max(0, Math.min(ch - 1, Math.round(y)));
        const idx = (iy * cw + ix) * 4;
        return 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      };

      // 1. Scan left side, top arch, and right side for rock boundary transition
      let bestLeftX = 0.13;
      let maxLeftGrad = -1;
      for (let nx = 0.06; nx <= 0.28; nx += 0.01) {
        const g = Math.abs(lumAt(nx * cw + 3, ch * 0.65) - lumAt(nx * cw - 3, ch * 0.65));
        if (g > maxLeftGrad) {
          maxLeftGrad = g;
          bestLeftX = nx;
        }
      }

      let bestRightX = 0.87;
      let maxRightGrad = -1;
      for (let nx = 0.72; nx <= 0.94; nx += 0.01) {
        const g = Math.abs(lumAt(nx * cw + 3, ch * 0.65) - lumAt(nx * cw - 3, ch * 0.65));
        if (g > maxRightGrad) {
          maxRightGrad = g;
          bestRightX = nx;
        }
      }

      let bestTopY = 0.13;
      let maxTopGrad = -1;
      for (let ny = 0.06; ny <= 0.28; ny += 0.01) {
        const g = Math.abs(lumAt(cw * 0.5, ny * ch + 3) - lumAt(cw * 0.5, ny * ch - 3));
        if (g > maxTopGrad) {
          maxTopGrad = g;
          bestTopY = ny;
        }
      }

      const floorY = 0.88;
      const totalSpanPx = (bestRightX - bestLeftX) * cw;
      const totalHeightPx = (floorY - bestTopY) * ch;
      // Springline (where straight wall ends and arch crown starts) is typically ~56-60% up from floor
      const springlineY = Number((floorY - (floorY - bestTopY) * 0.57).toFixed(3));

      setLeftWallStart({ x: Number(bestLeftX.toFixed(3)), y: floorY });
      setLeftWallEnd({ x: Number(bestLeftX.toFixed(3)), y: springlineY });
      setCrownApex({ x: Number(((bestLeftX + bestRightX) / 2).toFixed(3)), y: Number(bestTopY.toFixed(3)) });
      setRightWallStart({ x: Number(bestRightX.toFixed(3)), y: springlineY });
      setRightWallEnd({ x: Number(bestRightX.toFixed(3)), y: floorY });

      // 2. Scan central-lower region for bright high-contrast 1-foot field scale bar
      let bestScaleX = 0.46;
      let bestScaleY = 0.72;
      let maxContrast = -1;
      for (let ny = 0.52; ny <= 0.82; ny += 0.03) {
        for (let nx = 0.32; nx <= 0.68; nx += 0.03) {
          const lCenter = lumAt(nx * cw, ny * ch);
          const lBg = lumAt((nx - 0.04) * cw, (ny - 0.04) * ch);
          const diff = lCenter - lBg;
          if (diff > maxContrast) {
            maxContrast = diff;
            bestScaleX = nx;
            bestScaleY = ny;
          }
        }
      }

      // A 1-foot scale bar (0.3048 m) on an ~8.4 m tunnel spans ~3.6% of tunnel width
      const estScaleNormLen = Math.max(0.032, Math.min(0.085, (bestRightX - bestLeftX) * (scaleLengthMeters / (geometry.width || 8.4))));
      setScaleStart({
        x: Number((bestScaleX - estScaleNormLen / 2).toFixed(3)),
        y: Number(bestScaleY.toFixed(3)),
      });
      setScaleEnd({
        x: Number((bestScaleX + estScaleNormLen / 2).toFixed(3)),
        y: Number(bestScaleY.toFixed(3)),
      });

      void totalSpanPx;
      void totalHeightPx;
      setAutoDetectNote(
        'Auto-detected tunnel boundary (Left Wall Start/End, Crown Arch, Right Wall Start/End) & 1-Ft Scale Bar! Drag any handle to fine-tune.'
      );
    };
    img.src = fullPhotoUrl;
  };

  // Compute live dimensions in real-world meters & feet from the 1-Foot Scale Bar!
  const calibratedDimensions = useMemo(() => {
    const pw = photoPixelSize.w;
    const ph = photoPixelSize.h;

    const scaleDxPx = (scaleEnd.x - scaleStart.x) * pw;
    const scaleDyPx = (scaleEnd.y - scaleStart.y) * ph;
    const scaleLengthPx = Math.max(8, Math.hypot(scaleDxPx, scaleDyPx));

    const validScaleMeters = Math.max(0.05, scaleLengthMeters || 0.3048);
    const pxPerMeter = scaleLengthPx / validScaleMeters;
    const mmPerPixel = (validScaleMeters * 1000) / scaleLengthPx;

    // Left Wall length (Start -> End)
    const leftWallPx = Math.hypot(
      (leftWallEnd.x - leftWallStart.x) * pw,
      (leftWallEnd.y - leftWallStart.y) * ph
    );
    const leftWallMeters = Math.max(0.8, leftWallPx / pxPerMeter);

    // Right Wall length (Start -> End)
    const rightWallPx = Math.hypot(
      (rightWallEnd.x - rightWallStart.x) * pw,
      (rightWallEnd.y - rightWallStart.y) * ph
    );
    const rightWallMeters = Math.max(0.8, rightWallPx / pxPerMeter);

    // Tunnel Span Width (distance between wall bases / springlines)
    const bottomSpanPx = Math.abs(rightWallEnd.x - leftWallStart.x) * pw;
    const midSpanPx = Math.abs(rightWallStart.x - leftWallEnd.x) * pw;
    const widthPx = Math.max(bottomSpanPx, midSpanPx);
    const widthMeters = Math.max(1.8, widthPx / pxPerMeter);

    // Total Tunnel Height (from floor line to Crown Apex)
    const avgFloorY = (leftWallStart.y + rightWallEnd.y) / 2;
    const totalHeightPx = Math.max(20, (avgFloorY - crownApex.y) * ph);
    const heightMeters = Math.max(
      Math.max(leftWallMeters, rightWallMeters) + 0.4,
      totalHeightPx / pxPerMeter
    );

    // Crown Rise & Crown Arch Length (Parabola / Circular Arch approximation through L-End -> Apex -> R-Start)
    const avgWallHeight = (leftWallMeters + rightWallMeters) / 2;
    const crownRiseMeters = Math.max(0.3, heightMeters - avgWallHeight);
    const halfSpan = widthMeters / 2;
    // Circular arc radius R = (halfSpan^2 + rise^2) / (2 * rise)
    const crownRadiusMeters =
      (halfSpan * halfSpan + crownRiseMeters * crownRiseMeters) /
      Math.max(0.2, 2 * crownRiseMeters);
    const halfAngleRad = Math.asin(Math.min(0.999, halfSpan / Math.max(halfSpan, crownRadiusMeters)));
    const crownArcMeters = Math.max(widthMeters, 2 * crownRadiusMeters * halfAngleRad);

    return {
      scaleLengthPx: Math.round(scaleLengthPx),
      pxPerMeter: Number(pxPerMeter.toFixed(1)),
      mmPerPixel: Number(mmPerPixel.toFixed(2)),
      widthMeters: Number(widthMeters.toFixed(2)),
      heightMeters: Number(heightMeters.toFixed(2)),
      leftWallMeters: Number(leftWallMeters.toFixed(2)),
      rightWallMeters: Number(rightWallMeters.toFixed(2)),
      crownArcMeters: Number(crownArcMeters.toFixed(2)),
      crownRadiusMeters: Number(crownRadiusMeters.toFixed(2)),
      // Also in Feet for field convenience (1 m = 3.28084 ft)
      widthFeet: Number((widthMeters * 3.28084).toFixed(1)),
      heightFeet: Number((heightMeters * 3.28084).toFixed(1)),
      leftWallFeet: Number((leftWallMeters * 3.28084).toFixed(1)),
      rightWallFeet: Number((rightWallMeters * 3.28084).toFixed(1)),
      crownArcFeet: Number((crownArcMeters * 3.28084).toFixed(1)),
    };
  }, [
    photoPixelSize,
    scaleStart,
    scaleEnd,
    scaleLengthMeters,
    leftWallStart,
    leftWallEnd,
    crownApex,
    rightWallStart,
    rightWallEnd,
  ]);

  // Pointer dragging for the handles on the SVG overlay
  const updateHandlePositionFromClient = (clientX: number, clientY: number) => {
    if (!draggingHandle || !svgOverlayRef.current) return;
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const nx = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / Math.max(1, rect.height)));
    const pt = { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) };

    if (draggingHandle === 'scaleStart') setScaleStart(pt);
    else if (draggingHandle === 'scaleEnd') setScaleEnd(pt);
    else if (draggingHandle === 'leftWallStart') setLeftWallStart(pt);
    else if (draggingHandle === 'leftWallEnd') setLeftWallEnd(pt);
    else if (draggingHandle === 'crownApex') setCrownApex(pt);
    else if (draggingHandle === 'rightWallStart') setRightWallStart(pt);
    else if (draggingHandle === 'rightWallEnd') setRightWallEnd(pt);
  };

  // Apply Extracted Geometry & Scale
  const handleApplyFullPhotoSetup = () => {
    const {
      widthMeters,
      heightMeters,
      leftWallMeters,
      rightWallMeters,
      crownArcMeters,
      crownRadiusMeters,
      pxPerMeter,
    } = calibratedDimensions;

    const avgWallH = Number(((leftWallMeters + rightWallMeters) / 2).toFixed(2));
    const baseGeom = createTunnelGeometry(
      widthMeters,
      heightMeters,
      Math.min(heightMeters - 0.2, avgWallH),
      geometry.crownGeometry || 'd_shaped',
      crownRadiusMeters,
      'manual'
    );

    const updatedGeometry: TunnelGeometry = {
      ...baseGeom,
      leftWallHeight: leftWallMeters,
      rightWallHeight: rightWallMeters,
      leftWallArcLength: leftWallMeters,
      rightWallArcLength: rightWallMeters,
      crownArcLength: crownArcMeters,
      profileName: `${settings.locationName || 'Tunnel'} (1-Ft Field Scale Calibrated ${widthMeters}×${heightMeters}m)`,
    };

    onApplyExtractedGeometryAndScale(
      updatedGeometry,
      pxPerMeter,
      fullPhotoUrl || undefined,
      targetSurfaceToAssign
    );
    onStatusMessage?.(
      `Applied 1-Ft Scale Calibration (${pxPerMeter} px/m) & Tunnel Dimensions: W=${widthMeters}m, H=${heightMeters}m, Left Wall=${leftWallMeters}m, Right Wall=${rightWallMeters}m, Crown=${crownArcMeters}m.`
    );
    onClose();
  };

  // ============================================================================
  // TAB 2 STATE & COMPUTATIONS: 4-PART SIMPLE ACCURACY SUITE
  // ============================================================================
  const [selectedTraceAId, setSelectedTraceAId] = useState<string>(joints[0]?.id || '');
  const [selectedTraceBId, setSelectedTraceBId] = useState<string>(joints[1]?.id || '');

  // Part 2: Simple Compass Check
  const [compassSetId, setCompassSetId] = useState<string>(jointSets[0]?.id || 'J1');
  const [compassDipDir, setCompassDipDir] = useState<string>(
    String(jointSets[0]?.avgDipDirection ?? 135)
  );
  const [compassDip, setCompassDip] = useState<string>(String(jointSets[0]?.avgDip ?? 62));

  // Part 3 & 4: Compute live scanline & structural suite
  const activeSurfaceJoints = useMemo(
    () => joints.filter((j) => j.surface === activeSurface),
    [joints, activeSurface]
  );

  const autoScanlineStats = useMemo(() => {
    const surfW =
      activeSurface === 'face'
        ? geometry.width
        : activeSurface === 'crown'
        ? geometry.crownArcLength
        : geometry.wallHeight;
    const surfH = activeSurface === 'face' ? geometry.height : settings.roundLength || 3.5;
    // Horizontal mid-height scanline across active surface
    return computeVirtualScanlineMetrics(
      { x: -surfW * 0.45, y: surfH * 0.5 },
      { x: surfW * 0.45, y: surfH * 0.5 },
      activeSurfaceJoints
    );
  }, [activeSurface, activeSurfaceJoints, geometry, settings]);

  const structuralSuite = useMemo(
    () => computePhotogrammetricStructuralSummary(joints, jointSets, geometry, settings, photos),
    [joints, jointSets, geometry, settings, photos]
  );

  // Part 1 Action: 1-Click Auto-Link Corner Traces across surfaces
  const handleOneClickAutoLinkCornerTraces = () => {
    const refined = refineMultiSurfaceOrientations(joints, geometry, settings);
    onUpdateJointsWithHistory(refined);
    const multiCount = refined.filter(
      (j) =>
        j.orientationStatus === 'GEOMETRICALLY_CALCULATED' ||
        j.orientationStatus === 'CONFIRMED'
    ).length;
    onStatusMessage?.(
      `1-Click Corner Trace Linker: Solved exact 3D Strike & Dip across surfaces for ${multiCount} joint trace(s).`
    );
  };

  // Manual 2-Trace Link
  const handleLinkSelectedPair = () => {
    if (!selectedTraceAId || !selectedTraceBId || selectedTraceAId === selectedTraceBId) return;
    const next = joints.map((j) => {
      if (j.id === selectedTraceAId) {
        return {
          ...j,
          linkedJointIds: Array.from(new Set([...(j.linkedJointIds || []), selectedTraceBId])),
        };
      }
      if (j.id === selectedTraceBId) {
        return {
          ...j,
          linkedJointIds: Array.from(new Set([...(j.linkedJointIds || []), selectedTraceAId])),
        };
      }
      return j;
    });
    const refined = refineMultiSurfaceOrientations(next, geometry, settings);
    onUpdateJointsWithHistory(refined);
    onStatusMessage?.('Linked selected trace pair and solved exact 3D Cross-Surface Orientation.');
  };

  // Part 2 Action: 1-Click Apply Field Compass Reading to Joint Set
  const handleApplyFieldCompassCalibration = () => {
    const dd = Math.max(0, Math.min(360, Number(compassDipDir) || 135));
    const dipVal = Math.max(0, Math.min(90, Number(compassDip) || 60));
    const strikeVal = (dd - 90 + 360) % 360;

    const updated = joints.map((j) => {
      if (j.set !== compassSetId) return j;
      return {
        ...j,
        dipDirection: dd,
        dip: dipVal,
        strike: strikeVal,
        orientationStatus: 'DIRECTLY_MEASURED' as const,
        confidence: 'High' as const,
        confidenceScore: Math.max(j.confidenceScore, 0.96),
      };
    });

    onUpdateJointsWithHistory(updated);
    onStatusMessage?.(
      `Field Compass Calibration applied to Set ${compassSetId}: Dip Dir ${dd}° / Dip ${dipVal}° (Directly Measured).`
    );
  };

  // Part 3 Action: 1-Click Auto-Sync Mapped RQD, Spacing & Sets to RMR & Q-System
  const handleOneClickSyncToRmrAndQ = () => {
    const rqdVal = Number(
      (autoScanlineStats.intersectionCount >= 2
        ? autoScanlineStats.measuredScanlineRqdPct
        : structuralSuite.terzaghiCorrectedRqdPct
      ).toFixed(1)
    );
    const parsedSetSpacing = parseFloat(jointSets[0]?.spacing || '0.35') || 0.35;
    const meanSpacingM = Number(
      (autoScanlineStats.intersectionCount >= 2
        ? autoScanlineStats.meanSpacingMeters
        : parsedSetSpacing
      ).toFixed(2)
    );
    const activeSetsCount = Math.max(1, jointSets.length);
    const jnRating =
      activeSetsCount === 1
        ? 2
        : activeSetsCount === 2
        ? 4
        : activeSetsCount === 3
        ? 9
        : activeSetsCount === 4
        ? 12
        : 15;
    const meanJr = Number(
      (structuralSuite.meanBartonJrc >= 14
        ? 3.0
        : structuralSuite.meanBartonJrc >= 10
        ? 2.0
        : structuralSuite.meanBartonJrc >= 6
        ? 1.5
        : 1.0
      ).toFixed(1)
    );

    const rqdRating =
      rqdVal >= 90 ? 20 : rqdVal >= 75 ? 17 : rqdVal >= 50 ? 13 : rqdVal >= 25 ? 8 : 3;
    const spacingRating =
      meanSpacingM >= 2.0
        ? 20
        : meanSpacingM >= 0.6
        ? 15
        : meanSpacingM >= 0.2
        ? 10
        : meanSpacingM >= 0.06
        ? 8
        : 5;

    onUpdateRmrParams({
      ...rmrParams,
      rqdPercent: rqdVal,
      rqdRating,
      spacingMeters: meanSpacingM,
      spacingRating,
    });
    onUpdateQIndexParams({
      ...qIndexParams,
      rqd: rqdVal,
      jn: jnRating,
      jr: meanJr,
    });
    onUpdateQParamStatus({
      ...qParamStatus,
      rqd: 'USER_CONFIRMED',
      jn: 'USER_CONFIRMED',
      jr: 'USER_CONFIRMED',
    });
    onStatusMessage?.(
      `Synced Mapped Data to RMR & Q-System: RQD = ${rqdVal}%, Spacing = ${Math.round(
        meanSpacingM * 1000
      )} mm, Jn = ${jnRating} (${activeSetsCount} sets), Jr = ${meanJr}.`
    );
  };

  if (!isOpen) return null;

  // Build SVG path for the tunnel boundary on Tab 1 photo preview
  const boundarySvgPath = `M ${leftWallStart.x * 1000} ${leftWallStart.y * 650} L ${
    leftWallEnd.x * 1000
  } ${leftWallEnd.y * 650} Q ${crownApex.x * 1000} ${
    (crownApex.y * 2 - (leftWallEnd.y + rightWallStart.y) * 0.5) * 650
  } ${rightWallStart.x * 1000} ${rightWallStart.y * 650} L ${rightWallEnd.x * 1000} ${
    rightWallEnd.y * 650
  }`;

  const worstWedge =
    structuralSuite.kinematicWedges.length > 0
      ? structuralSuite.kinematicWedges.reduce(
          (worst, w) => (w.factorOfSafetyDry < worst.factorOfSafetyDry ? w : worst),
          structuralSuite.kinematicWedges[0]
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4">
      <div className="w-full max-w-6xl max-h-[94dvh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* TOP HEADER + 2 SIMPLE TABS */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wide">
                Full-Photo 1-Ft Scale Setup &amp; 4-Part Simple Accuracy Booster
              </h2>
              <p className="text-[11px] text-slate-300">
                Simple, step-by-step field scale calibration, wall/crown boundary detector &amp; 1-click accuracy tools
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('full_photo_1ft_scale')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'full_photo_1ft_scale'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                1. Full Photo + 1-Ft Scale &amp; Wall/Crown
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('four_part_accuracy')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'four_part_accuracy'
                    ? 'bg-sky-500 text-slate-950 shadow-xs font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                2. 4-Part Simple Accuracy Booster
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ====================================================================
            TAB 1: OVERALL FULL PHOTO + 1-FOOT FIELD SCALE + WALL/CROWN BOUNDARY
           ==================================================================== */}
        {activeTab === 'full_photo_1ft_scale' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFullPhoto(f);
                e.target.value = '';
              }}
            />

            {/* LEFT COLUMN (7 COLS): INTERACTIVE FULL PHOTO WITH 1-FT SCALE & 5 WALL/CROWN HANDLES */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Simple Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {fullPhotoUrl ? 'Upload Overall Full Photo' : 'Select Overall Full Photo'}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoDetectScaleAndBoundaryFromPhoto}
                    disabled={!fullPhotoUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Auto-Detect 1-Ft Scale &amp; Wall/Crown
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-600 font-medium">Assign Photo to:</span>
                  <select
                    value={targetSurfaceToAssign}
                    onChange={(e) => setTargetSurfaceToAssign(e.target.value as SurfaceType)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-800"
                  >
                    <option value="face">Tunnel Face</option>
                    <option value="crown">Crown / Roof</option>
                    <option value="leftWall">Left Wall</option>
                    <option value="rightWall">Right Wall</option>
                  </select>
                </div>
              </div>

              {/* Interactive Canvas */}
              <div className="relative flex-1 min-h-[380px] bg-slate-950 rounded-xl border border-slate-300 overflow-hidden select-none flex items-center justify-center">
                {fullPhotoUrl ? (
                  <svg
                    ref={svgOverlayRef}
                    viewBox="0 0 1000 650"
                    className="w-full h-full max-h-[520px] touch-none"
                    onPointerMove={(e) => updateHandlePositionFromClient(e.clientX, e.clientY)}
                    onPointerUp={() => setDraggingHandle(null)}
                    onPointerLeave={() => setDraggingHandle(null)}
                  >
                    <image
                      href={fullPhotoUrl}
                      x="0"
                      y="0"
                      width="1000"
                      height="650"
                      preserveAspectRatio="none"
                    />

                    {/* Shaded Tunnel Profile Interior */}
                    <path
                      d={`${boundarySvgPath} Z`}
                      fill="rgba(14, 165, 233, 0.12)"
                      stroke="none"
                    />

                    {/* Left Wall Segment (Start -> End) */}
                    <line
                      x1={leftWallStart.x * 1000}
                      y1={leftWallStart.y * 650}
                      x2={leftWallEnd.x * 1000}
                      y2={leftWallEnd.y * 650}
                      stroke="#22C55E"
                      strokeWidth="5"
                    />
                    {/* Crown Arch Segment (Left Wall End -> Crown Apex -> Right Wall Start) */}
                    <path
                      d={`M ${leftWallEnd.x * 1000} ${leftWallEnd.y * 650} Q ${
                        crownApex.x * 1000
                      } ${
                        (crownApex.y * 2 - (leftWallEnd.y + rightWallStart.y) * 0.5) * 650
                      } ${rightWallStart.x * 1000} ${rightWallStart.y * 650}`}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="5"
                    />
                    {/* Right Wall Segment (Start -> End) */}
                    <line
                      x1={rightWallStart.x * 1000}
                      y1={rightWallStart.y * 650}
                      x2={rightWallEnd.x * 1000}
                      y2={rightWallEnd.y * 650}
                      stroke="#F97316"
                      strokeWidth="5"
                    />
                    {/* Invert / Floor Baseline */}
                    <line
                      x1={leftWallStart.x * 1000}
                      y1={leftWallStart.y * 650}
                      x2={rightWallEnd.x * 1000}
                      y2={rightWallEnd.y * 650}
                      stroke="#94A3B8"
                      strokeWidth="2.5"
                      strokeDasharray="8,6"
                    />

                    {/* Springline Dashed Divider (Where Wall Ends & Crown Starts) */}
                    <line
                      x1={leftWallEnd.x * 1000}
                      y1={leftWallEnd.y * 650}
                      x2={rightWallStart.x * 1000}
                      y2={rightWallStart.y * 650}
                      stroke="#38BDF8"
                      strokeWidth="2"
                      strokeDasharray="6,6"
                    />

                    {/* Live Dimension Callouts on Canvas */}
                    <g fontFamily="IBM Plex Mono, monospace" fontSize="14" fontWeight="bold">
                      {/* Left Wall Badge */}
                      <rect
                        x={leftWallStart.x * 1000 + 14}
                        y={((leftWallStart.y + leftWallEnd.y) / 2) * 650 - 14}
                        width="165"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke="#22C55E"
                        strokeWidth="1.5"
                      />
                      <text
                        x={leftWallStart.x * 1000 + 96}
                        y={((leftWallStart.y + leftWallEnd.y) / 2) * 650 + 4}
                        fill="#4ADE80"
                        textAnchor="middle"
                      >
                        L-Wall: {calibratedDimensions.leftWallMeters}m ({calibratedDimensions.leftWallFeet}ft)
                      </text>

                      {/* Right Wall Badge */}
                      <rect
                        x={rightWallStart.x * 1000 - 180}
                        y={((rightWallStart.y + rightWallEnd.y) / 2) * 650 - 14}
                        width="166"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke="#F97316"
                        strokeWidth="1.5"
                      />
                      <text
                        x={rightWallStart.x * 1000 - 97}
                        y={((rightWallStart.y + rightWallEnd.y) / 2) * 650 + 4}
                        fill="#FB923C"
                        textAnchor="middle"
                      >
                        R-Wall: {calibratedDimensions.rightWallMeters}m ({calibratedDimensions.rightWallFeet}ft)
                      </text>

                      {/* Crown Arch Badge */}
                      <rect
                        x={crownApex.x * 1000 - 110}
                        y={crownApex.y * 650 + 18}
                        width="220"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke="#38BDF8"
                        strokeWidth="1.5"
                      />
                      <text
                        x={crownApex.x * 1000}
                        y={crownApex.y * 650 + 36}
                        fill="#38BDF8"
                        textAnchor="middle"
                      >
                        Crown Arch: {calibratedDimensions.crownArcMeters}m ({calibratedDimensions.crownArcFeet}ft)
                      </text>

                      {/* Total Span Badge */}
                      <rect
                        x={500 - 115}
                        y={((leftWallStart.y + rightWallEnd.y) / 2) * 650 - 34}
                        width="230"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke="#E2E8F0"
                        strokeWidth="1.5"
                      />
                      <text
                        x={500}
                        y={((leftWallStart.y + rightWallEnd.y) / 2) * 650 - 16}
                        fill="#F8FAFC"
                        textAnchor="middle"
                      >
                        Width W = {calibratedDimensions.widthMeters}m · Height H = {calibratedDimensions.heightMeters}m
                      </text>
                    </g>

                    {/* ============================================================
                        1-FOOT (0.3048 m) FIELD MEASURING SCALE BAR (S1 - S2)
                       ============================================================ */}
                    <g>
                      <line
                        x1={scaleStart.x * 1000}
                        y1={scaleStart.y * 650}
                        x2={scaleEnd.x * 1000}
                        y2={scaleEnd.y * 650}
                        stroke="#FACC15"
                        strokeWidth="5"
                      />
                      <rect
                        x={((scaleStart.x + scaleEnd.x) / 2) * 1000 - 95}
                        y={((scaleStart.y + scaleEnd.y) / 2) * 650 - 36}
                        width="190"
                        height="24"
                        rx="5"
                        fill="#FACC15"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                      />
                      <text
                        x={((scaleStart.x + scaleEnd.x) / 2) * 1000}
                        y={((scaleStart.y + scaleEnd.y) / 2) * 650 - 20}
                        fill="#0F172A"
                        fontFamily="IBM Plex Mono, monospace"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        SCALE: {scaleLengthMeters === 0.3048 ? '1 FT (0.3048m)' : `${scaleLengthMeters}m`} ({calibratedDimensions.scaleLengthPx}px)
                      </text>

                      {/* S1 & S2 Draggable Handles */}
                      {(
                        [
                          { id: 'scaleStart', pt: scaleStart, label: 'S1' },
                          { id: 'scaleEnd', pt: scaleEnd, label: 'S2' },
                        ] as { id: DragHandleId; pt: Point2D; label: string }[]
                      ).map((h) => (
                        <g
                          key={h.id}
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDraggingHandle(h.id);
                          }}
                        >
                          <circle
                            cx={h.pt.x * 1000}
                            cy={h.pt.y * 650}
                            r="12"
                            fill="#FACC15"
                            stroke="#0F172A"
                            strokeWidth="2.5"
                          />
                          <text
                            x={h.pt.x * 1000}
                            y={h.pt.y * 650 + 4}
                            fill="#0F172A"
                            fontFamily="IBM Plex Mono, monospace"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {h.label}
                          </text>
                        </g>
                      ))}
                    </g>

                    {/* ============================================================
                        5 DRAGGABLE WALL / CROWN START & END HANDLES
                       ============================================================ */}
                    {(
                      [
                        {
                          id: 'leftWallStart',
                          pt: leftWallStart,
                          label: '1. L-Wall Start',
                          color: '#22C55E',
                        },
                        {
                          id: 'leftWallEnd',
                          pt: leftWallEnd,
                          label: '2. L-Wall End / Crown Start',
                          color: '#10B981',
                        },
                        {
                          id: 'crownApex',
                          pt: crownApex,
                          label: '3. Crown Top Center',
                          color: '#38BDF8',
                        },
                        {
                          id: 'rightWallStart',
                          pt: rightWallStart,
                          label: '4. Crown End / R-Wall Start',
                          color: '#FB923C',
                        },
                        {
                          id: 'rightWallEnd',
                          pt: rightWallEnd,
                          label: '5. R-Wall End',
                          color: '#F97316',
                        },
                      ] as { id: DragHandleId; pt: Point2D; label: string; color: string }[]
                    ).map((h) => (
                      <g
                        key={h.id}
                        className="cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDraggingHandle(h.id);
                        }}
                      >
                        <circle
                          cx={h.pt.x * 1000}
                          cy={h.pt.y * 650}
                          r="13"
                          fill={h.color}
                          stroke="#0F172A"
                          strokeWidth="2.5"
                        />
                        <rect
                          x={h.pt.x * 1000 - 75}
                          y={h.pt.y * 650 - 32}
                          width="150"
                          height="18"
                          rx="4"
                          fill="rgba(15, 23, 42, 0.9)"
                        />
                        <text
                          x={h.pt.x * 1000}
                          y={h.pt.y * 650 - 19}
                          fill="#FFFFFF"
                          fontFamily="IBM Plex Mono, monospace"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {h.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <Upload className="w-10 h-10 text-sky-400 mx-auto" />
                    <div className="text-sm font-bold text-white">
                      Upload Overall Full Tunnel Picture (with 1-Foot Field Scale)
                    </div>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Take a full picture of the tunnel with a 1-foot (0.3048 m) measuring scale on the rock. We will automatically extract tunnel Width, Height, and where Left Wall, Crown, and Right Wall start and end.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Select Full Tunnel Photo
                    </button>
                  </div>
                )}
              </div>

              <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{autoDetectNote}</span>
              </div>
            </div>

            {/* RIGHT COLUMN (5 COLS): SIMPLE 3-STEP CONTROLS & LIVE DIMENSIONS */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3">
              <div className="space-y-3">
                {/* STEP 1: SELECT FIELD SCALE BAR LENGTH (DEFAULT 1 FOOT = 0.3048 M) */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Step 1 · Field Measuring Scale Length (S1–S2)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[11px] font-bold">
                      {calibratedDimensions.pxPerMeter} px/m ({calibratedDimensions.mmPerPixel} mm/px)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {SCALE_PRESETS.map((preset) => {
                      const isSelected = Math.abs(scaleLengthMeters - preset.meters) < 0.001;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setScaleLengthMeters(preset.meters);
                            setCustomScaleInput(String(preset.meters));
                          }}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-2xs'
                              : 'bg-white hover:bg-amber-100/50 text-slate-800 border-amber-200'
                          }`}
                        >
                          <div className="text-xs font-bold">{preset.label}</div>
                          <div className="text-[10px] font-mono opacity-85">{preset.badge}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-amber-900 font-medium">
                      Custom Scale (meters):
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.05"
                      value={customScaleInput}
                      onChange={(e) => {
                        setCustomScaleInput(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (Number.isFinite(val) && val >= 0.05) {
                          setScaleLengthMeters(val);
                        }
                      }}
                      className="w-28 px-2 py-1 bg-white border border-amber-300 rounded font-mono text-xs font-bold text-slate-900"
                    />
                    <span className="text-[11px] font-mono text-amber-800">
                      = {(scaleLengthMeters * 3.28084).toFixed(2)} ft
                    </span>
                  </div>
                </div>

                {/* STEP 2: LIVE EXTRACTED TUNNEL & WALL/CROWN DIMENSIONS */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Step 2 · Extracted Tunnel &amp; Wall/Crown Dimensions
                    </span>
                    <span className="text-[11px] font-mono text-sky-700 font-semibold">
                      Live from 1-Ft Scale
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-500">TUNNEL WIDTH (SPAN W)</div>
                      <div className="text-sm font-bold text-slate-900">
                        {calibratedDimensions.widthMeters} m{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({calibratedDimensions.widthFeet} ft)
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-500">TOTAL HEIGHT (H)</div>
                      <div className="text-sm font-bold text-slate-900">
                        {calibratedDimensions.heightMeters} m{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({calibratedDimensions.heightFeet} ft)
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                      <div className="text-[10px] text-emerald-800 font-bold">
                        LEFT WALL (START → END)
                      </div>
                      <div className="text-sm font-bold text-emerald-950">
                        {calibratedDimensions.leftWallMeters} m{' '}
                        <span className="text-xs font-normal text-emerald-700">
                          ({calibratedDimensions.leftWallFeet} ft)
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-orange-50/70 border border-orange-200 rounded-lg">
                      <div className="text-[10px] text-orange-800 font-bold">
                        RIGHT WALL (START → END)
                      </div>
                      <div className="text-sm font-bold text-orange-950">
                        {calibratedDimensions.rightWallMeters} m{' '}
                        <span className="text-xs font-normal text-orange-700">
                          ({calibratedDimensions.rightWallFeet} ft)
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 p-2.5 bg-sky-50/70 border border-sky-200 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-sky-800 font-bold">
                          CROWN ARCH LENGTH (L-WALL END → APEX → R-WALL START)
                        </div>
                        <div className="text-sm font-bold text-sky-950">
                          {calibratedDimensions.crownArcMeters} m{' '}
                          <span className="text-xs font-normal text-sky-700">
                            ({calibratedDimensions.crownArcFeet} ft) · Crown Radius R ={' '}
                            {calibratedDimensions.crownRadiusMeters} m
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3: 1-CLICK APPLY BUTTON */}
              <div className="p-3.5 bg-emerald-950 text-white rounded-xl space-y-2">
                <div className="text-xs font-semibold text-emerald-200">
                  Step 3 · Lock Scale &amp; Update Tunnel Shape
                </div>
                <p className="text-[11px] text-slate-300">
                  Updates Tunnel Width, Height, Left Wall height, Right Wall height, Crown Arch, and locks your photo to {calibratedDimensions.pxPerMeter} px/m.
                </p>
                <button
                  type="button"
                  onClick={handleApplyFullPhotoSetup}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Full Photo Dimensions, Wall/Crown Split &amp; 1-Ft Scale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: 4-PART SIMPLE ACCURACY BOOSTER (ULTRA-SIMPLE 4 CARDS)
           ==================================================================== */}
        {activeTab === 'four_part_accuracy' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PART 1: 1-CLICK CORNER TRACE LINKER (EXACT 3D CROSS-SURFACE SOLVER) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-[10px] font-bold">
                      PART 1 · TRUE 3D ORIENTATION
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      ±1° Cross-Surface Accuracy
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-sky-600" />
                    1-Click Corner Trace Linker (Crown ↔ Wall ↔ Face)
                  </h3>
                  <p className="text-xs text-slate-600">
                    When a joint crosses two surfaces (e.g., Crown into Left/Right Wall or Face), linking them solves the exact 3D Strike &amp; Dip using 3D vector cross-product.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOneClickAutoLinkCornerTraces}
                    className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Auto-Link All Corner Traces &amp; Solve True 3D Dip
                  </button>

                  {joints.length >= 2 && (
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Or manually link any 2 traces across surfaces:
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedTraceAId}
                          onChange={(e) => setSelectedTraceAId(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                        >
                          {joints.map((j, idx) => (
                            <option key={j.id} value={j.id}>
                              #{idx + 1} {j.set} ({j.surface}) {Math.round(j.dipDirection)}°/{Math.round(j.dip)}°
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedTraceBId}
                          onChange={(e) => setSelectedTraceBId(e.target.value)}
                          className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                        >
                          {joints.map((j, idx) => (
                            <option key={j.id} value={j.id}>
                              #{idx + 1} {j.set} ({j.surface}) {Math.round(j.dipDirection)}°/{Math.round(j.dip)}°
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleLinkSelectedPair}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded cursor-pointer"
                      >
                        Link Selected Pair &amp; Compute Exact 3D Plane
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* PART 2: SIMPLE SMARTPHONE COMPASS / CLINOMETER CHECK */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                      PART 2 · FIELD COMPASS CHECK
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-700">
                      Ground-Truth Lock
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-amber-600" />
                    Simple Field Compass / Clinometer Calibration
                  </h3>
                  <p className="text-xs text-slate-600">
                    Enter 1 field compass measurement (Dip Direction &amp; Dip) for any joint set to lock its true 3D orientation and mark it as Directly Measured.
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-600">Joint Set</span>
                      <select
                        value={compassSetId}
                        onChange={(e) => setCompassSetId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold"
                      >
                        {['J1', 'J2', 'J3', 'J4', 'J5', 'F1', 'J0'].map((s) => (
                          <option key={s} value={s}>
                            Set {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-600">Dip Dir (0-360°)</span>
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={compassDipDir}
                        onChange={(e) => setCompassDipDir(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-600">Dip (0-90°)</span>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={compassDip}
                        onChange={(e) => setCompassDip(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyFieldCompassCalibration}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Apply Field Compass Reading to Set {compassSetId}
                  </button>
                </div>
              </div>

              {/* PART 3: 1-CLICK AUTO-SYNC MAPPED JOINTS TO RMR & Q-SYSTEM */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                      PART 3 · AUTO RMR &amp; Q-SYSTEM SYNC
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      ISRM Priest &amp; Hudson + Terzaghi
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-emerald-600" />
                    1-Click Sync Mapped Joints to RMR &amp; Q-System
                  </h3>
                  <p className="text-xs text-slate-600">
                    Automatically computes True RQD (%), Joint Set Rating (Jn), Mean Spacing, and Roughness (Jr) from your mapped photo traces and applies them to RMR89 &amp; Q-System.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    <div className="p-2 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-500">MAPPED RQD</div>
                      <div className="text-sm font-bold text-emerald-700">
                        {autoScanlineStats.intersectionCount >= 2
                          ? autoScanlineStats.measuredScanlineRqdPct
                          : structuralSuite.terzaghiCorrectedRqdPct}
                        %
                      </div>
                    </div>
                    <div className="p-2 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-500">MEAN SPACING</div>
                      <div className="text-sm font-bold text-sky-700">
                        {autoScanlineStats.intersectionCount >= 2
                          ? autoScanlineStats.meanSpacingMeters
                          : (parseFloat(jointSets[0]?.spacing || '0.35') || 0.35).toFixed(2)}{' '}
                        m
                      </div>
                    </div>
                    <div className="p-2 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[10px] text-slate-500">JOINT SETS</div>
                      <div className="text-sm font-bold text-slate-900">
                        {Math.max(1, jointSets.length)} Sets
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOneClickSyncToRmrAndQ}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sync Mapped RQD, Spacing &amp; Sets to RMR &amp; Q-System Now
                  </button>
                </div>
              </div>

              {/* PART 4: SIMPLE ROCK WEDGE / BLOCK SAFETY CHECK */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                      PART 4 · 3D WEDGE SAFETY CHECK
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        !worstWedge || worstWedge.factorOfSafetyDry >= 1.5
                          ? 'bg-emerald-100 text-emerald-800'
                          : worstWedge.factorOfSafetyDry >= 1.0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {!worstWedge || worstWedge.factorOfSafetyDry >= 1.5
                        ? 'SAFE (FS ≥ 1.5)'
                        : worstWedge.factorOfSafetyDry >= 1.0
                        ? 'CAUTION (1.0 ≤ FS < 1.5)'
                        : 'UNSTABLE WEDGE (FS < 1.0)'}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    {!worstWedge || worstWedge.factorOfSafetyDry >= 1.5 ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    )}
                    Simple Rock Block &amp; Wedge Stability Summary
                  </h3>
                  <p className="text-xs text-slate-600">
                    Checks your mapped joint sets ({jointSets.map((s) => s.id).join(', ') || 'J1, J2, J3'}) against the calibrated tunnel span ({geometry.width.toFixed(2)}m) to estimate block size and bolt length.
                  </p>
                </div>

                {worstWedge ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 font-mono text-xs">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">FACTOR OF SAFETY</div>
                        <div
                          className={`text-sm font-bold ${
                            worstWedge.factorOfSafetyDry >= 1.5
                              ? 'text-emerald-700'
                              : worstWedge.factorOfSafetyDry >= 1.0
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          FS = {worstWedge.factorOfSafetyDry.toFixed(2)}
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">WEDGE WEIGHT</div>
                        <div className="text-sm font-bold text-slate-900">
                          {worstWedge.estimatedMassTonnes.toFixed(1)} t
                        </div>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500">REC. BOLT LENGTH</div>
                        <div className="text-sm font-bold text-sky-700">
                          {worstWedge.recommendedBoltLengthM.toFixed(1)} m @{' '}
                          {worstWedge.recommendedBoltSpacingM.toFixed(1)}m
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Critical Zone: <strong>{worstWedge.affectedSurface.toUpperCase()}</strong> ({worstWedge.failureMode.replace(/_/g, ' ')}) · Apex Height: {worstWedge.wedgeApexHeightMeters.toFixed(2)}m
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                    Map at least 2–3 joint sets to view automatic 3D wedge weight &amp; bolt recommendations.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
