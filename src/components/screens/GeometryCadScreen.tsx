import React from 'react';
import { ArrowLeft, ArrowRight, Database, Upload } from 'lucide-react';
import { TunnelGeometry } from '../../types/tunnel';

export interface GeometryCadScreenProps {
  layoutStyles: {
    viewportShell: string;
    majorPanel: string;
    headerRow: string;
    backButton: string;
    sectionSurface: string;
    previewStage: string;
    footerRow: string;
    secondaryButton: string;
    primaryButton: string;
  };
  isLight: boolean;
  geometry: TunnelGeometry;
  cadInputRef: React.RefObject<HTMLInputElement | null>;
  cadStatus: string | null;
  handleCADFileUpload: (f: File) => void;
  savedGeometriesCount: number;
  onBack: () => void;
  onOpenCustomEditor: (
    initialTab: 'freeform_canvas' | 'trace_image' | 'common_variants',
    returnScreen: string
  ) => void;
  onOpenSavedGeometries: () => void;
  onContinue: () => void;
  projectMemoryModalNode?: React.ReactNode;
}

export const GeometryCadScreen: React.FC<GeometryCadScreenProps> = ({
  layoutStyles,
  isLight,
  geometry,
  cadInputRef,
  cadStatus,
  handleCADFileUpload,
  savedGeometriesCount,
  onBack,
  onOpenCustomEditor,
  onOpenSavedGeometries,
  onContinue,
  projectMemoryModalNode,
}) => {
  const scale = Math.min(220 / geometry.width, 200 / geometry.height);
  const polyPath =
    geometry.crossSectionPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${160 + p.x * scale} ${240 - p.y * scale}`)
      .join(' ') + ' Z';

  return (
    <main className={layoutStyles.viewportShell}>
      <div className={`${layoutStyles.majorPanel} max-w-[740px]`}>
        <div className={layoutStyles.headerRow}>
          <button onClick={onBack} className={layoutStyles.backButton}>
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
            <div
              className={`text-xs sm:text-sm font-semibold ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}
            >
              Click to select Tunnel Profile (.DXF or .DWG)
            </div>
            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Extracts LINE, ARC, and LWPOLYLINE master cross-section geometry in real-world meters.
            </div>
          </label>

          {cadStatus && (
            <div
              className={`${layoutStyles.sectionSurface} text-xs font-mono ${
                isLight ? 'text-sky-800' : 'text-cyan-300'
              }`}
            >
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
            <button onClick={onOpenSavedGeometries} className={layoutStyles.secondaryButton}>
              <Database className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
              Load Saved Geometry ({savedGeometriesCount})
            </button>
            <button
              onClick={() => onOpenCustomEditor('freeform_canvas', 'geometry_cad')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-700/60'
              }`}
            >
              Edit Control Points in Custom Editor
            </button>
          </div>
          <button onClick={onContinue} className={layoutStyles.primaryButton}>
            Continue to Drive Direction &amp; Photos
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {projectMemoryModalNode}
    </main>
  );
};
