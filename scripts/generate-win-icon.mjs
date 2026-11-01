import fs from 'fs';
import path from 'path';

/**
 * Generates a valid 256x256 32-bit RGBA Windows Icon (.ico) file
 * featuring the Official ESWA GEOLOGICAL MAPPER Eagle Logo:
 * - Warm Geological Amber-Orange & Dark Slate Rounded Badge with Crisp White Rim
 * - Twin-Peak Dark Topographic Mountain Triangle
 * - Topographic White/Ice-Blue Eagle Head with Hooked Beak & Compass Needle Eye
 * - 'ESWA' Bold Geological Wordmark (Horseshoe Tunnel Arch 'E', Folded Stratum 'S', Fractured Blue-Rock 'W' & 'A')
 */
function clamp(v, lo = 0, hi = 255) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToPolyEdges(px, py, poly, closed = true) {
  let best = 1e9;
  const n = poly.length;
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const d = distToSegment(px, py, x1, y1, x2, y2);
    if (d < best) best = d;
  }
  return best;
}

function sampleCubicBezier(p0, p1, p2, p3, steps = 18) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0[0] +
      3 * mt * mt * t * p1[0] +
      3 * mt * t * t * p2[0] +
      t * t * t * p3[0];
    const y =
      mt * mt * mt * p0[1] +
      3 * mt * mt * t * p1[1] +
      3 * mt * t * t * p2[1] +
      t * t * t * p3[1];
    pts.push([x, y]);
  }
  return pts;
}

function buildEagleHeadPolygon() {
  const segs = [
    [[272, 268], [318, 228], [378, 190], [444, 186]],
    [[444, 186], [476, 184], [502, 194], [514, 208]],
    [[514, 208], [546, 210], [578, 224], [590, 250]],
    [[590, 250], [598, 268], [594, 292], [578, 308]],
    [[578, 308], [574, 292], [562, 280], [544, 278]],
    [[544, 278], [516, 276], [488, 292], [464, 316]],
    [[464, 316], [452, 328], [444, 342], [440, 354]],
  ];
  const poly = [];
  for (const [p0, p1, p2, p3] of segs) {
    const pts = sampleCubicBezier(p0, p1, p2, p3, 16);
    poly.push(...pts.slice(0, -1));
  }
  poly.push([440, 354], [382, 354]);
  const neckPts = sampleCubicBezier([382, 354], [368, 310], [326, 276], [272, 268], 16);
  poly.push(...neckPts.slice(0, -1));
  return poly;
}

function buildLetterSPolygon() {
  const segs1 = [
    [[432, 384], [414, 366], [386, 358], [358, 360]],
    [[358, 360], [318, 362], [294, 384], [294, 412]],
    [[294, 412], [294, 442], [322, 454], [360, 466]],
    [[360, 466], [388, 474], [398, 482], [396, 494]],
    [[396, 494], [394, 506], [376, 512], [354, 510]],
    [[354, 510], [332, 508], [314, 498], [298, 486]],
  ];
  const poly = [];
  for (const [p0, p1, p2, p3] of segs1) {
    poly.push(...sampleCubicBezier(p0, p1, p2, p3, 10).slice(0, -1));
  }
  poly.push([298, 486], [280, 518]);
  const segs2 = [
    [[280, 518], [302, 534], [330, 542], [360, 542]],
    [[360, 542], [406, 542], [438, 520], [438, 486]],
    [[438, 486], [438, 454], [412, 438], [370, 426]],
    [[370, 426], [344, 418], [334, 412], [336, 400]],
    [[336, 400], [338, 390], [352, 384], [372, 386]],
    [[372, 386], [390, 388], [406, 396], [418, 406]],
  ];
  for (const [p0, p1, p2, p3] of segs2) {
    poly.push(...sampleCubicBezier(p0, p1, p2, p3, 10).slice(0, -1));
  }
  poly.push([418, 406]);
  return poly;
}

function generateValidWindowsIco() {
  const width = 256;
  const height = 256;
  const xorSize = width * height * 4;
  const andRowBytes = Math.ceil(width / 32) * 4;
  const andSize = andRowBytes * height;
  const biSize = 40;
  const imageSize = biSize + xorSize + andSize;

  const buffer = Buffer.alloc(6 + 16 + imageSize, 0);

  // 1. ICONDIR Header
  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(1, 2);
  buffer.writeUInt16LE(1, 4);

  // 2. ICONDIRENTRY
  buffer.writeUInt8(0, 6); // 256
  buffer.writeUInt8(0, 7); // 256
  buffer.writeUInt8(0, 8);
  buffer.writeUInt8(0, 9);
  buffer.writeUInt16LE(1, 10);
  buffer.writeUInt16LE(32, 12);
  buffer.writeUInt32LE(imageSize, 14);
  buffer.writeUInt32LE(22, 18);

  // 3. BITMAPINFOHEADER
  const dibOffset = 22;
  buffer.writeUInt32LE(biSize, dibOffset);
  buffer.writeInt32LE(width, dibOffset + 4);
  buffer.writeInt32LE(height * 2, dibOffset + 8);
  buffer.writeUInt16LE(1, dibOffset + 12);
  buffer.writeUInt16LE(32, dibOffset + 14);
  buffer.writeUInt32LE(0, dibOffset + 16);
  buffer.writeUInt32LE(xorSize + andSize, dibOffset + 20);

  const pixelOffset = dibOffset + biSize;

  const mtnPoly = [
    [222, 332],
    [346, 118],
    [368, 144],
    [452, 22],
    [686, 332],
  ];
  const eaglePoly = buildEagleHeadPolygon();
  const beakCurve = sampleCubicBezier([514, 208], [498, 236], [496, 268], [516, 286], 12);
  const sPoly = buildLetterSPolygon();
  const wPoly = [
    [426, 364],
    [466, 364],
    [490, 472],
    [520, 364],
    [554, 364],
    [584, 472],
    [608, 364],
    [648, 364],
    [604, 538],
    [566, 538],
    [537, 432],
    [508, 538],
    [470, 538],
  ];
  const aOuterPoly = [
    [686, 364],
    [730, 364],
    [792, 538],
    [748, 538],
    [736, 502],
    [678, 502],
    [666, 538],
    [624, 538],
  ];
  const aHolePoly = [
    [707, 412],
    [688, 470],
    [726, 470],
  ];

  const ePoly = [[152, 538], [152, 392]];
  for (let deg = 180; deg > -18; deg -= 8) {
    const rad = (deg * Math.PI) / 180;
    ePoly.push([278 + 126 * Math.cos(rad), 392 - 126 * Math.sin(rad)]);
  }
  for (let deg = -12; deg < 165; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    ePoly.push([282 + 54 * Math.cos(rad), 414 - 54 * Math.sin(rad)]);
  }
  ePoly.push(
    [238, 428],
    [286, 428],
    [286, 468],
    [238, 468],
    [238, 496],
    [296, 496],
    [296, 538]
  );

  const pad = 8;
  const radCorner = 54;
  const innerX0 = pad + radCorner;
  const innerX1 = width - pad - radCorner;
  const innerY0 = pad + radCorner;
  const innerY1 = height - pad - radCorner;

  const cos36 = Math.cos((36 * Math.PI) / 180);
  const sin36 = Math.sin((36 * Math.PI) / 180);

  for (let y = 0; y < height; y++) {
    const imgY = height - 1 - y; // DIB is bottom-up
    for (let x = 0; x < width; x++) {
      const idx = pixelOffset + (y * width + x) * 4;
      const px = x + 0.5;
      const py = imgY + 0.5;

      const cx = Math.min(Math.max(px, innerX0), innerX1);
      const cy = Math.min(Math.max(py, innerY0), innerY1);
      const distOut = Math.hypot(px - cx, py - cy) - radCorner;
      const sdfBox =
        px >= innerX0 && px <= innerX1 && py >= innerY0 && py <= innerY1
          ? -Math.min(px - pad, width - pad - px, py - pad, height - pad - py)
          : distOut;

      if (sdfBox > 1.0) {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
        continue;
      }

      let alpha = 1.0;
      if (sdfBox > -1.0) {
        alpha = Math.max(0, Math.min(1, (1.0 - sdfBox) / 2.0));
      }

      const nx = px / width;
      const ny = py / height;
      let r = lerp(245, 180, ny * 0.75 + nx * 0.25);
      let g = lerp(148, 68, ny * 0.8 + nx * 0.2);
      let b = lerp(38, 12, ny);

      if (sdfBox > -6.0) {
        if (sdfBox > -3.2) {
          r = 255;
          g = 252;
          b = 245;
        } else {
          r = 15;
          g = 23;
          b = 42;
        }
      }

      const sx = (px - 128.0) / 0.36 + 468.0;
      const sy = (py - 128.0) / 0.36 + 286.0;

      const inMtn = pointInPoly(sx, sy, mtnPoly);
      const dMtn = distToPolyEdges(sx, sy, mtnPoly, true);

      const inEagle = pointInPoly(sx, sy, eaglePoly);
      const dEagle = distToPolyEdges(sx, sy, eaglePoly, true);

      const inE = pointInPoly(sx, sy, ePoly);
      const dE = distToPolyEdges(sx, sy, ePoly, true);

      const inS = pointInPoly(sx, sy, sPoly);
      const dS = distToPolyEdges(sx, sy, sPoly, true);

      const inW = pointInPoly(sx, sy, wPoly);
      const dW = distToPolyEdges(sx, sy, wPoly, true);

      const inAOuter = pointInPoly(sx, sy, aOuterPoly);
      const inAHole = pointInPoly(sx, sy, aHolePoly);
      const inA = inAOuter && !inAHole;
      const dA = Math.min(
        distToPolyEdges(sx, sy, aOuterPoly, true),
        inAOuter ? distToPolyEdges(sx, sy, aHolePoly, true) : 1e9
      );

      const anyInside = inMtn || inEagle || inE || inS || inW || inA;
      const minEdgeDist = Math.min(dMtn, dEagle, dE, dS, dW, dA);

      if (!anyInside && minEdgeDist < 14.0) {
        const ht = Math.max(0, Math.min(1, (14.0 - minEdgeDist) / 3.5));
        r = lerp(r, 255, ht);
        g = lerp(g, 255, ht);
        b = lerp(b, 255, ht);
      }

      if (inMtn) {
        const mtT = Math.max(0, Math.min(1, (sy - 22.0) / 310.0));
        let mr = lerp(68, 8, mtT);
        let mg = lerp(78, 12, mtT);
        let mb = lerp(94, 20, mtT);
        const cVal = Math.sin((sy - 30) * 0.16 + Math.sin(sx * 0.035) * 2.2);
        if (Math.abs(cVal) < 0.16) {
          mr = lerp(mr, 148, 0.45);
          mg = lerp(mg, 163, 0.45);
          mb = lerp(mb, 184, 0.45);
        }
        if (dMtn < 9.0) {
          mr = 5;
          mg = 7;
          mb = 10;
        }
        r = mr;
        g = mg;
        b = mb;
      }

      if (!inEagle && dEagle < 7.0 && sy < 350) {
        r = 255;
        g = 255;
        b = 255;
      }

      if (inEagle) {
        const et = Math.max(
          0,
          Math.min(1, ((sx - 272) / 320) * 0.65 + ((sy - 186) / 170) * 0.35)
        );
        let er = lerp(255, 165, et);
        let eg = lerp(255, 230, et);
        let eb = lerp(255, 252, et);

        const eagleWave = Math.sin(sx * 0.065 + sy * 0.095 + Math.sin(sx * 0.025) * 1.6);
        if (Math.abs(eagleWave) < 0.16) {
          er = lerp(er, 30, 0.62);
          eg = lerp(eg, 41, 0.62);
          eb = lerp(eb, 59, 0.62);
        }

        if (distToPolyEdges(sx, sy, beakCurve, false) < 2.5) {
          er = 15;
          eg = 23;
          eb = 42;
        }

        if (dEagle < 4.0) {
          er = 9;
          eg = 13;
          eb = 20;
        }

        const ex = sx - 476.0;
        const ey = sy - 236.0;
        const rxEye = ex * cos36 - ey * sin36;
        const ryEye = ex * sin36 + ey * cos36;
        const eyeR = Math.hypot(ex, ey);
        if (Math.abs(rxEye) / 28.0 + Math.abs(ryEye) / 8.5 <= 1.0 || eyeR <= 8.0) {
          er = 5;
          eg = 7;
          eb = 10;
          if (eyeR <= 5.4) {
            er = 186;
            eg = 230;
            eb = 253;
          }
          if (eyeR <= 2.4) {
            er = 15;
            eg = 23;
            eb = 42;
          }
        }

        r = er;
        g = eg;
        b = eb;
      }

      if (inE) {
        const distArch = Math.hypot(sx - 278.0, Math.min(sy, 392.0) - 392.0);
        let er = 148,
          eg = 163,
          eb = 184;
        if (sx >= 174 && distArch <= 104) {
          const wt = Math.max(0, Math.min(1, (538 - sy) / 240));
          er = lerp(154, 59, wt);
          eg = lerp(123, 77, wt);
          eb = lerp(79, 89, wt);
        }
        if (dE < 5.0) {
          er = 9;
          eg = 13;
          eb = 20;
        }
        r = er;
        g = eg;
        b = eb;
      }

      if (inS) {
        const wt = Math.max(0, Math.min(1, (sy - 360) / 180));
        let sr = lerp(41, 42, wt);
        let sg = lerp(163, 64, wt);
        let sb = lerp(220, 77, wt);
        const bandY = 392 + (sx - 275) * 0.52;
        if (Math.abs(sy - bandY) < 18) {
          sr = 196;
          sg = 138;
          sb = 69;
        }
        if (dS < 5.0) {
          sr = 9;
          sg = 13;
          sb = 20;
        }
        r = sr;
        g = sg;
        b = sb;
      }

      if (inW || inA) {
        const wt = Math.max(0, Math.min(1, (sy - 364) / 174));
        let wr = lerp(41, 42, wt);
        let wg = lerp(163, 64, wt);
        let wb = lerp(220, 77, wt);
        const dEdge = inW ? dW : dA;
        if (dEdge < 5.0) {
          wr = 9;
          wg = 13;
          wb = 20;
        }
        r = wr;
        g = wg;
        b = wb;
      }

      buffer[idx] = clamp(b);
      buffer[idx + 1] = clamp(g);
      buffer[idx + 2] = clamp(r);
      buffer[idx + 3] = clamp(alpha * 255);
    }
  }

  return buffer;
}

const icoBuffer = generateValidWindowsIco();

const buildDir = path.resolve('build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuffer);

console.log(
  'Generated 256x256 Windows .ico with Official ESWA Eagle Logo at build/icon.ico and public/icon.ico'
);
