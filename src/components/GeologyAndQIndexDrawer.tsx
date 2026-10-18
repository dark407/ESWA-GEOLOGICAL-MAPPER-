import React, { useMemo, useState } from 'react';
import {
  FailureModeSafetyRecord,
  GsiParameters,
  Joint,
  JointSet,
  OutputSheetMode,
  OverbreakUndercutAnalysis,
  ParameterInputStatus,
  QIndexParameters,
  QSystemParamKey,
  RmrMethodologyVersion,
  RmrParamKey,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  SavedProjectRecord,
  SpotBoltLocationRecord,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  computeRockStrataSupportSpotBoltingAndFailureFos,
} from '../engine/supportSpotBoltFailureEngine';
import {
  exportGeologyAndQIndexToCSV,
} from '../engine/photoWarpEngine';
import {
  buildLongitudinalChainageLog,
  computeEmpiricalSupportRecommendation,
  exportMappedGeologicalSheetToDXF,
  LongitudinalStationLogRow,
  triggerDownloadDXFSheet,
} from '../engine/kinematicsSupportAndDxfEngine';
import {
  downloadEngineeringSheetAsPDF,
  downloadEngineeringSheetAsWordDoc,
} from '../engine/pdfAndWordExportEngine';
import {
  calculateBieniawskiRmr,
  calculateHoekGsi,
  CLASSIFICATION_METHODS_REGISTRY,
  computeRmrRqdRating,
  computeRmrSpacingRating,
  computeRmrStrengthRating,
  createBlankQParamStatus,
  createBlankRmrParameters,
  evaluateQSystemWithValidation,
  GSI_STRUCTURE_OPTIONS,
  GSI_SURFACE_CONDITION_OPTIONS,
  RMR_CONDITION_OPTIONS,
  RMR_GROUNDWATER_OPTIONS,
  RMR_ORIENTATION_ADJUSTMENT_OPTIONS,
  RMR_RQD_OPTIONS,
  RMR_SPACING_OPTIONS,
  RMR_STRENGTH_OPTIONS,
  RMR_SUB_APERTURE_OPTIONS,
  RMR_SUB_INFILLING_OPTIONS,
  RMR_SUB_PERSISTENCE_OPTIONS,
  RMR_SUB_ROUGHNESS_OPTIONS,
  RMR_SUB_WEATHERING_OPTIONS,
  suggestQSystemWithConfirmation,
  suggestRmrFromMappedTraces,
} from '../engine/rockMassClassificationEngine';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useTheme,
} from '../context/ThemeContext';

interface GeologyAndQIndexDrawerProps {
  activeTab: 'geology_tables' | 'q_index';
  onChangeTab: (tab: 'geology_tables' | 'q_index') => void;
  onClose: () => void;
  fullPage?: boolean;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  activeSurface?: SurfaceType;
  joints: Joint[];
  jointSets: JointSet[];
  onUpdateJoints?: (nextJoints: Joint[]) => void;
  onUpdateJointSetAttribute: (setId: string, field: keyof JointSet, value: string) => void;
  onMergeJointSets: (fromSetId: string, toSetId: string) => void;
  qIndexParams: QIndexParameters;
  onUpdateQIndexParams: (next: QIndexParameters) => void;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  onUpdateQParamStatus: (next: Record<QSystemParamKey, ParameterInputStatus>) => void;
  selectedMethod: RockMassClassificationMethodId;
  onChangeSelectedMethod: (method: RockMassClassificationMethodId) => void;
  rmrParams: RmrParameters;
  onUpdateRmrParams: (next: RmrParameters) => void;
  gsiParams: GsiParameters;
  onUpdateGsiParams: (next: GsiParameters) => void;
  rockMassSummary: RockMassSummaryTable;
  onUpdateRockMassSummary: (next: RockMassSummaryTable) => void;
  onOpenExportSheet: (mode?: OutputSheetMode) => void;
  onOpenKinematics?: () => void;
  savedProjects?: SavedProjectRecord[];
  overbreakAnalysis?: OverbreakUndercutAnalysis;
}

const JN_OPTIONS = [
  { val: 0.75, label: '0.75 — Massive, no or few joints' },
  { val: 2, label: '2.0 — One joint set' },
  { val: 3, label: '3.0 — One joint set plus random joints' },
  { val: 4, label: '4.0 — Two joint sets' },
  { val: 6, label: '6.0 — Two joint sets plus random joints' },
  { val: 9, label: '9.0 — Three joint sets' },
  { val: 12, label: '12.0 — Three joint sets plus random joints' },
  { val: 15, label: '15.0 — Four or more joint sets, heavily jointed' },
  { val: 20, label: '20.0 — Crushed rock, earth-like' },
];

const JR_OPTIONS = [
  { val: 4.0, label: '4.0 — Discontinuous joints' },
  { val: 3.0, label: '3.0 — Rough or irregular, undulating' },
  { val: 2.0, label: '2.0 — Smooth, undulating' },
  { val: 1.5, label: '1.5 — Slickensided undulating OR Rough/irregular planar' },
  { val: 1.0, label: '1.0 — Smooth, planar OR No rock-wall contact when sheared' },
  { val: 0.5, label: '0.5 — Slickensided, planar' },
];

const JA_OPTIONS = [
  { val: 0.75, label: '0.75 — Tightly healed, hard, non-softening impermeable filling' },
  { val: 1.0, label: '1.0 — Unaltered joint walls, surface staining only' },
  { val: 2.0, label: '2.0 — Slightly altered joint walls, non-softening mineral coatings' },
  { val: 3.0, label: '3.0 — Silty or sandy-clay coatings, small clay fraction' },
  { val: 4.0, label: '4.0 — Softening or low-friction clay/chlorite/talc coatings (1–2 mm)' },
  { val: 6.0, label: '6.0 — Strongly over-consolidated non-softening clay filling (< 5 mm)' },
  { val: 8.0, label: '8.0 — Medium or low over-consolidation softening clay filling (< 5 mm)' },
  { val: 10.0, label: '10.0 — Swelling clay fillings OR Thick crushed clay zone' },
  { val: 15.0, label: '15.0 — Thick continuous bands of clay / gouge (Ja = 15)' },
];

const JW_OPTIONS = [
  { val: 1.0, label: '1.0 — Dry excavations or minor inflow (< 5 L/min locally)' },
  { val: 0.66, label: '0.66 — Medium inflow or pressure, occasional outwash of fillings' },
  { val: 0.5, label: '0.50 — Large inflow or high pressure in competent rock with unfilled joints' },
  { val: 0.33, label: '0.33 — Large inflow or high pressure with considerable outwash of fillings' },
  { val: 0.15, label: '0.15 — Exceptionally high inflow or water pressure at excavation, decaying' },
  { val: 0.08, label: '0.08 — Exceptionally high continuing water inflow / pressure' },
];

const SRF_OPTIONS = [
  { val: 1.0, label: '1.0 — Competent rock, medium stress, favorable stress condition' },
  { val: 2.5, label: '2.5 — Single shear zone in competent rock (excavation depth > 50m)' },
  { val: 5.0, label: '5.0 — Single weakness zone with clay OR depth <= 50m OR loose open joints' },
  { val: 7.5, label: '7.5 — Multiple shear zones in competent rock (clay-free), loose rock' },
  {
    val: 10.0,
    label: '10.0 — Multiple occurrences of weakness zones containing clay / chemically disintegrated rock',
  },
  { val: 15.0, label: '15.0 — Mild to Heavy squeezing rock pressure or slabbing' },
  { val: 20.0, label: '20.0 — Heavy squeezing or swelling rock pressure' },
];

const GeologyAndQIndexDrawerComponent: React.FC<GeologyAndQIndexDrawerProps> = ({
  activeTab,
  onChangeTab,
  onClose,
  fullPage = false,
  geometry,
  settings,
  activeSurface = 'face',
  joints,
  jointSets,
  onUpdateJoints,
  onUpdateJointSetAttribute,
  onMergeJointSets,
  qIndexParams,
  onUpdateQIndexParams,
  qParamStatus,
  onUpdateQParamStatus,
  selectedMethod,
  onChangeSelectedMethod,
  rmrParams,
  onUpdateRmrParams,
  gsiParams,
  onUpdateGsiParams,
  rockMassSummary,
  onUpdateRockMassSummary,
  onOpenExportSheet,
  onOpenKinematics,
  savedProjects = [],
  overbreakAnalysis,
}) => {
  const [mergeSourceSet, setMergeSourceSet] = useState<string>('J2');
  const [mergeTargetSet, setMergeTargetSet] = useState<string>('J1');
  const [classificationSubView, setClassificationSubView] = useState<
    'parameters' | 'support_chart' | 'chainage_log' | 'support_spotbolt_fos'
  >('parameters');
  const [demoAlignmentStations, setDemoAlignmentStations] = useState<LongitudinalStationLogRow[] | null>(
    null
  );
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const qResult = evaluateQSystemWithValidation(qIndexParams, geometry.width, qParamStatus);
  const rmrResult = calculateBieniawskiRmr(rmrParams);
  const gsiResult = calculateHoekGsi(gsiParams);

  const supportAndFos = useMemo(
    () =>
      computeRockStrataSupportSpotBoltingAndFailureFos(
        geometry,
        settings,
        joints,
        jointSets,
        qIndexParams,
        rmrParams,
        rockMassSummary,
        overbreakAnalysis,
        savedProjects
      ),
    [
      geometry,
      settings,
      joints,
      jointSets,
      qIndexParams,
      rmrParams,
      rockMassSummary,
      overbreakAnalysis,
      savedProjects,
    ]
  );

  const updateSupportOverrides = (
    patch: Partial<NonNullable<RockMassSummaryTable['supportSystemOverrides']>>
  ) => {
    const nextOverrides = {
      ...(rockMassSummary.supportSystemOverrides || {}),
      ...patch,
    };
    const nextBoltLen =
      nextOverrides.systematicBoltLengthM ?? supportAndFos.systematicBoltLengthM;
    const nextBoltSp =
      nextOverrides.systematicBoltSpacingM ?? supportAndFos.systematicBoltSpacingM;
    const nextShotcrete =
      nextOverrides.shotcreteThicknessMm ?? supportAndFos.shotcreteThicknessMm;
    const nextRibs =
      nextOverrides.steelRibsPrescription ?? supportAndFos.steelRibsPrescription;
    const nextSpotCount = (
      nextOverrides.spotBoltLocations ?? supportAndFos.spotBoltLocations
    ).reduce((acc, s) => acc + s.boltsRequired, 0);

    onUpdateRockMassSummary({
      ...rockMassSummary,
      installedSupport: `Bolts L=${nextBoltLen}m @ ${nextBoltSp}m c/c + ${nextShotcrete}mm Sfr + ${nextSpotCount} Spot Bolts (${nextRibs})`,
      supportSystemOverrides: nextOverrides,
    });
  };

  const handleUpdateSpotBoltRow = (
    id: string,
    patch: Partial<SpotBoltLocationRecord>
  ) => {
    const currentList =
      rockMassSummary.supportSystemOverrides?.spotBoltLocations ||
      supportAndFos.spotBoltLocations;
    const nextList = currentList.map((row) =>
      row.id === id ? { ...row, ...patch, isUserModified: true } : row
    );
    updateSupportOverrides({ spotBoltLocations: nextList });
  };

  const handleAddCustomSpotBoltLocation = () => {
    const currentList =
      rockMassSummary.supportSystemOverrides?.spotBoltLocations ||
      supportAndFos.spotBoltLocations;
    const nextIdx = currentList.length + 1;
    const newSpot: SpotBoltLocationRecord = {
      id: `spot-user-${Date.now()}`,
      sectorLabel: `Crown / Shoulder Sector #${nextIdx}`,
      locationSector: `Crown / Shoulder Sector #${nextIdx}`,
      surface: activeSurface,
      coordinateX: 0.0,
      coordinateY: Number((geometry.height * 0.85).toFixed(2)),
      xMeters: 0.0,
      yMeters: Number((geometry.height * 0.85).toFixed(2)),
      boltsRequired: 3,
      boltLengthMeters: supportAndFos.systematicBoltLengthM,
      boltDiameterMm: 25,
      boltCapacityKn: 200,
      installationAngleDeg: 15,
      inclinationDeg: 15,
      linkedJointSets: jointSets.slice(0, 2).map((s) => s.id).join(' + ') || 'J1 + J2',
      controllingJointSets: jointSets.slice(0, 2).map((s) => s.id).join(' + ') || 'J1 + J2',
      reasonChosen:
        'User-specified local rock block / wedge pinning reinforcement.',
      aiReasonForChoice:
        'User-specified local rock block / wedge pinning reinforcement.',
      historicalReference: `Historical Pulls Avg: ${supportAndFos.historicalAvgSpotBoltsPerPull} spot bolts/pull`,
      historicalReferenceSummary: `Historical Pulls Avg: ${supportAndFos.historicalAvgSpotBoltsPerPull} spot bolts/pull`,
      userModified: true,
      isUserModified: true,
    };
    updateSupportOverrides({ spotBoltLocations: [...currentList, newSpot] });
  };

  const handleDeleteSpotBoltLocation = (id: string) => {
    const currentList =
      rockMassSummary.supportSystemOverrides?.spotBoltLocations ||
      supportAndFos.spotBoltLocations;
    updateSupportOverrides({
      spotBoltLocations: currentList.filter((r) => r.id !== id),
    });
  };

  const handleUpdateFailureModeRow = (
    id: string,
    patch: Partial<FailureModeSafetyRecord>
  ) => {
    const currentModes =
      rockMassSummary.supportSystemOverrides?.failureModes ||
      supportAndFos.failureModes;
    const nextModes = currentModes.map((fm) => {
      if (fm.id !== id) return fm;
      const updated = { ...fm, ...patch, isUserModified: true };
      if (patch.recommendedExtraBolts !== undefined) {
        const extraResist =
          patch.recommendedExtraBolts * supportAndFos.systematicBoltCapacityKn * 0.85;
        updated.supportedResistingForceKn = Number(
          (fm.resistingForceKn + extraResist).toFixed(1)
        );
        updated.supportedFactorOfSafety = Number(
          (
            updated.supportedResistingForceKn / Math.max(1, fm.drivingForceKn)
          ).toFixed(2)
        );
        updated.stabilityStatus =
          updated.supportedFactorOfSafety >= updated.requiredTargetFos
            ? 'STABLE'
            : updated.supportedFactorOfSafety >= 1.15
            ? 'MARGINAL'
            : 'CRITICAL_UNSTABLE';
      }
      return updated;
    });
    updateSupportOverrides({ failureModes: nextModes });
  };

  const handleDownloadCSV = () => {
    const baseCsv = exportGeologyAndQIndexToCSV(
      geometry,
      settings,
      joints,
      jointSets,
      qIndexParams,
      rockMassSummary
    );
    const classificationLines = [
      '',
      '=== STATION ROCK MASS CLASSIFICATION RECORD ===',
      `Project / Tunnel,${settings.tunnelName}`,
      `Location,${settings.location}`,
      `Station / Face Chainage,${settings.faceChainage}`,
      `Surface / Section,${activeSurface.toUpperCase()}`,
      `Selected Classification Method,${selectedMethod}`,
      `RMR Version,${rmrParams.version}`,
      `RMR Basic Score,${rmrResult.basicRmr !== null ? rmrResult.basicRmr : 'Required input not available'}`,
      `RMR Orientation Adjustment,${rmrResult.orientationAdjustment !== null ? rmrResult.orientationAdjustment : 'Required input not available'}`,
      `Final RMR,${rmrResult.finalRmr !== null ? rmrResult.finalRmr : 'Required input not available'}`,
      `RMR Classification,${rmrResult.rockMassClassLabel}`,
      `Q-System Value,${qResult.isComplete ? qResult.qValue.toFixed(3) : 'Required input not available'}`,
      `Q-System Classification,${qResult.isComplete ? qResult.rockMassClass : 'Required input not available'}`,
      `GSI Value,${gsiResult.gsiValue !== null ? gsiResult.gsiValue : 'Required input not available'}`,
    ].join('\n');

    const blob = new Blob([baseCsv + '\n' + classificationLines], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(
      /\s+/g,
      '_'
    )}_classification.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper badge for parameter input status
  const renderParamStatusBadge = (
    status: ParameterInputStatus,
    onConfirmSuggestion: () => void,
    onMarkMissing: () => void
  ) => {
    if (status === 'MISSING') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-500/60 text-rose-200 text-[9px] font-bold">
          <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
          Required input not available
        </span>
      );
    }
    if (status === 'AI_SUGGESTED_UNCONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-200 text-[9px] font-bold">
            AI SUGGESTION — CONFIRM?
          </span>
          <button
            type="button"
            onClick={onConfirmSuggestion}
            className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold flex items-center gap-0.5"
            title="Confirm this suggested parameter value"
          >
            <Check className="w-2.5 h-2.5" />
            Confirm
          </button>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1">
        <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 text-[9px] font-semibold">
          CONFIRMED
        </span>
        <button
          type="button"
          onClick={onMarkMissing}
          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-[9px]"
          title="Clear value (set as 'Required input not available')"
        >
          Clear
        </button>
      </span>
    );
  };

  const setRmrParamConfirmed = (key: RmrParamKey, partial: Partial<RmrParameters>) => {
    const nextStatus = {
      ...rmrParams.paramStatus,
      [key]: 'USER_ENTERED' as ParameterInputStatus,
    };
    const allConfirmed = (Object.values(nextStatus) as ParameterInputStatus[]).every(
      (s) => s === 'USER_ENTERED' || s === 'USER_CONFIRMED'
    );
    onUpdateRmrParams({
      ...rmrParams,
      ...partial,
      paramStatus: nextStatus,
      userConfirmed: allConfirmed,
      confirmedAt: allConfirmed ? new Date().toISOString() : rmrParams.confirmedAt,
    });
  };

  const setRmrParamMissing = (key: RmrParamKey) => {
    const nextStatus = {
      ...rmrParams.paramStatus,
      [key]: 'MISSING' as ParameterInputStatus,
    };
    const partial: Partial<RmrParameters> = {};
    if (key === 'intactStrength') {
      partial.intactStrengthValueMPa = null;
      partial.intactStrengthRating = null;
      partial.intactStrengthDescription = 'Required input not available';
    } else if (key === 'rqd') {
      partial.rqdPercent = null;
      partial.rqdRating = null;
      partial.rqdDescription = 'Required input not available';
    } else if (key === 'spacing') {
      partial.spacingMeters = null;
      partial.spacingRating = null;
      partial.spacingDescription = 'Required input not available';
    } else if (key === 'condition') {
      partial.conditionRating = null;
      partial.conditionDescription = 'Required input not available';
    } else if (key === 'groundwater') {
      partial.groundwaterInflowLPerMin10m = null;
      partial.groundwaterRating = null;
      partial.groundwaterDescription = 'Required input not available';
    } else if (key === 'orientationAdjustment') {
      partial.orientationFavourability = 'Not Assessed';
      partial.orientationAdjustmentRating = null;
    }
    onUpdateRmrParams({
      ...rmrParams,
      ...partial,
      paramStatus: nextStatus,
      userConfirmed: false,
    });
  };

  const confirmAllRmrSuggestions = () => {
    const nextStatus = { ...rmrParams.paramStatus };
    (Object.keys(nextStatus) as RmrParamKey[]).forEach((k) => {
      if (nextStatus[k] === 'AI_SUGGESTED_UNCONFIRMED') {
        nextStatus[k] = 'USER_CONFIRMED';
      }
    });
    onUpdateRmrParams({
      ...rmrParams,
      paramStatus: nextStatus,
      userConfirmed: (Object.values(nextStatus) as ParameterInputStatus[]).every(
        (s) => s === 'USER_ENTERED' || s === 'USER_CONFIRMED'
      ),
      confirmedAt: new Date().toISOString(),
    });
  };

  const setQParamConfirmed = (key: QSystemParamKey, partial: Partial<QIndexParameters>) => {
    const nextStatus = {
      ...qParamStatus,
      [key]: 'USER_ENTERED' as ParameterInputStatus,
    };
    onUpdateQParamStatus(nextStatus);
    onUpdateQIndexParams({
      ...qIndexParams,
      ...partial,
      userConfirmed: (Object.values(nextStatus) as ParameterInputStatus[]).every(
        (s) => s === 'USER_ENTERED' || s === 'USER_CONFIRMED'
      ),
      confirmedAt: new Date().toISOString(),
    });
  };

  const confirmAllQSuggestions = () => {
    const nextStatus = { ...qParamStatus };
    (Object.keys(nextStatus) as QSystemParamKey[]).forEach((k) => {
      if (nextStatus[k] === 'AI_SUGGESTED_UNCONFIRMED') {
        nextStatus[k] = 'USER_CONFIRMED';
      }
    });
    onUpdateQParamStatus(nextStatus);
    onUpdateQIndexParams({
      ...qIndexParams,
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
    });
  };

  // Summary badge string for tab button
  const getMethodSummaryBadge = () => {
    if (selectedMethod === 'RMR') {
      return rmrResult.isComplete && rmrResult.finalRmr !== null
        ? `${rmrParams.version} = ${rmrResult.finalRmr} · ${rmrResult.rockMassClassLabel}`
        : `${rmrParams.version}: Required input not available`;
    }
    if (selectedMethod === 'Q_SYSTEM') {
      return qResult.isComplete
        ? `Q = ${qResult.qValue.toFixed(2)} · ${qResult.rockQualityCategory}`
        : `Q-System: Required input not available`;
    }
    if (selectedMethod === 'BOTH_RMR_AND_Q') {
      const rmrStr =
        rmrResult.isComplete && rmrResult.finalRmr !== null
          ? `RMR=${rmrResult.finalRmr}`
          : 'RMR=Incomplete';
      const qStr = qResult.isComplete ? `Q=${qResult.qValue.toFixed(2)}` : 'Q=Incomplete';
      return `DUAL: ${rmrStr} | ${qStr}`;
    }
    return gsiResult.isComplete && gsiResult.gsiValue !== null
      ? `GSI = ${gsiResult.gsiValue} (${gsiResult.gsiRangeLabel})`
      : `GSI: Required input not available`;
  };

  // Render RMR Editor & Result Section
  const renderRmrSection = (compact = false) => (
    <div className="space-y-2.5">
      {/* RMR Method Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-indigo-500/40 rounded px-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">
            METHOD: BIENIAWSKI RMR
          </span>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">Version:</span>
            {(['RMR89', 'RMR76'] as RmrMethodologyVersion[]).map((ver) => (
              <button
                key={ver}
                type="button"
                onClick={() => {
                  const nextSpacingRating =
                    rmrParams.spacingMeters !== null
                      ? computeRmrSpacingRating(rmrParams.spacingMeters, ver)
                      : rmrParams.spacingRating;
                  onUpdateRmrParams({
                    ...rmrParams,
                    version: ver,
                    spacingRating: nextSpacingRating,
                  });
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  rmrParams.version === ver
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {ver === 'RMR89' ? 'RMR89 (1989 Standard)' : 'RMR76 (1976 Standard)'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {rmrResult.hasUnconfirmedSuggestions && (
            <button
              type="button"
              onClick={confirmAllRmrSuggestions}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
            >
              <ShieldCheck className="w-3 h-3" />
              Confirm All AI Suggestions ({rmrResult.unconfirmedParamLabels.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const suggested = suggestRmrFromMappedTraces(
                joints,
                jointSets,
                geometry,
                settings,
                rockMassSummary,
                rmrParams
              );
              onUpdateRmrParams(suggested);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/40 text-[10px] font-semibold"
            title="Suggest RMR parameters from mapped discontinuity traces (flagged as suggestions requiring your confirmation)"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Suggest RMR from Mapped Traces
          </button>
          <button
            type="button"
            onClick={() => onUpdateRmrParams(createBlankRmrParameters(rmrParams.version))}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px]"
            title="Clear all RMR inputs to 'Required input not available'"
          >
            <RotateCcw className="w-3 h-3" />
            Set Inputs Unassessed
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'xl:grid-cols-12'} gap-3`}>
        {/* 6 RMR Input Parameter Cards */}
        <div
          className={`${
            compact ? 'lg:col-span-8' : 'xl:col-span-8'
          } grid grid-cols-1 md:grid-cols-3 gap-2`}
        >
          {/* A1. Strength of Intact Rock Material */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">
                A1. Intact Rock Strength
              </span>
              <span className="text-white font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60">
                R1 ={' '}
                {rmrResult.r1StrengthRating !== null
                  ? `${rmrResult.r1StrengthRating} / 15`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.intactStrength,
                () => setRmrParamConfirmed('intactStrength', {}),
                () => setRmrParamMissing('intactStrength')
              )}
              <span className="text-[10px] text-slate-400">
                {rmrParams.intactStrengthValueMPa !== null
                  ? `${rmrParams.intactStrengthValueMPa} MPa`
                  : 'Missing'}
              </span>
            </div>

            <select
              value={rmrParams.intactStrengthRating ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setRmrParamMissing('intactStrength');
                  return;
                }
                const rVal = Number(e.target.value);
                const opt = RMR_STRENGTH_OPTIONS.find((o) => o.rating89 === rVal);
                setRmrParamConfirmed('intactStrength', {
                  intactStrengthRating: rVal,
                  intactStrengthValueMPa: opt ? opt.representativeNum : 75,
                  intactStrengthDescription: opt ? opt.valueLabel : `Rating ${rVal}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {RMR_STRENGTH_OPTIONS.map((opt) => (
                <option key={opt.rating89} value={opt.rating89}>
                  [Rating {opt.rating89}] {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-400">Exact UCS (MPa):</span>
              <input
                type="number"
                min="0"
                max="400"
                step="1"
                placeholder="Enter MPa"
                value={rmrParams.intactStrengthValueMPa ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setRmrParamMissing('intactStrength');
                    return;
                  }
                  const val = Math.max(0, Number(e.target.value));
                  const rating = computeRmrStrengthRating(val, rmrParams.strengthInputType);
                  setRmrParamConfirmed('intactStrength', {
                    intactStrengthValueMPa: val,
                    intactStrengthRating: rating,
                    intactStrengthDescription: `UCS = ${val} MPa`,
                  });
                }}
                className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          {/* A2. Rock Quality Designation (RQD %) */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">A2. RQD (%)</span>
              <span className="text-white font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60">
                R2 = {rmrResult.r2RqdRating !== null ? `${rmrResult.r2RqdRating} / 20` : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.rqd,
                () => setRmrParamConfirmed('rqd', {}),
                () => setRmrParamMissing('rqd')
              )}
              <span className="text-[10px] text-slate-300 font-bold">
                {rmrParams.rqdPercent !== null ? `${rmrParams.rqdPercent}%` : 'Missing'}
              </span>
            </div>

            <select
              value={rmrParams.rqdRating ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setRmrParamMissing('rqd');
                  return;
                }
                const rVal = Number(e.target.value);
                const opt = RMR_RQD_OPTIONS.find((o) => o.rating89 === rVal);
                setRmrParamConfirmed('rqd', {
                  rqdRating: rVal,
                  rqdPercent: opt ? opt.representativeNum : 65,
                  rqdDescription: opt ? opt.valueLabel : `RQD Rating ${rVal}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {RMR_RQD_OPTIONS.map((opt) => (
                <option key={opt.rating89} value={opt.rating89}>
                  [Rating {opt.rating89}] {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">Exact RQD %:</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0-100%"
                value={rmrParams.rqdPercent ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setRmrParamMissing('rqd');
                    return;
                  }
                  const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                  const rating = computeRmrRqdRating(pct);
                  setRmrParamConfirmed('rqd', {
                    rqdPercent: pct,
                    rqdRating: rating,
                    rqdDescription: `${pct}%`,
                  });
                }}
                className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          {/* A3. Spacing of Discontinuities */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">
                A3. Discontinuity Spacing
              </span>
              <span className="text-white font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60">
                R3 ={' '}
                {rmrResult.r3SpacingRating !== null
                  ? `${rmrResult.r3SpacingRating} / ${rmrParams.version === 'RMR89' ? 20 : 30}`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.spacing,
                () => setRmrParamConfirmed('spacing', {}),
                () => setRmrParamMissing('spacing')
              )}
              <span className="text-[10px] text-slate-300">
                {rmrParams.spacingMeters !== null ? `${rmrParams.spacingMeters} m` : 'Missing'}
              </span>
            </div>

            <select
              value={rmrParams.spacingRating ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setRmrParamMissing('spacing');
                  return;
                }
                const rVal = Number(e.target.value);
                const opt = RMR_SPACING_OPTIONS.find(
                  (o) => (rmrParams.version === 'RMR89' ? o.rating89 : o.rating76) === rVal
                );
                setRmrParamConfirmed('spacing', {
                  spacingRating: rVal,
                  spacingMeters: opt ? opt.representativeNum : 0.35,
                  spacingDescription: opt ? opt.valueLabel : `Rating ${rVal}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {RMR_SPACING_OPTIONS.map((opt) => {
                const r = rmrParams.version === 'RMR89' ? opt.rating89 : opt.rating76;
                return (
                  <option key={opt.label} value={r}>
                    [Rating {r}] {opt.label}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">Spacing (m):</span>
              <input
                type="number"
                min="0.01"
                max="10"
                step="0.05"
                placeholder="e.g. 0.35"
                value={rmrParams.spacingMeters ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setRmrParamMissing('spacing');
                    return;
                  }
                  const sp = Math.max(0.01, Number(e.target.value));
                  const rating = computeRmrSpacingRating(sp, rmrParams.version);
                  setRmrParamConfirmed('spacing', {
                    spacingMeters: sp,
                    spacingRating: rating,
                    spacingDescription: `${sp} m`,
                  });
                }}
                className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          {/* A4. Condition of Discontinuities */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">
                A4. Discontinuity Condition
              </span>
              <span className="text-white font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60">
                R4 ={' '}
                {rmrResult.r4ConditionRating !== null
                  ? `${rmrResult.r4ConditionRating} / ${rmrParams.version === 'RMR89' ? 30 : 25}`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.condition,
                () => setRmrParamConfirmed('condition', {}),
                () => setRmrParamMissing('condition')
              )}
              <label className="flex items-center gap-1 text-[9px] text-cyan-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(rmrParams.conditionSubRatings?.useDetailedSubRatings)}
                  onChange={(e) => {
                    const useSub = e.target.checked;
                    const sub = rmrParams.conditionSubRatings || {
                      useDetailedSubRatings: false,
                      persistenceRating: 4,
                      persistenceValue: '1 - 3 m',
                      apertureRating: 4,
                      apertureValue: '0.1 - 1.0 mm',
                      roughnessRating: 5,
                      roughnessValue: 'Rough',
                      infillingRating: 4,
                      infillingValue: 'Hard filling < 5 mm',
                      weatheringRating: 5,
                      weatheringValue: 'Slightly weathered',
                    };
                    const sum =
                      sub.persistenceRating +
                      sub.apertureRating +
                      sub.roughnessRating +
                      sub.infillingRating +
                      sub.weatheringRating;
                    setRmrParamConfirmed('condition', {
                      conditionRating: useSub ? sum : rmrParams.conditionRating ?? 25,
                      conditionSubRatings: {
                        ...sub,
                        useDetailedSubRatings: useSub,
                      },
                    });
                  }}
                  className="rounded border-slate-700 bg-slate-900"
                />
                5-Subparam Table
              </label>
            </div>

            {!rmrParams.conditionSubRatings?.useDetailedSubRatings ? (
              <select
                value={rmrParams.conditionRating ?? ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setRmrParamMissing('condition');
                    return;
                  }
                  const rVal = Number(e.target.value);
                  const opt = RMR_CONDITION_OPTIONS.find(
                    (o) => (rmrParams.version === 'RMR89' ? o.rating89 : o.rating76) === rVal
                  );
                  setRmrParamConfirmed('condition', {
                    conditionRating: rVal,
                    conditionDescription: opt ? opt.valueLabel : `Condition Rating ${rVal}`,
                  });
                }}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
              >
                <option value="">-- Required input not available --</option>
                {RMR_CONDITION_OPTIONS.map((opt) => {
                  const r = rmrParams.version === 'RMR89' ? opt.rating89 : opt.rating76;
                  return (
                    <option key={opt.label} value={r}>
                      [Rating {r}] {opt.label}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <select
                  value={rmrParams.conditionSubRatings.persistenceRating}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const opt = RMR_SUB_PERSISTENCE_OPTIONS.find((o) => o.rating === r);
                    const nextSub = {
                      ...rmrParams.conditionSubRatings,
                      persistenceRating: r,
                      persistenceValue: opt?.label || '',
                    };
                    setRmrParamConfirmed('condition', {
                      conditionSubRatings: nextSub,
                      conditionRating:
                        nextSub.persistenceRating +
                        nextSub.apertureRating +
                        nextSub.roughnessRating +
                        nextSub.infillingRating +
                        nextSub.weatheringRating,
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                  title="Persistence (0-6)"
                >
                  {RMR_SUB_PERSISTENCE_OPTIONS.map((o) => (
                    <option key={o.label} value={o.rating}>
                      Len [{o.rating}]: {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rmrParams.conditionSubRatings.apertureRating}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const opt = RMR_SUB_APERTURE_OPTIONS.find((o) => o.rating === r);
                    const nextSub = {
                      ...rmrParams.conditionSubRatings,
                      apertureRating: r,
                      apertureValue: opt?.label || '',
                    };
                    setRmrParamConfirmed('condition', {
                      conditionSubRatings: nextSub,
                      conditionRating:
                        nextSub.persistenceRating +
                        nextSub.apertureRating +
                        nextSub.roughnessRating +
                        nextSub.infillingRating +
                        nextSub.weatheringRating,
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                  title="Aperture (0-6)"
                >
                  {RMR_SUB_APERTURE_OPTIONS.map((o) => (
                    <option key={o.label} value={o.rating}>
                      Aper [{o.rating}]: {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rmrParams.conditionSubRatings.roughnessRating}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const opt = RMR_SUB_ROUGHNESS_OPTIONS.find((o) => o.rating === r);
                    const nextSub = {
                      ...rmrParams.conditionSubRatings,
                      roughnessRating: r,
                      roughnessValue: opt?.label || '',
                    };
                    setRmrParamConfirmed('condition', {
                      conditionSubRatings: nextSub,
                      conditionRating:
                        nextSub.persistenceRating +
                        nextSub.apertureRating +
                        nextSub.roughnessRating +
                        nextSub.infillingRating +
                        nextSub.weatheringRating,
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                  title="Roughness (0-6)"
                >
                  {RMR_SUB_ROUGHNESS_OPTIONS.map((o) => (
                    <option key={o.label} value={o.rating}>
                      Rough [{o.rating}]: {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rmrParams.conditionSubRatings.infillingRating}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const opt = RMR_SUB_INFILLING_OPTIONS.find((o) => o.rating === r);
                    const nextSub = {
                      ...rmrParams.conditionSubRatings,
                      infillingRating: r,
                      infillingValue: opt?.label || '',
                    };
                    setRmrParamConfirmed('condition', {
                      conditionSubRatings: nextSub,
                      conditionRating:
                        nextSub.persistenceRating +
                        nextSub.apertureRating +
                        nextSub.roughnessRating +
                        nextSub.infillingRating +
                        nextSub.weatheringRating,
                    });
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                  title="Infilling (0-6)"
                >
                  {RMR_SUB_INFILLING_OPTIONS.map((o) => (
                    <option key={o.label} value={o.rating}>
                      Infill [{o.rating}]: {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rmrParams.conditionSubRatings.weatheringRating}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    const opt = RMR_SUB_WEATHERING_OPTIONS.find((o) => o.rating === r);
                    const nextSub = {
                      ...rmrParams.conditionSubRatings,
                      weatheringRating: r,
                      weatheringValue: opt?.label || '',
                    };
                    setRmrParamConfirmed('condition', {
                      conditionSubRatings: nextSub,
                      conditionRating:
                        nextSub.persistenceRating +
                        nextSub.apertureRating +
                        nextSub.roughnessRating +
                        nextSub.infillingRating +
                        nextSub.weatheringRating,
                    });
                  }}
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                  title="Weathering (0-6)"
                >
                  {RMR_SUB_WEATHERING_OPTIONS.map((o) => (
                    <option key={o.label} value={o.rating}>
                      Weathering [{o.rating}]: {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* A5. Groundwater Conditions */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">A5. Groundwater</span>
              <span className="text-white font-bold text-xs px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60">
                R5 ={' '}
                {rmrResult.r5GroundwaterRating !== null
                  ? `${rmrResult.r5GroundwaterRating} / ${rmrParams.version === 'RMR89' ? 15 : 10}`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.groundwater,
                () => setRmrParamConfirmed('groundwater', {}),
                () => setRmrParamMissing('groundwater')
              )}
              <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                {rmrParams.groundwaterDescription}
              </span>
            </div>

            <select
              value={rmrParams.groundwaterRating ?? ''}
              onChange={(e) => {
                if (e.target.value === '') {
                  setRmrParamMissing('groundwater');
                  return;
                }
                const rVal = Number(e.target.value);
                const opt = RMR_GROUNDWATER_OPTIONS.find(
                  (o) => (rmrParams.version === 'RMR89' ? o.rating89 : o.rating76) === rVal
                );
                setRmrParamConfirmed('groundwater', {
                  groundwaterRating: rVal,
                  groundwaterInflowLPerMin10m: opt ? opt.representativeNum : 5,
                  groundwaterDescription: opt ? opt.valueLabel : `Rating ${rVal}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {RMR_GROUNDWATER_OPTIONS.map((opt) => {
                const r = rmrParams.version === 'RMR89' ? opt.rating89 : opt.rating76;
                return (
                  <option key={opt.label} value={r}>
                    [Rating {r}] {opt.label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* B. Discontinuity Orientation Adjustment */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-indigo-300 font-bold text-[11px]">
                B. Orientation Adjustment
              </span>
              <span className="text-amber-300 font-bold text-xs px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-700/60">
                Adj ={' '}
                {rmrResult.orientationAdjustment !== null
                  ? `${rmrResult.orientationAdjustment}`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                rmrParams.paramStatus.orientationAdjustment,
                () => setRmrParamConfirmed('orientationAdjustment', {}),
                () => setRmrParamMissing('orientationAdjustment')
              )}
              <span className="text-[10px] text-slate-300">
                {rmrParams.orientationFavourability}
              </span>
            </div>

            <select
              value={
                rmrParams.orientationAdjustmentRating !== null
                  ? String(rmrParams.orientationAdjustmentRating)
                  : ''
              }
              onChange={(e) => {
                if (e.target.value === '') {
                  setRmrParamMissing('orientationAdjustment');
                  return;
                }
                const adj = Number(e.target.value);
                const opt = RMR_ORIENTATION_ADJUSTMENT_OPTIONS.find(
                  (o) => o.adjustmentTunnel === adj
                );
                setRmrParamConfirmed('orientationAdjustment', {
                  orientationAdjustmentRating: adj,
                  orientationFavourability: opt ? opt.favourability : 'Fair',
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {RMR_ORIENTATION_ADJUSTMENT_OPTIONS.map((opt) => (
                <option key={opt.favourability} value={opt.adjustmentTunnel}>
                  [{opt.favourability}] {opt.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right 4 Columns: RMR Calculation Summary & Classification Result Card */}
        <div
          className={`${
            compact ? 'lg:col-span-4' : 'xl:col-span-4'
          } p-3 bg-slate-950 border border-indigo-500/50 rounded flex flex-col justify-between space-y-2`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-[10px] text-indigo-300 font-bold">
                BIENIAWSKI ROCK MASS RATING ({rmrParams.version})
              </div>
              {rmrResult.isComplete && rmrResult.finalRmr !== null ? (
                <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>RMR = {rmrResult.finalRmr}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-semibold text-white"
                    style={{ backgroundColor: rmrResult.colorHex }}
                  >
                    {rmrResult.rockMassClassLabel}
                  </span>
                </div>
              ) : (
                <div className="text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded px-2 py-1 mt-1">
                  Required input not available ({rmrResult.missingParamLabels.length} missing)
                </div>
              )}
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <div>Basic RMR: {rmrResult.basicRmr !== null ? rmrResult.basicRmr : 'N/A'} / 100</div>
              <div>
                Adj: {rmrResult.orientationAdjustment !== null ? rmrResult.orientationAdjustment : 'N/A'}
              </div>
            </div>
          </div>

          {/* Individual Parameter Ratings Breakdown */}
          <div className="grid grid-cols-6 gap-1 text-center bg-slate-900/90 p-1.5 rounded border border-slate-800 text-[10px]">
            <div>
              <div className="text-slate-400">R1(UCS)</div>
              <div className="text-indigo-300 font-bold">
                {rmrResult.r1StrengthRating ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">R2(RQD)</div>
              <div className="text-indigo-300 font-bold">{rmrResult.r2RqdRating ?? '—'}</div>
            </div>
            <div>
              <div className="text-slate-400">R3(Spc)</div>
              <div className="text-indigo-300 font-bold">
                {rmrResult.r3SpacingRating ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">R4(Cnd)</div>
              <div className="text-indigo-300 font-bold">
                {rmrResult.r4ConditionRating ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">R5(H2O)</div>
              <div className="text-indigo-300 font-bold">
                {rmrResult.r5GroundwaterRating ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Adj</div>
              <div className="text-amber-300 font-bold">
                {rmrResult.orientationAdjustment ?? '—'}
              </div>
            </div>
          </div>

          {/* Supporting Calculation Summary */}
          {rmrResult.isComplete ? (
            <div className="space-y-1 text-[10px]">
              <div className="grid grid-cols-2 gap-1 text-slate-300 bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                <div>
                  Stand-up Time: <span className="text-white font-semibold">{rmrResult.averageStandUpTime}</span>
                </div>
                <div>
                  Modulus Em:{' '}
                  <span className="text-cyan-300 font-semibold">
                    {rmrResult.deformationModulusGPa} GPa
                  </span>
                </div>
                <div>
                  Cohesion c: <span className="text-white font-semibold">{rmrResult.cohesionKPa}</span>
                </div>
                <div>
                  Friction φ: <span className="text-white font-semibold">{rmrResult.frictionAngleDeg}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-300 bg-slate-900/70 p-2 rounded border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-0.5">
                  BIENIAWSKI SUPPORT GUIDELINE ({rmrResult.rockMassClassLabel}):
                </span>
                {rmrResult.recommendedSupportGuidelines}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-rose-200 bg-rose-950/40 border border-rose-800/60 rounded p-2">
              <div className="font-bold mb-1">Missing Required RMR Parameters:</div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-300">
                {rmrResult.missingParamLabels.map((lbl) => (
                  <li key={lbl}>{lbl}: Required input not available</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Q-System Editor & Result Section
  const renderQSystemSection = (compact = false) => (
    <div className="space-y-2.5">
      {/* Q-System Method Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-cyan-500/40 rounded px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[10px] font-bold">
            METHOD: BARTON Q-SYSTEM (NGI)
          </span>
          <span className="text-[10px] text-slate-300 font-mono">
            Formula: Q = (RQD / Jn) × (Jr / Ja) × (Jw / SRF)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {qResult.hasUnconfirmedSuggestions && (
            <button
              type="button"
              onClick={confirmAllQSuggestions}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
            >
              <ShieldCheck className="w-3 h-3" />
              Confirm All AI Suggestions ({qResult.unconfirmedParamLabels.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const { nextParams, nextStatus } = suggestQSystemWithConfirmation(
                joints,
                jointSets,
                geometry,
                settings,
                qIndexParams,
                qParamStatus
              );
              onUpdateQIndexParams(nextParams);
              onUpdateQParamStatus(nextStatus);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/40 text-[10px] font-semibold"
            title="Suggest RQD, Jn, Jr, Ja, Jw, SRF from mapped discontinuity traces (requires user confirmation)"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Suggest Q from Mapped Traces
          </button>
          <button
            type="button"
            onClick={() => onUpdateQParamStatus(createBlankQParamStatus())}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px]"
            title="Mark all Q-System inputs as 'Required input not available'"
          >
            <RotateCcw className="w-3 h-3" />
            Set Inputs Unassessed
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'xl:grid-cols-12'} gap-3`}>
        {/* Left 8 Columns: 6 NGI Q-System Parameters */}
        <div
          className={`${
            compact ? 'lg:col-span-8' : 'xl:col-span-8'
          } grid grid-cols-1 md:grid-cols-3 gap-2`}
        >
          {/* 1. RQD */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">1. RQD (%)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.rqd === 'MISSING' ? 'N/A' : `${qIndexParams.rqd}%`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              {renderParamStatusBadge(
                qParamStatus.rqd,
                () => setQParamConfirmed('rqd', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, rqd: 'MISSING' })
              )}
              <span className="text-[9px] text-slate-400">
                Jv ≈ {qIndexParams.volumetricJointCountJv ?? 14} jts/m³
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={qIndexParams.rqd}
              onChange={(e) => setQParamConfirmed('rqd', { rqd: Number(e.target.value) })}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* 2. Jn */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">2. Joint Set No. (Jn)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.jn === 'MISSING' ? 'N/A' : qResult.effectiveJn}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                qParamStatus.jn,
                () => setQParamConfirmed('jn', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, jn: 'MISSING' })
              )}
            </div>
            <select
              value={qParamStatus.jn === 'MISSING' ? '' : qIndexParams.jn}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateQParamStatus({ ...qParamStatus, jn: 'MISSING' });
                  return;
                }
                const val = Number(e.target.value);
                const found = JN_OPTIONS.find((o) => o.val === val);
                setQParamConfirmed('jn', {
                  jn: val,
                  jnDescription: found ? found.label : `Jn = ${val}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {JN_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3 text-[10px] text-slate-300">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(qIndexParams.isPortal)}
                  onChange={(e) =>
                    setQParamConfirmed('jn', {
                      isPortal: e.target.checked,
                      isIntersection: e.target.checked ? false : qIndexParams.isIntersection,
                    })
                  }
                  className="rounded border-slate-700 bg-slate-800 text-cyan-500"
                />
                Portal (2×Jn)
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(qIndexParams.isIntersection)}
                  onChange={(e) =>
                    setQParamConfirmed('jn', {
                      isIntersection: e.target.checked,
                      isPortal: e.target.checked ? false : qIndexParams.isPortal,
                    })
                  }
                  className="rounded border-slate-700 bg-slate-800 text-cyan-500"
                />
                Intersection (3×Jn)
              </label>
            </div>
          </div>

          {/* 3. Jr */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">3. Joint Roughness (Jr)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.jr === 'MISSING' ? 'N/A' : qIndexParams.jr}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                qParamStatus.jr,
                () => setQParamConfirmed('jr', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, jr: 'MISSING' })
              )}
            </div>
            <select
              value={qParamStatus.jr === 'MISSING' ? '' : qIndexParams.jr}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateQParamStatus({ ...qParamStatus, jr: 'MISSING' });
                  return;
                }
                const val = Number(e.target.value);
                const found = JR_OPTIONS.find((o) => o.val === val);
                setQParamConfirmed('jr', {
                  jr: val,
                  jrDescription: found ? found.label : `Jr = ${val}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {JR_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Ja */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">4. Joint Alteration (Ja)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.ja === 'MISSING' ? 'N/A' : qIndexParams.ja}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                qParamStatus.ja,
                () => setQParamConfirmed('ja', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, ja: 'MISSING' })
              )}
            </div>
            <select
              value={qParamStatus.ja === 'MISSING' ? '' : qIndexParams.ja}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateQParamStatus({ ...qParamStatus, ja: 'MISSING' });
                  return;
                }
                const val = Number(e.target.value);
                const found = JA_OPTIONS.find((o) => o.val === val);
                setQParamConfirmed('ja', {
                  ja: val,
                  jaDescription: found ? found.label : `Ja = ${val}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {JA_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Jw */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">5. Joint Water (Jw)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.jw === 'MISSING' ? 'N/A' : qIndexParams.jw}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                qParamStatus.jw,
                () => setQParamConfirmed('jw', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, jw: 'MISSING' })
              )}
            </div>
            <select
              value={qParamStatus.jw === 'MISSING' ? '' : qIndexParams.jw}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateQParamStatus({ ...qParamStatus, jw: 'MISSING' });
                  return;
                }
                const val = Number(e.target.value);
                const found = JW_OPTIONS.find((o) => o.val === val);
                setQParamConfirmed('jw', {
                  jw: val,
                  jwDescription: found ? found.label : `Jw = ${val}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {JW_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6. SRF */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-[11px]">6. Stress Factor (SRF)</span>
              <span className="text-white font-bold text-xs">
                {qParamStatus.srf === 'MISSING' ? 'N/A' : qIndexParams.srf}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                qParamStatus.srf,
                () => setQParamConfirmed('srf', {}),
                () => onUpdateQParamStatus({ ...qParamStatus, srf: 'MISSING' })
              )}
            </div>
            <select
              value={qParamStatus.srf === 'MISSING' ? '' : qIndexParams.srf}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateQParamStatus({ ...qParamStatus, srf: 'MISSING' });
                  return;
                }
                const val = Number(e.target.value);
                const found = SRF_OPTIONS.find((o) => o.val === val);
                setQParamConfirmed('srf', {
                  srf: val,
                  srfDescription: found ? found.label : `SRF = ${val}`,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {SRF_OPTIONS.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right 4 Columns: Computed Q-Value, Quotients & Support Recommendation */}
        <div
          className={`${
            compact ? 'lg:col-span-4' : 'xl:col-span-4'
          } p-3 bg-slate-950 border border-cyan-500/40 rounded flex flex-col justify-between space-y-2`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold">
                BARTON NGI TUNNELLING QUALITY INDEX
              </div>
              {qResult.isComplete ? (
                <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>Q = {qResult.qValue.toFixed(2)}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-semibold text-white"
                    style={{ backgroundColor: qResult.colorHex }}
                  >
                    {qResult.rockMassClass}
                  </span>
                </div>
              ) : (
                <div className="text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded px-2 py-1 mt-1">
                  Required input not available ({qResult.missingParamLabels.length} missing)
                </div>
              )}
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <div>De = {qResult.equivalentDimensionDe.toFixed(1)} m</div>
              <div>ESR = {qIndexParams.esr}</div>
            </div>
          </div>

          {qResult.isComplete ? (
            <>
              <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-900/90 p-2 rounded border border-slate-800 text-[10px]">
                <div>
                  <div className="text-slate-400">Block Size</div>
                  <div className="text-cyan-300 font-bold">
                    RQD/Jn = {qResult.blockSizeQuotient}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Shear Strength</div>
                  <div className="text-cyan-300 font-bold">
                    Jr/Ja = {qResult.shearStrengthQuotient}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Active Stress</div>
                  <div className="text-cyan-300 font-bold">
                    Jw/SRF = {qResult.activeStressQuotient}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-300 bg-slate-900/70 p-2 rounded border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-0.5">
                  NGI RECOMMENDED SUPPORT:
                </span>
                {qResult.recommendedSupport}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-rose-200 bg-rose-950/40 border border-rose-800/60 rounded p-2">
              <div className="font-bold mb-1">Missing Required Q-System Parameters:</div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-300">
                {qResult.missingParamLabels.map((lbl) => (
                  <li key={lbl}>{lbl}: Required input not available</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render GSI Editor & Result Section (Modular 3rd Method)
  const renderGsiSection = () => (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-emerald-500/40 rounded px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
            METHOD: HOEK &amp; MARINOS GSI
          </span>
          <span className="text-[10px] text-slate-300">
            Geological Strength Index &amp; Generalized Hoek-Brown Parameters
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* 1. Structure Category */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold text-[11px]">
                1. Rock Mass Structure
              </span>
              <span className="text-white font-bold text-xs">
                {gsiParams.structureRating ?? 'N/A'}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                gsiParams.paramStatus.structure,
                () =>
                  onUpdateGsiParams({
                    ...gsiParams,
                    paramStatus: { ...gsiParams.paramStatus, structure: 'USER_CONFIRMED' },
                  }),
                () =>
                  onUpdateGsiParams({
                    ...gsiParams,
                    structureCategory: 'MISSING',
                    structureRating: null,
                    paramStatus: { ...gsiParams.paramStatus, structure: 'MISSING' },
                  })
              )}
            </div>
            <select
              value={gsiParams.structureCategory === 'MISSING' ? '' : gsiParams.structureCategory}
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateGsiParams({
                    ...gsiParams,
                    structureCategory: 'MISSING',
                    structureRating: null,
                    paramStatus: { ...gsiParams.paramStatus, structure: 'MISSING' },
                  });
                  return;
                }
                const opt = GSI_STRUCTURE_OPTIONS.find((o) => o.id === e.target.value);
                onUpdateGsiParams({
                  ...gsiParams,
                  structureCategory: (opt?.id || 'BLOCKY') as GsiParameters['structureCategory'],
                  structureRating: opt?.rating ?? 65,
                  paramStatus: { ...gsiParams.paramStatus, structure: 'USER_ENTERED' },
                  userConfirmed: true,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {GSI_STRUCTURE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  [SR={o.rating}] {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Discontinuity Surface Condition */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold text-[11px]">
                2. Surface Condition
              </span>
              <span className="text-white font-bold text-xs">
                {gsiParams.surfaceConditionRating ?? 'N/A'}
              </span>
            </div>
            <div>
              {renderParamStatusBadge(
                gsiParams.paramStatus.surfaceCondition,
                () =>
                  onUpdateGsiParams({
                    ...gsiParams,
                    paramStatus: {
                      ...gsiParams.paramStatus,
                      surfaceCondition: 'USER_CONFIRMED',
                    },
                  }),
                () =>
                  onUpdateGsiParams({
                    ...gsiParams,
                    surfaceConditionCategory: 'MISSING',
                    surfaceConditionRating: null,
                    paramStatus: { ...gsiParams.paramStatus, surfaceCondition: 'MISSING' },
                  })
              )}
            </div>
            <select
              value={
                gsiParams.surfaceConditionCategory === 'MISSING'
                  ? ''
                  : gsiParams.surfaceConditionCategory
              }
              onChange={(e) => {
                if (e.target.value === '') {
                  onUpdateGsiParams({
                    ...gsiParams,
                    surfaceConditionCategory: 'MISSING',
                    surfaceConditionRating: null,
                    paramStatus: { ...gsiParams.paramStatus, surfaceCondition: 'MISSING' },
                  });
                  return;
                }
                const opt = GSI_SURFACE_CONDITION_OPTIONS.find((o) => o.id === e.target.value);
                onUpdateGsiParams({
                  ...gsiParams,
                  surfaceConditionCategory: (opt?.id ||
                    'GOOD') as GsiParameters['surfaceConditionCategory'],
                  surfaceConditionRating: opt?.rating ?? 65,
                  paramStatus: { ...gsiParams.paramStatus, surfaceCondition: 'USER_ENTERED' },
                  userConfirmed: true,
                });
              }}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-100"
            >
              <option value="">-- Required input not available --</option>
              {GSI_SURFACE_CONDITION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  [SCR={o.rating}] {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Intact UCS & Hoek-Brown mi / D */}
          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-bold text-[11px]">
                3. Intact UCS &amp; Hoek-Brown
              </span>
              <span className="text-white font-bold text-xs">
                {gsiParams.intactUcsMPa !== null ? `${gsiParams.intactUcsMPa} MPa` : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <label>
                <span className="text-slate-400 block">UCS (MPa)</span>
                <input
                  type="number"
                  value={gsiParams.intactUcsMPa ?? ''}
                  onChange={(e) =>
                    onUpdateGsiParams({
                      ...gsiParams,
                      intactUcsMPa: e.target.value === '' ? null : Number(e.target.value),
                      paramStatus: {
                        ...gsiParams.paramStatus,
                        intactUcs: e.target.value === '' ? 'MISSING' : 'USER_ENTERED',
                      },
                    })
                  }
                  className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </label>
              <label>
                <span className="text-slate-400 block">Constant mi</span>
                <input
                  type="number"
                  value={gsiParams.miHoekBrownConstant ?? 17}
                  onChange={(e) =>
                    onUpdateGsiParams({
                      ...gsiParams,
                      miHoekBrownConstant: Number(e.target.value),
                    })
                  }
                  className="w-full px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 p-3 bg-slate-950 border border-emerald-500/40 rounded flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <div className="text-[10px] text-emerald-400 font-bold">
                GEOLOGICAL STRENGTH INDEX (GSI)
              </div>
              {gsiResult.isComplete && gsiResult.gsiValue !== null ? (
                <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>GSI = {gsiResult.gsiValue}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-semibold text-white"
                    style={{ backgroundColor: gsiResult.colorHex }}
                  >
                    {gsiResult.rockMassClassLabel}
                  </span>
                </div>
              ) : (
                <div className="text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded px-2 py-1 mt-1">
                  Required input not available
                </div>
              )}
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <div>Range: {gsiResult.gsiRangeLabel}</div>
              <div>Em: {gsiResult.deformationModulusGPa ?? '—'} GPa</div>
            </div>
          </div>

          {gsiResult.isComplete && (
            <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-900/90 p-2 rounded border border-slate-800 text-[10px]">
              <div>
                <div className="text-slate-400">mb Constant</div>
                <div className="text-emerald-300 font-bold">{gsiResult.mbReducedConstant}</div>
              </div>
              <div>
                <div className="text-slate-400">s Constant</div>
                <div className="text-emerald-300 font-bold">{gsiResult.sConstant}</div>
              </div>
              <div>
                <div className="text-slate-400">a Constant</div>
                <div className="text-emerald-300 font-bold">{gsiResult.aConstant}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`${
        fullPage ? 'flex-1 min-h-0 h-full' : 'h-[390px] border-t border-slate-700/90'
      } bg-[#0E131D] flex flex-col shrink-0 z-30 shadow-2xl overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain`}
    >
      {/* Top Drawer Header & Method Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#131A28] border-b border-slate-800 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {fullPage && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors cursor-pointer"
              title="Back to Mapping Canvas"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Canvas</span>
            </button>
          )}
          <button
            onClick={() => onChangeTab('geology_tables')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
              activeTab === 'geology_tables'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            1. DISCONTINUITY &amp; GEOLOGICAL TABLES ({jointSets.length} Sets · {joints.length} Traces)
          </button>

          <button
            onClick={() => {
              onChangeTab('q_index');
              setClassificationSubView('parameters');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer ${
              activeTab === 'q_index' && classificationSubView === 'parameters'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/80 text-slate-300 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            2. ROCK MASS CLASSIFICATION ({getMethodSummaryBadge()})
          </button>

          <button
            onClick={() => {
              onChangeTab('q_index');
              setClassificationSubView('support_spotbolt_fos');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
              activeTab === 'q_index' && classificationSubView === 'support_spotbolt_fos'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            3. SUPPORT SYSTEM, SPOT BOLTING &amp; FoS (Strata FoS={supportAndFos.strataFactorOfSafety.toFixed(2)} · {supportAndFos.totalSpotBoltsRequired} Spot Bolts)
          </button>

          {/* Method Selection Switcher (Always accessible, never deletes geological mapping) */}
          <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/80 rounded px-2 py-0.5 ml-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold mr-1">
              Method:
            </span>
            {CLASSIFICATION_METHODS_REGISTRY.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChangeSelectedMethod(m.id);
                  onChangeTab('q_index');
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  selectedMethod === m.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={m.description}
              >
                {m.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadEngineeringSheetAsPDF({
                geometry,
                settings,
                joints,
                jointSets,
                qIndexParams,
                qParamStatus,
                rmrParams,
                gsiParams,
                selectedMethod,
                rockMassSummary,
                overbreakAnalysis,
              })
            }
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors cursor-pointer shadow-2xs"
            title="Download Geological Data Sheet & Rock Mass Classification as a Standalone .PDF File"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF (.pdf)
          </button>

          <button
            type="button"
            onClick={() =>
              void downloadEngineeringSheetAsWordDoc({
                geometry,
                settings,
                joints,
                jointSets,
                qIndexParams,
                qParamStatus,
                rmrParams,
                gsiParams,
                selectedMethod,
                rockMassSummary,
                overbreakAnalysis,
              })
            }
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer shadow-2xs"
            title="Download Editable Geological & Rock Mass Report in Microsoft Word (.doc) Format"
          >
            <Download className="w-3.5 h-3.5" />
            Download Word (.doc)
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded transition-colors cursor-pointer"
            title="Export Discontinuity Sets, Individual Traces, and Selected Rock Mass Classification to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              const dxfStr = exportMappedGeologicalSheetToDXF({
                geometry,
                settings,
                joints,
                jointSets,
                selectedMethod,
                qIndexParams,
                rmrParams,
                gsiParams,
                qValue: qResult.isComplete ? qResult.qValue : null,
                rmrValue: rmrResult.finalRmr,
              });
              const safeCh = (settings.faceChainage || 'Station').replace(/[^a-zA-Z0-9_-]/g, '_');
              triggerDownloadDXFSheet(`Mapped_Geological_Sheet_${safeCh}.dxf`, dxfStr);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors cursor-pointer"
            title="One-Click DXF Export of Custom Tunnel Profile + Mapped Joint Traces + Station Classification for AutoCAD / Civil 3D"
          >
            <Download className="w-3.5 h-3.5" />
            Export .DXF
          </button>

          <button
            onClick={() => onOpenExportSheet('FINAL_ENGINEERING_SHEET')}
            className="flex items-center gap-1 px-3 py-1 text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            3. Final Output Sheet →
          </button>

          {!fullPage && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Drawer Body Content */}
      <div className="flex-1 p-3.5 font-mono text-xs touch-pan-y">
        {activeTab === 'geology_tables' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* LEFT 7 COLUMNS: DISCONTINUITY-SET ENGINEERING TABLE */}
            <div className="xl:col-span-7 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300">
                  A. DISCONTINUITY-SET TABLE (ORIENTATION, SPACING, PERSISTENCE, ROUGHNESS,
                  INFILLING, WATER)
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">Merge:</span>
                  <select
                    value={mergeSourceSet}
                    onChange={(e) => setMergeSourceSet(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                  >
                    {['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'F1'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400">→</span>
                  <select
                    value={mergeTargetSet}
                    onChange={(e) => setMergeTargetSet(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                  >
                    {['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'F1'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onMergeJointSets(mergeSourceSet, mergeTargetSet)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded"
                  >
                    Merge Sets
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded bg-slate-950/70">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                      <th className="py-1.5 px-2">SET</th>
                      <th className="py-1.5 px-2">DIP DIR / DIP</th>
                      <th className="py-1.5 px-2">SPACING</th>
                      <th className="py-1.5 px-2">PERSISTENCE</th>
                      <th className="py-1.5 px-2">APERTURE</th>
                      <th className="py-1.5 px-2">ROUGHNESS</th>
                      <th className="py-1.5 px-2">INFILLING</th>
                      <th className="py-1.5 px-2">WATER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jointSets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500">
                          No discontinuity sets mapped yet. Click &quot;AI Trace&quot; or &quot;Add
                          Joint&quot; on the canvas.
                        </td>
                      </tr>
                    ) : (
                      jointSets.map((js) => (
                        <tr
                          key={js.id}
                          className="border-b border-slate-800/60 hover:bg-slate-900/50"
                        >
                          <td className="py-1.5 px-2 font-bold">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-white text-[10px]"
                              style={{ backgroundColor: js.color }}
                            >
                              {js.id}
                            </span>
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.orientation}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'orientation', e.target.value)
                              }
                              className="w-28 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.spacing}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'spacing', e.target.value)
                              }
                              className="w-24 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.persistence}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'persistence', e.target.value)
                              }
                              className="w-20 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.aperture}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'aperture', e.target.value)
                              }
                              className="w-24 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.roughness}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'roughness', e.target.value)
                              }
                              className="w-28 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.infilling}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'infilling', e.target.value)
                              }
                              className="w-28 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="text"
                              value={js.water}
                              onChange={(e) =>
                                onUpdateJointSetAttribute(js.id, 'water', e.target.value)
                              }
                              className="w-20 bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-100"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT 5 COLUMNS: LITHOLOGY, WEATHERING, STRENGTH, WATER & SUPPORT GEOLOGICAL TABLE */}
            <div className="xl:col-span-5 space-y-2">
              <span className="text-[11px] font-bold text-cyan-300 block">
                B. ROCK MASS, LITHOLOGY, WEATHERING &amp; SUPPORT LOG TABLE
              </span>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded text-[11px]">
                <label className="space-y-0.5">
                  <span className="text-slate-400">Rock Type / Lithology</span>
                  <input
                    type="text"
                    value={rockMassSummary.rockType}
                    onChange={(e) =>
                      onUpdateRockMassSummary({ ...rockMassSummary, rockType: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-0.5">
                  <span className="text-slate-400">Weathering Grade (ISRM)</span>
                  <select
                    value={rockMassSummary.weatheringGrade}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        weatheringGrade: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="W1 (Fresh / Unweathered)">W1 (Fresh / Unweathered)</option>
                    <option value="W2 (Slightly Weathered)">W2 (Slightly Weathered)</option>
                    <option value="W3 (Moderately Weathered)">W3 (Moderately Weathered)</option>
                    <option value="W4 (Highly Weathered)">W4 (Highly Weathered)</option>
                    <option value="W5 (Completely Weathered)">W5 (Completely Weathered)</option>
                  </select>
                </label>

                <label className="space-y-0.5">
                  <span className="text-slate-400">Intact Rock Strength (UCS)</span>
                  <select
                    value={rockMassSummary.strengthGrade}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        strengthGrade: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="R5 (Very Strong, 100–250 MPa)">
                      R5 (Very Strong, 100–250 MPa)
                    </option>
                    <option value="R4 (Strong, 50–100 MPa)">R4 (Strong, 50–100 MPa)</option>
                    <option value="R3–R4 (Medium Strong to Strong, UCS 50–100 MPa)">
                      R3–R4 (Medium Strong to Strong, 50–100 MPa)
                    </option>
                    <option value="R3 (Medium Strong, 25–50 MPa)">
                      R3 (Medium Strong, 25–50 MPa)
                    </option>
                    <option value="R2 (Weak, 5–25 MPa)">R2 (Weak, 5–25 MPa)</option>
                    <option value="R1 (Very Weak, 1–5 MPa)">R1 (Very Weak, 1–5 MPa)</option>
                  </select>
                </label>

                <label className="space-y-0.5">
                  <span className="text-slate-400">Groundwater / Inflow</span>
                  <input
                    type="text"
                    value={rockMassSummary.groundwaterCondition}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        groundwaterCondition: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-0.5">
                  <span className="text-slate-400">Overbreak / Stability Condition</span>
                  <input
                    type="text"
                    value={rockMassSummary.overbreakCondition}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        overbreakCondition: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="space-y-0.5">
                  <span className="text-slate-400">Installed / Designed Support</span>
                  <input
                    type="text"
                    value={rockMassSummary.installedSupport}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        installedSupport: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                <label className="col-span-2 space-y-0.5">
                  <span className="text-slate-400">Engineering Geologist Field Remarks</span>
                  <input
                    type="text"
                    value={rockMassSummary.geologistRemarks}
                    onChange={(e) =>
                      onUpdateRockMassSummary({
                        ...rockMassSummary,
                        geologistRemarks: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  />
                </label>

                {/* Live Support System, Spot Bolting & Factor of Safety Summary Strip inside Geological Table */}
                <div className="col-span-2 mt-1 p-2 rounded bg-emerald-950/30 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] space-y-0.5">
                    <div className="font-bold text-emerald-300">
                      SUPPORT SYSTEM &amp; FACTOR OF SAFETY: {supportAndFos.recommendedSupportCategory}
                    </div>
                    <div className="text-slate-300">
                      Strata FoS: <strong className="text-emerald-300">{supportAndFos.strataFactorOfSafety.toFixed(2)}</strong> · Systematic Bolts: <strong className="text-cyan-300">L={supportAndFos.systematicBoltLengthM}m @ {supportAndFos.systematicBoltSpacingM}m c/c</strong> · AI Spot Bolts: <strong className="text-amber-300">{supportAndFos.totalSpotBoltsRequired} bolts ({supportAndFos.spotBoltLocations.length} zones)</strong> · Wedge FoS: <strong className="text-emerald-300">{supportAndFos.failureModes[0]?.supportedFactorOfSafety.toFixed(2) ?? '1.65'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTab('q_index');
                      setClassificationSubView('support_spotbolt_fos');
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer shrink-0"
                  >
                    Edit Support, Spot Bolts &amp; FoS →
                  </button>
                </div>
              </div>
            </div>

            {/* FULL-WIDTH ROW C: INDIVIDUAL MAPPED STRUCTURAL TRACES LOG TABLE */}
            <div className="xl:col-span-12 space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300">
                  C. INDIVIDUAL MAPPED STRUCTURAL TRACES LOG ({joints.length} Vectors Registered to
                  Main Photos)
                </span>
                <span className="text-[10px] text-slate-400">
                  Drive Azimuth: N {String(Math.round(settings.driveDirection)).padStart(3, '0')}°
                  E · True / Apparent 3D Orientation
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded bg-slate-950/70 max-h-40">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 sticky top-0">
                      <th className="py-1 px-2">#</th>
                      <th className="py-1 px-2">SURFACE</th>
                      <th className="py-1 px-2">SET</th>
                      <th className="py-1 px-2">FEATURE TYPE</th>
                      <th className="py-1 px-2">DIP DIR (°)</th>
                      <th className="py-1 px-2">DIP (°)</th>
                      <th className="py-1 px-2">STRIKE (°)</th>
                      <th className="py-1 px-2">LENGTH (m)</th>
                      <th className="py-1 px-2">PTS</th>
                      <th className="py-1 px-2">WATER</th>
                      <th className="py-1 px-2">3D STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joints.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-3 text-center text-slate-500">
                          No individual traces mapped yet.
                        </td>
                      </tr>
                    ) : (
                      joints.map((j, idx) => (
                        <tr
                          key={j.id}
                          className="border-b border-slate-800/60 hover:bg-slate-900/50"
                        >
                          <td className="py-1 px-2 text-slate-400">{idx + 1}</td>
                          <td className="py-1 px-2 uppercase text-cyan-300 font-semibold">
                            {j.surface}
                          </td>
                          <td className="py-1 px-2 font-bold text-white">{j.set}</td>
                          <td className="py-1 px-2 text-slate-200">{j.featureType}</td>
                          <td className="py-1 px-2 font-semibold text-emerald-300">
                            {String(Math.round(j.dipDirection)).padStart(3, '0')}°
                          </td>
                          <td className="py-1 px-2 font-semibold text-emerald-300">
                            {String(Math.round(j.dip)).padStart(2, '0')}°
                          </td>
                          <td className="py-1 px-2 text-slate-300">
                            {String(Math.round(j.strike)).padStart(3, '0')}°
                          </td>
                          <td className="py-1 px-2 text-slate-200">
                            {j.persistenceMeters.toFixed(2)} m
                          </td>
                          <td className="py-1 px-2 text-slate-400">P1..P{j.geometry.length}</td>
                          <td className="py-1 px-2">
                            <select
                              value={j.waterCondition || 'Dry'}
                              onChange={(e) => {
                                if (!onUpdateJoints) return;
                                onUpdateJoints(
                                  joints.map((item) =>
                                    item.id === j.id
                                      ? {
                                          ...item,
                                          waterCondition: e.target
                                            .value as Joint['waterCondition'],
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-200"
                            >
                              <option value="Dry">Dry</option>
                              <option value="Damp">Damp</option>
                              <option value="Wet">Wet</option>
                              <option value="Dripping">Dripping</option>
                              <option value="Flowing">Flowing</option>
                            </select>
                          </td>
                          <td className="py-1 px-2 text-[10px] text-slate-400">
                            {j.orientationStatus.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ====================================================================
             TAB 2: METHOD-SPECIFIC ROCK MASS CLASSIFICATION WORKFLOW
             Strictly displays ONLY the selected method's parameters (or both
             side-by-side when BOTH_RMR_AND_Q is selected without mixing them).
             ==================================================================== */
          <div className="space-y-4">
            {classificationSubView === 'support_spotbolt_fos' ? (
              <div className="space-y-4">
                {/* SECTION A: ROCK STRATA SUPPORT SYSTEM & FACTOR OF SAFETY (USER EDITABLE) */}
                <div className="p-3 bg-slate-950 border border-emerald-500/50 rounded space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        A. ROCK STRATA SUPPORT SYSTEM &amp; FACTOR OF SAFETY ({settings.faceChainage})
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Evaluates Arch Rock Load Demand vs. Installed Support Pressure (Bolts + Sfr Shotcrete + Steel Ribs). Every value is user-editable and updates Output Sheets &amp; ESWA AI.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold border ${
                          supportAndFos.strataStabilityStatus === 'ADEQUATE'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                            : supportAndFos.strataStabilityStatus === 'MARGINAL'
                            ? 'bg-amber-950 text-amber-300 border-amber-500/60'
                            : 'bg-rose-950 text-rose-300 border-rose-500/60'
                        }`}
                      >
                        Rock Strata FoS = {supportAndFos.strataFactorOfSafety.toFixed(2)} (Target ≥{' '}
                        {supportAndFos.strataTargetFos.toFixed(2)} · {supportAndFos.strataStabilityStatus})
                      </span>
                      {rockMassSummary.supportSystemOverrides && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRockMassSummary({
                              ...rockMassSummary,
                              supportSystemOverrides: undefined,
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset to AI Default
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 text-[11px]">
                    <label className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block">
                        Systematic Bolt Length (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="1.5"
                        value={supportAndFos.systematicBoltLengthM}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) {
                            updateSupportOverrides({ systematicBoltLengthM: v });
                          }
                        }}
                        className="w-full px-2 py-1 bg-slate-950 border border-cyan-600/50 rounded text-cyan-300 font-bold"
                      />
                    </label>

                    <label className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block">
                        Bolt Pattern Spacing c/c (m)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.6"
                        value={supportAndFos.systematicBoltSpacingM}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) {
                            updateSupportOverrides({ systematicBoltSpacingM: v });
                          }
                        }}
                        className="w-full px-2 py-1 bg-slate-950 border border-cyan-600/50 rounded text-amber-300 font-bold"
                      />
                    </label>

                    <label className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block">
                        Single Bolt Capacity (kN)
                      </span>
                      <input
                        type="number"
                        step="10"
                        min="50"
                        value={supportAndFos.systematicBoltCapacityKn}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) {
                            updateSupportOverrides({ systematicBoltCapacityKn: v });
                          }
                        }}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 font-bold"
                      />
                    </label>

                    <label className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block">
                        Shotcrete Thickness (mm Sfr)
                      </span>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        value={supportAndFos.shotcreteThicknessMm}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) {
                            updateSupportOverrides({ shotcreteThicknessMm: v });
                          }
                        }}
                        className="w-full px-2 py-1 bg-slate-950 border border-emerald-600/50 rounded text-emerald-300 font-bold"
                      />
                    </label>

                    <label className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block">
                        Steel Ribs / Lattice Girders
                      </span>
                      <input
                        type="text"
                        value={supportAndFos.steelRibsPrescription}
                        onChange={(e) =>
                          updateSupportOverrides({ steelRibsPrescription: e.target.value })
                        }
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100"
                      />
                    </label>

                    <div className="p-2 bg-slate-900 rounded border border-emerald-500/40 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block">
                        Demand vs Capacity (kPa)
                      </span>
                      <div className="text-xs font-bold text-white">
                        {supportAndFos.strataDemandPressureKpa.toFixed(1)} vs{' '}
                        <span className="text-emerald-300">
                          {supportAndFos.installedSupportCapacityKpa.toFixed(1)} kPa
                        </span>
                      </div>
                      <div className="text-[9px] text-emerald-400 font-semibold">
                        FoS = Cap / Demand = {supportAndFos.strataFactorOfSafety.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION B: AI SPOT BOLTING LOCATIONS & HISTORICAL PULL BOLT COLLECTOR */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                  <div className="xl:col-span-8 p-3 bg-slate-950 border border-cyan-500/50 rounded space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                      <div>
                        <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          B1. AI SPOT BOLTING LOCATION ANALYSIS &amp; BOLT REQUIREMENT SCHEDULE (
                          {supportAndFos.totalSpotBoltsRequired} Bolts Required)
                        </span>
                        <p className="text-[10px] text-slate-400">
                          AI selects exact spot-bolting sectors from wedge intersections, overbreak cavities &amp; previous pull history. Click any cell to modify.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomSpotBoltLocation}
                        className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold cursor-pointer"
                      >
                        + Add Spot Bolt Location
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[10px]">
                            <th className="py-1.5 px-2">CHOSEN AREA / SECTOR</th>
                            <th className="py-1.5 px-2">COORDS (X, Y m)</th>
                            <th className="py-1.5 px-2">BOLTS REQ</th>
                            <th className="py-1.5 px-2">LEN / ANGLE</th>
                            <th className="py-1.5 px-2">SETS</th>
                            <th className="py-1.5 px-2">AI REASON FOR LOCATION &amp; HISTORY</th>
                            <th className="py-1.5 px-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {supportAndFos.spotBoltLocations.map((sp) => (
                            <tr
                              key={sp.id}
                              className="border-b border-slate-800/70 hover:bg-slate-900/50"
                            >
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={sp.locationSector}
                                  onChange={(e) =>
                                    handleUpdateSpotBoltRow(sp.id, {
                                      locationSector: e.target.value,
                                    })
                                  }
                                  className="w-40 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-200 font-semibold"
                                />
                              </td>
                              <td className="py-1.5 px-1.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={sp.xMeters}
                                    onChange={(e) =>
                                      handleUpdateSpotBoltRow(sp.id, {
                                        xMeters: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                                  />
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={sp.yMeters}
                                    onChange={(e) =>
                                      handleUpdateSpotBoltRow(sp.id, {
                                        yMeters: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                                  />
                                </div>
                              </td>
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={sp.boltsRequired}
                                  onChange={(e) =>
                                    handleUpdateSpotBoltRow(sp.id, {
                                      boltsRequired: Math.max(
                                        1,
                                        parseInt(e.target.value, 10) || 1
                                      ),
                                    })
                                  }
                                  className="w-14 bg-slate-900 border border-amber-500/60 rounded px-1.5 py-0.5 text-amber-300 font-bold text-center"
                                />
                              </td>
                              <td className="py-1.5 px-1.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={sp.boltLengthMeters}
                                    onChange={(e) =>
                                      handleUpdateSpotBoltRow(sp.id, {
                                        boltLengthMeters: parseFloat(e.target.value) || 3.5,
                                      })
                                    }
                                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                                  />
                                  <span className="text-[9px] text-slate-500">m @</span>
                                  <input
                                    type="number"
                                    step="5"
                                    value={sp.inclinationDeg}
                                    onChange={(e) =>
                                      handleUpdateSpotBoltRow(sp.id, {
                                        inclinationDeg: parseFloat(e.target.value) || 15,
                                      })
                                    }
                                    className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-100"
                                  />
                                  <span className="text-[9px] text-slate-500">°</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={sp.controllingJointSets}
                                  onChange={(e) =>
                                    handleUpdateSpotBoltRow(sp.id, {
                                      controllingJointSets: e.target.value,
                                    })
                                  }
                                  className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-emerald-300 font-semibold"
                                />
                              </td>
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={sp.aiReasonForChoice}
                                  onChange={(e) =>
                                    handleUpdateSpotBoltRow(sp.id, {
                                      aiReasonForChoice: e.target.value,
                                    })
                                  }
                                  className="w-full min-w-[240px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                                />
                                <div className="text-[9px] text-cyan-400 mt-0.5">
                                  {sp.historicalReferenceSummary}
                                </div>
                              </td>
                              <td className="py-1.5 px-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSpotBoltLocation(sp.id)}
                                  className="text-slate-500 hover:text-rose-400 px-1 cursor-pointer"
                                  title="Delete Spot Bolt Location"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* B2: HISTORICAL SPOT BOLTING DATA COLLECTED FROM PREVIOUS PULLS */}
                  <div className="xl:col-span-4 p-3 bg-slate-950 border border-amber-500/50 rounded space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-amber-300 text-xs">
                        B2. PREVIOUS PULLS SPOT BOLT MEMORY
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/50 text-[10px] font-bold">
                        Avg: {supportAndFos.historicalAvgSpotBoltsPerPull} bolts/pull
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      AI automatically collects spot bolt locations &amp; counts from previous tunnel pulls to calibrate current round requirements:
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {supportAndFos.historicalSpotBoltPulls.map((hp, idx) => (
                        <div
                          key={`${hp.chainage}-${idx}`}
                          className="p-2 bg-slate-900 border border-slate-800 rounded text-[10px] space-y-0.5"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-cyan-300">
                              Pull {hp.chainage} ({hp.dominantLocationSector})
                            </span>
                            <span className="text-amber-300">
                              {hp.spotBoltsInstalled} Spot Bolts (L={hp.boltLengthMeters}m)
                            </span>
                          </div>
                          <div className="text-slate-400">{hp.geologicalReason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION C: WEDGE, PLANAR, TOPPLING & RAVELLING FAILURE FACTOR OF SAFETY (USER EDITABLE) */}
                <div className="p-3 bg-slate-950 border border-indigo-500/50 rounded space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <div>
                      <span className="font-bold text-indigo-300 text-xs">
                        C. POSSIBLE FAILURE MODES (3D WEDGE, PLANAR SLIDING, TOPPLING &amp; RAVELLING) — FACTOR OF SAFETY &amp; AI RECOMMENDATIONS
                      </span>
                      <p className="text-[10px] text-slate-400">
                        AI evaluates every potential kinematic &amp; gravity failure mode. Users can directly modify Additional Spot Bolts, Target FoS, and Support Recommendations.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[10px]">
                          <th className="py-1.5 px-2">FAILURE MODE &amp; SECTOR</th>
                          <th className="py-1.5 px-2">SETS</th>
                          <th className="py-1.5 px-2">BLOCK MASS</th>
                          <th className="py-1.5 px-2">UNBOLTED FoS</th>
                          <th className="py-1.5 px-2">SUPPORTED FoS</th>
                          <th className="py-1.5 px-2">EXTRA BOLTS</th>
                          <th className="py-1.5 px-2">STATUS</th>
                          <th className="py-1.5 px-2">AI RECOMMENDATION (USER EDITABLE)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supportAndFos.failureModes.map((fm) => (
                          <tr
                            key={fm.id}
                            className="border-b border-slate-800/70 hover:bg-slate-900/50"
                          >
                            <td className="py-1.5 px-2">
                              <div className="font-bold text-white">{fm.failureModeLabel}</div>
                              <div className="text-[10px] text-cyan-300">{fm.locationSector}</div>
                            </td>
                            <td className="py-1.5 px-2 font-semibold text-emerald-300">
                              {fm.controllingSets}
                            </td>
                            <td className="py-1.5 px-2 text-slate-200">
                              {fm.apexHeightMeters}m · {fm.estimatedWeightTonnes}t
                            </td>
                            <td className="py-1.5 px-2">
                              <span
                                className={`font-bold ${
                                  fm.unboltedFactorOfSafety < 1.0
                                    ? 'text-rose-400'
                                    : fm.unboltedFactorOfSafety < 1.5
                                    ? 'text-amber-300'
                                    : 'text-emerald-300'
                                }`}
                              >
                                {fm.unboltedFactorOfSafety.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                step="0.05"
                                value={fm.supportedFactorOfSafety}
                                onChange={(e) =>
                                  handleUpdateFailureModeRow(fm.id, {
                                    supportedFactorOfSafety:
                                      parseFloat(e.target.value) || fm.supportedFactorOfSafety,
                                  })
                                }
                                className="w-16 bg-slate-900 border border-emerald-500/60 rounded px-1.5 py-0.5 text-emerald-300 font-bold"
                              />
                              <span className="text-[9px] text-slate-500 ml-1">
                                (Req ≥{fm.requiredTargetFos})
                              </span>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={fm.recommendedExtraBolts}
                                onChange={(e) =>
                                  handleUpdateFailureModeRow(fm.id, {
                                    recommendedExtraBolts: Math.max(
                                      0,
                                      parseInt(e.target.value, 10) || 0
                                    ),
                                  })
                                }
                                className="w-14 bg-slate-900 border border-amber-500/60 rounded px-1.5 py-0.5 text-amber-300 font-bold text-center"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  fm.stabilityStatus === 'STABLE'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                                    : fm.stabilityStatus === 'MARGINAL'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                                    : 'bg-rose-950 text-rose-300 border border-rose-600/50'
                                }`}
                              >
                                {fm.stabilityStatus}
                              </span>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={fm.aiSupportRecommendation}
                                onChange={(e) =>
                                  handleUpdateFailureModeRow(fm.id, {
                                    aiSupportRecommendation: e.target.value,
                                  })
                                }
                                className="w-full min-w-[260px] bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-100"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : classificationSubView === 'support_chart' ? (
              (() => {
                const sup = computeEmpiricalSupportRecommendation(
                  geometry,
                  qIndexParams,
                  rmrParams,
                  qResult.isComplete,
                  qResult.isComplete ? qResult.qValue : null,
                  rmrResult.finalRmr
                );

                // Map Q (0.001 .. 1000) to X (65 .. 515) on log10 scale
                // Map De (1.5 .. 40) to Y (215 .. 25) on log10 scale
                const qClamp = Math.max(0.001, Math.min(1000, sup.qValue ?? 4.0));
                const logQ = Math.log10(qClamp); // -3 .. +3
                const pxX = 65 + ((logQ + 3) / 6) * 450;

                const deClamp = Math.max(1.5, Math.min(40, sup.equivalentDimensionDe));
                const logDe = Math.log10(deClamp);
                const minLogDe = Math.log10(1.5);
                const maxLogDe = Math.log10(40);
                const pxY = 215 - ((logDe - minLogDe) / (maxLogDe - minLogDe)) * 190;

                return (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    {/* Left: Interactive Grimstad & Barton (1993) Q-Support Chart SVG */}
                    <div className="xl:col-span-6 bg-slate-950 border border-slate-800 rounded p-3 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-emerald-300 text-[11px]">
                          EMPIRICAL SUPPORT CHART — GRIMSTAD &amp; BARTON (1993) Q vs. De (Span/ESR)
                        </span>
                        <span className="text-[10px] text-cyan-300">
                          De = {sup.spanMeters.toFixed(2)}m / {sup.esr.toFixed(2)} ={' '}
                          <strong>{sup.equivalentDimensionDe}m</strong>
                        </span>
                      </div>

                      <svg
                        viewBox="0 0 545 250"
                        className={`w-full h-[225px] rounded border ${
                          isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#070B12] border-slate-800'
                        }`}
                      >
                        {/* Support Category Background Zones (Log Q from -3 to +3) */}
                        <rect x="65" y="25" width="75" height="190" fill="rgba(225, 29, 72, 0.14)" />
                        <rect x="140" y="25" width="75" height="190" fill="rgba(249, 115, 22, 0.13)" />
                        <rect x="215" y="25" width="75" height="190" fill="rgba(245, 158, 11, 0.12)" />
                        <rect x="290" y="25" width="75" height="190" fill="rgba(56, 189, 248, 0.12)" />
                        <rect x="365" y="25" width="75" height="190" fill="rgba(16, 185, 129, 0.12)" />
                        <rect x="440" y="25" width="75" height="190" fill="rgba(34, 197, 94, 0.10)" />

                        {/* Grid Lines for Log10(Q) */}
                        {[
                          { q: 0.001, lbl: '0.001' },
                          { q: 0.01, lbl: '0.01' },
                          { q: 0.1, lbl: '0.1' },
                          { q: 1, lbl: '1' },
                          { q: 4, lbl: '4' },
                          { q: 10, lbl: '10' },
                          { q: 40, lbl: '40' },
                          { q: 100, lbl: '100' },
                          { q: 1000, lbl: '1000' },
                        ].map((tick) => {
                          const x = 65 + ((Math.log10(tick.q) + 3) / 6) * 450;
                          return (
                            <g key={tick.lbl}>
                              <line
                                x1={x}
                                y1="25"
                                x2={x}
                                y2="215"
                                stroke={isLight ? '#CBD5E1' : '#1E293B'}
                                strokeWidth="1"
                                strokeDasharray="3,3"
                              />
                              <text
                                x={x}
                                y="230"
                                textAnchor="middle"
                                fontSize="9"
                                fill={isLight ? '#475569' : '#94A3B8'}
                              >
                                {tick.lbl}
                              </text>
                            </g>
                          );
                        })}

                        {/* Grid Lines for De = Span / ESR */}
                        {[2, 5, 10, 20, 35].map((deVal) => {
                          const y =
                            215 -
                            ((Math.log10(deVal) - minLogDe) / (maxLogDe - minLogDe)) * 190;
                          return (
                            <g key={deVal}>
                              <line
                                x1="65"
                                y1={y}
                                x2="515"
                                y2={y}
                                stroke={isLight ? '#CBD5E1' : '#1E293B'}
                                strokeWidth="1"
                              />
                              <text
                                x="58"
                                y={y + 3}
                                textAnchor="end"
                                fontSize="9"
                                fill={isLight ? '#475569' : '#94A3B8'}
                              >
                                {deVal}m
                              </text>
                            </g>
                          );
                        })}

                        {/* No-Support Limit Line: De = 2 * Q^0.4 */}
                        <path
                          d="M 250 215 L 435 25"
                          fill="none"
                          stroke={isLight ? '#059669' : '#10B981'}
                          strokeWidth="1.8"
                          strokeDasharray="5,4"
                        />

                        {/* Category Labels */}
                        <text
                          x="102"
                          y="55"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#BE123C' : '#FDA4AF'}
                        >
                          CAT 8–9 (RRS+Sfr)
                        </text>
                        <text
                          x="178"
                          y="85"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#C2410C' : '#FDBA74'}
                        >
                          CAT 7 (Sfr 120–150)
                        </text>
                        <text
                          x="252"
                          y="110"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#B45309' : '#FDE68A'}
                        >
                          CAT 5–6 (Sfr 60–120)
                        </text>
                        <text
                          x="328"
                          y="135"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#0369A1' : '#7DD3FC'}
                        >
                          CAT 4 (Bolts+Sfr 50)
                        </text>
                        <text
                          x="435"
                          y="165"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#047857' : '#6EE7B7'}
                        >
                          CAT 1–2 (Spot Bolts)
                        </text>

                        {/* Current Station Operating Point (Q, De) */}
                        <line
                          x1={pxX}
                          y1="25"
                          x2={pxX}
                          y2="215"
                          stroke={isLight ? '#0284C7' : '#22D3EE'}
                          strokeWidth="1.2"
                          strokeDasharray="2,2"
                        />
                        <line
                          x1="65"
                          y1={pxY}
                          x2="515"
                          y2={pxY}
                          stroke={isLight ? '#0284C7' : '#22D3EE'}
                          strokeWidth="1.2"
                          strokeDasharray="2,2"
                        />
                        <circle
                          cx={pxX}
                          cy={pxY}
                          r="8"
                          fill="rgba(34, 211, 238, 0.28)"
                          stroke={isLight ? '#0284C7' : '#22D3EE'}
                          strokeWidth="2"
                        />
                        <circle cx={pxX} cy={pxY} r="3.5" fill={isLight ? '#0284C7' : '#FFFFFF'} />
                        <rect
                          x={Math.min(410, Math.max(70, pxX - 55))}
                          y={Math.max(28, pxY - 26)}
                          width="115"
                          height="18"
                          rx="3"
                          fill={isLight ? '#FFFFFF' : '#0F172A'}
                          stroke={isLight ? '#0284C7' : '#22D3EE'}
                        />
                        <text
                          x={Math.min(467, Math.max(127, pxX + 2))}
                          y={Math.max(40, pxY - 14)}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={isLight ? '#0369A1' : '#22D3EE'}
                        >
                          Q={sup.qValue !== null ? sup.qValue.toFixed(2) : 'N/A'}, De={sup.equivalentDimensionDe}m
                        </text>

                        <text
                          x="290"
                          y="245"
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="700"
                          fill={isLight ? '#0F172A' : '#E2E8F0'}
                        >
                          Rock Mass Quality Q = (RQD/Jn) × (Jr/Ja) × (Jw/SRF) [Log Scale]
                        </text>
                      </svg>
                    </div>

                    {/* Right: Highlighted Rockbolt Spacing, Bolt Length & Shotcrete Cards (Barton Q + RMR89) */}
                    <div className="xl:col-span-6 space-y-2.5">
                      <div className="p-3 bg-slate-950 border border-emerald-500/50 rounded space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300 text-xs">
                            A. BARTON Q-SYSTEM SUPPORT PRESCRIPTION ({sup.qSupportCategoryTitle})
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold">
                            Q = {sup.qValue !== null ? sup.qValue.toFixed(2) : 'Unconfirmed'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Rockbolt Length (L)</div>
                            <div className="text-sm font-bold text-cyan-300">
                              {sup.boltLengthMeters.toFixed(2)} m
                            </div>
                            <div className="text-[9px] text-slate-500">L = 2 + 0.15·B/ESR</div>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Bolt Spacing (c/c)</div>
                            <div className="text-sm font-bold text-amber-300">
                              {sup.boltSpacingMeters.toFixed(2)} m × {sup.boltSpacingMeters.toFixed(2)} m
                            </div>
                            <div className="text-[9px] text-slate-500">Systematic Pattern</div>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Shotcrete (Sfr)</div>
                            <div className="text-sm font-bold text-emerald-300">
                              {sup.shotcreteThicknessMm > 0
                                ? `${sup.shotcreteThicknessMm} mm Sfr`
                                : 'Unlined / Spot'}
                            </div>
                            <div className="text-[9px] text-slate-500">{sup.steelRibsPrescription}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 border border-indigo-500/50 rounded space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 text-xs">
                            B. BIENIAWSKI (1989) RMR89 EMPIRICAL SUPPORT TABLE
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-200 border border-indigo-600/50 text-[10px] font-bold">
                            {sup.rmrClassLabel}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Excavation Round:</span>
                            <span className="text-slate-200">{sup.rmrExcavationMethod}</span>
                          </div>
                          <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Rockbolts (20mm dia):</span>
                            <span className="text-cyan-200">{sup.rmrBoltPrescription}</span>
                          </div>
                          <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Shotcrete:</span>
                            <span className="text-emerald-200">{sup.rmrShotcretePrescription}</span>
                          </div>
                          <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Steel Sets / Ribs:</span>
                            <span className="text-amber-200">{sup.rmrSteelSetsPrescription}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : classificationSubView === 'chainage_log' ? (
              (() => {
                const computedRows = buildLongitudinalChainageLog(
                  savedProjects,
                  settings,
                  geometry,
                  qIndexParams,
                  rmrParams,
                  qResult.isComplete ? qResult.qValue : null,
                  rmrResult.finalRmr
                );
                const rows =
                  demoAlignmentStations && demoAlignmentStations.length > computedRows.length
                    ? demoAlignmentStations
                    : computedRows;

                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded p-2.5">
                      <div>
                        <span className="font-bold text-cyan-300 text-xs">
                          LONGITUDINAL CHAINAGE LOG STRIP (MULTI-ROUND ALIGNMENT SUMMARY)
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Compares RMR, Q-Value, RQD (%), and Support Class across saved tunnel stations to highlight Fault / Weak Zones along the drive.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rows.length < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const baseCh = computedRows[0]?.chainageMeters || 132;
                              const sampleRows: LongitudinalStationLogRow[] = [
                                {
                                  id: 'st-1',
                                  chainageMeters: baseCh - 12,
                                  chainageLabel: `RD ${(baseCh - 12).toFixed(1)}m`,
                                  tunnelName: settings.tunnelName,
                                  location: settings.locationName || 'HRT',
                                  rmrValue: 68,
                                  rmrClass: 'Class II',
                                  qValue: 11.4,
                                  qClass: 'Good',
                                  rqdPct: 78,
                                  supportCategory: 'Cat 3 (L=3.3m, 50mm Sfr)',
                                  isWeakOrFaultZone: false,
                                  isCurrentStation: false,
                                },
                                {
                                  id: 'st-2',
                                  chainageMeters: baseCh - 8,
                                  chainageLabel: `RD ${(baseCh - 8).toFixed(1)}m`,
                                  tunnelName: settings.tunnelName,
                                  location: settings.locationName || 'HRT',
                                  rmrValue: 54,
                                  rmrClass: 'Class III',
                                  qValue: 4.6,
                                  qClass: 'Fair',
                                  rqdPct: 64,
                                  supportCategory: 'Cat 4 (L=3.3m, 60mm Sfr)',
                                  isWeakOrFaultZone: false,
                                  isCurrentStation: false,
                                },
                                {
                                  id: 'st-3',
                                  chainageMeters: baseCh - 4,
                                  chainageLabel: `RD ${(baseCh - 4).toFixed(1)}m`,
                                  tunnelName: settings.tunnelName,
                                  location: settings.locationName || 'HRT',
                                  rmrValue: 28,
                                  rmrClass: 'Class IV (Shear F1)',
                                  qValue: 0.32,
                                  qClass: 'Very Poor',
                                  rqdPct: 32,
                                  supportCategory: 'Cat 7 (L=3.3m, 140mm Sfr + Ribs)',
                                  isWeakOrFaultZone: true,
                                  isCurrentStation: false,
                                },
                                ...computedRows,
                                {
                                  id: 'st-5',
                                  chainageMeters: baseCh + 4,
                                  chainageLabel: `RD ${(baseCh + 4).toFixed(1)}m`,
                                  tunnelName: settings.tunnelName,
                                  location: settings.locationName || 'HRT',
                                  rmrValue: 61,
                                  rmrClass: 'Class II',
                                  qValue: 7.8,
                                  qClass: 'Fair/Good',
                                  rqdPct: 72,
                                  supportCategory: 'Cat 4 (L=3.3m, 60mm Sfr)',
                                  isWeakOrFaultZone: false,
                                  isCurrentStation: false,
                                },
                              ];
                              setDemoAlignmentStations(sampleRows);
                            }}
                            className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-600/50 text-[10px] font-bold cursor-pointer"
                          >
                            + Load Multi-Round Alignment Strip (RD 120m → RD 150m)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Multi-Track Longitudinal Strip Chart SVG */}
                    <div className="bg-slate-950 border border-slate-800 rounded p-3">
                      {(() => {
                        const n = Math.max(1, rows.length);
                        const colW = Math.min(160, Math.max(95, Math.floor(680 / n)));
                        const svgW = Math.max(760, 90 + n * colW);

                        return (
                          <svg
                            viewBox={`0 0 ${svgW} 175`}
                            className={`w-full h-[170px] rounded border ${
                              isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#070B12] border-slate-800'
                            }`}
                          >
                            {/* Track Labels on Left */}
                            <text x="10" y="32" fontSize="9.5" fontWeight="700" fill={isLight ? '#334155' : '#94A3B8'}>
                              CHAINAGE
                            </text>
                            <text x="10" y="68" fontSize="9.5" fontWeight="700" fill={isLight ? '#4F46E5' : '#818CF8'}>
                              RMR (0–100)
                            </text>
                            <text x="10" y="104" fontSize="9.5" fontWeight="700" fill={isLight ? '#0284C7' : '#38BDF8'}>
                              Q-VALUE
                            </text>
                            <text x="10" y="138" fontSize="9.5" fontWeight="700" fill={isLight ? '#059669' : '#34D399'}>
                              RQD (%)
                            </text>
                            <text x="10" y="164" fontSize="9.5" fontWeight="700" fill={isLight ? '#B45309' : '#FBBF24'}>
                              SUPPORT
                            </text>

                            <line
                              x1="85"
                              y1="10"
                              x2="85"
                              y2="170"
                              stroke={isLight ? '#94A3B8' : '#334155'}
                              strokeWidth="1.2"
                            />

                            {rows.map((r, idx) => {
                              const cx = 90 + idx * colW + colW / 2;
                              const x0 = 90 + idx * colW;
                              const rmrBarW = ((r.rmrValue ?? 50) / 100) * (colW - 24);
                              return (
                                <g key={r.id}>
                                  <rect
                                    x={x0 + 2}
                                    y="10"
                                    width={colW - 4}
                                    height="158"
                                    fill={
                                      r.isWeakOrFaultZone
                                        ? 'rgba(225, 29, 72, 0.14)'
                                        : r.isCurrentStation
                                        ? 'rgba(14, 165, 233, 0.12)'
                                        : isLight
                                        ? '#FFFFFF'
                                        : 'rgba(15, 23, 42, 0.55)'
                                    }
                                    stroke={
                                      r.isWeakOrFaultZone
                                        ? '#F43F5E'
                                        : r.isCurrentStation
                                        ? '#0284C7'
                                        : isLight
                                        ? '#CBD5E1'
                                        : '#1E293B'
                                    }
                                    strokeWidth={r.isCurrentStation || r.isWeakOrFaultZone ? '1.5' : '0.8'}
                                  />

                                  {/* Station Chainage Header */}
                                  <text
                                    x={cx}
                                    y="27"
                                    textAnchor="middle"
                                    fontSize="9.5"
                                    fontWeight="700"
                                    fill={
                                      r.isWeakOrFaultZone
                                        ? isLight
                                          ? '#BE123C'
                                          : '#FDA4AF'
                                        : r.isCurrentStation
                                        ? isLight
                                          ? '#0369A1'
                                          : '#38BDF8'
                                        : isLight
                                        ? '#0F172A'
                                        : '#F8FAFC'
                                    }
                                  >
                                    {r.chainageLabel}
                                  </text>
                                  {r.isWeakOrFaultZone && (
                                    <text x={cx} y="38" textAnchor="middle" fontSize="8" fontWeight="700" fill="#E11D48">
                                      ⚠ FAULT / WEAK ZONE
                                    </text>
                                  )}

                                  {/* RMR Bar & Value */}
                                  <rect
                                    x={x0 + 12}
                                    y="52"
                                    width={Math.max(8, rmrBarW)}
                                    height="12"
                                    rx="2"
                                    fill={r.isWeakOrFaultZone ? '#F43F5E' : '#6366F1'}
                                  />
                                  <text
                                    x={cx}
                                    y="75"
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="700"
                                    fill={isLight ? '#312E81' : '#E0E7FF'}
                                  >
                                    RMR = {r.rmrValue ?? 'N/A'} ({r.rmrClass})
                                  </text>

                                  {/* Q-Value Readout */}
                                  <text
                                    x={cx}
                                    y="104"
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="700"
                                    fill={isLight ? '#0369A1' : '#38BDF8'}
                                  >
                                    Q = {r.qValue !== null ? r.qValue.toFixed(2) : 'N/A'} ({r.qClass})
                                  </text>

                                  {/* RQD (%) */}
                                  <text
                                    x={cx}
                                    y="138"
                                    textAnchor="middle"
                                    fontSize="9.5"
                                    fontWeight="700"
                                    fill={isLight ? '#047857' : '#34D399'}
                                  >
                                    RQD {r.rqdPct}%
                                  </text>

                                  {/* Support Category */}
                                  <text
                                    x={cx}
                                    y="162"
                                    textAnchor="middle"
                                    fontSize="8.5"
                                    fontWeight="700"
                                    fill={isLight ? '#B45309' : '#FDE68A'}
                                  >
                                    {r.supportCategory.slice(0, 22)}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                {selectedMethod === 'RMR' && renderRmrSection(false)}
                {selectedMethod === 'Q_SYSTEM' && renderQSystemSection(false)}
                {selectedMethod === 'GSI' && renderGsiSection()}
                {selectedMethod === 'BOTH_RMR_AND_Q' && (
                  <div className="space-y-4">
                    <div className="p-2 bg-slate-900/90 border border-indigo-500/40 rounded flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-300">
                        DUAL STATION CLASSIFICATION ({settings.faceChainage}) — RMR AND Q-SYSTEM STORED
                        SEPARATELY WITHOUT MIXING PARAMETERS
                      </span>
                      <span className="text-slate-400">
                        RMR:{' '}
                        <strong className="text-white">
                          {rmrResult.finalRmr !== null ? rmrResult.finalRmr : 'Incomplete'}
                        </strong>{' '}
                        | Q:{' '}
                        <strong className="text-cyan-300">
                          {qResult.isComplete ? qResult.qValue.toFixed(2) : 'Incomplete'}
                        </strong>
                      </span>
                    </div>
                    {renderRmrSection(true)}
                    <div className="border-t border-slate-800 pt-3">{renderQSystemSection(true)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const GeologyAndQIndexDrawer = React.memo(GeologyAndQIndexDrawerComponent);
