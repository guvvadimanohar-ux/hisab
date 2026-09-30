# Hisab Multilingual Voice Assistant & Speech Engine

Hisab features a voice assistant designed for Indian kirana shop owners who speak Hindi, Telugu, Tamil, Kannada, and Indian English.

## 1. Pipeline Architecture
```text
Microphone (Browser or App)
    ↓
Web Speech API / Audio Recording
    ↓
POST /api/voice/transcribe (or POST /api/voice/query)
    ↓
VoiceService -> VoiceProvider (STT)
    ↓
Language Detection (Telugu, Hindi, English, etc.)
    ↓
AI Intent & Tool Execution (aiService)
    ↓
Database Aggregation (node:sqlite)
    ↓
Grounded Answer
    ↓
VoiceService -> VoiceProvider (TTS Synthesis)
    ↓
WAV Audio Stream / data:audio/wav;base64,...
    ↓
Browser Audio Playback & Live Waveform Animation
```

## 2. Provider Abstraction
Voice engines implement the `VoiceProvider` interface (`backend/providers/voice/VoiceProvider.js`):
- `MockVoiceProvider`: Zero-dependency, offline development provider that transcribes test inputs and synthesizes valid PCM WAV audio streams.
- `CloudVoiceProvider`: Production adapter for external speech APIs (e.g. Google Cloud Speech-to-Text / Text-to-Speech, Bhashini, or Azure Speech).

Configuration in `.env`:
```bash
VOICE_PROVIDER=mock # mock | cloud | google | bhashini
VOICE_STT_API_KEY=
VOICE_TTS_API_KEY=
```

## 3. Supported Languages
| Language | Code | Script / Example |
|---|---|---|
| Indian English | `en-IN` | "How much UPI payment came today?" |
| Telugu | `te-IN` | "ఈ నెల ఎంత UPI payment వచ్చింది?" |
| Hindi | `hi-IN` | "इस महीने कितनी कमाई हुई?" |
| Tamil | `ta-IN` | "இன்று எவ்வளவு UPI பணம் வந்தது?" |
| Kannada | `kn-IN` | "ಈ ತಿಂಗಳು ಎಷ್ಟು UPI ಪಾವತಿ ಬಂದಿದೆ?" |

## 4. Frontend Voice Experience
- **Interactive Mic Orb & Pulse**: Real-time visual feedback indicating listening, thinking, and speaking states.
- **Audio Waveform Canvas**: Dynamic HTML5 Canvas rendering audio oscillations while active.
- **Dual Playback Engine**: Plays synthesized WAV audio from the backend, with graceful fallback to browser `window.speechSynthesis` (`SpeechSynthesisUtterance`).
