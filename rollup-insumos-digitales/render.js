const { chromium } = require('playwright');
(async () => {
  const dir = __dirname;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 882, height: 2048 }, deviceScaleFactor: 2 });
  await p.goto('file://' + dir + '/rollup.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.banner').screenshot({ path: dir + '/rollup-preview.png' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: dir + '/rollup-85x200.pdf', width: '850mm', height: '2000mm', printBackground: true, pageRanges: '1' });
  // chequeo de desbordes de texto en tarjetas
  const over = await p.$$eval('.card', cs => cs.map(c => c.scrollHeight > c.clientHeight + 1 ? c.querySelector('h3').textContent : null).filter(Boolean));
  console.log('overflow:', over, 'fonts:', await p.evaluate(() => document.fonts.check('800 20px Montserrat')));
  await b.close();
})();
