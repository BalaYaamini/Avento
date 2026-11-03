const puppeteer = require('puppeteer');
const path = require('path');

const layouts = [
  { file: 'layout-minimal.html', output: 'layout-minimal.png', name: 'Minimal Sidebar' },
  { file: 'layout-topnav.html', output: 'layout-topnav.png', name: 'Top Navigation' },
  { file: 'layout-bento.html', output: 'layout-bento.png', name: 'Bento Grid' },
  { file: 'layout-split.html', output: 'layout-split.png', name: 'Split Panel' },
  { file: 'layout-glass.html', output: 'layout-glass.png', name: 'Glassmorphism' },
  { file: 'layout-magazine.html', output: 'layout-magazine.png', name: 'Magazine Editorial' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const layout of layouts) {
    console.log(`Rendering ${layout.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    const filePath = path.join(__dirname, layout.file);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const outputPath = path.join(__dirname, layout.output);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`  -> Saved: ${layout.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll layouts rendered!');
})();
