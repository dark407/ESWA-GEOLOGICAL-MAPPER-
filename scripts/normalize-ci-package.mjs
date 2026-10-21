import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Preserve and normalize all dependencies for clean public npm registry resolution
const existingDeps = pkg.dependencies || {};
const existingDevDeps = pkg.devDependencies || {};

// Ensure critical dependencies are never omitted during CI builds
pkg.dependencies = {
  ...existingDeps,
  '@google/genai': existingDeps['@google/genai'] || '^1.0.0',
  '@tailwindcss/vite': existingDeps['@tailwindcss/vite'] || '^4.0.9',
  '@vitejs/plugin-react': existingDeps['@vitejs/plugin-react'] || '^4.3.4',
  firebase: existingDeps['firebase'] || '^11.4.0',
  'lucide-react': existingDeps['lucide-react'] || '^0.475.0',
  nodemailer: existingDeps['nodemailer'] || '^10.0.14',
  react: existingDeps['react'] || '^19.0.0',
  'react-dom': existingDeps['react-dom'] || '^19.0.0',
  three: existingDeps['three'] || '^0.186.1',
  vite: existingDeps['vite'] || '^6.2.0',
  express: existingDeps['express'] || '^4.21.2',
  dotenv: existingDeps['dotenv'] || '^16.4.7',
  motion: existingDeps['motion'] || '^12.4.7',
};

pkg.devDependencies = {
  ...existingDevDeps,
  '@types/express': existingDevDeps['@types/express'] || '^4.17.21',
  '@types/node': existingDevDeps['@types/node'] || '^22.13.5',
  '@types/nodemailer': existingDevDeps['@types/nodemailer'] || '^8.0.2',
  '@types/react': existingDevDeps['@types/react'] || '^19.0.10',
  '@types/react-dom': existingDevDeps['@types/react-dom'] || '^19.0.4',
  '@types/three': existingDevDeps['@types/three'] || '^0.186.0',
  autoprefixer: existingDevDeps['autoprefixer'] || '^10.4.20',
  electron: existingDevDeps['electron'] || '^34.2.0',
  'electron-builder': existingDevDeps['electron-builder'] || '^25.1.8',
  esbuild: existingDevDeps['esbuild'] || '^0.25.0',
  tailwindcss: existingDevDeps['tailwindcss'] || '^4.0.9',
  terser: existingDevDeps['terser'] || '^5.51.2',
  tsx: existingDevDeps['tsx'] || '^4.19.2',
  typescript: existingDevDeps['typescript'] || '^5.7.3',
  'vite-plugin-pwa': existingDevDeps['vite-plugin-pwa'] || '^0.21.1',
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

for (const lockFile of ['package-lock.json', 'bun.lock']) {
  const fullLock = path.join(rootDir, lockFile);
  if (fs.existsSync(fullLock)) {
    fs.unlinkSync(fullLock);
  }
}

console.log('[CI] Normalized package.json with full 3D and native dependencies preserved.');
