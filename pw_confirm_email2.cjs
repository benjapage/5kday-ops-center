const { chromium } = require('playwright');
(async () => {
  // Use headless Playwright chromium (not user's Chrome) to log in to Supabase
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'C:/Users/Usuario/Desktop/5kday-ops-center';

  console.log('Going to Supabase login...');
  await page.goto('https://supabase.com/dashboard/sign-in', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${base}/conf2_01_signin.png`, fullPage: false });
  console.log('URL:', page.url());

  // Look for email/password login fields
  const emailField = await page.$('input[type="email"], input[name="email"]');
  console.log('EMAIL_FIELD:', !!emailField);

  if (emailField) {
    // We'd need Supabase dashboard credentials - we don't have them
    console.log('Found login form - need Supabase dashboard credentials');
  }

  // Check current body
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 400));
  console.log('BODY:', bodyText);

  await page.screenshot({ path: `${base}/conf2_02_page.png`, fullPage: false });
  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
