import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { exec } from "child_process";

puppeteer.use(StealthPlugin());

const meetingLink = process.argv[2];

if (!meetingLink) {
  console.error("❌ No meeting link provided!");
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: false,
  args: [
    "--incognito",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--no-sandbox",
    "--disable-setuid-sandbox",
  ],
});

const page = (await browser.pages())[0];

await page.goto(meetingLink, {
  waitUntil: "networkidle2",
  timeout: 120000,
});

try {
  // Step 1: Enter name
  await page.waitForSelector('input[placeholder="Your name"]', { timeout: 15000 });
  await page.type('input[placeholder="Your name"]', 'HireBot', { delay: 100 });
  console.log("✍️ Entered name: HireBot");

  // Step 2: Wait and click join button (robust fix)
  try {
    await page.waitForSelector('span.UywwFc-RLmnJb, button[jsname="Qx7uuf"]', { timeout: 15000 });

    const joinButton =
      (await page.$('span.UywwFc-RLmnJb')) ||
      (await page.$('button[jsname="Qx7uuf"]'));

    if (joinButton) {
      await joinButton.click();
      console.log("✅ Clicked the join button");
    } else {
      throw new Error("Join button not found");
    }
  } catch (joinErr) {
    console.error("❌ Error clicking join button:", joinErr.message);
    throw joinErr;
  }

  console.log("🕒 In meeting...");

  // 🎙️ Start FFmpeg Recording (delay to make sure bot's inside)
  setTimeout(() => {
    exec('ffmpeg -f dshow -i audio="Stereo Mix (Realtek(R) Audio)" -y asset/audio/meeting_record.mp3', (err) => {
      if (err) console.error("❌ FFmpeg error:", err.message);
      else console.log("✅ FFmpeg finished recording.");
    });
    console.log("🎙️ FFmpeg recording started!");
  }, 3000);

  // ⏳ Wait until meeting ends
  let meetingEnded = false;

  while (!meetingEnded) {
    if (page.isClosed()) break;

    try {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (
        pageText.includes("You left the call") ||
        pageText.includes("has ended")
      ) {
        meetingEnded = true;
        console.log("🚪 Meeting ended detected!");
        break;
      }
    } catch (e) {
      console.warn("⚠️ Page/frame detached.");
      break;
    }

    await new Promise((res) => setTimeout(res, 5000));
  }

  // Kill FFmpeg
  exec('taskkill /IM ffmpeg.exe /F', (err) => {
    if (err) console.warn("⚠️ FFmpeg may have already exited.");
    else console.log("🛑 FFmpeg stopped.");
  });

  await browser.close();
  console.log("✅ Meeting automation done. Browser closed.");
} catch (err) {
  console.error("❌ Error:", err.message);
  await browser.close();
  exec('taskkill /IM ffmpeg.exe /F', () => {
    console.log("🛑 FFmpeg stopped after error.");
  });
}
