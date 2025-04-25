// vosk-worker.js - Web Worker to handle Vosk initialization and transcription
// This worker runs in its own context and can use eval() which is needed by Vosk

// Global variables
let voskInitialized = false;
let voskModel = null;
let voskRecognizer = null;

// Respond to messages from the main thread
self.onmessage = async function(event) {
  const message = event.data;
  
  switch (message.command) {
    case 'init':
      try {
        console.log('[VoskWorker] Initializing with model path:', message.modelPath);
        const success = await initializeVosk(message.modelPath);
        self.postMessage({
          type: 'init-result',
          success: success,
          error: success ? null : 'Failed to initialize Vosk'
        });
      } catch (error) {
        console.error('[VoskWorker] Initialization error:', error);
        self.postMessage({
          type: 'init-result',
          success: false,
          error: error.message || 'Unknown error initializing Vosk'
        });
      }
      break;
      
    case 'transcribe':
      try {
        console.log('[VoskWorker] Transcribing audio, data length:', message.audioData.length);
        const result = await transcribeAudio(message.audioData, message.requestId);
        self.postMessage({
          type: 'transcribe-result',
          requestId: message.requestId,
          success: true,
          result: result
        });
      } catch (error) {
        console.error('[VoskWorker] Transcription error:', error);
        self.postMessage({
          type: 'transcribe-result',
          requestId: message.requestId,
          success: false,
          error: error.message || 'Unknown error during transcription'
        });
      }
      break;
      
    case 'status':
      self.postMessage({
        type: 'status-result',
        initialized: voskInitialized,
        hasModel: Boolean(voskModel),
        hasRecognizer: Boolean(voskRecognizer)
      });
      break;
      
    case 'importScripts':
      try {
        // Import scripts dynamically
        if (message.scripts && Array.isArray(message.scripts)) {
          for (const scriptUrl of message.scripts) {
            console.log('[VoskWorker] Importing script:', scriptUrl);
            self.importScripts(scriptUrl);
          }
          self.postMessage({
            type: 'import-result',
            success: true
          });
        }
      } catch (error) {
        console.error('[VoskWorker] Error importing scripts:', error);
        self.postMessage({
          type: 'import-result',
          success: false,
          error: error.message || 'Unknown error importing scripts'
        });
      }
      break;
      
    default:
      console.warn('[VoskWorker] Unknown command:', message.command);
      self.postMessage({
        type: 'error',
        error: `Unknown command: ${message.command}`
      });
  }
};

// Initialize Vosk
async function initializeVosk(modelPath) {
  console.log('[VoskWorker] Starting Vosk initialization with model path:', modelPath);
  
  if (voskInitialized && voskRecognizer) {
    console.log('[VoskWorker] Vosk already initialized');
    return true;
  }
  
  try {
    // Check if Vosk is available
    if (typeof self.Vosk === 'undefined') {
      console.error('[VoskWorker] Vosk not found, make sure scripts are imported first');
      throw new Error('Vosk library not found');
    }
    
    console.log('[VoskWorker] Creating Vosk model...');
    
    // Create model using either createModel or constructor
    if (typeof self.Vosk.createModel === 'function') {
      voskModel = await self.Vosk.createModel(modelPath);
      console.log('[VoskWorker] Model created with createModel');
    } else if (typeof self.Vosk.Model === 'function') {
      voskModel = new self.Vosk.Model(modelPath);
      console.log('[VoskWorker] Model created with constructor');
    } else {
      throw new Error('No method available to create Vosk model');
    }
    
    // Wait for model to initialize if it has an initialize method
    if (typeof voskModel.initialize === 'function') {
      console.log('[VoskWorker] Initializing model...');
      await voskModel.initialize();
      console.log('[VoskWorker] Model initialized');
    }
    
    // Wait for the model to be ready if it has a ready method
    if (typeof voskModel.ready === 'function') {
      console.log('[VoskWorker] Waiting for model to be ready...');
      await voskModel.ready();
      console.log('[VoskWorker] Model is ready');
    } else {
      // Add a delay to ensure model is fully loaded
      console.log('[VoskWorker] No ready method, waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Create recognizer
    console.log('[VoskWorker] Creating recognizer...');
    
    // Try different methods to create a recognizer
    if (typeof voskModel.registerRecognizer === 'function') {
      voskRecognizer = await voskModel.registerRecognizer(16000);
      console.log('[VoskWorker] Recognizer created with registerRecognizer');
    } else if (typeof self.Vosk.Recognizer === 'function') {
      voskRecognizer = new self.Vosk.Recognizer({
        model: voskModel,
        sampleRate: 16000
      });
      console.log('[VoskWorker] Recognizer created with constructor');
    } else if (typeof voskModel.KaldiRecognizer === 'function') {
      voskRecognizer = new voskModel.KaldiRecognizer(16000);
      console.log('[VoskWorker] Recognizer created with KaldiRecognizer');
    } else {
      throw new Error('No method available to create recognizer');
    }
    
    // Verify recognizer has required methods
    if (typeof voskRecognizer.acceptWaveform !== 'function' || 
        typeof voskRecognizer.finalResult !== 'function') {
      throw new Error('Recognizer missing required methods');
    }
    
    voskInitialized = true;
    console.log('[VoskWorker] Vosk initialized successfully');
    return true;
    
  } catch (error) {
    console.error('[VoskWorker] Error initializing Vosk:', error);
    voskInitialized = false;
    voskModel = null;
    voskRecognizer = null;
    throw error;
  }
}

// Process audio data for transcription
async function transcribeAudio(audioData, requestId) {
  console.log(`[VoskWorker] Processing transcription request: ${requestId}`);
  
  // Ensure Vosk is initialized
  if (!voskInitialized || !voskRecognizer) {
    throw new Error('Vosk not initialized');
  }
  
  try {
    // Process the audio
    const success = voskRecognizer.acceptWaveform(audioData);
    console.log(`[VoskWorker] acceptWaveform result: ${success}`);
    
    // Get the final result
    const result = voskRecognizer.finalResult();
    console.log('[VoskWorker] Final result:', result);
    
    return {
      text: result.text || '',
      rawResult: result
    };
  } catch (error) {
    console.error('[VoskWorker] Error during transcription:', error);
    throw error;
  }
}

// Log initialization
console.log('[VoskWorker] Worker initialized and ready to receive messages');
self.postMessage({ type: 'ready' });