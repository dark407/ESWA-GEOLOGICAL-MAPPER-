import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  Compass,
  Download,
  Edit,
  Edit2,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileUp,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  Percent,
  Printer,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Split,
  Table,
  Upload,
  UploadCloud,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  ContinuousTunnelStripDataset,
  createPowerTunnelReferenceDataset,
  exportContinuousStripToDXF,
  resolveStripTraceColor,
  runAiTrendAlignmentOnDataset,
  saveAllContinuousStripDatasets,
} from '../engine/continuous3DStripEngine';
import {
  loadUploadedReferenceReport,
  saveUploadedReferenceReport,
  clearUploadedReferenceReport,
  getSampleBenchmarkReport,
  UploadedReferenceReport,
} from '../engine/referenceReportStore';
import { EswaCadContinuousStripModal } from './EswaCadContinuousStripModal';

export interface A3ContinuousTunnelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ContinuousTunnelStripDataset;
  onUpdateDataset: (updated: ContinuousTunnelStripDataset) => void;
  initialCadOpen?: boolean;
  userDeviceId?: string;
  userEmail?: string;
}

export type A3ViewMode = 'generated' | 'uploaded' | 'split' | 'overlay';
export type CustomizerStep = 'titleBlock' | 'geometry' | 'columns' | 'pulls' | 'theme';

export const A3ContinuousTunnelLogModal: React.FC<A3ContinuousTunnelLogModalProps> = ({
  isOpen,
  onClose,
  dataset: initialDataset,
  onUpdateDataset,
  initialCadOpen = false,
  userDeviceId = 'ESWA-LOCAL',
  userEmail = '',
}) => {
  const [dataset, setDataset] = useState<ContinuousTunnelStripDataset>(initialDataset);

  // Sync state if initialDataset changes
  useEffect(() => {
    setDataset(initialDataset);
  }, [initialDataset]);

  // CAD Modal state - opens immediately if initialCadOpen is set
  const [isCadModalOpen, setIsCadModalOpen] = useState<boolean>(Boolean(initialCadOpen));

  useEffect(() => {
    if (initialCadOpen) {
      setIsCadModalOpen(true);
    }
  }, [initialCadOpen]);

  // Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewerDeviceIdInput, setReviewerDeviceIdInput] = useState<string>('');
  const [reviewerNameInput, setReviewerNameInput] = useState<string>('');
  const [submissionNotesInput, setSubmissionNotesInput] = useState<string>('');
  const [reviewSubmittedSuccess, setReviewSubmittedSuccess] = useState<boolean>(false);

  // Zoom scale for A3 sheet view
  const [sheetZoom, setSheetZoom] = useState<number>(1.0);

  // Step-by-Step Customizer Drawer
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [customizerStep, setCustomizerStep] = useState<CustomizerStep>('titleBlock');

  // Blueprint / Presentation Style: 'nhpc_standard' | 'cad_monochrome' | 'eswa_color'
  const [presentationTheme, setPresentationTheme] = useState<'nhpc_standard' | 'cad_monochrome' | 'eswa_color'>(
    'nhpc_standard'
  );

  // Column visibility toggles
  const [visibleColumns, setVisibleColumns] = useState({
    chainage: true,
    date: true,
    round: true,
    lithology: true,
    weathering: true,
    ucs: true,
    joints: true,
    water: true,
    rmrQ: true,
    rqd: true,
    support: true,
    overbreak: true,
    convergence: true,
    photo: true,
    remarks: true,
  });

  // Bounds & Geometry
  const fromRd = dataset.viewFromRd ?? 250;
  const toRd = dataset.viewToRd ?? 300;
  const totalLengthM = Math.max(1, toRd - fromRd);

  const leftWallHeight = dataset.leftWallHeightM || dataset.leftWallArcLengthM || 4.5;
  const crownWidth = dataset.crownWidthM || dataset.crownArcLengthM || 9.0;
  const rightWallHeight = dataset.rightWallHeightM || dataset.rightWallArcLengthM || 4.5;
  const totalPerimeterM = leftWallHeight + crownWidth + rightWallHeight;

  // Active pulls (use dataset pulls or fallback to power tunnel template pulls so template is never empty)
  const displayPulls = useMemo(() => {
    if (dataset.pulls && dataset.pulls.length > 0) {
      return dataset.pulls;
    }
    // Fallback to Power Tunnel pulls
    return createPowerTunnelReferenceDataset().pulls;
  }, [dataset.pulls]);

  // Save changes from CAD back to state & memory
  const handleCadSave = (updated: ContinuousTunnelStripDataset) => {
    setDataset(updated);
    onUpdateDataset(updated);
  };

  // Run AI Trend Alignment
  const handleAiAlign = () => {
    const aligned = runAiTrendAlignmentOnDataset(dataset);
    setDataset(aligned.updatedDataset);
    onUpdateDataset(aligned.updatedDataset);
  };

  // Export DXF
  const handleExportDxf = () => {
    try {
      const dxfContent = exportContinuousStripToDXF(dataset);
      const blob = new Blob([dxfContent], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.projectName || 'Tunnel'}_Continuous_Log_CH${fromRd}-${toRd}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DXF export error:', err);
    }
  };

  // Print / A3 Landscape PDF Export
  const handlePrintA3 = () => {
    window.print();
  };

  // Submit for Review
  const handleSubmitForReview = () => {
    const updated: ContinuousTunnelStripDataset = {
      ...dataset,
      reviewStatus: 'SUBMITTED_FOR_REVIEW',
      submittedAt: new Date().toISOString(),
      reviewerDeviceId: reviewerDeviceIdInput || 'ESWA-REVIEWER-HEAD',
      reviewerName: reviewerNameInput || 'Lead Geotechnical Engineer',
      reviewerNotes: submissionNotesInput,
      updatedAt: new Date().toISOString(),
    };

    setDataset(updated);
    onUpdateDataset(updated);
    setReviewSubmittedSuccess(true);
    setTimeout(() => {
      setReviewSubmittedSuccess(false);
      setIsReviewModalOpen(false);
    }, 1500);
  };

  // Update a single property on dataset
  const updateDatasetProp = (key: keyof ContinuousTunnelStripDataset, val: any) => {
    const updated = { ...dataset, [key]: val, updatedAt: new Date().toISOString() };
    setDataset(updated);
    onUpdateDataset(updated);
  };

  // Update pull property
  const updatePullProp = (pullIdx: number, prop: string, val: any) => {
    const updatedPulls = [...(dataset.pulls || [])];
    if (updatedPulls[pullIdx]) {
      updatedPulls[pullIdx] = { ...updatedPulls[pullIdx], [prop]: val };
      const updated = { ...dataset, pulls: updatedPulls, updatedAt: new Date().toISOString() };
      setDataset(updated);
      onUpdateDataset(updated);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9992] flex flex-col bg-stone-950 text-stone-100 overflow-hidden animate-in fade-in duration-200">
        {/* Top Control Header Bar */}
        <div className="h-14 bg-stone-900 border-b border-stone-800 px-4 flex items-center justify-between shrink-0 shadow-lg print:hidden gap-3">
          {/* Left: Info */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                A3 Continuous Tunnel Log Window
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  CH {fromRd.toFixed(1)}m – {toRd.toFixed(1)}m
                </span>
                {dataset.reviewStatus && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      dataset.reviewStatus === 'APPROVED'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : dataset.reviewStatus === 'SUBMITTED_FOR_REVIEW'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-stone-800 text-stone-300 border-stone-700'
                    }`}
                  >
                    {dataset.reviewStatus === 'SUBMITTED_FOR_REVIEW' ? 'Under Review' : dataset.reviewStatus}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-stone-400 truncate max-w-xs sm:max-w-md">
                {dataset.projectName || 'Project'} • {dataset.tunnelLocationName || 'Tunnel Heading'}
              </p>
            </div>
          </div>

          {/* Center: Sheet Zoom & Scale Info */}
          <div className="flex items-center gap-2 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800 text-xs">
            <span className="font-semibold text-stone-300 hidden sm:inline">A3 Technical Drawing</span>
            <div className="flex items-center gap-1 border-l border-stone-800 pl-2">
              <button
                type="button"
                onClick={() => setSheetZoom(1.0)}
                className="px-2 py-0.5 rounded font-mono text-[11px] text-stone-200 hover:text-white bg-stone-900 border border-stone-800 cursor-pointer"
                title="Mouse Wheel / 2-Finger Pinch to Zoom. Click to reset to 100%."
              >
                {Math.round(sheetZoom * 100)}% (1:1)
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Step-by-Step Customizer Button */}
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                isCustomizerOpen
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
              }`}
              title="Open step-by-step customizer to adjust title block, bands, and formatting"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Step-by-Step Edit</span>
            </button>

            {/* Edit Canvas -> Opens ESWA CAD */}
            <button
              type="button"
              onClick={() => setIsCadModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-600/25 transition cursor-pointer"
              title="Open ESWA CAD to edit the continuous strip canvas, move joints, add discontinuities, and lithology"
            >
              <Edit3 className="w-3.5 h-3.5 text-white" />
              <span>Edit Canvas (ESWA CAD)</span>
            </button>

            {/* Print / Export A3 PDF */}
            <button
              type="button"
              onClick={handlePrintA3}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-600/20 transition cursor-pointer"
              title="Export high-resolution A3 Landscape PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export A3 PDF</span>
            </button>

            {/* Export DXF */}
            <button
              type="button"
              onClick={handleExportDxf}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Export AutoCAD DXF"
            >
              <FileCode2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer ml-1"
              title="Close Window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body Area: Exact Engineering A3 Landscape Drawing Sheet (Replicating User's Attached PDF) */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-stone-950 flex flex-col items-center">
            {/* True A3 Landscape Sheet Canvas (420mm × 297mm ratio, 1400px width) */}
            <div
              style={{
                transform: `scale(${sheetZoom})`,
              transformOrigin: 'top center',
              marginBottom: `${(sheetZoom - 1) * 980}px`,
            }}
            className="w-[1400px] min-w-[1400px] bg-white text-stone-950 p-5 rounded-none shadow-2xl border-4 border-stone-950 flex flex-col font-sans transition-transform duration-150 print:m-0 print:p-2 print:shadow-none print:w-full print:border-none"
          >
            {/* Standard Engineering Margin Border */}
            <div className="border-2 border-stone-950 p-2 sm:p-2.5 flex flex-col bg-white">
              {/* SECTION 1: Header Engineering Title Block (Compact Engineering Fonts) */}
              <div className="border-2 border-stone-950 mb-2">
                <div className="grid grid-cols-12 divide-x-2 divide-stone-950 text-xs">
                  {/* Left: Client & Project Info */}
                  <div className="col-span-8 p-2 flex flex-col justify-between bg-stone-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[8px] font-bold text-stone-500 uppercase tracking-widest block">
                          PROJECT / CLIENT
                        </span>
                        <h2 className="text-sm font-black tracking-tight text-stone-950 uppercase leading-snug">
                          {dataset.projectName || 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT'}
                        </h2>
                        <span className="text-[9.5px] font-bold text-stone-700 block mt-0.5">
                          EMPLOYER / CLIENT: {dataset.clientName || 'NEPAL ELECTRICITY AUTHORITY'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-bold text-stone-500 uppercase tracking-wider block">
                          SCALE (H &amp; V)
                        </span>
                        <span className="text-xs font-black font-mono">1 : 100</span>
                      </div>
                    </div>

                    <div className="mt-1.5 grid grid-cols-3 gap-2 text-[9.5px] pt-1 border-t border-stone-300">
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold block uppercase">TUNNEL / HEADING:</span>
                        <strong className="text-stone-950 text-[10px] font-bold">{dataset.tunnelLocationName || 'POWER TUNNEL (HRT)'}</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold block uppercase">CHAINAGE SCOPE:</span>
                        <strong className="text-stone-950 font-mono text-[10px] font-bold">
                          CH {fromRd.toFixed(2)} m TO CH {toRd.toFixed(2)} m
                        </strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold block uppercase">TOTAL ADVANCE:</span>
                        <strong className="text-stone-950 font-mono text-[10px] font-bold">
                          {totalLengthM.toFixed(2)} m
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Right: Technical QA / Drawing Info */}
                  <div className="col-span-4 p-2 text-[9.5px] flex flex-col justify-between bg-stone-100">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold uppercase block">DRAWING NO:</span>
                        <strong className="text-stone-950 font-mono text-[10px]">PT-GEO-AB-01</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold uppercase block">STATUS / REV:</span>
                        <strong className="text-orange-700 font-bold font-mono text-[10px]">REV 0 ({dataset.reviewStatus || 'AS BUILT'})</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold uppercase block">MAPPED BY:</span>
                        <strong className="text-stone-950 text-[9.5px] truncate block">{dataset.geologistContractor || 'B. R. Mahtee'}</strong>
                      </div>
                      <div>
                        <span className="text-[7.5px] text-stone-500 font-bold uppercase block">CHECKED BY:</span>
                        <strong className="text-stone-950 text-[9.5px] truncate block">{dataset.geologistClient || 'Dr. Gunasekara'}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-900 text-white px-3 py-1 text-center font-black text-[10px] tracking-widest uppercase flex items-center justify-between">
                  <span>GEOLOGICAL &quot;AS BUILT&quot; CONTINUOUS TUNNEL LOG &amp; SUPPORT REPORT</span>
                  <span className="font-mono text-[9px] text-orange-300 font-normal">
                    DRIVE DIRECTION: 160°N • GRADIENT: +0.166%
                  </span>
                </div>
              </div>

              {/* SECTION 2: Continuous Unrolled Geological Profile (Holds ~45% of Total Vertical Sheet Space) */}
              <div className="border-2 border-stone-950 mb-2 bg-white shadow-xs">
                <div className="flex border-b-2 border-stone-950">
                  {/* Left Label Header matching Parameter Table Column below (Width 220px) */}
                  <div className="w-[220px] min-w-[220px] p-2 bg-stone-100 border-r-2 border-stone-950 flex flex-col justify-between text-[8.5px] font-bold text-stone-800">
                    <div>
                      <span className="block text-[11px] font-black uppercase text-stone-900 tracking-wider">
                        UNROLLED PROFILE
                      </span>
                      <span className="text-[8px] text-stone-600 block mt-0.5">
                        VIEWED FROM INSIDE LOOKING TO FACE
                      </span>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-orange-100 border border-orange-300 text-orange-800 font-mono text-[7.5px] font-bold">
                        Scale 1:100 H &amp; V
                      </span>
                    </div>

                    <div className="space-y-2 text-[8px] font-mono text-stone-700 py-3 border-y border-stone-300">
                      <div>
                        <span className="text-stone-500 block text-[7px] uppercase">Left Springline:</span>
                        <strong className="text-stone-900 text-[8.5px]">{dataset.leftCornerAzimuthLabel || '340°N'}</strong>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[7px] uppercase">Crown Arch:</span>
                        <strong className="text-stone-900 text-[8.5px]">CL (Centerline)</strong>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[7px] uppercase">Right Springline:</span>
                        <strong className="text-stone-900 text-[8.5px]">{dataset.rightCornerAzimuthLabel || '160°N'}</strong>
                      </div>
                      <div className="text-stone-600 font-sans pt-1 border-t border-stone-200">
                        Perimeter: <strong>{totalPerimeterM.toFixed(2)}m</strong>
                      </div>
                    </div>

                    <div className="text-[7.5px] text-stone-500 leading-snug">
                      Discontinuities, lithology &amp; support elements projected onto unfolded tunnel perimeter.
                    </div>
                  </div>

                  {/* Strip Canvas (Width 1140px, Height 470px - Occupies near 45% of Sheet Space) */}
                  <div className="w-[1140px] min-w-[1140px] bg-white overflow-hidden relative">
                    <svg
                      width={1140}
                      height={470}
                      className="bg-white block"
                    >
                      <defs>
                        <pattern id="qtzPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                          <circle cx="3" cy="3" r="1.2" fill="#d97706" />
                          <circle cx="8" cy="8" r="1.2" fill="#d97706" />
                        </pattern>
                        <pattern id="phPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="10" x2="10" y2="0" stroke="#0284c7" strokeWidth="1" />
                        </pattern>
                        <pattern id="grPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                          <path d="M 3 6 L 9 6 M 6 3 L 6 9" stroke="#dc2626" strokeWidth="1" />
                        </pattern>
                        <pattern id="veinPattern" width="14" height="14" patternUnits="userSpaceOnUse">
                          <text x="2" y="11" fontSize="10" fontWeight="bold" fill="#b45309">+</text>
                        </pattern>
                      </defs>

                      {/* Strip Background Frame: Top Y=24, Height=410 */}
                      <rect
                        x={0}
                        y={24}
                        width={1140}
                        height={410}
                        fill="#fafaf9"
                        stroke="#292524"
                        strokeWidth="1.8"
                      />

                      {/* Spring Line Division Guides across 410px height */}
                      {(() => {
                        const stripH = 410;
                        const spg1Y = 24 + (leftWallHeight / totalPerimeterM) * stripH;
                        const spg2Y = 24 + ((leftWallHeight + crownWidth) / totalPerimeterM) * stripH;

                        return (
                          <>
                            <line x1={0} y1={spg1Y} x2={1140} y2={spg1Y} stroke="#78716c" strokeDasharray="5 4" strokeWidth="1.2" />
                            <line x1={0} y1={spg2Y} x2={1140} y2={spg2Y} stroke="#78716c" strokeDasharray="5 4" strokeWidth="1.2" />
                            <text x={10} y={24 + (spg1Y - 24) / 2 + 4} fill="#57534e" fontSize="9.5" fontWeight="bold" fontFamily="sans-serif">
                              LEFT WALL ({leftWallHeight.toFixed(1)}m)
                            </text>
                            <text x={10} y={spg1Y + (spg2Y - spg1Y) / 2 + 4} fill="#57534e" fontSize="9.5" fontWeight="bold" fontFamily="sans-serif">
                              CROWN ARCH ({crownWidth.toFixed(1)}m)
                            </text>
                            <text x={10} y={spg2Y + (434 - spg2Y) / 2 + 4} fill="#57534e" fontSize="9.5" fontWeight="bold" fontFamily="sans-serif">
                              RIGHT WALL ({rightWallHeight.toFixed(1)}m)
                            </text>
                          </>
                        );
                      })()}

                      {/* Chainage Grid Lines & Labels */}
                      {(() => {
                        const lines = [];
                        const stepM = 1;

                        for (let ch = Math.ceil(fromRd); ch <= toRd; ch += stepM) {
                          const posX = ((ch - fromRd) / totalLengthM) * 1140;
                          const isMajor = ch % 5 === 0;

                          lines.push(
                            <g key={`ch-grid-${ch}`}>
                              <line
                                x1={posX}
                                y1={24}
                                x2={posX}
                                y2={434}
                                stroke={isMajor ? '#a8a29e' : '#e7e5e4'}
                                strokeWidth={isMajor ? 1.4 : 0.6}
                              />
                              {isMajor && (
                                <>
                                  <line x1={posX} y1={16} x2={posX} y2={24} stroke="#1c1917" strokeWidth="1.5" />
                                  <line x1={posX} y1={434} x2={posX} y2={442} stroke="#1c1917" strokeWidth="1.5" />
                                  <text x={posX} y={14} fill="#1c1917" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                                    {ch}m
                                  </text>
                                  <text x={posX} y={456} fill="#1c1917" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                                    {ch}m
                                  </text>
                                </>
                              )}
                            </g>
                          );
                        }
                        return lines;
                      })()}

                      {/* Lithology Zones */}
                      {(dataset.lithologyZones || []).map((zone) => {
                        if (!zone.polygon || zone.polygon.length < 3) return null;
                        const ptsStr = zone.polygon
                          .map((p) => {
                            const x = ((p.x - fromRd) / totalLengthM) * 1140;
                            const y = 24 + (p.y / totalPerimeterM) * 410;
                            return `${x},${y}`;
                          })
                          .join(' ');

                        return (
                          <polygon
                            key={zone.id}
                            points={ptsStr}
                            fill={
                              zone.rockType === 'Quartz veins' || zone.codeSymbol === '+ + +'
                                ? 'url(#veinPattern)'
                                : zone.rockType === 'Phyllite' || zone.codeSymbol === 'Ph'
                                ? 'url(#phPattern)'
                                : 'url(#qtzPattern)'
                            }
                            stroke="#b45309"
                            strokeWidth="1.2"
                            opacity="0.85"
                          />
                        );
                      })}

                      {/* Joint Discontinuities & Traces */}
                      {(dataset.traces || []).map((trace) => {
                        const pts = trace.points || [];
                        if (pts.length < 2) return null;

                        const dStr = pts
                          .map((p, i) => {
                            const x = ((p.x - fromRd) / totalLengthM) * 1140;
                            const y = 24 + (p.y / totalPerimeterM) * 410;
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          })
                          .join(' ');

                        const color = resolveStripTraceColor(trace);
                        const midPt = pts[Math.floor(pts.length / 2)];
                        const tagX = ((midPt.x - fromRd) / totalLengthM) * 1140;
                        const tagY = 24 + (midPt.y / totalPerimeterM) * 410;

                        return (
                          <g key={trace.id}>
                            <path
                              d={dStr}
                              stroke={color}
                              strokeWidth={trace.structureType === 'Shear Zone' ? 3.5 : 2.5}
                              strokeDasharray={trace.structureType === 'Shear Zone' ? '8 4' : 'none'}
                              fill="none"
                            />
                            {/* Joint Vertex dots */}
                            {pts.map((pt, pIdx) => {
                              const px = ((pt.x - fromRd) / totalLengthM) * 1140;
                              const py = 24 + (pt.y / totalPerimeterM) * 410;
                              return (
                                <circle key={pIdx} cx={px} cy={py} r={2} fill={color} />
                              );
                            })}
                            {trace.orientationLabel && (
                              <g transform={`translate(${tagX}, ${tagY - 5})`}>
                                <rect x={-16} y={-9} width={32} height={12} fill="#ffffff" stroke={color} strokeWidth="1" rx={2} />
                                <text
                                  x={0}
                                  y={-0.5}
                                  fill="#1c1917"
                                  fontSize="8"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                  textAnchor="middle"
                                >
                                  {trace.orientationLabel}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}

                      {/* Groundwater Seepage Symbols */}
                      {(dataset.waterSymbols || []).map((sym) => {
                        const x = ((sym.position.x - fromRd) / totalLengthM) * 1140;
                        const y = 24 + (sym.position.y / totalPerimeterM) * 410;

                        return (
                          <g key={sym.id}>
                            <circle cx={x} cy={y} r={5.5} fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
                            <text x={x} y={y + 3} fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                              W
                            </text>
                            {sym.label && (
                              <text x={x + 8} y={y + 3} fill="#0369a1" fontSize="8" fontWeight="bold">
                                {sym.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Tabular Parameter Bands Aligned Horizontally per Pull (Matching PDF Template) */}
              <div className="border-2 border-stone-950 mb-2 overflow-hidden">
                <table className="w-full border-collapse table-fixed text-[7.5px] leading-tight">
                  <thead>
                    <tr className="bg-stone-900 text-white font-bold divide-x divide-stone-700">
                      <th className="w-[220px] p-1 text-left uppercase tracking-wider text-[8px]">
                        ENGINEERING PARAMETERS
                      </th>
                      {displayPulls.map((pull, idx) => (
                        <th
                          key={pull.id || idx}
                          style={{
                            width: `${((pull.toRd - pull.fromRd) / totalLengthM) * 100}%`,
                          }}
                          className="p-1 text-center font-mono text-[7.5px]"
                        >
                          CH {pull.fromRd} – {pull.toRd}m
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-stone-950 text-stone-900">
                    {/* Row 1: Excavation Date */}
                    {visibleColumns.date && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          DATE OF EXCAVATION
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-semibold">
                            {pull.excavationDate || pull.dateMapped || '18/3/03'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 2: Excavation Defining No. */}
                    {visibleColumns.round && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          EXCAVATION DEFINING NO.
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold">
                            {pull.excavationDefiningNo || '2'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 3: Lithology / Rock Type */}
                    {visibleColumns.lithology && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          LITHOLOGY / ROCK TYPE
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-[7.5px] leading-tight">
                            <span className="font-bold text-stone-950 block">{pull.rockType || 'Quartzite'}</span>
                            <span className="text-stone-600 line-clamp-2">{pull.rockDescription || 'Medium grained quartzite.'}</span>
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 4: Weathering */}
                    {visibleColumns.weathering && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          DEGREE OF WEATHERING
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold">
                            {pull.weatheringCondition || 'W2'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 5: Compressive Strength UCS */}
                    {visibleColumns.ucs && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          COMPRESSIVE STRENGTH (UCS)
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center text-[7.5px] font-semibold">
                            {pull.ucsRangeMpa || '156.20 MPa'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 6: Discontinuities & Structural Features */}
                    {visibleColumns.joints && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          DISCONTINUITIES / JOINTS
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-[7.5px] leading-tight text-stone-800">
                            {pull.structureDescription || 'Fractured, blocky.'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 7: Groundwater / Seepage */}
                    {visibleColumns.water && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          GROUNDWATER / SEEPAGE
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold text-stone-800">
                            {pull.seepageCondition || 'DRY'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 8: RMR & Class */}
                    {visibleColumns.rmrQ && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          ROCK MASS RATING (RMR)
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono">
                            <span className="font-black text-stone-950 block">{pull.rmrValue ?? 61}</span>
                            <span className="text-[7px] font-sans font-bold text-emerald-800">Class {pull.rockClass || 'II'}</span>
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 9: RQD % */}
                    {visibleColumns.rqd && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          ROCK QUALITY DESIGNATION (RQD)
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold">
                            {pull.rqdValue ?? 74}%
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 10: Installed Support */}
                    {visibleColumns.support && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          INSTALLED SUPPORT
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-[7.5px] leading-tight text-stone-800 space-y-0.5">
                            <div><strong className="text-stone-950">Shot:</strong> {pull.shotcreteInstalled || '10cm'}</div>
                            <div><strong className="text-stone-950">Mesh:</strong> {pull.wireMeshInstalled || '3kg/m²'}</div>
                            <div><strong className="text-stone-950">Bolt:</strong> {pull.rockBoltsInstalled || '60/3m'}</div>
                            <div><strong className="text-stone-950">Rib:</strong> {pull.steelRibsInstalled || '-'}</div>
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 11: Overbreak Volume */}
                    {visibleColumns.overbreak && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          OVERBREAK (m³)
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold">
                            {pull.overbreakVolumeM3 ? `${pull.overbreakVolumeM3} m³` : '0'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 12: Convergence */}
                    {visibleColumns.convergence && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          CONVERGENCE (mm)
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono font-bold">
                            {pull.convergenceMm || '0 mm'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 13: Photographic Record */}
                    {visibleColumns.photo && (
                      <tr className="divide-x divide-stone-400 bg-stone-50">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          PHOTOGRAPHIC RECORD
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-center font-mono text-[7px]">
                            {pull.photoRollNo ? `R:${pull.photoRollNo} N:${pull.photoNegativeNo || '-'}` : '-'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Row 14: Remarks */}
                    {visibleColumns.remarks && (
                      <tr className="divide-x divide-stone-400 bg-white">
                        <td className="p-1 font-bold text-stone-900 uppercase bg-stone-100 text-[8px]">
                          GEOLOGIST REMARKS
                        </td>
                        {displayPulls.map((pull, idx) => (
                          <td key={idx} className="p-1 text-[7.5px] leading-tight text-stone-700">
                            {pull.remarks || 'Crown arch stable. No water seepage.'}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* SECTION 4: Engineering Legends & Title Sign-off Block (Bottom Row - Compact Typography) */}
              <div className="grid grid-cols-12 border-2 border-stone-950 divide-x-2 divide-stone-950 text-[8px] leading-tight">
                {/* Left (Col Span 4): Symbols & Legend */}
                <div className="col-span-4 p-2 bg-stone-50 space-y-1">
                  <span className="font-black text-stone-900 uppercase block tracking-wider text-[8.5px] border-b border-stone-300 pb-0.5">
                    SYMBOLS &amp; GEOLOGICAL LEGEND
                  </span>
                  <div className="space-y-0.5 text-[7.5px] text-stone-800">
                    <div>
                      <strong className="text-stone-950">LITHOLOGY:</strong> Qtz: Quartzite • Ph: Phyllite • PQ: Phyllitic Quartzite • +++: Quartz Veins
                    </div>
                    <div>
                      <strong className="text-stone-950">DISCONTINUITIES:</strong> JS1: Foliation • JS2: Main Joint • JS3: Joint Set 3 • SJ: Shear Joint
                    </div>
                    <div>
                      <strong className="text-stone-950">SEEPAGE:</strong> Dry • Damp • Wet • Dripping • Flowing
                    </div>
                    <div>
                      <strong className="text-stone-950">SUPPORT:</strong> SFRCS: Steel Fibre Shotcrete • RB: Rock Bolts • HEB: Steel Ribs
                    </div>
                  </div>
                </div>

                {/* Center (Col Span 4): Engineering Notes */}
                <div className="col-span-4 p-2 bg-white space-y-0.5">
                  <span className="font-black text-stone-900 uppercase block tracking-wider text-[8.5px] border-b border-stone-300 pb-0.5">
                    GENERAL NOTES &amp; CONVENTIONS
                  </span>
                  <ol className="list-decimal list-inside text-[7.5px] text-stone-700 space-y-0.5">
                    <li>Representative joints are shown in map, numbers limited by scale (1:100).</li>
                    <li>Information from daily tunnel mapping/face maps used as basis.</li>
                    <li>Projection done as viewed from inside tunnel looking towards heading.</li>
                    <li>&quot;-&quot; represents convergence and &quot;+&quot; represents divergence.</li>
                    <li>Steel ribs used in Power Tunnel is HEB-120.</li>
                  </ol>
                </div>

                {/* Right (Col Span 4): Official As-Built Title Block */}
                <div className="col-span-4 p-2 bg-stone-100 flex flex-col justify-between">
                  <div className="space-y-0.5 border-b border-stone-300 pb-1">
                    <span className="text-[7px] font-bold text-stone-500 uppercase block">CONTRACTOR &amp; CONSULTANT</span>
                    <p className="text-[8.5px] font-bold text-stone-950 uppercase leading-snug">
                      {dataset.contractorName || 'DYWIDAG — DRAGADOS — CWE JOINT VENTURE'}
                    </p>
                    <p className="text-[7.5px] text-stone-600">
                      CONSULTING ENGINEER: FICHTNER JOINT VENTURE (FJV)
                    </p>
                  </div>

                  <div className="pt-1 grid grid-cols-3 gap-1 text-center text-[7.5px]">
                    <div className="border border-stone-300 p-0.5 bg-white">
                      <span className="text-[6.5px] text-stone-500 block uppercase">MAPPED</span>
                      <strong className="text-stone-900 block truncate">{dataset.geologistContractor || 'B. R. Mahtee'}</strong>
                    </div>
                    <div className="border border-stone-300 p-0.5 bg-white">
                      <span className="text-[6.5px] text-stone-500 block uppercase">CHECKED</span>
                      <strong className="text-stone-900 block truncate">{dataset.geologistClient || 'Dr. Gunasekara'}</strong>
                    </div>
                    <div className="border border-stone-300 p-0.5 bg-white">
                      <span className="text-[6.5px] text-stone-500 block uppercase">APPROVED</span>
                      <strong className="text-stone-900 block truncate">Resident Eng.</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* STEP-BY-STEP REPORT CUSTOMIZER DRAWER */}
          {isCustomizerOpen && (
            <div className="w-96 bg-stone-900 border-l border-stone-800 flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Customizer Header */}
              <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-400" />
                  <h3 className="font-bold text-white text-sm">
                    Step-by-Step Report Customizer
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomizerOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step Navigation Tabs */}
              <div className="grid grid-cols-5 bg-stone-950/80 border-b border-stone-800 text-[10px] font-bold text-stone-400">
                <button
                  type="button"
                  onClick={() => setCustomizerStep('titleBlock')}
                  className={`py-2 text-center border-b-2 transition ${
                    customizerStep === 'titleBlock'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                      : 'border-transparent hover:text-stone-200'
                  }`}
                >
                  1. Header
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizerStep('geometry')}
                  className={`py-2 text-center border-b-2 transition ${
                    customizerStep === 'geometry'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                      : 'border-transparent hover:text-stone-200'
                  }`}
                >
                  2. Geometry
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizerStep('columns')}
                  className={`py-2 text-center border-b-2 transition ${
                    customizerStep === 'columns'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                      : 'border-transparent hover:text-stone-200'
                  }`}
                >
                  3. Bands
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizerStep('pulls')}
                  className={`py-2 text-center border-b-2 transition ${
                    customizerStep === 'pulls'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                      : 'border-transparent hover:text-stone-200'
                  }`}
                >
                  4. Pulls
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizerStep('theme')}
                  className={`py-2 text-center border-b-2 transition ${
                    customizerStep === 'theme'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                      : 'border-transparent hover:text-stone-200'
                  }`}
                >
                  5. Style
                </button>
              </div>

              {/* Step Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* STEP 1: TITLE BLOCK & HEADER */}
                {customizerStep === 'titleBlock' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-stone-400">
                      Edit Title Block details to match your project's engineering contract standard.
                    </p>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Project Name:</label>
                      <input
                        type="text"
                        value={dataset.projectName || ''}
                        onChange={(e) => updateDatasetProp('projectName', e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Location / Tunnel Heading:</label>
                      <input
                        type="text"
                        value={dataset.tunnelLocationName || ''}
                        onChange={(e) => updateDatasetProp('tunnelLocationName', e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Client / Employer:</label>
                      <input
                        type="text"
                        value={dataset.clientName || 'NHPC LIMITED'}
                        onChange={(e) => updateDatasetProp('clientName', e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Contractor Name:</label>
                      <input
                        type="text"
                        value={dataset.contractorName || 'M/s Patel - Gammon JV'}
                        onChange={(e) => updateDatasetProp('contractorName', e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-300">Logged By:</label>
                        <input
                          type="text"
                          value={dataset.geologistContractor || ''}
                          onChange={(e) => updateDatasetProp('geologistContractor', e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-300">Checked By:</label>
                        <input
                          type="text"
                          value={dataset.geologistClient || ''}
                          onChange={(e) => updateDatasetProp('geologistClient', e.target.value)}
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-medium focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: TUNNEL GEOMETRY */}
                {customizerStep === 'geometry' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-stone-400">
                      Configure tunnel dimensions for the unrolled perimeter strip.
                    </p>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Left Wall Height (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={leftWallHeight}
                        onChange={(e) => updateDatasetProp('leftWallHeightM', parseFloat(e.target.value) || 3.75)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-mono focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Crown Arch Width (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={crownWidth}
                        onChange={(e) => updateDatasetProp('crownWidthM', parseFloat(e.target.value) || 7.5)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-mono focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-300">Right Wall Height (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rightWallHeight}
                        onChange={(e) => updateDatasetProp('rightWallHeightM', parseFloat(e.target.value) || 3.75)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-mono focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-1">
                      <span className="text-[11px] font-bold text-orange-400">Total Unrolled Perimeter:</span>
                      <p className="font-mono text-sm font-bold text-white">{totalPerimeterM.toFixed(2)} meters</p>
                    </div>
                  </div>
                )}

                {/* STEP 3: TABULAR COLUMNS / BANDS */}
                {customizerStep === 'columns' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-stone-400">
                      Toggle columns to match your site's standard table layout.
                    </p>

                    <div className="space-y-2">
                      {Object.entries({
                        date: 'Excavation Date',
                        round: 'Excavation Defining No. / Round',
                        lithology: 'Lithology & Rock Type',
                        weathering: 'Degree of Weathering',
                        ucs: 'Compressive Strength (UCS)',
                        joints: 'Discontinuities / Joint Sets',
                        water: 'Groundwater / Seepage',
                        rmrQ: 'RMR & Rock Class',
                        rqd: 'Rock Quality Designation (RQD %)',
                        support: 'Installed Ground Support',
                        overbreak: 'Overbreak Volume (m³)',
                        convergence: 'Convergence (mm)',
                        photo: 'Photographic Record',
                        remarks: 'Geologist Remarks',
                      }).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between p-2 rounded-lg bg-stone-950 border border-stone-800 hover:border-stone-700 cursor-pointer"
                        >
                          <span className="text-xs text-stone-300 font-medium">{label}</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns[key as keyof typeof visibleColumns]}
                            onChange={(e) =>
                              setVisibleColumns({
                                ...visibleColumns,
                                [key]: e.target.checked,
                              })
                            }
                            className="rounded accent-orange-500 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 4: PULL RECORDS QUICK EDIT */}
                {customizerStep === 'pulls' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-stone-400">
                      Quickly edit the geological parameters for each advance pull.
                    </p>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {(dataset.pulls || []).map((pull, idx) => (
                        <div
                          key={pull.id || idx}
                          className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <strong className="text-orange-400 font-bold">
                              Pull #{idx + 1} (CH {pull.fromRd}m – {pull.toRd}m)
                            </strong>
                            <span className="font-mono text-[10px] text-stone-500">
                              {(pull.toRd - pull.fromRd).toFixed(1)}m advance
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <span className="text-[10px] text-stone-400 block">Rock Type:</span>
                              <input
                                type="text"
                                value={pull.rockType || ''}
                                onChange={(e) => updatePullProp(idx, 'rockType', e.target.value)}
                                className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white text-xs"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 block">Class:</span>
                              <input
                                type="text"
                                value={pull.rockClass || ''}
                                onChange={(e) => updatePullProp(idx, 'rockClass', e.target.value)}
                                className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white text-xs"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 block">Q-Value:</span>
                              <input
                                type="number"
                                step="0.1"
                                value={pull.qValue ?? 7.5}
                                onChange={(e) => updatePullProp(idx, 'qValue', parseFloat(e.target.value) || 0)}
                                className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white text-xs font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 block">RMR:</span>
                              <input
                                type="number"
                                value={pull.rmrValue ?? 60}
                                onChange={(e) => updatePullProp(idx, 'rmrValue', parseInt(e.target.value) || 0)}
                                className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-stone-400 block">Support Installed:</span>
                            <input
                              type="text"
                              value={pull.supportDescription || pull.shotcreteInstalled || ''}
                              onChange={(e) => updatePullProp(idx, 'supportDescription', e.target.value)}
                              className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 5: STYLE & THEME */}
                {customizerStep === 'theme' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-stone-400">
                      Choose professional presentation styling template.
                    </p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setPresentationTheme('nhpc_standard')}
                        className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${
                          presentationTheme === 'nhpc_standard'
                            ? 'bg-orange-950/40 border-orange-500 text-white'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-xs font-bold">Official NHPC As-Built Standard</strong>
                          {presentationTheme === 'nhpc_standard' && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <p className="text-[11px] text-stone-400">
                          Hydroelectric technical drawing standard with clean double-line borders and high-contrast tables.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPresentationTheme('cad_monochrome')}
                        className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${
                          presentationTheme === 'cad_monochrome'
                            ? 'bg-orange-950/40 border-orange-500 text-white'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-xs font-bold">AutoCAD Monochrome Blueprint</strong>
                          {presentationTheme === 'cad_monochrome' && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <p className="text-[11px] text-stone-400">
                          Crisp black &amp; white engineering plotter presentation ready for construction tender submissions.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPresentationTheme('eswa_color')}
                        className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${
                          presentationTheme === 'eswa_color'
                            ? 'bg-orange-950/40 border-orange-500 text-white'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-xs font-bold">ESWA Modern Geological Color</strong>
                          {presentationTheme === 'eswa_color' && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <p className="text-[11px] text-stone-400">
                          Full-color lithological patterns, rock class badges, and highlighted geological discontinuity traces.
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Customizer Footer */}
              <div className="p-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
                <span className="text-[10px] text-stone-500">Live preview active</span>
                <button
                  type="button"
                  onClick={() => setIsCustomizerOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Done Editing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ESWA CAD Modal */}
      {isCadModalOpen && (
        <EswaCadContinuousStripModal
          isOpen={isCadModalOpen}
          onClose={() => setIsCadModalOpen(false)}
          dataset={dataset}
          onSaveDataset={handleCadSave}
        />
      )}

      {/* Send for Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 text-stone-100">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">
                  Send Continuous Tunnel Log for Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reviewSubmittedSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white">Submitted Successfully!</h4>
                <p className="text-xs text-stone-400">
                  Continuous log has been submitted for review. Reviewer has been notified.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
                  <p className="font-semibold text-stone-200 mb-1">Tunnel Log Summary:</p>
                  <p>Project: <strong>{dataset.projectName}</strong></p>
                  <p>Heading: <strong>{dataset.tunnelLocationName}</strong></p>
                  <p>Chainage Scope: <strong>CH {fromRd.toFixed(1)}m – {toRd.toFixed(1)}m</strong></p>
                  <p>Sender Device ID: <strong className="font-mono text-orange-400">{userDeviceId}</strong></p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-300">Reviewer Device ID or Email:</label>
                  <input
                    type="text"
                    placeholder="e.g. ESWA-REVIEW-841 or lead.geologist@nhpc.gov.in"
                    value={reviewerDeviceIdInput}
                    onChange={(e) => setReviewerDeviceIdInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-300">Reviewer Title / Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Geotechnical Engineer"
                    value={reviewerNameInput}
                    onChange={(e) => setReviewerNameInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-300">Submission Remarks / Notes:</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Verified shear zone JS1 cross-cutting pull #2. Ground support class II approved."
                    value={submissionNotesInput}
                    onChange={(e) => setSubmissionNotesInput(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-stone-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitForReview}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Review</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
