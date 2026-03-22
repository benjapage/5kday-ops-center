const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'warn') consoleMessages.push(`[warn] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  const baseDir = 'C:/Users/Usuario/Desktop/5kday-ops-center';

  // Login page
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${baseDir}/ss_01_login.png`, fullPage: true });
  console.log('LOGIN:', await page.evaluate(() => document.body.innerText.substring(0, 300)));

  // Dashboard
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${baseDir}/ss_02_dashboard.png`, fullPage: true });
  const dashboardText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  console.log('DASHBOARD:', dashboardText);

  // Meta Assets
  await page.goto('http://localhost:5173/meta', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${baseDir}/ss_03_meta.png`, fullPage: true });
  const metaText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('META:', metaText);

  // Financial
  await page.goto('http://localhost:5173/financial', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${baseDir}/ss_04_financial.png`, fullPage: true });
  const financialText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('FINANCIAL:', financialText);

  // Pipeline
  await page.goto('http://localhost:5173/pipeline', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${baseDir}/ss_05_pipeline.png`, fullPage: true });
  const pipelineText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('PIPELINE:', pipelineText);

  // Team
  await page.goto('http://localhost:5173/team', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${baseDir}/ss_06_team.png`, fullPage: true });
  const teamText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('TEAM:', teamText);

  console.log('ERRORS:', JSON.stringify(errors));
  console.log('WARNINGS:', JSON.stringify(consoleMessages));
  await browser.close();
})().catch(e => console.error('PLAYWRIGHT_ERROR:', e.message));
