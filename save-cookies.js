// save-cookies.js
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized'],
    defaultViewport: null
  });

  const page = await browser.newPage();

  // Open Google login page
  await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });

  console.log('⚠️ Please manually log in to your Google account in the opened browser...');

  // Give yourself 60 seconds to complete login
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Save cookies after login
  const cookies = await page.cookies();
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
  console.log('✅ Cookies saved to cookies.json');

  await browser.close();
})();
