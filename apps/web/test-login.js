const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });

  await p.goto('http://localhost:3000/login');
  await p.waitForTimeout(800);
  await p.fill('input[type="email"]', 'digantakumar1974borah@gmail.com');
  await p.fill('input[type="password"]', 'Admin@1234!');
  await p.click('button[type="submit"]');

  // Wait for navigation to /
  await p.waitForURL('http://localhost:3000/', { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(2000);

  await p.screenshot({ path: 'C:/Users/ADMINI~1/AppData/Local/Temp/app-loggedin.png', fullPage: true });
  console.log('Final URL:', p.url());
  await b.close();
})();
