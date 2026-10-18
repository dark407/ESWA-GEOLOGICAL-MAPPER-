import {
  GsiParameters,
  Joint,
  JointSet,
  OverbreakUndercutAnalysis,
  ParameterInputStatus,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  SurveyControlPoint,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  calculateBieniawskiRmr,
  calculateHoekGsi,
  evaluateQSystemWithValidation,
} from './rockMassClassificationEngine';
import { computeRockStrataSupportSpotBoltingAndFailureFos } from './supportSpotBoltFailureEngine';

export interface PdfWordExportPayload {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  qIndexParams: QIndexParameters;
  qParamStatus?: Record<QSystemParamKey, ParameterInputStatus>;
  rmrParams?: RmrParameters;
  gsiParams?: GsiParameters;
  selectedMethod?: RockMassClassificationMethodId;
  rockMassSummary: RockMassSummaryTable;
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  controlPoints?: SurveyControlPoint[];
  /** Optional SVG markup of the Engineering Sheet if exporting directly from EngineeringSheetModal */
  svgString?: string | null;
  sheetWidthPx?: number;
  sheetHeightPx?: number;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Builds a valid standalone multi-page binary PDF-1.4 file from an array of JPEG page canvases.
 * Zero external dependencies — works 100% offline in browser, Electron, and Android APK.
 */
function buildPdfFromJpegPages(
  pages: {
    jpegBytes: Uint8Array;
    widthPx: number;
    heightPx: number;
    pagePtW: number;
    pagePtH: number;
  }[]
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed object byte offsets
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.byteLength;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.byteLength;
  };

  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  // Header with binary comment
  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(3 + i * 3);
  }

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${
      pages.length
    } >>`
  );
  endObj();

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    const contentStream = `q\n${p.pagePtW.toFixed(2)} 0 0 ${p.pagePtH.toFixed(
      2
    )} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);

    // Page object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pagePtW.toFixed(2)} ${p.pagePtH.toFixed(
        2
      )}] /Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content stream object
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream`);
    endObj();

    // Image XObject (DCTDecode = JPEG)
    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  }

  const totalObjs = 2 + pages.length * 3;
  const xrefOffset = currentOffset;
  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    const offStr = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${offStr} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

/**
 * Renders an SVG string to an HTMLCanvasElement at 1.75x resolution.
 */
async function renderSvgStringToCanvas(
  svgString: string,
  widthPx: number,
  heightPx: number
): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(widthPx * 1.75);
        canvas.height = Math.round(heightPx * 1.75);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Renders a crisp high-resolution Engineering Data & Classification Summary Canvas page
 * (used as Page 1 when exporting from Data Sheets, or Page 2 appendix when exporting with SVG sheet).
 */
function renderEngineeringSummaryCanvasPage(payload: PdfWordExportPayload): HTMLCanvasElement {
  const {
    geometry,
    settings,
    joints,
    jointSets,
    qIndexParams,
    qParamStatus,
    rmrParams,
    gsiParams,
    rockMassSummary,
    overbreakAnalysis,
  } = payload;

  const qRes = evaluateQSystemWithValidation(qIndexParams, geometry.width, qParamStatus);
  const rmrRes = rmrParams ? calculateBieniawskiRmr(rmrParams) : null;
  const gsiRes = gsiParams ? calculateHoekGsi(gsiParams) : null;
  const supportFos = computeRockStrataSupportSpotBoltingAndFailureFos(
    geometry,
    settings,
    joints,
    jointSets,
    qIndexParams,
    rmrParams,
    rockMassSummary,
    overbreakAnalysis
  );

  const W = 1754; // A4/A3 Landscape 150+ DPI
  const H = 1240;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // White engineering paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Outer engineering border
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, 34, W - 68, H - 68);

  // Header Banner
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(34, 34, W - 68, 86);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 25px monospace';
  ctx.fillText('ESWA GEOLOGICAL MAPPER — GEOLOGICAL & ROCK MASS ENGINEERING DATA SHEET', 56, 74);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '15px monospace';
  ctx.fillText(
    `Project: ${settings.projectName || 'Tunnel Project'}   |   Location: ${
      settings.locationName || settings.tunnelName
    }   |   Chainage: ${settings.faceChainage || settings.chainage}   |   Pull: ${
      settings.roundLength
    }m   |   Drive: N ${Math.round(settings.driveDirection)}° E`,
    56,
    104
  );

  // Section 1: Tunnel Geometry & Rock Mass Classification Summary Boxes
  let y = 144;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(50, y, W - 100, 92);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(50, y, W - 100, 92);

  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('1. MASTER TUNNEL GEOMETRY & ROCK MASS CLASSIFICATION SUMMARY', 66, y + 26);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px monospace';
  const qText = qRes.isComplete ? `${qRes.qValue} (${qRes.rockMassClass})` : 'Incomplete';
  const rmrText = rmrRes ? `${rmrRes.finalRmr} (${rmrRes.rockMassClassLabel})` : 'N/A';
  const gsiText =
    gsiRes?.gsiValue != null ? `${gsiRes.gsiValue} (${gsiRes.rockMassClassLabel || 'GSI'})` : 'N/A';

  ctx.fillText(
    `Shape: ${geometry.width.toFixed(2)}m W × ${geometry.height.toFixed(
      2
    )}m H (Wall ${geometry.wallHeight.toFixed(2)}m, Crown Arc ${geometry.crownArcLength.toFixed(
      2
    )}m)   |   Mapped Traces: ${joints.length}   |   Joint Sets: ${jointSets.length}`,
    66,
    y + 52
  );
  ctx.fillText(
    `Barton Q-Index: ${qText}   |   Bieniawski RMR: ${rmrText}   |   Hoek-Brown GSI: ${gsiText}   |   Strata FoS: ${supportFos.strataFactorOfSafety.toFixed(
      2
    )}`,
    66,
    y + 78
  );

  // Section 2: Discontinuity Set Engineering Table
  y += 112;
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('2. DISCONTINUITY-SET ENGINEERING TABLE (ISRM / BARTON / BIENIAWSKI)', 50, y);
  y += 12;

  const cols = [
    { label: 'SET', w: 70 },
    { label: 'TRACES', w: 80 },
    { label: 'DIP DIR (°)', w: 120 },
    { label: 'DIP (°)', w: 100 },
    { label: 'STRIKE (°)', w: 120 },
    { label: 'SPACING', w: 190 },
    { label: 'PERSISTENCE', w: 190 },
    { label: 'ROUGHNESS', w: 240 },
    { label: 'INFILLING', w: 220 },
    { label: 'WATER', w: 180 },
    { label: 'WEATHERING', w: 144 },
  ];

  // Table Header
  let x = 50;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(50, y, W - 100, 32);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px monospace';
  for (const col of cols) {
    ctx.fillText(col.label, x + 8, y + 21);
    x += col.w;
  }
  y += 32;

  const setsToRender = jointSets.slice(0, 7);
  if (setsToRender.length === 0) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(50, y, W - 100, 34);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(50, y, W - 100, 34);
    ctx.fillStyle = '#64748B';
    ctx.font = '14px monospace';
    ctx.fillText('No discontinuity sets mapped yet.', 64, y + 22);
    y += 34;
  } else {
    setsToRender.forEach((s, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(50, y, W - 100, 30);
      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(50, y, W - 100, 30);
      ctx.fillStyle = '#0F172A';
      ctx.font = '13px monospace';
      const vals = [
        s.id,
        String(s.jointCount ?? 0),
        `${Math.round(s.avgDipDirection ?? 0)}°`,
        `${Math.round(s.avgDip ?? 0)}°`,
        `${Math.round(s.avgStrike ?? 0)}°`,
        s.spacing.slice(0, 22),
        s.persistence.slice(0, 22),
        s.roughness.slice(0, 28),
        s.infilling.slice(0, 24),
        (s.water || 'Dry').slice(0, 20),
        (s.aperture || 'Tight').slice(0, 16),
      ];
      let cx = 50;
      vals.forEach((v, i) => {
        ctx.fillText(v, cx + 8, y + 20);
        cx += cols[i].w;
      });
      y += 30;
    });
  }

  // Section 3: Rock Mass Log & Support System
  y += 28;
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('3. ROCK MASS LOG, RECOMMENDED SUPPORT SYSTEM & SPOT BOLTING', 50, y);
  y += 12;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(50, y, W - 100, 150);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(50, y, W - 100, 150);

  ctx.fillStyle = '#0F172A';
  ctx.font = '14px monospace';
  ctx.fillText(`• Lithology / Rock Type : ${rockMassSummary.rockType}`, 66, y + 28);
  ctx.fillText(
    `• Weathering & Strength : ${rockMassSummary.weatheringGrade}   |   UCS: ${rockMassSummary.strengthGrade}`,
    66,
    y + 54
  );
  ctx.fillText(
    `• Groundwater & Stability: ${rockMassSummary.groundwaterCondition}   |   ${rockMassSummary.overbreakCondition}`,
    66,
    y + 80
  );
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(
    `• Support Category      : ${supportFos.recommendedSupportCategory} (Systematic Bolts L=${supportFos.systematicBoltLengthM}m @ ${supportFos.systematicBoltSpacingM}m c/c + SFRS ${supportFos.shotcreteThicknessMm}mm + ${supportFos.totalSpotBoltsRequired} Spot Bolts)`,
    66,
    y + 108
  );
  ctx.fillStyle = '#0F172A';
  ctx.font = '14px monospace';
  ctx.fillText(
    `• Geologist Remarks     : ${
      rockMassSummary.geologistRemarks || 'Mapped in accordance with ISRM standards.'
    }`,
    66,
    y + 134
  );

  // Section 4: Individual Mapped Structural Traces (up to 10 rows)
  y += 178;
  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(
    `4. MAPPED STRUCTURAL DISCONTINUITY TRACES (${joints.length} Total Traces)`,
    50,
    y
  );
  y += 12;

  const traceCols = [
    { label: '#', w: 60 },
    { label: 'SURFACE', w: 160 },
    { label: 'SET', w: 90 },
    { label: 'FEATURE TYPE', w: 200 },
    { label: 'DIP DIR (°)', w: 160 },
    { label: 'DIP (°)', w: 140 },
    { label: 'STRIKE (°)', w: 160 },
    { label: 'LENGTH (m)', w: 160 },
    { label: 'WATER', w: 200 },
    { label: 'METHOD', w: 324 },
  ];

  let tx = 50;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(50, y, W - 100, 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px monospace';
  for (const c of traceCols) {
    ctx.fillText(c.label, tx + 8, y + 20);
    tx += c.w;
  }
  y += 30;

  const maxTraces = Math.min(joints.length, 10);
  for (let i = 0; i < maxTraces; i++) {
    const j = joints[i];
    ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(50, y, W - 100, 26);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(50, y, W - 100, 26);
    ctx.fillStyle = '#0F172A';
    ctx.font = '12.5px monospace';
    const rowVals = [
      String(i + 1),
      j.surface.toUpperCase(),
      j.set,
      j.featureType.replace(/_/g, ' ').toUpperCase(),
      `${j.dipDirection.toFixed(1)}°`,
      `${j.dip.toFixed(1)}°`,
      `${j.strike.toFixed(1)}°`,
      `${(j.persistenceMeters || 0).toFixed(2)} m`,
      j.waterCondition || 'Dry',
      j.orientationStatus || '3D Registered',
    ];
    let rcx = 50;
    rowVals.forEach((rv, idx) => {
      ctx.fillText(rv, rcx + 8, y + 18);
      rcx += traceCols[idx].w;
    });
    y += 26;
  }

  if (overbreakAnalysis?.hasValidSurveyProfile) {
    ctx.fillStyle = '#B91C1C';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `SURVEY OVERBREAK SUMMARY: Design Area = ${overbreakAnalysis.designAreaSqMeters.toFixed(
        2
      )} m² | Excavated Area = ${overbreakAnalysis.surveyedAreaSqMeters.toFixed(
        2
      )} m² | Overbreak = ${overbreakAnalysis.overbreakAreaSqMeters.toFixed(
        2
      )} m² (${overbreakAnalysis.overbreakPercent.toFixed(
        1
      )}%) | Pull Volume = ${(overbreakAnalysis.overbreakVolumeCubicMeters ?? 0).toFixed(2)} m³`,
      50,
      H - 48
    );
  }

  return canvas;
}

/**
 * Generates and downloads a real standalone binary `.pdf` Engineering Sheet & Data Report.
 */
export async function downloadEngineeringSheetAsPDF(payload: PdfWordExportPayload): Promise<void> {
  const pages: {
    jpegBytes: Uint8Array;
    widthPx: number;
    heightPx: number;
    pagePtW: number;
    pagePtH: number;
  }[] = [];

  // Page 1: Mapped Geological Engineering Drawing Sheet (if SVG is provided)
  if (payload.svgString) {
    const wPx = payload.sheetWidthPx || 1600;
    const hPx = payload.sheetHeightPx || 1130;
    const svgCanvas = await renderSvgStringToCanvas(payload.svgString, wPx, hPx);
    if (svgCanvas) {
      const jpegDataUrl = svgCanvas.toDataURL('image/jpeg', 0.92);
      const b64 = jpegDataUrl.split(',')[1] || '';
      if (b64) {
        const aspect = svgCanvas.width / Math.max(1, svgCanvas.height);
        const pagePtW = 1190.55; // A3 Landscape width in points
        const pagePtH = Number((pagePtW / aspect).toFixed(2));
        pages.push({
          jpegBytes: base64ToUint8Array(b64),
          widthPx: svgCanvas.width,
          heightPx: svgCanvas.height,
          pagePtW,
          pagePtH,
        });
      }
    }
  }

  // Page 2 (or Page 1 if exported directly from Data Sheets): Engineering Data Tables & Classification Sheet
  const summaryCanvas = renderEngineeringSummaryCanvasPage(payload);
  const summaryJpegUrl = summaryCanvas.toDataURL('image/jpeg', 0.92);
  const summaryB64 = summaryJpegUrl.split(',')[1] || '';
  if (summaryB64) {
    pages.push({
      jpegBytes: base64ToUint8Array(summaryB64),
      widthPx: summaryCanvas.width,
      heightPx: summaryCanvas.height,
      pagePtW: 1190.55,
      pagePtH: 841.89,
    });
  }

  const pdfBlob = buildPdfFromJpegPages(pages);
  const safeTunnel = (payload.settings.tunnelName || 'Tunnel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCh = (payload.settings.faceChainage || payload.settings.chainage || 'Station').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  triggerBlobDownload(pdfBlob, `${safeTunnel}_${safeCh}_Geological_Mapping_Sheet.pdf`);
}

/**
 * Generates and downloads a rich Microsoft Word (`.doc`) Engineering Report & Data Sheet
 * with embedded high-resolution Mapping Sheet image and full editable Word tables.
 */
export async function downloadEngineeringSheetAsWordDoc(
  payload: PdfWordExportPayload
): Promise<void> {
  const {
    geometry,
    settings,
    joints,
    jointSets,
    qIndexParams,
    qParamStatus,
    rmrParams,
    gsiParams,
    rockMassSummary,
    overbreakAnalysis,
  } = payload;

  const qRes = evaluateQSystemWithValidation(qIndexParams, geometry.width, qParamStatus);
  const rmrRes = rmrParams ? calculateBieniawskiRmr(rmrParams) : null;
  const gsiRes = gsiParams ? calculateHoekGsi(gsiParams) : null;
  const supportFos = computeRockStrataSupportSpotBoltingAndFailureFos(
    geometry,
    settings,
    joints,
    jointSets,
    qIndexParams,
    rmrParams,
    rockMassSummary,
    overbreakAnalysis
  );

  let embeddedDrawingImgHtml = '';
  if (payload.svgString) {
    const wPx = payload.sheetWidthPx || 1600;
    const hPx = payload.sheetHeightPx || 1130;
    const svgCanvas = await renderSvgStringToCanvas(payload.svgString, wPx, hPx);
    if (svgCanvas) {
      const pngDataUrl = svgCanvas.toDataURL('image/png');
      embeddedDrawingImgHtml = `
        <h2>1. Developed Geological Mapping Sheet &amp; Tunnel Face Drawing</h2>
        <div style="text-align:center; margin: 10px 0 18px 0;">
          <img src="${pngDataUrl}" style="max-width:100%; width:980px; height:auto; border:1.5pt solid #0f172a;" alt="Geological Mapping Sheet" />
        </div>
      `;
    }
  }

  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>ESWA Geological Mapper — Geological &amp; Rock Mass Engineering Report</title>
<style>
  @page { size: 29.7cm 21.0cm; margin: 1.5cm; mso-page-orientation: landscape; }
  body { font-family: 'Calibri', 'Arial', sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.35; }
  h1 { font-size: 16pt; color: #0f172a; border-bottom: 2pt solid #0284c7; padding-bottom: 4pt; margin-bottom: 8pt; }
  h2 { font-size: 12.5pt; color: #0369a1; margin-top: 14pt; margin-bottom: 6pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 9.5pt; }
  th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left; padding: 5pt 6pt; border: 1pt solid #334155; }
  td { padding: 4.5pt 6pt; border: 1pt solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) td { background-color: #f8fafc; }
  .badge { font-weight: bold; color: #0369a1; }
</style>
</head>
<body>
  <h1>ESWA GEOLOGICAL MAPPER — GEOLOGICAL MAPPING &amp; ROCK MASS CLASSIFICATION REPORT</h1>

  <table>
    <tr>
      <th>Project Name</th>
      <td><strong>${settings.projectName || 'Tunnel Project'}</strong></td>
      <th>Location / Heading</th>
      <td><strong>${settings.locationName || settings.tunnelName}</strong></td>
      <th>Face Chainage</th>
      <td><strong>${settings.faceChainage || settings.chainage}</strong></td>
    </tr>
    <tr>
      <th>Round / Pull Length</th>
      <td>${settings.roundLength.toFixed(2)} m (${settings.chainage})</td>
      <th>Drive Direction</th>
      <td>N ${Math.round(settings.driveDirection)}° E</td>
      <th>Master Tunnel Shape</th>
      <td>${geometry.width.toFixed(2)}m W × ${geometry.height.toFixed(
    2
  )}m H (Wall ${geometry.wallHeight.toFixed(2)}m, Crown Arc ${geometry.crownArcLength.toFixed(
    2
  )}m)</td>
    </tr>
    <tr>
      <th>Barton Q-Index (NGI)</th>
      <td class="badge">${
        qRes.isComplete ? `Q = ${qRes.qValue} (${qRes.rockMassClass})` : 'Pending'
      }</td>
      <th>Bieniawski RMR</th>
      <td class="badge">${rmrRes ? `RMR = ${rmrRes.finalRmr} (${rmrRes.rockMassClassLabel})` : 'N/A'}</td>
      <th>Hoek-Brown GSI</th>
      <td class="badge">${
        gsiRes?.gsiValue != null ? `GSI = ${gsiRes.gsiValue} (${gsiRes.rockMassClassLabel || 'GSI'})` : 'N/A'
      }</td>
    </tr>
    <tr>
      <th>Recommended Support</th>
      <td colspan="3"><strong>${
        supportFos.recommendedSupportCategory
      }</strong> — Systematic Bolts L=${supportFos.systematicBoltLengthM}m @ ${
    supportFos.systematicBoltSpacingM
  }m c/c, SFRS=${supportFos.shotcreteThicknessMm}mm, Spot Bolts=${
    supportFos.totalSpotBoltsRequired
  }</td>
      <th>Strata FoS / Mapped By</th>
      <td>FoS = <strong>${supportFos.strataFactorOfSafety.toFixed(2)}</strong> · ${
    settings.mappedBy || 'Engineering Geologist'
  }</td>
    </tr>
  </table>

  ${embeddedDrawingImgHtml}

  <h2>2. Discontinuity-Set Engineering Table (ISRM / Barton / Bieniawski)</h2>
  <table>
    <thead>
      <tr>
        <th>Set ID</th>
        <th>Traces</th>
        <th>Dip Dir (°)</th>
        <th>Dip (°)</th>
        <th>Strike (°)</th>
        <th>Spacing</th>
        <th>Persistence</th>
        <th>Roughness</th>
        <th>Infilling</th>
        <th>Water</th>
        <th>Weathering</th>
      </tr>
    </thead>
    <tbody>
      ${
        jointSets.length === 0
          ? `<tr><td colspan="11">No discontinuity sets recorded yet.</td></tr>`
          : jointSets
              .map(
                (s) => `<tr>
            <td><strong>${s.id}</strong></td>
            <td>${s.jointCount ?? 0}</td>
            <td>${Math.round(s.avgDipDirection ?? 0)}°</td>
            <td>${Math.round(s.avgDip ?? 0)}°</td>
            <td>${Math.round(s.avgStrike ?? 0)}°</td>
            <td>${s.spacing}</td>
            <td>${s.persistence}</td>
            <td>${s.roughness}</td>
            <td>${s.infilling}</td>
            <td>${s.water || 'Dry'}</td>
            <td>${s.aperture || 'Tight'}</td>
          </tr>`
              )
              .join('')
      }
    </tbody>
  </table>

  <h2>3. Rock Mass Log, Lithology, Weathering &amp; Support Summary</h2>
  <table>
    <tr>
      <th>Rock Type / Lithology</th>
      <td>${rockMassSummary.rockType}</td>
      <th>Weathering Grade (ISRM)</th>
      <td>${rockMassSummary.weatheringGrade}</td>
    </tr>
    <tr>
      <th>Intact Rock Strength (UCS)</th>
      <td>${rockMassSummary.strengthGrade}</td>
      <th>Groundwater / Inflow</th>
      <td>${rockMassSummary.groundwaterCondition}</td>
    </tr>
    <tr>
      <th>Overbreak / Stability Condition</th>
      <td>${rockMassSummary.overbreakCondition}</td>
      <th>Installed / Designed Support</th>
      <td>${rockMassSummary.installedSupport}</td>
    </tr>
    <tr>
      <th>Barton Q Parameters</th>
      <td colspan="3">RQD = ${qIndexParams.rqd}% · Jn = ${qIndexParams.jn} · Jr = ${
    qIndexParams.jr
  } · Ja = ${qIndexParams.ja} · Jw = ${qIndexParams.jw} · SRF = ${
    qIndexParams.srf
  } → <strong>Q = ${qRes.qValue ?? 'N/A'}</strong></td>
    </tr>
    <tr>
      <th>Engineering Geologist Remarks</th>
      <td colspan="3">${rockMassSummary.geologistRemarks}</td>
    </tr>
  </table>

  ${
    overbreakAnalysis?.hasValidSurveyProfile
      ? `
  <h2>4. Survey Cross-Section Overbreak &amp; Undercut Quantities</h2>
  <table>
    <tr>
      <th>Design Area</th>
      <td>${overbreakAnalysis.designAreaSqMeters.toFixed(2)} m²</td>
      <th>Excavated Area</th>
      <td>${overbreakAnalysis.surveyedAreaSqMeters.toFixed(2)} m²</td>
      <th>Overbreak Area (%)</th>
      <td><strong>${overbreakAnalysis.overbreakAreaSqMeters.toFixed(
        2
      )} m² (${overbreakAnalysis.overbreakPercent.toFixed(1)}%)</strong></td>
      <th>Overbreak Volume (Pull)</th>
      <td><strong>${(overbreakAnalysis.overbreakVolumeCubicMeters ?? 0).toFixed(2)} m³</strong></td>
    </tr>
  </table>`
      : ''
  }

  <h2>5. Individual Mapped Structural Traces Log (${joints.length} Vectors)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Surface</th>
        <th>Set</th>
        <th>Feature Type</th>
        <th>Dip Dir (°)</th>
        <th>Dip (°)</th>
        <th>Strike (°)</th>
        <th>Persistence (m)</th>
        <th>Water Condition</th>
        <th>3D Method</th>
      </tr>
    </thead>
    <tbody>
      ${
        joints.length === 0
          ? `<tr><td colspan="10">No structural traces mapped yet.</td></tr>`
          : joints
              .map(
                (j, idx) => `<tr>
            <td>${idx + 1}</td>
            <td>${j.surface.toUpperCase()}</td>
            <td><strong>${j.set}</strong></td>
            <td>${j.featureType.replace(/_/g, ' ').toUpperCase()}</td>
            <td>${j.dipDirection.toFixed(1)}°</td>
            <td>${j.dip.toFixed(1)}°</td>
            <td>${j.strike.toFixed(1)}°</td>
            <td>${(j.persistenceMeters || 0).toFixed(2)} m</td>
            <td>${j.waterCondition || 'Dry'}</td>
            <td>${j.orientationStatus || '3D Registered'}</td>
          </tr>`
              )
              .join('')
      }
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordHtml], {
    type: 'application/msword;charset=utf-8',
  });
  const safeTunnel = (settings.tunnelName || 'Tunnel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCh = (settings.faceChainage || settings.chainage || 'Station').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  triggerBlobDownload(blob, `${safeTunnel}_${safeCh}_Geological_Mapping_Report.doc`);
}
