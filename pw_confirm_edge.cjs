const { chromium } = require('playwright');
(async () => {
  // Try using Edge user data
  const browser = await chromium.launchPersistentContext(
    'C:/Users/Usuario/AppData/Local/Microsoft/Edge/User Data',
    {
      headless: false,
      channel: 'msedge',
      viewport: { width: 1280, height: 900 },
      args: ['--profile-directory=Default']
    }
  );

  const page = await browser.newPage();
  const base = 'C:/Users/Usuario/Desktop/5kday-ops-center';

  console.log('Navigating to Supabase SQL editor via Edge...');
  await page.goto('https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/auth/users', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${base}/edge_01_users.png`, fullPage: false });
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('BODY:', bodyText);

  // Check if we see user management page
  const isOnDashboard = page.url().includes('supabase.com/dashboard');
  console.log('ON_DASHBOARD:', isOnDashboard);

  if (page.url().includes('/auth/users')) {
    // We're on the users page - look for the user
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${base}/edge_02_userspage.png`, fullPage: false });
    const usersText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('USERS_PAGE:', usersText);
  }

  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
