import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.dependencies = {
  '@google/genai': '^1.0.0',
  '@tailwindcss/vite': '^4.0.9',
  '@vitejs/plugin-react': '^4.3.4',
  firebase: '^11.4.0',
  'lucide-react': '^0.475.0',
  nodemailer: '^6.10.0',
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  vite: '^6.2.0',
  express: '^4.21.2',
  dotenv: '^16.4.7',
  motion: '^12.4.7',
};

pkg.devDependencies = {
  '@types/express': '^4.17.21',
  '@types/node': '^22.13.5',
  '@types/nodemailer': '^6.4.17',
  '@types/react': '^19.0.10',
  '@types/react-dom': '^19.0.4',
  autoprefixer: '^10.4.20',
  electron: '^34.2.0',
  'electron-builder': '^25.1.8',
  esbuild: '^0.25.0',
  tailwindcss: '^4.0.9',
  tsx: '^4.19.2',
  typescript: '^5.7.3',
  'vite-plugin-pwa': '^0.21.1',
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

for (const lockFile of ['package-lock.json', 'bun.lock']) {
  const fullLock = path.join(rootDir, lockFile);
  if (fs.existsSync(fullLock)) {
    fs.unlinkSync(fullLock);
  }
}

console.log('[CI] Normalized package.json for public npm registry.');
