import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function optimizeImages() {
  console.log('Optimizing images...');
  
  // App Screenshot
  const screenshotPath = path.join(PUBLIC_DIR, 'app-screenshot.png');
  const screenshotBase = sharp(screenshotPath);
  
  // Create 1920 WebP
  await screenshotBase.clone()
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(PUBLIC_DIR, 'app-screenshot.webp'));
    
  // Create ~1000 WebP for smaller screens (998 width in Lighthouse feedback)
  await screenshotBase.clone()
    .resize(1000)
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(PUBLIC_DIR, 'app-screenshot-1000.webp'));
  
  // Create ~1000 PNG fallback
  await screenshotBase.clone()
    .resize(1000)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, 'app-screenshot-1000.png'));

  // Create ~600 WebP for mobile screens
  await screenshotBase.clone()
    .resize(600)
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(PUBLIC_DIR, 'app-screenshot-600.webp'));
  
  // Create ~600 PNG fallback
  await screenshotBase.clone()
    .resize(600)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, 'app-screenshot-600.png'));

  // Icon
  const iconPath = path.join(PUBLIC_DIR, 'icon-512.png');
  const iconBase = sharp(iconPath);
  
  // Create 512 WebP
  await iconBase.clone()
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(PUBLIC_DIR, 'icon-512.webp'));
    
  // Create 72 WebP (for 36px display @2x)
  await iconBase.clone()
    .resize(72)
    .webp({ quality: 80, effort: 6 })
    .toFile(path.join(PUBLIC_DIR, 'icon-72.webp'));
    
  // Create 72 PNG fallback
  await iconBase.clone()
    .resize(72)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, 'icon-72.png'));

  console.log('Optimized images successfully.');
}

optimizeImages().catch(console.error);
