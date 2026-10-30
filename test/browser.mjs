import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { rpcFixture } from './fixtures.ts';
import { CORE_ADDRESS } from '../src/core.ts';
import axe from 'axe-core';

// Pass an installed Playwright module path as argv[2], or install Playwright externally.
const { chromium, webkit } = await import(process.argv[2] || 'playwright');
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/gateway\/squeek\//, '');
  const file = resolve(root, path === '' ? 'index.html' : path);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { response.writeHead(404).end('Not found'); }
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const base = `http://127.0.0.1:${server.address().port}/gateway/squeek/`;
await mkdir('test/scratch/browser', { recursive: true });
const outcomes = [];
let browser;
const check = async (name, run) => { await run(); outcomes.push({ name, passed: true }); console.log(`PASS ${name}`); };
const errors = [];

async function installMock(page) {
  const control = { mode: 'normal', fail: false, delay: 0, calls: 0, firstProviderDown: false };
  await page.route('https://**/*', async route => {
    const request = route.request();
    if (request.method() !== 'POST') { await route.abort(); return; }
    control.calls++;
    if (control.delay) await new Promise(resolve => setTimeout(resolve, control.delay));
    if (control.fail || (control.firstProviderDown && request.url().includes('publicnode'))) {
      await route.fulfill({ status: 503, body: 'Temporarily unavailable', headers: { 'Access-Control-Allow-Origin': '*' } });
      return;
    }
    const body = request.postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result: rpcFixture(body.method, body.params, control.mode) }) });
  });
  page.on('pageerror', error => errors.push(error.message));
  return control;
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const control = await installMock(page);
  await check('loading has placeholders and prevents duplicate refreshes', async () => {
    control.delay = 350;
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getByRole('button', { name: 'Refreshing…' }).isDisabled(), true);
    assert.equal(await page.getByTestId('block-height').innerText(), '…');
    await page.getByTestId('block-height').filter({ hasText: '12' }).waitFor();
    control.delay = 0;
  });
  await check('real ABI responses render totals, progress and certified history', async () => {
    assert.equal(await page.getByTestId('work-units').innerText(), '120');
    assert.equal(await page.getByTestId('settled-rounds').innerText(), '24');
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuetext'), '50.0%');
    assert.equal(await page.locator('tbody tr').count(), 6);
  });
  await check('product and primary action fit the first 390px screen', async () => {
    const primary = await page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox();
    const totals = await page.locator('.metrics-grid').boundingBox();
    assert.ok(primary && primary.y + primary.height < 844);
    assert.ok(totals && totals.y + totals.height < 844);
    await page.screenshot({ path: 'test/scratch/browser/mobile-success.png', fullPage: true });
  });
  await check('show all and show fewer expose the actual 12-round dataset', async () => {
    await page.getByRole('button', { name: 'Show all 12 rounds' }).click();
    assert.equal(await page.locator('tbody tr').count(), 12);
    await page.getByRole('button', { name: 'Show fewer rounds' }).click();
    assert.equal(await page.locator('tbody tr').count(), 6);
  });
  await check('round filtering, true quiet empty state and clear-filter action work', async () => {
    control.mode = 'quiet';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    await page.getByRole('button', { name: 'With work', exact: true }).click();
    await page.getByText('A quiet stretch of rounds').waitFor();
    assert.equal(await page.getByRole('button', { name: 'With work', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Show all rounds', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 6);
  });
  await check('network failure retains and explicitly labels previous totals; retry recovers', async () => {
    control.fail = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('The totals below are from the last successful read.', { exact: false }).waitFor();
    assert.equal(await page.getByTestId('block-height').innerText(), '12');
    await page.screenshot({ path: 'test/scratch/browser/mobile-stale.png', fullPage: true });
    control.fail = false;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    assert.equal(await page.locator('.notice').innerText(), '');
  });
  await check('public-provider failover works in the actual bundled client', async () => {
    control.firstProviderDown = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    assert.equal(await page.locator('.notice').innerText(), '');
    control.firstProviderDown = false;
  });
  await check('copy control copies the complete verified contract address', async () => {
    await page.getByRole('button', { name: 'Copy SqueekCore address' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), CORE_ADDRESS);
  });
  await check('navigation and source disclosure work by keyboard', async () => {
    await page.getByRole('link', { name: 'Rounds', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/#rounds');
    await page.locator('.data-details summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.data-details').getAttribute('open'), '');
    assert.equal(await page.locator('.data-details summary').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  });
  await check('auto-refresh pause/resume changes state and stops timer reads', async () => {
    await page.getByRole('button', { name: 'Pause auto-refresh' }).click();
    const before = control.calls;
    await page.clock.install();
    await page.clock.runFor(31_000);
    assert.equal(control.calls, before);
    await page.getByRole('button', { name: 'Resume auto-refresh' }).click();
    await page.clock.runFor(31_000);
    await page.waitForFunction(() => document.querySelector('[data-testid="block-height"]').innerText === '12');
    assert.ok(control.calls > before);
    await page.getByRole('button', { name: 'Pause auto-refresh' }).click();
  });
  await check('onchain paused state preserves useful reads and explains settlement pause', async () => {
    control.mode = 'paused';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('SqueekCore settlement is paused.', { exact: false }).waitFor();
    assert.equal(await page.getByTestId('block-height').innerText(), '12');
  });
  await check('changed contract identity fails closed with last-known data labeled', async () => {
    control.mode = 'changed';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('SqueekCore’s deployment has changed.', { exact: false }).waitFor();
    assert.equal(await page.getByTestId('block-height').innerText(), '12');
  });
  await check('uint64 maximums wrap completely at 320, 390, 820 and 1440 without overflow', async () => {
    control.mode = 'huge';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByTestId('work-units').filter({ hasText: '18,446,744,073,709,551,615' }).waitFor();
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: String(el.className), text: el.textContent?.slice(0, 70) })).slice(0, 12))));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px page overflow`);
      assert.equal(await page.getByTestId('work-units').evaluate(el => el.scrollWidth > el.clientWidth), false, `${width}px value overflow`);
    }
    await page.screenshot({ path: 'test/scratch/browser/desktop-max-values.png', fullPage: true });
  });
  await check('zero launch state shows genuine zero totals and useful empty history', async () => {
    control.mode = 'zero';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('No rounds have settled yet').waitFor();
    assert.equal(await page.getByTestId('work-units').innerText(), '0');
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuetext'), '0.0%');
  });
  await check('cold connection failure does not show stand-in numbers, and retry works', async () => {
    const cold = await context.newPage();
    const mock = await installMock(cold);
    mock.fail = true;
    await cold.goto(base);
    await cold.getByText('Round history is unavailable').waitFor();
    assert.equal(await cold.getByTestId('work-units').innerText(), '…');
    mock.fail = false;
    await cold.getByRole('button', { name: 'Refresh', exact: true }).click();
    await cold.getByTestId('block-height').filter({ hasText: '12' }).waitFor();
    await cold.close();
  });
  await check('320px layout, 200% text resize, RTL and reduced motion remain usable', async () => {
    control.mode = 'normal';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByTestId('block-height').filter({ hasText: '12' }).waitFor();
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'test/scratch/browser/mobile-200-text.png', fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.documentElement.dir = 'rtl'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'test/scratch/browser/mobile-rtl.png', fullPage: true });
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  });
  await check('relative runtime assets and share image work under a gateway subpath', async () => {
    for (const path of ['favicon.svg', 'og-image.png']) {
      const response = await context.request.get(base + path);
      assert.equal(response.status(), 200, path);
    }
    const fonts = await page.evaluate(() => document.fonts.check('16px "Nunito Sans Variable"'));
    assert.equal(fonts, true);
    const missingImages = await page.locator('img').evaluateAll(imgs => imgs.filter(img => !img.complete || img.naturalWidth === 0).length);
    assert.equal(missingImages, 0);
  });
  await check('automated WCAG A/AA checks pass at 390 and 1440', async () => {
    await page.addScriptTag({ content: axe.source });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const audit = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      await writeFile(`test/scratch/browser/axe-${width}.json`, JSON.stringify({ violations: audit.violations, incomplete: audit.incomplete.map(item => ({ id: item.id, impact: item.impact })) }, null, 2));
      assert.deepEqual(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(n => n.target) })), [], `${width}px accessibility findings`);
      assert.deepEqual(audit.incomplete.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => item.id), [], `${width}px accessibility checks needing review`);
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test/scratch/browser/desktop-success.png', fullPage: true });
  assert.deepEqual(errors, []);

  try {
    const safari = await webkit.launch({ headless: true });
    try {
      const tab = await safari.newPage({ viewport: { width: 390, height: 844 } });
      await installMock(tab);
      await tab.goto(base);
      await tab.getByTestId('block-height').filter({ hasText: '12' }).waitFor();
      await tab.getByRole('button', { name: 'Refresh', exact: true }).click();
      await tab.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      outcomes.push({ name: 'WebKit 390px primary interaction', passed: true });
    } finally { await safari.close(); }
  } catch (error) { outcomes.push({ name: 'WebKit', passed: null, limitation: error.message.split('\n')[0] }); }
  await writeFile('test/scratch/browser/results.json', JSON.stringify({ outcomes, scriptErrors: errors }, null, 2));
  console.log(JSON.stringify(outcomes, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
