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
  "-f", "avfoundation", // macOS specific
  "-i", ":0", // use ":0" for default system audio input
  "-ac", "1", // mono channel (required by Vosk)
  "-ar", "16000", // 16kHz sample rate (required by Vosk)
  "-acodec", "pcm_s16le", // 16-bit PCM (required by Vosk)
  "-t", "3600", // max duration: 1 hour
  "-y", // overwrite output file if it exists
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
      "--incognito",
      "--use-fake-ui-for-media-stream",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-running-insecure-content",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  const page = (await browser.pages())[0];

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(meetingLink, ['microphone', 'camera']);

  await page.goto(meetingLink, {
    waitUntil: "networkidle2",
    timeout: 120000,
  });

  try {
    await page.waitForSelector('input[placeholder="Your name"]', { timeout: 15000 });
    await page.type('input[placeholder="Your name"]', 'HireBot', { delay: 100 });
    console.log("✍️ Entered name");

    const joinButton = await page.$('span.UywwFc-RLmnJb') || await page.$('button[jsname="Qx7uuf"]');
    if (joinButton) {
      await joinButton.click();
      console.log("✅ Joined the meeting");
    }

    await new Promise(res => setTimeout(res, 5000)); // wait for meeting audio

    console.log("🕒 In meeting... FFmpeg is recording audio");

    // Wait for meeting to end
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

    // Stop recording
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
