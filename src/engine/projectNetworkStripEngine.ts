import { Point2D } from '../types/tunnel';
import {
  ContinuousPullRecord,
  ContinuousStripTrace,
  ContinuousTunnelStripDataset,
  getDefaultSheetConfig,
  SmoothRibbonSample,
} from './continuous3DStripEngine';

/**
 * Branch Dataset 1A: Construction Adit-2 intersecting Power Tunnel (HRT) at Ch. 268.0m on Right Wall
 */
export function createPowerTunnelAdit2Dataset(): ContinuousTunnelStripDataset {
  const pulls: ContinuousPullRecord[] = [
    {
      id: 'adit2-0-5',
      fromRd: 0,
      toRd: 5,
      driveAzimuthDeg: 75, // 85° turnout from HRT (160°N -> 075°N)
      gradientPct: 0.5,
      leftBoundaryAzimuthDeg: 255,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Very strong Quartzite at Adit-2 Junction Portal.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: '150 MPa',
      rmrValue: 56,
      rqdValue: 64,
      seepageCondition: 'DAMP',
      overbreakVolumeM3: 0.65,
      supportDescription: '15cm SFRS + Lattice Girder at Junction Collar + 4m Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-20',
    },
    {
      id: 'adit2-5-10',
      fromRd: 5,
      toRd: 10,
      driveAzimuthDeg: 75,
      gradientPct: 0.5,
      leftBoundaryAzimuthDeg: 255,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Medium grained Quartzite intersected by projected Shear Zone SZ-1.',
      rockClass: 'II',
      weatheringCondition: 'W2',
      ucsRangeMpa: '150 MPa',
      rmrValue: 52,
      rqdValue: 60,
      seepageCondition: 'WET',
      overbreakVolumeM3: 0.82,
      supportDescription: '10cm Wet Shotcrete + Wire Mesh + Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-21',
    },
    {
      id: 'adit2-10-15',
      fromRd: 10,
      toRd: 15,
      driveAzimuthDeg: 76, // 1° smooth curve turn
      gradientPct: 0.5,
      leftBoundaryAzimuthDeg: 256,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Reddish brown to grey very strong Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '160 MPa',
      rmrValue: 62,
      rqdValue: 74,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.3,
      supportDescription: '10cm Wet Shotcrete + Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-22',
    },
    {
      id: 'adit2-15-20',
      fromRd: 15,
      toRd: 20,
      driveAzimuthDeg: 76,
      gradientPct: 0.5,
      leftBoundaryAzimuthDeg: 256,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Massive to blocky Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1',
      ucsRangeMpa: '165 MPa',
      rmrValue: 65,
      rqdValue: 78,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.2,
      supportDescription: 'Spot Bolting + 5cm Shotcrete',
      status: 'MAPPED',
      dateMapped: '2003-03-23',
    },
  ];

  const traces: ContinuousStripTrace[] = [
    {
      id: 'adit2-sz1-cont',
      structureType: 'Shear Zone',
      setId: 'SZ-1',
      orientationLabel: '055/45',
      dipDirectionDeg: 55,
      dipDeg: 45,
      fillingThickness: '5~10cm',
      rawPoints: [
        { x: 2.2, y: 1.0 },
        { x: 5.0, y: 5.6 },
        { x: 5.4, y: 4.8 },
        { x: 11.5, y: 13.2 },
      ],
      aiAlignedPoints: [
        { x: 2.2, y: 1.0 },
        { x: 6.8, y: 7.1 },
        { x: 11.5, y: 13.2 },
      ],
      points: [
        { x: 2.2, y: 1.0 },
        { x: 6.8, y: 7.1 },
        { x: 11.5, y: 13.2 },
      ],
    },
    {
      id: 'adit2-js1-1',
      structureType: 'JS1 - Foliation',
      setId: 'JS1',
      orientationLabel: '050/50',
      dipDirectionDeg: 50,
      dipDeg: 50,
      fillingThickness: 'Clay Coated',
      rawPoints: [
        { x: 6.0, y: 13.5 },
        { x: 10.0, y: 7.8 },
        { x: 14.8, y: 1.2 },
      ],
      aiAlignedPoints: [
        { x: 6.0, y: 13.5 },
        { x: 10.4, y: 7.4 },
        { x: 14.8, y: 1.2 },
      ],
      points: [
        { x: 6.0, y: 13.5 },
        { x: 10.4, y: 7.4 },
        { x: 14.8, y: 1.2 },
      ],
    },
  ];

  return {
    id: 'dataset-power-tunnel-adit-2',
    projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
    tunnelLocationName: 'CONSTRUCTION ADIT-2 (BRANCH @ CH. 268m)',
    clientName: 'Nepal Electricity Authority',
    contractorName: 'DYWIDAG — DRAGADOS — CWE JV',
    geologistContractor: 'B. R. Mahtee',
    geologistClient: 'Dr. Gunasekara (FJV)',
    upperZoneLabel: 'ADIT LEFT WALL TO CROWN',
    lowerZoneLabel: 'ADIT CROWN TO RIGHT WALL',
    upperZoneWidthM: 7.0,
    lowerZoneWidthM: 7.0,
    tunnelDiameterWidthM: 5.2,
    tunnelArchHeightM: 5.2,
    viewFromRd: 0,
    viewToRd: 20,
    leftCornerAzimuthLabel: '255°N',
    rightCornerAzimuthLabel: '075°N',
    pulls,
    traces,
    lithologyZones: [],
    waterSymbols: [],
    narrativeBullets: [
      'CONSTRUCTION ADIT-2 INTERSECTS POWER TUNNEL (HRT) AT CH. 0+268.0m ON THE RIGHT WALL AT AZIMUTH N 075°.',
      'SHEAR ZONE SZ-1 (055/45) MAPPED IN HRT PROJECTS DIRECTLY INTO ADIT-2 BETWEEN CH. 2.2m AND 11.5m.',
    ],
    sheetConfig: getDefaultSheetConfig({
      projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
      tunnelLocationName: 'CONSTRUCTION ADIT-2 (BRANCH @ CH. 268m)',
    }),
    intersectionConfig: {
      parentDatasetId: 'dataset-power-tunnel-250-300',
      parentJunctionRd: 268,
      attachWall: 'RIGHT_WALL',
      ownJunctionRd: 0,
      portalWidthM: 5.2,
      junctionLabel: 'JUNCTION: ADIT-2 @ HRT Ch. 268.0m (Az N075°)',
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Branch Dataset 1B: Surge Tank Access Tunnel intersecting Power Tunnel (HRT) at Ch. 286.0m on Left Wall
 */
export function createPowerTunnelSurgeAccessDataset(): ContinuousTunnelStripDataset {
  const pulls: ContinuousPullRecord[] = [
    {
      id: 'surge-0-5',
      fromRd: 0,
      toRd: 5,
      driveAzimuthDeg: 245,
      gradientPct: 1.2,
      leftBoundaryAzimuthDeg: 65,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Strong Quartzite at Surge Tank Access Junction.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '155 MPa',
      rmrValue: 60,
      rqdValue: 70,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.4,
      supportDescription: '10cm Wet Shotcrete + Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-26',
    },
    {
      id: 'surge-5-10',
      fromRd: 5,
      toRd: 10,
      driveAzimuthDeg: 245,
      gradientPct: 1.2,
      leftBoundaryAzimuthDeg: 65,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Very strong Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1 - W2',
      ucsRangeMpa: '158 MPa',
      rmrValue: 63,
      rqdValue: 74,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.25,
      supportDescription: '10cm Wet Shotcrete + Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-27',
    },
    {
      id: 'surge-10-15',
      fromRd: 10,
      toRd: 15,
      driveAzimuthDeg: 244,
      gradientPct: 1.2,
      leftBoundaryAzimuthDeg: 64,
      rockType: 'Qtz - Quartzite',
      rockDescription: 'Very strong Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1',
      ucsRangeMpa: '160 MPa',
      rmrValue: 65,
      rqdValue: 77,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.15,
      supportDescription: '10cm Wet Shotcrete + Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2003-03-28',
    },
  ];

  const traces: ContinuousStripTrace[] = [
    {
      id: 'surge-js3-1',
      structureType: 'JS3 - Main Joint',
      setId: 'JS3',
      orientationLabel: '315/72',
      dipDirectionDeg: 315,
      dipDeg: 72,
      fillingThickness: 'Clay Coated',
      points: [
        { x: 1.5, y: 11.2 },
        { x: 7.5, y: 6.4 },
        { x: 13.5, y: 1.8 },
      ],
    },
  ];

  return {
    id: 'dataset-power-tunnel-surge-access',
    projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
    tunnelLocationName: 'SURGE TANK ACCESS TUNNEL (BRANCH @ CH. 286m)',
    clientName: 'Nepal Electricity Authority',
    contractorName: 'DYWIDAG — DRAGADOS — CWE JV',
    geologistContractor: 'B. R. Mahtee',
    geologistClient: 'Dr. Gunasekara (FJV)',
    upperZoneLabel: 'LEFT WALL TO CROWN',
    lowerZoneLabel: 'CROWN TO RIGHT WALL',
    upperZoneWidthM: 6.5,
    lowerZoneWidthM: 6.5,
    tunnelDiameterWidthM: 4.8,
    tunnelArchHeightM: 4.8,
    viewFromRd: 0,
    viewToRd: 15,
    leftCornerAzimuthLabel: '065°N',
    rightCornerAzimuthLabel: '245°N',
    pulls,
    traces,
    lithologyZones: [],
    waterSymbols: [],
    narrativeBullets: [
      'SURGE TANK ACCESS TUNNEL BRANCHES OFF POWER TUNNEL (HRT) LEFT WALL AT CH. 0+286.0m (AZIMUTH N 245°).',
    ],
    sheetConfig: getDefaultSheetConfig({
      projectName: 'MIDDLE MARSYANGDI HYDROELECTRIC PROJECT',
      tunnelLocationName: 'SURGE TANK ACCESS TUNNEL (BRANCH @ CH. 286m)',
    }),
    intersectionConfig: {
      parentDatasetId: 'dataset-power-tunnel-250-300',
      parentJunctionRd: 286,
      attachWall: 'LEFT_WALL',
      ownJunctionRd: 0,
      portalWidthM: 4.8,
      junctionLabel: 'JUNCTION: SURGE ACCESS @ HRT Ch. 286.0m (Az N245°)',
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Branch Dataset 2A: Gandikota Busduct Cross-Passage intersecting Powerhouse RHS Slashing at RD 16.0m
 */
export function createGandikotaBusductDataset(): ContinuousTunnelStripDataset {
  const pulls: ContinuousPullRecord[] = [
    {
      id: 'busduct-0-5',
      fromRd: 0,
      toRd: 5,
      driveAzimuthDeg: 160, // 90° perpendicular to Powerhouse Cavern (070°N -> 160°N)
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 340,
      rockType: 'QUARTZITE / Dolerite',
      rockDescription: 'Dolerite & Quartzite at Busduct-1 Portal Collar.',
      rockClass: 'II',
      weatheringCondition: 'W1-W2',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 63,
      rqdValue: 76,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.32,
      supportDescription: '150mm SFRS + SN Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2026-09-25',
    },
    {
      id: 'busduct-5-10',
      fromRd: 5,
      toRd: 10,
      driveAzimuthDeg: 160,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 340,
      rockType: 'Quartzite',
      rockDescription: 'Very strong Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 66,
      rqdValue: 81,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.21,
      supportDescription: '150mm SFRS + SN Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2026-09-26',
    },
    {
      id: 'busduct-10-15',
      fromRd: 10,
      toRd: 15,
      driveAzimuthDeg: 160,
      gradientPct: 0.1,
      leftBoundaryAzimuthDeg: 340,
      rockType: 'Quartzite',
      rockDescription: 'Very strong Quartzite.',
      rockClass: 'II',
      weatheringCondition: 'W1',
      ucsRangeMpa: '100~200 MPa',
      rmrValue: 68,
      rqdValue: 84,
      seepageCondition: 'DRY',
      overbreakVolumeM3: 0.18,
      supportDescription: '150mm SFRS + SN Rock Bolts',
      status: 'MAPPED',
      dateMapped: '2026-09-27',
    },
  ];

  const traces: ContinuousStripTrace[] = [
    {
      id: 'busduct-f1-proj',
      structureType: 'Fault',
      setId: 'F1',
      orientationLabel: '320/70-75',
      dipDirectionDeg: 320,
      dipDeg: 74,
      fillingThickness: '>10cm',
      points: [
        { x: 1.8, y: 2.0 },
        { x: 7.5, y: 7.2 },
        { x: 13.0, y: 12.1 },
      ],
    },
  ];

  return {
    id: 'dataset-gandikota-busduct-1',
    projectName: 'Gandikota Pumped Storage Project (Civil & Hydro-Mechanical Works)',
    tunnelLocationName: 'BUSDUCT TUNNEL-1 (INTERSECTS @ RD 16.0m)',
    clientName: 'adani',
    contractorName: 'RITHWIK',
    geologistContractor: 'Geologist - RPPL',
    geologistClient: 'Geologist - ADANI',
    upperZoneLabel: 'LEFT WALL & CROWN',
    lowerZoneLabel: 'RIGHT WALL',
    upperZoneWidthM: 7.0,
    lowerZoneWidthM: 7.0,
    tunnelDiameterWidthM: 5.5,
    tunnelArchHeightM: 5.5,
    viewFromRd: 0,
    viewToRd: 15,
    leftCornerAzimuthLabel: '340°N',
    rightCornerAzimuthLabel: '160°N',
    pulls,
    traces,
    lithologyZones: [],
    waterSymbols: [],
    narrativeBullets: [
      'BUSDUCT TUNNEL-1 INTERSECTS POWERHOUSE RHS SLASHING AT RD 16.0m AT 90° TURNOUT (AZIMUTH N 160°).',
    ],
    sheetConfig: getDefaultSheetConfig({
      projectName: 'Gandikota Pumped Storage Project (Civil & Hydro-Mechanical Works)',
      tunnelLocationName: 'BUSDUCT TUNNEL-1 (INTERSECTS @ RD 16.0m)',
    }),
    intersectionConfig: {
      parentDatasetId: 'dataset-gandikota-rhs-slashing',
      parentJunctionRd: 16,
      attachWall: 'RIGHT_WALL',
      ownJunctionRd: 0,
      portalWidthM: 5.5,
      junctionLabel: 'JUNCTION: BUSDUCT-1 @ RD 16.0m (Az N160°)',
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns user datasets without injecting pre-configured example branch tunnels
 */
export function ensureIntersectingBranchDatasets(
  datasets: ContinuousTunnelStripDataset[]
): ContinuousTunnelStripDataset[] {
  return [...datasets];
}

/**
 * Represents a positioned Tunnel Strip inside the Entire Project Multi-Tunnel Network Canvas
 */
export interface PositionedNetworkTunnelStrip {
  dataset: ContinuousTunnelStripDataset;
  isTrunk: boolean;
  totalPerimM: number;
  startRd: number;
  endRd: number;
  stripHeightPx: number;
  samples: SmoothRibbonSample[];
  mapRdPerimToSvg: (rd: number, perimM: number) => Point2D;
  /** If this is a branch tunnel, details of its intersection collar on the parent tunnel */
  junctionPortal?: {
    parentDatasetId: string;
    parentJunctionRd: number;
    attachWall: 'RIGHT_WALL' | 'LEFT_WALL' | 'PARALLEL_SEAM';
    portalCenterSvg: Point2D;
    portalCornersSvg: Point2D[];
    branchStartCenterSvg: Point2D;
    turnoutAngleDeg: number;
    label: string;
  };
}

export interface CrossTunnelAiProjection {
  id: string;
  setId: string;
  structureType: string;
  orientationLabel: string;
  fromTunnelName: string;
  toTunnelName: string;
  fromPtSvg: Point2D;
  toPtSvg: Point2D;
}

/**
 * Builds the 2D AutoCAD Model-Space Network Layout for all tunnels in the active project,
 * positioning intersecting branch tunnels at their exact parent chainage & turnout angle!
 */
export function buildProjectNetworkCanvasLayout(
  projectDatasets: ContinuousTunnelStripDataset[],
  pxPerRdM = 20
): {
  positionedStrips: PositionedNetworkTunnelStrip[];
  aiCrossProjections: CrossTunnelAiProjection[];
} {
  if (projectDatasets.length === 0) {
    return { positionedStrips: [], aiCrossProjections: [] };
  }

  // Identify Trunk Tunnel (dataset without intersectionConfig or whose parent isn't in projectDatasets)
  const trunkDataset =
    projectDatasets.find(
      (d) =>
        !d.intersectionConfig ||
        !projectDatasets.some((p) => p.id === d.intersectionConfig?.parentDatasetId)
    ) || projectDatasets[0];

  const buildStripSamples = (
    ds: ContinuousTunnelStripDataset,
    startX: number,
    startY: number,
    initialHeadingRad: number,
    stripHeightPx: number
  ): PositionedNetworkTunnelStrip => {
    const startRd = ds.viewFromRd;
    const endRd = Math.max(startRd + 5, ds.viewToRd);
    const totalPerimM = Math.max(6, ds.upperZoneWidthM + ds.lowerZoneWidthM);
    const stepM = 0.5;
    const spanM = endRd - startRd;
    const numSteps = Math.ceil(spanM / stepM) + 1;
    const baseAz = ds.pulls[0]?.driveAzimuthDeg ?? 160;

    const getRawAzAtRd = (rd: number): number => {
      if (ds.pulls.length === 0) return baseAz;
      for (const p of ds.pulls) {
        if (rd >= p.fromRd && rd <= p.toRd) return p.driveAzimuthDeg;
      }
      if (rd < ds.pulls[0].fromRd) return ds.pulls[0].driveAzimuthDeg;
      return ds.pulls[ds.pulls.length - 1].driveAzimuthDeg;
    };

    const getSmoothAzAtRd = (rd: number): number => {
      const r = 3.5;
      let sinSum = 0;
      let cosSum = 0;
      const samplesCount = 11;
      for (let i = -samplesCount; i <= samplesCount; i++) {
        const offsetRd = rd + (i / samplesCount) * r;
        const rawAz = getRawAzAtRd(offsetRd);
        const relDeg = ((((rawAz - baseAz) % 360) + 540) % 360) - 180;
        const relRad = (relDeg * Math.PI) / 180;
        const w = 0.5 * (1 + Math.cos((i / samplesCount) * Math.PI));
        sinSum += Math.sin(relRad) * w;
        cosSum += Math.cos(relRad) * w;
      }
      const meanRelRad = Math.atan2(sinSum, cosSum);
      const meanRelDeg = (meanRelRad * 180) / Math.PI;
      return baseAz + meanRelDeg;
    };

    const samples: SmoothRibbonSample[] = [];
    let curX = startX;
    let curY = startY;
    const minSafeRadiusPx = Math.max(stripHeightPx * 0.85, 160);
    const maxVisualBendRad = (35 * Math.PI) / 180;
    let currentAngleRad = initialHeadingRad;

    for (let i = 0; i < numSteps; i++) {
      const rd = Math.min(endRd, startRd + i * stepM);
      const smoothAz = getSmoothAzAtRd(rd);
      const deltaDeg = smoothAz - baseAz;
      const targetAngleRad =
        initialHeadingRad + maxVisualBendRad * Math.tanh((deltaDeg * 1.35) / 28);

      if (i === 0) {
        currentAngleRad = initialHeadingRad;
      } else {
        const prevRd = Math.min(endRd, startRd + (i - 1) * stepM);
        const dS = Math.max(0.5, (rd - prevRd) * pxPerRdM);
        const maxStepRad = dS / minSafeRadiusPx;
        const diffRad = targetAngleRad - currentAngleRad;
        const clampedStepRad = Math.max(-maxStepRad, Math.min(maxStepRad, diffRad));
        currentAngleRad += clampedStepRad;
      }

      const tx = Math.cos(currentAngleRad);
      const ty = Math.sin(currentAngleRad);
      const nx = -Math.sin(currentAngleRad);
      const ny = Math.cos(currentAngleRad);

      samples.push({
        rd,
        cx: curX,
        cy: curY,
        tx,
        ty,
        nx,
        ny,
        azimuthDeg: ((smoothAz % 360) + 360) % 360,
        deltaDeg,
      });

      if (i < numSteps - 1) {
        const nextRd = Math.min(endRd, startRd + (i + 1) * stepM);
        const dRd = nextRd - rd;
        curX += tx * dRd * pxPerRdM;
        curY += ty * dRd * pxPerRdM;
      }
    }

    const getSampleAtRd = (rd: number): SmoothRibbonSample => {
      const clamped = Math.max(startRd, Math.min(endRd, rd));
      const idxFloat = (clamped - startRd) / stepM;
      const i0 = Math.max(0, Math.min(samples.length - 1, Math.floor(idxFloat)));
      const i1 = Math.min(samples.length - 1, i0 + 1);
      const frac = idxFloat - i0;
      const s0 = samples[i0];
      const s1 = samples[i1];
      if (!s0) return samples[0];
      if (i0 === i1) return s0;
      return {
        rd: clamped,
        cx: s0.cx + (s1.cx - s0.cx) * frac,
        cy: s0.cy + (s1.cy - s0.cy) * frac,
        tx: s0.tx + (s1.tx - s0.tx) * frac,
        ty: s0.ty + (s1.ty - s0.ty) * frac,
        nx: s0.nx + (s1.nx - s0.nx) * frac,
        ny: s0.ny + (s1.ny - s0.ny) * frac,
        azimuthDeg: s0.azimuthDeg + (s1.azimuthDeg - s0.azimuthDeg) * frac,
        deltaDeg: s0.deltaDeg + (s1.deltaDeg - s0.deltaDeg) * frac,
      };
    };

    const mapRdPerimToSvg = (rd: number, perimM: number): Point2D => {
      const s = getSampleAtRd(rd);
      const normPerim = perimM / Math.max(1, totalPerimM) - 0.5;
      const offsetPx = normPerim * stripHeightPx;
      return {
        x: s.cx + s.nx * offsetPx,
        y: s.cy + s.ny * offsetPx,
      };
    };

    return {
      dataset: ds,
      isTrunk: ds.id === trunkDataset.id,
      totalPerimM,
      startRd,
      endRd,
      stripHeightPx,
      samples,
      mapRdPerimToSvg,
    };
  };

  // 1. Place Trunk Tunnel horizontally across the center of the Model-Space canvas
  const trunkStripHeightPx = 210;
  const trunkPositioned = buildStripSamples(
    trunkDataset,
    140,
    460,
    0, // 0 rad = horizontal left-to-right
    trunkStripHeightPx
  );

  const positionedStrips: PositionedNetworkTunnelStrip[] = [trunkPositioned];

  // 2. Place all Branch / Intersecting Tunnels relative to their Parent Tunnel Junction RD & Wall
  for (const ds of projectDatasets) {
    if (ds.id === trunkDataset.id) continue;
    const ic = ds.intersectionConfig;
    const parentPos =
      positionedStrips.find((p) => p.dataset.id === ic?.parentDatasetId) ||
      trunkPositioned;

    const jRd = ic
      ? Math.max(parentPos.startRd, Math.min(parentPos.endRd, ic.parentJunctionRd))
      : (parentPos.startRd + parentPos.endRd) * 0.5;
    const attachWall = ic?.attachWall || 'RIGHT_WALL';
    const portalW = ic?.portalWidthM || 5.0;

    // Parent azimuth vs branch azimuth
    const parentAz = parentPos.dataset.pulls[0]?.driveAzimuthDeg ?? 160;
    const branchAz = ds.pulls[0]?.driveAzimuthDeg ?? (parentAz - 85 + 360) % 360;
    let rawTurnDeg = branchAz - parentAz;
    while (rawTurnDeg > 180) rawTurnDeg -= 360;
    while (rawTurnDeg < -180) rawTurnDeg += 360;

    // Ensure branch visually points outward from the attached wall
    let branchHeadingRad = (rawTurnDeg * Math.PI) / 180;
    if (attachWall === 'RIGHT_WALL' && Math.sin(branchHeadingRad) < 0.25) {
      branchHeadingRad = Math.max(0.45, Math.abs(branchHeadingRad) || Math.PI / 2.3);
    } else if (attachWall === 'LEFT_WALL' && Math.sin(branchHeadingRad) > -0.25) {
      branchHeadingRad = -Math.max(0.45, Math.abs(branchHeadingRad) || Math.PI / 2.3);
    } else if (attachWall === 'PARALLEL_SEAM') {
      branchHeadingRad = 0;
    }

    const wallPerimM =
      attachWall === 'LEFT_WALL' ? 0 : parentPos.totalPerimM;
    const portalCenterSvg = parentPos.mapRdPerimToSvg(jRd, wallPerimM);

    // Build portal collar rectangle on parent wall
    const halfW = portalW * 0.5;
    const p1 = parentPos.mapRdPerimToSvg(jRd - halfW, wallPerimM);
    const p2 = parentPos.mapRdPerimToSvg(jRd + halfW, wallPerimM);
    const p3 = parentPos.mapRdPerimToSvg(
      jRd + halfW,
      attachWall === 'LEFT_WALL' ? 2.2 : parentPos.totalPerimM - 2.2
    );
    const p4 = parentPos.mapRdPerimToSvg(
      jRd - halfW,
      attachWall === 'LEFT_WALL' ? 2.2 : parentPos.totalPerimM - 2.2
    );

    const branchHeightPx = 155;
    // Offset branch start slightly outward from parent wall so the junction collar is clearly visible
    const outwardGapPx = attachWall === 'PARALLEL_SEAM' ? branchHeightPx * 0.55 : 28;
    const branchStartX =
      portalCenterSvg.x + Math.cos(branchHeadingRad) * outwardGapPx;
    const branchStartY =
      portalCenterSvg.y + Math.sin(branchHeadingRad) * outwardGapPx;

    const branchPositioned = buildStripSamples(
      ds,
      branchStartX,
      branchStartY,
      branchHeadingRad,
      branchHeightPx
    );

    branchPositioned.junctionPortal = {
      parentDatasetId: parentPos.dataset.id,
      parentJunctionRd: jRd,
      attachWall,
      portalCenterSvg,
      portalCornersSvg: [p1, p2, p3, p4],
      branchStartCenterSvg: { x: branchStartX, y: branchStartY },
      turnoutAngleDeg: Math.round(rawTurnDeg),
      label:
        ic?.junctionLabel ||
        `JUNCTION: ${ds.tunnelLocationName} @ Ch. ${jRd.toFixed(1)}m`,
    };

    positionedStrips.push(branchPositioned);
  }

  // 3. Compute AI Cross-Tunnel 3D Structure Projections between Trunk and Branch Tunnels
  const aiCrossProjections: CrossTunnelAiProjection[] = [];
  for (let i = 0; i < positionedStrips.length; i++) {
    for (let j = i + 1; j < positionedStrips.length; j++) {
      const stripA = positionedStrips[i];
      const stripB = positionedStrips[j];

      for (const trA of stripA.dataset.traces) {
        for (const trB of stripB.dataset.traces) {
          if (
            trA.setId === trB.setId ||
            Math.abs(trA.dipDirectionDeg - trB.dipDirectionDeg) <= 18
          ) {
            const ptA = trA.points[Math.floor(trA.points.length / 2)];
            const ptB = trB.points[Math.floor(trB.points.length / 2)];
            if (ptA && ptB) {
              aiCrossProjections.push({
                id: `proj-${trA.id}-${trB.id}`,
                setId: trA.setId,
                structureType: trA.structureType,
                orientationLabel: trA.orientationLabel,
                fromTunnelName: stripA.dataset.tunnelLocationName,
                toTunnelName: stripB.dataset.tunnelLocationName,
                fromPtSvg: stripA.mapRdPerimToSvg(ptA.x, ptA.y),
                toPtSvg: stripB.mapRdPerimToSvg(ptB.x, ptB.y),
              });
            }
          }
        }
      }
    }
  }

  return { positionedStrips, aiCrossProjections };
}

/**
 * AutoCAD OFFSET Command: Creates a parallel structural trace offset by `offsetPerimM` meters
 */
export function createOffsetStripTrace(
  sourceTrace: ContinuousStripTrace,
  offsetPerimM: number,
  totalPerimM: number
): ContinuousStripTrace {
  const offsetPts = sourceTrace.points.map((p) => ({
    x: Number((p.x + offsetPerimM * 0.35).toFixed(2)),
    y: Number(
      Math.max(0.3, Math.min(totalPerimM - 0.3, p.y + offsetPerimM)).toFixed(2)
    ),
  }));
  return {
    ...sourceTrace,
    id: `tr-offset-${Date.now()}`,
    rawPoints: offsetPts.map((p) => ({ ...p })),
    aiAlignedPoints: offsetPts.map((p) => ({ ...p })),
    points: offsetPts,
  };
}

/**
 * AutoCAD EXTEND Command: Extends a trace along its end vector to the next pull seam or tunnel wall
 */
export function extendStripTraceToBoundary(
  trace: ContinuousStripTrace,
  viewStartRd: number,
  viewEndRd: number,
  totalPerimM: number
): ContinuousStripTrace {
  if (trace.points.length < 2) return trace;
  const pts = [...trace.points];
  const p1 = pts[pts.length - 2];
  const p2 = pts[pts.length - 1];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const stepM = 5.0;
  const nx = Math.max(
    viewStartRd,
    Math.min(viewEndRd, Number((p2.x + (dx / len) * stepM).toFixed(2)))
  );
  const ny = Math.max(
    0.2,
    Math.min(totalPerimM - 0.2, Number((p2.y + (dy / len) * stepM).toFixed(2)))
  );
  const nextPts = [...pts, { x: nx, y: ny }];
  return {
    ...trace,
    points: nextPts,
    aiAlignedPoints: nextPts,
  };
}

/**
 * AutoCAD TRIM Command: Trims the last segment of a multi-segment trace (or clips at midpoint)
 */
export function trimStripTraceSegment(
  trace: ContinuousStripTrace
): ContinuousStripTrace {
  if (trace.points.length <= 2) {
    const [a, b] = trace.points;
    if (!a || !b) return trace;
    const mid = {
      x: Number(((a.x + b.x) / 2).toFixed(2)),
      y: Number(((a.y + b.y) / 2).toFixed(2)),
    };
    return {
      ...trace,
      points: [a, mid],
      aiAlignedPoints: [a, mid],
    };
  }
  const trimmed = trace.points.slice(0, trace.points.length - 1);
  return {
    ...trace,
    points: trimmed,
    aiAlignedPoints: trimmed,
  };
}
