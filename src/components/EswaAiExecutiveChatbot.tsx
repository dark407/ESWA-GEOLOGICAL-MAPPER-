import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Compass,
  Cpu,
  Database,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Layers,
  Maximize2,
  Minimize2,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  LithologyRegion,
  OverbreakUndercutAnalysis,
  PlacedGeologicalSymbol,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  ContinuousPullRecord,
  ContinuousStripTrace,
  ContinuousTunnelStripDataset,
  loadAllContinuousStripDatasets,
  saveAllContinuousStripDatasets,
} from '../engine/continuous3DStripEngine';
import {
  computeAdvancedOverbreakPrediction,
  computeRockStrataSupportSpotBoltingAndFailureFos,
} from '../engine/supportSpotBoltFailureEngine';
import { EswaTunnelLogo } from './EswaBrandIdentity';
import { useTheme } from '../context/ThemeContext';

export type EngineeringExportTemplateId =
  | 'AUTO_BEST_TEMPLATE'
  | 'SUPPORT_SPOTBOLT_FOS_TEMPLATE'
  | 'STRIP_PULL_LOG_TEMPLATE'
  | 'JOINT_DISCONTINUITY_TEMPLATE'
  | 'OVERBREAK_SUPPORT_BOQ_TEMPLATE'
  | 'EXECUTIVE_PROJECT_AUDIT_TEMPLATE';

export interface EswaAiExecutedAction {
  actionType:
    | 'OPEN_3D_CONTINUOUS_LOGGING'
    | 'OPEN_FACE_MAPPING'
    | 'OPEN_CUSTOM_PROFILE_EDITOR'
    | 'OPEN_PROJECT_DATABASE'
    | 'OPEN_EXPORT_SHEET'
    | 'UPDATE_GEOMETRY'
    | 'UPDATE_SETTINGS'
    | 'ADD_JOINT'
    | 'ADD_STRIP_PULL'
    | 'SAVE_SECTION'
    | 'SET_THEME'
    | 'NONE';
  description: string;
  payloadJson?: string;
}

export interface EswaAiExtractedDataPackage {
  title: string;
  subtitle?: string;
  templateType: EngineeringExportTemplateId;
  summaryMetrics?: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
}

export interface EswaAiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  engineLabel?: string;
  executedActions?: EswaAiExecutedAction[];
  extractedData?: EswaAiExtractedDataPackage;
}

interface EswaAiExecutiveChatbotProps {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  qIndexParams: QIndexParameters;
  rmrParams: RmrParameters;
  rockMassSummary: RockMassSummaryTable;
  lithologyRegions: LithologyRegion[];
  placedSymbols: PlacedGeologicalSymbol[];
  overbreakAnalysis: OverbreakUndercutAnalysis;
  savedProjects: SavedProjectRecord[];
  onNavigateScreen: (
    target:
      | 'start'
      | 'geometry_manual'
      | 'geometry_cad'
      | 'geometry_custom'
      | 'drive_and_photos'
      | 'mapping'
  ) => void;
  onOpenContinuous3DLogger: () => void;
  onOpenProjectDatabase: () => void;
  onOpenExportSheet: () => void;
  onUpdateGeometryDimensions: (width: number, height: number, wallHeight?: number) => void;
  onUpdateSettings: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  onAddExecutiveJoint: (joint: Partial<Joint>) => void;
  onSaveCurrentSection: () => void;
}

const TEMPLATE_LABELS: Record<EngineeringExportTemplateId, string> = {
  AUTO_BEST_TEMPLATE: 'Auto-Select Best Engineering Template',
  SUPPORT_SPOTBOLT_FOS_TEMPLATE: 'Support System, Spot Bolting & Factor of Safety (FoS) Template',
  STRIP_PULL_LOG_TEMPLATE: '3D Continuous Strip Pull & Chainage Template',
  JOINT_DISCONTINUITY_TEMPLATE: 'ISRM Structural Joint & Discontinuity Template',
  OVERBREAK_SUPPORT_BOQ_TEMPLATE: 'Overbreak / Undercut & Support BOQ Template',
  EXECUTIVE_PROJECT_AUDIT_TEMPLATE: 'Full Project Multi-Section Executive Audit Template',
};

export const EswaAiExecutiveChatbot: React.FC<EswaAiExecutiveChatbotProps> = ({
  geometry,
  settings,
  joints,
  jointSets,
  qIndexParams,
  rmrParams,
  rockMassSummary,
  lithologyRegions,
  placedSymbols,
  overbreakAnalysis,
  savedProjects,
  onNavigateScreen,
  onOpenContinuous3DLogger,
  onOpenProjectDatabase,
  onOpenExportSheet,
  onUpdateGeometryDimensions,
  onUpdateSettings,
  onAddExecutiveJoint,
  onSaveCurrentSection,
}) => {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isToggleVisible, setIsToggleVisible] = useState<boolean>(true);
  const [isHoveringToggle, setIsHoveringToggle] = useState<boolean>(false);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EngineeringExportTemplateId>('AUTO_BEST_TEMPLATE');
  const [expandedExtractMsgId, setExpandedExtractMsgId] = useState<string | null>(null);
  const [previewSheetPkg, setPreviewSheetPkg] = useState<{
    msgText: string;
    pkg: EswaAiExtractedDataPackage;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Automatically show small logo toggle on any touch / pointer / key interaction, and hide after 5 seconds
  useEffect(() => {
    const wakeToggle = () => {
      setIsToggleVisible(true);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        setIsToggleVisible(false);
      }, 5000);
    };

    wakeToggle();

    window.addEventListener('touchstart', wakeToggle, { passive: true });
    window.addEventListener('pointerdown', wakeToggle, { passive: true });
    window.addEventListener('pointermove', wakeToggle, { passive: true });
    window.addEventListener('keydown', wakeToggle, { passive: true });

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      window.removeEventListener('touchstart', wakeToggle);
      window.removeEventListener('pointerdown', wakeToggle);
      window.removeEventListener('pointermove', wakeToggle);
      window.removeEventListener('keydown', wakeToggle);
    };
  }, []);

  // Load 3D Continuous Strip datasets so ESWA AI has full visibility & write authority over 3D strip logging
  const stripDatasets = useMemo<ContinuousTunnelStripDataset[]>(() => {
    try {
      return loadAllContinuousStripDatasets();
    } catch {
      return [];
    }
  }, [isOpen, savedProjects.length]);

  const activeStripDs = stripDatasets[0];

  // Calculate live Q-value & RMR total for grounding
  const computedQValue = useMemo(() => {
    const jn = Math.max(0.5, qIndexParams.jn || 9);
    const jr = Math.max(0.5, qIndexParams.jr || 1.5);
    const ja = Math.max(0.75, qIndexParams.ja || 2.0);
    const jw = Math.max(0.1, qIndexParams.jw || 1.0);
    const srf = Math.max(0.5, qIndexParams.srf || 1.0);
    return Number((((qIndexParams.rqd || 75) / jn) * (jr / ja) * (jw / srf)).toFixed(2));
  }, [qIndexParams]);

  const computedRmrTotal = useMemo(() => {
    return (
      (rmrParams.intactStrengthRating ?? 12) +
      (rmrParams.rqdRating ?? 13) +
      (rmrParams.spacingRating ?? 10) +
      (rmrParams.conditionRating ?? 20) +
      (rmrParams.groundwaterRating ?? 10) +
      (rmrParams.orientationAdjustmentRating ?? -5)
    );
  }, [rmrParams]);

  // Safe number formatter to prevent calling .toFixed on null or undefined
  const fmtNum = (val: number | null | undefined, digits = 2, fallback = 0): string => {
    const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
    return n.toFixed(digits);
  };

  // Live AI Overbreak Root-Cause & Advance Prediction + Support System, Spot Bolting & Failure FoS
  const overbreakPrediction = useMemo(
    () =>
      computeAdvancedOverbreakPrediction(
        geometry,
        settings,
        overbreakAnalysis,
        joints,
        jointSets,
        qIndexParams,
        rmrParams,
        savedProjects
      ),
    [geometry, settings, overbreakAnalysis, joints, jointSets, qIndexParams, rmrParams, savedProjects]
  );

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

  // Build default initial welcome message with live data package ready to export
  const buildDefaultAuditPackage = (): EswaAiExtractedDataPackage => {
    const pulls = activeStripDs?.pulls || [];
    const roundLen = settings.roundLength || 3.5;
    const obVol =
      overbreakAnalysis.overbreakVolumeCubicMeters ??
      overbreakAnalysis.overbreakAreaSqMeters * roundLen;
    return {
      title: `${settings.tunnelName || 'HEADRACE TUNNEL'} — Live Geotechnical & 3D Strip Executive Schedule`,
      subtitle: `Chainage ${settings.faceChainage || settings.chainage} · Profile ${fmtNum(geometry.width)}m × ${fmtNum(geometry.height)}m · Q = ${computedQValue} · RMR = ${computedRmrTotal}`,
      templateType: 'EXECUTIVE_PROJECT_AUDIT_TEMPLATE',
      summaryMetrics: [
        { label: 'Active Tunnel', value: settings.tunnelName || 'Main Tunnel' },
        { label: 'Excavation W × H', value: `${fmtNum(geometry.width)}m × ${fmtNum(geometry.height)}m` },
        { label: 'Design Area', value: `${fmtNum(overbreakAnalysis.designAreaSqMeters)} m²` },
        { label: 'Mapped Face/Wall Joints', value: `${joints.length} (${jointSets.length} Sets)` },
        { label: 'Q-Index / RMR89', value: `Q = ${computedQValue} / RMR = ${computedRmrTotal}` },
        { label: '3D Strip Pulls Logged', value: `${pulls.length} Pulls (${activeStripDs?.traces.length || 0} Traces)` },
      ],
      columns: [
        'Record / Pull ID',
        'Chainage (RD)',
        'Azimuth (°N)',
        'Rock Type / Lithology',
        'Class / RMR / RQD',
        'Key Joint Sets & Orientation',
        'Overbreak / Support Installed',
      ],
      rows: [
        [
          'ACTIVE-FACE',
          settings.faceChainage || settings.chainage,
          `${fmtNum(settings.driveDirection, 1)}°N`,
          settings.lithology || rockMassSummary.rockType || 'Unmapped',
          `RMR ${computedRmrTotal} / RQD ${qIndexParams.rqd}% (Q=${computedQValue})`,
          jointSets.length > 0
            ? jointSets
                .map(
                  (s) =>
                    `${s.id} (${Math.round(s.avgDipDirection ?? 55)}°/${Math.round(s.avgDip ?? 50)}°)`
                )
                .join('; ')
            : 'No joints mapped yet',
          `OB: ${fmtNum(overbreakAnalysis.overbreakPercentage, 1)}% (${fmtNum(obVol)} m³)`,
        ],
        ...pulls.slice(0, 8).map((p, idx) => [
          `PULL-${idx + 1}`,
          `RD ${p.fromRd}m – ${p.toRd}m`,
          `${p.driveAzimuthDeg}°N`,
          p.rockType || 'Unmapped',
          `Class ${p.rockClass} / RMR ${p.rmrValue ?? 0} / RQD ${p.rqdValue ?? 0}%`,
          (activeStripDs?.traces || [])
            .slice(0, 3)
            .map((t) => `${t.setId} (${t.orientationLabel})`)
            .join(', ') || 'No traces',
          `OB: ${fmtNum(p.overbreakVolumeM3)} m³ · ${p.supportDescription || '-'}`,
        ]),
      ],
    };
  };

  const [messages, setMessages] = useState<EswaAiChatMessage[]>([]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  // Build specialized template package from live software data based on query/template
  const buildDataPackageForCategory = (
    category: EngineeringExportTemplateId,
    customTitle?: string
  ): EswaAiExtractedDataPackage => {
    const pulls = activeStripDs?.pulls || [];
    const stripTraces = activeStripDs?.traces || [];

    if (category === 'SUPPORT_SPOTBOLT_FOS_TEMPLATE') {
      return {
        title:
          customTitle ||
          `${settings.tunnelName} — Support System, Spot Bolting & Failure Mode Factor of Safety Schedule`,
        subtitle: `Chainage ${settings.faceChainage || settings.chainage} · Strata FoS = ${supportAndFos.strataSupportFactorOfSafety} (Target ≥ ${supportAndFos.requiredStrataFos}) · Total Bolts = ${supportAndFos.totalBoltsRequiredRound} Nos`,
        templateType: 'SUPPORT_SPOTBOLT_FOS_TEMPLATE',
        summaryMetrics: [
          { label: 'Strata Support FoS', value: `${supportAndFos.strataSupportFactorOfSafety} (${supportAndFos.strataSafetyStatus})` },
          { label: 'Support Capacity / Req', value: `${supportAndFos.installedSupportCapacityKpa} / ${supportAndFos.supportPressureDemandKpa} kPa` },
          { label: 'Systematic Bolts', value: `${supportAndFos.systematicBoltsTotalRound} Nos (L=${supportAndFos.systematicBoltLengthM}m @ ${supportAndFos.systematicBoltSpacingM}m)` },
          { label: 'AI Spot Bolts', value: `${supportAndFos.spotBoltsTotalRound} Nos (${supportAndFos.spotBoltLocations.length} Zones)` },
          { label: 'Shotcrete / Mesh', value: `${supportAndFos.shotcreteThicknessMm}mm SFRS · ${supportAndFos.wireMeshLayers} Mesh` },
          { label: 'Prev Pulls Avg Spot', value: `${supportAndFos.previousPullsSpotBoltSummary.avgSpotBoltsPerPull} Bolts/Pull` },
        ],
        columns: [
          'Item / Failure / Spot ID',
          'Location / Sector',
          'Governing Sets / Coordinates',
          'Unbolted FoS / Prev Pulls',
          'Supported FoS / Bolts Req.',
          'AI Engineering Reason & Recommendation',
        ],
        rows: [
          [
            'STRATA-SUPPORT',
            'Full Arch Perimeter',
            `Span ${fmtNum(geometry.width)}m × ${fmtNum(geometry.height)}m`,
            `Demand: ${supportAndFos.supportPressureDemandKpa} kPa`,
            `FoS = ${supportAndFos.strataSupportFactorOfSafety} (Cap ${supportAndFos.installedSupportCapacityKpa} kPa)`,
            supportAndFos.supportCategoryLabel,
          ],
          ...supportAndFos.spotBoltLocations.map((sb) => [
            sb.id,
            sb.sectorLabel,
            `X=${sb.coordinateX}m, Y=${sb.coordinateY}m (${sb.linkedJointSets})`,
            sb.historicalReference,
            `${sb.boltsRequired} Bolts (L=${sb.boltLengthMeters}m @ ${sb.installationAngleDeg}°)`,
            sb.reasonChosen,
          ]),
          ...supportAndFos.failureModes.map((fm) => [
            fm.id,
            `${fm.failureTitle} (${fm.locationSector})`,
            `${fm.governingSetsOrStrata} [${fm.blockMassTonnesOrStress}]`,
            `Unbolted FoS = ${fm.fosUnbolted.toFixed(2)}`,
            `Supported FoS = ${fm.fosSupported.toFixed(2)} (${fm.status})`,
            fm.aiDataRecommendation,
          ]),
        ],
      };
    }

    if (category === 'STRIP_PULL_LOG_TEMPLATE') {
      return {
        title:
          customTitle ||
          `${activeStripDs?.projectName || settings.tunnelName} — 3D Continuous Strip Logging Schedule`,
        subtitle: `Location: ${activeStripDs?.tunnelLocationName || settings.locationName || 'Main Headrace Tunnel'} · Span RD ${activeStripDs?.viewFromRd ?? 250}m to ${activeStripDs?.viewToRd ?? 300}m`,
        templateType: 'STRIP_PULL_LOG_TEMPLATE',
        summaryMetrics: [
          { label: 'Project', value: activeStripDs?.projectName || settings.tunnelName },
          { label: 'Tunnel Heading', value: activeStripDs?.tunnelLocationName || 'Main Drive' },
          { label: 'Logged Pulls', value: `${pulls.length} Intervals` },
          { label: '3D Traces', value: `${stripTraces.length} Continuous Traces` },
          { label: 'Lithology Zones', value: `${activeStripDs?.lithologyZones.length || 0} Zones` },
          { label: 'Water Inflows', value: `${activeStripDs?.waterSymbols.length || 0} Points` },
        ],
        columns: [
          'Pull Interval (RD)',
          'Length (m)',
          'Drive Azimuth',
          'Rock Type & Description',
          'Rock Class',
          'RMR / RQD',
          'Overbreak (m³)',
          'Support Installed (Shotcrete / Mesh / Bolts)',
          'Seepage / Weathering',
        ],
        rows: pulls.map((p) => [
          `RD ${fmtNum(p.fromRd, 1)}m – ${fmtNum(p.toRd, 1)}m`,
          `${fmtNum(p.toRd - p.fromRd, 1)}m`,
          `${p.driveAzimuthDeg}°N`,
          `${p.rockType} — ${p.rockDescription}`,
          `Class ${p.rockClass} (Support ${p.supportClass || '2/3a'})`,
          `RMR ${p.rmrValue} / RQD ${p.rqdValue}%`,
          `${fmtNum(p.overbreakVolumeM3)} m³`,
          `${p.shotcreteInstalled || '10cm Wet'} | ${p.wireMeshInstalled || '1 Layer'} | Bolts: ${p.rockBoltsInstalled || '40/3m'}`,
          `${p.seepageCondition} / ${p.weatheringCondition}`,
        ]),
      };
    }

    if (category === 'JOINT_DISCONTINUITY_TEMPLATE') {
      const jointRows: string[][] =
        joints.length > 0
          ? joints.map((j, idx) => [
              j.id || `J-${idx + 1}`,
              j.set || 'J1',
              j.surface.toUpperCase(),
              `${String(Math.round(j.dipDirection)).padStart(3, '0')}/${String(Math.round(j.dip)).padStart(2, '0')}`,
              `${(j.persistenceMeters || 2.4).toFixed(2)}m`,
              '1.50m',
              j.roughness || 'Rough / Planar',
              j.infilling || 'Tight / Clean',
              j.apertureMm || '1-3 mm',
              j.waterCondition || 'Dry',
            ])
          : stripTraces.map((t, idx) => [
              t.id || `TR-${idx + 1}`,
              t.setId,
              '3D STRIP ROLLOUT',
              t.orientationLabel,
              `${t.points.length} vertices`,
              '1.60m',
              t.structureType,
              t.fillingThickness,
              '2-5 mm',
              'Damp',
            ]);

      return {
        title:
          customTitle ||
          `${settings.tunnelName} — ISRM Discontinuity & Structural Joint Set Schedule`,
        subtitle: `Chainage ${settings.faceChainage || settings.chainage} · Drive Direction N ${settings.driveDirection.toFixed(1)}° E · ${jointRows.length} Discontinuities`,
        templateType: 'JOINT_DISCONTINUITY_TEMPLATE',
        summaryMetrics: [
          { label: 'Chainage', value: settings.faceChainage || settings.chainage },
          { label: 'Drive Azimuth', value: `${settings.driveDirection.toFixed(1)}°N` },
          { label: 'Face/Wall Joints', value: `${joints.length}` },
          { label: 'Joint Sets', value: `${jointSets.length}` },
          { label: '3D Strip Traces', value: `${stripTraces.length}` },
          { label: 'RQD / Q-Index', value: `${qIndexParams.rqd}% / Q=${computedQValue}` },
        ],
        columns: [
          'Joint ID',
          'Set ID',
          'Mapped Surface',
          'DipDir / Dip (°)',
          'Persistence / Trace',
          'Spacing (m)',
          'Roughness / Structure',
          'Infilling / Coating',
          'Aperture',
          'Water Condition',
        ],
        rows: jointRows,
      };
    }

    if (category === 'OVERBREAK_SUPPORT_BOQ_TEMPLATE') {
      const roundLen = settings.roundLength || 3.5;
      const recBoltLen = Number(Math.max(2.5, Math.min(5.5, 2.0 + 0.15 * geometry.width)).toFixed(1));
      const archPerim = geometry.wallHeight * 2 + geometry.crownArcLength;
      const boltsPerRing = Math.max(6, Math.round(archPerim / 1.5));
      const ringsPerRound = Math.max(1, Math.round(roundLen / 1.5));
      const totalBolts = boltsPerRing * ringsPerRound;
      const shotcreteVol = Number((archPerim * roundLen * 0.1 * 1.2).toFixed(2));
      const designVol =
        overbreakAnalysis.designVolumeCubicMeters ??
        overbreakAnalysis.designAreaSqMeters * roundLen;
      const obVol =
        overbreakAnalysis.overbreakVolumeCubicMeters ??
        overbreakAnalysis.overbreakAreaSqMeters * roundLen;
      const ucVol =
        overbreakAnalysis.undercutVolumeCubicMeters ??
        overbreakAnalysis.undercutAreaSqMeters * roundLen;

      return {
        title:
          customTitle ||
          `${settings.tunnelName} — Excavation Overbreak/Undercut & Rock Support BOQ Ledger`,
        subtitle: `Chainage ${settings.faceChainage || settings.chainage} · Round Length ${roundLen}m · Profile ${fmtNum(geometry.width)}m W × ${fmtNum(geometry.height)}m H`,
        templateType: 'OVERBREAK_SUPPORT_BOQ_TEMPLATE',
        summaryMetrics: [
          { label: 'Design Area', value: `${fmtNum(overbreakAnalysis.designAreaSqMeters)} m²` },
          { label: 'Surveyed Area', value: `${fmtNum(overbreakAnalysis.surveyedAreaSqMeters)} m²` },
          { label: 'Overbreak Area / %', value: `${fmtNum(overbreakAnalysis.overbreakAreaSqMeters)} m² (${fmtNum(overbreakAnalysis.overbreakPercentage, 1)}%)` },
          { label: 'Overbreak Volume', value: `${fmtNum(obVol)} m³` },
          { label: 'Undercut Volume', value: `${fmtNum(ucVol)} m³` },
          { label: 'Support Category', value: `Q = ${computedQValue} (Bolts L=${recBoltLen}m)` },
        ],
        columns: [
          'BOQ Item Code',
          'Engineering Description',
          'Unit',
          'Design Quantity',
          'As-Built / Measured',
          'Variance / Remarks',
        ],
        rows: [
          [
            'EX-01',
            `Theoretical Design Excavation Cross-Section (${geometry.crownGeometry})`,
            'm²',
            fmtNum(overbreakAnalysis.designAreaSqMeters),
            fmtNum(overbreakAnalysis.surveyedAreaSqMeters),
            `Perimeter = ${fmtNum(archPerim)} m`,
          ],
          [
            'EX-02',
            `Neat Design Excavation Volume (per ${roundLen}m Advance Round)`,
            'm³',
            fmtNum(designVol),
            fmtNum(overbreakAnalysis.surveyedAreaSqMeters * roundLen),
            `Chainage ${settings.faceChainage || settings.chainage}`,
          ],
          [
            'OB-01',
            'Geological Overbreak Beyond Design Payline',
            'm³',
            '0.00',
            fmtNum(obVol),
            `${fmtNum(overbreakAnalysis.overbreakPercentage)}% of Design Profile (Max ${fmtNum(overbreakAnalysis.maxRadialOverbreakMeters)}m)`,
          ],
          [
            'UC-01',
            'Tight-Rock Undercut Inside Design Payline (Trimming Required)',
            'm³',
            '0.00',
            fmtNum(ucVol),
            `${fmtNum(overbreakAnalysis.undercutPercentage)}% of Design Profile (Max ${fmtNum(overbreakAnalysis.maxRadialUndercutMeters)}m)`,
          ],
          [
            'SUP-01',
            `SN Grouted Rock Bolts Ø25mm, Length L = ${recBoltLen}m @ 1.5m × 1.5m c/c`,
            'Nos / m',
            `${totalBolts} Nos`,
            `${fmtNum(totalBolts * recBoltLen, 1)} m`,
            `${boltsPerRing} bolts/ring × ${ringsPerRound} rings`,
          ],
          [
            'SUP-02',
            'Wet-Mix Steel Fibre Reinforced Shotcrete (SFRS 100mm incl. 20% rebound)',
            'm³',
            fmtNum(shotcreteVol),
            fmtNum(shotcreteVol),
            `Q = ${computedQValue} · RMR = ${computedRmrTotal}`,
          ],
        ],
      };
    }

    return buildDefaultAuditPackage();
  };

  // Execute structured software authority commands returned by AI or Local Executive Engine
  const executeSoftwareAuthorityActions = (actions: EswaAiExecutedAction[]) => {
    for (const act of actions) {
      let payload: Record<string, unknown> = {};
      if (act.payloadJson) {
        try {
          payload = JSON.parse(act.payloadJson);
        } catch {
          payload = {};
        }
      }

      switch (act.actionType) {
        case 'OPEN_3D_CONTINUOUS_LOGGING':
          onOpenContinuous3DLogger();
          break;
        case 'OPEN_FACE_MAPPING':
          onNavigateScreen('mapping');
          break;
        case 'OPEN_CUSTOM_PROFILE_EDITOR':
          onNavigateScreen('geometry_custom');
          break;
        case 'OPEN_PROJECT_DATABASE':
          onOpenProjectDatabase();
          break;
        case 'OPEN_EXPORT_SHEET':
          onOpenExportSheet();
          break;
        case 'SET_THEME': {
          const t = String(payload.theme || '').toLowerCase();
          if (t === 'light' || t === 'dark') {
            setTheme(t);
          }
          break;
        }
        case 'UPDATE_GEOMETRY': {
          const w = Number(payload.width) || geometry.width;
          const h = Number(payload.height) || geometry.height;
          const wh = payload.wallHeight ? Number(payload.wallHeight) : undefined;
          onUpdateGeometryDimensions(w, h, wh);
          break;
        }
        case 'UPDATE_SETTINGS': {
          onUpdateSettings((prev) => ({
            ...prev,
            ...(typeof payload.tunnelName === 'string' ? { tunnelName: payload.tunnelName } : {}),
            ...(typeof payload.chainage === 'string' ? { chainage: payload.chainage } : {}),
            ...(typeof payload.faceChainage === 'string'
              ? { faceChainage: payload.faceChainage }
              : {}),
            ...(typeof payload.driveDirection === 'number'
              ? {
                  driveDirection: payload.driveDirection,
                  driveDirectionInput: `${payload.driveDirection}°`,
                }
              : {}),
            ...(typeof payload.roundLength === 'number'
              ? { roundLength: payload.roundLength }
              : {}),
            ...(typeof payload.lithology === 'string' ? { lithology: payload.lithology } : {}),
          }));
          break;
        }
        case 'ADD_JOINT': {
          onAddExecutiveJoint({
            dipDirection: Number(payload.dipDirection) || 65,
            dip: Number(payload.dip) || 52,
            set: String(payload.set || 'J1'),
            roughness: String(payload.roughness || 'Rough / Stepped'),
            infilling: String(payload.infilling || 'Quartz / Tight'),
          });
          break;
        }
        case 'ADD_STRIP_PULL': {
          try {
            const allDs = loadAllContinuousStripDatasets();
            if (allDs.length > 0) {
              const target = allDs[0];
              const lastPull = target.pulls[target.pulls.length - 1];
              const fromRd = Number(payload.fromRd) || (lastPull ? lastPull.toRd : 300);
              const toRd = Number(payload.toRd) || fromRd + 5;
              const newPull: ContinuousPullRecord = {
                id: `pull-ai-${fromRd}-${toRd}-${Date.now()}`,
                fromRd,
                toRd,
                driveAzimuthDeg: Number(payload.azimuth) || 161,
                gradientPct: 0.166,
                leftBoundaryAzimuthDeg: ((Number(payload.azimuth) || 161) + 180) % 360,
                convergenceMm: '0 mm',
                rockType: String(payload.rockType || 'Qtz - Quartzite'),
                rockDescription: 'AI Executive logged medium grained strong Quartzite',
                rockClass: String(payload.rockClass || 'II'),
                supportDescription: '10cm Wet Shotcrete, 1 Layer Wire Mesh, 40/3m Rock Bolts',
                shotcreteInstalled: '10cm WET',
                wireMeshInstalled: '3.01 (kg/m²) 1 Layer',
                rockBoltsInstalled: '40/3m',
                seepageCondition: 'DRY',
                weatheringCondition: 'W2',
                ucsRangeMpa: '150 MPa (VERY STRONG)',
                rmrValue: Number(payload.rmr) || 62,
                rqdValue: Number(payload.rqd) || 75,
                overbreakVolumeM3: 0.32,
                excavationDefiningNo: '2',
                excavationDate: new Date().toISOString().slice(0, 10),
                supportClass: '2/3a',
                status: 'MAPPED',
                dateMapped: new Date().toISOString().slice(0, 10),
              };
              const newTrace: ContinuousStripTrace = {
                id: `tr-ai-${Date.now()}`,
                structureType: 'JS1 - Foliation',
                setId: 'JS1',
                orientationLabel: '055/50',
                dipDirectionDeg: 55,
                dipDeg: 50,
                fillingThickness: 'Clay Coated',
                points: [
                  { x: fromRd + 0.4, y: 2.2 },
                  { x: (fromRd + toRd) / 2, y: 8.8 },
                  { x: toRd - 0.4, y: 15.2 },
                ],
              };
              allDs[0] = {
                ...target,
                pulls: [...target.pulls, newPull],
                traces: [...target.traces, newTrace],
                viewToRd: Math.max(target.viewToRd, toRd),
              };
              saveAllContinuousStripDatasets(allDs);
            }
          } catch {
            // ignore storage errors
          }
          break;
        }
        case 'SAVE_SECTION':
          onSaveCurrentSection();
          break;
        default:
          break;
      }
    }
  };

  // Local Intelligent Question & Command Engine (answers the exact question asked)
  const runLocalExecutiveEngine = (
    userQuery: string
  ): {
    reply: string;
    executedActions: EswaAiExecutedAction[];
    extractedDataPackage?: EswaAiExtractedDataPackage;
  } => {
    const qLower = userQuery.trim().toLowerCase();
    const executedActions: EswaAiExecutedAction[] = [];

    // 1. Check for conversational greetings
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|namaste|vanakkam)\b/i.test(qLower) && qLower.length < 28) {
      return {
        reply: `Hello! How can I help you today? You can ask me specific questions about your tunnel geometry, joints, RMR/Q-system, overbreak, or 3D continuous strip logging, or ask me to open any tool.`,
        executedActions: [],
      };
    }

    // 2. Check for navigation or software control commands
    if (
      qLower.includes('open 3d') ||
      qLower.includes('continuous logging') ||
      qLower.includes('open strip')
    ) {
      executedActions.push({
        actionType: 'OPEN_3D_CONTINUOUS_LOGGING',
        description: 'Opened 3D Continuous Strip Logging Workspace',
      });
    }
    if (qLower.includes('open face') || qLower.includes('face mapping') || qLower.includes('wall mapping')) {
      executedActions.push({
        actionType: 'OPEN_FACE_MAPPING',
        description: 'Opened Face & Wall Surface Mapping Workspace',
      });
    }
    if (qLower.includes('profile editor') || qLower.includes('create tunnel shape')) {
      executedActions.push({
        actionType: 'OPEN_CUSTOM_PROFILE_EDITOR',
        description: 'Opened Custom Tunnel Profile & Cavern Editor',
      });
    }
    if (qLower.includes('light mode') || qLower.includes('white theme')) {
      executedActions.push({
        actionType: 'SET_THEME',
        description: 'Switched software theme to Light Mode',
        payloadJson: JSON.stringify({ theme: 'light' }),
      });
    } else if (qLower.includes('dark mode') || qLower.includes('dark theme')) {
      executedActions.push({
        actionType: 'SET_THEME',
        description: 'Switched software theme to Dark Mode',
        payloadJson: JSON.stringify({ theme: 'dark' }),
      });
    }

    // Check for geometry dimension update (e.g., "set width 9.5 height 8.0" or "resize to 10x8")
    const dimMatch = userQuery.match(/(\d+(?:\.\d+)?)\s*(?:m\s*)?[x×by]\s*(\d+(?:\.\d+)?)/i);
    if (dimMatch && (qLower.includes('width') || qLower.includes('resize') || qLower.includes('set') || qLower.includes('geometry'))) {
      const newW = parseFloat(dimMatch[1]);
      const newH = parseFloat(dimMatch[2]);
      if (newW >= 2 && newH >= 2) {
        executedActions.push({
          actionType: 'UPDATE_GEOMETRY',
          description: `Updated Master Tunnel Geometry to ${newW.toFixed(2)}m W × ${newH.toFixed(2)}m H`,
          payloadJson: JSON.stringify({ width: newW, height: newH }),
        });
      }
    }

    // Check for adding a 3D strip pull interval
    if (qLower.includes('add pull') || qLower.includes('new pull') || qLower.includes('log pull')) {
      const pulls = activeStripDs?.pulls || [];
      const lastTo = pulls.length > 0 ? pulls[pulls.length - 1].toRd : 0;
      executedActions.push({
        actionType: 'ADD_STRIP_PULL',
        description: `Added 5m Pull Interval (RD ${lastTo}m to ${lastTo + 5}m) to 3D Continuous Strip Logger`,
        payloadJson: JSON.stringify({
          fromRd: lastTo,
          toRd: lastTo + 5,
          azimuth: settings.driveDirection || 0,
          rockType: settings.lithology || 'Rock Mass',
          rockClass: 'II',
          rmr: computedRmrTotal,
          rqd: qIndexParams.rqd,
        }),
      });
    }

    // Check for adding a face joint
    if (qLower.includes('add joint') || qLower.includes('insert joint')) {
      executedActions.push({
        actionType: 'ADD_JOINT',
        description: 'Added Structural Discontinuity Joint (065/52, Set J1) to Active Surface',
        payloadJson: JSON.stringify({ dipDirection: 65, dip: 52, set: 'J1' }),
      });
    }

    if (executedActions.length > 0 && !qLower.includes('show') && !qLower.includes('data') && !qLower.includes('table')) {
      return {
        reply: executedActions.map((a) => `Done: ${a.description}.`).join('\n'),
        executedActions,
      };
    }

    // 3. Determine whether user explicitly asked to display a table or schedule
    const wantsTableOrExtract =
      qLower.includes('show table') ||
      qLower.includes('data table') ||
      qLower.includes('schedule') ||
      qLower.includes('boq table');

    const pulls = activeStripDs?.pulls || [];
    const stripTraces = activeStripDs?.traces || [];
    const roundLen = settings.roundLength || 3.5;
    const obVol =
      overbreakAnalysis.overbreakVolumeCubicMeters ??
      overbreakAnalysis.overbreakAreaSqMeters * roundLen;
    const ucVol =
      overbreakAnalysis.undercutVolumeCubicMeters ??
      overbreakAnalysis.undercutAreaSqMeters * roundLen;

    // Topic 1: Spot Bolting (AI location choice, reasons, previous spotbolt pull history, number of bolts required)
    if (
      qLower.includes('spot bolt') ||
      qLower.includes('spotbolt') ||
      qLower.includes('previous spot') ||
      qLower.includes('bolts required') ||
      qLower.includes('number of bolt') ||
      (qLower.includes('bolt') && (qLower.includes('choose') || qLower.includes('location') || qLower.includes('reason') || qLower.includes('previous')))
    ) {
      const prevSum = supportAndFos.previousPullsSpotBoltSummary;
      const spotLines = supportAndFos.spotBoltLocations
        .map(
          (sb) =>
            `- **${sb.id} (${sb.sectorLabel} at X=${sb.coordinateX}m, Y=${sb.coordinateY}m)**: **${sb.boltsRequired} Spot Bolts Required** (L = ${sb.boltLengthMeters}m, Ø${sb.boltDiameterMm}mm @ ${sb.installationAngleDeg}°)\n  • *Reason Chosen*: ${sb.reasonChosen}\n  • *Previous Pull Data*: ${sb.historicalReference}`
        )
        .join('\n');
      const histLines = prevSum.historicalRecords
        .slice(0, 4)
        .map(
          (h) =>
            `  • **${h.chainageLabel}** (${h.sector}): **${h.spotBoltsUsed} Spot Bolts** (L=${h.boltLengthM}m, OB=${h.overbreakM3}m³) — ${h.reason}`
        )
        .join('\n');

      return {
        reply: `**AI Spot Bolting Analysis & Historical Pull Correlation (${settings.faceChainage || settings.chainage}):**\n\n**1. Chosen Spot Bolting Locations & Bolts Required (Total = ${supportAndFos.spotBoltsTotalRound} Spot Bolts + ${supportAndFos.systematicBoltsTotalRound} Systematic Bolts = ${supportAndFos.totalBoltsRequiredRound} Bolts):**\n${spotLines}\n\n**2. Data Collected from Previous Spot-Bolt Pulls (${prevSum.totalPreviousPullsAnalyzed} Pulls Analyzed · Avg ${prevSum.avgSpotBoltsPerPull} Spot Bolts/Pull):**\n${histLines}\n\n*Note: You can modify and edit every spot bolt location, bolt count, length, and reason in **Step 5: Tables & Output → 3. Support System, Spot Bolting & FoS**.*`,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('SUPPORT_SPOTBOLT_FOS_TEMPLATE')
          : undefined,
      };
    }

    // Topic 2: Factor of Safety (Rock Strata Support System FoS, Wedge Failure FoS, Planar / Keyblock / Failure Modes)
    if (
      qLower.includes('factor of safety') ||
      qLower.includes('fos') ||
      qLower.includes('wedge') ||
      qLower.includes('failure') ||
      qLower.includes('strata') ||
      qLower.includes('support system') ||
      qLower.includes('where is support')
    ) {
      const fmLines = supportAndFos.failureModes
        .map(
          (fm) =>
            `- **${fm.failureTitle} (${fm.locationSector})**:\n  • *Governing*: ${fm.governingSetsOrStrata} (${fm.blockMassTonnesOrStress})\n  • *Factor of Safety*: Unbolted **FoS = ${fm.fosUnbolted.toFixed(2)}** → Supported **FoS = ${fm.fosSupported.toFixed(2)}** (Required ≥ ${fm.requiredFos.toFixed(2)} · **${fm.status}**)\n  • *AI Recommendation*: ${fm.aiDataRecommendation}`
        )
        .join('\n');

      return {
        reply: `**Rock Strata Support System & Failure Mode Factor of Safety (FoS) Analysis:**\n\n**1. Where to Find & Edit Support System in Tables & Output:**\n- Open **Step 5: Tables & Output** and click Tab **3. Support System, Spot Bolting & FoS (AI + Editable)** (also printed directly on the **Final Output Sheet**).\n\n**2. Rock Strata Support System Factor of Safety:**\n- **Rock Load Support Demand ($P_{req}$)**: \`${supportAndFos.supportPressureDemandKpa} kPa\` (Barton Q = ${computedQValue}, RMR = ${computedRmrTotal})\n- **Installed Support Capacity ($P_{cap}$)**: \`${supportAndFos.installedSupportCapacityKpa} kPa\` (${supportAndFos.systematicBoltsTotalRound} Systematic Bolts L=${supportAndFos.systematicBoltLengthM}m @ ${supportAndFos.systematicBoltSpacingM}m c/c + ${supportAndFos.spotBoltsTotalRound} Spot Bolts + ${supportAndFos.shotcreteThicknessMm}mm SFRS${supportAndFos.wireMeshLayers > 0 ? ` + ${supportAndFos.wireMeshLayers} Layer Wire Mesh` : ''})\n- **Overall Rock Strata Support FoS**: **\`FoS = ${supportAndFos.strataSupportFactorOfSafety}\`** vs. Target \`${supportAndFos.requiredStrataFos.toFixed(2)}\` (**${supportAndFos.strataSafetyStatus}**)\n\n**3. Possible Failure Modes (Wedge, Planar, Keyblock, Buckling, Stress) Factor of Safety:**\n${fmLines}\n\n*All support parameters, bolt counts, and failure FoS values can be modified and edited by you in the Support System & FoS tab.*`,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('SUPPORT_SPOTBOLT_FOS_TEMPLATE')
          : undefined,
      };
    }

    // Topic 3: Overbreak Root Cause (Geological vs Mechanical/Excavation) & Advance Level Prediction
    if (
      qLower.includes('overbreak') ||
      qLower.includes('undercut') ||
      qLower.includes('mechanical') ||
      qLower.includes('why overbreak') ||
      qLower.includes('predict') ||
      qLower.includes('advance')
    ) {
      const zoneLines =
        overbreakPrediction.zonePredictions.length > 0
          ? overbreakPrediction.zonePredictions
              .map(
                (zp) =>
                  `- **${zp.zoneId} (${zp.locationLabel})**: **${zp.predictedCategory === 'GEOLOGICAL' ? 'GEOLOGICAL' : 'MECHANICAL / EXCAVATION'}** (Geo ${zp.geologicalScorePct}% / Mech ${zp.mechanicalScorePct}%) · Linked: \`${zp.linkedJointSets}\` · Spot Bolts: **${zp.recommendedSpotBolts} Nos**\n  • *Cause*: ${zp.advancedReasonDetail}`
              )
              .join('\n')
          : `- Overall profile analyzed from Q=${computedQValue}, RMR=${computedRmrTotal}, and ${joints.length} mapped discontinuities.`;

      return {
        reply: `**AI Advanced Overbreak Root-Cause & Next-Advance Prediction (${settings.faceChainage || settings.chainage}):**\n\n**1. Why Overbreak Happened (Geological vs. Mechanical Classification):**\n- **Primary Diagnosis**: **${overbreakPrediction.primaryClassification.replace(/_/g, ' ')}** (Confidence: ${overbreakPrediction.confidencePct}%)\n- **Probability Breakdown**: **Geological = ${overbreakPrediction.geologicalProbabilityPct}%** | **Mechanical / Excavation = ${overbreakPrediction.mechanicalProbabilityPct}%**\n- **Measured Quantities**: Overbreak = **${fmtNum(overbreakAnalysis.overbreakAreaSqMeters)} m² (${fmtNum(overbreakAnalysis.overbreakPercentage, 1)}%)**, Vol = **${fmtNum(obVol)} m³** (Max radial +${fmtNum(overbreakAnalysis.maxRadialOverbreakMeters)}m) · Undercut = **${fmtNum(ucVol)} m³**\n\n**2. Geological vs. Mechanical Drivers:**\n- *Geological Drivers*: ${overbreakPrediction.geologicalDrivers.join(' ')}\n- *Mechanical / Excavation Drivers*: ${overbreakPrediction.mechanicalDrivers.join(' ')}\n\n**3. Zone-by-Zone Root-Cause Breakdown:**\n${zoneLines}\n\n**4. Advance-Level Prediction for Next Pull (${roundLen}m Advance):**\n- **Predicted Next-Pull Overbreak**: **${overbreakPrediction.predictedNextPullOverbreakPct}% (~${overbreakPrediction.predictedNextPullOverbreakM3} m³)**\n- **Critical Sectors at Risk**: ${overbreakPrediction.predictedCriticalSectors.join(', ')}\n- **Recommended Mitigation**: ${overbreakPrediction.recommendedSupportMitigation}`,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('OVERBREAK_SUPPORT_BOQ_TEMPLATE')
          : undefined,
      };
    }

    // Topic A: Geometry / Width / Height / Shape
    if (
      qLower.includes('width') ||
      qLower.includes('height') ||
      qLower.includes('geometry') ||
      qLower.includes('dimension') ||
      qLower.includes('profile') ||
      qLower.includes('shape')
    ) {
      return {
        reply: `**Current Tunnel Geometry:**\n- **Shape**: ${geometry.crownGeometry}\n- **Width**: ${fmtNum(geometry.width)} m\n- **Total Height**: ${fmtNum(geometry.height)} m\n- **Wall Height**: ${fmtNum(geometry.wallHeight)} m\n- **Crown Arc Length**: ${fmtNum(geometry.crownArcLength)} m\n- **Design Cross-Section Area**: ${fmtNum(overbreakAnalysis.designAreaSqMeters)} m²`,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('OVERBREAK_SUPPORT_BOQ_TEMPLATE')
          : undefined,
      };
    }

    // Topic B: Joints / Discontinuities / Dip / Strike
    if (
      qLower.includes('joint') ||
      qLower.includes('dip') ||
      qLower.includes('strike') ||
      qLower.includes('fracture') ||
      qLower.includes('discontinuity')
    ) {
      const jointReply =
        joints.length === 0 && stripTraces.length === 0
          ? `There are currently **0 mapped joints** on the face/walls and **0 traces** in the 3D Continuous Strip Logger. You can trace joints on the mapping canvas or draw traces in 3D Continuous Logging.`
          : `**Mapped Discontinuities:**\n- **Face/Wall Joints**: ${joints.length} joints across ${jointSets.length} sets${
              jointSets.length > 0
                ? ` (${jointSets
                    .map(
                      (s) =>
                        `${s.id}: ${Math.round(s.avgDipDirection ?? 0)}°/${Math.round(s.avgDip ?? 0)}° (${s.roughness}, ${s.infilling})`
                    )
                    .join('; ')})`
                : ''
            }\n- **3D Strip Traces**: ${stripTraces.length} continuous traces`;
      return {
        reply: jointReply,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('JOINT_DISCONTINUITY_TEMPLATE')
          : undefined,
      };
    }

    // Topic C: Q-System / RMR / Rock Mass Classification
    if (
      qLower.includes('rmr') ||
      qLower.includes('q-system') ||
      qLower.includes('q value') ||
      qLower.includes('q index') ||
      qLower.includes('rqd') ||
      qLower.includes('classification') ||
      qLower.includes('rock mass')
    ) {
      return {
        reply: `**Rock Mass Classification & Support Summary:**\n- **Barton Q-Value**: \`Q = ${computedQValue}\` (\`RQD = ${qIndexParams.rqd}%\`, \`Jn = ${qIndexParams.jn}\`, \`Jr = ${qIndexParams.jr}\`, \`Ja = ${qIndexParams.ja}\`, \`Jw = ${qIndexParams.jw}\`, \`SRF = ${qIndexParams.srf}\`)\n- **Bieniawski RMR₈₉**: \`${computedRmrTotal} / 100\`\n- **Support Prescription**: ${supportAndFos.supportCategoryLabel}\n- **Rock Strata Support FoS**: \`FoS = ${supportAndFos.strataSupportFactorOfSafety}\` (Capacity ${supportAndFos.installedSupportCapacityKpa} kPa vs Demand ${supportAndFos.supportPressureDemandKpa} kPa)`,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('SUPPORT_SPOTBOLT_FOS_TEMPLATE')
          : undefined,
      };
    }

    // Topic E: 3D Continuous Strip Logging / Pulls / Chainage
    if (
      qLower.includes('pull') ||
      qLower.includes('strip') ||
      qLower.includes('chainage') ||
      qLower.includes('3d')
    ) {
      const pullReply =
        pulls.length === 0
          ? `**3D Continuous Strip Logger (${activeStripDs?.tunnelLocationName || 'Main Heading'}):**\nCurrently **0 pull intervals** and **${stripTraces.length} traces** are logged. You can add pull intervals or draw traces in the 3D Continuous Logging workspace.`
          : `**3D Continuous Strip Logger (${activeStripDs?.tunnelLocationName}):**\n- **Logged Pulls**: ${pulls.length} intervals (RD ${pulls[0]?.fromRd ?? 0}m to ${pulls[pulls.length - 1]?.toRd ?? 0}m)\n- **3D Structural Traces**: ${stripTraces.length}\n- **Lithology Zones**: ${activeStripDs?.lithologyZones.length || 0}\n- **Historical Spot Bolting**: Avg ${supportAndFos.previousPullsSpotBoltSummary.avgSpotBoltsPerPull} spot bolts/pull across ${supportAndFos.previousPullsSpotBoltSummary.dominantHistoricalSector}`;
      return {
        reply: pullReply,
        executedActions,
        extractedDataPackage: wantsTableOrExtract
          ? buildDataPackageForCategory('STRIP_PULL_LOG_TEMPLATE')
          : undefined,
      };
    }

    // Comprehensive intelligent synthesis for any general or multi-part question
    const reply = `**ESWA AI Geotechnical & Support Analysis (${settings.faceChainage || settings.chainage}):**\n- **Overbreak Diagnosis & Next-Advance Prediction**: **${overbreakPrediction.primaryClassification.replace(/_/g, ' ')}** (Geological **${overbreakPrediction.geologicalProbabilityPct}%** vs. Mechanical/Excavation **${overbreakPrediction.mechanicalProbabilityPct}%**). Current Overbreak = **${fmtNum(overbreakAnalysis.overbreakPercentage, 1)}% (${fmtNum(obVol)} m³)**; Predicted Next Pull = **${overbreakPrediction.predictedNextPullOverbreakPct}% (${overbreakPrediction.predictedNextPullOverbreakM3} m³)**.\n- **Support System & Rock Strata FoS**: **${supportAndFos.supportCategoryLabel}** — **FoS = ${supportAndFos.strataSupportFactorOfSafety}** (Capacity ${supportAndFos.installedSupportCapacityKpa} kPa vs Demand ${supportAndFos.supportPressureDemandKpa} kPa).\n- **AI Spot Bolting**: **${supportAndFos.spotBoltsTotalRound} Spot Bolts** required across ${supportAndFos.spotBoltLocations.map((s) => `${s.sectorLabel} (${s.boltsRequired} Nos)`).join(', ')} (correlated with ${supportAndFos.previousPullsSpotBoltSummary.totalPreviousPullsAnalyzed} previous pulls).\n- **Governing Wedge Failure FoS**: Unbolted **FoS = ${supportAndFos.failureModes[0]?.fosUnbolted.toFixed(2)}** → Supported **FoS = ${supportAndFos.failureModes[0]?.fosSupported.toFixed(2)}** (${supportAndFos.failureModes[0]?.status}).`;

    return {
      reply,
      executedActions,
      extractedDataPackage: wantsTableOrExtract
        ? buildDataPackageForCategory('SUPPORT_SPOTBOLT_FOS_TEMPLATE')
        : undefined,
    };
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? inputPrompt).trim();
    if (!textToSend || isThinking) return;

    const userMsg: EswaAiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputPrompt('');

    setIsThinking(true);

    // Prepare comprehensive live software context snapshot for Gemini API
    const softwareContext = {
      activeTunnel: {
        tunnelName: settings.tunnelName || 'Unassigned',
        locationName: settings.locationName || 'Unassigned',
        chainage: settings.chainage,
        faceChainage: settings.faceChainage,
        driveDirectionDeg: settings.driveDirection,
        roundLengthM: settings.roundLength,
        lithology: settings.lithology || rockMassSummary.rockType,
      },
      masterGeometry: {
        shape: geometry.crownGeometry,
        widthM: geometry.width,
        heightM: geometry.height,
        wallHeightM: geometry.wallHeight,
        crownRadiusM: geometry.crownRadius,
        crownArcLengthM: geometry.crownArcLength,
        designAreaSqM: overbreakAnalysis.designAreaSqMeters,
      },
      rockMassClassification: {
        qValue: computedQValue,
        qParams: qIndexParams,
        rmrTotal: computedRmrTotal,
        rmrParams,
      },
      overbreakUndercut: {
        surveyedAreaSqM: overbreakAnalysis.surveyedAreaSqMeters,
        overbreakAreaSqM: overbreakAnalysis.overbreakAreaSqMeters,
        overbreakPct: overbreakAnalysis.overbreakPercentage,
        overbreakVolM3: overbreakAnalysis.overbreakVolumeCubicMeters,
        undercutVolM3: overbreakAnalysis.undercutVolumeCubicMeters,
        aiOverbreakPrediction: overbreakPrediction,
      },
      supportSystemSpotBoltingAndFailureFos: supportAndFos,
      mappedJointsSummary: {
        totalJoints: joints.length,
        jointSets: jointSets.map((s) => ({
          id: s.id,
          name: s.label,
          meanDipDir: Math.round(s.avgDipDirection ?? 55),
          meanDip: Math.round(s.avgDip ?? 50),
          count: joints.filter((j) => j.set === s.id).length,
        })),
      },
      continuous3DStripLogger: {
        datasetCount: stripDatasets.length,
        activeProjectName: activeStripDs?.projectName,
        activeTunnelLocation: activeStripDs?.tunnelLocationName,
        viewFromRd: activeStripDs?.viewFromRd,
        viewToRd: activeStripDs?.viewToRd,
        pullsCount: (activeStripDs?.pulls || []).length,
        tracesCount: (activeStripDs?.traces || []).length,
        pulls: (activeStripDs?.pulls || []).slice(0, 12),
        traces: (activeStripDs?.traces || []).slice(0, 12),
      },
      savedProjectsCount: savedProjects.length,
      lithologyRegionsCount: lithologyRegions.length,
      placedSymbolsCount: placedSymbols.length,
    };

    try {
      const res = await fetch('/api/ai/eswa-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          softwareContext,
          selectedTemplate,
        }),
      });

      const data = await res.json();

      if (res.ok && data && typeof data.reply === 'string' && !data.fallback) {
        const actions: EswaAiExecutedAction[] = Array.isArray(data.executedActions)
          ? data.executedActions.filter((a: EswaAiExecutedAction) => a.actionType !== 'NONE')
          : [];
        if (actions.length > 0) {
          executeSoftwareAuthorityActions(actions);
        }

        const cat =
          (data.dataCategory as EngineeringExportTemplateId) ||
          'SUPPORT_SPOTBOLT_FOS_TEMPLATE';
        const userExplicitlyAskedForTable =
          textToSend.toLowerCase().includes('table') ||
          textToSend.toLowerCase().includes('schedule');
        const pkg: EswaAiExtractedDataPackage | undefined =
          data.includeDataSchedule && userExplicitlyAskedForTable
            ? buildDataPackageForCategory(cat)
            : undefined;

        const aiMsg: EswaAiChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          engineLabel: 'ESWA AI',
          executedActions: actions,
          extractedData: pkg,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const localResult = runLocalExecutiveEngine(textToSend);
        if (localResult.executedActions.length > 0) {
          executeSoftwareAuthorityActions(localResult.executedActions);
        }
        const aiMsg: EswaAiChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          text: localResult.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          engineLabel: 'ESWA AI',
          executedActions: localResult.executedActions,
          extractedData: localResult.extractedDataPackage,
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch {
      const localResult = runLocalExecutiveEngine(textToSend);
      if (localResult.executedActions.length > 0) {
        executeSoftwareAuthorityActions(localResult.executedActions);
      }
      const aiMsg: EswaAiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: localResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        engineLabel: 'ESWA AI',
        executedActions: localResult.executedActions,
        extractedData: localResult.extractedDataPackage,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  // ============================================================================
  // MULTI-FORMAT TEMPLATE EXPORTERS (CSV/Excel, Word .DOC, ESWACAD .DXF, JSON, MD, Print Sheet)
  // ============================================================================

  const downloadBlob = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportFormat = (
    format: 'CSV' | 'DOC' | 'DXF' | 'JSON' | 'MD' | 'PRINT_SHEET',
    msgText: string,
    pkg?: EswaAiExtractedDataPackage
  ) => {
    const activePkg =
      pkg ||
      buildDataPackageForCategory(
        selectedTemplate === 'AUTO_BEST_TEMPLATE'
          ? 'EXECUTIVE_PROJECT_AUDIT_TEMPLATE'
          : selectedTemplate
      );
    const safeBaseName = `${(settings.tunnelName || 'ESWA_Tunnel').replace(/[^a-zA-Z0-9_-]/g, '_')}_${activePkg.templateType}`;

    if (format === 'PRINT_SHEET') {
      setPreviewSheetPkg({ msgText, pkg: activePkg });
      return;
    }

    if (format === 'CSV') {
      const csvLines: string[] = [
        `"ESWA TUNNEL MAPPER & ESWACAD — OFFICIAL ENGINEERING TEMPLATE EXPORT"`,
        `"Template Title","${activePkg.title.replace(/"/g, '""')}"`,
        `"Subtitle / Scope","${(activePkg.subtitle || '').replace(/"/g, '""')}"`,
        `"Tunnel / Heading","${settings.tunnelName}","Chainage","${settings.faceChainage || settings.chainage}","Date","${settings.date}"`,
        `"Excavation Profile","${geometry.width.toFixed(2)}m W x ${geometry.height.toFixed(2)}m H","Q-Index","${computedQValue}","RMR89","${computedRmrTotal}"`,
        `""`,
      ];

      if (activePkg.summaryMetrics && activePkg.summaryMetrics.length > 0) {
        csvLines.push(`"KEY GEOTECHNICAL METRICS"`);
        csvLines.push(activePkg.summaryMetrics.map((m) => `"${m.label}"`).join(','));
        csvLines.push(activePkg.summaryMetrics.map((m) => `"${m.value.replace(/"/g, '""')}"`).join(','));
        csvLines.push(`""`);
      }

      csvLines.push(`"AI EXECUTIVE ASSESSMENT SUMMARY"`);
      csvLines.push(`"${msgText.replace(/"/g, '""').replace(/\n+/g, ' | ')}"`);
      csvLines.push(`""`);
      csvLines.push(activePkg.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
      for (const row of activePkg.rows) {
        csvLines.push(row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
      }

      downloadBlob(csvLines.join('\r\n'), `${safeBaseName}.csv`, 'text/csv;charset=utf-8');
      return;
    }

    if (format === 'DOC') {
      const htmlDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${activePkg.title}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 28px; font-size: 11pt; }
  .title-block { border: 2px solid #0f172a; padding: 14px; background: #f8fafc; margin-bottom: 18px; }
  .title-block h1 { margin: 0 0 4px 0; font-size: 15pt; color: #0369a1; text-transform: uppercase; }
  .title-block p { margin: 2px 0; font-size: 9.5pt; color: #334155; }
  .kpi-grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .kpi-grid td { border: 1px solid #cbd5e1; padding: 8px 10px; background: #f1f5f9; font-size: 9.5pt; }
  .kpi-label { font-weight: bold; color: #475569; text-transform: uppercase; font-size: 8pt; display: block; }
  .kpi-val { font-weight: bold; color: #0f172a; font-size: 11pt; }
  .ai-box { border-left: 4px solid #0284c7; background: #f0f9ff; padding: 12px 16px; margin-bottom: 18px; white-space: pre-wrap; font-size: 10pt; line-height: 1.5; }
  table.schedule { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.schedule th { background: #0f172a; color: #ffffff; border: 1px solid #0f172a; padding: 7px 9px; font-size: 9pt; text-align: left; }
  table.schedule td { border: 1px solid #94a3b8; padding: 6px 9px; font-size: 9pt; }
  table.schedule tr:nth-child(even) td { background: #f8fafc; }
  .signoff { margin-top: 26px; width: 100%; border-collapse: collapse; }
  .signoff td { border: 1px solid #0f172a; padding: 12px; width: 33.3%; font-size: 9pt; }
</style>
</head>
<body>
  <div class="title-block">
    <h1>${activePkg.title}</h1>
    <p><strong>${activePkg.subtitle || ''}</strong></p>
    <p>Project / Tunnel: <strong>${settings.tunnelName}</strong> | Chainage: <strong>${settings.faceChainage || settings.chainage}</strong> | Date: <strong>${settings.date}</strong> | Generated by: <strong>ESWA AI Executive Controller</strong></p>
  </div>
  ${
    activePkg.summaryMetrics && activePkg.summaryMetrics.length > 0
      ? `<table class="kpi-grid"><tr>${activePkg.summaryMetrics
          .map(
            (m) =>
              `<td><span class="kpi-label">${m.label}</span><span class="kpi-val">${m.value}</span></td>`
          )
          .join('')}</tr></table>`
      : ''
  }
  <h3>1. ESWA AI Geotechnical Engineering Assessment</h3>
  <div class="ai-box">${msgText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <h3>2. Extracted Engineering Data Schedule (${TEMPLATE_LABELS[activePkg.templateType]})</h3>
  <table class="schedule">
    <thead>
      <tr>${activePkg.columns.map((c) => `<th>${c}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${activePkg.rows
        .map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}
    </tbody>
  </table>
  <table class="signoff">
    <tr>
      <td><strong>Compiled / Mapped By (Contractor Geologist):</strong><br/><br/>___________________________<br/>Date: ${settings.date}</td>
      <td><strong>Verified By (ESWA AI &amp; Resident Engineer):</strong><br/><br/>___________________________<br/>Q = ${computedQValue} | RMR = ${computedRmrTotal}</td>
      <td><strong>Approved By (Client / Authority):</strong><br/><br/>___________________________<br/>Drawing / Ref: ESWACAD-ASBUILT</td>
    </tr>
  </table>
</body>
</html>`;
      downloadBlob(htmlDoc, `${safeBaseName}_Report.doc`, 'application/msword;charset=utf-8');
      return;
    }

    if (format === 'DXF') {
      const lines: string[] = [];
      const push = (code: number, val: string | number) => {
        lines.push(String(code));
        lines.push(String(val));
      };

      push(0, 'SECTION');
      push(2, 'HEADER');
      push(9, '$INSUNITS');
      push(70, 6); // Meters
      push(0, 'ENDSEC');

      push(0, 'SECTION');
      push(2, 'ENTITIES');

      // 1. Plot Tunnel Excavation Profile on layer ESWACAD_PROFILE
      const pts = geometry.crossSectionPoints || [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        push(0, 'LINE');
        push(8, 'ESWACAD_TUNNEL_PROFILE');
        push(62, 4); // Cyan
        push(10, a.x.toFixed(4));
        push(20, a.y.toFixed(4));
        push(30, '0.0');
        push(11, b.x.toFixed(4));
        push(21, b.y.toFixed(4));
        push(31, '0.0');
      }

      // 2. Plot Mapped Face Joints on layer ESWACAD_JOINTS
      for (const j of joints) {
        if (!j.geometry || j.geometry.length < 2) continue;
        for (let k = 0; k < j.geometry.length - 1; k++) {
          const p1 = j.geometry[k];
          const p2 = j.geometry[k + 1];
          push(0, 'LINE');
          push(8, `ESWACAD_JOINTS_${j.set || 'J1'}`);
          push(62, 1); // Red
          push(10, p1.x.toFixed(4));
          push(20, p1.y.toFixed(4));
          push(30, '0.0');
          push(11, p2.x.toFixed(4));
          push(21, p2.y.toFixed(4));
          push(31, '0.0');
        }
      }

      // 3. Plot ESWACAD AI Extracted Data Schedule Table to the right of the tunnel profile (X = +10m)
      const tableX = Math.max(8, geometry.width) + 4.0;
      let curY = geometry.height + 2.0;

      push(0, 'TEXT');
      push(8, 'ESWACAD_AI_SCHEDULE');
      push(62, 2); // Yellow
      push(10, tableX.toFixed(3));
      push(20, curY.toFixed(3));
      push(30, '0.0');
      push(40, '0.42');
      push(1, activePkg.title);

      curY -= 0.7;
      push(0, 'TEXT');
      push(8, 'ESWACAD_AI_SCHEDULE');
      push(62, 7);
      push(10, tableX.toFixed(3));
      push(20, curY.toFixed(3));
      push(30, '0.0');
      push(40, '0.28');
      push(1, activePkg.columns.join('  |  '));

      for (const row of activePkg.rows) {
        curY -= 0.55;
        push(0, 'TEXT');
        push(8, 'ESWACAD_AI_SCHEDULE');
        push(62, 3); // Green
        push(10, tableX.toFixed(3));
        push(20, curY.toFixed(3));
        push(30, '0.0');
        push(40, '0.24');
        push(1, row.join('  |  '));
      }

      push(0, 'ENDSEC');
      push(0, 'EOF');

      downloadBlob(lines.join('\n'), `${safeBaseName}.dxf`, 'application/dxf');
      return;
    }

    if (format === 'JSON') {
      const payload = {
        exportedAt: new Date().toISOString(),
        generator: 'ESWA AI Executive Controller',
        templateType: activePkg.templateType,
        title: activePkg.title,
        subtitle: activePkg.subtitle,
        aiAssessment: msgText,
        summaryMetrics: activePkg.summaryMetrics,
        table: {
          columns: activePkg.columns,
          rows: activePkg.rows.map((r) =>
            Object.fromEntries(activePkg.columns.map((col, idx) => [col, r[idx] ?? '']))
          ),
        },
        liveTunnelContext: {
          tunnelName: settings.tunnelName,
          chainage: settings.faceChainage || settings.chainage,
          geometry: {
            widthM: geometry.width,
            heightM: geometry.height,
            wallHeightM: geometry.wallHeight,
          },
          qValue: computedQValue,
          rmrTotal: computedRmrTotal,
        },
      };
      downloadBlob(JSON.stringify(payload, null, 2), `${safeBaseName}.json`, 'application/json');
      return;
    }

    if (format === 'MD') {
      const mdLines = [
        `# ${activePkg.title}`,
        `> **${activePkg.subtitle || ''}**`,
        ``,
        `## 1. Key Geotechnical Summary`,
        ...(activePkg.summaryMetrics || []).map((m) => `- **${m.label}**: ${m.value}`),
        ``,
        `## 2. ESWA AI Executive Analysis`,
        msgText,
        ``,
        `## 3. Extracted Engineering Data Schedule (${TEMPLATE_LABELS[activePkg.templateType]})`,
        `| ${activePkg.columns.join(' | ')} |`,
        `| ${activePkg.columns.map(() => '---').join(' | ')} |`,
        ...activePkg.rows.map((r) => `| ${r.join(' | ')} |`),
      ];
      downloadBlob(mdLines.join('\n'), `${safeBaseName}.md`, 'text/markdown;charset=utf-8');
    }
  };

  return (
    <>
      {/* ====================================================================
          SMALL ESWA LOGO FLOATING TOGGLE (AUTO-APPEARS ON TOUCH, HIDES AFTER 5s)
         ==================================================================== */}
      <div
        onMouseEnter={() => setIsHoveringToggle(true)}
        onMouseLeave={() => setIsHoveringToggle(false)}
        className="fixed bottom-3.5 right-3.5 z-[90] flex items-center print:hidden"
      >
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`group relative w-10 h-10 rounded-full flex items-center justify-center border shadow-lg transition-all duration-300 cursor-pointer opacity-100 scale-100 translate-y-0 ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-300 shadow-slate-900/15'
                : 'bg-[#0B1220] hover:bg-[#131F36] border-cyan-500/50 shadow-black/70'
            }`}
            title="ESWA AI"
          >
            <EswaTunnelLogo size="sm" showBadge={false} />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
            </span>
          </button>
        )}
      </div>

      {/* ====================================================================
          ESWA AI CHATBOT & TEMPLATE EXTRACTOR PANEL
         ==================================================================== */}
      {isOpen && (
        <div
          className={`fixed z-[95] flex flex-col border shadow-2xl transition-all duration-200 overflow-hidden print:hidden ${
            isMaximized
              ? 'inset-3 sm:inset-5 rounded-2xl'
              : 'bottom-4 right-4 w-[min(96vw,580px)] h-[min(88dvh,720px)] rounded-2xl'
          } ${
            isLight
              ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/20'
              : 'bg-[#0A0F1D] border-cyan-500/50 text-slate-100 shadow-black/80'
          }`}
        >
          {/* Top Header */}
          <div
            className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isLight
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-gradient-to-r from-[#0E172A] via-[#13203B] to-[#0E172A] border-cyan-500/40 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <EswaTunnelLogo size="sm" showBadge={false} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-xs sm:text-sm tracking-wide truncate">
                    ESWA AI
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono truncate">
                  Synced: {fmtNum(geometry.width, 1)}×{fmtNum(geometry.height, 1)}m · {joints.length}{' '}
                  Joints · {activeStripDs?.pulls.length || 0} Strip Pulls · Q={computedQValue}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setExpandedExtractMsgId(null);
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-white/10 text-[10px] text-slate-300 hover:text-white cursor-pointer"
                  title="Clear Chat"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMaximized((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                title={isMaximized ? 'Restore Window Size' : 'Maximize ESWA AI'}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 cursor-pointer"
                title="Close ESWA AI"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Stream (Clean & Uncluttered) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3">
                <EswaTunnelLogo size="md" showBadge={false} />
                <div className="space-y-1 max-w-sm">
                  <div className="font-display font-bold text-sm">ESWA AI Geotechnical Assistant</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ask any question about Overbreak (Geological vs. Mechanical &amp; Advance Prediction), Spot Bolting locations &amp; historical pull data, Rock Strata Support Factor of Safety, or Wedge Failure FoS.
                  </p>
                </div>
                <div className="w-full max-w-md grid grid-cols-1 gap-1.5 text-left pt-1">
                  {[
                    'Why did overbreak happen (Geological vs Mechanical) & predict next advance?',
                    'Analyze Spot Bolting locations, reasons & bolts required from previous pulls',
                    'What is our Rock Strata Support System Factor of Safety & Wedge Failure FoS?',
                    'Where is the Support System in Tables & Output and how can I edit it?',
                  ].map((qPrompt) => (
                    <button
                      key={qPrompt}
                      type="button"
                      onClick={() => handleSendMessage(qPrompt)}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-medium text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isLight
                          ? 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-700 hover:text-sky-700'
                          : 'bg-[#11192C] hover:bg-cyan-950/60 border-slate-800 hover:border-cyan-500/50 text-slate-200'
                      }`}
                    >
                      <span>{qPrompt}</span>
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isExtractExpanded = expandedExtractMsgId === msg.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl p-3 space-y-2 border ${
                        msg.role === 'user'
                          ? isLight
                            ? 'bg-sky-600 text-white border-sky-500 rounded-br-xs'
                            : 'bg-cyan-700 text-white border-cyan-500/60 rounded-br-xs'
                          : isLight
                          ? 'bg-slate-50 text-slate-800 border-slate-200/90 rounded-bl-xs shadow-2xs'
                          : 'bg-[#11192C] text-slate-100 border-slate-800 rounded-bl-xs shadow-md'
                      }`}
                    >
                      {/* Executed Actions (if any) */}
                      {msg.executedActions && msg.executedActions.length > 0 && (
                        <div
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                            isLight
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{msg.executedActions.map((a) => a.description).join(' · ')}</span>
                        </div>
                      )}

                      {/* Message Body Text */}
                      <div className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</div>

                      {/* Data Table (Shown ONLY if the query asked for data/table/schedule) */}
                      {msg.role === 'model' &&
                        msg.extractedData &&
                        msg.extractedData.rows.length > 0 && (
                          <div
                            className={`mt-2 pt-2 border-t space-y-1.5 ${
                              isLight ? 'border-slate-200' : 'border-slate-800'
                            }`}
                          >
                            <div
                              className={`font-bold text-[11px] ${
                                isLight ? 'text-sky-800' : 'text-cyan-300'
                              }`}
                            >
                              {msg.extractedData.title}
                            </div>
                            <div
                              className={`max-h-40 overflow-auto rounded-lg border ${
                                isLight
                                  ? 'border-slate-200 bg-white'
                                  : 'border-slate-800 bg-[#080C16]'
                              }`}
                            >
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr
                                    className={
                                      isLight
                                        ? 'bg-slate-100 text-slate-800 border-b border-slate-200'
                                        : 'bg-[#141E33] text-cyan-300 border-b border-slate-800'
                                    }
                                  >
                                    {msg.extractedData.columns.map((col, cIdx) => (
                                      <th
                                        key={cIdx}
                                        className="py-1.5 px-2 font-bold whitespace-nowrap"
                                      >
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-500/15">
                                  {msg.extractedData.rows.slice(0, 6).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className="py-1 px-2 whitespace-nowrap font-mono"
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      {/* STEP 2: On-Demand "Extract as File" Toggle */}
                      {msg.role === 'model' && (
                        <div className="pt-1 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedExtractMsgId(isExtractExpanded ? null : msg.id)
                              }
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isExtractExpanded
                                  ? 'bg-cyan-600 text-white border-cyan-500'
                                  : isLight
                                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-[#0B1220] hover:bg-slate-800 text-slate-300 border-slate-700/80'
                              }`}
                            >
                              <Download className="w-3 h-3" />
                              <span>Extract as File</span>
                            </button>
                            <span className="text-[9px] font-mono opacity-50">
                              {msg.timestamp}
                            </span>
                          </div>

                          {/* Step 2 Expanded File Format & Template Options */}
                          {isExtractExpanded && (
                            <div
                              className={`p-2.5 rounded-xl border space-y-2 ${
                                isLight
                                  ? 'bg-white border-slate-200'
                                  : 'bg-[#080C16] border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-slate-400">
                                  Template:
                                </span>
                                <select
                                  value={selectedTemplate}
                                  onChange={(e) =>
                                    setSelectedTemplate(
                                      e.target.value as EngineeringExportTemplateId
                                    )
                                  }
                                  className={`flex-1 px-2 py-1 rounded-md border text-[10px] font-semibold outline-none cursor-pointer ${
                                    isLight
                                      ? 'bg-slate-50 border-slate-300 text-slate-800'
                                      : 'bg-[#0E1628] border-slate-700 text-cyan-200'
                                  }`}
                                >
                                  {Object.entries(TEMPLATE_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                  [
                                    { fmt: 'CSV', label: 'Excel (.CSV)' },
                                    { fmt: 'DOC', label: 'Word (.DOC)' },
                                    { fmt: 'DXF', label: 'CAD (.DXF)' },
                                    { fmt: 'PRINT_SHEET', label: 'Sheet / PDF' },
                                    { fmt: 'JSON', label: '.JSON' },
                                    { fmt: 'MD', label: '.MD' },
                                  ] as const
                                ).map((item) => (
                                  <button
                                    key={item.fmt}
                                    type="button"
                                    onClick={() => {
                                      const pkgToExport =
                                        selectedTemplate === 'AUTO_BEST_TEMPLATE' &&
                                        msg.extractedData
                                          ? msg.extractedData
                                          : buildDataPackageForCategory(
                                              selectedTemplate === 'AUTO_BEST_TEMPLATE'
                                                ? 'EXECUTIVE_PROJECT_AUDIT_TEMPLATE'
                                                : selectedTemplate
                                            );
                                      handleExportFormat(item.fmt, msg.text, pkgToExport);
                                    }}
                                    className={`px-2 py-1 rounded-md border text-[10px] font-bold cursor-pointer ${
                                      isLight
                                        ? 'bg-slate-50 hover:bg-sky-50 text-slate-800 hover:text-sky-700 border-slate-300'
                                        : 'bg-[#131E36] hover:bg-cyan-950 text-slate-200 hover:text-cyan-300 border-slate-700'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono px-2">
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Command & Question Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className={`p-3 border-t flex items-center gap-2 shrink-0 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090E1A] border-slate-800'
            }`}
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask about tunnel data, command software actions, or request template extraction..."
              className={`flex-1 px-3.5 py-2 rounded-xl border text-xs outline-none transition-colors ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-sky-500'
                  : 'bg-[#050811] border-slate-700 text-slate-100 focus:border-cyan-400'
              }`}
            />
            <button
              type="submit"
              disabled={isThinking || !inputPrompt.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      )}

      {/* ====================================================================
          OFFICIAL PRINTABLE AS-BUILT TEMPLATE SHEET MODAL (FOR PDF / PRINT)
         ==================================================================== */}
      {previewSheetPkg && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl max-h-[92dvh] bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-slate-900 flex flex-col overflow-hidden">
            {/* Non-printable top action bar */}
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>
                  ESWA AI Official Engineering Template Sheet —{' '}
                  {TEMPLATE_LABELS[previewSheetPkg.pkg.templateType]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleExportFormat('DOC', previewSheetPkg.msgText, previewSheetPkg.pkg)
                  }
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                >
                  Download .DOC
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleExportFormat('CSV', previewSheetPkg.msgText, previewSheetPkg.pkg)
                  }
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  Download .CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSheetPkg(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Engineering Template Sheet Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white text-slate-900">
              <div className="border-2 border-slate-900 p-4 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-sky-700 font-bold">
                    ESWA TUNNEL MAPPER &amp; ESWACAD · OFFICIAL AS-BUILT GEOTECHNICAL SHEET
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">
                    {previewSheetPkg.pkg.title}
                  </h2>
                  <p className="text-xs font-semibold text-slate-600">
                    {previewSheetPkg.pkg.subtitle}
                  </p>
                </div>
                <div className="text-right font-mono text-xs border-l-2 border-slate-300 pl-4 space-y-0.5">
                  <div>
                    <strong>Tunnel:</strong> {settings.tunnelName}
                  </div>
                  <div>
                    <strong>Chainage:</strong> {settings.faceChainage || settings.chainage}
                  </div>
                  <div>
                    <strong>Date:</strong> {settings.date}
                  </div>
                </div>
              </div>

              {previewSheetPkg.pkg.summaryMetrics && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {previewSheetPkg.pkg.summaryMetrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-300 rounded-lg p-2 bg-slate-50"
                    >
                      <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">
                        {m.label}
                      </div>
                      <div className="text-xs font-mono font-black text-slate-900">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-l-4 border-sky-600 bg-sky-50/70 p-3.5 rounded-r-lg space-y-1">
                <div className="text-[10px] font-mono uppercase font-bold text-sky-800">
                  ESWA AI Executive Engineering Assessment
                </div>
                <div className="text-xs whitespace-pre-wrap leading-relaxed text-slate-800">
                  {previewSheetPkg.msgText}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Extracted Geotechnical &amp; Tunnel Data Schedule
                </div>
                <table className="w-full border-collapse border border-slate-900 text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      {previewSheetPkg.pkg.columns.map((c, idx) => (
                        <th
                          key={idx}
                          className="border border-slate-700 py-2 px-2.5 text-left font-bold"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewSheetPkg.pkg.rows.map((r, rIdx) => (
                      <tr
                        key={rIdx}
                        className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      >
                        {r.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="border border-slate-300 py-1.5 px-2.5 font-mono text-[11px]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-slate-900 text-xs">
                <div className="border border-slate-400 p-3">
                  <div className="font-bold text-slate-700">
                    Compiled By (Engineering Geologist):
                  </div>
                  <div className="mt-6 border-b border-slate-400" />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Date: {settings.date}
                  </div>
                </div>
                <div className="border border-slate-400 p-3">
                  <div className="font-bold text-slate-700">
                    Verified By (ESWA AI &amp; Tunnel Engineer):
                  </div>
                  <div className="mt-6 border-b border-slate-400" />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Q = {computedQValue} · RMR₈₉ = {computedRmrTotal}
                  </div>
                </div>
                <div className="border border-slate-400 p-3">
                  <div className="font-bold text-slate-700">
                    Approved By (Client / Consultant):
                  </div>
                  <div className="mt-6 border-b border-slate-400" />
                  <div className="text-[10px] text-slate-500 mt-1">
                    Template: {previewSheetPkg.pkg.templateType}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
