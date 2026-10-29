import React, { useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Database, Shapes } from 'lucide-react';
import { ProfileType, TunnelGeometry } from '../../types/tunnel';
import {
  createTunnelGeometry,
  enforceStrictTunnelGeometryConstraints,
} from '../../engine/geometryEngine';
import {
  CUSTOM_PROFILE_PRESETS,
  buildAuthoritativeCustomTunnelGeometry,
} from '../../engine/customProfileEngine';

export interface GeometryManualScreenProps {
  layoutStyles: {
    viewportShell: string;
    majorPanel: string;
    headerRow: string;
    backButton: string;
    sectionSurface: string;
    labelMuted: string;
    inputControl: string;
    hairlineDivider: string;
    previewStage: string;
    footerRow: string;
    secondaryButton: string;
    primaryButton: string;
  };
  isLight: boolean;
  manWidth: string;
  setManWidth: (v: string) => void;
  manHeight: string;
  setManHeight: (v: string) => void;
  manWallHeight: string;
  setManWallHeight: (v: string) => void;
  manCrownRadius: string;
  setManCrownRadius: (v: string) => void;
  manProfileType: ProfileType | '';
  setManProfileType: (v: ProfileType) => void;
  setGeometry: (geom: TunnelGeometry) => void;
  savedGeometriesCount: number;
  onBack: () => void;
  onOpenCustomEditor: (
    initialTab: 'freeform_canvas' | 'trace_image' | 'common_variants',
    returnScreen: string
  ) => void;
  onOpenSavedGeometries: () => void;
  onApplyManualGeometry: () => void;
  projectMemoryModalNode?: React.ReactNode;
}

export const GeometryManualScreen: React.FC<GeometryManualScreenProps> = ({
  layoutStyles,
  isLight,
  manWidth,
  setManWidth,
  manHeight,
  setManHeight,
  manWallHeight,
  setManWallHeight,
  manCrownRadius,
  setManCrownRadius,
  manProfileType,
  setManProfileType,
  setGeometry,
  savedGeometriesCount,
  onBack,
  onOpenCustomEditor,
  onOpenSavedGeometries,
  onApplyManualGeometry,
  projectMemoryModalNode,
}) => {
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shapeSelectRef = useRef<HTMLSelectElement | null>(null);
  const widthInputRef = useRef<HTMLInputElement | null>(null);
  const heightInputRef = useRef<HTMLInputElement | null>(null);
  const wallHeightInputRef = useRef<HTMLInputElement | null>(null);

  const isShapeEmpty = !manProfileType;
  const parsedW = parseFloat(manWidth);
  const parsedH = parseFloat(manHeight);
  const parsedWH = parseFloat(manWallHeight);

  const isWidthEmpty = !manWidth || isNaN(parsedW) || parsedW < 1.0;
  const isHeightEmpty = !manHeight || isNaN(parsedH) || parsedH < 1.0;
  const isWallHeightEmpty = !manWallHeight || isNaN(parsedWH) || parsedWH < 0.2;

  const hasCompleteGeometry = !isShapeEmpty && !isWidthEmpty && !isHeightEmpty && !isWallHeightEmpty;

  const previewW = Math.max(1.5, parsedW || 8.4);
  const previewH = Math.max(1.5, parsedH || 7.2);
  const previewWH = Math.min(previewH - 0.3, Math.max(0.5, parsedWH || 4.2));
  const previewCR = Math.max(1.0, parseFloat(manCrownRadius) || previewW / 2);
  const previewGeom = createTunnelGeometry(
    previewW,
    previewH,
    previewWH,
    (manProfileType as ProfileType) || 'd_shaped',
    previewCR,
    'manual'
  );

  const scale = Math.min(220 / previewGeom.width, 200 / previewGeom.height);
  const polyPath =
    previewGeom.crossSectionPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${160 + p.x * scale} ${240 - p.y * scale}`)
      .join(' ') + ' Z';

  const handleSaveAndContinue = () => {
    setHasAttemptedSubmit(true);

    if (isShapeEmpty) {
      setErrorMessage('Please select a tunnel excavation shape to continue.');
      shapeSelectRef.current?.focus();
      return;
    }
    if (isWidthEmpty) {
      setErrorMessage('Please specify the tunnel width (minimum 1.0m).');
      widthInputRef.current?.focus();
      return;
    }
    if (isHeightEmpty) {
      setErrorMessage('Please specify the total tunnel height (minimum 1.0m).');
      heightInputRef.current?.focus();
      return;
    }
    if (isWallHeightEmpty) {
      setErrorMessage('Please specify the sidewall height.');
      wallHeightInputRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    onApplyManualGeometry();
  };

  return (
    <main className={layoutStyles.viewportShell}>
      {/* Toast Alert for missing fields */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-600 text-white shadow-2xl border border-rose-400">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200" />
              <p className="text-xs font-semibold leading-snug">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className={`${layoutStyles.majorPanel} max-w-[920px]`}>
        <div className={layoutStyles.headerRow}>
          <button onClick={onBack} className={layoutStyles.backButton}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="font-display font-semibold text-base sm:text-lg tracking-wide">
            01. Create Master Tunnel Geometry
          </h2>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-mono hidden sm:inline ${
                isLight ? 'text-sky-700' : 'text-cyan-400'
              }`}
            >
              Units: meters (m)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pr-1">
          <div className={`${layoutStyles.sectionSurface} space-y-4`}>
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between">
                <span className={layoutStyles.labelMuted}>Tunnel / Cavern Excavation Shape *</span>
                {hasAttemptedSubmit && isShapeEmpty && (
                  <span className="text-[11px] font-bold text-rose-500">Selection Required</span>
                )}
              </span>
              <select
                ref={shapeSelectRef}
                value={manProfileType}
                onChange={(e) => {
                  const nextType = e.target.value as ProfileType;
                  if (!nextType) {
                    setManProfileType('' as ProfileType);
                    return;
                  }
                  if (
                    nextType === 'freeform_custom' ||
                    nextType === 'powerhouse_cavern' ||
                    nextType === 'transformer_hall' ||
                    nextType === 'cavern_junction' ||
                    nextType === 'asymmetric_cavern'
                  ) {
                    const presetMap: Record<string, string> = {
                      powerhouse_cavern: 'powerhouse_cavern',
                      transformer_hall: 'transformer_hall',
                      cavern_junction: 'cavern_junction',
                      asymmetric_cavern: 'asymmetric_sloping_crown',
                    };
                    const presetKey = presetMap[nextType];
                    if (presetKey) {
                      const found = CUSTOM_PROFILE_PRESETS.find((p) => p.id === presetKey);
                      if (found) {
                        const built = buildAuthoritativeCustomTunnelGeometry(found.createProfile());
                        setGeometry(built);
                        setManWidth(String(built.width));
                        setManHeight(String(built.height));
                        setManWallHeight(String(built.wallHeight));
                        setManCrownRadius(String(built.crownRadius));
                      }
                    }
                    onOpenCustomEditor('freeform_canvas', 'geometry_manual');
                    return;
                  }
                  setManProfileType(nextType);
                  const wVal = parseFloat(manWidth);
                  const hVal = parseFloat(manHeight);
                  if (wVal > 0 && hVal > 0) {
                    const c = enforceStrictTunnelGeometryConstraints(
                      wVal,
                      hVal,
                      undefined,
                      nextType
                    );
                    setManWallHeight(c.wallHeight.toFixed(2));
                    setManCrownRadius(c.crownRadius.toFixed(2));
                  }
                }}
                className={`${layoutStyles.inputControl} ${
                  hasAttemptedSubmit && isShapeEmpty
                    ? 'border-rose-500 ring-2 ring-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                    : ''
                }`}
              >
                <option value="">-- Select Tunnel Excavation Shape (No Selection) --</option>
                <option value="d_shaped">D-Shaped (Vertical Walls + Arch Crown)</option>
                <option value="horseshoe">Horseshoe Profile (Curved Sidewalls)</option>
                <option value="circular">Circular / TBM Profile</option>
                <option value="flat_arch">Modified Flat-Arch / Basket-Handle</option>
                <option value="powerhouse_cavern">
                  Powerhouse Cavern (Multi-Radius Arch + Stepped Walls)
                </option>
                <option value="transformer_hall">
                  Transformer Hall Cavern (Asymmetric Wall Heights)
                </option>
                <option value="cavern_junction">
                  Cavern Junction &amp; Enlarged Side-Chamber
                </option>
                <option value="asymmetric_cavern">
                  Asymmetric Sloping Crown &amp; Inclined Wall
                </option>
                <option value="freeform_custom">
                  Freeform Custom Vector Profile (Draw / Trace / Coordinates)
                </option>
              </select>
            </label>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onOpenCustomEditor('freeform_canvas', 'geometry_manual')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                    : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-700/60'
                }`}
              >
                Open Freeform Custom Profile &amp; Cavern Editor
              </button>
              <button
                type="button"
                onClick={() => onOpenCustomEditor('trace_image', 'geometry_manual')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                    : 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-700/60'
                }`}
              >
                Trace Engineering Drawing
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between">
                  <span className={layoutStyles.labelMuted}>Tunnel Width (m) *</span>
                  {hasAttemptedSubmit && isWidthEmpty && (
                    <span className="text-[10px] font-bold text-rose-500">Required</span>
                  )}
                </span>
                <input
                  ref={widthInputRef}
                  type="number"
                  step="0.1"
                  min="1.0"
                  placeholder="e.g. 8.50"
                  value={manWidth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManWidth(val);
                    const numW = parseFloat(val);
                    const numH = parseFloat(manHeight);
                    if (Number.isFinite(numW) && numW >= 1.0 && Number.isFinite(numH) && numH >= 1.0 && manProfileType) {
                      const c = enforceStrictTunnelGeometryConstraints(
                        numW,
                        numH,
                        undefined,
                        manProfileType
                      );
                      setManWallHeight(c.wallHeight.toFixed(2));
                      setManCrownRadius(c.crownRadius.toFixed(2));
                    }
                  }}
                  className={`${layoutStyles.inputControl} ${
                    hasAttemptedSubmit && isWidthEmpty
                      ? 'border-rose-500 ring-2 ring-rose-500/25 bg-rose-500/5'
                      : ''
                  }`}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="flex items-center justify-between">
                  <span className={layoutStyles.labelMuted}>Total Height (m) *</span>
                  {hasAttemptedSubmit && isHeightEmpty && (
                    <span className="text-[10px] font-bold text-rose-500">Required</span>
                  )}
                </span>
                <input
                  ref={heightInputRef}
                  type="number"
                  step="0.1"
                  min="1.0"
                  placeholder="e.g. 7.20"
                  value={manHeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManHeight(val);
                    const numH = parseFloat(val);
                    const numW = parseFloat(manWidth);
                    if (Number.isFinite(numH) && numH >= 1.0 && Number.isFinite(numW) && numW >= 1.0 && manProfileType) {
                      const c = enforceStrictTunnelGeometryConstraints(
                        numW,
                        numH,
                        undefined,
                        manProfileType
                      );
                      setManWallHeight(c.wallHeight.toFixed(2));
                      setManCrownRadius(c.crownRadius.toFixed(2));
                    }
                  }}
                  className={`${layoutStyles.inputControl} ${
                    hasAttemptedSubmit && isHeightEmpty
                      ? 'border-rose-500 ring-2 ring-rose-500/25 bg-rose-500/5'
                      : ''
                  }`}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="flex items-center justify-between">
                  <span className={layoutStyles.labelMuted}>Wall Height (m) *</span>
                  {hasAttemptedSubmit && isWallHeightEmpty && (
                    <span className="text-[10px] font-bold text-rose-500">Required</span>
                  )}
                </span>
                <input
                  ref={wallHeightInputRef}
                  type="number"
                  step="0.1"
                  min="0.2"
                  placeholder="e.g. 4.20"
                  value={manWallHeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManWallHeight(val);
                    const numWH = parseFloat(val);
                    const numW = parseFloat(manWidth);
                    const numH = parseFloat(manHeight);
                    if (Number.isFinite(numWH) && numWH >= 0.2 && Number.isFinite(numW) && Number.isFinite(numH) && manProfileType) {
                      const c = enforceStrictTunnelGeometryConstraints(
                        numW,
                        numH,
                        numWH,
                        manProfileType
                      );
                      setManCrownRadius(c.crownRadius.toFixed(2));
                    }
                  }}
                  className={`${layoutStyles.inputControl} ${
                    hasAttemptedSubmit && isWallHeightEmpty
                      ? 'border-rose-500 ring-2 ring-rose-500/25 bg-rose-500/5'
                      : ''
                  }`}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={layoutStyles.labelMuted}>Crown Radius (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  value={hasCompleteGeometry ? previewGeom.crownRadius.toFixed(2) : ''}
                  placeholder={hasCompleteGeometry ? undefined : 'Auto-computed'}
                  readOnly
                  title="Automatically constrained from Tunnel Width, Height, and Wall Height to prevent arch distortion"
                  className={`${layoutStyles.inputControl} opacity-75 cursor-not-allowed`}
                />
              </label>
            </div>

            <div
              className={`pt-3 border-t ${layoutStyles.hairlineDivider} text-xs space-y-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <div>
                Master Geometry Rule: Photographs &amp; Developed Perimeter strictly follow your configured dimensions.
              </div>
              {hasCompleteGeometry && (
                <div className={`font-mono text-[11px] ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                  Left/Right Wall = <strong>{previewGeom.wallHeight.toFixed(2)}m</strong> · Crown Arc ={' '}
                  <strong>{previewGeom.crownArcLength.toFixed(2)}m</strong> · Total Perimeter ={' '}
                  <strong>
                    {(previewGeom.wallHeight * 2 + previewGeom.crownArcLength).toFixed(2)}m
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Live Vector Cross-Section Preview */}
          <div className={layoutStyles.previewStage}>
            {hasCompleteGeometry ? (
              <svg viewBox="0 0 320 270" className="w-full h-[clamp(160px,28dvh,235px)]">
                <line
                  x1="160"
                  y1="15"
                  x2="160"
                  y2="245"
                  stroke={isLight ? '#94A3B8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <line
                  x1="40"
                  y1={240 - previewGeom.wallHeight * scale}
                  x2="280"
                  y2={240 - previewGeom.wallHeight * scale}
                  stroke={isLight ? '#94A3B8' : '#334155'}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <path
                  d={polyPath}
                  fill={isLight ? 'rgba(2, 132, 199, 0.10)' : 'rgba(56, 189, 248, 0.08)'}
                  stroke={isLight ? '#0284C7' : '#38BDF8'}
                  strokeWidth="2.2"
                />
                <text
                  x="160"
                  y="262"
                  textAnchor="middle"
                  fontSize="11"
                  fill={isLight ? '#334155' : '#94A3B8'}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  W = {previewGeom.width.toFixed(2)}m · H = {previewGeom.height.toFixed(2)}m · Wall ={' '}
                  {previewGeom.wallHeight.toFixed(2)}m
                </text>
              </svg>
            ) : (
              <div className="w-full h-[clamp(160px,28dvh,235px)] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <Shapes className="w-10 h-10 mb-2 opacity-50 text-cyan-500" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No Tunnel Shape Selected
                </p>
                <p className="text-[11px] text-slate-500 max-w-[240px] mt-1">
                  Select a shape from the dropdown and enter width &amp; height to preview the real-time cross section.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={layoutStyles.footerRow}>
          <button onClick={onOpenSavedGeometries} className={layoutStyles.secondaryButton}>
            <Database className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
            Saved Tunnel Geometries ({savedGeometriesCount})
          </button>
          <button onClick={handleSaveAndContinue} className={layoutStyles.primaryButton}>
            Save Master Geometry &amp; Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {projectMemoryModalNode}
    </main>
  );
};
