const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launchPersistentContext(
    'C:/Users/Usuario/AppData/Local/Google/Chrome/User Data',
    {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1280, height: 800 },
      args: ['--profile-directory=Default']
    }
  );

  const page = await browser.newPage();
  const base = 'C:/Users/Usuario/Desktop/5kday-ops-center';

  console.log('Navigating to Supabase SQL editor...');
  await page.goto('https://supabase.com/dashboard/project/zbbebrdvbueysjkzhqxv/sql/new', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${base}/confirm_01_sqleditor.png`, fullPage: false });
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('BODY_TEXT:', bodyText);

  // Wait for editor to load
  const editorLoaded = await page.waitForSelector('.monaco-editor, [role="textbox"], textarea', { timeout: 15000 }).catch(() => null);
  console.log('EDITOR_LOADED:', !!editorLoaded);

  if (editorLoaded) {
    await page.screenshot({ path: `${base}/confirm_02_editor.png`, fullPage: false });

    const sql = `UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'benjapagellafangio@gmail.com';`;

    // Click into the monaco editor
    const monacoEditor = await page.$('.monaco-editor .view-lines, .monaco-editor [role="textbox"]');
    if (monacoEditor) {
      await monacoEditor.click();
    } else {
      await editorLoaded.click();
    }

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);
    await page.keyboard.type(sql);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${base}/confirm_03_typed.png`, fullPage: false });

    // Try Ctrl+Enter to run
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${base}/confirm_04_result.png`, fullPage: false });
    console.log('SQL executed');

    const resultText = await page.evaluate(() => {
      const result = document.querySelector('[data-testid="result"], .result-panel, .output-panel, [class*="result"]');
      return result ? result.innerText.substring(0, 300) : 'no result element found';
    });
    console.log('RESULT:', resultText);
  } else {
    // Maybe we're not logged in
    await page.screenshot({ path: `${base}/confirm_02_notloaded.png`, fullPage: false });
    console.log('Editor not found - may not be logged in to Supabase');
  }

  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
