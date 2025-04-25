// offscreen-ui.js - UI helper functions for offscreen document

// Initialize UI when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Offscreen UI script loaded');
  initializeUI();
});

// Initialize the UI components
function initializeUI() {
  // Set up the log function
  window.logToUI = function(message, isError = false) {
    const log = document.getElementById('log');
    if (!log) return;
    
    // Create log entry
    const entry = document.createElement('div');
    entry.textContent = message;
    
    // Style based on error status
    if (isError) {
      entry.style.color = 'red';
      entry.style.fontWeight = 'bold';
    }
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    entry.dataset.timestamp = timestamp;
    
    // Insert at top for newest-first ordering
    log.insertBefore(entry, log.firstChild);
    
    // Keep log size manageable
    if (log.children.length > 100) {
      log.removeChild(log.lastChild);
    }
  };
  
  // Set up the keep-alive button
  const keepAliveBtn = document.getElementById('keepAliveBtn');
  if (keepAliveBtn) {
    keepAliveBtn.addEventListener('click', () => {
      const timestamp = new Date().toISOString();
      console.log(`Keep alive clicked at ${timestamp}`);
      logToUI(`Manual keep-alive sent at ${new Date().toLocaleTimeString()}`);
      
      // Send a message to the service worker
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_DEBUG',
        action: 'MANUAL_KEEPALIVE',
        timestamp: Date.now()
      }).then(response => {
        logToUI(`Service worker response: ${JSON.stringify(response)}`);
      }).catch(error => {
        logToUI(`Error sending keepalive: ${error.message}`, true);
      });
    });
  }
  
  // Set up the ping button
  const pingBtn = document.getElementById('pingBtn');
  if (pingBtn) {
    pingBtn.addEventListener('click', () => {
      logToUI('Pinging service worker...');
      
      // Try to ping the service worker
      chrome.runtime.sendMessage({
        type: 'PING',
        timestamp: Date.now()
      }).then(response => {
        logToUI(`Service worker ping response: ${JSON.stringify(response)}`);
      }).catch(error => {
        logToUI(`Error pinging service worker: ${error.message}`, true);
      });
    });
  }
  
  // Set up the test Vosk button
  const testVoskBtn = document.getElementById('testVoskBtn');
  if (testVoskBtn) {
    testVoskBtn.addEventListener('click', () => {
      logToUI('Starting Vosk model check...');
      
      // Call the debug function if available
      if (window.debugVoskModel) {
        window.debugVoskModel().then(results => {
          logToUI(`Vosk check completed. Valid: ${results.valid ? 'Yes' : 'No'}`);
          
          // Update status indicators
          updateStatus('vosk-status', results.valid ? 'Valid' : 'Invalid', results.valid);
        }).catch(error => {
          logToUI(`Error checking Vosk model: ${error.message}`, true);
          updateStatus('vosk-status', 'Error', false);
        });
      } else {
        logToUI('debugVoskModel function not available', true);
      }
    });
  }
  
  // Add diagnostic button
  addDiagnosticButton();
  
  // Set up the test transcription functionality
  setupTestTranscription();
  
  // Initial log entry
  logToUI('Offscreen document UI initialized');
  updateStatus('status-value', 'UI Ready');
}

// Helper to update status indicators
function updateStatus(elementId, text, isSuccess = true) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = text;
  element.style.color = isSuccess ? '#10b981' : '#ef4444';
}

// Add a diagnostic button to run various tests
function addDiagnosticButton() {
  const controlPanel = document.querySelector('.control-panel');
  if (!controlPanel) return;
  
  const diagBtn = document.createElement('button');
  diagBtn.textContent = 'Run Full Diagnostics';
  diagBtn.style.backgroundColor = '#6366f1';
  
  diagBtn.addEventListener('click', async () => {
    logToUI('Running full diagnostics...');
    
    // Check if essential objects exist
    logToUI(`chrome: ${typeof chrome !== 'undefined' ? '✓' : '✗'}`);
    logToUI(`chrome.runtime: ${typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' ? '✓' : '✗'}`);
    logToUI(`window.Vosk: ${typeof window.Vosk !== 'undefined' ? '✓' : '✗'}`);
    
    // Test file access
    try {
      const testPath = chrome.runtime.getURL('offscreen/vosk.wasm.js');
      const response = await fetch(testPath, { method: 'HEAD' });
      logToUI(`File access (vosk.wasm.js): ${response.ok ? '✓' : '✗ ' + response.status}`);
    } catch (e) {
      logToUI(`File access error: ${e.message}`, true);
    }
    
    // Check for content security policy
    logToUI('Testing CSP compatibility...');
    try {
      // This will fail if CSP blocks unsafe-eval
      const testFn = new Function('return "CSP allows Function constructor"');
      logToUI(testFn());
    } catch (e) {
      logToUI(`CSP test failed: ${e.message}`, true);
    }
    
    // Check WASM support
    logToUI('Testing WebAssembly support...');
    if (typeof WebAssembly !== 'undefined') {
      logToUI('WebAssembly is supported ✓');
      
      // Test basic WASM instantiation
      try {
        const bytes = new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,7,8,1,4,116,101,115,116,0,0,10,4,1,2,0,11]);
        const module = new WebAssembly.Module(bytes);
        const instance = new WebAssembly.Instance(module);
        logToUI('Basic WASM instantiation successful ✓');
      } catch (e) {
        logToUI(`WASM instantiation failed: ${e.message}`, true);
      }
    } else {
      logToUI('WebAssembly is NOT supported ✗', true);
    }
    
    // Try to initialize Vosk
    if (typeof window.VoskIntegration !== 'undefined' && typeof window.VoskIntegration.initializeVosk === 'function') {
      logToUI('Testing Vosk initialization...');
      try {
        const result = await window.VoskIntegration.initializeVosk();
        logToUI(`Vosk initialization result: ${result ? 'Success' : 'Failed'}`);
      } catch (e) {
        logToUI(`Vosk initialization error: ${e.message}`, true);
      }
    } else {
      logToUI('VoskIntegration.initializeVosk function not available', true);
      logToUI(`VoskIntegration object: ${typeof window.VoskIntegration}`);
      
      // Check if window.Vosk exists
      if (typeof window.Vosk !== 'undefined') {
        logToUI(`Vosk object exists but not properly integrated`);
      }
    }
    
    logToUI('Diagnostics completed');
  });
  
  controlPanel.appendChild(diagBtn);
}

// Set up test transcription functionality
function setupTestTranscription() {
  const testTranscribeBtn = document.getElementById('testTranscribeBtn');
  const testAudioFile = document.getElementById('testAudioFile');
  const resultArea = document.getElementById('testTranscriptionResult');
  
  if (!testTranscribeBtn || !testAudioFile || !resultArea) {
    console.error('Test transcription elements not found');
    return;
  }
  
  testTranscribeBtn.addEventListener('click', async () => {
    if (!testAudioFile.files || testAudioFile.files.length === 0) {
      resultArea.textContent = 'Please select an audio file first';
      resultArea.style.color = 'red';
      return;
    }
    
    const file = testAudioFile.files[0];
    logToUI(`Preparing to transcribe file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    resultArea.textContent = 'Transcribing...';
    
    try {
      // Check if VoskIntegration is available
      if (!window.VoskIntegration) {
        throw new Error('VoskIntegration not available');
      }
      
      // Make sure Vosk is initialized
      const initialized = await window.VoskIntegration.initializeVosk();
      if (!initialized) {
        throw new Error('Failed to initialize Vosk');
      }
      
      // Read the file and convert to audio buffer
      const audioBuffer = await readAudioFile(file);
      
      // Transcribe the audio using Vosk
      logToUI('Starting transcription...');
      const transcriptionResult = await window.VoskIntegration.transcribe(audioBuffer, 16000);
      
      // Display the result
      logToUI(`Transcription complete: "${transcriptionResult}"`);
      resultArea.textContent = transcriptionResult || 'No transcription result';
      resultArea.style.color = transcriptionResult ? 'black' : 'red';
    } catch (error) {
      console.error('Transcription error:', error);
      logToUI(`Transcription error: ${error.message}`, true);
      resultArea.textContent = `Error: ${error.message}`;
      resultArea.style.color = 'red';
    }
  });
}

// Helper function to read audio file and convert to usable format
async function readAudioFile(file) {
  // First, read the file as an ArrayBuffer
  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
  
  // Decode the audio file
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Resample to 16kHz mono as required by Vosk
  const resampledBuffer = resampleAudio(audioBuffer, 16000);
  
  // Return just the Float32Array of samples
  return resampledBuffer;
}

// Resamples audio to the target sample rate
function resampleAudio(audioBuffer, targetSampleRate) {
  const numChannels = 1; // Always use mono for speech recognition
  const sampleRate = audioBuffer.sampleRate;
  const originalLength = audioBuffer.length;
  
  // If already at target sample rate and mono, just return first channel data
  if (sampleRate === targetSampleRate && audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  
  // Calculate new buffer length after resampling
  const targetLength = Math.round(originalLength * targetSampleRate / sampleRate);
  const outputBuffer = new Float32Array(targetLength);
  
  // Mix all channels into mono and downsample/upsample as needed
  const channels = [];
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    channels.push(audioBuffer.getChannelData(channel));
  }
  
  // Simple linear interpolation resampling
  for (let i = 0; i < targetLength; i++) {
    const originalIndex = i * sampleRate / targetSampleRate;
    const index = Math.floor(originalIndex);
    const fraction = originalIndex - index;
    
    let sum = 0;
    for (let channel = 0; channel < channels.length; channel++) {
      const data = channels[channel];
      // Linear interpolation between samples
      if (index < originalLength - 1) {
        sum += (1 - fraction) * data[index] + fraction * data[index + 1];
      } else {
        sum += data[index];
      }
    }
    
    // Average all channels
    outputBuffer[i] = sum / channels.length;
  }
  
  return outputBuffer;
}

// Export functions for use in other scripts
window.updateStatus = updateStatus;