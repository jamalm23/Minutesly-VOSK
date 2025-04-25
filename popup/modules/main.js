// main.js - Main coordinator for the popup modules
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Main coordinator module that initializes and connects all the separate modules
 * Acts as a thin layer that wires everything together
 */

import * as VisualizationModule from './visualization.js';
import * as RecordingController from './recording-controller.js';
import * as SettingsManager from './settings-manager.js';
import * as UIManager from './ui-manager.js';
import * as RecordingsList from './recordings-list.js';
import * as Playback from './playback.js';
import * as TranscriptionViewer from './transcription-viewer.js';

// Store DOM elements
const elements = {
  // Status and visualization elements
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  audioVisualization: document.getElementById('audioVisualization'),
  duration: document.getElementById('duration'),
  source: document.getElementById('source'),
  
  // Recording control buttons
  tabButton: document.getElementById('tabButton'),
  screenButton: document.getElementById('screenButton'),
  startButton: document.getElementById('startButton'),
  pauseButton: document.getElementById('pauseButton'),
  stopButton: document.getElementById('stopButton'),
  
  // Settings elements
  settingsButton: document.getElementById('settingsButton'),
  settingsPanel: document.getElementById('settingsPanel'),
  saveSettingsButton: document.getElementById('saveSettingsButton'),
  audioQuality: document.getElementById('audioQuality'),
  automaticTranscription: document.getElementById('automaticTranscription'),
  speakerIdentification: document.getElementById('speakerIdentification'),
  saveRecordings: document.getElementById('saveRecordings'),
  
  // Panel navigation
  minimizeButton: document.getElementById('minimizeButton'),
  recordingsButton: document.getElementById('recordingsButton'),
  dashboardButton: document.getElementById('dashboardButton'),
  mainPanel: document.getElementById('mainPanel'),
  recordingsListPanel: document.getElementById('recordingsListPanel'),
  backToMainButton: document.getElementById('backToMainButton'),
  
  // Recordings list elements
  recordingsListContainer: document.getElementById('recordingsListContainer'),
  searchInput: document.getElementById('searchInput'),
  titleFilterButton: document.getElementById('titleFilterButton'),
  titleFilterDropdown: document.getElementById('titleFilterDropdown'),
  startDateFilter: document.getElementById('startDateFilter'),
  endDateFilter: document.getElementById('endDateFilter'),
  clearDatesButton: document.getElementById('clearDatesButton'),
  
  // Audio playback
  audioPlayer: document.getElementById('audioPlayer')
};

/**
 * Initialize the popup interface
 */
function initializePopup() {
  console.log('Initializing popup modules');
  
  // Initialize visualization
  VisualizationModule.initializeVisualization();
  
  // Initialize recording controller
  RecordingController.initialize(elements, handleRecordingStateChange);
  
  // Initialize settings manager
  SettingsManager.initialize(elements);
  
  // Initialize UI manager
  UIManager.initialize(elements);
  
  // Initialize recordings list
  RecordingsList.initialize(elements, {
    onPlay: handlePlayRecording,
    onDelete: handleDeleteRecording,
    onView: handleViewTranscription
  });
  
  // Initialize playback
  Playback.initialize(elements);
  
  // Initialize transcription viewer
  TranscriptionViewer.initialize();
  
  // Set up navigation
  setupNavigation();
  
  // Check if we should show the recordings panel by default
  checkInitialView();
  
  // Send message to background to get current state
  requestStateFromBackground();
}

/**
 * Set up navigation between panels
 */
function setupNavigation() {
  // Set up recordings button
  if (elements.recordingsButton) {
    elements.recordingsButton.addEventListener('click', () => {
      UIManager.showPanel(UIManager.PANELS.RECORDINGS);
      RecordingsList.loadAndDisplayRecordings();
    });
  }
  
  // Set up dashboard button
  if (elements.dashboardButton) {
    elements.dashboardButton.addEventListener('click', UIManager.openDashboard);
  }
}

/**
 * Check if we should show a specific view initially
 * Based on URL parameters or other conditions
 */
function checkInitialView() {
  if (window.location.href.includes('view=recordings')) {
    UIManager.showPanel(UIManager.PANELS.RECORDINGS);
    RecordingsList.loadAndDisplayRecordings();
  }
}

/**
 * Request current state from background
 */
function requestStateFromBackground() {
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting state:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.state) {
      // Update UI based on state
      UIManager.updateUIFromState(response.state);
    }
  });
}

/**
 * Handle recording state changes
 * @param {string} newState - New recording state
 */
function handleRecordingStateChange(newState) {
  console.log('Recording state changed:', newState);
  
  // Additional state change handling can be added here
  // This is a hook for any cross-module coordination
}

/**
 * Handle request to play a recording
 * @param {string} recordingId - Recording ID to play
 */
function handlePlayRecording(recordingId) {
  Playback.playRecording(recordingId);
}

/**
 * Handle request to delete a recording
 * @param {string} recordingId - Recording ID to delete
 */
function handleDeleteRecording(recordingId) {
  TranscriptionViewer.deleteRecording(recordingId);
}

/**
 * Handle request to view a transcription
 * @param {string} recordingId - Recording ID to view transcription for
 */
function handleViewTranscription(recordingId) {
  TranscriptionViewer.showTranscription(recordingId);
}

// Expose certain functions globally for message handling
window.updateRecordingState = RecordingController.updateRecordingState;
window.setSource = RecordingController.setSource;
window.updateDuration = RecordingController.updateDuration;
window.loadAndDisplayRecordings = RecordingsList.loadAndDisplayRecordings;

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePopup);

// Set up message listener for communication from background or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in main.js:', message);
  
  if (message.action === 'recordingCompleted') {
    RecordingController.handleRecordingCompleted(message.data);
    // Immediately load recordings to refresh the UI
    if (UIManager.getCurrentPanel() === UIManager.PANELS.RECORDINGS) {
      RecordingsList.loadAndDisplayRecordings();
    }
    sendResponse({ success: true });
    return true;
  }
  
  // New handler for notifyPopup from content script or service worker
  if (message.action === 'notifyPopup') {
    console.log('Notification received in popup:', message.data);
    
    if (message.data && message.data.type === 'recordingSaved') {
      // A new recording was saved, refresh recordings list if visible
      if (UIManager.getCurrentPanel() === UIManager.PANELS.RECORDINGS) {
        RecordingsList.loadAndDisplayRecordings();
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Required for async response
  return true;
});
