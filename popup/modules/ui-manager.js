// ui-manager.js - Handles UI state and management
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * UI manager module for handling interface state
 * Manages panels, errors, and general UI operations
 */

// Panel states
export const PANELS = {
  MAIN: 'main',
  RECORDINGS: 'recordings'
};

// References to DOM elements
let elements = {
  mainPanel: null,
  recordingsListPanel: null,
  backToMainButton: null,
  minimizeButton: null,
  errorContainer: null
};

// Current panel state
let currentPanel = PANELS.MAIN;

/**
 * Initialize UI manager with DOM elements
 * @param {Object} domElements - Object containing DOM elements
 */
function initialize(domElements) {
  elements = {
    mainPanel: domElements.mainPanel,
    recordingsListPanel: domElements.recordingsListPanel,
    backToMainButton: domElements.backToMainButton,
    minimizeButton: domElements.minimizeButton,
    errorContainer: domElements.errorContainer || null
  };
  
  // Setup event listeners
  if (elements.backToMainButton) {
    elements.backToMainButton.addEventListener('click', () => showPanel(PANELS.MAIN));
  }
  
  if (elements.minimizeButton) {
    elements.minimizeButton.addEventListener('click', minimizePanel);
  }
  
  // Make sure we're showing the right panel initially
  showPanel(currentPanel);
}

/**
 * Show a specific panel
 * @param {string} panelId - Panel identifier from PANELS enum
 */
function showPanel(panelId) {
  currentPanel = panelId;
  
  switch (panelId) {
    case PANELS.MAIN:
      showMainPanel();
      break;
    case PANELS.RECORDINGS:
      showRecordingsPanel();
      break;
    default:
      console.error('Unknown panel:', panelId);
      showMainPanel(); // Fallback to main panel
  }
}

/**
 * Show main recording panel
 */
function showMainPanel() {
  if (elements.mainPanel) {
    elements.mainPanel.classList.remove('hidden');
  }
  
  if (elements.recordingsListPanel) {
    elements.recordingsListPanel.classList.add('hidden');
  }
}

/**
 * Show recordings list panel
 */
function showRecordingsPanel() {
  if (elements.mainPanel) {
    elements.mainPanel.classList.add('hidden');
  }
  
  if (elements.recordingsListPanel) {
    elements.recordingsListPanel.classList.remove('hidden');
  }
}

/**
 * Minimize the panel
 * Used in the embedded panel context
 */
function minimizePanel() {
  console.log('Minimize panel requested');
  
  // If we're in a normal popup, just close it
  if (window.location.href.includes('popup.html')) {
    closePopupWindow();
    return;
  }
  
  // Otherwise, we're in an embedded panel - send a message to the parent
  window.parent.postMessage({ action: 'closePanel' }, '*');
}

/**
 * Close popup window
 */
function closePopupWindow() {
  window.close();
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  console.error('Error:', message);
  
  // Create error container if it doesn't exist yet
  if (!elements.errorContainer) {
    elements.errorContainer = document.createElement('div');
    elements.errorContainer.className = 'error-message';
    document.body.appendChild(elements.errorContainer);
  }
  
  elements.errorContainer.textContent = message;
  elements.errorContainer.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.errorContainer.style.display = 'none';
  }, 5000);
}

/**
 * Update UI from state object received from background
 * @param {Object} backgroundState - State object from background
 */
function updateUIFromState(backgroundState) {
  if (backgroundState.recordingState) {
    // Call external function to update recording state
    // This will be provided by the main popup.js that coordinates modules
    if (window.updateRecordingState) {
      window.updateRecordingState(backgroundState.recordingState);
    } else {
      console.warn('updateRecordingState function not available');
    }
  }
  
  if (backgroundState.recordingSource) {
    // Call external function to update source
    if (window.setSource) {
      window.setSource(backgroundState.recordingSource);
    } else {
      console.warn('setSource function not available');
    }
  }
  
  if (backgroundState.recordingDuration !== undefined) {
    // Call external function to update duration
    if (window.updateDuration) {
      window.updateDuration(backgroundState.recordingDuration);
    } else {
      console.warn('updateDuration function not available');
    }
  }
  
  // Update any other UI elements based on background state
  // ...
}

/**
 * Open dashboard page in a new tab
 */
function openDashboard() {
  chrome.runtime.sendMessage({ action: 'openDashboard' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening dashboard:', chrome.runtime.lastError);
      showError('Failed to open dashboard: ' + chrome.runtime.lastError.message);
      return;
    }
    
    // Close popup if we're in one
    if (window.location.href.includes('popup.html')) {
      closePopupWindow();
    }
  });
}

/**
 * Open whisper test page in a new tab
 */
function openWhisperTest() {
  chrome.runtime.sendMessage({ action: 'openWhisperTest' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening whisper test:', chrome.runtime.lastError);
      showError('Failed to open whisper test: ' + chrome.runtime.lastError.message);
      return;
    }
    
    // Close popup if we're in one
    if (window.location.href.includes('popup.html')) {
      closePopupWindow();
    }
  });
}

/**
 * Open transcription test page in a new tab
 */
function openTranscriptionTest() {
  chrome.runtime.sendMessage({ action: 'openTranscriptionTest' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error opening transcription test:', chrome.runtime.lastError);
      showError('Failed to open transcription test: ' + chrome.runtime.lastError.message);
      return;
    }
    
    // Close popup if we're in one
    if (window.location.href.includes('popup.html')) {
      closePopupWindow();
    }
  });
}

/**
 * Get the current panel being shown
 * @returns {string} Current panel ID from PANELS enum
 */
function getCurrentPanel() {
  return currentPanel;
}

// Export public API
export {
  initialize,
  showPanel,
  showMainPanel,
  showRecordingsPanel,
  minimizePanel,
  closePopupWindow,
  showError,
  updateUIFromState,
  openDashboard,
  openWhisperTest,
  openTranscriptionTest,
  getCurrentPanel
};
