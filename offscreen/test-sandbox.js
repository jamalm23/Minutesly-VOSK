// test-sandbox.js - External JavaScript for test-sandbox.html
// This avoids Content Security Policy issues with inline scripts

// Log function
function log(text, type = 'info') {
  const logEl = document.getElementById('log');
  if (!logEl) {
    console.error('Log element not found');
    return;
  }
  
  const entry = document.createElement('div');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  
  if (type) {
    entry.className = type;
  }
  
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${text}`);
}

// Sandbox reference
let sandboxFrame = null;

// Initialize event listeners when the page loads
document.addEventListener('DOMContentLoaded', function() {
  log('Test sandbox loaded', 'info');
  
  // Initialize button references
  const initButton = document.getElementById('initButton');
  const testButton = document.getElementById('testButton');
  const statusButton = document.getElementById('statusButton');
  
  if (!initButton || !testButton || !statusButton) {
    console.error('One or more buttons not found in the DOM');
    return;
  }
  
  // Create and initialize sandbox iframe
  createSandbox();
  
  // Initialize Vosk button
  initButton.addEventListener('click', function() {
    initializeVosk();
  });
  
  // Test transcription button
  testButton.addEventListener('click', function() {
    testTranscription();
  });
  
  // Status check button
  statusButton.addEventListener('click', function() {
    checkStatus();
  });
});

// Create sandbox iframe
function createSandbox() {
  try {
    log('Creating sandbox iframe...', 'info');
    
    // Create iframe if it doesn't exist
    if (!sandboxFrame) {
      sandboxFrame = document.createElement('iframe');
      sandboxFrame.src = chrome.runtime.getURL('offscreen/vosk-browser-embedded-sandbox.html');
      
      // Make iframe small but visible for debugging
      sandboxFrame.style.width = '300px';
      sandboxFrame.style.height = '100px';
      sandboxFrame.style.position = 'fixed';
      sandboxFrame.style.bottom = '10px';
      sandboxFrame.style.right = '10px';
      sandboxFrame.style.border = '1px solid #ccc';
      sandboxFrame.style.zIndex = '9999';
      
      document.body.appendChild(sandboxFrame);
      
      log('Sandbox iframe created', 'success');
      
      // Set up message listener for sandbox communication
      window.addEventListener('message', handleSandboxMessage);
    } else {
      log('Sandbox iframe already exists', 'info');
    }
  } catch (error) {
    log(`Error creating sandbox: ${error.message}`, 'error');
    console.error('Sandbox creation error:', error);
  }
}

// Handle messages from sandbox
function handleSandboxMessage(event) {
  // Ignore messages from other sources
  if (!sandboxFrame || event.source !== sandboxFrame.contentWindow) {
    return;
  }
  
  const message = event.data;
  
  if (!message || !message.type) {
    return;
  }
  
  log(`Received message from sandbox: ${message.type}`, 'info');
  console.log('Full sandbox message:', message);
  
  // Handle specific message types
  switch (message.type) {
    case 'SANDBOX_READY':
      log('Sandbox is ready', 'success');
      break;
      
    case 'INIT_RESULT':
      if (message.success) {
        log('Vosk initialized successfully', 'success');
      } else {
        log(`Vosk initialization failed: ${message.error}`, 'error');
      }
      break;
      
    case 'TRANSCRIBE_RESULT':
      if (message.success) {
        log(`Transcription result: ${message.result.text}`, 'success');
      } else {
        log(`Transcription failed: ${message.error}`, 'error');
      }
      break;
      
    case 'STATUS_RESULT':
      log(`Sandbox status: ${JSON.stringify(message.status)}`, 'info');
      break;
      
    case 'ERROR':
      log(`Sandbox error: ${message.error}`, 'error');
      break;
      
    default:
      log(`Unknown message type: ${message.type}`, 'info');
  }
}

// Initialize Vosk in the sandbox
function initializeVosk() {
  if (!sandboxFrame) {
    log('Sandbox not created yet', 'error');
    return;
  }
  
  log('Sending INIT_VOSK to sandbox...', 'info');
  
  try {
    // Get the model path from the extension
    const modelPath = chrome.runtime.getURL('wasm/vosk-model-en-us-0.22-lgraph');
    log(`Using model path: ${modelPath}`, 'info');
    
    // Send initialization message
    sandboxFrame.contentWindow.postMessage({
      type: 'INIT_VOSK',
      modelPath: modelPath
    }, '*');
  } catch (error) {
    log(`Error initializing Vosk: ${error.message}`, 'error');
    console.error('Vosk initialization error:', error);
  }
}

// Test transcription with generated audio
function testTranscription() {
  if (!sandboxFrame) {
    log('Sandbox not created yet', 'error');
    return;
  }
  
  log('Generating test audio...', 'info');
  
  try {
    // Generate simple sine wave audio
    const sampleRate = 16000;
    const duration = 2; // seconds
    const frequency = 440; // A4 note
    
    const audioData = new Int16Array(sampleRate * duration);
    for (let i = 0; i < audioData.length; i++) {
      // Generate sine wave with some amplitude modulation
      audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000;
    }
    
    log(`Generated ${audioData.length} samples of test audio`, 'info');
    
    // Send transcription request
    const requestId = 'test-' + Date.now();
    log(`Sending transcription request: ${requestId}`, 'info');
    
    sandboxFrame.contentWindow.postMessage({
      type: 'TRANSCRIBE',
      audioData: Array.from(audioData),
      requestId: requestId
    }, '*');
  } catch (error) {
    log(`Error testing transcription: ${error.message}`, 'error');
    console.error('Transcription test error:', error);
  }
}

// Check sandbox status
function checkStatus() {
  if (!sandboxFrame) {
    log('Sandbox not created yet', 'error');
    return;
  }
  
  log('Checking sandbox status...', 'info');
  
  try {
    sandboxFrame.contentWindow.postMessage({
      type: 'STATUS'
    }, '*');
  } catch (error) {
    log(`Error checking status: ${error.message}`, 'error');
    console.error('Status check error:', error);
  }
}
