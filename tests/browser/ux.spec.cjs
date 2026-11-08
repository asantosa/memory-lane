const { test, expect } = require('@playwright/test');
const path = require('node:path');
async function fitsViewport(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  page.on('pageerror', error => { throw error; });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Today, empty collection, and capture remain usable', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('yesterday');
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true });
  const nav = page.getByRole('navigation', { name: testInfo.project.use.viewport.width > 800 ? 'Main navigation' : 'Mobile navigation', exact: true });
  await nav.getByRole('button', { name: 'Memories', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your story starts here.' })).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true });
  await page.getByRole('button', { name: 'Add your first memory' }).click();
  await expect(page.getByRole('list', { name: 'Capture progress' })).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('capture.png'), fullPage: true });
});

test('featured memory opens and reveals its story', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Open One more hour by the lake', exact: true }).click();
  await page.getByRole('button', { name: 'Read the story', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One more hour by the lake', exact: true })).toBeVisible();
  await expect(page.getByText('We packed sandwiches', { exact: false })).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('revisit.png'), fullPage: true });
});

async function startWriting(page) {
  await page.locator('.intro-actions [data-page="add"]').click();
  await page.getByRole('button', { name: 'Continue with words' }).click();
}
async function saveStory(page, title = 'Sunday at home') {
  await page.getByLabel('What would you call this moment?').fill(title);
  await page.getByLabel('What would you like to remember?').fill('Warm bread and everyone around the table.');
  await page.getByRole('button', { name: 'Review this memory' }).click();
  await page.getByRole('button', { name: 'Keep this memory', exact: false }).click();
}

test('write, save, search, revisit, edit, export, and reload', async ({ page }, testInfo) => {
  await startWriting(page);
  await page.getByText('Add date, place & people').click();
  await page.getByLabel('When was it?').fill('Summer 1998');
  await page.getByLabel('Where was it?').fill('Lake Tahoe');
  await page.getByLabel('Who was there?').fill('Mum and Jamie');
  await saveStory(page);
  await expect(page.locator('.library-grid')).toContainText('Sunday at home');
  await page.getByLabel('Find a memory').fill('Tahoe');
  await expect(page.locator('#search-count')).toHaveText('1 memory found');
  await page.getByLabel('Find a memory').fill('no-such-memory');
  await expect(page.getByRole('heading', { name: 'No memories found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Open Sunday at home', exact: true }).click();
  await page.getByRole('button', { name: 'A little hint', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.hint')).toContainText('Mum and Jamie');
  await expect(page.getByRole('button', { name: 'A little hint', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Read the story', exact: true }).click();
  await expect(page.locator('.story-reveal')).toContainText('Warm bread');
  await page.getByRole('button', { name: 'Edit this memory' }).click();
  await page.getByLabel('What would you call this moment?').fill('Sunday with Mum');
  await page.getByRole('button', { name: 'Review this memory' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'));
  expect(backup.memories).toHaveLength(1);
  expect(backup.memories[0]).toMatchObject({ title: 'Sunday with Mum', location: 'Lake Tahoe', people: 'Mum and Jamie' });
  await page.reload();
  await page.getByRole('button', { name: 'Open Sunday with Mum', exact: true }).click();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('saved-memory.png'), fullPage: true });
});

test('draft recovery and required title validation', async ({ page }) => {
  await startWriting(page);
  await page.getByLabel('What would you call this moment?').fill('   ');
  await page.getByRole('button', { name: 'Review this memory' }).click();
  await expect(page.getByRole('alert')).toContainText('Give this moment a name');
  await expect(page.getByLabel('What would you call this moment?')).toBeFocused();
  await page.getByLabel('What would you call this moment?').fill('Unfinished afternoon');
  await page.reload();
  await page.getByRole('button', { name: 'Continue your draft' }).click();
  await expect(page.getByLabel('What would you call this moment?')).toHaveValue('Unfinished afternoon');
});

test('actual photo import, cover selection, removal, and saving', async ({ page }, testInfo) => {
  await page.locator('.intro-actions [data-page="add"]').click();
  await page.locator('#photo').setInputFiles([path.resolve('web/assets/lakeside-demo.png'), path.resolve('web/assets/lakeside-boat.png')]);
  await expect(page.locator('.photo-count')).toContainText('2 of 12');
  await page.getByRole('button', { name: 'Use photo 2 as cover' }).click();
  await expect(page.locator('.photo-tile').first()).toContainText('Cover');
  await page.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
  await expect(page.locator('.photo-count')).toContainText('1 of 12');
  await page.getByRole('button', { name: 'Tell the story' }).click();
  await saveStory(page, 'Our lakeside afternoon');
  await expect(page.locator('.library-grid img')).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('photo-library.png'), fullPage: true });
});

test('guided demo completes without saving fictional memories', async ({ page }) => {
  await page.getByRole('button', { name: 'Try a guided demo' }).click();
  await page.getByRole('button', { name: /Photos & albums/ }).click();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: 'Use 2 photos' }).click();
  await page.getByLabel('A name for this moment').fill('Demo only');
  await page.getByRole('button', { name: 'Keep this demo moment' }).click();
  await page.getByRole('button', { name: 'View demo photo 2' }).click();
  await page.getByRole('button', { name: 'Read the story', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s the heart of Memory Lane.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('album-echo-memories'))).toBeNull();
  await fitsViewport(page);
});

test('themes, prompt handoff, and keyboard navigation', async ({ page, browserName }) => {
  if(browserName === 'webkit') await page.getByRole('link', { name: 'Skip to content' }).focus();
  else await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: 'Your style', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#style-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Your style', exact: true }).click();
  await page.getByRole('button', { name: /Explorer Colorful/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'explorer');
  await expect(page.getByRole('button', { name: 'Your style', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'explorer');
  await page.getByRole('button', { name: 'Write a memory' }).click();
  await expect(page.locator('.writing-prompt')).toHaveText('What adventure would you love to relive?');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await fitsViewport(page);
});

test('storage failure keeps the draft and explains recovery', async ({ page }) => {
  await startWriting(page);
  await page.getByLabel('What would you call this moment?').fill('Keep my draft');
  await page.getByRole('button', { name: 'Review this memory' }).click();
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if(key === 'album-echo-memories') throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, key, value); }; });
  await page.getByRole('button', { name: 'Keep this memory', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('memory-lane-draft')).title)).toBe('Keep my draft');
});

test('install guidance and offline reload preserve saved memories', async ({ page, context }) => {
  await startWriting(page);
  await saveStory(page, 'Offline afternoon');
  await page.getByRole('button', { name: 'Use as an app', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Add to Home Screen');
  await expect(page.locator('#app-availability')).toContainText('Ready for offline use');
  await page.getByRole('button', { name: 'Close app instructions' }).click();
  // A reload after activation also covers first visits that were not yet controlled.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await page.request.get('/' + icon.src)).ok()).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#connection-status')).toBeVisible();
  await page.getByRole('button', { name: 'Open Offline afternoon', exact: true }).click();
  await page.getByRole('button', { name: 'Read the story', exact: true }).click();
  await expect(page.locator('.story-reveal')).toContainText('Warm bread');
  await fitsViewport(page);
});

test('key screens meet automated WCAG AA accessibility checks', async ({ page }) => {
  const AxeBuilder = require('@axe-core/playwright').default;
  const audit = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  };
  for(const theme of ['quiet','explorer','storykeeper']) {
    await page.getByRole('button', { name: 'Your style', exact: true }).click();
    await page.locator(`[data-theme="${theme}"]`).click();
    await audit();
  }
  await startWriting(page);
  await audit();
  await page.locator('.voice-disclosure summary').click();
  await audit();
  await saveStory(page);
  await audit();
  await page.getByRole('button', { name: 'Use as an app', exact: true }).click();
  await audit();
});

test('unsupported uploads explain the problem without losing photos', async ({ page }) => {
  await page.locator('.intro-actions [data-page="add"]').click();
  await page.locator('#photo').setInputFiles(path.resolve('web/assets/lakeside-demo.png'));
  await expect(page.locator('.photo-count')).toContainText('1 of 12');
  await page.locator('#files').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Not a photo') });
  await expect(page.getByRole('alert')).toContainText('No image files');
  await expect(page.locator('.photo-count')).toContainText('1 of 12');
});

test('installed app mode remains usable in landscape', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)' ? { matches: true } : original(query);
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'App & offline access' })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await fitsViewport(page);
  await startWriting(page);
  await saveStory(page, 'A'.repeat(100));
  await fitsViewport(page);
  await page.getByRole('button', { name: 'Open ' + 'A'.repeat(100), exact: true }).click();
  await page.getByRole('button', { name: 'Read the story', exact: true }).click();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('standalone-landscape.png'), fullPage: true });
});
