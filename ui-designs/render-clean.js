const puppeteer = require('puppeteer');
const path = require('path');

const designs = [
  { file: 'clean-dashboard.html', output: 'clean-dashboard.png', name: 'Clean Dashboard' },
  { file: 'clean-events.html', output: 'clean-events.png', name: 'Clean Events' },
  { file: 'clean-login.html', output: 'clean-login.png', name: 'Clean Login' },
  { file: 'clean-workspace.html', output: 'clean-workspace.png', name: 'Clean Workspace' },
  { file: 'clean-bento.html', output: 'clean-bento.png', name: 'Clean Bento' },
  { file: 'clean-magazine.html', output: 'clean-magazine.png', name: 'Clean Magazine' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const d of designs) {
    console.log(`Rendering ${d.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`file://${path.join(__dirname, d.file)}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(__dirname, d.output), fullPage: false });
    console.log(`  -> ${d.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll clean designs rendered!');
})();
