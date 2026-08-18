const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'informe_estados_vacios.html');
  await page.goto(`file:///${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.pdf({
    path: 'informe_estados_vacios.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();
  console.log('PDF generado: informe_estados_vacios.pdf');
})();
