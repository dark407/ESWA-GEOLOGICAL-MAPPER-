import React from 'react';
import { ArrowLeft, ArrowRight, Database } from 'lucide-react';
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
  manProfileType: ProfileType;
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
  const previewW = Math.max(1.5, parseFloat(manWidth) || 8.4);
  const previewH = Math.max(1.5, parseFloat(manHeight) || 7.2);
  const previewWH = Math.min(previewH - 0.3, Math.max(0.5, parseFloat(manWallHeight) || 4.2));
  const previewCR = Math.max(1.0, parseFloat(manCrownRadius) || previewW / 2);
  const previewGeom = createTunnelGeometry(
    previewW,
    previewH,
    previewWH,
    manProfileType,
    previewCR,
    'manual'
  );

  const scale = Math.min(220 / previewGeom.width, 200 / previewGeom.height);
  const polyPath =
    previewGeom.crossSectionPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${160 + p.x * scale} ${240 - p.y * scale}`)
      .join(' ') + ' Z';

  return (
    <main className={layoutStyles.viewportShell}>
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
              <span className={layoutStyles.labelMuted}>Tunnel / Cavern Excavation Shape</span>
              <select
                value={manProfileType}
                onChange={(e) => {
                  const nextType = e.target.value as ProfileType;
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
                  const c = enforceStrictTunnelGeometryConstraints(
                    parseFloat(manWidth) || 8.4,
                    parseFloat(manHeight) || 7.2,
                    undefined,
                    nextType
                  );
                  setManWallHeight(c.wallHeight.toFixed(2));
                  setManCrownRadius(c.crownRadius.toFixed(2));
                }}
                className={layoutStyles.inputControl}
              >
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
                <span className={layoutStyles.labelMuted}>Tunnel Width (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.5"
                  value={manWidth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManWidth(val);
                    const numW = parseFloat(val);
                    const numH = parseFloat(manHeight) || 7.2;
                    if (Number.isFinite(numW) && numW >= 1.5) {
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
                  className={layoutStyles.inputControl}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={layoutStyles.labelMuted}>Total Height (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.5"
                  value={manHeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManHeight(val);
                    const numH = parseFloat(val);
                    const numW = parseFloat(manWidth) || 8.4;
                    if (Number.isFinite(numH) && numH >= 1.5) {
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
                  className={layoutStyles.inputControl}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={layoutStyles.labelMuted}>Wall Height (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={manWallHeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManWallHeight(val);
                    const numWH = parseFloat(val);
                    const numW = parseFloat(manWidth) || 8.4;
                    const numH = parseFloat(manHeight) || 7.2;
                    if (Number.isFinite(numWH) && numWH >= 0.5) {
                      const c = enforceStrictTunnelGeometryConstraints(
                        numW,
                        numH,
                        numWH,
                        manProfileType
                      );
                      setManCrownRadius(c.crownRadius.toFixed(2));
                    }
                  }}
                  className={layoutStyles.inputControl}
                />
              </label>

              <label className="block space-y-1.5">
                <span className={layoutStyles.labelMuted}>Crown Radius (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  value={previewGeom.crownRadius.toFixed(2)}
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
                Master Geometry Rule: Photographs &amp; Developed Perimeter strictly follow{' '}
                <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>
                  {previewGeom.width.toFixed(2)}m W × {previewGeom.height.toFixed(2)}m H
                </strong>
                .
              </div>
              <div className={`font-mono text-[11px] ${isLight ? 'text-sky-700' : 'text-cyan-300'}`}>
                Left/Right Wall = <strong>{previewGeom.wallHeight.toFixed(2)}m</strong> · Crown Arc ={' '}
                <strong>{previewGeom.crownArcLength.toFixed(2)}m</strong> · Total Perimeter ={' '}
                <strong>
                  {(previewGeom.wallHeight * 2 + previewGeom.crownArcLength).toFixed(2)}m
                </strong>
              </div>
            </div>
          </div>

          {/* Live Vector Cross-Section Preview */}
          <div className={layoutStyles.previewStage}>
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
          </div>
        </div>

        <div className={layoutStyles.footerRow}>
          <button onClick={onOpenSavedGeometries} className={layoutStyles.secondaryButton}>
            <Database className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
            Saved Tunnel Geometries ({savedGeometriesCount})
          </button>
          <button onClick={onApplyManualGeometry} className={layoutStyles.primaryButton}>
            Save Master Geometry &amp; Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {projectMemoryModalNode}
    </main>
  );
};
