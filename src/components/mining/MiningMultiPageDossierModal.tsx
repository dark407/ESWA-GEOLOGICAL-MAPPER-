import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  FileText,
  X,
  CheckSquare,
  Square,
  Layers,
  EyeOff,
  Eye,
  Shield,
  TrendingUp,
  Compass,
} from 'lucide-react';
import {
  MiningStopeItem,
  MiningProjectItem,
  MiningLocationItem,
  MiningGeologicalFeature,
  MiningStopeShape,
} from '../../types/mining';
import { FaceChannelSampleRecord } from '../../types/tunnel';
import {
  calculateCompositeFaceAssays,
  calculateLaubscherMrmr,
  evaluateMathewsStability,
  generateMiningStopePolygon,
} from '../../engine/miningFaceEngine';
import {
  exportCanvasesAsPdfDocument,
  LogoOrSignatureCropConfig,
  renderSvgElementToHighResPngDataUrl,
} from '../../engine/fieldMappingEngine';
import {
  ReportHeaderLogoBox,
  ReportBorderlessGeologistSignRow,
  DEFAULT_LOGO_CROP_CONFIG,
} from '../UniversalLogoAndSignatureAdjuster';

export interface MiningMultiPageDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  driftId: string;
  chainage: string;
  mineLevel: string;
  stopeShape: MiningStopeShape;
  customRoofShape?: MiningStopeShape;
  stopeWidth: number;
  stopeHeight: number;
  wallHeight: number;
  headingAzimuth: number;
  faceDip: number;
  currentStope?: MiningStopeItem;
  currentLocation?: MiningLocationItem;
  currentProject?: MiningProjectItem;
  features: MiningGeologicalFeature[];
  channelSamples: FaceChannelSampleRecord[];
  composites: ReturnType<typeof calculateCompositeFaceAssays>;
  mrmrResult: ReturnType<typeof calculateLaubscherMrmr>;
  mathewsResult: ReturnType<typeof evaluateMathewsStability>;
}

interface PersistedLogoState {
  left?: string;
  leftRaw?: string;
  leftCfg?: LogoOrSignatureCropConfig;
  right?: string;
  rightRaw?: string;
  rightCfg?: LogoOrSignatureCropConfig;
}

interface PersistedSignState {
  geologistName: string;
  geologistSign: string;
  geologistSignRaw?: string;
  geologistCfg?: LogoOrSignatureCropConfig;
  geotechName: string;
  geotechSign: string;
  geotechSignRaw?: string;
  geotechCfg?: LogoOrSignatureCropConfig;
  chiefName: string;
  chiefSign: string;
  chiefSignRaw?: string;
  chiefCfg?: LogoOrSignatureCropConfig;
  remarks: string;
}

function pointsToSmoothSvgPath(pts: { px: number; py: number }[], closed = false): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)} L ${pts[1].px.toFixed(1)} ${pts[1].py.toFixed(1)}${closed ? ' Z' : ''}`;
  }
  const tension = 0.25;
  let d = `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)}`;
  const n = pts.length;
  const loopCount = closed ? n : n - 1;
  for (let i = 0; i < loopCount; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1.px + ((p2.px - (closed ? p0.px : i === 0 ? p1.px : p0.px)) * tension);
    const cp1y = p1.py + ((p2.py - (closed ? p0.py : i === 0 ? p1.py : p0.py)) * tension);
    const cp2x = p2.px - (((closed ? p3.px : i + 2 >= n ? p2.px : p3.px) - p1.px) * tension);
    const cp2y = p2.py - (((closed ? p3.py : i + 2 >= n ? p2.py : p3.py) - p1.py) * tension);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.px.toFixed(1)} ${p2.py.toFixed(1)}`;
  }
  if (closed) d += ' Z';
  return d;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const MiningMultiPageDossierModal: React.FC<MiningMultiPageDossierModalProps> = ({
  isOpen,
  onClose,
  driftId,
  chainage,
  mineLevel,
  stopeShape,
  customRoofShape,
  stopeWidth,
  stopeHeight,
  wallHeight,
  headingAzimuth,
  faceDip,
  currentStope,
  currentLocation,
  currentProject,
  features,
  channelSamples,
  composites,
  mrmrResult,
  mathewsResult,
}) => {
  const [dossierMode, setDossierMode] = useState<'FULL_3_PAGE' | 'COMPACT_2_PAGE' | 'SINGLE_PAGE'>('FULL_3_PAGE');
  const [autoHideEmpty, setAutoHideEmpty] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Configurable Section Visibility Toggles
  const [sections, setSections] = useState({
    faceMapAndFeatures: true,
    channelAssaysAndDilution: true,
    muckVerdictAndTonnage: true,
    mrmrAndMathewsStability: true,
    kinematicWedgeAndSupport: true,
  });

  // Persisted Dual Logos with Crop Config
  const [logos, setLogos] = useState<PersistedLogoState>(() => {
    try {
      const raw = localStorage.getItem('eswa_mining_dossier_logos_v2');
      if (raw) return JSON.parse(raw);
      const legacy = localStorage.getItem('eswa_mining_sheet_logos_v1');
      if (legacy) return JSON.parse(legacy);
    } catch {
      // ignore
    }
    return {};
  });

  const saveLogos = (updater: (prev: PersistedLogoState) => PersistedLogoState) => {
    setLogos((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('eswa_mining_dossier_logos_v2', JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  // Persisted Sign-Off Names, Signatures & Handover Remarks
  const [signState, setSignState] = useState<PersistedSignState>(() => {
    try {
      const raw = localStorage.getItem('eswa_mining_dossier_signs_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          geologistName: parsed.geologistName || currentStope?.responsibleGeologist || '',
          geologistSign: parsed.geologistSign || '',
          geologistSignRaw: parsed.geologistSignRaw || '',
          geologistCfg: parsed.geologistCfg || DEFAULT_LOGO_CROP_CONFIG,
          geotechName: parsed.geotechName || '',
          geotechSign: parsed.geotechSign || '',
          geotechSignRaw: parsed.geotechSignRaw || '',
          geotechCfg: parsed.geotechCfg || DEFAULT_LOGO_CROP_CONFIG,
          chiefName: parsed.chiefName || '',
          chiefSign: parsed.chiefSign || '',
          chiefSignRaw: parsed.chiefSignRaw || '',
          chiefCfg: parsed.chiefCfg || DEFAULT_LOGO_CROP_CONFIG,
          remarks:
            parsed.remarks ||
            `Face mapped at ${driftId} (${chainage}) on ${mineLevel}. Muck routing verdict: ${composites.verdict}. Follow Class ${mrmrResult.rockMassClass} ground support prior to drilling next round.`,
        };
      }
    } catch {
      // ignore
    }
    return {
      geologistName: currentStope?.responsibleGeologist || '',
      geologistSign: '',
      geotechName: '',
      geotechSign: '',
      chiefName: '',
      chiefSign: '',
      remarks: `Face mapped at ${driftId} (${chainage}) on ${mineLevel}. Muck routing verdict: ${composites.verdict}. Install Class ${mrmrResult.rockMassClass} support pattern before mucking/drilling.`,
    };
  });

  const updateSignState = (patch: Partial<PersistedSignState>) => {
    setSignState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('eswa_mining_dossier_signs_v2', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Exact Underground Profile Geometry
  const profileMetrics = useMemo(() => {
    const customPts =
      currentStope?.customProfilePoints && currentStope.customProfilePoints.length >= 3
        ? currentStope.customProfilePoints
        : currentLocation?.customProfilePoints && currentLocation.customProfilePoints.length >= 3
        ? currentLocation.customProfilePoints
        : undefined;
    return generateMiningStopePolygon(
      stopeShape,
      stopeWidth,
      stopeHeight,
      wallHeight,
      undefined,
      customPts,
      customRoofShape
    );
  }, [stopeShape, stopeWidth, stopeHeight, wallHeight, currentStope, currentLocation, customRoofShape]);

  // SVG Coordinate projection for the Face CAD Diagram (920 x 490 viewport: Left CAD Plot + Right Legend Key)
  const faceSvgConfig = useMemo(() => {
    const svgW = 920;
    const svgH = 490;
    const plotLeft = 58;
    const plotRight = 636;
    const padY = 46;
    const availW = plotRight - plotLeft;
    const availH = svgH - padY * 2;
    const scale = Math.min(availW / Math.max(0.5, stopeWidth), availH / Math.max(0.5, stopeHeight));
    const drawW = stopeWidth * scale;
    const drawH = stopeHeight * scale;
    const originX = plotLeft + (availW - drawW) / 2;
    const originY = svgH - padY - (availH - drawH) / 2; // bottom-left Y in SVG pixels

    const meterToSvg = (mx: number, my: number) => ({
      px: originX + mx * scale,
      py: originY - my * scale,
    });

    return { svgW, svgH, scale, drawW, drawH, originX, originY, plotLeft, plotRight, meterToSvg };
  }, [stopeWidth, stopeHeight]);

  // Structural Features & Kinematic Wedge Synthesis
  const structuralFeatures = useMemo(() => {
    return features.filter(
      (f) =>
        f.visible !== false &&
        (f.featureType === 'FAULT' ||
          f.featureType === 'SHEAR' ||
          f.featureType === 'JOINT' ||
          f.featureType === 'FOLIATION' ||
          f.featureType === 'VEIN' ||
          f.featureType === 'LITH_CONTACT')
    );
  }, [features]);

  const kinematicEvaluation = useMemo(() => {
    const setsCount = structuralFeatures.length;
    const steepFaults = structuralFeatures.filter(
      (f) => (f.featureType === 'FAULT' || f.featureType === 'SHEAR') && (f.dipDeg ?? 65) >= 45
    );
    const lowAngleJoints = structuralFeatures.filter((f) => (f.dipDeg ?? 65) < 45);
    const hasCriticalWedge = setsCount >= 3 || (steepFaults.length >= 1 && lowAngleJoints.length >= 1);
    const estimatedFos = hasCriticalWedge
      ? Math.max(1.15, Number((mrmrResult.designMrmr / 32).toFixed(2)))
      : Math.max(1.65, Number((mrmrResult.designMrmr / 24).toFixed(2)));
    const maxApexHeightM = Number((stopeWidth * (hasCriticalWedge ? 0.28 : 0.14)).toFixed(2));
    const wedgeTonnes = Number(((0.5 * stopeWidth * maxApexHeightM * 2.5 * (currentStope?.wasteSpecificGravity || 2.75)) / 3).toFixed(1));
    return {
      setsCount,
      hasCriticalWedge,
      estimatedFos,
      maxApexHeightM,
      wedgeTonnes,
      boltSpacingM: mrmrResult.designMrmr >= 60 ? 1.5 : mrmrResult.designMrmr >= 40 ? 1.2 : 1.0,
      boltLengthM: Math.max(1.8, Number((stopeWidth * 0.35).toFixed(1))),
      shotcreteMm: mrmrResult.designMrmr >= 65 ? 0 : mrmrResult.designMrmr >= 45 ? 50 : 100,
    };
  }, [structuralFeatures, mrmrResult.designMrmr, stopeWidth, currentStope?.wasteSpecificGravity]);

  if (!isOpen) return null;

  const gradeUnits = currentProject?.gradeUnits || 'g/t';
  const cutoffGrade = currentStope?.targetCutoffGrade ?? currentLocation?.targetCutoffGrade ?? 2.5;
  const visibleFeatures = features.filter((f) => f.visible !== false && f.points && f.points.length > 0);
  const showPage2 =
    dossierMode === 'FULL_3_PAGE' ||
    dossierMode === 'COMPACT_2_PAGE'
      ? sections.channelAssaysAndDilution || sections.muckVerdictAndTonnage
      : false;
  const showPage3 =
    dossierMode === 'FULL_3_PAGE' &&
    (sections.mrmrAndMathewsStability || sections.kinematicWedgeAndSupport);

  const totalPages = 1 + (showPage2 ? 1 : 0) + (showPage3 ? 1 : 0);

  const getPatternFillUrl = (f: MiningGeologicalFeature, prefix: string) => {
    const upperName = (f.name || '').toUpperCase();
    if (f.featureType === 'ORE_BOUNDARY') {
      if (upperName.includes('HIGH')) return `url(#${prefix}-oreHighGradePattern)`;
      if (upperName.includes('MED')) return `url(#${prefix}-oreMedGradePattern)`;
      if (upperName.includes('LOW')) return `url(#${prefix}-oreLowGradePattern)`;
      return `url(#${prefix}-oreHighGradePattern)`;
    }
    if (f.featureType === 'VEIN') return `url(#${prefix}-quartzVeinPattern)`;
    if (f.featureType === 'ALTERATION_HALO') return `url(#${prefix}-alterationHaloPattern)`;
    if (f.featureType === 'BRECCIA' || f.featureType === 'GOUGE') return `url(#${prefix}-faultBrecciaPattern)`;
    if (f.featureType === 'FAULT') return `url(#${prefix}-faultZonePattern)`;
    if (f.featureType === 'SHEAR') return `url(#${prefix}-shearZonePattern)`;
    if (f.featureType === 'JOINT') return `url(#${prefix}-jointZonePattern)`;
    if (f.featureType === 'FOLIATION') return `url(#${prefix}-foliationZonePattern)`;
    if (f.featureType === 'LITH_CONTACT' || f.featureType === 'DYKE') return `url(#${prefix}-wasteDykePattern)`;
    return f.colorHex || '#f59e0b';
  };

  // ============================================================================
  // HIGH-RES 300 DPI MULTI-PAGE PDF EXPORT (2480 x 3508 px per ISO A4 Page)
  // ============================================================================
  const handleExportMultiPage300DpiPdf = async () => {
    setIsExporting(true);
    try {
      const DPI_SCALE = 2.0; // 1240 x 1754 -> 2480 x 3508 px (True 300 DPI ISO A4)
      const W = 1240;
      const H = 1754;
      const canvases: HTMLCanvasElement[] = [];

      const leftLogoImg = await loadImageElement(logos.left || '');
      const rightLogoImg = await loadImageElement(logos.right || '');
      const geoSignImg = await loadImageElement(
        signState.geologistSign.startsWith('data:image/') ? signState.geologistSign : ''
      );
      const geotechSignImg = await loadImageElement(
        signState.geotechSign.startsWith('data:image/') ? signState.geotechSign : ''
      );
      const chiefSignImg = await loadImageElement(
        signState.chiefSign.startsWith('data:image/') ? signState.chiefSign : ''
      );

      const drawCommonHeader = (ctx: CanvasRenderingContext2D, pageNum: number, subtitle: string) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(28, 28, W - 56, H - 56);

        // Header Frame
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(36, 36, W - 72, 86);
        ctx.beginPath();
        ctx.moveTo(210, 36);
        ctx.lineTo(210, 122);
        ctx.moveTo(W - 210, 36);
        ctx.lineTo(W - 210, 122);
        ctx.stroke();

        // Left Logo
        if (leftLogoImg) {
          const sc = Math.min(156 / Math.max(1, leftLogoImg.width), 70 / Math.max(1, leftLogoImg.height));
          const dw = leftLogoImg.width * sc;
          const dh = leftLogoImg.height * sc;
          ctx.drawImage(leftLogoImg, 36 + (174 - dw) / 2, 36 + (86 - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((currentProject?.miningCompany || currentProject?.mineName || 'MINE OPERATOR').slice(0, 20), 123, 82);
        }

        // Right Logo
        if (rightLogoImg) {
          const sc = Math.min(156 / Math.max(1, rightLogoImg.width), 70 / Math.max(1, rightLogoImg.height));
          const dw = rightLogoImg.width * sc;
          const dh = rightLogoImg.height * sc;
          ctx.drawImage(rightLogoImg, W - 210 + (174 - dw) / 2, 36 + (86 - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('GRADE CONTROL & GEOTECH', W - 123, 74);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#475569';
          ctx.fillText(`SHEET ${pageNum} OF ${totalPages}`, W - 123, 94);
        }

        // Center Title
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 19px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UNDERGROUND MINING GEOLOGICAL & GRADE CONTROL DOSSIER', W / 2, 62);
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(
          `${currentProject?.projectName || 'Underground Mine'} · ${currentProject?.mineName || 'Mine Site'} · Commodity: ${currentProject?.primaryCommodity || 'Gold (Au)'}`,
          W / 2,
          84
        );
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11.5px monospace';
        ctx.fillText(
          `${subtitle}  |  Heading: ${driftId}  |  Chainage: ${chainage}  |  Level: ${mineLevel}  |  Page ${pageNum}/${totalPages}`,
          W / 2,
          106
        );
        ctx.textAlign = 'left';
      };

      const drawSignOffFooter = (ctx: CanvasRenderingContext2D, topY: number) => {
        // Remarks Box
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(36, topY, W - 72, 74);
        ctx.strokeRect(36, topY, W - 72, 74);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('GEOLOGIST SHIFT HANDOVER REMARKS, BLASTING & SUPPORT DIRECTIVES:', 46, topY + 18);
        ctx.font = '11.5px monospace';
        ctx.fillStyle = '#1e293b';
        const words = (signState.remarks || 'No additional remarks recorded.').split(' ');
        let line = '';
        let ly = topY + 38;
        words.forEach((w) => {
          if ((line + w).length > 130) {
            ctx.fillText(line, 46, ly);
            line = w + ' ';
            ly += 16;
          } else {
            line += w + ' ';
          }
        });
        if (line && ly <= topY + 68) ctx.fillText(line, 46, ly);

        // 3-Column Sign-Off
        const signY = topY + 84;
        const boxW = (W - 72) / 3;
        const roles = [
          {
            title: 'MAPPED BY (MINE GEOLOGIST)',
            name: signState.geologistName,
            signText: signState.geologistSign,
            img: geoSignImg,
          },
          {
            title: 'VERIFIED BY (GRADE CONTROL / GEOTECH)',
            name: signState.geotechName,
            signText: signState.geotechSign,
            img: geotechSignImg,
          },
          {
            title: 'APPROVED BY (CHIEF GEOLOGIST / CAPTAIN)',
            name: signState.chiefName,
            signText: signState.chiefSign,
            img: chiefSignImg,
          },
        ];

        roles.forEach((r, idx) => {
          const bx = 36 + idx * boxW;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx, signY, boxW, 88);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, signY, boxW, 88);

          ctx.fillStyle = '#475569';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(r.title, bx + 10, signY + 16);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(`Name: ${r.name || '______________________'}`, bx + 10, signY + 36);

          ctx.fillText('Sign:', bx + 10, signY + 66);
          if (r.img) {
            const sc = Math.min(130 / Math.max(1, r.img.width), 38 / Math.max(1, r.img.height));
            ctx.drawImage(r.img, bx + 56, signY + 42, r.img.width * sc, r.img.height * sc);
          } else if (r.signText && !r.signText.startsWith('data:image/')) {
            ctx.font = 'italic bold 13px serif';
            ctx.fillText(r.signText, bx + 56, signY + 66);
          } else {
            ctx.strokeStyle = '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(bx + 52, signY + 68);
            ctx.lineTo(bx + 210, signY + 68);
            ctx.stroke();
          }
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, bx + boxW - 115, signY + 80);
        });
      };

      // ======================================================================
      // PAGE 1: COVER METADATA, SCALED FACE CAD DIAGRAM & GEOLOGICAL FEATURES
      // ======================================================================
      const c1 = document.createElement('canvas');
      c1.width = Math.round(W * DPI_SCALE);
      c1.height = Math.round(H * DPI_SCALE);
      const ctx1 = c1.getContext('2d')!;
      ctx1.scale(DPI_SCALE, DPI_SCALE);
      drawCommonHeader(ctx1, 1, '01. STOPE FACE CAD MAPPING & STRUCTURAL INVENTORY');

      // Metadata Grid
      let y1 = 132;
      ctx1.fillStyle = '#f8fafc';
      ctx1.fillRect(36, y1, W - 72, 68);
      ctx1.strokeStyle = '#0f172a';
      ctx1.lineWidth = 1.5;
      ctx1.strokeRect(36, y1, W - 72, 68);

      const metaItems = [
        ['HEADING / STOPE ID', driftId],
        ['MINE LEVEL (mRL)', mineLevel],
        ['FACE STATION / CUT', chainage],
        ['EXCAVATION SHAPE', `${stopeShape.toUpperCase()} (${stopeWidth}m × ${stopeHeight}m)`],
        ['WALL HT / AREA', `${wallHeight}m  |  ${profileMetrics.areaM2} m²`],
        ['DRIVE AZIMUTH / DIP', `${headingAzimuth}°  |  ${faceDip}°`],
        ['MINING METHOD', currentStope?.miningMethod || 'Cut & Fill / Open Stope'],
        ['CUTOFF / VERDICT', `${cutoffGrade} ${gradeUnits}  →  ${composites.verdict}`],
      ];
      const cellW = (W - 72) / 4;
      metaItems.forEach((item, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const cx = 36 + col * cellW;
        const cy = y1 + row * 34;
        ctx1.strokeStyle = '#cbd5e1';
        ctx1.strokeRect(cx, cy, cellW, 34);
        ctx1.fillStyle = '#64748b';
        ctx1.font = 'bold 9.5px sans-serif';
        ctx1.textAlign = 'left';
        ctx1.fillText(item[0], cx + 8, cy + 12);
        ctx1.fillStyle = '#0f172a';
        ctx1.font = 'bold 11.5px monospace';
        ctx1.fillText(String(item[1]).slice(0, 32), cx + 8, cy + 27);
      });

      y1 += 80;

      // Render Scaled Underground Face SVG
      const faceSvgEl = document.getElementById('mining-dossier-face-svg') as unknown as SVGSVGElement | null;
      const facePng = await renderSvgElementToHighResPngDataUrl(faceSvgEl, 2800);
      const faceBoxH = 590;
      ctx1.strokeStyle = '#0f172a';
      ctx1.lineWidth = 2;
      ctx1.strokeRect(36, y1, W - 72, faceBoxH);
      ctx1.fillStyle = '#0f172a';
      ctx1.fillRect(36, y1, W - 72, 26);
      ctx1.fillStyle = '#ffffff';
      ctx1.font = 'bold 11.5px sans-serif';
      ctx1.textAlign = 'left';
      ctx1.fillText(
        `01. TRUE-TO-SCALE UNDERGROUND EXCAVATION FACE CAD MAP (${stopeShape.toUpperCase()} — ${stopeWidth}m W × ${stopeHeight}m H, AREA ${profileMetrics.areaM2} m²)`,
        46,
        y1 + 17
      );

      if (facePng) {
        const faceImg = await loadImageElement(facePng);
        if (faceImg) {
          const sc = Math.min((W - 96) / Math.max(1, faceImg.width), (faceBoxH - 40) / Math.max(1, faceImg.height));
          const dw = faceImg.width * sc;
          const dh = faceImg.height * sc;
          ctx1.drawImage(faceImg, (W - dw) / 2, y1 + 30 + (faceBoxH - 36 - dh) / 2, dw, dh);
        }
      }
      y1 += faceBoxH + 14;

      // Mapped Geological Features Table on Page 1
      ctx1.fillStyle = '#0f172a';
      ctx1.fillRect(36, y1, W - 72, 26);
      ctx1.fillStyle = '#ffffff';
      ctx1.font = 'bold 11.5px sans-serif';
      ctx1.textAlign = 'left';
      ctx1.fillText(
        `02. MAPPED LITHOLOGY, ORE LODE & STRUCTURAL FEATURE REGISTER (${visibleFeatures.length} Features Logged)`,
        46,
        y1 + 17
      );
      y1 += 26;

      const fCols = [
        { label: '#', w: 50 },
        { label: 'FEATURE CLASS', w: 170 },
        { label: 'LITHOLOGY / LODE / STRUCTURE NAME', w: 310 },
        { label: 'GEOMETRY', w: 120 },
        { label: 'ORIENTATION (STRIKE / DIP / DIR)', w: 240 },
        { label: 'THICKNESS / WATER / INFILL', w: 278 },
      ];
      ctx1.fillStyle = '#e2e8f0';
      ctx1.fillRect(36, y1, W - 72, 24);
      ctx1.strokeStyle = '#0f172a';
      ctx1.strokeRect(36, y1, W - 72, 24);
      let fx = 36;
      ctx1.fillStyle = '#0f172a';
      ctx1.font = 'bold 10px monospace';
      fCols.forEach((c) => {
        ctx1.fillText(c.label, fx + 6, y1 + 16);
        fx += c.w;
      });
      y1 += 24;

      const maxFeatRows = totalPages === 1 ? 8 : 14;
      if (visibleFeatures.length === 0) {
        ctx1.fillStyle = '#f8fafc';
        ctx1.fillRect(36, y1, W - 72, 32);
        ctx1.strokeStyle = '#cbd5e1';
        ctx1.strokeRect(36, y1, W - 72, 32);
        ctx1.fillStyle = '#64748b';
        ctx1.font = 'italic 11px sans-serif';
        ctx1.fillText('No geological polygons or structural traces drawn on this face interval.', 48, y1 + 20);
        y1 += 32;
      } else {
        visibleFeatures.slice(0, maxFeatRows).forEach((f, idx) => {
          ctx1.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          ctx1.fillRect(36, y1, W - 72, 24);
          ctx1.strokeStyle = '#cbd5e1';
          ctx1.strokeRect(36, y1, W - 72, 24);
          ctx1.fillStyle = '#0f172a';
          ctx1.font = '10.5px monospace';
          const orient =
            f.strikeDeg !== undefined || f.dipDeg !== undefined
              ? `Str ${f.strikeDeg ?? 45}° / Dip ${f.dipDeg ?? 65}° / Dir ${f.dipDirectionDeg ?? 135}°`
              : 'Face Contact / Trace';
          const notes = [
            f.trueThicknessM ? `True ${f.trueThicknessM}m` : '',
            f.waterInflow || 'DRY',
            f.infill || '',
          ]
            .filter(Boolean)
            .join(' · ');
          const rowVals = [
            String(idx + 1).padStart(2, '0'),
            f.featureType,
            (f.name || f.featureType).slice(0, 38),
            f.geometryType,
            orient,
            notes.slice(0, 34),
          ];
          let rx = 36;
          rowVals.forEach((val, ci) => {
            ctx1.fillText(val, rx + 6, y1 + 16);
            rx += fCols[ci].w;
          });
          y1 += 24;
        });
      }

      if (totalPages === 1) {
        drawSignOffFooter(ctx1, H - 210);
      }
      canvases.push(c1);

      // ======================================================================
      // PAGE 2: GRADE CONTROL, CHANNEL ASSAY TABLE & MUCK ROUTING RECONCILIATION
      // ======================================================================
      if (showPage2) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(W * DPI_SCALE);
        c2.height = Math.round(H * DPI_SCALE);
        const ctx2 = c2.getContext('2d')!;
        ctx2.scale(DPI_SCALE, DPI_SCALE);
        drawCommonHeader(ctx2, 2, '02. GRADE CONTROL, CHANNEL ASSAYS & MUCK ROUTING RECONCILIATION');

        let y2 = 136;

        // Muck Routing Verdict Banner
        ctx2.fillStyle = '#0f172a';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 11.5px sans-serif';
        ctx2.textAlign = 'left';
        ctx2.fillText('03. MUCK HAULAGE ROUTING VERDICT, BLAST TONNAGE & METAL RECONCILIATION', 46, y2 + 17);
        y2 += 26;

        ctx2.fillStyle = '#f8fafc';
        ctx2.fillRect(36, y2, W - 72, 92);
        ctx2.strokeStyle = '#0f172a';
        ctx2.lineWidth = 1.5;
        ctx2.strokeRect(36, y2, W - 72, 92);

        const kpiCards = [
          ['MUCK DISPATCH VERDICT', composites.verdict, composites.verdictDescription.slice(0, 36)],
          ['WEIGHTED FACE GRADE', `${composites.weightedGrade} ${gradeUnits}`, `Target Cutoff: ${cutoffGrade} ${gradeUnits}`],
          ['UNPLANNED DILUTION', `${composites.dilutionPercentByMass} %`, `Ore SG: ${currentStope?.oreSpecificGravity || 3.35} | Waste SG: ${currentStope?.wasteSpecificGravity || 2.75}`],
          ['ROUND TONNAGE & METAL', `${composites.estimatedTonnesPerRound} t`, `${(composites.containedMetalUnits / 31.1035).toFixed(2)} oz (${composites.containedMetalUnits.toFixed(0)} g)`],
        ];
        const kpiW = (W - 72) / 4;
        kpiCards.forEach((k, idx) => {
          const kx = 36 + idx * kpiW;
          ctx2.strokeStyle = '#cbd5e1';
          ctx2.strokeRect(kx, y2, kpiW, 92);
          ctx2.fillStyle = '#64748b';
          ctx2.font = 'bold 10px sans-serif';
          ctx2.fillText(k[0], kx + 12, y2 + 22);
          ctx2.fillStyle = idx === 0 ? '#b45309' : '#0f172a';
          ctx2.font = 'bold 20px monospace';
          ctx2.fillText(String(k[1]), kx + 12, y2 + 52);
          ctx2.fillStyle = '#475569';
          ctx2.font = '10.5px monospace';
          ctx2.fillText(String(k[2]), kx + 12, y2 + 76);
        });
        y2 += 108;

        // Channel Assay Table
        ctx2.fillStyle = '#0f172a';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 11.5px sans-serif';
        ctx2.fillText(
          `04. CHANNEL SAMPLING ASSAY REGISTER & MASS-WEIGHTED COMPOSITE CALCULATION (${channelSamples.length} Channel Cuts)`,
          46,
          y2 + 17
        );
        y2 += 26;

        const aCols = [
          { label: 'SAMPLE ID', w: 140 },
          { label: 'INTERVAL (m)', w: 160 },
          { label: 'CUT WIDTH (m)', w: 130 },
          { label: 'TRUE THICK (m)', w: 140 },
          { label: 'ROCK SG', w: 110 },
          { label: `ASSAY (${gradeUnits})`, w: 150 },
          { label: 'GRADE × LENGTH × SG', w: 180 },
          { label: 'CLASSIFICATION', w: 158 },
        ];
        ctx2.fillStyle = '#e2e8f0';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.strokeStyle = '#0f172a';
        ctx2.strokeRect(36, y2, W - 72, 26);
        let ax = 36;
        ctx2.fillStyle = '#0f172a';
        ctx2.font = 'bold 10px monospace';
        aCols.forEach((c) => {
          ctx2.fillText(c.label, ax + 6, y2 + 17);
          ax += c.w;
        });
        y2 += 26;

        if (channelSamples.length === 0) {
          ctx2.fillStyle = '#f8fafc';
          ctx2.fillRect(36, y2, W - 72, 36);
          ctx2.strokeStyle = '#cbd5e1';
          ctx2.strokeRect(36, y2, W - 72, 36);
          ctx2.fillStyle = '#64748b';
          ctx2.font = 'italic 11.5px sans-serif';
          ctx2.fillText('No channel samples logged on this face. Reconciliation computed from default face parameters.', 48, y2 + 22);
          y2 += 36;
        } else {
          channelSamples.slice(0, 18).forEach((s, idx) => {
            const widthM = Math.max(0.05, Number(Math.abs((s.toMeter ?? 0) - (s.fromMeter ?? 0)).toFixed(2)));
            const trueM = Number((s.trueThicknessMeters || widthM * 0.92).toFixed(2));
            const sg = s.specificGravity || 3.35;
            const grade = typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(String(s.gradeValue || '0')) || 0;
            const accum = (grade * widthM * sg).toFixed(2);
            const cat = grade >= cutoffGrade ? 'HIGH GRADE ORE' : grade >= cutoffGrade * 0.5 ? 'MARGINAL / LOW' : 'WASTE ROCK';

            ctx2.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            ctx2.fillRect(36, y2, W - 72, 26);
            ctx2.strokeStyle = '#cbd5e1';
            ctx2.strokeRect(36, y2, W - 72, 26);
            ctx2.fillStyle = '#0f172a';
            ctx2.font = 'bold 10.5px monospace';
            const vals = [
              s.sampleNumber || `CH-${idx + 1}`,
              `${s.fromMeter.toFixed(2)} – ${s.toMeter.toFixed(2)}`,
              `${widthM.toFixed(2)} m`,
              `${trueM.toFixed(2)} m`,
              sg.toFixed(2),
              grade.toFixed(2),
              accum,
              cat,
            ];
            let rx = 36;
            vals.forEach((v, ci) => {
              ctx2.fillText(v, rx + 6, y2 + 17);
              rx += aCols[ci].w;
            });
            y2 += 26;
          });
        }

        y2 += 16;

        // Render Grade Profile SVG Chart if available
        const gradeChartSvg = document.getElementById('mining-dossier-grade-chart-svg') as unknown as SVGSVGElement | null;
        const gradeChartPng = await renderSvgElementToHighResPngDataUrl(gradeChartSvg, 2200);
        if (gradeChartPng) {
          const gImg = await loadImageElement(gradeChartPng);
          if (gImg) {
            const chartBoxH = Math.min(340, H - y2 - (totalPages === 2 ? 225 : 60));
            if (chartBoxH >= 180) {
              ctx2.fillStyle = '#0f172a';
              ctx2.fillRect(36, y2, W - 72, 26);
              ctx2.fillStyle = '#ffffff';
              ctx2.font = 'bold 11.5px sans-serif';
              ctx2.fillText('05. ACROSS-FACE CHANNEL ASSAY GRADE PROFILE VS. TARGET CUTOFF THRESHOLD', 46, y2 + 17);
              y2 += 26;
              ctx2.strokeStyle = '#0f172a';
              ctx2.strokeRect(36, y2, W - 72, chartBoxH);
              const sc = Math.min((W - 96) / Math.max(1, gImg.width), (chartBoxH - 16) / Math.max(1, gImg.height));
              const dw = gImg.width * sc;
              const dh = gImg.height * sc;
              ctx2.drawImage(gImg, (W - dw) / 2, y2 + (chartBoxH - dh) / 2, dw, dh);
            }
          }
        }

        if (totalPages === 2) {
          drawSignOffFooter(ctx2, H - 210);
        }
        canvases.push(c2);
      }

      // ======================================================================
      // PAGE 3: LAUBSCHER MRMR, MATHEWS-POTVIN GRAPH, KINEMATIC WEDGE & SIGN-OFF
      // ======================================================================
      if (showPage3) {
        const c3 = document.createElement('canvas');
        c3.width = Math.round(W * DPI_SCALE);
        c3.height = Math.round(H * DPI_SCALE);
        const ctx3 = c3.getContext('2d')!;
        ctx3.scale(DPI_SCALE, DPI_SCALE);
        drawCommonHeader(ctx3, canvases.length + 1, '03. GEOMECHANICAL STABILITY (MRMR & MATHEWS), WEDGE ANALYSIS & SIGN-OFF');

        let y3 = 136;

        // Section 06: Laubscher MRMR & Mathews-Potvin Summary
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(36, y3, W - 72, 26);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11.5px sans-serif';
        ctx3.textAlign = 'left';
        ctx3.fillText('06. LAUBSCHER MINING ROCK MASS RATING (MRMR) & MATHEWS-POTVIN STOPE STABILITY EVALUATION', 46, y3 + 17);
        y3 += 26;

        const mrmrParams = currentStope?.mrmr;
        const mathewsParams = currentStope?.mathews;

        ctx3.fillStyle = '#f8fafc';
        ctx3.fillRect(36, y3, W - 72, 136);
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(36, y3, W - 72, 136);

        const geoItems = [
          ['IN-SITU RMR (BASE)', `${mrmrResult.baseRmr} / 100`],
          ['MRMR ADJUSTMENTS', `Weath ${Math.round((mrmrParams?.weatheringFactor ?? 0.95) * 100)}% · Stress ${Math.round((mrmrParams?.miningInducedStressFactor ?? 0.9) * 100)}% · Joint ${Math.round((mrmrParams?.jointOrientationFactor ?? 0.85) * 100)}% · Blast ${Math.round((mrmrParams?.blastingDamageFactor ?? 0.94) * 100)}%`],
          ['FINAL DESIGN MRMR', `${mrmrResult.designMrmr} / 100 (${mrmrResult.rockMassClass})`],
          ['REQUIRED GROUND SUPPORT', mrmrResult.recommendedSupport],
          ['HYDRAULIC RADIUS (HR)', `${mathewsResult.hydraulicRadiusM.toFixed(2)} m (Area / Perimeter)`],
          ['STABILITY NUMBER (N\')', `${mathewsResult.stabilityNumberN.toFixed(2)} (Q'=${mathewsResult.qPrime} × A=${mathewsParams?.stressFactorA ?? 0.7} × B=${mathewsParams?.jointOrientationFactorB ?? 0.5} × C=${mathewsParams?.gravityFactorC ?? 4.2})`],
          ['MATHEWS STABILITY ZONE', mathewsResult.zoneLabel],
          ['KINEMATIC WEDGE FOS', `FoS = ${kinematicEvaluation.estimatedFos} (${kinematicEvaluation.hasCriticalWedge ? 'Systematic + Spot Bolting Required' : 'Stable with Standard Pattern'})`],
        ];
        const gCellW = (W - 72) / 2;
        geoItems.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const gx = 36 + col * gCellW;
          const gy = y3 + row * 34;
          ctx3.strokeStyle = '#cbd5e1';
          ctx3.strokeRect(gx, gy, gCellW, 34);
          ctx3.fillStyle = '#64748b';
          ctx3.font = 'bold 9.5px sans-serif';
          ctx3.textAlign = 'left';
          ctx3.fillText(item[0], gx + 10, gy + 12);
          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 11px monospace';
          ctx3.fillText(String(item[1]).slice(0, 78), gx + 10, gy + 27);
        });
        y3 += 148;

        // Render Mathews-Potvin & Support Pattern SVGs side-by-side
        const mathewsSvgEl = document.getElementById('mining-dossier-mathews-svg') as unknown as SVGSVGElement | null;
        const supportSvgEl = document.getElementById('mining-dossier-support-svg') as unknown as SVGSVGElement | null;
        const [mathewsPng, supportPng] = await Promise.all([
          renderSvgElementToHighResPngDataUrl(mathewsSvgEl, 1600),
          renderSvgElementToHighResPngDataUrl(supportSvgEl, 1600),
        ]);

        const diagBoxH = 440;
        const halfW = (W - 84) / 2;

        // Left Box: Mathews-Potvin Graph
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(36, y3, halfW, 26);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11px sans-serif';
        ctx3.fillText('07A. MATHEWS-POTVIN STABILITY GRAPH (HR vs. N\')', 46, y3 + 17);
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(36, y3 + 26, halfW, diagBoxH);
        if (mathewsPng) {
          const mImg = await loadImageElement(mathewsPng);
          if (mImg) {
            const sc = Math.min((halfW - 20) / Math.max(1, mImg.width), (diagBoxH - 20) / Math.max(1, mImg.height));
            const dw = mImg.width * sc;
            const dh = mImg.height * sc;
            ctx3.drawImage(mImg, 36 + (halfW - dw) / 2, y3 + 26 + (diagBoxH - dh) / 2, dw, dh);
          }
        }

        // Right Box: Ground Support Pattern Cross-Section
        const rightX = 36 + halfW + 12;
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(rightX, y3, halfW, 26);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11px sans-serif';
        ctx3.fillText('07B. DESIGN GROUND SUPPORT & BOLTING CROSS-SECTION', rightX + 10, y3 + 17);
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(rightX, y3 + 26, halfW, diagBoxH);
        if (supportPng) {
          const sImg = await loadImageElement(supportPng);
          if (sImg) {
            const sc = Math.min((halfW - 20) / Math.max(1, sImg.width), (diagBoxH - 20) / Math.max(1, sImg.height));
            const dw = sImg.width * sc;
            const dh = sImg.height * sc;
            ctx3.drawImage(sImg, rightX + (halfW - dw) / 2, y3 + 26 + (diagBoxH - dh) / 2, dw, dh);
          }
        }

        y3 += diagBoxH + 42;

        // Kinematic Wedge Summary Table
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(36, y3, W - 72, 24);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11px sans-serif';
        ctx3.fillText('08. KINEMATIC WEDGE & GROUND SUPPORT SPECIFICATION SUMMARY', 46, y3 + 16);
        y3 += 24;

        ctx3.fillStyle = '#f8fafc';
        ctx3.fillRect(36, y3, W - 72, 46);
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(36, y3, W - 72, 46);
        ctx3.fillStyle = '#0f172a';
        ctx3.font = 'bold 11px monospace';
        ctx3.fillText(
          `Structural Sets: ${kinematicEvaluation.setsCount}  |  Max Wedge Apex: ${kinematicEvaluation.maxApexHeightM} m (${kinematicEvaluation.wedgeTonnes} t)  |  Kinematic FoS: ${kinematicEvaluation.estimatedFos}  |  Bolts: L=${kinematicEvaluation.boltLengthM}m @ ${kinematicEvaluation.boltSpacingM}m×${kinematicEvaluation.boltSpacingM}m  |  Shotcrete: ${kinematicEvaluation.shotcreteMm} mm`,
          48,
          y3 + 28
        );

        drawSignOffFooter(ctx3, H - 210);
        canvases.push(c3);
      }

      const safeCh = chainage.replace(/[^a-zA-Z0-9_-]/g, '_');
      exportCanvasesAsPdfDocument(
        canvases,
        `${driftId}_${safeCh}_Mining_Analytical_Dossier_300DPI.pdf`,
        'portrait',
        'A4'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // EDITABLE WORD (.DOCX / MHTML WORD) EXPORT
  // ============================================================================
  const handleExportEditableWordDoc = async () => {
    setIsExporting(true);
    try {
      const faceSvgEl = document.getElementById('mining-dossier-face-svg') as unknown as SVGSVGElement | null;
      const mathewsSvgEl = document.getElementById('mining-dossier-mathews-svg') as unknown as SVGSVGElement | null;
      const supportSvgEl = document.getElementById('mining-dossier-support-svg') as unknown as SVGSVGElement | null;
      const [facePng, mathewsPng, supportPng] = await Promise.all([
        renderSvgElementToHighResPngDataUrl(faceSvgEl, 1800),
        renderSvgElementToHighResPngDataUrl(mathewsSvgEl, 1200),
        renderSvgElementToHighResPngDataUrl(supportSvgEl, 1200),
      ]);

      const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>Underground Mining Dossier - ${driftId} (${chainage})</title>
<style>
  @page { size: 210mm 297mm; margin: 12mm; }
  body { font-family: Calibri, Arial, sans-serif; color: #0f172a; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
  th, td { border: 1px solid #0f172a; padding: 5pt 6pt; text-align: left; font-size: 9.5pt; }
  th { background-color: #e2e8f0; font-weight: bold; }
  .sec-hdr { background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 5pt 8pt; font-size: 10.5pt; margin-top: 8pt; margin-bottom: 4pt; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <table>
    <tr>
      <td style="width:20%;text-align:center;">
        ${logos.left ? `<img src="${logos.left}" width="110" height="45" />` : `<strong>${currentProject?.miningCompany || currentProject?.mineName || 'MINE LOGO'}</strong>`}
      </td>
      <td style="width:60%;text-align:center;">
        <div style="font-size:14pt;font-weight:bold;">UNDERGROUND MINING GEOLOGICAL &amp; GRADE CONTROL DOSSIER</div>
        <div style="font-size:10pt;margin-top:2pt;">${currentProject?.projectName || 'Underground Mine'} · ${currentProject?.mineName || 'Mine Site'} · Commodity: ${currentProject?.primaryCommodity || 'Gold (Au)'}</div>
        <div style="font-size:9pt;color:#334155;margin-top:2pt;">Heading: <strong>${driftId}</strong> | Chainage: <strong>${chainage}</strong> | Level: <strong>${mineLevel}</strong> | Date: ${new Date().toLocaleDateString()}</div>
      </td>
      <td style="width:20%;text-align:center;">
        ${logos.right ? `<img src="${logos.right}" width="110" height="45" />` : `<strong>GRADE CONTROL</strong>`}
      </td>
    </tr>
  </table>

  <div class="sec-hdr">01. EXCAVATION PROFILE &amp; STOPE FACE METADATA</div>
  <table>
    <tr>
      <th>Heading / Stope ID</th><td>${driftId}</td>
      <th>Mine Level (mRL)</th><td>${mineLevel}</td>
      <th>Face Chainage / Cut</th><td>${chainage}</td>
      <th>Mining Method</th><td>${currentStope?.miningMethod || 'Cut & Fill'}</td>
    </tr>
    <tr>
      <th>Underground Shape</th><td>${stopeShape.toUpperCase()} (${stopeWidth}m × ${stopeHeight}m)</td>
      <th>Wall Height / Area</th><td>${wallHeight}m / ${profileMetrics.areaM2} m²</td>
      <th>Azimuth / Face Dip</th><td>${headingAzimuth}° / ${faceDip}°</td>
      <th>Target Cutoff Grade</th><td>${cutoffGrade} ${gradeUnits}</td>
    </tr>
  </table>

  ${facePng ? `<div class="sec-hdr">02. SCALED UNDERGROUND FACE CAD DIAGRAM</div><div style="text-align:center;border:1px solid #0f172a;padding:6pt;margin-bottom:10pt;"><img src="${facePng}" width="620" /></div>` : ''}

  <div class="sec-hdr">03. MAPPED LITHOLOGY, ORE LODE &amp; STRUCTURAL INVENTORY (${visibleFeatures.length} Features)</div>
  <table>
    <thead>
      <tr><th>#</th><th>Feature Class</th><th>Lithology / Structure Name</th><th>Geometry</th><th>Orientation</th><th>Thickness / Water / Infill</th></tr>
    </thead>
    <tbody>
      ${
        visibleFeatures.length === 0
          ? `<tr><td colspan="6">No geological features mapped on this face.</td></tr>`
          : visibleFeatures
              .map(
                (f, i) =>
                  `<tr><td>${i + 1}</td><td>${f.featureType}</td><td>${f.name}</td><td>${f.geometryType}</td><td>Str ${f.strikeDeg ?? 45}° / Dip ${f.dipDeg ?? 65}°</td><td>${f.trueThicknessM ? `${f.trueThicknessM}m · ` : ''}${f.waterInflow || 'DRY'} ${f.infill || ''}</td></tr>`
              )
              .join('')
      }
    </tbody>
  </table>

  <div class="page-break"></div>
  <div class="sec-hdr">04. MUCK HAULAGE ROUTING VERDICT, BLAST TONNAGE &amp; METAL RECONCILIATION</div>
  <table>
    <tr>
      <th>Muck Routing Verdict</th><td><strong>${composites.verdict}</strong> (${composites.verdictDescription})</td>
      <th>Weighted Face Grade</th><td><strong>${composites.weightedGrade} ${gradeUnits}</strong></td>
    </tr>
    <tr>
      <th>Unplanned Dilution</th><td>${composites.dilutionPercentByMass} %</td>
      <th>Estimated Round Tonnage</th><td>${composites.estimatedTonnesPerRound} t (Contained: ${(composites.containedMetalUnits / 31.1035).toFixed(2)} oz / ${composites.containedMetalUnits.toFixed(0)} g)</td>
    </tr>
  </table>

  <div class="sec-hdr">05. CHANNEL SAMPLING ASSAY TABLE (${channelSamples.length} Cuts)</div>
  <table>
    <thead>
      <tr><th>Sample ID</th><th>Interval (m)</th><th>Width (m)</th><th>SG</th><th>Assay Grade (${gradeUnits})</th><th>Classification</th></tr>
    </thead>
    <tbody>
      ${
        channelSamples.length === 0
          ? `<tr><td colspan="6">No channel samples recorded on this face.</td></tr>`
          : channelSamples
              .map((s) => {
                const g = typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(String(s.gradeValue || '0')) || 0;
                const w = Math.abs((s.toMeter ?? 0) - (s.fromMeter ?? 0)).toFixed(2);
                return `<tr><td><strong>${s.sampleNumber}</strong></td><td>${s.fromMeter} – ${s.toMeter} m</td><td>${w} m</td><td>${s.specificGravity || 3.35}</td><td><strong>${g.toFixed(2)} ${gradeUnits}</strong></td><td>${g >= cutoffGrade ? 'ORE' : 'WASTE / MARGINAL'}</td></tr>`;
              })
              .join('')
      }
    </tbody>
  </table>

  <div class="sec-hdr">06. LAUBSCHER MRMR, MATHEWS-POTVIN STABILITY &amp; KINEMATIC WEDGE ANALYSIS</div>
  <table>
    <tr>
      <th>In-Situ RMR</th><td>${mrmrResult.baseRmr} / 100</td>
      <th>Design MRMR</th><td><strong>${mrmrResult.designMrmr} / 100 (${mrmrResult.rockMassClass})</strong></td>
    </tr>
    <tr>
      <th>Mathews Hydraulic Radius (HR)</th><td>${mathewsResult.hydraulicRadiusM.toFixed(2)} m</td>
      <th>Modified Stability Number (N')</th><td><strong>${mathewsResult.stabilityNumberN.toFixed(2)} (${mathewsResult.zoneLabel})</strong></td>
    </tr>
    <tr>
      <th>Recommended Ground Support</th><td colspan="3"><strong>${mrmrResult.recommendedSupport}</strong> (Bolts L=${kinematicEvaluation.boltLengthM}m @ ${kinematicEvaluation.boltSpacingM}m×${kinematicEvaluation.boltSpacingM}m, Kinematic Wedge FoS=${kinematicEvaluation.estimatedFos})</td>
    </tr>
  </table>

  ${
    mathewsPng || supportPng
      ? `<table><tr>
          <td style="width:50%;text-align:center;">${mathewsPng ? `<img src="${mathewsPng}" width="290" />` : ''}</td>
          <td style="width:50%;text-align:center;">${supportPng ? `<img src="${supportPng}" width="290" />` : ''}</td>
        </tr></table>`
      : ''
  }

  <div class="sec-hdr">07. GEOLOGIST SHIFT HANDOVER REMARKS &amp; OFFICIAL SIGN-OFF</div>
  <p style="border:1px solid #0f172a;padding:6pt;background:#f8fafc;">${signState.remarks}</p>
  <table>
    <tr>
      <td style="width:33.3%;">
        <strong>MAPPED BY (MINE GEOLOGIST)</strong><br/>
        Name: ${signState.geologistName || '____________________'}<br/>
        Sign: ${signState.geologistSign.startsWith('data:image/') ? `<img src="${signState.geologistSign}" height="32" />` : signState.geologistSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
      <td style="width:33.3%;">
        <strong>VERIFIED BY (GRADE CONTROL / GEOTECH)</strong><br/>
        Name: ${signState.geotechName || '____________________'}<br/>
        Sign: ${signState.geotechSign.startsWith('data:image/') ? `<img src="${signState.geotechSign}" height="32" />` : signState.geotechSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
      <td style="width:33.3%;">
        <strong>APPROVED BY (CHIEF GEOLOGIST / CAPTAIN)</strong><br/>
        Name: ${signState.chiefName || '____________________'}<br/>
        Sign: ${signState.chiefSign.startsWith('data:image/') ? `<img src="${signState.chiefSign}" height="32" />` : signState.chiefSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
    </tr>
  </table>
</body>
</html>`;

      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8',
      });
      const safeCh = chainage.replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${driftId}_${safeCh}_Mining_Analytical_Dossier.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setIsExporting(false);
    }
  };

  // Helper to render the common ISO Engineering Title Block on each A4 page
  const renderIsoTitleBlock = (pageNum: number, pageSubtitle: string) => (
    <div className="border-2 border-slate-950 bg-white">
      <div className="grid grid-cols-12 items-stretch border-b border-slate-950">
        {/* Left Company Logo with Crop/Fit Adjuster */}
        <div className="col-span-3 border-r border-slate-950 p-2 flex flex-col items-center justify-center bg-white">
          <ReportHeaderLogoBox
            side="left"
            logoDataUrl={logos.left}
            rawLogoDataUrl={logos.leftRaw}
            cropConfig={logos.leftCfg}
            fallbackTitle={currentProject?.miningCompany || currentProject?.mineName || 'CLICK TO ADD MINE LOGO'}
            onUpdateLogo={(cropped, raw, cfg) =>
              saveLogos((prev) => ({ ...prev, left: cropped, leftRaw: raw, leftCfg: cfg }))
            }
            onClearLogo={() =>
              saveLogos((prev) => ({ ...prev, left: undefined, leftRaw: undefined }))
            }
          />
        </div>

        {/* Center Engineering Title */}
        <div className="col-span-6 p-2 text-center flex flex-col justify-center bg-slate-50/70">
          <div className="text-[13px] font-black tracking-wider uppercase text-slate-950 leading-tight">
            UNDERGROUND MINING GEOLOGICAL &amp; GRADE CONTROL DOSSIER
          </div>
          <div className="text-[10.5px] font-bold text-slate-800 mt-0.5 truncate">
            {currentProject?.projectName || 'Underground Mining Project'} · {currentProject?.mineName || 'Mine Site'} ·{' '}
            {currentProject?.primaryCommodity || 'Gold (Au)'}
          </div>
          <div className="text-[9.5px] font-mono font-bold text-slate-600 mt-0.5">
            {pageSubtitle} · Sheet {pageNum} of {totalPages}
          </div>
        </div>

        {/* Right Grade Control / Consultant Logo with Crop/Fit Adjuster */}
        <div className="col-span-3 border-l border-slate-950 p-2 flex flex-col items-center justify-center bg-white">
          <ReportHeaderLogoBox
            side="right"
            logoDataUrl={logos.right}
            rawLogoDataUrl={logos.rightRaw}
            cropConfig={logos.rightCfg}
            fallbackTitle="GRADE CONTROL / GEOTECH LOGO"
            onUpdateLogo={(cropped, raw, cfg) =>
              saveLogos((prev) => ({ ...prev, right: cropped, rightRaw: raw, rightCfg: cfg }))
            }
            onClearLogo={() =>
              saveLogos((prev) => ({ ...prev, right: undefined, rightRaw: undefined }))
            }
          />
        </div>
      </div>

      {/* Spacious 4-Column × 2-Row Key-Value Metadata Grid (Zero Horizontal Cramping) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 text-[10px] font-mono divide-x divide-y divide-slate-300 bg-white">
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Heading / Stope ID</span>
          <strong className="text-slate-950 truncate block">{driftId}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Mine Level (mRL)</span>
          <strong className="text-slate-950 truncate block">{mineLevel}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Chainage / Cut</span>
          <strong className="text-slate-950 truncate block">{chainage}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Fed Profile Shape</span>
          <strong className="text-slate-950 truncate block">{stopeShape.replace('_', ' ').toUpperCase()}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Dimensions (W × H / Wall)</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {stopeWidth}m × {stopeHeight}m (W.H {wallHeight}m)
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">True Face Area</span>
          <strong className="text-slate-950 tabular-nums truncate block">{profileMetrics.areaM2} m² (HR {profileMetrics.hydraulicRadiusM.toFixed(2)}m)</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Drive Azimuth / Dip</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {headingAzimuth}° / {faceDip}°
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Target Cutoff / Verdict</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {cutoffGrade} {gradeUnits} → {composites.verdict}
          </strong>
        </div>
      </div>
    </div>
  );

  // Helper to render the 3-Party Official Sign-Off & Editable Remarks Block
  const renderOfficialSignOffBlock = () => (
    <div className="border-2 border-slate-950 bg-white space-y-0">
      {/* Editable Geologist Shift Handover & Support Remarks */}
      <div className="border-b border-slate-950 p-2 bg-slate-50">
        <div className="flex items-center justify-between text-[9.5px] font-bold uppercase text-slate-800 mb-1">
          <span>08. Mine Geologist Shift Handover Remarks, Blasting &amp; Ground Support Directives</span>
          <span className="text-[8.5px] font-mono text-slate-500 print:hidden">Editable Inline</span>
        </div>
        <textarea
          rows={2}
          value={signState.remarks}
          onChange={(e) => updateSignState({ remarks: e.target.value })}
          placeholder="Enter geological observations, ore/waste firing split instructions, or spot bolting directives..."
          className="w-full text-[10px] font-mono text-slate-950 bg-white border border-slate-300 rounded px-2 py-1 focus:border-slate-950 outline-none resize-none print:border-none print:bg-transparent print:p-0"
        />
      </div>

      {/* 3-Column Borderless Name & Croppable PNG Signature Block (Stacked per Column so Zero Overlap) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-950 text-[10px] bg-white">
        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Mapped By · Production Mine Geologist
          </div>
          <ReportBorderlessGeologistSignRow
            roleLabel="Name:"
            nameValue={signState.geologistName}
            signValue={signState.geologistSign}
            rawSignDataUrl={signState.geologistSignRaw}
            signCropConfig={signState.geologistCfg}
            onNameChange={(val) => updateSignState({ geologistName: val })}
            onSignChange={(val, raw, cfg) =>
              updateSignState({ geologistSign: val, geologistSignRaw: raw, geologistCfg: cfg })
            }
            stackedLayout
          />
          <div className="text-[8.5px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-200">
            <span>Mining Geology Dept</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Reconciled By · Grade Control / Geotech
          </div>
          <ReportBorderlessGeologistSignRow
            roleLabel="Name:"
            nameValue={signState.geotechName}
            signValue={signState.geotechSign}
            rawSignDataUrl={signState.geotechSignRaw}
            signCropConfig={signState.geotechCfg}
            onNameChange={(val) => updateSignState({ geotechName: val })}
            onSignChange={(val, raw, cfg) =>
              updateSignState({ geotechSign: val, geotechSignRaw: raw, geotechCfg: cfg })
            }
            stackedLayout
          />
          <div className="text-[8.5px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-200">
            <span>Grade Control &amp; Rock Mech</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Approved By · Chief Geologist / Captain
          </div>
          <ReportBorderlessGeologistSignRow
            roleLabel="Name:"
            nameValue={signState.chiefName}
            signValue={signState.chiefSign}
            rawSignDataUrl={signState.chiefSignRaw}
            signCropConfig={signState.chiefCfg}
            onNameChange={(val) => updateSignState({ chiefName: val })}
            onSignChange={(val, raw, cfg) =>
              updateSignState({ chiefSign: val, chiefSignRaw: raw, chiefCfg: cfg })
            }
            stackedLayout
          />
          <div className="text-[8.5px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-200">
            <span>Statutory Sign-Off</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden print:bg-white print:static print:overflow-visible">
      {/* Top Studio Control Bar (Hidden in Print) */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-100 truncate">
              Underground Mining Multi-Page Analytical Dossier Studio
            </h2>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {driftId} · {chainage} · {mineLevel} · {totalPages}-Page ISO A4 Engineering Package (300 DPI PDF &amp; Editable Word)
            </p>
          </div>
        </div>

        {/* Layout Mode Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          {(
            [
              { id: 'FULL_3_PAGE', label: '3-Page Full Dossier' },
              { id: 'COMPACT_2_PAGE', label: '2-Page Sheet' },
              { id: 'SINGLE_PAGE', label: '1-Page Summary' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDossierMode(m.id)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                dossierMode === m.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Auto-Hide Empty Sections & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoHideEmpty((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              autoHideEmpty
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Automatically hide unlogged optional tables so no blank boilerplate appears"
          >
            {autoHideEmpty ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Auto-Hide Empty: {autoHideEmpty ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportMultiPage300DpiPdf}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Rendering 300 DPI...' : `Download ${totalPages}-Page PDF (300 DPI)`}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportEditableWordDoc}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
          >
            <FileText className="w-4 h-4" />
            <span>Export Word (.doc)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print A4</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Section Toggle Bar (Hidden in Print) */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-300 print:hidden shrink-0">
        <span className="font-bold text-slate-400 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          Include Sections:
        </span>
        {(
          [
            { key: 'faceMapAndFeatures', label: '01. Scaled Face CAD & Features' },
            { key: 'muckVerdictAndTonnage', label: '02. Muck Verdict & Tonnage' },
            { key: 'channelAssaysAndDilution', label: '03. Channel Assays & Dilution Profile' },
            { key: 'mrmrAndMathewsStability', label: '04. Laubscher MRMR & Mathews Graph' },
            { key: 'kinematicWedgeAndSupport', label: '05. Kinematic Wedge & Ground Support' },
          ] as const
        ).map((sec) => {
          const active = sections[sec.key];
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => setSections((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
              className={`flex items-center gap-1 font-mono cursor-pointer ${
                active ? 'text-amber-300 font-bold' : 'text-slate-500'
              }`}
            >
              {active ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Multi-Page ISO A4 Preview Stage */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-slate-950 print:p-0 print:space-y-0 print:bg-white">
        {/* ====================================================================
            PAGE 1: COVER TITLE BLOCK, SCALED UNDERGROUND FACE CAD & FEATURES
           ==================================================================== */}
        <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4 print:break-after-page">
          <div className="space-y-3">
            {renderIsoTitleBlock(1, '01. STOPE FACE CAD MAPPING & STRUCTURAL INVENTORY')}

            {/* Scaled Underground Face CAD Diagram */}
            {sections.faceMapAndFeatures && (
              <div className="border-2 border-slate-950 bg-white">
                <div className="bg-slate-950 text-white px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <span>
                    01. Scaled Underground Excavation Face CAD Map — {stopeShape.replace('_', ' ').toUpperCase()} ({stopeWidth}m ×{' '}
                    {stopeHeight}m · Area {profileMetrics.areaM2} m²)
                  </span>
                  <span className="font-mono text-amber-300">
                    Azimuth {headingAzimuth}° · Face Dip {faceDip}°
                  </span>
                </div>

                <div className="p-2 bg-white flex items-center justify-center">
                  <svg
                    id="mining-dossier-face-svg"
                    viewBox={`0 0 ${faceSvgConfig.svgW} ${faceSvgConfig.svgH}`}
                    className="w-full h-[340px] block"
                  >
                    <defs>
                      <pattern id="md-oreHighGradePattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="12" height="12" fill="#fee2e2" fillOpacity="0.65" />
                        <line x1="0" y1="0" x2="0" y2="12" stroke="#dc2626" strokeWidth="3" />
                      </pattern>
                      <pattern id="md-oreMedGradePattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="12" height="12" fill="#fef3c7" fillOpacity="0.6" />
                        <line x1="0" y1="0" x2="0" y2="12" stroke="#d97706" strokeWidth="2.2" />
                      </pattern>
                      <pattern id="md-oreLowGradePattern" width="14" height="14" patternUnits="userSpaceOnUse">
                        <rect width="14" height="14" fill="#fef9c3" fillOpacity="0.5" />
                        <circle cx="4" cy="4" r="1.5" fill="#ca8a04" />
                        <circle cx="11" cy="11" r="1.5" fill="#ca8a04" />
                      </pattern>
                      <pattern id="md-quartzVeinPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                        <rect width="16" height="16" fill="#ecfeff" fillOpacity="0.65" />
                        <path d="M 0 8 L 8 0 M 8 16 L 16 8" stroke="#0891b2" strokeWidth="1.8" />
                      </pattern>
                      <pattern id="md-faultZonePattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
                        <rect width="12" height="12" fill="#ffe4e6" fillOpacity="0.55" />
                        <line x1="0" y1="0" x2="0" y2="12" stroke="#e11d48" strokeWidth="2.4" strokeDasharray="4 2" />
                      </pattern>
                      <pattern id="md-shearZonePattern" width="14" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
                        <rect width="14" height="8" fill="#fae8ff" fillOpacity="0.5" />
                        <path d="M 0 4 Q 3.5 0, 7 4 T 14 4" fill="none" stroke="#9333ea" strokeWidth="1.6" />
                      </pattern>
                      <pattern id="md-jointZonePattern" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(60)">
                        <rect width="10" height="10" fill="#e0f2fe" fillOpacity="0.45" />
                        <line x1="0" y1="0" x2="0" y2="10" stroke="#0284c7" strokeWidth="1.5" />
                      </pattern>
                      <pattern id="md-foliationZonePattern" width="12" height="6" patternUnits="userSpaceOnUse">
                        <rect width="12" height="6" fill="#f3e8ff" fillOpacity="0.45" />
                        <line x1="0" y1="3" x2="12" y2="3" stroke="#7e22ce" strokeWidth="1.2" strokeDasharray="5 2" />
                      </pattern>
                      <pattern id="md-alterationHaloPattern" width="14" height="14" patternUnits="userSpaceOnUse">
                        <rect width="14" height="14" fill="#dcfce7" fillOpacity="0.5" />
                        <circle cx="7" cy="7" r="2" fill="#16a34a" />
                      </pattern>
                      <pattern id="md-faultBrecciaPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                        <rect width="16" height="16" fill="#ffedd5" fillOpacity="0.6" />
                        <polygon points="3,3 9,5 5,10" fill="#ea580c" />
                        <polygon points="11,9 15,12 10,15" fill="#9a3412" />
                      </pattern>
                      <pattern id="md-wasteDykePattern" width="12" height="12" patternUnits="userSpaceOnUse">
                        <rect width="12" height="12" fill="#e2e8f0" fillOpacity="0.6" />
                        <path d="M 2 2 L 6 6 M 6 2 L 2 6" stroke="#475569" strokeWidth="1.4" />
                      </pattern>

                      <clipPath id="miningDossierStopeClip">
                        <polygon
                          points={profileMetrics.points
                            .map((p) => {
                              const { px, py } = faceSvgConfig.meterToSvg(p.x, p.y);
                              return `${px.toFixed(1)},${py.toFixed(1)}`;
                            })
                            .join(' ')}
                        />
                      </clipPath>
                    </defs>

                    {/* Background Canvas Frame */}
                    <rect x="0" y="0" width={faceSvgConfig.svgW} height={faceSvgConfig.svgH} fill="#ffffff" />

                    {/* Underground Excavation Base Fill */}
                    <polygon
                      points={profileMetrics.points
                        .map((p) => {
                          const { px, py } = faceSvgConfig.meterToSvg(p.x, p.y);
                          return `${px.toFixed(1)},${py.toFixed(1)}`;
                        })
                        .join(' ')}
                      fill="#f8fafc"
                    />

                    {/* Clipped Metric Grid, Centerline, Grade Line & Geological Features */}
                    <g clipPath="url(#miningDossierStopeClip)">
                      {Array.from({ length: Math.floor(stopeWidth) + 1 }, (_, i) => i).map((m) => {
                        const p1 = faceSvgConfig.meterToSvg(m, 0);
                        const p2 = faceSvgConfig.meterToSvg(m, stopeHeight);
                        return (
                          <line
                            key={`vg-${m}`}
                            x1={p1.px}
                            y1={p1.py}
                            x2={p2.px}
                            y2={p2.py}
                            stroke="#cbd5e1"
                            strokeWidth="0.8"
                            strokeDasharray="3 3"
                          />
                        );
                      })}
                      {Array.from({ length: Math.floor(stopeHeight) + 1 }, (_, i) => i).map((m) => {
                        const p1 = faceSvgConfig.meterToSvg(0, m);
                        const p2 = faceSvgConfig.meterToSvg(stopeWidth, m);
                        return (
                          <line
                            key={`hg-${m}`}
                            x1={p1.px}
                            y1={p1.py}
                            x2={p2.px}
                            y2={p2.py}
                            stroke="#cbd5e1"
                            strokeWidth="0.8"
                            strokeDasharray="3 3"
                          />
                        );
                      })}

                      {/* Centerline & Laser Grade Line (1.5m) */}
                      {(() => {
                        const clB = faceSvgConfig.meterToSvg(stopeWidth / 2, 0);
                        const clT = faceSvgConfig.meterToSvg(stopeWidth / 2, stopeHeight);
                        const glL = faceSvgConfig.meterToSvg(0, Math.min(1.5, stopeHeight * 0.35));
                        const glR = faceSvgConfig.meterToSvg(stopeWidth, Math.min(1.5, stopeHeight * 0.35));
                        return (
                          <>
                            <line
                              x1={clB.px}
                              y1={clB.py}
                              x2={clT.px}
                              y2={clT.py}
                              stroke="#64748b"
                              strokeWidth="1.2"
                              strokeDasharray="6 3"
                            />
                            <line
                              x1={glL.px}
                              y1={glL.py}
                              x2={glR.px}
                              y2={glR.py}
                              stroke="#0284c7"
                              strokeWidth="1.1"
                              strokeDasharray="5 3"
                            />
                          </>
                        );
                      })()}

                      {/* Mapped Polygons & Polylines (Shapes Only First) */}
                      {visibleFeatures.map((feat) => {
                        const pts = feat.points.map((p) => faceSvgConfig.meterToSvg(p.x, p.y));
                        if (feat.geometryType === 'POINT') {
                          const pt = pts[0];
                          return (
                            <circle
                              key={feat.id}
                              cx={pt.px}
                              cy={pt.py}
                              r="6"
                              fill={feat.colorHex || '#dc2626'}
                              stroke="#0f172a"
                              strokeWidth="1.5"
                            />
                          );
                        }
                        const isClosed = feat.geometryType === 'POLYGON';
                        const useSmooth = feat.isSpline || feat.drawTool === 'PENCIL' || feat.drawTool === 'SPL';
                        const d = useSmooth
                          ? pointsToSmoothSvgPath(pts, isClosed)
                          : pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ') +
                            (isClosed ? ' Z' : '');
                        return (
                          <g key={feat.id}>
                            {isClosed && (
                              <path
                                d={d}
                                fill={feat.colorHex || '#f59e0b'}
                                fillOpacity={0.22}
                                stroke="none"
                              />
                            )}
                            <path
                              d={d}
                              fill={isClosed ? getPatternFillUrl(feat, 'md') : 'none'}
                              fillOpacity={isClosed ? 0.85 : 0}
                              stroke={feat.colorHex || '#0f172a'}
                              strokeWidth={feat.strokeWidth || 2.5}
                              strokeDasharray={
                                feat.featureType === 'FAULT'
                                  ? '8 4'
                                  : feat.featureType === 'SHEAR'
                                  ? '5 2'
                                  : undefined
                              }
                            />
                          </g>
                        );
                      })}

                      {/* Non-Overlapping Numbered Feature Callout Badges + Channel Sample Cut Vectors */}
                      {(() => {
                        const placedBoxes: { x: number; y: number; w: number; h: number }[] = [];
                        const resolveNonOverlappingPos = (cx: number, cy: number, bw: number, bh: number) => {
                          const offsets = [
                            [0, 0],
                            [0, -20],
                            [0, 20],
                            [-30, -16],
                            [30, -16],
                            [-30, 16],
                            [30, 16],
                            [0, -38],
                            [0, 38],
                          ];
                          for (const [dx, dy] of offsets) {
                            const tx = cx + dx;
                            const ty = cy + dy;
                            const collides = placedBoxes.some(
                              (b) =>
                                Math.abs(tx - b.x) < (bw + b.w) / 2 + 4 &&
                                Math.abs(ty - b.y) < (bh + b.h) / 2 + 4
                            );
                            if (!collides) {
                              placedBoxes.push({ x: tx, y: ty, w: bw, h: bh });
                              return { x: tx, y: ty };
                            }
                          }
                          const fallback = { x: cx, y: cy - placedBoxes.length * 14 };
                          placedBoxes.push({ ...fallback, w: bw, h: bh });
                          return fallback;
                        };

                        return (
                          <>
                            {/* Channel Sample Cut Vectors with Staggered Non-Overlapping Callout Pills */}
                            {channelSamples.map((s, idx) => {
                              const yBand = 0.28 + ((idx % 4) * 0.11);
                              const yPos = stopeHeight * yBand;
                              const p1 = faceSvgConfig.meterToSvg(s.fromMeter, yPos);
                              const p2 = faceSvgConfig.meterToSvg(s.toMeter, yPos);
                              const midX = (p1.px + p2.px) / 2;
                              const midY = p1.py - 12;
                              const pos = resolveNonOverlappingPos(midX, midY, 84, 15);
                              const grade =
                                typeof s.assayGrade === 'number'
                                  ? s.assayGrade.toFixed(1)
                                  : parseFloat(String(s.gradeValue || '0')).toFixed(1);
                              return (
                                <g key={s.id || idx}>
                                  <line x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="#dc2626" strokeWidth="3.5" />
                                  <line x1={p1.px} y1={p1.py - 5} x2={p1.px} y2={p1.py + 5} stroke="#0f172a" strokeWidth="2" />
                                  <line x1={p2.px} y1={p2.py - 5} x2={p2.px} y2={p2.py + 5} stroke="#0f172a" strokeWidth="2" />
                                  <rect
                                    x={pos.x - 42}
                                    y={pos.y - 8}
                                    width="84"
                                    height="15"
                                    rx="3"
                                    fill="#fef2f2"
                                    fillOpacity="0.95"
                                    stroke="#dc2626"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={pos.x}
                                    y={pos.y + 3}
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fill="#991b1b"
                                  >
                                    {s.sampleNumber}: {grade}{gradeUnits}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Compact Numbered Feature Callout Tags (#1, #2, ...) */}
                            {visibleFeatures.map((feat, idx) => {
                              const pts = feat.points.map((p) => faceSvgConfig.meterToSvg(p.x, p.y));
                              if (pts.length === 0) return null;
                              const avgX = pts.reduce((acc, p) => acc + p.px, 0) / pts.length;
                              const avgY = pts.reduce((acc, p) => acc + p.py, 0) / pts.length;
                              const pos = resolveNonOverlappingPos(avgX, avgY, 34, 16);
                              return (
                                <g key={`lbl-${feat.id}`}>
                                  <rect
                                    x={pos.x - 16}
                                    y={pos.y - 8}
                                    width="32"
                                    height="16"
                                    rx="4"
                                    fill="#0f172a"
                                    stroke="#ffffff"
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={pos.x}
                                    y={pos.y + 3.5}
                                    fontSize="9"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fill="#fbbf24"
                                  >
                                    #{idx + 1}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </g>

                    {/* Crisp Outer Underground Excavation Perimeter Outline */}
                    <polygon
                      points={profileMetrics.points
                        .map((p) => {
                          const { px, py } = faceSvgConfig.meterToSvg(p.x, p.y);
                          return `${px.toFixed(1)},${py.toFixed(1)}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="3.2"
                      strokeLinejoin="round"
                    />

                    {/* Metric Axis Ruler Ticks along Invert & Left Wall (Filtered Step so Ticks Never Crowd) */}
                    {(() => {
                      const xStep = stopeWidth > 10 ? 2 : 1;
                      const xTicks: number[] = [];
                      for (let m = 0; m <= Math.floor(stopeWidth); m += xStep) xTicks.push(m);
                      return xTicks.map((m) => {
                        const pt = faceSvgConfig.meterToSvg(m, 0);
                        return (
                          <g key={`xt-${m}`} transform={`translate(${pt.px}, ${faceSvgConfig.originY})`}>
                            <line y1="0" y2="6" stroke="#0f172a" strokeWidth="1.5" />
                            <text y="18" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                              {m}m
                            </text>
                          </g>
                        );
                      });
                    })()}
                    {(() => {
                      const yStep = stopeHeight > 10 ? 2 : 1;
                      const yTicks: number[] = [];
                      for (let m = 0; m <= Math.floor(stopeHeight); m += yStep) yTicks.push(m);
                      return yTicks.map((m) => {
                        const pt = faceSvgConfig.meterToSvg(0, m);
                        return (
                          <g key={`yt-${m}`} transform={`translate(${faceSvgConfig.originX}, ${pt.py})`}>
                            <line x1="-6" y1="0" x2="0" y2="0" stroke="#0f172a" strokeWidth="1.5" />
                            <text x="-9" y="3" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="end" fill="#0f172a">
                              {m}m
                            </text>
                          </g>
                        );
                      });
                    })()}

                    {/* ================================================================
                        RIGHT SIDE: DEDICATED CAD CALLOUT LEGEND & CHANNEL KEY PANEL
                       ================================================================ */}
                    <g transform="translate(656, 16)">
                      <rect x="0" y="0" width="248" height="458" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
                      <rect x="0" y="0" width="248" height="24" rx="3" fill="#0f172a" />
                      <text x="10" y="16" fontSize="9.5" fontFamily="sans-serif" fontWeight="bold" fill="#ffffff">
                        CAD CALLOUT KEY &amp; LEGEND
                      </text>

                      {/* Mapped Features Key (#1 .. #N) */}
                      <text x="10" y="42" fontSize="8.5" fontFamily="sans-serif" fontWeight="bold" fill="#475569">
                        MAPPED GEOLOGICAL ENTITIES ({visibleFeatures.length})
                      </text>
                      {visibleFeatures.length === 0 ? (
                        <text x="10" y="60" fontSize="9" fontFamily="monospace" fill="#64748b">
                          No features drawn on face
                        </text>
                      ) : (
                        visibleFeatures.slice(0, 8).map((f, idx) => {
                          const ry = 54 + idx * 24;
                          return (
                            <g key={`leg-${f.id}`} transform={`translate(10, ${ry})`}>
                              <rect x="0" y="0" width="24" height="15" rx="3" fill="#0f172a" />
                              <text x="12" y="11" fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#fbbf24">
                                #{idx + 1}
                              </text>
                              <rect
                                x="29"
                                y="2"
                                width="11"
                                height="11"
                                fill={f.colorHex || '#f59e0b'}
                                stroke="#0f172a"
                                strokeWidth="0.8"
                              />
                              <text x="45" y="11" fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                {(f.name || f.featureType).slice(0, 17)} ({f.dipDeg ?? 65}°)
                              </text>
                            </g>
                          );
                        })
                      )}

                      {/* Divider */}
                      <line x1="10" y1="254" x2="238" y2="254" stroke="#cbd5e1" strokeWidth="1" />

                      {/* Channel Cuts Key */}
                      <text x="10" y="272" fontSize="8.5" fontFamily="sans-serif" fontWeight="bold" fill="#475569">
                        CHANNEL ASSAY CUTS ({channelSamples.length})
                      </text>
                      {channelSamples.length === 0 ? (
                        <text x="10" y="290" fontSize="9" fontFamily="monospace" fill="#64748b">
                          No channel cuts logged
                        </text>
                      ) : (
                        channelSamples.slice(0, 5).map((s, idx) => {
                          const ry = 282 + idx * 21;
                          const g =
                            typeof s.assayGrade === 'number'
                              ? s.assayGrade.toFixed(2)
                              : parseFloat(String(s.gradeValue || '0')).toFixed(2);
                          return (
                            <g key={`cleg-${s.id || idx}`} transform={`translate(10, ${ry})`}>
                              <rect x="0" y="2" width="12" height="4" fill="#dc2626" />
                              <text x="18" y="9" fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                {s.sampleNumber}: {s.fromMeter.toFixed(1)}–{s.toMeter.toFixed(1)}m → {g}{gradeUnits}
                              </text>
                            </g>
                          );
                        })
                      )}

                      {/* Reference Lines Key at Bottom of Legend */}
                      <line x1="10" y1="396" x2="238" y2="396" stroke="#cbd5e1" strokeWidth="1" />
                      <line x1="12" y1="412" x2="34" y2="412" stroke="#64748b" strokeWidth="1.4" strokeDasharray="5 2" />
                      <text x="40" y="415" fontSize="8.5" fontFamily="monospace" fill="#334155">
                        Drive Centerline (X = {(stopeWidth / 2).toFixed(2)}m)
                      </text>
                      <line x1="12" y1="430" x2="34" y2="430" stroke="#0284c7" strokeWidth="1.4" strokeDasharray="5 2" />
                      <text x="40" y="433" fontSize="8.5" fontFamily="monospace" fill="#334155">
                        Survey Laser Grade Line (+1.50m)
                      </text>
                      <text x="12" y="449" fontSize="8.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                        True Scale Area: {profileMetrics.areaM2} m² (HR {profileMetrics.hydraulicRadiusM.toFixed(2)}m)
                      </text>
                    </g>
                  </svg>
                </div>
              </div>
            )}

            {/* Mapped Geological Features & Lithology Inventory Table */}
            {(!autoHideEmpty || visibleFeatures.length > 0) && (
              <div className="border-2 border-slate-950 bg-white">
                <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span>02. Mapped Geological Contacts, Ore Lodes &amp; Structural Discontinuities</span>
                  <span className="font-mono text-amber-300">{visibleFeatures.length} Entities</span>
                </div>
                <table className="w-full text-left text-[10px] font-mono border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-950 text-slate-900">
                    <tr>
                      <th className="py-1 px-2 border-r border-slate-300">#</th>
                      <th className="py-1 px-2 border-r border-slate-300">Feature Class</th>
                      <th className="py-1 px-2 border-r border-slate-300">Rock / Ore Lode / Structure Name</th>
                      <th className="py-1 px-2 border-r border-slate-300">Geometry</th>
                      <th className="py-1 px-2 border-r border-slate-300">Strike / Dip / Dir</th>
                      <th className="py-1 px-2">Thickness · Water · Infill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleFeatures.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-2 text-center text-slate-500 italic">
                          No geological features mapped on this face interval.
                        </td>
                      </tr>
                    ) : (
                      visibleFeatures.slice(0, 12).map((f, idx) => (
                        <tr key={f.id} className="odd:bg-white even:bg-slate-50/70">
                          <td className="py-1 px-2 border-r border-slate-200 font-bold">
                            #{idx + 1}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 font-bold text-slate-900">
                            {f.featureType}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 font-bold">
                            <span
                              className="inline-block w-2.5 h-2.5 mr-1.5 align-middle border border-slate-800"
                              style={{ backgroundColor: f.colorHex || '#f59e0b' }}
                            />
                            {f.name || f.featureType}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200">{f.geometryType}</td>
                          <td className="py-1 px-2 border-r border-slate-200 tabular-nums">
                            {f.strikeDeg ?? 45}° / {f.dipDeg ?? 65}° / {f.dipDirectionDeg ?? 135}°
                          </td>
                          <td className="py-1 px-2 text-slate-700">
                            {f.trueThicknessM ? `${f.trueThicknessM}m · ` : ''}
                            {f.waterInflow || 'DRY'} {f.infill ? `· ${f.infill}` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalPages === 1 ? (
            renderOfficialSignOffBlock()
          ) : (
            <div className="border-t border-slate-400 pt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>
                ESWA Underground Mining Grade Control &amp; Geomechanics Dossier · {driftId} ({chainage})
              </span>
              <span>Continued on Sheet 2 of {totalPages} →</span>
            </div>
          )}
        </div>

        {/* ====================================================================
            PAGE 2: GRADE CONTROL, CHANNEL ASSAY TABLE & MUCK ROUTING VERDICT
           ==================================================================== */}
        {showPage2 && (
          <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4 print:break-after-page">
            <div className="space-y-4">
              {renderIsoTitleBlock(2, '02. GRADE CONTROL, CHANNEL ASSAYS & MUCK ROUTING RECONCILIATION')}

              {/* Section 03: Muck Haulage Routing Verdict & Blast Round Metal Accounting */}
              {sections.muckVerdictAndTonnage && (
                <div className="border-2 border-slate-950 bg-white">
                  <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      03. Muck Haulage Routing Verdict, Blast Tonnage &amp; Contained Metal Accounting
                    </span>
                    <span className="font-mono text-amber-300">
                      Blast Advance Pull: {currentStope?.blastPullMeters || 3.2} m
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 font-mono">
                    <div className="p-3 bg-amber-50/50">
                      <div className="text-[9px] font-sans font-bold uppercase text-slate-500">
                        Muck Haulage Dispatch Verdict
                      </div>
                      <div className="text-lg font-black text-slate-950 mt-0.5">{composites.verdict}</div>
                      <div className="text-[9.5px] text-slate-700 mt-0.5 leading-snug">
                        {composites.verdictDescription}
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="text-[9px] font-sans font-bold uppercase text-slate-500">
                        Weighted Face Composite Grade
                      </div>
                      <div className="text-xl font-black text-slate-950 tabular-nums mt-0.5">
                        {composites.weightedGrade}{' '}
                        <span className="text-xs font-normal text-slate-600">{gradeUnits}</span>
                      </div>
                      <div className="text-[9.5px] text-slate-600 mt-0.5">
                        Target Cutoff: <strong>{cutoffGrade} {gradeUnits}</strong>
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="text-[9px] font-sans font-bold uppercase text-slate-500">
                        Unplanned Wallrock Dilution
                      </div>
                      <div className="text-xl font-black text-slate-950 tabular-nums mt-0.5">
                        {composites.dilutionPercentByMass} <span className="text-xs font-normal text-slate-600">%</span>
                      </div>
                      <div className="text-[9.5px] text-slate-600 mt-0.5">
                        Ore SG: {currentStope?.oreSpecificGravity || 3.35} · Waste SG:{' '}
                        {currentStope?.wasteSpecificGravity || 2.75}
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="text-[9px] font-sans font-bold uppercase text-slate-500">
                        Blast Round Tonnage &amp; Metal
                      </div>
                      <div className="text-xl font-black text-slate-950 tabular-nums mt-0.5">
                        {composites.estimatedTonnesPerRound} <span className="text-xs font-normal text-slate-600">t</span>
                      </div>
                      <div className="text-[9.5px] text-slate-700 font-bold mt-0.5 tabular-nums">
                        Contained: {(composites.containedMetalUnits / 31.1035).toFixed(2)} oz (
                        {composites.containedMetalUnits.toFixed(0)} g)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 04: Channel Sampling Assay Table */}
              {sections.channelAssaysAndDilution && (
                <>
                  <div className="border-2 border-slate-950 bg-white">
                    <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>
                        04. Channel Cut Assay Register &amp; Mass-Weighted Composite Reconciliation
                      </span>
                      <span className="font-mono text-amber-300">{channelSamples.length} Channel Cuts</span>
                    </div>

                    <table className="w-full text-left text-[10px] font-mono border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-950 text-slate-900">
                        <tr>
                          <th className="py-1.5 px-2 border-r border-slate-300">Sample ID</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">Face Interval (m)</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">Cut Width</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">True Thick</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">SG (t/m³)</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">Assay ({gradeUnits})</th>
                          <th className="py-1.5 px-2 border-r border-slate-300">Grade×L×SG</th>
                          <th className="py-1.5 px-2">Zone Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 tabular-nums">
                        {channelSamples.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-3 text-center text-slate-500 italic">
                              No channel samples logged on this face interval.
                            </td>
                          </tr>
                        ) : (
                          channelSamples.map((s, idx) => {
                            const widthM = Math.max(
                              0.05,
                              Number(Math.abs((s.toMeter ?? 0) - (s.fromMeter ?? 0)).toFixed(2))
                            );
                            const trueM = Number((s.trueThicknessMeters || widthM * 0.92).toFixed(2));
                            const sg = s.specificGravity || 3.35;
                            const grade =
                              typeof s.assayGrade === 'number'
                                ? s.assayGrade
                                : parseFloat(String(s.gradeValue || '0')) || 0;
                            const accum = (grade * widthM * sg).toFixed(2);
                            const isOre = grade >= cutoffGrade;
                            return (
                              <tr key={s.id || idx} className="odd:bg-white even:bg-slate-50/70">
                                <td className="py-1 px-2 border-r border-slate-200 font-bold text-slate-950">
                                  {s.sampleNumber || `CH-${idx + 1}`}
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200">
                                  {s.fromMeter.toFixed(2)} – {s.toMeter.toFixed(2)} m
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200">{widthM.toFixed(2)} m</td>
                                <td className="py-1 px-2 border-r border-slate-200">{trueM.toFixed(2)} m</td>
                                <td className="py-1 px-2 border-r border-slate-200">{sg.toFixed(2)}</td>
                                <td className="py-1 px-2 border-r border-slate-200 font-black text-slate-950">
                                  {grade.toFixed(2)}
                                </td>
                                <td className="py-1 px-2 border-r border-slate-200">{accum}</td>
                                <td
                                  className={`py-1 px-2 font-bold ${
                                    isOre ? 'text-emerald-800' : 'text-slate-600'
                                  }`}
                                >
                                  {isOre ? 'HIGH/MILL ORE' : grade >= cutoffGrade * 0.5 ? 'MARGINAL STOCKPILE' : 'WASTE'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section 05: Across-Face Channel Grade Profile SVG Chart (Non-Overlapping Legend & Callouts) */}
                  {(!autoHideEmpty || channelSamples.length > 0) && (
                    <div className="border-2 border-slate-950 bg-white">
                      <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span>
                          05. Across-Face Channel Assay Grade Profile vs. Cutoff ({cutoffGrade} {gradeUnits}) &amp; Weighted Composite ({composites.weightedGrade} {gradeUnits})
                        </span>
                        <span className="font-mono text-amber-300">Horizontal Face Profile (0m → {stopeWidth}m)</span>
                      </div>

                      <div className="p-2 bg-white">
                        <svg
                          id="mining-dossier-grade-chart-svg"
                          viewBox="0 0 880 225"
                          className="w-full h-48 block"
                        >
                          <rect x="0" y="0" width="880" height="225" fill="#ffffff" />
                          {(() => {
                            const padL = 58;
                            const padR = 138;
                            const padT = 36;
                            const padB = 34;
                            const cw = 880 - padL - padR;
                            const ch = 225 - padT - padB;
                            const maxGrade = Math.max(
                              cutoffGrade * 2,
                              composites.weightedGrade * 1.4,
                              ...channelSamples.map((s) =>
                                typeof s.assayGrade === 'number'
                                  ? s.assayGrade
                                  : parseFloat(String(s.gradeValue || '0')) || 0
                              ),
                              5
                            );
                            const xToPx = (m: number) => padL + (Math.min(stopeWidth, Math.max(0, m)) / Math.max(1, stopeWidth)) * cw;
                            const gToPy = (g: number) => padT + ch - (Math.min(maxGrade, Math.max(0, g)) / maxGrade) * ch;

                            const cutoffY = gToPy(cutoffGrade);
                            const compY = gToPy(composites.weightedGrade);

                            // Anti-collision for right-margin Cutoff & Composite labels
                            let cutoffLabelY = cutoffY + 3;
                            let compLabelY = compY + 3;
                            if (Math.abs(compLabelY - cutoffLabelY) < 16) {
                              if (compY <= cutoffY) {
                                compLabelY = Math.max(padT + 8, cutoffY - 9);
                                cutoffLabelY = Math.min(padT + ch, cutoffY + 9);
                              } else {
                                cutoffLabelY = Math.max(padT + 8, compY - 9);
                                compLabelY = Math.min(padT + ch, compY + 9);
                              }
                            }

                            return (
                              <>
                                {/* Top Legend Strip (Never Overlaps Bars) */}
                                <g transform={`translate(${padL}, 8)`}>
                                  <rect x="0" y="2" width="12" height="10" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
                                  <text x="17" y="10.5" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                    Ore Cut (≥ Cutoff)
                                  </text>

                                  <rect x="135" y="2" width="12" height="10" fill="#94a3b8" stroke="#0f172a" strokeWidth="1" />
                                  <text x="152" y="10.5" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#475569">
                                    Waste / Marginal Cut
                                  </text>

                                  <line x1="295" y1="7" x2="320" y2="7" stroke="#dc2626" strokeWidth="2" strokeDasharray="5 2" />
                                  <text x="326" y="10.5" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#dc2626">
                                    Cutoff ({cutoffGrade} {gradeUnits})
                                  </text>

                                  <line x1="465" y1="7" x2="490" y2="7" stroke="#059669" strokeWidth="2" strokeDasharray="4 2" />
                                  <text x="496" y="10.5" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#059669">
                                    Face Composite ({composites.weightedGrade} {gradeUnits})
                                  </text>
                                </g>

                                {/* Axes */}
                                <line x1={padL} y1={padT} x2={padL} y2={padT + ch} stroke="#0f172a" strokeWidth="1.5" />
                                <line x1={padL} y1={padT + ch} x2={padL + cw} y2={padT + ch} stroke="#0f172a" strokeWidth="1.5" />

                                {/* Y Ticks */}
                                {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                                  const val = maxGrade * t;
                                  const py = gToPy(val);
                                  return (
                                    <g key={idx}>
                                      <line x1={padL} y1={py} x2={padL + cw} y2={py} stroke="#e2e8f0" strokeWidth="1" />
                                      <text x={padL - 6} y={py + 3} fontSize="9.5" fontFamily="monospace" textAnchor="end" fill="#334155">
                                        {val.toFixed(1)}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Channel Sample Bars with Staggered Top Callout Pills */}
                                {channelSamples.map((s, idx) => {
                                  const x1 = xToPx(Math.min(s.fromMeter, s.toMeter));
                                  const x2 = xToPx(Math.max(s.fromMeter, s.toMeter));
                                  const bw = Math.max(16, x2 - x1);
                                  const g =
                                    typeof s.assayGrade === 'number'
                                      ? s.assayGrade
                                      : parseFloat(String(s.gradeValue || '0')) || 0;
                                  const py = gToPy(g);
                                  const bh = padT + ch - py;
                                  const isHigh = g >= cutoffGrade;
                                  const labelY = Math.max(padT + 10, py - (idx % 2 === 0 ? 5 : 15));
                                  return (
                                    <g key={s.id || idx}>
                                      <rect
                                        x={x1}
                                        y={py}
                                        width={bw}
                                        height={Math.max(2, bh)}
                                        fill={isHigh ? '#f59e0b' : '#94a3b8'}
                                        fillOpacity="0.82"
                                        stroke="#0f172a"
                                        strokeWidth="1.2"
                                      />
                                      <text
                                        x={x1 + bw / 2}
                                        y={labelY}
                                        fontSize="8.5"
                                        fontFamily="monospace"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        fill="#0f172a"
                                      >
                                        {s.sampleNumber}:{g.toFixed(1)}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Target Cutoff Threshold Line + Right Margin Tag */}
                                <line
                                  x1={padL}
                                  y1={cutoffY}
                                  x2={padL + cw}
                                  y2={cutoffY}
                                  stroke="#dc2626"
                                  strokeWidth="1.8"
                                  strokeDasharray="6 3"
                                />
                                <text
                                  x={padL + cw + 6}
                                  y={cutoffLabelY}
                                  fontSize="9"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  fill="#dc2626"
                                >
                                  Cutoff: {cutoffGrade}{gradeUnits}
                                </text>

                                {/* Weighted Composite Line + Right Margin Tag */}
                                <line
                                  x1={padL}
                                  y1={compY}
                                  x2={padL + cw}
                                  y2={compY}
                                  stroke="#059669"
                                  strokeWidth="1.8"
                                  strokeDasharray="4 2"
                                />
                                <text
                                  x={padL + cw + 6}
                                  y={compLabelY}
                                  fontSize="9"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  fill="#059669"
                                >
                                  Comp: {composites.weightedGrade}{gradeUnits}
                                </text>

                                {/* X-Axis Meter Labels */}
                                {Array.from({ length: Math.floor(stopeWidth) + 1 }, (_, i) => i).map((m) => (
                                  <text
                                    key={m}
                                    x={xToPx(m)}
                                    y={padT + ch + 18}
                                    fontSize="9.5"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fill="#0f172a"
                                  >
                                    {m}m
                                  </text>
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {totalPages === 2 ? (
              renderOfficialSignOffBlock()
            ) : (
              <div className="border-t border-slate-400 pt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span>
                  ESWA Underground Mining Grade Control &amp; Geomechanics Dossier · {driftId} ({chainage})
                </span>
                <span>Continued on Sheet 3 of {totalPages} →</span>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            PAGE 3: LAUBSCHER MRMR, MATHEWS-POTVIN GRAPH, WEDGE & SUPPORT SIGN-OFF
           ==================================================================== */}
        {showPage3 && (
          <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4">
            <div className="space-y-3.5">
              {renderIsoTitleBlock(
                totalPages,
                '03. GEOMECHANICAL STABILITY (LAUBSCHER MRMR & MATHEWS), WEDGE & SUPPORT'
              )}

              {/* Section 06: Laubscher MRMR & Mathews-Potvin Breakdown */}
              {sections.mrmrAndMathewsStability && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Left 5 Cols: Laubscher MRMR & Mathews Numerical Table */}
                  <div className="sm:col-span-5 border-2 border-slate-950 bg-white flex flex-col justify-between">
                    <div>
                      <div className="bg-slate-950 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>06A. Laubscher MRMR &amp; Mathews Parameters</span>
                      </div>
                      <table className="w-full text-[9.5px] font-mono border-collapse">
                        <tbody className="divide-y divide-slate-200 tabular-nums">
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">In-Situ RMR (Base)</td>
                            <td className="py-1 px-2 font-black text-right">{mrmrResult.baseRmr} / 100</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Weathering Adj.</td>
                            <td className="py-1 px-2 text-right">
                              {Math.round((currentStope?.mrmr?.weatheringFactor ?? 0.95) * 100)} %
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Induced Stress Adj.</td>
                            <td className="py-1 px-2 text-right">
                              {Math.round((currentStope?.mrmr?.miningInducedStressFactor ?? 0.9) * 100)} %
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Joint Orientation Adj.</td>
                            <td className="py-1 px-2 text-right">
                              {Math.round((currentStope?.mrmr?.jointOrientationFactor ?? 0.85) * 100)} %
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Blasting Factor Adj.</td>
                            <td className="py-1 px-2 text-right">
                              {Math.round((currentStope?.mrmr?.blastingDamageFactor ?? 0.94) * 100)} %
                            </td>
                          </tr>
                          <tr className="bg-amber-50">
                            <td className="py-1.5 px-2 font-sans font-black text-slate-950">
                              Design MRMR &amp; Class
                            </td>
                            <td className="py-1.5 px-2 font-black text-right text-slate-950">
                              {mrmrResult.designMrmr} ({mrmrResult.rockMassClass})
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">
                              Mathews Hydraulic Radius (HR)
                            </td>
                            <td className="py-1 px-2 font-bold text-right">
                              {mathewsResult.hydraulicRadiusM.toFixed(2)} m
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">
                              Factors Q&apos; × A × B × C
                            </td>
                            <td className="py-1 px-2 text-right">
                              {mathewsResult.qPrime} × {currentStope?.mathews?.stressFactorA ?? 0.7} ×{' '}
                              {currentStope?.mathews?.jointOrientationFactorB ?? 0.5} ×{' '}
                              {currentStope?.mathews?.gravityFactorC ?? 4.2}
                            </td>
                          </tr>
                          <tr className="bg-emerald-50">
                            <td className="py-1.5 px-2 font-sans font-black text-slate-950">
                              Stability Number (N&apos;)
                            </td>
                            <td className="py-1.5 px-2 font-black text-right text-emerald-900">
                              N&apos; = {mathewsResult.stabilityNumberN.toFixed(2)} ({mathewsResult.zoneLabel})
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-2 bg-slate-100 border-t border-slate-300 text-[9.5px] font-mono">
                      <span className="font-bold uppercase text-slate-600 block text-[8.5px]">
                        MRMR Support Prescription:
                      </span>
                      <strong className="text-slate-950">{mrmrResult.recommendedSupport}</strong>
                    </div>
                  </div>

                  {/* Right 7 Cols: Mathews-Potvin Stability Graph (SVG — Clean Non-Overlapping Zone Pills) */}
                  <div className="sm:col-span-7 border-2 border-slate-950 bg-white flex flex-col">
                    <div className="bg-slate-950 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>06B. Mathews-Potvin Empirical Stope Stability Graph</span>
                      <span className="font-mono text-amber-300">
                        HR = {mathewsResult.hydraulicRadiusM.toFixed(2)}m · N&apos; = {mathewsResult.stabilityNumberN.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2 flex-1 flex items-center justify-center">
                      <svg
                        id="mining-dossier-mathews-svg"
                        viewBox="0 0 460 250"
                        className="w-full h-56 block"
                      >
                        <rect x="0" y="0" width="460" height="250" fill="#ffffff" />
                        {(() => {
                          const padL = 50;
                          const padR = 20;
                          const padT = 18;
                          const padB = 34;
                          const w = 460 - padL - padR;
                          const h = 250 - padT - padB;

                          // HR: 1 to 25 m, N': 0.1 to 100 (log scale)
                          const hrToX = (hr: number) => padL + (Math.min(25, Math.max(1, hr)) / 25) * w;
                          const nToY = (n: number) => {
                            const logN = Math.log10(Math.min(100, Math.max(0.1, n))); // -1 to +2
                            return padT + h - ((logN + 1) / 3) * h;
                          };

                          const curX = hrToX(mathewsResult.hydraulicRadiusM);
                          const curY = nToY(mathewsResult.stabilityNumberN);

                          // Position the active stope callout box so it never overlaps top-left or bottom-right zone pills
                          const calloutW = 148;
                          const calloutX = curX + calloutW + 14 > padL + w ? Math.max(padL + 6, curX - calloutW - 10) : curX + 10;
                          const calloutY = curY < padT + 46 ? curY + 8 : curY - 24;

                          return (
                            <>
                              {/* Zones */}
                              <polygon
                                points={`${padL},${padT} ${padL + w},${padT} ${padL + w},${nToY(18)} ${padL},${nToY(1.2)}`}
                                fill="#dcfce7"
                                fillOpacity="0.65"
                              />
                              <polygon
                                points={`${padL},${nToY(1.2)} ${padL + w},${nToY(18)} ${padL + w},${nToY(4.5)} ${padL},${nToY(0.35)}`}
                                fill="#fef3c7"
                                fillOpacity="0.7"
                              />
                              <polygon
                                points={`${padL},${nToY(0.35)} ${padL + w},${nToY(4.5)} ${padL + w},${padT + h} ${padL},${padT + h}`}
                                fill="#fee2e2"
                                fillOpacity="0.65"
                              />

                              {/* Boundary Curves */}
                              <line x1={padL} y1={nToY(1.2)} x2={padL + w} y2={nToY(18)} stroke="#15803d" strokeWidth="2" strokeDasharray="5 3" />
                              <line x1={padL} y1={nToY(0.35)} x2={padL + w} y2={nToY(4.5)} stroke="#b91c1c" strokeWidth="2" strokeDasharray="5 3" />

                              {/* Clean Corner Zone Labels (Never Cross Boundary Lines) */}
                              <g transform={`translate(${padL + 8}, ${padT + 8})`}>
                                <rect x="0" y="0" width="146" height="16" rx="3" fill="#ffffff" fillOpacity="0.88" stroke="#15803d" strokeWidth="0.8" />
                                <text x="73" y="11" fontSize="8.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" fill="#166534">
                                  STABLE EXCAVATION ZONE
                                </text>
                              </g>

                              <g transform={`translate(${padL + w - 182}, ${padT + 66})`}>
                                <rect x="0" y="0" width="174" height="16" rx="3" fill="#ffffff" fillOpacity="0.88" stroke="#d97706" strokeWidth="0.8" />
                                <text x="87" y="11" fontSize="8" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" fill="#92400e">
                                  SUPPORT / CABLEBOLT TRANSITION
                                </text>
                              </g>

                              <g transform={`translate(${padL + w - 154}, ${padT + h - 24})`}>
                                <rect x="0" y="0" width="146" height="16" rx="3" fill="#ffffff" fillOpacity="0.88" stroke="#b91c1c" strokeWidth="0.8" />
                                <text x="73" y="11" fontSize="8.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" fill="#991b1b">
                                  UNSTABLE / CAVING ZONE
                                </text>
                              </g>

                              {/* Axes */}
                              <rect x={padL} y={padT} width={w} height={h} fill="none" stroke="#0f172a" strokeWidth="1.5" />
                              {[0.1, 1, 10, 100].map((nVal) => {
                                const py = nToY(nVal);
                                return (
                                  <g key={nVal}>
                                    <line x1={padL - 4} y1={py} x2={padL + w} y2={py} stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="2 2" />
                                    <text x={padL - 7} y={py + 3} fontSize="9" fontFamily="monospace" textAnchor="end" fill="#0f172a">
                                      {nVal}
                                    </text>
                                  </g>
                                );
                              })}
                              {[1, 5, 10, 15, 20, 25].map((hrVal) => {
                                const px = hrToX(hrVal);
                                return (
                                  <g key={hrVal}>
                                    <line x1={px} y1={padT} x2={px} y2={padT + h + 4} stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="2 2" />
                                    <text x={px} y={padT + h + 15} fontSize="9" fontFamily="monospace" textAnchor="middle" fill="#0f172a">
                                      {hrVal}m
                                    </text>
                                  </g>
                                );
                              })}
                              <text x={padL + w / 2} y={244} fontSize="9.5" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                                Hydraulic Radius HR = Area / Perimeter (m)
                              </text>

                              {/* Plotted Stope Operating Point */}
                              <line x1={curX} y1={padT} x2={curX} y2={padT + h} stroke="#0f172a" strokeWidth="1" strokeDasharray="3 2" />
                              <line x1={padL} y1={curY} x2={padL + w} y2={curY} stroke="#0f172a" strokeWidth="1" strokeDasharray="3 2" />
                              <circle cx={curX} cy={curY} r="6.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
                              <rect
                                x={calloutX}
                                y={calloutY}
                                width={calloutW}
                                height="18"
                                rx="3"
                                fill="#0f172a"
                              />
                              <text
                                x={calloutX + calloutW / 2}
                                y={calloutY + 12}
                                fontSize="8.5"
                                fontFamily="monospace"
                                fontWeight="bold"
                                textAnchor="middle"
                                fill="#fbbf24"
                              >
                                {driftId.slice(0, 10)} (HR={mathewsResult.hydraulicRadiusM.toFixed(1)}, N&apos;={mathewsResult.stabilityNumberN.toFixed(1)})
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 07: Kinematic Wedge Analysis & Ground Support Cross-Section */}
              {sections.kinematicWedgeAndSupport && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Left 5 Cols: Kinematic Wedge & Support Spec Table */}
                  <div className="sm:col-span-5 border-2 border-slate-950 bg-white flex flex-col justify-between">
                    <div>
                      <div className="bg-slate-950 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        <span>07A. Kinematic Structural Wedge &amp; Support Spec</span>
                      </div>
                      <table className="w-full text-[9.5px] font-mono border-collapse">
                        <tbody className="divide-y divide-slate-200 tabular-nums">
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Mapped Structural Sets</td>
                            <td className="py-1 px-2 font-bold text-right">{kinematicEvaluation.setsCount} Sets</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Max Potential Wedge Apex</td>
                            <td className="py-1 px-2 text-right">{kinematicEvaluation.maxApexHeightM} m</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Estimated Wedge Mass</td>
                            <td className="py-1 px-2 text-right">{kinematicEvaluation.wedgeTonnes} t</td>
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="py-1 px-2 font-sans font-black text-slate-900">Supported Wedge FoS</td>
                            <td className="py-1 px-2 font-black text-right text-emerald-800">
                              FoS = {kinematicEvaluation.estimatedFos} (Req ≥ 1.50)
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Rockbolt / Split-Set Length</td>
                            <td className="py-1 px-2 font-bold text-right">{kinematicEvaluation.boltLengthM} m</td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Systematic Bolt Grid</td>
                            <td className="py-1 px-2 font-bold text-right">
                              {kinematicEvaluation.boltSpacingM}m × {kinematicEvaluation.boltSpacingM}m
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 px-2 font-sans font-bold text-slate-600">Fibre Shotcrete / Mesh</td>
                            <td className="py-1 px-2 font-bold text-right">
                              {kinematicEvaluation.shotcreteMm > 0
                                ? `${kinematicEvaluation.shotcreteMm} mm + Weld Mesh`
                                : 'Spot Mesh in Crown'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2 bg-slate-50 border-t border-slate-300 text-[9px] font-mono text-slate-700">
                      {kinematicEvaluation.hasCriticalWedge
                        ? '⚠ Intersecting fault/joint planes detected: install systematic crown/shoulder bolts prior to face charging.'
                        : '✓ Favorable discontinuity geometry relative to drive azimuth.'}
                    </div>
                  </div>

                  {/* Right 7 Cols: 2D Ground Support Pattern Cross-Section SVG */}
                  <div className="sm:col-span-7 border-2 border-slate-950 bg-white flex flex-col">
                    <div className="bg-slate-950 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>07B. Underground Ground Support Cross-Section Diagram</span>
                      <span className="font-mono text-cyan-300">
                        L={kinematicEvaluation.boltLengthM}m @ {kinematicEvaluation.boltSpacingM}m · Shotcrete {kinematicEvaluation.shotcreteMm}mm
                      </span>
                    </div>
                    <div className="p-2 flex-1 flex items-center justify-center">
                      <svg
                        id="mining-dossier-support-svg"
                        viewBox="0 0 460 225"
                        className="w-full h-52 block"
                      >
                        <rect x="0" y="0" width="460" height="225" fill="#ffffff" />
                        {(() => {
                          const totalSpanW = stopeWidth + kinematicEvaluation.boltLengthM * 2.1;
                          const totalSpanH = stopeHeight + kinematicEvaluation.boltLengthM * 1.15;
                          const sc = Math.min(390 / Math.max(1, totalSpanW), 146 / Math.max(1, totalSpanH));
                          const dw = stopeWidth * sc;
                          const ox = (460 - dw) / 2;
                          const oy = 192;
                          const toPx = (mx: number, my: number) => ({
                            x: ox + mx * sc,
                            y: oy - my * sc,
                          });
                          const polyPts = profileMetrics.points.map((p) => toPx(p.x, p.y));
                          const center = toPx(stopeWidth / 2, stopeHeight * 0.45);
                          const boltLenPx = kinematicEvaluation.boltLengthM * sc;

                          // Sample perimeter points along walls and roof for rockbolts
                          const boltTargets = profileMetrics.points.filter(
                            (p, idx) => p.y >= stopeHeight * 0.28 && idx % Math.max(1, Math.floor(profileMetrics.points.length / 9)) === 0
                          );
                          const classLabel = mrmrResult.rockMassClass.startsWith('Class')
                            ? mrmrResult.rockMassClass
                            : `Class ${mrmrResult.rockMassClass}`;

                          return (
                            <>
                              {/* Top Banner Text (Reserved y = 0..26) */}
                              <text x="230" y="17" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                                {classLabel} Support — Rockbolts L={kinematicEvaluation.boltLengthM}m @ {kinematicEvaluation.boltSpacingM}m×{kinematicEvaluation.boltSpacingM}m
                              </text>

                              {/* Shotcrete / Mesh Arch Halo */}
                              {kinematicEvaluation.shotcreteMm > 0 && (
                                <polygon
                                  points={polyPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                                  fill="none"
                                  stroke="#0284c7"
                                  strokeWidth="7"
                                  strokeOpacity="0.35"
                                />
                              )}

                              {/* Rockbolts radiating into rock mass */}
                              {boltTargets.map((bp, idx) => {
                                const start = toPx(bp.x, bp.y);
                                const vx = start.x - center.x;
                                const vy = start.y - center.y;
                                const len = Math.hypot(vx, vy) || 1;
                                const endX = start.x + (vx / len) * boltLenPx;
                                const endY = start.y + (vy / len) * boltLenPx;
                                return (
                                  <g key={idx}>
                                    <line
                                      x1={start.x}
                                      y1={start.y}
                                      x2={endX}
                                      y2={endY}
                                      stroke="#dc2626"
                                      strokeWidth="2.2"
                                    />
                                    <circle cx={start.x} cy={start.y} r="3" fill="#0f172a" />
                                  </g>
                                );
                              })}

                              {/* Excavation Profile */}
                              <polygon
                                points={polyPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                                fill="#f8fafc"
                                stroke="#0f172a"
                                strokeWidth="2.5"
                              />

                              {/* Bottom Caption Text (Reserved y = 205..222) */}
                              <text x="230" y="214" fontSize="9.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#475569">
                                Span {stopeWidth}m × Height {stopeHeight}m ({stopeShape.replace('_', ' ').toUpperCase()}) · Area {profileMetrics.areaM2} m²
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {renderOfficialSignOffBlock()}
          </div>
        )}
      </div>
    </div>
  );
};
