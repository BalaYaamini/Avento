const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  
  const filePath = path.join(__dirname, 'index.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await page.screenshot({ path: path.join(__dirname, 'index-preview.png'), fullPage: false });
  console.log('Preview saved: index-preview.png');

  // Full page screenshot
  await page.screenshot({ path: path.join(__dirname, 'index-full.png'), fullPage: true });
  console.log('Full page saved: index-full.png');

  await browser.close();
})();
