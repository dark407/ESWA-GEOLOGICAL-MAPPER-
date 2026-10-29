// ============================================================================
// ESWA GEOLOGICAL DISCONTINUITY SUITE — PERMANENT CORE DEPRECATION REGISTRY
// ============================================================================
// Protocol: When a feature or UI element is removed "from core" or "entirely"
// by the user, it MUST be purged completely across:
// 1. Component UI & JSX trees
// 2. State definitions and reducer/hook actions
// 3. Type interfaces and calculation engines
// 4. Autonomous data feeders and synthetic generators
//
// Registered entries in this file serve as an immutable ledger to prevent
// autonomous reappearance or accidental restoration in subsequent turns.
// ============================================================================

export interface PurgedFeatureRecord {
  id: string;
  name: string;
  category: 'UI_ELEMENT' | 'CALCULATION_ENGINE' | 'STATE_PROPERTY' | 'AUTONOMOUS_FEEDER';
  purgedDate: string;
  reason: string;
  prohibitedBehaviors: string[];
}

export const PERMANENTLY_PURGED_FEATURES: PurgedFeatureRecord[] = [
  {
    id: 'AUTONOMOUS_SYNTHETIC_DATA_FEEDERS',
    name: 'Autonomous / Phantom Geotechnical Data Synthesis',
    category: 'AUTONOMOUS_FEEDER',
    purgedDate: '2026-10-29',
    reason: 'Violates scientific rock mechanics integrity: user must provide real field inputs or outputs remain strictly locked.',
    prohibitedBehaviors: [
      'Generating fallback RMR (e.g. 58) when user has not completed RMR',
      'Generating fallback Barton Q (e.g. 5.5) when user has not completed Q',
      'Manufacturing phantom regional faults (e.g. F-01 Shear Zone) on unmapped faces',
      'Manufacturing synthetic historical blast rounds when fewer than 2 rounds are logged',
      'Assuming phantom 65°/135° joint orientations when no discontinuities are traced',
    ],
  },
  {
    id: 'UNVALIDATED_CALCULATION_EXECUTION',
    name: 'Unchecked Geotechnical Calculations on Out-of-Bounds Inputs',
    category: 'CALCULATION_ENGINE',
    purgedDate: '2026-10-29',
    reason: 'Rejected impossible rock mechanics values (e.g. dip > 90°, friction > 65°, negative UCS/spacing).',
    prohibitedBehaviors: [
      'Running kinematic wedge FoS or Hoek-Brown on non-orthogonal or out-of-bounds dip/dipDirection',
      'Displaying passing FoS when geometry or friction angle violate physical laws',
    ],
  },
];

/**
 * Checks if a feature id is marked as permanently purged from the application core.
 */
export function isFeaturePurged(featureId: string): boolean {
  return PERMANENTLY_PURGED_FEATURES.some(
    (f) => f.id.toLowerCase() === featureId.toLowerCase()
  );
}

/**
 * Throws or warns in development if any code attempts to invoke or re-instantiate
 * a purged core feature.
 */
export function assertFeatureNotPurged(featureId: string): void {
  const record = PERMANENTLY_PURGED_FEATURES.find(
    (f) => f.id.toLowerCase() === featureId.toLowerCase()
  );
  if (record) {
    console.error(
      `[CORE PURGE VIOLATION]: Attempted to invoke purged feature "${record.name}" (${record.id}). This feature has been permanently purged from core on ${record.purgedDate}. Reason: ${record.reason}`
    );
  }
}
