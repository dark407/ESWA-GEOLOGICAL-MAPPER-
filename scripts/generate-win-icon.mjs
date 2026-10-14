import fs from 'fs';
import path from 'path';

/**
 * Generates a standard 256x256 32-bit BGRA Windows .ico file
 * (electron-builder requires Windows NSIS icons to be at least 256x256 pixels).
 */
function createAkashTunnelMapperIcoBuffer() {
  const width = 256;
  const height = 256;
  const pixelBytes = width * height * 4;
  const maskRowBytes = Math.ceil(width / 32) * 4;
  const maskBytes = maskRowBytes * height;
  const dibHeaderSize = 40;
  const imageSize = dibHeaderSize + pixelBytes + maskBytes;

  // ICO Header (6 bytes) + 1 Directory Entry (16 bytes) = 22 bytes
  const icoBuffer = Buffer.alloc(22 + imageSize, 0);

  // ICONDIR
  icoBuffer.writeUInt16LE(0, 0); // Reserved
  icoBuffer.writeUInt16LE(1, 2); // Type: 1 = ICO
  icoBuffer.writeUInt16LE(1, 4); // Count: 1 image

  // ICONDIRENTRY (0 means 256px in Windows ICO specification)
  icoBuffer.writeUInt8(0, 6); // Width: 256
  icoBuffer.writeUInt8(0, 7); // Height: 256
  icoBuffer.writeUInt8(0, 8); // Palette count
  icoBuffer.writeUInt8(0, 9); // Reserved
  icoBuffer.writeUInt16LE(1, 10); // Color planes
  icoBuffer.writeUInt16LE(32, 12); // Bits per pixel (32-bit BGRA)
  icoBuffer.writeUInt32LE(imageSize, 14); // Size of image data
  icoBuffer.writeUInt32LE(22, 18); // Offset of image data

  // BITMAPINFOHEADER (40 bytes at offset 22)
  const dibOffset = 22;
  icoBuffer.writeUInt32LE(dibHeaderSize, dibOffset + 0);
  icoBuffer.writeInt32LE(width, dibOffset + 4);
  icoBuffer.writeInt32LE(height * 2, dibOffset + 8); // Combined height of XOR + AND masks
  icoBuffer.writeUInt16LE(1, dibOffset + 12); // Planes
  icoBuffer.writeUInt16LE(32, dibOffset + 14); // BitCount
  icoBuffer.writeUInt32LE(0, dibOffset + 16); // Compression (BI_RGB)
  icoBuffer.writeUInt32LE(pixelBytes + maskBytes, dibOffset + 20);

  // Draw 256x256 Engineering Tunnel Arch + Joint Trace Icon (bottom-up rows for BMP)
  const pixelOffset = dibOffset + dibHeaderSize;
  const cx = width / 2;

  for (let y = 0; y < height; y++) {
    const bmpRow = height - 1 - y;
    const ny = y / 4; // Normalized to 64x64 coordinate space
    for (let x = 0; x < width; x++) {
      const nx = x / 4;
      const idx = pixelOffset + (bmpRow * width + x) * 4;

      const dx = nx - 32;
      const dy = ny - 32;
      const maxDist = Math.max(Math.abs(dx), Math.abs(dy));

      if (maxDist > 30) {
        icoBuffer[idx + 0] = 0;
        icoBuffer[idx + 1] = 0;
        icoBuffer[idx + 2] = 0;
        icoBuffer[idx + 3] = 0;
        continue;
      }

      let r = 11;
      let g = 18;
      let b = 30;
      const a = 255;

      if (maxDist >= 28) {
        r = 14;
        g = 165;
        b = 233;
      }

      const inWallSpan = Math.abs(nx - 32) >= 17 && Math.abs(nx - 32) <= 19 && ny >= 28 && ny <= 50;
      const inInvert = Math.abs(nx - 32) <= 19 && ny >= 49 && ny <= 51;
      const archDist = Math.hypot(nx - 32, ny - 28);
      const inCrownArch = ny <= 28 && archDist >= 17 && archDist <= 19.2;

      if (inWallSpan || inInvert || inCrownArch) {
        r = 56;
        g = 189;
        b = 248;
      }

      const jointY = 24 + (nx - 16) * 0.55 + Math.sin((nx - 16) * 0.25) * 2.0;
      if (nx >= 16 && nx <= 47 && Math.abs(ny - jointY) <= 1.2) {
        r = 245;
        g = 158;
        b = 11;
      }

      const conjY = 44 - (nx - 18) * 0.48;
      if (nx >= 20 && nx <= 45 && Math.abs(ny - conjY) <= 1.1) {
        r = 16;
        g = 185;
        b = 129;
      }

      // ESWA Geometric 'E' Monogram inside the tunnel portal
      const inEVertical = nx >= 24 && nx <= 27.2 && ny >= 21 && ny <= 43;
      const inETopBar = nx >= 24 && nx <= 40 && ny >= 21 && ny <= 24;
      const inEMidBar = nx >= 24 && nx <= 37 && ny >= 30.5 && ny <= 33.5;
      const inEBotBar = nx >= 24 && nx <= 40 && ny >= 40 && ny <= 43;
      if (inEVertical || inETopBar || inEMidBar || inEBotBar) {
        r = 248;
        g = 250;
        b = 252;
      }

      icoBuffer[idx + 0] = b;
      icoBuffer[idx + 1] = g;
      icoBuffer[idx + 2] = r;
      icoBuffer[idx + 3] = a;
    }
  }

  return icoBuffer;
}

const isCi = process.env.GITHUB_ACTIONS === 'true';
const buildDir = isCi ? path.join(process.cwd(), 'build') : '/tmp/akash-release-cache/build';
const publicDir = isCi ? path.join(process.cwd(), 'public') : '/tmp/akash-release-cache/public';
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const icoBuf = createAkashTunnelMapperIcoBuffer();
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);
fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuf);
console.log('Generated 256x256 icon.ico (' + icoBuf.length + ' bytes)');
