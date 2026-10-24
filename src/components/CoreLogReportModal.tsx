import React, { useRef, useState } from 'react';
import {
  BoreholeRecord,
  calculateBoreholeSummary,
  getRqdBadgeColor,
  chunkRunsForReport,
  chunkPhotosForReport,
} from '../engine/coreLoggingEngine';
import {
  Download,
  FileText,
  Printer,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  syncCoreLogForAiTraining,
} from '../engine/userCloudAndPackageEngine';

interface CoreLogReportModalProps {
  borehole: BoreholeRecord;
  onClose: () => void;
}

export const CoreLogReportModal: React.FC<CoreLogReportModalProps> = ({ borehole, onClose }) => {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [selectedSheetView, setSelectedSheetView] = useState<number | 'all'>('all');

  const summary = calculateBoreholeSummary(borehole);

  // Split continuous runs: 7 runs per A4 page ensures complete title block and footer fit without overflow
  const runSheets = chunkRunsForReport(borehole.runs || [], 7);
  // Split photos: 2 photos per A4 page for high clarity photographic record
  const photoSheets = chunkPhotosForReport(borehole.photos || [], 2);

  // Total pages calculation: Run pages + Photo pages + 1 Summary/Sign-off page
  const totalSheets = runSheets.length + photoSheets.length + 1;

  const handlePrint = () => {
    syncCoreLogForAiTraining(borehole, 'EXPORT_GENERATED');
    window.print();
  };

  const handleDownloadHtml = () => {
    if (!printContainerRef.current) return;
    syncCoreLogForAiTraining(borehole, 'EXPORT_GENERATED');
    const content = printContainerRef.current.innerHTML;
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Geotechnical Core Logging Report - ${borehole.boreholeId}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: #fff !important;
        padding: 0 !important;
      }
      .no-print { display: none !important; }
      .a4-page {
        page-break-after: always !important;
        page-break-inside: avoid !important;
        box-shadow: none !important;
        border: 1.5px solid #0f172a !important;
        margin: 0 0 0 0 !important;
        width: 100% !important;
        min-height: 280mm !important;
        height: auto !important;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 20px;
    }
    .a4-page {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      margin: 0 auto 24px auto;
      padding: 12mm;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border: 1px solid #cbd5e1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 4px 5px;
      font-size: 10px;
      line-height: 1.25;
    }
    th {
      background-color: #f8fafc;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.025em;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Geotechnical_Core_Log_${borehole.boreholeId.replace(/\s+/g, '_')}_A4_Report.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Helper component for Standard Engineering Title Block on each A4 sheet
   */
  const renderTitleBlock = (sheetNumber: number, sheetTitleSuffix?: string) => (
    <div className="border-2 border-slate-900 mb-3 bg-white text-slate-900 text-xs">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 p-2.5 bg-slate-50">
        <div>
          <h1 className="text-sm font-black tracking-wider uppercase text-slate-900 flex items-center gap-2">
            <span>GEOTECHNICAL CORE LOGGING REPORT</span>
            {sheetTitleSuffix && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                [{sheetTitleSuffix}]
              </span>
            )}
          </h1>
          <p className="text-[9.5px] text-slate-600 font-semibold tracking-wide mt-0.5">
            CONTINUOUS DIAMOND DRILL HOLE RECORD &bull; BS 5930:2015+A1:2020 / ASTM D2113 / ISRM STANDARDS
          </p>
        </div>

        {/* Engineering Identification Stamp Box */}
        <div className="flex items-stretch border-2 border-slate-900 bg-white">
          <div className="px-3 py-1 bg-slate-900 text-white font-black text-center flex flex-col justify-center">
            <span className="text-[8px] uppercase tracking-wider block">BOREHOLE NO.</span>
            <span className="text-sm font-mono tracking-tight font-extrabold">{borehole.boreholeId}</span>
          </div>
          <div className="px-3 py-1 text-center flex flex-col justify-center border-l-2 border-slate-900 bg-amber-50">
            <span className="text-[8px] uppercase tracking-wider font-bold text-slate-600 block">SHEET</span>
            <span className="text-xs font-mono font-black text-slate-900">
              {sheetNumber} of {totalSheets}
            </span>
          </div>
        </div>
      </div>

      {/* Structured Geotechnical Metadata Table */}
      <table className="w-full text-[10px] border-collapse border-2 border-slate-900">
        <tbody>
          <tr>
            <td className="w-[14%] bg-slate-200 font-black uppercase text-[9px] text-slate-950">Project Name:</td>
            <td className="w-[36%] font-bold text-slate-950">{borehole.projectName || '—'}</td>
            <td className="w-[14%] bg-slate-200 font-black uppercase text-[9px] text-slate-950">Client / Employer:</td>
            <td className="w-[36%] font-bold text-slate-950">{borehole.clientEmployer || '—'}</td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Location / Chainage:</td>
            <td className="font-black text-slate-950 font-mono">
              {borehole.chainageLabel || borehole.tunnelName || '—'}
            </td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Drilling Contractor:</td>
            <td className="font-bold text-slate-950">{borehole.drillingContractor || '—'}</td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Collar Elevation:</td>
            <td className="font-mono font-bold text-slate-950">
              {borehole.collarElevation ? `${borehole.collarElevation.toFixed(2)} m a.s.l.` : '—'}
            </td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Geotechnical PMC:</td>
            <td className="font-bold text-slate-950">{borehole.pmcConsultant || '—'}</td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Coordinates:</td>
            <td className="font-mono font-bold text-slate-950 text-[9.5px]">
              {borehole.coordinates?.easting && borehole.coordinates?.northing
                ? `E: ${borehole.coordinates.easting} | N: ${borehole.coordinates.northing}`
                : borehole.coordinates?.elevation || 'Standard Site Grid'}
            </td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Drilling Rig / Method:</td>
            <td className="font-bold text-slate-950">{borehole.drillingMethod || 'Wireline Diamond Core HQ3'}</td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Inclination / Azimuth:</td>
            <td className="font-mono font-black text-slate-950">
              {borehole.inclinationDeg}° (from horiz) &bull; Azimuth {borehole.azimuthDeg}°
            </td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Core Barrel / Size:</td>
            <td className="font-bold text-slate-950">{borehole.coreDiameter || 'HQ3 (61.1 mm)'}</td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Total Drilled Depth:</td>
            <td className="font-mono font-black text-slate-950">{summary.totalDrilledDepth.toFixed(2)} m</td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Water Table Depth:</td>
            <td className="font-mono font-black text-blue-900">
              {borehole.waterTableDepth !== undefined ? `${borehole.waterTableDepth.toFixed(2)} m b.g.l.` : 'Dry / Nil Ingress'}
            </td>
          </tr>
          <tr>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Dates Commenced / Ended:</td>
            <td className="font-mono font-bold text-slate-950 text-[9px]">
              {borehole.startDate || '—'} to {borehole.completionDate || '—'}
            </td>
            <td className="bg-slate-200 font-black uppercase text-[9px] text-slate-950">Logged By / Checked By:</td>
            <td className="font-bold text-slate-950 text-[9px]">
              Logged: {borehole.loggedBy || 'Site Geologist'} &bull; Checked: {borehole.reviewedBy || 'PMC Engineer'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  /**
   * Helper component for Standard Engineering Sheet Footer
   */
  const renderSheetFooter = (sheetNumber: number) => (
    <div className="pt-2 border-t-2 border-slate-900 text-[9px] font-mono text-slate-600 flex items-center justify-between mt-auto">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900">{borehole.projectName}</span>
        <span>&bull;</span>
        <span className="font-bold">BH ID: {borehole.boreholeId}</span>
      </div>
      <div className="font-bold uppercase tracking-wider text-slate-700">
        GEOTECHNICAL INVESTIGATION RECORD &bull; BOREHOLE CORE LOG
      </div>
      <div className="font-bold text-slate-900">
        Sheet {sheetNumber} of {totalSheets}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[96vh] overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 text-white shadow-xs">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Geotechnical Core Logging Report</span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
                  {borehole.boreholeId}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  A4 Multi-Page ({totalSheets} Sheets)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative geotechnical borehole report &bull; Strip log, continuous runs, photo plates &amp; tri-party sign-off
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sheet View Selector Filter */}
            <div className="hidden md:flex items-center gap-1 bg-slate-300 dark:bg-slate-800 p-1 rounded-lg text-xs border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedSheetView('all')}
                className={`px-2.5 py-1 rounded font-black transition-all cursor-pointer ${
                  selectedSheetView === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-800 dark:text-slate-200 hover:text-orange-600'
                }`}
              >
                All Sheets ({totalSheets})
              </button>
              {Array.from({ length: totalSheets }, (_, i) => i + 1).map((sNum) => (
                <button
                  key={sNum}
                  type="button"
                  onClick={() => setSelectedSheetView(sNum)}
                  className={`px-2 py-1 rounded font-mono font-black transition-all cursor-pointer ${
                    selectedSheetView === sNum
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-slate-800 dark:text-slate-200 hover:text-orange-600'
                  }`}
                  title={`View Sheet ${sNum}`}
                >
                  S{sNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border-2 border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download standalone A4 HTML report"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Export HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-black text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              title="Print / Save to A4 PDF"
            >
              <Printer className="w-3.5 h-3.5 text-orange-400" />
              <span>Print / Save PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Close report modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Sheets Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 dark:bg-slate-950 flex flex-col items-center gap-6">
          <div ref={printContainerRef} className="w-full flex flex-col items-center">
            {/* =========================================================================
                SECTION 1: RUN LOG SHEETS (PAGINATED CHUNKS OF 7-8 RUNS PER A4 SHEET)
               ========================================================================= */}
            {runSheets.map((runsChunk, chunkIdx) => {
              const currentSheetNumber = chunkIdx + 1;
              if (selectedSheetView !== 'all' && selectedSheetView !== currentSheetNumber) {
                return null;
              }

              return (
                <div
                  key={`run-sheet-${chunkIdx}`}
                  className="a4-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-xl border border-slate-300 mb-6 flex flex-col justify-between"
                  style={{ boxSizing: 'border-box' }}
                >
                  <div>
                    {/* Engineering Header Block */}
                    {renderTitleBlock(currentSheetNumber, 'Core Run Log')}

                    {/* Continuous Core Run Log Table */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                          Continuous Diamond Core Run Log &amp; Discontinuity Survey
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                          Runs {runsChunk[0]?.runNumber || 1} to {runsChunk[runsChunk.length - 1]?.runNumber || 1} of{' '}
                          {borehole.runs.length} Total Runs
                        </span>
                      </div>

                      <table className="w-full text-left border-collapse border-2 border-slate-900 text-[9.5px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[8.5px]">
                            <th className="p-1 border border-slate-400 text-center w-6">Run</th>
                            <th className="p-1 border border-slate-400 text-center">From (m)</th>
                            <th className="p-1 border border-slate-400 text-center">To (m)</th>
                            <th className="p-1 border border-slate-400 text-center">L (m)</th>
                            <th className="p-1 border border-slate-400 text-center">CR (m)</th>
                            <th className="p-1 border border-slate-400 text-center">TCR %</th>
                            <th className="p-1 border border-slate-400 text-center">≥10cm (m)</th>
                            <th className="p-1 border border-slate-400 text-center">RQD %</th>
                            <th className="p-1 border border-slate-400 text-center">ISRM Rating</th>
                            <th className="p-1 border border-slate-400 text-center">Lithology</th>
                            <th className="p-1 border border-slate-400 text-center">Graphic</th>
                            <th className="p-1 border border-slate-400 text-center">Wth</th>
                            <th className="p-1 border border-slate-400 text-center">Str</th>
                            <th className="p-1 border border-slate-400 text-center">FF/m</th>
                            <th className="p-1 border border-slate-400 text-center">Box</th>
                            <th className="p-1 border border-slate-400 w-[28%]">Discontinuities &amp; Geological Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runsChunk.map((run) => {
                            const ratingColor = getRqdBadgeColor(run.rqdRating);
                            return (
                              <tr key={run.id} className="hover:bg-slate-50">
                                <td className="p-1 border border-slate-400 text-center font-bold font-mono">
                                  {run.runNumber}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono">
                                  {run.depthFrom.toFixed(2)}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono">
                                  {run.depthTo.toFixed(2)}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono text-slate-700">
                                  {run.runLength.toFixed(2)}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono">
                                  {run.coreRecovered.toFixed(2)}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono font-bold">
                                  {run.tcrPercent.toFixed(1)}%
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono">
                                  {run.soundPiecesOver10cm.toFixed(2)}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono font-black text-slate-900">
                                  {run.rqdPercent.toFixed(1)}%
                                </td>
                                <td className="p-1 border border-slate-400 text-center">
                                  <span
                                    className={`px-1 py-0.5 rounded text-[8.5px] font-bold border ${ratingColor.bg} ${ratingColor.text} ${ratingColor.border}`}
                                  >
                                    {run.rqdRating}
                                  </span>
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-semibold text-[9px]">
                                  {run.lithology}
                                </td>
                                {/* Graphic Lithology Swatch */}
                                <td className="p-1 border border-slate-400 text-center">
                                  <div
                                    className="w-8 h-4 mx-auto rounded-xs border border-slate-600 flex items-center justify-center font-mono text-[7px] font-bold"
                                    style={{
                                      backgroundColor: run.lithologyColor || '#e2e8f0',
                                      color: '#0f172a',
                                    }}
                                  >
                                    |||
                                  </div>
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-bold font-mono">
                                  {run.weathering}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-bold font-mono">
                                  {run.strengthGrade}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono">
                                  {run.fractureFrequency !== undefined ? run.fractureFrequency : '—'}
                                </td>
                                <td className="p-1 border border-slate-400 text-center font-mono font-bold text-slate-800">
                                  #{run.coreBoxNumber}
                                </td>
                                <td className="p-1 border border-slate-400 text-[9px] text-slate-800 leading-tight">
                                  <div className="font-semibold text-slate-900">
                                    {run.discontinuitiesDescription || 'Intact core sticks'}
                                  </div>
                                  {run.remarks && (
                                    <div className="text-slate-600 italic text-[8.5px] mt-0.5">{run.remarks}</div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Depth Section Graphic Bar for this Sheet */}
                    <div className="p-2 border border-slate-400 bg-slate-50 mb-3">
                      <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Interval RQD &amp; Lithological Graphic Log ({runsChunk[0]?.depthFrom.toFixed(1)}m –{' '}
                        {runsChunk[runsChunk.length - 1]?.depthTo.toFixed(1)}m)
                      </div>
                      <div className="space-y-1">
                        {runsChunk.map((r) => (
                          <div key={`int-${r.id}`} className="flex items-center gap-1.5 text-[8.5px]">
                            <span className="w-16 font-mono text-right text-slate-600 font-bold shrink-0">
                              {r.depthFrom.toFixed(1)} - {r.depthTo.toFixed(1)}m:
                            </span>
                            <span
                              className="w-20 px-1 py-0.5 rounded text-center font-bold truncate shrink-0 border"
                              style={{
                                backgroundColor: r.lithologyColor ? `${r.lithologyColor}30` : '#e2e8f0',
                                borderColor: r.lithologyColor || '#cbd5e1',
                              }}
                            >
                              {r.lithology}
                            </span>
                            <div className="flex-1 bg-slate-200 h-3 rounded overflow-hidden relative border border-slate-300">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, r.rqdPercent))}%`,
                                  backgroundColor:
                                    r.rqdPercent >= 90
                                      ? '#10B981'
                                      : r.rqdPercent >= 75
                                      ? '#14B8A6'
                                      : r.rqdPercent >= 50
                                      ? '#F59E0B'
                                      : r.rqdPercent >= 25
                                      ? '#F97316'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="w-24 font-mono font-bold text-slate-800 text-right shrink-0">
                              RQD {r.rqdPercent.toFixed(1)}% ({r.rqdRating})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sheet Footer */}
                  {renderSheetFooter(currentSheetNumber)}
                </div>
              );
            })}

            {/* =========================================================================
                SECTION 2: APPENDIX - CORE BOX PHOTOGRAPHIC PLATES (PAGINATED CHUNKS)
               ========================================================================= */}
            {photoSheets.map((photoChunk, pIdx) => {
              const currentSheetNumber = runSheets.length + pIdx + 1;
              if (selectedSheetView !== 'all' && selectedSheetView !== currentSheetNumber) {
                return null;
              }

              return (
                <div
                  key={`photo-sheet-${pIdx}`}
                  className="a4-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-xl border border-slate-300 mb-6 flex flex-col justify-between"
                  style={{ boxSizing: 'border-box' }}
                >
                  <div>
                    {/* Engineering Header Block */}
                    {renderTitleBlock(currentSheetNumber, 'Photographic Plates')}

                    <div className="mb-2 flex items-center justify-between border-b border-slate-300 pb-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        APPENDIX A: Core Box Photographic Record (Plates {pIdx * 2 + 1} –{' '}
                        {pIdx * 2 + photoChunk.length})
                      </h3>
                      <span className="text-[9px] font-mono text-slate-500">
                        High-Resolution Core Tray Inspection Under Diffused Lighting
                      </span>
                    </div>

                    {/* Photo Plates Grid (2 per A4 sheet for high clarity) */}
                    <div className="space-y-4">
                      {photoChunk.map((photo) => (
                        <div
                          key={photo.id}
                          className="border-2 border-slate-800 rounded overflow-hidden bg-slate-50 text-slate-900"
                        >
                          <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[10px] font-bold">
                            <span className="tracking-wide uppercase">
                              PLATE #{photo.boxNumber}: CORE BOX #{photo.boxNumber} &bull; DEPTH INTERVAL:{' '}
                              {photo.depthFrom.toFixed(2)}m TO {photo.depthTo.toFixed(2)}m
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-400 text-slate-900">
                              {photo.condition || 'Wet'} Condition
                            </span>
                          </div>

                          <div className="h-56 bg-slate-100 flex items-center justify-center relative overflow-hidden border-b border-slate-300">
                            {photo.photoUrl ? (
                              <img
                                src={photo.photoUrl}
                                alt={`Core Box #${photo.boxNumber}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center p-4 text-slate-400">
                                <div className="font-bold text-xs uppercase mb-1">
                                  Photographic Plate: Core Box #{photo.boxNumber}
                                </div>
                                <div className="text-[10px] font-mono">
                                  Interval: {photo.depthFrom.toFixed(2)}m – {photo.depthTo.toFixed(2)}m
                                </div>
                                <div className="text-[9px] text-slate-400 mt-2 italic">
                                  [Standard 1.0m Geotechnical Core Tray Photographic Plate]
                                </div>
                              </div>
                            )}

                            {/* Scale bar indicator */}
                            <div className="absolute bottom-2 right-2 bg-black/75 text-white font-mono text-[8px] px-2 py-0.5 rounded">
                              Scale: 1.0m Tray Divisions
                            </div>
                          </div>

                          <div className="p-2 text-[10px] bg-white flex items-start justify-between gap-4">
                            <div>
                              <div className="font-bold text-slate-900">
                                {photo.photoTitle || `Core Box #${photo.boxNumber} Layout`}
                              </div>
                              <p className="text-slate-600 text-[9.5px] mt-0.5">
                                {photo.notes || 'Core sticks carefully arranged in standard channelized trays with wooden depth spacer blocks.'}
                              </p>
                            </div>
                            <div className="text-right shrink-0 text-[9px] font-mono text-slate-500">
                              <div>Cataloged: {photo.takenAt || borehole.startDate}</div>
                              <div>Tray Length: {(photo.depthTo - photo.depthFrom).toFixed(2)}m</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sheet Footer */}
                  {renderSheetFooter(currentSheetNumber)}
                </div>
              );
            })}

            {/* =========================================================================
                SECTION 3: FINAL SHEET - GEOTECHNICAL SUMMARY & FORMAL TRI-PARTY SIGN-OFF
               ========================================================================= */}
            {(() => {
              const currentSheetNumber = totalSheets;
              if (selectedSheetView !== 'all' && selectedSheetView !== currentSheetNumber) {
                return null;
              }

              return (
                <div
                  key="summary-signoff-sheet"
                  className="a4-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-xl border border-slate-300 mb-6 flex flex-col justify-between"
                  style={{ boxSizing: 'border-box' }}
                >
                  <div>
                    {/* Engineering Header Block */}
                    {renderTitleBlock(currentSheetNumber, 'Summary & Sign-Off')}

                    {/* Section 1: Overall Geotechnical Summary Statistics */}
                    <div className="mb-4">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-300 pb-1">
                        Overall Geotechnical Borehole Summary &amp; Rock Mass Indices
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                        <div className="border border-slate-300 bg-slate-50 p-2 rounded">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Depth</span>
                          <span className="text-base font-black font-mono text-slate-900">
                            {summary.totalDrilledDepth.toFixed(2)} m
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            {summary.runCount} Runs Recorded
                          </span>
                        </div>

                        <div className="border border-slate-300 bg-slate-50 p-2 rounded">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Core Recovery</span>
                          <span className="text-base font-black font-mono text-slate-900">
                            {summary.averageTcr.toFixed(1)}%
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            {summary.totalCoreRecovered.toFixed(2)}m recovered
                          </span>
                        </div>

                        <div className="border border-slate-300 bg-slate-50 p-2 rounded">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Average RQD %</span>
                          <span className="text-base font-black font-mono text-slate-900">
                            {summary.averageRqd.toFixed(1)}%
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            {summary.totalSoundPieces.toFixed(2)}m sound (≥10cm)
                          </span>
                        </div>

                        <div className="border border-slate-300 bg-slate-50 p-2 rounded">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">ISRM Rock Quality</span>
                          <span className="text-sm font-black text-amber-700 uppercase mt-0.5 block">
                            {summary.overallRqdRating}
                          </span>
                          <span className="text-[9px] text-slate-500 block">Deere &amp; Miller Scale</span>
                        </div>
                      </div>

                      <table className="w-full text-[10px] border-collapse border border-slate-300 mb-4">
                        <tbody>
                          <tr>
                            <td className="w-1/4 bg-slate-100 font-bold uppercase text-[9px]">Dominant Rock Mass:</td>
                            <td className="w-1/4 font-bold text-slate-900">{summary.dominantLithology}</td>
                            <td className="w-1/4 bg-slate-100 font-bold uppercase text-[9px]">Weathering Profile:</td>
                            <td className="w-1/4 font-bold text-slate-900">{summary.dominantWeathering}</td>
                          </tr>
                          <tr>
                            <td className="bg-slate-100 font-bold uppercase text-[9px]">Static Water Table:</td>
                            <td className="font-mono text-blue-800 font-bold">
                              {borehole.waterTableDepth !== undefined
                                ? `${borehole.waterTableDepth.toFixed(2)} m b.g.l.`
                                : 'Dry / Nil'}
                            </td>
                            <td className="bg-slate-100 font-bold uppercase text-[9px]">Core Boxes Cataloged:</td>
                            <td className="font-mono font-bold text-slate-900">{summary.boxCount} Boxes</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Section 2: Complete Vertical Graphic Strip Log */}
                    <div className="mb-4 border border-slate-300 p-2.5 rounded bg-slate-50">
                      <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 mb-2">
                        Complete Vertical Graphic Strip Log (Collar 0.00m to E.O.H. {summary.totalDrilledDepth.toFixed(2)}m)
                      </div>
                      <div className="space-y-1">
                        {borehole.runs.map((run) => (
                          <div key={`full-${run.id}`} className="flex items-center gap-2 text-[9px]">
                            <span className="w-16 font-mono text-right text-slate-600 font-bold shrink-0">
                              {run.depthFrom.toFixed(1)} - {run.depthTo.toFixed(1)}m:
                            </span>
                            <span
                              className="w-24 px-1.5 py-0.5 rounded text-center font-bold truncate text-[9px] shrink-0 border"
                              style={{
                                backgroundColor: run.lithologyColor ? `${run.lithologyColor}30` : '#e2e8f0',
                                borderColor: run.lithologyColor || '#cbd5e1',
                              }}
                            >
                              {run.lithology}
                            </span>
                            <div className="flex-1 bg-slate-200 h-3.5 rounded overflow-hidden relative border border-slate-300">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, run.rqdPercent))}%`,
                                  backgroundColor:
                                    run.rqdPercent >= 90
                                      ? '#10B981'
                                      : run.rqdPercent >= 75
                                      ? '#14B8A6'
                                      : run.rqdPercent >= 50
                                      ? '#F59E0B'
                                      : run.rqdPercent >= 25
                                      ? '#F97316'
                                      : '#EF4444',
                                }}
                              />
                            </div>
                            <span className="w-28 font-mono font-bold text-slate-800 text-right shrink-0">
                              RQD {run.rqdPercent.toFixed(1)}% ({run.rqdRating})
                            </span>
                            <span className="w-16 font-mono font-bold text-slate-600 text-center shrink-0 bg-white border border-slate-200 rounded px-1">
                              {run.weathering}|{run.strengthGrade}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Tri-Party Geotechnical Acceptance & Verification Sign-Off */}
                    <div className="border-2 border-slate-900 rounded p-3 bg-white mt-4">
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-300">
                        <ShieldCheck className="w-4 h-4 text-slate-900" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Tri-Party Geotechnical Verification &amp; Acceptance Sign-Off
                        </h4>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* 1. Contractor Block */}
                        <div className="border border-slate-400 p-2.5 rounded bg-slate-50 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-300">
                              <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                Contractor
                              </span>
                              <span className="text-[8.5px] text-slate-500 font-semibold">Drilling &amp; Primary Log</span>
                            </div>
                            <div className="font-bold text-slate-900 text-[11px]">
                              {borehole.signOff.contractorName || borehole.drillingContractor || 'Contractor Geologist'}
                            </div>
                            <div className="text-[9px] text-slate-600 font-medium">
                              {borehole.signOff.contractorDesignation || 'Lead Drilling & Geotechnical Engineer'}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-300">
                            <div className="h-14 flex items-center justify-center border border-slate-300 rounded bg-white mb-1 overflow-hidden relative">
                              {borehole.signOff.contractorSignature ? (
                                <img
                                  src={borehole.signOff.contractorSignature}
                                  alt="Contractor Signature"
                                  className="max-h-12 object-contain"
                                />
                              ) : (
                                <span className="text-[8.5px] text-slate-400 font-mono italic">[Signature on File]</span>
                              )}
                              <div className="absolute top-0.5 right-1 text-[7px] text-slate-400 font-mono uppercase">
                                Stamp / Sign
                              </div>
                            </div>
                            <div className="text-[8.5px] text-slate-600 flex justify-between font-mono">
                              <span>Verification Date:</span>
                              <span className="font-bold text-slate-900">{borehole.signOff.contractorDate || borehole.completionDate || '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. PMC Consultant Block */}
                        <div className="border border-slate-400 p-2.5 rounded bg-slate-50 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-300">
                              <span className="text-[9px] font-black uppercase text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded">
                                PMC Consultant
                              </span>
                              <span className="text-[8.5px] text-slate-500 font-semibold">Checked &amp; Verified</span>
                            </div>
                            <div className="font-bold text-slate-900 text-[11px]">
                              {borehole.signOff.pmcName || borehole.pmcConsultant || 'PMC Geotechnical Specialist'}
                            </div>
                            <div className="text-[9px] text-slate-600 font-medium">
                              {borehole.signOff.pmcDesignation || 'Senior Tunnel Geotechnical Engineer'}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-300">
                            <div className="h-14 flex items-center justify-center border border-slate-300 rounded bg-white mb-1 overflow-hidden relative">
                              {borehole.signOff.pmcSignature ? (
                                <img
                                  src={borehole.signOff.pmcSignature}
                                  alt="PMC Signature"
                                  className="max-h-12 object-contain"
                                />
                              ) : (
                                <span className="text-[8.5px] text-slate-400 font-mono italic">[Signature on File]</span>
                              )}
                              <div className="absolute top-0.5 right-1 text-[7px] text-slate-400 font-mono uppercase">
                                Stamp / Sign
                              </div>
                            </div>
                            <div className="text-[8.5px] text-slate-600 flex justify-between font-mono">
                              <span>Verification Date:</span>
                              <span className="font-bold text-slate-900">{borehole.signOff.pmcDate || borehole.completionDate || '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Client / Employer Block */}
                        <div className="border border-slate-400 p-2.5 rounded bg-slate-50 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-300">
                              <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                                Client / Employer
                              </span>
                              <span className="text-[8.5px] text-slate-500 font-semibold">Accepted &amp; Approved</span>
                            </div>
                            <div className="font-bold text-slate-900 text-[11px]">
                              {borehole.signOff.clientName || borehole.clientEmployer || 'Client Representative'}
                            </div>
                            <div className="text-[9px] text-slate-600 font-medium">
                              {borehole.signOff.clientDesignation || 'Project Director / Executive Engineer'}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-300">
                            <div className="h-14 flex items-center justify-center border border-slate-300 rounded bg-white mb-1 overflow-hidden relative">
                              {borehole.signOff.clientSignature ? (
                                <img
                                  src={borehole.signOff.clientSignature}
                                  alt="Client Signature"
                                  className="max-h-12 object-contain"
                                />
                              ) : (
                                <span className="text-[8.5px] text-slate-400 font-mono italic">[Signature on File]</span>
                              )}
                              <div className="absolute top-0.5 right-1 text-[7px] text-slate-400 font-mono uppercase">
                                Stamp / Sign
                              </div>
                            </div>
                            <div className="text-[8.5px] text-slate-600 flex justify-between font-mono">
                              <span>Approval Date:</span>
                              <span className="font-bold text-slate-900">{borehole.signOff.clientDate || borehole.completionDate || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Certification Legal Note */}
                      <p className="text-[8px] text-slate-500 mt-2 text-justify leading-tight">
                        CERTIFICATION: This document is an engineering record of subsurface diamond core drilling, continuous rock recovery measurements, TCR/RQD evaluations, and discontinuity observations prepared in accordance with standard geotechnical practices (BS 5930 / ASTM D2113 / ISRM).
                      </p>
                    </div>
                  </div>

                  {/* Sheet Footer */}
                  {renderSheetFooter(currentSheetNumber)}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
