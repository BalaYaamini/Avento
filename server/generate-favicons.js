const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '../client/public/logo.png');
const outDir = path.join(__dirname, '../client/public');

async function generateFavicons() {
  try {
    console.log('Generating favicons from', logoPath);
    
    // 16x16
    await sharp(logoPath)
      .resize(16, 16)
      .toFile(path.join(outDir, 'favicon-16x16.png'));
    console.log('Generated favicon-16x16.png');

    // 32x32
    await sharp(logoPath)
      .resize(32, 32)
      .toFile(path.join(outDir, 'favicon-32x32.png'));
    console.log('Generated favicon-32x32.png');

    // Apple Touch Icon
    await sharp(logoPath)
      .resize(180, 180)
      .toFile(path.join(outDir, 'apple-touch-icon.png'));
    console.log('Generated apple-touch-icon.png');
    
    // Android Chrome 192x192
    await sharp(logoPath)
      .resize(192, 192)
      .toFile(path.join(outDir, 'android-chrome-192x192.png'));
    console.log('Generated android-chrome-192x192.png');
    
    // Android Chrome 512x512
    await sharp(logoPath)
      .resize(512, 512)
      .toFile(path.join(outDir, 'android-chrome-512x512.png'));
    console.log('Generated android-chrome-512x512.png');

    // Generate ico from 32x32
    const icoBuf = await pngToIco(path.join(outDir, 'favicon-32x32.png'));
    fs.writeFileSync(path.join(outDir, 'favicon.ico'), icoBuf);
    console.log('Generated favicon.ico');

  } catch (err) {
    console.error('Error generating favicons:', err);
  }
}

generateFavicons();
