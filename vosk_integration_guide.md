
# Vosk-Browser Integration for Chrome MV3 Extension

This document provides a **step-by-step guide** for integrating Vosk-Browser into a Chrome Manifest V3 extension, running entirely offline in an offscreen or iframe context.

## Project Layout

```
extension-root/
│ manifest.json
│
├─ wasm/
│   └─ vosk-model-en-us-0.22-lgraph/    ← unzipped model files here
│
├─ offscreen/                          ← offscreen document (Chrome 121+)
│   ├─ offscreen.html
│   └─ offscreen.js
│
├─ background/
│   └─ service-worker.js
│
└─ popup/
    ├─ popup.html
    └─ popup.js
```

---

## 1. Scaffold & Install

1. **Initialize Node project**  
   ```bash
   cd extension-root
   npm init -y
   ```

2. **Install Vosk-Browser**  
   ```bash
   npm install vosk-browser
   ```

3. **Download and unzip** the Vosk model into `wasm/vosk-model-en-us-0.22-lgraph/`.

---

## 2. `manifest.json`

```jsonc
{
  "manifest_version": 3,
  "name": "Vosk Offline ASR",
  "version": "0.1",
  "permissions": [
    "audioCapture", 
    "storage"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "offscreen": {
    "page": "offscreen/offscreen.html",
    "persistent": false
  },
  "action": {
    "default_title": "Transcribe"
  },
  "web_accessible_resources": [
    {
      "resources": ["wasm/vosk-model-en-us-0.22-lgraph/**"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; worker-src 'self';"
  }
}
```

---

## 3. `offscreen/offscreen.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vosk Offscreen</title>
  <script type="module" src="offscreen.js"></script>
</head>
<body></body>
</html>
```

---

## 4. `offscreen/offscreen.js`

```js
import { Model, Recognizer } from "vosk-browser";

let recognizer = null;

async function initVosk() {
  if (recognizer) return recognizer;
  const modelPath = chrome.runtime.getURL(
    "wasm/vosk-model-en-us-0.22-lgraph"
  );
  const model = new Model(modelPath);
  recognizer = new Recognizer({ model, sampleRate: 16000 });
  return recognizer;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "REQUEST_TRANSCRIBE") return;
  (async () => {
    try {
      const rec = await initVosk();
      const pcm = new Float32Array(msg.audio);
      rec.acceptWaveform(pcm);
      const { text } = rec.finalResult();
      sendResponse({ text });
    } catch (err) {
      console.error("Vosk error:", err);
      sendResponse({ error: err.message });
    }
  })();
  return true;  // keep the message channel open
});
```

---

## 5. `background/service-worker.js`

```js
const OFFSCREEN_HTML = "offscreen/offscreen.html";
let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const exists = await chrome.offscreen.hasDocument();
    if (!exists) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_HTML,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Run Vosk ASR",
      });
    }
  }
  offscreenCreated = true;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "REQUEST_TRANSCRIBE") {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage(
        { type: "REQUEST_TRANSCRIBE", audio: msg.audio },
        resp => sendResponse(resp)
      );
    });
    return true;
  }
});
```

---

## 6. `popup/popup.html`

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ASR Popup</title></head>
<body>
  <button id="record">Record 5 s</button>
  <pre id="output"></pre>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

---

## 7. `popup/popup.js`

```js
const btn = document.getElementById("record");
const out = document.getElementById("output");

btn.addEventListener("click", async () => {
  out.textContent = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    await new Promise(r => setTimeout(r, 5000));
    recorder.stop();
    await new Promise(r => (recorder.onstop = r));

    // Decode to 16 kHz Float32 PCM
    const arrayBuffer = await new Blob(chunks).arrayBuffer();
    const ctx = new AudioContext({ sampleRate: 16000 });
    const audioBuf = await ctx.decodeAudioData(arrayBuffer);
    const pcm = audioBuf.getChannelData(0);

    chrome.runtime.sendMessage(
      { type: "REQUEST_TRANSCRIBE", audio: pcm.buffer },
      resp => {
        out.textContent = resp.error ? `Error: ${resp.error}` : resp.text;
      }
    );
  } catch (err) {
    out.textContent = "Mic error: " + err.message;
  }
});
```

---

## 8. Load & Test

1. Copy your unzipped `vosk-model-en-us-0.22-lgraph/` into `extension-root/wasm/`.
2. Load unpacked in `chrome://extensions`.
3. Click **Record 5 s**, grant mic access, and verify the transcript in the popup.
