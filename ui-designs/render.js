const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const designs = [
  { file: 'design1-dashboard.html', output: 'design1-dashboard.png', name: 'Crimson Dashboard' },
  { file: 'design2-eventhub.html', output: 'design2-eventhub.png', name: 'Event Hub' },
  { file: 'design3-login.html', output: 'design3-login.png', name: 'Dark Elegance Login' },
  { file: 'design4-workspace.html', output: 'design4-workspace.png', name: 'Workspace Pro' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const design of designs) {
    console.log(`Rendering ${design.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    const filePath = path.join(__dirname, design.file);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait a moment for fonts to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const outputPath = path.join(__dirname, design.output);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`  -> Saved: ${design.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll designs rendered successfully!');
})();
