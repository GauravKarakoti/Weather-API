// scripts/optimize-images.js
// Scans public/ for raster images and generates optimized WebP and JPG variants
// Outputs to public/optimized preserving subfolders
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const srcDir = path.join(__dirname, '..', 'public');
const outDir = path.join(srcDir, 'optimized');

const sizes = [480, 768, 1024, 1920]; // responsive widths

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function processFile(file) {
  const rel = path.relative(srcDir, file);
  const dir = path.dirname(rel);
  const base = path.basename(rel, path.extname(rel));
  const outSubDir = path.join(outDir, dir);
  if (!fs.existsSync(outSubDir)) fs.mkdirSync(outSubDir, { recursive: true });

  const ext = path.extname(file).toLowerCase();
  if (ext === '.svg') {
    console.log('Skipping SVG:', rel);
    return Promise.resolve();
  }

  const tasks = [];

  // create a WebP version at original resolution
  const webpOut = path.join(outSubDir, `${base}.webp`);
  tasks.push(
    sharp(file)
      .webp({ quality: 80 })
      .toFile(webpOut)
      .then(() => console.log('Wrote', path.relative(srcDir, webpOut)))
  );

  // create multiple resized JPEG and WebP variants
  for (const w of sizes) {
    const resizedOutWebp = path.join(outSubDir, `${base}-${w}.webp`);
    tasks.push(
      sharp(file)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(resizedOutWebp)
        .then(() => console.log('Wrote', path.relative(srcDir, resizedOutWebp)))
    );

    const resizedOutJpg = path.join(outSubDir, `${base}-${w}.jpg`);
    tasks.push(
      sharp(file)
        .resize({ width: w, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(resizedOutJpg)
        .then(() => console.log('Wrote', path.relative(srcDir, resizedOutJpg)))
    );
  }

  return Promise.all(tasks);
}

function walk(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, list);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) list.push(full);
    }
  }
  return list;
}

const files = walk(srcDir);
console.log(`Found ${files.length} raster images`);
if (files.length === 0) {
  console.log('No raster images found in', srcDir);
}

Promise.all(files.map(processFile))
  .then(() => {
    console.log('All done. Optimized images are in public/optimized');
  })
  .catch((e) => {
    console.error('Error processing images', e);
    process.exit(1);
  });
