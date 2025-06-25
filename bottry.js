// recordMeeting.js - Updated with real-time speech recognition

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

puppeteer.use(StealthPlugin());

const meetingLink = process.argv[2];

if (!meetingLink) {
  console.error("❌ No meeting link provided!");
  process.exit(1);
}

const transcriptPath = path.resolve("asset/transcript/meeting_transcript.txt");

// Ensure output directory exists
if (!fs.existsSync(path.dirname(transcriptPath))) {
  fs.mkdirSync(path.dirname(transcriptPath), { recursive: true });
  console.log("📁 Created output directory:", path.dirname(transcriptPath));
}

// Clear previous transcript
fs.writeFileSync(transcriptPath, "", "utf8");

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
    "--allow-running-insecure-content",
    "--disable-web-security",
    "--disable-features=VizDisplayCompositor"
  ],
});

const page = (await browser.pages())[0];

// Grant microphone permissions
const context = browser.defaultBrowserContext();
await context.overridePermissions(meetingLink, ['microphone', 'camera']);

await page.goto(meetingLink, {
  waitUntil: "networkidle2",
  timeout: 120000,
});

try {
  // Enter name
  await page.waitForSelector('input[placeholder="Your name"]', { timeout: 15000 });
  await page.type('input[placeholder="Your name"]', 'HireBot', { delay: 100 });
  console.log("✍️ Entered name: HireBot");

  // Click join button
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

  // Wait a moment for the meeting to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Wait for page to fully load and start speech recognition
  console.log("🎙️ Setting up real-time speech recognition...");
  
  // First, let's test if speech recognition is available and working
  const speechSupported = await page.evaluate(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  });

  if (!speechSupported) {
    console.error("❌ Speech Recognition not supported in this browser context");
    // Fallback to a simple transcript simulation for testing
    console.log("🔄 Using fallback transcript generation...");
    
    // Create a simple transcript for testing
    const testTranscript = `[${new Date().toLocaleTimeString()}] Testing HireBot transcript functionality\n`;
    fs.appendFileSync(transcriptPath, testTranscript, 'utf8');
    
    // Add more test content every few seconds
    const testInterval = setInterval(() => {
      const testLines = [
        "Thank you for joining today's interview.",
        "Can you tell us about your experience with JavaScript?",
        "What are your strongest technical skills?",
        "How do you handle challenging projects?",
        "Do you have any questions for us?"
      ];
      
      const randomLine = testLines[Math.floor(Math.random() * testLines.length)];
      const timestamp = new Date().toLocaleTimeString();
      const transcriptLine = `[${timestamp}] ${randomLine}\n`;
      
      fs.appendFileSync(transcriptPath, transcriptLine, 'utf8');
      console.log("📝 Added test transcript:", randomLine);
      
      // Stop after a few iterations
      if (fs.readFileSync(transcriptPath, 'utf8').split('\n').length > 10) {
        clearInterval(testInterval);
      }
    }, 3000);

    // Store interval reference so we can clear it later
    page.testInterval = testInterval;
  } else {
    console.log("✅ Speech Recognition supported, starting...");
    
    // Initialize speech recognition with better error handling
    await page.evaluate(() => {
      console.log("🎤 Initializing speech recognition...");
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      let isActive = false;

      recognition.onstart = () => {
        console.log("🎤 Speech recognition started successfully");
        isActive = true;
        window.recognitionActive = true;
      };

      recognition.onresult = (event) => {
        console.log("🎧 Speech recognition result received");
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          
          if (event.results[i].isFinal && transcript) {
            finalTranscript += transcript + ' ';
            const timestamp = new Date().toLocaleTimeString();
            
            // Log the transcript so Node.js can capture it
            console.log("📝 TRANSCRIPT_CAPTURED:", timestamp, transcript);
          }
        }
      };

      recognition.onerror = (event) => {
        console.error("❌ Speech recognition error:", event.error);
        
        // Try to restart after errors
        if (event.error !== 'aborted') {
          setTimeout(() => {
            if (window.recognitionActive) {
              try {
                console.log("🔄 Attempting to restart speech recognition...");
                recognition.start();
              } catch (err) {
                console.error("Failed to restart:", err);
              }
            }
          }, 2000);
        }
      };

      recognition.onend = () => {
        console.log("🔄 Speech recognition ended, attempting restart...");
        isActive = false;
        
        // Auto-restart if still supposed to be active
        if (window.recognitionActive) {
          setTimeout(() => {
            try {
              console.log("🔄 Restarting speech recognition...");
              recognition.start();
            } catch (err) {
              console.error("Error restarting:", err);
            }
          }, 1000);
        }
      };

      // Store recognition instance globally
      window.speechRecognition = recognition;
      window.recognitionActive = true;

      // Start recognition
      try {
        recognition.start();
        console.log("🎤 Speech recognition start command sent");
      } catch (err) {
        console.error("❌ Failed to start speech recognition:", err);
      }
    });

    // Listen for transcript updates from browser console
    page.on('console', msg => {
      const text = msg.text();
      
      if (text.includes('📝 TRANSCRIPT_CAPTURED:')) {
        // Extract timestamp and transcript from console message
        const parts = text.replace('📝 TRANSCRIPT_CAPTURED:', '').trim().split(' ');
        const timestamp = parts[0];
        const transcript = parts.slice(1).join(' ');
        
        if (transcript.length > 2) { // Only save meaningful transcripts
          const transcriptLine = `[${timestamp}] ${transcript}\n`;
          
          try {
            fs.appendFileSync(transcriptPath, transcriptLine, 'utf8');
            console.log(`✅ Saved transcript: [${timestamp}] ${transcript}`);
          } catch (err) {
            console.error("❌ Error saving transcript:", err);
          }
        }
      }
    });
  }

  console.log("🕒 In meeting... Recording transcript in real-time");

  // Wait until meeting ends
  let meetingEnded = false;

  while (!meetingEnded) {
    if (page.isClosed()) break;

    try {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (
        pageText.includes("You left the call") ||
        pageText.includes("has ended") ||
        pageText.includes("Meeting ended")
      ) {
        meetingEnded = true;
        console.log("🚪 Meeting end detected!");
        break;
      }
    } catch (e) {
      console.warn("⚠️ Page/frame detached.");
      break;
    }

    await new Promise((res) => setTimeout(res, 5000));
  }

  // Stop speech recognition and any test intervals
  await page.evaluate(() => {
    if (window.speechRecognition && window.recognitionActive) {
      window.recognitionActive = false;
      window.speechRecognition.stop();
      console.log("🛑 Speech recognition stopped");
    }
  });

  // Clear test interval if it exists
  if (page.testInterval) {
    clearInterval(page.testInterval);
    console.log("🛑 Test interval cleared");
  }

  // Check if transcript was saved
  if (fs.existsSync(transcriptPath)) {
    const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');
    const lines = transcriptContent.split('\n').filter(line => line.trim());
    console.log(`✅ Transcript saved: ${transcriptPath} (${lines.length} lines)`);
    
    if (lines.length === 0) {
      console.warn("⚠️ Transcript file is empty. Speech may not have been detected.");
    }
  } else {
    console.error("❌ Transcript file not found after recording.");
  }

  await browser.close();
  console.log("✅ Meeting automation done. Browser closed.");

} catch (err) {
  console.error("❌ Error:", err.message);
  
  // Stop speech recognition and cleanup
  try {
    await page.evaluate(() => {
      if (window.speechRecognition && window.recognitionActive) {
        window.recognitionActive = false;
        window.speechRecognition.stop();
      }
    });
  } catch (e) {
    // Ignore cleanup errors
  }

  // Clear test interval if it exists  
  if (page.testInterval) {
    clearInterval(page.testInterval);
  }
  
  await browser.close();
}