const { chromium } = require('playwright');
(async () => {
  // Launch non-headless to see what's happening
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Try to load Chrome's cookies for supabase.com
  const page = await context.newPage();
  const base = 'C:/Users/Usuario/Desktop/5kday-ops-center';

  // First try to get to the Supabase dashboard
  await page.goto('https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/settings/api', {
    waitUntil: 'networkidle',
    timeout: 20000
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${base}/sb_api_settings.png`, fullPage: true });
  console.log('URL:', page.url());

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('BODY:', bodyText);

  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
