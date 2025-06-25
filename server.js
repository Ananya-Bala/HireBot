import express from 'express';
import { spawn, execSync } from 'child_process';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// 🎯 Launch HireBot meeting automation
app.post('/start-bot', (req, res) => {
  const link = req.body.link;
  if (!link) return res.status(400).send("No link provided");

  console.log("Received link:", link);
  console.log("👉 Full spawn command:", 'node', ['bottry.js', link]);

  const bot = spawn('node', ['bottry.js', link], { stdio: 'inherit' });

  res.send("Bot launched successfully");
});

// 🧠 Generate transcript directly from .mp3
app.get("/transcript", (req, res) => {
  const mp3Path = path.join("asset/audio/meeting_record.mp3");

  if (!fs.existsSync(mp3Path)) {
    console.error("❌ MP3 file not found");
    return res.status(404).send("No MP3 audio file found.");
  }

  console.log("📥 Transcribing directly from MP3...");

  try {
    // Run Whisper and capture output directly
    const output = execSync(
      `whisper "${mp3Path}" --model small --language English --output_format txt --output_dir temp_transcript`,
      { encoding: "utf-8" }
    );

    const txtPath = path.join("temp_transcript", "meeting_record.txt");
    if (!fs.existsSync(txtPath)) {
      return res.status(500).send("Transcript not generated.");
    }

    const transcript = fs.readFileSync(txtPath, "utf8");
    res.send(transcript);
  } catch (err) {
    console.error("❌ Whisper error:", err.message);
    res.status(500).send("Error while generating transcript.");
  }
});

// 🚀 Start server
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
