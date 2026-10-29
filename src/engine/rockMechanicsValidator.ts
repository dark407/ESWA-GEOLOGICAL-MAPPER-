// ============================================================================
// ESWA ROCK MECHANICS & GEOTECHNICAL VALIDATION ENGINE
// Theoretical Bounds, Physical Law Enforcers, and Ground-Truth Gatekeeper
// ============================================================================
// Standards: ISRM Suggested Methods, Bieniawski RMR89, Barton Q-System (1974/2002),
// Hoek-Brown (2002/2018), Palmström (1996), Goodman-Shi (1985) Block Theory.
// ============================================================================

import {
  Joint,
  JointSet,
  QIndexParameters,
  RmrParameters,
  SavedProjectRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'VALID';

export interface ValidationIssue {
  field: string;
  value: number | string | undefined | null;
  severity: ValidationSeverity;
  message: string;
  theoreticalRange: string;
  referenceStandard: string;
}

export interface ParameterValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type ModuleReadinessStatus = 'EMPTY' | 'INVALID' | 'VALID';

export interface ModuleDataReadiness {
  moduleId: string;
  moduleName: string;
  status: ModuleReadinessStatus;
  missingInputs: string[];
  validationErrors: string[];
  validationWarnings: string[];
  canCalculate: boolean;
  actionGuidance: string;
}

// ----------------------------------------------------------------------------
// 1. PHYSICAL & THEORETICAL BOUNDARY CHECKS
// ----------------------------------------------------------------------------

/**
 * Validates discontinuity orientation (Dip, Dip Direction, Strike, Friction Angle).
 * ISRM Standards:
 * - Dip: 0° (horizontal) to 90° (vertical). Values outside this are geometrically impossible.
 * - Dip Direction: 0° to < 360° (measured clockwise from true north).
 * - Strike: 0° to < 360°.
 * - Friction angle φ: Typical rock joints range from 15° to 50° (ISRM). Highly polished planar
 *   clay gouge can be ~8°-12°; rough undulating surfaces with asperities up to 60°. Above 65° is physical shear locking.
 */
export function validateDiscontinuityParameters(params: {
  dip?: number | null;
  dipDirection?: number | null;
  strike?: number | null;
  frictionAngle?: number | null;
  cohesionKpa?: number | null;
  spacingM?: number | null;
  apertureMm?: number | null;
  persistenceM?: number | null;
}): ParameterValidationResult {
  const issues: ValidationIssue[] = [];

  // Dip
  if (params.dip !== undefined && params.dip !== null) {
    if (isNaN(params.dip)) {
      issues.push({
        field: 'dip',
        value: params.dip,
        severity: 'ERROR',
        message: 'Dip angle must be a valid numeric value.',
        theoreticalRange: '0° to 90°',
        referenceStandard: 'ISRM Suggested Methods',
      });
    } else if (params.dip < 0 || params.dip > 90) {
      issues.push({
        field: 'dip',
        value: params.dip,
        severity: 'ERROR',
        message: `Dip angle ${params.dip}° is geometrically impossible for a rock discontinuity plane.`,
        theoreticalRange: '0° (Horizontal) to 90° (Vertical)',
        referenceStandard: 'ISRM Suggested Methods for Quantitative Description of Discontinuities',
      });
    }
  }

  // Dip Direction
  if (params.dipDirection !== undefined && params.dipDirection !== null) {
    if (isNaN(params.dipDirection)) {
      issues.push({
        field: 'dipDirection',
        value: params.dipDirection,
        severity: 'ERROR',
        message: 'Dip direction must be a valid azimuth.',
        theoreticalRange: '000° to 359.9°',
        referenceStandard: 'ISRM Suggested Methods',
      });
    } else if (params.dipDirection < 0 || params.dipDirection >= 360) {
      issues.push({
        field: 'dipDirection',
        value: params.dipDirection,
        severity: 'ERROR',
        message: `Dip direction azimuth ${params.dipDirection}° is out of compass bounds (must be 0° to 359.9°).`,
        theoreticalRange: '000° to 359.9° (True North azimuth)',
        referenceStandard: 'ISRM Suggested Methods',
      });
    }
  }

  // Strike
  if (params.strike !== undefined && params.strike !== null) {
    if (isNaN(params.strike)) {
      issues.push({
        field: 'strike',
        value: params.strike,
        severity: 'ERROR',
        message: 'Strike must be a valid azimuth.',
        theoreticalRange: '000° to 359.9°',
        referenceStandard: 'ISRM Suggested Methods',
      });
    } else if (params.strike < 0 || params.strike >= 360) {
      issues.push({
        field: 'strike',
        value: params.strike,
        severity: 'ERROR',
        message: `Strike azimuth ${params.strike}° is out of compass bounds (must be 0° to 359.9°).`,
        theoreticalRange: '000° to 359.9°',
        referenceStandard: 'ISRM Suggested Methods',
      });
    }

    // Strike / Dip Direction Orthogonality Check (Right-hand rule or quadrant)
    if (
      params.dipDirection !== undefined &&
      params.dipDirection !== null &&
      !isNaN(params.dipDirection)
    ) {
      const diff1 = Math.abs((params.dipDirection - params.strike + 360) % 360 - 90);
      const diff2 = Math.abs((params.dipDirection - params.strike + 360) % 360 - 270);
      const minDiff = Math.min(diff1, diff2);
      if (minDiff > 5) {
        issues.push({
          field: 'strike_dipDirection_consistency',
          value: `Strike: ${params.strike}°, DipDir: ${params.dipDirection}°`,
          severity: 'WARNING',
          message: `Discrepancy: Dip Direction (${params.dipDirection}°) must be perpendicular (90°) to Strike (${params.strike}°). Divergence is ${minDiff.toFixed(1)}°.`,
          theoreticalRange: 'Dip Direction = (Strike ± 90°) mod 360°',
          referenceStandard: 'Structural Geology Orthogonality Postulate',
        });
      }
    }
  }

  // Friction Angle
  if (params.frictionAngle !== undefined && params.frictionAngle !== null) {
    if (isNaN(params.frictionAngle)) {
      issues.push({
        field: 'frictionAngle',
        value: params.frictionAngle,
        severity: 'ERROR',
        message: 'Friction angle must be a valid number.',
        theoreticalRange: '5° to 65°',
        referenceStandard: 'Mohr-Coulomb / Barton-Bandis Criterion',
      });
    } else if (params.frictionAngle < 0) {
      issues.push({
        field: 'frictionAngle',
        value: params.frictionAngle,
        severity: 'ERROR',
        message: 'Negative friction angle is thermodynamically impossible for rock mass contacts.',
        theoreticalRange: '≥ 0° (Typical rock joints: 15° to 45°)',
        referenceStandard: 'Mohr-Coulomb Criterion',
      });
    } else if (params.frictionAngle < 5) {
      issues.push({
        field: 'frictionAngle',
        value: params.frictionAngle,
        severity: 'WARNING',
        message: `Friction angle ${params.frictionAngle}° is extremely low (super-lubricated graphite or talc gauge). Verify shear testing.`,
        theoreticalRange: '5° to 50°',
        referenceStandard: 'Barton-Choubey (1977)',
      });
    } else if (params.frictionAngle > 65) {
      issues.push({
        field: 'frictionAngle',
        value: params.frictionAngle,
        severity: 'ERROR',
        message: `Friction angle ${params.frictionAngle}° exceeds maximum physical shear resistance of intact rock asperities (max ~60°-65°).`,
        theoreticalRange: '5° to 60°',
        referenceStandard: 'ISRM & Barton-Bandis Joint Behavior Model',
      });
    }
  }

  // Cohesion
  if (params.cohesionKpa !== undefined && params.cohesionKpa !== null) {
    if (params.cohesionKpa < 0) {
      issues.push({
        field: 'cohesionKpa',
        value: params.cohesionKpa,
        severity: 'ERROR',
        message: 'Cohesion cannot be negative.',
        theoreticalRange: 'c ≥ 0 kPa (0 for unbonded joints)',
        referenceStandard: 'Mohr-Coulomb Criterion',
      });
    }
  }

  // Spacing
  if (params.spacingM !== undefined && params.spacingM !== null) {
    if (params.spacingM <= 0) {
      issues.push({
        field: 'spacingM',
        value: params.spacingM,
        severity: 'ERROR',
        message: 'Discontinuity spacing must be strictly greater than zero.',
        theoreticalRange: '0.005 m to 20.0 m',
        referenceStandard: 'ISRM Spacing Classification (Very close <0.02m to Very wide >2m)',
      });
    } else if (params.spacingM > 50) {
      issues.push({
        field: 'spacingM',
        value: params.spacingM,
        severity: 'WARNING',
        message: `Spacing of ${params.spacingM} m represents massive/intact rock without significant jointing.`,
        theoreticalRange: '0.01 m to 10 m in tunnel spans',
        referenceStandard: 'ISRM Discontinuity Spacing Guidelines',
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/**
 * Validates intact rock strength properties (UCS, mi, unit weight, Poisson's ratio, Young's Modulus).
 */
export function validateIntactRockProperties(props: {
  ucsMpa?: number | null;
  mi?: number | null;
  unitWeightKnM3?: number | null;
  youngsModulusGpa?: number | null;
  poissonsRatio?: number | null;
}): ParameterValidationResult {
  const issues: ValidationIssue[] = [];

  // UCS / σci
  if (props.ucsMpa !== undefined && props.ucsMpa !== null) {
    if (isNaN(props.ucsMpa)) {
      issues.push({
        field: 'ucsMpa',
        value: props.ucsMpa,
        severity: 'ERROR',
        message: 'Uniaxial Compressive Strength (UCS) must be a valid number.',
        theoreticalRange: '0.5 to 450 MPa',
        referenceStandard: 'ISRM Suggested Methods for Determining Uniaxial Compressive Strength',
      });
    } else if (props.ucsMpa <= 0) {
      issues.push({
        field: 'ucsMpa',
        value: props.ucsMpa,
        severity: 'ERROR',
        message: `Compressive strength (${props.ucsMpa} MPa) must be strictly positive. Rock cannot have negative or zero compressive strength.`,
        theoreticalRange: '0.5 MPa (Very weak rock) to 400 MPa (Extremely strong rock)',
        referenceStandard: 'ISRM Grade R0 to R6 (1981)',
      });
    } else if (props.ucsMpa > 500) {
      issues.push({
        field: 'ucsMpa',
        value: props.ucsMpa,
        severity: 'WARNING',
        message: `UCS value of ${props.ucsMpa} MPa exceeds almost all terrestrial rocks (corundum/chert ~450 MPa). Verify laboratory testing.`,
        theoreticalRange: '0.5 to 350 MPa',
        referenceStandard: 'ISRM Rock Classification Guidelines',
      });
    }
  }

  // Hoek-Brown mi
  if (props.mi !== undefined && props.mi !== null) {
    if (isNaN(props.mi)) {
      issues.push({
        field: 'mi',
        value: props.mi,
        severity: 'ERROR',
        message: 'Hoek-Brown mi parameter must be numeric.',
        theoreticalRange: '2 to 45',
        referenceStandard: 'Hoek-Brown Failure Criterion (2002 Edition)',
      });
    } else if (props.mi < 2 || props.mi > 45) {
      issues.push({
        field: 'mi',
        value: props.mi,
        severity: 'ERROR',
        message: `Hoek-Brown intact rock constant mi (${props.mi}) is out of physical range (typically 4 for claystones/chalk to 35 for igneous/granite).`,
        theoreticalRange: '2 to 45 (Hoek, Carranza-Torres, Corkum 2002)',
        referenceStandard: 'Hoek-Brown Criterion 2002',
      });
    }
  }

  // Unit weight γ
  if (props.unitWeightKnM3 !== undefined && props.unitWeightKnM3 !== null) {
    if (props.unitWeightKnM3 < 10 || props.unitWeightKnM3 > 50) {
      issues.push({
        field: 'unitWeightKnM3',
        value: props.unitWeightKnM3,
        severity: 'ERROR',
        message: `Rock unit weight ${props.unitWeightKnM3} kN/m³ is outside the physical density of earth crust rocks (typical: 20-33 kN/m³, basalt ~30, granite ~26).`,
        theoreticalRange: '15 to 40 kN/m³ (approx 1.5 to 4.0 g/cm³)',
        referenceStandard: 'ISRM Physical Properties of Rock Materials',
      });
    }
  }

  // Poisson's ratio ν
  if (props.poissonsRatio !== undefined && props.poissonsRatio !== null) {
    if (props.poissonsRatio < 0.05 || props.poissonsRatio > 0.49) {
      issues.push({
        field: 'poissonsRatio',
        value: props.poissonsRatio,
        severity: 'ERROR',
        message: `Poisson's ratio ${props.poissonsRatio} violates linear elastic physical limits for rocks (theoretical limit 0.05 to 0.45).`,
        theoreticalRange: '0.10 to 0.40',
        referenceStandard: 'Theory of Elasticity / ISRM Rock Mechanics',
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/**
 * Validates Barton Q-System parameters (Barton, Lien, Lunde 1974 / Barton 2002).
 */
export function validateBartonQParameters(params?: QIndexParameters | null): ParameterValidationResult {
  const issues: ValidationIssue[] = [];

  if (!params) {
    return {
      isValid: false,
      issues: [
        {
          field: 'qParameters',
          value: null,
          severity: 'ERROR',
          message: 'Barton Q-System parameters have not been supplied.',
          theoreticalRange: 'RQD, Jn, Jr, Ja, Jw, SRF',
          referenceStandard: 'NGI Q-System (Barton 1974, 2002)',
        },
      ],
      errors: [
        {
          field: 'qParameters',
          value: null,
          severity: 'ERROR',
          message: 'Barton Q-System parameters have not been supplied.',
          theoreticalRange: 'RQD, Jn, Jr, Ja, Jw, SRF',
          referenceStandard: 'NGI Q-System (Barton 1974, 2002)',
        },
      ],
      warnings: [],
    };
  }

  // RQD: 0 to 100
  if (params.rqd < 0 || params.rqd > 100) {
    issues.push({
      field: 'rqd',
      value: params.rqd,
      severity: 'ERROR',
      message: `RQD ${params.rqd}% is out of bounds (must be 0% to 100%).`,
      theoreticalRange: '0% to 100% (Deere 1964)',
      referenceStandard: 'Barton Q-System / Deere RQD',
    });
  }

  // Jn: 0.5 to 20
  if (params.jn < 0.5 || params.jn > 20) {
    issues.push({
      field: 'jn',
      value: params.jn,
      severity: 'ERROR',
      message: `Joint set number Jn (${params.jn}) is outside empirical NGI classification bounds (0.5 for massive to 20 for crushed earth).`,
      theoreticalRange: '0.5 to 20.0',
      referenceStandard: 'Barton 1974 Table 2',
    });
  }

  // Jr: 0.5 to 4.0
  if (params.jr < 0.5 || params.jr > 4.0) {
    issues.push({
      field: 'jr',
      value: params.jr,
      severity: 'ERROR',
      message: `Joint roughness number Jr (${params.jr}) is outside valid NGI bounds (0.5 to 4.0).`,
      theoreticalRange: '0.5 to 4.0',
      referenceStandard: 'Barton 1974 Table 3',
    });
  }

  // Ja: 0.75 to 20.0
  if (params.ja < 0.75 || params.ja > 20.0) {
    issues.push({
      field: 'ja',
      value: params.ja,
      severity: 'ERROR',
      message: `Joint alteration number Ja (${params.ja}) is outside valid NGI bounds (0.75 to 20.0).`,
      theoreticalRange: '0.75 to 20.0',
      referenceStandard: 'Barton 1974 Table 4',
    });
  }

  // Jw: 0.05 to 1.0
  if (params.jw < 0.05 || params.jw > 1.0) {
    issues.push({
      field: 'jw',
      value: params.jw,
      severity: 'ERROR',
      message: `Joint water reduction factor Jw (${params.jw}) must be between 0.05 (heavy inflow) and 1.0 (dry).`,
      theoreticalRange: '0.05 to 1.0',
      referenceStandard: 'Barton 1974 Table 5',
    });
  }

  // SRF: 0.5 to 400
  if (params.srf < 0.5 || params.srf > 400) {
    issues.push({
      field: 'srf',
      value: params.srf,
      severity: 'ERROR',
      message: `Stress reduction factor SRF (${params.srf}) is outside valid NGI range (0.5 to 400).`,
      theoreticalRange: '0.5 to 400.0',
      referenceStandard: 'Barton 1974 Table 6',
    });
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/**
 * Validates Bieniawski RMR89 parameters (Bieniawski 1989).
 */
export function validateBieniawskiRmrParameters(params?: RmrParameters | null): ParameterValidationResult {
  const issues: ValidationIssue[] = [];

  if (!params) {
    return {
      isValid: false,
      issues: [
        {
          field: 'rmrParameters',
          value: null,
          severity: 'ERROR',
          message: 'Bieniawski RMR parameters have not been supplied.',
          theoreticalRange: 'R1 through R6 (0 to 100)',
          referenceStandard: 'Bieniawski RMR89 (Geomechanics Classification)',
        },
      ],
      errors: [
        {
          field: 'rmrParameters',
          value: null,
          severity: 'ERROR',
          message: 'Bieniawski RMR parameters have not been supplied.',
          theoreticalRange: 'R1 through R6 (0 to 100)',
          referenceStandard: 'Bieniawski RMR89 (Geomechanics Classification)',
        },
      ],
      warnings: [],
    };
  }

  // Total RMR: 0 to 100
  const total = params.totalRmr ?? 0;
  if (total < 0 || total > 100) {
    issues.push({
      field: 'totalRmr',
      value: total,
      severity: 'ERROR',
      message: `Total RMR rating (${total}) is out of empirical bounds (0 to 100).`,
      theoreticalRange: '0 (Extremely poor rock, Class V) to 100 (Very good rock, Class I)',
      referenceStandard: 'Bieniawski (1989)',
    });
  }

  const errors = issues.filter((i) => i.severity === 'ERROR');
  const warnings = issues.filter((i) => i.severity === 'WARNING');

  return {
    isValid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

// ----------------------------------------------------------------------------
// 2. DATA READINESS GATEKEEPER FOR GEOTECHNICAL ANALYSIS MODULES
// ----------------------------------------------------------------------------

export interface GeotechnicalActiveState {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  rmrParams?: RmrParameters;
  qIndexParams?: QIndexParameters;
  savedProjects?: SavedProjectRecord[];
  intactUcsMpa?: number;
  frictionAngleDeg?: number;
}

/**
 * Assesses whether a specific geotechnical analysis module has sufficient, verified ground-truth data
 * to produce scientifically valid calculations without hallucinating inputs.
 */
export function assessModuleDataReadiness(
  moduleId: string,
  state: GeotechnicalActiveState
): ModuleDataReadiness {
  const { geometry, settings, joints = [], jointSets = [], rmrParams, qIndexParams, savedProjects = [] } = state;
  const missingInputs: string[] = [];
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  const candidateJoints = (joints || []).filter((j) => j && (j.dip !== undefined || j.dipDirection !== undefined));
  const hasAtLeastOneJoint = candidateJoints.length > 0;
  const hasAtLeastTwoJoints = candidateJoints.length >= 2 || (jointSets && jointSets.length >= 2);
  const hasValidRmr = rmrParams && typeof rmrParams.totalRmr === 'number' && rmrParams.totalRmr > 0;
  const hasValidQ = qIndexParams && typeof qIndexParams.qValue === 'number' && qIndexParams.qValue > 0;
  const hasGeometry = !!(geometry && geometry.width && geometry.width > 0 && geometry.height && geometry.height > 0);

  // Validate geometry
  if (!hasGeometry) {
    missingInputs.push('Tunnel Geometry (Cross-section Span & Height)');
  } else {
    if (geometry.width <= 0 || geometry.height <= 0) {
      validationErrors.push(`Tunnel dimensions (${geometry.width}m x ${geometry.height}m) must be positive values.`);
    }
  }

  // Per-module validation
  switch (moduleId) {
    case 'WEDGE_FOS': {
      // Goodman-Shi (1985) Kinematic Wedge Stability requires:
      // 1. At least 2 structural discontinuity planes (strike/dip/dipDir)
      // 2. Friction angle φ > 0°
      // 3. Tunnel drive azimuth
      if (!hasAtLeastTwoJoints) {
        missingInputs.push('Discontinuity Traces: At least 2 distinct joint sets or structural planes are required to define a kinematic tetrahedral wedge.');
      }
      if (settings.driveDirection === undefined || settings.driveDirection === null) {
        missingInputs.push('Tunnel Drive Axis Azimuth (e.g., 045° heading)');
      }

      // Check discontinuity physical bounds for each joint
      candidateJoints.forEach((j, idx) => {
        const valRes = validateDiscontinuityParameters({
          dip: j.dip,
          dipDirection: j.dipDirection,
          strike: j.strike,
          frictionAngle: (j as any).frictionAngle || 32,
        });
        valRes.errors.forEach((err) => validationErrors.push(`Joint #${idx + 1} (${j.set || 'Discontinuity'}): ${err.message}`));
        valRes.warnings.forEach((warn) => validationWarnings.push(`Joint #${idx + 1}: ${warn.message}`));
      });
      break;
    }

    case 'HOEK_BROWN_ROCK': {
      // Hoek-Brown 2002 criterion requires:
      // 1. Intact rock UCS (σci > 0)
      // 2. GSI (Geological Strength Index) or valid RMR/Q
      // 3. Rock type / mi constant
      if (!hasValidRmr && !hasValidQ) {
        missingInputs.push('Rock Mass Rating (RMR89) or Barton Q-System classification to derive GSI.');
      }
      break;
    }

    case 'STANDUP_TIME_SPAN': {
      // Bieniawski Stand-up Time requires valid RMR89 total rating
      if (!hasValidRmr) {
        missingInputs.push('Bieniawski RMR89 Classification (Total RMR score required to compute unsupported stand-up time).');
      }
      break;
    }

    case 'PALMSTROM_BLOCKS': {
      // Palmström 1996 volumetric joint count Jv & block sizing requires:
      // Discontinuity sets with measured true spacing S
      if (!hasAtLeastOneJoint) {
        missingInputs.push('Mapped Discontinuities: Measured joint sets with true spacings (S1, S2, S3) required for Palmström Jv calculation.');
      }
      break;
    }

    case 'HYDRO_INFLOW': {
      // Goodman / Heuer 1995 tunnel groundwater inflow requires:
      // Tunnel depth / overburden H and piezometric head or rock permeability
      if (!hasGeometry) {
        missingInputs.push('Tunnel Cross-Section Geometry (Radius & Perimeter)');
      }
      break;
    }

    case 'WEAK_ZONE_PROJECTOR': {
      // Weak zone ahead requires genuine mapped faults or shear contacts
      const hasMappedFault = candidateJoints.some((j) => {
        const t = ((j as any).type || (j.featureType as string) || '').toLowerCase();
        return t.includes('fault') || t.includes('shear');
      });
      if (!hasMappedFault) {
        missingInputs.push('No Structural Faults or Shear Zones Mapped on Active Face. (Trace or mark a shear zone on the face canvas to project ahead).');
      }
      break;
    }

    case 'SEQUENTIAL_3D_RECON': {
      // 3D face interpolation requires at least 2 consecutive face logs
      if (!savedProjects || savedProjects.length < 2) {
        missingInputs.push('Sequential Face Logs: At least 2 mapped face rounds (chainage stations) required to interpolate 3D geological lithology ribbons.');
      }
      break;
    }

    case 'ALIGNMENT_ALTERNATIVES': {
      if (!hasAtLeastOneJoint) {
        missingInputs.push('Structural Discontinuity Field: At least 1 joint or fault required to evaluate alignment strike-to-tunnel angles.');
      }
      if (!hasValidRmr) {
        missingInputs.push('Baseline RMR Classification to compute Bieniawski R6 alignment orientation adjustment.');
      }
      break;
    }

    case 'POOR_ROCK_PROPORTIONS': {
      if (!hasValidRmr && !hasValidQ) {
        missingInputs.push('Geotechnical Classification (RMR or Q) across mapped chainage to evaluate probabilistic Class IV & V proportions.');
      }
      break;
    }

    case 'EXCAVATION_3D_LOG':
    case 'APPARENT_THICKNESS_SPACING':
    default: {
      if (!hasAtLeastOneJoint) {
        missingInputs.push('Discontinuity Traces: No joints, bedding, or shear planes have been traced on the active tunnel face.');
      }
      break;
    }
  }

  const isMissing = missingInputs.length > 0;
  const isInvalid = validationErrors.length > 0;

  let status: ModuleReadinessStatus = 'VALID';
  if (isMissing) {
    status = 'EMPTY';
  } else if (isInvalid) {
    status = 'INVALID';
  }

  let actionGuidance = 'All theoretical inputs verified. Ground-truth calculations enabled.';
  if (status === 'EMPTY') {
    actionGuidance = 'Input Required: Provide the listed field measurements to unlock theoretical rock mechanics outputs.';
  } else if (status === 'INVALID') {
    actionGuidance = 'Physical Violation: Correct out-of-bounds parameters to adhere to rock mechanics standards.';
  }

  return {
    moduleId,
    moduleName: moduleId.replace(/_/g, ' '),
    status,
    missingInputs,
    validationErrors,
    validationWarnings,
    canCalculate: status === 'VALID',
    actionGuidance,
  };
}

// ----------------------------------------------------------------------------
// 4. REAL-TIME SCIENTIFIC PARAMETER CLAMPING & VALIDATION HOOKS
// ----------------------------------------------------------------------------

export interface ClampedResult<T = number> {
  value: T;
  clamped: boolean;
  originalValue?: any;
  warning?: string;
  theoreticalRange: string;
}

/**
 * Clamps tunnel drive azimuth / heading strictly to 0° - 360°
 */
export function clampDriveAzimuth(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 0, clamped: false, theoreticalRange: '0° to 360°' };
  }
  if (num < 0) {
    const norm = ((num % 360) + 360) % 360;
    return {
      value: Number(norm.toFixed(1)),
      clamped: true,
      originalValue: raw,
      warning: `Negative azimuth ${num}° normalized to ${norm.toFixed(1)}°.`,
      theoreticalRange: '0° to 360° (Clockwise from True North)',
    };
  }
  if (num > 360) {
    const norm = num % 360;
    return {
      value: Number(norm.toFixed(1)),
      clamped: true,
      originalValue: raw,
      warning: `Azimuth ${num}° exceeds 360° circle; wrapped to ${norm.toFixed(1)}°.`,
      theoreticalRange: '0° to 360° (Compass Azimuth)',
    };
  }
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0° to 360°' };
}

/**
 * Clamps rock discontinuity dip strictly to 0° - 90°
 */
export function clampDiscontinuityDip(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 0, clamped: false, theoreticalRange: '0° (Horizontal) to 90° (Vertical)' };
  }
  if (num < 0) {
    return {
      value: 0,
      clamped: true,
      originalValue: raw,
      warning: `Dip cannot be negative (${num}° clamped to 0° horizontal).`,
      theoreticalRange: '0° to 90° (ISRM Standard)',
    };
  }
  if (num > 90) {
    return {
      value: 90,
      clamped: true,
      originalValue: raw,
      warning: `Dip cannot exceed 90° vertical (${num}° clamped to 90°).`,
      theoreticalRange: '0° to 90° (ISRM Standard)',
    };
  }
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0° to 90°' };
}

/**
 * Clamps discontinuity dip direction strictly to 0° - 360°
 */
export function clampDiscontinuityDipDirection(raw: number | string | null | undefined): ClampedResult<number> {
  return clampDriveAzimuth(raw);
}

/**
 * Clamps excavation width / span to 1.0m - 35.0m
 */
export function clampTunnelSpan(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 8.4, clamped: false, theoreticalRange: '1.0m to 35.0m' };
  }
  if (num < 1.0) {
    return {
      value: 1.0,
      clamped: true,
      originalValue: raw,
      warning: `Span ${num}m is below minimum engineering dimension (clamped to 1.0m).`,
      theoreticalRange: '1.0m to 35.0m',
    };
  }
  if (num > 35.0) {
    return {
      value: 35.0,
      clamped: true,
      originalValue: raw,
      warning: `Span ${num}m exceeds underground excavation practical limits (clamped to 35.0m).`,
      theoreticalRange: '1.0m to 35.0m',
    };
  }
  return { value: Number(num.toFixed(2)), clamped: false, theoreticalRange: '1.0m to 35.0m' };
}

/**
 * Clamps excavation height to 1.0m - 35.0m
 */
export function clampTunnelHeight(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 7.2, clamped: false, theoreticalRange: '1.0m to 35.0m' };
  }
  if (num < 1.0) {
    return {
      value: 1.0,
      clamped: true,
      originalValue: raw,
      warning: `Height ${num}m clamped to minimum 1.0m.`,
      theoreticalRange: '1.0m to 35.0m',
    };
  }
  if (num > 35.0) {
    return {
      value: 35.0,
      clamped: true,
      originalValue: raw,
      warning: `Height ${num}m clamped to maximum 35.0m.`,
      theoreticalRange: '1.0m to 35.0m',
    };
  }
  return { value: Number(num.toFixed(2)), clamped: false, theoreticalRange: '1.0m to 35.0m' };
}

/**
 * Clamps pull / round length to 0.5m - 12.0m
 */
export function clampPullLength(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 3.5, clamped: false, theoreticalRange: '0.5m to 12.0m' };
  }
  if (num < 0.5) {
    return {
      value: 0.5,
      clamped: true,
      originalValue: raw,
      warning: `Blast round pull ${num}m is below minimum 0.5m (clamped to 0.5m).`,
      theoreticalRange: '0.5m to 12.0m',
    };
  }
  if (num > 12.0) {
    return {
      value: 12.0,
      clamped: true,
      originalValue: raw,
      warning: `Blast pull ${num}m exceeds maximum drill-and-blast depth (clamped to 12.0m).`,
      theoreticalRange: '0.5m to 12.0m',
    };
  }
  return { value: Number(num.toFixed(2)), clamped: false, theoreticalRange: '0.5m to 12.0m' };
}

/**
 * Clamps Intact Rock UCS to 0.5 - 500 MPa
 */
export function clampUcsMpa(raw: number | string | null | undefined): ClampedResult<number | null> {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, clamped: false, theoreticalRange: '0.5 to 500 MPa' };
  }
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (isNaN(num)) {
    return { value: null, clamped: false, theoreticalRange: '0.5 to 500 MPa' };
  }
  if (num < 0.5) {
    return {
      value: 0.5,
      clamped: true,
      originalValue: raw,
      warning: `UCS ${num} MPa clamped to lowest ISRM rock strength boundary (0.5 MPa).`,
      theoreticalRange: '0.5 to 500 MPa (ISRM Strength Grade R0-R6)',
    };
  }
  if (num > 500) {
    return {
      value: 500,
      clamped: true,
      originalValue: raw,
      warning: `UCS ${num} MPa clamped to theoretical rock limit (500 MPa).`,
      theoreticalRange: '0.5 to 500 MPa (ISRM Strength Grade R0-R6)',
    };
  }
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0.5 to 500 MPa' };
}

/**
 * Clamps RQD % strictly to 0% - 100%
 */
export function clampRqdPercent(raw: number | string | null | undefined): ClampedResult<number | null> {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, clamped: false, theoreticalRange: '0% to 100%' };
  }
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (isNaN(num)) {
    return { value: null, clamped: false, theoreticalRange: '0% to 100%' };
  }
  if (num < 0) {
    return {
      value: 0,
      clamped: true,
      originalValue: raw,
      warning: `RQD ${num}% cannot be negative (clamped to 0%).`,
      theoreticalRange: '0% to 100% (Deere et al., 1967)',
    };
  }
  if (num > 100) {
    return {
      value: 100,
      clamped: true,
      originalValue: raw,
      warning: `RQD ${num}% cannot exceed 100% total core recovery (clamped to 100%).`,
      theoreticalRange: '0% to 100% (Deere et al., 1967)',
    };
  }
  return { value: Math.round(num), clamped: false, theoreticalRange: '0% to 100%' };
}

/**
 * Clamps Discontinuity Spacing to 0.01m - 10.0m
 */
export function clampDiscontinuitySpacingMeters(raw: number | string | null | undefined): ClampedResult<number | null> {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, clamped: false, theoreticalRange: '0.01m to 10.0m' };
  }
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (isNaN(num)) {
    return { value: null, clamped: false, theoreticalRange: '0.01m to 10.0m' };
  }
  if (num < 0.01) {
    return {
      value: 0.01,
      clamped: true,
      originalValue: raw,
      warning: `Spacing ${num}m clamped to minimum 0.01m (10 mm).`,
      theoreticalRange: '0.01m (Crushed) to 10.0m (Very Wide)',
    };
  }
  if (num > 10.0) {
    return {
      value: 10.0,
      clamped: true,
      originalValue: raw,
      warning: `Spacing ${num}m clamped to massive rock limit (10.0m).`,
      theoreticalRange: '0.01m to 10.0m (ISRM Discontinuity Spacing)',
    };
  }
  return { value: Number(num.toFixed(3)), clamped: false, theoreticalRange: '0.01m to 10.0m' };
}

/**
 * Clamps Barton Joint Set Number Jn (0.5 to 20.0)
 */
export function clampBartonJn(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 3.0, clamped: false, theoreticalRange: '0.5 to 20.0' };
  }
  if (num < 0.5) return { value: 0.5, clamped: true, originalValue: raw, warning: 'Jn clamped to 0.5 (Massive, no or few joints).', theoreticalRange: '0.5 to 20.0' };
  if (num > 20.0) return { value: 20.0, clamped: true, originalValue: raw, warning: 'Jn clamped to 20.0 (Earthlike crushed rock).', theoreticalRange: '0.5 to 20.0' };
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0.5 to 20.0' };
}

/**
 * Clamps Barton Joint Roughness Number Jr (0.5 to 4.0)
 */
export function clampBartonJr(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 1.5, clamped: false, theoreticalRange: '0.5 to 4.0' };
  }
  if (num < 0.5) return { value: 0.5, clamped: true, originalValue: raw, warning: 'Jr clamped to 0.5 (Planar slickensided).', theoreticalRange: '0.5 to 4.0' };
  if (num > 4.0) return { value: 4.0, clamped: true, originalValue: raw, warning: 'Jr clamped to 4.0 (Discontinuous joints).', theoreticalRange: '0.5 to 4.0' };
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0.5 to 4.0' };
}

/**
 * Clamps Barton Joint Alteration Number Ja (0.75 to 20.0)
 */
export function clampBartonJa(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 1.0, clamped: false, theoreticalRange: '0.75 to 20.0' };
  }
  if (num < 0.75) return { value: 0.75, clamped: true, originalValue: raw, warning: 'Ja clamped to 0.75 (Tightly healed hard rock).', theoreticalRange: '0.75 to 20.0' };
  if (num > 20.0) return { value: 20.0, clamped: true, originalValue: raw, warning: 'Ja clamped to 20.0 (Thick continuous clay gouge).', theoreticalRange: '0.75 to 20.0' };
  return { value: Number(num.toFixed(2)), clamped: false, theoreticalRange: '0.75 to 20.0' };
}

/**
 * Clamps Barton Joint Water Reduction Factor Jw (0.05 to 1.0)
 */
export function clampBartonJw(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 1.0, clamped: false, theoreticalRange: '0.05 to 1.0' };
  }
  if (num < 0.05) return { value: 0.05, clamped: true, originalValue: raw, warning: 'Jw clamped to 0.05 (Exceptionally high inflow/pressure).', theoreticalRange: '0.05 to 1.0' };
  if (num > 1.0) return { value: 1.0, clamped: true, originalValue: raw, warning: 'Jw clamped to 1.0 (Dry excavations).', theoreticalRange: '0.05 to 1.0' };
  return { value: Number(num.toFixed(2)), clamped: false, theoreticalRange: '0.05 to 1.0' };
}

/**
 * Clamps Barton Stress Reduction Factor SRF (0.5 to 200.0)
 */
export function clampBartonSrf(raw: number | string | null | undefined): ClampedResult<number> {
  const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (raw === null || raw === undefined || isNaN(num)) {
    return { value: 1.0, clamped: false, theoreticalRange: '0.5 to 200.0' };
  }
  if (num < 0.5) return { value: 0.5, clamped: true, originalValue: raw, warning: 'SRF clamped to 0.5 (Competent medium stress).', theoreticalRange: '0.5 to 200.0' };
  if (num > 200.0) return { value: 200.0, clamped: true, originalValue: raw, warning: 'SRF clamped to 200.0 (Heavy swelling/squeezing).', theoreticalRange: '0.5 to 200.0' };
  return { value: Number(num.toFixed(1)), clamped: false, theoreticalRange: '0.5 to 200.0' };
}

