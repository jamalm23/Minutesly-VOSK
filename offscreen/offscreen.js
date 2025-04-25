// Add this at the top of your offscreen.js file after other imports
// Note: vosk-integration.js is already included in the HTML

// Initialize communication with service worker
async function initializeConnection() {
  debugLog('Initializing connection to service worker');
  
  try {
    // Connect to the service worker
    console.log('[OFFSCREEN.JS] about to connect port...');
    debugLog('Attempting to create port connection...');
    
    // Create the port connection with error handling
    try {
      serviceWorkerPort = chrome.runtime.connect({ name: 'offscreen-port' });
      
      // Log the port connection success in a way that's unmistakable in console
      console.log('[OFFSCREEN.JS] PORT CONNECTION SUCCESSFUL ✓');
      debugLog('Port connection established successfully');
      
      // Send a basic port connected message (not ready yet)
      serviceWorkerPort.postMessage({
        type: 'PORT_CONNECTED',
        timestamp: Date.now()
      });
    } catch (connectError) {
      console.error('[OFFSCREEN.JS] PORT CONNECTION FAILED:', connectError);
      debugLog('Error creating port connection:', connectError);
      
      // Try again after a delay
      setTimeout(() => {
        debugLog('Retrying port connection after connection error...');
        initializeConnection();
      }, 1000);
      return;
    }
    
    // Set up listener for messages from service worker
    serviceWorkerPort.onMessage.addListener((message) => {
      debugLog('Received message from SW via port:', message);
      
      // Special handling for PING messages for immediate response
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
      
      // Handle all other messages
      handleServiceWorkerMessage(message);
    });
    
    // Start the heartbeat immediately
    startHeartbeat();
    
    // Set up disconnect handler to attempt reconnection
    serviceWorkerPort.onDisconnect.addListener(() => {
      const disconnectError = chrome.runtime.lastError;
      debugLog('Port disconnected', disconnectError ? `Error: ${disconnectError.message}` : '');
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
  if (!message || typeof message !== 'object') {
    debugLog('Received invalid message from SW:', message);
    return;
  }
  
  debugLog('Handling message from SW:', message.type);
  
  switch (message.type) {
    case 'HEARTBEAT_ACK':
      // Heartbeat acknowledged, nothing to do
      break;

    case 'INIT_TRANSCRIBER':
    case 'INIT_WHISPER': // Support both message types for backward compatibility
      // Initialize transcription system
      debugLog('Received transcription initialization request');
      initializeVoskInOffscreen()
        .then(success => {
          debugLog(`Vosk initialization ${success ? 'succeeded' : 'failed'}`);
          // Signal ready even if initialization failed - we'll fall back to error handling
          signalReady(success);
        })
        .catch(err => {
          debugLog('Error during Vosk initialization:', err);
          signalReady(false, err.message);
        });
      break;
      
    case 'TRANSCRIBE_AUDIO':
    case 'TRANSCRIBE_AUDIO_VOSK':
      // Handle transcription request - support both message types
      const requestId = message.payload?.requestId;
      debugLog('Received transcription request:', requestId);
      
      if (!message.payload) {
        debugLog('Error: Missing payload in transcription request');
        sendUpdateMessage({
          type: 'TRANSCRIPTION_ERROR',
          payload: { 
            requestId: requestId || 'unknown',
            error: 'Missing payload in transcription request',
            errorType: 'InvalidRequest',
            errorDetails: 'The transcription request is missing required payload data'
          }
        });
        return;
      }
      
      // Process the transcription request
      handleVoskTranscription(message.payload);
      break;
      
    case 'GET_READY_STATE':
      // Respond with current ready state
      signalReady(voskInitialized);
      break;
      
    case 'START_TRANSCRIPTION':
      console.log("[OFFSCREEN] 📨 Received START_TRANSCRIPTION message");
      
      if (!message.payload) {
        debugLog('Error: Missing payload in START_TRANSCRIPTION request');
        return;
      }
      
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

// Initialize Vosk using the direct integration
async function initializeVoskInOffscreen() {
  debugLog('Initializing Vosk via direct integration');
  
  if (voskInitialized) {
    debugLog('Vosk already initialized');
    return true;
  }
  
  try {
    // Wait for the script to load and initialize
    if (!window.VoskIntegration) {
      debugLog('Waiting for VoskIntegration to be available...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.VoskIntegration) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Set a timeout in case it never loads
        setTimeout(() => {
          clearInterval(checkInterval);
          debugLog('Timeout waiting for VoskIntegration');
          resolve();
        }, 5000);
      });
    }
    
    if (!window.VoskIntegration) {
      debugLog('VoskIntegration not available, checking global Vosk object');
      
      // If we have window.Vosk but not window.VoskIntegration, create it
      if (typeof window.Vosk === 'object') {
        debugLog('Creating VoskIntegration from global Vosk object');
        // This is a manual fallback if our module hasn't loaded properly
        window.VoskIntegration = {
          initializeVosk: async function() {
            try {
              const modelPath = chrome.runtime.getURL('wasm/vosk-model-en-us-0.22-lgraph');
              debugLog(`Using model path: ${modelPath}`);
              
              if (!window.Vosk.SpeechRecognizer) {
                debugLog('Vosk.SpeechRecognizer not available', 'error');
                console.error('Missing Vosk.SpeechRecognizer:', window.Vosk);
                return false;
              }
              
              // Create recognizer
              const recognizer = new window.Vosk.SpeechRecognizer({
                model: modelPath,
                sampleRate: 16000
              });
              
              debugLog('Vosk recognizer created successfully');
              return true;
            } catch (error) {
              debugLog(`Error in fallback Vosk init: ${error.message}`, 'error');
              console.error('Vosk fallback init error:', error);
              return false;
            }
          }
        };
      } else {
        throw new Error('VoskIntegration not available and no global Vosk object found');
      }
    }
    
    // Initialize the Vosk integration
    debugLog('Calling VoskIntegration.initializeVosk()');
    const success = await window.VoskIntegration.initializeVosk();
    
    if (success) {
      debugLog('Vosk initialized successfully via direct integration');
      voskInitialized = true;
      return true;
    } else {
      throw new Error('Vosk integration returned false');
    }
  } catch (error) {
    debugLog('Error initializing Vosk via direct integration:', error);
    
    // Try the original method as fallback
    try {
      debugLog('Trying original method as fallback');
      return await initializeSandbox();
    } catch (fallbackError) {
      debugLog('Both initialization methods failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Rename your original method to avoid conflicts
const initializeSandboxOriginal = initializeSandbox;

// Define a stub initializeSandbox function if it doesn't exist
// This avoids reference errors when the original function is not available
function initializeSandbox() {
  debugLog('initializeSandbox stub called (not implemented)');
  return Promise.resolve(false);
}

// Also replace or update your handleVoskTranscription function:

async function handleVoskTranscription(payload) {
  const { audioDataUrl, requestId, options = {} } = payload;
  debugLog(`Processing transcription request: ${requestId}`);

  // Immediately acknowledge receipt of the request
  sendUpdateMessage({
    type: 'TRANSCRIPTION_PROGRESS',
    payload: { 
      requestId, 
      percent: 0,
      status: 'received' 
    }
  });

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
      
      await initializeVoskInOffscreen();
    }
    
    if (!voskInitialized) {
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
    debugLog('Converting audio data URL to PCM data');
    
    let base64Data;
    let audioData;
    
    try {
      // Handle different possible formats of the data URL
      if (audioDataUrl.startsWith('data:audio')) {
        base64Data = audioDataUrl.split(',')[1];
      } else {
        base64Data = audioDataUrl;
      }
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      debugLog(`Decoded ${bytes.length} bytes of audio data`);
      
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
      const audioBytes = bytes.slice(dataStart);
      debugLog(`Extracted ${audioBytes.length} bytes of audio data`);
      
      // Convert to Int16Array for Vosk
      audioData = new Int16Array(
        audioBytes.buffer,
        audioBytes.byteOffset,
        audioBytes.byteLength / 2
      );
      
      debugLog(`Created Int16Array with ${audioData.length} samples`);
      
    } catch (decodeError) {
      debugLog('Error decoding audio data:', decodeError);
      throw new Error(`Failed to decode audio data: ${decodeError.message}`);
    }
    
    // 6) Report progress before processing
    sendUpdateMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: { 
        requestId, 
        percent: 40,
        status: 'processing_audio' 
      }
    });

    // 7) Send to Vosk for transcription
    debugLog('Sending audio data to Vosk for transcription');
    sendUpdateMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: { 
        requestId, 
        percent: 50,
        status: 'transcribing' 
      }
    });
    
    try {
      const result = await window.VoskIntegration.transcribeAudio(audioData, 16000);
      
      // 8) Process result from Vosk
      if (result.success) {
        debugLog('Transcription successful:', result.result);
        
        // 9) Report success
        sendUpdateMessage({
          type: 'TRANSCRIPTION_PROGRESS',
          payload: { 
            requestId, 
            percent: 100,
            status: 'complete' 
          }
        });
        
        // 10) Send the result
        sendUpdateMessage({
          type: 'TRANSCRIPTION_RESULT',
          payload: { 
            requestId, 
            result: result.result.text,
            rawResult: result.result.rawResult
          }
        });
        
        return true;
      } else {
        throw new Error(result.error || 'Unknown error during transcription');
      }
    } catch (error) {
      debugLog('Error from Vosk during transcription:', error);
      throw new Error(`Vosk error: ${error.message}`);
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
    provideMockTranscription(requestId, `[MOCK] Transcription error: ${error.message}. This is a fallback result.`);
    
    return false;
  }
}

// Keep a reference to the original function
const handleVoskTranscriptionOriginal = handleVoskTranscription.toString()
  .replace('async function handleVoskTranscription', 'async function _temp')
  .replace('return await handleVoskTranscriptionOriginal(payload);', 'throw new Error("Recursive call detected");');
eval(handleVoskTranscriptionOriginal);

// CRITICAL FIXES (must be at the very top)

// EARLY DEBUG - Runs before anything else
console.log('[OFFSCREEN.JS] Script starting - very early debug point');

// Keep-alive handle
let keepAliveAudio = null;

// Offscreen document functionality
// This script handles tasks that can't be done in the service worker

// Create a port to the extension service worker
let serviceWorkerPort = null;

// Track Vosk status
let voskInitialized = false;

// Global variable for the wrapper iframe
let wrapperIframe = null;
let wrapperReady = false;

// Debug flag - set to true for detailed logging
const DEBUG = true;

// Enhanced logging
function debugLog(...args) {
  if (DEBUG) {
    console.log('[OFFSCREEN-DEBUG]', ...args);
    // Also send to service worker for visibility
    try {
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_LOG',
        payload: {
          message: args.join(' '),
          timestamp: Date.now()
        }
      });
    } catch (e) {
      // Ignore errors sending log messages
    }
    
    // Also log to UI if available
    if (typeof window.logToUI === 'function') {
      window.logToUI(args.join(' '));
    }
  }
}

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
      serviceWorkerPort.postMessage(readyPayload);
    } catch (e) {
      debugLog('Error sending via port:', e);
    }
  } else {
    debugLog('No port available, using runtime messaging');
  }
  
  // Always send via runtime messaging as backup
  try {
    chrome.runtime.sendMessage(readyPayload);
  } catch (e) {
    debugLog('Error sending via runtime:', e);
  }
}

// Initialize the offscreen document when loaded
document.addEventListener('DOMContentLoaded', async function() {
  // Initial setup and listeners
  addMessageListener();
  updateStatusText('Ready');
  
  // Add test button for Vosk
  const controlsDiv = document.getElementById('controls') || document.createElement('div');
  if (!controlsDiv.id) {
    controlsDiv.id = 'controls';
    document.body.appendChild(controlsDiv);
  }
  
  // Add Vosk test button if it doesn't exist
  if (!document.getElementById('test-vosk-btn')) {
    const testButton = document.createElement('button');
    testButton.id = 'test-vosk-btn';
    testButton.textContent = 'Test Vosk Integration';
    testButton.addEventListener('click', async () => {
      if (!window.VoskIntegration) {
        console.error('VoskIntegration not available');
        updateStatusText('VoskIntegration not available');
        return;
      }
      
      updateStatusText('Testing Vosk integration...');
      try {
        const testResult = await window.VoskIntegration.test();
        if (testResult.success) {
          updateStatusText(`Vosk test successful. Result: "${testResult.text}"`);
        } else {
          updateStatusText(`Vosk test failed: ${testResult.error}`);
        }
      } catch (error) {
        console.error('Vosk test error:', error);
        updateStatusText(`Vosk test error: ${error.message}`);
      }
    });
    
    controlsDiv.appendChild(testButton);
    console.log('Added Vosk test button');
  }
  
  // Add Vosk cache clear button if it doesn't exist
  if (!document.getElementById('clear-vosk-cache-btn')) {
    const clearButton = document.createElement('button');
    clearButton.id = 'clear-vosk-cache-btn';
    clearButton.textContent = 'Clear Vosk Cache';
    clearButton.addEventListener('click', async () => {
      if (!window.VoskIntegration) {
        console.error('VoskIntegration not available');
        updateStatusText('VoskIntegration not available');
        return;
      }
      
      updateStatusText('Clearing Vosk cache...');
      try {
        const cleared = await window.VoskIntegration.clearCache();
        updateStatusText(`Vosk cache ${cleared ? 'cleared' : 'clearing failed'}`);
      } catch (error) {
        console.error('Vosk cache clear error:', error);
        updateStatusText(`Vosk cache clear error: ${error.message}`);
      }
    });
    
    controlsDiv.appendChild(clearButton);
    console.log('Added Vosk cache clear button');
  }
  
  console.log('Offscreen document initialized');
  
  // Initialize connection as soon as possible
  initializeConnection();
  
  // Start background keepalive
  setTimeout(() => {
    try {
      debugLog('Starting keepalive audio...');
      createAndPlayLoopingAudio();
    } catch (e) {
      debugLog('Error starting keepalive:', e);
    }
  }, 1000);
  
  // Listen for messages via chrome.runtime
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Log received messages but avoid logging pings to reduce noise
    if (message.type !== 'PING') {
      debugLog('Received runtime message:', message);
    }
    
    // Ensure proper handling
    try {
      // Always send a response if a response callback was provided
      if (typeof sendResponse === 'function') {
        sendResponse({ received: true, type: message.type });
      }
      
      // Process the message
      handleServiceWorkerMessage(message);
    } catch (e) {
      debugLog('Error handling runtime message:', e);
      // Still try to send response even if processing failed
      if (typeof sendResponse === 'function') {
        sendResponse({ error: e.message });
      }
    }
    
    // Return true to indicate we'll handle the response asynchronously
    return true;
  });
  
  // Add initialization status debug info to the page
  const statusElement = document.getElementById('status-value');
  if (statusElement) {
    statusElement.textContent = 'Ready - Waiting for commands';
  }
  
  // Indicate document is ready via port (if available) and runtime messaging
  debugLog('Sending initial READY message');
  signalReady(true);
  
  // Also send a direct runtime message as a fallback
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_DOCUMENT_READY',
    timestamp: Date.now(),
    initialized: true
  }).catch(e => {
    debugLog('Error sending ready message:', e);
  });
});

// Helper function to update status text
function updateStatusText(text) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = text;
  } else {
    console.log('Status update:', text);
  }
}

// Helper function for sending messages back to service worker
function sendUpdateMessage(message) {
  debugLog(`Sending update: ${message.type}`, message.payload?.requestId ? `(requestId: ${message.payload.requestId})` : '');
  
  let sent = false;
  
  // First try to send via port if available
  if (serviceWorkerPort) {
    try {
      serviceWorkerPort.postMessage(message);
      sent = true;
      debugLog(`Message ${message.type} sent successfully via port`);
    } catch (err) {
      debugLog('Error sending via port, will fall back to runtime:', err);
      
      // If port exists but sending failed, it might be disconnected
      // Check if the port is disconnected and try to reconnect
      if (chrome.runtime.lastError || err.message.includes('disconnected')) {
        debugLog('Port appears to be disconnected, attempting to reconnect...');
        serviceWorkerPort = null;
        
        // Try to reconnect immediately
        setTimeout(() => {
          initializeConnection();
        }, 100);
      }
    }
  } else {
    debugLog('No port available, using runtime messaging');
  }
  
  // Always fall back to runtime messaging if port send failed or no port
  if (!sent) {
    try {
      chrome.runtime.sendMessage(message)
        .then(() => {
          debugLog(`Message ${message.type} sent successfully via runtime.sendMessage`);
        })
        .catch(err => {
          debugLog('Error sending runtime message:', err);
          
          // If we get here, both port and runtime messaging failed
          // This is a critical error, log it prominently
          console.error('[OFFSCREEN] CRITICAL: Failed to send message via both port and runtime!', message);
        });
    } catch (err) {
      debugLog('Fatal error sending message:', err);
      console.error('[OFFSCREEN] FATAL: Could not send message at all:', message, err);
      return false;
    }
  }
  
  return true;
}

// Create mock transcription result
function provideMockTranscription(requestId, text) {
  debugLog(`Providing mock transcription for ${requestId}`);
  
  setTimeout(() => {
    // Send progress updates
    sendUpdateMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: { 
        requestId, 
        percent: 100,
        status: 'complete_mock' 
      }
    });
    
    // Send mock result
    sendUpdateMessage({
      type: 'TRANSCRIPTION_RESULT',
      payload: { 
        requestId, 
        result: text || "[Mock transcription] This is a simulated transcription result.",
        isMockResult: true
      }
    });
  }, 500);
}

// Fallback for runtime‐messaging transcription requests
chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    message.action === 'transcribeAudio' ||
    message.type === 'TRANSCRIBE_AUDIO' ||
    message.type === 'TRANSCRIBE_AUDIO_VOSK'
  ) {
    debugLog('⤷ fallback via runtime.sendMessage:', message);
    handleVoskTranscription({
      audioDataUrl: message.audioDataUrl,
      requestId: message.requestId,
      options: message.options || {}
    });
  }
  // no async response, so return nothing
});