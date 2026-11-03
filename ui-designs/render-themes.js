const puppeteer = require('puppeteer');
const path = require('path');

const themes = [
  { file: 'theme-electric-blue.html', output: 'theme-electric-blue.png', name: 'Electric Blue' },
  { file: 'theme-emerald.html', output: 'theme-emerald.png', name: 'Emerald' },
  { file: 'theme-purple.html', output: 'theme-purple.png', name: 'Deep Purple' },
  { file: 'theme-amber.html', output: 'theme-amber.png', name: 'Amber/Gold' },
  { file: 'theme-cyan.html', output: 'theme-cyan.png', name: 'Cyan/Teal' },
  { file: 'theme-sunset.html', output: 'theme-sunset.png', name: 'Sunset Orange' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const theme of themes) {
    console.log(`Rendering ${theme.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    const filePath = path.join(__dirname, theme.file);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const outputPath = path.join(__dirname, theme.output);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`  -> Saved: ${theme.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll themes rendered!');
})();
