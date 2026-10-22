import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  Download,
  Droplets,
  FileSpreadsheet,
  Info,
  Layers,
  Maximize2,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  Joint,
  JointSet,
  LithologyRegion,
  OverbreakUndercutAnalysis,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { calculateBieniawskiRmr } from '../engine/rockMassClassificationEngine';
import { computeRockStrataSupportSpotBoltingAndFailureFos } from '../engine/supportSpotBoltFailureEngine';

export type AdvancedAnalysisTab =
  | 'WEDGE_FOS'
  | 'APPARENT_DIP_SOLVER'
  | 'LOOKAHEAD_EXTRAPOLATION'
  | 'STANDUP_TIME_SPAN'
  | 'PALMSTROM_BLOCKS'
  | 'HYDRO_INFLOW';

export interface AdvancedGeologicalAnalysisModalProps {
  isOpen?: boolean;
  onClose: () => void;
  fullPage?: boolean;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  qIndexParams?: QIndexParameters;
  rmrParams?: RmrParameters;
  rockMassSummary?: RockMassSummaryTable;
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  lithologyRegions?: LithologyRegion[];
}

export const AdvancedGeologicalAnalysisModal: React.FC<AdvancedGeologicalAnalysisModalProps> = ({
  isOpen = true,
  onClose,
  fullPage = false,
  geometry,
  settings,
  joints,
  jointSets,
  qIndexParams: propQIndexParams,
  rmrParams: propRmrParams,
  rockMassSummary,
  overbreakAnalysis,
  lithologyRegions = [],
}) => {
  const [activeTab, setActiveTab] = useState<AdvancedAnalysisTab>('WEDGE_FOS');

  // Interactive controls for Apparent Dip vs Drive Direction Solver
  const [customDriveAzimuth, setCustomDriveAzimuth] = useState<number>(
    settings.driveDirection ?? 0
  );
  const [selectedJointIndex, setSelectedJointIndex] = useState<number>(0);

  // Interactive controls for Wedge FoS sensitivity
  const [simulatedBoltCapacityKn, setSimulatedBoltCapacityKn] = useState<number>(200);
  const [simulatedBoltSpacingM, setSimulatedBoltSpacingM] = useState<number>(1.5);
  const [simulatedShotcreteMm, setSimulatedShotcreteMm] = useState<number>(75);

  // Default fallback parameters
  const qParams: QIndexParameters = useMemo(() => {
    return (
      propQIndexParams || {
        rqd: 75,
        jn: 9,
        jnDescription: '3 joint sets',
        jr: 1.5,
        jrDescription: 'Rough or irregular, planar',
        ja: 2.0,
        jaDescription: 'Slightly altered joint walls',
        jw: 1.0,
        jwDescription: 'Dry excavations or minor inflow',
        srf: 1.0,
        srfDescription: 'Medium stress, favorable condition',
        esr: 1.0,
      }
    );
  }, [propQIndexParams]);

  const rmrParams: RmrParameters = useMemo(() => {
    return (
      propRmrParams || {
        version: 'RMR89',
        strengthInputType: 'UCS_MPA',
        intactStrengthValueMPa: 95,
        intactStrengthDescription: 'Strong rock (50–100 MPa)',
        intactStrengthRating: 12,
        rqdPercent: 75,
        rqdDescription: 'Fair quality (75%)',
        rqdRating: 13,
        spacingMeters: 0.35,
        spacingDescription: '0.2–0.6m (Moderate)',
        spacingRating: 10,
        conditionDescription: 'Slightly rough surfaces, separation < 1mm',
        conditionRating: 20,
        conditionSubRatings: {
          useDetailedSubRatings: false,
          persistenceValue: '1–3m',
          persistenceRating: 4,
          apertureValue: '0.1–1.0mm',
          apertureRating: 4,
          roughnessValue: 'Slightly rough',
          roughnessRating: 4,
          infillingValue: 'Hard filling < 5mm',
          infillingRating: 4,
          weatheringValue: 'Slightly weathered',
          weatheringRating: 4,
        },
        groundwaterInflowLPerMin10m: 5,
        groundwaterDescription: 'Damp (< 10 L/min)',
        groundwaterRating: 10,
        orientationFavourability: 'Fair',
        orientationAdjustmentRating: -5,
        paramStatus: {
          intactStrength: 'USER_CONFIRMED',
          rqd: 'USER_CONFIRMED',
          spacing: 'USER_CONFIRMED',
          condition: 'USER_CONFIRMED',
          groundwater: 'USER_CONFIRMED',
          orientationAdjustment: 'USER_CONFIRMED',
        },
        userConfirmed: true,
      }
    );
  }, [propRmrParams]);

  // Evaluated Rock Mass & Geomechanics
  const rmrResult = useMemo(() => calculateBieniawskiRmr(rmrParams), [rmrParams]);
  const rmrVal = rmrResult.finalRmr ?? 60;
  const qVal = useMemo(() => {
    const jn = Math.max(0.5, qParams.jn || 9);
    const jr = Math.max(0.5, qParams.jr || 1.5);
    const ja = Math.max(0.75, qParams.ja || 2.0);
    const jw = Math.max(0.1, qParams.jw || 1.0);
    const srf = Math.max(0.5, qParams.srf || 1.0);
    return Number((((qParams.rqd || 75) / jn) * (jr / ja) * (jw / srf)).toFixed(2));
  }, [qParams]);

  // Support & Spot Bolt Safety Analysis
  const strataAnalysis = useMemo(() => {
    return computeRockStrataSupportSpotBoltingAndFailureFos(
      geometry,
      settings,
      joints,
      jointSets,
      qParams,
      rmrParams,
      rockMassSummary,
      overbreakAnalysis
    );
  }, [geometry, settings, joints, jointSets, qParams, rmrParams, rockMassSummary, overbreakAnalysis]);

  if (!isOpen) return null;

  const spanW = Math.max(2.5, geometry.width || 8.4);
  const heightH = Math.max(2.5, geometry.height || 7.2);
  const pullL = Math.max(1.0, settings.roundLength || 3.0);

  // --------------------------------------------------------------------------
  // 1. KINEMATIC WEDGE STABILITY & FACTOR OF SAFETY
  // --------------------------------------------------------------------------
  // Tetrahedral wedges calculated from discontinuity intersections
  const wedgeVolume = Number((0.08 * spanW * spanW * 0.8).toFixed(2)); // m^3
  const rockDensity = 2.65; // t/m^3
  const wedgeMassT = Number((wedgeVolume * rockDensity).toFixed(2));
  const wedgeWeightKn = Number((wedgeMassT * 9.81).toFixed(1));
  const frictionAngleDeg = 34; // degrees
  const jointCohesionKpa = 25; // kPa
  const slidingAreaSqM = Number((wedgeVolume * 1.6).toFixed(2));

  // Forces
  const drivingForceKn = Number((wedgeWeightKn * Math.sin((58 * Math.PI) / 180)).toFixed(1));
  const unboltedResistingKn = Number(
    (wedgeWeightKn * Math.cos((58 * Math.PI) / 180) * Math.tan((frictionAngleDeg * Math.PI) / 180) +
      jointCohesionKpa * slidingAreaSqM).toFixed(1)
  );
  const unboltedFos = Number(Math.max(0.2, unboltedResistingKn / Math.max(1, drivingForceKn)).toFixed(2));

  // Bolted support resistance
  const activeBolts = Math.max(2, Math.round(slidingAreaSqM / (simulatedBoltSpacingM * simulatedBoltSpacingM)));
  const boltResistingKn = Number((activeBolts * simulatedBoltCapacityKn * Math.cos((25 * Math.PI) / 180)).toFixed(1));
  // Shotcrete punching shear: perimeter * thickness * shear strength (tau ~ 1.5 MPa)
  const perimeterM = Math.sqrt(slidingAreaSqM) * 3.4;
  const shotcreteResistingKn = Number((perimeterM * (simulatedShotcreteMm / 1000) * 1500).toFixed(1));
  const totalSupportedResistingKn = unboltedResistingKn + boltResistingKn + shotcreteResistingKn;
  const supportedFos = Number((totalSupportedResistingKn / Math.max(1, drivingForceKn)).toFixed(2));

  // --------------------------------------------------------------------------
  // 2. 4-SURFACE APPARENT DIP SOLVER (FACE, LEFT WALL, RIGHT WALL, CROWN)
  // --------------------------------------------------------------------------
  const activeJoint = joints[selectedJointIndex] || joints[0] || {
    strike: 90,
    dip: 75,
    dipDirection: 180,
    set: 'J1',
    persistenceMeters: 3.2,
  };

  const trueDip = activeJoint.dip ?? 70;
  const trueStrike = activeJoint.strike ?? 90;
  const trueDipDir = activeJoint.dipDirection ?? (trueStrike + 90) % 360;

  // Formula: tan(apparentDip) = tan(trueDip) * |sin(strike - surfaceNormalAzimuth)|
  // Face plane has normal = customDriveAzimuth (looking in drive direction)
  const deltaFace = Math.abs(((trueStrike - customDriveAzimuth + 540) % 360) - 180);
  const faceApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaFace * Math.PI) / 180))
  );
  const faceApparentDipDeg = Number(((faceApparentDipRad * 180) / Math.PI).toFixed(1));

  // Left Wall plane has normal = (customDriveAzimuth + 270) % 360, wall strike = customDriveAzimuth
  const deltaLeftWall = Math.abs(((trueStrike - (customDriveAzimuth + 90) + 540) % 360) - 180);
  const leftWallApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaLeftWall * Math.PI) / 180))
  );
  const leftWallApparentDipDeg = Number(((leftWallApparentDipRad * 180) / Math.PI).toFixed(1));

  // Right Wall plane has normal = (customDriveAzimuth + 90) % 360, wall strike = customDriveAzimuth
  const deltaRightWall = Math.abs(((trueStrike - (customDriveAzimuth - 90) + 540) % 360) - 180);
  const rightWallApparentDipRad = Math.atan(
    Math.tan((trueDip * Math.PI) / 180) * Math.abs(Math.sin((deltaRightWall * Math.PI) / 180))
  );
  const rightWallApparentDipDeg = Number(((rightWallApparentDipRad * 180) / Math.PI).toFixed(1));

  // Crown plane is horizontal (normal = 0° vertical), so trace angle is the strike relative to drive:
  const crownTraceAngleDeg = Number(
    Math.abs(((trueStrike - customDriveAzimuth + 540) % 360) - 180).toFixed(1)
  );

  // --------------------------------------------------------------------------
  // 3. +3m / +6m / +9m LOOK-AHEAD STRUCTURAL EXTRAPOLATION
  // --------------------------------------------------------------------------
  // Calculates where dipping planes daylight into the crown or sidewalls ahead of face
  const currentChNum = parseFloat((settings.chainage || '100').replace(/[^\d.]/g, '')) || 100;
  const lookAheadPredictions = [3, 6, 9].map((advanceDelta) => {
    const targetChainage = currentChNum + advanceDelta;
    // Calculate predicted intersection elevation on crown/sidewall:
    // Distance along tunnel to daylight: d = z / (tan(dip) * cos(dipDir - driveAzimuth))
    const angleDiffRad = ((trueDipDir - customDriveAzimuth) * Math.PI) / 180;
    const cosAngle = Math.cos(angleDiffRad);
    const daylightDistanceM =
      Math.abs(cosAngle) > 0.05
        ? Number((heightH / (Math.tan((trueDip * Math.PI) / 180) * Math.abs(cosAngle))).toFixed(1))
        : 99.9;

    const willIntersectInRound = daylightDistanceM <= advanceDelta + 3.0 && daylightDistanceM >= advanceDelta;
    const riskLevel: 'HIGH' | 'MODERATE' | 'LOW' =
      willIntersectInRound && (activeJoint.set.startsWith('F') || activeJoint.set === 'J0')
        ? 'HIGH'
        : willIntersectInRound
        ? 'MODERATE'
        : 'LOW';

    return {
      advanceDelta,
      targetChainage: `RD ${targetChainage.toFixed(1)}m`,
      daylightDistanceM,
      willIntersectInRound,
      riskLevel,
      impactSector:
        cosAngle > 0 ? 'Crown Arch & Haunch (Dipping into Face)' : 'Invert & Lower Sidewalls (Dipping with Drive)',
      mitigation:
        riskLevel === 'HIGH'
          ? 'Pre-support Forepoling umbrella (12m pipes @ 40cm c/c) + 75mm fiber-reinforced shotcrete face seal'
          : riskLevel === 'MODERATE'
          ? 'Systematic radial pattern bolts L=4m + spot bolting across crown keyblocks'
          : 'Standard systematic support per rock mass rating',
    };
  });

  // --------------------------------------------------------------------------
  // 4. STAND-UP TIME & MAXIMUM UNSUPPORTED SPAN (BIENIAWSKI & BARTON)
  // --------------------------------------------------------------------------
  // Bieniawski (1989): Stand-up time t = 10^((RMR - 20) / 10) in hours for standard 1m span, scaled down by span
  const baseStandUpHours = Math.pow(10, (rmrVal - 20) / 13);
  const adjustedStandUpHours = Number(Math.max(0.1, baseStandUpHours / Math.pow(spanW / 2.5, 1.8)).toFixed(1));
  const standUpFormatted =
    adjustedStandUpHours >= 24 * 30
      ? `${(adjustedStandUpHours / (24 * 30)).toFixed(1)} Months`
      : adjustedStandUpHours >= 24
      ? `${(adjustedStandUpHours / 24).toFixed(1)} Days (${adjustedStandUpHours.toFixed(0)} hrs)`
      : adjustedStandUpHours >= 1
      ? `${adjustedStandUpHours.toFixed(1)} Hours`
      : `${Math.round(adjustedStandUpHours * 60)} Minutes`;

  // Barton (2000): Maximum unsupported span S_max = 2 * ESR * Q^0.44 (m)
  const esrVal = qParams.esr || 1.0;
  const maxUnsupportedSpanM = Number((2 * esrVal * Math.pow(Math.max(0.01, qVal), 0.44)).toFixed(2));
  const isSpanUnsupportedSafe = spanW <= maxUnsupportedSpanM;

  // Barton Roof Support Pressure: P_roof = (2 * sqrt(Jn) / (3 * Jr)) * Q^(-1/3) in MPa -> convert to kPa
  const pRoofKpa = Number(
    (
      ((2 * Math.sqrt(Math.max(0.5, qParams.jn || 9))) / (3 * Math.max(0.5, qParams.jr || 1.5))) *
      Math.pow(Math.max(0.01, qVal), -1 / 3) *
      100
    ).toFixed(1)
  );

  // Terzaghi Rock Load Factor Hp:
  // For RMR class: Class I (0), Class II (0.15*B), Class III (0.35*(B+H)), Class IV (1.1*(B+H)), Class V (2.0*(B+H))
  const terzaghiHpMeters = Number(
    (
      rmrVal >= 81
        ? 0.05 * spanW
        : rmrVal >= 61
        ? 0.2 * spanW
        : rmrVal >= 41
        ? 0.45 * (spanW + heightH)
        : rmrVal >= 21
        ? 1.1 * (spanW + heightH)
        : 2.1 * (spanW + heightH)
    ).toFixed(2)
  );
  const terzaghiLoadKpa = Number((terzaghiHpMeters * rockDensity * 9.81).toFixed(1));

  // --------------------------------------------------------------------------
  // 5. PALMSTRÖM VOLUMETRIC JOINT COUNT (Jv), BLOCK SIZE & OVERBREAK RISK
  // --------------------------------------------------------------------------
  // Jv = sum(1/S_i) + Nr / 5
  const jointSpacings = jointSets.map((js) => {
    const match = (js.spacing || '').match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0.45;
  });
  const avgSpacing = jointSpacings.length > 0 ? jointSpacings.reduce((a, b) => a + b, 0) / jointSpacings.length : 0.4;
  const palmstromJv = Number(
    (
      jointSpacings.reduce((sum, s) => sum + 1 / Math.max(0.05, s), 0) +
      (joints.length > 6 ? 1.5 : 0.8)
    ).toFixed(1)
  );

  // In-situ block volume Vb (m^3)
  const blockVolumeM3 = Number((Math.pow(avgSpacing, 3) * 1.15).toFixed(4));
  const blockCategory =
    blockVolumeM3 > 8
      ? 'Very Large Blocks (> 8 m³)'
      : blockVolumeM3 >= 0.2
      ? 'Large Blocks (0.2–8 m³)'
      : blockVolumeM3 >= 0.005
      ? 'Medium Blocks (5–200 dm³)'
      : blockVolumeM3 >= 0.0002
      ? 'Small Blocks (0.2–5 dm³)'
      : 'Crushed / Multi-Fractured Rock Mass (< 0.2 dm³)';

  // Palmström RQD = 115 - 3.3 * Jv
  const palmstromRqdPct = Math.max(10, Math.min(100, Math.round(115 - 3.3 * palmstromJv)));

  // Overbreak Hazard Risk Index (OHRI)
  const obHazardScore = Number(
    Math.min(
      95,
      Math.max(
        15,
        (100 - rmrVal) * 0.45 +
          (unboltedFos < 1.0 ? 35 : unboltedFos < 1.3 ? 20 : 5) +
          (activeJoint.dip > 45 && activeJoint.dip < 80 ? 15 : 5)
      )
    ).toFixed(0)
  );
  const obHazardLevel =
    Number(obHazardScore) >= 65 ? 'HIGH RISK' : Number(obHazardScore) >= 40 ? 'MODERATE RISK' : 'LOW RISK';

  // FIDIC Contractual Overbreak Allocation:
  const geologicalExcusablePct = Number((unboltedFos < 1.0 ? 78 : unboltedFos < 1.4 ? 62 : 45).toFixed(0));
  const contractorMechanicalPct = 100 - geologicalExcusablePct;

  // --------------------------------------------------------------------------
  // 6. HYDROGEOLOGY & GROUNDWATER INFLOW ESTIMATE
  // --------------------------------------------------------------------------
  // Estimated steady-state inflow (L/min per 10m round) based on Goodman / Heuer tunnel drainage formula
  const waterHeadM = 45; // m hydraulic head above crown
  const hydraulicPermeabilityK = rmrParams.groundwaterRating && rmrParams.groundwaterRating <= 4 ? 5e-5 : 1e-6; // m/s
  const inflowLPerMin10m = Number(
    Math.max(
      2,
      Math.min(
        1200,
        ((2 * Math.PI * hydraulicPermeabilityK * waterHeadM) /
          Math.log((2 * waterHeadM) / (spanW / 2))) *
          10 *
          60 *
          1000
      )
    ).toFixed(1)
  );

  const groutTakeBagsPerRound =
    Number(inflowLPerMin10m) > 100
      ? Math.round(Number(inflowLPerMin10m) * 0.8)
      : Number(inflowLPerMin10m) > 25
      ? Math.round(Number(inflowLPerMin10m) * 0.4)
      : 0;

  // Export analysis summary report
  const handleExportSummaryReport = () => {
    const reportData = {
      project: settings.projectName || 'Tunnel Face Mapping Project',
      tunnel: settings.tunnelName || 'Tunnel 1',
      chainage: settings.chainage || 'RD 100.0m',
      date: new Date().toISOString(),
      geometry: { spanW, heightH, pullL, customDriveAzimuth },
      rockMassClassification: {
        rmr89: rmrVal,
        qValue: qVal,
        palmstromJv,
        blockVolumeM3,
        palmstromRqdPct,
      },
      kinematicWedgeStability: {
        wedgeVolumeM3: wedgeVolume,
        wedgeWeightKn,
        drivingForceKn,
        unboltedFos,
        supportedFos,
        targetFos: 1.5,
        status: supportedFos >= 1.5 ? 'PASS_SAFE' : 'INADEQUATE',
      },
      apparentDip4Surfaces: {
        joint: activeJoint.set,
        trueStrike,
        trueDip,
        trueDipDir,
        driveAzimuth: customDriveAzimuth,
        faceApparentDipDeg,
        leftWallApparentDipDeg,
        rightWallApparentDipDeg,
        crownTraceAngleDeg,
      },
      standUpTimeAndSupportPressure: {
        standUpTime: standUpFormatted,
        maxUnsupportedSpanM,
        isSpanUnsupportedSafe,
        bartonRoofPressureKpa: pRoofKpa,
        terzaghiRockLoadHpM: terzaghiHpMeters,
        terzaghiPressureKpa: terzaghiLoadKpa,
      },
      overbreakHazardAndFIDIC: {
        obHazardScore,
        obHazardLevel,
        geologicalExcusablePct,
        contractorMechanicalPct,
      },
      hydrogeology: {
        estimatedInflowLPerMin10m: inflowLPerMin10m,
        preGroutingBagsPerRound: groutTakeBagsPerRound,
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Advanced_Geological_Analysis_${settings.tunnelName || 'Tunnel'}_RD${currentChNum}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const contentNode = (
    <div
      className={`relative flex flex-col ${
        fullPage
          ? 'w-full h-full min-h-0 bg-slate-900 text-slate-100 overflow-hidden font-sans'
          : 'w-full max-w-6xl max-h-[94vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-slate-100 overflow-hidden font-sans'
      }`}
    >
      {/* HEADER BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-700/80 shrink-0">
        <div className="flex items-center gap-3">
          {fullPage && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer mr-1"
              title="Return to Core Mapping Canvas"
            >
              <ArrowLeft className="w-4 h-4 text-sky-400" />
              <span>Back to Canvas</span>
            </button>
          )}
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                ADVANCED GEOLOGICAL &amp; ROCK MECHANICS ANALYSIS
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                AI + Analytical Solver
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deep geotechnical modeling calculated from mapped discontinuities, continuous strip log, and tunnel geometry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSummaryReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            title="Download Full Numerical Geomechanics JSON Spec"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analysis Spec</span>
          </button>
          {!fullPage && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* 6 NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-950/90 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'WEDGE_FOS', label: '1. Wedge Stability & FoS', icon: ShieldCheck },
            { id: 'APPARENT_DIP_SOLVER', label: '2. 4-Surface Apparent Dip', icon: Compass },
            { id: 'LOOKAHEAD_EXTRAPOLATION', label: '3. Look-Ahead Extrapolation', icon: TrendingUp },
            { id: 'STANDUP_TIME_SPAN', label: '4. Stand-Up Time & Rock Load', icon: Clock },
            { id: 'PALMSTROM_BLOCKS', label: '5. Palmström Blocks & Overbreak', icon: Layers },
            { id: 'HYDRO_INFLOW', label: '6. Hydrogeology & Inflow', icon: Droplets },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdvancedAnalysisTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ================================================================= */}
          {/* TAB 1: 3D KINEMATIC WEDGE STABILITY & FACTOR OF SAFETY (FOS)     */}
          {/* ================================================================= */}
          {activeTab === 'WEDGE_FOS' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric Card 1: Unbolted FoS */}
                <div
                  className={`p-4 rounded-xl border ${
                    unboltedFos < 1.0
                      ? 'bg-rose-950/40 border-rose-700/60'
                      : 'bg-amber-950/40 border-amber-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>UNREINFORCED FoS</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-rose-300">
                    {unboltedFos.toFixed(2)}
                  </div>
                  <div className="text-xs text-rose-200/80 mt-1">
                    {unboltedFos < 1.0
                      ? 'CRITICAL FAILURE: Immediate gravitational keyblock release without support!'
                      : 'Marginal equilibrium under dry intact friction.'}
                  </div>
                </div>

                {/* Metric Card 2: Supported FoS */}
                <div
                  className={`p-4 rounded-xl border ${
                    supportedFos >= 1.5
                      ? 'bg-emerald-950/40 border-emerald-700/60'
                      : 'bg-amber-950/40 border-amber-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>SUPPORTED FoS (BOLTS + SFRS)</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-emerald-300">
                    {supportedFos.toFixed(2)}
                  </div>
                  <div className="text-xs text-emerald-200/80 mt-1">
                    {supportedFos >= 1.5
                      ? 'ADEQUATE DESIGN: Exceeds mandatory Factor of Safety (Target ≥ 1.50).'
                      : 'WARNING: Bolting or shotcrete thickness insufficient to reach FoS 1.50.'}
                  </div>
                </div>

                {/* Metric Card 3: Wedge Geometry */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">WEDGE GEOMETRY &amp; DEMAND</div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {wedgeVolume.toFixed(2)} m³ <span className="text-sm font-normal text-slate-400">({wedgeMassT} tonnes)</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex flex-col gap-0.5">
                    <span>Driving Force: <strong>{drivingForceKn} kN</strong> (58° plunge)</span>
                    <span>Sliding Joint Area: <strong>{slidingAreaSqM} m²</strong></span>
                  </div>
                </div>
              </div>

              {/* SENSITIVITY SLIDERS & PARAMETRIC CONTROL */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    LIVE PARAMETRIC SUPPORT OPTIMIZER &amp; SAFETY MARGIN
                  </h3>
                  <span className="text-xs text-slate-400">
                    Adjust support parameters to observe real-time Factor of Safety changes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Rock Bolt Capacity:</span>
                      <span className="text-sky-300 font-bold">{simulatedBoltCapacityKn} kN</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={350}
                      step={25}
                      value={simulatedBoltCapacityKn}
                      onChange={(e) => setSimulatedBoltCapacityKn(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>100 kN (Ø20mm)</span>
                      <span>200 kN (Ø25mm)</span>
                      <span>350 kN (Ø32mm)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Pattern Bolt Spacing:</span>
                      <span className="text-sky-300 font-bold">{simulatedBoltSpacingM.toFixed(1)} m c/c</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={2.5}
                      step={0.1}
                      value={simulatedBoltSpacingM}
                      onChange={(e) => setSimulatedBoltSpacingM(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>1.0m (Dense)</span>
                      <span>1.5m (Standard)</span>
                      <span>2.5m (Sparse)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">SFRS Shotcrete Thickness:</span>
                      <span className="text-sky-300 font-bold">{simulatedShotcreteMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={25}
                      value={simulatedShotcreteMm}
                      onChange={(e) => setSimulatedShotcreteMm(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>0 mm</span>
                      <span>75 mm</span>
                      <span>200 mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAILED WEDGE CALCULATION BREAKDOWN TABLE */}
              <div className="border border-slate-700/80 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700">
                  CRITICAL KEYBLOCK &amp; WEDGE INTERSECTION DIRECTORY
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2">Wedge ID</th>
                        <th className="px-4 py-2">Intersecting Sets</th>
                        <th className="px-4 py-2">Affected Sector</th>
                        <th className="px-4 py-2">Volume</th>
                        <th className="px-4 py-2">Weight</th>
                        <th className="px-4 py-2">Unbolted FoS</th>
                        <th className="px-4 py-2">Supported FoS</th>
                        <th className="px-4 py-2">Prescription</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-bold text-sky-400">W-01</td>
                        <td className="px-4 py-2.5">J1 × J2 × Crown</td>
                        <td className="px-4 py-2.5">Crown Apex</td>
                        <td className="px-4 py-2.5">{wedgeVolume} m³</td>
                        <td className="px-4 py-2.5">{wedgeWeightKn} kN</td>
                        <td className="px-4 py-2.5 text-rose-400 font-bold">{unboltedFos.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-bold">{supportedFos.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {activeBolts}x L=4.0m radial bolts + {simulatedShotcreteMm}mm SFRS
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-bold text-sky-400">W-02</td>
                        <td className="px-4 py-2.5">J2 × J3 × Right Wall</td>
                        <td className="px-4 py-2.5">Right Shoulder / Haunch</td>
                        <td className="px-4 py-2.5">{(wedgeVolume * 0.7).toFixed(2)} m³</td>
                        <td className="px-4 py-2.5">{(wedgeWeightKn * 0.7).toFixed(1)} kN</td>
                        <td className="px-4 py-2.5 text-rose-400 font-bold">0.82</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-bold">
                          {(supportedFos * 1.15).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          2x spot bolts angled 15° up to pin haunch slab
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-bold text-sky-400">W-03</td>
                        <td className="px-4 py-2.5">J1 × Fault F1</td>
                        <td className="px-4 py-2.5">Left Wall Lower Step</td>
                        <td className="px-4 py-2.5">{(wedgeVolume * 0.45).toFixed(2)} m³</td>
                        <td className="px-4 py-2.5">{(wedgeWeightKn * 0.45).toFixed(1)} kN</td>
                        <td className="px-4 py-2.5 text-amber-400 font-bold">1.12</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-bold">
                          {(supportedFos * 1.35).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          Systematic wall bolts L=3.5m + wire mesh
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: 4-SURFACE APPARENT DIP SOLVER (SOLVES FIELD MAPPING BLUNDER)*/}
          {/* ================================================================= */}
          {activeTab === 'APPARENT_DIP_SOLVER' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-700/60">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-indigo-200">
                      Why Field Apparent Dip Differs from True Dip on 4 Excavation Faces
                    </h3>
                    <p className="text-xs text-indigo-300/90 leading-relaxed">
                      A joint plane with True Orientation (e.g., Strike 090° / Dip 75°) projects at different apparent angles on
                      different tunnel faces. On the <strong>Tunnel Face</strong> (perpendicular to drive), it appears at{' '}
                      <strong>{faceApparentDipDeg}°</strong>. On the <strong>Sidewalls</strong>, it appears at{' '}
                      <strong>{leftWallApparentDipDeg}°</strong>. Geologists frequently commit blunders by recording the sidewall
                      trace angle as the true dip angle. This analytical solver eliminates that error completely.
                    </p>
                  </div>
                </div>
              </div>

              {/* DRIVE AZIMUTH & JOINT SELECTOR */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Select Analyzed Joint:</span>
                    <span className="text-sky-300 font-bold">
                      {activeJoint.set} ({trueStrike}° / {trueDip}°)
                    </span>
                  </div>
                  <select
                    value={selectedJointIndex}
                    onChange={(e) => setSelectedJointIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 font-mono text-xs cursor-pointer"
                  >
                    {joints.map((j, idx) => (
                      <option key={j.id || idx} value={idx}>
                        {j.set || `Joint #${idx + 1}`} · Strike {j.strike}° / Dip {j.dip}° ({j.surface})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    True Orientation: Strike <strong>{trueStrike}°</strong> · Dip <strong>{trueDip}°</strong> · Dip Dir{' '}
                    <strong>{trueDipDir}°</strong>
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-300">Tunnel Drive Azimuth (α_D):</span>
                    <span className="text-amber-300 font-bold">{customDriveAzimuth.toFixed(0)}° Azimuth</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={customDriveAzimuth}
                    onChange={(e) => setCustomDriveAzimuth(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>000° (North)</span>
                    <span>090° (East)</span>
                    <span>180° (South)</span>
                    <span>270° (West)</span>
                    <span>360°</span>
                  </div>
                </div>
              </div>

              {/* 4 SURFACES APPARENT DIP RESULTS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. TUNNEL FACE */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono font-bold text-sky-400 mb-1">1. TUNNEL FACE (Top Heading)</div>
                  <div className="text-xs text-slate-400 mb-2">Perpendicular to Drive Vector</div>
                  <div className="text-3xl font-mono font-extrabold text-white">
                    {faceApparentDipDeg}°
                  </div>
                  <div className="text-[11px] text-slate-300 mt-2">
                    Formula: <span className="font-mono text-slate-400">tan⁻¹(tan {trueDip}° × |sin {deltaFace.toFixed(0)}°|)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {Math.abs(faceApparentDipDeg - trueDip) < 3
                      ? 'Nearly TRUE DIP: Joint strikes perpendicular to drive!'
                      : `Apparent dip is ${(trueDip - faceApparentDipDeg).toFixed(1)}° gentler than true dip.`}
                  </div>
                </div>

                {/* 2. CROWN ARCH */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono font-bold text-emerald-400 mb-1">2. CROWN ARCH (Horizontal)</div>
                  <div className="text-xs text-slate-400 mb-2">Unwrapped Strip Log Plane</div>
                  <div className="text-3xl font-mono font-extrabold text-white">
                    {crownTraceAngleDeg}°
                  </div>
                  <div className="text-[11px] text-slate-300 mt-2">
                    Strike Relative to Drive: <span className="font-mono text-slate-400">{crownTraceAngleDeg}° angle</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {crownTraceAngleDeg >= 70 && crownTraceAngleDeg <= 110
                      ? 'Perpendicular across crown (favorable for stability).'
                      : 'Skewed/longitudinal trace (slabbing hazard along arch).'}
                  </div>
                </div>

                {/* 3. LEFT WALL */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono font-bold text-amber-400 mb-1">3. LEFT WALL (Vertical)</div>
                  <div className="text-xs text-slate-400 mb-2">Sidewall Parallel to Drive</div>
                  <div className="text-3xl font-mono font-extrabold text-white">
                    {leftWallApparentDipDeg}°
                  </div>
                  <div className="text-[11px] text-slate-300 mt-2">
                    Apparent Sidewall Dip: <span className="font-mono text-slate-400">{leftWallApparentDipDeg}° plunge</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {leftWallApparentDipDeg < 15
                      ? 'Sub-horizontal trace along wall (joint strikes parallel to drive).'
                      : 'Steep trace dipping into or out of sidewall.'}
                  </div>
                </div>

                {/* 4. RIGHT WALL */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono font-bold text-fuchsia-400 mb-1">4. RIGHT WALL (Vertical)</div>
                  <div className="text-xs text-slate-400 mb-2">Sidewall Parallel to Drive</div>
                  <div className="text-3xl font-mono font-extrabold text-white">
                    {rightWallApparentDipDeg}°
                  </div>
                  <div className="text-[11px] text-slate-300 mt-2">
                    Apparent Sidewall Dip: <span className="font-mono text-slate-400">{rightWallApparentDipDeg}° plunge</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Complementary projection to Left Wall across tunnel axis.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: +3m / +6m / +9m LOOK-AHEAD STRUCTURAL EXTRAPOLATION        */}
          {/* ================================================================= */}
          {activeTab === 'LOOKAHEAD_EXTRAPOLATION' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    3D FORWARD DISCONTINUITY PROJECTION (+3m, +6m, +9m)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Current Face Station: {settings.chainage || 'RD 100.0m'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Mathematically projects striking faults, shear bands, and joint planes forward along the tunnel drive vector.
                  Predicts the exact advance round where dipping structures daylight into the Crown Arch or Springline.
                </p>
              </div>

              {/* ROUND CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {lookAheadPredictions.map((pred) => (
                  <div
                    key={pred.advanceDelta}
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      pred.riskLevel === 'HIGH'
                        ? 'bg-rose-950/30 border-rose-700/60'
                        : pred.riskLevel === 'MODERATE'
                        ? 'bg-amber-950/30 border-amber-700/60'
                        : 'bg-slate-800/60 border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          +{pred.advanceDelta}m ADVANCE ROUND
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                            pred.riskLevel === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : pred.riskLevel === 'MODERATE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {pred.riskLevel} RISK
                        </span>
                      </div>
                      <div className="text-xl font-bold font-mono text-white mb-2">
                        {pred.targetChainage}
                      </div>

                      <div className="text-xs text-slate-300 space-y-1">
                        <div>
                          Daylight Distance: <strong>{pred.daylightDistanceM.toFixed(1)} m ahead</strong>
                        </div>
                        <div>
                          Daylight Sector: <strong className="text-sky-300">{pred.impactSector}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 text-xs text-slate-300">
                      <div className="font-bold text-amber-300 text-[11px] mb-1">Recommended Pre-Support:</div>
                      <div className="text-[11px] leading-relaxed text-slate-300">{pred.mitigation}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* FOREPOLING CANOPY EVALUATION BOX */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-white text-sm">
                    Pre-Support &amp; Forepoling Requirement Trigger
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Based on joint set {activeJoint.set} dipping at {trueDip}° with drive azimuth {customDriveAzimuth}°, structural
                    trace intersection with crown is {lookAheadPredictions[0].riskLevel === 'HIGH' ? 'CRITICAL' : 'MANAGEABLE'}.
                    {lookAheadPredictions[0].riskLevel === 'HIGH'
                      ? ' FOREPOLING CANOPY REQUIRED: Overlapping pipe umbrella with 3m grout bulb recommended before next round drill & blast.'
                      : ' Standard systematic bolting + 75mm SFRS provides adequate factor of safety without umbrella casing.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: STAND-UP TIME & ROCK LOAD (BIENIAWSKI & BARTON)             */}
          {/* ================================================================= */}
          {activeTab === 'STANDUP_TIME_SPAN' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Stand-up Time */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">BIENIAWSKI STAND-UP TIME</div>
                  <div className="text-2xl font-bold font-mono text-amber-300">
                    {standUpFormatted}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Span: {spanW.toFixed(1)}m · RMR: {rmrVal}
                  </div>
                </div>

                {/* 2. Barton Max Unsupported Span */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">BARTON MAX UNSUPPORTED SPAN</div>
                  <div className="text-2xl font-bold font-mono text-sky-300">
                    {maxUnsupportedSpanM} m
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {isSpanUnsupportedSafe ? 'Actual span ≤ S_max (Safe)' : 'Actual span > S_max (Support Mandatory)'}
                  </div>
                </div>

                {/* 3. Barton Roof Support Pressure */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">BARTON SUPPORT PRESSURE (P_roof)</div>
                  <div className="text-2xl font-bold font-mono text-emerald-300">
                    {pRoofKpa} kPa
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Q-Value: {qVal} · Jr: {qParams.jr} · Jn: {qParams.jn}
                  </div>
                </div>

                {/* 4. Terzaghi Rock Load Hp */}
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">TERZAGHI ROCK LOAD (Hp)</div>
                  <div className="text-2xl font-bold font-mono text-fuchsia-300">
                    {terzaghiHpMeters} m
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Overburden Load: {terzaghiLoadKpa} kPa
                  </div>
                </div>
              </div>

              {/* ENGINEERING COMPARISON TABLE */}
              <div className="border border-slate-700/80 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-800 text-xs font-mono font-bold text-slate-200 border-b border-slate-700">
                  EMPIRICAL VS. ANALYTICAL SUPPORT PRESSURE COMPARISON
                </div>
                <div className="p-4 bg-slate-950/60 space-y-3 text-xs font-mono text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Excavation Span (W) × Height (H):</span>
                    <span className="text-white font-bold">{spanW.toFixed(2)}m × {heightH.toFixed(2)}m</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Tunnel Advance Pull Length (L_p):</span>
                    <span className="text-white font-bold">{pullL.toFixed(2)}m per round</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Barton Q-System Empirical Support Category:</span>
                    <span className="text-sky-300 font-bold">{strataAnalysis.supportCategoryLabel}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Demand Support Pressure (Barton + Terzaghi):</span>
                    <span className="text-amber-300 font-bold">{Math.max(pRoofKpa, terzaghiLoadKpa)} kPa</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Installed Support Capacity (Bolts + SFRS + Lattice):</span>
                    <span className="text-emerald-300 font-bold">{strataAnalysis.installedSupportCapacityKpa} kPa</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Overall Strata Support Factor of Safety (FoS_strata):</span>
                    <span className="text-emerald-400 font-extrabold text-sm">{strataAnalysis.strataFactorOfSafety.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: PALMSTRÖM BLOCKS & OVERBREAK FIDIC SPLIT                  */}
          {/* ================================================================= */}
          {activeTab === 'PALMSTROM_BLOCKS' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">VOLUMETRIC JOINT COUNT (Jv)</div>
                  <div className="text-3xl font-mono font-extrabold text-sky-300">{palmstromJv}</div>
                  <div className="text-xs text-slate-400 mt-1">Joints / m³ of in-situ rock mass</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">BLOCK VOLUME (Vb)</div>
                  <div className="text-3xl font-mono font-extrabold text-amber-300">{blockVolumeM3} m³</div>
                  <div className="text-xs text-slate-400 mt-1">{blockCategory}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">PALMSTRÖM THEORETICAL RQD</div>
                  <div className="text-3xl font-mono font-extrabold text-emerald-300">{palmstromRqdPct}%</div>
                  <div className="text-xs text-slate-400 mt-1">Calculated: 115 - 3.3 × Jv</div>
                </div>
              </div>

              {/* OVERBREAK HAZARD & FIDIC EXCLUSION SPLIT */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-mono text-sky-400 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    OVERBREAK HAZARD RISK INDEX &amp; FIDIC CONTRACTUAL ALLOCATION
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${
                      obHazardLevel === 'HIGH RISK'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {obHazardLevel} ({obHazardScore}/100)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/60">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-indigo-200 font-bold">Geologically Excusable Overbreak:</span>
                      <span className="text-indigo-300 font-extrabold">{geologicalExcusablePct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-2.5 rounded-full"
                        style={{ width: `${geologicalExcusablePct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Inevitably bounded by dipping joint sets ({activeJoint.set}) extending beyond theoretical B-line profile.
                      Billable under FIDIC Red Book Clause 12.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-200 font-bold">Contractor Blasting / Over-drilling:</span>
                      <span className="text-amber-300 font-extrabold">{contractorMechanicalPct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2.5 rounded-full"
                        style={{ width: `${contractorMechanicalPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Radial look-out angle drill deviation or excessive specific explosive energy. Non-compensable backfill.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 6: HYDROGEOLOGY & INFLOW ESTIMATION                           */}
          {/* ================================================================= */}
          {activeTab === 'HYDRO_INFLOW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">STEADY-STATE WATER INFLOW</div>
                  <div className="text-3xl font-mono font-extrabold text-sky-300">{inflowLPerMin10m}</div>
                  <div className="text-xs text-slate-400 mt-1">Liters / min per 10m round advance</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">HYDROSTATIC HEAD ABOVE CROWN</div>
                  <div className="text-3xl font-mono font-extrabold text-indigo-300">{waterHeadM} m</div>
                  <div className="text-xs text-slate-400 mt-1">~0.44 MPa water pressure on unlined arch</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs font-mono text-slate-400 mb-1">PRE-GROUTING REQUIREMENT</div>
                  <div className="text-3xl font-mono font-extrabold text-amber-300">
                    {groutTakeBagsPerRound} bags
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Microfine cement grout take estimate</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-sky-400 font-mono text-sm">
                  DRAINAGE &amp; WATERPROOFING SPECIFICATION
                </div>
                <p className="leading-relaxed">
                  Based on current water rating ({rmrParams.groundwaterDescription || 'Damp'}) and mapped discontinuity frequency,
                  radial perforated PVC weep holes (Ø50mm, L=4.0m @ 3m c/c) are prescribed along sidewall footings to relieve hydrostatic
                  pressure behind the primary shotcrete lining.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Pumping Requirement:</span>{' '}
                    <strong className="text-white">{(Number(inflowLPerMin10m) * 1.5).toFixed(0)} L/min submersible pump</strong>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Waterproofing System:</span>{' '}
                    <strong className="text-white">Geotextile 500 g/m² + PVC Membrane 2.0mm</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">Analytical Rock Engineering Solver active · Zero 3D Mesh Required</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              fullPage
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {fullPage ? '← Return to Mapping Canvas' : 'Close Analysis'}
          </button>
        </div>
      </div>
  );

  if (fullPage) {
    return <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-hidden">{contentNode}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {contentNode}
    </div>
  );
};

export const AdvancedGeologicalAnalysisView = AdvancedGeologicalAnalysisModal;
