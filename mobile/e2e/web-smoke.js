/**
 * End-to-end smoke test of the app in the web preview: signs in with the
 * development account and drives real flows (routine → log a set → finish,
 * food search/quick add/recipe, weigh-in, plan, trends, progress, friends,
 * legal), failing on any page error, console error or failed API call.
 *
 * Prerequisites: the API running locally with seed data
 * (`python3 backend/scripts/seed_dev_data.py`), `npx expo start --web`, and
 * Google Chrome installed. Then: `npm run e2e:web` (screenshots go to e2e/screenshots).
 *
 * The web preview can't exercise native-only features (camera scanning, push,
 * share sheet); see docs/testing.md for the on-device checklist.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const BASE = process.env.E2E_URL ?? 'http://localhost:8081';
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const results = [];
const errors = [];
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#error-toast{display:none!important}'; document.head.appendChild(st); }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`[${current}] pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/cannot be a descendant|cannot contain a nested|React does not recognize|hydration|Unexpected text node/.test(m.text())) errors.push(`[${current}] console: ${m.text().slice(0, 160)}`); });
  p.on('response', (r) => { if (r.url().includes(':8080/') && r.status() >= 400 && r.status() !== 404) errors.push(`[${current}] HTTP ${r.status()} ${r.request().method()} ${r.url().split(':8080')[1]}`); });
  p.on('dialog', (d) => d.accept());
  let current = 'start';
  const vis = (t) => p.locator(`text=${t} >> visible=true`).first();
  const label = (l) => p.getByLabel(l, { exact: true }).locator('visible=true').first();
  const go = async (path, wait = 2500) => { await p.goto(BASE + path); await p.waitForTimeout(wait); };
  const step = async (name, fn) => {
    current = name;
    try { await fn(); results.push(`PASS ${name}`); }
    catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
    await p.screenshot({ path: `${out}/${String(results.length).padStart(2, '0')}-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  };
  const expectText = async (t, timeout = 8000) => { await p.locator(`text=${t} >> visible=true`).first().waitFor({ timeout }); };

  await step('sign in', async () => {
    await go('/', 3000);
    if (await p.getByText('Use development account').count()) await p.getByText('Use development account').click();
    await expectText('Ready to lift?');
  });
  await step('weekly goal', async () => {
    await go('/profile');
    await p.getByText('4×', { exact: true }).click();
    await go('/', 3000);
    await expectText('THIS WEEK');
  });
  await step('start routine', async () => {
    await p.getByText('Start', { exact: true }).last().click();
    await expectText('Today:');
  });
  await step('sticky note carried from last session', async () => {
    await p.locator('textarea >> visible=true').first().waitFor({ timeout: 8000 });
    const value = await p.locator('textarea >> visible=true').first().inputValue();
    if (!value.includes('Index fingers')) throw new Error(`note was "${value}"`);
  });
  await step('plate calculator', async () => {
    await label('Plate calculator').click();
    await expectText('EACH SIDE');
    await p.goBack();
    await p.waitForTimeout(1500);
  });
  await step('tick a set from the suggestion', async () => {
    await label('Set 1 complete').click();
    await p.waitForTimeout(800);
  });
  await step('finish workout', async () => {
    await p.getByText('Finish', { exact: true }).first().click();
    await expectText('Done', 10000);
  });
  await step('workout complete → done', async () => {
    await vis('Done').click();
    await p.waitForTimeout(1500);
    await expectText('Recent');
  });
  await step('history shows it', async () => {
    await go('/history');
    await expectText('TODAY');
  });
  await step('food: search and log', async () => {
    await go('/food/add?meal=SNACK');
    await p.getByPlaceholder('Search foods or brands').last().fill('nutella');
    await p.waitForTimeout(2500);
    await vis('Nutella').click();
    await p.getByText('Log food', { exact: true }).last().click();
    await p.waitForTimeout(2500);
    await expectText('Nutella');
  });
  await step('food: quick add', async () => {
    await go('/food/quick?meal=LUNCH');
    await p.getByPlaceholder('e.g. Burrito bowl').fill('Test burrito');
    await p.getByPlaceholder('0').first().fill('650');
    await vis('Log').click();
    await p.waitForTimeout(2500);
    await expectText('Test burrito');
  });
  await step('water +1', async () => {
    await label('Add a glass of water').click();
    await p.waitForTimeout(800);
  });
  await step('create recipe', async () => {
    await go('/food/recipe/new');
    await p.getByPlaceholder('e.g. Chicken rice bowl').fill('E2E bowl');
    await vis('Add ingredient').click();
    await p.waitForTimeout(1500);
    await p.getByPlaceholder('Search foods or brands').last().fill('nutella');
    await p.waitForTimeout(2500);
    await vis('Nutella').click();
    await p.waitForTimeout(1500);
    await expectText('INGREDIENTS');
    await vis('Save recipe').click();
    await p.waitForTimeout(2000);
    await go('/food/recipes');
    await expectText('E2E bowl');
  });
  await step('weigh-in', async () => {
    await go('/weigh-in');
    const input = p.locator('input >> visible=true').first();
    await input.fill('176.2');
    await vis('Save').click();
    await p.waitForTimeout(2000);
  });
  await step('edit plan and save', async () => {
    await go('/food/goals', 3000);
    await vis('Save changes').click();
    await p.waitForTimeout(2500);
  });
  await step('my plan', async () => { await go('/food/plan'); await expectText('YOUR DETAILS'); });
  await step('trends', async () => { await go('/food/trends', 3000); await expectText('ON TARGET'); });
  await step('progress strength', async () => {
    await go('/progress');
    await vis('Strength').click();
    await p.waitForTimeout(2500);
    await expectText('Bench Press');
  });
  await step('exercise detail', async () => { await vis('Bench Press').click(); await p.waitForTimeout(2500); await expectText('ESTIMATED ONE-REP MAX'); });
  await step('progress weight', async () => { await go('/progress'); await vis('Weight').click(); await expectText('TREND WEIGHT'); });
  await step('progress nutrition', async () => { await vis('Nutrition').click(); await expectText('ON TARGET'); });
  await step('friends', async () => { await go('/friends', 3000); await expectText('Sam'); });
  await step('friend profile', async () => { await vis('Sam').click(); await p.waitForTimeout(2500); });
  await step('shared recipes', async () => { await go('/food/recipes'); await vis('From friends').click(); await expectText('Chicken rice meal prep'); });
  await step('routine save as from history', async () => {
    await go('/history');
    await p.locator('text=TODAY >> visible=true').first().click();
    await p.waitForTimeout(2000);
    await vis('Save as routine').click();
    await p.waitForTimeout(2500);
    await expectText('New Routine');
  });
  await step('profile + legal', async () => { await go('/profile/legal/terms'); await expectText('Not medical advice'); });
  await b.close();
  console.log(results.join('\n'));
  console.log('\nErrors:\n' + ([...new Set(errors)].join('\n') || 'none'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed}/${results.length} steps passed`);
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e.message); console.log(results.join('\n')); process.exit(1); });
