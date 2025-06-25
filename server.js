// import express from 'express';
// import { spawn, execSync } from 'child_process';
// import cors from 'cors';
// import fs from 'fs';
// import path from 'path';

// const app = express();
// app.use(cors());
// app.use(express.json());

// // 🎯 Launch HireBot meeting automation
// app.post('/start-bot', (req, res) => {
//   const link = req.body.link;
//   if (!link) return res.status(400).send("No link provided");

//   console.log("Received link:", link);
//   console.log("👉 Full spawn command:", 'node', ['bottry.js', link]);

//   const bot = spawn('node', ['bottry.js', link], { stdio: 'inherit' });

//   res.send("Bot launched successfully");
// });

// // 🧠 Generate transcript directly from .mp3
// app.get("/transcript", (req, res) => {
//   const mp3Path = path.join("asset/audio/meeting_record.mp3");

//   if (!fs.existsSync(mp3Path)) {
//     console.error("❌ MP3 file not found");
//     return res.status(404).send("No MP3 audio file found.");
//   }

//   console.log("📥 Transcribing directly from MP3...");

//   try {
//     // Run Whisper and capture output directly
//     const output = execSync(
//       `whisper "${mp3Path}" --model small --language English --output_format txt --output_dir temp_transcript`,
//       { encoding: "utf-8" }
//     );

//     const txtPath = path.join("temp_transcript", "meeting_record.txt");
//     if (!fs.existsSync(txtPath)) {
//       return res.status(500).send("Transcript not generated.");
//     }

//     const transcript = fs.readFileSync(txtPath, "utf8");
//     res.send(transcript);
//   } catch (err) {
//     console.error("❌ Whisper error:", err.message);
//     res.status(500).send("Error while generating transcript.");
//   }
// });

// // 🚀 Start server
// app.listen(3000, () => {
//   console.log("🚀 Server running on http://localhost:3000");
// });


// server.js - Updated for real-time transcript serving

import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

let botProcess = null;

// 🎯 Launch HireBot meeting automation
app.post('/start-bot', (req, res) => {
  const link = req.body.link;
  if (!link) return res.status(400).send("No link provided");

  // Kill existing bot process if running
  if (botProcess) {
    console.log("🛑 Stopping existing bot process...");
    botProcess.kill('SIGTERM');
    botProcess = null;
  }

  console.log("🚀 Launching bot with link:", link);

  // Clear previous transcript
  const transcriptPath = path.join("asset/transcript/meeting_transcript.txt");
  if (fs.existsSync(transcriptPath)) {
    fs.writeFileSync(transcriptPath, "", "utf8");
    console.log("🧹 Cleared previous transcript");
  }

  // Start the bot process
  botProcess = spawn('node', ['bottry.js', link], { 
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: false
  });

  botProcess.stdout.on('data', (data) => {
    console.log(`🤖 Bot: ${data.toString().trim()}`);
  });

  botProcess.stderr.on('data', (data) => {
    console.error(`🤖 Bot Error: ${data.toString().trim()}`);
  });

  botProcess.on('close', (code) => {
    console.log(`🤖 Bot process exited with code ${code}`);
    botProcess = null;
  });

  botProcess.on('error', (err) => {
    console.error('🤖 Bot process error:', err);
    botProcess = null;
  });

  res.json({ 
    success: true, 
    message: "Bot launched successfully",
    status: "Bot is joining the meeting..."
  });
});

// 📝 Get real-time transcript
app.get("/transcript", (req, res) => {
  const transcriptPath = path.join("asset/transcript/meeting_transcript.txt");

  if (!fs.existsSync(transcriptPath)) {
    return res.status(404).json({
      success: false,
      message: "No transcript file found. Bot may not have started yet.",
      transcript: ""
    });
  }

  try {
    const transcript = fs.readFileSync(transcriptPath, "utf8");
    
    // Return transcript with metadata
    res.json({
      success: true,
      transcript: transcript,
      length: transcript.length,
      lines: transcript.split('\n').filter(line => line.trim()).length,
      lastUpdated: fs.statSync(transcriptPath).mtime,
      botStatus: botProcess ? "active" : "inactive"
    });

  } catch (err) {
    console.error("❌ Error reading transcript:", err.message);
    res.status(500).json({
      success: false,
      message: "Error reading transcript file",
      error: err.message
    });
  }
});

// 📊 Get transcript statistics
app.get("/transcript/stats", (req, res) => {
  const transcriptPath = path.join("asset/transcript/meeting_transcript.txt");

  if (!fs.existsSync(transcriptPath)) {
    return res.status(404).json({
      success: false,
      message: "No transcript file found"
    });
  }

  try {
    const transcript = fs.readFileSync(transcriptPath, "utf8");
    const lines = transcript.split('\n').filter(line => line.trim());
    const words = transcript.split(/\s+/).filter(word => word.trim());
    
    const stats = {
      totalLines: lines.length,
      totalWords: words.length,
      totalCharacters: transcript.length,
      fileSize: fs.statSync(transcriptPath).size,
      lastUpdated: fs.statSync(transcriptPath).mtime,
      botStatus: botProcess ? "active" : "inactive"
    };

    res.json({
      success: true,
      stats: stats
    });

  } catch (err) {
    console.error("❌ Error getting transcript stats:", err.message);
    res.status(500).json({
      success: false,
      message: "Error getting transcript statistics",
      error: err.message
    });
  }
});

// 🛑 Stop bot process
app.post('/stop-bot', (req, res) => {
  if (botProcess) {
    console.log("🛑 Stopping bot process...");
    botProcess.kill('SIGTERM');
    botProcess = null;
    
    res.json({
      success: true,
      message: "Bot stopped successfully"
    });
  } else {
    res.json({
      success: false,
      message: "No bot process is currently running"
    });
  }
});

// 🔄 Get bot status
app.get('/bot-status', (req, res) => {
  res.json({
    success: true,
    status: botProcess ? "active" : "inactive",
    pid: botProcess ? botProcess.pid : null
  });
});

// 🧹 Clear transcript
app.delete('/transcript', (req, res) => {
  const transcriptPath = path.join("asset/transcript/meeting_transcript.txt");
  
  try {
    if (fs.existsSync(transcriptPath)) {
      fs.writeFileSync(transcriptPath, "", "utf8");
      console.log("🧹 Transcript cleared");
    }
    
    res.json({
      success: true,
      message: "Transcript cleared successfully"
    });
  } catch (err) {
    console.error("❌ Error clearing transcript:", err.message);
    res.status(500).json({
      success: false,
      message: "Error clearing transcript",
      error: err.message
    });
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  if (botProcess) {
    console.log('🛑 Stopping bot process...');
    botProcess.kill('SIGTERM');
  }
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  if (botProcess) {
    botProcess.kill('SIGTERM');
  }
  
  process.exit(0);
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Transcript API: http://localhost:${PORT}/transcript`);
  console.log(`📊 Stats API: http://localhost:${PORT}/transcript/stats`);
  console.log(`🤖 Bot Status API: http://localhost:${PORT}/bot-status`);
});