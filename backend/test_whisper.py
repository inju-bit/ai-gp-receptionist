import os

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import sounddevice as sd
import soundfile as sf

from voice import transcribe_file

SAMPLE_RATE = 16000
DURATION = 5

print("Recording starts now. Speak clearly.")

audio = sd.rec(
    int(DURATION * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=1,
    dtype="float32",
)

sd.wait()

sf.write(
    "test_recording.wav",
    audio,
    SAMPLE_RATE,
)

print("Recording saved.")
print("Starting Whisper transcription...")

result = transcribe_file("test_recording.wav")

print("RESULT:", result)
