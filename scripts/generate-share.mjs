import { readFile, readdir } from 'node:fs/promises';

const { chromium } = await import(process.argv[2] || 'playwright');
const hamster = await readFile(new URL('../src/assets/hamster-wheel.svg', import.meta.url), 'utf8');
const assets = await readdir(new URL('../dist/assets/', import.meta.url));
const font = assets.find(name => name.startsWith('nunito-sans-latin-wght') && name.endsWith('.woff2'));
if (!font) throw new Error('Build the site before generating the share image.');
const fontData = (await readFile(new URL(`../dist/assets/${font}`, import.meta.url))).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>@font-face{font-family:Nunito;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:200 900}*{box-sizing:border-box}body{margin:0;background:#f8f9f5;color:#303b30;font-family:Nunito,sans-serif}.card{width:1200px;height:630px;display:flex;padding:64px;gap:24px;align-items:center}.text{width:550px}.name{font-size:28px;font-weight:800;letter-spacing:-1px;margin-bottom:45px}h1{font-size:66px;line-height:1.12;letter-spacing:-3px;margin:0 0 24px;font-weight:800}p{font-size:24px;line-height:1.5;color:#687063;margin:0;max-width:490px}.network{display:inline-block;margin-top:40px;font-size:18px;color:#3e5739;background:#e8eedf;padding:9px 20px;border-radius:30px}.art{width:470px;height:470px;background:#e8eedf;border-radius:50%;display:flex;align-items:center}.art svg{width:470px;height:auto}</style><div class="card"><div class="text"><div class="name">squeek peek</div><h1>Small paws.<br>Big blocks.</h1><p>A little window into Squeektoshi’s work on Squeekchain.</p><div class="network">Sepolia testnet · Live SqueekCore data</div></div><div class="art">${hamster}</div></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og-image.png' });
  console.log('Generated public/og-image.png (1200 × 630)');
} finally { await browser.close(); }
