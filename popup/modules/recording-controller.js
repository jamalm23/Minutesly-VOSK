// recording-controller.js - Handles recording functionality
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Recording controller module for audio capture
 * Manages recording start/stop/pause and related state
 */

import * as visualizationModule from './visualization.js';

// Recording states enum
export const RECORDING_STATES = {
  INACTIVE: 'inactive',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing'
};

// Private state
let state = {
  recordingState: RECORDING_STATES.INACTIVE,
  selectedSource: 'tab',
  recordingStartTime: null,
  durationInterval: null,
  portToContent: null
};

// References to DOM elements
let elements = {
  statusIndicator: null,
  statusText: null,
  duration: null,
  source: null,
  tabButton: null,
  screenButton: null,
  startButton: null,
  pauseButton: null,
  stopButton: null
};

// Callback for state changes
let onStateChangeCallback = null;

/**
 * Initialize recording controller with DOM elements
 * @param {Object} domElements - Object containing DOM elements
 * @param {Function} stateChangeCallback - Callback for state changes 
 */
function initialize(domElements, stateChangeCallback) {
  elements = {
    statusIndicator: domElements.statusIndicator,
    statusText: domElements.statusText,
    duration: domElements.duration,
    source: domElements.source,
    tabButton: domElements.tabButton,
    screenButton: domElements.screenButton,
    startButton: domElements.startButton,
    pauseButton: domElements.pauseButton,
    stopButton: domElements.stopButton
  };
  
  onStateChangeCallback = stateChangeCallback;
  
  // Setup event listeners for recording controls
  if (elements.tabButton) {
    elements.tabButton.addEventListener('click', () => setSource('tab'));
  }
  
  if (elements.screenButton) {
    elements.screenButton.addEventListener('click', () => setSource('screen'));
  }
  
  if (elements.startButton) {
    elements.startButton.addEventListener('click', startRecording);
  }
  
  if (elements.pauseButton) {
    elements.pauseButton.addEventListener('click', pauseRecording);
  }
  
  if (elements.stopButton) {
    elements.stopButton.addEventListener('click', stopRecording);
  }
  
  resetDuration();
}

/**
 * Set the recording source
 * @param {string} source - Source type ('tab' or 'screen')
 */
function setSource(source) {
  if (state.recordingState !== RECORDING_STATES.INACTIVE) {
    console.warn('Cannot change source while recording is active');
    return;
  }
  
  state.selectedSource = source;
  
  // Update UI
  if (elements.tabButton) {
    elements.tabButton.classList.toggle('active', source === 'tab');
  }
  
  if (elements.screenButton) {
    elements.screenButton.classList.toggle('active', source === 'screen');
  }
  
  if (elements.source) {
    elements.source.textContent = source === 'tab' ? 'Current Tab' : 'Screen';
  }
}

/**
 * Start recording
 */
function startRecording() {
  console.log('Start recording requested');
  
  // Send message to start recording
  sendToContentScript({
    action: 'startRecording',
    source: state.selectedSource
  });
  
  // Update state and UI
  updateRecordingState(RECORDING_STATES.RECORDING);
  
  // Start timers and visualizations
  startDurationTimer();
  visualizationModule.startVisualization();
}

/**
 * Pause recording
 */
function pauseRecording() {
  console.log('Pause recording requested');
  
  sendToContentScript({
    action: 'pauseRecording'
  });
  
  updateRecordingState(RECORDING_STATES.PAUSED);
  
  // Stop duration timer
  stopDurationTimer();
  
  // Update pause button to show resume
  if (elements.pauseButton) {
    elements.pauseButton.innerHTML = '<span class="material-symbols-outlined">play_arrow</span><span>Resume</span>';
    elements.pauseButton.onclick = resumeRecording;
  }
  
  // Pause visualization
  visualizationModule.stopVisualization();
}

/**
 * Resume recording
 */
function resumeRecording() {
  console.log('Resume recording requested');
  
  sendToContentScript({
    action: 'resumeRecording'
  });
  
  updateRecordingState(RECORDING_STATES.RECORDING);
  
  // Resume duration timer without resetting
  startDurationTimer();
  
  // Update pause button to show pause again
  if (elements.pauseButton) {
    elements.pauseButton.innerHTML = '<span class="material-symbols-outlined">pause</span><span>Pause</span>';
    elements.pauseButton.onclick = pauseRecording;
  }
  
  // Resume visualization
  visualizationModule.startVisualization();
}

/**
 * Stop recording
 */
function stopRecording() {
  console.log('Stop recording requested');
  
  // Change state to processing immediately for UI feedback
  updateRecordingState(RECORDING_STATES.PROCESSING);
  
  sendToContentScript({
    action: 'stopRecording'
  });
  
  // Stop timers
  stopDurationTimer();
  visualizationModule.stopVisualization();
}

/**
 * Send message to content script
 * @param {Object} message - Message to send
 */
function sendToContentScript(message) {
  console.log('Sending message to content script:', message);
  
  // Try first by direct messaging if we're running in a standard popup
  if (window.location.href.includes('popup.html')) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (!tabs || tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to content script:', chrome.runtime.lastError);
          createEmergencyRecording();
          return;
        }
        
        console.log('Content script response:', response);
      });
    });
  } 
  // If we're running in a content script context, send via postMessage to parent
  else {
    window.parent.postMessage(message, '*');
  }
}

/**
 * Create a fallback/emergency recording
 * Used when direct recording methods fail
 */
function createEmergencyRecording() {
  console.warn('Creating emergency recording (fallback)');
  
  // Set status to processing to indicate activity
  updateRecordingState(RECORDING_STATES.PROCESSING);
  
  chrome.runtime.sendMessage({
    action: 'createEmergencyRecording',
    source: state.selectedSource
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Emergency recording failed:', chrome.runtime.lastError);
      updateRecordingState(RECORDING_STATES.INACTIVE);
      return;
    }
    
    if (response && response.success) {
      console.log('Emergency recording started successfully');
    } else {
      console.error('Emergency recording failed:', response ? response.error : 'Unknown error');
      updateRecordingState(RECORDING_STATES.INACTIVE);
    }
  });
}

/**
 * Update recording state and UI
 * @param {string} newState - New recording state
 */
function updateRecordingState(newState) {
  state.recordingState = newState;
  
  // Update status indicator
  if (elements.statusIndicator) {
    elements.statusIndicator.className = 'status-indicator';
  }
  
  switch (newState) {
    case RECORDING_STATES.RECORDING:
      if (elements.statusIndicator) elements.statusIndicator.classList.add('status-recording');
      if (elements.statusText) elements.statusText.textContent = 'Recording';
      if (elements.startButton) elements.startButton.disabled = true;
      if (elements.pauseButton) elements.pauseButton.disabled = false;
      if (elements.stopButton) elements.stopButton.disabled = false;
      break;
      
    case RECORDING_STATES.PAUSED:
      if (elements.statusIndicator) elements.statusIndicator.classList.add('status-paused');
      if (elements.statusText) elements.statusText.textContent = 'Paused';
      if (elements.startButton) elements.startButton.disabled = true;
      if (elements.pauseButton) elements.pauseButton.disabled = false;
      if (elements.pauseButton) {
        elements.pauseButton.innerHTML = '<span class="material-symbols-outlined">play_arrow</span><span>Resume</span>';
        elements.pauseButton.onclick = resumeRecording;
      }
      if (elements.stopButton) elements.stopButton.disabled = false;
      break;
      
    case RECORDING_STATES.PROCESSING:
      if (elements.statusIndicator) elements.statusIndicator.classList.add('status-processing');
      if (elements.statusText) elements.statusText.textContent = 'Processing';
      if (elements.startButton) elements.startButton.disabled = true;
      if (elements.pauseButton) elements.pauseButton.disabled = true;
      if (elements.stopButton) elements.stopButton.disabled = true;
      break;
      
    case RECORDING_STATES.INACTIVE:
    default:
      if (elements.statusIndicator) elements.statusIndicator.classList.add('status-inactive');
      if (elements.statusText) elements.statusText.textContent = 'Not Recording';
      if (elements.startButton) elements.startButton.disabled = false;
      if (elements.pauseButton) elements.pauseButton.disabled = true;
      if (elements.pauseButton) {
        elements.pauseButton.innerHTML = '<span class="material-symbols-outlined">pause</span><span>Pause</span>';
        elements.pauseButton.onclick = pauseRecording;
      }
      if (elements.stopButton) elements.stopButton.disabled = true;
      break;
  }
  
  // Call state change callback if provided
  if (onStateChangeCallback) {
    onStateChangeCallback(newState);
  }
}

/**
 * Start the duration timer
 */
function startDurationTimer() {
  if (!state.recordingStartTime) {
    state.recordingStartTime = Date.now();
  }
  
  // Clear any existing interval
  if (state.durationInterval) {
    clearInterval(state.durationInterval);
  }
  
  // Update duration every second
  state.durationInterval = setInterval(() => {
    const durationMs = Date.now() - state.recordingStartTime;
    updateDuration(durationMs);
  }, 1000);
}

/**
 * Stop the duration timer
 */
function stopDurationTimer() {
  if (state.durationInterval) {
    clearInterval(state.durationInterval);
    state.durationInterval = null;
  }
}

/**
 * Reset duration display
 */
function resetDuration() {
  state.recordingStartTime = null;
  updateDuration(0);
}

/**
 * Update duration display with a specific value
 * @param {number} durationMs - Duration in milliseconds
 */
function updateDuration(durationMs) {
  if (elements.duration) {
    elements.duration.textContent = formatDuration(durationMs);
  }
}

/**
 * Format duration in HH:MM:SS
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(ms) {
  if (ms === 0) {
    return '00:00';
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const formattedHours = hours > 0 ? `${hours}:` : '';
  const formattedMinutes = `${hours > 0 ? String(minutes % 60).padStart(2, '0') : minutes % 60}:`;
  const formattedSeconds = String(seconds % 60).padStart(2, '0');
  
  return `${formattedHours}${formattedMinutes}${formattedSeconds}`;
}

/**
 * Get the current recording state
 * @returns {Object} The current state object
 */
function getState() {
  return { ...state };
}

/**
 * Handle recording completed event (usually triggered by content script or background)
 * @param {Object} data - Data about the completed recording
 */
function handleRecordingCompleted(data) {
  // Reset state
  updateRecordingState(RECORDING_STATES.INACTIVE);
  stopDurationTimer();
  
  // We don't reset duration here so the user can see how long their recording was
  
  console.log('Recording completed with data:', data);
}

// Export public API
export {
  initialize,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  setSource,
  updateRecordingState,
  getState,
  handleRecordingCompleted,
  resetDuration,
  updateDuration,
  formatDuration
};
