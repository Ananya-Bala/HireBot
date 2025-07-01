# transcribe.py
from flask import Flask, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import os

app = Flask(__name__)
CORS(app) 

# Load Faster-Whisper model (use "base.en", "small.en", etc.)
model = WhisperModel("small.en", compute_type="int8")  # Fast + accurate

@app.route("/transcribe", methods=["POST"])
def transcribe():
    audio_path = "asset/audio/meeting_audio.wav"

    if not os.path.exists(audio_path):
        return jsonify({"success": False, "message": "Audio file not found"}), 404

    try:
        segments, _ = model.transcribe(audio_path, beam_size=5)
        transcript = " ".join([seg.text.strip() for seg in segments])
        return jsonify({"success": True, "transcript": transcript})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5005)
