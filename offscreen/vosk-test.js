// Global variables
let extensionId = null;
let modelPath = null;
let voskAvailable = false;

// Utility function to log messages
function log(message, type = 'info') {
  const logElement = document.getElementById('log');
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.textContent = `[${timestamp}] ${message}`;
  entry.className = type;
  logElement.appendChild(entry);
  logElement.scrollTop = logElement.scrollHeight;
  console.log(`[${type}] ${message}`);
}

// Get extension ID from URL or chrome.runtime
function getExtensionId() {
  try {
    // First try chrome.runtime
    extensionId = chrome.runtime.id;
    document.getElementById('extension-info').innerHTML = `
      <p><strong>Extension ID:</strong> ${extensionId}</p>
      <p><strong>Context:</strong> Running with extension API access</p>
    `;
    log(`Detected extension ID from chrome.runtime: ${extensionId}`);
  } catch (err) {
    // If that fails, extract from URL
    try {
      const url = window.location.href;
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      
      if (match && match[1]) {
        extensionId = match[1];
        document.getElementById('extension-info').innerHTML = `
          <p><strong>Extension ID:</strong> ${extensionId}</p>
          <p><strong>Context:</strong> Running in sandbox (extracted ID from URL)</p>
        `;
        log(`Extracted extension ID from URL: ${extensionId}`);
      } else {
        document.getElementById('extension-info').innerHTML = `
          <p class="error"><strong>Error:</strong> Could not determine extension ID</p>
          <p>This page must be accessed via a Chrome extension URL.</p>
        `;
        log('Could not determine extension ID from URL', 'error');
        return null;
      }
    } catch (urlErr) {
      document.getElementById('extension-info').innerHTML = `
        <p class="error"><strong>Error:</strong> Not running as a Chrome extension</p>
        <p>This page needs to be accessed via a Chrome extension URL.</p>
      `;
      log('Not running as a Chrome extension: ' + err.message, 'error');
      return null;
    }
  }
  
  return extensionId;
}

// Check if Vosk is loaded
function checkVosk() {
  const voskStatusElement = document.getElementById('vosk-status');
  
  // Check if the Vosk object exists
  if (typeof Vosk !== 'undefined') {
    voskAvailable = true;
    voskStatusElement.innerHTML = `
      <p class="success"><strong>Status:</strong> Vosk library loaded successfully</p>
      <p><strong>Version:</strong> ${Vosk.VERSION || 'Unknown'}</p>
      <p><strong>Available methods:</strong> ${Object.keys(Vosk).join(', ')}</p>
    `;
    log('✅ Vosk library loaded successfully', 'success');
    log(`Available methods: ${Object.keys(Vosk).join(', ')}`);
    return true;
  } else {
    voskAvailable = false;
    voskStatusElement.innerHTML = `
      <p class="error"><strong>Status:</strong> Vosk library not loaded</p>
      <p>The Vosk library is not available. Check that the script is properly included.</p>
    `;
    log('❌ Vosk library not loaded', 'error');
    log('Make sure the path to vosk-browser.js is correct', 'error');
    return false;
  }
}

// Calculate and display model path
function updateModelPath() {
  if (!extensionId) {
    document.getElementById('model-path').innerHTML = `
      <p class="error">Cannot calculate model path: Extension ID unknown</p>
    `;
    return null;
  }
  
  modelPath = `chrome-extension://${extensionId}/wasm/vosk-model-en-us-0.22-lgraph`;
  
  document.getElementById('model-path').innerHTML = `
    <p><strong>Model path:</strong></p>
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
    
    // Try to create a recognizer with the model
    try {
      const recognizer = new Vosk.Recognizer({model: model, sampleRate: 16000});
      log('✅ Recognizer created successfully!', 'success');
      
      // Check available methods
      const methods = Object.keys(recognizer).filter(k => typeof recognizer[k] === 'function');
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

// Check sandbox status
function checkSandbox() {
  log('Checking sandbox environment...');
  
  // Test if we can use eval (shouldn't be possible in normal extension pages)
  try {
    const result = eval('2 + 2');
    log(`✅ eval() is working: 2 + 2 = ${result}`, 'success');
  } catch (error) {
    log(`❌ eval() is blocked: ${error.message}`, 'error');
    log('This page needs to run in a sandboxed context to use Vosk', 'error');
  }
  
  // Test if we can use Function constructor
  try {
    const add = new Function('a', 'b', 'return a + b');
    const result = add(3, 4);
    log(`✅ Function constructor is working: 3 + 4 = ${result}`, 'success');
  } catch (error) {
    log(`❌ Function constructor is blocked: ${error.message}`, 'error');
  }
  
  // Check if running in sandbox based on URL
  const url = window.location.href;
  if (url.includes('sandbox')) {
    log('✅ URL suggests this page is running in a sandbox context', 'success');
  } else {
    log('⚠️ URL does not suggest a sandbox context', 'warning');
  }
}

// Initialize page
function initialize() {
  log('Page loaded, running initial checks...');
  
  // Get extension ID
  getExtensionId();
  
  // Update model path
  updateModelPath();
  
  // Check if Vosk is loaded
  setTimeout(() => {
    checkVosk();
  }, 500);
  
  // Set up button event listeners
  document.getElementById('checkVoskBtn').addEventListener('click', checkVosk);
  document.getElementById('testModelPathBtn').addEventListener('click', testModelPath);
  document.getElementById('loadModelBtn').addEventListener('click', tryLoadModel);
  document.getElementById('checkSandboxBtn').addEventListener('click', checkSandbox);
}

// Run initialization when page loads
window.addEventListener('load', initialize);