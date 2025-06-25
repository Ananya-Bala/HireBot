import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Step 1: Check if mp3 already exists
if (fs.existsSync("asset/audio/meeting_record.mp3")) {
  console.log("📝 MP3 file already exists: meeting_record.mp3");
} else if (fs.existsSync("asset/audio/meeting_record.mkv")) {
  // If mkv exists, convert mkv → mp3
  console.log("🎬 Converting mkv to mp3...");
  execSync(
    'ffmpeg -i asset/audio/meeting_record.mkv -vn -acodec libmp3lame asset/audio/meeting_record.mp3'
  );
  
  console.log("🎵 Conversion done: meeting_record.mp3");
} else {
  console.error("❌ No recording found (mkv or mp3). Aborting.");
  process.exit(1);
}

// Step 2: Run Whisper
console.log("📝 Running Whisper for transcript...");
execSync(
  'whisper "asset/audio/meeting_record.mp3" --model small --language English'
);
// Move transcript file to desired folder
fs.renameSync(
  "meeting_record.txt",
  path.join("asset", "audio", "meeting_record.txt")
);
console.log("✅ Transcript ready!");
