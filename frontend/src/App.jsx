
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI GP Receptionist. You can type or speak to me.",
      appointments: [],
      sources: [],
    },
  ]);

  const [input, setInput] = useState("");
  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const bottomRef = useRef(null);
  const stageRef = useRef("idle");
  const mountedRef = useRef(true);

  const busy = stage !== "idle";

  function updateStage(next) {
    stageRef.current = next;
    if (mountedRef.current) setStage(next);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, stage]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current) {
        recorderRef.current.onstop = null;
        if (recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      }
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function speak(text) {
    if (!voiceEnabled || !("speechSynthesis" in window)) {
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.95;

    const british = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase() === "en-gb");

    if (british) utterance.voice = british;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  // Read API errors instead of showing just "400" or "503".
  async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : `HTTP ${response.status}`;

      throw new Error(detail);
    }

    return data;
  }

  // Fetch with a timeout so the interface cannot wait forever.
  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(
          `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. ` +
          "Check the FastAPI terminal."
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Send either typed or transcribed text to FastAPI.
  async function sendMessage(text, fromVoice = false) {
    const message = text.trim();

    if (!message) return;

    if (stageRef.current !== "idle" &&
        stageRef.current !== "transcribing") {
      return;
    }

    setError("");
    setInput("");
    stopSpeaking();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
    ]);

    updateStage("chatting");

    try {
      const response = await fetchWithTimeout(
        `${API}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
        150000
      );

      const data = await readResponse(response);

      if (!mountedRef.current) return;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          appointments: data.appointments || [],
          sources: data.sources || [],
        },
      ]);

      if (fromVoice && voiceEnabled) {
        let spoken = data.reply;

        if (data.appointments?.length) {
          const summary = data.appointments
            .slice(0, 3)
            .map(
              (slot) =>
                `${slot.appointment_date} at ` +
                `${slot.appointment_time} with ${slot.doctor}`
            )
            .join(". ");

          spoken += ` First available appointments: ${summary}`;
        }

        speak(spoken);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      setError(err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't complete that request: ${err.message}`,
        },
      ]);
    } finally {
      updateStage("idle");
    }
  }

  // Send recorded audio to local Whisper.
  async function transcribeRecording(blob, mimeType) {
    updateStage("transcribing");

    try {
      const extension =
        mimeType === "audio/mp4"
          ? "mp4"
          : mimeType === "audio/ogg"
          ? "ogg"
          : mimeType === "audio/wav"
          ? "wav"
          : "webm";

      const formData = new FormData();

      formData.append(
        "file",
        blob,
        `recording.${extension}`
      );

      const response = await fetchWithTimeout(
        `${API}/voice/transcribe`,
        {
          method: "POST",
          body: formData,
        },
        240000
      );

      const data = await readResponse(response);

      if (!data.text?.trim()) {
        throw new Error("Whisper did not detect any speech.");
      }

      if (!mountedRef.current) return;

      await sendMessage(data.text, true);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (stageRef.current === "transcribing") {
        updateStage("idle");
      }
    }
  }

  async function startRecording() {
    if (stageRef.current !== "idle") return;

    if (!navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio.");
      return;
    }

    setError("");
    stopSpeaking();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];

      const selectedType = supportedTypes.find(
        (type) => MediaRecorder.isTypeSupported(type)
      );

      const recorder = new MediaRecorder(
        stream,
        selectedType ? { mimeType: selectedType } : undefined
      );

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Microphone recording failed.");
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (!mountedRef.current) return;

        const mimeType = recorder.mimeType.split(";")[0];

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        if (blob.size === 0) {
          setError("No audio was recorded.");
          updateStage("idle");
          return;
        }

        await transcribeRecording(blob, mimeType);
      };

      recorder.start();
      updateStage("recording");
    } catch (err) {
      setError(`Microphone: ${err.message}`);
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );
      updateStage("idle");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      updateStage("transcribing");
      recorderRef.current.stop();
    }
  }

  async function showAppointments() {
    if (stageRef.current !== "idle") return;

    updateStage("appointments");
    setError("");

    try {
      const response = await fetchWithTimeout(
        `${API}/appointments/available`,
        {},
        15000
      );

      const data = await readResponse(response);
      const appointments = data.appointments || [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: appointments.length
            ? "Here are the available demo appointments:"
            : "No demo appointments are currently available.",
          appointments: appointments.slice(0, 9),
          sources: [],
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      updateStage("idle");
    }
  }

  const statusText = {
    idle: speaking ? "🔊 AI is speaking..." : "🟢 Ready to chat",
    recording: "🔴 Recording your voice...",
    transcribing: "🎙️ Whisper is transcribing...",
    chatting: "🧠 AI is generating a reply...",
    appointments: "📅 Loading appointments...",
  };

  return (
    <main className="page">
      <div className="chat-container">
        <header>
          <h1>🏥 AI GP Receptionist</h1>
          <p>Healthcare AI Assistant — Voice + RAG</p>
          <div className="voice-status">
            {statusText[stage]}
          </div>
        </header>

        <div className="quick-actions">
          <button
            onClick={showAppointments}
            disabled={busy}
          >
            📅 Available Appointments
          </button>

          <button
            className="voice-toggle"
            onClick={() => {
              if (voiceEnabled) stopSpeaking();
              setVoiceEnabled(!voiceEnabled);
            }}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>

          {speaking && (
            <button className="stop-voice" onClick={stopSpeaking}>
              ⏹ Stop Speaking
            </button>
          )}
        </div>

        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role}`}
            >
              <div>{msg.content}</div>

              {msg.appointments?.length > 0 && (
                <div className="appointment-list">
                  {msg.appointments.map((slot) => (
                    <div key={slot.id} className="appointment-card">
                      <strong>📅 {slot.appointment_date}</strong>
                      <span>🕒 {slot.appointment_time}</span>
                      <span>👨‍⚕️ {slot.doctor}</span>
                    </div>
                  ))}
                  <small>Fictional appointments only.</small>
                </div>
              )}

              {msg.sources?.length > 0 && (
                <details className="sources">
                  <summary>📚 Retrieved GP documents</summary>
                  {msg.sources.map((source, i) => (
                    <div className="source" key={i}>
                      <strong>{source.source}</strong>
                      <p>{source.content}</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          ))}

          {busy && (
            <p className="typing">
              {statusText[stage]}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="voice-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(input);
          }}
        >
          <button
            type="button"
            className={`mic-button ${
              stage === "recording" ? "recording" : ""
            }`}
            onClick={
              stage === "recording"
                ? stopRecording
                : startRecording
            }
            disabled={busy && stage !== "recording"}
            title="Record voice message"
          >
            {stage === "recording" ? "⏹" : "🎤"}
          </button>

          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type or speak your question..."
            maxLength={2000}
          />

          <button
            type="submit"
            disabled={busy || !input.trim()}
          >
            Send ➤
          </button>
        </form>

        <footer>
          Fictional GP demonstration only. Do not enter patient data.
          For life-threatening emergencies, call 999.
        </footer>
      </div>
    </main>
  );
}

export default App;

