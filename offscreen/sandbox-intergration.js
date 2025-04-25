// Integration code for using the Vosk sandbox from offscreen.js

// Global variables
let sandboxIframe = null;
let sandboxReady = false;
let voskInitialized = false;
let initializationPromise = null;
let pendingTranscriptionRequests = [];

// Debug logging function
function debug(message) {
  console.log(`[SANDBOX-INTEGRATION] ${message}`);
}

// Initialize the Vosk sandbox
function initializeVoskSandbox() {
  if (initializationPromise) {
    debug('Initialization already in progress, returning existing promise');
    return initializationPromise;
  }
  
  initializationPromise = new Promise((resolve, reject) => {
    debug('Creating sandbox iframe');
    
    // Create sandbox iframe
    sandboxIframe = document.createElement('iframe');
    sandboxIframe.src = chrome.runtime.getURL('offscreen/vosk-sandbox-test.html');
    
    // Style the iframe (can be adjusted or made invisible in production)
    sandboxIframe.style.width = '400px';
    sandboxIframe.style.height = '300px';
    sandboxIframe.style.position = 'fixed';
    sandboxIframe.style.bottom = '10px';
    sandboxIframe.style.right = '10px';
    sandboxIframe.style.border = '1px solid #ccc';
    sandboxIframe.style.zIndex = '9999';
    
    // Set up timeout for initialization
    const timeout = setTimeout(() => {
      debug('Sandbox initialization timed out');
      reject(new Error('Sandbox initialization timed out'));
    }, 30000); // 30 second timeout
    
    // Set up message event listener
    function messageHandler(event) {
      if (!event.source || event.source !== sandboxIframe.contentWindow) {
        return; // Ignore messages from other sources
      }
      
      const message = event.data;
      if (!message || !message.type) {
        return; // Ignore messages without a type
      }
      
      debug(`Received message from sandbox: ${message.type}`);
      
      if (message.type === 'SANDBOX_READY') {
        debug('Sandbox is ready, sending init message');
        
        // Send initialization message with model path
        sandboxIframe.contentWindow.postMessage({
          type: 'INIT_VOSK',
          modelPath: chrome.runtime.getURL('wasm/vosk-model-en-us-0.22-lgraph')
        }, '*');
      }
      
      if (message.type === 'INIT_RESULT') {
        debug(`Vosk initialization ${message.success ? 'succeeded' : 'failed'}`);
        
        if (message.success) {
          clearTimeout(timeout);
          sandboxReady = true;
          voskInitialized = true;
          
          // Process any pending transcription requests
          processPendingRequests();
          
          // Remove the event listener since we're done with initialization
          window.removeEventListener('message', messageHandler);
          
          // Resolve the promise
          resolve(true);
        } else {
          debug('Initialization failed, details:', message.testStatus || 'unknown');
          clearTimeout(timeout);
          
          // Remove the event listener
          window.removeEventListener('message', messageHandler);
          
          // Reject with details
          reject(new Error(`Vosk initialization failed: ${JSON.stringify(message.testStatus || {})}`));
        }
      }
    }
    
    // Add message listener
    window.addEventListener('message', messageHandler);
    
    // Add load/error handlers for the iframe
    sandboxIframe.onload = () => {
      debug('Sandbox iframe loaded');
    };
    
    sandboxIframe.onerror = (error) => {
      debug(`Sandbox iframe error: ${error}`);
      clearTimeout(timeout);
      window.removeEventListener('message', messageHandler);
      reject(new Error('Failed to load sandbox iframe'));
    };
    
    // Append the iframe to the document
    document.body.appendChild(sandboxIframe);
    debug('Sandbox iframe appended to document');
  });
  
  return initializationPromise;
}

// Process any pending transcription requests
function processPendingRequests() {
  if (pendingTranscriptionRequests.length === 0) {
    return;
  }
  
  debug(`Processing ${pendingTranscriptionRequests.length} pending transcription requests`);
  
  // Process each request in order
  pendingTranscriptionRequests.forEach(request => {
    transcribeAudio(request.audioDataUrl, request.requestId)
      .then(request.resolve)
      .catch(request.reject);
  });
  
  // Clear the pending requests
  pendingTranscriptionRequests = [];
}

// Set up the transcription event listener
function setupTranscriptionListener() {
  window.addEventListener('message', event => {
    if (!event.source || event.source !== sandboxIframe?.contentWindow) {
      return; // Ignore messages from other sources
    }
    
    const message = event.data;
    if (!message || !message.type) {
      return; // Ignore messages without a type
    }
    
    if (message.type === 'TRANSCRIBE_RESULT') {
      debug(`Received transcription result for request: ${message.requestId}`);
      
      // Forward to service worker
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPTION_RESULT',
        payload: {
          requestId: message.requestId,
          result: message.result?.text || '',
          rawResult: message.result?.rawResult || {}
        }
      }).catch(error => {
        debug(`Error forwarding transcription result: ${error.message}`);
      });
    }
    
    if (message.type === 'TEST_TRANSCRIPTION_RESULT') {
      debug(`Received test transcription result: ${JSON.stringify(message.result || message.error)}`);
      // This is just for testing - you can handle it differently if needed
    }
  });
}

// Transcribe audio using the sandbox
async function transcribeAudio(audioDataUrl, requestId) {
  if (!sandboxReady || !voskInitialized) {
    debug(`Sandbox not ready for ${requestId}, queuing request`);
    
    // Queue the request to be processed later
    return new Promise((resolve, reject) => {
      pendingTranscriptionRequests.push({
        audioDataUrl,
        requestId,
        resolve,
        reject
      });
      
      // Try to initialize if not already doing so
      initializeVoskSandbox().catch(error => {
        debug(`Error initializing sandbox while processing queued request: ${error.message}`);
        // Note: we don't reject the transcription promise here, as it will
        // be rejected when processPendingRequests is called
      });
    });
  }
  
  try {
    debug(`Processing transcription request: ${requestId}`);
    
    // First send progress update
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: {
        requestId,
        percent: 10,
        status: 'processing'
      }
    }).catch(error => {
      debug(`Error sending progress update: ${error.message}`);
    });
    
    // Convert base64 data URL to Int16Array
    const base64Data = audioDataUrl.startsWith('data:audio') ? 
      audioDataUrl.split(',')[1] : audioDataUrl;
      
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Find the data chunk in the WAV
    let dataStart = 0;
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
    
    // Extract audio data and convert to Int16Array
    const audioBytes = bytes.slice(dataStart);
    const audioData = new Int16Array(
      audioBytes.buffer,
      audioBytes.byteOffset,
      audioBytes.byteLength / 2
    );
    
    // Send update
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_PROGRESS',
      payload: {
        requestId,
        percent: 50,
        status: 'transcribing'
      }
    }).catch(error => {
      debug(`Error sending progress update: ${error.message}`);
    });
    
    // Post message to sandbox with transcription request
    sandboxIframe.contentWindow.postMessage({
      type: 'TRANSCRIBE',
      audioData: Array.from(audioData),
      requestId
    }, '*');
    
    // Note: The result will be handled by the message event listener
    // We don't resolve this promise directly, as the result comes asynchronously
    
    return true;
  } catch (error) {
    debug(`Error transcribing audio: ${error.message}`);
    
    // Send error notification
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_ERROR',
      payload: {
        requestId,
        error: error.message
      }
    }).catch(ignoreError => {
      // Ignore errors in sending the error
    });
    
    throw error;
  }
}

// Initialize the integration
function initialize() {
  debug('Initializing sandbox integration');
  setupTranscriptionListener();
}

// Export the functions
window.SandboxIntegration = {
  initialize,
  initializeVoskSandbox,
  transcribeAudio,
  isReady: () => sandboxReady && voskInitialized
};

// Auto-initialize
initialize();