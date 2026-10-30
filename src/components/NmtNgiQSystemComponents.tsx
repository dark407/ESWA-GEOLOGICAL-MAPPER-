import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  Info,
  Layers,
  Shield,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  FieldExcavationRound,
  FieldSupportSystemConfig,
  FieldTunnelLocationItem,
  getLocationSurfaceConfig,
  FIELD_NMT_ROCK_CLASSES,
  FieldNmtClassItem,
  getNmtRockClassFromQ,
} from '../engine/fieldMappingEngine';

// ============================================================================
// NMT — NORWEGIAN METHOD OF TUNNELLING & NGI Q-SYSTEM TABLES (TABLE 1 & TABLE 2)
// Authoritative Reference: Barton, Lien & Lunde (1974), Grimstad & Barton (1993), NGI (2014)
// ============================================================================

export interface NgiTableRowOption {
  code: string;
  categoryGroup?: string;
  description: string;
  value: number;
  valueRangeLabel: string;
  selectableValues?: number[];
  subMeta1?: string; // e.g. phi_r or pw or sigma_c/sigma_1
  subMeta2?: string; // e.g. sigma_theta/sigma_c
  note?: string;
}

export const NGI_TABLE1_RQD_ROWS: NgiTableRowOption[] = [
  {
    code: 'A',
    description: 'Very poor ( > 27 joints per m³ )',
    value: 10,
    valueRangeLabel: '0 – 25%',
    selectableValues: [10, 15, 20, 25],
    note: 'Where RQD is reported or measured as ≤ 10 (including 0), a nominal value of 10 is used to evaluate Q.',
  },
  {
    code: 'B',
    description: 'Poor ( 20–27 joints per m³ )',
    value: 35,
    valueRangeLabel: '25 – 50%',
    selectableValues: [30, 35, 40, 45, 50],
  },
  {
    code: 'C',
    description: 'Fair ( 13–19 joints per m³ )',
    value: 60,
    valueRangeLabel: '50 – 75%',
    selectableValues: [55, 60, 65, 70, 75],
  },
  {
    code: 'D',
    description: 'Good ( 8–12 joints per m³ )',
    value: 80,
    valueRangeLabel: '75 – 90%',
    selectableValues: [75, 80, 85, 90],
  },
  {
    code: 'E',
    description: 'Excellent ( 0–7 joints per m³ )',
    value: 95,
    valueRangeLabel: '90 – 100%',
    selectableValues: [90, 95, 100],
  },
];

export const NGI_TABLE1_JN_ROWS: NgiTableRowOption[] = [
  {
    code: 'A',
    description: 'Massive, no or few joints',
    value: 0.5,
    valueRangeLabel: '0.5 – 1.0',
    selectableValues: [0.5, 0.75, 1.0],
  },
  {
    code: 'B',
    description: 'One joint set',
    value: 2.0,
    valueRangeLabel: '2.0',
  },
  {
    code: 'C',
    description: 'One joint set plus random joints',
    value: 3.0,
    valueRangeLabel: '3.0',
  },
  {
    code: 'D',
    description: 'Two joint sets',
    value: 4.0,
    valueRangeLabel: '4.0',
  },
  {
    code: 'E',
    description: 'Two joint sets plus random joints',
    value: 6.0,
    valueRangeLabel: '6.0',
  },
  {
    code: 'F',
    description: 'Three joint sets',
    value: 9.0,
    valueRangeLabel: '9.0',
  },
  {
    code: 'G',
    description: 'Three joint sets plus random joints',
    value: 12.0,
    valueRangeLabel: '12.0',
  },
  {
    code: 'H',
    description: 'Four or more joint sets, random, heavily jointed, "sugar cube", etc.',
    value: 15.0,
    valueRangeLabel: '15.0',
  },
  {
    code: 'J',
    description: 'Crushed rock, earthlike',
    value: 20.0,
    valueRangeLabel: '20.0',
  },
];

export const NGI_TABLE1_JR_ROWS: NgiTableRowOption[] = [
  // Category a & b: Rock-wall contact, and rock-wall contact before 10 cm shear
  {
    code: 'A',
    categoryGroup: 'ab',
    description: 'Discontinuous joints',
    value: 4.0,
    valueRangeLabel: '4.0',
  },
  {
    code: 'B',
    categoryGroup: 'ab',
    description: 'Rough or irregular, undulating',
    value: 3.0,
    valueRangeLabel: '3.0',
  },
  {
    code: 'C',
    categoryGroup: 'ab',
    description: 'Smooth, undulating',
    value: 2.0,
    valueRangeLabel: '2.0',
  },
  {
    code: 'D',
    categoryGroup: 'ab',
    description: 'Slickensided, undulating',
    value: 1.5,
    valueRangeLabel: '1.5',
  },
  {
    code: 'E',
    categoryGroup: 'ab',
    description: 'Rough or irregular, planar',
    value: 1.5,
    valueRangeLabel: '1.5',
  },
  {
    code: 'F',
    categoryGroup: 'ab',
    description: 'Smooth, planar',
    value: 1.0,
    valueRangeLabel: '1.0',
  },
  {
    code: 'G',
    categoryGroup: 'ab',
    description: 'Slickensided, planar (lineations oriented for minimum strength)',
    value: 0.5,
    valueRangeLabel: '0.5',
  },
  // Category c: No rock-wall contact when sheared
  {
    code: 'H',
    categoryGroup: 'c',
    description: 'Zone containing clay minerals thick enough to prevent rock-wall contact',
    value: 1.0,
    valueRangeLabel: '1.0 (nominal)',
  },
  {
    code: 'J',
    categoryGroup: 'c',
    description: 'Sandy, gravelly or crushed zone thick enough to prevent rock-wall contact',
    value: 1.0,
    valueRangeLabel: '1.0 (nominal)',
  },
];

export const NGI_TABLE1_JA_ROWS: NgiTableRowOption[] = [
  // Category a: Rock-wall contact (no mineral fillings, only coatings)
  {
    code: 'A',
    categoryGroup: 'a',
    description: 'Tightly healed, hard, non-softening, impermeable filling, i.e., quartz or epidote',
    value: 0.75,
    valueRangeLabel: '0.75',
    subMeta1: '—',
  },
  {
    code: 'B',
    categoryGroup: 'a',
    description: 'Unaltered joint walls, surface staining only',
    value: 1.0,
    valueRangeLabel: '1.0',
    subMeta1: 'φr ≈ 25–35°',
  },
  {
    code: 'C',
    categoryGroup: 'a',
    description: 'Slightly altered joint walls. Non-softening mineral coatings, sandy particles, clay-free disintegrated rock, etc.',
    value: 2.0,
    valueRangeLabel: '2.0',
    subMeta1: 'φr ≈ 25–30°',
  },
  {
    code: 'D',
    categoryGroup: 'a',
    description: 'Silty- or sandy-clay coatings, small clay fraction (non-softening)',
    value: 3.0,
    valueRangeLabel: '3.0',
    subMeta1: 'φr ≈ 20–25°',
  },
  {
    code: 'E',
    categoryGroup: 'a',
    description: 'Softening or low friction clay mineral coatings, i.e., kaolinite or mica. Also chlorite, talc, gypsum, graphite, etc., and small quantities of swelling clays',
    value: 4.0,
    valueRangeLabel: '4.0',
    subMeta1: 'φr ≈ 8–16°',
  },
  // Category b: Rock-wall contact before 10 cm shear (thin mineral fillings < 5 mm)
  {
    code: 'F',
    categoryGroup: 'b',
    description: 'Sandy particles, clay-free disintegrated rock, etc.',
    value: 4.0,
    valueRangeLabel: '4.0',
    subMeta1: 'φr ≈ 25–30°',
  },
  {
    code: 'G',
    categoryGroup: 'b',
    description: 'Strongly over-consolidated non-softening clay mineral fillings (continuous, but < 5 mm thickness)',
    value: 6.0,
    valueRangeLabel: '6.0',
    subMeta1: 'φr ≈ 16–24°',
  },
  {
    code: 'H',
    categoryGroup: 'b',
    description: 'Medium or low over-consolidation, softening, clay mineral fillings (continuous, but < 5 mm thickness)',
    value: 8.0,
    valueRangeLabel: '8.0',
    subMeta1: 'φr ≈ 12–16°',
  },
  {
    code: 'J',
    categoryGroup: 'b',
    description: 'Swelling-clay fillings, i.e., montmorillonite (continuous, but < 5 mm thickness). Depends on % of swelling clay-size particles & water access',
    value: 10.0,
    valueRangeLabel: '8 – 12',
    selectableValues: [8.0, 10.0, 12.0],
    subMeta1: 'φr ≈ 6–12°',
  },
  // Category c: No rock-wall contact when sheared (thick mineral fillings)
  {
    code: 'K',
    categoryGroup: 'c',
    description: 'Zones or bands of disintegrated or crushed rock and strongly over-consolidated clay (see G)',
    value: 6.0,
    valueRangeLabel: '6.0',
    subMeta1: 'φr ≈ 16–24°',
  },
  {
    code: 'L',
    categoryGroup: 'c',
    description: 'Zones or bands of disintegrated or crushed rock and medium/low over-consolidation softening clay (see H)',
    value: 8.0,
    valueRangeLabel: '8.0',
    subMeta1: 'φr ≈ 12–16°',
  },
  {
    code: 'M',
    categoryGroup: 'c',
    description: 'Zones or bands of disintegrated or crushed rock and swelling clay (see J)',
    value: 10.0,
    valueRangeLabel: '8 – 12',
    selectableValues: [8.0, 10.0, 12.0],
    subMeta1: 'φr ≈ 6–12°',
  },
  {
    code: 'N',
    categoryGroup: 'c',
    description: 'Zones or bands of silty- or sandy-clay, small clay fraction (non-softening)',
    value: 5.0,
    valueRangeLabel: '5.0',
    subMeta1: '—',
  },
  {
    code: 'O',
    categoryGroup: 'c',
    description: 'Thick, continuous zones or bands of strongly over-consolidated clay (see G)',
    value: 10.0,
    valueRangeLabel: '10.0',
    subMeta1: 'φr ≈ 16–24°',
  },
  {
    code: 'P',
    categoryGroup: 'c',
    description: 'Thick, continuous zones or bands of medium/low over-consolidation softening clay (see H)',
    value: 13.0,
    valueRangeLabel: '13.0',
    subMeta1: 'φr ≈ 12–16°',
  },
  {
    code: 'R',
    categoryGroup: 'c',
    description: 'Thick, continuous zones or bands of swelling clay (see J)',
    value: 16.0,
    valueRangeLabel: '13 – 20',
    selectableValues: [13.0, 15.0, 18.0, 20.0],
    subMeta1: 'φr ≈ 6–12°',
  },
];

export const NGI_TABLE1_JW_ROWS: NgiTableRowOption[] = [
  {
    code: 'A',
    description: 'Dry excavations or minor inflow, i.e., < 5 l/min locally',
    value: 1.0,
    valueRangeLabel: '1.0',
    subMeta1: 'pw < 1 kg/cm²',
  },
  {
    code: 'B',
    description: 'Medium inflow or pressure, occasional outwash of joint fillings',
    value: 0.66,
    valueRangeLabel: '0.66',
    subMeta1: 'pw = 1 – 2.5 kg/cm²',
  },
  {
    code: 'C',
    description: 'Large inflow or high pressure in competent rock with unfilled joints',
    value: 0.5,
    valueRangeLabel: '0.5',
    subMeta1: 'pw = 2.5 – 10 kg/cm²',
  },
  {
    code: 'D',
    description: 'Large inflow or high pressure, considerable outwash of joint fillings',
    value: 0.33,
    valueRangeLabel: '0.33',
    subMeta1: 'pw = 2.5 – 10 kg/cm²',
  },
  {
    code: 'E',
    description: 'Exceptionally high inflow or water pressure at blasting, decaying with time (Note i: install drainage)',
    value: 0.15,
    valueRangeLabel: '0.2 – 0.1',
    selectableValues: [0.2, 0.15, 0.1],
    subMeta1: 'pw > 10 kg/cm²',
  },
  {
    code: 'F',
    description: 'Exceptionally high inflow or water pressure continuing without noticeable decay (Note i: install drainage)',
    value: 0.05,
    valueRangeLabel: '0.1 – 0.05',
    selectableValues: [0.1, 0.075, 0.05],
    subMeta1: 'pw > 10 kg/cm²',
  },
];

export const NGI_TABLE1_SRF_ROWS: NgiTableRowOption[] = [
  // Category a: Weakness zones intersecting excavation, which may cause loosening of rock mass
  {
    code: 'A',
    categoryGroup: 'a',
    description: 'Multiple occurrences of weakness zones containing clay or chemically disintegrated rock, very loose surrounding rock (any depth)',
    value: 10.0,
    valueRangeLabel: '10.0',
  },
  {
    code: 'B',
    categoryGroup: 'a',
    description: 'Single weakness zones containing clay or chemically disintegrated rock (depth of excavation ≤ 50 m)',
    value: 5.0,
    valueRangeLabel: '5.0',
  },
  {
    code: 'C',
    categoryGroup: 'a',
    description: 'Single weakness zones containing clay or chemically disintegrated rock (depth of excavation > 50 m)',
    value: 2.5,
    valueRangeLabel: '2.5',
  },
  {
    code: 'D',
    categoryGroup: 'a',
    description: 'Multiple shear zones in competent rock (clay-free), loose surrounding rock (any depth)',
    value: 7.5,
    valueRangeLabel: '7.5',
  },
  {
    code: 'E',
    categoryGroup: 'a',
    description: 'Single shear zones in competent rock (clay-free), depth of excavation ≤ 50 m',
    value: 5.0,
    valueRangeLabel: '5.0',
  },
  {
    code: 'F',
    categoryGroup: 'a',
    description: 'Single shear zones in competent rock (clay-free), depth of excavation > 50 m',
    value: 2.5,
    valueRangeLabel: '2.5',
  },
  {
    code: 'G',
    categoryGroup: 'a',
    description: 'Loose, open joints, heavily jointed or "sugar cube", etc. (any depth)',
    value: 5.0,
    valueRangeLabel: '5.0',
  },
  // Category b: Competent rock, rock stress problems
  {
    code: 'H',
    categoryGroup: 'b',
    description: 'Low stress, near surface, open joints',
    value: 2.5,
    valueRangeLabel: '2.5',
    subMeta1: 'σc/σ1 > 200',
    subMeta2: 'σθ/σc < 0.01',
  },
  {
    code: 'J',
    categoryGroup: 'b',
    description: 'Medium stress, favourable stress condition',
    value: 1.0,
    valueRangeLabel: '1.0',
    subMeta1: 'σc/σ1 = 200 – 10',
    subMeta2: 'σθ/σc = 0.01 – 0.3',
  },
  {
    code: 'K',
    categoryGroup: 'b',
    description: 'High stress, very tight structure. Usually favourable to stability, may be unfavourable for wall stability',
    value: 1.0,
    valueRangeLabel: '0.5 – 2',
    selectableValues: [0.5, 1.0, 1.5, 2.0],
    subMeta1: 'σc/σ1 = 10 – 5',
    subMeta2: 'σθ/σc = 0.3 – 0.4',
  },
  {
    code: 'L',
    categoryGroup: 'b',
    description: 'Moderate slabbing after > 1 hour in massive rock',
    value: 15.0,
    valueRangeLabel: '5 – 50',
    selectableValues: [5.0, 15.0, 25.0, 50.0],
    subMeta1: 'σc/σ1 = 5 – 3',
    subMeta2: 'σθ/σc = 0.5 – 0.65',
  },
  {
    code: 'M',
    categoryGroup: 'b',
    description: 'Slabbing and rock burst after a few minutes in massive rock',
    value: 100.0,
    valueRangeLabel: '50 – 200',
    selectableValues: [50.0, 100.0, 150.0, 200.0],
    subMeta1: 'σc/σ1 = 3 – 2',
    subMeta2: 'σθ/σc = 0.65 – 1.0',
  },
  {
    code: 'N',
    categoryGroup: 'b',
    description: 'Heavy rock burst (strain-burst) and immediate dynamic deformations in massive rock',
    value: 250.0,
    valueRangeLabel: '200 – 400',
    selectableValues: [200.0, 300.0, 400.0],
    subMeta1: 'σc/σ1 < 2',
    subMeta2: 'σθ/σc > 1.0',
  },
  // Category c: Squeezing rock: plastic flow of incompetent rock under high rock pressure
  {
    code: 'O',
    categoryGroup: 'c',
    description: 'Mild squeezing rock pressure',
    value: 7.5,
    valueRangeLabel: '5 – 10',
    selectableValues: [5.0, 7.5, 10.0],
    subMeta2: 'σθ/σc = 1 – 5',
  },
  {
    code: 'P',
    categoryGroup: 'c',
    description: 'Heavy squeezing rock pressure',
    value: 15.0,
    valueRangeLabel: '10 – 20',
    selectableValues: [10.0, 15.0, 20.0],
    subMeta2: 'σθ/σc > 5',
  },
  // Category d: Swelling rock: chemical swelling activity depending on presence of water
  {
    code: 'R',
    categoryGroup: 'd',
    description: 'Mild swelling rock pressure',
    value: 7.5,
    valueRangeLabel: '5 – 10',
    selectableValues: [5.0, 7.5, 10.0],
  },
  {
    code: 'S',
    categoryGroup: 'd',
    description: 'Heavy swelling rock pressure',
    value: 12.5,
    valueRangeLabel: '10 – 15',
    selectableValues: [10.0, 12.5, 15.0],
  },
];

export interface NgiTable2EsrOption {
  code: 'A' | 'B' | 'C' | 'D' | 'E';
  description: string;
  esrDefault: number;
  esrRangeLabel: string;
  selectableValues: number[];
}

export const NGI_TABLE2_ESR_ROWS: NgiTable2EsrOption[] = [
  {
    code: 'A',
    description: 'Temporary mine openings, etc.',
    esrDefault: 3.5,
    esrRangeLabel: 'ca. 3 – 5',
    selectableValues: [3.0, 3.5, 4.0, 5.0],
  },
  {
    code: 'B',
    description: 'Permanent mine openings, water tunnels for hydro power (exclude high pressure penstocks), pilot tunnels, drifts and headings for large openings',
    esrDefault: 1.6,
    esrRangeLabel: '1.6',
    selectableValues: [1.6],
  },
  {
    code: 'C',
    description: 'Storage rooms, water treatment plants, minor road and railway tunnels, surge chambers, access tunnels, etc.',
    esrDefault: 1.3,
    esrRangeLabel: '1.3',
    selectableValues: [1.3],
  },
  {
    code: 'D',
    description: 'Power stations, major road and railway tunnels, civil defence chambers, portals, intersections',
    esrDefault: 1.0,
    esrRangeLabel: '1.0',
    selectableValues: [1.0],
  },
  {
    code: 'E',
    description: 'Underground nuclear power stations, railway stations, sports and public facilities, factories',
    esrDefault: 0.8,
    esrRangeLabel: '0.8',
    selectableValues: [0.8],
  },
];

export interface NgiSupportPrescription {
  categoryNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  categoryCode: string;
  categoryTitle: string;
  rockMassClassCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  rockMassClassLabel: string;
  boltType: 'none' | 'spot_bolts' | 'systematic_bolts';
  boltLengthM: number;
  boltSpacingInShotcreteM: number | null;
  boltSpacingOutsideShotcreteM: number | null;
  shotcreteType: 'none' | 'unreinforced' | 'Sfr';
  shotcreteThicknessCmRange: string;
  shotcreteThicknessMm: number;
  energyAbsorptionClass: 'None' | 'E500' | 'E500–E700' | 'E700' | 'E700–E1000' | 'E1000';
  rrsClass: 'None' | 'RRS I' | 'RRS II' | 'RRS III' | 'CCA (Cast Concrete Arch)';
  rrsSpec: string;
  rrsSpacingM: number | null;
}

/**
 * Computes Q_wall from Q_roof per NGI (Grimstad & Barton 1993):
 * - For Q > 10: Q_wall = 5.0 * Q
 * - For 0.1 <= Q <= 10: Q_wall = 2.5 * Q
 * - For Q < 0.1: Q_wall = 1.0 * Q
 */
export function computeNgiWallQValue(qRoof: number): {
  qWall: number;
  multiplier: number;
  ruleLabel: string;
} {
  if (qRoof > 10) {
    return {
      qWall: Number(Math.min(1000, qRoof * 5.0).toFixed(3)),
      multiplier: 5.0,
      ruleLabel: 'Q > 10 → Qwall = 5.0 × Q',
    };
  }
  if (qRoof >= 0.1) {
    return {
      qWall: Number((qRoof * 2.5).toFixed(3)),
      multiplier: 2.5,
      ruleLabel: '0.1 ≤ Q ≤ 10 → Qwall = 2.5 × Q',
    };
  }
  return {
    qWall: Number((qRoof * 1.0).toFixed(3)),
    multiplier: 1.0,
    ruleLabel: 'Q < 0.1 → Qwall = 1.0 × Q',
  };
}

export function getNgiRockMassClass(q: number): {
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  shortTitle: string;
  fullTitle: string;
} {
  if (q >= 400) {
    return { code: 'A', shortTitle: 'Exc. Good', fullTitle: 'Class A — Exceptionally Good (400 ≤ Q ≤ 1000)' };
  }
  if (q >= 100) {
    return { code: 'B', shortTitle: 'Ext. Good', fullTitle: 'Class B — Extremely Good (100 ≤ Q < 400)' };
  }
  if (q >= 40) {
    return { code: 'C', shortTitle: 'Very Good', fullTitle: 'Class C — Very Good (40 ≤ Q < 100)' };
  }
  if (q >= 10) {
    return { code: 'D', shortTitle: 'Good', fullTitle: 'Class D — Good Rock (10 ≤ Q < 40)' };
  }
  if (q >= 4) {
    return { code: 'E', shortTitle: 'Fair', fullTitle: 'Class E — Fair Rock (4 ≤ Q < 10)' };
  }
  if (q >= 1) {
    return { code: 'F', shortTitle: 'Poor', fullTitle: 'Class F — Poor Rock (1 ≤ Q < 4)' };
  }
  if (q >= 0.1) {
    return { code: 'G', shortTitle: 'Very Poor', fullTitle: 'Class G — Very Poor Rock (0.1 ≤ Q < 1)' };
  }
  if (q >= 0.01) {
    return { code: 'H', shortTitle: 'Ext. Poor', fullTitle: 'Class H — Extremely Poor Rock (0.01 ≤ Q < 0.1)' };
  }
  return { code: 'I', shortTitle: 'Exc. Poor', fullTitle: 'Class I — Exceptionally Poor Rock (0.001 ≤ Q < 0.01)' };
}

/**
 * Evaluates the Grimstad & Barton (1993) / NGI (2014) Figure 1 Support Chart boundaries
 * for any (Q, De) coordinate pair.
 */
export function evaluateNgiChartSupportCategory(
  qVal: number,
  deVal: number,
  spanOrHeightM: number,
  esrVal: number
): NgiSupportPrescription {
  const q = Math.max(0.001, Math.min(1000, qVal));
  const de = Math.max(1.0, Math.min(100, deVal));
  const logQ = Math.log10(q);

  // Bolt length formula: L = 2 + 0.15 * B / ESR (which equals 2 + 0.15 * De)
  const boltLengthM = Number(Math.max(1.8, Math.min(15.0, 2.0 + 0.15 * (spanOrHeightM / Math.max(0.5, esrVal)))).toFixed(1));

  // Digitized boundary curves from Figure 1: NGI Rock Support Chart (Grimstad & Barton 1993)
  // De_no_support(Q): boundary between Category 1 (Unsupported) and Category 2/3
  const deLimitCat1 = 2.0 * Math.pow(q, 0.42);
  // Boundary between Category 2 (Spot bolting, sb) and Category 3 (Systematic bolting, B)
  const deLimitCat2 = 3.2 * Math.pow(q, 0.40);

  // Bolt spacing interpolation from top axis of Figure 1
  let spacingInSfr = 1.5;
  let spacingOutSfr = 2.0;
  if (q >= 100) {
    spacingInSfr = 2.5;
    spacingOutSfr = 4.0;
  } else if (q >= 40) {
    spacingInSfr = 2.5;
    spacingOutSfr = 3.0;
  } else if (q >= 10) {
    spacingInSfr = 2.3;
    spacingOutSfr = 2.5;
  } else if (q >= 4) {
    spacingInSfr = 2.0;
    spacingOutSfr = 2.0;
  } else if (q >= 1) {
    spacingInSfr = 1.7;
    spacingOutSfr = 1.7;
  } else if (q >= 0.4) {
    spacingInSfr = 1.5;
    spacingOutSfr = 1.5;
  } else if (q >= 0.1) {
    spacingInSfr = 1.3;
    spacingOutSfr = 1.3;
  } else if (q >= 0.01) {
    spacingInSfr = 1.2;
    spacingOutSfr = 1.2;
  } else {
    spacingInSfr = 1.0;
    spacingOutSfr = 1.0;
  }

  const rmClass = getNgiRockMassClass(q);

  // Category 1: Unsupported
  if (de <= deLimitCat1 && q >= 1.0) {
    return {
      categoryNumber: 1,
      categoryCode: 'Cat. 1',
      categoryTitle: '1. Unsupported',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'none',
      boltLengthM,
      boltSpacingInShotcreteM: null,
      boltSpacingOutsideShotcreteM: null,
      shotcreteType: 'none',
      shotcreteThicknessCmRange: '0 cm',
      shotcreteThicknessMm: 0,
      energyAbsorptionClass: 'None',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Category 2: Spot bolting, sb
  if (de <= deLimitCat2 && q >= 4.0) {
    return {
      categoryNumber: 2,
      categoryCode: 'Cat. 2 (sb)',
      categoryTitle: '2. Spot bolting, sb',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'spot_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: null,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'none',
      shotcreteThicknessCmRange: '0 cm',
      shotcreteThicknessMm: 0,
      energyAbsorptionClass: 'None',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Category 3: Systematic bolting, B (and unreinforced shotcrete, 5-6 cm, B+S)
  if (q > 10 && de <= 35) {
    return {
      categoryNumber: 3,
      categoryCode: 'Cat. 3 (B / B+S)',
      categoryTitle: '3. Systematic bolting, B (and unreinforced shotcrete, 5–6 cm, B+S)',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: de > 12 ? 'unreinforced' : 'none',
      shotcreteThicknessCmRange: de > 12 ? '5 – 6 cm (local)' : '0 cm',
      shotcreteThicknessMm: de > 12 ? 50 : 0,
      energyAbsorptionClass: 'None',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Compute structural severity index on the NGI chart: combines log10(De) and -log10(Q)
  // On Figure 1, Sfr thickness contours (5cm, 6cm, 9cm, 12cm, 15cm, 25cm) slope upward from left to right.
  const chartSeverity = Math.log10(de) - 0.36 * logQ;

  // Category 4: Fibre reinforced shotcrete and bolting, 5–6 cm, Sfr+B (E=500 J)
  if (chartSeverity < 0.62 && q >= 1.0) {
    return {
      categoryNumber: 4,
      categoryCode: 'Cat. 4 (Sfr+B, 5–6 cm)',
      categoryTitle: '4. Fibre reinforced shotcrete and bolting, 5–6 cm, Sfr+B',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'Sfr',
      shotcreteThicknessCmRange: '5 – 6 cm',
      shotcreteThicknessMm: 60,
      energyAbsorptionClass: 'E500',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Category 5: Fibre reinforced shotcrete and bolting, 6–9 cm, Sfr+B (E=500–700 J)
  if (chartSeverity < 0.96 && q >= 0.4) {
    return {
      categoryNumber: 5,
      categoryCode: 'Cat. 5 (Sfr+B, 6–9 cm)',
      categoryTitle: '5. Fibre reinforced shotcrete and bolting, 6–9 cm, Sfr+B',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'Sfr',
      shotcreteThicknessCmRange: '6 – 9 cm',
      shotcreteThicknessMm: 80,
      energyAbsorptionClass: 'E700',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Category 6: Fibre reinforced shotcrete and bolting, 9–12 cm, Sfr+B (E=700 J)
  if (chartSeverity < 1.28 && q >= 0.1) {
    return {
      categoryNumber: 6,
      categoryCode: 'Cat. 6 (Sfr+B, 9–12 cm)',
      categoryTitle: '6. Fibre reinforced shotcrete and bolting, 9–12 cm, Sfr+B',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'Sfr',
      shotcreteThicknessCmRange: '9 – 12 cm',
      shotcreteThicknessMm: 100,
      energyAbsorptionClass: 'E700',
      rrsClass: 'None',
      rrsSpec: 'None',
      rrsSpacingM: null,
    };
  }

  // Category 7: Fibre reinforced shotcrete and bolting, 12–15 cm, Sfr+B (E=700–1000 J)
  if (chartSeverity < 1.56 && q >= 0.04) {
    return {
      categoryNumber: 7,
      categoryCode: 'Cat. 7 (Sfr+B, 12–15 cm)',
      categoryTitle: '7. Fibre reinforced shotcrete and bolting, 12–15 cm, Sfr+B',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'Sfr',
      shotcreteThicknessCmRange: '12 – 15 cm',
      shotcreteThicknessMm: 150,
      energyAbsorptionClass: 'E1000',
      rrsClass: 'RRS I',
      rrsSpec: 'Si30/6 Ø16–Ø20 c/c 2.0–3.0 m (Single Layer 30 cm thick, 6 bars)',
      rrsSpacingM: 2.5,
    };
  }

  // Category 8: Fibre reinforced shotcrete, >15 cm, reinforced ribs of shotcrete and bolting, Sfr, RRS+B (E=1000 J)
  if (chartSeverity < 2.08 && q >= 0.004) {
    const isHeavyRrs = chartSeverity >= 1.82 || q < 0.02;
    return {
      categoryNumber: 8,
      categoryCode: 'Cat. 8 (Sfr, RRS+B, >15 cm)',
      categoryTitle: '8. Fibre reinforced shotcrete >15 cm, reinforced ribs of shotcrete and bolting, Sfr, RRS+B',
      rockMassClassCode: rmClass.code,
      rockMassClassLabel: rmClass.fullTitle,
      boltType: 'systematic_bolts',
      boltLengthM,
      boltSpacingInShotcreteM: spacingInSfr,
      boltSpacingOutsideShotcreteM: spacingOutSfr,
      shotcreteType: 'Sfr',
      shotcreteThicknessCmRange: isHeavyRrs ? '20 – 25 cm' : '15 – 20 cm',
      shotcreteThicknessMm: isHeavyRrs ? 225 : 175,
      energyAbsorptionClass: 'E1000',
      rrsClass: isHeavyRrs ? 'RRS II' : 'RRS I',
      rrsSpec: isHeavyRrs
        ? 'D45/6+2 Ø16–20 c/c 1.5–2.0 m (Double Layer 45 cm thick)'
        : 'D40/6+2 Ø16–20 c/c 2.0–3.0 m (Double Layer 40 cm thick)',
      rrsSpacingM: isHeavyRrs ? 1.5 : 2.0,
    };
  }

  // Category 9: Cast concrete lining, CCA (or Sfr+RRS III+B, >25 cm)
  return {
    categoryNumber: 9,
    categoryCode: 'Cat. 9 (CCA / RRS III)',
    categoryTitle: '9. Cast concrete lining, CCA (or Sfr >25 cm + RRS III + Bolting)',
    rockMassClassCode: rmClass.code,
    rockMassClassLabel: rmClass.fullTitle,
    boltType: 'systematic_bolts',
    boltLengthM,
    boltSpacingInShotcreteM: 1.0,
    boltSpacingOutsideShotcreteM: 1.0,
    shotcreteType: 'Sfr',
    shotcreteThicknessCmRange: '> 25 cm + CCA',
    shotcreteThicknessMm: 250,
    energyAbsorptionClass: 'E1000',
    rrsClass: 'RRS III',
    rrsSpec: 'D55/6+4 to D60/6+4 Ø20 c/c 1.0–1.5 m + Cast Concrete Arch (CCA)',
    rrsSpacingM: 1.0,
  };
}

// ============================================================================
// PART 1: NMT — ADVANCED NGI Q-INDEX WORKBENCH (FOR CLASSIFICATIONS STAGE)
// ============================================================================
export const NmtAdvancedNgiQWorkbench: React.FC<{
  activeLocation?: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
  onContinueToSupport?: () => void;
}> = ({ activeLocation, activeRound, onUpdateRound, onContinueToSupport }) => {
  const qSys = activeRound.qSystem || ({} as FieldExcavationRound['qSystem']);
  const surf = useMemo(
    () =>
      activeLocation
        ? getLocationSurfaceConfig(activeLocation)
        : { tunnelW: 8.5, tunnelH: 7.2, splHeightM: 4.5 },
    [activeLocation]
  );

  const spanW = Math.max(1.5, surf.tunnelW || activeLocation?.widthM || 8.5);
  const heightH = Math.max(1.5, surf.tunnelH || activeLocation?.heightM || 7.2);

  const esrVal = qSys.esrValue ?? 1.0;
  const esrCode = qSys.esrCategoryCode ?? 'D';
  const jnMultMode = qSys.jnMultiplierMode ?? 'normal';
  const jnMultFactor =
    jnMultMode === 'intersection_3x' ? 3.0 : jnMultMode === 'portal_2x' ? 2.0 : 1.0;
  const jrPlusOne = Boolean(qSys.jrSpacingPlusOne);

  // Active sub-category tabs for Jr, Ja, SRF
  const [jrCatFilter, setJrCatFilter] = useState<'all' | 'ab' | 'c'>('all');
  const [jaCatFilter, setJaCatFilter] = useState<'all' | 'a' | 'b' | 'c'>('all');
  const [srfCatFilter, setSrfCatFilter] = useState<'all' | 'a' | 'b' | 'c' | 'd'>('all');

  const updateQSystemPatch = (
    patch: Partial<FieldExcavationRound['qSystem']>,
    rowCodePatch?: Partial<NonNullable<FieldExcavationRound['qSystem']['selectedRowCodes']>>
  ) => {
    onUpdateRound((r) => {
      const prevQ = r.qSystem || ({} as FieldExcavationRound['qSystem']);
      const nextCodes = rowCodePatch
        ? { ...(prevQ.selectedRowCodes || {}), ...rowCodePatch }
        : prevQ.selectedRowCodes;
      return {
        ...r,
        qSystem: {
          ...prevQ,
          ...patch,
          ...(nextCodes ? { selectedRowCodes: nextCodes } : {}),
        },
      };
    });
  };

  // Handle Jn base selection + multiplier
  const handleSelectJn = (baseVal: number, code?: string) => {
    const effectiveJn = Number((baseVal * jnMultFactor).toFixed(2));
    updateQSystemPatch(
      {
        jnBase: baseVal,
        jn: effectiveJn,
      },
      code ? { jn: code } : undefined
    );
  };

  const handleSelectJnMultiplier = (mode: 'normal' | 'portal_2x' | 'intersection_3x') => {
    const mult = mode === 'intersection_3x' ? 3.0 : mode === 'portal_2x' ? 2.0 : 1.0;
    const baseJn =
      qSys.jnBase ??
      (qSys.jn !== null && qSys.jn !== undefined
        ? Number((qSys.jn / jnMultFactor).toFixed(2))
        : null);
    updateQSystemPatch({
      jnMultiplierMode: mode,
      ...(baseJn !== null ? { jnBase: baseJn, jn: Number((baseJn * mult).toFixed(2)) } : {}),
    });
  };

  // Handle Jr base selection + (>3m spacing +1.0 rule)
  const handleSelectJr = (baseVal: number, code?: string, catGroup?: string) => {
    const effectiveJr = Number((baseVal + (jrPlusOne ? 1.0 : 0)).toFixed(2));
    updateQSystemPatch(
      {
        jrBase: baseVal,
        jr: effectiveJr,
        ...(catGroup ? { jrCategory: catGroup === 'c' ? 'c' : 'a' } : {}),
      },
      code ? { jr: code } : undefined
    );
  };

  const handleToggleJrPlusOne = (checked: boolean) => {
    const baseJr =
      qSys.jrBase ??
      (qSys.jr !== null && qSys.jr !== undefined
        ? Math.max(0.5, Number((qSys.jr - (jrPlusOne ? 1.0 : 0)).toFixed(2)))
        : null);
    updateQSystemPatch({
      jrSpacingPlusOne: checked,
      ...(baseJr !== null ? { jrBase: baseJr, jr: Number((baseJr + (checked ? 1.0 : 0)).toFixed(2)) } : {}),
    });
  };

  // Calculate Quotients, Q_roof, Q_wall, De_roof, De_wall
  const calcSummary = useMemo(() => {
    const hasAll =
      qSys.rqd !== null &&
      qSys.rqd !== undefined &&
      qSys.jn !== null &&
      qSys.jn !== undefined &&
      qSys.jr !== null &&
      qSys.jr !== undefined &&
      qSys.ja !== null &&
      qSys.ja !== undefined &&
      qSys.jw !== null &&
      qSys.jw !== undefined &&
      qSys.srf !== null &&
      qSys.srf !== undefined;

    const effRqd =
      qSys.rqd !== null && qSys.rqd !== undefined ? Math.max(10, Math.min(100, Number(qSys.rqd))) : null;
    const quotient1 =
      effRqd !== null && qSys.jn && qSys.jn > 0 ? Number((effRqd / qSys.jn).toFixed(2)) : null;
    const quotient2 =
      qSys.jr !== null && qSys.jr !== undefined && qSys.ja && qSys.ja > 0
        ? Number((qSys.jr / qSys.ja).toFixed(3))
        : null;
    const approxFrictionDeg =
      quotient2 !== null ? Number(((Math.atan(quotient2) * 180) / Math.PI).toFixed(1)) : null;
    const quotient3 =
      qSys.jw !== null && qSys.jw !== undefined && qSys.srf && qSys.srf > 0
        ? Number((qSys.jw / qSys.srf).toFixed(4))
        : null;

    const deRoof = Number((spanW / Math.max(0.5, esrVal)).toFixed(2));
    const deWall = Number((heightH / Math.max(0.5, esrVal)).toFixed(2));

    if (!hasAll || !quotient1 || !quotient2 || !quotient3) {
      return {
        hasAll: false,
        effRqd,
        quotient1,
        quotient2,
        approxFrictionDeg,
        quotient3,
        qRoof: null as number | null,
        qWallInfo: null as ReturnType<typeof computeNgiWallQValue> | null,
        deRoof,
        deWall,
        roofPrescription: null as NgiSupportPrescription | null,
        wallPrescription: null as NgiSupportPrescription | null,
      };
    }

    const rawQ = (effRqd! / qSys.jn) * (qSys.jr / qSys.ja) * (qSys.jw / qSys.srf);
    const qRoof = Number(Math.max(0.001, Math.min(1000, rawQ)).toFixed(3));
    const qWallInfo = computeNgiWallQValue(qRoof);
    const roofPrescription = evaluateNgiChartSupportCategory(qRoof, deRoof, spanW, esrVal);
    const wallPrescription = evaluateNgiChartSupportCategory(
      qWallInfo.qWall,
      deWall,
      heightH,
      esrVal
    );

    return {
      hasAll: true,
      effRqd,
      quotient1,
      quotient2,
      approxFrictionDeg,
      quotient3,
      qRoof,
      qWallInfo,
      deRoof,
      deWall,
      roofPrescription,
      wallPrescription,
    };
  }, [qSys, spanW, heightH, esrVal]);

  return (
    <div className="space-y-3 font-sans">
      {/* ==================== NMT MASTER FORMULA & 3-QUOTIENT INSTRUMENTATION HEADER ==================== */}
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-xl p-3.5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs tracking-wider uppercase shadow">
              NMT • NGI Q-SYSTEM
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400">
                Norwegian Method of Tunnelling — Advanced NGI Rock Mass Quality (Table 1 &amp; Table 2)
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Barton, Lien &amp; Lunde (1974) • Grimstad &amp; Barton (1993) • NGI (2014) Official Parameter Tables
              </p>
            </div>
          </div>

          {/* Live Q_roof and Q_wall Readouts */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-1.5 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Crown / Roof Q-Value
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-400">
                Q = {calcSummary.qRoof !== null ? calcSummary.qRoof : 'Not Assessed'}
              </div>
              <div className="text-[10px] font-bold text-emerald-400">
                {calcSummary.roofPrescription
                  ? `${calcSummary.roofPrescription.rockMassClassLabel} • ${calcSummary.roofPrescription.categoryCode}`
                  : 'Select all 6 NGI parameters below'}
              </div>
            </div>

            <div className="bg-slate-950 border border-cyan-500/50 rounded-xl px-3 py-1.5 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Wall Adjusted Q<sub>wall</sub>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-cyan-300">
                Q<sub>wall</sub> ={' '}
                {calcSummary.qWallInfo !== null ? calcSummary.qWallInfo.qWall : 'Not Assessed'}
              </div>
              <div className="text-[10px] font-mono text-sky-300">
                {calcSummary.qWallInfo
                  ? `${calcSummary.qWallInfo.ruleLabel} • ${calcSummary.wallPrescription?.categoryCode}`
                  : 'Auto-computed from Q_roof'}
              </div>
            </div>
          </div>
        </div>

        {/* 3 Physical Quotients Breakdown Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          {/* Quotient 1: RQD / Jn */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase text-amber-400">
                1. Block Size Quotient (RQD / J<sub>n</sub>)
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                RQD ({qSys.rqd ?? '—'}%
                {qSys.rqd !== null && qSys.rqd !== undefined && qSys.rqd <= 10 ? ' → nom. 10' : ''}
                ) / J<sub>n</sub> ({qSys.jn ?? '—'})
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-black text-amber-300">
                {calcSummary.quotient1 !== null ? calcSummary.quotient1 : '—'}
              </div>
              <div className="text-[9.5px] text-slate-500">Range: 200 – 0.5</div>
            </div>
          </div>

          {/* Quotient 2: Jr / Ja */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase text-cyan-400">
                2. Inter-Block Shear (J<sub>r</sub> / J<sub>a</sub>)
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                J<sub>r</sub> ({qSys.jr ?? '—'}) / J<sub>a</sub> ({qSys.ja ?? '—'})
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-black text-cyan-300">
                {calcSummary.quotient2 !== null ? calcSummary.quotient2 : '—'}
              </div>
              <div className="text-[9.5px] text-emerald-400">
                {calcSummary.approxFrictionDeg !== null
                  ? `tan⁻¹(Jr/Ja) ≈ ${calcSummary.approxFrictionDeg}°`
                  : 'Roughness / Coating'}
              </div>
            </div>
          </div>

          {/* Quotient 3: Jw / SRF */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase text-rose-400">
                3. Active Stress (J<sub>w</sub> / SRF)
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                J<sub>w</sub> ({qSys.jw ?? '—'}) / SRF ({qSys.srf ?? '—'})
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-black text-rose-300">
                {calcSummary.quotient3 !== null ? calcSummary.quotient3 : '—'}
              </div>
              <div className="text-[9.5px] text-slate-500">Water / Fault &amp; Stress</div>
            </div>
          </div>

          {/* Equivalent Dimension De = Span / ESR */}
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase text-emerald-400">
                4. Equivalent Dim. D<sub>e</sub> (Span / ESR)
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                W={spanW}m, H={heightH}m | ESR={esrVal}
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs font-black text-emerald-300">
                D<sub>e,roof</sub> = {calcSummary.deRoof} m
              </div>
              <div className="text-[10.5px] font-bold text-cyan-300">
                D<sub>e,wall</sub> = {calcSummary.deWall} m
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== NGI TABLE 1: 6 CORE PARAMETERS MATRIX ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ==================== PARAMETER 1: RQD ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
                1. RQD
              </span>
              <span className="text-xs font-black uppercase text-white">
                Rock Quality Designation (%)
              </span>
              {(qSys.rqd === null || qSys.rqd === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Exact RQD (%):</span>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={qSys.rqd ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    rqd: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-amber-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-amber-300 text-center"
              />
            </div>
          </div>

          {/* 5% Interval Quick Bar (Note ii: RQD intervals of 5, i.e. 100, 95, 90...) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>NGI Note ii: Select in 5% intervals (≤10% uses nominal RQD=10 in Q formula)</span>
              {qSys.rqd !== null && qSys.rqd !== undefined && (
                <span className="text-amber-300 font-bold">
                  Measured: {qSys.rqd}% → Effective RQD = {Math.max(10, qSys.rqd)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-11 gap-1">
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map(
                (pct) => {
                  const isSel = qSys.rqd !== null && qSys.rqd !== undefined && Number(qSys.rqd) === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => updateQSystemPatch({ rqd: pct })}
                      className={`py-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* NGI Table 1 RQD Rows A–E */}
          <div className="space-y-1">
            {NGI_TABLE1_RQD_ROWS.map((row) => {
              const isRowSelected =
                qSys.selectedRowCodes?.rqd === row.code ||
                (qSys.rqd !== null &&
                  qSys.rqd !== undefined &&
                  Math.abs(Number(qSys.rqd) - row.value) < 0.01);
              return (
                <div
                  key={row.code}
                  onClick={() => updateQSystemPatch({ rqd: row.value }, { rqd: row.code })}
                  className={`p-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-amber-400">
                      {row.code}
                    </span>
                    <span className="font-semibold">{row.description}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-mono text-slate-400">
                      {row.valueRangeLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 font-mono font-bold text-amber-300 text-[11px]">
                      {row.value}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800/80 rounded p-2">
            <strong>Notes:</strong> i) Where RQD is reported or measured as ≤ 10 (including 0), a nominal value of 10 is used to evaluate Q. ii) RQD intervals of 5, i.e., 100, 95, 90, etc., are sufficiently accurate.
          </div>
        </div>

        {/* ==================== PARAMETER 2: Jn (JOINT SET NUMBER) ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-black">
                2. J<sub>n</sub>
              </span>
              <span className="text-xs font-black uppercase text-white">
                Joint Set Number
              </span>
              {(qSys.jn === null || qSys.jn === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Effective J<sub>n</sub>:</span>
              <input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={qSys.jn ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    jn: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-amber-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-amber-300 text-center"
              />
            </div>
          </div>

          {/* NGI Note i & ii: Tunnel Intersection (3.0 x Jn) & Portal (2.0 x Jn) Multiplier Selector */}
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-lg p-2 space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-amber-300 flex items-center justify-between">
              <span>NGI Table 1 Notes i &amp; ii — Excavation Geometry Multiplier:</span>
              <span className="font-mono text-emerald-400">
                Active Multiplier: ×{jnMultFactor.toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'normal' as const, label: 'Normal Tunnel (1.0 × Jn)', mult: '1.0×' },
                { id: 'portal_2x' as const, label: 'Portal Zone (2.0 × Jn)', mult: '2.0×' },
                {
                  id: 'intersection_3x' as const,
                  label: 'Intersection (3.0 × Jn)',
                  mult: '3.0×',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectJnMultiplier(m.id)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                    jnMultMode === m.id
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* NGI Table 1 Jn Rows A–J */}
          <div className="space-y-1 max-h-[295px] overflow-y-auto pr-1">
            {NGI_TABLE1_JN_ROWS.map((row) => {
              const effectiveRowVal = Number((row.value * jnMultFactor).toFixed(2));
              const isRowSelected =
                qSys.selectedRowCodes?.jn === row.code ||
                (qSys.jn !== null &&
                  qSys.jn !== undefined &&
                  Math.abs(Number(qSys.jn) - effectiveRowVal) < 0.05);
              return (
                <div
                  key={row.code}
                  onClick={() => handleSelectJn(row.value, row.code)}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 shrink-0 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-amber-400">
                      {row.code}
                    </span>
                    <span className="truncate">{row.description}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {row.selectableValues ? (
                      row.selectableValues.map((sv) => {
                        const effSv = Number((sv * jnMultFactor).toFixed(2));
                        const svSelected =
                          qSys.jn !== null &&
                          qSys.jn !== undefined &&
                          Math.abs(Number(qSys.jn) - effSv) < 0.02;
                        return (
                          <button
                            key={sv}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleSelectJn(sv, row.code);
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold border cursor-pointer ${
                              svSelected
                                ? 'bg-amber-400 text-slate-950 border-white font-black'
                                : 'bg-slate-900 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {effSv}
                          </button>
                        );
                      })
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 font-mono font-bold text-amber-300 text-[11px]">
                        {effectiveRowVal}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800/80 rounded p-2">
            <strong>Notes:</strong> i) For tunnel intersections, use (3.0 × J<sub>n</sub>). ii) For portals, use (2.0 × J<sub>n</sub>).
          </div>
        </div>

        {/* ==================== PARAMETER 3: Jr (JOINT ROUGHNESS NUMBER) ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-black">
                3. J<sub>r</sub>
              </span>
              <span className="text-xs font-black uppercase text-white">
                Joint Roughness Number
              </span>
              {(qSys.jr === null || qSys.jr === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Effective J<sub>r</sub>:</span>
              <input
                type="number"
                min={0.5}
                max={5.0}
                step={0.5}
                value={qSys.jr ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    jr: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-cyan-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-cyan-300 text-center"
              />
            </div>
          </div>

          {/* Category Filter + Note ii (+1.0 for spacing > 3m) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {[
                { id: 'all' as const, label: 'All (a, b, c)' },
                { id: 'ab' as const, label: 'a & b) Wall Contact' },
                { id: 'c' as const, label: 'c) No Wall Contact' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setJrCatFilter(tab.id)}
                  className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer ${
                    jrCatFilter === tab.id
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-cyan-300 cursor-pointer">
              <input
                type="checkbox"
                checked={jrPlusOne}
                onChange={(e) => handleToggleJrPlusOne(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
              />
              <span>Note ii: Add +1.0 (Mean spacing &gt; 3 m)</span>
            </label>
          </div>

          {/* NGI Table 1 Jr Rows A–J */}
          <div className="space-y-1 max-h-[295px] overflow-y-auto pr-1">
            {NGI_TABLE1_JR_ROWS.filter(
              (r) => jrCatFilter === 'all' || r.categoryGroup === jrCatFilter
            ).map((row) => {
              const effVal = Number((row.value + (jrPlusOne ? 1.0 : 0)).toFixed(2));
              const isRowSelected =
                qSys.selectedRowCodes?.jr === row.code ||
                (qSys.jr !== null &&
                  qSys.jr !== undefined &&
                  Math.abs(Number(qSys.jr) - effVal) < 0.05 &&
                  (!qSys.selectedRowCodes?.jr || qSys.selectedRowCodes?.jr === row.code));
              return (
                <div
                  key={row.code}
                  onClick={() => handleSelectJr(row.value, row.code, row.categoryGroup)}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 shrink-0 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-cyan-400">
                      {row.code}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{row.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {row.categoryGroup === 'c'
                          ? 'c) No rock-wall contact when sheared'
                          : 'a/b) Rock-wall contact (or before 10 cm shear)'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 font-mono font-bold text-cyan-300 text-[11px] shrink-0">
                    {effVal}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800/80 rounded p-2">
            <strong>Notes:</strong> i) Descriptions refer to small-scale features and intermediate scale features, in that order. ii) Add 1.0 if the mean spacing of the relevant joint set is greater than 3 m. iii) J<sub>r</sub> = 0.5 can be used for planar, slickensided joints having lineations, provided the lineations are oriented for minimum strength.
          </div>
        </div>

        {/* ==================== PARAMETER 4: Ja (JOINT ALTERATION NUMBER) ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-black">
                4. J<sub>a</sub>
              </span>
              <span className="text-xs font-black uppercase text-white">
                Joint Alteration Number
              </span>
              {(qSys.ja === null || qSys.ja === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Selected J<sub>a</sub>:</span>
              <input
                type="number"
                min={0.75}
                max={20}
                step={0.25}
                value={qSys.ja ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    ja: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-cyan-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-cyan-300 text-center"
              />
            </div>
          </div>

          {/* Category Filter (a: Coatings, b: Thin fillings <5mm, c: Thick fillings no wall contact) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-1.5">
            {[
              { id: 'all' as const, label: 'All Categories (A–R)' },
              { id: 'a' as const, label: 'a) Wall Contact (A–E)' },
              { id: 'b' as const, label: 'b) Thin Filling <5mm (F–J)' },
              { id: 'c' as const, label: 'c) No Wall Contact (K–R)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJaCatFilter(tab.id)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer ${
                  jaCatFilter === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* NGI Table 1 Ja Rows A–R */}
          <div className="space-y-1 max-h-[295px] overflow-y-auto pr-1">
            {NGI_TABLE1_JA_ROWS.filter(
              (r) => jaCatFilter === 'all' || r.categoryGroup === jaCatFilter
            ).map((row) => {
              const isRowSelected =
                qSys.selectedRowCodes?.ja === row.code ||
                (!qSys.selectedRowCodes?.ja &&
                  qSys.ja !== null &&
                  qSys.ja !== undefined &&
                  Math.abs(Number(qSys.ja) - row.value) < 0.05);
              return (
                <div
                  key={row.code}
                  onClick={() =>
                    updateQSystemPatch(
                      { ja: row.value, jaCategory: row.categoryGroup as 'a' | 'b' | 'c' },
                      { ja: row.code }
                    )
                  }
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 shrink-0 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-cyan-400">
                      {row.code}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug">{row.description}</div>
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        Cat. {row.categoryGroup}) • {row.subMeta1}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {row.selectableValues ? (
                      row.selectableValues.map((sv) => {
                        const svSel =
                          isRowSelected &&
                          qSys.ja !== null &&
                          qSys.ja !== undefined &&
                          Math.abs(Number(qSys.ja) - sv) < 0.05;
                        return (
                          <button
                            key={sv}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              updateQSystemPatch(
                                { ja: sv, jaCategory: row.categoryGroup as 'a' | 'b' | 'c' },
                                { ja: row.code }
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold border cursor-pointer ${
                              svSel
                                ? 'bg-cyan-400 text-slate-950 border-white font-black'
                                : 'bg-slate-900 text-cyan-300 border-cyan-500/40'
                            }`}
                          >
                            {sv}
                          </button>
                        );
                      })
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 font-mono font-bold text-cyan-300 text-[11px]">
                        {row.value}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================== PARAMETER 5: Jw (JOINT WATER REDUCTION FACTOR) ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/50 text-sky-300 font-mono text-xs font-black">
                5. J<sub>w</sub>
              </span>
              <span className="text-xs font-black uppercase text-white">
                Joint Water Reduction Factor
              </span>
              {(qSys.jw === null || qSys.jw === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Selected J<sub>w</sub>:</span>
              <input
                type="number"
                min={0.05}
                max={1.0}
                step={0.05}
                value={qSys.jw ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    jw: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-sky-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-sky-300 text-center"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {NGI_TABLE1_JW_ROWS.map((row) => {
              const isRowSelected =
                qSys.selectedRowCodes?.jw === row.code ||
                (!qSys.selectedRowCodes?.jw &&
                  qSys.jw !== null &&
                  qSys.jw !== undefined &&
                  Math.abs(Number(qSys.jw) - row.value) < 0.02);
              return (
                <div
                  key={row.code}
                  onClick={() => updateQSystemPatch({ jw: row.value }, { jw: row.code })}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 shrink-0 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-sky-400">
                      {row.code}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug">{row.description}</div>
                      <div className="text-[10px] text-sky-300 font-mono mt-0.5">
                        Approx. water pressure: {row.subMeta1}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {row.selectableValues ? (
                      row.selectableValues.map((sv) => {
                        const svSel =
                          isRowSelected &&
                          qSys.jw !== null &&
                          qSys.jw !== undefined &&
                          Math.abs(Number(qSys.jw) - sv) < 0.01;
                        return (
                          <button
                            key={sv}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              updateQSystemPatch({ jw: sv }, { jw: row.code });
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold border cursor-pointer ${
                              svSel
                                ? 'bg-sky-400 text-slate-950 border-white font-black'
                                : 'bg-slate-900 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            {sv}
                          </button>
                        );
                      })
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-sky-500/40 font-mono font-bold text-sky-300 text-[11px]">
                        {row.value}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800/80 rounded p-2">
            <strong>Notes:</strong> i) Factors C to F are crude estimates. Increase J<sub>w</sub> if drainage measures are installed. ii) Special problems caused by ice formation are not considered.
          </div>
        </div>

        {/* ==================== PARAMETER 6: SRF (STRESS REDUCTION FACTOR) ==================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-300 font-mono text-xs font-black">
                6. SRF
              </span>
              <span className="text-xs font-black uppercase text-white">
                Stress Reduction Factor
              </span>
              {(qSys.srf === null || qSys.srf === undefined) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/70 text-amber-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Not Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono">Selected SRF:</span>
              <input
                type="number"
                min={0.5}
                max={400}
                step={0.5}
                value={qSys.srf ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateQSystemPatch({
                    srf: e.target.value === '' ? (null as any) : Number(e.target.value),
                  })
                }
                className="w-16 bg-slate-950 border border-rose-500/60 rounded px-2 py-0.5 text-xs font-mono font-black text-rose-300 text-center"
              />
            </div>
          </div>

          {/* SRF Category Filter (a: Weakness zones, b: Competent stress, c: Squeezing, d: Swelling) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-wrap items-center justify-between gap-1">
            {[
              { id: 'all' as const, label: 'All (A–S)' },
              { id: 'a' as const, label: 'a) Weakness Zones (A–G)' },
              { id: 'b' as const, label: 'b) Competent Stress (H–N)' },
              { id: 'c' as const, label: 'c) Squeezing (O–P)' },
              { id: 'd' as const, label: 'd) Swelling (R–S)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSrfCatFilter(tab.id)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer ${
                  srfCatFilter === tab.id
                    ? 'bg-rose-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* NGI Table 1 SRF Rows A–S */}
          <div className="space-y-1 max-h-[295px] overflow-y-auto pr-1">
            {NGI_TABLE1_SRF_ROWS.filter(
              (r) => srfCatFilter === 'all' || r.categoryGroup === srfCatFilter
            ).map((row) => {
              const isRowSelected =
                qSys.selectedRowCodes?.srf === row.code ||
                (!qSys.selectedRowCodes?.srf &&
                  qSys.srf !== null &&
                  qSys.srf !== undefined &&
                  Math.abs(Number(qSys.srf) - row.value) < 0.05);
              return (
                <div
                  key={row.code}
                  onClick={() =>
                    updateQSystemPatch(
                      { srf: row.value, srfCategory: row.categoryGroup as 'a' | 'b' | 'c' | 'd' },
                      { srf: row.code }
                    )
                  }
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isRowSelected
                      ? 'bg-rose-500/20 border-rose-400 text-white shadow'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 shrink-0 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-black text-[11px] text-rose-400">
                      {row.code}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug">{row.description}</div>
                      {(row.subMeta1 || row.subMeta2) && (
                        <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                          {[row.subMeta1, row.subMeta2].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {row.selectableValues ? (
                      row.selectableValues.map((sv) => {
                        const svSel =
                          isRowSelected &&
                          qSys.srf !== null &&
                          qSys.srf !== undefined &&
                          Math.abs(Number(qSys.srf) - sv) < 0.05;
                        return (
                          <button
                            key={sv}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              updateQSystemPatch(
                                {
                                  srf: sv,
                                  srfCategory: row.categoryGroup as 'a' | 'b' | 'c' | 'd',
                                },
                                { srf: row.code }
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold border cursor-pointer ${
                              svSel
                                ? 'bg-rose-400 text-slate-950 border-white font-black'
                                : 'bg-slate-900 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {sv}
                          </button>
                        );
                      })
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-rose-500/40 font-mono font-bold text-rose-300 text-[11px]">
                        {row.value}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 border border-slate-800/80 rounded p-2">
            <strong>Notes:</strong> i) Reduce these values of SRF by 25–50% if the relevant shear zones only influence but do not intersect the excavation. ii) For strongly anisotropic virgin stress field: when 5 ≤ σ<sub>1</sub>/σ<sub>3</sub> ≤ 10, reduce σ<sub>c</sub> to 0.75σ<sub>c</sub>; when σ<sub>1</sub>/σ<sub>3</sub> &gt; 10, reduce σ<sub>c</sub> to 0.5σ<sub>c</sub>.
          </div>
        </div>
      </div>

      {/* ==================== NGI TABLE 2: EXCAVATION SUPPORT RATIO (ESR) & EQUIVALENT DIMENSION De ==================== */}
      <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Table 2 — Excavation Support Ratio (ESR) &amp; Equivalent Dimension (D<sub>e</sub> = Span / ESR)
            </div>
            <p className="text-[11px] text-slate-400">
              Select the excavation category to determine ESR, Equivalent Dimension D<sub>e</sub>, and Wall Support Q<sub>wall</sub>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300">Custom ESR:</span>
            <input
              type="number"
              min={0.5}
              max={5.0}
              step={0.1}
              value={esrVal}
              onChange={(e) =>
                updateQSystemPatch({
                  esrValue: Math.max(0.5, Math.min(5.0, Number(e.target.value) || 1.0)),
                })
              }
              className="w-16 bg-slate-950 border border-emerald-500 rounded px-2 py-1 text-xs font-mono font-black text-emerald-300 text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {NGI_TABLE2_ESR_ROWS.map((row) => {
            const isSelected = esrCode === row.code || Math.abs(esrVal - row.esrDefault) < 0.05;
            return (
              <div
                key={row.code}
                onClick={() =>
                  updateQSystemPatch({
                    esrValue: row.esrDefault,
                    esrCategoryCode: row.code,
                    esrCategoryLabel: row.description,
                  })
                }
                className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/40 font-mono font-black text-emerald-300 text-[11px]">
                      Cat. {row.code}
                    </span>
                    <span className="font-mono font-black text-amber-300 text-xs">
                      ESR = {row.esrRangeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-200">{row.description}</p>
                </div>

                {row.selectableValues.length > 1 && (
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-800/80">
                    {row.selectableValues.map((sv) => (
                      <button
                        key={sv}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          updateQSystemPatch({
                            esrValue: sv,
                            esrCategoryCode: row.code,
                            esrCategoryLabel: row.description,
                          });
                        }}
                        className={`flex-1 py-0.5 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                          Math.abs(esrVal - sv) < 0.05
                            ? 'bg-emerald-400 text-slate-950 border-white font-black'
                            : 'bg-slate-900 text-emerald-300 border-slate-700'
                        }`}
                      >
                        {sv}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live NMT Support Preview Banner + Jump to Support System */}
        {calcSummary.hasAll && calcSummary.roofPrescription && calcSummary.wallPrescription && (
          <div className="bg-slate-950 border border-amber-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black uppercase text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  Prescribed NMT Support Category: {calcSummary.roofPrescription.categoryTitle}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                <strong>Crown/Roof (Q={calcSummary.qRoof}, De={calcSummary.deRoof}m):</strong>{' '}
                Bolts L={calcSummary.roofPrescription.boltLengthM}m @{' '}
                {calcSummary.roofPrescription.boltSpacingInShotcreteM ??
                  calcSummary.roofPrescription.boltSpacingOutsideShotcreteM ??
                  '—'}
                m | Sfr: {calcSummary.roofPrescription.shotcreteThicknessCmRange} (
                {calcSummary.roofPrescription.energyAbsorptionClass}) | RRS:{' '}
                {calcSummary.roofPrescription.rrsSpec}
              </div>
              <div className="text-[11px] font-mono text-cyan-300">
                <strong>
                  Walls (Q<sub>wall</sub>={calcSummary.qWallInfo?.qWall}, De={calcSummary.deWall}m):
                </strong>{' '}
                {calcSummary.wallPrescription.categoryCode} — Bolts L=
                {calcSummary.wallPrescription.boltLengthM}m @{' '}
                {calcSummary.wallPrescription.boltSpacingInShotcreteM ??
                  calcSummary.wallPrescription.boltSpacingOutsideShotcreteM ??
                  '—'}
                m | Sfr: {calcSummary.wallPrescription.shotcreteThicknessCmRange}
              </div>
            </div>

            {onContinueToSupport && (
              <button
                type="button"
                onClick={onContinueToSupport}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
              >
                View on NGI Q-Chart in Support System →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PART 2: INTERACTIVE NGI Q-SYSTEM ROCK SUPPORT CHART (FOR SUPPORT SYSTEM STAGE)
// Digitized Logarithmic Figure 1 (Grimstad & Barton, 1993 / NGI, 2014)
// ============================================================================
export const NgiQSupportChartInteractivePanel: React.FC<{
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  support: FieldSupportSystemConfig;
  onUpdateSupport: (patch: Partial<FieldSupportSystemConfig>) => void;
  onUpdateRound: (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => void;
}> = ({ activeLocation, activeRound, support, onUpdateSupport, onUpdateRound }) => {
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const surf = useMemo(() => getLocationSurfaceConfig(activeLocation), [activeLocation]);
  const spanW = Math.max(1.5, surf.tunnelW || activeLocation.widthM || 8.5);
  const heightH = Math.max(1.5, surf.tunnelH || activeLocation.heightM || 7.2);

  const qSys = activeRound.qSystem || ({} as FieldExcavationRound['qSystem']);
  const esrVal = qSys.esrValue ?? 1.0;

  // Evaluate Q_roof from activeRound.qSystem (if all 6 parameters are selected; otherwise allow interactive preview or show prompt)
  const hasCompleteQ =
    qSys.rqd !== null &&
    qSys.rqd !== undefined &&
    qSys.jn !== null &&
    qSys.jn !== undefined &&
    qSys.jr !== null &&
    qSys.jr !== undefined &&
    qSys.ja !== null &&
    qSys.ja !== undefined &&
    qSys.jw !== null &&
    qSys.jw !== undefined &&
    qSys.srf !== null &&
    qSys.srf !== undefined &&
    qSys.jn > 0 &&
    qSys.ja > 0 &&
    qSys.srf > 0;

  const qRoof = useMemo(() => {
    if (!hasCompleteQ) return null;
    const effRqd = Math.max(10, Math.min(100, Number(qSys.rqd)));
    const raw = (effRqd / qSys.jn) * (qSys.jr / qSys.ja) * (qSys.jw / qSys.srf);
    return Number(Math.max(0.001, Math.min(1000, raw)).toFixed(3));
  }, [hasCompleteQ, qSys]);

  const qWallInfo = useMemo(() => (qRoof !== null ? computeNgiWallQValue(qRoof) : null), [qRoof]);

  const deRoof = Number((spanW / Math.max(0.5, esrVal)).toFixed(2));
  const deWall = Number((heightH / Math.max(0.5, esrVal)).toFixed(2));

  const roofPrescription = useMemo(
    () => (qRoof !== null ? evaluateNgiChartSupportCategory(qRoof, deRoof, spanW, esrVal) : null),
    [qRoof, deRoof, spanW, esrVal]
  );

  const wallPrescription = useMemo(
    () =>
      qWallInfo !== null
        ? evaluateNgiChartSupportCategory(qWallInfo.qWall, deWall, heightH, esrVal)
        : null,
    [qWallInfo, deWall, heightH, esrVal]
  );

  // SVG Coordinate Mapping for Figure 1:
  // Chart plot box: X from 90 to 750 (width 660 px for log10(Q) from -3 to +3, i.e. 110 px per decade)
  // Y from 355 (De=1) to 65 (De=100) (height 290 px for log10(De) from 0 to 2, i.e. 145 px per decade)
  const plotX0 = 90;
  const plotX1 = 750;
  const plotW = plotX1 - plotX0; // 660
  const plotYBottom = 355; // De = 1
  const plotYTop = 65; // De = 100
  const plotH = plotYBottom - plotYTop; // 290

  const mapQToX = (q: number) => {
    const clamped = Math.max(0.001, Math.min(1000, q));
    const logQ = Math.log10(clamped); // -3 .. +3
    return plotX0 + ((logQ + 3) / 6) * plotW;
  };

  const mapDeToY = (de: number) => {
    const clamped = Math.max(1, Math.min(100, de));
    const logDe = Math.log10(clamped); // 0 .. 2
    return plotYBottom - (logDe / 2) * plotH;
  };

  // Build smooth SVG polyline paths for the NGI Chart boundary curves
  const buildCurvePath = (fnDeOfQ: (q: number) => number, qMin: number, qMax: number) => {
    const steps = 48;
    const logMin = Math.log10(qMin);
    const logMax = Math.log10(qMax);
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const lq = logMin + (i / steps) * (logMax - logMin);
      const q = Math.pow(10, lq);
      const de = fnDeOfQ(q);
      if (de >= 1.0 && de <= 100.0) {
        pts.push(`${mapQToX(q).toFixed(1)},${mapDeToY(de).toFixed(1)}`);
      }
    }
    return pts.length >= 2 ? `M ${pts.join(' L ')}` : '';
  };

  // Apply NMT Chart Prescription directly to Tunnel Support System
  const handleApplyNmtPrescriptionToTunnel = () => {
    if (!roofPrescription || !wallPrescription) return;

    const boltSpacing =
      roofPrescription.boltSpacingInShotcreteM ??
      roofPrescription.boltSpacingOutsideShotcreteM ??
      1.5;

    const isRrsOrCca =
      roofPrescription.categoryNumber >= 8 || roofPrescription.rrsClass !== 'None';

    const nmtClassItem = getNmtRockClassFromQ(qRoof);
    const mappedSupportClass: FieldSupportSystemConfig['supportClass'] = nmtClassItem.fullName;

    onUpdateSupport({
      supportClass: mappedSupportClass,
      rockClass: `${nmtClassItem.fullName} • NMT ${roofPrescription.categoryCode} (${roofPrescription.categoryTitle})`,
      rockBoltsEnabled: roofPrescription.boltType === 'systematic_bolts',
      spotBoltsEnabled: roofPrescription.boltType === 'spot_bolts' || support.spotBoltsEnabled,
      rockBoltScope:
        wallPrescription.boltType === 'systematic_bolts' ? 'crown_and_wall' : 'crown_only',
      rockBoltType: `NMT Grouted Rebar Dowel (L=${roofPrescription.boltLengthM}m)`,
      rockBoltLengthM: roofPrescription.boltLengthM,
      rockBoltInPlaneSpacingM: boltSpacing,
      rockBoltLongitudinalSpacingM: boltSpacing,
      shotcreteEnabled: roofPrescription.shotcreteType !== 'none',
      shotcreteScope:
        wallPrescription.shotcreteType !== 'none' ? 'crown_and_wall' : 'crown_only',
      shotcreteType: roofPrescription.shotcreteType === 'Sfr' ? 'SFRS' : 'Plain',
      shotcreteCrownThicknessMm: roofPrescription.shotcreteThicknessMm || 50,
      shotcreteWallThicknessMm: wallPrescription.shotcreteThicknessMm || 50,
      latticeGirderEnabled: isRrsOrCca,
      latticeGirderSpec: isRrsOrCca
        ? `${roofPrescription.rrsClass}: ${roofPrescription.rrsSpec}`
        : support.latticeGirderSpec,
      latticeGirderSpacingM: roofPrescription.rrsSpacingM || 1.5,
      ismbEnabled: roofPrescription.categoryNumber === 9,
      ismbSpec: roofPrescription.categoryNumber === 9 ? 'ISMB 200 / CCA Lining' : support.ismbSpec,
      ismbSpacingM: 1.0,
    });

    setAppliedBanner(
      `Applied ${nmtClassItem.fullName} • NMT ${roofPrescription.categoryCode}: Bolts L=${roofPrescription.boltLengthM}m @ ${boltSpacing}×${boltSpacing}m, Crown Sfr=${roofPrescription.shotcreteThicknessMm}mm (${roofPrescription.energyAbsorptionClass}), Wall Sfr=${wallPrescription.shotcreteThicknessMm}mm${
        roofPrescription.rrsClass !== 'None' ? `, ${roofPrescription.rrsClass} (${roofPrescription.rrsSpec})` : ''
      }`
    );
    setTimeout(() => setAppliedBanner(null), 5000);
  };

  return (
    <div className="bg-slate-900 border-2 border-amber-500/60 rounded-xl p-3 space-y-2.5 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-black text-[11px] uppercase tracking-wider">
            NGI Q-CHART
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-400">
              NMT — NGI Q-System Rock Support Chart (Grimstad &amp; Barton, 1993 / NGI, 2014)
            </div>
            <p className="text-[10.5px] text-slate-400 font-mono">
              Live logarithmic plotting of Roof (Q, D<sub>e</sub>) &amp; Wall (Q<sub>wall</sub>, D<sub>e,wall</sub>) across Reinforcement Categories 1–9, Sfr &amp; RRS I–III
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick ESR Selector inside Support Chart */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs">
            <span className="text-[10px] font-bold text-emerald-400 uppercase">ESR:</span>
            <select
              value={esrVal}
              onChange={(e) => {
                const nextEsr = Number(e.target.value) || 1.0;
                onUpdateRound((r) => ({
                  ...r,
                  qSystem: {
                    ...r.qSystem,
                    esrValue: nextEsr,
                  },
                }));
              }}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-emerald-300"
            >
              <option value={3.5}>3.5 (Cat A: Temp Mine)</option>
              <option value={1.6}>1.6 (Cat B: Water / Pilot)</option>
              <option value={1.3}>1.3 (Cat C: Minor Road/Rail)</option>
              <option value={1.0}>1.0 (Cat D: Major Tunnel/Portal)</option>
              <option value={0.8}>0.8 (Cat E: Station / Cavern)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
          >
            {isExpanded ? 'Collapse Chart ▲' : 'Expand NGI Chart ▼'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2.5">
          {/* High-Contrast Engineering Paper SVG Reproduction of Figure 1: The Q-System Rock Support Chart */}
          <div className="bg-white rounded-xl border-2 border-slate-800 p-1.5 overflow-x-auto">
            <svg viewBox="0 0 850 465" className="w-full h-auto min-w-[680px] block select-none">
              {/* Background Paper */}
              <rect x="0" y="0" width="850" height="465" fill="#ffffff" />

              {/* Top Bolt Spacing Header Band (Figure 1 Top Axis) */}
              <rect
                x={plotX0}
                y="8"
                width={plotW}
                height="36"
                fill="#f8fafc"
                stroke="#0f172a"
                strokeWidth="1.2"
              />
              <line
                x1={plotX0}
                y1="26"
                x2={plotX1}
                y2="26"
                stroke="#475569"
                strokeWidth="0.9"
              />
              <text
                x={plotX0 + 6}
                y="20"
                fontSize="8.2"
                fontWeight="800"
                fontFamily="IBM Plex Mono, monospace"
                fill="#0f172a"
              >
                Bolt spacing (m) in shotcrete area:
              </text>
              <text
                x={plotX0 + 6}
                y="38"
                fontSize="8.2"
                fontWeight="800"
                fontFamily="IBM Plex Mono, monospace"
                fill="#334155"
              >
                Bolt spacing (m) outside shotcrete area:
              </text>

              {/* Top Axis Bolt Spacing Tick Marks */}
              {[
                { q: 0.004, inSfr: '1.0 m', outSfr: '' },
                { q: 0.03, inSfr: '1.2 m', outSfr: '' },
                { q: 0.15, inSfr: '1.3 m', outSfr: '' },
                { q: 0.5, inSfr: '1.5 m', outSfr: '1.3 m' },
                { q: 1.8, inSfr: '1.7 m', outSfr: '1.5 m' },
                { q: 5.5, inSfr: '2.0 m', outSfr: '1.7 m' },
                { q: 15, inSfr: '2.3 m', outSfr: '2.0 m' },
                { q: 45, inSfr: '2.5 m', outSfr: '2.5 m' },
                { q: 130, inSfr: '', outSfr: '3.0 m' },
                { q: 400, inSfr: '', outSfr: '4.0 m' },
              ].map((sp, idx) => {
                const tx = mapQToX(sp.q);
                return (
                  <g key={idx}>
                    {sp.inSfr && (
                      <text
                        x={tx}
                        y="20"
                        textAnchor="middle"
                        fontSize="8.2"
                        fontWeight="900"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#0f172a"
                      >
                        {sp.inSfr}
                      </text>
                    )}
                    {sp.outSfr && (
                      <text
                        x={tx}
                        y="38"
                        textAnchor="middle"
                        fontSize="8.2"
                        fontWeight="800"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#1e40af"
                      >
                        {sp.outSfr}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Main Log-Log Plot Area Frame */}
              <rect
                x={plotX0}
                y={plotYTop}
                width={plotW}
                height={plotH}
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="1.6"
              />

              {/* Subtle Category Zone Shading inside Plot Area */}
              {/* Category 9 (Cast Concrete CCA, Top-Left Extreme Poor) */}
              <polygon
                points={`${plotX0},${plotYTop} ${mapQToX(0.15)},${plotYTop} ${plotX0},${mapDeToY(8)}`}
                fill="#fecdd3"
                fillOpacity="0.45"
              />
              {/* Category 8 (Sfr > 15cm + RRS + B) */}
              <polygon
                points={`${plotX0},${mapDeToY(8)} ${mapQToX(0.15)},${plotYTop} ${mapQToX(1.5)},${plotYTop} ${mapQToX(0.08)},${plotYBottom} ${plotX0},${plotYBottom}`}
                fill="#fde68a"
                fillOpacity="0.35"
              />
              {/* Category 4–7 (Fibre Reinforced Shotcrete Sfr + Bolting Band) */}
              <polygon
                points={`${mapQToX(0.08)},${plotYBottom} ${mapQToX(1.5)},${plotYTop} ${mapQToX(40)},${plotYTop} ${mapQToX(10)},${mapDeToY(8)} ${mapQToX(1.0)},${plotYBottom}`}
                fill="#e0f2fe"
                fillOpacity="0.4"
              />
              {/* Category 1 (Unsupported Bottom-Right) */}
              <polygon
                points={`${mapQToX(1.0)},${plotYBottom} ${mapQToX(40)},${mapDeToY(9.5)} ${mapQToX(1000)},${mapDeToY(36)} ${plotX1},${plotYBottom}`}
                fill="#dcfce7"
                fillOpacity="0.45"
              />

              {/* Logarithmic Vertical Gridlines (Q from 0.001 to 1000) */}
              {[0.001, 0.004, 0.01, 0.04, 0.1, 0.4, 1, 4, 10, 40, 100, 400, 1000].map((qTick) => {
                const x = mapQToX(qTick);
                const isMajor = [0.001, 0.01, 0.1, 1, 4, 10, 40, 100, 400, 1000].includes(qTick);
                return (
                  <g key={qTick}>
                    <line
                      x1={x}
                      y1={plotYTop}
                      x2={x}
                      y2={plotYBottom}
                      stroke={isMajor ? '#64748b' : '#cbd5e1'}
                      strokeWidth={isMajor ? '1.0' : '0.6'}
                      strokeDasharray={isMajor ? undefined : '3 3'}
                    />
                    <text
                      x={x}
                      y={plotYBottom + 13}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#0f172a"
                    >
                      {qTick}
                    </text>
                  </g>
                );
              })}

              {/* Logarithmic Horizontal Gridlines (De from 1 to 100) */}
              {[1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100].map((deTick) => {
                const y = mapDeToY(deTick);
                const isMajor = [1, 2, 5, 10, 20, 50, 100].includes(deTick);
                return (
                  <g key={deTick}>
                    <line
                      x1={plotX0}
                      y1={y}
                      x2={plotX1}
                      y2={y}
                      stroke={isMajor ? '#64748b' : '#cbd5e1'}
                      strokeWidth={isMajor ? '0.9' : '0.6'}
                      strokeDasharray={isMajor ? undefined : '3 3'}
                    />
                    <text
                      x={plotX0 - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="8.5"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#0f172a"
                    >
                      {deTick}
                    </text>
                  </g>
                );
              })}

              {/* Right Y-Axis: Bolt Length L (m) for ESR=1 */}
              {[
                { l: 2.4, de: 2.67 },
                { l: 3.0, de: 6.67 },
                { l: 4.0, de: 13.33 },
                { l: 5.0, de: 20.0 },
                { l: 6.0, de: 26.67 },
                { l: 7.0, de: 33.33 },
                { l: 8.0, de: 40.0 },
                { l: 10.0, de: 53.33 },
                { l: 12.0, de: 66.67 },
                { l: 15.0, de: 86.67 },
              ].map((bTick) => {
                const y = mapDeToY(bTick.de);
                return (
                  <g key={bTick.l}>
                    <line
                      x1={plotX1}
                      y1={y}
                      x2={plotX1 + 5}
                      y2={y}
                      stroke="#0f172a"
                      strokeWidth="1.2"
                    />
                    <text
                      x={plotX1 + 8}
                      y={y + 3}
                      textAnchor="start"
                      fontSize="8.5"
                      fontWeight="800"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#1e3a8a"
                    >
                      {bTick.l}m
                    </text>
                  </g>
                );
              })}

              {/* Digitized NGI Support Category Boundary Curves (Figure 1) */}
              {/* Curve 1: Unsupported Limit (Cat 1 / Cat 2-4) */}
              <path
                d={buildCurvePath((q) => 2.0 * Math.pow(q, 0.42), 0.4, 1000)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.0"
              />
              {/* Curve 2: Spot Bolting Limit (Cat 2 / Cat 3) */}
              <path
                d={buildCurvePath((q) => 3.2 * Math.pow(q, 0.40), 4.0, 400)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
              />
              {/* Curve 3: Sfr 5 cm boundary (Cat 3 / Cat 4) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 0.62 + 0.36 * Math.log10(q)), 1.0, 60)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.8"
              />
              {/* Curve 4: Sfr 6 cm boundary (Cat 4 / Cat 5) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 0.80 + 0.36 * Math.log10(q)), 0.4, 40)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
              />
              {/* Curve 5: Sfr 9 cm boundary (Cat 5 / Cat 6) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 0.96 + 0.36 * Math.log10(q)), 0.1, 20)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
              />
              {/* Curve 6: Sfr 12 cm boundary (Cat 6 / Cat 7) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 1.28 + 0.36 * Math.log10(q)), 0.04, 10)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
              />
              {/* Curve 7: Sfr 15 cm boundary (Cat 7 / Cat 8) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 1.56 + 0.36 * Math.log10(q)), 0.004, 4)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.8"
              />
              {/* Curve 8: Sfr 25 cm / CCA boundary (Cat 8 / Cat 9) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 2.08 + 0.36 * Math.log10(q)), 0.001, 0.5)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.0"
              />

              {/* Dashed RRS I, RRS II, RRS III Curves (Grimstad & Barton 1993) */}
              <path
                d={buildCurvePath((q) => Math.pow(10, 1.45 + 0.36 * Math.log10(q)), 0.01, 2.5)}
                fill="none"
                stroke="#7c2d12"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <path
                d={buildCurvePath((q) => Math.pow(10, 1.75 + 0.36 * Math.log10(q)), 0.003, 0.8)}
                fill="none"
                stroke="#7c2d12"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <path
                d={buildCurvePath((q) => Math.pow(10, 1.98 + 0.36 * Math.log10(q)), 0.001, 0.3)}
                fill="none"
                stroke="#7c2d12"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />

              {/* Support Category Numbers (Circles 1 to 9) & Thickness Callouts on Chart */}
              {[
                { cat: '1', q: 60, de: 2.2, label: 'Unsupported' },
                { cat: '2', q: 18, de: 5.5, label: 'sb' },
                { cat: '3', q: 22, de: 18, label: 'B (+S)' },
                { cat: '4', q: 3.2, de: 4.5, label: '5–6 cm (E500)' },
                { cat: '5', q: 1.4, de: 8.5, label: '6–9 cm (E700)' },
                { cat: '6', q: 0.45, de: 9.5, label: '9–12 cm (E700)' },
                { cat: '7', q: 0.14, de: 9.5, label: '12–15 cm (E1000)' },
                { cat: '8', q: 0.025, de: 12, label: '15–25 cm (RRS+B)' },
                { cat: '9', q: 0.004, de: 32, label: 'CCA (>25 cm)' },
              ].map((c) => {
                const cx = mapQToX(c.q);
                const cy = mapDeToY(c.de);
                return (
                  <g key={c.cat}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="9.5"
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth="1.6"
                    />
                    <text
                      x={cx}
                      y={cy + 3.5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#0f172a"
                    >
                      {c.cat}
                    </text>
                    <text
                      x={cx + 12}
                      y={cy + 3}
                      fontSize="7.8"
                      fontWeight="800"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#334155"
                    >
                      {c.label}
                    </text>
                  </g>
                );
              })}

              {/* Official RRS Rebar Spec Callout Boxes on Chart (Si30/6, D40/6+2, D45/6+2, D55/6+4) */}
              {[
                { q: 0.35, de: 24, tag: 'RRS I: Si30/6 c/c 2.0–3.5m' },
                { q: 0.06, de: 19, tag: 'RRS I: D40/6+2 c/c 1.5–2.5m' },
                { q: 0.015, de: 26, tag: 'RRS II: D45/6+2 c/c 1.5m' },
                { q: 0.005, de: 16, tag: 'RRS III: D55/6+4 c/c 1.0m' },
              ].map((rb, idx) => {
                const rx = mapQToX(rb.q);
                const ry = mapDeToY(rb.de);
                return (
                  <g key={idx} transform={`translate(${rx - 48}, ${ry - 7})`}>
                    <rect
                      x="0"
                      y="0"
                      width="104"
                      height="13"
                      rx="2"
                      fill="#fffbeb"
                      stroke="#92400e"
                      strokeWidth="0.9"
                    />
                    <text
                      x="52"
                      y="9.5"
                      textAnchor="middle"
                      fontSize="6.8"
                      fontWeight="800"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#78350f"
                    >
                      {rb.tag}
                    </text>
                  </g>
                );
              })}

              {/* Bottom Rock Mass Class Band — Authentic 9 NGI Rock Mass Quality Classes (Barton et al., 1974 / NGI 2014) */}
              {[
                { code: 'I', q0: 0.001, q1: 0.01, label: 'Exc. Poor', bg: '#ffe4e6', text: '#881337', stroke: '#e11d48' },
                { code: 'H', q0: 0.01, q1: 0.1, label: 'Ext. Poor', bg: '#fecaca', text: '#7f1d1d', stroke: '#b91c1c' },
                { code: 'G', q0: 0.1, q1: 1.0, label: 'Very Poor', bg: '#fee2e2', text: '#b91c1c', stroke: '#ef4444' },
                { code: 'F', q0: 1.0, q1: 4.0, label: 'Poor', bg: '#ffedd5', text: '#c2410c', stroke: '#f97316' },
                { code: 'E', q0: 4.0, q1: 10.0, label: 'Fair', bg: '#fef3c7', text: '#b45309', stroke: '#f59e0b' },
                { code: 'D', q0: 10.0, q1: 40.0, label: 'Good', bg: '#e0f2fe', text: '#0284c7', stroke: '#38bdf8' },
                { code: 'C', q0: 40.0, q1: 100.0, label: 'V. Good', bg: '#bae6fd', text: '#0369a1', stroke: '#0284c7' },
                { code: 'B', q0: 100.0, q1: 400.0, label: 'Ext. Good', bg: '#a7f3d0', text: '#047857', stroke: '#059669' },
                { code: 'A', q0: 400.0, q1: 1000.0, label: 'Exc. Good', bg: '#d1fae5', text: '#065f46', stroke: '#10b981' },
              ].map((cls) => {
                const x0 = mapQToX(cls.q0);
                const x1 = mapQToX(cls.q1);
                const w = x1 - x0;
                const isRoofIn =
                  qRoof !== null &&
                  qRoof >= cls.q0 &&
                  (cls.q1 === 1000 ? qRoof <= cls.q1 : qRoof < cls.q1);
                const isWallIn =
                  qWallInfo !== null &&
                  qWallInfo.qWall >= cls.q0 &&
                  (cls.q1 === 1000 ? qWallInfo.qWall <= cls.q1 : qWallInfo.qWall < cls.q1);
                return (
                  <g key={cls.code}>
                    <rect
                      x={x0}
                      y={plotYBottom + 18}
                      width={w}
                      height="23"
                      fill={isRoofIn ? cls.bg : '#f8fafc'}
                      stroke={isRoofIn ? cls.stroke : '#0f172a'}
                      strokeWidth={isRoofIn ? '2.0' : '1.0'}
                    />
                    <text
                      x={(x0 + x1) / 2}
                      y={plotYBottom + 33}
                      textAnchor="middle"
                      fontSize={w < 50 ? '7.5' : '8.2'}
                      fontWeight="900"
                      fontFamily="IBM Plex Mono, monospace"
                      fill={isRoofIn ? cls.text : '#0f172a'}
                    >
                      {cls.code} {w > 50 ? `(${cls.label})` : ''}
                    </text>
                    {isRoofIn && (
                      <path
                        d={`M ${(x0 + x1) / 2 - 4},${plotYBottom + 18} L ${(x0 + x1) / 2},${plotYBottom + 13} L ${(x0 + x1) / 2 + 4},${plotYBottom + 18} Z`}
                        fill="#dc2626"
                      />
                    )}
                    {isWallIn && (
                      <circle
                        cx={(x0 + x1) / 2}
                        cy={plotYBottom + 38}
                        r="2.5"
                        fill="#0284c7"
                      />
                    )}
                  </g>
                );
              })}

              {/* Secondary Bottom Axis: Q_wall Scale */}
              <text
                x={plotX0 - 8}
                y={plotYBottom + 56}
                textAnchor="end"
                fontSize="8.5"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#0369a1"
              >
                Qwall:
              </text>
              {[
                { qRoofPos: 0.001, qWallLabel: '0.001' },
                { qRoofPos: 0.01, qWallLabel: '0.01' },
                { qRoofPos: 0.1, qWallLabel: '0.25' },
                { qRoofPos: 1.0, qWallLabel: '2.5' },
                { qRoofPos: 4.0, qWallLabel: '10' },
                { qRoofPos: 10.0, qWallLabel: '50' },
                { qRoofPos: 40.0, qWallLabel: '200' },
                { qRoofPos: 100.0, qWallLabel: '500' },
              ].map((qw, idx) => (
                <text
                  key={idx}
                  x={mapQToX(qw.qRoofPos)}
                  y={plotYBottom + 56}
                  textAnchor="middle"
                  fontSize="8.0"
                  fontWeight="800"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#0369a1"
                >
                  {qw.qWallLabel}
                </text>
              ))}

              {/* Axis Titles */}
              <text
                x={(plotX0 + plotX1) / 2}
                y="450"
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#0f172a"
              >
                Rock Mass Quality Q = (RQD / Jn) × (Jr / Ja) × (Jw / SRF)
              </text>
              <text
                x="24"
                y={(plotYTop + plotYBottom) / 2}
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#0f172a"
                transform={`rotate(-90, 24, ${(plotYTop + plotYBottom) / 2})`}
              >
                Equivalent Dimension De = Span or Height (m) / ESR
              </text>
              <text
                x="826"
                y={(plotYTop + plotYBottom) / 2}
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fontFamily="IBM Plex Mono, monospace"
                fill="#1e3a8a"
                transform={`rotate(90, 826, ${(plotYTop + plotYBottom) / 2})`}
              >
                Bolt Length L (m) for ESR = 1
              </text>

              {/* ==================== LIVE PLOTTED ROOF (Q, De) & WALL (Qwall, De,wall) MARKERS ==================== */}
              {qRoof !== null && (
                <g>
                  {/* 1. WALL POINT (Qwall, De_wall) in Blue/Cyan */}
                  {qWallInfo && (
                    <g>
                      <line
                        x1={mapQToX(qWallInfo.qWall)}
                        y1={plotYTop}
                        x2={mapQToX(qWallInfo.qWall)}
                        y2={plotYBottom}
                        stroke="#0284c7"
                        strokeWidth="1.4"
                        strokeDasharray="4 3"
                      />
                      <line
                        x1={plotX0}
                        y1={mapDeToY(deWall)}
                        x2={plotX1}
                        y2={mapDeToY(deWall)}
                        stroke="#0284c7"
                        strokeWidth="1.4"
                        strokeDasharray="4 3"
                      />
                      <circle
                        cx={mapQToX(qWallInfo.qWall)}
                        cy={mapDeToY(deWall)}
                        r="7"
                        fill="#0284c7"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <rect
                        x={Math.min(plotX1 - 145, Math.max(plotX0 + 4, mapQToX(qWallInfo.qWall) + 10))}
                        y={Math.max(plotYTop + 4, mapDeToY(deWall) - 22)}
                        width="140"
                        height="18"
                        rx="3"
                        fill="#0284c7"
                      />
                      <text
                        x={
                          Math.min(plotX1 - 145, Math.max(plotX0 + 4, mapQToX(qWallInfo.qWall) + 10)) +
                          70
                        }
                        y={Math.max(plotYTop + 4, mapDeToY(deWall) - 22) + 12}
                        textAnchor="middle"
                        fontSize="8.2"
                        fontWeight="900"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#ffffff"
                      >
                        WALL: Qw={qWallInfo.qWall}, De={deWall}m
                      </text>
                    </g>
                  )}

                  {/* 2. CROWN / ROOF POINT (Q, De_roof) in Crimson/Amber */}
                  <line
                    x1={mapQToX(qRoof)}
                    y1={plotYTop}
                    x2={mapQToX(qRoof)}
                    y2={plotYBottom}
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    strokeDasharray="5 2.5"
                  />
                  <line
                    x1={plotX0}
                    y1={mapDeToY(deRoof)}
                    x2={plotX1}
                    y2={mapDeToY(deRoof)}
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    strokeDasharray="5 2.5"
                  />
                  <circle
                    cx={mapQToX(qRoof)}
                    cy={mapDeToY(deRoof)}
                    r="8.5"
                    fill="#dc2626"
                    stroke="#fef08a"
                    strokeWidth="2.5"
                  />
                  <circle cx={mapQToX(qRoof)} cy={mapDeToY(deRoof)} r="2.5" fill="#ffffff" />
                  <rect
                    x={Math.min(plotX1 - 155, Math.max(plotX0 + 4, mapQToX(qRoof) - 75))}
                    y={Math.min(plotYBottom - 24, mapDeToY(deRoof) + 10)}
                    width="150"
                    height="19"
                    rx="3"
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.min(plotX1 - 155, Math.max(plotX0 + 4, mapQToX(qRoof) - 75)) + 75}
                    y={Math.min(plotYBottom - 24, mapDeToY(deRoof) + 10) + 13}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="900"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#ffffff"
                  >
                    ROOF: Q={qRoof}, De={deRoof}m
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Prescribed NMT Support Schedule & One-Click Auto-Apply */}
          {qRoof !== null && roofPrescription && wallPrescription ? (
            <div className="bg-slate-950 border border-amber-500/50 rounded-xl p-3 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {/* Roof / Crown NMT Prescription */}
                <div className="bg-slate-900 border border-rose-500/40 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-rose-400">
                      ● Crown / Roof Prescription (Q = {qRoof}, D<sub>e</sub> = {deRoof}m)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 font-mono font-black text-rose-300 text-[11px]">
                      {roofPrescription.categoryCode}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white">
                    {roofPrescription.categoryTitle}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-300">
                    • <strong>Bolts:</strong> L = {roofPrescription.boltLengthM}m @{' '}
                    {roofPrescription.boltSpacingInShotcreteM
                      ? `${roofPrescription.boltSpacingInShotcreteM}m (in Sfr)`
                      : roofPrescription.boltSpacingOutsideShotcreteM
                      ? `${roofPrescription.boltSpacingOutsideShotcreteM}m (unshotcreted)`
                      : 'None'}
                  </div>
                  <div className="text-[10.5px] font-mono text-amber-300">
                    • <strong>Shotcrete (Sfr):</strong> {roofPrescription.shotcreteThicknessCmRange}{' '}
                    ({roofPrescription.shotcreteThicknessMm} mm) • Energy:{' '}
                    {roofPrescription.energyAbsorptionClass}
                  </div>
                  {roofPrescription.rrsClass !== 'None' && (
                    <div className="text-[10.5px] font-mono text-emerald-300">
                      • <strong>RRS / Ribs:</strong> {roofPrescription.rrsClass} —{' '}
                      {roofPrescription.rrsSpec}
                    </div>
                  )}
                </div>

                {/* Wall NMT Prescription */}
                <div className="bg-slate-900 border border-sky-500/40 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-sky-400">
                      ● Wall Prescription (Q<sub>wall</sub> = {qWallInfo?.qWall}, D<sub>e,wall</sub>{' '}
                      = {deWall}m)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/50 font-mono font-black text-sky-300 text-[11px]">
                      {wallPrescription.categoryCode}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-white">
                    {wallPrescription.categoryTitle}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-300">
                    • <strong>Wall Bolts:</strong> L = {wallPrescription.boltLengthM}m @{' '}
                    {wallPrescription.boltSpacingInShotcreteM
                      ? `${wallPrescription.boltSpacingInShotcreteM}m (in Sfr)`
                      : wallPrescription.boltSpacingOutsideShotcreteM
                      ? `${wallPrescription.boltSpacingOutsideShotcreteM}m`
                      : 'Spot / None'}
                  </div>
                  <div className="text-[10.5px] font-mono text-cyan-300">
                    • <strong>Wall Sfr:</strong> {wallPrescription.shotcreteThicknessCmRange} (
                    {wallPrescription.shotcreteThicknessMm} mm) • Energy:{' '}
                    {wallPrescription.energyAbsorptionClass}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono">
                  Reinforcement Categories 1–9 per Grimstad &amp; Barton (1993): E500 / E700 / E1000 toughness classes &amp; RRS I–III
                </span>
                <button
                  type="button"
                  onClick={handleApplyNmtPrescriptionToTunnel}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer transition-all"
                >
                  <Zap className="w-4 h-4" />
                  <span>Apply NMT Chart Support to Tunnel Drawing</span>
                </button>
              </div>

              {appliedBanner && (
                <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-bold">
                  ✓ {appliedBanner}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Info className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Complete all 6 NGI Q-System parameters (RQD, J<sub>n</sub>, J<sub>r</sub>, J<sub>a</sub>, J<sub>w</sub>, SRF) in the <strong>NMT — Norwegian Method of Tunnelling</strong> window to plot live Roof &amp; Wall coordinates on this chart.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
