// vosk-browser-sandbox.js
// Sandbox implementation for Vosk transcription processing
// This runs in a separate iframe with less restrictive CSP

// Global variables
let voskInitialized = false;
let voskModel = null;
let voskRecognizer = null;
let processingMessage = false;
let testAudioData = null;
let extensionId = null;
let modelPath = null;

// DOM element references
const directInitBtn = document.getElementById('directInitBtn');
const checkFilesBtn = document.getElementById('checkFilesBtn');
const checkCacheBtn = document.getElementById('checkCacheBtn');
const testVoskBtn = document.getElementById('testVoskBtn');
const generateTestAudioBtn = document.getElementById('generateTestAudioBtn');
const transcribeTestAudioBtn = document.getElementById('transcribeTestAudioBtn');
const modelInfoElement = document.getElementById('model-info');
const transcriptionResultElement = document.getElementById('transcriptionResult');

// Function to log to console and on page
function log(message, isError = false) {
  const logElement = document.getElementById('log');
  if (!logElement) return;
  
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
  if (!statusElement) return;
  
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
    
    if (!message || !message.type) {
      processingMessage = false;
      return;
    }
    
    log(`Received message: ${message.type}`);
    
    switch (message.type) {
      case 'INIT_VOSK':
        modelPath = message.modelPath;
        await initializeVosk(modelPath);
        break;
        
      case 'TRANSCRIBE':
        await transcribeAudio(message.audioData, message.requestId);
        break;
        
      case 'CHECK_FILES':
        modelPath = message.modelPath;
        await checkModelFiles(modelPath);
        break;
        
      case 'CHECK_CACHE':
        await checkCache();
        break;
        
      case 'CLEAR_CACHE':
        await clearCache();
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
    console.error('Message handler error:', error);
    
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
async function initializeVosk(path) {
  try {
    setStatus('Initializing Vosk...');
    log(`Using model path: ${path}`);
    
    // Check if Vosk is available
    if (typeof Vosk === 'undefined') {
      throw new Error('Vosk not found. Library failed to load.');
    }
    
    log('Vosk library loaded successfully');
    
    // Create model with IndexedDB caching
    setStatus('Creating Vosk model...');
    const startTime = Date.now();
    voskModel = await Vosk.createModel(path);
    const endTime = Date.now();
    log(`Model created successfully in ${(endTime - startTime)/1000} seconds`);
    
    // Create recognizer
    setStatus('Creating recognizer...');
    voskRecognizer = new Vosk.Recognizer({model: voskModel, sampleRate: 16000});
    log('Recognizer created successfully');
    
    // Verify recognizer methods
    const methods = [];
    for (const key in voskRecognizer) {
      if (typeof voskRecognizer[key] === 'function') {
        methods.push(key);
      }
    }
    
    log(`Recognizer methods: ${methods.join(', ')}`);
    
    // Test if critical methods exist
    if (methods.includes('acceptWaveform') && 
        (methods.includes('result') || methods.includes('finalResult'))) {
      log('All critical recognizer methods are available');
    } else {
      log('Some critical recognizer methods may be missing', true);
    }
    
    // Update model info display
    updateModelInfo();
    
    voskInitialized = true;
    setStatus('Vosk initialized successfully', false);
    
    // Enable test buttons
    if (transcribeTestAudioBtn) transcribeTestAudioBtn.disabled = testAudioData ? false : true;
    if (testVoskBtn) testVoskBtn.disabled = false;
    
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

// Update the model info display
function updateModelInfo() {
  if (!modelInfoElement) return;
  
  if (!voskModel || !voskInitialized) {
    modelInfoElement.textContent = 'No model loaded';
    return;
  }
  
  let infoText = 'Model loaded successfully\n';
  
  // Check if the model has properties we can access
  if (voskModel) {
    infoText += `Model handle: ${voskModel.handle || 'unknown'}\n`;
    
    // Add more properties if available
    if (voskRecognizer) {
      infoText += `Sample rate: 16000 Hz\n`;
      infoText += `Available methods: ${Object.keys(voskRecognizer).filter(k => typeof voskRecognizer[k] === 'function').join(', ')}\n`;
    }
  }
  
  modelInfoElement.textContent = infoText;
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
    
    // Create Int16Array from the array
    const int16Data = new Int16Array(audioData);
    
    // Reset recognizer for new transcription
    if (typeof voskRecognizer.reset === 'function') {
      voskRecognizer.reset();
    }
    
    // Process the audio in chunks
    const chunkSize = 16000; // 1 second chunks
    let offset = 0;
    
    while (offset < int16Data.length) {
      const chunk = int16Data.subarray(offset, offset + chunkSize);
      voskRecognizer.acceptWaveform(chunk);
      offset += chunkSize;
      
      // Short delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Get final result
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
    
    // Update transcription result display if this is an internal test
    if (requestId === 'internal-test' && transcriptionResultElement) {
      transcriptionResultElement.value = JSON.stringify(result, null, 2);
    }
    
    // Send result back to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TRANSCRIBE_RESULT',
        success: true,
        result: result,
        requestId: requestId
      }, '*');
    }
    
    return result;
  } catch (error) {
    log(`Transcription error: ${error.message}`, true);
    setStatus(`Transcription failed: ${error.message}`, true);
    
    // Update transcription result display if this is an internal test
    if (requestId === 'internal-test' && transcriptionResultElement) {
      transcriptionResultElement.value = `Error: ${error.message}`;
    }
    
    // Send error to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'TRANSCRIBE_RESULT',
        success: false,
        error: error.message,
        requestId: requestId
      }, '*');
    }
    
    return null;
  }
}

// Check model files
async function checkModelFiles(path) {
  try {
    setStatus(`Checking model files at ${path}...`);
    
    // Files that should exist in the model directory
    const criticalFiles = [
      '/am/final.mdl',
      '/conf/mfcc.conf',
      '/conf/model.conf',
      '/graph/phones.txt',
      '/ivector/final.dubm'
    ];
    
    let allFilesOk = true;
    let fileResults = [];
    
    for (const file of criticalFiles) {
      const url = path + file;
      try {
        log(`Checking file: ${file}`);
        const response = await fetch(url);
        
        if (response.ok) {
          log(`File exists: ${file}`);
          fileResults.push({ file, exists: true });
        } else {
          log(`File missing or inaccessible: ${file} (${response.status}: ${response.statusText})`, true);
          fileResults.push({ file, exists: false, status: response.status });
          allFilesOk = false;
        }
      } catch (error) {
        log(`Error checking file ${file}: ${error.message}`, true);
        fileResults.push({ file, exists: false, error: error.message });
        allFilesOk = false;
      }
    }
    
    setStatus(allFilesOk ? 'All model files are accessible' : 'Some model files are missing');
    
    // Send result to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CHECK_FILES_RESULT',
        allFilesOk: allFilesOk,
        fileResults: fileResults
      }, '*');
    }
    
    return allFilesOk;
  } catch (error) {
    log(`Error checking files: ${error.message}`, true);
    
    // Send error to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CHECK_FILES_RESULT',
        allFilesOk: false,
        error: error.message
      }, '*');
    }
    
    return false;
  }
}

// Check IndexedDB cache status
async function checkCache() {
  try {
    setStatus('Checking IndexedDB cache...');
    
    // Open the database
    const openRequest = indexedDB.open('vosk_models', 1);
    
    openRequest.onupgradeneeded = function(event) {
      // Create object store if it doesn't exist
      const db = event.target.result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models', { keyPath: 'url' });
      }
    };
    
    const checkPromise = new Promise((resolve, reject) => {
      openRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['models'], 'readonly');
        const store = transaction.objectStore('models');
        const countRequest = store.count();
        
        countRequest.onsuccess = function() {
          const count = countRequest.result;
          log(`Found ${count} models in cache`);
          
          if (count > 0) {
            // Get all items to show details
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = function() {
              const models = getAllRequest.result;
              const totalSize = models.reduce((sum, model) => {
                return sum + (model.data ? model.data.byteLength : 0);
              }, 0);
              
              const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
              const cacheInfo = `
                <strong>Cache Status:</strong><br>
                ${count} model(s) cached<br>
                Total size: ${sizeMB} MB<br>
                <ul>
                  ${models.map(model => `<li>${model.url} - ${(model.data ? model.data.byteLength / (1024 * 1024) : 0).toFixed(2)} MB</li>`).join('')}
                </ul>
              `;
              
              setStatus(`Cache contains ${count} models (${sizeMB} MB)`);
              
              // Send result to parent
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'CACHE_INFO',
                  count: count,
                  cacheInfo: cacheInfo,
                  totalSize: totalSize
                }, '*');
              }
              
              resolve({ count, totalSize });
            };
            
            getAllRequest.onerror = function(event) {
              const error = `Error getting cached models: ${event.target.error}`;
              log(error, true);
              reject(new Error(error));
            };
          } else {
            setStatus('No models in cache');
            
            // Send empty result to parent
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'CACHE_INFO',
                count: 0,
                cacheInfo: '<strong>Cache Status:</strong> No models cached',
                totalSize: 0
              }, '*');
            }
            
            resolve({ count: 0, totalSize: 0 });
          }
        };
        
        countRequest.onerror = function(event) {
          const error = `Error counting cached models: ${event.target.error}`;
          log(error, true);
          reject(new Error(error));
        };
      };
      
      openRequest.onerror = function(event) {
        const error = `Error opening database: ${event.target.error}`;
        log(error, true);
        reject(new Error(error));
      };
    });
    
    return await checkPromise;
  } catch (error) {
    log(`Error checking cache: ${error.message}`, true);
    setStatus(`Cache check failed: ${error.message}`, true);
    
    // Send error to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CACHE_INFO',
        error: error.message
      }, '*');
    }
    
    return null;
  }
}

// Clear IndexedDB cache
async function clearCache() {
  try {
    setStatus('Clearing IndexedDB cache...');
    
    const clearPromise = new Promise((resolve, reject) => {
      // Attempt to delete the database
      const request = indexedDB.deleteDatabase('vosk_models');
      
      request.onsuccess = function() {
        log('Cache cleared successfully');
        setStatus('Cache cleared successfully');
        resolve(true);
      };
      
      request.onerror = function(event) {
        const error = `Error clearing cache: ${event.target.error}`;
        log(error, true);
        setStatus(error, true);
        reject(new Error(error));
      };
      
      request.onblocked = function() {
        const warning = 'Database deletion was blocked - please close other tabs or pages using Vosk';
        log(warning, true);
        setStatus(warning, true);
        // Still resolve, just with a warning
        resolve({ warning });
      };
    });
    
    const result = await clearPromise;
    
    // Send result to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CACHE_CLEARED',
        success: true
      }, '*');
    }
    
    return result;
  } catch (error) {
    log(`Error clearing cache: ${error.message}`, true);
    setStatus(`Cache clearing failed: ${error.message}`, true);
    
    // Send error to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'CACHE_CLEARED',
        success: false,
        error: error.message
      }, '*');
    }
    
    return false;
  }
}

// Generate test audio - a simple sine wave
function generateTestAudio() {
  setStatus('Generating test audio...');
  log('Generating test audio samples');
  
  const sampleRate = 16000;
  const duration = 2; // seconds
  const frequency = 440; // A4 note
  
  testAudioData = new Int16Array(sampleRate * duration);
  for (let i = 0; i < testAudioData.length; i++) {
    // Generate sine wave with some amplitude modulation
    testAudioData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000;
  }
  
  log(`Generated ${testAudioData.length} samples of test audio`);
  setStatus('Test audio generated');
  
  // Enable the transcribe button
  if (transcribeTestAudioBtn) {
    transcribeTestAudioBtn.disabled = !voskInitialized;
  }
  
  return testAudioData;
}

// Test Vosk with sample speech
async function testVosk() {
  if (!voskInitialized || !voskRecognizer) {
    log('Vosk not initialized yet. Please initialize first.', true);
    return;
  }
  
  setStatus('Testing Vosk with real speech samples...');
  
  try {
    // Create simple test data - speech-like pattern
    const sampleRate = 16000;
    const duration = 3; // seconds
    
    const testData = new Int16Array(sampleRate * duration);
    
    // Create a more complex waveform to mimic speech
    for (let i = 0; i < testData.length; i++) {
      const t = i / sampleRate;
      
      // Mix different frequencies with amplitude modulation
      testData[i] = (
        Math.sin(2 * Math.PI * 200 * t) * 8000 * Math.sin(Math.PI * t) + 
        Math.sin(2 * Math.PI * 400 * t) * 4000 * Math.sin(2 * Math.PI * 2 * t) +
        Math.sin(2 * Math.PI * 1000 * t) * 2000 * Math.sin(2 * Math.PI * 5 * t)
      );
    }
    
    log(`Created ${testData.length} samples of speech-like test audio`);
    
    // Process with Vosk
    if (typeof voskRecognizer.reset === 'function') {
      voskRecognizer.reset();
    }
    
    const accepted = voskRecognizer.acceptWaveform(testData);
    log(`Waveform accepted: ${accepted}`);
    
    let result;
    if (typeof voskRecognizer.finalResult === 'function') {
      result = voskRecognizer.finalResult();
    } else if (typeof voskRecognizer.result === 'function') {
      result = voskRecognizer.result();
    } else {
      throw new Error('No result method available');
    }
    
    log(`Test result: ${JSON.stringify(result)}`);
    
    // Update UI
    if (transcriptionResultElement) {
      transcriptionResultElement.value = JSON.stringify(result, null, 2);
    }
    
    setStatus('Vosk test complete');
    return result;
  } catch (error) {
    log(`Test error: ${error.message}`, true);
    setStatus(`Test failed: ${error.message}`, true);
    
    if (transcriptionResultElement) {
      transcriptionResultElement.value = `Error: ${error.message}`;
    }
    
    return null;
  }
}

// Transcribe test audio
async function transcribeTestAudio() {
  if (!testAudioData) {
    log('No test audio generated yet. Please generate test audio first.', true);
    return;
  }
  
  if (!voskInitialized || !voskRecognizer) {
    log('Vosk not initialized yet. Please initialize first.', true);
    return;
  }
  
  // Use the shared transcribe function with local request ID
  return await transcribeAudio(testAudioData, 'internal-test');
}

// Try to extract extension ID from URL
function getExtensionId() {
  try {
    const url = window.location.href;
    const match = url.match(/chrome-extension:\/\/([^\/]+)/);
    
    if (match && match[1]) {
      extensionId = match[1];
      log(`Extracted extension ID from URL: ${extensionId}`);
      
      // Calculate model path
      modelPath = `chrome-extension://${extensionId}/wasm/vosk-model-en-us-0.22-lgraph`;
      log(`Model path calculated: ${modelPath}`);
      
      return extensionId;
    }
  } catch (err) {
    log(`Error getting extension ID: ${err.message}`, true);
  }
  
  return null;
}

// Initialize debug buttons
function setupDebugButtons() {
  if (directInitBtn) {
    directInitBtn.addEventListener('click', () => {
      if (!modelPath) {
        if (!getExtensionId()) {
          log('Could not determine extension ID. Cannot initialize Vosk directly.', true);
          return;
        }
      }
      
      initializeVosk(modelPath);
    });
  }
  
  if (checkFilesBtn) {
    checkFilesBtn.addEventListener('click', () => {
      if (!modelPath) {
        if (!getExtensionId()) {
          log('Could not determine extension ID. Cannot check model files.', true);
          return;
        }
      }
      
      checkModelFiles(modelPath);
    });
  }
  
  if (checkCacheBtn) {
    checkCacheBtn.addEventListener('click', () => {
      checkCache();
    });
  }
  
  if (testVoskBtn) {
    testVoskBtn.addEventListener('click', () => {
      testVosk();
    });
  }
  
  if (generateTestAudioBtn) {
    generateTestAudioBtn.addEventListener('click', () => {
      generateTestAudio();
    });
  }
  
  if (transcribeTestAudioBtn) {
    transcribeTestAudioBtn.addEventListener('click', () => {
      transcribeTestAudio();
    });
  }
}

// Initialize when page loads
function init() {
  setStatus('Sandbox loaded, waiting for commands...');
  log('Vosk sandbox initialized');
  
  // Set up debug buttons
  setupDebugButtons();
  
  // Try to get extension ID right away
  getExtensionId();
  
  // Notify parent that sandbox is ready
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'SANDBOX_READY'
    }, '*');
  }
}

// Attach message handler
window.addEventListener('message', handleMessage);

// Initialize when loaded
window.addEventListener('load', init);
