/**
 * Vosk Integration Diagnostics
 * 
 * This file helps diagnose issues with the Vosk integration in the context
 * of Chrome's Manifest V3 Content Security Policy restrictions.
 */

// Output element for diagnostics
let diagOutput;

// Initialize the diagnostics UI
function initDiagnostics() {
  // Create output element if it doesn't exist
  if (!diagOutput) {
    diagOutput = document.getElementById('diag-output') || document.createElement('div');
    diagOutput.id = 'diag-output';
    diagOutput.className = 'diagnostic-output';
    document.body.appendChild(diagOutput);
    
    // Add some basic styling
    const style = document.createElement('style');
    style.textContent = `
      .diagnostic-output {
        font-family: monospace;
        background: #f0f0f0;
        border: 1px solid #ccc;
        padding: 10px;
        margin: 10px 0;
        max-height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      .diag-success { color: green; }
      .diag-error { color: red; }
      .diag-info { color: blue; }
      .diag-warning { color: orange; }
    `;
    document.head.appendChild(style);
  }
  
  // Clear previous results
  diagOutput.innerHTML = '<h3>Vosk Integration Diagnostics</h3>';
  
  // Add run button
  const runButton = document.createElement('button');
  runButton.textContent = 'Run Full Diagnostics';
  runButton.onclick = runDiagnostics;
  document.body.insertBefore(runButton, diagOutput);
}

// Log a diagnostic message
function logDiag(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `diag-${type}`;
  line.textContent = message;
  diagOutput.appendChild(line);
  console.log(`[DIAG:${type}] ${message}`);
}

// Run all diagnostics
async function runDiagnostics() {
  logDiag('Starting Vosk integration diagnostics...', 'info');
  
  // Test 1: Check if VoskIntegration object exists
  try {
    if (typeof window.VoskIntegration === 'object') {
      logDiag('✓ VoskIntegration object exists', 'success');
      
      // Log available methods
      const methods = Object.keys(window.VoskIntegration);
      logDiag(`VoskIntegration methods: ${methods.join(', ')}`, 'info');
      
      // Check for expected methods
      const expectedMethods = ['initializeVosk', 'transcribe', 'isReady', 'test'];
      for (const method of expectedMethods) {
        if (typeof window.VoskIntegration[method] === 'function') {
          logDiag(`✓ VoskIntegration.${method} function is available`, 'success');
        } else {
          logDiag(`✗ VoskIntegration.${method} function not available`, 'error');
        }
      }
    } else {
      logDiag('✗ VoskIntegration object not available', 'error');
    }
  } catch (error) {
    logDiag(`Error checking VoskIntegration: ${error.message}`, 'error');
  }
  
  // Test 2: Check WebAssembly support
  try {
    if (typeof WebAssembly === 'object') {
      logDiag('✓ WebAssembly is supported', 'success');
      
      // Check if we can instantiate WebAssembly
      const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
      const module = new WebAssembly.Module(bytes);
      const instance = new WebAssembly.Instance(module);
      logDiag('✓ Basic WASM instantiation successful', 'success');
    } else {
      logDiag('✗ WebAssembly not supported', 'error');
    }
  } catch (error) {
    logDiag(`Error testing WebAssembly: ${error.message}`, 'error');
  }
  
  // Test 3: Check CSP status - we expect 'unsafe-eval' to be blocked in main context
  try {
    logDiag('Testing CSP restrictions...', 'info');
    try {
      // This should fail in the main context with Manifest V3
      eval('1+1');
      logDiag('⚠ CSP check: eval() is allowed in this context, which is unexpected', 'warning');
    } catch (evalError) {
      if (evalError.message.includes('Content Security Policy')) {
        logDiag('✓ CSP check: eval() correctly blocked in main context (expected)', 'success');
        logDiag('Note: This is why we use a sandboxed worker for Vosk which allows eval()', 'info');
      } else {
        logDiag(`⚠ CSP check: eval() failed for unexpected reason: ${evalError.message}`, 'warning');
      }
    }
  } catch (error) {
    logDiag(`Error testing CSP: ${error.message}`, 'error');
  }
  
  // Test 4: Check sandbox iframe
  try {
    logDiag('Testing sandbox worker communication...', 'info');
    const iframes = document.querySelectorAll('iframe');
    
    if (iframes.length > 0) {
      logDiag(`Found ${iframes.length} iframe(s) in the document`, 'info');
      
      // Check if any iframe is our worker
      let workerFound = false;
      for (const iframe of iframes) {
        const src = iframe.src || '';
        if (src.includes('vosk-worker.html')) {
          workerFound = true;
          logDiag(`✓ Found vosk-worker.html iframe: ${src}`, 'success');
        } else {
          logDiag(`Found iframe with src: ${src}`, 'info');
        }
      }
      
      if (!workerFound) {
        logDiag('⚠ No vosk-worker.html iframe found - worker may not be initialized yet', 'warning');
      }
    } else {
      logDiag('⚠ No iframes found - worker may not be initialized yet', 'warning');
    }
  } catch (error) {
    logDiag(`Error checking sandbox: ${error.message}`, 'error');
  }
  
  // Test 5: Try to initialize Vosk
  try {
    logDiag('Attempting to initialize Vosk...', 'info');
    
    if (typeof window.VoskIntegration?.initializeVosk === 'function') {
      // Set a timeout to prevent blocking if initialization stalls
      const initPromise = Promise.race([
        window.VoskIntegration.initializeVosk(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), 10000))
      ]);
      
      try {
        const result = await initPromise;
        logDiag(`Vosk initialization result: ${result ? 'success' : 'failed'}`, result ? 'success' : 'error');
        
        if (result) {
          logDiag('✓ Vosk initialized successfully', 'success');
          
          // Check if it's ready
          if (window.VoskIntegration.isReady()) {
            logDiag('✓ Vosk is ready for transcription', 'success');
          } else {
            logDiag('⚠ Vosk initialized but not ready - this is unexpected', 'warning');
          }
          
          // Try the test function
          try {
            const testResult = await window.VoskIntegration.test();
            logDiag(`Vosk test result: ${JSON.stringify(testResult)}`, testResult.success ? 'success' : 'error');
          } catch (testError) {
            logDiag(`Error running Vosk test: ${testError.message}`, 'error');
          }
        } else {
          const lastError = window.VoskIntegration.getLastError?.() || 'Unknown error';
          logDiag(`✗ Vosk initialization failed: ${lastError}`, 'error');
        }
      } catch (timeoutError) {
        logDiag(`✗ ${timeoutError.message}`, 'error');
      }
    } else {
      logDiag('✗ Cannot initialize Vosk - initializeVosk function not available', 'error');
    }
  } catch (error) {
    logDiag(`Error initializing Vosk: ${error.message}`, 'error');
  }
  
  logDiag('Diagnostics completed', 'info');
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', initDiagnostics);

// Export for external use
window.VoskDiagnostics = {
  run: runDiagnostics,
  log: logDiag
};
