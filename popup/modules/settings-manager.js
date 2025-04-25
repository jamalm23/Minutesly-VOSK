// settings-manager.js - Handles user settings for the audio recording extension
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Settings module for managing user configuration
 * Handles loading, saving, and displaying settings
 */

// Default settings
const DEFAULT_SETTINGS = {
  audioQuality: 'medium',
  automaticTranscription: true,
  speakerIdentification: true,
  saveRecordings: true
};

// DOM elements for settings
let elements = {
  audioQuality: null,
  automaticTranscription: null,
  speakerIdentification: null,
  saveRecordings: null,
  settingsButton: null,
  settingsPanel: null,
  saveSettingsButton: null
};

// Current settings state
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * Initialize settings manager with DOM elements
 * @param {Object} domElements - Object containing DOM elements
 */
function initialize(domElements) {
  elements = {
    audioQuality: domElements.audioQuality,
    automaticTranscription: domElements.automaticTranscription,
    speakerIdentification: domElements.speakerIdentification,
    saveRecordings: domElements.saveRecordings,
    settingsButton: domElements.settingsButton,
    settingsPanel: domElements.settingsPanel,
    saveSettingsButton: domElements.saveSettingsButton
  };
  
  // Load settings from storage
  loadSettings();
  
  // Setup event listeners
  if (elements.saveSettingsButton) {
    elements.saveSettingsButton.addEventListener('click', saveSettings);
  }
  
  if (elements.settingsButton) {
    elements.settingsButton.addEventListener('click', toggleSettingsPanel);
  }
}

/**
 * Load settings from Chrome storage
 */
function loadSettings() {
  chrome.storage.local.get('settings', (result) => {
    if (result.settings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
      updateSettingsUI();
    }
  });
}

/**
 * Update settings UI from state
 */
function updateSettingsUI() {
  if (elements.audioQuality) {
    elements.audioQuality.value = currentSettings.audioQuality;
  }
  
  if (elements.automaticTranscription) {
    elements.automaticTranscription.checked = currentSettings.automaticTranscription;
  }
  
  if (elements.speakerIdentification) {
    elements.speakerIdentification.checked = currentSettings.speakerIdentification;
  }
  
  if (elements.saveRecordings) {
    elements.saveRecordings.checked = currentSettings.saveRecordings;
  }
}

/**
 * Save settings
 */
function saveSettings() {
  // Get settings from UI
  if (elements.audioQuality) {
    currentSettings.audioQuality = elements.audioQuality.value;
  }
  
  if (elements.automaticTranscription) {
    currentSettings.automaticTranscription = elements.automaticTranscription.checked;
  }
  
  if (elements.speakerIdentification) {
    currentSettings.speakerIdentification = elements.speakerIdentification.checked;
  }
  
  if (elements.saveRecordings) {
    currentSettings.saveRecordings = elements.saveRecordings.checked;
  }
  
  // Save to Chrome storage
  chrome.storage.local.set({ settings: currentSettings }, () => {
    console.log('Settings saved', currentSettings);
    
    // Notify the service worker of the updated settings
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings: currentSettings
    });
    
    // Hide settings panel
    toggleSettingsPanel(false);
  });
}

/**
 * Toggle settings panel visibility
 * @param {boolean|Event} showOrEvent - Boolean to force state or event object
 */
function toggleSettingsPanel(showOrEvent) {
  // If parameter is an event or undefined, toggle the panel
  const forceState = typeof showOrEvent === 'boolean' ? showOrEvent : null;
  
  if (elements.settingsPanel) {
    const isVisible = elements.settingsPanel.classList.contains('visible');
    
    if (forceState !== null) {
      // Force specific state
      if (forceState) {
        elements.settingsPanel.classList.add('visible');
      } else {
        elements.settingsPanel.classList.remove('visible');
      }
    } else {
      // Toggle current state
      elements.settingsPanel.classList.toggle('visible');
    }
  }
}

/**
 * Get the current settings
 * @returns {Object} The current settings object
 */
function getSettings() {
  return { ...currentSettings };
}

// Export public API
export {
  initialize,
  loadSettings,
  updateSettingsUI,
  saveSettings,
  toggleSettingsPanel,
  getSettings
};
