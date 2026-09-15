const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const clientDistDir = path.join(rootDir, 'client', 'dist');
const rootDistDir = path.join(rootDir, 'dist');

console.log('📦 Starting distribution sync...');

if (!fs.existsSync(clientDistDir)) {
  console.error('❌ client/dist does not exist! Please run client build first.');
  process.exit(1);
}

// 1. Sync client/dist to root /dist
if (fs.existsSync(rootDistDir)) {
  fs.rmSync(rootDistDir, { recursive: true, force: true });
}
fs.cpSync(clientDistDir, rootDistDir, { recursive: true });
console.log('✅ Copied client/dist -> /dist');

// 2. Sync critical files to root / for legacy or root-serving deployments
const filesToSyncToRoot = ['index.html', 'favicon.svg', 'icons.svg'];
for (const file of filesToSyncToRoot) {
  const src = path.join(clientDistDir, file);
  const dest = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied ${file} -> root /${file}`);
  }
}

// Sync assets folder to root /assets
const srcAssets = path.join(clientDistDir, 'assets');
const destAssets = path.join(rootDir, 'assets');
if (fs.existsSync(srcAssets)) {
  if (fs.existsSync(destAssets)) {
    fs.rmSync(destAssets, { recursive: true, force: true });
  }
  fs.cpSync(srcAssets, destAssets, { recursive: true });
  console.log('✅ Copied client/dist/assets -> root /assets');
}

console.log('🎉 Distribution sync completed successfully!');
