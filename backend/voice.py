
from functools import lru_cache
from pathlib import Path
import os
import tempfile
import time

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
)
from fastapi.concurrency import run_in_threadpool
from faster_whisper import WhisperModel


# ---------------------------------------
# VOICE ROUTER
# ---------------------------------------

router = APIRouter(
    prefix="/voice",
    tags=["Voice"],
)

MAX_AUDIO_BYTES = 10 * 1024 * 1024

ALLOWED_AUDIO_TYPES = {
    "audio/webm": ".webm",
    "audio/mp4": ".mp4",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}


# ---------------------------------------
# LOAD WHISPER MODEL
# ---------------------------------------

@lru_cache(maxsize=1)
def get_whisper_model():
    print(
        "[WHISPER] Loading tiny.en model...",
        flush=True,
    )

    model = WhisperModel(
        "tiny.en",
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
    )

    print(
        "[WHISPER] Model loaded successfully!",
        flush=True,
    )

    return model


# ---------------------------------------
# TRANSCRIBE AUDIO
# ---------------------------------------

def transcribe_file(path: str):
    started = time.perf_counter()

    print(
        "[WHISPER] Starting transcription...",
        flush=True,
    )

    model = get_whisper_model()

    print(
        "[WHISPER] Starting audio decoding...",
        flush=True,
    )

    segments, info = model.transcribe(
        path,
        language="en",
        beam_size=1,
        vad_filter=False,
        condition_on_previous_text=False,
    )

    print(
        "[WHISPER] Audio decoded. Processing segments...",
        flush=True,
    )

    # Important: actually execute Whisper inference
    segments = list(segments)

    print(
        "[WHISPER] Segments processed!",
        flush=True,
    )

    transcript = " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()

    elapsed = round(
        time.perf_counter() - started,
        2,
    )

    print(
        f"[WHISPER] Completed in {elapsed} seconds",
        flush=True,
    )

    print(
        f"[WHISPER] Recognised text: {transcript}",
        flush=True,
    )

    return {
        "text": transcript,
        "language": info.language,
        "processing_seconds": elapsed,
    }


# ---------------------------------------
# HEALTH CHECK
# ---------------------------------------

@router.get("/health")
def voice_health():
    return {
        "status": "running",
        "engine": "faster-whisper",
        "model": "tiny.en",
    }


# ---------------------------------------
# UPLOAD AND TRANSCRIBE RECORDING
# ---------------------------------------

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
):
    content_type = (
        (file.content_type or "")
        .split(";")[0]
        .strip()
        .lower()
    )

    print(
        f"[VOICE] Received audio type: {content_type}",
        flush=True,
    )

    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported audio format: "
                f"{file.content_type}"
            ),
        )

    audio_bytes = await file.read(
        MAX_AUDIO_BYTES + 1
    )

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Audio recording is empty.",
        )

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio recording exceeds 10 MB.",
        )

    print(
        f"[VOICE] Received {len(audio_bytes)} bytes",
        flush=True,
    )

    suffix = ALLOWED_AUDIO_TYPES[content_type]
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
        ) as temp:
            temp.write(audio_bytes)
            temp_path = temp.name

        print(
            "[VOICE] Temporary audio saved",
            flush=True,
        )

        # Run CPU transcription outside
        # FastAPI's asynchronous event loop.
        result = await run_in_threadpool(
            transcribe_file,
            temp_path,
        )

        if not result["text"]:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No speech detected. "
                    "Please record again."
                ),
            )

        print(
            "[VOICE] Sending transcript to React",
            flush=True,
        )

        return result

    except HTTPException:
        raise

    except Exception as error:
        print(
            f"[VOICE] ERROR: {repr(error)}",
            flush=True,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Whisper transcription failed. "
                "Check the FastAPI terminal."
            ),
        ) from error

    finally:
        if (
            temp_path is not None
            and Path(temp_path).exists()
        ):
            os.remove(temp_path)

            print(
                "[VOICE] Temporary file deleted",
                flush=True,
            )


