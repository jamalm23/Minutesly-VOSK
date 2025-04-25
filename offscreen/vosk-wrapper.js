// This script acts as a wrapper for Vosk in the Chrome extension
// It avoids using Web Workers directly and uses a different approach

// Log function
function log(message) {
    console.log('[VOSK-WRAPPER] ' + message);
    
    const logElement = document.getElementById('log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      logElement.appendChild(entry);
      logElement.scrollTop = logElement.scrollHeight;
    }
  }
  
  // Global state
  let modelLoaded = false;
  let modelPath = null;
  let recognizerReady = false;
  
  // Get extension ID either directly or from URL
  function getExtensionId() {
    try {
      return chrome.runtime.id;
    } catch (e) {
      // Extract from URL if running in sandbox
      const url = window.location.href;
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      return match && match[1] ? match[1] : null;
    }
  }
  
  // Initialize the model path
  function initModelPath() {
    const extensionId = getExtensionId();
    if (!extensionId) {
      log('Could not determine extension ID');
      return null;
    }
    
    // Use the default model path
    modelPath = `chrome-extension://${extensionId}/wasm/vosk-model-en-us-0.22-lgraph`;
    log(`Model path set to: ${modelPath}`);
    return modelPath;
  }
  
  // Check if model files exist
  async function checkModelFiles() {
    if (!modelPath) {
      log('Model path not set');
      return false;
    }
    
    // Files that should exist in the model directory
    const criticalFiles = [
      '/am/final.mdl',
      '/conf/mfcc.conf',
      '/conf/model.conf',
      '/graph/phones.txt',
      '/ivector/final.dubm'
    ];
    
    let allFilesExist = true;
    
    for (const file of criticalFiles) {
      const url = modelPath + file;
      try {
        log(`Checking file: ${file}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          log(`File missing: ${file}`);
          allFilesExist = false;
        }
      } catch (error) {
        log(`Error checking file ${file}: ${error.message}`);
        allFilesExist = false;
      }
    }
    
    return allFilesExist;
  }
  
  // Load the model using a progressive approach
  async function loadModel() {
    if (!modelPath) {
      initModelPath();
      if (!modelPath) return false;
    }
    
    // Check if model files exist
    const filesExist = await checkModelFiles();
    if (!filesExist) {
      log('Some model files are missing. Check your installation.');
      return false;
    }
    
    // Check if Vosk is available
    if (typeof Vosk === 'undefined') {
      log('Vosk library not loaded');
      return false;
    }
    
    try {
      log('Creating model...');
      
      // Use the static method to create the model
      const model = await Vosk.createModel(modelPath);
      
      log('Model created successfully!');
      
      // Create a recognizer with the model
      log('Creating recognizer...');
      const recognizer = new Vosk.Recognizer({
        model: model,
        sampleRate: 16000
      });
      
      log('Recognizer created successfully!');
      
      // Store in global state
      window.voskModel = model;
      window.voskRecognizer = recognizer;
      modelLoaded = true;
      recognizerReady = true;
      
      return true;
    } catch (error) {
      log(`Error loading model: ${error.message}`);
      if (error.stack) {
        log(`Stack trace: ${error.stack}`);
      }
      return false;
    }
  }
  
  // Transcribe audio data
  async function transcribeAudio(audioData, requestId) {
    if (!modelLoaded || !window.voskRecognizer) {
      log('Model not loaded or recognizer not ready');
      return { 
        success: false, 
        error: 'Vosk not initialized' 
      };
    }
    
    try {
      log(`Processing transcription request: ${requestId}`);
      
      // Convert to Int16Array if needed
      let audioInt16;
      if (audioData instanceof Int16Array) {
        audioInt16 = audioData;
      } else if (Array.isArray(audioData)) {
        audioInt16 = new Int16Array(audioData);
      } else {
        throw new Error('Unsupported audio data format');
      }
      
      // Process the audio
      log('Processing audio...');
      window.voskRecognizer.acceptWaveform(audioInt16);
      
      // Get the result
      log('Getting transcription result...');
      let result;
      
      if (typeof window.voskRecognizer.finalResult === 'function') {
        result = window.voskRecognizer.finalResult();
      } else if (typeof window.voskRecognizer.result === 'function') {
        result = window.voskRecognizer.result();
      } else {
        throw new Error('No result method available');
      }
      
      log(`Transcription result: ${JSON.stringify(result)}`);
      
      return {
        success: true,
        requestId: requestId,
        result: {
          text: result.text || '',
          rawResult: result
        }
      };
    } catch (error) {
      log(`Error transcribing audio: ${error.message}`);
      return {
        success: false,
        requestId: requestId,
        error: error.message
      };
    }
  }
  
  // Create a simple interface for the wrapper
  window.VoskWrapper = {
    init: async function() {
      initModelPath();
      const success = await loadModel();
      return success;
    },
    
    transcribe: async function(audioData, requestId) {
      if (!modelLoaded) {
        // Try loading first
        await this.init();
      }
      
      return await transcribeAudio(audioData, requestId);
    },
    
    isReady: function() {
      return modelLoaded && recognizerReady;
    },
    
    getStatus: function() {
      return {
        modelLoaded: modelLoaded,
        recognizerReady: recognizerReady,
        modelPath: modelPath
      };
    }
  };
  
  // Initialize on load
  window.addEventListener('load', function() {
    log('Vosk wrapper loaded');
    
    // Try to initialize automatically
    window.VoskWrapper.init().then(success => {
      log(`Automatic initialization ${success ? 'succeeded' : 'failed'}`);
    }).catch(err => {
      log(`Error during initialization: ${err.message}`);
    });
  });
  
  // Add message event listener for iframe communication
  window.addEventListener('message', async function(event) {
    // Only process messages from the extension
    if (!event.origin.startsWith('chrome-extension://')) {
      return;
    }
    
    const message = event.data;
    
    if (!message || !message.type) {
      return;
    }
    
    switch (message.type) {
      case 'INIT_VOSK':
        // Override model path if provided
        if (message.modelPath) {
          modelPath = message.modelPath;
          log(`Using provided model path: ${modelPath}`);
        }
        
        const initSuccess = await window.VoskWrapper.init();
        
        // Reply with result
        if (event.source) {
          event.source.postMessage({
            type: 'INIT_RESULT',
            success: initSuccess
          }, '*');
        }
        break;
        
      case 'TRANSCRIBE':
        const transcribeResult = await window.VoskWrapper.transcribe(
          message.audioData, 
          message.requestId
        );
        
        // Reply with result
        if (event.source) {
          event.source.postMessage({
            type: 'TRANSCRIBE_RESULT',
            ...transcribeResult
          }, '*');
        }
        break;
        
      case 'STATUS':
        // Reply with status
        if (event.source) {
          event.source.postMessage({
            type: 'STATUS_RESULT',
            ...window.VoskWrapper.getStatus()
          }, '*');
        }
        break;
    }
  });