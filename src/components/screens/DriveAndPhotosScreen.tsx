import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Compass,
  Plus,
  Ruler,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  ParameterInputStatus,
  PhotoSurface,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../../types/tunnel';
import { parseDriveDirectionAzimuth } from '../../engine/orientationEngine';
import {
  getSurfacePanelLabelMap,
  MappingDomainType,
  SurfaceGeometryParameters,
} from '../../engine/surfaceMappingEngine';
import {
  SimpleAddonTab,
  SimpleFullPhotoAndAccuracyModal,
} from '../SimpleFullPhotoAndAccuracyModal';

export interface DriveAndPhotosScreenProps {
  layoutStyles: {
    viewportShell: string;
    majorPanel: string;
    headerRow: string;
    backButton: string;
    sectionSurface: string;
    hairlineDivider: string;
    footerRow: string;
    secondaryButton: string;
    primaryButton: string;
  };
  isLight: boolean;
  activeMappingDomain: MappingDomainType;
  settings: TunnelSettings;
  geometry: TunnelGeometry;
  activeProjectName: string;
  activeLocationName: string;
  photoSurfaceParams: SurfaceGeometryParameters;
  photos: Record<SurfaceType, PhotoSurface>;
  activeSurface: SurfaceType;
  setActiveSurface: (s: SurfaceType) => void;
  clusteredJoints: Joint[];
  jointSets: JointSet[];
  rmrParams: RmrParameters;
  qIndexParams: QIndexParameters;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  responsive: {
    isMobile: boolean;
    isTouchDevice: boolean;
    isShortLandscape?: boolean;
    isCompactHeight?: boolean;
  };
  onBack: () => void;
  onOpenProjectConfiguration?: () => void;
  onOpenCustomEditor: (
    initialTab: 'freeform_canvas' | 'trace_image' | 'common_variants',
    returnScreen: string
  ) => void;
  handleRemoveMainPhoto: (slotId: SurfaceType) => void;
  handleUploadSurfacePhoto: (slotId: SurfaceType, f: File) => void;
  handleUploadSupportingPhoto: (slotId: SurfaceType, f: File, spId?: string) => void;
  handleRemoveSupportingPhoto: (slotId: SurfaceType, spId: string) => void;
  handleSaveOfflineDraft: () => void;
  onNavigateToMapping: () => void;
  onApplyExtractedGeometryAndScale: (
    nextGeometry: TunnelGeometry,
    calibratedPxPerMeter: number,
    fullPhotoDataUrl: string,
    targetSurface?: SurfaceType
  ) => void;
  onUpdateJointsWithHistory: (joints: Joint[]) => void;
  onUpdateRmrParams: React.Dispatch<React.SetStateAction<RmrParameters>>;
  onUpdateQIndexParams: React.Dispatch<React.SetStateAction<QIndexParameters>>;
  onUpdateQParamStatus: React.Dispatch<
    React.SetStateAction<Record<QSystemParamKey, ParameterInputStatus>>
  >;
  onStatusMessage: (msg: string | null) => void;
  projectMemoryModalNode?: React.ReactNode;
}

export const DriveAndPhotosScreen: React.FC<DriveAndPhotosScreenProps> = ({
  layoutStyles,
  isLight,
  activeMappingDomain,
  settings,
  geometry,
  activeProjectName,
  activeLocationName,
  photoSurfaceParams,
  photos,
  activeSurface,
  setActiveSurface,
  clusteredJoints,
  jointSets,
  rmrParams,
  qIndexParams,
  qParamStatus,
  responsive,
  onBack,
  onOpenProjectConfiguration,
  onOpenCustomEditor,
  handleRemoveMainPhoto,
  handleUploadSurfacePhoto,
  handleUploadSupportingPhoto,
  handleRemoveSupportingPhoto,
  handleSaveOfflineDraft,
  onNavigateToMapping,
  onApplyExtractedGeometryAndScale,
  onUpdateJointsWithHistory,
  onUpdateRmrParams,
  onUpdateQIndexParams,
  onUpdateQParamStatus,
  onStatusMessage,
  projectMemoryModalNode,
}) => {
  const [showPhotoScreenAccuracyModal, setShowPhotoScreenAccuracyModal] = useState(false);
  const [photoScreenAccuracyTab, setPhotoScreenAccuracyTab] =
    useState<SimpleAddonTab>('full_photo_1ft_scale');

  const parsedDrive = parseDriveDirectionAzimuth(settings.driveDirectionInput);

  return (
    <main className={layoutStyles.viewportShell}>
      <div className={`${layoutStyles.majorPanel} max-w-[96vw] xl:max-w-[1440px]`}>
        <div className={layoutStyles.headerRow}>
          <button onClick={onBack} className={layoutStyles.backButton}>
            <ArrowLeft className="w-4 h-4" />
            Back to Project &amp; Location
          </button>
          <h2 className="font-display font-semibold text-base sm:text-lg tracking-wide">
            Step 3 · Add {getSurfacePanelLabelMap(activeMappingDomain).domainTitle} Surface Pictures
          </h2>
          <div className="flex items-center gap-2">
            {onOpenProjectConfiguration && (
              <button
                type="button"
                onClick={onOpenProjectConfiguration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/50 cursor-pointer shadow-sm transition-all"
                title="Configure Project Metadata, Drive Direction (0-360°), Chainage, RMR89 & Q-System"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Project &amp; Geotech Parameters</span>
              </button>
            )}
            {activeMappingDomain === 'TUNNEL' && (
              <button
                type="button"
                onClick={() => {
                  onOpenCustomEditor(
                    geometry.customProfile ||
                      geometry.crownGeometry === 'freeform_custom' ||
                      geometry.source === 'custom_editor'
                      ? 'freeform_canvas'
                      : 'common_variants',
                    'drive_and_photos'
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono border border-slate-700 cursor-pointer"
              >
                Edit / Change Shape ({geometry.width.toFixed(1)}m × {geometry.height.toFixed(1)}m)
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 pr-1">
          {/* Compact Summary Bar of Step 1 & Step 2 Selections */}
          <div
            className={`${layoutStyles.sectionSurface} flex flex-wrap items-center justify-between gap-3 text-xs font-mono`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Project: <strong className="text-cyan-300">{activeProjectName || '—'}</strong>
              </span>
              <span>·</span>
              <span>
                Location: <strong className="text-emerald-300">{activeLocationName || '—'}</strong>
              </span>
              <span>·</span>
              <span>
                {activeMappingDomain === 'TUNNEL' ? 'Chainage' : 'Station / RL'}:{' '}
                <strong className="text-amber-300">
                  {settings.faceChainage || settings.chainage}
                </strong>
              </span>
              <span>·</span>
              <span>
                {activeMappingDomain === 'TUNNEL' ? 'Pull' : 'Span'}:{' '}
                <strong>{settings.roundLength.toFixed(2)}m</strong>
              </span>
              <span>·</span>
              <span>
                {activeMappingDomain === 'TUNNEL'
                  ? 'Drive'
                  : activeMappingDomain === 'TRENCH'
                  ? 'Trench Axis'
                  : 'Face DipDir'}
                :{' '}
                <strong>N {parsedDrive.azimuth.toFixed(0)}°</strong>
              </span>
              <span>·</span>
              <span>
                {activeMappingDomain === 'TUNNEL' ? 'Shape' : 'Surface Geometry'}:{' '}
                <strong>
                  {geometry.width.toFixed(2)}m W × {geometry.height.toFixed(2)}m H
                  {activeMappingDomain === 'TUNNEL' ? (
                    <>
                      {' '}
                      (L-Wall{' '}
                      {(
                        geometry.leftWallArcLength ??
                        geometry.leftWallHeight ??
                        geometry.wallHeight
                      ).toFixed(2)}
                      m · R-Wall{' '}
                      {(
                        geometry.rightWallArcLength ??
                        geometry.rightWallHeight ??
                        geometry.wallHeight
                      ).toFixed(2)}
                      m
                      {geometry.hasCrown === false
                        ? ' · Face+Walls Only'
                        : ` · Crown ${geometry.crownArcLength.toFixed(2)}m`}
                      )
                    </>
                  ) : (
                    <>
                      {' '}
                      · {activeMappingDomain === 'TRENCH' ? 'Floor' : 'Berm'}{' '}
                      {geometry.crownArcLength.toFixed(2)}m · Angle{' '}
                      {photoSurfaceParams.faceDipAngleDeg}°
                    </>
                  )}
                </strong>
              </span>
            </div>
          </div>

          {/* Section 5: Surface Photograph Inputs */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                className={`text-xs sm:text-sm font-semibold ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                {getSurfacePanelLabelMap(activeMappingDomain).domainTitle} Photographs (Optional
                Combinations Supported)
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhotoScreenAccuracyTab('full_photo_1ft_scale');
                    setShowPhotoScreenAccuracyModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  Overall Full Photo + 1-Ft Scale (Auto Size &amp; Wall/Crown)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoScreenAccuracyTab('four_part_accuracy');
                    setShowPhotoScreenAccuracyModal(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    isLight
                      ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                      : 'bg-sky-950/60 hover:bg-sky-900/70 text-sky-300 border-sky-700/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  4-Part Simple Accuracy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                (() => {
                  const surfLabels = getSurfacePanelLabelMap(activeMappingDomain);
                  return [
                    {
                      id: 'face',
                      title:
                        activeMappingDomain !== 'TUNNEL'
                          ? `01. ${surfLabels.face.fullLabel}`
                          : geometry.excavationStage === 'TOP_HEADING' ||
                            geometry.excavationStage === 'top_heading'
                          ? `01. Tunnel Face (Top Heading — Bench ${(
                              geometry.benchHeightRemovedMeters || 0
                            ).toFixed(2)}m Removed)`
                          : '01. Tunnel Face',
                      desc:
                        activeMappingDomain !== 'TUNNEL'
                          ? surfLabels.face.description
                          : `Fits ${
                              geometry.customProfile?.name
                                ? `${geometry.customProfile.name} (${geometry.width}m × ${geometry.height}m)`
                                : `${geometry.width}m × ${geometry.height}m cross-section`
                            }`,
                      enabled: true,
                    },
                    {
                      id: 'leftWall',
                      title:
                        activeMappingDomain !== 'TUNNEL'
                          ? `02. ${surfLabels.leftWall.fullLabel}`
                          : geometry.excavationStage === 'TOP_HEADING' ||
                            geometry.excavationStage === 'top_heading'
                          ? '02. Left Wall (Top Heading)'
                          : '02. Left Wall',
                      desc:
                        activeMappingDomain !== 'TUNNEL'
                          ? surfLabels.leftWall.description
                          : `Fits ${settings.roundLength}m pull × ${(
                              geometry.leftWallArcLength ??
                              geometry.leftWallHeight ??
                              geometry.wallHeight
                            ).toFixed(2)}m left wall`,
                      enabled: geometry.hasLeftWall !== false,
                    },
                    {
                      id: 'rightWall',
                      title:
                        activeMappingDomain !== 'TUNNEL'
                          ? `03. ${surfLabels.rightWall.fullLabel}`
                          : geometry.excavationStage === 'TOP_HEADING' ||
                            geometry.excavationStage === 'top_heading'
                          ? '03. Right Wall (Top Heading)'
                          : '03. Right Wall',
                      desc:
                        activeMappingDomain !== 'TUNNEL'
                          ? surfLabels.rightWall.description
                          : `Fits ${settings.roundLength}m pull × ${(
                              geometry.rightWallArcLength ??
                              geometry.rightWallHeight ??
                              geometry.wallHeight
                            ).toFixed(2)}m right wall`,
                      enabled: geometry.hasRightWall !== false,
                    },
                    {
                      id: 'crown',
                      title:
                        activeMappingDomain !== 'TUNNEL'
                          ? `04. ${surfLabels.crown.fullLabel}`
                          : geometry.excavationStage === 'TOP_HEADING' ||
                            geometry.excavationStage === 'top_heading'
                          ? '04. Crown Arch (Top Heading)'
                          : '04. Crown Arch',
                      desc:
                        activeMappingDomain !== 'TUNNEL'
                          ? surfLabels.crown.description
                          : `Fits ${geometry.crownArcLength.toFixed(2)}m arch × ${
                              settings.roundLength
                            }m pull`,
                      enabled: geometry.hasCrown !== false,
                    },
                  ] as { id: SurfaceType; title: string; desc: string; enabled: boolean }[];
                })()
              )
                .filter((slot) => slot.enabled)
                .map((slot) => {
                  const surfPhoto = photos[slot.id];
                  const supPhotos = surfPhoto.supportingPhotos || [];
                  const isCurrentPortion = activeSurface === slot.id;
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setActiveSurface(slot.id)}
                      className={`${layoutStyles.sectionSurface} flex flex-col justify-between space-y-3 cursor-pointer border transition-all ${
                        isCurrentPortion
                          ? isLight
                            ? 'border-sky-500 ring-2 ring-sky-500/20'
                            : 'border-cyan-400 ring-2 ring-cyan-400/20'
                          : isLight
                          ? 'border-slate-200/80 hover:border-sky-300'
                          : 'border-slate-800/80 hover:border-cyan-700/60'
                      }`}
                    >
                      {/* Main Photo Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div
                            className={`flex items-center gap-2 text-xs font-semibold ${
                              isLight ? 'text-slate-900' : 'text-slate-100'
                            }`}
                          >
                            <span>{slot.title}</span>
                            {isCurrentPortion && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[10px] font-mono font-bold">
                                SELECTED PORTION
                              </span>
                            )}
                            {surfPhoto.image && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div
                            className={`text-[11px] font-mono ${
                              isLight ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            {slot.desc}
                          </div>
                          {surfPhoto.autoFitted && (
                            <div
                              className={`text-[11px] font-mono ${
                                isLight ? 'text-emerald-700' : 'text-emerald-400'
                              }`}
                            >
                              {surfPhoto.calibration
                                ? `${
                                    surfPhoto.calibration.source === 'EXIF_METADATA'
                                      ? 'EXIF Calibrated'
                                      : 'Estimated Cam'
                                  }: ${surfPhoto.calibration.focalLengthMm}mm eq · 3×3 Homography`
                                : 'Auto-fitted to master geometry'}
                            </div>
                          )}
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {surfPhoto.image && (
                            <div className="relative group">
                              <img
                                src={surfPhoto.image}
                                alt={`${slot.title} Main Photo`}
                                referrerPolicy="no-referrer"
                                className="w-12 h-10 object-cover rounded-lg border border-cyan-500/60 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMainPhoto(slot.id)}
                                title="Remove Main Photo"
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] hover:bg-rose-500 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                          {(responsive.isMobile || responsive.isTouchDevice) && (
                            <label
                              className="relative overflow-hidden flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs cursor-pointer whitespace-nowrap"
                              title="Select or capture tunnel surface photo"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Camera / Gallery</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setActiveSurface(slot.id);
                                    handleUploadSurfacePhoto(slot.id, f);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                          <label
                            className={`relative overflow-hidden px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              isLight
                                ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                                : 'bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border-cyan-700/70'
                            }`}
                          >
                            {surfPhoto.image ? 'Replace Photo' : 'Upload Photo'}
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  setActiveSurface(slot.id);
                                  handleUploadSurfacePhoto(slot.id, f);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSurface(slot.id);
                              onNavigateToMapping();
                            }}
                            className="px-2.5 py-2 rounded-xl text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer whitespace-nowrap"
                            title={`Open ${slot.title} directly in the Mapping Canvas`}
                          >
                            Map Portion →
                          </button>
                        </div>
                      </div>

                      {/* Additional Supporting Photos (0-5 Optional Supporting Evidence Only) */}
                      <div
                        className={`pt-2.5 border-t ${layoutStyles.hairlineDivider} flex flex-wrap items-center justify-between gap-2`}
                      >
                        <div
                          className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          Supporting Photos ({supPhotos.length}/5) ·{' '}
                          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
                            Verification only
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {supPhotos.map((sp, spIdx) => (
                            <div
                              key={sp.id}
                              className={`relative group flex items-center rounded-lg p-0.5 border ${
                                isLight
                                  ? 'bg-white border-slate-200'
                                  : 'bg-slate-950 border-slate-700'
                              }`}
                              title={`Supporting Photo #${spIdx + 1}: ${sp.fileName} (Baseline ${
                                sp.baselineMeters ?? 1.1
                              }m)`}
                            >
                              <img
                                src={sp.image}
                                alt={`Supporting ${spIdx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-8 h-7 object-cover rounded-md"
                              />
                              <label
                                title="Replace Supporting Photo"
                                className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-mono text-cyan-300 cursor-pointer rounded-lg transition-opacity overflow-hidden"
                              >
                                Repl
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadSupportingPhoto(slot.id, f, sp.id);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveSupportingPhoto(slot.id, sp.id)}
                                title="Remove Supporting Photo"
                                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-600 flex items-center justify-center z-10 cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}

                          {supPhotos.length < 5 && (
                            <label
                              className={`relative overflow-hidden flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                                isLight
                                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              <Plus className="w-3 h-3 text-emerald-500" />
                              Add Photo
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadSupportingPhoto(slot.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className={layoutStyles.footerRow}>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleSaveOfflineDraft} className={layoutStyles.secondaryButton}>
              <Save className={`w-3.5 h-3.5 ${isLight ? 'text-sky-600' : 'text-cyan-400'}`} />
              Save Draft
            </button>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {(
                (() => {
                  const surfLabels = getSurfacePanelLabelMap(activeMappingDomain);
                  return [
                    { id: 'face', label: `1. ${surfLabels.face.shortLabel}` },
                    { id: 'crown', label: `2. ${surfLabels.crown.shortLabel}` },
                    { id: 'leftWall', label: `3. ${surfLabels.leftWall.shortLabel}` },
                    { id: 'rightWall', label: `4. ${surfLabels.rightWall.shortLabel}` },
                  ] as { id: SurfaceType; label: string }[];
                })()
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveSurface(p.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    activeSurface === p.id
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={onNavigateToMapping} className={layoutStyles.primaryButton}>
            Open Mapping Canvas (
            {getSurfacePanelLabelMap(activeMappingDomain)[activeSurface]?.shortLabel || '1. Face'})
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {projectMemoryModalNode}
      <SimpleFullPhotoAndAccuracyModal
        isOpen={showPhotoScreenAccuracyModal}
        initialTab={photoScreenAccuracyTab}
        onClose={() => setShowPhotoScreenAccuracyModal(false)}
        geometry={geometry}
        settings={settings}
        photos={photos}
        activeSurface={activeSurface}
        joints={clusteredJoints}
        jointSets={jointSets}
        rmrParams={rmrParams}
        qIndexParams={qIndexParams}
        qParamStatus={qParamStatus}
        onApplyExtractedGeometryAndScale={onApplyExtractedGeometryAndScale}
        onUpdateJointsWithHistory={onUpdateJointsWithHistory}
        onUpdateRmrParams={onUpdateRmrParams}
        onUpdateQIndexParams={onUpdateQIndexParams}
        onUpdateQParamStatus={onUpdateQParamStatus}
        onStatusMessage={onStatusMessage}
      />
    </main>
  );
};
