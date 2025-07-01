// recordMeetingWithAudio.js

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

puppeteer.use(StealthPlugin());

const meetingLink = process.argv[2];

if (!meetingLink) {
  console.error("❌ No meeting link provided!");
  process.exit(1);
}

const outputDir = path.resolve("asset/audio");
const audioPath = path.join(outputDir, "meeting_audio.wav");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 🎙️ Start system audio recording using ffmpeg
console.log("🎙️ Starting FFmpeg audio recording...");
const ffmpeg = spawn("ffmpeg", [
  "-f", "dshow",
  "-i", "audio=Stereo Mix (Realtek(R) Audio)",
  "-ac", "1",
  "-ar", "16000",
  "-acodec", "pcm_s16le",
  "-t", "3600",
  "-y",
  audioPath
]);

ffmpeg.stderr.on("data", (data) => {
  const msg = data.toString();
  if (!msg.includes("size=")) {
    console.log(`🔊 ffmpeg: ${msg.trim()}`);
  }
});

ffmpeg.on("close", (code) => {
  console.log(`🎧 FFmpeg exited with code ${code}`);
});

// 🚀 Launch browser to join meeting
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      // '--incognito', // ❌ disable incognito to prevent sign-in popup
      // "--use-fake-ui-for-media-stream",
      // "--use-fake-device-for-media-stream",
      // "--mute-audio",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-running-insecure-content",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor"
    ],
  });

  const page = (await browser.pages())[0];

  // Removed overridePermissions because it causes ProtocolError in some Puppeteer setups
  // const context = browser.defaultBrowserContext();
  // await context.overridePermissions(meetingLink, ['microphone', 'camera']);

  await page.goto(meetingLink, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  try {
    await page.waitForSelector('input[placeholder="Your name"]', { timeout: 15000 });
    await page.type('input[placeholder="Your name"]', 'HireBot', { delay: 100 });
    console.log("✍️ Entered name");

    // Turn off mic and camera if they're on
    try {
      const micBtn = await page.$('[aria-label="Turn off microphone (ctrl + d)"]');
      if (micBtn) {
        await micBtn.click();
        console.log("🔇 Mic turned off");
      }
      const camBtn = await page.$('[aria-label="Turn off camera (ctrl + e)"]');
      if (camBtn) {
        await camBtn.click();
        console.log("📷 Camera turned off");
      }
    } catch (micCamErr) {
      console.warn("⚠️ Could not find mic/cam toggle buttons.");
    }

    const joinButton = await page.$('span.UywwFc-RLmnJb') || await page.$('button[jsname="Qx7uuf"]');
    if (joinButton) {
      await joinButton.click();
      console.log("✅ Joined the meeting");
    }

    await new Promise(res => setTimeout(res, 5000));
    console.log("🕒 In meeting... FFmpeg is recording audio");

    let meetingEnded = false;
    while (!meetingEnded) {
      if (page.isClosed()) break;
      try {
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes("You left the call") || pageText.includes("Meeting ended")) {
          meetingEnded = true;
          console.log("🚪 Meeting ended detected");
          break;
        }
      } catch (e) {
        console.warn("⚠️ Page/frame error");
        break;
      }
      await new Promise((res) => setTimeout(res, 5000));
    }

    console.log("🛑 Stopping FFmpeg...");
    ffmpeg.kill("SIGINT");

    await browser.close();
    console.log("✅ Browser closed. Audio saved to:", audioPath);

  } catch (err) {
    console.error("❌ Error:", err.message);
    ffmpeg.kill("SIGINT");
    await browser.close();
  }
})();
