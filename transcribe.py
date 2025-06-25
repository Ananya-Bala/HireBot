# transcribe_server.py
from flask import Flask, jsonify
from flask_cors import CORS
import wave
import json
from vosk import Model, KaldiRecognizer

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

model = Model("vosk-model-small-en-us-0.15")

@app.route("/transcribe", methods=["POST"])
def transcribe():
    audio_path = "asset/audio/meeting_audio.wav"

    wf = wave.open(audio_path, "rb")
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        return jsonify({"success": False, "message": "Audio must be mono PCM 16kHz"}), 400

    rec = KaldiRecognizer(model, wf.getframerate())
    result_text = ""
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result())
            result_text += result.get("text", "") + " "

    result = json.loads(rec.FinalResult())
    result_text += result.get("text", "")

    return jsonify({"success": True, "transcript": result_text.strip()})

if __name__ == "__main__":
    app.run(port=5005)
