// vosk-sandbox.js - Updated for ES modules
import { createModel, Recognizer, VERSION } from '../lib/vosk-browser-no-indexeddb.js';

// Global variables
let voskInitialized = false;
let voskModel = null;
let voskRecognizer = null;
let processingMessage = false; // Added to prevent recursive message loops

// Function to log messages to page and console
function log(message, isError = false) {
  const logElement = document.getElementById('log');
  const entry = document.createElement('div');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  if (isError) {
    entry.className = 'error';
  }
  
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
  console.log(message);
}

// Update status display
function setStatus(message, isError = false) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = isError ? 'error' : '';
  log(message, isError);
}

// Handler for messages from parent window
async function handleMessage(event) {
  // Critical: Check if we're already processing a message to prevent loops
  if (processingMessage) {
    return;
  }
  
  processingMessage = true;
  
  try {
    const message = event.data;
    
    // Skip processing ERROR messages to prevent loops
    if (message.type === 'ERROR') {
      log(`Ignoring ERROR message to prevent loops: ${JSON.stringify(message).substring(0, 100)}...`, true);
      processingMessage = false;
      return;
    }
    
    log(`Received message: ${message.type}`);
    
    switch (message.type) {
      case 'INIT_VOSK':
        await initializeVosk(message.modelPath);
        break;
        
      case 'TRANSCRIBE':
        await transcribeAudio(message.audioData, message.requestId);
        break;
        
      case 'STATUS':
        sendStatusUpdate();
        break;
        
      default:
        log(`Unknown message type: ${message.type}`, true);
        
        // Only send error message if it's a known sender
        if (event.source && event.source !== window) {
          event.source.postMessage({
            type: 'ERROR',
            error: `Unknown message type: ${message.type}`
          }, '*');
        }
    }
  } catch (error) {
    log(`Error handling message: ${error.message}`, true);
    
    // Only send error message if it's a known sender
    if (event.source && event.source !== window) {
      event.source.postMessage({
        type: 'ERROR',
        error: error.message
      }, '*');
    }
  } finally {
    processingMessage = false;
  }
}

// Initialize Vosk
async function initializeVosk(modelPath) {
  try {
    setStatus('Initializing Vosk...');
    log(`Using model path: ${modelPath}`);
    
    // Check if imported functions are available
    if (typeof createModel === 'undefined') {
      throw new Error('Vosk not found. Library failed to load.');
    }
    
    log('Vosk library loaded successfully');
    
    // Create model
    setStatus('Creating Vosk model...');
    voskModel = await createModel(modelPath);
    log('Model created successfully');
    
    // Create recognizer
    setStatus('Creating recognizer...');
    voskRecognizer = new Recognizer({model: voskModel, sampleRate: 16000});
    log('Recognizer created successfully');
    
    // Verify recognizer methods
    if (typeof voskRecognizer.acceptWaveform !== 'function') {
      throw new Error('Recognizer missing acceptWaveform method');
    }
    
    if (typeof voskRecognizer.result !== 'function' && 
        typeof voskRecognizer.finalResult !== 'function') {
      throw new Error('Recognizer missing result methods');
    }
    
    // Also store in window for wider accessibility
    window.voskModel = voskModel;
    window.voskRecognizer = voskRecognizer;
    
    voskInitialized = true;
    setStatus('Vosk initialized successfully', false);
    
    // Send success response to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'INIT_RESULT',
        success: true
      }, '*');
    }
    
    return true;
  } catch (error) {
    log(`Error initializing Vosk: ${error.message}`, true);
    setStatus(`Initialization failed: ${error.message}`, true);
    
    // Send error response to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'INIT_RESULT',
        success: false,
        error: error.message
      }, '*');
    }
    
    return false;
  }
}

// Transcribe audio data
async function transcribeAudio(audioData, requestId) {
  try {
    setStatus(`Transcribing request ${requestId}...`);
    
    // Check if Vosk is initialized
    if (!voskInitialized || !voskRecognizer) {
      throw new Error('Vosk not initialized');
    }
    
    log(`Processing transcription request: ${requestId} with ${audioData.length} samples`);
    
    // Create Int16Array from the array if needed
    let int16Data;
    if (audioData instanceof Int16Array) {
      int16Data = audioData;
    } else if (Array.isArray(audioData)) {
      int16Data = new Int16Array(audioData);
    } else {
      throw new Error('Invalid audio data format');
    }
    
    // Process the audio with Vosk
    log('Calling acceptWaveform...');
    const accepted = voskRecognizer.acceptWaveform(int16Data);
    log(`Waveform accepted: ${accepted}`);
    
    // Get final result - check which method is available
    let result;
    if (typeof voskRecognizer.finalResult === 'function') {
      result = voskRecognizer.finalResult();
    } else if (typeof voskRecognizer.result === 'function') {
      result = voskRecognizer.result();
    } else {
      throw new Error('No result method available');
    }
    
    log(`Transcription result: ${JSON.stringify(result)}`);
    setStatus('Transcription complete');
    
    // Send result back to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TRANSCRIBE_RESULT',
        requestId: requestId,
        success: true,
        result: {
          text: result.text || '',
          rawResult: result
        }
      }, '*');
    }
    
    return result;
  } catch (error) {
    log(`Error transcribing audio: ${error.message}`, true);
    setStatus(`Transcription error: ${error.message}`, true);
    
    // Send error back to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TRANSCRIBE_RESULT',
        requestId: requestId,
        success: false,
        error: error.message
      }, '*');
    }
    
    throw error;
  }
}

// Send status update to parent
function sendStatusUpdate() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'STATUS_RESULT',
      initialized: voskInitialized,
      hasModel: Boolean(voskModel),
      hasRecognizer: Boolean(voskRecognizer)
    }, '*');
  }
}

// Generate a simple test audio sample (for testing)
function generateTestAudio() {
  const sampleRate = 16000;
  const duration = 2; // 2 seconds
  const frequency = 440; // A4 note
  
  const numSamples = sampleRate * duration;
  const audioData = new Int16Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    // Generate sine wave, convert to 16-bit range (-32768 to 32767)
    audioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 32767 * 0.5;
  }
  
  return audioData;
}

// Initial log output when loaded
function init() {
  setStatus('Sandbox loaded and ready');
  log('Vosk library version: ' + VERSION);
  
  // Check capabilities
  log('Vosk library loaded: ' + (typeof createModel !== 'undefined'));
  
  // Send ready message to parent
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'SANDBOX_READY'
    }, '*');
  }
  
  // Create test button
  addTestButton();
}

// Add a test button to manually try Vosk
function addTestButton() {
  const testButton = document.createElement('button');
  testButton.textContent = 'Test Vosk Loading';
  testButton.style.padding = '8px 16px';
  testButton.style.margin = '10px 0';
  testButton.style.backgroundColor = '#2563eb';
  testButton.style.color = 'white';
  testButton.style.border = 'none';
  testButton.style.borderRadius = '4px';
  testButton.style.cursor = 'pointer';

  testButton.addEventListener('click', async () => {
    log('Testing Vosk load...');
    
    try {
      // Check if Vosk is available
      if (typeof createModel === 'undefined') {
        throw new Error('Vosk not found. Library failed to load.');
      }
      
      log('✅ Vosk library loaded: ' + (typeof createModel));
      
      // Get extension ID automatically or via prompt
      let extensionId;
      try {
        extensionId = chrome.runtime.id;
        log('Detected extension ID: ' + extensionId);
      } catch (err) {
        log('Could not automatically detect extension ID. Please enter it manually.', true);
        extensionId = prompt('Enter your extension ID:');
      }
      
      if (!extensionId) {
        throw new Error('No extension ID provided');
      }
      
      const modelPath = `chrome-extension://${extensionId}/wasm/vosk-model-en-us-0.22-lgraph`;
      
      log('Creating model with path: ' + modelPath);
      log('This may take a moment, please wait...');
      
      try {
        const model = await createModel(modelPath);
        log('✅ Model created successfully!');
        
        // Try creating a recognizer as well
        const recognizer = new Recognizer({model: model, sampleRate: 16000});
        log('✅ Recognizer created successfully!');
        
        // Store globally
        voskModel = model;
        voskRecognizer = recognizer;
        window.voskModel = model;
        window.voskRecognizer = recognizer;
        voskInitialized = true;
        
        // Try a simple transcription
        try {
          const testAudio = generateTestAudio();
          log(`Generated ${testAudio.length} samples of test audio`);
          
          const accepted = recognizer.acceptWaveform(testAudio);
          log(`Waveform accepted: ${accepted}`);
          
          const result = recognizer.result ? recognizer.result() : recognizer.finalResult();
          log(`Test transcription result: ${JSON.stringify(result)}`);
        } catch (transcribeError) {
          log(`❌ Error in test transcription: ${transcribeError.message}`, true);
        }
      } catch (modelError) {
        log('❌ Error creating model: ' + modelError.message, true);
        
        if (modelError.stack) {
          log('Stack trace: ' + modelError.stack, true);
        }
      }
    } catch (error) {
      log('❌ Error: ' + error.message, true);
      if (error.stack) {
        log('Stack trace: ' + error.stack, true);
      }
    }
  });

  document.body.appendChild(testButton);
  
  // Add a transcription test button
  const transcribeButton = document.createElement('button');
  transcribeButton.textContent = 'Test Transcription';
  transcribeButton.style.padding = '8px 16px';
  transcribeButton.style.margin = '10px 0 10px 10px';
  transcribeButton.style.backgroundColor = '#047857';
  transcribeButton.style.color = 'white';
  transcribeButton.style.border = 'none';
  transcribeButton.style.borderRadius = '4px';
  transcribeButton.style.cursor = 'pointer';
  
  transcribeButton.addEventListener('click', async () => {
    log('Testing transcription...');
    
    // Check if Vosk is initialized
    if (!voskInitialized || !voskRecognizer) {
      log('Vosk not initialized. Run the Vosk Loading test first.', true);
      return;
    }
    
    try {
      // Generate test audio
      const testAudio = generateTestAudio();
      log(`Generated ${testAudio.length} samples of test audio`);
      
      // Process the audio
      const accepted = voskRecognizer.acceptWaveform(testAudio);
      log(`Waveform accepted: ${accepted}`);
      
      // Get the result
      let result;
      if (typeof voskRecognizer.finalResult === 'function') {
        result = voskRecognizer.finalResult();
      } else {
        result = voskRecognizer.result();
      }
      
      log(`Transcription result: ${JSON.stringify(result)}`);
    } catch (error) {
      log(`❌ Error during transcription test: ${error.message}`, true);
      if (error.stack) {
        log(`Stack trace: ${error.stack}`, true);
      }
    }
  });
  
  document.body.appendChild(transcribeButton);
}

// Attach message handler
window.addEventListener('message', handleMessage);

// Initialize when loaded
window.addEventListener('load', init);