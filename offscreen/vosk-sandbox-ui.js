// UI logic for the Vosk sandbox testing page
// This is in a separate file to avoid inline script CSP issues

// Global variables
let extensionId = null;
let modelPath = null;
let voskAvailable = false;
let testStatus = {};
let voskRecognizer = null;

// Utility function to log messages
function log(message, type = 'info') {
  const logElement = document.getElementById('log');
  if (!logElement) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.textContent = `[${timestamp}] ${message}`;
  entry.className = type;
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
  console.log(`[${type}] ${message}`);
}

// Get extension ID from URL
function getExtensionId() {
  try {
    // Try to extract from URL
    const url = window.location.href;
    const match = url.match(/chrome-extension:\/\/([^\/]+)/);
    
    if (match && match[1]) {
      extensionId = match[1];
      document.getElementById('extension-info').textContent = 
        `Extension ID: ${extensionId}`;
      log(`Extracted extension ID from URL: ${extensionId}`);
      return extensionId;
    } else {
      document.getElementById('extension-info').textContent = 
        'Error: Could not determine extension ID';
      log('Could not determine extension ID from URL', 'error');
      return null;
    }
  } catch (err) {
    document.getElementById('extension-info').textContent = 
      'Error: Could not determine extension ID';
    log('Error getting extension ID: ' + err.message, 'error');
    return null;
  }
}

// Check if Vosk is loaded
function checkVosk() {
  const voskStatusElement = document.getElementById('vosk-status');
  
  // Check if the Vosk object exists
  if (typeof Vosk !== 'undefined') {
    voskAvailable = true;
    voskStatusElement.innerHTML = `
      <div class="success">Vosk library loaded successfully</div>
      <div>Version: ${Vosk.VERSION || 'Unknown'}</div>
      <div>Available methods: ${Object.keys(Vosk).join(', ')}</div>
    `;
    testStatus.voskLoaded = true;
    log('✅ Vosk library loaded successfully', 'success');
    log(`Available methods: ${Object.keys(Vosk).join(', ')}`);
    return true;
  } else {
    voskAvailable = false;
    voskStatusElement.innerHTML = `
      <div class="error">Vosk library not loaded</div>
      <div>Check that the script is properly included.</div>
    `;
    testStatus.voskLoaded = false;
    log('❌ Vosk library not loaded', 'error');
    log('Make sure the path to vosk-browser.js is correct', 'error');
    return false;
  }
}

// Calculate and display model path
function updateModelPath() {
  if (!extensionId) {
    document.getElementById('model-path').textContent = 
      'Cannot calculate model path: Extension ID unknown';
    return null;
  }
  
  modelPath = `chrome-extension://${extensionId}/wasm/vosk-model-en-us-0.22-lgraph`;
  
  document.getElementById('model-path').innerHTML = `
    <div>Model path:</div>
    <div class="path-box">${modelPath}</div>
  `;
  
  log(`Model path calculated: ${modelPath}`);
  return modelPath;
}

// Test if model path exists
async function testModelPath() {
  if (!modelPath) {
    log('No model path available. Get extension ID first.', 'error');
    return;
  }
  
  log(`Testing model path: ${modelPath}`);
  
  // Files that should exist in the model directory
  const criticalFiles = [
    '/am/final.mdl',
    '/conf/mfcc.conf',
    '/conf/model.conf',
    '/graph/phones.txt',
    '/ivector/final.dubm'
  ];
  
  let allFilesOk = true;
  
  for (const file of criticalFiles) {
    const url = modelPath + file;
    try {
      log(`Checking file: ${file}`);
      const response = await fetch(url);
      
      if (response.ok) {
        log(`✅ File exists: ${file}`, 'success');
      } else {
        log(`❌ File missing or inaccessible: ${file} (${response.status}: ${response.statusText})`, 'error');
        allFilesOk = false;
      }
    } catch (error) {
      log(`❌ Error checking file ${file}: ${error.message}`, 'error');
      allFilesOk = false;
    }
  }
  
  testStatus.modelFilesExist = allFilesOk;
  
  if (allFilesOk) {
    log('✅ All required model files are accessible', 'success');
  } else {
    log('❌ Some model files are missing or inaccessible', 'error');
    log('Check your manifest.json to ensure the wasm directory is properly listed in web_accessible_resources', 'error');
  }
}

// Attempt to load the model
async function tryLoadModel() {
  if (!voskAvailable) {
    log('Vosk library not loaded. Cannot load model.', 'error');
    return;
  }
  
  if (!modelPath) {
    log('No model path available. Get extension ID first.', 'error');
    return;
  }
  
  log(`Attempting to load model from ${modelPath}...`);
  log('This may take some time, please be patient...');
  
  try {
    const startTime = Date.now();
    const model = await Vosk.createModel(modelPath);
    const endTime = Date.now();
    
    log(`✅ Model loaded successfully in ${(endTime - startTime)/1000} seconds!`, 'success');
    
    // Store the model globally
    window.voskModel = model;
    
    // Try to create a recognizer with the model
    try {
      log('Creating recognizer...');
      const recognizer = new Vosk.Recognizer({model: model, sampleRate: 16000});
      log('✅ Recognizer created successfully!', 'success');
      
      // Store the recognizer globally - FIX: Also assign to voskRecognizer
      window.voskRecognizer = recognizer;
      voskRecognizer = recognizer;
      
      // Check what methods it has
      const methods = [];
      for (const key in recognizer) {
        if (typeof recognizer[key] === 'function') {
          methods.push(key);
        }
      }
      log(`Recognizer methods: ${methods.join(', ')}`);
      
      // Test if critical methods exist
      if (methods.includes('acceptWaveform') && 
          (methods.includes('result') || methods.includes('finalResult'))) {
        log('✅ All critical recognizer methods are available', 'success');
      } else {
        log('⚠️ Some critical recognizer methods may be missing', 'warning');
      }
    } catch (recError) {
      log(`❌ Error creating recognizer: ${recError.message}`, 'error');
    }
  } catch (error) {
    log(`❌ Error loading model: ${error.message}`, 'error');
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, 'error');
    }
  }
}

// Test a simple transcription
async function testTranscription() {
  log('Starting transcription test...');
  
  // Check if we have a stored recognizer
  if (!voskRecognizer && !window.voskRecognizer) {
    log('Recognizer not created. Run the model loading test first.', 'error');
    return;
  }
  
  // Use whichever recognizer is available
  const recognizer = voskRecognizer || window.voskRecognizer;
  
  try {
    // Generate test audio
    log('Generating test audio data...');
    const audioData = generateTestAudio();
    log(`Generated ${audioData.length} samples of test audio`);
    
    // Process the audio
    log('Processing audio waveform...');
    
    // Ensure recognizer has acceptWaveform method
    if (typeof recognizer.acceptWaveform !== 'function') {
      throw new Error('Recognizer does not have acceptWaveform method');
    }
    
    const accepted = recognizer.acceptWaveform(audioData);
    log(`Waveform accepted: ${accepted}`);
    
    // Get result
    let result;
    if (typeof recognizer.finalResult === 'function') {
      result = recognizer.finalResult();
      log('Using finalResult() method');
    } else if (typeof recognizer.result === 'function') {
      result = recognizer.result();
      log('Using result() method');
    } else {
      throw new Error('Recognizer has neither result() nor finalResult() method');
    }
    
    log(`Transcription result: ${JSON.stringify(result)}`, 'success');
    
    // Send result to parent if we're in an iframe
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TEST_TRANSCRIPTION_RESULT',
        success: true,
        result: result
      }, '*');
    }
  } catch (error) {
    log(`❌ Error during test transcription: ${error.message}`, 'error');
    log(`Stack trace: ${error.stack || 'No stack trace available'}`, 'error');
    
    // Send error to parent if we're in an iframe
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TEST_TRANSCRIPTION_RESULT',
        success: false,
        error: error.message
      }, '*');
    }
  }
}

// Check sandbox status
function checkSandbox() {
  log('Checking sandbox environment...');
  
  // Test if we can use eval (shouldn't be possible in normal extension pages)
  try {
    const result = eval('2 + 2');
    testStatus.evalWorks = true;
    log(`✅ eval() is working: 2 + 2 = ${result}`, 'success');
  } catch (error) {
    testStatus.evalWorks = false;
    log(`❌ eval() is blocked: ${error.message}`, 'error');
    log('This page needs to run in a sandboxed context to use Vosk', 'error');
  }
  
  // Test if we can use Function constructor
  try {
    const add = new Function('a', 'b', 'return a + b');
    const result = add(3, 4);
    testStatus.functionConstructorWorks = true;
    log(`✅ Function constructor is working: 3 + 4 = ${result}`, 'success');
  } catch (error) {
    testStatus.functionConstructorWorks = false;
    log(`❌ Function constructor is blocked: ${error.message}`, 'error');
  }
  
  // Test if we can create a worker from a blob
  try {
    const blob = new Blob(['self.onmessage = function(e) { self.postMessage("Hello from worker: " + e.data); }'], 
                         { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    
    worker.onmessage = function(e) {
      log(`✅ Worker response: ${e.data}`, 'success');
      testStatus.blobWorkerWorks = true;
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    
    worker.onerror = function(error) {
      log(`❌ Worker error: ${error.message}`, 'error');
      testStatus.blobWorkerWorks = false;
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    
    log('Created worker from blob URL, sending message...');
    worker.postMessage('test');
  } catch (error) {
    testStatus.blobWorkerWorks = false;
    log(`❌ Cannot create worker from blob: ${error.message}`, 'error');
  }
}

// Generate a simple test audio - just a sine wave
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

// Initialize page
function initialize() {
  log('Page loaded, running initial checks...');
  
  // Initialize test status object
  testStatus = {
    voskLoaded: false,
    modelFilesExist: false,
    modelLoaded: false,
    recognizerCreated: false,
    recognizerMethodsAvailable: false,
    evalWorks: false,
    functionConstructorWorks: false,
    blobWorkerWorks: false
  };
  
  // Get extension ID
  getExtensionId();
  
  // Update model path
  updateModelPath();
  
  // Check if Vosk is loaded
  setTimeout(() => {
    checkVosk();
  }, 500);
  
  // Set up button event handlers
  document.getElementById('checkVoskBtn').addEventListener('click', checkVosk);
  document.getElementById('testModelPathBtn').addEventListener('click', testModelPath);
  document.getElementById('loadModelBtn').addEventListener('click', async function() {
    await tryLoadModel();
    
    // Store the model and recognizer in global variables for the test transcription
    if (testStatus.modelLoaded && testStatus.recognizerCreated) {
      window.voskModel = this.model;
      window.voskRecognizer = this.recognizer;
    }
  });
  document.getElementById('checkSandboxBtn').addEventListener('click', checkSandbox);
  document.getElementById('testTranscriptionBtn').addEventListener('click', testTranscription);
  
  // Send ready message to parent if in iframe
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'SANDBOX_READY' }, '*');
    log('Sent SANDBOX_READY message to parent');
  }
  
  // Set up message event listener
  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;
    
    const message = event.data;
    if (!message || !message.type) return;
    
    log(`Received message from parent: ${message.type}`);
    
    switch (message.type) {
      case 'INIT_VOSK':
        // Override model path if provided
        if (message.modelPath) {
          modelPath = message.modelPath;
          log(`Using provided model path: ${modelPath}`);
          document.getElementById('model-path').innerHTML = `
            <div>Model path (from parent):</div>
            <div class="path-box">${modelPath}</div>
          `;
        }
        
        // Auto-run the tests
        setTimeout(async () => {
          await testModelPath();
          await tryLoadModel();
          
          // Send result to parent
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'INIT_RESULT',
              success: testStatus.modelLoaded && testStatus.recognizerCreated,
              testStatus: testStatus
            }, '*');
          }
        }, 500);
        break;
        
      case 'TRANSCRIBE':
        // Handle transcription request
        log(`Received transcription request for ID: ${message.requestId}`);
        // Implementation would go here...
        break;
    }
  });
}

// Run initialization when page loads
window.addEventListener('load', initialize);