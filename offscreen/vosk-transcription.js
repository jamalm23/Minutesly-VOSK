// vosk-transcription.js - Sandbox-based implementation for file transcription

// Global variables
let voskInitialized = false;
let extensionId = null;
let modelPath = null;
let audioContext = null;
let sandboxFrame = null;
let sandboxReady = false;

// DOM element references
const initButton = document.getElementById('initButton');
const checkFilesButton = document.getElementById('checkFilesButton');
const clearCacheButton = document.getElementById('clearCacheButton');
const checkCacheButton = document.getElementById('checkCacheButton');
const fileUpload = document.getElementById('fileUpload');
const transcribeButton = document.getElementById('transcribeButton');
const transcribeProgress = document.getElementById('transcribeProgress');
const transcriptionResult = document.getElementById('transcriptionResult');
const cacheInfo = document.getElementById('cacheInfo');
const logElement = document.getElementById('log');

// Function to log messages to page and console
function log(message, type = 'info') {
  if (!logElement) {
    console.error('Log element not found');
    return;
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.textContent = `[${timestamp}] ${message}`;
  
  if (type) {
    entry.className = type;
  }
  
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialize page
function initialize() {
  log('Page loaded, running initial checks...');
  
  // Get the sandbox iframe reference
  sandboxFrame = document.getElementById('sandboxFrame');
  
  // Get extension ID and update sandbox iframe src
  getExtensionId();
  
  // Add event listeners
  initButton.addEventListener('click', initializeVosk);
  checkFilesButton.addEventListener('click', checkModelFiles);
  clearCacheButton.addEventListener('click', clearCache);
  checkCacheButton.addEventListener('click', checkCache);
  fileUpload.addEventListener('change', handleFileSelection);
  transcribeButton.addEventListener('click', transcribeFile);
  
  // Set up message handling from sandbox
  window.addEventListener('message', handleSandboxMessage);
  
  // Wait for sandbox to report it's ready
  log('Waiting for sandbox to initialize...');
}

// Handle messages from the sandbox iframe
function handleSandboxMessage(event) {
  // Ignore messages from other sources
  if (!sandboxFrame || event.source !== sandboxFrame.contentWindow) {
    return;
  }
  
  const message = event.data;
  if (!message || !message.type) {
    return;
  }
  
  log(`Received message from sandbox: ${message.type}`);
  
  switch (message.type) {
    case 'SANDBOX_READY':
      sandboxReady = true;
      log('✅ Sandbox is ready', 'success');
      document.getElementById('vosk-status').innerHTML = 
        '<div class="success">Sandbox loaded successfully</div>';
      break;
      
    case 'INIT_RESULT':
      handleInitResult(message);
      break;
      
    case 'TRANSCRIBE_RESULT':
      handleTranscribeResult(message);
      break;
      
    case 'CACHE_INFO':
      handleCacheInfo(message);
      break;
      
    case 'CACHE_CLEARED':
      log('✅ Cache cleared successfully', 'success');
      break;
      
    case 'CHECK_FILES_RESULT':
      handleCheckFilesResult(message);
      break;
      
    case 'ERROR':
      log(`❌ Sandbox error: ${message.error}`, 'error');
      break;
      
    default:
      log(`Unknown message type: ${message.type}`, 'warning');
  }
}

// Handle initialization result from sandbox
function handleInitResult(message) {
  if (message.success) {
    voskInitialized = true;
    log('✅ Vosk initialized successfully', 'success');
    fileUpload.disabled = false;
    initButton.disabled = false;
  } else {
    log(`❌ Error initializing Vosk: ${message.error}`, 'error');
    initButton.disabled = false;
  }
}

// Handle transcription result from sandbox
function handleTranscribeResult(message) {
  transcribeProgress.value = 100;
  transcribeButton.disabled = false;
  
  if (message.success) {
    log('Transcription complete', 'success');
    log(`Transcription text: ${message.result.text}`, 'info');
    transcriptionResult.textContent = message.result.text || 'No speech detected';
  } else {
    log(`❌ Transcription error: ${message.error}`, 'error');
  }
  
  // Hide progress after a short delay
  setTimeout(() => {
    transcribeProgress.style.display = 'none';
  }, 1000);
}

// Handle cache info from sandbox
function handleCacheInfo(message) {
  if (message.cacheInfo) {
    cacheInfo.innerHTML = message.cacheInfo;
    log(`Found ${message.count} models in cache`, 'info');
  } else {
    cacheInfo.innerHTML = '<strong>Cache Status:</strong> No models cached';
    log('No models in cache', 'info');
  }
}

// Handle check files result from sandbox
function handleCheckFilesResult(message) {
  if (message.allFilesOk) {
    log('✅ All required model files are accessible', 'success');
  } else {
    log('❌ Some model files are missing or inaccessible', 'error');
    log('Check your manifest.json to ensure the wasm directory is properly listed in web_accessible_resources', 'error');
  }
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
      
      // Important: Update the sandbox iframe src with the actual extension ID
      if (sandboxFrame && sandboxFrame.src.includes('EXTENSION_ID_PLACEHOLDER')) {
        const updatedSrc = sandboxFrame.src.replace('EXTENSION_ID_PLACEHOLDER', extensionId);
        log(`Updating sandbox iframe src to: ${updatedSrc}`);
        sandboxFrame.src = updatedSrc;
      }
      
      updateModelPath();
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

// Tell sandbox to check model files
function checkModelFiles() {
  if (!modelPath) {
    log('No model path available. Get extension ID first.', 'error');
    return;
  }
  
  if (!sandboxReady) {
    log('Sandbox not ready yet.', 'warning');
    return;
  }
  
  log(`Testing model path: ${modelPath}`);
  
  // Send message to sandbox to check files
  sandboxFrame.contentWindow.postMessage({
    type: 'CHECK_FILES',
    modelPath: modelPath
  }, '*');
}

// Initialize Vosk via sandbox
function initializeVosk() {
  if (!modelPath) {
    log('Cannot initialize Vosk: No model path available', 'error');
    return false;
  }
  
  if (!sandboxReady) {
    log('Sandbox not ready yet.', 'warning');
    return false;
  }
  
  try {
    initButton.disabled = true;
    log('Initializing Vosk...', 'info');
    log(`Using model path: ${modelPath}`, 'info');
    
    // Send message to sandbox to initialize Vosk
    sandboxFrame.contentWindow.postMessage({
      type: 'INIT_VOSK',
      modelPath: modelPath
    }, '*');
    
    return true;
  } catch (error) {
    log(`❌ Error sending init message: ${error.message}`, 'error');
    console.error('Error:', error);
    initButton.disabled = false;
    return false;
  }
}

// Handle file selection
function handleFileSelection(event) {
  const file = event.target.files[0];
  if (!file) {
    transcribeButton.disabled = true;
    return;
  }
  
  log(`File selected: ${file.name} (${formatFileSize(file.size)})`, 'info');
  transcribeButton.disabled = false;
}

// Format file size in human-readable format
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Transcribe selected file
async function transcribeFile() {
  if (!voskInitialized) {
    log('Vosk not initialized yet. Please initialize first.', 'warning');
    return;
  }
  
  if (!sandboxReady) {
    log('Sandbox not ready yet.', 'warning');
    return;
  }
  
  const file = fileUpload.files[0];
  if (!file) {
    log('No file selected', 'warning');
    return;
  }
  
  try {
    log(`Transcribing file: ${file.name}`, 'info');
    transcribeButton.disabled = true;
    transcribeProgress.style.display = 'block';
    transcribeProgress.value = 10;
    
    // Create audio context if needed
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      log(`Audio context created with sample rate: ${audioContext.sampleRate}Hz`, 'info');
    }
    
    // Read file as ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    transcribeProgress.value = 20;
    
    // Decode audio data
    log('Decoding audio...', 'info');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    transcribeProgress.value = 40;
    
    log(`Audio decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`, 'info');
    
    // Need to resample to 16kHz for Vosk
    let audioData;
    if (audioBuffer.sampleRate === 16000) {
      // Extract samples directly if already at 16kHz
      audioData = extractSamplesFromAudioBuffer(audioBuffer);
    } else {
      // Otherwise resample to 16kHz
      log(`Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz...`, 'info');
      audioData = resampleAudio(audioBuffer, 16000);
    }
    
    transcribeProgress.value = 60;
    
    // Send audio data to sandbox for transcription
    log(`Sending ${audioData.length} samples to sandbox for transcription...`, 'info');
    
    // Convert Int16Array to regular Array for message passing
    const audioDataArray = Array.from(audioData);
    
    // Generate a unique request ID
    const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Send transcription request to sandbox
    sandboxFrame.contentWindow.postMessage({
      type: 'TRANSCRIBE',
      audioData: audioDataArray,
      requestId: requestId
    }, '*');
    
  } catch (error) {
    log(`❌ Transcription error: ${error.message}`, 'error');
    console.error('Transcription error:', error);
    transcribeButton.disabled = false;
    
    // Hide progress
    transcribeProgress.style.display = 'none';
  }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(event) {
      resolve(event.target.result);
    };
    
    reader.onerror = function(error) {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Extract samples from audio buffer
function extractSamplesFromAudioBuffer(audioBuffer) {
  // Get the first channel (mono)
  const samples = audioBuffer.getChannelData(0);
  
  // Convert to Int16Array as required by Vosk
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
    int16Samples[i] = Math.min(Math.max(samples[i] * 32768, -32768), 32767);
  }
  
  return int16Samples;
}

// Simple resampling function (basic linear interpolation)
function resampleAudio(audioBuffer, targetSampleRate) {
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // Calculate new buffer size
  const newLength = Math.round(duration * targetSampleRate);
  const result = new Int16Array(newLength);
  
  // Resample
  for (let i = 0; i < newLength; i++) {
    const position = i * (sampleRate / targetSampleRate);
    const index = Math.floor(position);
    const fraction = position - index;
    
    // Linear interpolation between samples
    let value;
    if (index >= samples.length - 1) {
      value = samples[samples.length - 1];
    } else {
      value = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
    }
    
    // Convert to Int16
    result[i] = Math.min(Math.max(value * 32768, -32768), 32767);
  }
  
  return result;
}

// Tell sandbox to clear IndexedDB cache
function clearCache() {
  if (!sandboxReady) {
    log('Sandbox not ready yet.', 'warning');
    return;
  }
  
  log('Requesting cache clear from sandbox...', 'info');
  
  // Send message to sandbox to clear cache
  sandboxFrame.contentWindow.postMessage({
    type: 'CLEAR_CACHE'
  }, '*');
}

// Tell sandbox to check IndexedDB cache status
function checkCache() {
  if (!sandboxReady) {
    log('Sandbox not ready yet.', 'warning');
    return;
  }
  
  log('Requesting cache info from sandbox...', 'info');
  
  // Send message to sandbox to check cache
  sandboxFrame.contentWindow.postMessage({
    type: 'CHECK_CACHE'
  }, '*');
}

// Run initialization when page loads
window.addEventListener('load', initialize);
