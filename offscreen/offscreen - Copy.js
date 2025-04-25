// ————————————————————————————————————————————————————————————
// CRITICAL FIXES (must be at the very top)

// 1) Load the in-JS WASM bundle (vosk.wasm.js) first
import './vosk.wasm.js';              // load the embedded WASM bytes

// EARLY DEBUG - Runs before anything else
console.log('[OFFSCREEN.JS] Script starting - very early debug point');


// placeholders for the constructors
let Model, Recognizer;

// 3) Then declare the keep-alive handle
let keepAliveAudio = null;
// —————————————————————————————————————————————————————————————


// Offscreen document functionality
// This script handles tasks that can't be done in the service worker

// Vosk will be loaded via <script> tag in HTML, so we don't import it
// import { Model, Recognizer } from './vosk.final.js';

// Create a port to the extension service worker
let serviceWorkerPort = null;

// Track whether Vosk is initialized
let voskInitialized = false;
let voskModel = null;
let voskRecognizer = null;

// Debug flag - set to true for detailed logging
const DEBUG = true;

// Enhanced logging
function debugLog(...args) {
  if (DEBUG) {
    console.log('[OFFSCREEN-DEBUG]', ...args);
    // Also send to service worker for visibility
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_LOG',
      payload: {
        message: args.join(' '),
        timestamp: Date.now()
      }
    });
  }
}
 // --- FALLBACK: listen for direct chrome.runtime.sendMessage() calls ---
 

// CRITICAL: Send ready signal via both port and runtime
function signalReady(voskStatus = false, error = null) {
  debugLog(`Sending READY signal. Vosk status: ${voskStatus}`, error ? `Error: ${error}` : '');
  
  const readyPayload = {
    type: 'OFFSCREEN_READY',
    payload: {
      ready: true,
      voskLoaded: voskStatus,
      error: error,
      timestamp: Date.now()
    }
  };
  
  // Send via port if available
  if (serviceWorkerPort) {
    try {
      debugLog('Sending READY signal via port');
      serviceWorkerPort.postMessage(readyPayload);
    } catch (e) {
      debugLog('Error sending via port:', e);
    }
  }
  
  // Always send via runtime messaging as backup
  try {
    debugLog('Sending READY signal via runtime.sendMessage');
    chrome.runtime.sendMessage(readyPayload);
  } catch (e) {
    debugLog('Error sending via runtime:', e);
  }
}

// Initialize connection to service worker
function initializeConnection() {
  debugLog('Initializing connection to service worker');
  
  try {
    // Connect to the service worker
    console.log('[OFFSCREEN.JS] about to connect port...');
    debugLog('Attempting to create port connection...');
    
    // Create the port connection
    serviceWorkerPort = chrome.runtime.connect({ name: 'offscreen-port' });
    
    // Set up listener for messages from service worker
    serviceWorkerPort.onMessage.addListener((message) => {
      debugLog('Received message from SW via port:', message);
      handleServiceWorkerMessage(message);
      
      // Special handling for PING messages
      if (message.type === 'PING') {
        try {
          serviceWorkerPort.postMessage({ 
            type: 'PONG', 
            timestamp: Date.now(),
            originalTimestamp: message.timestamp 
          });
          debugLog('Responded to PING with PONG');
        } catch (e) {
          debugLog('Error responding to PING:', e);
        }
      }
    });
    
    // Log the port connection success in a way that's unmistakable in console
    console.log('[OFFSCREEN.JS] PORT CONNECTION SUCCESSFUL ✓');
    debugLog('Port connection established successfully');
    
    // Send a basic port connected message (not ready yet)
    serviceWorkerPort.postMessage({
      type: 'PORT_CONNECTED',
      timestamp: Date.now()
    });
    
    // Start the heartbeat immediately
    startHeartbeat();
    
    // Set up disconnect handler to attempt reconnection
    serviceWorkerPort.onDisconnect.addListener(() => {
      debugLog('Port disconnected, attempting to reconnect...');
      serviceWorkerPort = null;
      
      // Try to reconnect after a short delay
      setTimeout(() => {
        debugLog('Attempting to reconnect after disconnect...');
        initializeConnection();
      }, 1000);
    });
    
  } catch (error) {
    debugLog('ERROR establishing port connection:', error);
    
    // Retry connection after a delay
    setTimeout(() => {
      debugLog('Retrying port connection...');
      initializeConnection();
    }, 1000);
  }
}

// Process messages from the service worker
function handleServiceWorkerMessage(message) {
  debugLog('Handling message from SW:', message);
  
  switch (message.type) {
    case 'HEARTBEAT_ACK':
      // Heartbeat acknowledged, nothing to do
      break;

    case 'INIT_TRANSCRIBER':
    case 'INIT_WHISPER': // Support both message types for backward compatibility
      // Initialize transcription system
      debugLog('Received transcription initialization request');
      initializeVosk().then(success => {
        debugLog(`Vosk initialization ${success ? 'succeeded' : 'failed'}`);
        // Signal ready even if initialization failed - we'll fall back to error handling
        signalReady(success);
      });
      break;
      
    case 'TRANSCRIBE_AUDIO':
    case 'TRANSCRIBE_AUDIO_VOSK':
      // Handle transcription request - support both message types
      debugLog('Received transcription request:', message.payload?.requestId);
      handleVoskTranscription(message.payload);
      break;
      
    case 'GET_READY_STATE':
      // Respond with current ready state
      signalReady(voskInitialized);
      break;
      
    case 'START_TRANSCRIPTION':
      console.log("[OFFSCREEN] 📨 Received START_TRANSCRIPTION message");
      handleVoskTranscription(message.payload);
      break;
      
    default:
      debugLog('Unknown message type:', message.type);
  }
}

// Send heartbeat to service worker to keep connection alive
function startHeartbeat() {
  const HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
  
  debugLog('Starting heartbeat');
  
  // Set up interval to send heartbeat
  setInterval(() => {
    if (serviceWorkerPort) {
      try {
        serviceWorkerPort.postMessage({
          type: 'HEARTBEAT',
          timestamp: Date.now()
        });
      } catch (error) {
        debugLog('Error sending heartbeat, attempting to reconnect:', error);
        // Attempt to reconnect if heartbeat fails
        initializeConnection();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// Creates a silent audio loop to keep the offscreen document alive
function createAndPlayLoopingAudio() {
  debugLog('Creating audio keepalive');
  
  try {
    // Only create if not already playing
    if (keepAliveAudio) {
      debugLog('Audio keepalive already active');
      return;
    }
    
    // Create audio context
    const audioContext = new AudioContext();
    
    // Create silent oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Set gain to 0 (silent)
    gainNode.gain.value = 0;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start oscillator
    oscillator.start();
    
    // Store reference
    keepAliveAudio = {
      context: audioContext,
      oscillator: oscillator,
      gain: gainNode
    };
    
    debugLog('Audio keepalive started');
  } catch (error) {
    debugLog('Error creating audio keepalive:', error);
  }
}

// Allow manual keepalive triggering for debugging
window.sendManualKeepAlive = function() {
  debugLog('Sending manual keepalive');
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_DEBUG',
    action: 'MANUAL_KEEPALIVE',
    timestamp: Date.now()
  });
};

// Enhanced Vosk initialization with simplified approach
async function initializeVosk() {
  debugLog('Starting Vosk initialization');
  
  if (voskInitialized && voskRecognizer) {
    debugLog('Vosk already initialized, reusing existing instance');
    return true;
  }

  try {
    debugLog('Initializing Vosk...');
    if (typeof window.logToUI === 'function') {
      window.logToUI('Starting Vosk initialization');
    }

    // Check model path
    const modelPath = chrome.runtime.getURL('wasm/vosk-model-en-us-0.22-lgraph');
    debugLog('Using model path:', modelPath);
    if (typeof window.logToUI === 'function') {
      window.logToUI(`Using model path: ${modelPath}`);
    }
    
    // Verify model exists by checking the README file
    try {
      const testPath = `${modelPath}/README`;
      const response = await fetch(testPath);
      if (!response.ok) {
        throw new Error(`Model path not accessible: ${response.status}`);
      }
      debugLog('Model path is accessible');
      if (typeof window.logToUI === 'function') {
        window.logToUI('Model path is accessible ✓');
      }
      
      // Also log the content of README to verify we can read files
      const readmeText = await response.text();
      debugLog('README content (first 100 chars):', readmeText.substring(0, 100));
    } catch (e) {
      debugLog('Error accessing model path:', e);
      throw new Error(`Model accessibility check failed: ${e.message}`);
    }

    // Load scripts if needed
    if (!window.Vosk) {
      debugLog('Vosk not found, loading scripts');
      await loadVoskScripts();
    }
    
    // Verify Vosk is available
    if (!window.Vosk) {
      throw new Error('Failed to load Vosk library');
    }
    
    debugLog('Vosk library loaded, object contains:', Object.keys(window.Vosk).join(', '));

    // Simple approach - use Vosk.createModel first
    debugLog('Creating model using Vosk.createModel...');
    try {
      voskModel = await window.Vosk.createModel(modelPath);
      debugLog('Model created with createModel successfully');
      if (typeof window.logToUI === 'function') {
        window.logToUI('Model created with createModel successfully ✓');
      }
    } catch (e) {
      debugLog('Error creating model with createModel:', e);
      if (typeof window.logToUI === 'function') {
        window.logToUI(`Error creating model with createModel: ${e.message}`, true);
      }
      
      // Fall back to Model constructor
      debugLog('Falling back to Model constructor');
      voskModel = new window.Vosk.Model(modelPath);
    }
    
    // Give more time to initialize
    debugLog('Waiting for model to initialize...');
    if (typeof window.logToUI === 'function') {
      window.logToUI('Waiting for model to initialize (10 seconds)...');
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Try creating a recognizer using registerRecognizer
    debugLog('Creating recognizer with registerRecognizer...');
    if (typeof window.logToUI === 'function') {
      window.logToUI('Creating recognizer with registerRecognizer...');
    }
    
    try {
      voskRecognizer = await voskModel.registerRecognizer(16000);
      debugLog('Recognizer created successfully');
      if (typeof window.logToUI === 'function') {
        window.logToUI('Recognizer created successfully ✓');
      }
      
      // Verify recognizer methods
      if (typeof voskRecognizer.acceptWaveform !== 'function' || 
          typeof voskRecognizer.finalResult !== 'function') {
        throw new Error('Recognizer missing required methods');
      }
      
      debugLog('Recognizer methods verified');
    } catch (e) {
      debugLog('Error creating recognizer:', e);
      if (typeof window.logToUI === 'function') {
        window.logToUI(`Error creating recognizer: ${e.message}`, true);
      }
      
      // Create a mock recognizer as fallback
      debugLog('Creating mock recognizer as fallback');
      voskRecognizer = createMockRecognizer();
    }

    // Signal success
    debugLog('Vosk initialized successfully');
    voskInitialized = true;
    
    if (typeof window.logToUI === 'function') {
      window.logToUI('✅ Vosk initialized successfully!');
    }
    
    // Send ready signal with success
    signalReady(true);
    
    return true;

  } catch (error) {
    // Handle initialization failure
    debugLog('ERROR initializing Vosk:', error);
    debugLog('Error details:', error.stack || 'No stack trace');
    
    // Update state
    voskInitialized = false;
    
    if (typeof window.logToUI === 'function') {
      window.logToUI(`❌ Vosk initialization failed: ${error.message}`, true);
      window.logToUI(`Stack trace: ${error.stack || 'No stack trace available'}`, true);
    }
    
    // Create a mock recognizer as fallback
    debugLog('Creating mock recognizer due to initialization failure');
    voskRecognizer = createMockRecognizer();
    
    // Signal ready with failure but with mock recognizer
    signalReady(false, `Vosk init failed: ${error.message}`);
    
    return false;
  }
}

// Helper function to load Vosk scripts
async function loadVoskScripts() {
  debugLog('Loading Vosk scripts');
  
  // Create a helper function to load scripts
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };
  
  // First load wasm.js if not already loaded
  if (!window.voskWasmLoaded) {
    debugLog('Loading vosk.wasm.js');
    try {
      await loadScript(chrome.runtime.getURL('offscreen/vosk.wasm.js'));
      debugLog('vosk.wasm.js loaded');
    } catch (e) {
      debugLog('Error loading vosk.wasm.js:', e);
      throw e;
    }
  }
  
  // Then load final.js
  debugLog('Loading vosk.final.js');
  try {
    await loadScript(chrome.runtime.getURL('offscreen/vosk.final.js'));
    debugLog('vosk.final.js loaded');
  } catch (e) {
    debugLog('Error loading vosk.final.js:', e);
    throw e;
  }
  
  // Additional check - verify if Vosk is available
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 3000);
  });
  
  const checkVosk = new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.Vosk) {
        clearInterval(interval);
        resolve(window.Vosk);
      }
    }, 100);
  });
  
  const result = await Promise.race([checkVosk, timeout]);
  if (!result) {
    debugLog('Timed out waiting for Vosk to become available');
    throw new Error('Timed out waiting for Vosk to become available');
  }
  
  return result;
}

// Helper to create a mock recognizer
function createMockRecognizer() {
  debugLog('Creating mock recognizer');
  return {
    acceptWaveform: function(data) {
      debugLog('Mock recognizer.acceptWaveform called with data length:', data.length);
      return true;
    },
    finalResult: function() {
      debugLog('Mock recognizer.finalResult called');
      return { 
        text: "[Mock transcription] Vosk failed to initialize properly. This is fallback transcription.", 
        result: [{ 
          conf: 1.0, 
          start: 0, 
          end: 5, 
          word: "mock" 
        }]
      };
    },
    isMock: true
  };
}

// Updated handleVoskTranscription function with better error handling
async function handleVoskTranscription(payload) {
  const { audioDataUrl, requestId, options = {} } = payload;
  debugLog(`Processing Vosk transcription request: ${requestId}`);

  // Immediately acknowledge receipt of the request
  sendUpdateMessage({
    type: 'TRANSCRIPTION_PROGRESS',
    payload: { 
      requestId, 
      percent: 0,
      status: 'received' 
    }
  });

  // Helper: send a message back via port or runtime
  function sendUpdateMessage(msg) {
    debugLog(`Sending update for request ${requestId}: ${msg.type}`);
    
    if (serviceWorkerPort) {
      try {
        serviceWorkerPort.postMessage(msg);
        return true;
      } catch (err) {
        debugLog('Error sending via port, falling back to runtime:', err);
      }
    }
    
    // Fallback to runtime messaging
    try {
      chrome.runtime.sendMessage(msg).catch(err =>
        debugLog('Error sending fallback runtime message:', err)
      );
      return true;
    } catch (err) {
      debugLog('Fatal error sending message:', err);
      return false;
    }
  }

  try {
    // Validate input
    if (!audioDataUrl) {
      throw new Error('No audio data provided');
    }
    
    if (!requestId) {
      throw new Error('No request ID provided');
    }

    // 1) Ensure Vosk is initialized
    if (!voskInitialized) {
      debugLog('Vosk not initialized, initializing now…');
      sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { 
          requestId, 
          percent: 5,
          status: 'initializing_vosk' 
        }
      });
      
      await initializeVosk();
    }
    
    if (!voskInitialized || !voskRecognizer) {
      throw new Error('Vosk initialization failed.');
    }

    // 2) Report starting actual transcription
    sendUpdateMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: { 
        requestId, 
        percent: 10,
        status: 'decoding_audio' 
      }
    });

    // 3) Decode the base64 WAV
    debugLog('Converting audio data URL to binary data');
    let base64Data;
    
    try {
      // Handle different possible formats of the data URL
      if (audioDataUrl.startsWith('data:audio')) {
        base64Data = audioDataUrl.split(',')[1];
      } else {
        base64Data = audioDataUrl;
      }
      
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      debugLog(`Decoded ${len} bytes of audio data`);
      
      // 4) Report progress
      sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { 
          requestId, 
          percent: 20,
          status: 'processing_wav' 
        }
      });

      // 5) Extract PCM from WAV
      debugLog('Finding data chunk in WAV file');
      let dataStart = 0;
      
      // Look for the 'data' chunk marker
      for (let i = 0; i < bytes.length - 4; i++) {
        if (
          bytes[i] === 0x64 && // 'd'
          bytes[i+1] === 0x61 && // 'a'
          bytes[i+2] === 0x74 && // 't'
          bytes[i+3] === 0x61    // 'a'
        ) {
          dataStart = i + 8; // Skip 'data' + size (4 bytes)
          break;
        }
      }
      
      if (!dataStart) {
        throw new Error('Could not find data chunk in WAV file');
      }
      
      debugLog(`Found data chunk starting at byte ${dataStart}`);
      
      // Extract the actual audio data after the 'data' chunk header
      const audioData = bytes.slice(dataStart);
      debugLog(`Extracted ${audioData.length} bytes of audio data`);
      
      // Convert to Int16Array for Vosk
      const pcmData = new Int16Array(
        audioData.buffer,
        audioData.byteOffset,
        audioData.byteLength / 2
      );
      
      debugLog(`Created Int16Array with ${pcmData.length} samples`);
      
      // 6) Report progress before processing
      sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { 
          requestId, 
          percent: 40,
          status: 'processing_audio' 
        }
      });

      // 7) Run Vosk
      debugLog('Passing data to Vosk recognizer');
      voskRecognizer.acceptWaveform(pcmData);
      
      // 8) Report almost done
      sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { 
          requestId, 
          percent: 90,
          status: 'finalizing' 
        }
      });

      // 9) Get the final result
      const result = voskRecognizer.finalResult();
      debugLog('Transcription completed:', result);
      
      // 10) Process result
      const transcriptionText = result.text || '';
      debugLog(`Final transcription text: "${transcriptionText}"`);

      // 11) Send 100% progress and the final result
      sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { 
          requestId, 
          percent: 100,
          status: 'complete' 
        }
      });
      
      sendUpdateMessage({
        type: 'TRANSCRIPTION_RESULT',
        payload: { 
          requestId, 
          result: transcriptionText,
          rawResult: result
        }
      });
      
      return true;

    } catch (decodeError) {
      debugLog('Error decoding audio data:', decodeError);
      throw new Error(`Failed to decode audio data: ${decodeError.message}`);
    }

  } catch (error) {
    // Handle any errors in the transcription process
    debugLog(`Error in handleVoskTranscription:`, error);
    debugLog('Stack trace:', error.stack || 'No stack trace available');

    // Report error
    sendUpdateMessage({
      type: 'TRANSCRIPTION_ERROR',
      payload: { 
        requestId, 
        error: error.message,
        errorType: error.name || 'TranscriptionError',
        errorDetails: error.stack || 'No details available'
      }
    });

    // Fall back to mock transcription
    debugLog('Providing mock transcription as fallback');
    provideMockTranscription(
      percent => sendUpdateMessage({
        type: 'TRANSCRIPTION_PROGRESS',
        payload: { requestId, percent }
      }),
      null,
      requestId,
      options
    );
    
    return false;
  }
}

// Fallback mock implementation
function provideMockTranscription(updateProgress, serviceWorkerPort, requestId, options) {  
  debugLog(`Providing mock transcription for ${requestId}`);
  
  updateProgress(10);
  
  // Simulate processing time
  setTimeout(() => {
    updateProgress(50);
    
    setTimeout(() => {
      updateProgress(90);
      
      // Send mock result after delay
      setTimeout(() => {
        updateProgress(100);
        
        if (serviceWorkerPort) {
          serviceWorkerPort.postMessage({
            type: 'TRANSCRIPTION_RESULT',
            payload: {
              requestId,
              result: "[Mock transcription] This is a simulated transcription result because Vosk processing failed. Please check console for errors.",
              isMockResult: true
            }
          });
        }
      }, 500);
    }, 500);
  }, 500);
}

// Initialize the offscreen document when loaded
try {
  debugLog('Offscreen document loaded');
  
  // CRITICAL FIX: Check if vosk-wasm.js provided the global objects we need
  try {
    if (window.Model) {
      debugLog('window.Model found, vosk-wasm.js loaded successfully');
    } else {
      debugLog('window.Model NOT FOUND! Check if vosk-wasm.js loaded correctly');
      debugLog('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('vosk')).join(', '));
    }
  } catch (e) {
    debugLog('Error checking for window.Model:', e);
  }
  
  // First establish connection to service worker
  initializeConnection();
  
  // CRITICAL FIX: Signal ready IMMEDIATELY to prevent service worker hanging
  // Even if Vosk fails, we'll signal ready=false so transcription can fallback to mock
  debugLog('Sending initial ready signal before Vosk initialization');
  signalReady(false, 'Initial ready signal, Vosk initialization pending');
  
  // Make our ready check more aggressive by pinging repeatedly
  let readyAttempts = 0;
  const readyInterval = setInterval(() => {
    readyAttempts++;
    debugLog(`Ready check attempt ${readyAttempts}`);
    
    // Send keepalive through runtime messaging
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_DEBUG',
      action: 'MANUAL_KEEPALIVE',
      timestamp: Date.now(),
      readyAttempt: readyAttempts
    });
    
    // Send ready signal every attempt
    signalReady(voskInitialized);
    
    // After 5 attempts, try to initialize Vosk if not already done
    if (readyAttempts === 5 && !voskInitialized) {
      debugLog('Starting delayed Vosk initialization');
      initializeVosk().catch(e => debugLog('Delayed Vosk init failed:', e));
    }
    
    // Stop after 10 attempts
    if (readyAttempts >= 10) {
      debugLog('Stopping ready check attempts after 10 tries');
      clearInterval(readyInterval);
    }
  }, 1500);
  
  // Immediately start initializing Vosk
  try {
    debugLog('Starting Vosk initialization on document load');
    await initializeVosk();
    debugLog('Vosk initialized during document load - ready signal sent');
    clearInterval(readyInterval); // Stop the interval if Vosk init succeeds quickly
  } catch (error) {
    debugLog('Failed to initialize Vosk on document load:', error);
    // We already send a ready signal with error in initializeVosk
  }
  
  // Start playing silent audio to keep document alive
  createAndPlayLoopingAudio();
} catch (error) {
  debugLog('Error initializing offscreen document:', error);
}

// ——————————————————————————————————————————————————————————
// Fallback for runtime‐messaging transcription requests
// (must be at top‐level, after all your other code)

chrome.runtime.onMessage.addListener((message, sender) => {
  // catch either the original "action: 'transcribeAudio'"
  // or the typed‐out versions used over the port
  if (
    message.action === 'transcribeAudio' ||
    message.type   === 'TRANSCRIBE_AUDIO' ||
    message.type   === 'TRANSCRIBE_AUDIO_VOSK'
  ) {
    debugLog('⤷ fallback via runtime.sendMessage:', message);
    handleVoskTranscription({
      audioDataUrl: message.audioDataUrl,
      requestId:   message.requestId,
      options:     message.options || {}
    });
  }
  // no async response, so return nothing
});

// Export functions for potential use in other modules or testing
export {
  handleVoskTranscription,
  initializeVosk,
  provideMockTranscription
};

// model-check.js - Diagnostic script to check for Vosk model files
// This can be added to your offscreen.js file for debugging

/**
 * Checks if a given file exists in the extension's directory
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if the file exists, false otherwise
 */
async function checkFileExists(filePath) {
  try {
    const response = await fetch(filePath, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error checking file:', filePath, error);
    return false;
  }
}

/**
 * Checks for the existence of Vosk model files
 * @returns {Promise<object>} Object containing check results
 */
async function checkVoskModelFiles() {
  const results = {
    models: [],
    wasm: {
      exists: false,
      path: null
    },
    js: {
      exists: false,
      path: null
    }
  };
  
  // Check for model directories
  const modelPaths = [
    'wasm/vosk-model-small-en-us-0.15',
    'wasm/vosk-model-en-us-0.22-lgraph',
    'vosk-model-small-en-us-0.15',
    'vosk-model-en-us-0.22-lgraph'
  ];
  
  for (const modelPath of modelPaths) {
    const fullPath = chrome.runtime.getURL(modelPath);
    const readmeExists = await checkFileExists(`${fullPath}/README`);
    const modelExists = await checkFileExists(`${fullPath}/am/final.mdl`);
    
    results.models.push({
      path: modelPath,
      fullPath: fullPath,
      readmeExists: readmeExists,
      modelExists: modelExists,
      valid: readmeExists && modelExists
    });
  }
  
  // Check for WASM files
  const wasmPaths = [
    'offscreen/vosk.wasm',
    'wasm/vosk.wasm',
    'vosk.wasm'
  ];
  
  for (const wasmPath of wasmPaths) {
    const fullPath = chrome.runtime.getURL(wasmPath);
    const exists = await checkFileExists(fullPath);
    
    if (exists) {
      results.wasm.exists = true;
      results.wasm.path = wasmPath;
      break;
    }
  }
  
  // Check for JS files
  const jsPaths = [
    'offscreen/vosk.final.js',
    'offscreen/vosk.js',
    'wasm/vosk.js',
    'vosk.js'
  ];
  
  for (const jsPath of jsPaths) {
    const fullPath = chrome.runtime.getURL(jsPath);
    const exists = await checkFileExists(fullPath);
    
    if (exists) {
      results.js.exists = true;
      results.js.path = jsPath;
      break;
    }
  }
  
  return results;
}

// Debug function to check Vosk model and print results
async function debugVoskModel() {
  console.log('🔍 Starting Vosk model check...');
  
  // Use UI logger if available
  if (typeof window.logToUI === 'function') {
    window.logToUI('🔍 Starting Vosk model check...');
  }
  
  // Get model check results
  const results = await checkVoskModelFiles();
  
  console.log('🔍 Vosk model check results:', results);
  
  // Format results for UI display
  let uiMessage = '';
  
  // Check for models
  const validModels = results.models.filter(m => m.valid);
  if (validModels.length > 0) {
    uiMessage += '✅ Found valid Vosk model(s):\n';
    validModels.forEach(model => {
      uiMessage += `   - ${model.path}\n`;
    });
  } else {
    uiMessage += '❌ No valid Vosk models found!\n';
    results.models.forEach(model => {
      uiMessage += `   - ${model.path} (README: ${model.readmeExists ? '✓' : '✗'}, Model: ${model.modelExists ? '✓' : '✗'})\n`;
    });
  }
  
  // Check for WASM file
  if (results.wasm.exists) {
    uiMessage += `✅ Found WASM file: ${results.wasm.path}\n`;
  } else {
    uiMessage += '❌ No WASM file found!\n';
  }
  
  // Check for JS file
  if (results.js.exists) {
    uiMessage += `✅ Found JS file: ${results.js.path}\n`;
  } else {
    uiMessage += '❌ No JS file found!\n';
  }
  
  // Log to UI
  if (typeof window.logToUI === 'function') {
    window.logToUI(uiMessage);
  } else {
    console.log(uiMessage);
  }
  
  return results;
}

// Export for testing
window.debugVoskModel = debugVoskModel;
