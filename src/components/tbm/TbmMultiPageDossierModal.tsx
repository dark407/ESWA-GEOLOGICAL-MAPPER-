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
  Activity,
  Shield,
  Compass,
  TrendingUp,
} from 'lucide-react';
import {
  TbmExcavationRecord,
  TbmLocationItem,
  TbmProjectItem,
} from '../../types/tbm';
import {
  calculateTbmKpi,
  calculateQToRmrCorrelations,
  calculateBartonGrimstadSupport,
  calculateRmrGeomechanicalProperties,
} from '../../engine/tbmCalculationsEngine';
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

export interface TbmMultiPageDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: TbmExcavationRecord;
  records: TbmExcavationRecord[];
  activeLocation: TbmLocationItem | null;
  activeProject: TbmProjectItem | null;
}

interface TbmPersistedLogoState {
  left?: string;
  leftRaw?: string;
  leftCfg?: LogoOrSignatureCropConfig;
  right?: string;
  rightRaw?: string;
  rightCfg?: LogoOrSignatureCropConfig;
}

interface TbmPersistedSignState {
  geologistName: string;
  geologistSign: string;
  geologistSignRaw?: string;
  geologistCfg?: LogoOrSignatureCropConfig;
  operatorName: string;
  operatorSign: string;
  operatorSignRaw?: string;
  operatorCfg?: LogoOrSignatureCropConfig;
  managerName: string;
  managerSign: string;
  managerSignRaw?: string;
  managerCfg?: LogoOrSignatureCropConfig;
  remarks: string;
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

function clockToAngleDeg(clock: string): number {
  const parts = (clock || '12:00').split(':');
  const hr = Number(parts[0]) % 12;
  return hr * 30 - 90; // 12:00 -> -90 deg (top)
}

export const TbmMultiPageDossierModal: React.FC<TbmMultiPageDossierModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  activeLocation,
  activeProject,
}) => {
  const [dossierMode, setDossierMode] = useState<'FULL_3_PAGE' | 'COMPACT_2_PAGE' | 'SINGLE_PAGE'>('FULL_3_PAGE');
  const [autoHideEmpty, setAutoHideEmpty] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [sections, setSections] = useState({
    unrolledRingAndCutterhead: true,
    tbmTelemetryAndPerformance: true,
    cutterWearGroutAndProbe: true,
    qTbmRmrAndSupportClass: true,
    multiRingLongitudinalTrends: true,
  });

  // Persisted Dual Logos with Crop Config
  const [logos, setLogos] = useState<TbmPersistedLogoState>(() => {
    try {
      const raw = localStorage.getItem('eswa_tbm_dossier_logos_v2');
      if (raw) return JSON.parse(raw);
      const legacy = localStorage.getItem('eswa_tbm_report_logos_v1');
      if (legacy) return JSON.parse(legacy);
    } catch {
      // ignore
    }
    return {};
  });

  const saveLogos = (updater: (prev: TbmPersistedLogoState) => TbmPersistedLogoState) => {
    setLogos((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('eswa_tbm_dossier_logos_v2', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Persisted 3-Party Sign-Off & Geologist Remarks
  const [signState, setSignState] = useState<TbmPersistedSignState>(() => {
    try {
      const raw = localStorage.getItem('eswa_tbm_dossier_signs_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          geologistName:
            parsed.geologistName ||
            record.chainageRecord?.geologistOrOperator ||
            activeLocation?.responsibleGeologist ||
            '',
          geologistSign: parsed.geologistSign || '',
          geologistSignRaw: parsed.geologistSignRaw || '',
          geologistCfg: parsed.geologistCfg || DEFAULT_LOGO_CROP_CONFIG,
          operatorName: parsed.operatorName || '',
          operatorSign: parsed.operatorSign || '',
          operatorSignRaw: parsed.operatorSignRaw || '',
          operatorCfg: parsed.operatorCfg || DEFAULT_LOGO_CROP_CONFIG,
          managerName: parsed.managerName || '',
          managerSign: parsed.managerSign || '',
          managerSignRaw: parsed.managerSignRaw || '',
          managerCfg: parsed.managerCfg || DEFAULT_LOGO_CROP_CONFIG,
          remarks:
            parsed.remarks ||
            record.chainageRecord?.generalObservations ||
            `Ring #${record.chainageRecord?.ringNumber ?? 1} excavated in ${record.geology?.mainLithology || 'Hard Rock'}. Maintain annular grout pressure and monitor cutterhead torque.`,
        };
      }
    } catch {
      // ignore
    }
    return {
      geologistName:
        record.chainageRecord?.geologistOrOperator ||
        activeLocation?.responsibleGeologist ||
        '',
      geologistSign: '',
      operatorName: '',
      operatorSign: '',
      managerName: '',
      managerSign: '',
      remarks:
        record.chainageRecord?.generalObservations ||
        `Ring #${record.chainageRecord?.ringNumber ?? 1} excavated in ${record.geology?.mainLithology || 'Bedrock'}. Maintain annular grout fill ratio and monitor cutter wear.`,
    };
  });

  const updateSignState = (patch: Partial<TbmPersistedSignState>) => {
    setSignState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('eswa_tbm_dossier_signs_v2', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Derived TBM Engineering Calculations
  const cutterheadDiaM = activeLocation?.cutterheadDiameterM || activeProject?.tunnelDiameterM || 6.4;
  const cutterCount = activeLocation?.discCutterCount || 44;
  const nominalThrustKn = activeLocation?.nominalOperatingThrustKn || 18000;
  const nominalTorqueKnm = activeLocation?.nominalOperatingTorqueKnm || 3200;

  const kpi = useMemo(
    () => calculateTbmKpi(record.telemetry, cutterheadDiaM, cutterCount),
    [record.telemetry, cutterheadDiaM, cutterCount]
  );

  const qVal = record.classification?.calculatedQ || 4.5;
  const rmrVal = record.classification?.calculatedRmr || 58;
  const qtbmVal =
    record.classification?.qtbmIndex ??
    Number((qVal * Math.pow(20 / Math.max(5, record.geology?.intactStrengthEstimatedMpa || 85), 0.7)).toFixed(2));

  const correlations = useMemo(
    () => calculateQToRmrCorrelations(qVal, rmrVal),
    [qVal, rmrVal]
  );

  const supportDesign = useMemo(
    () => calculateBartonGrimstadSupport(qVal, cutterheadDiaM, 1.0),
    [qVal, cutterheadDiaM]
  );

  const rmrProps = useMemo(
    () => calculateRmrGeomechanicalProperties(rmrVal),
    [rmrVal]
  );

  const trendRecords = useMemo(() => {
    if (records.length === 0) return [record];
    return [...records]
      .sort((a, b) => (a.chainageRecord?.ringNumber ?? 0) - (b.chainageRecord?.ringNumber ?? 0))
      .slice(-20);
  }, [records, record]);

  if (!isOpen) return null;

  const chRec = record.chainageRecord;
  const geo = record.geology;
  const tel = record.telemetry;
  const sup = record.supportLining;
  const gw = record.groundwater;
  const probe = record.probeDrilling;
  const muck = record.muck;
  const discontinuities = geo?.discontinuities || [];
  const hazards = record.hazards || [];

  const hasProbeData = Boolean(
    probe &&
      probe.drilledLengthMeters > 0 &&
      probe.probeHoleId &&
      probe.probeHoleId !== 'NONE'
  );
  const hasEpbData =
    activeLocation?.tbmType === 'EPB' ||
    Boolean(tel?.epbChamberPressureTopBar || tel?.screwConveyorSpeedRpm || tel?.foamInjectionRateLMin);
  const hasSlurryData =
    activeLocation?.tbmType === 'SLURRY_SHIELD' ||
    Boolean(tel?.slurryFacePressureBar || tel?.slurryFlowRateM3H);

  const showPage2 =
    dossierMode === 'FULL_3_PAGE' || dossierMode === 'COMPACT_2_PAGE'
      ? sections.tbmTelemetryAndPerformance || sections.cutterWearGroutAndProbe
      : false;
  const showPage3 =
    dossierMode === 'FULL_3_PAGE' &&
    (sections.qTbmRmrAndSupportClass || sections.multiRingLongitudinalTrends);

  const totalPages = 1 + (showPage2 ? 1 : 0) + (showPage3 ? 1 : 0);

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
      const opSignImg = await loadImageElement(
        signState.operatorSign.startsWith('data:image/') ? signState.operatorSign : ''
      );
      const mgrSignImg = await loadImageElement(
        signState.managerSign.startsWith('data:image/') ? signState.managerSign : ''
      );

      const drawCommonHeader = (ctx: CanvasRenderingContext2D, pageNum: number, subtitle: string) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(28, 28, W - 56, H - 56);

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.strokeRect(36, 36, W - 72, 86);
        ctx.beginPath();
        ctx.moveTo(210, 36);
        ctx.lineTo(210, 122);
        ctx.moveTo(W - 210, 36);
        ctx.lineTo(W - 210, 122);
        ctx.stroke();

        if (leftLogoImg) {
          const sc = Math.min(156 / Math.max(1, leftLogoImg.width), 70 / Math.max(1, leftLogoImg.height));
          const dw = leftLogoImg.width * sc;
          const dh = leftLogoImg.height * sc;
          ctx.drawImage(leftLogoImg, 36 + (174 - dw) / 2, 36 + (86 - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((activeProject?.client || 'CLIENT AUTHORITY').slice(0, 20), 123, 82);
        }

        if (rightLogoImg) {
          const sc = Math.min(156 / Math.max(1, rightLogoImg.width), 70 / Math.max(1, rightLogoImg.height));
          const dw = rightLogoImg.width * sc;
          const dh = rightLogoImg.height * sc;
          ctx.drawImage(rightLogoImg, W - 210 + (174 - dw) / 2, 36 + (86 - dh) / 2, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((activeProject?.contractor || 'TBM CONTRACTOR').slice(0, 20), W - 123, 74);
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#475569';
          ctx.fillText(`SHEET ${pageNum} OF ${totalPages}`, W - 123, 94);
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 19px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TBM MECHANIZED TUNNELING GEOLOGICAL & TELEMETRY DOSSIER', W / 2, 62);
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(
          `${activeProject?.projectName || 'TBM Tunnel Project'} · ${activeLocation?.locationName || 'Main TBM Drive'} · Machine: ${activeLocation?.machineManufacturer || 'TBM'} (${activeLocation?.tbmType || 'SHIELD'})`,
          W / 2,
          84
        );
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11.5px monospace';
        ctx.fillText(
          `${subtitle}  |  Ring #${chRec?.ringNumber ?? 1}  |  RD ${chRec?.startChainage?.toFixed(2)}m → ${chRec?.endChainage?.toFixed(2)}m  |  Page ${pageNum}/${totalPages}`,
          W / 2,
          106
        );
        ctx.textAlign = 'left';
      };

      const drawSignOffFooter = (ctx: CanvasRenderingContext2D, topY: number) => {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(36, topY, W - 72, 74);
        ctx.strokeRect(36, topY, W - 72, 74);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('GEOLOGIST & TBM SHIFT ENGINEER OBSERVATIONS & BORING DIRECTIVES:', 46, topY + 18);
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

        const signY = topY + 84;
        const boxW = (W - 72) / 3;
        const roles = [
          {
            title: 'LOGGED BY (TUNNEL GEOLOGIST)',
            name: signState.geologistName,
            signText: signState.geologistSign,
            img: geoSignImg,
          },
          {
            title: 'VERIFIED BY (TBM SHIFT / PERF ENGINEER)',
            name: signState.operatorName,
            signText: signState.operatorSign,
            img: opSignImg,
          },
          {
            title: 'APPROVED BY (PROJECT MANAGER / CLIENT)',
            name: signState.managerName,
            signText: signState.managerSign,
            img: mgrSignImg,
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
      // PAGE 1: COVER, CUTTERHEAD + 360 UNROLLED RING MAP & GEOLOGY/MUCK TABLE
      // ======================================================================
      const c1 = document.createElement('canvas');
      c1.width = Math.round(W * DPI_SCALE);
      c1.height = Math.round(H * DPI_SCALE);
      const ctx1 = c1.getContext('2d')!;
      ctx1.scale(DPI_SCALE, DPI_SCALE);
      drawCommonHeader(ctx1, 1, '01. 360° UNROLLED RING MAP, CUTTERHEAD FACE & GEOLOGICAL LOG');

      let y1 = 132;
      ctx1.fillStyle = '#f8fafc';
      ctx1.fillRect(36, y1, W - 72, 68);
      ctx1.strokeStyle = '#0f172a';
      ctx1.lineWidth = 1.5;
      ctx1.strokeRect(36, y1, W - 72, 68);

      const metaItems = [
        ['RING NUMBER / SHIFT', `Ring #${chRec?.ringNumber ?? 1} (${chRec?.shift || 'DAY'} ${chRec?.shiftStartTime || '08:00'}–${chRec?.shiftEndTime || '16:00'})`],
        ['CHAINAGE INTERVAL', `RD ${chRec?.startChainage?.toFixed(2)}m → ${chRec?.endChainage?.toFixed(2)}m (Δ ${chRec?.advanceLengthMeters?.toFixed(2)}m)`],
        ['TBM MACHINE SPEC', `${activeLocation?.tbmType || 'SHIELD'} · Ø${cutterheadDiaM}m · ${cutterCount} Cutters`],
        ['DOMINANT LITHOLOGY', `${geo?.mainLithology || 'Hard Rock'} (${geo?.weatheringGrade || 'W1_FRESH'})`],
        ['INTACT UCS / FRACTURING', `${geo?.intactStrengthEstimatedMpa || 95} MPa · ${geo?.degreeOfFracturing || 'MODERATELY_FRACTURED'}`],
        ['Q-SYSTEM / Q-TBM', `Q = ${qVal} (${record.classification?.qClassLabel || 'Fair'}) · Q_TBM = ${qtbmVal}`],
        ['BIENIAWSKI RMR / GSI', `RMR89 = ${rmrVal} · GSI = ${record.classification?.gsiScore || rmrProps.gsiScore}`],
        ['KEY SEGMENT / GROUT', `Key @ ${sup?.keySegmentPositionClock || '12:00'} · Grout ${sup?.annularGroutVolumeActualM3 || 6.4} m³`],
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
        ctx1.font = 'bold 11px monospace';
        ctx1.fillText(String(item[1]).slice(0, 34), cx + 8, cy + 27);
      });
      y1 += 80;

      // Render 360 Unrolled Ring & Cutterhead SVG
      const ringSvgEl = document.getElementById('tbm-dossier-ring-map-svg') as unknown as SVGSVGElement | null;
      const ringPng = await renderSvgElementToHighResPngDataUrl(ringSvgEl, 2800);
      const mapBoxH = 540;
      ctx1.strokeStyle = '#0f172a';
      ctx1.lineWidth = 2;
      ctx1.strokeRect(36, y1, W - 72, mapBoxH);
      ctx1.fillStyle = '#0f172a';
      ctx1.fillRect(36, y1, W - 72, 26);
      ctx1.fillStyle = '#ffffff';
      ctx1.font = 'bold 11.5px sans-serif';
      ctx1.fillText(
        `01. CUTTERHEAD FACE, PRECAST SEGMENT RING & 360° UNROLLED CYLINDRICAL TUNNEL WALL MAP (Ø${cutterheadDiaM}m)`,
        46,
        y1 + 17
      );

      if (ringPng) {
        const rImg = await loadImageElement(ringPng);
        if (rImg) {
          const sc = Math.min((W - 92) / Math.max(1, rImg.width), (mapBoxH - 36) / Math.max(1, rImg.height));
          const dw = rImg.width * sc;
          const dh = rImg.height * sc;
          ctx1.drawImage(rImg, (W - dw) / 2, y1 + 28 + (mapBoxH - 32 - dh) / 2, dw, dh);
        }
      }
      y1 += mapBoxH + 14;

      // Encountered Discontinuity Sets & Muck Belt Table
      ctx1.fillStyle = '#0f172a';
      ctx1.fillRect(36, y1, W - 72, 26);
      ctx1.fillStyle = '#ffffff';
      ctx1.font = 'bold 11.5px sans-serif';
      ctx1.fillText(
        `02. DISCONTINUITY SETS (${discontinuities.length} Sets) & CONVEYOR MUCK CHIP INSPECTION SUMMARY`,
        46,
        y1 + 17
      );
      y1 += 26;

      const dCols = [
        { label: 'SET #', w: 70 },
        { label: 'STRUCTURE TYPE', w: 150 },
        { label: 'STRIKE / DIP / DIR', w: 190 },
        { label: 'SPACING / APERTURE', w: 180 },
        { label: 'ROUGHNESS & INFILLING', w: 290 },
        { label: 'WATER / WEATHERING', w: 288 },
      ];
      ctx1.fillStyle = '#e2e8f0';
      ctx1.fillRect(36, y1, W - 72, 24);
      ctx1.strokeStyle = '#0f172a';
      ctx1.strokeRect(36, y1, W - 72, 24);
      let dx = 36;
      ctx1.fillStyle = '#0f172a';
      ctx1.font = 'bold 10px monospace';
      dCols.forEach((c) => {
        ctx1.fillText(c.label, dx + 6, y1 + 16);
        dx += c.w;
      });
      y1 += 24;

      if (discontinuities.length === 0) {
        ctx1.fillStyle = '#f8fafc';
        ctx1.fillRect(36, y1, W - 72, 28);
        ctx1.strokeStyle = '#cbd5e1';
        ctx1.strokeRect(36, y1, W - 72, 28);
        ctx1.fillStyle = '#64748b';
        ctx1.font = 'italic 11px sans-serif';
        ctx1.fillText('Massive rock mass / no discrete discontinuity sets logged on this ring interval.', 48, y1 + 18);
        y1 += 28;
      } else {
        discontinuities.slice(0, 8).forEach((d, idx) => {
          ctx1.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          ctx1.fillRect(36, y1, W - 72, 24);
          ctx1.strokeStyle = '#cbd5e1';
          ctx1.strokeRect(36, y1, W - 72, 24);
          ctx1.fillStyle = '#0f172a';
          ctx1.font = '10.5px monospace';
          const vals = [
            `J${d.setNumber || idx + 1}`,
            d.type,
            `${d.strikeDeg}° / ${d.dipDeg}° / ${d.dipDirectionDeg}°`,
            `${d.spacingCm} cm · ${d.apertureMm} mm`,
            `${d.roughness} · ${d.infilling}`,
            `${d.waterCondition} · ${d.weathering}`,
          ];
          let rx = 36;
          vals.forEach((v, ci) => {
            ctx1.fillText(String(v).slice(0, 34), rx + 6, y1 + 16);
            rx += dCols[ci].w;
          });
          y1 += 24;
        });
      }

      // Muck Inspection Strip
      y1 += 10;
      ctx1.fillStyle = '#f8fafc';
      ctx1.fillRect(36, y1, W - 72, 48);
      ctx1.strokeStyle = '#0f172a';
      ctx1.strokeRect(36, y1, W - 72, 48);
      ctx1.fillStyle = '#0f172a';
      ctx1.font = 'bold 10.5px sans-serif';
      ctx1.fillText('CONVEYOR MUCK INSPECTION:', 46, y1 + 18);
      ctx1.font = '11px monospace';
      ctx1.fillText(
        `Material: ${muck?.materialType || 'ROCK_CHIPS'}  |  Grading: ${muck?.gradingDescription || 'WELL_GRADED_CHIPS'}  |  Fines/Coarse: ${muck?.finesPercentEstimated ?? 25}% / ${muck?.coarsePercentEstimated ?? 75}%  |  Avg/Max Chip: ${muck?.averageFragmentSizeMm ?? 45}mm / ${muck?.maxFragmentSizeMm ?? 110}mm  |  Water: ${muck?.waterContentVisual || 'MOIST'}`,
        46,
        y1 + 38
      );

      if (totalPages === 1) {
        drawSignOffFooter(ctx1, H - 210);
      }
      canvases.push(c1);

      // ======================================================================
      // PAGE 2: BORING TELEMETRY, CUTTERHEAD WEAR MAP, GROUT & PROBE DRILLING
      // ======================================================================
      if (showPage2) {
        const c2 = document.createElement('canvas');
        c2.width = Math.round(W * DPI_SCALE);
        c2.height = Math.round(H * DPI_SCALE);
        const ctx2 = c2.getContext('2d')!;
        ctx2.scale(DPI_SCALE, DPI_SCALE);
        drawCommonHeader(ctx2, 2, '02. TBM BORING TELEMETRY, CUTTER WEAR MAP, GROUT & PROBE LOG');

        let y2 = 136;

        // Section 03: TBM Boring Telemetry Matrix
        ctx2.fillStyle = '#0f172a';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 11.5px sans-serif';
        ctx2.textAlign = 'left';
        ctx2.fillText('03. TBM OPERATING TELEMETRY & BORING ENERGY EFFICIENCY MATRIX', 46, y2 + 17);
        y2 += 26;

        const telItems = [
          ['TOTAL THRUST FORCE', `${tel?.thrustForceKn ?? 14200} kN (${Math.round(((tel?.thrustForceKn ?? 14200) / nominalThrustKn) * 100)}% Nom.)`],
          ['CUTTERHEAD TORQUE', `${tel?.cutterheadTorqueKnm ?? 2150} kNm (${Math.round(((tel?.cutterheadTorqueKnm ?? 2150) / nominalTorqueKnm) * 100)}% Nom.)`],
          ['CUTTERHEAD RPM', `${tel?.cutterheadRpm ?? 4.8} rev/min`],
          ['PENETRATION PER REV', `${tel?.penetrationPerRevMm ?? 6.2} mm/rev`],
          ['NET PENETRATION RATE', `${tel?.penetrationRateMmMin ?? 29.8} mm/min (${kpi.penetrationRateMH} m/h)`],
          ['FIELD PENETRATION INDEX', `FPI = ${kpi.fpi} kN/cutter/mm (${kpi.fpiStatus})`],
          ['SPECIFIC ENERGY (SE)', `${kpi.specificEnergyMJM3} MJ/m³`],
          ['BORING TIME / DOWNTIME', `${tel?.excavationDurationMin ?? 52} min  |  Downtime: ${tel?.machineDowntimeHours ?? 0} h`],
        ];
        ctx2.fillStyle = '#f8fafc';
        ctx2.fillRect(36, y2, W - 72, 92);
        ctx2.strokeStyle = '#0f172a';
        ctx2.strokeRect(36, y2, W - 72, 92);
        const tCellW = (W - 72) / 4;
        telItems.forEach((item, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const tx = 36 + col * tCellW;
          const ty = y2 + row * 46;
          ctx2.strokeStyle = '#cbd5e1';
          ctx2.strokeRect(tx, ty, tCellW, 46);
          ctx2.fillStyle = '#64748b';
          ctx2.font = 'bold 9.5px sans-serif';
          ctx2.fillText(item[0], tx + 10, ty + 16);
          ctx2.fillStyle = '#0f172a';
          ctx2.font = 'bold 13px monospace';
          ctx2.fillText(String(item[1]).slice(0, 32), tx + 10, ty + 36);
        });
        y2 += 108;

        // Render Cutterhead Wear & Annular Grout SVG Diagram
        const wearSvgEl = document.getElementById('tbm-dossier-wear-grout-svg') as unknown as SVGSVGElement | null;
        const wearPng = await renderSvgElementToHighResPngDataUrl(wearSvgEl, 2600);
        const wearBoxH = 420;
        ctx2.fillStyle = '#0f172a';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 11.5px sans-serif';
        ctx2.fillText('04. CUTTERHEAD DISC WEAR RADIAL MAP & ANNULAR TAIL-VOID GROUTING VERIFICATION', 46, y2 + 17);
        y2 += 26;
        ctx2.strokeStyle = '#0f172a';
        ctx2.strokeRect(36, y2, W - 72, wearBoxH);
        if (wearPng) {
          const wImg = await loadImageElement(wearPng);
          if (wImg) {
            const sc = Math.min((W - 92) / Math.max(1, wImg.width), (wearBoxH - 20) / Math.max(1, wImg.height));
            const dw = wImg.width * sc;
            const dh = wImg.height * sc;
            ctx2.drawImage(wImg, (W - dw) / 2, y2 + (wearBoxH - dh) / 2, dw, dh);
          }
        }
        y2 += wearBoxH + 16;

        // Probe Hole Drilling & Hydrogeology Table
        ctx2.fillStyle = '#0f172a';
        ctx2.fillRect(36, y2, W - 72, 26);
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 11.5px sans-serif';
        ctx2.fillText('05. PROBE HOLE DRILLING AHEAD LOG & HYDROGEOLOGICAL INFLOW REGISTER', 46, y2 + 17);
        y2 += 26;

        ctx2.fillStyle = '#f8fafc';
        ctx2.fillRect(36, y2, W - 72, 110);
        ctx2.strokeStyle = '#0f172a';
        ctx2.strokeRect(36, y2, W - 72, 110);

        const probeHydroItems = [
          ['WATER INFLOW RATE', `${gw?.inflowRateLitersPerMin ?? 0} L/min (${gw?.waterInrushRiskLevel || 'SAFE_DRY'})`],
          ['WATER PRESSURE / INGRESS', `${gw?.waterPressureBar ?? 0} bar @ ${gw?.ingressLocation || 'FACE_CUTTERHEAD'}`],
          ['WATER QUALITY (pH / TURB)', `pH ${gw?.phEstimated ?? 7.2} · ${gw?.turbidity || 'CLEAR'} · Pumps: ${gw?.dewateringPumpsActive ?? 1}`],
          ['PRE-GROUTING ACTION', gw?.preGroutingActionTaken || 'None Required'],
          ...(hasProbeData || !autoHideEmpty
            ? [
                ['PROBE HOLE ID & LENGTH', `${probe?.probeHoleId || 'PRB-01'} · Length: ${probe?.drilledLengthMeters ?? 24} m (Az ${probe?.azimuthDeg ?? 0}° / Inc ${probe?.inclinationDeg ?? 2}°)`],
                ['PROBE DRILLING TELEMETRY', `Speed: ${probe?.drillingSpeedMMin ?? 1.8} m/min · Feed: ${probe?.drillingFeedPressureBar ?? 85} bar · Return: ${probe?.flushingWaterReturn || 'FULL_RETURN'}`],
                ['GEOLOGY AHEAD & VOIDS', `${probe?.geologyLoggedAhead || 'Competent bedrock ahead'} · Cavity: ${probe?.cavityOrVoidDetected ? 'YES' : 'NONE'}`],
                ['ADVANCE RECOMMENDATION', probe?.advanceRecommendation || 'PROCEED_NORMAL'],
              ]
            : []),
        ];
        const phCellW = (W - 72) / 2;
        probeHydroItems.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const px = 36 + col * phCellW;
          const py = y2 + row * 27.5;
          ctx2.strokeStyle = '#cbd5e1';
          ctx2.strokeRect(px, py, phCellW, 27.5);
          ctx2.fillStyle = '#475569';
          ctx2.font = 'bold 9.5px sans-serif';
          ctx2.fillText(item[0], px + 8, py + 18);
          ctx2.fillStyle = '#0f172a';
          ctx2.font = 'bold 10.5px monospace';
          ctx2.fillText(String(item[1]).slice(0, 56), px + 180, py + 18);
        });

        if (totalPages === 2) {
          drawSignOffFooter(ctx2, H - 210);
        }
        canvases.push(c2);
      }

      // ======================================================================
      // PAGE 3: Q-TBM / RMR CORRELATIONS, MULTI-RING TRENDS & SIGN-OFF
      // ======================================================================
      if (showPage3) {
        const c3 = document.createElement('canvas');
        c3.width = Math.round(W * DPI_SCALE);
        c3.height = Math.round(H * DPI_SCALE);
        const ctx3 = c3.getContext('2d')!;
        ctx3.scale(DPI_SCALE, DPI_SCALE);
        drawCommonHeader(ctx3, canvases.length + 1, '03. Q-TBM / RMR CORRELATIONS, MULTI-RING LONGITUDINAL TRENDS & SIGN-OFF');

        let y3 = 136;

        // Section 06: Q-TBM, Barton Q, RMR89 & Support Class
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(36, y3, W - 72, 26);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11.5px sans-serif';
        ctx3.textAlign = 'left';
        ctx3.fillText('06. GEOMECHANICAL CLASSIFICATION (Q-SYSTEM, Q-TBM, BIENIAWSKI RMR89 & GSI) & SUPPORT CLASS', 46, y3 + 17);
        y3 += 26;

        ctx3.fillStyle = '#f8fafc';
        ctx3.fillRect(36, y3, W - 72, 110);
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(36, y3, W - 72, 110);

        const qRmrItems = [
          ['BARTON Q PARAMETERS', `RQD=${record.classification?.rqdPercent ?? 75}% · Jn=${record.classification?.jn ?? 6} · Jr=${record.classification?.jr ?? 2} · Ja=${record.classification?.ja ?? 2} · Jw=${record.classification?.jw ?? 1} · SRF=${record.classification?.srf ?? 1}`],
          ['CALCULATED Q & Q-TBM', `Q = ${qVal} (${record.classification?.qClassLabel || 'Fair'})  |  Q_TBM = ${qtbmVal}`],
          ['BIENIAWSKI RMR89 BREAKDOWN', `UCS=${record.classification?.rmrStrengthScore ?? 12} + RQD=${record.classification?.rmrRqdScore ?? 15} + Spc=${record.classification?.rmrSpacingScore ?? 12} + Cond=${record.classification?.rmrConditionScore ?? 20} + Wat=${record.classification?.rmrWaterScore ?? 10} + Adj=${record.classification?.rmrOrientationAdjustment ?? -5}`],
          ['CALCULATED RMR89 & GSI', `RMR89 = ${rmrVal} (${rmrProps.rockClass})  |  Hoek GSI = ${record.classification?.gsiScore || rmrProps.gsiScore}`],
          ['DEFORMATION MODULUS (Em)', `Em = ${rmrProps.deformationModulusEmGpa} GPa  |  Cohesion c = ${rmrProps.cohesionKpa} kPa  |  Friction φ = ${rmrProps.frictionAngleDeg}°`],
          ['EMPIRICAL Q→RMR CONSENSUS', `Bieniawski=${correlations.bieniawski1976} · Barton=${correlations.barton1995} · Rutledge=${correlations.rutledgePreston1978} · Avg=${correlations.averageRmr} (${correlations.confidenceScorePercent}% Conf.)`],
          ['BARTON-GRIMSTAD SUPPORT', `Category ${supportDesign.categoryNum}: ${supportDesign.categoryName}`],
          ['INSTALLED LINING / SUPPORT', `${sup?.liningType || 'PRECAST_SEGMENT'} (${sup?.ringTypeUniversal || 'UNIVERSAL'}) · Bolts L=${supportDesign.boltLengthM}m · SFRS=${supportDesign.fiberShotcreteThicknessMm}mm`],
        ];
        const qrW = (W - 72) / 2;
        qRmrItems.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const qx = 36 + col * qrW;
          const qy = y3 + row * 27.5;
          ctx3.strokeStyle = '#cbd5e1';
          ctx3.strokeRect(qx, qy, qrW, 27.5);
          ctx3.fillStyle = '#475569';
          ctx3.font = 'bold 9.5px sans-serif';
          ctx3.fillText(item[0], qx + 8, qy + 18);
          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 10.5px monospace';
          ctx3.fillText(String(item[1]).slice(0, 58), qx + 175, qy + 18);
        });
        y3 += 126;

        // Render Multi-Ring Longitudinal Trend Charts SVG
        const trendSvgEl = document.getElementById('tbm-dossier-trends-svg') as unknown as SVGSVGElement | null;
        const trendPng = await renderSvgElementToHighResPngDataUrl(trendSvgEl, 2600);
        const trendBoxH = 510;
        ctx3.fillStyle = '#0f172a';
        ctx3.fillRect(36, y3, W - 72, 26);
        ctx3.fillStyle = '#ffffff';
        ctx3.font = 'bold 11.5px sans-serif';
        ctx3.fillText(
          `07. MULTI-RING LONGITUDINAL CHAINAGE TREND CHARTS (${trendRecords.length} Rings — Thrust, Torque, PR, FPI & Rock Mass Q/RMR)`,
          46,
          y3 + 17
        );
        y3 += 26;
        ctx3.strokeStyle = '#0f172a';
        ctx3.strokeRect(36, y3, W - 72, trendBoxH);
        if (trendPng) {
          const tImg = await loadImageElement(trendPng);
          if (tImg) {
            const sc = Math.min((W - 92) / Math.max(1, tImg.width), (trendBoxH - 20) / Math.max(1, tImg.height));
            const dw = tImg.width * sc;
            const dh = tImg.height * sc;
            ctx3.drawImage(tImg, (W - dw) / 2, y3 + (trendBoxH - dh) / 2, dw, dh);
          }
        }

        drawSignOffFooter(ctx3, H - 210);
        canvases.push(c3);
      }

      exportCanvasesAsPdfDocument(
        canvases,
        `TBM_Ring_${chRec?.ringNumber ?? 1}_RD_${chRec?.startChainage?.toFixed(1)}m_Analytical_Dossier_300DPI.pdf`,
        'portrait',
        'A4'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // EDITABLE WORD (.DOC) EXPORT
  // ============================================================================
  const handleExportEditableWordDoc = async () => {
    setIsExporting(true);
    try {
      const ringSvgEl = document.getElementById('tbm-dossier-ring-map-svg') as unknown as SVGSVGElement | null;
      const wearSvgEl = document.getElementById('tbm-dossier-wear-grout-svg') as unknown as SVGSVGElement | null;
      const trendSvgEl = document.getElementById('tbm-dossier-trends-svg') as unknown as SVGSVGElement | null;
      const [ringPng, wearPng, trendPng] = await Promise.all([
        renderSvgElementToHighResPngDataUrl(ringSvgEl, 1800),
        renderSvgElementToHighResPngDataUrl(wearSvgEl, 1600),
        renderSvgElementToHighResPngDataUrl(trendSvgEl, 1600),
      ]);

      const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>TBM Analytical Dossier - Ring #${chRec?.ringNumber ?? 1}</title>
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
        ${logos.left ? `<img src="${logos.left}" width="110" height="45" />` : `<strong>${activeProject?.client || 'CLIENT LOGO'}</strong>`}
      </td>
      <td style="width:60%;text-align:center;">
        <div style="font-size:14pt;font-weight:bold;">TBM MECHANIZED TUNNELING GEOLOGICAL &amp; TELEMETRY DOSSIER</div>
        <div style="font-size:10pt;margin-top:2pt;">${activeProject?.projectName || 'TBM Tunnel Project'} · ${activeLocation?.locationName || 'Main TBM Drive'}</div>
        <div style="font-size:9pt;color:#334155;margin-top:2pt;">Ring #<strong>${chRec?.ringNumber ?? 1}</strong> | Chainage: <strong>RD ${chRec?.startChainage?.toFixed(2)}m → ${chRec?.endChainage?.toFixed(2)}m</strong> | Shift: ${chRec?.shift || 'DAY'}</div>
      </td>
      <td style="width:20%;text-align:center;">
        ${logos.right ? `<img src="${logos.right}" width="110" height="45" />` : `<strong>${activeProject?.contractor || 'CONTRACTOR'}</strong>`}
      </td>
    </tr>
  </table>

  <div class="sec-hdr">01. RING ADVANCE, TBM CONFIGURATION &amp; GEOLOGICAL SUMMARY</div>
  <table>
    <tr>
      <th>Ring Number / Shift</th><td>Ring #${chRec?.ringNumber ?? 1} (${chRec?.shift})</td>
      <th>Chainage Interval</th><td>RD ${chRec?.startChainage?.toFixed(2)}m – ${chRec?.endChainage?.toFixed(2)}m (Δ ${chRec?.advanceLengthMeters?.toFixed(2)}m)</td>
      <th>TBM Machine Type</th><td>${activeLocation?.tbmType || 'SHIELD'} (Ø${cutterheadDiaM}m, ${cutterCount} Cutters)</td>
    </tr>
    <tr>
      <th>Dominant Lithology</th><td>${geo?.mainLithology || 'Hard Rock'} (${geo?.weatheringGrade || 'W1_FRESH'})</td>
      <th>Intact UCS / Fracturing</th><td>${geo?.intactStrengthEstimatedMpa || 95} MPa / ${geo?.degreeOfFracturing || 'MODERATELY_FRACTURED'}</td>
      <th>Q-System / RMR89</th><td>Q = ${qVal} (Q_TBM = ${qtbmVal}) | RMR89 = ${rmrVal}</td>
    </tr>
  </table>

  ${ringPng ? `<div class="sec-hdr">02. CUTTERHEAD FACE, SEGMENTAL RING &amp; 360° UNROLLED WALL MAP</div><div style="text-align:center;border:1px solid #0f172a;padding:6pt;margin-bottom:10pt;"><img src="${ringPng}" width="640" /></div>` : ''}

  <div class="sec-hdr">03. MAPPED DISCONTINUITY SETS (${discontinuities.length} Sets)</div>
  <table>
    <thead>
      <tr><th>Set #</th><th>Type</th><th>Strike / Dip / Dir</th><th>Spacing / Aperture</th><th>Roughness &amp; Infilling</th><th>Water / Weathering</th></tr>
    </thead>
    <tbody>
      ${
        discontinuities.length === 0
          ? `<tr><td colspan="6">Massive rock mass / no discrete discontinuity sets recorded.</td></tr>`
          : discontinuities
              .map(
                (d, i) =>
                  `<tr><td>J${d.setNumber || i + 1}</td><td>${d.type}</td><td>${d.strikeDeg}° / ${d.dipDeg}° / ${d.dipDirectionDeg}°</td><td>${d.spacingCm} cm / ${d.apertureMm} mm</td><td>${d.roughness} · ${d.infilling}</td><td>${d.waterCondition} · ${d.weathering}</td></tr>`
              )
              .join('')
      }
    </tbody>
  </table>

  <div class="page-break"></div>
  <div class="sec-hdr">04. TBM BORING TELEMETRY, CUTTERHEAD TOOL WEAR &amp; ANNULAR GROUTING</div>
  <table>
    <tr>
      <th>Thrust Force</th><td><strong>${tel?.thrustForceKn ?? 14200} kN</strong></td>
      <th>Cutterhead Torque</th><td><strong>${tel?.cutterheadTorqueKnm ?? 2150} kNm</strong></td>
      <th>Cutterhead RPM</th><td>${tel?.cutterheadRpm ?? 4.8} RPM</td>
    </tr>
    <tr>
      <th>Penetration Rate</th><td>${tel?.penetrationPerRevMm ?? 6.2} mm/rev (${tel?.penetrationRateMmMin ?? 29.8} mm/min | ${kpi.penetrationRateMH} m/h)</td>
      <th>Field Penetration Index (FPI)</th><td><strong>${kpi.fpi} kN/cutter/mm (${kpi.fpiStatus})</strong></td>
      <th>Specific Energy (SE)</th><td><strong>${kpi.specificEnergyMJM3} MJ/m³</strong></td>
    </tr>
    <tr>
      <th>Cutter Wear / Replaced</th><td>Avg Wear: ${tel?.cutterWearMm ?? 3.5} mm | Replaced: ${tel?.cuttersReplacedCount ?? 0}</td>
      <th>Annular Backfill Grout</th><td>Actual: ${sup?.annularGroutVolumeActualM3 ?? 6.4} m³ / Theo: ${sup?.annularGroutVolumeTheoreticalM3 ?? 6.0} m³ (${sup?.groutRatioActualVsTheo ?? 107}%)</td>
      <th>Key Segment Clock</th><td>${sup?.keySegmentPositionClock || '12:00'} (Roll ${sup?.ringRollMm ?? 2}mm, Pitch ${sup?.ringPitchMm ?? -1}mm)</td>
    </tr>
  </table>

  ${wearPng ? `<div style="text-align:center;border:1px solid #0f172a;padding:6pt;margin-bottom:10pt;"><img src="${wearPng}" width="640" /></div>` : ''}

  ${trendPng ? `<div class="sec-hdr">05. MULTI-RING LONGITUDINAL CHAINAGE TRENDS</div><div style="text-align:center;border:1px solid #0f172a;padding:6pt;margin-bottom:10pt;"><img src="${trendPng}" width="640" /></div>` : ''}

  <div class="sec-hdr">06. GEOLOGIST &amp; TBM SHIFT ENGINEER REMARKS &amp; SIGN-OFF</div>
  <p style="border:1px solid #0f172a;padding:6pt;background:#f8fafc;">${signState.remarks}</p>
  <table>
    <tr>
      <td style="width:33.3%;">
        <strong>LOGGED BY (TUNNEL GEOLOGIST)</strong><br/>
        Name: ${signState.geologistName || '____________________'}<br/>
        Sign: ${signState.geologistSign.startsWith('data:image/') ? `<img src="${signState.geologistSign}" height="32" />` : signState.geologistSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
      <td style="width:33.3%;">
        <strong>VERIFIED BY (TBM SHIFT ENGINEER)</strong><br/>
        Name: ${signState.operatorName || '____________________'}<br/>
        Sign: ${signState.operatorSign.startsWith('data:image/') ? `<img src="${signState.operatorSign}" height="32" />` : signState.operatorSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
      <td style="width:33.3%;">
        <strong>APPROVED BY (PROJECT MANAGER)</strong><br/>
        Name: ${signState.managerName || '____________________'}<br/>
        Sign: ${signState.managerSign.startsWith('data:image/') ? `<img src="${signState.managerSign}" height="32" />` : signState.managerSign || '____________________'}<br/>
        Date: ${new Date().toLocaleDateString()}
      </td>
    </tr>
  </table>
</body>
</html>`;

      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TBM_Ring_${chRec?.ringNumber ?? 1}_Analytical_Dossier.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setIsExporting(false);
    }
  };

  // Common ISO Title Block for TBM Dossier Pages
  const renderIsoTitleBlock = (pageNum: number, subtitle: string) => (
    <div className="border-2 border-slate-950 bg-white">
      <div className="grid grid-cols-12 items-stretch border-b border-slate-950">
        <div className="col-span-3 border-r border-slate-950 p-2 flex flex-col items-center justify-center bg-white">
          <ReportHeaderLogoBox
            side="left"
            logoDataUrl={logos.left}
            rawLogoDataUrl={logos.leftRaw}
            cropConfig={logos.leftCfg}
            fallbackTitle={activeProject?.client || 'CLICK TO ADD CLIENT LOGO'}
            onUpdateLogo={(cropped, raw, cfg) =>
              saveLogos((prev) => ({ ...prev, left: cropped, leftRaw: raw, leftCfg: cfg }))
            }
            onClearLogo={() =>
              saveLogos((prev) => ({ ...prev, left: undefined, leftRaw: undefined }))
            }
          />
        </div>

        <div className="col-span-6 p-2 text-center flex flex-col justify-center bg-slate-50/70">
          <div className="text-[13px] font-black tracking-wider uppercase text-slate-950 leading-tight">
            TBM MECHANIZED TUNNELING GEOLOGICAL &amp; TELEMETRY DOSSIER
          </div>
          <div className="text-[10.5px] font-bold text-slate-800 mt-0.5 truncate">
            {activeProject?.projectName || 'TBM Tunnel Project'} · {activeLocation?.locationName || 'Main TBM Drive'} ·{' '}
            {activeLocation?.machineManufacturer || 'TBM'} ({activeLocation?.tbmType || 'SHIELD'})
          </div>
          <div className="text-[9.5px] font-mono font-bold text-slate-600 mt-0.5">
            {subtitle} · Sheet {pageNum} of {totalPages}
          </div>
        </div>

        <div className="col-span-3 border-l border-slate-950 p-2 flex flex-col items-center justify-center bg-white">
          <ReportHeaderLogoBox
            side="right"
            logoDataUrl={logos.right}
            rawLogoDataUrl={logos.rightRaw}
            cropConfig={logos.rightCfg}
            fallbackTitle={activeProject?.contractor || 'CONTRACTOR LOGO'}
            onUpdateLogo={(cropped, raw, cfg) =>
              saveLogos((prev) => ({ ...prev, right: cropped, rightRaw: raw, rightCfg: cfg }))
            }
            onClearLogo={() =>
              saveLogos((prev) => ({ ...prev, right: undefined, rightRaw: undefined }))
            }
          />
        </div>
      </div>

      {/* Spacious 4-Column × 2-Row Key-Value Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 text-[10px] font-mono divide-x divide-y divide-slate-300 bg-white">
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Ring Number</span>
          <strong className="text-slate-950 tabular-nums truncate block">Ring #{chRec?.ringNumber ?? 1}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Chainage (RD)</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {chRec?.startChainage?.toFixed(2)}–{chRec?.endChainage?.toFixed(2)}m
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Ring Stroke</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            Δ {chRec?.advanceLengthMeters?.toFixed(2) || '1.50'} m
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Shift &amp; Time</span>
          <strong className="text-slate-950 truncate block">
            {chRec?.shift || 'DAY'} ({chRec?.shiftStartTime || '08:00'})
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Cutterhead Ø</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {cutterheadDiaM}m ({cutterCount} Discs)
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Main Lithology</span>
          <strong className="text-slate-950 truncate block">{geo?.mainLithology || 'Hard Rock'}</strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">Q / Q-TBM</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {qVal} / {qtbmVal}
          </strong>
        </div>
        <div className="p-2 min-w-0">
          <span className="block text-[8.5px] font-sans font-bold uppercase text-slate-500">RMR89 / FPI</span>
          <strong className="text-slate-950 tabular-nums truncate block">
            {rmrVal} / {kpi.fpi}
          </strong>
        </div>
      </div>
    </div>
  );

  // Common 3-Party Official Sign-Off Block
  const renderOfficialSignOffBlock = () => (
    <div className="border-2 border-slate-950 bg-white space-y-0">
      <div className="border-b border-slate-950 p-2 bg-slate-50">
        <div className="flex items-center justify-between text-[9.5px] font-bold uppercase text-slate-800 mb-1">
          <span>08. Tunnel Geologist &amp; TBM Shift Engineer Remarks, Cutterhead &amp; Grout Directives</span>
          <span className="text-[8.5px] font-mono text-slate-500 print:hidden">Editable Inline</span>
        </div>
        <textarea
          rows={2}
          value={signState.remarks}
          onChange={(e) => updateSignState({ remarks: e.target.value })}
          placeholder="Enter TBM face stability notes, cutter inspection directives, or grouting instructions..."
          className="w-full text-[10px] font-mono text-slate-950 bg-white border border-slate-300 rounded px-2 py-1 focus:border-slate-950 outline-none resize-none print:border-none print:bg-transparent print:p-0"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-950 text-[10px] bg-white">
        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Logged By · Site Tunnel Geologist
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
            <span>Engineering Geology</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Verified By · TBM Shift / Perf Engineer
          </div>
          <ReportBorderlessGeologistSignRow
            roleLabel="Name:"
            nameValue={signState.operatorName}
            signValue={signState.operatorSign}
            rawSignDataUrl={signState.operatorSignRaw}
            signCropConfig={signState.operatorCfg}
            onNameChange={(val) => updateSignState({ operatorName: val })}
            onSignChange={(val, raw, cfg) =>
              updateSignState({ operatorSign: val, operatorSignRaw: raw, operatorCfg: cfg })
            }
            stackedLayout
          />
          <div className="text-[8.5px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-200">
            <span>TBM Operations</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-2.5 space-y-1.5 min-w-0">
          <div className="text-[8.5px] font-bold uppercase text-slate-500 truncate">
            Approved By · Construction Manager / Client
          </div>
          <ReportBorderlessGeologistSignRow
            roleLabel="Name:"
            nameValue={signState.managerName}
            signValue={signState.managerSign}
            rawSignDataUrl={signState.managerSignRaw}
            signCropConfig={signState.managerCfg}
            onNameChange={(val) => updateSignState({ managerName: val })}
            onSignChange={(val, raw, cfg) =>
              updateSignState({ managerSign: val, managerSignRaw: raw, managerCfg: cfg })
            }
            stackedLayout
          />
          <div className="text-[8.5px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-200">
            <span>QA/QC Statutory Sign-Off</span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden print:bg-white print:static print:overflow-visible">
      {/* Top Studio Control Bar */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              TBM Mechanized Tunneling Multi-Page Analytical Dossier Studio
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Ring #{chRec?.ringNumber ?? 1} · RD {chRec?.startChainage?.toFixed(2)}m → {chRec?.endChainage?.toFixed(2)}m · {totalPages}-Page ISO A4 Package (300 DPI PDF &amp; Editable Word)
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
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Auto-Hide & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoHideEmpty((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              autoHideEmpty
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Automatically hide unlogged optional sections (such as unlogged probe holes or hazards)"
          >
            {autoHideEmpty ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Auto-Hide Empty: {autoHideEmpty ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportMultiPage300DpiPdf}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Rendering 300 DPI...' : `Download ${totalPages}-Page PDF (300 DPI)`}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportEditableWordDoc}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
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

      {/* Section Filter Checkboxes */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-300 print:hidden shrink-0">
        <span className="font-bold text-slate-400 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Include Sections:
        </span>
        {(
          [
            { key: 'unrolledRingAndCutterhead', label: '01. 360° Unrolled Ring & Cutterhead Face' },
            { key: 'tbmTelemetryAndPerformance', label: '02. Thrust, Torque, PR, FPI & Energy' },
            { key: 'cutterWearGroutAndProbe', label: '03. Cutter Wear, Grout & Probe Log' },
            { key: 'qTbmRmrAndSupportClass', label: '04. Q-TBM, RMR89 & Support Class' },
            { key: 'multiRingLongitudinalTrends', label: '05. Multi-Ring Longitudinal Trends' },
          ] as const
        ).map((sec) => {
          const active = sections[sec.key];
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => setSections((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
              className={`flex items-center gap-1 font-mono cursor-pointer ${
                active ? 'text-cyan-300 font-bold' : 'text-slate-500'
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
            PAGE 1: COVER TITLE BLOCK, CUTTERHEAD + 360° UNROLLED RING MAP & GEOLOGY
           ==================================================================== */}
        <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4 print:break-after-page">
          <div className="space-y-3.5">
            {renderIsoTitleBlock(1, '01. CUTTERHEAD FACE, SEGMENTAL RING & 360° UNROLLED GEOLOGY')}

            {/* Dual Graphical CAD Panel: Cutterhead Face + 360° Unrolled Cylindrical Wall */}
            {sections.unrolledRingAndCutterhead && (
              <div className="border-2 border-slate-950 bg-white">
                <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    01. 2D Cutterhead Face, Precast Segment Ring &amp; 360° Unrolled Cylindrical Wall Map (Ø{cutterheadDiaM}m)
                  </span>
                  <span className="font-mono text-cyan-300">
                    Key Segment @ {sup?.keySegmentPositionClock || '12:00'} · {discontinuities.length} Joint Sets
                  </span>
                </div>

                <div className="p-2 bg-white">
                  <svg
                    id="tbm-dossier-ring-map-svg"
                    viewBox="0 0 880 350"
                    className="w-full h-[305px] block"
                  >
                    <rect x="0" y="0" width="880" height="350" fill="#ffffff" />

                    {/* LEFT PANEL (0..330): 2D Circular Cutterhead Face & Annular Precast Segment Ring */}
                    {(() => {
                      const cx = 165;
                      const cy = 175;
                      const rOuter = 122;
                      const rInner = 102;
                      const keyAngleDeg = clockToAngleDeg(sup?.keySegmentPositionClock || '12:00');
                      const setColors = ['#dc2626', '#0284c7', '#d97706', '#7c3aed', '#059669'];

                      return (
                        <g>
                          <text x={cx} y="20" fontSize="10.5" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                            A. CUTTERHEAD FACE &amp; SEGMENT RING (#{chRec?.ringNumber ?? 1})
                          </text>

                          {/* Annular Precast Concrete Segment Ring */}
                          <circle cx={cx} cy={cy} r={rOuter} fill="#e2e8f0" stroke="#0f172a" strokeWidth="2.2" />
                          {[0, 60, 120, 180, 240, 300].map((deg) => {
                            const rad = ((deg + keyAngleDeg + 15) * Math.PI) / 180;
                            return (
                              <line
                                key={deg}
                                x1={cx + rInner * Math.cos(rad)}
                                y1={cy + rInner * Math.sin(rad)}
                                x2={cx + rOuter * Math.cos(rad)}
                                y2={cy + rOuter * Math.sin(rad)}
                                stroke="#0f172a"
                                strokeWidth="1.8"
                              />
                            );
                          })}

                          {/* Highlight Key Segment at Logged Clock Position */}
                          {(() => {
                            const a1 = ((keyAngleDeg - 14) * Math.PI) / 180;
                            const a2 = ((keyAngleDeg + 14) * Math.PI) / 180;
                            const x1o = cx + rOuter * Math.cos(a1);
                            const y1o = cy + rOuter * Math.sin(a1);
                            const x2o = cx + rOuter * Math.cos(a2);
                            const y2o = cy + rOuter * Math.sin(a2);
                            const x2i = cx + rInner * Math.cos(a2);
                            const y2i = cy + rInner * Math.sin(a2);
                            const x1i = cx + rInner * Math.cos(a1);
                            const y1i = cy + rInner * Math.sin(a1);
                            return (
                              <polygon
                                points={`${x1o},${y1o} ${x2o},${y2o} ${x2i},${y2i} ${x1i},${y1i}`}
                                fill="#f59e0b"
                                stroke="#0f172a"
                                strokeWidth="2"
                              />
                            );
                          })()}

                          {/* Inner Cutterhead Excavation Face */}
                          <circle cx={cx} cy={cy} r={rInner} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />

                          {/* Radial & Concentric Cutterhead Tracks */}
                          {[32, 64, 90].map((r) => (
                            <circle
                              key={r}
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill="none"
                              stroke="#cbd5e1"
                              strokeWidth="0.9"
                              strokeDasharray="3 3"
                            />
                          ))}
                          <line x1={cx - rInner} y1={cy} x2={cx + rInner} y2={cy} stroke="#cbd5e1" strokeWidth="0.9" />
                          <line x1={cx} y1={cy - rInner} x2={cx} y2={cy + rInner} stroke="#cbd5e1" strokeWidth="0.9" />

                          {/* Plot Discontinuity Traces Across Circular Cutterhead Face */}
                          {discontinuities.map((d, idx) => {
                            const strikeRad = (((d.strikeDeg ?? 45) - 90) * Math.PI) / 180;
                            const offset = ((idx - (discontinuities.length - 1) / 2) * 28);
                            const nx = -Math.sin(strikeRad);
                            const ny = Math.cos(strikeRad);
                            const px = cx + nx * offset;
                            const py = cy + ny * offset;
                            const chord = Math.sqrt(Math.max(100, rInner * rInner - offset * offset));
                            const x1 = px - Math.cos(strikeRad) * chord;
                            const y1 = py - Math.sin(strikeRad) * chord;
                            const x2 = px + Math.cos(strikeRad) * chord;
                            const y2 = py + Math.sin(strikeRad) * chord;
                            const col = setColors[idx % setColors.length];
                            return (
                              <g key={d.id || idx}>
                                <line
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={col}
                                  strokeWidth={d.type === 'FAULT' || d.type === 'SHEAR_ZONE' ? 3 : 2}
                                  strokeDasharray={d.type === 'FAULT' ? '6 3' : undefined}
                                />
                                {/* Dip tick */}
                                <line
                                  x1={px}
                                  y1={py}
                                  x2={px + nx * 11}
                                  y2={py + ny * 11}
                                  stroke={col}
                                  strokeWidth="2"
                                />
                                <text
                                  x={px + nx * 18}
                                  y={py + ny * 18}
                                  fontSize="9"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  fill={col}
                                >
                                  J{d.setNumber || idx + 1} ({d.dipDeg}°)
                                </text>
                              </g>
                            );
                          })}

                          {/* Clock Labels */}
                          <text x={cx} y={cy - rOuter - 6} fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                            12:00 (CROWN)
                          </text>
                          <text x={cx} y={cy + rOuter + 13} fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                            06:00 (INVERT)
                          </text>
                          <text x={cx - rOuter - 8} y={cy + 3} fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="end" fill="#475569">
                            09:00
                          </text>
                          <text x={cx + rOuter + 8} y={cy + 3} fontSize="8.5" fontFamily="monospace" fontWeight="bold" textAnchor="start" fill="#475569">
                            03:00
                          </text>

                          {/* Key Segment & Alignment Readout */}
                          <text x={cx} y="336" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#334155">
                            Key: {sup?.keySegmentPositionClock || '12:00'} · Roll: {sup?.ringRollMm ?? 0}mm · Pitch: {sup?.ringPitchMm ?? 0}mm
                          </text>
                        </g>
                      );
                    })()}

                    {/* RIGHT PANEL (355..865): 360° Unrolled Cylindrical Ring Strip Map */}
                    {(() => {
                      const sx = 360;
                      const sy = 36;
                      const sw = 500;
                      const sh = 272;
                      const zones = [
                        { label: 'L. INVERT', x: 0, w: sw * 0.125 },
                        { label: 'LEFT WALL (270°)', x: sw * 0.125, w: sw * 0.25 },
                        { label: 'CROWN / ARCH (000°)', x: sw * 0.375, w: sw * 0.25 },
                        { label: 'RIGHT WALL (090°)', x: sw * 0.625, w: sw * 0.25 },
                        { label: 'R. INVERT', x: sw * 0.875, w: sw * 0.125 },
                      ];
                      const setColors = ['#dc2626', '#0284c7', '#d97706', '#7c3aed', '#059669'];

                      return (
                        <g>
                          <text x={sx + sw / 2} y="20" fontSize="10.5" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                            B. 360° UNROLLED CYLINDRICAL TUNNEL PERIMETER GEOLOGICAL STRIP MAP (RD {chRec?.startChainage?.toFixed(2)}m → {chRec?.endChainage?.toFixed(2)}m)
                          </text>

                          {/* Unrolled Strip Frame */}
                          <rect x={sx} y={sy} width={sw} height={sh} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />

                          {/* Zone Dividers & Headers */}
                          {zones.map((z, idx) => (
                            <g key={z.label}>
                              {idx > 0 && (
                                <line
                                  x1={sx + z.x}
                                  y1={sy}
                                  x2={sx + z.x}
                                  y2={sy + sh}
                                  stroke="#64748b"
                                  strokeWidth="1.2"
                                  strokeDasharray="5 3"
                                />
                              )}
                              <rect
                                x={sx + z.x}
                                y={sy}
                                width={z.w}
                                height="22"
                                fill={z.label.includes('CROWN') ? '#e0f2fe' : '#e2e8f0'}
                                stroke="#0f172a"
                                strokeWidth="1"
                              />
                              <text
                                x={sx + z.x + z.w / 2}
                                y={sy + 14}
                                fontSize="8.5"
                                fontFamily="monospace"
                                fontWeight="bold"
                                textAnchor="middle"
                                fill="#0f172a"
                              >
                                {z.label}
                              </text>
                            </g>
                          ))}

                          {/* Sinusoidal Unrolled Discontinuity Traces Across 360° Cylinder */}
                          {discontinuities.map((d, idx) => {
                            const col = setColors[idx % setColors.length];
                            const amp = Math.min(85, ((d.dipDeg ?? 60) / 90) * 78);
                            const phaseRad = ((d.dipDirectionDeg ?? 135) * Math.PI) / 180;
                            const baseY = sy + 68 + idx * Math.min(48, (sh - 95) / Math.max(1, discontinuities.length));
                            const pts: string[] = [];
                            for (let step = 0; step <= 40; step++) {
                              const t = step / 40;
                              const px = sx + t * sw;
                              const theta = t * 2 * Math.PI + phaseRad;
                              const py = Math.max(sy + 26, Math.min(sy + sh - 8, baseY + Math.sin(theta) * amp));
                              pts.push(`${step === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
                            }
                            const labelX = sx + sw * (0.22 + (idx % 3) * 0.26);
                            const labelY = Math.max(
                              sy + 38,
                              Math.min(
                                sy + sh - 16,
                                baseY + Math.sin((0.22 + (idx % 3) * 0.26) * 2 * Math.PI + phaseRad) * amp
                              )
                            );
                            return (
                              <g key={d.id || idx}>
                                <path
                                  d={pts.join(' ')}
                                  fill="none"
                                  stroke={col}
                                  strokeWidth={d.type === 'FAULT' || d.type === 'SHEAR_ZONE' ? 3 : 2.2}
                                  strokeDasharray={d.type === 'FAULT' ? '8 4' : d.type === 'FOLIATION' ? '4 2' : undefined}
                                />
                                <rect
                                  x={labelX - 58}
                                  y={labelY - 11}
                                  width="116"
                                  height="15"
                                  rx="2"
                                  fill="#ffffff"
                                  fillOpacity="0.9"
                                  stroke={col}
                                  strokeWidth="1"
                                />
                                <text
                                  x={labelX}
                                  y={labelY}
                                  fontSize="8.5"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  fill={col}
                                >
                                  J{d.setNumber || idx + 1}: {d.type} ({d.strikeDeg}°/{d.dipDeg}°)
                                </text>
                              </g>
                            );
                          })}

                          {/* Lithology & Groundwater Footer Annotation inside Unrolled Strip */}
                          <text x={sx + sw / 2} y="326" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                            Lithology: {geo?.mainLithology || 'Hard Rock'} ({geo?.weatheringGrade || 'W1_FRESH'}, UCS {geo?.intactStrengthEstimatedMpa || 95} MPa) · Water Inflow: {gw?.inflowRateLitersPerMin ?? 0} L/min ({gw?.waterInrushRiskLevel || 'SAFE_DRY'})
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* Section 02: Encountered Geology, Discontinuity Sets & Muck Belt Inspection Table */}
            <div className="border-2 border-slate-950 bg-white">
              <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span>
                  02. Encountered Rock Mass Discontinuity Sets &amp; Conveyor Muck Chip Inspection Log
                </span>
                <span className="font-mono text-cyan-300">
                  Observation Mode: {geo?.directVsIndirectObservation || 'DIRECT_FACE'}
                </span>
              </div>

              <table className="w-full text-left text-[10px] font-mono border-collapse">
                <thead className="bg-slate-100 border-b border-slate-950 text-slate-900">
                  <tr>
                    <th className="py-1 px-2 border-r border-slate-300">Set #</th>
                    <th className="py-1 px-2 border-r border-slate-300">Structure Type</th>
                    <th className="py-1 px-2 border-r border-slate-300">Strike / Dip / Dip Dir</th>
                    <th className="py-1 px-2 border-r border-slate-300">Spacing · Aperture</th>
                    <th className="py-1 px-2 border-r border-slate-300">Roughness · Infilling</th>
                    <th className="py-1 px-2">Water · Weathering</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 tabular-nums">
                  {discontinuities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-500 italic">
                        Massive rock mass — no discrete discontinuity sets recorded for this ring.
                      </td>
                    </tr>
                  ) : (
                    discontinuities.map((d, idx) => (
                      <tr key={d.id || idx} className="odd:bg-white even:bg-slate-50/70">
                        <td className="py-1 px-2 border-r border-slate-200 font-bold text-slate-950">
                          J{d.setNumber || idx + 1}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200 font-bold">{d.type}</td>
                        <td className="py-1 px-2 border-r border-slate-200">
                          {d.strikeDeg}° / {d.dipDeg}° / {d.dipDirectionDeg}°
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200">
                          {d.spacingCm} cm · {d.apertureMm} mm
                        </td>
                        <td className="py-1 px-2 border-r border-slate-200">
                          {d.roughness} · {d.infilling}
                        </td>
                        <td className="py-1 px-2">
                          {d.waterCondition} · {d.weathering}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Conveyor Muck Chip Inspection Synthesis Strip */}
              <div className="border-t border-slate-950 bg-slate-50 p-2 grid grid-cols-2 sm:grid-cols-6 gap-2 text-[9.5px] font-mono">
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Muck Material</span>
                  <strong>{muck?.materialType || 'ROCK_CHIPS'}</strong>
                </div>
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Chip Grading</span>
                  <strong>{muck?.gradingDescription || 'WELL_GRADED_CHIPS'}</strong>
                </div>
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Fines / Coarse</span>
                  <strong className="tabular-nums">
                    {muck?.finesPercentEstimated ?? 25}% / {muck?.coarsePercentEstimated ?? 75}%
                  </strong>
                </div>
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Avg / Max Chip</span>
                  <strong className="tabular-nums">
                    {muck?.averageFragmentSizeMm ?? 45}mm / {muck?.maxFragmentSizeMm ?? 110}mm
                  </strong>
                </div>
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Chip Angularity</span>
                  <strong>{muck?.fragmentShapeAngularity || 'ANGULAR'}</strong>
                </div>
                <div>
                  <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">Fault Gouge / Water</span>
                  <strong>
                    {muck?.faultGougeObserved ? 'GOUGE PRESENT' : 'NO GOUGE'} · {muck?.waterContentVisual || 'MOIST'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {totalPages === 1 ? (
            renderOfficialSignOffBlock()
          ) : (
            <div className="border-t border-slate-400 pt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>
                ESWA TBM Mechanized Tunneling Analytical Dossier · Ring #{chRec?.ringNumber ?? 1} (RD{' '}
                {chRec?.startChainage?.toFixed(2)}m)
              </span>
              <span>Continued on Sheet 2 of {totalPages} →</span>
            </div>
          )}
        </div>

        {/* ====================================================================
            PAGE 2: TBM TELEMETRY, CUTTERHEAD TOOL WEAR MAP, GROUT & PROBE LOG
           ==================================================================== */}
        {showPage2 && (
          <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4 print:break-after-page">
            <div className="space-y-3.5">
              {renderIsoTitleBlock(2, '02. TBM BORING TELEMETRY, CUTTER WEAR MAP, GROUT & PROBE LOG')}

              {/* Section 03: TBM Boring Telemetry & Machine Energy Matrix */}
              {sections.tbmTelemetryAndPerformance && (
                <div className="border-2 border-slate-950 bg-white">
                  <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      03. TBM Operating Telemetry: Thrust, Torque, Penetration Rate, FPI &amp; Specific Energy
                    </span>
                    <span className="font-mono text-cyan-300">
                      Boring Duration: {tel?.excavationDurationMin ?? 52} min · Downtime: {tel?.machineDowntimeHours ?? 0} h
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 font-mono">
                    <div className="p-2.5">
                      <div className="text-[8.5px] font-sans font-bold uppercase text-slate-500">
                        Total Thrust Force
                      </div>
                      <div className="text-lg font-black text-slate-950 tabular-nums mt-0.5">
                        {tel?.thrustForceKn ?? 14200} <span className="text-xs font-normal text-slate-600">kN</span>
                      </div>
                      <div className="text-[9px] text-slate-600">
                        {Math.round(((tel?.thrustForceKn ?? 14200) / nominalThrustKn) * 100)}% of Nominal ({nominalThrustKn} kN)
                      </div>
                    </div>

                    <div className="p-2.5">
                      <div className="text-[8.5px] font-sans font-bold uppercase text-slate-500">
                        Cutterhead Torque &amp; RPM
                      </div>
                      <div className="text-lg font-black text-slate-950 tabular-nums mt-0.5">
                        {tel?.cutterheadTorqueKnm ?? 2150}{' '}
                        <span className="text-xs font-normal text-slate-600">kNm</span>
                      </div>
                      <div className="text-[9px] text-slate-600">
                        Speed: <strong>{tel?.cutterheadRpm ?? 4.8} RPM</strong> ({Math.round(((tel?.cutterheadTorqueKnm ?? 2150) / nominalTorqueKnm) * 100)}% Nom.)
                      </div>
                    </div>

                    <div className="p-2.5">
                      <div className="text-[8.5px] font-sans font-bold uppercase text-slate-500">
                        Penetration Rate (PR)
                      </div>
                      <div className="text-lg font-black text-slate-950 tabular-nums mt-0.5">
                        {tel?.penetrationPerRevMm ?? 6.2}{' '}
                        <span className="text-xs font-normal text-slate-600">mm/rev</span>
                      </div>
                      <div className="text-[9px] text-slate-700 font-bold">
                        {tel?.penetrationRateMmMin ?? 29.8} mm/min ({kpi.penetrationRateMH} m/h)
                      </div>
                    </div>

                    <div className="p-2.5 bg-cyan-50/40">
                      <div className="text-[8.5px] font-sans font-bold uppercase text-slate-500">
                        FPI &amp; Specific Energy (SE)
                      </div>
                      <div className="text-lg font-black text-slate-950 tabular-nums mt-0.5">
                        {kpi.fpi} <span className="text-xs font-normal text-slate-600">kN/c/mm</span>
                      </div>
                      <div className="text-[9px] text-slate-700 font-bold">
                        SE: {kpi.specificEnergyMJM3} MJ/m³ ({kpi.fpiStatus})
                      </div>
                    </div>
                  </div>

                  {/* Conditional EPB or Slurry Telemetry Strip */}
                  {(hasEpbData || hasSlurryData) && (
                    <div className="border-t border-slate-300 bg-slate-50 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9.5px] font-mono tabular-nums">
                      {hasEpbData && (
                        <>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              EPB Chamber Pressure (T/C/B)
                            </span>
                            <strong>
                              {tel?.epbChamberPressureTopBar ?? 1.8} / {tel?.epbChamberPressureCenterBar ?? 2.1} /{' '}
                              {tel?.epbChamberPressureBottomBar ?? 2.4} bar
                            </strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Screw Conveyor (RPM / Torque)
                            </span>
                            <strong>
                              {tel?.screwConveyorSpeedRpm ?? 12} RPM · {tel?.screwConveyorTorqueKnm ?? 45} kNm
                            </strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Conditioning (FER / Foam)
                            </span>
                            <strong>
                              FER {tel?.foamExpansionRatio ?? 10} · {tel?.foamInjectionRateLMin ?? 180} L/min
                            </strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Muck Mass (Actual vs. Theo)
                            </span>
                            <strong>
                              {tel?.excavatedWeightTonnesActual ?? 92} t / {tel?.excavatedWeightTonnesTheoretical ?? 90} t
                            </strong>
                          </div>
                        </>
                      )}
                      {hasSlurryData && (
                        <>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Slurry Face Pressure
                            </span>
                            <strong>{tel?.slurryFacePressureBar ?? 2.2} bar</strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Slurry Flow Rate
                            </span>
                            <strong>{tel?.slurryFlowRateM3H ?? 850} m³/h</strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Density (Supply / Return)
                            </span>
                            <strong>
                              {tel?.slurryDensitySupplyGcm3 ?? 1.08} / {tel?.slurryDensityReturnGcm3 ?? 1.24} g/cm³
                            </strong>
                          </div>
                          <div>
                            <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                              Shield Jack / Gripper
                            </span>
                            <strong>
                              Jack {tel?.shieldJackPressureBar ?? 240} bar · Art. {tel?.articulationAngleDeg ?? 0.2}°
                            </strong>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 04: Cutterhead Tool Wear Map, Annular Grout Volume & Probe Hole Log */}
              {sections.cutterWearGroutAndProbe && (
                <>
                  <div className="border-2 border-slate-950 bg-white">
                    <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>
                        04. Cutterhead Tool Wear Radial Profile &amp; Annular Tail-Void Grout Verification
                      </span>
                      <span className="font-mono text-cyan-300">
                        Avg Disc Wear: {tel?.cutterWearMm ?? 3.5} mm · Replaced: {tel?.cuttersReplacedCount ?? 0} Cutters
                      </span>
                    </div>

                    <div className="p-2 bg-white">
                      <svg
                        id="tbm-dossier-wear-grout-svg"
                        viewBox="0 0 860 220"
                        className="w-full h-48 block"
                      >
                        <rect x="0" y="0" width="860" height="220" fill="#ffffff" />

                        {/* LEFT HALF: Radial Cutterhead Disc Wear Track Diagram */}
                        {(() => {
                          const baseWear = Math.max(1, tel?.cutterWearMm || 3.5);
                          const tracks = [
                            { group: 'Center Twin Discs (#1–#4)', wear: Number((baseWear * 0.65).toFixed(1)), limit: 25 },
                            { group: 'Inner Face Discs (#5–#18)', wear: Number((baseWear * 0.85).toFixed(1)), limit: 25 },
                            { group: 'Outer Face Discs (#19–#34)', wear: Number((baseWear * 1.05).toFixed(1)), limit: 25 },
                            { group: 'Gauge / Overcut Discs (#35–#' + cutterCount + ')', wear: Number((baseWear * 1.35).toFixed(1)), limit: 20 },
                          ];

                          return (
                            <g>
                              <text x="210" y="18" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                                A. RADIAL DISC CUTTER WEAR PROFILE ({activeLocation?.discCutterDiameterInches || 17}&quot; DISCS)
                              </text>
                              <rect x="16" y="26" width="395" height="182" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />

                              {tracks.map((t, i) => {
                                const y = 44 + i * 38;
                                const pct = Math.min(100, (t.wear / t.limit) * 100);
                                const barW = (pct / 100) * 240;
                                const barColor = pct >= 80 ? '#dc2626' : pct >= 55 ? '#f59e0b' : '#0284c7';
                                return (
                                  <g key={t.group}>
                                    <text x="26" y={y} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                      {t.group}
                                    </text>
                                    <rect x="26" y={y + 5} width="240" height="13" fill="#e2e8f0" stroke="#475569" strokeWidth="0.8" />
                                    <rect x="26" y={y + 5} width={barW} height="13" fill={barColor} />
                                    <text x="274" y={y + 15} fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                      {t.wear} / {t.limit} mm ({Math.round(pct)}%)
                                    </text>
                                  </g>
                                );
                              })}

                              <text x="26" y="198" fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#334155">
                                Replaced This Ring: {tel?.cuttersReplacedCount ?? 0} Cutters · FPI Wear State: {kpi.fpiStatus}
                              </text>
                            </g>
                          );
                        })()}

                        {/* RIGHT HALF: Annular Grout Volume Actual vs. Theoretical & Segment Ring */}
                        {(() => {
                          const actualM3 = sup?.annularGroutVolumeActualM3 ?? 6.4;
                          const theoM3 = sup?.annularGroutVolumeTheoreticalM3 ?? 6.0;
                          const ratioPct = sup?.groutRatioActualVsTheo ?? Math.round((actualM3 / Math.max(0.1, theoM3)) * 100);
                          const maxM3 = Math.max(10, actualM3 * 1.3, theoM3 * 1.3);
                          const actW = (actualM3 / maxM3) * 260;
                          const theoW = (theoM3 / maxM3) * 260;

                          return (
                            <g>
                              <text x="640" y="18" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#0f172a">
                                B. ANNULAR TAIL-VOID GROUTING &amp; SEGMENT LINING QC
                              </text>
                              <rect x="430" y="26" width="414" height="182" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />

                              <text x="444" y="50" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                Actual Injected Grout Volume: {actualM3.toFixed(2)} m³
                              </text>
                              <rect x="444" y="56" width="260" height="16" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
                              <rect
                                x="444"
                                y="56"
                                width={actW}
                                height="16"
                                fill={ratioPct >= 100 ? '#059669' : '#dc2626'}
                              />
                              <text x="712" y="68" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                Fill Ratio: {ratioPct}%
                              </text>

                              <text x="444" y="94" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#475569">
                                Theoretical Annulus Volume: {theoM3.toFixed(2)} m³
                              </text>
                              <rect x="444" y="100" width="260" height="14" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
                              <rect x="444" y="100" width={theoW} height="14" fill="#64748b" />
                              <text x="712" y="111" fontSize="9" fontFamily="monospace" fill="#475569">
                                Target ≥ 100%
                              </text>

                              <line x1="444" y1="128" x2="830" y2="128" stroke="#cbd5e1" strokeWidth="1" />

                              <text x="444" y="146" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                Injection Pressure: {sup?.groutInjectionPressureBar ?? 2.4} bar · Tail Grease: {sup?.tailSealGreaseConsumptionKg ?? 42} kg
                              </text>
                              <text x="444" y="166" fontSize="9.5" fontFamily="monospace" fontWeight="bold" fill="#0f172a">
                                Ring Type: {sup?.ringTypeUniversal || 'UNIVERSAL'} · Key @ {sup?.keySegmentPositionClock || '12:00'}
                              </text>
                              <text x="444" y="186" fontSize="9" fontFamily="monospace" fill="#334155">
                                Lining Defects: {(sup?.liningDefectsObserved || 'None observed — segments intact').slice(0, 50)}
                              </text>
                            </g>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>

                  {/* Section 05: Probe Hole Drilling Ahead & Groundwater Register */}
                  <div className="border-2 border-slate-950 bg-white">
                    <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>
                        05. Hydrogeological Inflow Register {(!autoHideEmpty || hasProbeData) ? '& Probe Hole Drilling Ahead Log' : ''}
                      </span>
                      <span className="font-mono text-cyan-300">
                        Inflow Risk: {gw?.waterInrushRiskLevel || 'SAFE_DRY'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-[9.5px] font-mono">
                      <div className="p-2">
                        <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                          Groundwater Inflow Rate
                        </span>
                        <strong className="text-slate-950 text-xs tabular-nums">
                          {gw?.inflowRateLitersPerMin ?? 0} L/min ({gw?.waterPressureBar ?? 0} bar)
                        </strong>
                      </div>
                      <div className="p-2">
                        <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                          Ingress Location &amp; Turbidity
                        </span>
                        <strong className="text-slate-950">
                          {gw?.ingressLocation || 'FACE_CUTTERHEAD'} · {gw?.turbidity || 'CLEAR'}
                        </strong>
                      </div>
                      <div className="p-2">
                        <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                          Water Chemistry &amp; Pumps
                        </span>
                        <strong className="text-slate-950 tabular-nums">
                          pH {gw?.phEstimated ?? 7.2} · Active Pumps: {gw?.dewateringPumpsActive ?? 1}
                        </strong>
                      </div>
                      <div className="p-2">
                        <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                          Pre-Grouting Action
                        </span>
                        <strong className="text-slate-950">
                          {gw?.preGroutingActionTaken || 'None Required'}
                        </strong>
                      </div>
                    </div>

                    {(!autoHideEmpty || hasProbeData) && (
                      <div className="border-t border-slate-950 bg-slate-50 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9.5px] font-mono">
                        <div>
                          <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                            Probe Hole ID &amp; Length
                          </span>
                          <strong className="tabular-nums">
                            {probe?.probeHoleId || 'PRB-01'} · {probe?.drilledLengthMeters ?? 24} m ({probe?.drillingMethod || 'PERCUSSIVE_MWD'})
                          </strong>
                        </div>
                        <div>
                          <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                            Drilling Rate &amp; Feed Pressure
                          </span>
                          <strong className="tabular-nums">
                            {probe?.drillingSpeedMMin ?? 1.8} m/min @ {probe?.drillingFeedPressureBar ?? 85} bar ({probe?.flushingWaterReturn || 'FULL_RETURN'})
                          </strong>
                        </div>
                        <div>
                          <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                            Geology Ahead &amp; Cavities
                          </span>
                          <strong>
                            {probe?.geologyLoggedAhead || 'Competent Rock'} · Void: {probe?.cavityOrVoidDetected ? 'DETECTED' : 'NO'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[8px] font-sans font-bold uppercase text-slate-500 block">
                            Advance Recommendation
                          </span>
                          <strong className="text-emerald-900">
                            {probe?.advanceRecommendation || 'PROCEED_NORMAL'}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {totalPages === 2 ? (
              renderOfficialSignOffBlock()
            ) : (
              <div className="border-t border-slate-400 pt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span>
                  ESWA TBM Mechanized Tunneling Analytical Dossier · Ring #{chRec?.ringNumber ?? 1}
                </span>
                <span>Continued on Sheet 3 of {totalPages} →</span>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            PAGE 3: Q-TBM / RMR CORRELATIONS, MULTI-RING TRENDS & SIGN-OFF
           ==================================================================== */}
        {showPage3 && (
          <div className="a4-page w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-950 shadow-2xl p-6 flex flex-col justify-between gap-4 print:shadow-none print:p-4">
            <div className="space-y-3.5">
              {renderIsoTitleBlock(
                totalPages,
                '03. Q-TBM / RMR CORRELATIONS, MULTI-RING LONGITUDINAL TRENDS & SIGN-OFF'
              )}

              {/* Section 06: Q-TBM, Barton Q, RMR89 & Support Class */}
              {sections.qTbmRmrAndSupportClass && (
                <div className="border-2 border-slate-950 bg-white">
                  <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      06. Geomechanical Classification: Barton Q, Q-TBM, Bieniawski RMR89, GSI &amp; Support Class
                    </span>
                    <span className="font-mono text-cyan-300">
                      Em = {rmrProps.deformationModulusEmGpa} GPa · Correlation Confidence: {correlations.confidenceScorePercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-[9.5px] font-mono tabular-nums">
                    {/* Col 1: Barton Q & Q-TBM */}
                    <div className="p-2.5 space-y-1">
                      <div className="font-sans font-black uppercase text-slate-900 border-b border-slate-200 pb-0.5">
                        Barton Q-System &amp; Q-TBM
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">RQD / Jn:</span>
                        <strong>
                          {record.classification?.rqdPercent ?? 75}% / {record.classification?.jn ?? 6}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Jr / Ja:</span>
                        <strong>
                          {record.classification?.jr ?? 2} / {record.classification?.ja ?? 2}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Jw / SRF:</span>
                        <strong>
                          {record.classification?.jw ?? 1} / {record.classification?.srf ?? 1}
                        </strong>
                      </div>
                      <div className="flex justify-between bg-cyan-50 px-1.5 py-0.5 font-black text-slate-950">
                        <span>Barton Q / Q-TBM:</span>
                        <span>
                          Q = {qVal} | Q_TBM = {qtbmVal}
                        </span>
                      </div>
                    </div>

                    {/* Col 2: Bieniawski RMR89 & GSI */}
                    <div className="p-2.5 space-y-1">
                      <div className="font-sans font-black uppercase text-slate-900 border-b border-slate-200 pb-0.5">
                        Bieniawski RMR89 &amp; Hoek GSI
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">UCS + RQD + Spacing:</span>
                        <strong>
                          {record.classification?.rmrStrengthScore ?? 12} + {record.classification?.rmrRqdScore ?? 15} +{' '}
                          {record.classification?.rmrSpacingScore ?? 12}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Condition + Water + Adj:</span>
                        <strong>
                          {record.classification?.rmrConditionScore ?? 20} + {record.classification?.rmrWaterScore ?? 10} (
                          {record.classification?.rmrOrientationAdjustment ?? -5})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Empirical Q→RMR Avg:</span>
                        <strong>
                          {correlations.averageRmr} (Barton {correlations.barton1995}, Bien. {correlations.bieniawski1976})
                        </strong>
                      </div>
                      <div className="flex justify-between bg-emerald-50 px-1.5 py-0.5 font-black text-slate-950">
                        <span>RMR89 / GSI:</span>
                        <span>
                          RMR = {rmrVal} | GSI = {record.classification?.gsiScore || rmrProps.gsiScore}
                        </span>
                      </div>
                    </div>

                    {/* Col 3: Support & Rock Mass Properties */}
                    <div className="p-2.5 space-y-1">
                      <div className="font-sans font-black uppercase text-slate-900 border-b border-slate-200 pb-0.5">
                        Rock Mass Modulus &amp; Support Class
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Deformation Modulus Em:</span>
                        <strong>{rmrProps.deformationModulusEmGpa} GPa</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Cohesion c / Friction φ:</span>
                        <strong>
                          {rmrProps.cohesionKpa} kPa / {rmrProps.frictionAngleDeg}°
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Barton Support Cat:</span>
                        <strong>Cat. {supportDesign.categoryNum}</strong>
                      </div>
                      <div className="text-[8.5px] bg-slate-100 px-1.5 py-0.5 font-bold text-slate-900 truncate">
                        {supportDesign.categoryName}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 07: Multi-Ring Longitudinal Chainage Trend Charts (SVG) */}
              {sections.multiRingLongitudinalTrends && (
                <div className="border-2 border-slate-950 bg-white">
                  <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                      07. Multi-Ring Longitudinal Chainage Trend Charts ({trendRecords.length} Logged Rings)
                    </span>
                    <span className="font-mono text-cyan-300">
                      Thrust · Torque · Penetration Rate · FPI · Rock Mass RMR89
                    </span>
                  </div>

                  <div className="p-2 bg-white">
                    <svg
                      id="tbm-dossier-trends-svg"
                      viewBox="0 0 860 320"
                      className="w-full h-[275px] block"
                    >
                      <rect x="0" y="0" width="860" height="320" fill="#ffffff" />
                      {(() => {
                        const padL = 64;
                        const padR = 32;
                        const cw = 860 - padL - padR;
                        const n = Math.max(1, trendRecords.length);
                        const idxToX = (i: number) =>
                          n === 1 ? padL + cw / 2 : padL + (i / (n - 1)) * cw;

                        const tracks = [
                          {
                            title: 'TRACK A: THRUST FORCE (kN, Blue) & CUTTERHEAD TORQUE (kNm × 5, Amber)',
                            top: 22,
                            h: 72,
                            color1: '#0284c7',
                            color2: '#d97706',
                            vals1: trendRecords.map((r) => r.telemetry?.thrustForceKn || 14000),
                            vals2: trendRecords.map((r) => (r.telemetry?.cutterheadTorqueKnm || 2100) * 5),
                            unit: 'kN',
                          },
                          {
                            title: 'TRACK B: PENETRATION RATE (mm/min, Emerald) & FIELD PENETRATION INDEX (FPI, Rose)',
                            top: 120,
                            h: 72,
                            color1: '#059669',
                            color2: '#e11d48',
                            vals1: trendRecords.map((r) => r.telemetry?.penetrationRateMmMin || 28),
                            vals2: trendRecords.map((r) => {
                              const k = calculateTbmKpi(r.telemetry, cutterheadDiaM, cutterCount);
                              return k.fpi;
                            }),
                            unit: 'mm/m',
                          },
                          {
                            title: 'TRACK C: BIENIAWSKI RMR89 (0–100, Purple) & WATER INFLOW (L/min, Cyan)',
                            top: 218,
                            h: 72,
                            color1: '#7c3aed',
                            color2: '#0891b2',
                            vals1: trendRecords.map((r) => r.classification?.calculatedRmr || 58),
                            vals2: trendRecords.map((r) => r.groundwater?.inflowRateLitersPerMin || 0),
                            unit: 'RMR',
                          },
                        ];

                        return (
                          <>
                            {tracks.map((tr) => {
                              const maxV = Math.max(...tr.vals1, ...tr.vals2, 10) * 1.15;
                              const vToY = (v: number) => tr.top + tr.h - (Math.max(0, v) / maxV) * tr.h;
                              const path1 = tr.vals1
                                .map((v, i) => `${i === 0 ? 'M' : 'L'} ${idxToX(i).toFixed(1)} ${vToY(v).toFixed(1)}`)
                                .join(' ');
                              const path2 = tr.vals2
                                .map((v, i) => `${i === 0 ? 'M' : 'L'} ${idxToX(i).toFixed(1)} ${vToY(v).toFixed(1)}`)
                                .join(' ');

                              return (
                                <g key={tr.title}>
                                  <text x={padL} y={tr.top - 5} fontSize="9" fontWeight="bold" fill="#0f172a">
                                    {tr.title}
                                  </text>
                                  <rect
                                    x={padL}
                                    y={tr.top}
                                    width={cw}
                                    height={tr.h}
                                    fill="#f8fafc"
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />
                                  <line
                                    x1={padL}
                                    y1={tr.top + tr.h / 2}
                                    x2={padL + cw}
                                    y2={tr.top + tr.h / 2}
                                    stroke="#cbd5e1"
                                    strokeWidth="0.8"
                                    strokeDasharray="3 3"
                                  />
                                  <text x={padL - 6} y={tr.top + 9} fontSize="8.5" fontFamily="monospace" textAnchor="end" fill="#334155">
                                    {Math.round(maxV)}
                                  </text>
                                  <text x={padL - 6} y={tr.top + tr.h} fontSize="8.5" fontFamily="monospace" textAnchor="end" fill="#334155">
                                    0
                                  </text>

                                  {n > 1 && (
                                    <>
                                      <path d={path1} fill="none" stroke={tr.color1} strokeWidth="2.2" />
                                      <path d={path2} fill="none" stroke={tr.color2} strokeWidth="1.8" strokeDasharray="5 3" />
                                    </>
                                  )}

                                  {tr.vals1.map((v, i) => (
                                    <circle
                                      key={`p1-${i}`}
                                      cx={idxToX(i)}
                                      cy={vToY(v)}
                                      r={trendRecords[i].id === record.id ? 4.5 : 3}
                                      fill={tr.color1}
                                      stroke="#ffffff"
                                      strokeWidth="1"
                                    />
                                  ))}
                                  {tr.vals2.map((v, i) => (
                                    <circle
                                      key={`p2-${i}`}
                                      cx={idxToX(i)}
                                      cy={vToY(v)}
                                      r="2.5"
                                      fill={tr.color2}
                                    />
                                  ))}
                                </g>
                              );
                            })}

                            {/* Ring Number & Chainage X-Axis Ticks */}
                            {trendRecords.map((r, i) => {
                              const step = Math.max(1, Math.floor(trendRecords.length / 8));
                              if (i % step !== 0 && i !== trendRecords.length - 1) return null;
                              const px = idxToX(i);
                              return (
                                <g key={r.id || i}>
                                  <line x1={px} y1="290" x2={px} y2="296" stroke="#0f172a" strokeWidth="1.2" />
                                  <text
                                    x={px}
                                    y="309"
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fill="#0f172a"
                                  >
                                    R#{r.chainageRecord?.ringNumber ?? i + 1} ({r.chainageRecord?.startChainage?.toFixed(0)}m)
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}

              {/* Optional Geological Hazards Table (Auto-hidden when empty and autoHideEmpty is ON) */}
              {(!autoHideEmpty || hazards.length > 0) && (
                <div className="border-2 border-slate-950 bg-white">
                  <div className="bg-slate-950 text-white px-3 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span>Geological Hazards &amp; Mitigation Log</span>
                    <span className="font-mono text-amber-300">{hazards.length} Events</span>
                  </div>
                  {hazards.length === 0 ? (
                    <div className="p-2 text-[9.5px] font-mono text-slate-500 italic text-center">
                      No geological hazard incidents recorded on this ring.
                    </div>
                  ) : (
                    <table className="w-full text-left text-[9.5px] font-mono border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-950">
                        <tr>
                          <th className="py-1 px-2 border-r border-slate-300">Hazard Category</th>
                          <th className="py-1 px-2 border-r border-slate-300">Severity / Status</th>
                          <th className="py-1 px-2 border-r border-slate-300">Impact on TBM</th>
                          <th className="py-1 px-2">Mitigation Action Taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {hazards.map((h) => (
                          <tr key={h.hazardId}>
                            <td className="py-1 px-2 border-r border-slate-200 font-bold">{h.hazardCategory}</td>
                            <td className="py-1 px-2 border-r border-slate-200 font-bold">
                              {h.severity} ({h.status})
                            </td>
                            <td className="py-1 px-2 border-r border-slate-200">{h.impactOnTbm}</td>
                            <td className="py-1 px-2">{h.actionTaken}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
