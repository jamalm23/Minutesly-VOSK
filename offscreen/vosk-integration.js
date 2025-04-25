/**
 * Vosk Integration Module
 * 
 * This module provides speech-to-text functionality using the Vosk library
 * in a sandboxed environment to work around Content Security Policy restrictions.
 */

// Debugging helper
function log(message) {
  console.log(`[VoskIntegration] ${message}`);
}

// Error tracking
let voskLastError = null;
let voskIsInitializing = false;
let voskIsInitialized = false;
let workerFrame = null;
let pendingRequests = new Map();
let workerReady = false;

// Initialize the sandboxed Vosk worker
function initializeSandboxedWorker() {
  if (workerFrame) {
    log('Worker iframe already exists');
    return workerFrame;
  }
  
  log('Creating sandboxed worker iframe...');
  
  // Create the iframe
  workerFrame = document.createElement('iframe');
  workerFrame.src = chrome.runtime.getURL('offscreen/vosk-worker.html');
  workerFrame.style.display = 'none';
  document.body.appendChild(workerFrame);
  
  // Listen for worker log messages for debugging
  window.addEventListener('message', (event) => {
    // Filter to only handle worker log messages
    if (event.data && event.data.type === 'WORKER_LOG') {
      log(`[Worker] ${event.data.message}`);
    }
  });
  
  log('Sandboxed worker iframe created');
  return workerFrame;
}

// Check if Vosk is ready
function isVoskReady() {
  return workerReady && voskIsInitialized && !voskIsInitializing;
}

// Handle messages from the worker iframe
function setupMessageHandler() {
  window.addEventListener('message', (event) => {
    // Make sure it's from our worker frame
    if (!workerFrame || event.source !== workerFrame.contentWindow) {
      return;
    }
    
    const message = event.data;
    
    // Handle different message types
    switch (message.type) {
      case 'WORKER_READY':
        log('Worker is ready');
        workerReady = true;
        break;
        
      case 'INIT_RESULT':
        log(`Vosk initialization ${message.success ? 'succeeded' : 'failed'}: ${message.error || ''}`);
        voskIsInitializing = false;
        voskIsInitialized = message.success;
        voskLastError = message.success ? null : message.error;
        break;
        
      case 'TRANSCRIPTION_RESULT':
        log(`Received transcription result for request ${message.requestId}`);
        const callback = pendingRequests.get(message.requestId);
        if (callback) {
          callback(message.text);
          pendingRequests.delete(message.requestId);
        }
        break;
        
      case 'ERROR':
        log(`Worker error during ${message.messageType}: ${message.error}`);
        voskLastError = message.error;
        
        // If it was a transcription request, call the callback with empty result
        if (message.messageType === 'TRANSCRIBE' && message.requestId) {
          const callback = pendingRequests.get(message.requestId);
          if (callback) {
            callback('');
            pendingRequests.delete(message.requestId);
          }
        }
        break;
        
      case 'CACHE_CLEARED':
        log(`Cache cleared: ${message.success ? 'success' : 'failed'}`);
        break;
        
      case 'WORKER_LOG': // Handle log messages from worker
        // Optional: Log differently or simply ignore if not needed here
        // log(`[Worker Log] ${message.message}`); 
        break; 

      default:
        log(`Unknown message type from worker: ${message.type}`);
    }
  });
}

// Initialize Vosk
async function initializeVosk() {
  log('Initializing Vosk...');
  
  if (voskIsInitialized) {
    log('Vosk already initialized');
    return true;
  }
  
  if (voskIsInitializing) {
    log('Vosk initialization already in progress');
    return false;
  }
  
  voskIsInitializing = true;
  voskLastError = null;
  
  try {
    // Initialize the worker if not already done
    if (!workerFrame) {
      initializeSandboxedWorker();
      setupMessageHandler();
      
      // Wait for worker to be ready
      log('Waiting for worker to be ready...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker ready timeout'));
        }, 5000); // 5 second timeout
        
        const checkWorkerReady = () => {
          if (workerReady) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkWorkerReady, 100);
          }
        };
        
        checkWorkerReady();
      });
    }
    
    // Send initialization message to worker
    log('Sending initialization message to worker...');
    const modelPath = 'wasm/vosk-model-en-us-0.22-lgraph';
    workerFrame.contentWindow.postMessage({
      type: 'INIT_VOSK',
      modelPath // Only send the path, let vosk-browser.js handle loading components
    }, '*');
    
    // Wait for initialization to complete
    log('Waiting for initialization to complete...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        voskIsInitializing = false;
        reject(new Error('Vosk initialization timeout'));
      }, 30000); // 30 second timeout (model loading can take time)
      
      const checkInitialized = () => {
        if (!voskIsInitializing) {
          clearTimeout(timeout);
          if (voskIsInitialized) {
            resolve();
          } else {
            reject(new Error(voskLastError || 'Unknown initialization error'));
          }
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      
      checkInitialized();
    });
    
    log('Vosk initialization completed successfully');
    return true;
  } catch (error) {
    voskIsInitializing = false;
    voskLastError = error.message;
    log(`Vosk initialization failed: ${error.message}`);
    return false;
  }
}

// Transcribe audio data
async function transcribeAudio(audioData, sampleRate) {
  if (!isVoskReady()) {
    const initialized = await initializeVosk();
    if (!initialized) {
      throw new Error("Vosk is not initialized");
    }
  }
  
  // Generate unique request ID
  const requestId = Date.now() + Math.random().toString(36).substring(2, 8);
  
  try {
    log('Sending transcription request ' + requestId + ' to worker...');
    
    // Convert Float32Array to Int16Array as required by Vosk
    let audioDataInt16;
    if (audioData instanceof Float32Array) {
      // Convert Float32Array [-1.0, 1.0] to Int16Array [-32768, 32767]
      audioDataInt16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        // Clamp values to avoid overflow
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        audioDataInt16[i] = Math.floor(sample * 32767);
      }
    } else if (audioData instanceof Int16Array) {
      audioDataInt16 = audioData;
    } else {
      throw new Error("Audio data must be Float32Array or Int16Array");
    }
    
    return new Promise((resolve, reject) => {
      // Store the callback in the pending requests map
      pendingRequests.set(requestId, (result) => {
        resolve(result);
      });
      
      // Send message to worker
      workerFrame.contentWindow.postMessage({
        type: 'TRANSCRIBE',
        requestId: requestId,
        audioData: audioDataInt16,
        sampleRate: sampleRate
      }, '*');
      
      // Set timeout for request
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error("Transcription request timed out"));
        }
      }, 30000); // 30 second timeout
    });
  } catch (error) {
    log(`Error during transcription: ${error.message}`);
    throw error;
  }
}

// Clear the model cache
async function clearModelCache() {
  if (!workerFrame || !workerReady) {
    log('Worker not ready for cache clearing');
    return false;
  }
  
  return new Promise((resolve) => {
    const messageHandler = (event) => {
      if (event.data && event.data.type === 'CACHE_CLEARED') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.success);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    workerFrame.contentWindow.postMessage({
      type: 'CLEAR_CACHE'
    }, '*');
    
    // Set a timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      resolve(false);
    }, 5000);
  });
}

// Get the last error
function getLastError() {
  return voskLastError;
}

// Test function to verify Vosk is working
async function testVosk() {
  log('Testing Vosk initialization...');
  
  try {
    // Try to initialize Vosk
    const initialized = await initializeVosk();
    
    if (!initialized) {
      log(`Vosk initialization failed: ${voskLastError || 'Unknown error'}`);
      return {
        success: false,
        error: voskLastError || 'Unknown error'
      };
    }
    
    log('Vosk initialization succeeded, creating test audio');
    
    // Create a small test audio sample (silent)
    const sampleRate = 16000;
    const duration = 1; // 1 second
    const testAudio = new Int16Array(sampleRate * duration);
    
    // Try to transcribe the test audio
    const text = await transcribeAudio(testAudio, sampleRate); // Pass sampleRate
    
    log(`Test transcription result: "${text}"`);
    return {
      success: true,
      text: text
    };
  } catch (error) {
    log(`Vosk test failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Expose the API
window.VoskIntegration = {
  initializeVosk: initializeVosk,  // Renamed to match expected API
  transcribe: transcribeAudio,
  isReady: isVoskReady,
  getLastError: getLastError,
  test: testVosk,
  clearCache: clearModelCache
};
