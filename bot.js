const puppeteer = require('puppeteer');
const fs = require('fs');

const MEETING_LINK = process.argv[2];

if (!MEETING_LINK) {
  console.error("❌ Please provide a meeting link.");
  process.exit(1);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox', '--start-maximized'],
    defaultViewport: null
  });

  const page = await browser.newPage();

  // Load cookies from saved session
  const cookiesFilePath = 'cookies.json';
  if (fs.existsSync(cookiesFilePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesFilePath));
    await page.setCookie(...cookies);
    console.log('🍪 Loaded cookies');
  } else {
    console.error('❌ No cookies.json found. Run save-cookies.js first.');
    await browser.close();
    return;
  }

  // Go to the Google Meet link
  try {
    await page.goto(MEETING_LINK, { waitUntil: 'networkidle2' });
    console.log("🌐 Opened meeting page");

    // Mute mic and cam
    await page.keyboard.down('Control');
    await page.keyboard.press('d');
    await page.keyboard.up('Control');

    await page.keyboard.down('Control');
    await page.keyboard.press('e');
    await page.keyboard.up('Control');

    // Wait for and click Join/Ask button
    await page.waitForTimeout(5000);
    const [joinButton] = await page.$x("//span[contains(text(), 'Join now') or contains(text(), 'Ask to join')]/ancestor::button");
    if (joinButton) {
      await joinButton.click();
      console.log("✅ Bot has joined the meeting:", MEETING_LINK);
    } else {
      console.log("❌ Could not find the Join button.");
    }

  } catch (err) {
    console.error("❌ Error while joining:", err.message);
  }
})();
