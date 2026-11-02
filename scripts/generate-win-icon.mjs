import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

/**
 * Generates a 100% uncompressed BMP-inside-ICO multi-resolution Windows .ico file
 * containing 16x16, 32x32, 48x48, 64x64, 128x128, and 256x256 32-bit BGRA frames.
 * NSIS makensis.exe and Windows Explorer require standard BITMAPINFOHEADER DIB frames
 * across all standard DPI resolutions.
 */
function decodeUnfilteredPng(pngPath, expectedSize) {
  const buf = fs.readFileSync(pngPath);
  let offset = 8; // skip PNG signature
  let width = 0;
  let height = 0;
  const idatChunks = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`Expected ${expectedSize}x${expectedSize} PNG in ${pngPath}, got ${width}x${height}`);
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  const rgba = Buffer.alloc(width * height * 4);
  const stride = width * 4 + 1;
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride + 1;
    decompressed.copy(rgba, y * width * 4, rowStart, rowStart + width * 4);
  }

  return { width, height, rgba };
}

function downsampleRgba(srcRgba, srcSize, dstSize) {
  if (srcSize === dstSize) return srcRgba;
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  const factor = srcSize / dstSize;
  for (let y = 0; y < dstSize; y++) {
    const sy0 = Math.floor(y * factor);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * factor));
    for (let x = 0; x < dstSize; x++) {
      const sx0 = Math.floor(x * factor);
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * factor));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const idx = (sy * srcSize + sx) * 4;
          r += srcRgba[idx];
          g += srcRgba[idx + 1];
          b += srcRgba[idx + 2];
          a += srcRgba[idx + 3];
          count++;
        }
      }
      const dstIdx = (y * dstSize + x) * 4;
      dst[dstIdx] = Math.round(r / count);
      dst[dstIdx + 1] = Math.round(g / count);
      dst[dstIdx + 2] = Math.round(b / count);
      dst[dstIdx + 3] = Math.round(a / count);
    }
  }
  return dst;
}

function createBmpDibFrame(width, height, rgba) {
  const xorSize = width * height * 4;
  // AND mask rows must be padded to a multiple of 4 bytes (32 bits)
  const andRowBytes = Math.ceil(width / 32) * 4;
  const andSize = andRowBytes * height;
  const bihSize = 40;
  const dibBuffer = Buffer.alloc(bihSize + xorSize + andSize);

  // BITMAPINFOHEADER (40 bytes)
  dibBuffer.writeUInt32LE(bihSize, 0);        // biSize
  dibBuffer.writeInt32LE(width, 4);           // biWidth
  dibBuffer.writeInt32LE(height * 2, 8);      // biHeight (doubled for XOR + AND masks in ICO)
  dibBuffer.writeUInt16LE(1, 12);             // biPlanes
  dibBuffer.writeUInt16LE(32, 14);            // biBitCount (32-bit BGRA)
  dibBuffer.writeUInt32LE(0, 16);             // biCompression (BI_RGB = 0)
  dibBuffer.writeUInt32LE(xorSize + andSize, 20); // biSizeImage
  dibBuffer.writeInt32LE(0, 24);              // biXPelsPerMeter
  dibBuffer.writeInt32LE(0, 28);              // biYPelsPerMeter
  dibBuffer.writeUInt32LE(0, 32);             // biClrUsed
  dibBuffer.writeUInt32LE(0, 36);             // biClrImportant

  // Write bottom-up BGRA pixels (XOR mask) and 1-bit opacity mask (AND mask)
  const xorOffset = bihSize;
  const andOffset = bihSize + xorSize;

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y; // BMP is bottom-up
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 4;
      const dstIdx = xorOffset + (y * width + x) * 4;

      const r = rgba[srcIdx];
      const g = rgba[srcIdx + 1];
      const b = rgba[srcIdx + 2];
      const a = rgba[srcIdx + 3];

      dibBuffer[dstIdx] = b;
      dibBuffer[dstIdx + 1] = g;
      dibBuffer[dstIdx + 2] = r;
      dibBuffer[dstIdx + 3] = a;

      // Set AND mask bit to 1 if pixel is transparent (alpha < 128)
      if (a < 128) {
        const byteIndex = andOffset + y * andRowBytes + (x >> 3);
        const bitIndex = 7 - (x & 7);
        dibBuffer[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  return dibBuffer;
}

function generateIco() {
  const iconSizes = [16, 32, 48, 64, 128, 256];
  const png256Path = path.join(rootDir, 'public', 'icons', 'icon-256x256.png');

  if (!fs.existsSync(png256Path)) {
    console.log('Generating PNG icons via generate-app-icons.py first...');
    execSync('python3 scripts/generate-app-icons.py', { cwd: rootDir, stdio: 'inherit' });
  }

  const master256 = decodeUnfilteredPng(png256Path, 256);

  const frames = iconSizes.map((size) => {
    const candidatePaths = [
      path.join(rootDir, 'public', 'icons', `icon-${size}x${size}.png`),
      path.join(rootDir, 'public', `favicon-${size}x${size}.png`),
    ];
    const foundPath = candidatePaths.find((p) => fs.existsSync(p));
    const rgba = foundPath
      ? decodeUnfilteredPng(foundPath, size).rgba
      : downsampleRgba(master256.rgba, 256, size);
    const dib = createBmpDibFrame(size, size, rgba);
    return { size, dib };
  });

  const headerSize = 6;
  const dirEntrySize = 16;
  const totalDirSize = headerSize + dirEntrySize * frames.length;
  const totalDibSize = frames.reduce((sum, f) => sum + f.dib.length, 0);
  const icoBuffer = Buffer.alloc(totalDirSize + totalDibSize);

  // ICONDIR (6 bytes)
  icoBuffer.writeUInt16LE(0, 0);             // Reserved (0)
  icoBuffer.writeUInt16LE(1, 2);             // Type (1 = ICO)
  icoBuffer.writeUInt16LE(frames.length, 4); // Count (6 resolutions)

  let currentDataOffset = totalDirSize;
  frames.forEach((frame, index) => {
    const entryOffset = headerSize + index * dirEntrySize;
    icoBuffer.writeUInt8(frame.size === 256 ? 0 : frame.size, entryOffset);     // Width (0 = 256)
    icoBuffer.writeUInt8(frame.size === 256 ? 0 : frame.size, entryOffset + 1); // Height (0 = 256)
    icoBuffer.writeUInt8(0, entryOffset + 2);                                   // ColorCount
    icoBuffer.writeUInt8(0, entryOffset + 3);                                   // Reserved
    icoBuffer.writeUInt16LE(1, entryOffset + 4);                                // Planes (1)
    icoBuffer.writeUInt16LE(32, entryOffset + 6);                               // BitCount (32-bit BGRA)
    icoBuffer.writeUInt32LE(frame.dib.length, entryOffset + 8);                 // BytesInRes
    icoBuffer.writeUInt32LE(currentDataOffset, entryOffset + 12);               // ImageOffset

    frame.dib.copy(icoBuffer, currentDataOffset);
    currentDataOffset += frame.dib.length;
  });

  const buildDir = path.join(rootDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(rootDir, 'public', 'icon.ico'), icoBuffer);
  fs.copyFileSync(png256Path, path.join(buildDir, 'icon.png'));

  console.log(`Generated multi-resolution uncompressed BMP-in-ICO at build/icon.ico & public/icon.ico (${icoBuffer.length} bytes, sizes: ${iconSizes.join(', ')}px)`);
}

generateIco();
