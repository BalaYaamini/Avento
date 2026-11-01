const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../client/public/logo-mark.png');
const outputPath = path.join(__dirname, '../client/public/logo-mark-cyan.png');

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

const sepia = [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]];

const hueRotate = (deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]
  ];
};

const saturate = (s) => [
  [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
  [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
  [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
];

const applyMatrix = (data, m) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = clamp(m[0][0] * r + m[0][1] * g + m[0][2] * b);
    data[i + 1] = clamp(m[1][0] * r + m[1][1] * g + m[1][2] * b);
    data[i + 2] = clamp(m[2][0] * r + m[2][1] * g + m[2][2] * b);
  }
};

const applyBrightness = (data, factor) => {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * factor);
    data[i + 1] = clamp(data[i + 1] * factor);
    data[i + 2] = clamp(data[i + 2] * factor);
  }
};

// CSS: filter: brightness(0.85) sepia(1) hue-rotate(130deg) saturate(3) brightness(1.1);
// Each step runs in order with clamping, exactly like the browser applies the chain.
async function makeCyanLogo() {
  try {
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    applyBrightness(data, 0.85);
    applyMatrix(data, sepia);
    applyMatrix(data, hueRotate(130));
    applyMatrix(data, saturate(3));
    applyBrightness(data, 1.1);

    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(outputPath);

    console.log('Cyan logo generated at', outputPath);
  } catch (err) {
    console.error('Error:', err);
  }
}

makeCyanLogo();
