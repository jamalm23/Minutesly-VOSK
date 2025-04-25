// DOM Elements
const audioFileInput = document.getElementById('audio-file');
const fileNameDisplay = document.getElementById('file-name-display');
const audioPlayer = document.getElementById('audio-player');
const transcribeBtn = document.getElementById('transcribe-btn');
const copyResultBtn = document.getElementById('copy-result');
const clearAllBtn = document.getElementById('clear-all');
const resultElement = document.getElementById('result');
const statusElement = document.getElementById('status');
const detailsElement = document.getElementById('details');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const startRecordingBtn = document.getElementById('start-recording');
const stopRecordingBtn = document.getElementById('stop-recording');
const recordingStatus = document.getElementById('recording-status');
const recordedAudioPlayer = document.getElementById('recorded-audio-player');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const transcriptionEngine = document.getElementById('transcription-engine');
const modelSize = document.getElementById('model-size');
const language = document.getElementById('language');

// State variables
let audioBlob = null;
let audioArrayBuffer = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Tab switching functionality
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// File input handling
audioFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    fileNameDisplay.textContent = file.name;
    audioBlob = file;
    
    // Create object URL for audio player
    const audioURL = URL.createObjectURL(file);
    audioPlayer.src = audioURL;
    audioPlayer.style.display = 'block';
    
    // Enable transcribe button
    transcribeBtn.disabled = false;
    
    // Update status
    statusElement.textContent = 'Audio file loaded successfully.';
    detailsElement.textContent = `Size: ${formatFileSize(file.size)}, Type: ${file.type}`;
    
    // Read file as ArrayBuffer (needed for transcription)
    const reader = new FileReader();
    reader.onload = function(e) {
      audioArrayBuffer = e.target.result;
    };
    reader.readAsArrayBuffer(file);
  }
});

// Recording functionality
startRecordingBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    
    mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    });
    
    mediaRecorder.addEventListener('stop', () => {
      audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      
      // Create object URL for audio player
      const audioURL = URL.createObjectURL(audioBlob);
      recordedAudioPlayer.src = audioURL;
      recordedAudioPlayer.style.display = 'block';
      
      // Enable transcribe button
      transcribeBtn.disabled = false;
      
      // Update status
      statusElement.textContent = 'Recording complete.';
      detailsElement.textContent = `Size: ${formatFileSize(audioBlob.size)}, Type: ${audioBlob.type}`;
      
      // Read blob as ArrayBuffer
      const reader = new FileReader();
      reader.onload = function(e) {
        audioArrayBuffer = e.target.result;
      };
      reader.readAsArrayBuffer(audioBlob);
      
      isRecording = false;
      startRecordingBtn.disabled = false;
      stopRecordingBtn.disabled = true;
      recordingStatus.textContent = '';
    });
    
    mediaRecorder.start();
    isRecording = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = false;
    recordingStatus.textContent = 'Recording...';
    
  } catch (error) {
    console.error('Error starting recording:', error);
    statusElement.textContent = 'Error starting recording.';
    detailsElement.textContent = error.message;
  }
});

stopRecordingBtn.addEventListener('click', () => {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    // Stop all audio tracks
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
});

// Transcription functionality
transcribeBtn.addEventListener('click', async () => {
  if (!audioBlob) {
    statusElement.textContent = 'No audio file loaded.';
    return;
  }
  
  try {
    // Update UI
    transcribeBtn.disabled = true;
    resultElement.textContent = 'Transcribing...';
    statusElement.textContent = 'Transcription in progress...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '10%';
    
    // Get settings
    const engine = transcriptionEngine.value;
    const model = modelSize.value;
    const lang = language.value;
    
    // Convert the audio to a data URL for transmission
    const audioDataUrl = await blobToDataURL(audioBlob);
    
    // Create a request ID
    const requestId = generateUUID();
    
    // Set up message listener for this specific request
    setupMessageListener(requestId);
    
    // Update progress
    progressBar.style.width = '30%';
    
    // Send message to extension's service worker
    if (window.chrome && chrome.runtime) {
      // We're in a Chrome extension context
      console.log('Sending transcription request:', requestId);
      chrome.runtime.sendMessage({
        action: 'transcribeAudio',
        audioDataUrl: audioDataUrl,
        requestId: requestId,
        options: {
          engine: engine,
          model: model,
          language: lang
        }
      }, handleTranscriptionResponse);
    } else {
      // We're in a standalone web page - use mock transcription
      console.log('Using mock transcription (not in extension context)');
      mockTranscribe(audioDataUrl, requestId);
    }
    
  } catch (error) {
    console.error('Error in transcription process:', error);
    statusElement.textContent = 'Transcription error.';
    detailsElement.textContent = error.message;
    resultElement.textContent = 'Error: ' + error.message;
    progressContainer.style.display = 'none';
    transcribeBtn.disabled = false;
  }
});

function handleTranscriptionResponse(response) {
  if (chrome.runtime.lastError) {
    console.error('Runtime error:', chrome.runtime.lastError);
    statusElement.textContent = 'Error communicating with extension.';
    detailsElement.textContent = chrome.runtime.lastError.message;
    progressContainer.style.display = 'none';
    transcribeBtn.disabled = false;
    return;
  }
  
  console.log('Initial response:', response);
  if (response && response.status === 'queued') {
    statusElement.textContent = 'Transcription request queued.';
    progressBar.style.width = '50%';
  } else if (response && response.status === 'error') {
    // Handle immediate error response
    handleTranscriptionError({
      requestId: response.requestId,
      error: response.error || 'Unknown error'
    });
  }
}

let messageListener;

function setupMessageListener(requestId) {
  // Remove any existing listener first to avoid duplicates
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }
  
  messageListener = function(message) {
    console.log('Received message:', message);
    
    if (message.type === 'TRANSCRIPTION_PROGRESS' && 
        message.payload && 
        message.payload.requestId === requestId) {
      handleProgressUpdate(message.payload);
      return true;
    } 
    
    if (message.type === 'TRANSCRIPTION_RESULT' && 
        message.payload && 
        message.payload.requestId === requestId) {
      handleTranscriptionResult(message.payload);
      return true;
    } 
    
    if (message.type === 'TRANSCRIPTION_ERROR' && 
        message.payload && 
        message.payload.requestId === requestId) {
      handleTranscriptionError(message.payload);
      return true;
    }
    
    return false;
  };
  
  chrome.runtime.onMessage.addListener(messageListener);
}

function handleProgressUpdate(payload) {
  console.log('Progress update:', payload);
  const { requestId, progress, status } = payload;
  
  if (status) {
    statusElement.textContent = status;
  }
  
  if (progress) {
    progressBar.style.width = `${Math.min(90, 30 + progress * 60)}%`;
  }
}

function handleTranscriptionResult(payload) {
  console.log('Transcription result:', payload);
  const { requestId, result } = payload;
  
  statusElement.textContent = 'Transcription completed successfully.';
  detailsElement.textContent = `Engine: ${transcriptionEngine.value}, Model: ${modelSize.value}`;
  resultElement.textContent = result;
  progressBar.style.width = '100%';
  
  // Re-enable buttons
  transcribeBtn.disabled = false;
  copyResultBtn.disabled = false;
  
  // Hide progress after a delay
  setTimeout(() => {
    progressContainer.style.display = 'none';
  }, 2000);
}

function handleTranscriptionError(payload) {
  console.error('Transcription error:', payload);
  const { requestId, error } = payload;
  
  statusElement.textContent = 'Transcription error.';
  detailsElement.textContent = error;
  resultElement.textContent = 'Error: ' + error;
  progressContainer.style.display = 'none';
  transcribeBtn.disabled = false;
}

// Mock transcription function (for testing outside extension)
function mockTranscribe(audioDataUrl, requestId) {
  console.log('Starting mock transcription for request:', requestId);
  statusElement.textContent = 'Using mock transcription engine...';
  
  // Simulate progress updates
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 0.1;
    progressBar.style.width = `${Math.min(90, 30 + progress * 60)}%`;
    
    if (progress >= 1) {
      clearInterval(progressInterval);
      
      // Simulate result after progress completes
      setTimeout(() => {
        const mockResult = "This is a mock transcription result. It's generated for testing purposes and doesn't reflect the actual content of your audio file. In a real scenario, the audio would be processed by the selected transcription engine, which would analyze the speech patterns and convert them to text using automatic speech recognition technology.";
        
        statusElement.textContent = 'Mock transcription completed.';
        detailsElement.textContent = 'This is a simulation only.';
        resultElement.textContent = mockResult;
        progressBar.style.width = '100%';
        
        // Re-enable buttons
        transcribeBtn.disabled = false;
        copyResultBtn.disabled = false;
        
        // Hide progress after a delay
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 2000);
      }, 1000);
    }
  }, 500);
}

// Copy result functionality
copyResultBtn.addEventListener('click', () => {
  const text = resultElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = copyResultBtn.textContent;
    copyResultBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyResultBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Error copying text:', err);
  });
});

// Clear functionality
clearAllBtn.addEventListener('click', () => {
  // Reset file input
  audioFileInput.value = '';
  fileNameDisplay.textContent = 'No file selected';
  
  // Clear audio players
  audioPlayer.src = '';
  audioPlayer.style.display = 'none';
  recordedAudioPlayer.src = '';
  recordedAudioPlayer.style.display = 'none';
  
  // Reset state
  audioBlob = null;
  audioArrayBuffer = null;
  
  // Reset UI
  transcribeBtn.disabled = true;
  copyResultBtn.disabled = true;
  resultElement.textContent = 'Transcription results will appear here.';
  statusElement.textContent = 'Ready to transcribe.';
  detailsElement.textContent = '';
  progressContainer.style.display = 'none';
  progressBar.style.width = '0%';
});

// Utility functions
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
