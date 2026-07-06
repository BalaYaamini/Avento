const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../client/public/logo.png');
const outputPath = path.join(__dirname, '../client/public/logo-transparent.png');

async function makeTransparent() {
  try {
    const img = sharp(inputPath);
    const { width, height } = await img.metadata();
    
    // Read raw pixel data
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    
    // We want to make white (or near white) pixels transparent
    // Tolerance for "white"
    const tolerance = 240; 
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      if (r > tolerance && g > tolerance && b > tolerance) {
        data[i+3] = 0; // Set alpha to 0 for white pixels
      }
    }
    
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    }).png().toFile(outputPath);
    
    console.log('Transparent logo generated at', outputPath);
  } catch (err) {
    console.error('Error:', err);
  }
}

makeTransparent();
