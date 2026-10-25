# AI GP Receptionist — Voice-Enabled AI Assistant with RAG

An AI-powered virtual GP receptionist prototype developed using **Python, FastAPI, React, Ollama, Faster Whisper, Sentence Transformers, and ChromaDB**.

This project demonstrates the integration of Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), speech recognition, and RESTful APIs to provide conversational assistance for fictional GP administrative services.

## Features

### AI-Powered Chatbot
- Conversational AI powered by a locally hosted Ollama language model.
- Context-aware responses using retrieved GP information.
- Handles opening hours, prescriptions, appointment enquiries, and general administrative questions.
- Basic emergency keyword detection for demonstration purposes.

### Retrieval-Augmented Generation (RAG)
- Semantic embeddings generated using Sentence Transformers (`all-MiniLM-L6-v2`).
- Vector storage and similarity search using ChromaDB.
- Retrieval of relevant information from fictional GP documents.
- Integration of retrieved context with LLM-generated responses.
- Display of supporting document excerpts in the frontend.

### Voice Recognition and Speech Synthesis
- Microphone recording using the browser MediaRecorder API.
- Local speech-to-text processing with Faster Whisper.
- CPU-based speech recognition without requiring a dedicated GPU.
- Voice activity detection to reduce transcription of silence.
- Text-to-speech responses using the browser Web Speech API.

### Appointment Availability
- SQLite database containing fictional GP appointment slots.
- REST API for retrieving appointment availability.
- Appointment cards displaying dates, times, and doctors.
- No real patient records or appointment booking functionality.

### Frontend Interface
- Responsive React application built with Vite.
- Interactive conversational interface.
- Microphone recording and voice playback controls.
- Recording, transcription, and AI-processing indicators.
- Retrieved document references and appointment availability display.

## Technology Stack

| Component | Technology |
|---|---|
| Programming Languages | Python, JavaScript |
| Frontend | React, Vite, CSS |
| Backend | FastAPI |
| Large Language Model | Ollama (Llama 3.2 1B) |
| Speech-to-Text | Faster Whisper |
| Text-to-Speech | Web Speech API |
| Embeddings | Sentence Transformers |
| Vector Database | ChromaDB |
| Relational Database | SQLite |
| API Architecture | RESTful APIs |
| Development Tools | Git, GitHub, VS Code |

## System Architecture

```text
User
 |
React Frontend
 |
 +-------------------+
 |                   |
Text Input       Voice Input
 |                   |
 |              Faster Whisper
 |                   |
 +---------+---------+
           |
       FastAPI
           |
    Request Handling
           |
   +-------+--------+
   |                |
SQLite          RAG Pipeline
Appointments         |
                 Sentence Transformers
                      |
                   ChromaDB
                      |
              Retrieved GP Context
                      |
                 Ollama LLM
                      |
                  Response
                      |
               React Frontend
                      |
              Text-to-Speech
```

Appointment queries can be handled directly through the SQLite database without requiring an LLM response.

For improved stability, Whisper can be deployed as a separate service.

## Project Structure

```text
ai-gp-receptionist/
├── backend/
│   ├── main.py
│   ├── rag.py
│   ├── voice.py
│   ├── appointments.py
│   ├── prompts.py
│   ├── requirements.txt
│   ├── test_whisper.py
│   └── data/
│       └── gp_information.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Installation and Setup

### Prerequisites

- Python 3.12
- Node.js and npm
- Ollama
- Git
- Microphone for voice functionality

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/ai-gp-receptionist.git
cd ai-gp-receptionist
```

Replace `YOUR-USERNAME` with your GitHub username.

### 2. Configure the Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

The tested local speech-recognition environment used `faster-whisper==1.2.1` and `av==17.1.0`.

### 3. Initialise the Knowledge Base

```bash
python rag.py
```

This indexes the fictional GP information into ChromaDB.

### 4. Install the Local Language Model

```bash
ollama pull llama3.2:1b
```

Make sure the Ollama service is running.

### 5. Start the Backend

```bash
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --loop asyncio
```

API documentation: `http://127.0.0.1:8000/docs`

### 6. Start the Frontend

From the project root, open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

If you're still in the `backend` directory, return to the project root before entering `frontend`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Application information |
| GET | `/health` | Backend health check |
| POST | `/chat` | Process user messages |
| GET | `/appointments/available` | Retrieve fictional appointments |
| POST | `/voice/transcribe` | Convert speech into text |
| GET | `/voice/health` | Voice service health check |

The voice endpoints may run on port 8001 when deployed as a separate speech service.

## Example Queries

- What time does the surgery open?
- Is the GP surgery open on weekends?
- How can I request a repeat prescription?
- What appointments are available?
- How can I obtain my test results?

## Technical Challenges

- Integrating React with a Python FastAPI backend.
- Developing document retrieval using vector embeddings.
- Grounding LLM responses in retrieved reference information.
- Running local LLM inference using Ollama.
- Implementing speech-to-text inference on an Intel Mac.
- Resolving PyAV and Faster Whisper compatibility issues.
- Investigating OpenMP-related native-library crashes.
- Designing isolated speech-recognition services.
- Managing asynchronous API requests and frontend state.

## Project Status

**Prototype — Active Development**

The application includes a working text-based RAG pipeline, fictional appointment retrieval, and a standalone speech-transcription implementation.

End-to-end voice integration and native-library stability remain under development and require further testing.

## Future Improvements

- Dedicated Whisper microservice.
- Improved speech recognition and silence detection.
- Automated unit and integration tests.
- Enhanced RAG retrieval and evaluation.
- Conversation history and session management.
- Structured logging and monitoring.
- Containerisation using Docker.
- Deployment to a cloud platform.

## Privacy and Safety

This project uses fictional healthcare information and is intended strictly for learning and demonstration.

It does not access NHS systems, store real patient records, book real appointments, or provide clinical diagnoses.

The emergency keyword detection feature is not a validated medical triage system.

Real patient information and sensitive medical data should not be entered into the application.

## Project Focus

This project demonstrates practical experience in:

**AI Application Development | LLM Integration | Retrieval-Augmented Generation | Natural Language Processing | Speech Recognition | FastAPI | React | REST APIs | Full-Stack Development**

## Disclaimer

This application is an independent educational prototype. It is not affiliated with the NHS or any GP practice and is not intended for clinical use.