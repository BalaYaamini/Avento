const puppeteer = require('puppeteer');
const path = require('path');

const designs = [
  { file: 'anim-dashboard.html', output: 'anim-dashboard.png', name: 'Animated Dashboard' },
  { file: 'anim-events.html', output: 'anim-events.png', name: 'Animated Events' },
  { file: 'anim-login.html', output: 'anim-login.png', name: 'Animated Login' },
  { file: 'anim-workspace.html', output: 'anim-workspace.png', name: 'Animated Workspace' },
  { file: 'anim-bento.html', output: 'anim-bento.png', name: 'Animated Bento' },
  { file: 'anim-magazine.html', output: 'anim-magazine.png', name: 'Animated Magazine' },
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
    // Wait longer for animations to complete
    await new Promise(resolve => setTimeout(resolve, 4000));
    await page.screenshot({ path: path.join(__dirname, d.output), fullPage: false });
    console.log(`  -> ${d.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nAll animated designs rendered!');
})();
